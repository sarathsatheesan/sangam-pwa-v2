// ═══════════════════════════════════════════════════════════════════════
// FEED — Firestore data access for pages/feed.tsx (Session 47 extraction)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Conventions (mirrors services/catering/cateringOrders.ts header, H7):
 * - MECHANICAL MOVES ONLY: every function issues the IDENTICAL query/payload
 *   the page issued before extraction — same collections, same where/orderBy
 *   clauses, same field names, same serverTimestamp()/ISO-string choices.
 *   Do NOT "improve" queries here without a dedicated session.
 * - Error handling: functions do NOT swallow errors. The page's existing
 *   try/catch + toast/console feedback stays at the call site (strict parity —
 *   adding logging here would double-log).
 * - Subscriptions: subscribeX(args, onData, onError?) returns the unsubscribe
 *   function; the page calls them from the same useEffects with the same
 *   cleanup as before.
 * - zod OBSERVE MODE: list/subscribe paths safeParse each post doc against
 *   FeedPostSchema. On failure we console.warn and STILL include the item
 *   exactly as before (cast). Validation is observationally invisible to
 *   users — no doc is ever dropped or transformed.
 */

import {
  collection,
  query,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  limit,
  startAfter,
  where,
  type Unsubscribe,
  type QueryDocumentSnapshot,
  type DocumentData,
  type FirestoreError,
} from 'firebase/firestore';
import { z } from 'zod';
import { db } from './firebase';
import { sendContentHiddenNotificationDoc } from './moderation';

const POSTS_COL = 'posts';
const COMMENTS_SUB = 'comments';

// ── Types ──

/** Post record as the feed page reads/writes it (matches pages/feed.tsx `Post`). */
export interface FeedPostRecord {
  id: string;
  content: string;
  type: 'community' | 'professional' | 'event';
  userId: string;
  userName: string;
  userAvatar: string;
  likes: number;
  comments: number;
  createdAt: any;
  heritage?: string | string[];
  reported?: boolean;
  reactions?: { [emoji: string]: string[] };
  reactionCount?: number;
  feeling?: { emoji: string; label: string };
  images?: string[];
}

/** Comment record as stored in posts/{postId}/comments (matches pages/feed.tsx `Comment`). */
export interface FeedCommentRecord {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
  createdAt: any;
  likes?: number;
  likedBy?: string[];
  image?: string;
}

/** content_hidden notification record from the `notifications` collection. */
export interface ModerationNotificationRecord {
  id: string;
  message: string;
  reason: string;
  postId: string;
  createdAt: any;
  read: boolean;
  [key: string]: any;
}

/** Result shape for the paginated post list/subscription paths. */
export interface PostsPageResult {
  /** Non-hidden posts, in query order (isHidden docs skipped — parity with the page). */
  posts: FeedPostRecord[];
  /** Raw last doc of the snapshot (INCLUDING hidden docs) — cursor for startAfter. */
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  /** Raw snapshot doc count (INCLUDING hidden docs) — drives the hasMore check. */
  fetchedCount: number;
}

// ── zod OBSERVE MODE schema ──

/**
 * Permissive schema: all fields optional except id, passthrough for unknown
 * fields. Used ONLY to log drift via console.warn — never to drop/transform.
 */
export const FeedPostSchema = z
  .object({
    id: z.string(),
    content: z.string().optional(),
    type: z.string().optional(),
    userId: z.string().optional(),
    userName: z.string().optional(),
    userAvatar: z.string().optional(),
    likes: z.number().optional(),
    comments: z.number().optional(),
    createdAt: z.any().optional(),
    heritage: z.union([z.string(), z.array(z.string())]).optional(),
    reported: z.boolean().optional(),
    reactions: z.record(z.string(), z.array(z.string())).optional(),
    reactionCount: z.number().optional(),
    feeling: z.object({ emoji: z.string(), label: z.string() }).nullable().optional(),
    images: z.array(z.string()).optional(),
    isHidden: z.boolean().optional(),
  })
  .passthrough();

/** Observe-only validation: warn on drift, never block. */
function observePostValidation(id: string, data: DocumentData): void {
  const result = FeedPostSchema.safeParse({ id, ...data });
  if (!result.success) {
    console.warn('[feed] doc failed validation', id, result.error.issues);
  }
}

