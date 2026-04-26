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
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { db } from '../firebase';
import {
  notifyVendorItemReassigned,
  notifyVendorsRfpEdited,
  notifyCustomerRfpCancelled,
  notifyVendorRfpCancelled,
  notifyCustomerRfpExpired,
} from './cateringNotifications';
import { notifyVendorsRfpCancelledMultiChannel } from '../notificationService';

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
  // Store full delivery address if provided (privacy: vendors only see deliveryCity)
  if (request.deliveryAddress) payload.deliveryAddress = request.deliveryAddress;

  const docRef = await addDoc(collection(db, QUOTE_REQUESTS_COL), payload);
  return docRef.id;
}

/**
 * Check whether a quote request is still editable.
 * FIX-H5/M-9: Now also enforces these rules server-side (previously client-only).
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

  // FIX-H5: Notify vendors who have already quoted that the RFP was edited
  if (data.responseCount > 0) {
    const editedFields = Object.keys(updates).filter((k) => updates[k as keyof typeof updates] !== undefined);
    const editSummary = editedFields.join(', ') + ' updated';
    notifyVendorsOfRfpEdit(requestId, editSummary).catch(console.warn);
  }
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

/**
 * Check whether a quote response is still editable.
 * Rules:
 *  - Status must be 'submitted' (not accepted/declined)
 *  - Within 24 hours of creation
 */
export function isQuoteResponseEditable(response: CateringQuoteResponse): boolean {
  if (response.status !== 'submitted') return false;

  // Time-since-creation check
  const createdMs = response.createdAt?.toMillis?.()
    || (response.createdAt?.seconds ? response.createdAt.seconds * 1000 : 0);
  if (!createdMs) return false;
  if (Date.now() - createdMs >= QUOTE_EDIT_WINDOW_MS) return false;

  return true;
}

/**
 * Update an existing quote response (only allowed within edit window).
 * Allows vendors to edit their submitted quotes before the customer accepts/declines.
 */
