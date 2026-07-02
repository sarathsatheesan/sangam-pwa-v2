// ═══════════════════════════════════════════════════════════════════════
// FORUM DATA ACCESS — every Firestore read/write used by pages/forum.tsx,
// moved here mechanically (Session 48). Query shapes, payloads, field names
// and timestamp choices are byte-identical to what the page did inline.
// The page keeps all state, filtering, sorting and UI logic.
// ═══════════════════════════════════════════════════════════════════════

import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  increment,
  serverTimestamp,
  arrayUnion,
  getCountFromServer,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { z } from 'zod';
import { db } from './firebase';
import { FORUM_TOPICS } from '../constants/config';
import type { ForumTopic } from '../constants/config';

/* ─── types (moved verbatim from pages/forum.tsx) ─── */

export interface ForumThread {
  id: string;
  topicId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  heritage: string[];
  replyCount: number;
  lastReplyAt: any;
  likes: number;
  upvotes?: number;
  downvotes?: number;
  voteScore?: number;
  isPinned: boolean;
  isFlagged: boolean;
  isRemoved: boolean;
  createdAt: any;
  flair?: string;
  acceptedReplyId?: string;
}

export interface ForumReply {
  id: string;
  threadId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  heritage: string[];
  likes: number;
  upvotes?: number;
  downvotes?: number;
  voteScore?: number;
  isFlagged: boolean;
  isRemoved: boolean;
  createdAt: any;
  parentReplyId?: string;
  parentAuthorName?: string;
  depth?: number;
  isAccepted?: boolean;
}

/* ─── zod schemas (OBSERVE MODE) ───
 * Permissive on purpose: everything optional except id, .passthrough() for
 * extra Firestore fields. safeParse failures are logged with console.warn
 * but the doc is ALWAYS returned unchanged — items are never dropped. */

const firestoreTimestamp = z.any().optional();

export const ForumThreadSchema = z.object({
  id: z.string(),
  topicId: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
  authorAvatar: z.string().optional(),
  heritage: z.array(z.string()).optional(),
  replyCount: z.number().optional(),
  lastReplyAt: firestoreTimestamp,
  likes: z.number().optional(),
  upvotes: z.number().optional(),
  downvotes: z.number().optional(),
  voteScore: z.number().optional(),
  isPinned: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
  isRemoved: z.boolean().optional(),
  createdAt: firestoreTimestamp,
  flair: z.string().optional(),
  acceptedReplyId: z.string().optional(),
}).passthrough();

export const ForumReplySchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  content: z.string().optional(),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
  authorAvatar: z.string().optional(),
  heritage: z.array(z.string()).optional(),
  likes: z.number().optional(),
  upvotes: z.number().optional(),
  downvotes: z.number().optional(),
  voteScore: z.number().optional(),
  isFlagged: z.boolean().optional(),
  isRemoved: z.boolean().optional(),
  createdAt: firestoreTimestamp,
  parentReplyId: z.string().optional(),
  parentAuthorName: z.string().optional(),
  depth: z.number().optional(),
  isAccepted: z.boolean().optional(),
}).passthrough();

/** Observe-mode validation: warn on failure, never drop the doc. */
function observeThread(raw: { id: string } & DocumentData): void {
  const result = ForumThreadSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[ForumSchema] Thread validation failed (doc kept):', raw.id, result.error.issues);
  }
}

function observeReply(raw: { id: string } & DocumentData): void {
  const result = ForumReplySchema.safeParse(raw);
  if (!result.success) {
    console.warn('[ForumSchema] Reply validation failed (doc kept):', raw.id, result.error.issues);
  }
}

/* ─── topic counts ─── */

/**
 * Server-side aggregate thread counts per topic (Session 44) — replaces
 * downloading the entire forumThreads collection just to count.
 * `total - removed` preserves the old `!data.isRemoved` semantics for legacy
 * docs that lack the isRemoved field (a `== false` filter would skip them).
 * Equality-only queries need no composite index (index merging).
 *
 * Returns counts in the same order as FORUM_TOPICS.
 */
export async function getTopicThreadCounts(): Promise<number[]> {
  return Promise.all(
    FORUM_TOPICS.map(async (topic: ForumTopic) => {
      const base = query(collection(db, 'forumThreads'), where('topicId', '==', topic.id));
      const [totalSnap, removedSnap] = await Promise.all([
        getCountFromServer(base),
        getCountFromServer(query(base, where('isRemoved', '==', true))),
      ]);
      return totalSnap.data().count - removedSnap.data().count;
    }),
  );
}

/* ─── thread list / detail / create / delete ─── */

/**
 * Threads in a topic (max 50, as before). Raw docs — the page keeps its
 * isRemoved / blocked-user / flair / heritage filtering and sorting.
 */
