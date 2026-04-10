// ═══════════════════════════════════════════════════════════════════════
// CATERING MENU — Menu item CRUD and inventory management
// ═══════════════════════════════════════════════════════════════════════

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { CateringMenuItem } from './cateringTypes';

const MENU_ITEMS_COL = 'cateringMenuItems';

export async function fetchMenuItemsByBusiness(businessId: string): Promise<CateringMenuItem[]> {
  const q = query(
    collection(db, MENU_ITEMS_COL),
    where('businessId', '==', businessId),
    where('available', '==', true),
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringMenuItem));
  return results.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
}

export async function fetchMenuItemsByCategory(cuisineCategory: string): Promise<CateringMenuItem[]> {
  // First get all catering-enabled businesses (optionally filtered by category)
  const bizConstraints = [
    ...(cuisineCategory !== 'all' ? [where('category', '==', cuisineCategory)] : []),
    where('isCateringEnabled', '==', true),
  ];
  const bizQ = query(collection(db, 'businesses'), ...bizConstraints);
  const bizSnap = await getDocs(bizQ);
  const bizIds = bizSnap.docs.map(d => d.id);

  if (bizIds.length === 0) return [];

  // Firestore 'in' supports max 30 values
  const chunks: string[][] = [];
  for (let i = 0; i < bizIds.length; i += 30) {
    chunks.push(bizIds.slice(i, i + 30));
  }

  const allItems: CateringMenuItem[] = [];
  for (const chunk of chunks) {
    const itemQ = query(
      collection(db, MENU_ITEMS_COL),
      where('businessId', 'in', chunk),
      where('available', '==', true),
    );
    const itemSnap = await getDocs(itemQ);
    itemSnap.docs.forEach(d => {
      allItems.push({ id: d.id, ...d.data() } as CateringMenuItem);
    });
  }

  return allItems;
}

export async function createMenuItem(item: Omit<CateringMenuItem, 'id'>): Promise<string> {
  const cleanItem = Object.fromEntries(
    Object.entries(item).filter(([, v]) => v !== undefined),
  );
  const docRef = await addDoc(collection(db, MENU_ITEMS_COL), {
    ...cleanItem,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateMenuItem(itemId: string, updates: Partial<CateringMenuItem>): Promise<void> {
  const ref = doc(db, MENU_ITEMS_COL, itemId);
  // Strip undefined values — Firestore rejects them
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  );
  await updateDoc(ref, cleanUpdates);
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, MENU_ITEMS_COL, itemId));
}

export async function updateMenuItemStock(
  itemId: string,
  updates: {
    stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
    stockCount?: number;
    available?: boolean;
    availableFrom?: string;
    availableUntil?: string;
  },
): Promise<void> {
  const cleanUpdates: Record<string, any> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) cleanUpdates[k] = v;
  }
  await updateDoc(doc(db, MENU_ITEMS_COL, itemId), cleanUpdates);
}

// ═══════════════════════════════════════════════════════════════════════
// VENDOR STOREFRONT BUILDER — New functions (existing functions above untouched)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch ALL menu items for a business (including unavailable/archived) — vendor editor view.
 * Unlike fetchMenuItemsByBusiness, this does NOT filter by available === true.
 */
export async function fetchAllMenuItemsByBusiness(businessId: string): Promise<CateringMenuItem[]> {
  const q = query(
    collection(db, MENU_ITEMS_COL),
    where('businessId', '==', businessId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as CateringMenuItem))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || (a.category || '').localeCompare(b.category || ''));
}

/**
 * Real-time subscription to all menu items for a business (vendor editor).
 * Returns an unsubscribe function.
 */
export function subscribeToMenuItems(
  businessId: string,
  onData: (items: CateringMenuItem[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, MENU_ITEMS_COL),
    where('businessId', '==', businessId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as CateringMenuItem))
        .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || (a.category || '').localeCompare(b.category || ''));
      onData(items);
    },
    (err) => onError?.(err as Error),
  );
}

/**
 * Batch-create multiple menu items at once (for templates / smart paste).
 * Returns array of created document IDs.
 */
export async function batchCreateMenuItems(
  items: Omit<CateringMenuItem, 'id'>[],
): Promise<string[]> {
  const batch = writeBatch(db);
  const ids: string[] = [];

  for (const item of items) {
    const cleanItem = Object.fromEntries(
      Object.entries(item).filter(([, v]) => v !== undefined),
    );
    const ref = doc(collection(db, MENU_ITEMS_COL));
    batch.set(ref, { ...cleanItem, createdAt: serverTimestamp() });
    ids.push(ref.id);
  }

  await batch.commit();
  return ids;
}

/**
 * Soft-delete: archive a menu item (hidden from customers, visible in vendor editor).
 */
export async function archiveMenuItem(itemId: string): Promise<void> {
  await updateDoc(doc(db, MENU_ITEMS_COL, itemId), {
    archived: true,
    available: false,
  });
}

/**
 * Restore an archived menu item.
 */
export async function restoreMenuItem(itemId: string): Promise<void> {
  await updateDoc(doc(db, MENU_ITEMS_COL, itemId), {
    archived: false,
    available: true,
    stockStatus: 'in_stock',
  });
}

/**
 * Log a vendor image upload for liability audit trail.
 */
export async function logImageUpload(entry: Omit<import('./cateringTypes').VendorImageAuditEntry, 'timestamp'>): Promise<void> {
  await addDoc(collection(db, 'vendorImageAuditLog'), {
    ...entry,
    timestamp: serverTimestamp(),
  });
}