/** Shared snapshot → PostsPageResult mapping (identical to the page's old loop). */
function mapPostsSnapshot(snapshot: { docs: QueryDocumentSnapshot<DocumentData>[]; forEach: (cb: (d: QueryDocumentSnapshot<DocumentData>) => void) => void }): PostsPageResult {
  const posts: FeedPostRecord[] = [];
  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    if (data.isHidden) return; // Skip hidden posts
    observePostValidation(docSnapshot.id, data);
    posts.push({ id: docSnapshot.id, ...data } as FeedPostRecord);
  });
  return {
    posts,
    lastVisible: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    fetchedCount: snapshot.docs.length,
  };
}

// ── Post loading / pagination ──

/**
 * Live subscription to the first page of posts
 * (orderBy createdAt desc, limit pageSize). Returns the unsubscribe function.
 */
export function subscribeToPosts(
  pageSize: number,
  onData: (result: PostsPageResult) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const q = query(collection(db, POSTS_COL), orderBy('createdAt', 'desc'), limit(pageSize));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(mapPostsSnapshot(snapshot));
    },
    onError,
  );
}

/** Next page of posts after the given cursor (orderBy createdAt desc, startAfter, limit). */
export async function fetchMorePosts(
  lastDoc: QueryDocumentSnapshot<DocumentData>,
  pageSize: number,
): Promise<PostsPageResult> {
  const q = query(
    collection(db, POSTS_COL),
    orderBy('createdAt', 'desc'),
    startAfter(lastDoc),
    limit(pageSize),
  );
  const snapshot = await getDocs(q);
  return mapPostsSnapshot(snapshot);
}

// ── Post create / update / delete ──

export interface CreatePostInput {
  content: string;
  type: 'community' | 'professional' | 'event';
  userId: string;
  userName: string;
  userAvatar: string;
  heritage: string[];
  likes: number;
  comments: number;
  feeling: { emoji: string; label: string } | null;
  reactions: Record<string, string[]>;
  reactionCount: number;
  /** Only present when the post has images (parity: field omitted otherwise). */
  images?: string[];
}

/** Creates a post; the service adds `createdAt: serverTimestamp()`. */
export async function createPost(data: CreatePostInput): Promise<string> {
  const ref = await addDoc(collection(db, POSTS_COL), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export interface UpdatePostInput {
  content: string;
  type: 'community' | 'professional' | 'event';
  feeling: { emoji: string; label: string } | null;
  images: string[];
}

export async function updatePost(postId: string, updates: UpdatePostInput): Promise<void> {
  await updateDoc(doc(db, POSTS_COL, postId), { ...updates });
}

export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(db, POSTS_COL, postId));
}

// ── Reactions ──

/**
 * Persists a reaction toggle/switch/add — identical field-path updates the
 * page issued (`reactions.<emoji>` arrayUnion/arrayRemove).
 */
export async function updatePostReaction(
  postId: string,
  userId: string,
  emoji: string,
  currentReaction: string | undefined,
): Promise<void> {
  const postRef = doc(db, POSTS_COL, postId);
  if (currentReaction === emoji) {
    await updateDoc(postRef, { [`reactions.${emoji}`]: arrayRemove(userId) });
  } else if (currentReaction) {
    await updateDoc(postRef, {
      [`reactions.${currentReaction}`]: arrayRemove(userId),
      [`reactions.${emoji}`]: arrayUnion(userId),
    });
  } else {
    await updateDoc(postRef, { [`reactions.${emoji}`]: arrayUnion(userId) });
  }
}

// ── Comments ──

/** Result shape for the paginated comment fetch (newest-first pages). */
export interface CommentsPageResult {
  /** One page of comments, in query order (createdAt DESC — newest first). */
  comments: FeedCommentRecord[];
  /** Raw last doc of the page — cursor for the next (older) page's startAfter. */
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  /** Full page returned ⇒ there may be older comments behind the cursor. */
  hasMore: boolean;
}

/**
 * One page of comments for a post, newest first
 * (orderBy createdAt desc, startAfter cursor?, limit pageSize).
 * Callers wanting ascending display should reverse the returned batch.
 */