export async function listThreadsByTopic(topicId: string): Promise<ForumThread[]> {
  const threadsQuery = query(
    collection(db, 'forumThreads'),
    where('topicId', '==', topicId),
    limit(50)
  );
  const snapshot = await getDocs(threadsQuery);
  return snapshot.docs.map((d) => {
    const raw = { id: d.id, ...d.data() };
    observeThread(raw);
    return raw as ForumThread;
  });
}

/**
 * Single thread fetch (deep-link from profile activity). Returns the raw
 * document data — the page keeps its own default-filling mapping.
 */
export async function getThreadById(
  threadId: string,
): Promise<{ id: string; data: DocumentData } | null> {
  const threadDoc = await getDoc(doc(db, 'forumThreads', threadId));
  if (!threadDoc.exists()) return null;
  return { id: threadDoc.id, data: threadDoc.data() };
}

export interface CreateThreadInput {
  topicId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  heritage: string[];
  isFlagged: boolean;
  flair: string;
}

/** Creates a forum thread with the exact payload the page used. Returns the new id. */
export async function createThread(input: CreateThreadInput): Promise<string> {
  const threadRef = await addDoc(collection(db, 'forumThreads'), {
    topicId: input.topicId,
    title: input.title,
    content: input.content,
    authorId: input.authorId,
    authorName: input.authorName,
    authorAvatar: input.authorAvatar,
    heritage: input.heritage,
    replyCount: 0,
    lastReplyAt: serverTimestamp(),
    likes: 0,
    upvotes: 0,
    downvotes: 0,
    voteScore: 0,
    isPinned: false,
    isFlagged: input.isFlagged,
    isRemoved: false,
    createdAt: serverTimestamp(),
    flair: input.flair,
  });
  return threadRef.id;
}

/** Soft-delete: same isRemoved flag write the page did. */
export async function softDeleteThread(threadId: string): Promise<void> {
  await updateDoc(doc(db, 'forumThreads', threadId), { isRemoved: true });
}

/* ─── replies ─── */

/**
 * Replies in a thread (max 100, as before). Raw docs — the page keeps its
 * isRemoved / blocked-user filtering and tree building.
 */
export async function listRepliesByThread(threadId: string): Promise<ForumReply[]> {
  const repliesQuery = query(
    collection(db, 'forumReplies'),
    where('threadId', '==', threadId),
    limit(100)
  );
  const snapshot = await getDocs(repliesQuery);
  return snapshot.docs.map((d) => {
    const raw = { id: d.id, ...d.data() };
    observeReply(raw);
    return raw as ForumReply;
  });
}

export interface CreateReplyInput {
  threadId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  heritage: string[];
  isFlagged: boolean;
  parentReplyId?: string;
  parentAuthorName?: string;
  depth: number;
}

/**
 * Creates a reply and bumps the parent thread (replyCount +1, lastReplyAt) —
 * same two sequential writes, same order, as the page did. Returns the reply id.
 */
export async function createReply(input: CreateReplyInput): Promise<string> {
  const replyRef = await addDoc(collection(db, 'forumReplies'), {
    threadId: input.threadId,
    content: input.content,
    authorId: input.authorId,
    authorName: input.authorName,
    authorAvatar: input.authorAvatar,
    heritage: input.heritage,
    likes: 0,
    upvotes: 0,
    downvotes: 0,
    voteScore: 0,
    isFlagged: input.isFlagged,
    isRemoved: false,
    createdAt: serverTimestamp(),
    parentReplyId: input.parentReplyId,
    parentAuthorName: input.parentAuthorName,
    depth: input.depth,
  });
  const threadRef = doc(db, 'forumThreads', input.threadId);
  await updateDoc(threadRef, { replyCount: increment(1), lastReplyAt: serverTimestamp() });
  return replyRef.id;
}

/**
 * Soft-delete a reply; when threadId is provided, also decrements the
 * thread's replyCount (exactly the conditional the page had).
 */
export async function softDeleteReply(replyId: string, threadId?: string): Promise<void> {
  await updateDoc(doc(db, 'forumReplies', replyId), { isRemoved: true });
  if (threadId) await updateDoc(doc(db, 'forumThreads', threadId), { replyCount: increment(-1) });
}

/* ─── accepted answer (question threads) ─── */

/** Unmarks the previous accepted reply (if any), marks the new one, updates the thread — same order. */
export async function acceptReply(
  threadId: string,
  replyId: string,
  previousAcceptedReplyId?: string,
): Promise<void> {
  const threadRef = doc(db, 'forumThreads', threadId);
  const replyRef = doc(db, 'forumReplies', replyId);

  if (previousAcceptedReplyId) {
    const prevReplyRef = doc(db, 'forumReplies', previousAcceptedReplyId);
    await updateDoc(prevReplyRef, { isAccepted: false });
  }

  await updateDoc(replyRef, { isAccepted: true });
  await updateDoc(threadRef, { acceptedReplyId: replyId });
}

