/**
 * Saved Items Service
 *
 * Cloud-synced saved/bookmarked items backed by Firestore.
 * Uses localStorage as a fast read-cache, but Firestore is the source of truth.
 *
 * Firestore doc: users/{uid}/savedItems/bookmarks
 * Shape: { posts: string[], businesses: string[], housing: string[],
 *           forumThreads: string[], events: string[] }
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// ── Firestore field name ↔ localStorage key mapping ──
const FIELD_MAP = {
  posts:        'sangam_saved_posts',
  businesses:   'business_favorites',
  housing:      'savedHousing',
  forumThreads: 'savedForumThreads',
  events:       'saved_events',
} as const;

type SavedField = keyof typeof FIELD_MAP;

// ── Read helpers ──

/** Read saved IDs for one category – fast localStorage first, then Firestore */
export function getLocalSavedIds(field: SavedField): string[] {
  try {
    return JSON.parse(localStorage.getItem(FIELD_MAP[field]) || '[]');
  } catch {
    return [];
  }
}

/**
 * Fetch all saved IDs from Firestore and hydrate localStorage.
 * On first call (no Firestore doc exists yet), migrates any existing
 * localStorage data up to Firestore so previously-saved items aren't lost.
 */
export async function pullSavedItems(uid: string): Promise<Record<SavedField, string[]>> {
  const ref = doc(db, 'users', uid, 'savedItems', 'bookmarks');
  const snap = await getDoc(ref);

  const defaults: Record<SavedField, string[]> = {
    posts: [], businesses: [], housing: [], forumThreads: [], events: [],
  };

  if (!snap.exists()) {
    // First time: migrate localStorage → Firestore
    const local: Record<SavedField, string[]> = { ...defaults };
    let hasAny = false;
    for (const [field, lsKey] of Object.entries(FIELD_MAP)) {
      try {
        const ids: string[] = JSON.parse(localStorage.getItem(lsKey) || '[]');
        if (ids.length > 0) { local[field as SavedField] = ids; hasAny = true; }
      } catch { /* ignore */ }
    }
    if (hasAny) {
      // Push local data to Firestore so it syncs to other devices
      await setDoc(ref, local).catch((err) =>
        console.error('[savedItems] migration error:', err),
      );
    }
    return local;
  }

  const data = snap.data() as Partial<Record<SavedField, string[]>>;
  const result = { ...defaults, ...data };

  // Hydrate localStorage cache from Firestore (source of truth)
  for (const [field, lsKey] of Object.entries(FIELD_MAP)) {
    const ids = result[field as SavedField] || [];
    try { localStorage.setItem(lsKey, JSON.stringify(ids)); } catch { /* quota */ }
  }

  return result;
}

// ── Write helpers ──

/** Persist a single category's saved IDs to both localStorage and Firestore */
export async function pushSavedIds(uid: string, field: SavedField, ids: string[]): Promise<void> {
  // Optimistic localStorage write (instant UI)
  try { localStorage.setItem(FIELD_MAP[field], JSON.stringify(ids)); } catch { /* quota */ }

  // Firestore merge-write (cloud sync)
  const ref = doc(db, 'users', uid, 'savedItems', 'bookmarks');
  await setDoc(ref, { [field]: ids }, { merge: true });
}

/** Toggle a single ID in a category, returning the updated Set */
export async function toggleSavedItem(
  uid: string,
  field: SavedField,
  itemId: string,
): Promise<{ saved: boolean; ids: Set<string> }> {
  const current = new Set(getLocalSavedIds(field));
  const saved = !current.has(itemId);
  if (saved) current.add(itemId); else current.delete(itemId);

  const arr = Array.from(current);
  // Fire-and-forget Firestore write (don't block UI)
  pushSavedIds(uid, field, arr).catch((err) =>
    console.error(`[savedItems] sync error for ${field}:`, err),
  );

  return { saved, ids: current };
}
