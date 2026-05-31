/**
 * Native FCM push for Android via @capacitor/push-notifications.
 *
 * This reuses your EXISTING backend contract: notification recipients are read
 * from `users/{uid}.fcmTokens` (an array). The native device token is appended
 * to that same array with arrayUnion, so your existing Cloud Functions deliver
 * to native devices with zero backend changes.
 *
 * Notification tap routing mirrors `public/firebase-messaging-sw.js`: it honours
 * `data.url` / `data.click_action`, and otherwise builds a /catering or /messages
 * deep link from the payload data.
 */
import { PushNotifications } from '@capacitor/push-notifications';
import type { PushNotificationSchema } from '@capacitor/push-notifications';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

type NavigateFn = (pathOrUrl: string) => void;

/** Build a deep-link path from FCM data, matching the web service worker logic. */
function resolveClickUrl(data: Record<string, unknown> | undefined): string {
  if (!data) return '/messages';
  // Incoming-call taps go to /messages, where the in-app call listener picks up
  // the still-ringing call doc and shows the call UI (Bug 1).
  if (data.type === 'incoming_call') return '/messages';
  const url = (data.click_action as string) || (data.url as string) || '';
  if (url) return url;

  const template = (data.template as string) || '';
  const isCatering =
    template.startsWith('order_') ||
    template.startsWith('quote_') ||
    template.startsWith('vendor_') ||
    template.startsWith('rfp_') ||
    template.startsWith('reprice_') ||
    template === 'review_flagged';

  if (isCatering) {
    const orderId = data.orderId as string | undefined;
    const requestId = data.requestId as string | undefined;
    const role = data.role as string | undefined;
    if (orderId && role === 'vendor') return `/catering?vendorView=orders&orderId=${orderId}`;
    if (orderId) return `/catering?view=orders&orderId=${orderId}`;
    if (requestId && role === 'vendor') return '/catering?vendorView=quotes';
    if (requestId) return `/catering?view=quotes&quoteRequestId=${requestId}`;
    return '/catering';
  }
  return '/messages';
}

/** Persist a device token to the signed-in user's fcmTokens array. */
async function saveToken(token: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    // Not signed in yet — retry once auth settles.
    const off = auth.onAuthStateChanged((u) => {
      if (u) {
        off();
        void updateDoc(doc(db, 'users', u.uid), { fcmTokens: arrayUnion(token) });
      }
    });
    return;
  }
  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });
}

export async function registerNativePush(navigate: NavigateFn): Promise<void> {
  // Ask for the OS notification permission (Android 13+ requires POST_NOTIFICATIONS).
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') {
    console.warn('[native/push] Notification permission not granted');
    return;
  }

  // Android 8+ requires notification CHANNELS. These ids must match the
  // channelId values sent by the Cloud Functions (Bug 7). Importance 5 = HIGH
  // → heads-up banners. No-op on iOS.
  try {
    await PushNotifications.createChannel({
      id: 'messages', name: 'Messages',
      description: 'Direct and group messages',
      importance: 5, visibility: 1, vibration: true,
    });
    await PushNotifications.createChannel({
      id: 'calls', name: 'Calls',
      description: 'Incoming voice and video calls',
      importance: 5, visibility: 1, vibration: true,
    });
  } catch (err) {
    console.warn('[native/push] createChannel skipped (non-Android or unsupported):', err);
  }

  // Register the device with FCM (token arrives on the "registration" event).
  await PushNotifications.register();

  await PushNotifications.addListener('registration', (tokenData) => {
    void saveToken(tokenData.value);
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.error('[native/push] Registration error:', err);
  });

  // Foreground receipt — Android does NOT show a banner while the app is open;
  // it hands the notification to us. Broadcast it so the in-app toast bridge
  // (mounted in MainLayout) can surface what arrived.
  await PushNotifications.addListener('pushNotificationReceived', (notif: PushNotificationSchema) => {
    console.log('[native/push] Foreground push:', notif.title);
    window.dispatchEvent(new CustomEvent('enovo:push-foreground', {
      detail: {
        title: notif.title || 'New notification',
        body: notif.body || '',
        data: (notif.data as Record<string, unknown>) || {},
      },
    }));
  });

  // Tap on a notification → route into the SPA.
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = resolveClickUrl(action.notification.data as Record<string, unknown>);
    navigate(url);
  });
}
