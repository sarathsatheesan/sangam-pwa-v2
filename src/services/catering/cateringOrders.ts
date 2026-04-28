// ═══════════════════════════════════════════════════════════════════════
// CATERING ORDERS — Order CRUD, status management, payments, messaging
// ═══════════════════════════════════════════════════════════════════════

/**
 * Error Handling Convention (H7):
 * - All public service functions use try-catch internally
 * - Errors are logged with console.error('[ServiceName] context:', error)
 * - Critical mutations (order creation, payment) re-throw after logging
 * - Non-critical reads (analytics, preferences) return fallback values silently
 * - Fire-and-forget writes (logging, analytics) use .catch(() => {}) to avoid blocking
 */

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  increment,
  Timestamp,
  runTransaction,
  type Unsubscribe,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { CateringOrder, OrderItem, OrderNote, CateringQuoteRequest, CateringQuoteResponse } from './cateringTypes';
import { notifyCustomerStatusChange, notifyCustomerOrderModified, notifyOrderCancelled } from './cateringNotifications';
import { notifyOrderCancelledMultiChannel } from '../notificationService';

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
    const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
    const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
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
    const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
    const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
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
      const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
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
      const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return bTime - aTime;
    });
    callback(results);
  }, (err) => {
    console.warn('subscribeToBusinessOrders error:', err);
    callback([]);
  });
}

// ── Status state machine — valid transitions ──
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],      // terminal state
  cancelled: [],      // terminal state
};

export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string,
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * FIX-C2: Optimistic locking via _version field.
 * Uses a Firestore transaction to read current version, validate transition,
 * and atomically increment version + update status. Concurrent writes are
 * rejected and the caller should retry with fresh data.
 */
export async function updateOrderStatus(
  orderId: string,
  status: CateringOrder['status'],
  extra?: Record<string, any>,
  callerRole?: { uid: string; role: 'customer' | 'vendor' },
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);

  const orderData = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('Order not found');
    const data = snap.data() as CateringOrder & { _version?: number };
    const currentStatus = data.status;

    // Validate transition
    if (!isValidStatusTransition(currentStatus, status)) {
      throw new Error(`Invalid status transition: ${currentStatus} → ${status}`);
    }

    // SB-40: Role-based authorization on status transitions
    if (callerRole) {
      const vendorOnlyStatuses = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
      if (vendorOnlyStatuses.includes(status) && callerRole.role !== 'vendor') {
        throw new Error('Only the vendor can advance order status');
      }
    }

    const updates: Record<string, any> = {
      status,
      _version: (data._version || 0) + 1,
      ...extra,
    };
    if (status === 'confirmed') updates.confirmedAt = serverTimestamp();
    updates.statusHistory = arrayUnion({
      status,
      timestamp: Timestamp.now(),
    });
    transaction.update(ref, updates);
    return data;
  });

  // Fire notification (non-blocking, outside transaction)
  if (status !== 'pending') {
    notifyCustomerStatusChange(orderData.customerId, orderId, status, orderData.businessName).catch((err) => console.error('[CateringOrders] Notification failed:', err));
  }
}

/**
 * FIX-C2 + FIX-H3: Transactional cancel with optimistic locking.
 * If a paid order is cancelled, automatically sets paymentStatus to 'refund_pending'.
 */
export async function cancelOrder(
  orderId: string,
  reason: string,
  cancelledBy: 'customer' | 'vendor',
  callerUid?: string,
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);

  const orderData = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('Order not found');
    const data = snap.data() as CateringOrder & { _version?: number; paymentStatus?: string };
    const currentStatus = data.status;

    if (!isValidStatusTransition(currentStatus, 'cancelled')) {
      throw new Error(`Cannot cancel an order that is ${currentStatus.replace(/_/g, ' ')}`);
    }

    // SB-40: Verify caller matches cancelledBy role
    if (callerUid && cancelledBy === 'customer' && data.customerId !== callerUid) {
      throw new Error('Only the order customer can cancel as customer');
    }

    const updates: Record<string, any> = {
      status: 'cancelled',
      _version: (data._version || 0) + 1,
      cancellationReason: reason,
      cancelledBy,
      cancelledAt: serverTimestamp(),
      statusHistory: arrayUnion({
        status: 'cancelled',
        timestamp: Timestamp.now(),
      }),
    };

    // FIX-H3: Auto-trigger refund flow if order was already paid
    if (data.paymentStatus === 'paid') {
      updates.paymentStatus = 'refund_pending';
      updates.statusHistory = arrayUnion(
        { status: 'cancelled', timestamp: Timestamp.now() },
        { status: 'payment_refund_pending', timestamp: Timestamp.now() },
      );
    }

    transaction.update(ref, updates);
    return data;
  });

  // Notify the OTHER party about the cancellation (non-blocking, outside transaction)
  if (cancelledBy === 'customer' && orderData.businessId) {
    // Customer cancelled → notify vendor
    getDoc(doc(db, 'businesses', orderData.businessId)).then((bizSnap) => {
      const ownerId = bizSnap.data()?.ownerId;
      if (ownerId) {
        notifyOrderCancelled(ownerId, orderId, orderData.businessName, cancelledBy, reason);
        notifyOrderCancelledMultiChannel(ownerId, orderId, orderData.businessName, cancelledBy, reason);
      }
    }).catch((err) => console.error('[CateringOrders] Failed to notify vendor of cancellation:', orderId, err));
  } else if (cancelledBy === 'vendor') {
    // Vendor cancelled → notify customer
    notifyOrderCancelled(orderData.customerId, orderId, orderData.businessName, cancelledBy, reason)
      .catch((err) => console.error('[CateringOrders] Failed to notify customer of cancellation:', orderId, err));
    notifyOrderCancelledMultiChannel(orderData.customerId, orderId, orderData.businessName, cancelledBy, reason)
      .catch((err) => console.error('[CateringOrders] Failed to send multi-channel cancellation:', orderId, err));
  }
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

