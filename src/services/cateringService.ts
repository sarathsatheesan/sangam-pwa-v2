// ═════════════════════════════════════════════════════════════════════════════════
// CATERING SERVICE
// Firestore CRUD for catering menu items, orders, and quote requests.
// Phase 1: Menu items + Direct Orders (Path A)
// ═════════════════════════════════════════════════════════════════════════════════

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
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  deleteField,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ──

export interface CateringMenuItem {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  price: number;              // cents (1299 = $12.99)
  pricingType: 'per_person' | 'per_tray' | 'flat_rate';
  servesCount?: number;
  category: 'Appetizer' | 'Entree' | 'Side' | 'Dessert' | 'Beverage' | 'Package';
  dietaryTags?: string[];     // vegetarian, vegan, halal, kosher, gluten_free, dairy_free, nut_free
  photoUrl?: string;
  available: boolean;
  minOrderQty?: number;
  maxOrderQty?: number;
  createdAt?: any;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;          // cents
  pricingType: string;
  specialInstructions?: string;
  minOrderQty?: number;
  maxOrderQty?: number;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
}

export interface OrderForContext {
  type: 'self' | 'individual' | 'organization' | 'anonymous';
  recipientName?: string;
  recipientContact?: string;
  organizationName?: string;
  department?: string;
  relationship?: string;
}

export interface CateringOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  businessId: string;
  businessName: string;
  items: OrderItem[];
  subtotal: number;           // cents
  tax?: number;               // cents
  total: number;              // cents
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  eventDate: any;
  deliveryAddress: DeliveryAddress;
  headcount: number;
  specialInstructions?: string;
  orderForContext?: OrderForContext;
  contactName: string;
  contactPhone: string;
  eventType?: string;           // corporate_meeting | wedding | cultural_festival | religious | birthday | other
  estimatedDeliveryTime?: string; // e.g. "2:30 PM" or "30 minutes"
  createdAt?: any;
  confirmedAt?: any;
  declinedReason?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: any;
  statusHistory?: Array<{ status: string; timestamp: any }>;
}

// ── Menu Items ──

const MENU_ITEMS_COL = 'cateringMenuItems';

export async function fetchMenuItemsByBusiness(businessId: string): Promise<CateringMenuItem[]> {
  const q = query(
    collection(db, MENU_ITEMS_COL),
    where('businessId', '==', businessId),
    where('available', '==', true),
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringMenuItem));
  return results.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
}

export async function fetchMenuItemsByCategory(cuisineCategory: string): Promise<CateringMenuItem[]> {
  // First get all catering-enabled businesses (optionally filtered by category)
  const bizConstraints = [
    ...(cuisineCategory !== 'all' ? [where('category', '==', cuisineCategory)] : []),
    where('isCateringEnabled', '==', true),
  ];
  const bizQ = query(collection(db, 'businesses'), ...bizConstraints);
  const bizSnap = await getDocs(bizQ);
  const bizIds = bizSnap.docs.map(d => d.id);

  if (bizIds.length === 0) return [];

  // Firestore 'in' supports max 30 values
  const chunks: string[][] = [];
  for (let i = 0; i < bizIds.length; i += 30) {
    chunks.push(bizIds.slice(i, i + 30));
  }

  const allItems: CateringMenuItem[] = [];
  for (const chunk of chunks) {
    const itemQ = query(
      collection(db, MENU_ITEMS_COL),
      where('businessId', 'in', chunk),
      where('available', '==', true),
    );
    const itemSnap = await getDocs(itemQ);
    itemSnap.docs.forEach(d => {
      allItems.push({ id: d.id, ...d.data() } as CateringMenuItem);
    });
  }

  return allItems;
}

