// ═══════════════════════════════════════════════════════════════════════
// MARKETPLACE DATA ACCESS — every Firestore read/write used by
// pages/marketplace.tsx, moved here mechanically (Session 48). Payloads,
// field names and timestamp choices are byte-identical to what the page did
// inline (note: this page uses Timestamp.now(), NOT serverTimestamp(), for
// listing/comment createdAt — preserved as-is). APPROVED behavior change:
// the formerly-unbounded reads are now paginated — fetchListingsPage
// (24/page newest-first + cursor), fetchListingsForFilter (200-doc batch for
// active filter/search views) and fetchListingComments (newest 50 + cursor).
// The page keeps all state, filtering, sorting, toasts and UI logic. The shared report flow lives in
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
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { z } from 'zod';
import { db } from './firebase';
import { sendContentHiddenNotificationDoc } from './moderation';

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

/** Cursor type shared by paginated listing/comment fetchers. */
export type MarketplaceCursor = QueryDocumentSnapshot<DocumentData>;

/** Shared per-doc mapping: isHidden skip + zod observe-mode (never drops). */
function mapListingDocs(docs: QueryDocumentSnapshot<DocumentData>[]): MarketplaceItem[] {
  const items: MarketplaceItem[] = [];
  docs.forEach((d) => {
    const data = d.data();
    if (data.isHidden) return;
    observeListing({ id: d.id, ...data });
    items.push({ ...(data as Omit<MarketplaceItem, 'id'>), id: d.id });
  });
  return items;
}

/**
 * Paginated browse fetch (replaces the old unbounded fetchListings):
 * newest-first, 24/page by default, cursor-based Load More.
 *
 * ⚠️ orderBy('createdAt') EXCLUDES docs that are missing the createdAt field.
 * The only in-app write path (createListing below) always sets
 * `createdAt: Timestamp.now()`, so app-created docs are safe — but any legacy
 * or externally-seeded doc without createdAt will silently disappear from
 * browse results.
 *
 * `hasMore` is computed from the RAW snapshot length (before the isHidden
 * skip), so a page full of hidden docs still advances the cursor correctly.
 */
export async function fetchListingsPage(
  options: { pageSize?: number; cursor?: MarketplaceCursor | null } = {},
): Promise<{ items: MarketplaceItem[]; lastDoc: MarketplaceCursor | null; hasMore: boolean }> {
  const { pageSize = 24, cursor } = options;
  const q = query(
    collection(db, 'marketplaceListings'),
    orderBy('createdAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  );
  const snapshot = await getDocs(q);
  return {
    items: mapListingDocs(snapshot.docs),
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

/**
 * One-shot batch fetch for ACTIVE search/category/heritage filter views:
 * newest-first, capped at `maxDocs` (default 200). The page fetches this once
 * (cached) when any filter first activates — NOT per keystroke — and keeps
 * filtering client-side as before.
 */
export async function fetchListingsForFilter(maxDocs = 200): Promise<MarketplaceItem[]> {
  const q = query(
    collection(db, 'marketplaceListings'),
    orderBy('createdAt', 'desc'),
    limit(maxDocs),
  );
  const snapshot = await getDocs(q);
  return mapListingDocs(snapshot.docs);
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
 * Paginated comment fetch (replaces the old unbounded per-listing fetch):
 * newest-first, capped at 50/page, cursor-based "Load older". The batch is
 * returned NEWEST-FIRST — the page reverses it for ascending display.
 *
 * ⚠️ Notes: (1) `where(listingId ==) + orderBy(createdAt desc)` needs a
 * composite Firestore index (marketplaceComments: listingId ASC,
 * createdAt DESC). (2) orderBy excludes comments missing createdAt —
 * addListingComment below always sets Timestamp.now(), so only legacy /
 * externally-seeded comments are at risk.
 */
export async function fetchListingComments(
  listingId: string,
  options: { pageSize?: number; cursor?: MarketplaceCursor | null } = {},
): Promise<{ comments: MarketplaceComment[]; lastDoc: MarketplaceCursor | null; hasMore: boolean }> {
  const { pageSize = 50, cursor } = options;
  const q = query(
    collection(db, 'marketplaceComments'),
    where('listingId', '==', listingId),
    orderBy('createdAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  );
  const snapshot = await getDocs(q);
  return {
    comments: snapshot.docs.map((d) => ({
      ...(d.data() as Omit<MarketplaceComment, 'id'>),
      id: d.id,
    })),
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  };
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
  // Delegates to the shared moderation helper (Session 53 dedup).
  await sendContentHiddenNotificationDoc({ ...input });
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
