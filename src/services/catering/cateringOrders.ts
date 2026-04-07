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
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { CateringOrder, OrderItem, OrderNote, CateringQuoteRequest, CateringQuoteResponse } from './cateringTypes';
import { notifyCustomerStatusChange, notifyCustomerOrderModified } from './cateringNotifications';

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

export async function updateOrderStatus(
  orderId: string,
  status: CateringOrder['status'],
  extra?: Record<string, any>,
  callerRole?: { uid: string; role: 'customer' | 'vendor' },
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);
  // Validate transition
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Order not found');
  const currentStatus = (snap.data() as CateringOrder).status;
  if (!isValidStatusTransition(currentStatus, status)) {
    throw new Error(`Invalid status transition: ${currentStatus} → ${status}`);
  }

  // SB-40: Role-based authorization on status transitions
  if (callerRole) {
    const orderData = snap.data() as CateringOrder;
    const vendorOnlyStatuses = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
    if (vendorOnlyStatuses.includes(status) && callerRole.role !== 'vendor') {
      throw new Error('Only the vendor can advance order status');
    }
    // Vendors can only manage their own business orders
    if (callerRole.role === 'vendor' && orderData.businessId) {
      // Note: businessId ownership check should ideally be done via Firestore security rules
      // This is a client-side guard; server-side enforcement via security rules is recommended
    }
  }

  const updates: Record<string, any> = { status, ...extra };
  if (status === 'confirmed') updates.confirmedAt = serverTimestamp();
  updates.statusHistory = arrayUnion({
    status,
    timestamp: Timestamp.now(),
  });
  await updateDoc(ref, updates);

  // Fire notification (non-blocking)
  const orderData = snap.data() as CateringOrder;
  if (status !== 'pending') {
    notifyCustomerStatusChange(orderData.customerId, orderId, status, orderData.businessName).catch(console.warn);
  }
}

export async function cancelOrder(
  orderId: string,
  reason: string,
  cancelledBy: 'customer' | 'vendor',
  callerUid?: string,
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);

  // Validate status transition before cancelling (F-02 fix)
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Order not found');
  const currentStatus = (snap.data() as CateringOrder).status;
  if (!isValidStatusTransition(currentStatus, 'cancelled')) {
    throw new Error(`Cannot cancel an order that is ${currentStatus.replace(/_/g, ' ')}`);
  }

  // SB-40: Verify caller matches cancelledBy role
  if (callerUid) {
    const orderData = snap.data() as CateringOrder;
    if (cancelledBy === 'customer' && orderData.customerId !== callerUid) {
      throw new Error('Only the order customer can cancel as customer');
    }
  }

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
      const ref = doc(db, ORDERS_COL, id);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error('Order not found');
        const currentStatus = (snap.data() as CateringOrder).status;
        if (!isValidStatusTransition(currentStatus, newStatus)) {
          throw new Error(`Invalid transition: ${currentStatus} → ${newStatus}`);
        }
        const updates: Record<string, any> = { status: newStatus, ...extra };
        if (newStatus === 'confirmed') updates.confirmedAt = serverTimestamp();
        updates.statusHistory = arrayUnion({
          status: newStatus,
          timestamp: Timestamp.now(),
        });
        transaction.update(ref, updates);
      });
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

  // Notify customer of modification (non-blocking)
  notifyCustomerOrderModified(data.customerId, orderId, data.businessName, updates.note).catch(console.warn);
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

// ── Payment status tracking (H-05) ──

/**
 * Update payment status on an order.
 * Tracks payment events in the order for audit trail.
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: 'pending' | 'paid' | 'refunded',
  extra?: { paymentMethod?: string; paymentNote?: string; transactionId?: string },
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);
  await updateDoc(ref, {
    paymentStatus,
    ...(extra || {}),
    paymentUpdatedAt: serverTimestamp(),
    statusHistory: arrayUnion({
      status: `payment_${paymentStatus}`,
      timestamp: Timestamp.now(),
    }),
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
 * Create CateringOrders from a finalized quote request.
 * Groups accepted item assignments by vendor and creates one order per vendor.
 * Orders start as 'confirmed' since the vendor already accepted the quote.
 *
 * @param quoteRequest - The finalized CateringQuoteRequest (must have itemAssignments)
 * @param responses - All CateringQuoteResponses for this request (to get pricing & customer details)
 * @param deliveryAddress - Full delivery address from the finalization form
 * @returns Array of created order IDs
 */
