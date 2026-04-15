/* eslint-disable no-undef */
/**
 * Firebase Messaging Service Worker
 * Handles background push notifications when the app is not in focus.
 * This file MUST be at the root (/firebase-messaging-sw.js) for FCM to work.
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyClfuZtD0Si-oZ0QRJXcVFvyakYh0Csgyo',
  authDomain: 'mithr-1e5f4.firebaseapp.com',
  projectId: 'mithr-1e5f4',
  storageBucket: 'mithr-1e5f4.firebasestorage.app',
  messagingSenderId: '699698490740',
  appId: '1:699698490740:web:1941b2de4cc25dac095021',
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in focus)
// Routes catering notifications to /catering, messages to /messages
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'New Notification';
  const template = payload.data?.template || '';
  const isCatering = template.startsWith('order_') || template.startsWith('quote_')
    || template.startsWith('vendor_') || template.startsWith('rfp_')
    || template === 'review_flagged';

  // Determine click destination based on notification type
  const defaultUrl = isCatering ? '/catering' : '/messages';
  const clickUrl = payload.data?.click_action || defaultUrl;

  // Use more specific tags to avoid collapsing unrelated notifications
  let tag = 'notification';
  if (payload.data?.conversationId) {
    tag = 'msg-' + payload.data.conversationId;
  } else if (payload.data?.orderId) {
    tag = 'order-' + payload.data.orderId;
  } else if (payload.data?.requestId) {
    tag = 'rfp-' + payload.data.requestId;
  }

  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: tag,
    renotify: true,
    data: {
      url: clickUrl,
      conversationId: payload.data?.conversationId,
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open the app to the messages page
// Cross-browser: Chrome, Safari, Firefox, Android Chrome, iOS Safari 16.4+ PWA
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/messages';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes('mithr-1e5f4.web.app') || client.url.includes('localhost')) {
          client.focus();
          // Firefox does not support client.navigate() — use postMessage fallback
          if (typeof client.navigate === 'function') {
            client.navigate(url);
          } else {
            client.postMessage({ type: 'NOTIFICATION_CLICK', url: url });
          }
          return;
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url);
    })
  );
});