export async function createMenuItem(item: Omit<CateringMenuItem, 'id'>): Promise<string> {
  const cleanItem = Object.fromEntries(
    Object.entries(item).filter(([, v]) => v !== undefined),
  );
  const docRef = await addDoc(collection(db, MENU_ITEMS_COL), {
    ...cleanItem,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateMenuItem(itemId: string, updates: Partial<CateringMenuItem>): Promise<void> {
  const ref = doc(db, MENU_ITEMS_COL, itemId);
  await updateDoc(ref, updates);
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, MENU_ITEMS_COL, itemId));
}

// ── Orders ──

const ORDERS_COL = 'cateringOrders';

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

// ── Phase 2: Request for Price (RFP) Types ──

export interface QuoteRequestItem {
  name: string;
  description?: string;
  qty: number;
  pricingType: 'per_person' | 'per_tray' | 'flat_rate';
  dietaryTags?: string[];
}

export interface ItemAssignment {
  itemName: string;
  responseId: string;
  businessId: string;
  businessName: string;
  assignedAt: any;
}

export interface CateringQuoteRequest {
  id: string;
  customerId: string;
  // Privacy: NO customer name/email/phone stored here
  deliveryCity: string;           // Only city shared with caterers
  cuisineCategory: string;
  eventType?: string;             // corporate_meeting | wedding | cultural_festival | religious | birthday | other
  eventDate: any;
  headcount: number;
  items: QuoteRequestItem[];      // What they want catered
  specialInstructions?: string;
  orderForContext?: OrderForContext;
  status: 'open' | 'reviewing' | 'partially_accepted' | 'accepted' | 'expired' | 'cancelled';
  selectedResponseId?: string;    // Which vendor response was accepted (full accept — legacy)
  selectedBusinessId?: string;    // Which vendor was selected (full accept — legacy)
  itemAssignments?: ItemAssignment[];  // Item-level assignments to different vendors
  targetBusinessIds?: string[];   // Specific businesses to request from (empty = broadcast to all in category)
  responseCount: number;          // How many vendors responded
  expiresAt?: any;
  createdAt?: any;
}

export interface CateringQuoteResponse {
  id: string;
  quoteRequestId: string;
  businessId: string;
  businessName: string;
  businessRating?: number;
  businessHeritage?: string;
  // Quote details
  quotedItems: QuotedItem[];
  subtotal: number;               // cents
  serviceFee?: number;            // cents
  deliveryFee?: number;           // cents
  total: number;                  // cents
  estimatedPrepTime?: string;     // e.g. "2-3 hours"
  message?: string;               // Personal message from caterer
  validUntil?: any;               // Quote expiry
  status: 'submitted' | 'accepted' | 'partially_accepted' | 'declined' | 'expired';
  // Only populated after customer accepts (full or partial) this response
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  acceptedItemNames?: string[];   // Which specific items were accepted from this vendor
  createdAt?: any;
}

export interface QuotedItem {
  name: string;
  qty: number;
  unitPrice: number;              // cents
  pricingType: string;
  traySize?: 'small' | 'medium' | 'large';  // tray size offered by vendor
  notes?: string;                 // caterer notes per item
}

// ── Quote Requests ──

const QUOTE_REQUESTS_COL = 'cateringQuoteRequests';
const QUOTE_RESPONSES_COL = 'cateringQuoteResponses';

export async function createQuoteRequest(request: Omit<CateringQuoteRequest, 'id' | 'responseCount'>): Promise<string> {
  // Build payload explicitly to avoid undefined fields (Firestore rejects them)
  // and to avoid corrupting Firebase sentinel values like serverTimestamp()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    customerId: request.customerId,
    deliveryCity: request.deliveryCity,
    cuisineCategory: request.cuisineCategory || '',
    eventDate: request.eventDate,
    headcount: request.headcount,
    // Strip undefined from each item's optional fields (description, dietaryTags)
    items: request.items.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clean: Record<string, any> = {
        name: item.name,
        qty: item.qty,
        pricingType: item.pricingType,
      };
      if (item.description) clean.description = item.description;
      if (item.dietaryTags && item.dietaryTags.length > 0) clean.dietaryTags = item.dietaryTags;
      return clean;
    }),
    status: 'open',
    responseCount: 0,
    createdAt: serverTimestamp(),
  };
  // Only add optional fields if they have values
  if (request.eventType) payload.eventType = request.eventType;
  if (request.specialInstructions) payload.specialInstructions = request.specialInstructions;
  if (request.orderForContext) payload.orderForContext = request.orderForContext;
  if (request.targetBusinessIds && request.targetBusinessIds.length > 0) {
    payload.targetBusinessIds = request.targetBusinessIds;
  }
  if (request.expiresAt) payload.expiresAt = request.expiresAt;

  const docRef = await addDoc(collection(db, QUOTE_REQUESTS_COL), payload);
  return docRef.id;
}

/** Edit window: 24 hours from creation */
const QUOTE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Minimum lead time: event must be more than 2 days away to allow edits */
const MIN_EVENT_LEAD_MS = 2 * 24 * 60 * 60 * 1000;

/** Parse eventDate (YYYY-MM-DD string or Firestore timestamp) to epoch ms */
function parseEventDateMs(eventDate: any): number {
  if (!eventDate) return 0;
  if (typeof eventDate === 'string') {
    const ms = new Date(eventDate + 'T00:00:00').getTime();
    return isNaN(ms) ? 0 : ms;
  }
  if (eventDate?.toMillis) return eventDate.toMillis();
  if (eventDate?.seconds) return eventDate.seconds * 1000;
  return 0;
}

/**
 * Check whether a quote request is still editable.
 * Rules:
 *  - Status must be 'open' (not accepted/cancelled/expired)
 *  - Within 24 hours of creation
 *  - Event must be more than 2 days away
 *  - Allowed even if vendors have responded (customer can edit & request re-quote)
 */
export function isQuoteRequestEditable(request: CateringQuoteRequest): boolean {
  if (request.status !== 'open') return false;

  // Time-since-creation check
  const createdMs = request.createdAt?.toMillis?.()
    || (request.createdAt?.seconds ? request.createdAt.seconds * 1000 : 0);
  if (!createdMs) return false;
  if (Date.now() - createdMs >= QUOTE_EDIT_WINDOW_MS) return false;

  // Event lead-time check: block edits if event is within 2 days
  const eventMs = parseEventDateMs(request.eventDate);
  if (eventMs && eventMs - Date.now() < MIN_EVENT_LEAD_MS) return false;

  return true;
}

/** Remaining edit time in milliseconds (0 if expired or event too close) */
export function quoteEditTimeRemaining(request: CateringQuoteRequest): number {
  const createdMs = request.createdAt?.toMillis?.()
    || (request.createdAt?.seconds ? request.createdAt.seconds * 1000 : 0);
  if (!createdMs) return 0;

  const timeLeft = QUOTE_EDIT_WINDOW_MS - (Date.now() - createdMs);
  if (timeLeft <= 0) return 0;

  // Also check event lead time
  const eventMs = parseEventDateMs(request.eventDate);
  if (eventMs && eventMs - Date.now() < MIN_EVENT_LEAD_MS) return 0;

  return timeLeft;
}

