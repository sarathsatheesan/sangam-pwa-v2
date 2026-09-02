/**
 * Shared content-report mechanics (Session 47).
 *
 * feed.tsx and forum.tsx (and future modules) all follow the same flow when a
 * user reports content:
 *   1. append a record to the `reports` collection
 *   2. blind-upsert the crowdsourced `moderationQueue` entry keyed by
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
  addDoc,
  doc,
  arrayUnion,
  serverTimestamp,
  setDoc,
  increment,
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
 * Runs the shared report flow. The 3-strike escalation (auto-hide + author
 * notification) runs server-side in the onModerationQueueWritten Cloud
 * Function. Throws on failure — callers already have try/catch + feedback.
 */
export async function submitContentReport(params: SubmitReportParams): Promise<void> {
  const { contentId, reportDoc, modQueueDoc, reporter } = params;

  // 1. Record-keeping entry (stealth: author is not notified)
  await addDoc(collection(db, 'reports'), {
    ...reportDoc,
    createdAt: serverTimestamp(),
    status: 'pending',
  });

  // 2. SECURITY (H-05, 2026-09-02): the queue is write-only for members —
  // reads are admin-only, so the old find-or-increment (query + update) is a
  // blind upsert keyed by contentId. reportCount uses a server-side increment,
  // and the 3-strike escalation now runs in the onModerationQueueWritten
  // Cloud Function.
  await setDoc(doc(db, 'moderationQueue', contentId), {
    ...modQueueDoc,
    contentId,
    reportCount: increment(1),
    reporters: arrayUnion(reporter),
    lastReportedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
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