/**
 * FIX-H1: Batch operations with per-order error reporting and optimistic locking.
 * Each order is still updated in its own transaction (Firestore limit: 500 ops per batch,
 * and different orders may have different current statuses), but we now return detailed
 * per-order results so the UI can show exactly which orders failed and why.
 */
export async function batchUpdateOrderStatus(
  orderIds: string[],
  newStatus: CateringOrder['status'],
  extra?: Record<string, any>,
): Promise<{ success: number; failed: number; results: Array<{ orderId: string; ok: boolean; error?: string }> }> {
  const results: Array<{ orderId: string; ok: boolean; error?: string }> = [];

  for (const id of orderIds) {
    try {
      const ref = doc(db, ORDERS_COL, id);
      const orderData = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error('Order not found');
        const data = snap.data() as CateringOrder & { _version?: number };
        if (!isValidStatusTransition(data.status, newStatus)) {
          throw new Error(`Cannot change from ${data.status} to ${newStatus}`);
        }
        const updates: Record<string, any> = {
          status: newStatus,
          _version: (data._version || 0) + 1,
          ...extra,
        };
        if (newStatus === 'confirmed') updates.confirmedAt = serverTimestamp();
        updates.statusHistory = arrayUnion({
          status: newStatus,
          timestamp: Timestamp.now(),
        });
        transaction.update(ref, updates);
        return data;
      });
      results.push({ orderId: id, ok: true });

      // Fire notification for this order (non-blocking)
      if (newStatus !== 'pending') {
        notifyCustomerStatusChange(orderData.customerId, id, newStatus, orderData.businessName).catch((err) => console.error('[CateringOrders] Notification failed:', err));
      }
    } catch (err: any) {
      results.push({ orderId: id, ok: false, error: err.message || 'Unknown error' });
    }
  }

  const success = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  return { success, failed, results };
}

// ── Order modification by vendor (#18) ──

/**
 * FIX-H2: Modification lock — prevents stacking modifications before customer responds.
 * Uses a transaction to check for existing pending modifications, saves original items
 * only on the FIRST modification (preserving the true original), and sets a
 * pendingModification flag that blocks further edits until customer accepts/rejects.
 */
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

  const orderData = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('Order not found');
    const data = snap.data() as CateringOrder & { _version?: number; pendingModification?: boolean; originalItems?: OrderItem[] };

    // Only allow modification for confirmed/preparing
    if (!['confirmed', 'preparing'].includes(data.status)) {
      throw new Error('Can only modify confirmed or preparing orders');
    }

    // FIX-H2: Block if a modification is already pending customer response
    if (data.pendingModification) {
      throw new Error('A modification is already pending customer approval. Please wait for the customer to respond before making additional changes.');
    }

    const modUpdates: Record<string, any> = {
      // Only save originalItems if this is the first modification (preserve true original)
      ...(data.originalItems ? {} : { originalItems: data.items }),
      items: updates.items,
      subtotal: updates.subtotal,
      total: updates.total,
      ...(updates.tax !== undefined ? { tax: updates.tax } : {}),
      vendorModified: true,
      vendorModifiedAt: serverTimestamp(),
      vendorModificationNote: updates.note,
      pendingModification: true,        // FIX-H2: Lock flag
      modificationExpiresAt: Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000), // FIX-H2: 48hr auto-reject
      _version: (data._version || 0) + 1,
    };
    transaction.update(ref, modUpdates);
    return data;
  });

  // Notify customer of modification (non-blocking, outside transaction)
  notifyCustomerOrderModified(orderData.customerId, orderId, orderData.businessName, updates.note).catch((err) => console.error('[CateringOrders] Notification failed:', err));
}

