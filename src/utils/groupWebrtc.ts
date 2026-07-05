// ═══════════════════════════════════════════════════════════════════════
// Group WebRTC Mesh Calling Service for eNoVo Messages
// ═══════════════════════════════════════════════════════════════════════
// Extends the WebRTC architecture for multi-party (up to 8 participants)
// using mesh topology — each participant maintains a peer connection to
// every other participant. Firestore-based signaling.
//
// Architecture:
//  - Firestore `groupCalls/{roomId}` document for room metadata
//  - Per-pair signaling via `groupCalls/{roomId}/signals/{pairId}` docs
//  - ICE candidates in subcollections under each signal doc
//  - Each participant creates offers to all existing participants on join
//  - Screen sharing via getDisplayMedia(), track replacement on all peers
// ═══════════════════════════════════════════════════════════════════════

import {
  doc, setDoc, updateDoc, onSnapshot, collection, query, where,
  addDoc, getDoc, getDocs, deleteDoc, serverTimestamp, Timestamp,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { ICE_SERVERS } from '@/utils/iceConfig';

// ─── Configuration ───────────────────────────────────────────────────

// ICE/TURN servers are centralized in src/utils/iceConfig.ts (env-driven TURN
// with a public dev fallback). Imported as ICE_SERVERS above.

const MAX_PARTICIPANTS = 8;
const RING_TIMEOUT_MS = 45_000;

// ─── Types ───────────────────────────────────────────────────────────

export type GroupCallType = 'audio' | 'video';

export type GroupCallStatus =
  | 'idle'
  | 'ringing'     // Incoming group call — being alerted, not yet joined
  | 'joining'     // Acquiring media, setting up connections
  | 'connected'   // In the call
  | 'ended';      // Left or call ended

export interface GroupParticipant {
  uid: string;
  name: string;
  joinedAt: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

export interface PeerConnection {
  uid: string;
  name: string;
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  pendingIceCandidates: RTCIceCandidateInit[];
  remoteDescriptionSet: boolean;
}

export interface GroupCallState {
  status: GroupCallStatus;
  roomId: string | null;
  conversationId: string | null;
  callType: GroupCallType;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isScreenSharing: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  participants: GroupParticipant[];
  peers: Map<string, { remoteStream: MediaStream; name: string }>;
  duration: number;
  error: string | null;
  // Incoming-call ring metadata (populated only while status === 'ringing')
  incomingRoomId: string | null;
  incomingFromName: string | null;
  incomingCallType: GroupCallType | null;
  incomingConversationId: string | null;
}

export type GroupCallStateListener = (state: GroupCallState) => void;

export interface GroupCallEndedEvent {
  roomId: string;
  conversationId: string;
  callType: GroupCallType;
  duration: number;
  participantCount: number;
  isRoomEnded: boolean; // true only when last participant leaves (room is fully ended)
}
export type GroupCallEndedListener = (event: GroupCallEndedEvent) => void;

// ─── Firestore Schema ────────────────────────────────────────────────
//
// groupCalls/{roomId}
//   conversationId: string
//   createdBy: string
//   callType: 'audio' | 'video'
//   status: 'active' | 'ended'
//   participants: string[]  (array of UIDs currently in call)
//   participantNames: { [uid]: string }
//   participantStates: { [uid]: { isMuted, isVideoOff, isScreenSharing } }
//   createdAt: Timestamp
//   endedAt: Timestamp | null
//
// groupCalls/{roomId}/signals/{senderUid}_{receiverUid}
//   offer: { type, sdp }
//   answer: { type, sdp }
//
// groupCalls/{roomId}/signals/{senderUid}_{receiverUid}/candidates/{id}
//   candidate: string
//   sdpMid: string
//   sdpMLineIndex: number
//   from: string  (uid of sender)
// ─────────────────────────────────────────────────────────────────────

// ─── Group Call Manager ──────────────────────────────────────────────

export class GroupCallManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, PeerConnection> = new Map();
  private unsubscribers: Array<() => void> = [];
  private durationIntervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<GroupCallStateListener> = new Set();
  private callEndedListeners: Set<GroupCallEndedListener> = new Set();

  // ─── Incoming-call ring state ──────────────────────────────────────
  private ringAudio: HTMLAudioElement | null = null;
  private ringTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private incomingUnsub: (() => void) | null = null;
  // roomIds we've already accepted/declined/handled — never re-ring for them.
  private handledIncomingRooms: Set<string> = new Set();
  // Context needed to join the call we're currently ringing for.
  private pendingIncoming: { roomId: string; myUid: string; myName: string } | null = null;

  private state: GroupCallState = {
    status: 'idle',
    roomId: null,
    conversationId: null,
    callType: 'audio',
    localStream: null,
    screenStream: null,
    isScreenSharing: false,
    isMuted: false,
    isVideoOff: false,
    participants: [],
    peers: new Map(),
    duration: 0,
    error: null,
    incomingRoomId: null,
    incomingFromName: null,
    incomingCallType: null,
    incomingConversationId: null,
  };

  private myUid: string = '';
  private myName: string = '';
  private connectedAt: number = 0;

  // ─── Observer pattern ──────────────────────────────────────────────

  subscribe(listener: GroupCallStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  onCallEnded(listener: GroupCallEndedListener): () => void {
    this.callEndedListeners.add(listener);
    return () => this.callEndedListeners.delete(listener);
  }

  private emit() {
    // Rebuild peers map from live connections
    const peers = new Map<string, { remoteStream: MediaStream; name: string }>();
    this.peerConnections.forEach((pc, uid) => {
      peers.set(uid, { remoteStream: pc.remoteStream, name: pc.name });
    });
    this.state = { ...this.state, peers };
    this.listeners.forEach((l) => l(this.state));
  }

  private setState(partial: Partial<GroupCallState>) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  getState(): GroupCallState {
    return this.state;
  }

  // ─── Start / Create a group call ──────────────────────────────────

  async startCall(
    conversationId: string,
    callType: GroupCallType,
    myUid: string,
    myName: string,
    memberUids: string[] = [],
  ): Promise<string> {
    if (this.state.status !== 'idle') {
      throw new Error('Already in a call');
    }
    this.myUid = myUid;
    this.myName = myName;

    this.setState({
      status: 'joining',
      callType,
      conversationId,
      error: null,
    });

    try {
      // Cross-browser: Check mediaDevices API availability (iOS Safari, older Firefox)
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone/camera access not supported in your browser');
      }

      // Acquire local media
      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: callType === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create room in Firestore
      const roomId = `gc_${conversationId}_${Date.now()}`;
      const roomRef = doc(db, 'groupCalls', roomId);
      // memberUids = everyone in the group (so absent members can be rung via a
      // Firestore array-contains query + a Cloud Function push). Always include
      // the creator. De-duplicated.
      const allMemberUids = Array.from(new Set([myUid, ...memberUids]));
      await setDoc(roomRef, {
        conversationId,
        createdBy: myUid,
        createdByName: myName,
        memberUids: allMemberUids,
        callType,
        status: 'active',
        participants: [myUid],
        participantNames: { [myUid]: myName },
        participantStates: {
          [myUid]: { isMuted: false, isVideoOff: false, isScreenSharing: false },
        },
        createdAt: serverTimestamp(),
        endedAt: null,
      });

      this.connectedAt = Date.now();
      this.setState({
        status: 'connected',
        roomId,
        localStream: this.localStream,
        participants: [{
          uid: myUid, name: myName, joinedAt: Date.now(),
          isMuted: false, isVideoOff: false, isScreenSharing: false,
        }],
      });

      // Start duration timer
      this.startDurationTimer();

      // Listen for participants joining/leaving
      this.listenForParticipants(roomId);

      // Listen for incoming signals from new participants
      this.listenForSignals(roomId);

      this.handledIncomingRooms.add(roomId);
      console.log('[GroupCall] Created room:', roomId);
      return roomId;

    } catch (err) {
      console.error('[GroupCall] startCall error:', err);
      this.setState({
        status: 'idle',
        error: err instanceof Error ? err.message : 'Failed to start group call',
      });
      this.cleanup();
      throw err;
    }
  }

  // ─── Join an existing group call ──────────────────────────────────

  async joinCall(
    roomId: string,
    myUid: string,
    myName: string,
  ): Promise<void> {
    if (this.state.status !== 'idle') {
      throw new Error('Already in a call');
    }
    this.myUid = myUid;
    this.myName = myName;
    this.handledIncomingRooms.add(roomId);

    this.setState({ status: 'joining', roomId, error: null });

    try {
      // Get room info
      const roomRef = doc(db, 'groupCalls', roomId);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) throw new Error('Call room not found');

      const roomData = roomSnap.data();
      if (roomData.status === 'ended') throw new Error('Call has already ended');
      if ((roomData.participants || []).length >= MAX_PARTICIPANTS) {
        throw new Error(`Call is full (max ${MAX_PARTICIPANTS} participants)`);
      }

      const callType = roomData.callType as GroupCallType;

      // Cross-browser: Check mediaDevices API availability (iOS Safari, older Firefox)
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone/camera access not supported in your browser');
      }

      // Acquire local media
      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: callType === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Add ourselves to the room
      await updateDoc(roomRef, {
        participants: arrayUnion(myUid),
        [`participantNames.${myUid}`]: myName,
        [`participantStates.${myUid}`]: { isMuted: false, isVideoOff: false, isScreenSharing: false },
      });

      this.connectedAt = Date.now();
      this.setState({
        status: 'connected',
        callType,
        conversationId: roomData.conversationId,
        localStream: this.localStream,
      });

      // Start duration timer
      this.startDurationTimer();

      // Listen for participants
      this.listenForParticipants(roomId);

      // Listen for signals
      this.listenForSignals(roomId);

      // Create offers to all existing participants
      const existingParticipants = (roomData.participants || []).filter((uid: string) => uid !== myUid);
      for (const peerUid of existingParticipants) {
        const peerName = roomData.participantNames?.[peerUid] || 'Unknown';
        await this.createOffer(roomId, peerUid, peerName);
      }

      console.log('[GroupCall] Joined room:', roomId, 'existing peers:', existingParticipants.length);

    } catch (err) {
      console.error('[GroupCall] joinCall error:', err);
      this.setState({
        status: 'idle',
        error: err instanceof Error ? err.message : 'Failed to join group call',
      });
      this.cleanup();
      throw err;
    }
  }

  // ─── Create peer connection + offer to a specific participant ─────

  private async createOffer(roomId: string, peerUid: string, peerName: string): Promise<void> {
    console.log('[GroupCall] Creating offer to:', peerUid);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remoteStream = new MediaStream();
    const peerConn: PeerConnection = {
      uid: peerUid,
      name: peerName,
      pc,
      remoteStream,
      pendingIceCandidates: [],
      remoteDescriptionSet: false,
    };
    this.peerConnections.set(peerUid, peerConn);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('[GroupCall] Remote track from', peerUid, event.track.kind);
      event.streams[0]?.getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      this.emit();
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log('[GroupCall] Connection state with', peerUid, ':', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.removePeer(peerUid);
      }
    };

    // Signal path: signals/{myUid}_{peerUid}
    const signalId = `${this.myUid}_${peerUid}`;
    const signalRef = doc(db, 'groupCalls', roomId, 'signals', signalId);

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, 'groupCalls', roomId, 'signals', signalId, 'candidates'), {
          ...event.candidate.toJSON(),
          from: this.myUid,
        }).catch((err) => console.error('[GroupCall] ICE candidate write error:', err));
      }
    };

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(signalRef, {
      offer: { type: offer.type, sdp: offer.sdp },
      answer: null,
      from: this.myUid,
      to: peerUid,
      createdAt: serverTimestamp(),
    });

    // Listen for answer on this signal doc
    const unsubAnswer = onSnapshot(signalRef, (snap) => {
      const data = snap.data();
      if (data?.answer && !peerConn.remoteDescriptionSet) {
        console.log('[GroupCall] Received answer from', peerUid);
        pc.setRemoteDescription(data.answer)
          .then(() => {
            peerConn.remoteDescriptionSet = true;
            // Flush buffered ICE candidates
            peerConn.pendingIceCandidates.forEach((c) => {
              pc.addIceCandidate(new RTCIceCandidate(c)).catch((e) =>
                console.error('[GroupCall] Flush ICE error:', e));
            });
            peerConn.pendingIceCandidates = [];
          })
          .catch((err) => console.error('[GroupCall] setRemoteDescription error:', err));
      }
    }, (error) => {
      console.error('[GroupCall] Signal answer listener error:', error);
    });
    this.unsubscribers.push(unsubAnswer);

    // Listen for ICE candidates from peer (on our signal doc)
    const unsubCandidates = onSnapshot(
      collection(db, 'groupCalls', roomId, 'signals', signalId, 'candidates'),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.from !== this.myUid) {
              const candidate: RTCIceCandidateInit = {
                candidate: data.candidate,
                sdpMid: data.sdpMid,
                sdpMLineIndex: data.sdpMLineIndex,
              };
              if (peerConn.remoteDescriptionSet) {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) =>
                  console.error('[GroupCall] addIceCandidate error:', e));
              } else {
                peerConn.pendingIceCandidates.push(candidate);
              }
            }
          }
        });
      },
      (error) => {
        console.error('[GroupCall] Candidates listener error:', error);
      }
    );
    this.unsubscribers.push(unsubCandidates);

    // Also listen on the reverse signal doc for candidates from peer
    const reverseSignalId = `${peerUid}_${this.myUid}`;
    const unsubReverseCandidates = onSnapshot(
      collection(db, 'groupCalls', roomId, 'signals', reverseSignalId, 'candidates'),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.from !== this.myUid) {
              const candidate: RTCIceCandidateInit = {
                candidate: data.candidate,
                sdpMid: data.sdpMid,
                sdpMLineIndex: data.sdpMLineIndex,
              };
              if (peerConn.remoteDescriptionSet) {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) =>
                  console.error('[GroupCall] addIceCandidate error:', e));
              } else {
                peerConn.pendingIceCandidates.push(candidate);
              }
            }
          }
        });
      }
    );
    this.unsubscribers.push(unsubReverseCandidates);

    this.emit();
  }

  // ─── Handle incoming offer from a new participant ─────────────────

  private async handleIncomingOffer(
    roomId: string,
    signalId: string,
    fromUid: string,
    fromName: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    console.log('[GroupCall] Handling incoming offer from:', fromUid);

    // Don't create duplicate connections
    if (this.peerConnections.has(fromUid)) {
      console.log('[GroupCall] Already have connection to', fromUid, '— skipping');
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remoteStream = new MediaStream();
    const peerConn: PeerConnection = {
      uid: fromUid,
      name: fromName,
      pc,
      remoteStream,
      pendingIceCandidates: [],
      remoteDescriptionSet: false,
    };
    this.peerConnections.set(fromUid, peerConn);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('[GroupCall] Remote track from', fromUid, event.track.kind);
      event.streams[0]?.getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      this.emit();
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log('[GroupCall] Connection state with', fromUid, ':', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.removePeer(fromUid);
      }
    };

    // ICE candidates — write to the SAME signal doc (offerer's doc)
    const signalRef = doc(db, 'groupCalls', roomId, 'signals', signalId);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, 'groupCalls', roomId, 'signals', signalId, 'candidates'), {
          ...event.candidate.toJSON(),
          from: this.myUid,
        }).catch((err) => console.error('[GroupCall] ICE candidate write error:', err));
      }
    };

    // Set remote description (offer), create answer
    await pc.setRemoteDescription(offer);
    peerConn.remoteDescriptionSet = true;

    // Flush any buffered candidates
    peerConn.pendingIceCandidates.forEach((c) => {
      pc.addIceCandidate(new RTCIceCandidate(c)).catch((e) =>
        console.error('[GroupCall] Flush ICE error:', e));
    });
    peerConn.pendingIceCandidates = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Write answer back to the signal doc
    await updateDoc(signalRef, {
      answer: { type: answer.type, sdp: answer.sdp },
    });

    // Listen for ICE candidates on this signal doc
    const unsubCandidates = onSnapshot(
      collection(db, 'groupCalls', roomId, 'signals', signalId, 'candidates'),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.from !== this.myUid) {
              const candidate: RTCIceCandidateInit = {
                candidate: data.candidate,
                sdpMid: data.sdpMid,
                sdpMLineIndex: data.sdpMLineIndex,
              };
              if (peerConn.remoteDescriptionSet) {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) =>
                  console.error('[GroupCall] addIceCandidate error:', e));
              } else {
                peerConn.pendingIceCandidates.push(candidate);
              }
            }
          }
        });
      }
    );
    this.unsubscribers.push(unsubCandidates);

    this.emit();
  }

  // ─── Listen for new signals (offers from joining participants) ────

  private listenForSignals(roomId: string) {
    const signalsRef = collection(db, 'groupCalls', roomId, 'signals');
    const unsub = onSnapshot(signalsRef, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const signalId = change.doc.id;

          // Only handle signals addressed TO us that have an offer but no answer yet
          if (data.to === this.myUid && data.offer && !data.answer) {
            const fromUid = data.from;
            const fromName = this.state.participants.find((p) => p.uid === fromUid)?.name || 'Unknown';
            await this.handleIncomingOffer(roomId, signalId, fromUid, fromName, data.offer);
          }
        }
      });
    });
    this.unsubscribers.push(unsub);
  }

  // ─── Listen for participant changes in the room ───────────────────

  private listenForParticipants(roomId: string) {
    const roomRef = doc(db, 'groupCalls', roomId);
    const unsub = onSnapshot(roomRef, (snap) => {
      const data = snap.data();
      if (!data) return;

      // Update participants list
      const participantUids: string[] = data.participants || [];
      const participantNames: Record<string, string> = data.participantNames || {};
      const participantStates: Record<string, { isMuted: boolean; isVideoOff: boolean; isScreenSharing: boolean }> = data.participantStates || {};

      const participants: GroupParticipant[] = participantUids.map((uid) => ({
        uid,
        name: participantNames[uid] || 'Unknown',
        joinedAt: 0,
        isMuted: participantStates[uid]?.isMuted || false,
        isVideoOff: participantStates[uid]?.isVideoOff || false,
        isScreenSharing: participantStates[uid]?.isScreenSharing || false,
      }));

      this.setState({ participants });

      // If room ended, leave
      if (data.status === 'ended') {
        this.leaveCall();
      }

      // Clean up peer connections for participants who left
      this.peerConnections.forEach((_, uid) => {
        if (!participantUids.includes(uid)) {
          this.removePeer(uid);
        }
      });
    });
    this.unsubscribers.push(unsub);
  }

  // ─── Remove a peer connection ─────────────────────────────────────

  private removePeer(uid: string) {
    const peer = this.peerConnections.get(uid);
    if (peer) {
      console.log('[GroupCall] Removing peer:', uid);
      peer.pc.close();
      this.peerConnections.delete(uid);
      this.emit();
    }
  }

  // ─── Leave the call ───────────────────────────────────────────────

  async leaveCall(): Promise<void> {
    if (this.state.status === 'idle') return;

    const { roomId, conversationId, callType, duration, participants } = this.state;

    console.log('[GroupCall] Leaving call:', roomId);

    // Remove ourselves from Firestore room
    let isRoomEnded = false;
    if (roomId) {
      try {
        const roomRef = doc(db, 'groupCalls', roomId);
        await updateDoc(roomRef, {
          participants: arrayRemove(this.myUid),
          [`participantStates.${this.myUid}`]: null,
        });

        // If we're the last participant, end the room
        const roomSnap = await getDoc(roomRef);
        const roomData = roomSnap.data();
        const remaining = (roomData?.participants || []).filter((uid: string) => uid !== this.myUid);
        if (remaining.length === 0) {
          isRoomEnded = true;
          await updateDoc(roomRef, {
            status: 'ended',
            endedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('[GroupCall] Error updating room on leave:', err);
      }
    }

    // Fire ended event
    if (roomId && conversationId) {
      this.callEndedListeners.forEach((l) => l({
        roomId,
        conversationId,
        callType,
        duration,
        participantCount: participants.length,
        isRoomEnded,
      }));
    }

    this.cleanup();
    this.setState({
      status: 'idle',
      roomId: null,
      conversationId: null,
      localStream: null,
      screenStream: null,
      isScreenSharing: false,
      isMuted: false,
      isVideoOff: false,
      participants: [],
      duration: 0,
      error: null,
    });
  }

  // ─── Toggle mute ──────────────────────────────────────────────────

  toggleMute(): boolean {
    if (!this.localStream) return this.state.isMuted;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const isMuted = !audioTrack.enabled;
      this.setState({ isMuted });
      this.updateMyState({ isMuted });
      return isMuted;
    }
    return this.state.isMuted;
  }

  // ─── Toggle video ─────────────────────────────────────────────────

  toggleVideo(): boolean {
    if (!this.localStream) return this.state.isVideoOff;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const isVideoOff = !videoTrack.enabled;
      this.setState({ isVideoOff });
      this.updateMyState({ isVideoOff });
      return isVideoOff;
    }
    return this.state.isVideoOff;
  }

  // ─── Screen sharing ───────────────────────────────────────────────

  async toggleScreenShare(): Promise<boolean> {
    if (this.state.isScreenSharing) {
      // Stop screen share — revert to camera
      this.stopScreenShare();
      return false;
    }

    try {
      // Cross-browser: Check getDisplayMedia API availability (Firefox, iOS Safari don't support it)
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing not supported in your browser');
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      this.screenStream = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track on all peer connections
      this.peerConnections.forEach((peer) => {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack).catch((err) =>
            console.error('[GroupCall] replaceTrack error:', err));
        }
      });

      // Listen for screen share ending (user clicks "Stop sharing")
      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      this.setState({ isScreenSharing: true, screenStream });
      this.updateMyState({ isScreenSharing: true });
      return true;

    } catch (err) {
      console.error('[GroupCall] Screen share error:', err);
      return false;
    }
  }

  private stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    // Revert to camera track on all peers
    const cameraTrack = this.localStream?.getVideoTracks()[0];
    if (cameraTrack) {
      this.peerConnections.forEach((peer) => {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(cameraTrack).catch((err) =>
            console.error('[GroupCall] revert track error:', err));
        }
      });
    }

    this.setState({ isScreenSharing: false, screenStream: null });
    this.updateMyState({ isScreenSharing: false });
  }

  // ─── Camera flip ──────────────────────────────────────────────────

  async flipCamera(): Promise<void> {
    if (!this.localStream || this.state.isScreenSharing) return;

    try {
      // Cross-browser: Check mediaDevices API availability before flipping camera
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera switching not supported in your browser');
      }

      const currentTrack = this.localStream.getVideoTracks()[0];
      const currentFacing = currentTrack?.getSettings()?.facingMode || 'user';
      const newFacing = currentFacing === 'user' ? 'environment' : 'user';

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const newTrack = newStream.getVideoTracks()[0];

      // Replace on local stream
      if (currentTrack) {
        this.localStream.removeTrack(currentTrack);
        currentTrack.stop();
      }
      this.localStream.addTrack(newTrack);

      // Replace on all peers
      this.peerConnections.forEach((peer) => {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newTrack).catch((err) =>
            console.error('[GroupCall] flip camera replaceTrack error:', err));
        }
      });

      this.emit();
    } catch (err) {
      console.error('[GroupCall] flipCamera error:', err);
    }
  }

  // ─── Update my state in Firestore ─────────────────────────────────

  private updateMyState(partial: Partial<{ isMuted: boolean; isVideoOff: boolean; isScreenSharing: boolean }>) {
    const { roomId } = this.state;
    if (!roomId) return;
    const updates: Record<string, unknown> = {};
    Object.entries(partial).forEach(([key, value]) => {
      updates[`participantStates.${this.myUid}.${key}`] = value;
    });
    updateDoc(doc(db, 'groupCalls', roomId), updates).catch((err) =>
      console.error('[GroupCall] updateMyState error:', err));
  }

  // ─── Duration timer ───────────────────────────────────────────────

  private startDurationTimer() {
    this.durationIntervalId = setInterval(() => {
      if (this.connectedAt > 0) {
        this.setState({ duration: Math.floor((Date.now() - this.connectedAt) / 1000) });
      }
    }, 1000);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  private cleanup() {
    // Stop all Firestore listeners
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    // Close all peer connections
    this.peerConnections.forEach((peer) => peer.pc.close());
    this.peerConnections.clear();

    // Stop local media
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;

    // Stop duration timer
    if (this.durationIntervalId) {
      clearInterval(this.durationIntervalId);
      this.durationIntervalId = null;
    }

    // Stop any ring in progress
    this.stopRingtone();
    if (this.ringTimeoutId) { clearTimeout(this.ringTimeoutId); this.ringTimeoutId = null; }

    this.connectedAt = 0;
  }

  // ─── Incoming group-call ring (mirrors the 1:1 CallManager) ───────
  //
  // A group call has no single "callee", so we ring every member. The room doc
  // carries `memberUids`; this listener fires an in-app ring on any active call
  // in a group the user belongs to (foreground). A Cloud Function sends a push
  // for the backgrounded/closed case (see functions/src/index.ts).

  listenForIncomingGroupCalls(
    myUid: string,
    myName: string,
    onIncoming: (roomId: string, callType: GroupCallType, fromName: string, conversationId: string) => void,
  ): () => void {
    // Tear down any previous listener (e.g. on user change).
    if (this.incomingUnsub) { this.incomingUnsub(); this.incomingUnsub = null; }

    const q = query(
      collection(db, 'groupCalls'),
      where('memberUids', 'array-contains', myUid),
      where('status', '==', 'active'),
    );

    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        const roomId = change.doc.id;
        const data = change.doc.data();

        if (change.type === 'added') {
          // Skip if: I'm busy, it's my own call, I've already handled it, or I'm
          // already listed as a participant (joined on another session/device).
          if (this.state.status !== 'idle') return;
          if (data.createdBy === myUid) return;
          if (this.handledIncomingRooms.has(roomId)) return;
          if ((data.participants || []).includes(myUid)) return;

          // Skip stale rings (older than the ring timeout).
          const createdAt = data.createdAt as Timestamp | null;
          if (createdAt && Date.now() - createdAt.toMillis() > RING_TIMEOUT_MS) return;

          const callType = (data.callType as GroupCallType) || 'audio';
          const fromName = (data.createdByName as string) || 'Someone';
          const conversationId = (data.conversationId as string) || '';

          this.pendingIncoming = { roomId, myUid, myName };
          this.setState({
            status: 'ringing',
            incomingRoomId: roomId,
            incomingFromName: fromName,
            incomingCallType: callType,
            incomingConversationId: conversationId,
          });
          this.playRingtone();

          // Auto-dismiss the ring after the timeout if unanswered.
          if (this.ringTimeoutId) clearTimeout(this.ringTimeoutId);
          this.ringTimeoutId = setTimeout(() => {
            if (this.state.status === 'ringing' && this.state.incomingRoomId === roomId) {
              this.handledIncomingRooms.add(roomId);
              this.dismissRing();
            }
          }, RING_TIMEOUT_MS);

          onIncoming(roomId, callType, fromName, conversationId);
        } else if (change.type === 'modified') {
          // If the call we're ringing for ends, dismiss the ring.
          if (this.state.status === 'ringing' && this.state.incomingRoomId === roomId && data.status === 'ended') {
            this.handledIncomingRooms.add(roomId);
            this.dismissRing();
          }
        } else if (change.type === 'removed') {
          if (this.state.status === 'ringing' && this.state.incomingRoomId === roomId) {
            this.handledIncomingRooms.add(roomId);
            this.dismissRing();
          }
        }
      });
    }, (error) => {
      console.error('[GroupCall] Incoming-call listener error:', error);
    });

    this.incomingUnsub = unsub;
    return () => {
      unsub();
      if (this.incomingUnsub === unsub) this.incomingUnsub = null;
    };
  }

  // Accept the currently-ringing incoming group call → join its room.
  async acceptIncoming(): Promise<void> {
    if (this.state.status !== 'ringing' || !this.pendingIncoming) return;
    const { roomId, myUid, myName } = this.pendingIncoming;
    this.handledIncomingRooms.add(roomId);
    this.stopRingtone();
    if (this.ringTimeoutId) { clearTimeout(this.ringTimeoutId); this.ringTimeoutId = null; }
    this.pendingIncoming = null;
    // Reset to idle so joinCall's guard passes, then join.
    this.setState({
      status: 'idle',
      incomingRoomId: null,
      incomingFromName: null,
      incomingCallType: null,
      incomingConversationId: null,
    });
    await this.joinCall(roomId, myUid, myName);
  }

  // Decline / dismiss the currently-ringing incoming group call (local only).
  declineIncoming(): void {
    if (this.state.status !== 'ringing') return;
    if (this.state.incomingRoomId) this.handledIncomingRooms.add(this.state.incomingRoomId);
    this.dismissRing();
  }

  // Clear ring state back to idle (shared by decline / timeout / room-ended).
  private dismissRing(): void {
    this.stopRingtone();
    if (this.ringTimeoutId) { clearTimeout(this.ringTimeoutId); this.ringTimeoutId = null; }
    this.pendingIncoming = null;
    this.setState({
      status: 'idle',
      incomingRoomId: null,
      incomingFromName: null,
      incomingCallType: null,
      incomingConversationId: null,
    });
  }

  // ─── Ringtone (mirrors CallManager) ───────────────────────────────

  private playRingtone(): void {
    try {
      this.stopRingtone();
      const AudioCtx = (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext || AudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const playBeep = () => {
        if (!this.ringAudio) return;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.value = 0.15;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.2);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      };
      this.ringAudio = new Audio();
      playBeep();
      const interval = setInterval(() => {
        if (!this.ringAudio) { clearInterval(interval); return; }
        playBeep();
      }, 2000);
      (this.ringAudio as unknown as Record<string, unknown>)._interval = interval;
    } catch {
      // Audio not available — ringtone is best-effort.
    }
  }

  private stopRingtone(): void {
    if (this.ringAudio) {
      const interval = (this.ringAudio as unknown as Record<string, unknown>)._interval as ReturnType<typeof setInterval>;
      if (interval) clearInterval(interval);
      this.ringAudio = null;
    }
  }

  // ─── Check for active group call in a conversation ────────────────

  static async getActiveCall(conversationId: string): Promise<string | null> {
    const q = query(
      collection(db, 'groupCalls'),
      where('conversationId', '==', conversationId),
      where('status', '==', 'active'),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].id;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────

let groupCallManagerInstance: GroupCallManager | null = null;

export function getGroupCallManager(): GroupCallManager {
  if (!groupCallManagerInstance) {
    groupCallManagerInstance = new GroupCallManager();
  }
  return groupCallManagerInstance;
}
