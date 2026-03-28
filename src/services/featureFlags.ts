/**
 * Lightweight feature flag helper for use OUTSIDE FeatureSettingsProvider
 * (e.g., auth screens that render before the user is logged in).
 *
 * For components inside the provider, use useFeatureSettings() instead.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

const FIRESTORE_DOC = 'appConfig';
const FIRESTORE_ID = 'featureSettings';

// Cache to avoid repeated Firestore reads within a session
let cachedFlags: Record<string, boolean> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5_000; // 5 seconds — keep short so admin changes take effect quickly

/**
 * Ensure the current user has a valid ID token before making Firestore reads.
 * During page reload, auth.currentUser may exist from persistence but the
 * token may not yet be refreshed, causing permission errors.
 */
async function ensureValidToken(): Promise<boolean> {
  if (!auth.currentUser) return false;
  try {
    await auth.currentUser.getIdToken();
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch a single feature flag value from Firestore.
 * Returns the flag value, or the provided defaultValue if not found.
 *
 * Works both with and without authentication — appConfig allows public reads
 * so the signup page can check KYC flags before the user logs in.
 */
export async function getFeatureFlag(
  key: string,
  defaultValue: boolean = true
): Promise<boolean> {
  try {
    const now = Date.now();

    // Use cache if still fresh
    if (cachedFlags && now - cacheTimestamp < CACHE_TTL_MS) {
      return cachedFlags[key] ?? defaultValue;
    }

    // Try to refresh token if user is logged in (avoids stale-token errors)
    await ensureValidToken();

    const docRef = doc(db, FIRESTORE_DOC, FIRESTORE_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      cachedFlags = docSnap.data() as Record<string, boolean>;
      cacheTimestamp = now;

      return cachedFlags[key] ?? defaultValue;
    }

    return defaultValue;
  } catch (error: any) {
    // Silence permission errors — fall back to cache or default
    if (error?.code === 'permission-denied') {
      return cachedFlags?.[key] ?? defaultValue;
    }
    console.warn(`[FeatureFlags] Error reading flag "${key}" — using default (${defaultValue})`);
    return defaultValue;
  }
}

/**
 * Fetch multiple feature flags at once.
 */
/**
 * Fetch multiple feature flags at once.
 * Works both with and without authentication.
 */
export async function getFeatureFlags(
  keys: string[],
  defaults: Record<string, boolean> = {}
): Promise<Record<string, boolean>> {
  try {
    const now = Date.now();

    if (!cachedFlags || now - cacheTimestamp >= CACHE_TTL_MS) {
      // Try to refresh token if user is logged in
      await ensureValidToken();

      const docRef = doc(db, FIRESTORE_DOC, FIRESTORE_ID);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        cachedFlags = docSnap.data() as Record<string, boolean>;
        cacheTimestamp = now;
      }
    }

    const result: Record<string, boolean> = {};
    for (const key of keys) {
      result[key] = cachedFlags?.[key] ?? defaults[key] ?? true;
    }
    return result;
  } catch (error: any) {
    if (error?.code !== 'permission-denied') {
      console.warn('[FeatureFlags] Error reading flags — using defaults');
    }
    const result: Record<string, boolean> = {};
    for (const key of keys) {
      result[key] = cachedFlags?.[key] ?? defaults[key] ?? true;
    }
    return result;
  }
}