/**
 * FIX-H2: Customer responds to a vendor modification — accept or reject.
 * Clears the pendingModification lock so vendor can make further changes if needed.
 */
export async function respondToModification(
  orderId: string,
  action: 'accept' | 'reject',
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('Order not found');
    const data = snap.data() as CateringOrder & { _version?: number; pendingModification?: boolean; originalItems?: OrderItem[] };

    if (!data.pendingModification && !data.vendorModified) {
      throw new Error('No pending modification to respond to');
    }

    const updates: Record<string, any> = {
      pendingModification: false,
      modificationExpiresAt: null,
      vendorModified: false,
      _version: (data._version || 0) + 1,
    };

    if (action === 'reject' && data.originalItems) {
      // Revert to original items
      updates.items = data.originalItems;
      updates.subtotal = data.originalItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
      updates.tax = calculateTax(updates.subtotal, data.deliveryAddress?.state);
      updates.total = updates.subtotal + updates.tax;
      updates.vendorModificationNote = null;
    }

    // Clear the originalItems snapshot after responding (no longer needed)
    updates.originalItems = null;

    updates.statusHistory = arrayUnion({
      status: `modification_${action}ed`,
      timestamp: Timestamp.now(),
    });

    transaction.update(ref, updates);
  });
}

// ── Vendor payment info (#13) ──
// NOTE: Payment setup is OPTIONAL. Vendors can accept and manage orders without
// payment info configured — the system never hard-locks acceptance. Customers
// simply won't see a "Pay" button if no payment info exists (see PaymentInfoSection
// in CateringOrderStatus.tsx, which returns null when all fields are empty).

export async function updateBusinessPaymentInfo(
  businessId: string,
  payment: { paymentUrl?: string; paymentMethod?: string; paymentNote?: string },
): Promise<void> {
  await updateDoc(doc(db, 'businesses', businessId), {
    paymentUrl: payment.paymentUrl || '',
    paymentMethod: payment.paymentMethod || '',
    paymentNote: payment.paymentNote || '',
    // Saving payment info implicitly clears any "remind me later" deferral.
    paymentSetupSkippedUntil: null,
  });
}

export async function getBusinessPaymentInfo(
  businessId: string,
): Promise<{
  paymentUrl?: string;
  paymentMethod?: string;
  paymentNote?: string;
  paymentSetupSkippedUntil?: number | null;
}> {
  const snap = await getDoc(doc(db, 'businesses', businessId));
  if (!snap.exists()) return {};
  const data = snap.data();
  // paymentSetupSkippedUntil is stored as a Firestore Timestamp. Convert to
  // epoch millis so cross-browser Date comparisons work without Firestore types
  // leaking into UI code. Chrome/Safari/Firefox/iOS/Android all handle number OK.
  let skippedUntil: number | null = null;
  const raw = data.paymentSetupSkippedUntil;
  if (raw) {
    if (typeof raw?.toMillis === 'function') skippedUntil = raw.toMillis();
    else if (typeof raw === 'number') skippedUntil = raw;
    else if (raw instanceof Date) skippedUntil = raw.getTime();
  }
  return {
    paymentUrl: data.paymentUrl,
    paymentMethod: data.paymentMethod,
    paymentNote: data.paymentNote,
    paymentSetupSkippedUntil: skippedUntil,
  };
}

/**
 * Defer payment setup. Stores a future timestamp on the business doc; the
 * dashboard reminder banner stays hidden until that timestamp passes.
 * Pass `null` to clear the deferral immediately.
 */
export async function deferPaymentSetup(
  businessId: string,
  days: number | null,
): Promise<void> {
  let until: Timestamp | null = null;
  if (days !== null && days > 0) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    until = Timestamp.fromDate(d);
  }
  await updateDoc(doc(db, 'businesses', businessId), {
    paymentSetupSkippedUntil: until,
  });
}

// ── Payment status tracking (H-05) ──

/**
 * FIX-H8: Validated payment status transitions.
 * Only allows: pending → paid (requires transactionId), paid → refunded (requires reason),
 * paid → refund_pending, refund_pending → refunded.
 * Tracks payment events in statusHistory for audit trail.
 */
const VALID_PAYMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid'],
  paid: ['refunded', 'refund_pending'],
  refund_pending: ['refunded'],
  refunded: [],
};

