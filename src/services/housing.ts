// ═══════════════════════════════════════════════════════════════════════
// HOUSING DATA ACCESS — every Firestore read/write used by pages/housing.tsx,
// moved here mechanically (Session 48). Query shapes, payloads, field names
// and timestamp choices (Timestamp.now() vs serverTimestamp()) are
// byte-identical to what the page did inline. The page keeps all state,
// filtering, sorting and UI logic.
//
// Conventions (mirrors services/feed.ts / services/forum.ts):
// - MECHANICAL MOVES ONLY: no query "improvements" without a dedicated session.
// - Error handling: functions do NOT swallow errors. The page's existing
//   try/catch + toast/console feedback stays at the call site.
// - zod OBSERVE MODE: list paths safeParse listing docs against
//   HousingListingSchema. On failure we console.warn and STILL return the doc
//   exactly as before — no doc is ever dropped or transformed by validation.
// - The shared report flow lives in services/moderation.submitContentReport;
//   the housing-specific 3-strike tail (hideListing +
//   sendListingHiddenNotification + muteListingForUser) is driven by the PAGE.
// ═══════════════════════════════════════════════════════════════════════

import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  Timestamp,
  increment,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { z } from 'zod';
import { db } from './firebase';

const LISTINGS_COL = 'listings';
const COMMENTS_SUB = 'comments';

/* ─── types (moved verbatim from pages/housing.tsx) ─── */

export interface HousingListing {
  id: string;
  title: string;
  type: 'rent' | 'sale' | 'roommate' | 'sublet';
  price: string;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  locCity: string;
  locState: string;
  locZip: string;
  desc: string;
  tags: string[];
  featured: boolean;
  emoji: string;
  bgColor: string;
  posterName: string;
  posterAvatar: string;
  posterId: string;
  createdAt: any;
  heritage?: string | string[];
  contactPhone?: string;
  contactEmail?: string;
  availableDate?: string;
  petPolicy?: string;
  parking?: string;
  photos?: string[];
  coverPhotoIndex?: number;
  videoUrl?: string;
  yearBuilt?: string;
  lotSize?: string;
  propertyType?: string;
  heating?: string;
  cooling?: string;
  laundry?: string;
  hoa?: string;
  status?: 'active' | 'pending' | 'under_contract' | 'sold' | 'rented';
  walkScore?: number;
  transitScore?: number;
  neighborhoodHighlights?: string[];
  viewCount?: number;
  saveCount?: number;
  isHidden?: boolean;
  hiddenAt?: string;
  hiddenReason?: string;
}

export interface HousingComment {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  likes: number;
  likedBy: string[];
  createdAt: any;
}

/* ─── zod schema (OBSERVE MODE) ───
 * Permissive on purpose: everything optional except id, .passthrough() for
 * extra Firestore fields. safeParse failures are logged with console.warn
 * but the doc is ALWAYS returned unchanged — items are never dropped. */

const firestoreTimestamp = z.any().optional();

export const HousingListingSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  type: z.string().optional(),
  price: z.string().optional(),
  beds: z.number().optional(),
  baths: z.number().optional(),
  sqft: z.number().optional(),
  address: z.string().optional(),
  locCity: z.string().optional(),
  locState: z.string().optional(),
  locZip: z.string().optional(),
  desc: z.string().optional(),
  tags: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  emoji: z.string().optional(),
  bgColor: z.string().optional(),
  posterName: z.string().optional(),
  posterAvatar: z.string().optional(),
  posterId: z.string().optional(),
  createdAt: firestoreTimestamp,
  heritage: z.union([z.string(), z.array(z.string())]).optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  availableDate: z.string().optional(),
  petPolicy: z.string().optional(),
  parking: z.string().optional(),
  photos: z.array(z.string()).optional(),
  coverPhotoIndex: z.number().optional(),
  videoUrl: z.string().optional(),
  yearBuilt: z.string().optional(),
  lotSize: z.string().optional(),
  propertyType: z.string().optional(),
  heating: z.string().optional(),
  cooling: z.string().optional(),
  laundry: z.string().optional(),
  hoa: z.string().optional(),
  status: z.string().optional(),
  walkScore: z.number().optional(),
  transitScore: z.number().optional(),
  neighborhoodHighlights: z.array(z.string()).optional(),
  viewCount: z.number().optional(),
  saveCount: z.number().optional(),
  isHidden: z.boolean().optional(),
  hiddenAt: z.string().optional(),
  hiddenReason: z.string().optional(),
}).passthrough();

/** Observe-mode validation: warn on failure, never drop the doc. */
function observeListing(raw: { id: string } & DocumentData): void {
  const result = HousingListingSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[HousingSchema] Listing validation failed (doc kept):', raw.id, result.error.issues);
  }
}

/* ─── listings: list / create / update / delete ─── */

/**
 * All listings, mapped with the page's exact default-filling and isHidden
 * skip.
 *
 * UNBOUNDED QUERY (flagged Session 48): downloads the ENTIRE `listings`
 * collection — no limit(), no orderBy(), no where(). Exactly what the page
 * did (all filtering/sorting is client-side). Left as-is per the parity rule;
 * needs a dedicated pagination session.
 */
