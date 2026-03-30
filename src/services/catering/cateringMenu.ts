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
} from 'firebase/firestore';
import { db } from '../firebase';
import { CateringMenuItem } from './cateringTypes';

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
  await updateDoc(ref, updates);
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