export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'refund_pending',
  extra?: { paymentMethod?: string; paymentNote?: string; transactionId?: string },
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('Order not found');
    const data = snap.data() as CateringOrder & { paymentStatus?: string; _version?: number };
    const currentPaymentStatus = data.paymentStatus || 'pending';

    // Validate payment transition
    const allowed = VALID_PAYMENT_TRANSITIONS[currentPaymentStatus] || [];
    if (!allowed.includes(paymentStatus)) {
      throw new Error(`Invalid payment transition: ${currentPaymentStatus} → ${paymentStatus}`);
    }

    // Require transactionId for marking as paid
    if (paymentStatus === 'paid' && !extra?.transactionId) {
      throw new Error('A transaction ID is required to mark an order as paid');
    }

    transaction.update(ref, {
      paymentStatus,
      ...(extra || {}),
      paymentUpdatedAt: serverTimestamp(),
      _version: (data._version || 0) + 1,
      statusHistory: arrayUnion({
        status: `payment_${paymentStatus}`,
        timestamp: Timestamp.now(),
      }),
    });
  });
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

// ── RFP → Order conversion ──

/**
 * FIX-C1 + FIX-H7: Atomic order creation from a finalized quote request.
 *
 * Uses a Firestore transaction to:
 * 1. Check for existing orders (duplicate prevention) inside the transaction
 * 2. Create all vendor orders atomically — either all succeed or none do
 * 3. Accept an optional idempotencyKey to prevent network-retry duplicates
 *
 * Groups accepted item assignments by vendor and creates one order per vendor.
 * Orders start as 'confirmed' since the vendor already accepted the quote.
 */
