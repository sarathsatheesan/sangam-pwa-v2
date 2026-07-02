// ═══════════════════════════════════════════════════════════════════════
// EVENTS DATA ACCESS — every Firestore read/write used by pages/events.tsx,
// moved here mechanically (Session 48). Query shapes, payloads, field names
// and timestamp choices (Timestamp.now() vs serverTimestamp()) are
// byte-identical to what the page did inline. The page keeps all state,
// filtering, sorting, optimistic updates and UI logic.
//
// Conventions (mirrors services/feed.ts / services/forum.ts):
// - MECHANICAL MOVES ONLY — do not "improve" queries here without a
//   dedicated session.
// - Functions do NOT swallow errors; the page's try/catch + toast feedback
//   stays at the call site (strict parity — logging here would double-log).
// - subscribeX(args, onData, onError?) returns the unsubscribe function.
// - zod OBSERVE MODE: list/subscribe paths safeParse each event doc against
//   EventSchema. On failure we console.warn and ALWAYS keep the doc —
//   validation is observationally invisible (nothing dropped/transformed).
// ═══════════════════════════════════════════════════════════════════════

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
  limit,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import type { DocumentData, Unsubscribe, FirestoreError } from 'firebase/firestore';
import { z } from 'zod';
import { db } from './firebase';

/* ─── types ─── */

/** Mirrors the page's TicketTier interface (pages/events.tsx). */
export interface EventTicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  description?: string;
}

/** Raw event document as returned by the list fetch (page keeps its own default-filling mapping). */
export interface RawEventDoc {
  id: string;
  data: DocumentData;
}

/** Comment record as stored in events/{eventId}/comments (matches pages/events.tsx `EventComment`). */
export interface EventCommentRecord {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: any;
}

/** Attendee profile shape the page renders (mapped from users/{uid}). */
export interface AttendeeProfile {
  uid: string;
  name: string;
  avatar: string;
}

/* ─── zod schema (OBSERVE MODE) ───
 * Permissive on purpose: everything optional except id, .passthrough() for
 * extra Firestore fields (legacy docs carry city/state/zip/description etc.).
 * safeParse failures are logged with console.warn but the doc is ALWAYS
 * kept — items are never dropped or transformed. */

const firestoreTimestamp = z.any().optional();

export const EventSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    emoji: z.string().optional(),
    type: z.string().optional(),
    fullDate: z.string().optional(),
    time: z.string().optional(),
    endTime: z.string().optional(),
    location: z.string().optional(),
    locCity: z.string().optional(),
    locState: z.string().optional(),
    locZip: z.string().optional(),
    desc: z.string().optional(),
    ticket: z.string().optional(),
    price: z.string().optional(),
    organizer: z.string().optional(),
    promoted: z.boolean().optional(),
    count: z.number().optional(),
    posterId: z.string().optional(),
    posterName: z.string().optional(),
    createdAt: firestoreTimestamp,
    updatedAt: firestoreTimestamp,
    disabled: z.boolean().optional(),
    rsvpUsers: z.array(z.string()).optional(),
    status: z.string().optional(),
    capacity: z.number().optional(),
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    ticketTiers: z.array(z.any()).optional(),
    waitlistUsers: z.array(z.string()).optional(),
    waitlistEnabled: z.boolean().optional(),
    photos: z.array(z.string()).optional(),
    coverPhotoIndex: z.number().optional(),
    heritage: z.array(z.string()).optional(),
    isHidden: z.boolean().optional(),
    hiddenAt: z.string().optional(),
    hiddenReason: z.string().optional(),
  })
  .passthrough();

/** Observe-mode validation: warn on failure, never drop the doc. */
function observeEvent(id: string, data: DocumentData): void {
  const result = EventSchema.safeParse({ id, ...data });
  if (!result.success) {
    console.warn('[EventSchema] Event validation failed (doc kept):', id, result.error.issues);
  }
}

/* ─── event list ─── */

