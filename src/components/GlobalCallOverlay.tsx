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

// ─── Safari Compatibility Helpers ─────────────────────────────────
const isSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
};

const safariSafePlay = async (el: HTMLMediaElement): Promise<void> => {
  try {
    await el.play();
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === 'NotAllowedError' || name === 'AbortError') {
      console.warn('[Safari] Autoplay blocked, retrying with muted workaround');
      const wasMuted = el.muted;
      el.muted = true;
      try {
        await el.play();
        if (!wasMuted) {
          setTimeout(() => { el.muted = false; }, 200);
        }
      } catch {
        console.warn('[Safari] Even muted play failed — will require user tap');
      }
    } else {
      console.warn('[WebRTC] Play failed:', err);
    }
  }
};

// ─── Helpers ───────────────────────────────────────────────────────

const generateConvId = (uid1: string, uid2: string): string => {
  return [uid1, uid2].sort().join('__');
};

const formatMessageTime = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '';
  const d = ts.toDate();
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// ─── Component ─────────────────────────────────────────────────────

const GlobalCallOverlay: React.FC = () => {
  const { user } = useAuth();
  const callManagerRef = useRef(getCallManager());

  const [callState, setCallState] = useState<CallState>(getCallManager().getState());
  const [callMinimized, setCallMinimized] = useState(false);

  // Deduplication guard — prevents writing the same call event twice
  const writtenCallIdsRef = useRef<Set<string>>(new Set());

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Subscribe to call manager state changes
  useEffect(() => {
    const unsub = callManagerRef.current.subscribe((state) => {
      setCallState(state);
    });
    return unsub;
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = callManagerRef.current.listenForIncomingCalls(
      user.uid,
      (_callId, _callerName, _callType) => {
        setCallMinimized(false);
      }
    );
    return unsub;
  }, [user?.uid]);

  // Write call event messages to chat when calls end
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = callManagerRef.current.onCallEnded(async (event: CallEndedEvent) => {
      // Only the CALLER writes the call event message to prevent duplicates
      if (!event.isCaller) return;
      // Dedup guard: skip if we already wrote an event for this callId
      if (writtenCallIdsRef.current.has(event.callId)) {
        console.log('[CallEvent] Skipping duplicate for callId:', event.callId);
        return;
      }
      writtenCallIdsRef.current.add(event.callId);
      // Clean up old entries after 30s to prevent memory leak
      setTimeout(() => writtenCallIdsRef.current.delete(event.callId), 30_000);
      try {
        let eventType: 'missed' | 'completed' | 'rejected' | 'cancelled';
        if (event.endReason === 'timeout') {
          eventType = 'cancelled';
        } else if (event.endReason === 'rejected') {
          eventType = 'rejected';
        } else if (event.endReason === 'cancelled') {
          eventType = 'cancelled';
        } else if (event.duration > 0) {
          eventType = 'completed';
        } else {
          eventType = event.isCaller ? 'cancelled' : 'missed';
        }

        const convId = generateConvId(user.uid, event.peerId);
        const callLabel = event.callType === 'video' ? 'Video' : 'Voice';
        const textLabel = eventType === 'completed'
          ? `${callLabel} call`
          : eventType === 'missed'
            ? `Missed ${callLabel.toLowerCase()} call`
            : eventType === 'rejected'
              ? `Declined ${callLabel.toLowerCase()} call`
              : `Cancelled ${callLabel.toLowerCase()} call`;

        // Use setDoc with deterministic ID to prevent duplicates —
        // even if this fires twice, it overwrites the same document
        const callEventDocId = `call_${event.callId}`;
        await setDoc(doc(db, 'conversations', convId, 'messages', callEventDocId), {
          text: textLabel,
          senderId: user.uid,
          time: formatMessageTime(Timestamp.now()),
          createdAt: serverTimestamp(),
          callEvent: {
            type: eventType,
            callType: event.callType,
            ...(event.duration > 0 ? { duration: event.duration } : {}),
          },
        });

        await setDoc(doc(db, 'conversations', convId), {
          lastMessage: textLabel,
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageSenderId: user.uid,
          participants: [user.uid, event.peerId].sort(),
        }, { merge: true });

        console.log('[CallEvent] Wrote call event message:', eventType, event.callType);
      } catch (err) {
        console.error('[CallEvent] Failed to write call event message:', err);
      }
    });
    return unsub;
  }, [user?.uid]);

  // Attach local media stream to video element
  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.setAttribute('webkit-playsinline', '');
      localVideoRef.current.srcObject = callState.localStream;
      safariSafePlay(localVideoRef.current);
    }
  }, [callState.localStream]);

  // Attach remote stream to media elements.
  //
  // CRITICAL: For video calls, <audio> and <video> must NOT share the same
  // MediaStream. On Safari/Android, a muted <video>'s mute state can bleed
  // into the shared stream, silencing the <audio> element.
  //
  // Solution:
  //  - Audio calls: <audio> gets the full stream
  //  - Video calls: <audio> gets a SEPARATE audio-only MediaStream
  //                 <video muted> gets the full stream (video display only)
  useEffect(() => {
    if (!callState.remoteStream) return;
    const tracks = callState.remoteStream.getTracks();
    console.log('[WebRTC] Attaching remote stream, tracks:', tracks.map(t => `${t.kind}:${t.readyState}`).join(', '));

    const isVideo = callState.callType === 'video';

    if (isVideo) {
      // Audio element gets its own audio-only stream (avoids mute-bleed)
      if (remoteAudioRef.current) {
        const audioTracks = callState.remoteStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioOnlyStream = new MediaStream(audioTracks);
          remoteAudioRef.current.srcObject = audioOnlyStream;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.play().catch((err) => {
            console.warn('[WebRTC] Audio play blocked, will retry on user gesture:', err);
          });
        }
      }
      // Video element gets the full stream (muted — video display only)
      // This is a PERSISTENT element — never unmounts during PiP/fullscreen switch
      if (remoteVideoRef.current) {
        remoteVideoRef.current.setAttribute('webkit-playsinline', '');
        remoteVideoRef.current.muted = true;
        remoteVideoRef.current.srcObject = callState.remoteStream;
        remoteVideoRef.current.play().catch((err) => {
          console.warn('[WebRTC] Video play failed:', err);
        });
      }
    } else {
      // AUDIO CALL: just use the <audio> element
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = callState.remoteStream;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch((err) => {
          console.warn('[WebRTC] Audio play blocked, will retry on user gesture:', err);
        });
      }
    }
  }, [callState.remoteStream, callState.status, callState.callType]);

  // When call status changes to connected, ensure audio is playing.
  useEffect(() => {
    if (callState.status !== 'connected' || !callState.remoteStream) return;

    if (remoteAudioRef.current) {
      if (callState.callType === 'video') {
        const audioTracks = callState.remoteStream.getAudioTracks();
        if (audioTracks.length > 0 && remoteAudioRef.current.srcObject !== null) {
          // Stream already set — just retry play
        } else if (audioTracks.length > 0) {
          remoteAudioRef.current.srcObject = new MediaStream(audioTracks);
        }
      }
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.play().catch((err) => {
        console.warn('[WebRTC] Connected but audio play failed, will retry:', err);
        setTimeout(() => {
          if (remoteAudioRef.current?.srcObject) {
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play().catch(() => {});
          }
        }, 500);
      });
    }
  }, [callState.status, callState.remoteStream, callState.callType]);

  // Reset minimized state when call ends
  useEffect(() => {
    if (callState.status === 'idle' || callState.status === 'ended') {
      setCallMinimized(false);
    }
  }, [callState.status]);

  // Intercept browser/hardware back button during active calls → minimize to PiP
  useEffect(() => {
    const isActiveCall = callState.status !== 'idle' && callState.status !== 'ended';
    if (!isActiveCall || callMinimized) return;

    window.history.pushState({ callActive: true }, '');

    const handlePopState = () => {
      const stillActive = callManagerRef.current.getState().status !== 'idle' &&
                          callManagerRef.current.getState().status !== 'ended';
      if (stillActive) {
        setCallMinimized(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [callState.status, callMinimized]);

  // ── Handlers ──

  const retryMediaPlayback = useCallback(() => {
    const state = callManagerRef.current.getState();

    if (remoteAudioRef.current) {
      if (state.callType === 'video' && state.remoteStream && !remoteAudioRef.current.srcObject) {
        const audioTracks = state.remoteStream.getAudioTracks();
        if (audioTracks.length > 0) {
          remoteAudioRef.current.srcObject = new MediaStream(audioTracks);
        }
      }
      if (remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch((err) =>
          console.warn('[WebRTC] Audio retry play failed:', err)
        );
      }
    }
    if (remoteVideoRef.current?.srcObject) {
      remoteVideoRef.current.muted = true;
      remoteVideoRef.current.play().catch(() => {});
    }
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.play().catch(() => {});
    }
  }, []);

  const handleAnswerCall = async () => {
    if (!callState.callId) return;
    try {
      await callManagerRef.current.answerCall(callState.callId, callState.callType);
      setTimeout(retryMediaPlayback, 200);
      setTimeout(retryMediaPlayback, 800);
      setTimeout(retryMediaPlayback, 2000);
    } catch (err) {
      console.error('Failed to answer call:', err);
    }
  };

  const handleEndCall = () => {
    callManagerRef.current.endCall('ended');
  };

  const handleRejectCall = () => {
    callManagerRef.current.rejectCall();
  };

  // Determine if remote video should be visible
  const hasRemoteVideoTrack = callState.remoteStream
    ? callState.remoteStream.getVideoTracks().length > 0
    : false;
  const showRemoteVideo = callState.status === 'connected' || hasRemoteVideoTrack;
  const isVideoCall = callState.callType === 'video';

  // Don't render anything when idle
  if (callState.status === 'idle') return null;

  return (
    <>
      {/* ── PERSISTENT MEDIA ELEMENTS ── never unmount during PiP/fullscreen switch */}

      {/* Audio — handles ALL remote audio. Off-screen, never muted. */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        // @ts-ignore webkit-playsinline for older Safari
        webkit-playsinline=""
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
      />

      {/* Remote video — SINGLE persistent element, repositioned via CSS.
          Never destroyed on PiP↔fullscreen switch so video never pauses. */}
      {isVideoCall && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          // @ts-ignore webkit-playsinline for older Safari
          webkit-playsinline=""
          style={{
            position: 'fixed',
            zIndex: 10000,
            objectFit: 'cover',
            opacity: showRemoteVideo ? 1 : 0,
            pointerEvents: 'none', // let clicks pass through to buttons below
            // Smooth transition when switching between PiP and fullscreen
            transition: 'all 0.3s ease-in-out',
            WebkitTransform: 'translateZ(0)',
            ...(callMinimized ? {
              // PiP position
              bottom: '100px',
              right: '16px',
              width: '140px',
              height: '180px',
              borderRadius: '16px',
            } : {
              // Fullscreen position
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              borderRadius: 0,
            }),
          }}
        />
      )}

      {/* ── MINIMIZED PiP MODE ── */}
      {callMinimized ? (
        <div
          className="fixed bottom-20 right-4 z-[10001] rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
          style={{
            width: isVideoCall ? '140px' : '200px',
            backgroundColor: '#1a1a2e',
            border: '2px solid rgba(99,102,241,0.5)',
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            WebkitTapHighlightColor: 'transparent',
          }}
          onClick={() => {
            setCallMinimized(false);
            retryMediaPlayback();
            setTimeout(retryMediaPlayback, 300);
          }}
          onTouchStart={() => {
            setCallMinimized(false);
            retryMediaPlayback();
            setTimeout(retryMediaPlayback, 300);
          }}
        >
          {/* PiP video placeholder / avatar fallback */}
          {isVideoCall && (
            <div className="relative" style={{ height: '180px' }}>
              {/* The actual video is the persistent element above — this div is just the container */}
              {!showRemoteVideo && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: '#6366F1' }}>
                  <span className="text-white text-2xl font-bold">{callState.peerName?.[0]?.toUpperCase() || '?'}</span>
                </div>
              )}
              {/* Mute/video-off indicators on PiP */}
              <div className="absolute top-1.5 left-1.5 flex gap-1 z-10">
                {callState.isMuted && (
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <MicOff size={12} className="text-white" />
                  </div>
                )}
                {callState.isVideoOff && (
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <VideoOff size={12} className="text-white" />
                  </div>
                )}
              </div>
            </div>
          )}
          {/* PiP audio call info */}
          {callState.callType === 'audio' && (
            <div className="px-3 py-3 flex items-center gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>
                <span className="text-white text-sm font-bold">{callState.peerName?.[0]?.toUpperCase() || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{callState.peerName}</div>
                <div className="text-white/60 text-[10px]">
                  {callState.status === 'connected' ? formatCallDuration(callState.duration) : 'Connecting...'}
                </div>
              </div>
              {callState.isMuted && (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <MicOff size={10} className="text-white" />
                </div>
              )}
            </div>
          )}
          {/* PiP bottom bar */}
          <div className="flex items-center justify-between px-2 py-1.5" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <span className="text-white/70 text-[10px]">
              {callState.status === 'connected' && isVideoCall ? formatCallDuration(callState.duration) : 'Tap to expand'}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleEndCall(); }}
              className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center"
            >
              <PhoneOff size={12} className="text-white" />
            </button>
          </div>
        </div>
      ) : (
        /* ── FULLSCREEN CALL MODE ── */
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center"
          style={{
            backgroundColor: isVideoCall && showRemoteVideo ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.92)',
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
          }}
          onTouchStart={retryMediaPlayback}
          onClick={retryMediaPlayback}
        >
          <div className="w-full h-full max-w-lg mx-auto flex flex-col items-center justify-between py-12 px-6 relative">

            {/* Minimize button (top left) */}
            {(callState.status === 'connected' || callState.status === 'connecting') && (
              <button
                onClick={(e) => { e.stopPropagation(); setCallMinimized(true); }}
                className="absolute top-4 left-4 z-20 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Minimize call"
              >
                <Minimize2 size={20} className="text-white" />
              </button>
            )}

            {/* Remote video is the PERSISTENT element above — rendered at z-10000 */}

            {/* Local video (picture-in-picture corner) */}
            {isVideoCall && callState.localStream && (
              <div className="absolute top-4 right-4 w-28 h-40 rounded-xl overflow-hidden shadow-xl border-2 border-white/30 z-10">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  // @ts-ignore webkit-playsinline for older Safari
                  webkit-playsinline=""
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {callState.isVideoOff && (
                  <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center">
                    <VideoOff size={20} className="text-white/70" />
                    <span className="text-white/60 text-[9px] mt-1">Camera off</span>
                  </div>
                )}
              </div>
            )}

            {/* Top section: call info */}
            <div className="text-center z-10 relative">
              <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold"
                style={{ backgroundColor: isVideoCall && showRemoteVideo ? 'transparent' : '#6366F1' }}
              >
                {!isVideoCall || !showRemoteVideo ? (
                  callState.peerName?.[0]?.toUpperCase() || '?'
                ) : null}
              </div>

              <h2 className="text-white text-xl font-semibold mb-1">{callState.peerName || 'Unknown'}</h2>

              <p className="text-white/70 text-sm">
                {callState.status === 'calling' && 'Calling...'}
                {callState.status === 'ringing' && (
                  <span className="flex items-center justify-center gap-2">
                    <PhoneIncoming size={16} className="animate-pulse" />
                    Incoming {callState.callType} call
                  </span>
                )}
                {callState.status === 'connecting' && 'Connecting...'}
                {callState.status === 'connected' && formatCallDuration(callState.duration)}
                {callState.status === 'ended' && 'Call ended'}
              </p>

              {callState.status === 'connected' && (
                <div className="flex items-center justify-center gap-1 mt-2 text-green-400 text-xs">
                  <Shield size={12} />
                  <span>End-to-end encrypted</span>
                </div>
              )}

              {callState.status === 'connected' && (callState.isMuted || callState.isVideoOff) && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  {callState.isMuted && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/90 text-white text-xs font-medium">
                      <MicOff size={12} /> Muted
                    </div>
                  )}
                  {callState.isVideoOff && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/90 text-white text-xs font-medium">
                      <VideoOff size={12} /> Camera off
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* Bottom section: call controls */}
            <div className="z-10 relative">
              {/* Incoming call: accept/reject */}
              {callState.status === 'ringing' && (
                <div className="flex items-center gap-8">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={handleRejectCall}
                      className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <PhoneOff size={28} className="text-white" />
                    </button>
                    <span className="text-white/60 text-xs">Decline</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={handleAnswerCall}
                      className="w-16 h-16 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 transition-colors shadow-lg animate-pulse"
                    >
                      <Phone size={28} className="text-white" />
                    </button>
                    <span className="text-white/60 text-xs">Accept</span>
                  </div>
                </div>
              )}

              {/* Outgoing call: cancel */}
              {callState.status === 'calling' && (
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={handleEndCall}
                    className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors shadow-lg"
                  >
                    <PhoneOff size={28} className="text-white" />
                  </button>
                  <span className="text-white/60 text-xs">Cancel</span>
                </div>
              )}

              {/* Active call: mute, video toggle, flip camera, end */}
              {(callState.status === 'connecting' || callState.status === 'connected') && (
                <div className="flex items-center gap-3">
                  {/* Mute */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => callManagerRef.current.toggleMute()}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        callState.isMuted
                          ? 'bg-red-500 text-white ring-2 ring-red-300'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      {callState.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>
                    <span className={`text-xs ${callState.isMuted ? 'text-red-400' : 'text-white/50'}`}>
                      {callState.isMuted ? 'Muted' : 'Mic'}
                    </span>
                  </div>

                  {/* Video toggle */}
                  {isVideoCall && (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => callManagerRef.current.toggleVideo()}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                          callState.isVideoOff
                            ? 'bg-red-500 text-white ring-2 ring-red-300'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        {callState.isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                      </button>
                      <span className={`text-xs ${callState.isVideoOff ? 'text-red-400' : 'text-white/50'}`}>
                        {callState.isVideoOff ? 'Off' : 'Video'}
                      </span>
                    </div>
                  )}

                  {/* Switch camera */}
                  {isVideoCall && (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => callManagerRef.current.switchCamera()}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-white/20 text-white hover:bg-white/30 transition-colors shadow-lg"
                      >
                        <SwitchCamera size={22} />
                      </button>
                      <span className="text-white/50 text-xs">Flip</span>
                    </div>
                  )}

                  {/* End call */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={handleEndCall}
                      className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <PhoneOff size={24} className="text-white" />
                    </button>
                    <span className="text-red-400 text-xs">End</span>
                  </div>
                </div>
              )}

              {/* Ended state */}
              {callState.status === 'ended' && (
                <p className="text-white/50 text-sm">Call ended</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalCallOverlay;