export async function createOrdersFromQuote(
  quoteRequest: CateringQuoteRequest,
  responses: CateringQuoteResponse[],
  deliveryAddress: { street: string; city: string; state: string; zip: string },
  idempotencyKey?: string,
): Promise<string[]> {
  let assignments = quoteRequest.itemAssignments || [];

  // Fallback: if no explicit itemAssignments exist (legacy full-accept flow),
  // derive assignments from accepted responses.
  if (assignments.length === 0) {
    const derived: typeof assignments = [];
    for (const resp of responses) {
      if (resp.status === 'accepted' || resp.status === 'partially_accepted') {
        const itemNames = resp.acceptedItemNames && resp.acceptedItemNames.length > 0
          ? resp.acceptedItemNames
          : resp.quotedItems.map((qi) => qi.name);
        for (const itemName of itemNames) {
          if (!derived.some((d) => d.itemName === itemName)) {
            derived.push({
              itemName,
              responseId: resp.id,
              businessId: resp.businessId,
              businessName: resp.businessName,
              assignedAt: null as any,
            });
          }
        }
      }
    }
    assignments = derived;
    console.log('[createOrdersFromQuote] Used fallback: derived', derived.length, 'assignments from responses');
  }

  if (assignments.length === 0) throw new Error('No item assignments found on this quote request');

  // FIX-H7: Check idempotency key before proceeding
  if (idempotencyKey) {
    const idemSnap = await getDocs(query(
      collection(db, ORDERS_COL),
      where('idempotencyKey', '==', idempotencyKey),
    ));
    if (idemSnap.size > 0) {
      console.log('[createOrdersFromQuote] Idempotency key matched — returning existing order IDs');
      return idemSnap.docs.map((d) => d.id);
    }
  }

  // Group assignments by vendor (businessId → assignments[])
  const vendorGroups = new Map<string, typeof assignments>();
  for (const a of assignments) {
    if (!vendorGroups.has(a.businessId)) vendorGroups.set(a.businessId, []);
    vendorGroups.get(a.businessId)!.push(a);
  }

  // Find the response that has customer details
  const acceptedResponse = responses.find(
    (r) => r.status === 'accepted' || r.status === 'partially_accepted',
  );
  let customerName = acceptedResponse?.customerName || '';
  let customerEmail = acceptedResponse?.customerEmail || '';
  let customerPhone = acceptedResponse?.customerPhone || '';

  // Fallback: if no customer details found on responses, look up from user profile
  if (!customerName && quoteRequest.customerId) {
    try {
      const userSnap = await getDoc(doc(db, 'users', quoteRequest.customerId));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        customerName = userData?.name || userData?.displayName || '';
        customerEmail = customerEmail || userData?.email || '';
        customerPhone = customerPhone || userData?.phone || '';
      }
    } catch {
      // Non-critical — proceed with empty name rather than failing order creation
    }
  }

  // Atomic marker: set ordersCreated = true on the quote request to block concurrent calls
  const requestRef = doc(db, 'cateringQuoteRequests', quoteRequest.id);

  // Use a transaction to read the marker, then write all orders
  const createdIds = await runTransaction(db, async (transaction) => {
    // Re-check inside transaction: has another call already created orders?
    const requestSnap = await transaction.get(requestRef);
    if (requestSnap.exists() && requestSnap.data()?.ordersCreated) {
      // Another concurrent call already created orders — abort to prevent duplicates.
      // Caller can query existing orders separately if needed.
      return [] as string[];
    }

    // Mark the request as having orders created (inside transaction for atomicity)
    transaction.update(requestRef, { ordersCreated: true, ordersCreatedAt: serverTimestamp() });

    const ids: string[] = [];

    for (const [businessId, vendorAssignments] of vendorGroups) {
      const response = responses.find((r) => r.businessId === businessId);
      if (!response) continue;

      const businessName = vendorAssignments[0]?.businessName || response.businessName;
      const assignedItemNames = new Set(vendorAssignments.map((a) => a.itemName));

      const orderItems: OrderItem[] = response.quotedItems
        .filter((qi) => assignedItemNames.has(qi.name))
        .map((qi) => ({
          menuItemId: `rfp_${response.id}_${qi.name.replace(/\s+/g, '_').toLowerCase()}`,
          name: qi.name,
          qty: qi.qty,
          unitPrice: qi.unitPrice,
          pricingType: qi.pricingType,
        }));

      if (orderItems.length === 0) continue;

      const itemSubtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
      const deliveryFee = response.deliveryFee || 0;

      // If a reprice was accepted (vendor_accepted or counter_accepted), use the negotiated total
      // instead of recalculating from individual item prices.
      // response.total in Firestore = repriceRequestedPrice or repriceCounterPrice (includes delivery fee)
      const isRepriceAccepted = response.repriceStatus === 'vendor_accepted' || response.repriceStatus === 'counter_accepted';
      const subtotal = isRepriceAccepted
        ? Math.max(0, (response.total || itemSubtotal + deliveryFee) - deliveryFee)
        : itemSubtotal;
      const tax = calculateTax(subtotal + deliveryFee, deliveryAddress.state);
      const total = subtotal + deliveryFee + tax;

      const order: Record<string, any> = {
        customerId: quoteRequest.customerId,
        customerName,
        customerEmail,
        customerPhone,
        businessId,
        businessName,
        items: orderItems,
        subtotal,
        deliveryFee,
        tax,
        total,
        status: 'confirmed',
        eventDate: quoteRequest.eventDate,
        deliveryAddress: {
          street: deliveryAddress.street,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          zip: deliveryAddress.zip,
        },
        headcount: quoteRequest.headcount,
        specialInstructions: quoteRequest.specialInstructions,
        orderForContext: quoteRequest.orderForContext,
        contactName: customerName,
        contactPhone: customerPhone,
        eventType: quoteRequest.eventType,
        quoteRequestId: quoteRequest.id,
        quoteResponseId: response.id,
        rfpOrigin: true,
        // Track reprice discount if negotiated price was accepted
        ...(isRepriceAccepted && itemSubtotal !== subtotal ? {
          repriceDiscount: itemSubtotal - subtotal,
          originalSubtotal: itemSubtotal,
        } : {}),
        _version: 1,
        createdAt: serverTimestamp(),
        confirmedAt: serverTimestamp(),
        paymentStatus: 'pending',
        statusHistory: [{
          status: 'confirmed',
          timestamp: Timestamp.now(),
        }],
      };

      // FIX-H7: Attach idempotency key
      if (idempotencyKey) order.idempotencyKey = idempotencyKey;

      // Filter out undefined values
      const cleanOrder = Object.fromEntries(
        Object.entries(order).filter(([, v]) => v !== undefined),
      );

      // Create a new doc ref and add to transaction
      const newOrderRef = doc(collection(db, ORDERS_COL));
      transaction.set(newOrderRef, cleanOrder);
      ids.push(newOrderRef.id);
    }

    return ids;
  });

  return createdIds;
}

// ── In-order messaging (OrderNotes subcollection) ──

const ORDER_NOTES_SUB = 'notes';
/** FIX-M1: Default page size for message pagination */
const NOTES_PAGE_SIZE = 50;

/**
 * FIX-M2: Send a note with automatic retry on failure.
 * Retries up to 3 times with exponential backoff (500ms, 1s, 2s).
 * Returns the note ID on success or throws after exhausting retries.
 */
