// ═══════════════════════════════════════════════════════════════════════
// MARKETPLACE DATA ACCESS — every Firestore read/write used by
// pages/marketplace.tsx, moved here mechanically (Session 48). Query shapes,
// payloads, field names and timestamp choices are byte-identical to what the
// page did inline (note: this page uses Timestamp.now(), NOT serverTimestamp(),
// for listing/comment createdAt — preserved as-is). The page keeps all state,
// filtering, sorting, toasts and UI logic. The shared report flow lives in
// services/moderation.ts (submitContentReport); the marketplace-specific
// 3-strike tail (hideListing + sendListingHiddenNotification) lives here and
// is driven by the PAGE.
// ═══════════════════════════════════════════════════════════════════════

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { z } from 'zod';
import { db } from './firebase';

/* ─── types (moved verbatim from pages/marketplace.tsx) ─── */

export interface MarketplaceItem {
  id: string;
  title: string;
  price: string;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  description: string;
  photos: string[];
  location: string;
  locCity: string;
  locState: string;
  locZip: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  createdAt: any;
  status: 'available' | 'pending' | 'sold';
  featured: boolean;
  viewCount: number;
  saveCount: number;
  brand?: string;
  model?: string;
  color?: string;
  size?: string;
  material?: string;
  dimensions?: string;
  weight?: string;
  sku?: string;
  deliveryMethod: 'pickup' | 'shipping' | 'both';
  shippingPrice?: string;
  negotiable: boolean;
  tags: string[];
  videoUrl?: string;
  heritage?: string[];
  isHidden?: boolean;
  hiddenAt?: string;
  hiddenReason?: string;
}

/** Comment record in `marketplaceComments` (was `Comment` in the page). */
export interface MarketplaceComment {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: any;
}

/* ─── zod schema (OBSERVE MODE) ───
 * Permissive on purpose: everything optional except id, .passthrough() for
 * extra Firestore fields. safeParse failures are logged with console.warn
 * but the doc is ALWAYS returned unchanged — items are never dropped. */

const firestoreTimestamp = z.any().optional();

export const MarketplaceListingSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  price: z.string().optional(),
  category: z.string().optional(),
  condition: z.string().optional(),
  description: z.string().optional(),
  photos: z.array(z.string()).optional(),
  location: z.string().optional(),
  locCity: z.string().optional(),
  locState: z.string().optional(),
  locZip: z.string().optional(),
  sellerId: z.string().optional(),
  sellerName: z.string().optional(),
  sellerAvatar: z.string().optional(),
  createdAt: firestoreTimestamp,
  status: z.string().optional(),
  featured: z.boolean().optional(),
  viewCount: z.number().optional(),
  saveCount: z.number().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  material: z.string().optional(),
  dimensions: z.string().optional(),
  weight: z.string().optional(),
  sku: z.string().optional(),
  deliveryMethod: z.string().optional(),
  shippingPrice: z.string().optional(),
  negotiable: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  heritage: z.array(z.string()).optional(),
  isHidden: z.boolean().optional(),
  hiddenAt: z.string().optional(),
  hiddenReason: z.string().optional(),
}).passthrough();

/** Observe-mode validation: warn on failure, never drop the doc. */
function observeListing(raw: { id: string } & DocumentData): void {
  const result = MarketplaceListingSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[MarketplaceSchema] Listing validation failed (doc kept):', raw.id, result.error.issues);
  }
}

/* ─── timestamp helper (moved verbatim from the page's sort comparator) ─── */

/**
 * The page's "newest" sort did `createdAt instanceof Timestamp ?
 * createdAt.toDate().getTime() : new Date(createdAt).getTime()` inline —
 * moved here so the page needs no value import of Timestamp.
 */
export function createdAtToMillis(value: any): number {
  return value instanceof Timestamp ? value.toDate().getTime() : new Date(value).getTime();
}

/* ─── listings: fetch / create / update / delete / status ─── */

/**
 * ⚠️ UNBOUNDED QUERY (parity — no limit added): downloads the ENTIRE
 * marketplaceListings collection on every page load. isHidden docs are
 * skipped client-side, exactly as before. The page keeps all category /
 * heritage / search filtering and sorting.
 */
export async function fetchListings(): Promise<MarketplaceItem[]> {
  const querySnapshot = await getDocs(collection(db, 'marketplaceListings'));
  const items: MarketplaceItem[] = [];
  querySnapshot.docs.forEach((d) => {
    const data = d.data();
    if (data.isHidden) return;
    observeListing({ id: d.id, ...data });
    items.push({ ...(data as Omit<MarketplaceItem, 'id'>), id: d.id });
  });
  return items;
}

/** Payload the page builds for a new listing (optional detail fields already
 * conditionally spread by the page — never undefined). createdAt is added here. */
export type CreateListingInput = Omit<MarketplaceItem, 'id' | 'createdAt'>;

/**
 * Creates a listing with `createdAt: Timestamp.now()` (parity — this page
 * never used serverTimestamp() for listings). Returns the new id AND the
 * createdAt value so the page can mirror the exact doc into local state.
 */
export async function createListing(
  data: CreateListingInput,
): Promise<{ id: string; createdAt: Timestamp }> {
  const createdAt = Timestamp.now();
  const docRef = await addDoc(collection(db, 'marketplaceListings'), {
    ...data,
    createdAt,
  });
  return { id: docRef.id, createdAt };
}

/** Full edit payload: `{ ...formData, photos, tags, heritage }` exactly as the
 * page spread it (note: includes `sku` and raw `location`, unlike create —
 * preserved as-is; every field is always defined). */
