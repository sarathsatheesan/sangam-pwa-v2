import { useState, useCallback } from 'react';
import type { Message } from '@/types/messages';

/**
 * Message context-menu + delete-confirm state (Session 52 — messages.tsx
 * decomposition tranche 3, domain 3 of docs/messages-state-decomposition-plan.md).
 *
 * - `contextMenuMsg`/`setContextMenuMsg` keep their exact useState shape:
 *   the page has 10 call sites (open on right-click/long-press, null on every
 *   menu action) that need zero edits.
 * - The old showDeleteMsgConfirm + deleteMsgId pair collapses into one
 *   nullable `deleteMsgId` (non-null == confirm dialog visible — they were
 *   only ever toggled together).
 *
 * Firestore I/O (the actual deleteDoc) stays in the page per tranche rules.
 */
export function useMessageActions() {
  const [contextMenuMsg, setContextMenuMsg] = useState<Message | null>(null);
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);

  /** Open the delete-confirm dialog for a message. */
  const requestDeleteMessage = useCallback((messageId: string) => {
    setDeleteMsgId(messageId);
  }, []);

  /** Close the delete-confirm dialog (cancel or after completion). */
  const cancelDeleteMessage = useCallback(() => {
    setDeleteMsgId(null);
  }, []);

  return {
    contextMenuMsg,
    setContextMenuMsg,
    deleteMsgId,
    requestDeleteMessage,
    cancelDeleteMessage,
  };
}