export async function addOrderNote(
  orderId: string,
  note: Omit<OrderNote, 'id' | 'createdAt'>,
  maxRetries = 3,
): Promise<string> {
  const notesCol = collection(db, ORDERS_COL, orderId, ORDER_NOTES_SUB);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const docRef = await addDoc(notesCol, {
        ...note,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError || new Error('Failed to send message after retries');
}

/**
 * FIX-M1: Paginated subscription — subscribes to the most recent NOTES_PAGE_SIZE notes.
 * Returns an unsubscribe function. The callback receives notes in chronological order.
 */
export function subscribeToOrderNotes(
  orderId: string,
  callback: (notes: OrderNote[]) => void,
  pageSize: number = NOTES_PAGE_SIZE,
): Unsubscribe {
  const notesCol = collection(db, ORDERS_COL, orderId, ORDER_NOTES_SUB);
  // Subscribe to the most recent `pageSize` notes.
  // Note: orderBy + limit require a composite index on createdAt if not already present,
  // so we fall back to client-side sort + slice if the query fails.
  return onSnapshot(notesCol, (snap) => {
    const results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderNote));
    results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return aTime - bTime; // chronological order (oldest first)
    });
    // FIX-M1: Only return the most recent pageSize notes to prevent performance degradation
    const paginated = results.length > pageSize ? results.slice(-pageSize) : results;
    callback(paginated);
  }, (err) => {
    console.warn('subscribeToOrderNotes error:', err);
    callback([]);
  });
}

/**
 * FIX-M1: Load older messages beyond the current page.
 * Fetches `pageSize` notes older than the oldest note in the current set.
 */
export async function fetchOlderOrderNotes(
  orderId: string,
  oldestNoteTimestamp: any,
  pageSize: number = NOTES_PAGE_SIZE,
): Promise<OrderNote[]> {
  const notesCol = collection(db, ORDERS_COL, orderId, ORDER_NOTES_SUB);
  const snap = await getDocs(notesCol);
  const allNotes = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderNote));

  const oldestMs = oldestNoteTimestamp?.toMillis?.() || (oldestNoteTimestamp?.seconds ? oldestNoteTimestamp.seconds * 1000 : 0);

  // Filter to notes older than the oldest displayed note, sort descending, take pageSize
  const older = allNotes
    .filter((n) => {
      const nMs = n.createdAt?.toMillis?.() || (n.createdAt?.seconds ? n.createdAt.seconds * 1000 : 0);
      return nMs > 0 && nMs < oldestMs;
    })
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return bTime - aTime; // newest-first for slicing
    })
    .slice(0, pageSize);

  // Return in chronological order
  return older.reverse();
}

/**
 * Mark all unread notes in an order as read by a specific user.
 * Updates each note's `readBy` array and sets `readAt` timestamp (for sender's read receipt).
 */
export async function markOrderNotesRead(
  orderId: string,
  userId: string,
): Promise<void> {
  const notesCol = collection(db, ORDERS_COL, orderId, ORDER_NOTES_SUB);
  const snap = await getDocs(notesCol);
  const updates: Promise<void>[] = [];
  for (const noteDoc of snap.docs) {
    const data = noteDoc.data();
    const readBy: string[] = data.readBy || [];
    // Only update notes NOT sent by this user AND not already marked as read
    if (data.senderId !== userId && !readBy.includes(userId)) {
      updates.push(
        updateDoc(doc(db, ORDERS_COL, orderId, ORDER_NOTES_SUB, noteDoc.id), {
          readBy: arrayUnion(userId),
          readAt: serverTimestamp(),
        }),
      );
    }
  }
  await Promise.all(updates);
}

// ── FIX-L4: Message edit & delete ──

/**
 * FIX-L4: Edit an existing order note. Only the sender can edit, and only within 5 minutes.
 */