export async function listAllListings(): Promise<HousingListing[]> {
  const snapshot = await getDocs(collection(db, LISTINGS_COL));
  const data: HousingListing[] = snapshot.docs
    .map((d) => {
      const data = d.data();
      if (data.isHidden) return null;
      observeListing({ id: d.id, ...data });
      return {
        id: d.id,
        title: data.title || '',
        type: data.type || 'rent',
        price: data.price || '',
        beds: data.beds || 0,
        baths: data.baths || 0,
        sqft: data.sqft || 0,
        address: data.address || '',
        locCity: data.locCity || data.city || '',
        locState: data.locState || data.state || '',
        locZip: data.locZip || data.zip || '',
        desc: data.desc || '',
        tags: data.tags || [],
        featured: data.featured || false,
        emoji: data.emoji || '🏠',
        bgColor: data.bgColor || '#F5F5F5',
        posterName: data.posterName || 'Anonymous',
        posterAvatar: data.posterAvatar || '',
        posterId: data.posterId || '',
        createdAt: data.createdAt,
        heritage: data.heritage,
        contactPhone: data.contactPhone || '',
        contactEmail: data.contactEmail || '',
        availableDate: data.availableDate || '',
        petPolicy: data.petPolicy || '',
        parking: data.parking || '',
        photos: data.photos || [],
        coverPhotoIndex: data.coverPhotoIndex || 0,
        videoUrl: data.videoUrl || '',
        yearBuilt: data.yearBuilt || '',
        lotSize: data.lotSize || '',
        propertyType: data.propertyType || '',
        heating: data.heating || '',
        cooling: data.cooling || '',
        laundry: data.laundry || '',
        hoa: data.hoa || '',
        status: data.status || 'active',
        walkScore: data.walkScore,
        transitScore: data.transitScore,
        neighborhoodHighlights: data.neighborhoodHighlights || [],
        viewCount: data.viewCount || 0,
        saveCount: data.saveCount || 0,
      };
    })
    .filter(Boolean) as HousingListing[];
  return data;
}

export interface CreateListingInput {
  title: string;
  type: string;
  price: string;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  locCity: string;
  locState: string;
  locZip: string;
  desc: string;
  tags: string[];
  posterName: string;
  posterAvatar: string;
  posterId: string;
  heritage: string[];
  contactPhone: string;
  contactEmail: string;
  availableDate: string;
  petPolicy: string;
  parking: string;
  photos: string[];
  coverPhotoIndex: number;
  videoUrl: string;
  propertyType: string;
  yearBuilt: string;
  lotSize: string;
  heating: string;
  cooling: string;
  laundry: string;
  hoa: string;
  status: string;
}

/**
 * Creates a listing with the exact payload the page used: the constants
 * (featured false, emoji/bgColor defaults, viewCount/saveCount 0) and
 * `createdAt: Timestamp.now()` (NOT serverTimestamp — parity) are added here.
 */
export async function createListing(input: CreateListingInput): Promise<void> {
  await addDoc(collection(db, LISTINGS_COL), {
    title: input.title,
    type: input.type,
    price: input.price,
    beds: input.beds,
    baths: input.baths,
    sqft: input.sqft,
    address: input.address,
    locCity: input.locCity,
    locState: input.locState,
    locZip: input.locZip,
    desc: input.desc,
    tags: input.tags,
    featured: false,
    emoji: '🏠',
    bgColor: '#F5F5F5',
    posterName: input.posterName,
    posterAvatar: input.posterAvatar,
    posterId: input.posterId,
    createdAt: Timestamp.now(),
    heritage: input.heritage,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail,
    availableDate: input.availableDate,
    petPolicy: input.petPolicy,
    parking: input.parking,
    photos: input.photos,
    coverPhotoIndex: input.coverPhotoIndex,
    videoUrl: input.videoUrl,
    propertyType: input.propertyType,
    yearBuilt: input.yearBuilt,
    lotSize: input.lotSize,
    heating: input.heating,
    cooling: input.cooling,
    laundry: input.laundry,
    hoa: input.hoa,
    status: input.status,
    viewCount: 0,
    saveCount: 0,
  });
}

export interface UpdateListingInput {
  title: string;
  type: string;
  price: string;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  locCity: string;
  locState: string;
  locZip: string;
  desc: string;
  tags: string[];
  contactPhone: string;
  contactEmail: string;
  availableDate: string;
  petPolicy: string;
  parking: string;
  photos: string[];
  coverPhotoIndex: number;
  videoUrl: string;
  propertyType: string;
  yearBuilt: string;
  lotSize: string;
  heating: string;
  cooling: string;
  laundry: string;
  hoa: string;
}

/** Edit save — identical field set the page wrote (no status/scores here — parity). */
export async function updateListing(listingId: string, updates: UpdateListingInput): Promise<void> {
  await updateDoc(doc(db, LISTINGS_COL, listingId), { ...updates });
}

export async function deleteListing(listingId: string): Promise<void> {
  await deleteDoc(doc(db, LISTINGS_COL, listingId));
}

