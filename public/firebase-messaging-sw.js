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
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.conversationId ? `msg-${payload.data.conversationId}` : 'new-message',
    renotify: true,
    data: {
      url: payload.data?.click_action || '/messages',
      conversationId: payload.data?.conversationId,
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open the app to the messages page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/messages';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes('mithr-1e5f4.web.app')) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url);
    })
  );
});