/** Update an existing quote request (only allowed within edit window) */
export async function updateQuoteRequest(
  requestId: string,
  updates: {
    deliveryCity?: string;
    eventType?: string;
    eventDate?: string;
    headcount?: number;
    items?: QuoteRequestItem[];
    specialInstructions?: string;
  },
): Promise<void> {
  const ref = doc(db, QUOTE_REQUESTS_COL, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Quote request not found');
  const data = snap.data() as CateringQuoteRequest;

  // Guard: status must be open
  if (data.status !== 'open') throw new Error('Only open requests can be edited');

  // Guard: within 24hr creation window
  const createdMs = data.createdAt?.toMillis?.()
    || (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
  if (createdMs && Date.now() - createdMs >= QUOTE_EDIT_WINDOW_MS) {
    throw new Error('Edit window (24 hours) has expired');
  }

  // Guard: event must be more than 2 days away
  const eventMs = parseEventDateMs(data.eventDate);
  if (eventMs && eventMs - Date.now() < MIN_EVENT_LEAD_MS) {
    throw new Error('Cannot edit — your event is less than 2 days away');
  }

  // Strip undefined keys
  const cleanUpdates: Record<string, any> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) cleanUpdates[k] = v;
  }
  cleanUpdates.updatedAt = serverTimestamp();
  cleanUpdates.lastEditedAt = serverTimestamp();

  // If vendors already responded, flag as re-quote so vendors are notified
  if (data.responseCount > 0) {
    cleanUpdates.requiresRequote = true;
  }

  await updateDoc(ref, cleanUpdates);
}

export async function fetchQuoteRequestsByCustomer(customerId: string): Promise<CateringQuoteRequest[]> {
  try {
    const q = query(
      collection(db, QUOTE_REQUESTS_COL),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteRequest));
  } catch (err) {
    console.warn('Composite index not ready for customer requests, using fallback:', err);
    const q = query(
      collection(db, QUOTE_REQUESTS_COL),
      where('customerId', '==', customerId),
    );
    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteRequest));
    return results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }
}

export async function fetchOpenQuoteRequests(cuisineCategory?: string): Promise<CateringQuoteRequest[]> {
  try {
    // Try composite-index query first (status + createdAt)
    let q;
    if (cuisineCategory) {
      q = query(
        collection(db, QUOTE_REQUESTS_COL),
        where('status', '==', 'open'),
        where('cuisineCategory', '==', cuisineCategory),
        orderBy('createdAt', 'desc'),
      );
    } else {
      q = query(
        collection(db, QUOTE_REQUESTS_COL),
        where('status', '==', 'open'),
        orderBy('createdAt', 'desc'),
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteRequest));
  } catch (err) {
    // Fallback: if composite index isn't ready, query without orderBy and sort client-side
    console.warn('Composite index not ready, using fallback query:', err);
    let q;
    if (cuisineCategory) {
      q = query(
        collection(db, QUOTE_REQUESTS_COL),
        where('status', '==', 'open'),
        where('cuisineCategory', '==', cuisineCategory),
      );
    } else {
      q = query(
        collection(db, QUOTE_REQUESTS_COL),
        where('status', '==', 'open'),
      );
    }
    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteRequest));
    return results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }
}

export async function fetchQuoteRequestsForBusiness(businessId: string): Promise<CateringQuoteRequest[]> {
  // Fetch requests that either target this business specifically or are broadcast (no targetBusinessIds)
  const allOpen = await fetchOpenQuoteRequests();
  return allOpen.filter(
    (r) => !r.targetBusinessIds || r.targetBusinessIds.length === 0 || r.targetBusinessIds.includes(businessId)
  );
}

export function subscribeToCustomerQuoteRequests(
  customerId: string,
  callback: (requests: CateringQuoteRequest[]) => void,
): Unsubscribe {
  // Try without orderBy first (works without composite index), sort client-side
  const q = query(
    collection(db, QUOTE_REQUESTS_COL),
    where('customerId', '==', customerId),
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteRequest));
    results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    callback(results);
  }, (err) => {
    console.warn('subscribeToCustomerQuoteRequests error:', err);
    callback([]);
  });
}

export async function updateQuoteRequestStatus(
  requestId: string,
  status: CateringQuoteRequest['status'],
  extra?: Record<string, any>,
): Promise<void> {
  const ref = doc(db, QUOTE_REQUESTS_COL, requestId);
  await updateDoc(ref, { status, ...extra });
}

// ── Quote Responses ──

export async function createQuoteResponse(response: Omit<CateringQuoteResponse, 'id'>): Promise<string> {
  // Build payload explicitly to avoid undefined fields (Firestore rejects them)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    quoteRequestId: response.quoteRequestId,
    businessId: response.businessId,
    businessName: response.businessName,
    quotedItems: response.quotedItems,
    subtotal: response.subtotal,
    total: response.total,
    status: 'submitted',
    createdAt: serverTimestamp(),
  };
  if (response.businessRating != null) payload.businessRating = response.businessRating;
  if (response.businessHeritage) payload.businessHeritage = response.businessHeritage;
  if (response.serviceFee != null) payload.serviceFee = response.serviceFee;
  if (response.deliveryFee != null) payload.deliveryFee = response.deliveryFee;
  if (response.estimatedPrepTime) payload.estimatedPrepTime = response.estimatedPrepTime;
  if (response.message) payload.message = response.message;
  if (response.validUntil) payload.validUntil = response.validUntil;

  const docRef = await addDoc(collection(db, QUOTE_RESPONSES_COL), payload);
  // Increment response count on the request
  const requestRef = doc(db, QUOTE_REQUESTS_COL, response.quoteRequestId);
  const requestSnap = await getDoc(requestRef);
  if (requestSnap.exists()) {
    const current = requestSnap.data().responseCount || 0;
    await updateDoc(requestRef, { responseCount: current + 1 });
  }
  return docRef.id;
}

