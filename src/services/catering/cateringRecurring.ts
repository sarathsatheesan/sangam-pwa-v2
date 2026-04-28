// ═══════════════════════════════════════════════════════════════════════
// CATERING RECURRING — Favorites, recurring orders, scheduling
// ═══════════════════════════════════════════════════════════════════════

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  deleteField,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { db } from '../firebase';
import type {
  FavoriteOrder,
  RecurringOrder,
  RecurrenceSchedule,
  RecurrenceInterval,
  OccurrenceOverride,
  DeliveryAddress,
  CateringOrder,
} from './cateringTypes';
import { calculateOrderTotal, createOrder } from './cateringOrders';
import { toEpochMs } from './cateringUtils';

// ═══════════════════════════════════════════════════════════════════════════
// FAVORITES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Save a favorite order for quick reordering.
 */
export async function saveFavoriteOrder(
  fav: Omit<FavoriteOrder, 'id' | 'useCount' | 'createdAt'>,
): Promise<string> {
  // Filter out undefined values — Firestore rejects them
  const cleanFav = Object.fromEntries(
    Object.entries(fav).filter(([, v]) => v !== undefined),
  );
  const docRef = await addDoc(collection(db, 'cateringFavorites'), {
    ...cleanFav,
    useCount: 0,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * List all favorites for a user, most-recently-used first.
 */
export async function fetchFavoriteOrders(userId: string): Promise<FavoriteOrder[]> {
  const q = query(
    collection(db, 'cateringFavorites'),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  const favorites = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FavoriteOrder));
  // Sort client-side: most recently used first, then by creation date
  favorites.sort((a, b) => {
    const aTime = toEpochMs(a.lastOrderedAt) || toEpochMs(a.createdAt);
    const bTime = toEpochMs(b.lastOrderedAt) || toEpochMs(b.createdAt);
    return bTime - aTime;
  });
  return favorites;
}

/**
 * Real-time subscription to user's favorites.
 */
export function subscribeToFavorites(
  userId: string,
  callback: (favs: FavoriteOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'cateringFavorites'),
    where('userId', '==', userId),
  );
  return onSnapshot(q, (snap) => {
    const favorites = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FavoriteOrder));
    favorites.sort((a, b) => {
      const aTime = toEpochMs(a.lastOrderedAt) || toEpochMs(a.createdAt);
      const bTime = toEpochMs(b.lastOrderedAt) || toEpochMs(b.createdAt);
      return bTime - aTime;
    });
    callback(favorites);
  }, (err) => {
    console.warn('subscribeToFavorites error:', err);
    callback([]);
  });
}

/**
 * Verify document ownership before mutation. Throws if doc doesn't exist or userId doesn't match.
 */
async function verifyOwnership(collectionName: string, docId: string, userId: string): Promise<void> {
  const snap = await getDoc(doc(db, collectionName, docId));
  if (!snap.exists()) throw new Error(`Document ${docId} not found`);
  if (snap.data().userId !== userId) throw new Error('Unauthorized: you do not own this document');
}

/**
 * Update a favorite (rename, update items, etc.).
 */
export async function updateFavoriteOrder(
  favId: string,
  updates: Partial<FavoriteOrder>,
  userId: string,
): Promise<void> {
  await verifyOwnership('cateringFavorites', favId, userId);
  const { id, ...data } = updates as any;
  await updateDoc(doc(db, 'cateringFavorites', favId), data);
}

/**
 * Delete a favorite.
 */
export async function deleteFavoriteOrder(favId: string, userId: string): Promise<void> {
  await verifyOwnership('cateringFavorites', favId, userId);
  await deleteDoc(doc(db, 'cateringFavorites', favId));
}

/**
 * Quick reorder from a favorite — creates a new order using the saved items.
 * Returns the new order ID.
 */
