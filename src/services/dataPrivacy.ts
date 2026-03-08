/**
 * GDPR / CCPA Data Privacy Service
 * Provides "Download My Data" and "Delete My Data" functionality.
 */

import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  writeBatch,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { deleteUser as firebaseDeleteUser } from 'firebase/auth';
import { db, auth } from './firebase';

// ─── Types ───────────────────────────────────────────────────

export interface UserDataExport {
  exportDate: string;
  userId: string;
  email: string;
  profile: Record<string, any> | null;
  posts: Record<string, any>[];
  businesses: Record<string, any>[];
  listings: Record<string, any>[];
  events: Record<string, any>[];
  travelPosts: Record<string, any>[];
  forumThreads: Record<string, any>[];
  forumReplies: Record<string, any>[];
  conversations: {
    conversationId: string;
    participants: string[];
    messages: Record<string, any>[];
  }[];
  eventRsvps: Record<string, any>[];
}

export interface DeletionResult {
  success: boolean;
  deletedCounts: Record<string, number>;
  errors: string[];
}

// ─── Helpers ────────────────────────────────────────────────

function serializeTimestamps(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) {
    return obj.toDate().toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeTimestamps);
  }
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeTimestamps(value);
    }
    return result;
  }
  return obj;
}

// ─── Download My Data ───────────────────────────────────────

export async function downloadMyData(userId: string): Promise<UserDataExport> {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) {
    throw new Error('Authentication required');
  }

  const exportData: UserDataExport = {
    exportDate: new Date().toISOString(),
    userId,
    email: user.email || '',
    profile: null,
    posts: [],
    businesses: [],
    listings: [],
    events: [],
    travelPosts: [],
    forumThreads: [],
    forumReplies: [],
    conversations: [],
    eventRsvps: [],
  };

  // 1. Profile
  try {
    const profileDoc = await getDoc(doc(db, 'users', userId));
    if (profileDoc.exists()) {
      exportData.profile = serializeTimestamps({ id: profileDoc.id, ...profileDoc.data() });
    }
  } catch (e) {
    console.warn('Error fetching profile:', e);
  }

  // 2. Posts (feed)
  try {
    const postsQuery = query(collection(db, 'posts'), where('userId', '==', userId));
    const postsSnap = await getDocs(postsQuery);
    exportData.posts = postsSnap.docs.map((d) =>
      serializeTimestamps({ id: d.id, ...d.data() })
    );
  } catch (e) {
    console.warn('Error fetching posts:', e);
  }

  // 3. Businesses
  try {
    const bizQuery = query(collection(db, 'businesses'), where('ownerId', '==', userId));
    const bizSnap = await getDocs(bizQuery);
    exportData.businesses = bizSnap.docs.map((d) =>
      serializeTimestamps({ id: d.id, ...d.data() })
    );
  } catch (e) {
    console.warn('Error fetching businesses:', e);
  }

  // 4. Listings (housing)
  try {
    const listQuery = query(collection(db, 'listings'), where('posterId', '==', userId));
    const listSnap = await getDocs(listQuery);
    exportData.listings = listSnap.docs.map((d) =>
      serializeTimestamps({ id: d.id, ...d.data() })
    );
  } catch (e) {
    console.warn('Error fetching listings:', e);
  }

  // 5. Events created by user
  try {
    const eventsQuery = query(collection(db, 'events'), where('posterId', '==', userId));
    const eventsSnap = await getDocs(eventsQuery);
    exportData.events = eventsSnap.docs.map((d) =>
      serializeTimestamps({ id: d.id, ...d.data() })
    );
  } catch (e) {
    console.warn('Error fetching events:', e);
  }

  // 6. Events RSVPed to
  try {
    const rsvpQuery = query(
      collection(db, 'events'),
      where('rsvpUsers', 'array-contains', userId)
    );
    const rsvpSnap = await getDocs(rsvpQuery);
    exportData.eventRsvps = rsvpSnap.docs.map((d) =>
      serializeTimestamps({ id: d.id, title: d.data().title, fullDate: d.data().fullDate })
    );
  } catch (e) {
    console.warn('Error fetching RSVPs:', e);
  }

  // 7. Travel Posts
  try {
    const travelQuery = query(collection(db, 'travelPosts'), where('posterId', '==', userId));
    const travelSnap = await getDocs(travelQuery);
    exportData.travelPosts = travelSnap.docs.map((d) =>
      serializeTimestamps({ id: d.id, ...d.data() })
    );
  } catch (e) {
    console.warn('Error fetching travel posts:', e);
  }

  // 8. Forum Threads
  try {
    const threadsQuery = query(collection(db, 'forumThreads'), where('authorId', '==', userId));
    const threadsSnap = await getDocs(threadsQuery);
    exportData.forumThreads = threadsSnap.docs.map((d) =>
      serializeTimestamps({ id: d.id, ...d.data() })
    );
  } catch (e) {
    console.warn('Error fetching forum threads:', e);
  }

  // 9. Forum Replies
  try {
    const repliesQuery = query(collection(db, 'forumReplies'), where('authorId', '==', userId));
    const repliesSnap = await getDocs(repliesQuery);
    exportData.forumReplies = repliesSnap.docs.map((d) =>
      serializeTimestamps({ id: d.id, ...d.data() })
    );
  } catch (e) {
    console.warn('Error fetching forum replies:', e);
  }

  // 10. Conversations & Messages
  try {
    const convsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId)
    );
    const convsSnap = await getDocs(convsQuery);

    for (const convDoc of convsSnap.docs) {
      const convData = convDoc.data();
      // Fetch all messages in this conversation
      const msgsQuery = query(
        collection(db, 'conversations', convDoc.id, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const msgsSnap = await getDocs(msgsQuery);
      const messages = msgsSnap.docs.map((m) =>
        serializeTimestamps({ id: m.id, ...m.data() })
      );

      exportData.conversations.push({
        conversationId: convDoc.id,
        participants: convData.participants || [],
        messages,
      });
    }
  } catch (e) {
    console.warn('Error fetching conversations:', e);
  }

  return exportData;
}