export async function updateQuoteResponse(
  responseId: string,
  updates: {
    quotedItems?: QuotedItem[];
    subtotal?: number;
    serviceFee?: number;
    deliveryFee?: number;
    total?: number;
    estimatedPrepTime?: string;
    message?: string;
  },
): Promise<void> {
  const ref = doc(db, QUOTE_RESPONSES_COL, responseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Quote response not found');
  const data = snap.data() as CateringQuoteResponse;

  // Guard: status must be submitted
  if (data.status !== 'submitted') throw new Error('Only submitted quotes can be edited');

  // Guard: within 24hr creation window
  const createdMs = data.createdAt?.toMillis?.()
    || (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
  if (createdMs && Date.now() - createdMs >= QUOTE_EDIT_WINDOW_MS) {
    throw new Error('Edit window (24 hours) has expired');
  }

  // Strip undefined keys
  const cleanUpdates: Record<string, any> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) cleanUpdates[k] = v;
  }
  cleanUpdates.updatedAt = serverTimestamp();

  await updateDoc(ref, cleanUpdates);
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

/**
 * FIX-M8: Atomic full-vendor acceptance using a transaction on the request doc.
 * Reads the request status inside the transaction to prevent two simultaneous
 * full-accept calls from both succeeding on different vendors.
 */
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

  // FIX-M8: Use a transaction on the request doc to prevent concurrent full-accepts
  const requestRef = doc(db, QUOTE_REQUESTS_COL, requestId);
  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(requestRef);
    if (!reqSnap.exists()) throw new Error('Quote request not found');
    const reqData = reqSnap.data();

    // If request is already accepted, another concurrent call beat us
    if (reqData.status === 'accepted') {
      throw new Error('This quote request has already been fully accepted. Please refresh to see the latest state.');
    }

    // Mark the chosen response as accepted and reveal customer details
    const responseRef = doc(db, QUOTE_RESPONSES_COL, responseId);
    transaction.update(responseRef, {
      status: 'accepted',
      ...customerDetails,
    });

    // 2. Read the response data to get quoted items (inside transaction for consistency)
    const respSnap = await transaction.get(responseRef);
    const respData = respSnap.data() || {};
    const quotedItems: { name: string }[] = respData.quotedItems || [];

    // 3. Mark the quote request as accepted + write itemAssignments
    transaction.update(requestRef, {
      status: 'accepted',
      selectedResponseId: responseId,
      selectedBusinessId: respData.businessId,
      itemAssignments: quotedItems.map((qi) => ({
        itemName: qi.name,
        responseId,
        businessId: respData.businessId,
        businessName: respData.businessName,
        assignedAt: Timestamp.now(),
      })),
    });
  });

  // 4. Decline all other responses for this request (outside transaction — non-critical)
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

  // FIX-C3: Identify items being reassigned away from other vendors
  const reassignedItems = existingAssignments.filter(
    (a) => selectedItemNames.includes(a.itemName) && a.businessId !== responseData.businessId,
  );

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
    assignedAt: Timestamp.now(),          // Timestamp.now() — not serverTimestamp() which Firestore forbids inside arrays
  }));
  const allAssignments = [...filteredAssignments, ...newAssignments];

  // FIX-C3: Notify vendors who lost items due to reassignment (non-blocking)
  if (reassignedItems.length > 0) {
    // Group reassigned items by the vendor who lost them
    const lostByVendor = new Map<string, string[]>();
    for (const item of reassignedItems) {
      if (!lostByVendor.has(item.businessId)) lostByVendor.set(item.businessId, []);
      lostByVendor.get(item.businessId)!.push(item.itemName);
    }
    for (const [lostBusinessId, itemNames] of lostByVendor) {
      // Find the vendor's response to get their owner ID for notification
      const allResponses = await fetchQuoteResponsesByRequest(requestId);
      const lostResponse = allResponses.find((r: any) => r.businessId === lostBusinessId);
      if (lostResponse?.vendorOwnerId) {
        notifyVendorItemReassigned(
          lostResponse.vendorOwnerId,
          lostResponse.businessName,
          itemNames,
          requestId,
        ).catch(console.warn);
      }
    }
  }

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

  // FIX-LOCK: Always keep status as 'partially_accepted' here.
  // The customer must explicitly confirm finalization via the UI before
  // we set status to 'accepted' and auto-decline remaining vendors.
  // This prevents the "lock bug" where accepting items from one vendor
  // auto-finalizes and blocks selecting from other vendors.
  requestUpdate.status = 'partially_accepted';

  await updateDoc(requestRef, requestUpdate);

  return { allItemsAssigned };
}

/**
 * Finalize a partially-accepted request — mark it as fully accepted and auto-decline remaining.
 * Called when the customer clicks "Finalize Order" after assigning all items they want.
 * SB-37: Now accepts an optional deliveryAddress to be stored with the request.
 */
