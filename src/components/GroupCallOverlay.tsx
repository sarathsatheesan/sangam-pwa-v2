'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureSettings } from '@/contexts/FeatureSettingsContext';
import {
  getGroupCallManager,
  type GroupCallState, type GroupCallEndedEvent, type GroupCallType,
} from '@/utils/groupWebrtc';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera,
  Monitor, MonitorOff, Users, X, Shield, Minimize2, Maximize2,
  Share2, Check,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────

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
      const wasMuted = el.muted;
      el.muted = true;
      try {
        await el.play();
        if (!wasMuted) setTimeout(() => { el.muted = false; }, 200);
      } catch { /* will require user tap */ }
    }
  }
};

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Participant Video Tile ──────────────────────────────────────────

function ParticipantTile({
  stream,
  name,
  isMuted,
  isVideoOff,
  isScreenSharing,
  isLocal,
  isSpeaking,
}: {
  stream: MediaStream | null;
  name: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isLocal: boolean;
  isSpeaking?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!stream) return;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      if (isLocal) videoRef.current.muted = true;
      safariSafePlay(videoRef.current);
    }
    // Separate audio element for remote participants (Safari fix)
    if (!isLocal && audioRef.current) {
      const audioStream = new MediaStream(stream.getAudioTracks());
      audioRef.current.srcObject = audioStream;
      safariSafePlay(audioRef.current);
    }
  }, [stream, isLocal]);

  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1a1b2e 0%, #2d2f5e 100%)',
        border: isSpeaking ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
        width: '100%',
        height: '100%',
        minHeight: '120px',
      }}
    >
      {/* Video */}
      {!isVideoOff && stream && stream.getVideoTracks().length > 0 ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width: '100%',
            height: '100%',
            objectFit: isScreenSharing ? 'contain' : 'cover',
            transform: isLocal && !isScreenSharing ? 'scaleX(-1)' : 'none',
          }}
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          <div
            className="rounded-full flex items-center justify-center text-white font-bold"
            style={{
              width: '64px', height: '64px', fontSize: '24px',
              background: 'linear-gradient(135deg, #7e22ce, #4f46e5)',
            }}
          >
            {initials}
          </div>
        </div>
      )}

      {/* Remote audio (hidden — separate for Safari) */}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />}

      {/* Name + status badges */}
      <div
        className="absolute bottom-0 left-0 right-0 px-2 py-1.5 flex items-center gap-1.5"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}
      >
        <span className="text-white text-xs font-medium truncate">
          {isLocal ? 'You' : name}
        </span>
        {isMuted && <MicOff size={12} className="text-red-400 flex-shrink-0" />}
        {isScreenSharing && <Monitor size={12} className="text-green-400 flex-shrink-0" />}
      </div>

      {/* Local badge */}
      {isLocal && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-purple-600/80">
          YOU
        </div>
      )}
    </div>
  );
}

// ─── Grid Layout Calculator ──────────────────────────────────────────

function getGridLayout(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 }; // max 8 → 3x3 (one cell empty)
}

// ─── Main GroupCallOverlay ───────────────────────────────────────────

