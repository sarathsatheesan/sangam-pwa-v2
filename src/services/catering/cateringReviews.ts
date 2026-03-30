// ═══════════════════════════════════════════════════════════════════════
// CATERING REVIEWS — Review submission, vendor responses, flagging
// ═══════════════════════════════════════════════════════════════════════

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { CateringReview } from './cateringTypes';

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

// ── Review flagging (#22) ──

export async function flagReview(reviewId: string, flaggedBy: string, reason: string): Promise<void> {
  await updateDoc(doc(db, 'businessReviews', reviewId), {
    flagged: true,
    flaggedBy,
    flaggedAt: serverTimestamp(),
    flagReason: reason,
  });
}