export async function createOrdersFromQuote(
  quoteRequest: CateringQuoteRequest,
  responses: CateringQuoteResponse[],
  deliveryAddress: { street: string; city: string; state: string; zip: string },
): Promise<string[]> {
  let assignments = quoteRequest.itemAssignments || [];

  // Fallback: if no explicit itemAssignments exist (e.g., quote accepted before this field
  // was implemented, or via legacy full-accept flow), derive assignments from accepted responses.
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
              assignedAt: null as any, // Not critical for order creation
            });
          }
        }
      }
    }
    assignments = derived;
    console.log('[createOrdersFromQuote] Used fallback: derived', derived.length, 'assignments from responses');
  }

  if (assignments.length === 0) throw new Error('No item assignments found on this quote request');

  // Group assignments by vendor (businessId → assignments[])
  const vendorGroups = new Map<string, typeof assignments>();
  for (const a of assignments) {
    if (!vendorGroups.has(a.businessId)) vendorGroups.set(a.businessId, []);
    vendorGroups.get(a.businessId)!.push(a);
  }

  // Find the response that has customer details (any accepted/partially_accepted response will do)
  const acceptedResponse = responses.find(
    (r) => r.status === 'accepted' || r.status === 'partially_accepted',
  );
  const customerName = acceptedResponse?.customerName || '';
  const customerEmail = acceptedResponse?.customerEmail || '';
  const customerPhone = acceptedResponse?.customerPhone || '';

  // ── Duplicate prevention: check if orders already exist for this quote ──
  const existingOrdersSnap = await getDocs(query(
    collection(db, ORDERS_COL),
    where('quoteRequestId', '==', quoteRequest.id),
  ));
  if (existingOrdersSnap.size > 0) {
    console.log('[createOrdersFromQuote] Orders already exist for quote', quoteRequest.id, '— returning existing IDs');
    return existingOrdersSnap.docs.map((d) => d.id);
  }

  const orderIds: string[] = [];

  for (const [businessId, vendorAssignments] of vendorGroups) {
    // Find this vendor's response to get quoted pricing
    const response = responses.find((r) => r.businessId === businessId);
    if (!response) continue; // shouldn't happen

    const businessName = vendorAssignments[0]?.businessName || response.businessName;
    const assignedItemNames = new Set(vendorAssignments.map((a) => a.itemName));

    // Build OrderItems from the vendor's quotedItems, filtered to only accepted items
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

    const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    const tax = Math.round(subtotal * 0.0825);
    const total = subtotal + tax;

    const order: Omit<CateringOrder, 'id'> = {
      customerId: quoteRequest.customerId,
      customerName,
      customerEmail,
      customerPhone,
      businessId,
      businessName,
      items: orderItems,
      subtotal,
      tax,
      total,
      status: 'confirmed', // auto-confirmed — vendor already accepted the quote
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
      // RFP backreference
      quoteRequestId: quoteRequest.id,
      quoteResponseId: response.id,
      rfpOrigin: true,
    };

    // Use addDoc directly (not createOrder) to set status as 'confirmed' not 'pending'
    const cleanOrder = Object.fromEntries(
      Object.entries(order).filter(([, v]) => v !== undefined),
    );
    const docRef = await addDoc(collection(db, ORDERS_COL), {
      ...cleanOrder,
      createdAt: serverTimestamp(),
      confirmedAt: serverTimestamp(),
      statusHistory: [{
        status: 'confirmed',
        timestamp: Timestamp.now(),
      }],
    });
    orderIds.push(docRef.id);
  }

  return orderIds;
}

// ── In-order messaging (OrderNotes subcollection) ──

const ORDER_NOTES_SUB = 'notes';

/**
 * Send a note (message) within an order thread.
 */
export async function addOrderNote(
  orderId: string,
  note: Omit<OrderNote, 'id' | 'createdAt'>,
): Promise<string> {
  const notesCol = collection(db, ORDERS_COL, orderId, ORDER_NOTES_SUB);
  const docRef = await addDoc(notesCol, {
    ...note,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Subscribe to real-time order notes for a specific order.
 */
export function subscribeToOrderNotes(
  orderId: string,
  callback: (notes: OrderNote[]) => void,
): Unsubscribe {
  const notesCol = collection(db, ORDERS_COL, orderId, ORDER_NOTES_SUB);
  return onSnapshot(notesCol, (snap) => {
    const results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderNote));
    results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return aTime - bTime; // chronological order (oldest first)
    });
    callback(results);
  }, (err) => {
    console.warn('subscribeToOrderNotes error:', err);
    callback([]);
  });
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
  const batch: Promise<void>[] = [];
  for (const noteDoc of snap.docs) {
    const data = noteDoc.data();
    const readBy: string[] = data.readBy || [];
    // Only update notes NOT sent by this user AND not already marked as read
    if (data.senderId !== userId && !readBy.includes(userId)) {
      batch.push(
        updateDoc(doc(db, ORDERS_COL, orderId, ORDER_NOTES_SUB, noteDoc.id), {
          readBy: arrayUnion(userId),
          readAt: serverTimestamp(),
        }),
      );
    }
  }
  await Promise.all(batch);
}