export async function fetchQuoteResponsesByRequest(requestId: string): Promise<CateringQuoteResponse[]> {
  try {
    const q = query(
      collection(db, QUOTE_RESPONSES_COL),
      where('quoteRequestId', '==', requestId),
      orderBy('createdAt', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteResponse));
  } catch (err) {
    console.warn('Composite index not ready for responses by request, using fallback:', err);
    const q = query(
      collection(db, QUOTE_RESPONSES_COL),
      where('quoteRequestId', '==', requestId),
    );
    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteResponse));
    return results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return aTime - bTime;
    });
  }
}

export async function fetchQuoteResponsesByBusiness(businessId: string): Promise<CateringQuoteResponse[]> {
  try {
    const q = query(
      collection(db, QUOTE_RESPONSES_COL),
      where('businessId', '==', businessId),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteResponse));
  } catch (err) {
    console.warn('Composite index not ready for responses, using fallback:', err);
    const q = query(
      collection(db, QUOTE_RESPONSES_COL),
      where('businessId', '==', businessId),
    );
    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteResponse));
    return results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }
}

export function subscribeToQuoteResponses(
  requestId: string,
  callback: (responses: CateringQuoteResponse[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, QUOTE_RESPONSES_COL),
    where('quoteRequestId', '==', requestId),
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteResponse));
    results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      return aTime - bTime;
    });
    callback(results);
  }, (err) => {
    console.warn('subscribeToQuoteResponses error:', err);
    callback([]);
  });
}

export async function acceptQuoteResponse(
  responseId: string,
  requestId: string,
  customerDetails: { customerName: string; customerEmail: string; customerPhone: string },
): Promise<void> {
  // 1. Mark the chosen response as accepted and reveal customer details
  const responseRef = doc(db, QUOTE_RESPONSES_COL, responseId);
  await updateDoc(responseRef, {
    status: 'accepted',
    ...customerDetails,
  });

  // 2. Mark the quote request as accepted + write itemAssignments for all quoted items
  const responseSnap = await getDoc(responseRef);
  const responseData = responseSnap.data();
  const quotedItems: { name: string }[] = responseData?.quotedItems || [];
  const requestRef = doc(db, QUOTE_REQUESTS_COL, requestId);
  await updateDoc(requestRef, {
    status: 'accepted',
    selectedResponseId: responseId,
    selectedBusinessId: responseData?.businessId,
    itemAssignments: quotedItems.map((qi) => ({
      itemName: qi.name,
      responseId,
      businessId: responseData?.businessId,
      businessName: responseData?.businessName,
      assignedAt: serverTimestamp(),
    })),
  });

  // 3. Decline all other responses for this request
  const allResponses = await fetchQuoteResponsesByRequest(requestId);
  for (const resp of allResponses) {
    if (resp.id !== responseId && resp.status === 'submitted') {
      await updateDoc(doc(db, QUOTE_RESPONSES_COL, resp.id), { status: 'declined' });
    }
  }
}

export async function declineQuoteResponse(responseId: string): Promise<void> {
  const ref = doc(db, QUOTE_RESPONSES_COL, responseId);
  await updateDoc(ref, { status: 'declined' });
}

// ── Item-level acceptance ──

/**
 * Accept specific items from a vendor's quote response.
 * - Marks the response as accepted/partially_accepted depending on whether all quoted items were selected.
 * - Reveals customer contact details to this vendor.
 * - Updates the request's itemAssignments array.
 * - Checks if all request items are now assigned; if so, marks request as 'accepted' and auto-declines remaining.
 * - If not all assigned, marks request as 'partially_accepted' (stays open for other vendors).
 */
