import { useState, useCallback } from 'react';
import type { NotificationType } from '@/types/messages';

/**
 * In-chat notification toast state (Session 50 — messages.tsx decomposition
 * tranche 1, "notification" domain from docs/messages-decomposition-plan.md).
 *
 * Replaces three useState hooks (showNotification / notificationMessage /
 * notificationType) with one nullable object. `showNotif` keeps the exact
 * signature the page's ~70 call sites already use.
 */
export function useChatNotification() {
  const [notification, setNotification] = useState<{
    message: string;
    type: NotificationType;
  } | null>(null);

  const showNotif = useCallback((message: string, type: NotificationType = 'info') => {
    setNotification({ message, type });
  }, []);

  const clearNotif = useCallback(() => setNotification(null), []);

  return { notification, showNotif, clearNotif };
}