const MESSAGE_EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function editOrderNote(
  orderId: string,
  noteId: string,
  newText: string,
  callerUserId: string,
): Promise<void> {
  const noteRef = doc(db, ORDERS_COL, orderId, ORDER_NOTES_SUB, noteId);
  const snap = await getDoc(noteRef);
  if (!snap.exists()) throw new Error('Message not found');
  const data = snap.data();

  if (data.senderId !== callerUserId) {
    throw new Error('You can only edit your own messages');
  }

  const createdMs = data.createdAt?.toMillis?.() || (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
  if (createdMs && Date.now() - createdMs > MESSAGE_EDIT_WINDOW_MS) {
    throw new Error('Edit window (5 minutes) has expired');
  }

  await updateDoc(noteRef, {
    text: newText,
    edited: true,
    editedAt: serverTimestamp(),
  });
}

/**
 * FIX-L4: Delete an order note. Only the sender can delete, and only within 5 minutes.
 * Soft-deletes by replacing text with "[Message deleted]" to preserve thread continuity.
 */
export async function deleteOrderNote(
  orderId: string,
  noteId: string,
  callerUserId: string,
): Promise<void> {
  const noteRef = doc(db, ORDERS_COL, orderId, ORDER_NOTES_SUB, noteId);
  const snap = await getDoc(noteRef);
  if (!snap.exists()) throw new Error('Message not found');
  const data = snap.data();

  if (data.senderId !== callerUserId) {
    throw new Error('You can only delete your own messages');
  }

  const createdMs = data.createdAt?.toMillis?.() || (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
  if (createdMs && Date.now() - createdMs > MESSAGE_EDIT_WINDOW_MS) {
    throw new Error('Delete window (5 minutes) has expired');
  }

  await updateDoc(noteRef, {
    text: '[Message deleted]',
    deleted: true,
    deletedAt: serverTimestamp(),
  });
}

// ── FIX-M3: ETA validation ──

/**
 * FIX-M3: Validate that a vendor-entered ETA is both in the future
 * and before the event date. Throws descriptive errors on failure.
 */
export function validateDeliveryETA(
  eta: string | Date,
  eventDate?: string | any,
): { valid: boolean; error?: string } {
  const etaDate = typeof eta === 'string' ? new Date(eta) : eta;
  if (Number.isNaN(etaDate.getTime())) {
    return { valid: false, error: 'Invalid date/time format for ETA' };
  }

  // Must be in the future
  if (etaDate.getTime() <= Date.now()) {
    return { valid: false, error: 'ETA must be in the future' };
  }

  // Must be before the event date (if provided)
  if (eventDate) {
    let eventMs: number;
    if (typeof eventDate === 'string') {
      eventMs = new Date(eventDate + 'T23:59:59').getTime();
    } else if (eventDate?.toMillis) {
      eventMs = eventDate.toMillis();
    } else if (eventDate?.seconds) {
      eventMs = eventDate.seconds * 1000;
    } else {
      eventMs = 0;
    }
    if (eventMs > 0 && etaDate.getTime() > eventMs) {
      return { valid: false, error: 'ETA cannot be after the event date' };
    }
  }

  return { valid: true };
}

// ── FIX-M5: Vendor decline notification to customer ──

/**
 * FIX-M5: When a vendor declines a pending order, notify the customer in real-time.
 * This is called from cancelOrder when cancelledBy === 'vendor'.
 */
export async function notifyCustomerOfVendorDecline(
  customerId: string,
  orderId: string,
  businessName: string,
  reason: string,
): Promise<void> {
  // Import inline to avoid circular dependency
  const { sendCateringNotification } = await import('./cateringNotifications');
  await sendCateringNotification({
    recipientId: customerId,
    type: 'order_cancelled',
    title: 'Order Declined by Vendor',
    body: `${businessName} declined your order: ${reason}`,
    orderId,
    businessName,
  });
}

// ── FIX-M6: Review deduplication guard ──

/**
 * FIX-M6: Check if a review already exists for a given order before creating one.
 * Returns true if a review already exists (caller should prevent duplicate submission).
 */
export async function hasExistingReview(
  orderId: string,
  customerId: string,
): Promise<boolean> {
  const q = query(
    collection(db, 'cateringReviews'),
    where('orderId', '==', orderId),
    where('customerId', '==', customerId),
  );
  const snap = await getDocs(q);
  return snap.size > 0;
}

/**
 * FIX-M6: Create a review with server-side dedup guard.
 * Throws if a review already exists for this order + customer combo.
 */
export async function createReviewWithDedup(
  review: {
    orderId: string;
    customerId: string;
    businessId: string;
    rating: number;
    comment?: string;
    [key: string]: any;
  },
): Promise<string> {
  // Server-side dedup check
  const exists = await hasExistingReview(review.orderId, review.customerId);
  if (exists) {
    throw new Error('You have already reviewed this order');
  }

  const docRef = await addDoc(collection(db, 'cateringReviews'), {
    ...review,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ── FIX-M7: Modification timeout check (called client-side on dashboard load) ──

/**
 * FIX-M7: Check for and auto-reject expired vendor modifications.
 * Should be called when the vendor or customer dashboard loads.
 * Any order with pendingModification=true and modificationExpiresAt < now
 * will have its modification auto-rejected (reverted to original items).
 */
export async function checkAndRejectExpiredModifications(
  businessIdOrCustomerId: string,
  role: 'vendor' | 'customer',
): Promise<number> {
  const fieldName = role === 'vendor' ? 'businessId' : 'customerId';
  const q = query(
    collection(db, ORDERS_COL),
    where(fieldName, '==', businessIdOrCustomerId),
    where('pendingModification', '==', true),
  );
  const snap = await getDocs(q);
  let rejectedCount = 0;

  for (const orderDoc of snap.docs) {
    const data = orderDoc.data() as CateringOrder & {
      modificationExpiresAt?: any;
      originalItems?: OrderItem[];
      _version?: number;
    };

    const expiresMs = data.modificationExpiresAt?.toMillis?.()
      || (data.modificationExpiresAt?.seconds ? data.modificationExpiresAt.seconds * 1000 : 0);

    if (expiresMs > 0 && Date.now() > expiresMs && data.originalItems) {
      // Auto-reject: revert to original items
      const subtotal = data.originalItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
      const tax = calculateTax(subtotal, data.deliveryAddress?.state);
      await updateDoc(orderDoc.ref, {
        items: data.originalItems,
        subtotal,
        tax,
        total: subtotal + tax,
        originalItems: null,
        pendingModification: false,
        modificationExpiresAt: null,
        vendorModified: false,
        vendorModificationNote: null,
        _version: (data._version || 0) + 1,
        statusHistory: arrayUnion({
          status: 'modification_auto_rejected',
          timestamp: Timestamp.now(),
        }),
      });
      rejectedCount++;
    }
  }

  return rejectedCount;
}

// ── FIX-L1: Time-to-deliver SLO tracking ──

/**
 * FIX-L1: Calculate time spent in each status for a delivered order.
 * Returns a map of status → duration in milliseconds, useful for SLO analytics.
 */
export function calculateStatusDurations(
  statusHistory: Array<{ status: string; timestamp: any }>,
): Record<string, number> {
  if (!statusHistory || statusHistory.length === 0) return {};

  const durations: Record<string, number> = {};
  const sorted = [...statusHistory].sort((a, b) => {
    const aMs = a.timestamp?.toMillis?.() || (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
    const bMs = b.timestamp?.toMillis?.() || (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
    return aMs - bMs;
  });

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const startMs = current.timestamp?.toMillis?.() || (current.timestamp?.seconds ? current.timestamp.seconds * 1000 : 0);
    const endMs = next.timestamp?.toMillis?.() || (next.timestamp?.seconds ? next.timestamp.seconds * 1000 : 0);
    if (startMs && endMs) {
      durations[current.status] = (durations[current.status] || 0) + (endMs - startMs);
    }
  }

  // Total time from first status to last
  const firstMs = sorted[0]?.timestamp?.toMillis?.() || (sorted[0]?.timestamp?.seconds ? sorted[0].timestamp.seconds * 1000 : 0);
  const lastMs = sorted[sorted.length - 1]?.timestamp?.toMillis?.() || (sorted[sorted.length - 1]?.timestamp?.seconds ? sorted[sorted.length - 1].timestamp.seconds * 1000 : 0);
  if (firstMs && lastMs) {
    durations._totalDeliveryTime = lastMs - firstMs;
  }

  return durations;
}

// ── FIX-L2: Admin override for stuck orders ──

/**
 * FIX-L2: Force-transition an order to a specified status, bypassing the normal
 * state machine. Intended for admin use only to rescue stuck orders.
 * Records the override in statusHistory with a special 'admin_override' marker.
 */
export async function adminForceStatus(
  orderId: string,
  newStatus: string,
  adminUid: string,
  reason: string,
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Order not found');

  await updateDoc(ref, {
    status: newStatus,
    _version: ((snap.data() as any)._version || 0) + 1,
    statusHistory: arrayUnion({
      status: newStatus,
      timestamp: Timestamp.now(),
      adminOverride: true,
      adminUid,
      reason,
    }),
  });
}

// ── FIX-L3: Configurable tax rate ──

/** Default tax rate — can be overridden per-state or per-business */
const DEFAULT_TAX_RATE = 0.0825;

/**
 * FIX-L3: State-based tax rate lookup. Returns the tax rate as a decimal (e.g. 0.0825).
 * Falls back to DEFAULT_TAX_RATE for unknown states.
 */
const STATE_TAX_RATES: Record<string, number> = {
  TX: 0.0825,
  CA: 0.0725,
  NY: 0.08,
  FL: 0.06,
  IL: 0.0625,
  PA: 0.06,
  OH: 0.0575,
  GA: 0.04,
  WA: 0.065,
  NJ: 0.06625,
  // Add more as needed
};

export function getTaxRate(state?: string): number {
  if (!state) return DEFAULT_TAX_RATE;
  return STATE_TAX_RATES[state.toUpperCase()] ?? DEFAULT_TAX_RATE;
}

export function calculateTax(subtotal: number, state?: string): number {
  return Math.round(subtotal * getTaxRate(state));
}
