/**
 * Shared content-report mechanics (Session 47).
 *
 * feed.tsx and forum.tsx (and future modules) all follow the same flow when a
 * user reports content:
 *   1. append a record to the `reports` collection
 *   2. find-or-increment the crowdsourced `moderationQueue` entry keyed by
 *      contentId (increment reportCount + arrayUnion the reporter, or create
 *      the entry with reportCount 1)
 *   3. the CALLER decides what to do at the 3-strike threshold (auto-hide
 *      fields, notification payloads and target collections differ per module
 *      — deliberately NOT generalized here; parity rule).
 *
 * The payload shapes intentionally stay at the call site: feed tracks images
 * and reporter avatars, forum tracks thread/reply distinctions. This module
 * owns only the mechanics that were byte-identical in both pages.
 */
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/** Matches the reporter entries both pages already write (forum omits avatar). */
export interface ReporterEntry {
  uid: string;
  name: string;
  avatar?: string;
  category: string;
  details: string;
  createdAt: string; // ISO string — matches existing data
}

export interface SubmitReportParams {
  /** ID of the reported content (post/thread/reply/listing id). */
  contentId: string;
  /** Document appended to the `reports` collection, as the page built it. */
  reportDoc: Record<string, unknown>;
  /**
   * Document created in `moderationQueue` when no entry exists yet for this
   * contentId. `reportCount`, `reporters` and `createdAt` are added here —
   * don't include them.
   */
  modQueueDoc: Record<string, unknown>;
  /** Entry appended to the moderation entry's `reporters` array. */
  reporter: ReporterEntry;
}

/**
 * Runs the shared report flow. Returns the total report count after this
 * report, so callers can apply their module-specific 3-strike handling.
 * Throws on failure — callers already have try/catch + user feedback.
 */
export async function submitContentReport(params: SubmitReportParams): Promise<number> {
  const { contentId, reportDoc, modQueueDoc, reporter } = params;

  // 1. Record-keeping entry (stealth: author is not notified)
  await addDoc(collection(db, 'reports'), {
    ...reportDoc,
    createdAt: serverTimestamp(),
    status: 'pending',
  });

  // 2. Find-or-increment the crowdsourced moderationQueue entry
  const existing = await getDocs(
    query(collection(db, 'moderationQueue'), where('contentId', '==', contentId)),
  );

  if (existing.docs.length > 0) {
    const entry = existing.docs[0];
    const totalReportCount = ((entry.data().reportCount as number) || 1) + 1;
    await updateDoc(doc(db, 'moderationQueue', entry.id), {
      reportCount: totalReportCount,
      reporters: arrayUnion(reporter),
    });
    return totalReportCount;
  }

  await addDoc(collection(db, 'moderationQueue'), {
    ...modQueueDoc,
    reportCount: 1,
    reporters: [reporter],
    createdAt: serverTimestamp(),
  });
  return 1;
}

/**
 * Notifies a content author that their content was auto-hidden by the
 * 3-strike flow (Session 53 dedup — was implemented identically in
 * services/feed.ts, events.ts, housing.ts and marketplace.ts; those modules'
 * typed wrappers now delegate here). Adds `type: 'content_hidden'`,
 * `read: false` and `createdAt: serverTimestamp()` to the module payload.
 */
export async function sendContentHiddenNotificationDoc(
  payload: Record<string, unknown>,
): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    type: 'content_hidden',
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  });
}
