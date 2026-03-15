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
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
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
      console.log('[WebRTC] ontrack fired, kind:', event.track.kind);
      this.remoteStream!.addTrack(event.track);
      this.setState({ remoteStream: this.remoteStream });
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
        this.stopRingtone();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.endCall('connection_lost');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
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
      const offer = await this.pc.createOffer();
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
            const answer = new RTCSessionDescription(data.answer);
            await this.pc.setRemoteDescription(answer);
            // Flush any buffered ICE candidates now that remote description is set
            await this.flushIceCandidates();
            this.setState({ status: 'connecting' });
          } catch (err) {
            console.error('[WebRTC] Failed to set remote description:', err);
          }
        }
      });
      this.unsubscribers.push(unsubCall);

      // Listen for callee ICE candidates
      const unsubCandidates = onSnapshot(
        collection(db, 'calls', callId, 'calleeCandidates'),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              this.addIceCandidateSafe(change.doc.data() as RTCIceCandidateInit);
            }
          });
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

      // Fetch the call document to get the offer (direct read, not snapshot)
      const callSnap = await getDoc(doc(db, 'calls', callId));
      const callData = callSnap.data();
      if (!callData?.offer) {
        throw new Error('No offer found in call document');
      }

      // Set the offer as remote description
      console.log('[WebRTC] Setting offer as remote description');
      const offer = new RTCSessionDescription(callData.offer);
      await this.pc.setRemoteDescription(offer);

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

      // Listen for call status changes (ended by caller)
      const unsubCall = onSnapshot(doc(db, 'calls', callId), (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.status === 'ended') {
          this.endCall(data.endReason || 'ended');
        }
      });
      this.unsubscribers.push(unsubCall);

      // Listen for caller ICE candidates (buffer-safe)
      const unsubCandidates = onSnapshot(
        collection(db, 'calls', callId, 'callerCandidates'),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              this.addIceCandidateSafe(change.doc.data() as RTCIceCandidateInit);
            }
          });
        }
      );
      this.unsubscribers.push(unsubCandidates);

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

    const currentFacingMode = videoTrack.getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      this.localStream.removeTrack(videoTrack);
      videoTrack.stop();
      this.localStream.addTrack(newVideoTrack);
      this.setState({ localStream: this.localStream });
    } catch (err) {
      console.error('[WebRTC] Failed to switch camera:', err);
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

    // Fire call-ended event for chat message logging
    if (callId && peerId) {
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

  // ── Ringtone ─────────────────────────────────────────────────────

  private playRingtone() {
    try {
      this.stopRingtone();
      const ctx = new AudioContext();
      const playBeep = () => {
        if (!this.ringAudio) return;
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
