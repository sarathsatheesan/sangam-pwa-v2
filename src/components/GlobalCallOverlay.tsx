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
  PhoneIncoming, Shield, Minimize2,
} from 'lucide-react';

const generateConvId = (uid1: string, uid2: string): string => [uid1, uid2].sort().join('__');

const formatMessageTime = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '';
  return ts.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const safePlay = async (el: HTMLMediaElement): Promise<void> => {
  try { await el.play(); } catch { /* autoplay blocked */ }
};

const GlobalCallOverlay: React.FC = () => {
  const { user } = useAuth();
  const cm = useRef(getCallManager());

  const [cs, setCs] = useState<CallState>(getCallManager().getState());
  const [minimized, setMinimized] = useState(false);

  const localVidRef = useRef<HTMLVideoElement>(null);
  const remoteVidRef = useRef<HTMLVideoElement>(null);
  const remoteAudRef = useRef<HTMLAudioElement>(null);

  useEffect(() => { return cm.current.subscribe(setCs); }, []);

  useEffect(() => {
    if (!user?.uid) return;
    return cm.current.listenForIncomingCalls(user.uid, () => setMinimized(false));
  }, [user?.uid]);

  // Write call event to chat
  useEffect(() => {
    if (!user?.uid) return;
    return cm.current.onCallEnded(async (ev: CallEndedEvent) => {
      try {
        let t: string;
        if (ev.endReason === 'timeout') t = ev.isCaller ? 'cancelled' : 'missed';
        else if (ev.endReason === 'rejected') t = 'rejected';
        else if (ev.endReason === 'cancelled') t = 'cancelled';
        else if (ev.duration > 0) t = 'completed';
        else t = ev.isCaller ? 'cancelled' : 'missed';

        const cid = generateConvId(user.uid, ev.peerId);
        const lbl = ev.callType === 'video' ? 'Video' : 'Voice';
        const txt = t === 'completed' ? `${lbl} call` : t === 'missed' ? `Missed ${lbl.toLowerCase()} call`
          : t === 'rejected' ? `Declined ${lbl.toLowerCase()} call` : `Cancelled ${lbl.toLowerCase()} call`;

        await addDoc(collection(db, 'conversations', cid, 'messages'), {
          text: txt, senderId: user.uid, time: formatMessageTime(Timestamp.now()),
          createdAt: serverTimestamp(),
          callEvent: { type: t, callType: ev.callType, ...(ev.duration > 0 ? { duration: ev.duration } : {}) },
        });
        await setDoc(doc(db, 'conversations', cid), {
          lastMessage: txt, lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
          lastMessageSenderId: user.uid, participants: [user.uid, ev.peerId].sort(),
        }, { merge: true });
      } catch (err) { console.error('[CallEvent]', err); }
    });
  }, [user?.uid]);

  // Attach local video
  useEffect(() => {
    if (localVidRef.current && cs.localStream) {
      localVidRef.current.srcObject = cs.localStream;
      safePlay(localVidRef.current);
    }
  }, [cs.localStream]);

  // Attach remote stream
  useEffect(() => {
    if (!cs.remoteStream) return;
    const s = cs.remoteStream;
    if (remoteAudRef.current) {
      remoteAudRef.current.srcObject = cs.callType === 'video'
        ? new MediaStream(s.getAudioTracks()) : s;
      remoteAudRef.current.muted = false;
      safePlay(remoteAudRef.current);
    }
    if (cs.callType === 'video' && remoteVidRef.current) {
      remoteVidRef.current.srcObject = s;
      remoteVidRef.current.muted = true;
      safePlay(remoteVidRef.current);
    }
  }, [cs.remoteStream, cs.callType]);

  // Retry on connected
  useEffect(() => {
    if (cs.status !== 'connected') return;
    const r = () => {
      if (remoteAudRef.current) { remoteAudRef.current.muted = false; safePlay(remoteAudRef.current); }
      if (remoteVidRef.current) safePlay(remoteVidRef.current);
      if (localVidRef.current) safePlay(localVidRef.current);
    };
    r(); const t1 = setTimeout(r, 500); const t2 = setTimeout(r, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cs.status]);

  useEffect(() => {
    if (cs.status === 'idle' || cs.status === 'ended') setMinimized(false);
  }, [cs.status]);

  useEffect(() => {
    const active = cs.status !== 'idle' && cs.status !== 'ended';
    if (!active || minimized) return;
    window.history.pushState({ callActive: true }, '');
    const h = () => { const s = cm.current.getState().status; if (s !== 'idle' && s !== 'ended') setMinimized(true); };
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, [cs.status, minimized]);

  const retryMedia = useCallback(() => {
    if (remoteAudRef.current) { remoteAudRef.current.muted = false; safePlay(remoteAudRef.current); }
    if (remoteVidRef.current) safePlay(remoteVidRef.current);
    if (localVidRef.current) safePlay(localVidRef.current);
  }, []);

  const endCall = (e?: React.MouseEvent) => { e?.stopPropagation(); cm.current.endCall('ended'); };
  const rejectCall = (e?: React.MouseEvent) => { e?.stopPropagation(); cm.current.rejectCall(); };
  const answerCall = async () => {
    if (!cs.callId) return;
    try {
      await cm.current.answerCall(cs.callId, cs.callType);
      setTimeout(retryMedia, 300); setTimeout(retryMedia, 1500);
    } catch (err) { console.error('Answer failed:', err); }
  };

  const isVideo = cs.callType === 'video';
  const hasRemoteVid = cs.remoteStream?.getVideoTracks().some(t => t.readyState === 'live') ?? false;
  const showVid = isVideo && (cs.status === 'connected' || hasRemoteVid);

  if (cs.status === 'idle') return null;

  // ── Shared remote video element (rendered inside both PiP and fullscreen) ──
  const RemoteVideo = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
    <video ref={remoteVidRef} autoPlay playsInline muted
      className={className}
      style={{ objectFit: 'cover', ...style }}
    />
  );

  return (
    <>
      {/* Audio — visible at (0,0) so browsers don't mute it */}
      <audio ref={remoteAudRef} autoPlay playsInline
        style={{ position: 'fixed', top: 0, left: 0, width: '1px', height: '1px', opacity: 0.01 }} />

      {minimized ? (
        /* ── PiP ── */
        <div className="fixed bottom-20 right-4 z-[10001] rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
          style={{ width: isVideo ? '140px' : '200px', backgroundColor: '#1a1a2e', border: '2px solid rgba(99,102,241,0.5)' }}
          onClick={() => { setMinimized(false); retryMedia(); }}
        >
          {isVideo ? (
            <div className="relative" style={{ height: '180px' }}>
              {/* Remote video INSIDE the PiP container */}
              {showVid ? (
                <video ref={remoteVidRef} autoPlay playsInline muted
                  className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: '#6366F1' }}>
                  <span className="text-white text-2xl font-bold">{cs.peerName?.[0]?.toUpperCase() || '?'}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="px-3 py-3 flex items-center gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>
                <span className="text-white text-sm font-bold">{cs.peerName?.[0]?.toUpperCase() || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{cs.peerName}</div>
                <div className="text-white/60 text-[10px]">{cs.status === 'connected' ? formatCallDuration(cs.duration) : 'Connecting...'}</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-2 py-1.5" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <span className="text-white/70 text-[10px]">{cs.status === 'connected' && isVideo ? formatCallDuration(cs.duration) : 'Tap to expand'}</span>
            <button onClick={endCall} className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
              <PhoneOff size={12} className="text-white" />
            </button>
          </div>
        </div>
      ) : (
        /* ── Fullscreen ── */
        <div className="fixed inset-0 z-[10001] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
          onTouchStart={retryMedia} onClick={retryMedia}
        >
          {/* Remote video as background — INSIDE the overlay */}
          {isVideo && showVid && (
            <video ref={remoteVidRef} autoPlay playsInline muted
              className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0 }} />
          )}

          {/* Semi-transparent overlay on top of video */}
          {isVideo && showVid && (
            <div className="absolute inset-0 bg-black/20" style={{ zIndex: 1 }} />
          )}

          <div className="w-full h-full max-w-lg mx-auto flex flex-col items-center justify-between py-12 px-6 relative" style={{ zIndex: 2 }}>

            {(cs.status === 'connected' || cs.status === 'connecting') && (
              <button onClick={(e) => { e.stopPropagation(); setMinimized(true); }}
                className="absolute top-4 left-4 z-20 p-2.5 rounded-full bg-white/10 hover:bg-white/20">
                <Minimize2 size={20} className="text-white" />
              </button>
            )}

            {/* Local video PiP */}
            {isVideo && cs.localStream && (
              <div className="absolute top-4 right-4 w-28 h-40 rounded-xl overflow-hidden shadow-xl border-2 border-white/30 z-10">
                <video ref={localVidRef} autoPlay playsInline muted
                  className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                {cs.isVideoOff && (
                  <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center">
                    <VideoOff size={20} className="text-white/70" />
                    <span className="text-white/60 text-[9px] mt-1">Camera off</span>
                  </div>
                )}
              </div>
            )}

            {/* Call info */}
            <div className="text-center z-10 relative">
              {!showVid && (
                <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold"
                  style={{ backgroundColor: '#6366F1' }}>
                  {cs.peerName?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <h2 className="text-white text-xl font-semibold mb-1">{cs.peerName || 'Unknown'}</h2>
              <p className="text-white/70 text-sm">
                {cs.status === 'calling' && 'Calling...'}
                {cs.status === 'ringing' && (
                  <span className="flex items-center justify-center gap-2">
                    <PhoneIncoming size={16} className="animate-pulse" /> Incoming {cs.callType} call
                  </span>
                )}
                {cs.status === 'connecting' && 'Connecting...'}
                {cs.status === 'connected' && formatCallDuration(cs.duration)}
                {cs.status === 'ended' && 'Call ended'}
              </p>
              {cs.status === 'connected' && (
                <div className="flex items-center justify-center gap-1 mt-2 text-green-400 text-xs">
                  <Shield size={12} /><span>Encrypted</span>
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* Controls */}
            <div className="z-10 relative">
              {cs.status === 'ringing' && (
                <div className="flex items-center gap-8">
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={rejectCall} className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 shadow-lg">
                      <PhoneOff size={28} className="text-white" />
                    </button>
                    <span className="text-white/60 text-xs">Decline</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); answerCall(); }}
                      className="w-16 h-16 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 shadow-lg animate-pulse">
                      <Phone size={28} className="text-white" />
                    </button>
                    <span className="text-white/60 text-xs">Accept</span>
                  </div>
                </div>
              )}

              {cs.status === 'calling' && (
                <div className="flex flex-col items-center gap-1">
                  <button onClick={endCall} className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 shadow-lg">
                    <PhoneOff size={28} className="text-white" />
                  </button>
                  <span className="text-white/60 text-xs">Cancel</span>
                </div>
              )}

              {(cs.status === 'connecting' || cs.status === 'connected') && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); cm.current.toggleMute(); }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg text-white ${cs.isMuted ? 'bg-red-500 ring-2 ring-red-300' : 'bg-white/20 hover:bg-white/30'}`}>
                      {cs.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>
                    <span className={`text-xs ${cs.isMuted ? 'text-red-400' : 'text-white/50'}`}>{cs.isMuted ? 'Muted' : 'Mic'}</span>
                  </div>
                  {isVideo && (
                    <div className="flex flex-col items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); cm.current.toggleVideo(); }}
                        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg text-white ${cs.isVideoOff ? 'bg-red-500 ring-2 ring-red-300' : 'bg-white/20 hover:bg-white/30'}`}>
                        {cs.isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                      </button>
                      <span className={`text-xs ${cs.isVideoOff ? 'text-red-400' : 'text-white/50'}`}>{cs.isVideoOff ? 'Off' : 'Video'}</span>
                    </div>
                  )}
                  {isVideo && (
                    <div className="flex flex-col items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); cm.current.switchCamera(); }}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-white/20 text-white hover:bg-white/30 shadow-lg">
                        <SwitchCamera size={22} />
                      </button>
                      <span className="text-white/50 text-xs">Flip</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={endCall} className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 shadow-lg">
                      <PhoneOff size={24} className="text-white" />
                    </button>
                    <span className="text-red-400 text-xs">End</span>
                  </div>
                </div>
              )}

              {cs.status === 'ended' && <p className="text-white/50 text-sm">Call ended</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalCallOverlay;
