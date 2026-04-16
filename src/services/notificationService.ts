/**
 * Notification Service
 *
 * Queues email and SMS notifications by writing to a Firestore
 * `notifications` collection. Cloud Functions pick these up and
 * dispatch via SendGrid (email) / Twilio (SMS).
 *
 * Each notification doc:
 *  - channel: 'email' | 'sms' | 'push'
 *  - recipientId: user UID
 *  - recipientEmail / recipientPhone (resolved by Cloud Function if not provided)
 *  - template: template key for email/SMS body
 *  - data: template variables
 *  - status: 'queued' | 'sent' | 'failed'
 *  - createdAt: server timestamp
 */

import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const NOTIFICATIONS_COL = 'notifications';

// ─── Types ───────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'sms' | 'push';

export type CateringNotificationType =
  | 'quote_request_submitted'
  | 'quote_request_edited'
  | 'vendor_quote_received'
  | 'quote_accepted'
  | 'quote_declined'
  | 'quote_expired'
  | 'order_confirmed'
  | 'order_status_changed'
  | 'order_cancelled'
  | 'vendor_new_rfq'
  | 'vendor_rfq_edited'
  | 'vendor_rfq_cancelled'
  | 'vendor_new_review'
  | 'review_flagged'
  | 'reprice_requested'
  | 'reprice_countered'
  | 'reprice_resolved';

export interface NotificationPayload {
  channel: NotificationChannel;
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  template: CateringNotificationType;
  data: Record<string, any>;
}

// ─── Queue a single notification ─────────────────────────────────────