export async function acceptQuoteResponseItems(
  responseId: string,
  requestId: string,
  selectedItemNames: string[],
  customerDetails: { customerName: string; customerEmail: string; customerPhone: string },
): Promise<{ allItemsAssigned: boolean }> {
  // 1. Get the response data to know vendor details
  const responseRef = doc(db, QUOTE_RESPONSES_COL, responseId);
  const responseSnap = await getDoc(responseRef);
  if (!responseSnap.exists()) throw new Error('Quote response not found');
  const responseData = responseSnap.data();

  // 2. Determine if this is a full or partial accept of THIS vendor's quote
  const allQuotedItemNames = (responseData.quotedItems || []).map((qi: any) => qi.name);
  const isFullVendorAccept = selectedItemNames.length >= allQuotedItemNames.length;
  const vendorStatus = isFullVendorAccept ? 'accepted' : 'partially_accepted';

  // 3. Mark this response with accepted items + customer details
  await updateDoc(responseRef, {
    status: vendorStatus,
    acceptedItemNames: selectedItemNames,
    ...customerDetails,
  });

  // 4. Update the request's item assignments
  const requestRef = doc(db, QUOTE_REQUESTS_COL, requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error('Quote request not found');
  const requestData = requestSnap.data();

  const existingAssignments: ItemAssignment[] = requestData.itemAssignments || [];
  // Remove any previous assignments for these items (in case of re-assignment)
  const filteredAssignments = existingAssignments.filter(
    (a) => !selectedItemNames.includes(a.itemName)
  );
  // Add new assignments
  const newAssignments: ItemAssignment[] = selectedItemNames.map((name) => ({
    itemName: name,
    responseId,
    businessId: responseData.businessId,
    businessName: responseData.businessName,
    assignedAt: serverTimestamp(),
  }));
  const allAssignments = [...filteredAssignments, ...newAssignments];

  // 5. Check if all request items are now assigned
  const requestItemNames = (requestData.items || []).map((i: any) => i.name);
  const assignedItemNames = new Set(allAssignments.map((a) => a.itemName));
  const allItemsAssigned = requestItemNames.every((name: string) => assignedItemNames.has(name));

  // 6. Update the request status
  const requestUpdate: Record<string, any> = {
    itemAssignments: allAssignments.map((a) => ({
      itemName: a.itemName,
      responseId: a.responseId,
      businessId: a.businessId,
      businessName: a.businessName,
      assignedAt: a.assignedAt,
    })),
  };

  if (allItemsAssigned) {
    requestUpdate.status = 'accepted';
  } else {
    requestUpdate.status = 'partially_accepted';
  }

  await updateDoc(requestRef, requestUpdate);

  // 7. If all items assigned, auto-decline any remaining 'submitted' responses
  if (allItemsAssigned) {
    const allResponses = await fetchQuoteResponsesByRequest(requestId);
    for (const resp of allResponses) {
      if (resp.id !== responseId && resp.status === 'submitted') {
        await updateDoc(doc(db, QUOTE_RESPONSES_COL, resp.id), { status: 'declined' });
      }
    }
  }

  return { allItemsAssigned };
}

/**
 * Finalize a partially-accepted request — mark it as fully accepted and auto-decline remaining.
 * Called when the customer clicks "Finalize Order" after assigning all items they want.
 */
export async function finalizeQuoteRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, QUOTE_REQUESTS_COL, requestId);
  await updateDoc(requestRef, { status: 'accepted' });

  // Auto-decline any remaining submitted responses
  const allResponses = await fetchQuoteResponsesByRequest(requestId);
  for (const resp of allResponses) {
    if (resp.status === 'submitted') {
      await updateDoc(doc(db, QUOTE_RESPONSES_COL, resp.id), { status: 'declined' });
    }
  }
}

// ── Real-time vendor subscription for quote responses ──

/**
 * Subscribe to all quote responses for a specific business — gives vendors real-time
 * updates when customers accept/decline their quotes.
 */
export function subscribeToBusinessQuoteResponses(
  businessId: string,
  callback: (responses: CateringQuoteResponse[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, QUOTE_RESPONSES_COL),
    where('businessId', '==', businessId),
  );
  return onSnapshot(q, (snap) => {
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringQuoteResponse));
    results.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    callback(results);
  }, (err) => {
    console.warn('subscribeToBusinessQuoteResponses error:', err);
    callback([]);
  });
}

// ═════════════════════════════════════════════════════════════════════════════════
// CATERING REVIEWS & RATINGS
// Phase 5: Post-delivery reviews with vendor responses, aggregated ratings
// Uses the shared `businessReviews` collection with catering-specific fields.
// ═════════════════════════════════════════════════════════════════════════════════

export interface CateringReview {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  rating: number;                   // 1–5 stars
  text: string;
  orderId?: string;                 // links to catering order (optional)
  eventType?: string;               // from the original order
  itemsOrdered?: string[];          // item names for context
  headcount?: number;
  isCateringReview: boolean;        // distinguishes from general biz reviews
  vendorResponse?: string;          // vendor's reply to this review
  vendorRespondedAt?: any;
  createdAt: any;
}

/**
 * Fetch all catering reviews for a business, sorted newest-first (client-side).
 */
export async function fetchCateringReviews(businessId: string): Promise<CateringReview[]> {
  const q = query(
    collection(db, 'businessReviews'),
    where('businessId', '==', businessId),
    where('isCateringReview', '==', true),
  );
  const snap = await getDocs(q);
  const reviews: CateringReview[] = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  } as CateringReview));
  reviews.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
    const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
    return bTime - aTime;
  });
  return reviews;
}

/**
 * Submit a new catering review. Recalculates the business aggregate rating
 * across ALL reviews (catering + general) and updates the business document.
 */
export async function submitCateringReview(review: {
  businessId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  orderId?: string;
  eventType?: string;
  itemsOrdered?: string[];
  headcount?: number;
}): Promise<string> {
  // Filter out undefined values (Firestore rejects them)
  const cleanReview = Object.fromEntries(
    Object.entries(review).filter(([, v]) => v !== undefined),
  );
  const docRef = await addDoc(collection(db, 'businessReviews'), {
    ...cleanReview,
    isCateringReview: true,
    createdAt: Timestamp.now(),
  });

  // Recalculate aggregate rating across ALL reviews for this business
  const allReviewsSnap = await getDocs(
    query(collection(db, 'businessReviews'), where('businessId', '==', review.businessId)),
  );
  const allRatings = allReviewsSnap.docs.map(d => d.data().rating as number);
  const avgRating = allRatings.reduce((s, r) => s + r, 0) / allRatings.length;
  await updateDoc(doc(db, 'businesses', review.businessId), {
    rating: parseFloat(avgRating.toFixed(1)),
    reviews: allRatings.length,
  });

  return docRef.id;
}

