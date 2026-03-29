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
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  eventDate: any;
  deliveryAddress: DeliveryAddress;
  headcount: number;
  specialInstructions?: string;
  orderForContext?: OrderForContext;
  contactName: string;
  contactPhone: string;
  eventType?: string;           // corporate_meeting | wedding | cultural_festival | religious | birthday | other
  createdAt?: any;
  confirmedAt?: any;
  declinedReason?: string;
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
  // First get all catering-enabled businesses in this category
  const bizQ = query(
    collection(db, 'businesses'),
    where('category', '==', cuisineCategory),
    where('isCateringEnabled', '==', true),
  );
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
  const docRef = await addDoc(collection(db, MENU_ITEMS_COL), {
    ...item,
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
  const docRef = await addDoc(collection(db, ORDERS_COL), {
    ...order,
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
  const q = query(
    collection(db, 'businesses'),
    where('category', '==', category),
    where('isCateringEnabled', '==', true),
    where('registrationStatus', '==', 'approved'),
  );
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
