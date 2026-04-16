import React, { useEffect } from 'react';
import { MESSAGE_CONFIG } from '@/constants/messages';

/* UndoToast Component — COMMENTED OUT (duplicate of delete functionality)
export function UndoToast({ onUndo, onDismiss }: { onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, MESSAGE_CONFIG.UNDO_TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-xs bg-white dark:bg-[var(--aurora-surface)] rounded-lg shadow-lg p-4 flex items-center justify-between border border-[var(--aurora-border)]">
      <span className="text-sm">Message sent</span>
      <button onClick={onUndo} className="text-xs font-bold text-aurora-indigo hover:underline">
        Undo
      </button>
    </div>
  );
}
*/