export async function unacceptReply(threadId: string, replyId: string): Promise<void> {
  const threadRef = doc(db, 'forumThreads', threadId);
  const replyRef = doc(db, 'forumReplies', replyId);

  await updateDoc(replyRef, { isAccepted: false });
  await updateDoc(threadRef, { acceptedReplyId: undefined });
}

/* ─── votes (forumLikes subcollections) ─── */

export interface VoteSyncResult {
  /** Current user's surviving vote ('up' | 'down') or null. */
  voteType: string | null;
  /** Recomputed absolute score after dedupe (written back to the doc). */
  correctScore: number;
}

/**
 * Reads ALL vote docs in a thread's forumLikes subcollection, dedupes per
 * user (keeps the deterministic doc id === userId, deletes the rest, migrates
 * the current user's vote if needed), writes the corrected absolute score
 * back to the thread, and returns the current user's vote + corrected score.
 * Moved verbatim from the page's loadThreadVotes inner loop.
 */
export async function syncThreadVoteState(
  threadId: string,
  currentUserId: string,
): Promise<VoteSyncResult> {
  const threadDocRef = doc(db, 'forumThreads', threadId);
  const likesCollRef = collection(threadDocRef, 'forumLikes');

  // Read ALL vote docs in this thread's subcollection
  const allVotes = await getDocs(likesCollRef);
  let foundVoteType: string | null = null;
  const toDelete: Promise<void>[] = [];
  let correctScore = 0;

  // Group by userId to find duplicates
  const userVoteMap = new Map<string, { docId: string; voteType: string; ref: any }[]>();
  allVotes.docs.forEach((d) => {
    const data = d.data();
    const uid = data.userId;
    if (!uid) { toDelete.push(deleteDoc(d.ref)); return; } // orphan doc
    const arr = userVoteMap.get(uid) || [];
    arr.push({ docId: d.id, voteType: data.voteType, ref: d.ref });
    userVoteMap.set(uid, arr);
  });

  // For each user, keep only the deterministic doc (id === userId), delete the rest
  userVoteMap.forEach((docs, uid) => {
    let kept: { voteType: string } | null = null;
    // Prefer the deterministic doc
    const detDoc = docs.find((d) => d.docId === uid);
    if (detDoc) {
      kept = detDoc;
      // Delete all non-deterministic docs for this user
      docs.forEach((d) => { if (d.docId !== uid) toDelete.push(deleteDoc(d.ref)); });
    } else {
      // No deterministic doc — keep the first, delete the rest, migrate
      kept = docs[0];
      docs.slice(1).forEach((d) => toDelete.push(deleteDoc(d.ref)));
    }

    if (kept) {
      if (kept.voteType === 'up') correctScore++;
      else if (kept.voteType === 'down') correctScore--;
    }

    // Track current user's vote
    if (uid === currentUserId && kept) {
      foundVoteType = kept.voteType;
    }
  });

  // Execute all deletions
  if (toDelete.length > 0) await Promise.all(toDelete);

  // Migrate current user's vote to deterministic doc if needed
  if (foundVoteType && !allVotes.docs.some((d) => d.id === currentUserId)) {
    await setDoc(doc(likesCollRef, currentUserId), { userId: currentUserId, voteType: foundVoteType, createdAt: serverTimestamp() });
  }

  // Fix the thread's score to the correct absolute value
  await updateDoc(threadDocRef, { voteScore: correctScore, likes: correctScore });

  return { voteType: foundVoteType, correctScore };
}

