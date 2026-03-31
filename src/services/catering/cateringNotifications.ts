// ═══════════════════════════════════════════════════════════════════════
// CATERING NOTIFICATIONS — In-app notification pipeline for order events
// Bridges the User ↔ Vendor handoff gap
// ═══════════════════════════════════════════════════════════════════════

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface CateringNotification {
  id: string;
  recipientId: string;
  type:
    | 'new_order'           // vendor: new order received
    | 'order_confirmed'     // customer: vendor confirmed
    | 'order_preparing'     // customer: order being prepared
    | 'order_ready'         // customer: order ready
    | 'order_out_for_delivery' // customer: out for delivery
    | 'order_delivered'     // customer: delivered
    | 'order_cancelled'     // both: order cancelled
    | 'order_modified'      // customer: vendor modified order
    | 'modification_rejected' // vendor: customer rejected modification
    | 'quote_received'      // customer: new vendor quote on RFP
    | 'quote_accepted';     // vendor: customer accepted quote
  title: string;
  body: string;
  orderId?: string;
  quoteRequestId?: string;
  businessId?: string;
  businessName?: string;
  read: boolean;
  createdAt?: any;
}

const NOTIF_COL = 'cateringNotifications';

/**
 * Send an in-app notification to a user.
 */
export async function sendCateringNotification(
  notification: Omit<CateringNotification, 'id' | 'read' | 'createdAt'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, NOTIF_COL), {
    ...notification,
    read: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Notify vendor of a new incoming order.
 */
export async function notifyVendorNewOrder(
  vendorOwnerId: string,
  orderId: string,
  customerName: string,
  businessName: string,
  total: number,
): Promise<void> {
  await sendCateringNotification({
    recipientId: vendorOwnerId,
    type: 'new_order',
    title: 'New Catering Order',
    body: `${customerName} placed a $${(total / 100).toFixed(2)} order for ${businessName}`,
    orderId,
    businessName,
  });
}

/**
 * Notify customer of order status change.
 */
export async function notifyCustomerStatusChange(
  customerId: string,
  orderId: string,
  newStatus: string,
  businessName: string,
): Promise<void> {
  const statusMessages: Record<string, { title: string; body: string }> = {
    confirmed: {
      title: 'Order Confirmed',
      body: `${businessName} has confirmed your catering order`,
    },
    preparing: {
      title: 'Order Being Prepared',
      body: `${businessName} has started preparing your order`,
    },
    ready: {
      title: 'Order Ready',
      body: `Your order from ${businessName} is ready for pickup/delivery`,
    },
    out_for_delivery: {
      title: 'Out for Delivery',
      body: `Your order from ${businessName} is on its way!`,
    },
    delivered: {
      title: 'Order Delivered',
      body: `Your order from ${businessName} has been delivered. Enjoy!`,
    },
    cancelled: {
      title: 'Order Cancelled',
      body: `Your order from ${businessName} has been cancelled`,
    },
  };

  const msg = statusMessages[newStatus];
  if (!msg) return;

  await sendCateringNotification({
    recipientId: customerId,
    type: `order_${newStatus}` as CateringNotification['type'],
    title: msg.title,
    body: msg.body,
    orderId,
    businessName,
  });
}

/**
 * Notify customer that vendor modified their order.
 */
export async function notifyCustomerOrderModified(
  customerId: string,
  orderId: string,
  businessName: string,
  modificationNote: string,
): Promise<void> {
  await sendCateringNotification({
    recipientId: customerId,
    type: 'order_modified',
    title: 'Order Modified by Vendor',
    body: `${businessName} updated your order: ${modificationNote}`,
    orderId,
    businessName,
  });
}

/**
 * Notify vendor that customer rejected their order modification (F-06).
 */
export async function notifyVendorModificationRejected(
  vendorOwnerId: string,
  orderId: string,
  customerName: string,
  businessName: string,
): Promise<void> {
  await sendCateringNotification({
    recipientId: vendorOwnerId,
    type: 'modification_rejected',
    title: 'Modification Rejected',
    body: `${customerName} rejected your changes to their order at ${businessName}`,
    orderId,
    businessName,
  });
}

/**
 * Fetch recent notifications for a user.
 */
export async function fetchCateringNotifications(
  userId: string,
  maxResults = 50,
): Promise<CateringNotification[]> {
  const q = query(
    collection(db, NOTIF_COL),
    where('recipientId', '==', userId),
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringNotification));
  // Client-side sort (avoids composite index)
  results.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
  return results.slice(0, maxResults);
}

/**
 * Subscribe to real-time notifications for a user.
 */
export function subscribeToCateringNotifications(
  userId: string,
  callback: (notifications: CateringNotification[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, NOTIF_COL),
    where('recipientId', '==', userId),
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringNotification));
    results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    callback(results);
  });
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, NOTIF_COL, notifId), { read: true });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, NOTIF_COL),
    where('recipientId', '==', userId),
    where('read', '==', false),
  );
  const snap = await getDocs(q);
  const updates = snap.docs.map(d => updateDoc(d.ref, { read: true }));
  await Promise.all(updates);
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const q = query(
    collection(db, NOTIF_COL),
    where('recipientId', '==', userId),
    where('read', '==', false),
  );
  const snap = await getDocs(q);
  return snap.size;
}