export async function reorderFromFavorite(
  fav: FavoriteOrder,
  overrides: {
    customerId: string;
    customerName: string;
    customerEmail: string;
    contactName: string;
    contactPhone: string;
    eventDate: string;
    deliveryAddress: DeliveryAddress;
    headcount?: number;
  },
): Promise<string> {
  const total = calculateOrderTotal(fav.items);
  const orderId = await createOrder({
    customerId: overrides.customerId,
    customerName: overrides.customerName,
    customerEmail: overrides.customerEmail,
    customerPhone: overrides.contactPhone,
    businessId: fav.businessId,
    businessName: fav.businessName,
    items: fav.items,
    subtotal: total,
    total,
    status: 'pending',
    eventDate: overrides.eventDate,
    deliveryAddress: overrides.deliveryAddress,
    headcount: overrides.headcount || fav.headcount || 1,
    specialInstructions: fav.specialInstructions,
    orderForContext: fav.orderForContext,
    contactName: overrides.contactName,
    contactPhone: overrides.contactPhone,
  });

  // Bump favorite usage stats
  await updateDoc(doc(db, 'cateringFavorites', fav.id), {
    lastOrderedAt: serverTimestamp(),
    useCount: (fav.useCount || 0) + 1,
  });

  return orderId;
}

// ═══════════════════════════════════════════════════════════════════════════
// RECURRING ORDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the next run date from a schedule config.
 * Throws if schedule is invalid or no valid date found within 365 days.
 */
export function computeNextRunDate(schedule: RecurrenceSchedule, afterDate?: string): string {
  // Input validation
  if (!schedule) throw new Error('Schedule is required');

  const hasCalendarDays = schedule.daysOfWeek && schedule.daysOfWeek.length > 0;
  const hasDayOfMonth = !!schedule.dayOfMonth;
  const hasInterval = !!schedule.interval;

  if (!hasCalendarDays && !hasDayOfMonth && !hasInterval) {
    throw new Error('Schedule must specify daysOfWeek, dayOfMonth, or interval');
  }

  const after = afterDate ? new Date(afterDate) : new Date();
  if (isNaN(after.getTime())) throw new Error(`Invalid afterDate: ${afterDate}`);
  after.setHours(0, 0, 0, 0);
  const skipSet = new Set(schedule.skipDates || []);

  // Calendar-based: specific days of week
  if (hasCalendarDays) {
    // Validate day numbers
    if (schedule.daysOfWeek!.some(d => d < 0 || d > 6)) {
      throw new Error('daysOfWeek must contain values 0-6 (Sun-Sat)');
    }
    const candidate = new Date(after);
    candidate.setDate(candidate.getDate() + 1);
    for (let i = 0; i < 365; i++) {
      const iso = candidate.toISOString().slice(0, 10);
      if (schedule.daysOfWeek!.includes(candidate.getDay()) && !skipSet.has(iso)) {
        if (!schedule.endDate || iso <= schedule.endDate) return iso;
      }
      candidate.setDate(candidate.getDate() + 1);
    }
    throw new Error('No valid run date found within 365 days for daysOfWeek schedule');
  }

  // Calendar-based: specific day of month
  if (hasDayOfMonth) {
    if (schedule.dayOfMonth! < 1 || schedule.dayOfMonth! > 31) {
      throw new Error('dayOfMonth must be between 1 and 31');
    }
    const candidate = new Date(after);
    candidate.setDate(candidate.getDate() + 1);
    for (let i = 0; i < 365; i++) {
      if (candidate.getDate() === schedule.dayOfMonth) {
        const iso = candidate.toISOString().slice(0, 10);
        if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate)) return iso;
      }
      candidate.setDate(candidate.getDate() + 1);
    }
    throw new Error('No valid run date found within 365 days for dayOfMonth schedule');
  }

  // Simple interval mode
  const intervalDays: Record<RecurrenceInterval, number> = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
  };
  const days = intervalDays[schedule.interval!];
  if (!days) throw new Error(`Unknown interval: ${schedule.interval}`);

  const candidate = new Date(after);
  candidate.setDate(candidate.getDate() + days);
  for (let i = 0; i < 365; i++) {
    const iso = candidate.toISOString().slice(0, 10);
    if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate)) return iso;
    candidate.setDate(candidate.getDate() + 1);
  }
  throw new Error('No valid run date found within 365 days for interval schedule');
}

