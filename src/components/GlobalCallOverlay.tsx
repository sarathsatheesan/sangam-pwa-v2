'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, addDoc, doc, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCallManager, formatCallDuration,
  type CallState, type CallType, type CallEndedEvent,
} from '@/utils/webrtc';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera,
  PhoneIncoming, X, Shield, Minimize2,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────

const generateConvId = (uid1: string, uid2: string): string =>
  [uid1, uid2].sort().join('__');

const formatMessageTime = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '';
  return ts.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

/** Safely play a media element — handles autoplay restrictions on all browsers */
const safePlay = async (el: HTMLMediaElement): Promise<void> => {
  try {
    await el.play();
  } catch {
    console.warn('[WebRTC] Autoplay blocked for', el.tagName);
  }
};

// ─── Component ─────────────────────────────────────────────────────

const GlobalCallOverlay: React.FC = () => {
  const { user } = useAuth();
  const callManagerRef = useRef(getCallManager());

  const [callState, setCallState] = useState<CallState>(getCallManager().getState());
  const [callMinimized, setCallMinimized] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Subscribe to call manager state changes
  useEffect(() => {
    const unsub = callManagerRef.current.subscribe((state) => setCallState(state));
    return unsub;
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!user?.uid) return;
    return callManagerRef.current.listenForIncomingCalls(
      user.uid,
      () => setCallMinimized(false)
    );
  }, [user?.uid]);

  // Write call event messages to chat when calls end
  useEffect(() => {
    if (!user?.uid) return;
    return callManagerRef.current.onCallEnded(async (event: CallEndedEvent) => {
      try {
        let eventType: 'missed' | 'completed' | 'rejected' | 'cancelled';
        if (event.endReason === 'timeout') eventType = event.isCaller ? 'cancelled' : 'missed';
        else if (event.endReason === 'rejected') eventType = 'rejected';
        else if (event.endReason === 'cancelled') eventType = 'cancelled';
        else if (event.duration > 0) eventType = 'completed';
        else eventType = event.isCaller ? 'cancelled' : 'missed';

        const convId = generateConvId(user.uid, event.peerId);
        const callLabel = event.callType === 'video' ? 'Video' : 'Voice';
        const textLabel = eventType === 'completed' ? `${callLabel} call`
          : eventType === 'missed' ? `Missed ${callLabel.toLowerCase()} call`
          : eventType === 'rejected' ? `Declined ${callLabel.toLowerCase()} call`
          : `Cancelled ${callLabel.toLowerCase()} call`;

        await addDoc(collection(db, 'conversations', convId, 'messages'), {
          text: textLabel, senderId: user.uid,
          time: formatMessageTime(Timestamp.now()), createdAt: serverTimestamp(),
          callEvent: { type: eventType, callType: event.callType, ...(event.duration > 0 ? { duration: event.duration } : {}) },
        });
        await setDoc(doc(db, 'conversations', convId), {
          lastMessage: textLabel, lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp(), lastMessageSenderId: user.uid,
          participants: [user.uid, event.peerId].sort(),
        }, { merge: true });
      } catch (err) {
        console.error('[CallEvent] Failed to write call event:', err);
      }
    });
  }, [user?.uid]);

  // ── Attach local video stream ──
  useEffect(() => {
    if (!localVideoRef.current || !callState.localStream) return;
    localVideoRef.current.srcObject = callState.localStream;
    safePlay(localVideoRef.current);
  }, [callState.localStream]);

  // ── Attach remote stream to audio + video ──
  useEffect(() => {
    if (!callState.remoteStream) return;
    const stream = callState.remoteStream;
    console.log('[WebRTC] Attaching remote:', stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', '));

    // AUDIO
    if (remoteAudioRef.current) {
      if (callState.callType === 'video') {
        const at = stream.getAudioTracks();
        if (at.length > 0) remoteAudioRef.current.srcObject = new MediaStream(at);
      } else {
        remoteAudioRef.current.srcObject = stream;
      }
      remoteAudioRef.current.muted = false;
      safePlay(remoteAudioRef.current);
    }

    // VIDEO
    if (callState.callType === 'video' && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.muted = true;
      safePlay(remoteVideoRef.current);
    }
  }, [callState.remoteStream, callState.callType]);

  // ── Retry playback on connected state (Safari is slow) ──
  useEffect(() => {
    if (callState.status !== 'connected') return;
    const retry = () => {
      const s = callManagerRef.current.getState();
      if (!s.remoteStream) return;
      if (remoteAudioRef.current) {
        if (!remoteAudioRef.current.srcObject) {
          remoteAudioRef.current.srcObject = s.callType === 'video'
            ? new MediaStream(s.remoteStream.getAudioTracks())
            : s.remoteStream;
        }
        remoteAudioRef.current.muted = false;
        safePlay(remoteAudioRef.current);
      }
      if (s.callType === 'video' && remoteVideoRef.current) {
        if (!remoteVideoRef.current.srcObject) remoteVideoRef.current.srcObject = s.remoteStream;
        remoteVideoRef.current.muted = true;
        safePlay(remoteVideoRef.current);
      }
      if (localVideoRef.current && s.localStream) {
        if (!localVideoRef.current.srcObject) localVideoRef.current.srcObject = s.localStream;
        safePlay(localVideoRef.current);
      }
    };
    retry();
    const t1 = setTimeout(retry, 500);
    const t2 = setTimeout(retry, 1500);
    const t3 = setTimeout(retry, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [callState.status]);

  // Reset minimized on end
  useEffect(() => {
    if (callState.status === 'idle' || callState.status === 'ended') setCallMinimized(false);
  }, [callState.status]);

  // Back button → minimize
  useEffect(() => {
    const active = callState.status !== 'idle' && callState.status !== 'ended';
    if (!active || callMinimized) return;
    window.history.pushState({ callActive: true }, '');
    const h = () => {
      const s = callManagerRef.current.getState().status;
      if (s !== 'idle' && s !== 'ended') setCallMinimized(true);
    };
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, [callState.status, callMinimized]);

  // ── Handlers ──
  const retryMedia = useCallback(() => {
    if (remoteAudioRef.current) { remoteAudioRef.current.muted = false; safePlay(remoteAudioRef.current); }
    if (remoteVideoRef.current) safePlay(remoteVideoRef.current);
    if (localVideoRef.current) safePlay(localVideoRef.current);
  }, []);

  const handleAnswerCall = async () => {
    if (!callState.callId) return;
    try {
      await callManagerRef.current.answerCall(callState.callId, callState.callType);
      setTimeout(retryMedia, 300);
      setTimeout(retryMedia, 1000);
      setTimeout(retryMedia, 2500);
    } catch (err) {
      console.error('Failed to answer:', err);
    }
  };

  const handleEndCall = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    console.log('[Call] End clicked, status:', callManagerRef.current.getState().status);
    callManagerRef.current.endCall('ended');
  };

  const handleRejectCall = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    callManagerRef.current.rejectCall();
  };

  // ── Derived state ──
  const isVideoCall = callState.callType === 'video';
  const hasRemoteVideo = callState.remoteStream?.getVideoTracks().some(t => t.readyState === 'live') ?? false;
  const showRemoteVideo = isVideoCall && (callState.status === 'connected' || hasRemoteVideo);

  if (callState.status === 'idle') return null;

  return (
    <>
      {/* Remote audio — NOT offscreen (some browsers mute offscreen audio) */}
      <audio ref={remoteAudioRef} autoPlay playsInline
        style={{ position: 'fixed', top: 0, left: 0, width: '1px', height: '1px', opacity: 0.01 }} />

      {/* Remote video — persistent element */}
      {isVideoCall && (
        <video ref={remoteVideoRef} autoPlay playsInline muted
          style={{
            position: 'fixed', zIndex: 10000, objectFit: 'cover',
            opacity: showRemoteVideo ? 1 : 0, pointerEvents: 'none',
            transition: 'opacity 0.3s',
            ...(callMinimized
              ? { bottom: '100px', right: '16px', width: '140px', height: '180px', borderRadius: '16px' }
              : { top: 0, left: 0, width: '100%', height: '100%', borderRadius: 0 }),
          }}
        />
      )}

      {/* ── PiP MODE ── */}
      {callMinimized ? (
        <div className="fixed bottom-20 right-4 z-[10001] rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
          style={{ width: isVideoCall ? '140px' : '200px', backgroundColor: '#1a1a2e', border: '2px solid rgba(99,102,241,0.5)' }}
          onClick={() => { setCallMinimized(false); retryMedia(); }}
        >
          {isVideoCall && (
            <div className="relative" style={{ height: '180px' }}>
              {!showRemoteVideo && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: '#6366F1' }}>
                  <span className="text-white text-2xl font-bold">{callState.peerName?.[0]?.toUpperCase() || '?'}</span>
                </div>
              )}
            </div>
          )}
          {!isVideoCall && (
            <div className="px-3 py-3 flex items-center gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>
                <span className="text-white text-sm font-bold">{callState.peerName?.[0]?.toUpperCase() || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{callState.peerName}</div>
                <div className="text-white/60 text-[10px]">{callState.status === 'connected' ? formatCallDuration(callState.duration) : 'Connecting...'}</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-2 py-1.5" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <span className="text-white/70 text-[10px]">{callState.status === 'connected' && isVideoCall ? formatCallDuration(callState.duration) : 'Tap to expand'}</span>
            <button onClick={(e) => handleEndCall(e)} className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
              <PhoneOff size={12} className="text-white" />
            </button>
          </div>
        </div>
      ) : (
        /* ── FULLSCREEN MODE ── */
        <div className="fixed inset-0 z-[10001] flex items-center justify-center"
          style={{ backgroundColor: showRemoteVideo ? 'transparent' : 'rgba(0,0,0,0.92)' }}
          onTouchStart={retryMedia} onClick={retryMedia}
        >
          {isVideoCall && showRemoteVideo && (
            <div className="absolute inset-0 bg-black/30" style={{ zIndex: 0 }} />
          )}
          <div className="w-full h-full max-w-lg mx-auto flex flex-col items-center justify-between py-12 px-6 relative" style={{ zIndex: 1 }}>

            {(callState.status === 'connected' || callState.status === 'connecting') && (
              <button onClick={(e) => { e.stopPropagation(); setCallMinimized(true); }}
                className="absolute top-4 left-4 z-20 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Minimize2 size={20} className="text-white" />
              </button>
            )}

            {isVideoCall && callState.localStream && (
              <div className="absolute top-4 right-4 w-28 h-40 rounded-xl overflow-hidden shadow-xl border-2 border-white/30 z-10">
                <video ref={localVideoRef} autoPlay playsInline muted
                  className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                {callState.isVideoOff && (
                  <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center">
                    <VideoOff size={20} className="text-white/70" />
                    <span className="text-white/60 text-[9px] mt-1">Camera off</span>
                  </div>
                )}
              </div>
            )}

            {/* Call info */}
            <div className="text-center z-10 relative">
              <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold"
                style={{ backgroundColor: showRemoteVideo ? 'transparent' : '#6366F1' }}>
                {!showRemoteVideo && (callState.peerName?.[0]?.toUpperCase() || '?')}
              </div>
              <h2 className="text-white text-xl font-semibold mb-1">{callState.peerName || 'Unknown'}</h2>
              <p className="text-white/70 text-sm">
                {callState.status === 'calling' && 'Calling...'}
                {callState.status === 'ringing' && (
                  <span className="flex items-center justify-center gap-2">
                    <PhoneIncoming size={16} className="animate-pulse" /> Incoming {callState.callType} call
                  </span>
                )}
                {callState.status === 'connecting' && 'Connecting...'}
                {callState.status === 'connected' && formatCallDuration(callState.duration)}
                {callState.status === 'ended' && 'Call ended'}
              </p>
              {callState.status === 'connected' && (
                <div className="flex items-center justify-center gap-1 mt-2 text-green-400 text-xs">
                  <Shield size={12} /><span>End-to-end encrypted</span>
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* Controls */}
            <div className="z-10 relative">
              {callState.status === 'ringing' && (
                <div className="flex items-center gap-8">
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={(e) => handleRejectCall(e)}
                      className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 shadow-lg">
                      <PhoneOff size={28} className="text-white" />
                    </button>
                    <span className="text-white/60 text-xs">Decline</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleAnswerCall(); }}
                      className="w-16 h-16 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 shadow-lg animate-pulse">
                      <Phone size={28} className="text-white" />
                    </button>
                    <span className="text-white/60 text-xs">Accept</span>
                  </div>
                </div>
              )}

              {callState.status === 'calling' && (
                <div className="flex flex-col items-center gap-1">
                  <button onClick={(e) => handleEndCall(e)}
                    className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 shadow-lg">
                    <PhoneOff size={28} className="text-white" />
                  </button>
                  <span className="text-white/60 text-xs">Cancel</span>
                </div>
              )}

              {(callState.status === 'connecting' || callState.status === 'connected') && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); callManagerRef.current.toggleMute(); }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${callState.isMuted ? 'bg-red-500 ring-2 ring-red-300' : 'bg-white/20 hover:bg-white/30'} text-white`}>
                      {callState.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>
                    <span className={`text-xs ${callState.isMuted ? 'text-red-400' : 'text-white/50'}`}>{callState.isMuted ? 'Muted' : 'Mic'}</span>
                  </div>
                  {isVideoCall && (
                    <div className="flex flex-col items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); callManagerRef.current.toggleVideo(); }}
                        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${callState.isVideoOff ? 'bg-red-500 ring-2 ring-red-300' : 'bg-white/20 hover:bg-white/30'} text-white`}>
                        {callState.isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                      </button>
                      <span className={`text-xs ${callState.isVideoOff ? 'text-red-400' : 'text-white/50'}`}>{callState.isVideoOff ? 'Off' : 'Video'}</span>
                    </div>
                  )}
                  {isVideoCall && (
                    <div className="flex flex-col items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); callManagerRef.current.switchCamera(); }}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-white/20 text-white hover:bg-white/30 shadow-lg">
                        <SwitchCamera size={22} />
                      </button>
                      <span className="text-white/50 text-xs">Flip</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={(e) => handleEndCall(e)}
                      className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 shadow-lg">
                      <PhoneOff size={24} className="text-white" />
                    </button>
                    <span className="text-red-400 text-xs">End</span>
                  </div>
                </div>
              )}

              {callState.status === 'ended' && <p className="text-white/50 text-sm">Call ended</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalCallOverlay;
