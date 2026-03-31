// ═══════════════════════════════════════════════════════════════════════
// CATERING QUOTES — RFQ/RFP quote requests and vendor responses
// ═══════════════════════════════════════════════════════════════════════

import type {
  CateringQuoteRequest,
  CateringQuoteResponse,
  QuotedItem,
  CateringOrder,
  OrderItem,
  QuoteRequestItem,
  ItemAssignment,
} from './cateringTypes';

import {
  collection,
  addDoc,
  getDoc,
  updateDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { db } from '../firebase';

const QUOTE_REQUESTS_COL = 'cateringQuoteRequests';
const QUOTE_RESPONSES_COL = 'cateringQuoteResponses';

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
  // Check expiry before accepting
  const responseSnap = await getDoc(doc(db, QUOTE_RESPONSES_COL, responseId));
  if (responseSnap.exists()) {
    const responseData = responseSnap.data();
    if (responseData.validUntil) {
      const expiryMs = responseData.validUntil.toMillis?.() || responseData.validUntil.seconds * 1000;
      if (Date.now() > expiryMs) {
        throw new Error('This quote has expired. Please request a new quote from the vendor.');
      }
    }
  }

  // 1. Mark the chosen response as accepted and reveal customer details
  const responseRef = doc(db, QUOTE_RESPONSES_COL, responseId);
  await updateDoc(responseRef, {
    status: 'accepted',
    ...customerDetails,
  });

  // 2. Mark the quote request as accepted + write itemAssignments for all quoted items
  const updatedSnap = await getDoc(responseRef);
  const updatedData = updatedSnap.data();
  const quotedItems: { name: string }[] = updatedData?.quotedItems || [];
  const requestRef = doc(db, QUOTE_REQUESTS_COL, requestId);
  await updateDoc(requestRef, {
    status: 'accepted',
    selectedResponseId: responseId,
    selectedBusinessId: updatedData?.businessId,
    itemAssignments: quotedItems.map((qi) => ({
      itemName: qi.name,
      responseId,
      businessId: updatedData?.businessId,
      businessName: updatedData?.businessName,
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
  // Check expiry before accepting
  const responseRef = doc(db, QUOTE_RESPONSES_COL, responseId);
  const responseSnap = await getDoc(responseRef);
  if (!responseSnap.exists()) throw new Error('Quote response not found');
  const responseData = responseSnap.data();

  if (responseData.validUntil) {
    const expiryMs = responseData.validUntil.toMillis?.() || responseData.validUntil.seconds * 1000;
    if (Date.now() > expiryMs) {
      throw new Error('This quote has expired. Please request a new quote from the vendor.');
    }
  }

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