export async function fetchComments(
  postId: string,
  { pageSize = 50, cursor }: { pageSize?: number; cursor?: QueryDocumentSnapshot<DocumentData> | null } = {},
): Promise<CommentsPageResult> {
  const q = cursor
    ? query(
        collection(db, POSTS_COL, postId, COMMENTS_SUB),
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(pageSize),
      )
    : query(
        collection(db, POSTS_COL, postId, COMMENTS_SUB),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      );
  const snapshot = await getDocs(q);
  const commentsData: FeedCommentRecord[] = [];
  snapshot.forEach((d) => commentsData.push({ id: d.id, ...d.data() } as FeedCommentRecord));
  return {
    comments: commentsData,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

export interface AddCommentInput {
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
  /** Only present when the comment has an image (parity: field omitted otherwise). */
  image?: string;
}

/** Adds a comment; the service adds `createdAt: serverTimestamp()`. */
export async function addComment(postId: string, data: AddCommentInput): Promise<string> {
  const ref = await addDoc(collection(db, POSTS_COL, postId, COMMENTS_SUB), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Adjusts the denormalized `comments` counter on the post (delta: +1 / -1). */
export async function incrementPostComments(postId: string, delta: number): Promise<void> {
  await updateDoc(doc(db, POSTS_COL, postId), { comments: increment(delta) });
}

/** Like/unlike a comment: likes increment(±1) + likedBy arrayUnion/arrayRemove. */
export async function toggleCommentLike(
  postId: string,
  commentId: string,
  userId: string,
  alreadyLiked: boolean,
): Promise<void> {
  const commentRef = doc(db, POSTS_COL, postId, COMMENTS_SUB, commentId);
  if (alreadyLiked) {
    await updateDoc(commentRef, { likes: increment(-1), likedBy: arrayRemove(userId) });
  } else {
    await updateDoc(commentRef, { likes: increment(1), likedBy: arrayUnion(userId) });
  }
}

/** Clears a comment's image (sets `image: ''` — parity with the old page write). */
export async function removeCommentImage(postId: string, commentId: string): Promise<void> {
  await updateDoc(doc(db, POSTS_COL, postId, COMMENTS_SUB, commentId), { image: '' });
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, POSTS_COL, postId, COMMENTS_SUB, commentId));
}

export async function updateCommentText(
  postId: string,
  commentId: string,
  text: string,
): Promise<void> {
  await updateDoc(doc(db, POSTS_COL, postId, COMMENTS_SUB, commentId), { text });
}

// ── User safety data (mutedPosts / blockedUsers on users/{uid}) ──

/**
 * Reads the user's doc for safety data. Returns null when the doc doesn't
 * exist; otherwise the raw fields (page keeps its own truthiness checks).
 */
export async function fetchUserSafetyData(
  userId: string,
): Promise<{ mutedPosts?: string[]; blockedUsers?: string[] } | null> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  const data = userDoc.data();
  return { mutedPosts: data.mutedPosts, blockedUsers: data.blockedUsers };
}

/** Mute-on-report: permanently hide a post from the reporter's own feed. */
export async function mutePostForUser(userId: string, postId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    mutedPosts: arrayUnion(postId),
  });
}

/** Adds a user to the caller's blockedUsers array. */
export async function blockUser(userId: string, blockedUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    blockedUsers: arrayUnion(blockedUid),
  });
}

// ── Moderation notifications (notifications collection) ──

/**
 * Latest 10 content_hidden notifications for the user
 * (where recipientId ==, where type == 'content_hidden', orderBy createdAt desc, limit 10).
 */
export async function fetchModerationNotifications(
  userId: string,
): Promise<ModerationNotificationRecord[]> {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    where('type', '==', 'content_hidden'),
    orderBy('createdAt', 'desc'),
    limit(10),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ModerationNotificationRecord));
}

export async function markNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
}

// ── Moderation writes (3-strike auto-hide, driven by the PAGE) ──

/**
 * Auto-hide a post that hit the report threshold. `hiddenAt` stays an ISO
 * string (parity — this field was never a serverTimestamp).
 */
export async function hidePost(postId: string, hiddenReason: string): Promise<void> {
  await updateDoc(doc(db, POSTS_COL, postId), {
    isHidden: true,
    hiddenAt: new Date().toISOString(),
    hiddenReason,
  });
}

export interface ContentHiddenNotificationInput {
  recipientId: string;
  recipientName: string;
  postId: string;
  reason: string;
  message: string;
  actionUrl: string;
}

/**
 * Notifies a post author their content was auto-hidden. The service adds
 * `type: 'content_hidden'`, `read: false` and `createdAt: serverTimestamp()`.
 */
export async function sendContentHiddenNotification(
  input: ContentHiddenNotificationInput,
): Promise<void> {
  // Delegates to the shared moderation helper (Session 53 dedup).
  await sendContentHiddenNotificationDoc({ ...input });
}