/**
 * Check if a user has already reviewed a specific catering order.
 */
export async function hasReviewedOrder(userId: string, orderId: string): Promise<boolean> {
  const q = query(
    collection(db, 'businessReviews'),
    where('userId', '==', userId),
    where('orderId', '==', orderId),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Add a vendor response to an existing review.
 */
export async function addVendorResponse(reviewId: string, responseText: string): Promise<void> {
  await updateDoc(doc(db, 'businessReviews', reviewId), {
    vendorResponse: responseText,
    vendorRespondedAt: Timestamp.now(),
  });
}


// ═════════════════════════════════════════════════════════════════════════════════
// PHASE 6: RECURRING ORDERS, FAVORITES & ORDER TEMPLATES
// ═════════════════════════════════════════════════════════════════════════════════

// ── Types ──

export interface FavoriteOrder {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  label: string;                       // e.g. "Weekly Office Lunch"
  items: OrderItem[];
  headcount?: number;
  specialInstructions?: string;
  deliveryAddress?: DeliveryAddress;
  orderForContext?: OrderForContext;
  lastOrderedAt?: any;
  useCount: number;
  createdAt?: any;
}

export type RecurrenceInterval = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurrenceSchedule {
  // Simple interval mode
  interval?: RecurrenceInterval;
  // Calendar-based mode (advanced)
  daysOfWeek?: number[];               // 0=Sun..6=Sat (e.g. [1,3] = Mon,Wed)
  dayOfMonth?: number;                 // For monthly on a specific date (1–31)
  // Shared
  timeOfDay: string;                   // "11:30" (HH:mm) — delivery target time
  startDate: string;                   // ISO date "2026-04-01"
  endDate?: string;                    // ISO date or null for indefinite
  skipDates?: string[];                // Holidays / vacation dates to skip
}

/** Per-occurrence overrides — modifications to the next scheduled run only */
export interface OccurrenceOverride {
  forDate: string;                     // The nextRunDate this override applies to
  items?: OrderItem[];                 // Override items (null = use default)
  headcount?: number;
  specialInstructions?: string;
  skip?: boolean;                      // Skip just this occurrence
}

export interface RecurringOrder {
  id: string;
  userId: string;
  favoriteId: string;                  // Links to the FavoriteOrder being repeated
  businessId: string;
  businessName: string;
  label: string;
  items: OrderItem[];
  headcount?: number;
  specialInstructions?: string;
  deliveryAddress: DeliveryAddress;
  orderForContext?: OrderForContext;
  contactName: string;
  contactPhone: string;
  schedule: RecurrenceSchedule;
  active: boolean;
  nextRunDate: string;                 // ISO date of next scheduled order
  lastRunDate?: string;
  totalOrdersPlaced: number;
  nextOccurrenceOverride?: OccurrenceOverride;  // One-time modification for the next run
  createdAt?: any;
  updatedAt?: any;
}

export interface OrderTemplate {
  id: string;
  creatorId: string;
  creatorName: string;
  businessId: string;
  businessName: string;
  title: string;                       // "Q1 Team Lunch Template"
  description?: string;
  items: OrderItem[];
  headcount?: number;
  specialInstructions?: string;
  eventType?: string;
  // Sharing
  shareCode: string;                   // 8-char unique code for link sharing
  isPublic: boolean;                   // Anyone with link can use it
  // Organization scoping
  organizationId?: string;             // Ties to an org for team library
  organizationName?: string;
  // Stats
  useCount: number;
  lastUsedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}


// ═══════════════════════════════════════════════════════════════════════════════
// FAVORITES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save a completed order (or cart) as a favorite for quick reordering.
 */
export async function saveFavoriteOrder(fav: Omit<FavoriteOrder, 'id' | 'useCount' | 'createdAt'>): Promise<string> {
  // Filter out undefined values — Firestore rejects them
  const cleanFav = Object.fromEntries(
    Object.entries(fav).filter(([, v]) => v !== undefined),
  );
  const docRef = await addDoc(collection(db, 'cateringFavorites'), {
    ...cleanFav,
    useCount: 0,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * List all favorites for a user, most-recently-used first.
 */
export async function fetchFavoriteOrders(userId: string): Promise<FavoriteOrder[]> {
  const q = query(
    collection(db, 'cateringFavorites'),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  const favorites = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FavoriteOrder));
  // Sort client-side: most recently used first, then by creation date
  favorites.sort((a, b) => {
    const aTime = a.lastOrderedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const bTime = b.lastOrderedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
  return favorites;
}

/**
 * Real-time subscription to user's favorites.
 */
export function subscribeToFavorites(userId: string, callback: (favs: FavoriteOrder[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'cateringFavorites'),
    where('userId', '==', userId),
  );
  return onSnapshot(q, (snap) => {
    const favorites = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FavoriteOrder));
    favorites.sort((a, b) => {
      const aTime = a.lastOrderedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bTime = b.lastOrderedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    callback(favorites);
  });
}

/**
 * Update a favorite (rename, update items, etc.).
 */
export async function updateFavoriteOrder(favId: string, updates: Partial<FavoriteOrder>): Promise<void> {
  const { id, ...data } = updates as any;
  await updateDoc(doc(db, 'cateringFavorites', favId), data);
}

/**
 * Delete a favorite.
 */
export async function deleteFavoriteOrder(favId: string): Promise<void> {
  await deleteDoc(doc(db, 'cateringFavorites', favId));
}

/**
 * Quick reorder from a favorite — creates a new order using the saved items.
 * Returns the new order ID.
 */
export async function reorderFromFavorite(
  fav: FavoriteOrder,
  overrides: {
    customerId: string;
    customerName: string;
    customerEmail: string;
    contactName: string;
    contactPhone: string;
    eventDate: string;
    deliveryAddress: DeliveryAddress;
    headcount?: number;
  },
): Promise<string> {
  const total = calculateOrderTotal(fav.items);
  const orderId = await createOrder({
    customerId: overrides.customerId,
    customerName: overrides.customerName,
    customerEmail: overrides.customerEmail,
    customerPhone: overrides.contactPhone,
    businessId: fav.businessId,
    businessName: fav.businessName,
    items: fav.items,
    subtotal: total,
    total,
    status: 'pending',
    eventDate: overrides.eventDate,
    deliveryAddress: overrides.deliveryAddress,
    headcount: overrides.headcount || fav.headcount || 1,
    specialInstructions: fav.specialInstructions,
    orderForContext: fav.orderForContext,
    contactName: overrides.contactName,
    contactPhone: overrides.contactPhone,
  });

  // Bump favorite usage stats
  await updateDoc(doc(db, 'cateringFavorites', fav.id), {
    lastOrderedAt: serverTimestamp(),
    useCount: (fav.useCount || 0) + 1,
  });

  return orderId;
}


// ═══════════════════════════════════════════════════════════════════════════════
// RECURRING ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the next run date from a schedule config.
 */
export function computeNextRunDate(schedule: RecurrenceSchedule, afterDate?: string): string {
  const after = afterDate ? new Date(afterDate) : new Date();
  after.setHours(0, 0, 0, 0);
  const skipSet = new Set(schedule.skipDates || []);

  // Calendar-based: specific days of week
  if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
    const candidate = new Date(after);
    candidate.setDate(candidate.getDate() + 1); // Start from tomorrow
    for (let i = 0; i < 365; i++) {
      const iso = candidate.toISOString().slice(0, 10);
      if (schedule.daysOfWeek.includes(candidate.getDay()) && !skipSet.has(iso)) {
        if (!schedule.endDate || iso <= schedule.endDate) return iso;
      }
      candidate.setDate(candidate.getDate() + 1);
    }
    return ''; // No valid date found within a year
  }

  // Calendar-based: specific day of month
  if (schedule.dayOfMonth) {
    const candidate = new Date(after);
    candidate.setDate(candidate.getDate() + 1);
    for (let i = 0; i < 365; i++) {
      if (candidate.getDate() === schedule.dayOfMonth) {
        const iso = candidate.toISOString().slice(0, 10);
        if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate)) return iso;
      }
      candidate.setDate(candidate.getDate() + 1);
    }
    return '';
  }

  // Simple interval mode
  const intervalDays: Record<RecurrenceInterval, number> = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
  };
  const days = intervalDays[schedule.interval || 'weekly'];
  const candidate = new Date(after);
  candidate.setDate(candidate.getDate() + days);
  for (let i = 0; i < 365; i++) {
    const iso = candidate.toISOString().slice(0, 10);
    if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate)) return iso;
    candidate.setDate(candidate.getDate() + 1);
  }
  return '';
}

