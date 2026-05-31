import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Real-time count of the current user's conversations that have an UNREAD last
 * message (i.e. unread chats), for the home Messages tile badge.
 *
 * Implementation note: the conversation-level `unreadCount` field is NOT a
 * reliable signal — it's only ever reset to 0 in the messages page and never
 * incremented on send. The reliable signal is `lastMessageRead`, which IS
 * maintained on both ends: set false on every send (messages.tsx) and true when
 * the recipient opens the chat. A conversation is unread for this user when its
 * last message came from someone else and hasn't been read:
 *   lastMessageRead === false && lastMessageSenderId !== uid
 *
 * This counts unread *conversations* (like most chat-app tile badges). If you
 * later want an exact unread-*message* total, increment `unreadCount` on send
 * (e.g. in the sendNewMessageNotification Cloud Function) and sum it here.
 */
export function useUnreadMessageCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setCount(0);
      return;
    }

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        let total = 0;
        snap.forEach((d) => {
          const data = d.data();
          const lastSender = data.lastMessageSenderId as string | undefined;
          if (data.lastMessageRead === false && lastSender && lastSender !== user.uid) {
            total += 1;
          }
        });
        setCount(total);
      },
      (err) => {
        console.error('[useUnreadMessageCount] Firestore listener error:', err);
        setCount(0);
      }
    );

    return unsub;
  }, [user?.uid]);

  return count;
}
