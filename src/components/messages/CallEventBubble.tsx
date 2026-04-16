import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import type { Message } from '@/types/messages';

/**
 * CallEventBubble Component
 * Displays missed/completed/rejected call events in chat
 */
export function CallEventBubble({ callEvent, isMine }: { callEvent: NonNullable<Message['callEvent']>; isMine: boolean }) {
  const isMissed = callEvent.type === 'missed' || callEvent.type === 'rejected';
  const isVideo = callEvent.callType === 'video';

  const icon = isMissed
    ? <PhoneOff size={16} className="text-red-500" />
    : isVideo
      ? <Video size={16} className="text-green-600" />
      : <Phone size={16} className="text-green-600" />;

  let label = '';
  if (callEvent.type === 'missed') {
    label = isMine ? `Unanswered ${isVideo ? 'video' : 'voice'} call` : `Missed ${isVideo ? 'video' : 'voice'} call`;
  } else if (callEvent.type === 'rejected') {
    label = isMine ? `Declined ${isVideo ? 'video' : 'voice'} call` : `${isVideo ? 'Video' : 'Voice'} call declined`;
  } else if (callEvent.type === 'cancelled') {
    label = isMine ? `Cancelled ${isVideo ? 'video' : 'voice'} call` : `Missed ${isVideo ? 'video' : 'voice'} call`;
  } else {
    // completed
    const dur = callEvent.duration || 0;
    const m = Math.floor(dur / 60);
    const s = dur % 60;
    const durStr = dur > 0 ? ` (${m}:${String(s).padStart(2, '0')})` : '';
    label = `${isVideo ? 'Video' : 'Voice'} call${durStr}`;
  }

  return (
    <div className="flex items-center gap-2 py-1 px-1">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isMissed ? 'bg-red-50' : 'bg-green-50'}`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className={`text-[13px] font-medium ${isMissed ? 'text-red-600' : 'text-gray-700'}`}>
          {label}
        </span>
      </div>
    </div>
  );
}