/** Reply counterpart of syncThreadVoteState — moved verbatim from loadReplyVotes. */
export async function syncReplyVoteState(
  replyId: string,
  currentUserId: string,
): Promise<VoteSyncResult> {
  const replyDocRef = doc(db, 'forumReplies', replyId);
  const likesCollRef = collection(replyDocRef, 'forumLikes');

  const allVotes = await getDocs(likesCollRef);
  let foundVoteType: string | null = null;
  const toDelete: Promise<void>[] = [];
  let correctScore = 0;

  const userVoteMap = new Map<string, { docId: string; voteType: string; ref: any }[]>();
  allVotes.docs.forEach((d) => {
    const data = d.data();
    const uid = data.userId;
    if (!uid) { toDelete.push(deleteDoc(d.ref)); return; }
    const arr = userVoteMap.get(uid) || [];
    arr.push({ docId: d.id, voteType: data.voteType, ref: d.ref });
    userVoteMap.set(uid, arr);
  });

  userVoteMap.forEach((docs, uid) => {
    let kept: { voteType: string } | null = null;
    const detDoc = docs.find((d) => d.docId === uid);
    if (detDoc) {
      kept = detDoc;
      docs.forEach((d) => { if (d.docId !== uid) toDelete.push(deleteDoc(d.ref)); });
    } else {
      kept = docs[0];
      docs.slice(1).forEach((d) => toDelete.push(deleteDoc(d.ref)));
    }

    if (kept) {
      if (kept.voteType === 'up') correctScore++;
      else if (kept.voteType === 'down') correctScore--;
    }

    if (uid === currentUserId && kept) {
      foundVoteType = kept.voteType;
    }
  });

  if (toDelete.length > 0) await Promise.all(toDelete);

  if (foundVoteType && !allVotes.docs.some((d) => d.id === currentUserId)) {
    await setDoc(doc(likesCollRef, currentUserId), { userId: currentUserId, voteType: foundVoteType, createdAt: serverTimestamp() });
  }

  await updateDoc(replyDocRef, { voteScore: correctScore, likes: correctScore });

  return { voteType: foundVoteType, correctScore };
}

/**
 * Persists a thread vote after the page's optimistic UI update: cleans up
 * old random-ID vote docs for this user, writes/deletes the deterministic
 * vote doc, then atomically increments the thread score by scoreDelta.
 */
export async function persistThreadVote(
  threadId: string,
  userId: string,
  voteType: 'up' | 'down',
  isToggleOff: boolean,
  scoreDelta: number,
): Promise<void> {
  const threadRef = doc(db, 'forumThreads', threadId);
  const likesCollRef = collection(threadRef, 'forumLikes');
  const voteDocRef = doc(likesCollRef, userId);

  // Clean up old random-ID vote docs
  const oldVotes = await getDocs(query(likesCollRef, where('userId', '==', userId)));
  const toDelete: Promise<void>[] = [];
  oldVotes.docs.forEach((d) => { if (d.id !== userId) toDelete.push(deleteDoc(d.ref)); });
  if (toDelete.length > 0) await Promise.all(toDelete);

  // Write or delete the vote doc
  if (isToggleOff) {
    await deleteDoc(voteDocRef);
  } else {
    await setDoc(voteDocRef, { userId, voteType, createdAt: serverTimestamp() });
  }

  // Update thread score using increment (atomic, no read needed)
  await updateDoc(threadRef, { voteScore: increment(scoreDelta), likes: increment(scoreDelta) });
}

/** Reply counterpart of persistThreadVote. */
export async function persistReplyVote(
  replyId: string,
  userId: string,
  voteType: 'up' | 'down',
  isToggleOff: boolean,
  scoreDelta: number,
): Promise<void> {
  const replyRef = doc(db, 'forumReplies', replyId);
  const likesCollRef = collection(replyRef, 'forumLikes');
  const voteDocRef = doc(likesCollRef, userId);

  // Clean up old random-ID vote docs
  const oldVotes = await getDocs(query(likesCollRef, where('userId', '==', userId)));
  const toDelete: Promise<void>[] = [];
  oldVotes.docs.forEach((d) => { if (d.id !== userId) toDelete.push(deleteDoc(d.ref)); });
  if (toDelete.length > 0) await Promise.all(toDelete);

  // Write or delete the vote doc
  if (isToggleOff) {
    await deleteDoc(voteDocRef);
  } else {
    await setDoc(voteDocRef, { userId, voteType, createdAt: serverTimestamp() });
  }

  // Update reply score using increment (atomic)
  await updateDoc(replyRef, { voteScore: increment(scoreDelta), likes: increment(scoreDelta) });
}

/* ─── moderation / users ─── */

/**
 * Appends an entry to the moderationQueue (used by the content-filter path
 * on thread/reply creation). Adds createdAt: serverTimestamp() — pass every
 * other field (including status) exactly as before.
 */
export async function addToModerationQueue(entry: Record<string, unknown>): Promise<void> {
  await addDoc(collection(db, 'moderationQueue'), {
    ...entry,
    createdAt: serverTimestamp(),
  });
}

/** Returns the user's blockedUsers array, or null when missing/empty — the page only overwrites state on a non-null result. */
export async function getBlockedUserIds(userId: string): Promise<string[] | null> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (userDoc.exists()) {
    const data = userDoc.data();
    if (data.blockedUsers) return data.blockedUsers;
  }
  return null;
}

/** arrayUnion the blocked uid onto the current user's blockedUsers. */
export async function blockUser(currentUserId: string, blockedUserId: string): Promise<void> {
  await updateDoc(doc(db, 'users', currentUserId), {
    blockedUsers: arrayUnion(blockedUserId),
  });
}
