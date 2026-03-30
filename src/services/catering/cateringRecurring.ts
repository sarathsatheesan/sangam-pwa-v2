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
  Unsubscribe,
} from 'firebase/firestore';

import { db } from '../firebase';
import {
  FavoriteOrder,
  RecurringOrder,
  RecurrenceSchedule,
  RecurrenceInterval,
  OccurrenceOverride,
  DeliveryAddress,
} from './cateringTypes';
import { calculateOrderTotal, createOrder } from './cateringOrders';

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
    const aTime = a.lastOrderedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const bTime = b.lastOrderedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
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
      const aTime = a.lastOrderedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bTime = b.lastOrderedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    callback(favorites);
  });
}

/**
 * Update a favorite (rename, update items, etc.).
 */
export async function updateFavoriteOrder(
  favId: string,
  updates: Partial<FavoriteOrder>,
): Promise<void> {
  const { id, ...data } = updates as any;
  await updateDoc(doc(db, 'cateringFavorites', favId), data);
}

/**
 * Delete a favorite.
 */
export async function deleteFavoriteOrder(favId: string): Promise<void> {
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
 */
export function computeNextRunDate(schedule: RecurrenceSchedule, afterDate?: string): string {
  const after = afterDate ? new Date(afterDate) : new Date();
  after.setHours(0, 0, 0, 0);
  const skipSet = new Set(schedule.skipDates || []);

  // Calendar-based: specific days of week
  if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
    const candidate = new Date(after);
    candidate.setDate(candidate.getDate() + 1); // Start from tomorrow
    for (let i = 0; i < 365; i++) {
      const iso = candidate.toISOString().slice(0, 10);
      if (schedule.daysOfWeek.includes(candidate.getDay()) && !skipSet.has(iso)) {
        if (!schedule.endDate || iso <= schedule.endDate) return iso;
      }
      candidate.setDate(candidate.getDate() + 1);
    }
    return ''; // No valid date found within a year
  }

  // Calendar-based: specific day of month
  if (schedule.dayOfMonth) {
    const candidate = new Date(after);
    candidate.setDate(candidate.getDate() + 1);
    for (let i = 0; i < 365; i++) {
      if (candidate.getDate() === schedule.dayOfMonth) {
        const iso = candidate.toISOString().slice(0, 10);
        if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate)) return iso;
      }
      candidate.setDate(candidate.getDate() + 1);
    }
    return '';
  }

  // Simple interval mode
  const intervalDays: Record<RecurrenceInterval, number> = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
  };
  const days = intervalDays[schedule.interval || 'weekly'];
  const candidate = new Date(after);
  candidate.setDate(candidate.getDate() + days);
  for (let i = 0; i < 365; i++) {
    const iso = candidate.toISOString().slice(0, 10);
    if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate)) return iso;
    candidate.setDate(candidate.getDate() + 1);
  }
  return '';
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
  });
}

/**
 * Update a recurring order (pause, change schedule, update items, etc.).
 */
export async function updateRecurringOrder(
  recId: string,
  updates: Partial<RecurringOrder>,
): Promise<void> {
  const { id, ...data } = updates as any;
  await updateDoc(doc(db, 'cateringRecurring', recId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a recurring order.
 */
export async function deleteRecurringOrder(recId: string): Promise<void> {
  await deleteDoc(doc(db, 'cateringRecurring', recId));
}

/**
 * Toggle a recurring order active/paused.
 */
export async function toggleRecurringOrder(recId: string, active: boolean): Promise<void> {
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
): Promise<void> {
  await updateDoc(doc(db, 'cateringRecurring', recId), {
    nextOccurrenceOverride: override,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Clear the per-occurrence override (revert next run to default template).
 */
export async function clearOccurrenceOverride(recId: string): Promise<void> {
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