/**
 * Create a recurring order schedule.
 */
export async function createRecurringOrder(
  rec: Omit<
    RecurringOrder,
    'id' | 'totalOrdersPlaced' | 'createdAt' | 'updatedAt'
  >,
): Promise<string> {
  const cleanRec = Object.fromEntries(
    Object.entries(rec).filter(([, v]) => v !== undefined),
  );
  const docRef = await addDoc(collection(db, 'cateringRecurring'), {
    ...cleanRec,
    totalOrdersPlaced: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * List recurring orders for a user.
 */
export async function fetchRecurringOrders(userId: string): Promise<RecurringOrder[]> {
  const q = query(
    collection(db, 'cateringRecurring'),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecurringOrder));
}

/**
 * Real-time subscription to user's recurring orders.
 */
export function subscribeToRecurringOrders(
  userId: string,
  callback: (recs: RecurringOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'cateringRecurring'),
    where('userId', '==', userId),
  );
  return onSnapshot(q, (snap) => {
    const recs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecurringOrder));
    callback(recs);
  }, (err) => {
    console.warn('subscribeToRecurringOrders error:', err);
    callback([]);
  });
}

/**
 * Update a recurring order (pause, change schedule, update items, etc.).
 */
export async function updateRecurringOrder(
  recId: string,
  updates: Partial<RecurringOrder>,
  userId: string,
): Promise<void> {
  await verifyOwnership('cateringRecurring', recId, userId);
  const { id, ...data } = updates as any;
  await updateDoc(doc(db, 'cateringRecurring', recId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a recurring order.
 */
export async function deleteRecurringOrder(recId: string, userId: string): Promise<void> {
  await verifyOwnership('cateringRecurring', recId, userId);
  await deleteDoc(doc(db, 'cateringRecurring', recId));
}

/**
 * Toggle a recurring order active/paused.
 */
export async function toggleRecurringOrder(recId: string, active: boolean, userId: string): Promise<void> {
  await verifyOwnership('cateringRecurring', recId, userId);
  await updateDoc(doc(db, 'cateringRecurring', recId), {
    active,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Set a per-occurrence override for the next scheduled run.
 * This modifies only the next run without changing the recurring template.
 */
export async function setOccurrenceOverride(
  recId: string,
  override: OccurrenceOverride,
  userId: string,
): Promise<void> {
  await verifyOwnership('cateringRecurring', recId, userId);
  await updateDoc(doc(db, 'cateringRecurring', recId), {
    nextOccurrenceOverride: override,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Clear the per-occurrence override (revert next run to default template).
 */
export async function clearOccurrenceOverride(recId: string, userId: string): Promise<void> {
  await verifyOwnership('cateringRecurring', recId, userId);
  await updateDoc(doc(db, 'cateringRecurring', recId), {
    nextOccurrenceOverride: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Compute estimated monthly cost for a recurring order.
 * Returns cents.
 */
export function estimateMonthlyRecurringCost(rec: RecurringOrder): number {
  const orderTotal = calculateOrderTotal(rec.items);
  const sched = rec.schedule;

  let runsPerMonth: number;
  if (sched.daysOfWeek && sched.daysOfWeek.length > 0) {
    // Calendar mode: runs per week × ~4.33 weeks/month
    runsPerMonth = sched.daysOfWeek.length * 4.33;
  } else {
    switch (sched.interval) {
      case 'daily':
        runsPerMonth = 30;
        break;
      case 'weekly':
        runsPerMonth = 4.33;
        break;
      case 'biweekly':
        runsPerMonth = 2.17;
        break;
      case 'monthly':
        runsPerMonth = 1;
        break;
      default:
        runsPerMonth = 4.33;
    }
  }

  // Subtract approximate skip dates per month
  if (sched.skipDates && sched.skipDates.length > 0) {
    const skipsPerMonth = sched.skipDates.length / 12; // rough average
    runsPerMonth = Math.max(0, runsPerMonth - skipsPerMonth);
  }

  return Math.round(orderTotal * runsPerMonth);
}

/**
 * Estimate monthly cost with refreshed prices from current menu.
 * Falls back to stored prices if menu items can't be fetched.
 */
export async function estimateMonthlyRecurringCostLive(rec: RecurringOrder): Promise<{
  estimatedCost: number;
  priceChanges: Array<{ name: string; oldPrice: number; newPrice: number }>;
}> {
  const priceChanges: Array<{ name: string; oldPrice: number; newPrice: number }> = [];
  let refreshedItems = [...rec.items];

  try {
    // Fetch current prices for each item
    const menuItemIds = rec.items.map(i => i.menuItemId).filter(id => !id.startsWith('scratch_'));
    if (menuItemIds.length > 0) {
      const { getDocs, collection: fbCollection, query: fbQuery, where: fbWhere } = await import('firebase/firestore');
      const { db: firebaseDb } = await import('../firebase');

      // Fetch in batches of 10 (Firestore 'in' limit)
      for (let i = 0; i < menuItemIds.length; i += 10) {
        const batch = menuItemIds.slice(i, i + 10);
        const q = fbQuery(
          fbCollection(firebaseDb, 'cateringMenuItems'),
          fbWhere('__name__', 'in', batch),
        );
        const snap = await getDocs(q);
        const priceMap = new Map<string, number>();
        snap.docs.forEach(d => priceMap.set(d.id, (d.data() as any).price));

        refreshedItems = refreshedItems.map(item => {
          const currentPrice = priceMap.get(item.menuItemId);
          if (currentPrice !== undefined && currentPrice !== item.unitPrice) {
            priceChanges.push({
              name: item.name,
              oldPrice: item.unitPrice,
              newPrice: currentPrice,
            });
            return { ...item, unitPrice: currentPrice };
          }
          return item;
        });
      }
    }
  } catch {
    // Fallback to stored prices silently
  }

  // Calculate with (possibly refreshed) items
  const orderTotal = refreshedItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const sched = rec.schedule;

  let runsPerMonth: number;
  if (sched.daysOfWeek && sched.daysOfWeek.length > 0) {
    runsPerMonth = sched.daysOfWeek.length * 4.33;
  } else {
    switch (sched.interval) {
      case 'daily': runsPerMonth = 30; break;
      case 'weekly': runsPerMonth = 4.33; break;
      case 'biweekly': runsPerMonth = 2.17; break;
      case 'monthly': runsPerMonth = 1; break;
      default: runsPerMonth = 4.33;
    }
  }

  if (sched.skipDates && sched.skipDates.length > 0) {
    const skipsPerMonth = sched.skipDates.length / 12;
    runsPerMonth = Math.max(0, runsPerMonth - skipsPerMonth);
  }

  return {
    estimatedCost: Math.round(orderTotal * runsPerMonth),
    priceChanges,
  };
}

/**
 * Fetch execution history for a recurring order.
 * Returns orders created by this recurring schedule.
 */
export async function fetchRecurringExecutionHistory(
  recurringOrderId: string,
  limitCount = 10,
): Promise<CateringOrder[]> {
  const q = query(
    collection(db, 'cateringOrders'),
    where('recurringOrderId', '==', recurringOrderId),
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringOrder));
  results.sort((a, b) => {
    const aTime = toEpochMs(a.createdAt);
    const bTime = toEpochMs(b.createdAt);
    return bTime - aTime;
  });
  return results.slice(0, limitCount);
}
