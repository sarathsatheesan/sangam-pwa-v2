// ═══════════════════════════════════════════════════════════════════════
// CATERING ORDERS — Order CRUD, status management, payments, messaging
// ═══════════════════════════════════════════════════════════════════════

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { CateringOrder, OrderItem } from './cateringTypes';

const ORDERS_COL = 'cateringOrders';

// ── Order CRUD ──

export async function createOrder(order: Omit<CateringOrder, 'id'>): Promise<string> {
  // Filter out undefined values — Firestore rejects them
  const cleanOrder = Object.fromEntries(
    Object.entries(order).filter(([, v]) => v !== undefined),
  );
  const docRef = await addDoc(collection(db, ORDERS_COL), {
    ...cleanOrder,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function fetchOrdersByCustomer(customerId: string): Promise<CateringOrder[]> {
  const q = query(
    collection(db, ORDERS_COL),
    where('customerId', '==', customerId),
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringOrder));
  return results.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
}

export async function fetchOrdersByBusiness(businessId: string): Promise<CateringOrder[]> {
  const q = query(
    collection(db, ORDERS_COL),
    where('businessId', '==', businessId),
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringOrder));
  return results.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
}

export function subscribeToCustomerOrders(
  customerId: string,
  callback: (orders: CateringOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, ORDERS_COL),
    where('customerId', '==', customerId),
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringOrder));
    results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    callback(results);
  }, (err) => {
    console.warn('subscribeToCustomerOrders error:', err);
    callback([]);
  });
}

export function subscribeToBusinessOrders(
  businessId: string,
  callback: (orders: CateringOrder[]) => void,
): Unsubscribe {
  // Use single-field where to avoid composite index requirement; sort client-side
  const q = query(
    collection(db, ORDERS_COL),
    where('businessId', '==', businessId),
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringOrder));
    results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    callback(results);
  }, (err) => {
    console.warn('subscribeToBusinessOrders error:', err);
    callback([]);
  });
}

export async function updateOrderStatus(
  orderId: string,
  status: CateringOrder['status'],
  extra?: Record<string, any>,
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);
  const updates: Record<string, any> = { status, ...extra };
  if (status === 'confirmed') updates.confirmedAt = serverTimestamp();
  // Append to statusHistory for timeline tracking
  updates.statusHistory = arrayUnion({
    status,
    timestamp: Timestamp.now(),
  });
  await updateDoc(ref, updates);
}

export async function cancelOrder(
  orderId: string,
  reason: string,
  cancelledBy: 'customer' | 'vendor',
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);
  await updateDoc(ref, {
    status: 'cancelled',
    cancellationReason: reason,
    cancelledBy,
    cancelledAt: serverTimestamp(),
    statusHistory: arrayUnion({
      status: 'cancelled',
      timestamp: Timestamp.now(),
    }),
  });
}

// ── Catering-enabled businesses ──

export async function fetchCateringBusinesses(): Promise<any[]> {
  const q = query(
    collection(db, 'businesses'),
    where('isCateringEnabled', '==', true),
    where('registrationStatus', '==', 'approved'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchCateringBusinessesByCategory(category: string): Promise<any[]> {
  const constraints = [
    ...(category !== 'all' ? [where('category', '==', category)] : []),
    where('isCateringEnabled', '==', true),
    where('registrationStatus', '==', 'approved'),
  ];
  const q = query(collection(db, 'businesses'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Helpers ──

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function calculateOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
}

// ── Batch operations ──

export async function batchUpdateOrderStatus(
  orderIds: string[],
  newStatus: CateringOrder['status'],
  extra?: Record<string, any>,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  for (const id of orderIds) {
    try {
      await updateOrderStatus(id, newStatus, extra);
      success++;
    } catch {
      failed++;
    }
  }
  return { success, failed };
}

// ── Order modification by vendor (#18) ──

export async function vendorModifyOrder(
  orderId: string,
  updates: {
    items: OrderItem[];
    total: number;
    subtotal: number;
    tax?: number;
    note: string;
  },
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Order not found');
  const data = snap.data() as CateringOrder;

  // Only allow modification for confirmed/preparing
  if (!['confirmed', 'preparing'].includes(data.status)) {
    throw new Error('Can only modify confirmed or preparing orders');
  }

  await updateDoc(ref, {
    originalItems: data.items, // save snapshot
    items: updates.items,
    subtotal: updates.subtotal,
    total: updates.total,
    ...(updates.tax !== undefined ? { tax: updates.tax } : {}),
    vendorModified: true,
    vendorModifiedAt: serverTimestamp(),
    vendorModificationNote: updates.note,
  });
}

// ── Vendor payment info (#13) ──

export async function updateBusinessPaymentInfo(
  businessId: string,
  payment: { paymentUrl?: string; paymentMethod?: string; paymentNote?: string },
): Promise<void> {
  await updateDoc(doc(db, 'businesses', businessId), {
    paymentUrl: payment.paymentUrl || '',
    paymentMethod: payment.paymentMethod || '',
    paymentNote: payment.paymentNote || '',
  });
}

export async function getBusinessPaymentInfo(
  businessId: string,
): Promise<{ paymentUrl?: string; paymentMethod?: string; paymentNote?: string }> {
  const snap = await getDoc(doc(db, 'businesses', businessId));
  if (!snap.exists()) return {};
  const data = snap.data();
  return {
    paymentUrl: data.paymentUrl,
    paymentMethod: data.paymentMethod,
    paymentNote: data.paymentNote,
  };
}

// ── Customer-vendor messaging (#14) ──

export async function findOrCreateConversation(
  customerId: string,
  vendorOwnerId: string,
  context?: string,
): Promise<string> {
  // Check if a conversation already exists between these two users
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', customerId),
  );
  const snap = await getDocs(q);
  const existing = snap.docs.find(d => {
    const participants = d.data().participants as string[];
    return participants.includes(vendorOwnerId);
  });

  if (existing) return existing.id;

  // Create new conversation
  const convRef = await addDoc(collection(db, 'conversations'), {
    participants: [customerId, vendorOwnerId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: context || 'New catering inquiry',
    lastMessageTime: serverTimestamp(),
    lastMessageSenderId: customerId,
  });

  // Add initial context message
  if (context) {
    await addDoc(collection(db, 'conversations', convRef.id, 'messages'), {
      text: context,
      senderId: customerId,
      createdAt: Timestamp.now(),
      encrypted: false,
    });
  }

  return convRef.id;
}