/**
 * Event list with the page's exact triple-fallback query strategy:
 *   1. where disabled == false, orderBy createdAt desc, limit 100
 *   2. on failure: where disabled == false            — UNBOUNDED (no limit — parity)
 *   3. on failure: the entire `events` collection     — UNBOUNDED (no limit — parity)
 * Returns raw docs — the page keeps its disabled/isHidden skipping,
 * default-filling mapping and promoted-first sort.
 */
export async function fetchEventDocs(): Promise<RawEventDoc[]> {
  let snapshot;
  try {
    const q = query(collection(db, 'events'), where('disabled', '==', false), orderBy('createdAt', 'desc'), limit(100));
    snapshot = await getDocs(q);
  } catch {
    try {
      const q = query(collection(db, 'events'), where('disabled', '==', false));
      snapshot = await getDocs(q);
    } catch {
      snapshot = await getDocs(collection(db, 'events'));
    }
  }
  return snapshot.docs.map((d) => {
    const data = d.data();
    observeEvent(d.id, data);
    return { id: d.id, data };
  });
}

/* ─── create / update / delete / status ─── */

/**
 * Event payload as the page builds it in handleCreateEvent. `createdAt` and
 * `updatedAt` (both Timestamp.now() — parity: this page never used
 * serverTimestamp() for these) are added HERE — don't include them.
 */
export interface CreateEventInput {
  title: string;
  emoji: string;
  type: string;
  month: string;
  day: string;
  fullDate: string;
  time: string;
  location: string;
  locState: string;
  locCity: string;
  locZip: string;
  desc: string;
  ticket: 'free' | 'ticketed';
  organizer: string;
  promoted: boolean;
  count: number;
  posterId: string;
  posterName: string;
  disabled: boolean;
  rsvpUsers: string[];
  status: string;
  contactEmail: string;
  contactPhone: string;
  waitlistEnabled: boolean;
  waitlistUsers: string[];
  /** Only present when the event has photos (parity: fields omitted otherwise). */
  photos?: string[];
  coverPhotoIndex?: number;
  /** Only present when the form set an end time (parity: field omitted otherwise). */
  endTime?: string;
  price?: string;
  /** Only present when the form set a capacity (parity: field omitted otherwise). */
  capacity?: number;
  /** Only present for tiered ticketing (parity: field omitted otherwise). */
  ticketTiers?: EventTicketTier[];
}

/** Creates an event; the service adds createdAt/updatedAt (Timestamp.now(), as before). */
export async function createEvent(eventData: CreateEventInput): Promise<string> {
  const ref = await addDoc(collection(db, 'events'), {
    ...eventData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

/**
 * Edit payload as the page builds it in handleSaveEdit. `updatedAt`
 * (Timestamp.now(), as before) is added HERE — don't include it.
 */
export interface UpdateEventInput {
  title: string;
  emoji: string;
  type: string;
  month: string;
  day: string;
  fullDate: string;
  time: string;
  location: string;
  locCity: string;
  locState: string;
  locZip: string;
  desc: string;
  ticket: 'free' | 'ticketed';
  contactEmail: string;
  contactPhone: string;
  waitlistEnabled: boolean;
  /** Only present when the form set an end time (parity: field omitted otherwise). */
  endTime?: string;
  price?: string;
  ticketTiers?: EventTicketTier[];
  /** Only present when the form set a capacity (parity: field omitted otherwise). */
  capacity?: number;
  photos?: string[];
  coverPhotoIndex?: number;
}

export async function updateEvent(eventId: string, updateData: UpdateEventInput): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), {
    ...updateData,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(db, 'events', eventId));
}

export async function updateEventStatus(eventId: string, newStatus: string): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), { status: newStatus });
}

/* ─── RSVP / waitlist ─── */

/** Remove the user's RSVP; newCount is computed by the page (Math.max(0, count - 1) — parity). */
export async function removeEventRsvp(eventId: string, userId: string, newCount: number): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), { rsvpUsers: arrayRemove(userId), count: newCount });
}

/** Add the user's RSVP; newCount is computed by the page (count + 1 — parity). */
export async function addEventRsvp(eventId: string, userId: string, newCount: number): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), { rsvpUsers: arrayUnion(userId), count: newCount });
}