/* ─── listing counters ─── */

/** viewCount +1 (detail open / eye button). Callers fire-and-forget, as before. */
export async function incrementListingViewCount(listingId: string): Promise<void> {
  await updateDoc(doc(db, LISTINGS_COL, listingId), { viewCount: increment(1) });
}

/** saveCount ±1 — optimistic counter next to the savedItems service toggle. */
export async function adjustListingSaveCount(listingId: string, delta: number): Promise<void> {
  await updateDoc(doc(db, LISTINGS_COL, listingId), { saveCount: increment(delta) });
}

/* ─── comments (listings/{id}/comments subcollection) ─── */

/**
 * All comments on a listing, with the page's exact defaults.
 *
 * UNBOUNDED QUERY (flagged Session 48): full subcollection read, no limit()
 * and no orderBy() (display order relies on Firestore's default doc-id
 * ordering, as before). Left as-is per the parity rule.
 */
export async function listListingComments(listingId: string): Promise<HousingComment[]> {
  const snapshot = await getDocs(collection(db, LISTINGS_COL, listingId, COMMENTS_SUB));
  return snapshot.docs.map((d) => {
    const d_data = d.data();
    return {
      id: d.id,
      listingId: d_data.listingId,
      userId: d_data.userId,
      userName: d_data.userName,
      userAvatar: d_data.userAvatar,
      text: d_data.text,
      likes: d_data.likes || 0,
      likedBy: d_data.likedBy || [],
      createdAt: d_data.createdAt,
    };
  });
}

export interface AddListingCommentInput {
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
}

/**
 * Adds a comment; the service adds the `listingId` field, `likes: 0`,
 * `likedBy: []` and `createdAt: Timestamp.now()` (NOT serverTimestamp — parity).
 */
export async function addListingComment(
  listingId: string,
  input: AddListingCommentInput,
): Promise<void> {
  await addDoc(collection(db, LISTINGS_COL, listingId, COMMENTS_SUB), {
    listingId,
    userId: input.userId,
    userName: input.userName,
    userAvatar: input.userAvatar,
    text: input.text,
    likes: 0,
    likedBy: [],
    createdAt: Timestamp.now(),
  });
}

/**
 * Persists a comment like toggle AFTER the page's optimistic update: writes
 * the full recomputed likedBy array + its length (NOT increment/arrayUnion —
 * parity with the page's last-write-wins approach).
 */
export async function setListingCommentLikes(
  listingId: string,
  commentId: string,
  likes: number,
  likedBy: string[],
): Promise<void> {
  await updateDoc(doc(db, LISTINGS_COL, listingId, COMMENTS_SUB, commentId), {
    likes,
    likedBy,
  });
}

export async function deleteListingComment(listingId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, LISTINGS_COL, listingId, COMMENTS_SUB, commentId));
}

/* ─── user safety data (users/{uid}) ─── */

/**
 * Reads the user's doc for housing safety data. Returns null when the doc
 * doesn't exist; otherwise the raw fields (page keeps its truthiness checks).
 */
export async function getUserHousingSafetyData(
  userId: string,
): Promise<{ mutedHousingListings?: string[]; blockedUsers?: string[] } | null> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  const data = userDoc.data();
  return { mutedHousingListings: data.mutedHousingListings, blockedUsers: data.blockedUsers };
}

/** Mute-on-report: permanently hide a listing from the reporter's own view. */
export async function muteListingForUser(userId: string, listingId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    mutedHousingListings: arrayUnion(listingId),
  });
}

/** arrayUnion the blocked uid onto the current user's blockedUsers. */
export async function blockUser(currentUserId: string, blockedUserId: string): Promise<void> {
  await updateDoc(doc(db, 'users', currentUserId), {
    blockedUsers: arrayUnion(blockedUserId),
  });
}

/* ─── moderation writes (3-strike auto-hide, driven by the PAGE) ─── */

/**
 * Auto-hide a listing that hit the report threshold. `hiddenAt` stays an ISO
 * string (parity — this field was never a serverTimestamp).
 */
export async function hideListing(listingId: string, hiddenReason: string): Promise<void> {
  await updateDoc(doc(db, LISTINGS_COL, listingId), {
    isHidden: true,
    hiddenAt: new Date().toISOString(),
    hiddenReason,
  });
}

export interface ListingHiddenNotificationInput {
  recipientId: string;
  recipientName: string;
  /** Kept as `postId` in the notification doc — parity with existing data. */
  postId: string;
  reason: string;
  message: string;
  actionUrl: string;
}

/**
 * Notifies a listing owner their content was auto-hidden. The service adds
 * `type: 'content_hidden'`, `read: false` and `createdAt: serverTimestamp()`.
 */
export async function sendListingHiddenNotification(
  input: ListingHiddenNotificationInput,
): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    type: 'content_hidden',
    recipientId: input.recipientId,
    recipientName: input.recipientName,
    postId: input.postId,
    reason: input.reason,
    message: input.message,
    actionUrl: input.actionUrl,
    read: false,
    createdAt: serverTimestamp(),
  });
}
