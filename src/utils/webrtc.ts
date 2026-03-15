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
  doc, setDoc, updateDoc, onSnapshot, collection,
  addDoc, getDocs, deleteDoc, serverTimestamp, Timestamp,
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
const RING_AUDIO_SRC = '/ring.mp3'; // Optional ringtone

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

// ─── Firestore Call Document Schema ──────────────────────────────────
// Path: calls/{callId}
// {
//   callerId: string,
//   calleeId: string,
//   callerName: string,
//   callType: 'audio' | 'video',
//   status: 'ringing' | 'connected' | 'ended' | 'missed' | 'rejected',
//   offer: RTCSessionDescriptionInit | null,
//   answer: RTCSessionDescriptionInit | null,
//   createdAt: Timestamp,
//   endedAt: Timestamp | null,
//   endReason: string | null,
// }
// ICE candidates: calls/{callId}/callerCandidates/{id}
//                 calls/{callId}/calleeCandidates/{id}

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

  // ── Peer Connection Setup ────────────────────────────────────────

  private createPeerConnection(callId: string, isCaller: boolean): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Set up remote stream
    this.remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream!.addTrack(track);
      });
      this.setState({ remoteStream: this.remoteStream });
    };

    // Send ICE candidates to Firestore
    const candidateCollection = isCaller ? 'callerCandidates' : 'calleeCandidates';
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(
          collection(db, 'calls', callId, candidateCollection),
          event.candidate.toJSON()
        ).catch(console.error);
      }
    };

    // Track connection state
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.setState({ status: 'connected' });
        this.startDurationTimer();
        this.stopRingtone();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.endCall('connection_lost');
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        // Give it a moment to recover before ending
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            this.endCall('connection_lost');
          }
        }, 5000);
      }
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

      // Listen for answer from callee
      const unsubCall = onSnapshot(doc(db, 'calls', callId), (snap) => {
        const data = snap.data();
        if (!data) return;

        if (data.status === 'ended' || data.status === 'rejected' || data.status === 'missed') {
          this.endCall(data.endReason || data.status);
          return;
        }

        if (data.answer && this.pc && !this.pc.currentRemoteDescription) {
          const answer = new RTCSessionDescription(data.answer);
          this.pc.setRemoteDescription(answer).then(() => {
            this.setState({ status: 'connecting' });
          }).catch(console.error);
        }
      });
      this.unsubscribers.push(unsubCall);

      // Listen for callee ICE candidates
      const unsubCandidates = onSnapshot(
        collection(db, 'calls', callId, 'calleeCandidates'),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added' && this.pc) {
              const candidate = new RTCIceCandidate(change.doc.data());
              this.pc.addIceCandidate(candidate).catch(console.error);
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
      console.error('Failed to start call:', err);
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

      // Get the call document to read the offer
      const unsubCall = onSnapshot(doc(db, 'calls', callId), async (snap) => {
        const data = snap.data();
        if (!data) return;

        if (data.status === 'ended') {
          this.endCall(data.endReason || 'ended');
          return;
        }

        // Set remote description (offer) if not yet set
        if (data.offer && this.pc && !this.pc.currentRemoteDescription) {
          const offer = new RTCSessionDescription(data.offer);
          await this.pc.setRemoteDescription(offer);

          // Create and send answer
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);

          await updateDoc(doc(db, 'calls', callId), {
            answer: { type: answer.type, sdp: answer.sdp },
            status: 'connected',
          });
        }
      });
      this.unsubscribers.push(unsubCall);

      // Listen for caller ICE candidates
      const unsubCandidates = onSnapshot(
        collection(db, 'calls', callId, 'callerCandidates'),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added' && this.pc) {
              const candidate = new RTCIceCandidate(change.doc.data());
              this.pc.addIceCandidate(candidate).catch(console.error);
            }
          });
        }
      );
      this.unsubscribers.push(unsubCandidates);

      this.stopRingtone();

    } catch (err) {
      console.error('Failed to answer call:', err);
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
    // We listen to the 'calls' collection for documents where we are the callee
    // and status is 'ringing'. We use onSnapshot for real-time.
    const q = collection(db, 'calls');
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (
            data.calleeId === myUid &&
            data.status === 'ringing' &&
            this.state.status === 'idle'
          ) {
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

      // Replace track in peer connection
      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      // Replace in local stream
      this.localStream.removeTrack(videoTrack);
      videoTrack.stop();
      this.localStream.addTrack(newVideoTrack);
      this.setState({ localStream: this.localStream });
    } catch (err) {
      console.error('Failed to switch camera:', err);
    }
  }

  // ── End Call ─────────────────────────────────────────────────────

  async endCall(reason: string = 'ended'): Promise<void> {
    const { callId, status } = this.state;

    if (status === 'idle' || status === 'ended') return;

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
        console.error('Failed to update call status:', err);
      }
    }

    this.cleanup();
    this.setState({
      status: 'ended',
      localStream: null,
      remoteStream: null,
    });

    // Reset to idle after brief delay
    setTimeout(() => {
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
    // Stop media
    this.stopMedia();

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Unsubscribe Firestore listeners
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];

    // Clear timers
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
      // Use a simple oscillator beep instead of an audio file (no dependency)
      this.stopRingtone();
      const ctx = new AudioContext();
      const playBeep = () => {
        if (!this.ringAudio) return; // stopped
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
      // Use a dummy audio element as a flag
      this.ringAudio = new Audio();
      playBeep();
      const interval = setInterval(() => {
        if (!this.ringAudio) { clearInterval(interval); return; }
        playBeep();
      }, 2000);
      (this.ringAudio as unknown as Record<string, unknown>)._interval = interval;
    } catch {
      // Audio not available — silent ringtone
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