async function queueNotification(payload: NotificationPayload): Promise<void> {
  try {
    await addDoc(collection(db, NOTIFICATIONS_COL), {
      ...payload,
      status: 'queued',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[notificationService] Failed to queue notification:', err);
  }
}

// ─── Queue email + SMS together ──────────────────────────────────────

async function notifyAllChannels(
  recipientId: string,
  template: CateringNotificationType,
  data: Record<string, any>,
): Promise<void> {
  await Promise.all([
    queueNotification({ channel: 'email', recipientId, template, data }),
    queueNotification({ channel: 'sms', recipientId, template, data }),
    queueNotification({ channel: 'push', recipientId, template, data }),
  ]);
}

// ─── Catering-specific notification helpers ──────────────────────────

/** Customer submitted a new quote request */
export async function notifyQuoteRequestSubmitted(
  customerId: string,
  requestId: string,
  cuisineCategory: string,
  eventDate: string,
  headcount: number,
): Promise<void> {
  await notifyAllChannels(customerId, 'quote_request_submitted', {
    requestId,
    cuisineCategory,
    eventDate,
    headcount,
    // Deep-link: service worker uses requestId to build /catering?view=quotes&quoteRequestId=xxx
  });
}

/** Customer edited their quote request (vendors get notified if they had responded) */
export async function notifyQuoteRequestEdited(
  customerId: string,
  requestId: string,
  requiresRequote: boolean,
  vendorBusinessIds: string[],
): Promise<void> {
  // Notify customer
  await notifyAllChannels(customerId, 'quote_request_edited', {
    requestId,
    requiresRequote,
  });

  // Notify vendors who had already responded — they need to re-quote
  if (requiresRequote && vendorBusinessIds.length > 0) {
    for (const bizId of vendorBusinessIds) {
      try {
        const bizDoc = await getDoc(doc(db, 'businesses', bizId));
        const ownerId = bizDoc.data()?.ownerId;
        if (ownerId) {
          await notifyAllChannels(ownerId, 'vendor_rfq_edited', {
            requestId,
            message: 'A customer has updated their quote request. Please review and re-quote.',
          });
        }
      } catch (err) {
        console.error(`[notificationService] Failed to notify vendor ${bizId}:`, err);
      }
    }
  }
}

/** Vendor submitted a quote — notify the customer */
export async function notifyVendorQuoteReceived(
  customerId: string,
  requestId: string,
  vendorName: string,
  totalPrice: number,
): Promise<void> {
  await notifyAllChannels(customerId, 'vendor_quote_received', {
    requestId,
    vendorName,
    totalPrice,
  });
}

/** Customer accepted a vendor's quote */
export async function notifyQuoteAccepted(
  vendorOwnerId: string,
  requestId: string,
  customerName: string,
  totalPrice: number,
): Promise<void> {
  await notifyAllChannels(vendorOwnerId, 'quote_accepted', {
    requestId,
    customerName,
    totalPrice,
    role: 'vendor',
  });
}

/** Order status changed — notify customer */
export async function notifyOrderStatusChanged(
  customerId: string,
  orderId: string,
  newStatus: string,
  businessName: string,
): Promise<void> {
  await notifyAllChannels(customerId, 'order_status_changed', {
    orderId,
    newStatus,
    businessName,
  });
}

/** New RFQ broadcast — notify eligible vendors */
export async function notifyVendorsNewRFQ(
  vendorOwnerIds: string[],
  requestId: string,
  cuisineCategory: string,
  deliveryCity: string,
  headcount: number,
): Promise<void> {
  for (const ownerId of vendorOwnerIds) {
    await notifyAllChannels(ownerId, 'vendor_new_rfq', {
      requestId,
      cuisineCategory,
      deliveryCity,
      headcount,
      role: 'vendor',
    });
  }
}

/** New review posted — notify vendor (#21) */
export async function notifyVendorNewReview(
  vendorOwnerId: string,
  businessName: string,
  reviewerName: string,
  rating: number,
  reviewText: string,
): Promise<void> {
  await notifyAllChannels(vendorOwnerId, 'vendor_new_review', {
    businessName,
    reviewerName,
    rating,
    reviewText: reviewText.slice(0, 200),
  });
}

/** Review flagged — notify admin / vendor (#22) */
export async function notifyReviewFlagged(
  vendorOwnerId: string,
  reviewId: string,
  reason: string,
  businessName: string,
): Promise<void> {
  await notifyAllChannels(vendorOwnerId, 'review_flagged', {
    reviewId,
    reason,
    businessName,
  });
}

/** Order confirmed — notify both parties
 *  Each payload includes `role` so the service worker can build the correct
 *  deep-link URL (customer → /catering?view=orders, vendor → /catering?vendorView=orders). */
export async function notifyOrderConfirmed(
  customerId: string,
  vendorOwnerId: string,
  orderId: string,
  totalPrice: number,
  businessName: string,
): Promise<void> {
  await Promise.all([
    notifyAllChannels(customerId, 'order_confirmed', {
      orderId,
      totalPrice,
      businessName,
      role: 'customer',
    }),
    notifyAllChannels(vendorOwnerId, 'order_confirmed', {
      orderId,
      totalPrice,
      businessName,
      role: 'vendor',
    }),
  ]);
}

/** Order cancelled — notify the other party (email/SMS/push) */
export async function notifyOrderCancelledMultiChannel(
  recipientId: string,
  orderId: string,
  businessName: string,
  cancelledBy: 'customer' | 'vendor',
  reason: string,
): Promise<void> {
  await notifyAllChannels(recipientId, 'order_cancelled', {
    orderId,
    businessName,
    cancelledBy,
    reason,
  });
}

/** Vendor's quote was declined — notify vendor (email/SMS/push) */
export async function notifyVendorQuoteDeclinedMultiChannel(
  vendorOwnerId: string,
  requestId: string,
  businessName: string,
): Promise<void> {
  await notifyAllChannels(vendorOwnerId, 'quote_declined', {
    requestId,
    businessName,
  });
}

/** RFP cancelled — notify vendors who had responded (email/SMS/push) */
export async function notifyVendorsRfpCancelledMultiChannel(
  vendorOwnerIds: string[],
  requestId: string,
): Promise<void> {
  for (const ownerId of vendorOwnerIds) {
    await notifyAllChannels(ownerId, 'vendor_rfq_cancelled', {
      requestId,
    });
  }
}

// ── Reprice negotiation multi-channel notifications ──

/** Notify vendor of reprice request (email/SMS/push) */
export async function notifyVendorRepriceRequestedMultiChannel(
  vendorOwnerId: string,
  requestId: string,
  requestedPrice: number,
): Promise<void> {
  await notifyAllChannels(vendorOwnerId, 'reprice_requested', {
    requestId,
    requestedPrice,
    role: 'vendor',
  });
}

/** Notify customer of vendor's reprice response (email/SMS/push) */
export async function notifyCustomerRepriceResponseMultiChannel(
  customerId: string,
  requestId: string,
  action: 'accepted' | 'denied' | 'countered',
  counterPrice?: number,
): Promise<void> {
  const type: CateringNotificationType = action === 'countered' ? 'reprice_countered' : 'reprice_resolved';
  await notifyAllChannels(customerId, type, {
    requestId,
    action,
    counterPrice,
  });
}

/** Notify vendor that customer resolved their counter-offer (email/SMS/push) */
export async function notifyVendorCounterResolvedMultiChannel(
  vendorOwnerId: string,
  requestId: string,
  accepted: boolean,
): Promise<void> {
  await notifyAllChannels(vendorOwnerId, 'reprice_resolved', {
    requestId,
    accepted,
    role: 'vendor',
  });
}
