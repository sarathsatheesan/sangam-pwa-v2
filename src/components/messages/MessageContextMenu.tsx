import React from 'react';
import {
  Reply, Forward, Pin, PinOff, Star, StarOff, Edit3, Trash2,
  Flag, Ban,
} from 'lucide-react';

/**
 * MessageContextMenu Component
 * Context menu for message actions (edit, delete, report, block)
 */
export function MessageContextMenu({
  isMine,
  onDelete,
  onEdit,
  onReport,
  onBlock,
  onReply,
  onForward,
  onPin,
  onStar,
  onClose,
  isRecent,
  isPinned,
  isStarred,
}: {
  isMine: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  onPin?: () => void;
  onStar?: () => void;
  onClose: () => void;
  isRecent: boolean;
  isPinned?: boolean;
  isStarred?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose} onTouchStart={onClose} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div className="bg-white dark:bg-[var(--aurora-surface)] rounded-lg shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        {onReply && (
          <button onClick={() => { onReply(); onClose(); }} className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm" style={{ color: 'var(--msg-text)' }}>
            <Reply size={15} className="text-aurora-indigo" /> Reply
          </button>
        )}
        {onForward && (
          <button onClick={() => { onForward(); onClose(); }} className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm" style={{ color: 'var(--msg-text)' }}>
            <Forward size={15} className="text-aurora-indigo" /> Forward
          </button>
        )}
        {onPin && (
          <button onClick={() => { onPin(); onClose(); }} className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm" style={{ color: 'var(--msg-text)' }}>
            {isPinned ? <PinOff size={15} className="text-aurora-indigo" /> : <Pin size={15} className="text-aurora-indigo" />}
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
        )}
        {onStar && (
          <button onClick={() => { onStar(); onClose(); }} className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm" style={{ color: 'var(--msg-text)' }}>
            {isStarred ? <StarOff size={15} className="text-amber-500" /> : <Star size={15} className="text-amber-500" />}
            {isStarred ? 'Unstar' : 'Star'}
          </button>
        )}
        {isMine && isRecent && onEdit && (
          <button
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm"
          >
            <Edit3 size={15} className="text-aurora-indigo" /> Edit
          </button>
        )}
        {isMine && onDelete && (
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm text-red-500"
          >
            <Trash2 size={15} /> Delete
          </button>
        )}
        {!isMine && onReport && (
          <button
            onClick={() => {
              onReport();
              onClose();
            }}
            className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm"
            style={{ color: 'var(--msg-secondary)' }}
          >
            <Flag size={15} /> Report Message
          </button>
        )}
        {!isMine && onBlock && (
          <button
            onClick={() => {
              onBlock();
              onClose();
            }}
            className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm text-red-500"
          >
            <Ban size={15} /> Block User
          </button>
        )}
      </div>
    </div>
  );
}