export default function GroupCallOverlay() {
  const { user, userProfile } = useAuth();
  const { isFeatureEnabled } = useFeatureSettings();
  const screenSharingEnabled = isFeatureEnabled('messages_screenSharing');
  const [callState, setCallState] = useState<GroupCallState | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Draggable PiP state
  const [pipPos, setPipPos] = useState<{ x: number; y: number }>({ x: -1, y: -1 });
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; dragging: boolean }>({ startX: 0, startY: 0, startPosX: 0, startPosY: 0, dragging: false });
  const pipRef = useRef<HTMLDivElement>(null);

  // Initialize PiP position to bottom-right on first render
  useEffect(() => {
    if (pipPos.x === -1) {
      setPipPos({ x: window.innerWidth - 176, y: window.innerHeight - 160 });
    }
  }, [pipPos.x]);

  const handlePipPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pipPos.x, startPosY: pipPos.y, dragging: false };
    const el = pipRef.current;
    if (el) el.setPointerCapture(e.pointerId);
  }, [pipPos]);

  const handlePipPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      d.dragging = true;
    }
    if (d.dragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - 160, d.startPosX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, d.startPosY + dy));
      setPipPos({ x: newX, y: newY });
    }
  }, []);

  const handlePipPointerUp = useCallback(() => {
    if (!dragRef.current.dragging) {
      // It was a tap, not a drag — expand
      setIsMinimized(false);
    }
    dragRef.current.dragging = false;
  }, []);

  useEffect(() => {
    const manager = getGroupCallManager();
    const unsub = manager.subscribe((state) => {
      setCallState(state.status !== 'idle' ? state : null);
    });
    return unsub;
  }, []);

  // Write group call event message to conversation when call ends
  useEffect(() => {
    const manager = getGroupCallManager();
    const unsub = manager.onCallEnded(async (event: GroupCallEndedEvent) => {
      if (!user?.uid || !event.conversationId) return;
      // Only write a call event message when the room fully ends (last participant left)
      if (!event.isRoomEnded) return;
      try {
        const text = event.duration > 0
          ? `Group ${event.callType} call · ${formatDuration(event.duration)} · ${event.participantCount} participants`
          : `Group ${event.callType} call ended`;
        const callEventDocId = `groupcall_${event.roomId}`;
        await setDoc(doc(db, 'conversations', event.conversationId, 'messages', callEventDocId), {
          text,
          senderId: user.uid,
          createdAt: serverTimestamp(),
          callEvent: {
            type: 'group_call_ended',
            callType: event.callType,
            duration: event.duration,
            participantCount: event.participantCount,
          },
        });
      } catch (err) {
        console.error('[GroupCallOverlay] Failed to write call event:', err);
      }
    });
    return unsub;
  }, [user]);

  if (!callState) return null;

  const manager = getGroupCallManager();
  const { callType, participants, peers, localStream, screenStream, isScreenSharing, isMuted, isVideoOff, duration } = callState;

  // Build tile list: local + remote peers
  const tiles: Array<{
    uid: string; name: string; stream: MediaStream | null;
    isMuted: boolean; isVideoOff: boolean; isScreenSharing: boolean; isLocal: boolean;
  }> = [];

  // Local tile
  tiles.push({
    uid: user?.uid || '',
    name: userProfile?.name || userProfile?.preferredName || 'You',
    stream: isScreenSharing ? screenStream : localStream,
    isMuted,
    isVideoOff: callType === 'audio' ? true : isVideoOff,
    isScreenSharing,
    isLocal: true,
  });

  // Remote tiles
  peers.forEach((peer, uid) => {
    const participant = participants.find((p) => p.uid === uid);
    tiles.push({
      uid,
      name: peer.name || participant?.name || 'Unknown',
      stream: peer.remoteStream,
      isMuted: participant?.isMuted || false,
      isVideoOff: participant?.isVideoOff || false,
      isScreenSharing: participant?.isScreenSharing || false,
      isLocal: false,
    });
  });

  const { cols, rows } = getGridLayout(tiles.length);

  // ─── Minimized PiP View ─────────────────────────────────────────

  if (isMinimized) {
    return (
      <div
        ref={pipRef}
        onPointerDown={handlePipPointerDown}
        onPointerMove={handlePipPointerMove}
        onPointerUp={handlePipPointerUp}
        style={{
          position: 'fixed',
          left: `${pipPos.x}px`,
          top: `${pipPos.y}px`,
          zIndex: 10000,
          width: '160px', height: '100px', borderRadius: '16px',
          background: 'linear-gradient(135deg, #1a1b2e, #2d2f5e)',
          border: '2px solid rgba(124, 58, 206, 0.5)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          cursor: 'grab', overflow: 'hidden', touchAction: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <Users size={20} className="text-purple-400 mb-1" />
        <span className="text-white text-xs font-medium">{participants.length} in call</span>
        <span className="text-purple-300 text-[10px]">{formatDuration(duration)}</span>
      </div>
    );
  }

  // ─── Full-screen View ───────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0f0f1a',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(135deg, #1a1b2e, #232438)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Shield size={14} className="text-green-400" />
            <span className="text-green-400 text-xs font-medium">Encrypted</span>
          </div>
          <span className="text-white/50 text-xs">·</span>
          <span className="text-white text-sm font-semibold">
            Group {callType === 'video' ? 'Video' : 'Audio'} Call
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-purple-300 text-sm font-mono">{formatDuration(duration)}</span>
          <span className="text-white/40 text-xs">{participants.length}/8</span>
          <button
            onClick={() => setIsMinimized(true)}
            onTouchStart={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg hover:bg-white/10"
            style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          >
            <Minimize2 size={16} className="text-white/70" />
          </button>
        </div>
      </div>

      {/* Participant Grid */}
      <div
        className="flex-1 p-2 sm:p-3"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: '8px',
          overflow: 'hidden',
        }}
      >
        {tiles.map((tile) => (
          <ParticipantTile
            key={tile.uid}
            stream={tile.stream}
            name={tile.name}
            isMuted={tile.isMuted}
            isVideoOff={tile.isVideoOff}
            isScreenSharing={tile.isScreenSharing}
            isLocal={tile.isLocal}
          />
        ))}
      </div>

      {/* Controls Bar */}
      <div
        className="flex items-center justify-center gap-3 sm:gap-4 px-4 py-4"
        style={{
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Mute */}
        <button
          onClick={() => manager.toggleMute()}
          onTouchStart={(e) => { e.preventDefault(); manager.toggleMute(); }}
          className="rounded-full flex items-center justify-center"
          style={{
            width: '48px', height: '48px',
            background: isMuted ? '#EF4444' : 'rgba(255,255,255,0.15)',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}
        >
          {isMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
        </button>

        {/* Video toggle (only for video calls) */}
        {callType === 'video' && (
          <button
            onClick={() => manager.toggleVideo()}
            onTouchStart={(e) => { e.preventDefault(); manager.toggleVideo(); }}
            className="rounded-full flex items-center justify-center"
            style={{
              width: '48px', height: '48px',
              background: isVideoOff ? '#EF4444' : 'rgba(255,255,255,0.15)',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {isVideoOff ? <VideoOff size={20} className="text-white" /> : <Video size={20} className="text-white" />}
          </button>
        )}

        {/* Screen Share (video calls only, not on mobile) */}
        {screenSharingEnabled && callType === 'video' && typeof navigator !== 'undefined' && 'getDisplayMedia' in (navigator.mediaDevices || {}) && (
          <button
            onClick={() => manager.toggleScreenShare()}
            onTouchStart={(e) => { e.preventDefault(); manager.toggleScreenShare(); }}
            className="rounded-full flex items-center justify-center"
            style={{
              width: '48px', height: '48px',
              background: isScreenSharing ? '#22C55E' : 'rgba(255,255,255,0.15)',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {isScreenSharing ? <MonitorOff size={20} className="text-white" /> : <Monitor size={20} className="text-white" />}
          </button>
        )}

        {/* Flip camera (video calls only) */}
        {callType === 'video' && !isScreenSharing && (
          <button
            onClick={() => manager.flipCamera()}
            onTouchStart={(e) => { e.preventDefault(); manager.flipCamera(); }}
            className="rounded-full flex items-center justify-center"
            style={{
              width: '48px', height: '48px',
              background: 'rgba(255,255,255,0.15)',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <SwitchCamera size={20} className="text-white" />
          </button>
        )}

        {/* Share Call Link */}
        <button
          onClick={async () => {
            if (!callState?.roomId || !callState?.conversationId) return;
            const baseUrl = window.location.origin;
            const link = `${baseUrl}/messages?joinCall=${callState.roomId}&conv=${callState.conversationId}`;
            try {
              if (navigator.share) {
                await navigator.share({ title: 'Join Group Call', text: 'Join the group call on ethniCity', url: link });
              } else {
                await navigator.clipboard.writeText(link);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }
            } catch {
              // Fallback if share is cancelled or clipboard fails
              try {
                await navigator.clipboard.writeText(link);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              } catch { /* ignore */ }
            }
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            if (!callState?.roomId || !callState?.conversationId) return;
            const baseUrl = window.location.origin;
            const link = `${baseUrl}/messages?joinCall=${callState.roomId}&conv=${callState.conversationId}`;
            if (navigator.share) {
              navigator.share({ title: 'Join Group Call', text: 'Join the group call on ethniCity', url: link }).catch(() => {});
            } else {
              navigator.clipboard.writeText(link).then(() => {
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }).catch(() => {});
            }
          }}
          className="rounded-full flex items-center justify-center"
          style={{
            width: '48px', height: '48px',
            background: linkCopied ? '#22C55E' : 'rgba(255,255,255,0.15)',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}
        >
          {linkCopied ? <Check size={20} className="text-white" /> : <Share2 size={20} className="text-white" />}
        </button>

        {/* Leave Call */}
        <button
          onClick={() => manager.leaveCall()}
          onTouchStart={(e) => { e.preventDefault(); manager.leaveCall(); }}
          className="rounded-full flex items-center justify-center"
          style={{
            width: '56px', height: '56px',
            background: '#EF4444',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}
        >
          <PhoneOff size={24} className="text-white" />
        </button>
      </div>
    </div>
  );
}
