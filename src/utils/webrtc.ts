// ═══════════════════════════════════════════════════════════════════════
// WebRTC Peer-to-Peer Calling Service for eNoVo Messages
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
import { ICE_SERVERS } from '@/utils/iceConfig';

// ─── Configuration ───────────────────────────────────────────────────

// ICE/TURN servers are centralized in src/utils/iceConfig.ts (env-driven TURN
// with a public dev fallback). Imported as ICE_SERVERS above.

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
  // ── Connection-recovery state (Bug 5: call drops after a threshold) ──
  // True once the call has reached 'connected' at least once. Used to tell
  // setup churn apart from a real mid-call disconnect.
  private connectionEstablished = false;
  // Grace timer: if a disconnect doesn't recover within the window, end the call.
  private disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;
  // Guards re-entrant ICE restarts.
  private iceRestartInProgress = false;
  // Dedup guard for the callee processing the same restart offer twice.
  private lastHandledRestartSdp: string | null = null;

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
    // Reset connection-recovery state (Bug 5)
    this.connectionEstablished = false;
    this.iceRestartInProgress = false;
    this.lastHandledRestartSdp = null;
    if (this.disconnectGraceTimer) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }

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

    // Track connection state. Both connectionState and iceConnectionState feed
    // the same recovery logic (Safari fires one but not the other reliably).
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.handleConnected();
      } else if (pc.connectionState === 'failed') {
        this.handleConnectionTrouble('failed');
      } else if (pc.connectionState === 'disconnected') {
        this.handleConnectionTrouble('disconnected');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      const s = pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') {
        this.handleConnected();
      } else if (s === 'failed') {
        this.handleConnectionTrouble('failed');
      } else if (s === 'disconnected') {
        this.handleConnectionTrouble('disconnected');
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling state:', pc.signalingState);
    };

    return pc;
  }

  // ── Connection Recovery (Bug 5) ──────────────────────────────────

  /** Media is flowing — promote to connected and cancel any pending teardown. */
  private handleConnected(): void {
    if (this.disconnectGraceTimer) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }
    this.iceRestartInProgress = false;
    this.connectionEstablished = true;
    if (this.state.status !== 'connected') {
      console.log('[WebRTC] Connected — media flowing');
      this.setState({ status: 'connected' });
      this.startDurationTimer();
      this.startAdaptiveBitrate();
      this.stopRingtone();
    }
  }

  /**
   * A disconnect/failure occurred. Instead of dropping the call immediately,
   * attempt an ICE restart (re-allocates TURN relays / re-gathers candidates)
   * and only end the call if it doesn't recover within a grace window.
   */
  private handleConnectionTrouble(kind: 'disconnected' | 'failed'): void {
    // Ignore churn before we ever connected — except a hard 'failed' during
    // setup, which won't fix itself.
    if (!this.connectionEstablished) {
      if (kind === 'failed') this.scheduleEndIfStillBroken(6000);
      return;
    }
    console.warn('[WebRTC]', kind, 'after connect — attempting recovery (no immediate drop)');
    void this.attemptIceRestart();
    // 'failed' is more severe than 'disconnected'; give disconnected longer to self-heal.
    this.scheduleEndIfStillBroken(kind === 'failed' ? 12_000 : 15_000);
  }

  /** End the call after `ms` unless the connection has recovered by then. */
  private scheduleEndIfStillBroken(ms: number): void {
    if (this.disconnectGraceTimer) return; // already counting down
    this.disconnectGraceTimer = setTimeout(() => {
      this.disconnectGraceTimer = null;
      const ice = this.pc?.iceConnectionState;
      const conn = this.pc?.connectionState;
      const healthy = ice === 'connected' || ice === 'completed' || conn === 'connected';
      if (!healthy) {
        console.warn('[WebRTC] Recovery window elapsed, still unhealthy — ending call');
        this.endCall('connection_lost');
      }
    }, ms);
  }

  /**
   * Caller-initiated ICE restart over the existing Firestore signaling channel.
   * Writes a `restartOffer`; the callee answers with `restartAnswer` (handled in
   * the call-doc listeners). Only the caller initiates to avoid glare.
   */
  private async attemptIceRestart(): Promise<void> {
    if (!this.pc || !this.state.isCaller || !this.state.callId) return;
    if (this.iceRestartInProgress) return;
    this.iceRestartInProgress = true;
    try {
      console.log('[WebRTC] Initiating ICE restart (caller)');
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      // Remote description will be re-applied from restartAnswer; buffer ICE until then.
      this.remoteDescriptionSet = false;
      await updateDoc(doc(db, 'calls', this.state.callId), {
        restartOffer: { type: offer.type, sdp: offer.sdp },
        restartAnswer: null,
      });
    } catch (err) {
      console.error('[WebRTC] ICE restart offer failed:', err);
      this.iceRestartInProgress = false;
    }
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

        // ICE restart answer from the callee (Bug 5 recovery)
        if (data.restartAnswer && this.pc && this.iceRestartInProgress) {
          try {
            console.log('[WebRTC] Received restart answer — re-establishing media');
            await this.pc.setRemoteDescription(data.restartAnswer);
            await this.flushIceCandidates();
            this.iceRestartInProgress = false;
          } catch (err) {
            console.error('[WebRTC] Failed to apply restart answer:', err);
            this.iceRestartInProgress = false;
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

      // Listen for call status changes (ended by caller) + ICE-restart offers
      const unsubCall = onSnapshot(doc(db, 'calls', callId), async (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.status === 'ended') {
          this.endCall(data.endReason || 'ended');
          return;
        }
        // Caller initiated an ICE restart (Bug 5 recovery) — answer the new offer.
        const restartOffer = data.restartOffer as RTCSessionDescriptionInit | undefined;
        if (
          restartOffer && this.pc &&
          restartOffer.sdp && restartOffer.sdp !== this.lastHandledRestartSdp
        ) {
          this.lastHandledRestartSdp = restartOffer.sdp;
          try {
            console.log('[WebRTC] Applying ICE restart offer (callee)');
            this.remoteDescriptionSet = false;
            await this.pc.setRemoteDescription(restartOffer);
            await this.flushIceCandidates();
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            await updateDoc(doc(db, 'calls', callId), {
              restartAnswer: { type: answer.type, sdp: answer.sdp },
            });
          } catch (err) {
            console.error('[WebRTC] Failed to apply restart offer:', err);
          }
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
        const data = change.doc.data();
        const docId = change.doc.id;

        if (change.type === 'added') {
          if (data.status === 'ringing' && this.state.status === 'idle') {
            // Check if call is still fresh (not older than timeout)
            const createdAt = data.createdAt as Timestamp | null;
            if (createdAt) {
              const age = Date.now() - createdAt.toMillis();
              if (age > CALL_TIMEOUT_MS) return; // Stale call
            }

            this.setState({
              status: 'ringing',
              callId: docId,
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
            onIncoming(docId, data.callerName, data.callType);
          }
        } else if (change.type === 'modified') {
          // Only react to the call THIS session is currently showing. Before the
          // callee answers, this global listener is the ONLY thing watching the
          // call doc, so it must handle terminal transitions (Bug 9).
          if (this.state.callId !== docId) return;
          const status = data.status;

          if (status === 'ended' || status === 'rejected' || status === 'missed') {
            // Caller hung up / cancelled / call was declined → tear down here too.
            // endCall safely handles both a ringing-only session and an active one.
            if (this.state.status !== 'idle' && this.state.status !== 'ended') {
              this.endCall(data.endReason || status);
            }
          } else if (status === 'connected' && this.state.status === 'ringing') {
            // The call was answered on ANOTHER of this user's sessions/devices.
            // Stop ringing here and clear the incoming UI — but do NOT call
            // endCall (that would mark the live call ended for the real answerer).
            this.stopRingtone();
            this.setState({
              status: 'idle',
              callId: null,
              peerId: null,
              peerName: null,
              duration: 0,
              error: null,
            });
          }
        } else if (change.type === 'removed') {
          // Call doc deleted while we were showing it → tear down.
          if (this.state.callId === docId &&
              this.state.status !== 'idle' && this.state.status !== 'ended') {
            this.endCall('ended');
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
    const oldTrack = this.localStream.getVideoTracks()[0];
    if (!oldTrack) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn('[WebRTC] Camera switching not supported in this browser');
      return;
    }

    // Flip only makes sense with 2+ cameras (mobile front/back). On single-camera
    // devices — most desktops (Chrome/Safari/Firefox) — skip so we don't pointlessly
    // stop and restart the only camera (which would flicker/freeze the preview).
    // enumerateDevices is cross-browser; labels/count are available mid-call.
    try {
      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === 'videoinput');
        if (cameras.length < 2) {
          console.log('[WebRTC] Single camera — flip skipped');
          return;
        }
      }
    } catch {
      // enumerate failed — proceed; getUserMedia fallbacks below will handle it.
    }

    // Use tracked facing mode (getSettings().facingMode is unreliable on many devices)
    const prevFacingMode = this.currentFacingMode;
    const newFacingMode: 'user' | 'environment' = prevFacingMode === 'user' ? 'environment' : 'user';
    console.log('[WebRTC] Switching camera from', prevFacingMode, 'to', newFacingMode);

    // CROSS-PLATFORM FIX (Bug 2): most ANDROID devices cannot open a second
    // camera while the first is still active — getUserMedia throws
    // NotReadableError ("Could not start video source"). iOS Safari and desktop
    // allow concurrent access, which is why flip worked there but not on Android
    // browsers. So we STOP and release the current camera BEFORE requesting the
    // new one. The brief freeze during the switch is expected and acceptable.
    this.localStream.removeTrack(oldTrack);
    oldTrack.stop();

    const acquire = (facing: 'user' | 'environment', exact: boolean): Promise<MediaStream> =>
      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: exact ? { exact: facing } : facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

    try {
      let stream: MediaStream;
      try {
        stream = await acquire(newFacingMode, true);
      } catch (exactErr) {
        // Some devices reject { exact } — retry with a soft facingMode preference.
        console.warn('[WebRTC] exact facingMode failed, retrying soft:', exactErr);
        stream = await acquire(newFacingMode, false);
      }
      await this.attachNewVideoTrack(stream.getVideoTracks()[0], newFacingMode);
    } catch (err) {
      // The other camera couldn't be opened (e.g. single-camera device). Restore
      // the ORIGINAL camera so the user isn't left with a dead/black video.
      console.error('[WebRTC] Failed to open the other camera, restoring original:', err);
      try {
        const restored = await acquire(prevFacingMode, false);
        await this.attachNewVideoTrack(restored.getVideoTracks()[0], prevFacingMode);
      } catch (restoreErr) {
        console.error('[WebRTC] Could not restore camera after failed switch:', restoreErr);
      }
    }
  }

  /** Wire a freshly-acquired video track into the peer connection + local stream. */
  private async attachNewVideoTrack(
    track: MediaStreamTrack | undefined,
    facing: 'user' | 'environment'
  ): Promise<void> {
    if (!track || !this.pc || !this.localStream) {
      track?.stop();
      return;
    }
    // Respect a currently-toggled-off camera.
    track.enabled = !this.state.isVideoOff;

    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video') ||
      this.pc.getSenders().find((s) => s.track === null);
    if (sender) {
      await sender.replaceTrack(track);
    } else {
      this.pc.addTrack(track, this.localStream);
    }

    this.localStream.addTrack(track);
    this.currentFacingMode = facing;

    // New MediaStream reference so React re-attaches the self-view (Bug 2/4).
    const updatedStream = new MediaStream(this.localStream.getTracks());
    this.localStream = updatedStream;
    this.setState({ localStream: updatedStream });
  }

  // ── End Call ─────────────────────────────────────────────────────

  async endCall(reason: string = 'ended'): Promise<void> {
    const { callId, status, callType, peerId, peerName, isCaller, duration } = this.state;

    if (status === 'idle' || status === 'ended') return;
    // Prevent re-entrant calls (UI click + Firestore snapshot echo + timeout)
    if (this.endingCall) return;
    this.endingCall = true;

    // Signal the peer FIRST and do NOT await it. Awaiting the Firestore write
    // delayed local teardown AND pushed back when the other side learns the call
    // ended — adding visible hang-up latency on both ends. Fire-and-forget so the
    // peer's listener triggers as soon as possible.
    if (callId) {
      const endStatus = reason === 'rejected' ? 'rejected'
        : reason === 'timeout' ? 'missed'
        : 'ended';
      updateDoc(doc(db, 'calls', callId), {
        status: endStatus,
        endedAt: serverTimestamp(),
        endReason: reason,
      }).catch((err) => console.error('[WebRTC] Failed to update call status:', err));
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

    // Clear the "Call ended" screen quickly. Was 2000ms, which felt laggy on
    // teardown (especially on the receiver, on top of Firestore propagation).
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
    }, 700);
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
    if (this.disconnectGraceTimer) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }
    this.connectionEstablished = false;
    this.iceRestartInProgress = false;

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
        // intentional-suppression: resume() rejects with NotAllowedError when
        // called outside a user gesture (autoplay policy) — ringtone is best-effort.
        ctx.resume().catch(() => {});
      }
      const playBeep = () => {
        if (!this.ringAudio) return;
        // Safari: re-check context state and resume if needed
        if (ctx.state === 'suspended') {
          // intentional-suppression: resume() rejects with NotAllowedError outside
          // a user gesture (autoplay policy) — ringtone beep is best-effort.
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
