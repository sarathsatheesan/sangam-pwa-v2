/**
 * Admin dashboard statistics — server-side aggregation.
 *
 * Replaces the former pattern of downloading 15 entire collections just to
 * read `.size` (O(total documents) reads, billed per doc). Aggregate counts
 * cost 1 read per 1,000 index entries and transfer no documents.
 *
 * The only document fetch left is the 7-day signup histogram, which is a
 * bounded range query on users.createdAt (auto single-field index).
 */
import {
  collection,
  query,
  where,
  getCountFromServer,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  disabledUsers: number;
  totalListings: number;
  businessCount: number;
  housingCount: number;
  travelCount: number;
  forumThreads: number;
  forumReplies: number;
  totalEvents: number;
  totalPosts: number;
  modQueueCount: number;
  announcementCount: number;
  cateringOrderCount: number;
  cateringPendingCount: number;
  cateringBusinessCount: number;
  cateringRfpCount: number;
  recentSignups: number[];
}

const countColl = async (name: string): Promise<number> =>
  (await getCountFromServer(collection(db, name))).data().count;

/** Bounded query: only users created in the last 7 days, bucketed by day. */
async function getSignupBuckets(): Promise<number[]> {
  const now = Date.now();
  const weekAgo = Timestamp.fromMillis(now - 7 * 24 * 60 * 60 * 1000);
  const snap = await getDocs(
    query(collection(db, 'users'), where('createdAt', '>=', weekAgo)),
  );
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  snap.docs.forEach((d) => {
    const data = d.data();
    const ts: number =
      data.createdAt?.toMillis?.() || (data.createdAt?.seconds ?? 0) * 1000 || 0;
    if (ts > 0) {
      const daysAgo = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
      if (daysAgo >= 0 && daysAgo < 7) buckets[6 - daysAgo]++;
    }
  });
  return buckets;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    users,
    businesses,
    housing,
    travel,
    forumThreads,
    forumReplies,
    events,
    posts,
    modQueue,
    announcements,
    banned,
    disabled,
    cateringOrders,
    cateringPending,
    cateringBiz,
    cateringRfp,
    recentSignups,
  ] = await Promise.all([
    countColl('users'),
    countColl('businesses'),
    countColl('listings'),
    countColl('travelPosts'),
    countColl('forumThreads'),
    countColl('forumReplies'),
    countColl('events'),
    countColl('posts'),
    countColl('moderationQueue'),
    countColl('announcements'),
    countColl('bannedUsers'),
    countColl('disabledUsers'),
    countColl('cateringOrders'),
    getCountFromServer(
      query(collection(db, 'cateringOrders'), where('status', '==', 'pending')),
    ).then((s) => s.data().count),
    getCountFromServer(
      query(collection(db, 'businesses'), where('isCateringEnabled', '==', true)),
    ).then((s) => s.data().count),
    countColl('cateringQuoteRequests'),
    getSignupBuckets(),
  ]);

  return {
    totalUsers: users,
    activeUsers: users - banned - disabled,
    bannedUsers: banned,
    disabledUsers: disabled,
    totalListings: businesses + housing + travel,
    businessCount: businesses,
    housingCount: housing,
    travelCount: travel,
    forumThreads,
    forumReplies,
    totalEvents: events,
    totalPosts: posts,
    modQueueCount: modQueue,
    announcementCount: announcements,
    cateringOrderCount: cateringOrders,
    cateringPendingCount: cateringPending,
    cateringBusinessCount: cateringBiz,
    cateringRfpCount: cateringRfp,
    recentSignups,
  };
}
