import { useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';

/**
 * Bridges NATIVE foreground push notifications into the in-app toast UI.
 *
 * On Android, when a push arrives while the app is in the foreground, the OS
 * does NOT show a heads-up banner — it delivers the notification to the app via
 * `pushNotificationReceived` (see src/native/push.ts), which re-broadcasts it as
 * a window 'enovo:push-foreground' event. This component listens for that event
 * and shows a toast so the user can see what arrived (Bug 7 follow-up).
 *
 * Renders nothing; safe on web (the event simply never fires there).
 */
export default function NativePushToast() {
  const { addToast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { title?: string; body?: string; data?: Record<string, unknown> }
        | undefined;
      if (!detail) return;
      const title = detail.title?.trim();
      const body = detail.body?.trim();
      const message = title && body ? `${title}: ${body}` : (title || body || 'New notification');
      addToast(message, 'info', 5000);
    };
    window.addEventListener('enovo:push-foreground', handler);
    return () => window.removeEventListener('enovo:push-foreground', handler);
  }, [addToast]);

  return null;
}