export async function finalizeQuoteRequest(
  requestId: string,
  deliveryAddress?: { street: string; city: string; state: string; zip: string },
): Promise<void> {
  const requestRef = doc(db, QUOTE_REQUESTS_COL, requestId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = { status: 'accepted' };
  if (deliveryAddress) {
    updatePayload.deliveryAddress = deliveryAddress;
  }
  await updateDoc(requestRef, updatePayload);

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

// ── FIX-C4: Close RFP and Proceed-with-partial escape hatches ──

/**
 * FIX-C4: Close an RFP entirely — cancels the request and auto-declines all vendors.
 * Used when the customer wants to abandon a partially-accepted or open RFP.
 */
export async function closeQuoteRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, QUOTE_REQUESTS_COL, requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error('Quote request not found');
  const data = requestSnap.data();

  if (data.status === 'cancelled') throw new Error('Quote request is already cancelled');
  if (data.ordersCreated) throw new Error('Orders have already been created from this quote request');

  await updateDoc(requestRef, {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
  });

  // Auto-decline all submitted responses + collect vendor owner IDs for notifications
  const allResponses = await fetchQuoteResponsesByRequest(requestId);
  const vendorOwnerIdsToNotify: Array<{ ownerId: string; businessName: string }> = [];
  for (const resp of allResponses) {
    if (resp.status === 'submitted' || resp.status === 'partially_accepted') {
      await updateDoc(doc(db, QUOTE_RESPONSES_COL, resp.id), { status: 'declined' });
    }
    // Collect vendor owners to notify (all who had responded, regardless of status)
    if (resp.vendorOwnerId) {
      vendorOwnerIdsToNotify.push({ ownerId: resp.vendorOwnerId, businessName: resp.businessName });
    }
  }

  // Notify customer their RFP was cancelled (in-app, fire-and-forget)
  notifyCustomerRfpCancelled(data.customerId, requestId).catch(console.warn);

  // Notify all vendors who had responded (in-app + multi-channel, fire-and-forget)
  const vendorOwnerIdsList = vendorOwnerIdsToNotify.map(v => v.ownerId);
  for (const { ownerId, businessName } of vendorOwnerIdsToNotify) {
    notifyVendorRfpCancelled(ownerId, requestId, businessName).catch(console.warn);
  }
  if (vendorOwnerIdsList.length > 0) {
    notifyVendorsRfpCancelledMultiChannel(vendorOwnerIdsList, requestId).catch(console.warn);
  }
}

/**
 * FIX-C4: Proceed with only the items that have been assigned so far.
 * Marks unassigned items as "dropped" and triggers finalization with whatever is assigned.
 * Returns the list of unassigned item names that were dropped.
 */
export async function proceedWithPartialAssignment(requestId: string): Promise<{ droppedItems: string[] }> {
  const requestRef = doc(db, QUOTE_REQUESTS_COL, requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error('Quote request not found');
  const data = requestSnap.data();

  const allItemNames: string[] = (data.items || []).map((i: any) => i.name);
  const assignedItemNames = new Set((data.itemAssignments || []).map((a: any) => a.itemName));

  const droppedItems = allItemNames.filter((name) => !assignedItemNames.has(name));

  if (assignedItemNames.size === 0) {
    throw new Error('No items have been assigned yet. Use "Close RFP" instead.');
  }

  // Mark request as accepted (with partial note) and record dropped items
  await updateDoc(requestRef, {
    status: 'accepted',
    droppedItems,
    partialProceed: true,
    partialProceedAt: serverTimestamp(),
  });

  // Auto-decline remaining submitted responses
  const allResponses = await fetchQuoteResponsesByRequest(requestId);
  for (const resp of allResponses) {
    if (resp.status === 'submitted') {
      await updateDoc(doc(db, QUOTE_RESPONSES_COL, resp.id), { status: 'declined' });
    }
  }

  return { droppedItems };
}

// ── FIX-C5: Expire stale RFPs (to be called by Cloud Function or periodic client-side check) ──

/**
 * FIX-C5: Find and expire all open RFPs older than 7 days.
 * Returns the count of expired requests. Intended to be called by a scheduled
 * Cloud Function (daily) or as a client-side check on dashboard load.
 */
export async function expireStaleQuoteRequests(): Promise<number> {
  const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const q = query(
    collection(db, QUOTE_REQUESTS_COL),
    where('status', '==', 'open'),
  );
  const snap = await getDocs(q);
  let expiredCount = 0;

  for (const requestDoc of snap.docs) {
    const data = requestDoc.data();
    const createdMs = data.createdAt?.toMillis?.() || data.createdAt?.seconds * 1000 || 0;

    if (createdMs > 0 && createdMs < sevenDaysAgo.toMillis()) {
      await updateDoc(requestDoc.ref, {
        status: 'expired',
        expiredAt: serverTimestamp(),
      });

      // Decline any submitted responses
      const responses = await fetchQuoteResponsesByRequest(requestDoc.id);
      for (const resp of responses) {
        if (resp.status === 'submitted') {
          await updateDoc(doc(db, QUOTE_RESPONSES_COL, resp.id), { status: 'expired' });
        }
      }

      // Notify customer their RFP expired (in-app, fire-and-forget)
      const itemCount = (data.items || []).length;
      notifyCustomerRfpExpired(data.customerId, requestDoc.id, itemCount).catch(console.warn);

      expiredCount++;
    }
  }

  // Also expire stale reprice requests/counter-offers in the same pass
  const repriceExpired = await expireStaleRepriceRequests();
  expiredCount += repriceExpired;

  return expiredCount;
}

// ── FIX-H5: Notify vendors when an RFP is edited (called from updateQuoteRequest) ──

/**
 * FIX-H5: After editing an RFP, notify all vendors who have already submitted quotes.
 * Should be called after a successful updateQuoteRequest that changes items/details.
 */
export async function notifyVendorsOfRfpEdit(
  requestId: string,
  editSummary: string,
): Promise<void> {
  const responses = await fetchQuoteResponsesByRequest(requestId);
  const vendorOwnerIds = responses
    .filter((r) => r.status === 'submitted' && r.vendorOwnerId)
    .map((r) => r.vendorOwnerId!);

  if (vendorOwnerIds.length > 0) {
    await notifyVendorsRfpEdited(vendorOwnerIds, requestId, editSummary);
  }

  // Mark existing quotes as potentially stale
  for (const resp of responses) {
    if (resp.status === 'submitted') {
      await updateDoc(doc(db, QUOTE_RESPONSES_COL, resp.id), {
        staleWarning: true,
        staleReason: `RFP edited: ${editSummary}`,
        staleAt: serverTimestamp(),
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPRICE NEGOTIATION — one-shot price negotiation within the RFP flow
// Customer proposes a new total → Vendor accepts / denies / counters → Customer accepts or declines
// ═══════════════════════════════════════════════════════════════════════════════

/** 24-hour window for vendor to respond to reprice request / customer to respond to counter */
const REPRICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Customer requests a new price for a vendor's quote.
 * One-shot: can only be called once per response (repriceStatus must be 'none' or undefined).
 */
export async function requestReprice(
  responseId: string,
  requestedPrice: number,
  reason?: string,
): Promise<void> {
  const responseRef = doc(db, QUOTE_RESPONSES_COL, responseId);
  const snap = await getDoc(responseRef);
  if (!snap.exists()) throw new Error('Quote response not found');
  const data = snap.data();

  // Guard: only allowed on submitted quotes with no prior reprice
  if (data.status !== 'submitted') {
    throw new Error('Can only request a reprice on a submitted quote');
  }
  if (data.repriceStatus && data.repriceStatus !== 'none') {
    throw new Error('A reprice has already been requested for this quote');
  }

  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + REPRICE_WINDOW_MS);

  await updateDoc(responseRef, {
    repriceStatus: 'requested',
    repriceRequestedPrice: requestedPrice,
    repriceReason: reason || '',
    repriceRequestedAt: now,
    repriceExpiresAt: expiresAt,
  });
}

/**
 * Vendor responds to a customer's reprice request.
 * action: 'accept' — vendor accepts customer's proposed price (updates quote total)
 *         'deny'   — vendor refuses, original price stands
 *         'counter' — vendor proposes a different total
 */
export async function respondToReprice(
  responseId: string,
  action: 'accept' | 'deny' | 'counter',
  counterPrice?: number,
  vendorNote?: string,
): Promise<void> {
  const responseRef = doc(db, QUOTE_RESPONSES_COL, responseId);
  const snap = await getDoc(responseRef);
  if (!snap.exists()) throw new Error('Quote response not found');
  const data = snap.data();

  if (data.repriceStatus !== 'requested') {
    throw new Error('No pending reprice request to respond to');
  }

  // Check expiry
  const expiresMs = data.repriceExpiresAt?.toMillis?.() || 0;
  if (Date.now() > expiresMs) {
    throw new Error('The reprice request has expired');
  }

  const now = Timestamp.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {
    repriceRespondedAt: now,
    repriceVendorNote: vendorNote || '',
  };

  if (action === 'accept') {
    // Vendor accepts the customer's proposed price — update the quote total
    update.repriceStatus = 'vendor_accepted';
    update.total = data.repriceRequestedPrice;
  } else if (action === 'deny') {
    // Vendor refuses — original price stands, negotiation over
    update.repriceStatus = 'vendor_denied';
  } else if (action === 'counter') {
    if (counterPrice == null || counterPrice <= 0) {
      throw new Error('Counter price is required');
    }
    update.repriceStatus = 'vendor_countered';
    update.repriceCounterPrice = counterPrice;
    // Start 24h acceptance window for customer
    update.repriceCounterExpiresAt = Timestamp.fromMillis(now.toMillis() + REPRICE_WINDOW_MS);
  }

  await updateDoc(responseRef, update);
}

/**
 * Customer responds to a vendor's counter-offer.
 * action: 'accept' — customer accepts the counter price (updates quote total)
 *         'decline' — customer declines, original quote price is restored
 */
export async function resolveCounterOffer(
  responseId: string,
  action: 'accept' | 'decline',
): Promise<void> {
  const responseRef = doc(db, QUOTE_RESPONSES_COL, responseId);
  const snap = await getDoc(responseRef);
  if (!snap.exists()) throw new Error('Quote response not found');
  const data = snap.data();

  if (data.repriceStatus !== 'vendor_countered') {
    throw new Error('No pending counter-offer to resolve');
  }

  // Check expiry
  const expiresMs = data.repriceCounterExpiresAt?.toMillis?.() || 0;
  if (Date.now() > expiresMs) {
    throw new Error('The counter-offer has expired');
  }

  const now = Timestamp.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {
    repriceResolvedAt: now,
  };

  if (action === 'accept') {
    update.repriceStatus = 'counter_accepted';
    update.total = data.repriceCounterPrice;
  } else {
    update.repriceStatus = 'counter_declined';
    // Total stays at original value
  }

  await updateDoc(responseRef, update);
}

/**
 * Expire stale reprice requests and counter-offers.
 * Called alongside expireStaleQuoteRequests() or on its own schedule.
 */
export async function expireStaleRepriceRequests(): Promise<number> {
  let expiredCount = 0;
  const now = Date.now();

  // 1. Expire vendor-response windows (repriceStatus === 'requested' && past expiresAt)
  const requestedSnap = await getDocs(
    query(collection(db, QUOTE_RESPONSES_COL), where('repriceStatus', '==', 'requested')),
  );
  for (const docSnap of requestedSnap.docs) {
    const data = docSnap.data();
    const expiresMs = data.repriceExpiresAt?.toMillis?.() || 0;
    if (expiresMs > 0 && now > expiresMs) {
      await updateDoc(doc(db, QUOTE_RESPONSES_COL, docSnap.id), {
        repriceStatus: 'expired',
      });
      expiredCount++;
    }
  }

  // 2. Expire customer counter-acceptance windows (repriceStatus === 'vendor_countered' && past counterExpiresAt)
  const counteredSnap = await getDocs(
    query(collection(db, QUOTE_RESPONSES_COL), where('repriceStatus', '==', 'vendor_countered')),
  );
  for (const docSnap of counteredSnap.docs) {
    const data = docSnap.data();
    const expiresMs = data.repriceCounterExpiresAt?.toMillis?.() || 0;
    if (expiresMs > 0 && now > expiresMs) {
      await updateDoc(doc(db, QUOTE_RESPONSES_COL, docSnap.id), {
        repriceStatus: 'expired',
      });
      expiredCount++;
    }
  }

  return expiredCount;
}

// ═════════════════════════════════════════════════════════════════════════════════