/**
 * Create a recurring order schedule.
 */
export async function createRecurringOrder(rec: Omit<RecurringOrder, 'id' | 'totalOrdersPlaced' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const cleanRec = Object.fromEntries(
    Object.entries(rec).filter(([, v]) => v !== undefined),
  );
  const docRef = await addDoc(collection(db, 'cateringRecurring'), {
    ...cleanRec,
    totalOrdersPlaced: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * List recurring orders for a user.
 */
export async function fetchRecurringOrders(userId: string): Promise<RecurringOrder[]> {
  const q = query(
    collection(db, 'cateringRecurring'),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecurringOrder));
}

/**
 * Real-time subscription to user's recurring orders.
 */
export function subscribeToRecurringOrders(userId: string, callback: (recs: RecurringOrder[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'cateringRecurring'),
    where('userId', '==', userId),
  );
  return onSnapshot(q, (snap) => {
    const recs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecurringOrder));
    callback(recs);
  });
}

/**
 * Update a recurring order (pause, change schedule, update items, etc.).
 */
export async function updateRecurringOrder(recId: string, updates: Partial<RecurringOrder>): Promise<void> {
  const { id, ...data } = updates as any;
  await updateDoc(doc(db, 'cateringRecurring', recId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a recurring order.
 */
export async function deleteRecurringOrder(recId: string): Promise<void> {
  await deleteDoc(doc(db, 'cateringRecurring', recId));
}

/**
 * Toggle a recurring order active/paused.
 */
export async function toggleRecurringOrder(recId: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'cateringRecurring', recId), {
    active,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Set a per-occurrence override for the next scheduled run.
 * This modifies only the next run without changing the recurring template.
 */
export async function setOccurrenceOverride(
  recId: string,
  override: OccurrenceOverride,
): Promise<void> {
  await updateDoc(doc(db, 'cateringRecurring', recId), {
    nextOccurrenceOverride: override,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Clear the per-occurrence override (revert next run to default template).
 */
export async function clearOccurrenceOverride(recId: string): Promise<void> {
  await updateDoc(doc(db, 'cateringRecurring', recId), {
    nextOccurrenceOverride: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Compute estimated monthly cost for a recurring order.
 * Returns cents.
 */
export function estimateMonthlyRecurringCost(rec: RecurringOrder): number {
  const orderTotal = calculateOrderTotal(rec.items);
  const sched = rec.schedule;

  let runsPerMonth: number;
  if (sched.daysOfWeek && sched.daysOfWeek.length > 0) {
    // Calendar mode: runs per week × ~4.33 weeks/month
    runsPerMonth = sched.daysOfWeek.length * 4.33;
  } else {
    switch (sched.interval) {
      case 'daily': runsPerMonth = 30; break;
      case 'weekly': runsPerMonth = 4.33; break;
      case 'biweekly': runsPerMonth = 2.17; break;
      case 'monthly': runsPerMonth = 1; break;
      default: runsPerMonth = 4.33;
    }
  }

  // Subtract approximate skip dates per month
  if (sched.skipDates && sched.skipDates.length > 0) {
    const skipsPerMonth = sched.skipDates.length / 12; // rough average
    runsPerMonth = Math.max(0, runsPerMonth - skipsPerMonth);
  }

  return Math.round(orderTotal * runsPerMonth);
}


// ═══════════════════════════════════════════════════════════════════════════════
// ORDER TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a short unique share code.
 */
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create an order template.
 */
export async function createOrderTemplate(tmpl: Omit<OrderTemplate, 'id' | 'shareCode' | 'useCount' | 'createdAt' | 'updatedAt'>): Promise<{ id: string; shareCode: string }> {
  const shareCode = generateShareCode();
  const cleanTmpl = Object.fromEntries(
    Object.entries(tmpl).filter(([, v]) => v !== undefined),
  );
  const docRef = await addDoc(collection(db, 'cateringTemplates'), {
    ...cleanTmpl,
    shareCode,
    useCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id, shareCode };
}

/**
 * Fetch templates created by a user.
 */
export async function fetchMyTemplates(userId: string): Promise<OrderTemplate[]> {
  const q = query(
    collection(db, 'cateringTemplates'),
    where('creatorId', '==', userId),
  );
  const snap = await getDocs(q);
  const templates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderTemplate));
  templates.sort((a, b) => {
    const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
  return templates;
}

/**
 * Fetch templates shared within an organization.
 */
export async function fetchOrgTemplates(organizationId: string): Promise<OrderTemplate[]> {
  const q = query(
    collection(db, 'cateringTemplates'),
    where('organizationId', '==', organizationId),
  );
  const snap = await getDocs(q);
  const templates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderTemplate));
  templates.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
  return templates;
}

/**
 * Look up a template by its share code (for link sharing).
 */
export async function fetchTemplateByShareCode(shareCode: string): Promise<OrderTemplate | null> {
  const q = query(
    collection(db, 'cateringTemplates'),
    where('shareCode', '==', shareCode),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as OrderTemplate;
}

/**
 * Update a template.
 */
export async function updateOrderTemplate(tmplId: string, updates: Partial<OrderTemplate>): Promise<void> {
  const { id, ...data } = updates as any;
  await updateDoc(doc(db, 'cateringTemplates', tmplId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a template.
 */
export async function deleteOrderTemplate(tmplId: string): Promise<void> {
  await deleteDoc(doc(db, 'cateringTemplates', tmplId));
}

/**
 * Record a template usage (when someone uses a template to start an order).
 */
export async function recordTemplateUsage(tmplId: string): Promise<void> {
  const tmplRef = doc(db, 'cateringTemplates', tmplId);
  const snap = await getDoc(tmplRef);
  if (snap.exists()) {
    await updateDoc(tmplRef, {
      useCount: (snap.data().useCount || 0) + 1,
      lastUsedAt: serverTimestamp(),
    });
  }
}

/**
 * Subscribe to templates for a user (own + org).
 */
export function subscribeToTemplates(
  userId: string,
  organizationId: string | null,
  callback: (templates: OrderTemplate[]) => void,
): Unsubscribe {
  // Subscribe to user's own templates
  const qOwn = query(
    collection(db, 'cateringTemplates'),
    where('creatorId', '==', userId),
  );

  let ownTemplates: OrderTemplate[] = [];
  let orgTemplates: OrderTemplate[] = [];

  const unsubOwn = onSnapshot(qOwn, (snap) => {
    ownTemplates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderTemplate));
    callback(dedupeTemplates([...ownTemplates, ...orgTemplates]));
  });

  let unsubOrg: Unsubscribe | null = null;
  if (organizationId) {
    const qOrg = query(
      collection(db, 'cateringTemplates'),
      where('organizationId', '==', organizationId),
    );
    unsubOrg = onSnapshot(qOrg, (snap) => {
      orgTemplates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderTemplate));
      callback(dedupeTemplates([...ownTemplates, ...orgTemplates]));
    });
  }

  return () => {
    unsubOwn();
    if (unsubOrg) unsubOrg();
  };
}

function dedupeTemplates(templates: OrderTemplate[]): OrderTemplate[] {
  const seen = new Set<string>();
  return templates.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}