// ─── Delete My Data ─────────────────────────────────────────

export async function deleteMyData(userId: string): Promise<DeletionResult> {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) {
    throw new Error('Authentication required');
  }

  const result: DeletionResult = {
    success: true,
    deletedCounts: {},
    errors: [],
  };

  // Helper: batch delete docs from a query
  async function batchDeleteQuery(
    collectionName: string,
    field: string,
    value: string
  ): Promise<number> {
    let count = 0;
    try {
      const q = query(collection(db, collectionName), where(field, '==', value));
      const snap = await getDocs(q);

      // Firestore batches limited to 500 writes
      const batchSize = 450;
      for (let i = 0; i < snap.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = snap.docs.slice(i, i + batchSize);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        count += chunk.length;
      }
    } catch (e: any) {
      result.errors.push(`${collectionName}: ${e.message}`);
      result.success = false;
    }
    return count;
  }

  // 1. Delete Posts
  result.deletedCounts.posts = await batchDeleteQuery('posts', 'userId', userId);

  // 2. Delete Businesses
  result.deletedCounts.businesses = await batchDeleteQuery('businesses', 'ownerId', userId);

  // 3. Delete Listings
  result.deletedCounts.listings = await batchDeleteQuery('listings', 'posterId', userId);

  // 4. Delete Events created by user
  result.deletedCounts.events = await batchDeleteQuery('events', 'posterId', userId);

  // 5. Delete Travel Posts
  result.deletedCounts.travelPosts = await batchDeleteQuery('travelPosts', 'posterId', userId);

  // 6. Delete Forum Threads (and their likes subcollection)
  try {
    const threadsQuery = query(collection(db, 'forumThreads'), where('authorId', '==', userId));
    const threadsSnap = await getDocs(threadsQuery);
    let threadCount = 0;

    for (const threadDoc of threadsSnap.docs) {
      // Delete likes subcollection first
      try {
        const likesSnap = await getDocs(collection(db, 'forumThreads', threadDoc.id, 'likes'));
        const batch = writeBatch(db);
        likesSnap.docs.forEach((likeDoc) => batch.delete(likeDoc.ref));
        if (likesSnap.docs.length > 0) await batch.commit();
      } catch (_) {}
      await deleteDoc(threadDoc.ref);
      threadCount++;
    }
    result.deletedCounts.forumThreads = threadCount;
  } catch (e: any) {
    result.errors.push(`forumThreads: ${e.message}`);
    result.success = false;
  }

  // 7. Delete Forum Replies (and their likes subcollection)
  try {
    const repliesQuery = query(collection(db, 'forumReplies'), where('authorId', '==', userId));
    const repliesSnap = await getDocs(repliesQuery);
    let replyCount = 0;

    for (const replyDoc of repliesSnap.docs) {
      try {
        const likesSnap = await getDocs(collection(db, 'forumReplies', replyDoc.id, 'likes'));
        const batch = writeBatch(db);
        likesSnap.docs.forEach((likeDoc) => batch.delete(likeDoc.ref));
        if (likesSnap.docs.length > 0) await batch.commit();
      } catch (_) {}
      await deleteDoc(replyDoc.ref);
      replyCount++;
    }
    result.deletedCounts.forumReplies = replyCount;
  } catch (e: any) {
    result.errors.push(`forumReplies: ${e.message}`);
    result.success = false;
  }

  // 8. Delete Conversations & Messages
  try {
    const convsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId)
    );
    const convsSnap = await getDocs(convsQuery);
    let msgCount = 0;
    let convCount = 0;

    for (const convDoc of convsSnap.docs) {
      // Delete all messages in this conversation
      const msgsSnap = await getDocs(collection(db, 'conversations', convDoc.id, 'messages'));
      const batchSize = 450;
      for (let i = 0; i < msgsSnap.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = msgsSnap.docs.slice(i, i + batchSize);
        chunk.forEach((m) => batch.delete(m.ref));
        await batch.commit();
        msgCount += chunk.length;
      }
      // Delete conversation doc
      await deleteDoc(convDoc.ref);
      convCount++;
    }
    result.deletedCounts.messages = msgCount;
    result.deletedCounts.conversations = convCount;
  } catch (e: any) {
    result.errors.push(`conversations: ${e.message}`);
    result.success = false;
  }

  // 9. Remove user from event RSVP lists
  try {
    const rsvpQuery = query(
      collection(db, 'events'),
      where('rsvpUsers', 'array-contains', userId)
    );
    const rsvpSnap = await getDocs(rsvpQuery);
    let rsvpCount = 0;

    for (const eventDoc of rsvpSnap.docs) {
      const eventData = eventDoc.data();
      const updatedRsvpUsers = (eventData.rsvpUsers || []).filter((uid: string) => uid !== userId);
      const { updateDoc: firestoreUpdateDoc } = await import('firebase/firestore');
      await firestoreUpdateDoc(eventDoc.ref, {
        rsvpUsers: updatedRsvpUsers,
        count: Math.max(0, (eventData.count || 0) - 1),
      });
      rsvpCount++;
    }
    result.deletedCounts.eventRsvpsRemoved = rsvpCount;
  } catch (e: any) {
    result.errors.push(`eventRsvps: ${e.message}`);
    result.success = false;
  }

  // 10. Delete banned/disabled entries if they exist
  try {
    await deleteDoc(doc(db, 'bannedUsers', userId));
  } catch (_) {}
  try {
    await deleteDoc(doc(db, 'disabledUsers', userId));
  } catch (_) {}

  // 11. Delete user profile document
  try {
    await deleteDoc(doc(db, 'users', userId));
    result.deletedCounts.profile = 1;
  } catch (e: any) {
    result.errors.push(`profile: ${e.message}`);
    result.success = false;
  }

  // 12. Delete Firebase Auth account
  try {
    await firebaseDeleteUser(user);
    result.deletedCounts.authAccount = 1;
  } catch (e: any) {
    result.errors.push(`auth: ${e.message}`);
    result.success = false;
  }

  return result;
}