export async function joinEventWaitlist(eventId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), { waitlistUsers: arrayUnion(userId) });
}

export async function leaveEventWaitlist(eventId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), { waitlistUsers: arrayRemove(userId) });
}

/* ─── comments (events/{eventId}/comments subcollection) ─── */

/**
 * Live subscription to ALL comments on an event. UNBOUNDED (no orderBy/limit
 * — parity). Maps each doc with the page's exact default-filling; the page
 * keeps its createdAt sort. Returns the unsubscribe function.
 */
export function subscribeToEventComments(
  eventId: string,
  onData: (comments: EventCommentRecord[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'events', eventId, 'comments'),
    (snapshot) => {
      const commentsList: EventCommentRecord[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        commentsList.push({
          id: d.id,
          text: data.text || '',
          userId: data.userId || '',
          userName: data.userName || 'Anonymous',
          userAvatar: data.userAvatar,
          createdAt: data.createdAt,
        });
      });
      onData(commentsList);
    },
    onError,
  );
}

export interface AddEventCommentInput {
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
}

/** Adds a comment; the service adds `createdAt: Timestamp.now()` (parity — not serverTimestamp()). */
export async function addEventComment(eventId: string, data: AddEventCommentInput): Promise<void> {
  await addDoc(collection(db, 'events', eventId, 'comments'), {
    ...data,
    createdAt: Timestamp.now(),
  });
}

/* ─── attendees ─── */

/**
 * Profiles for RSVP'd users (documentId-in query). The page passes at most 6
 * ids (it slices before calling — parity: the slice stays at the call site).
 */
export async function fetchAttendeeProfiles(userIds: string[]): Promise<AttendeeProfile[]> {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(query(usersRef, where('__name__', 'in', userIds)));
  const attendeesList: AttendeeProfile[] = [];
  snapshot.forEach((d) => {
    const data = d.data();
    attendeesList.push({
      uid: d.id,
      name: data.displayName || 'User',
      avatar: data.photoURL || '',
    });
  });
  return attendeesList;
}

/* ─── user safety data (mutedEvents / blockedUsers on users/{uid}) ─── */

/**
 * Reads the user's doc for safety data. Returns null when the doc doesn't
 * exist; otherwise the raw fields (page keeps its own truthiness checks).
 */
export async function fetchUserSafetyData(
  userId: string,
): Promise<{ mutedEvents?: string[]; blockedUsers?: string[] } | null> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  const data = userDoc.data();
  return { mutedEvents: data.mutedEvents, blockedUsers: data.blockedUsers };
}

/** Mute-on-report: permanently hide an event from the reporter's own view. */
export async function muteEventForUser(userId: string, eventId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    mutedEvents: arrayUnion(eventId),
  });
}

/** Adds a user to the caller's blockedUsers array. */
export async function blockUser(userId: string, blockedUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    blockedUsers: arrayUnion(blockedUid),
  });
}

/* ─── moderation writes (3-strike auto-hide, driven by the PAGE) ─── */

/**
 * Auto-hide an event that hit the report threshold. `hiddenAt` stays an ISO
 * string (parity — this field was never a serverTimestamp).
 */
export async function hideEvent(eventId: string, hiddenReason: string): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), {
    isHidden: true,
    hiddenAt: new Date().toISOString(),
    hiddenReason,
  });
}

export interface EventHiddenNotificationInput {
  recipientId: string;
  recipientName: string;
  /** Parity: the events page reuses the feed's `postId` field name for the event id. */
  postId: string;
  reason: string;
  message: string;
  actionUrl: string;
}

/**
 * Notifies an event owner their content was auto-hidden. The service adds
 * `type: 'content_hidden'`, `read: false` and `createdAt: serverTimestamp()`.
 */
export async function sendEventHiddenNotification(
  input: EventHiddenNotificationInput,
): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    type: 'content_hidden',
    ...input,
    read: false,
    createdAt: serverTimestamp(),
  });
}
