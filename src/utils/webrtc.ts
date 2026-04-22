// ═══════════════════════════════════════════════════════════════════════
// WebRTC Peer-to-Peer Calling Service for ethniCity Messages
// ═══════════════════════════════════════════════════════════════════════
// Uses WebRTC with Firestore signaling for 1:1 audio & video calls.
// All media streams are encrypted via SRTP (built into WebRTC).
//
// Architecture:
//  - Firestore document per call for signaling (SDP offer/answer + ICE)
//  - Google STUN servers for NAT traversal
//  - MediaStream API for camera/microphone access
//  - RTCPeerConnection for peer-to-peer media transport
// ═══════════════════════════════════════════════════════════════════════

import {
  doc, setDoc, updateDoc, onSnapshot, collection, query, where,
  addDoc, getDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

// ─── Configuration ───────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Free TURN servers for NAT traversal (needed for symmetric NATs / mobile networks)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const CALL_TIMEOUT_MS = 45_000; // 45 seconds to answer

// ─── Types ───────────────────────────────────────────────────────────

export type CallType = 'audio' | 'video';

export type CallStatus =
  | 'idle'
  | 'calling'     // Outgoing: waiting for peer to answer
  | 'ringing'     // Incoming: ringing on our side
  | 'connecting'  // SDP exchange done, ICE connecting
  | 'connected'   // Media flowing
  | 'ended';      // Call ended

export interface CallState {
  status: CallStatus;
  callId: string | null;
  callType: CallType;
  peerId: string | null;
  peerName: string | null;
  isCaller: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  duration: number;
  error: string | null;
}

export type CallStateListener = (state: CallState) => void;

/** Fired when a call ends — used to write system messages to the chat */
export interface CallEndedEvent {
  callId: string;
  callType: CallType;
  peerId: string;
  peerName: string;
  isCaller: boolean;
  endReason: string; // 'ended' | 'timeout' | 'rejected' | 'connection_lost' | 'cancelled'
  duration: number;  // seconds (0 for missed/rejected)
}
export type CallEndedListener = (event: CallEndedEvent) => void;

// ─── WebRTC Call Manager ─────────────────────────────────────────────

export class CallManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private unsubscribers: Array<() => void> = [];
  private callTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private durationIntervalId: ReturnType<typeof setInterval> | null = null;
  private ringAudio: HTMLAudioElement | null = null;
  private listeners: Set<CallStateListener> = new Set();
  private callEndedListeners: Set<CallEndedListener> = new Set();
  // ICE candidate buffer — holds candidates received before remote description is set
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  // Guard against endCall being called multiple times concurrently
  private endingCall = false;
  // Dedup: track callIds for which we already fired the ended event
  private firedEndedCallIds: Set<string> = new Set();
  // Track current camera facing mode (getSettings() is unreliable on some devices)
  private currentFacingMode: 'user' | 'environment' = 'user';
  // Adaptive bitrate monitoring
  private bitrateIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastBytesReceived = 0;
  private lastTimestamp = 0;

  private state: CallState = {
    status: 'idle',
    callId: null,
    callType: 'audio',
    peerId: null,
    peerName: null,
    isCaller: false,
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isVideoOff: false,
    duration: 0,
    error: null,
  };

  // ── State Management ─────────────────────────────────────────────

  getState(): CallState {
    return { ...this.state };
  }

  subscribe(listener: CallStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  /** Register a listener for when calls end (for writing chat messages) */
  onCallEnded(listener: CallEndedListener): () => void {
    this.callEndedListeners.add(listener);
    return () => this.callEndedListeners.delete(listener);
  }

  private setState(partial: Partial<CallState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((fn) => fn(this.getState()));
  }

  // ── Media Helpers ────────────────────────────────────────────────

  private async getMedia(callType: CallType): Promise<MediaStream> {
    // Cross-browser: Check mediaDevices API availability (iOS Safari, older Firefox)
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone/camera access not supported in your browser. Please use a modern browser like Chrome, Safari 14+, or Firefox.');
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === 'video' ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: 'user',
      } : false,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  private stopMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => t.stop());
      this.remoteStream = null;
    }
  }

  // ── ICE Candidate Buffering ──────────────────────────────────────

  /**
   * Add an ICE candidate, buffering it if remote description isn't set yet.
   * This prevents the common WebRTC failure where candidates arrive before
   * the SDP answer/offer is applied.
   */
  private async addIceCandidateSafe(candidateInit: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return;
    if (this.remoteDescriptionSet) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (err) {
        console.warn('Failed to add ICE candidate:', err);
      }
    } else {
      // Buffer until remote description is set
      this.pendingIceCandidates.push(candidateInit);
    }
  }

  /** Flush all buffered ICE candidates after remote description is set */
  private async flushIceCandidates(): Promise<void> {
    if (!this.pc) return;
    this.remoteDescriptionSet = true;
    const candidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];
    for (const c of candidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.warn('Failed to flush buffered ICE candidate:', err);
      }
    }
  }

  // ── Peer Connection Setup ────────────────────────────────────────

  private createPeerConnection(callId: string, isCaller: boolean): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Reset ICE buffer for new connection
    this.pendingIceCandidates = [];
    this.remoteDescriptionSet = false;

    // Set up remote stream — use event.track directly (more reliable than event.streams)
    this.remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack fired, kind:', event.track.kind, 'readyState:', event.track.readyState);
      this.remoteStream!.addTrack(event.track);
      // Create a new MediaStream reference so React detects the state change
      // (adding tracks to the same object doesn't trigger re-renders)
      const newStream = new MediaStream(this.remoteStream!.getTracks());
      this.remoteStream = newStream;
      this.setState({ remoteStream: newStream });

      // Safari: tracks can arrive in 'live' state but not fire 'unmute' events
      // Listen for track unmute/ended to re-trigger state update
      event.track.onunmute = () => {
        console.log('[WebRTC] Track unmuted:', event.track.kind);
        const refreshedStream = new MediaStream(this.remoteStream!.getTracks());
        this.remoteStream = refreshedStream;
        this.setState({ remoteStream: refreshedStream });
      };

      // Safari: handle track termination to refresh stream reference
      event.track.onended = () => {
        console.log('[WebRTC] Track ended:', event.track.kind);
        if (this.remoteStream) {
          const refreshedStream = new MediaStream(this.remoteStream.getTracks().filter(t => t.readyState === 'live'));
          this.remoteStream = refreshedStream;
          this.setState({ remoteStream: refreshedStream });
        }
      };
    };

    // Send ICE candidates to Firestore
    const candidateCollection = isCaller ? 'callerCandidates' : 'calleeCandidates';
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(
          collection(db, 'calls', callId, candidateCollection),
          event.candidate.toJSON()
        ).catch((err) => console.error('[WebRTC] Failed to send ICE candidate:', err));
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', pc.iceGatheringState);
    };

    // Track connection state
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.setState({ status: 'connected' });
        this.startDurationTimer();
        this.startAdaptiveBitrate();
        this.stopRingtone();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.endCall('connection_lost');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      // Fallback for browsers (especially Safari) where onconnectionstatechange
      // doesn't reliably fire 'connected'. ICE 'connected' or 'completed' means
      // media is flowing — treat it the same as peer connection 'connected'.
      if (
        (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') &&
        this.state.status !== 'connected'
      ) {
        console.log('[WebRTC] ICE connected/completed — promoting to connected status');
        this.setState({ status: 'connected' });
        this.startDurationTimer();
        this.startAdaptiveBitrate();
        this.stopRingtone();
      } else if (pc.iceConnectionState === 'failed') {
        // ICE failed — try to restart
        console.warn('[WebRTC] ICE failed, ending call');
        this.endCall('connection_lost');
      } else if (pc.iceConnectionState === 'disconnected') {
        // Give it a moment to recover
        setTimeout(() => {
          if (this.pc && this.pc.iceConnectionState === 'disconnected') {
            this.endCall('connection_lost');
          }
        }, 5000);
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling state:', pc.signalingState);
    };

    return pc;
  }

  // ── Initiate Call (Caller) ───────────────────────────────────────

  async startCall(
    myUid: string,
    myName: string,
    peerId: string,
    peerName: string,
    callType: CallType
  ): Promise<void> {
    if (this.state.status !== 'idle') {
      throw new Error('Already in a call');
    }

    try {
      // Get media first so user sees permission prompt before call starts
      this.localStream = await this.getMedia(callType);

      // Create call document
      const callDocRef = doc(collection(db, 'calls'));
      const callId = callDocRef.id;

      this.setState({
        status: 'calling',
        callId,
        callType,
        peerId,
        peerName,
        isCaller: true,
        localStream: this.localStream,
        remoteStream: null,
        isMuted: false,
        isVideoOff: false,
        duration: 0,
        error: null,
      });

      // Create peer connection and add local tracks
      this.pc = this.createPeerConnection(callId, true);
      this.localStream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, this.localStream!);
      });

      // Create SDP offer
      // Safari: explicitly request audio/video receive capabilities
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });
      await this.pc.setLocalDescription(offer);

      // Write call document to Firestore (this signals the callee)
      await setDoc(callDocRef, {
        callerId: myUid,
        calleeId: peerId,
        callerName: myName,
        callType,
        status: 'ringing',
        offer: { type: offer.type, sdp: offer.sdp },
        answer: null,
        createdAt: serverTimestamp(),
        endedAt: null,
        endReason: null,
      });

      console.log('[WebRTC] Call created:', callId);

      // Listen for answer from callee
      const unsubCall = onSnapshot(doc(db, 'calls', callId), async (snap) => {
        const data = snap.data();
        if (!data) return;

        if (data.status === 'ended' || data.status === 'rejected' || data.status === 'missed') {
          this.endCall(data.endReason || data.status);
          return;
        }

        if (data.answer && this.pc && !this.pc.currentRemoteDescription) {
          try {
            console.log('[WebRTC] Received answer, setting remote description');
            await this.pc.setRemoteDescription(data.answer);
            // Flush any buffered ICE candidates now that remote description is set
            await this.flushIceCandidates();
            this.setState({ status: 'connecting' });
          } catch (err) {
            console.error('[WebRTC] Failed to set remote description:', err);
          }
        }
      }, (error) => {
        console.error('[WebRTC] Call listener error:', error);
      });
      this.unsubscribers.push(unsubCall);

      // Listen for callee ICE candidates
      const unsubCandidates = onSnapshot(
        collection(db, 'calls', callId, 'calleeCandidates'),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              console.log('[WebRTC] Received callee ICE candidate');
              this.addIceCandidateSafe(change.doc.data() as RTCIceCandidateInit);
            }
          });
        },
        (error) => {
          console.error('[WebRTC] Callee candidates listener error:', error);
        }
      );
      this.unsubscribers.push(unsubCandidates);

      // Set timeout for unanswered call
      this.callTimeoutId = setTimeout(() => {
        if (this.state.status === 'calling') {
          this.endCall('timeout');
        }
      }, CALL_TIMEOUT_MS);

      this.playRingtone();

    } catch (err) {
      console.error('[WebRTC] Failed to start call:', err);
      this.cleanup();
      this.setState({
        status: 'idle',
        error: err instanceof Error ? err.message : 'Failed to start call',
      });
      throw err;
    }
  }

  // ── Answer Call (Callee) ─────────────────────────────────────────

  async answerCall(callId: string, callType: CallType): Promise<void> {
    if (this.state.status !== 'ringing') {
      throw new Error('No incoming call to answer');
    }

    try {
      this.localStream = await this.getMedia(callType);
      this.setState({
        status: 'connecting',
        localStream: this.localStream,
      });

      // Create peer connection and add local tracks
      this.pc = this.createPeerConnection(callId, false);
      this.localStream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, this.localStream!);
      });

      // Start listening for caller ICE candidates EARLY (before setting remote desc)
      // so candidates get buffered and flushed after remote description is set
      const unsubCandidates = onSnapshot(
        collection(db, 'calls', callId, 'callerCandidates'),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              console.log('[WebRTC] Received caller ICE candidate');
              this.addIceCandidateSafe(change.doc.data() as RTCIceCandidateInit);
            }
          });
        }
      );
      this.unsubscribers.push(unsubCandidates);

      // Listen for call status changes (ended by caller)
      const unsubCall = onSnapshot(doc(db, 'calls', callId), (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.status === 'ended') {
          this.endCall(data.endReason || 'ended');
        }
      });
      this.unsubscribers.push(unsubCall);

      // Fetch the call document to get the offer (direct read, not snapshot)
      const callSnap = await getDoc(doc(db, 'calls', callId));
      const callData = callSnap.data();
      if (!callData?.offer) {
        throw new Error('No offer found in call document');
      }

      // Set the offer as remote description
      console.log('[WebRTC] Setting offer as remote description');
      await this.pc.setRemoteDescription(callData.offer);

      // Now flush any ICE candidates that arrived while we were setting up
      await this.flushIceCandidates();

      // Create and send answer
      console.log('[WebRTC] Creating answer');
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      // Write answer to Firestore
      await updateDoc(doc(db, 'calls', callId), {
        answer: { type: answer.type, sdp: answer.sdp },
        status: 'connected',
      });

      console.log('[WebRTC] Answer sent to Firestore');

      this.stopRingtone();

    } catch (err) {
      console.error('[WebRTC] Failed to answer call:', err);
      this.cleanup();
      this.setState({
        status: 'idle',
        error: err instanceof Error ? err.message : 'Failed to answer call',
      });
      throw err;
    }
  }

  // ── Incoming Call Detection ──────────────────────────────────────

  listenForIncomingCalls(
    myUid: string,
    onIncoming: (callId: string, callerName: string, callType: CallType) => void
  ): () => void {
    const q = query(
      collection(db, 'calls'),
      where('calleeId', '==', myUid)
    );
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.status === 'ringing' && this.state.status === 'idle') {
            // Check if call is still fresh (not older than timeout)
            const createdAt = data.createdAt as Timestamp | null;
            if (createdAt) {
              const age = Date.now() - createdAt.toMillis();
              if (age > CALL_TIMEOUT_MS) return; // Stale call
            }

            this.setState({
              status: 'ringing',
              callId: change.doc.id,
              callType: data.callType,
              peerId: data.callerId,
              peerName: data.callerName,
              isCaller: false,
              isMuted: false,
              isVideoOff: false,
              duration: 0,
              error: null,
            });

            this.playRingtone();
            onIncoming(change.doc.id, data.callerName, data.callType);
          }
        }
      });
    });

    return unsub;
  }

  // ── Call Controls ────────────────────────────────────────────────

  toggleMute(): void {
    if (!this.localStream) return;
    const audioTracks = this.localStream.getAudioTracks();
    const newMuted = !this.state.isMuted;
    audioTracks.forEach((t) => { t.enabled = !newMuted; });
    this.setState({ isMuted: newMuted });
  }

  toggleVideo(): void {
    if (!this.localStream) return;
    const videoTracks = this.localStream.getVideoTracks();
    const newOff = !this.state.isVideoOff;
    videoTracks.forEach((t) => { t.enabled = !newOff; });
    this.setState({ isVideoOff: newOff });
  }

  async switchCamera(): Promise<void> {
    if (!this.localStream || !this.pc) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    // Use tracked facing mode (getSettings().facingMode is unreliable on many devices)
    const newFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    console.log('[WebRTC] Switching camera from', this.currentFacingMode, 'to', newFacingMode);

    try {
      // Cross-browser: Verify mediaDevices is still available
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera switching not supported in your browser');
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: newFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace the track on the RTCPeerConnection sender
      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      // Update the local stream
      this.localStream.removeTrack(videoTrack);
      videoTrack.stop();
      this.localStream.addTrack(newVideoTrack);
      this.currentFacingMode = newFacingMode;

      // Create new reference so React detects the change
      const updatedStream = new MediaStream(this.localStream.getTracks());
      this.localStream = updatedStream;
      this.setState({ localStream: updatedStream });
    } catch (err) {
      console.error('[WebRTC] Failed to switch camera:', err);
      // If { exact } fails (device has only one camera), try without exact
      try {
        const fallback = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacingMode },
        });
        const newVideoTrack = fallback.getVideoTracks()[0];
        const sender = this.pc!.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(newVideoTrack);
        this.localStream!.removeTrack(videoTrack);
        videoTrack.stop();
        this.localStream!.addTrack(newVideoTrack);
        this.currentFacingMode = newFacingMode;
        const updatedStream = new MediaStream(this.localStream!.getTracks());
        this.localStream = updatedStream;
        this.setState({ localStream: updatedStream });
      } catch {
        console.warn('[WebRTC] Device may only have one camera');
      }
    }
  }

  // ── End Call ─────────────────────────────────────────────────────

  async endCall(reason: string = 'ended'): Promise<void> {
    const { callId, status, callType, peerId, peerName, isCaller, duration } = this.state;

    if (status === 'idle' || status === 'ended') return;
    // Prevent re-entrant calls (UI click + Firestore snapshot echo + timeout)
    if (this.endingCall) return;
    this.endingCall = true;

    // Update Firestore call status
    if (callId) {
      try {
        const endStatus = reason === 'rejected' ? 'rejected'
          : reason === 'timeout' ? 'missed'
          : 'ended';
        await updateDoc(doc(db, 'calls', callId), {
          status: endStatus,
          endedAt: serverTimestamp(),
          endReason: reason,
        });
      } catch (err) {
        console.error('[WebRTC] Failed to update call status:', err);
      }
    }

    // Fire call-ended event for chat message logging (ONCE per callId)
    if (callId && peerId && !this.firedEndedCallIds.has(callId)) {
      this.firedEndedCallIds.add(callId);
      // Clean up after 60s to prevent memory leak
      setTimeout(() => this.firedEndedCallIds.delete(callId), 60_000);
      const event: CallEndedEvent = {
        callId,
        callType,
        peerId,
        peerName: peerName || 'Unknown',
        isCaller,
        endReason: reason,
        duration,
      };
      this.callEndedListeners.forEach((fn) => {
        try { fn(event); } catch (err) { console.error('[WebRTC] callEnded listener error:', err); }
      });
    }

    this.cleanup();
    this.setState({
      status: 'ended',
      localStream: null,
      remoteStream: null,
    });

    // Reset to idle after brief delay
    setTimeout(() => {
      this.endingCall = false;
      this.setState({
        status: 'idle',
        callId: null,
        peerId: null,
        peerName: null,
        duration: 0,
        error: null,
      });
    }, 2000);
  }

  async rejectCall(): Promise<void> {
    this.stopRingtone();
    await this.endCall('rejected');
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  private cleanup() {
    this.stopMedia();
    this.pendingIceCandidates = [];
    this.remoteDescriptionSet = false;

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];

    if (this.callTimeoutId) {
      clearTimeout(this.callTimeoutId);
      this.callTimeoutId = null;
    }
    if (this.durationIntervalId) {
      clearInterval(this.durationIntervalId);
      this.durationIntervalId = null;
    }
    if (this.bitrateIntervalId) {
      clearInterval(this.bitrateIntervalId);
      this.bitrateIntervalId = null;
    }

    this.stopRingtone();
  }

  // ── Duration Timer ───────────────────────────────────────────────

  private startDurationTimer() {
    if (this.durationIntervalId) return;
    const startTime = Date.now();
    this.durationIntervalId = setInterval(() => {
      this.setState({ duration: Math.floor((Date.now() - startTime) / 1000) });
    }, 1000);
  }

  // ── Adaptive Bitrate ──────────────────────────────────────────────

  private startAdaptiveBitrate() {
    if (this.bitrateIntervalId || this.state.callType !== 'video') return;
    this.lastBytesReceived = 0;
    this.lastTimestamp = Date.now();

    this.bitrateIntervalId = setInterval(async () => {
      if (!this.pc) return;
      try {
        const stats = await this.pc.getStats();
        let currentBytes = 0;
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            currentBytes = report.bytesReceived || 0;
          }
        });

        const now = Date.now();
        const elapsed = (now - this.lastTimestamp) / 1000;
        if (elapsed > 0 && this.lastBytesReceived > 0) {
          const bitrateKbps = ((currentBytes - this.lastBytesReceived) * 8) / elapsed / 1000;

          // Adjust outgoing video quality based on observed incoming bitrate
          const sender = this.pc?.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            const params = sender.getParameters();
            if (params.encodings && params.encodings.length > 0) {
              if (bitrateKbps < 100) {
                // Very poor connection — limit to 150kbps, reduce resolution
                params.encodings[0].maxBitrate = 150_000;
                params.encodings[0].scaleResolutionDownBy = 4;
                console.log('[WebRTC] Adaptive: Poor connection, reducing to 150kbps');
              } else if (bitrateKbps < 300) {
                // Moderate connection — limit to 400kbps
                params.encodings[0].maxBitrate = 400_000;
                params.encodings[0].scaleResolutionDownBy = 2;
                console.log('[WebRTC] Adaptive: Moderate connection, 400kbps');
              } else {
                // Good connection — allow full quality
                params.encodings[0].maxBitrate = 1_500_000;
                delete params.encodings[0].scaleResolutionDownBy;
              }
              await sender.setParameters(params);
            }
          }
        }
        this.lastBytesReceived = currentBytes;
        this.lastTimestamp = now;
      } catch (err) {
        // Stats not available — ignore
      }
    }, 5000); // Check every 5 seconds
  }

  // ── Ringtone ─────────────────────────────────────────────────────

  private playRingtone() {
    try {
      this.stopRingtone();
      // Safari requires AudioContext to be created/resumed from a user gesture.
      // Use webkitAudioContext fallback for older Safari.
      const AudioCtx = (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext || AudioContext;
      const ctx = new AudioCtx();
      // Safari: resume() must be called to unlock suspended AudioContext
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const playBeep = () => {
        if (!this.ringAudio) return;
        // Safari: re-check context state and resume if needed
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
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
      // Audio not available
    }
  }

  private stopRingtone() {
    if (this.ringAudio) {
      const interval = (this.ringAudio as unknown as Record<string, unknown>)._interval as ReturnType<typeof setInterval>;
      if (interval) clearInterval(interval);
      this.ringAudio = null;
    }
  }

  // ── Destroy ──────────────────────────────────────────────────────

  destroy() {
    this.cleanup();
    this.listeners.clear();
    this.callEndedListeners.clear();
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────

let _instance: CallManager | null = null;

export function getCallManager(): CallManager {
  if (!_instance) {
    _instance = new CallManager();
  }
  return _instance;
}

// ─── Utility ─────────────────────────────────────────────────────────

export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