export interface UpdateListingInput {
  title: string;
  price: string;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  description: string;
  location: string;
  locCity: string;
  locState: string;
  locZip: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  material: string;
  dimensions: string;
  weight: string;
  sku: string;
  deliveryMethod: 'pickup' | 'shipping' | 'both';
  shippingPrice: string;
  negotiable: boolean;
  videoUrl: string;
  photos: string[];
  tags: string[];
  heritage: string[];
}

export async function updateListing(listingId: string, updates: UpdateListingInput): Promise<void> {
  await updateDoc(doc(db, 'marketplaceListings', listingId), { ...updates });
}

/** Hard delete (parity — marketplace has no soft-delete flag for owner deletes). */
export async function deleteListing(listingId: string): Promise<void> {
  await deleteDoc(doc(db, 'marketplaceListings', listingId));
}

/** Status transitions: available / pending / sold (relist = back to available). */
export async function updateListingStatus(
  listingId: string,
  status: 'available' | 'pending' | 'sold',
): Promise<void> {
  await updateDoc(doc(db, 'marketplaceListings', listingId), { status });
}

/** Save/unsave toggle: atomic saveCount increment (page passes +1 / -1). */
export async function adjustListingSaveCount(listingId: string, delta: number): Promise<void> {
  await updateDoc(doc(db, 'marketplaceListings', listingId), {
    saveCount: increment(delta),
  });
}

/** Detail-open view counter bump. */
export async function incrementListingViewCount(listingId: string): Promise<void> {
  await updateDoc(doc(db, 'marketplaceListings', listingId), {
    viewCount: increment(1),
  });
}

/**
 * Heritage/avatar backfill on the user's own legacy listings. The page builds
 * `updates` with only the keys that need backfilling; conditional spreads here
 * guarantee no `undefined` value can ever reach updateDoc (the Firestore SDK
 * throws on undefined field values).
 */
export async function backfillListingSellerInfo(
  listingId: string,
  updates: { heritage?: string[]; sellerAvatar?: string },
): Promise<void> {
  await updateDoc(doc(db, 'marketplaceListings', listingId), {
    ...(updates.heritage !== undefined ? { heritage: updates.heritage } : {}),
    ...(updates.sellerAvatar !== undefined ? { sellerAvatar: updates.sellerAvatar } : {}),
  });
}

/* ─── comments (marketplaceComments collection) ─── */

/**
 * ⚠️ UNBOUNDED QUERY (parity — no limit added): all comments for a listing
 * (where listingId ==, no orderBy — the page never sorted them).
 */
export async function fetchListingComments(listingId: string): Promise<MarketplaceComment[]> {
  const querySnapshot = await getDocs(
    query(collection(db, 'marketplaceComments'), where('listingId', '==', listingId)),
  );
  return querySnapshot.docs.map((d) => ({
    ...(d.data() as Omit<MarketplaceComment, 'id'>),
    id: d.id,
  }));
}

export interface AddListingCommentInput {
  listingId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
}

/**
 * Adds a comment with `createdAt: Timestamp.now()` (parity — not
 * serverTimestamp()). Returns id + createdAt for the page's local-state mirror.
 */
export async function addListingComment(
  input: AddListingCommentInput,
): Promise<{ id: string; createdAt: Timestamp }> {
  const createdAt = Timestamp.now();
  const docRef = await addDoc(collection(db, 'marketplaceComments'), {
    ...input,
    createdAt,
  });
  return { id: docRef.id, createdAt };
}

/* ─── moderation tail (3-strike auto-hide, driven by the PAGE) ─── */

/**
 * Auto-hide a listing that hit the report threshold. `hiddenAt` stays an ISO
 * string (parity — this field was never a serverTimestamp).
 */
export async function hideListing(listingId: string, hiddenReason: string): Promise<void> {
  await updateDoc(doc(db, 'marketplaceListings', listingId), {
    isHidden: true,
    hiddenAt: new Date().toISOString(),
    hiddenReason,
  });
}

export interface ListingHiddenNotificationInput {
  recipientId: string;
  recipientName: string;
  /** Yes, `postId` — the notifications collection reuses this field name for
   * listing ids too (parity with the page's original payload). */
  postId: string;
  reason: string;
  message: string;
  actionUrl: string;
}

/**
 * Notifies a seller their listing was auto-hidden. The service adds
 * `type: 'content_hidden'`, `read: false` and `createdAt: serverTimestamp()`.
 * (Same payload shape as services/feed.ts sendContentHiddenNotification —
 * kept separate per the parity rule; unify in a dedicated session.)
 */
export async function sendListingHiddenNotification(
  input: ListingHiddenNotificationInput,
): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    type: 'content_hidden',
    ...input,
    read: false,
    createdAt: serverTimestamp(),
  });
}

/* ─── user safety data (mutedListings / blockedUsers on users/{uid}) ─── */

/**
 * Reads the user's doc for safety data. Returns null when the doc doesn't
 * exist; otherwise the raw fields (page keeps its own truthiness checks).
 */
export async function fetchUserSafetyData(
  userId: string,
): Promise<{ mutedListings?: string[]; blockedUsers?: string[] } | null> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  const data = userDoc.data();
  return { mutedListings: data.mutedListings, blockedUsers: data.blockedUsers };
}

/** Mute-on-report: permanently hide a listing from the reporter's own view. */
export async function muteListingForUser(userId: string, listingId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    mutedListings: arrayUnion(listingId),
  });
}

/** Adds a seller to the caller's blockedUsers array. */
export async function blockUser(userId: string, blockedUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    blockedUsers: arrayUnion(blockedUid),
  });
}
