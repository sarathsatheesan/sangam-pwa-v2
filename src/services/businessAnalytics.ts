// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS ANALYTICS SERVICE
// Tracks views, contact clicks, shares, and favorites for business listings.
// Uses Firestore subcollection: businesses/{id}/analytics/{YYYY-MM-DD}
// Also maintains denormalized counters on the business document itself.
// ═════════════════════════════════════════════════════════════════════════════════

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { BusinessAnalytics, AnalyticsEvent } from '@/reducers/businessReducer';

// ── Helpers ──

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Debounce view tracking per session to avoid over-counting
const viewedThisSession = new Set<string>();

// ── Record Events ──

/**
 * Record a business detail view. Debounced per session (only counts once per business).
 */
export async function recordView(businessId: string): Promise<void> {
  if (viewedThisSession.has(businessId)) return;
  viewedThisSession.add(businessId);

  const dateKey = todayKey();
  const analyticsRef = doc(db, 'businesses', businessId, 'analytics', dateKey);
  const businessRef = doc(db, 'businesses', businessId);

  try {
    const snap = await getDoc(analyticsRef);
    if (snap.exists()) {
      await updateDoc(analyticsRef, { views: increment(1) });
    } else {
      await setDoc(analyticsRef, {
        date: dateKey,
        views: 1,
        contactClicks: 0,
        shares: 0,
        favorites: 0,
        createdAt: Timestamp.now(),
      });
    }
    // Update denormalized counter
    await updateDoc(businessRef, { viewCount: increment(1) }).catch(() => {});
  } catch (err) {
    console.warn('Analytics: failed to record view', err);
  }
}

/**
 * Record a contact click (phone, website, or map link).
 */
export async function recordContactClick(businessId: string): Promise<void> {
  const dateKey = todayKey();
  const analyticsRef = doc(db, 'businesses', businessId, 'analytics', dateKey);
  const businessRef = doc(db, 'businesses', businessId);

  try {
    const snap = await getDoc(analyticsRef);
    if (snap.exists()) {
      await updateDoc(analyticsRef, { contactClicks: increment(1) });
    } else {
      await setDoc(analyticsRef, {
        date: dateKey,
        views: 0,
        contactClicks: 1,
        shares: 0,
        favorites: 0,
        createdAt: Timestamp.now(),
      });
    }
    await updateDoc(businessRef, { contactClicks: increment(1) }).catch(() => {});
  } catch (err) {
    console.warn('Analytics: failed to record contact click', err);
  }
}

/**
 * Record a share event.
 */
export async function recordShare(businessId: string): Promise<void> {
  const dateKey = todayKey();
  const analyticsRef = doc(db, 'businesses', businessId, 'analytics', dateKey);
  const businessRef = doc(db, 'businesses', businessId);

  try {
    const snap = await getDoc(analyticsRef);
    if (snap.exists()) {
      await updateDoc(analyticsRef, { shares: increment(1) });
    } else {
      await setDoc(analyticsRef, {
        date: dateKey,
        views: 0,
        contactClicks: 0,
        shares: 1,
        favorites: 0,
        createdAt: Timestamp.now(),
      });
    }
    await updateDoc(businessRef, { shareCount: increment(1) }).catch(() => {});
  } catch (err) {
    console.warn('Analytics: failed to record share', err);
  }
}

/**
 * Record a favorite toggle (increment only — does not decrement on unfavorite).
 */
export async function recordFavorite(businessId: string): Promise<void> {
  const dateKey = todayKey();
  const analyticsRef = doc(db, 'businesses', businessId, 'analytics', dateKey);

  try {
    const snap = await getDoc(analyticsRef);
    if (snap.exists()) {
      await updateDoc(analyticsRef, { favorites: increment(1) });
    } else {
      await setDoc(analyticsRef, {
        date: dateKey,
        views: 0,
        contactClicks: 0,
        shares: 0,
        favorites: 1,
        createdAt: Timestamp.now(),
      });
    }
  } catch (err) {
    console.warn('Analytics: failed to record favorite', err);
  }
}

// ── Fetch Analytics (for owner dashboard) ──

/**
 * Fetch the last 30 days of analytics for a business.
 */
export async function fetchBusinessAnalytics(businessId: string): Promise<BusinessAnalytics> {
  const analyticsCol = collection(db, 'businesses', businessId, 'analytics');
  const q = query(analyticsCol, orderBy('date', 'desc'), limit(30));

  try {
    const snap = await getDocs(q);
    const dailyData: AnalyticsEvent[] = [];
    let totalViews = 0;
    let totalContactClicks = 0;
    let totalShares = 0;
    let totalFavorites = 0;

    snap.forEach((docSnap) => {
      const d = docSnap.data() as AnalyticsEvent;
      dailyData.push(d);
      totalViews += d.views || 0;
      totalContactClicks += d.contactClicks || 0;
      totalShares += d.shares || 0;
      totalFavorites += d.favorites || 0;
    });

    // Sort ascending for chart display
    dailyData.sort((a, b) => a.date.localeCompare(b.date));

    return { totalViews, totalContactClicks, totalShares, totalFavorites, dailyData };
  } catch (err) {
    console.warn('Analytics: failed to fetch data', err);
    return { totalViews: 0, totalContactClicks: 0, totalShares: 0, totalFavorites: 0, dailyData: [] };
  }
}
