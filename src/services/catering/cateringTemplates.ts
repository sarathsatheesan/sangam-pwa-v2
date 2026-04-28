// ═══════════════════════════════════════════════════════════════════════
// CATERING TEMPLATES — Order template CRUD and sharing
// ═══════════════════════════════════════════════════════════════════════

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp,
  arrayUnion,
  writeBatch,
  QueryConstraint,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { db } from '../firebase';
import type { OrderTemplate } from './cateringTypes';
import { toEpochMs, toDate } from './cateringUtils';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a short unique share code using cryptographically secure random values.
 */
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars.charAt(byte % chars.length)).join('');
}

function dedupeTemplates(templates: OrderTemplate[]): OrderTemplate[] {
  const seen = new Set<string>();
  return templates.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an order template.
 */
export async function createOrderTemplate(
  tmpl: Omit<
    OrderTemplate,
    'id' | 'shareCode' | 'useCount' | 'createdAt' | 'updatedAt'
  >,
): Promise<{ id: string; shareCode: string }> {
  const shareCode = generateShareCode();
  const cleanTmpl = Object.fromEntries(
    Object.entries(tmpl).filter(([, v]) => v !== undefined),
  );
  const docRef = await addDoc(collection(db, 'cateringTemplates'), {
    ...cleanTmpl,
    shareCode,
    useCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id, shareCode };
}

/**
 * Fetch templates created by a user.
 */
export async function fetchMyTemplates(userId: string): Promise<OrderTemplate[]> {
  const q = query(
    collection(db, 'cateringTemplates'),
    where('creatorId', '==', userId),
  );
  const snap = await getDocs(q);
  const templates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderTemplate));
  templates.sort((a, b) => {
    const aTime = toEpochMs(a.updatedAt) || toEpochMs(a.createdAt);
    const bTime = toEpochMs(b.updatedAt) || toEpochMs(b.createdAt);
    return bTime - aTime;
  });
  return templates;
}

/**
 * Fetch templates shared within an organization.
 */
export async function fetchOrgTemplates(organizationId: string): Promise<OrderTemplate[]> {
  const q = query(
    collection(db, 'cateringTemplates'),
    where('organizationId', '==', organizationId),
  );
  const snap = await getDocs(q);
  const templates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderTemplate));
  templates.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
  return templates;
}

/**
 * Look up a template by its share code (for link sharing).
 */
export async function fetchTemplateByShareCode(shareCode: string): Promise<OrderTemplate | null> {
  const q = query(
    collection(db, 'cateringTemplates'),
    where('shareCode', '==', shareCode),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as OrderTemplate;
}

/**
 * Update a template with versioning support (Feature #30).
 */
export async function updateOrderTemplate(
  tmplId: string,
  updates: Partial<OrderTemplate>,
  userId?: string,
): Promise<void> {
  const { id, ...data } = updates as any;
  const tmplRef = doc(db, 'cateringTemplates', tmplId);
  const snap = await getDoc(tmplRef);

  // Feature #30: Create version history entry if items/headcount/specialInstructions changed
  let updatePayload: any = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  if (snap.exists()) {
    const currentData = snap.data();
    const isContentChange =
      (data.items && JSON.stringify(data.items) !== JSON.stringify(currentData.items)) ||
      (data.headcount !== undefined && data.headcount !== currentData.headcount) ||
      (data.specialInstructions !== undefined && data.specialInstructions !== currentData.specialInstructions);

    if (isContentChange && snap.data().items) {
      const newVersion = (currentData.version || 0) + 1;
      const historyEntry = {
        version: currentData.version || 1,
        items: currentData.items,
        headcount: currentData.headcount,
        specialInstructions: currentData.specialInstructions,
        updatedAt: currentData.updatedAt || currentData.createdAt,
        updatedBy: userId || 'system',
      };

      updatePayload.version = newVersion;
      updatePayload.versionHistory = arrayUnion(historyEntry);

      // Size guard: if version history exceeds 50 entries, archive older entries to subcollection
      if (currentData.versionHistory && currentData.versionHistory.length > 50) {
        const toArchive = currentData.versionHistory.slice(0, currentData.versionHistory.length - 20); // keep last 20 in doc
        const keepRecent = currentData.versionHistory.slice(currentData.versionHistory.length - 20);

        // Archive to subcollection using writeBatch for atomic commit (max 500 ops)
        const batch = writeBatch(db);
        const archiveCol = collection(db, 'cateringTemplates', tmplId, 'versionArchive');
        for (const entry of toArchive) {
          batch.set(doc(archiveCol), entry);
        }
        await batch.commit();

        // Replace versionHistory with only recent entries
        updatePayload.versionHistory = keepRecent;
      }
    }
  }

  await updateDoc(tmplRef, updatePayload);
}

/**
 * Delete a template.
 */
export async function deleteOrderTemplate(tmplId: string): Promise<void> {
  await deleteDoc(doc(db, 'cateringTemplates', tmplId));
}

/**
 * Record a template usage (when someone uses a template to start an order).
 * Feature #31: Also records to usageLog subcollection.
 */
export async function recordTemplateUsage(tmplId: string, userId?: string): Promise<void> {
  const tmplRef = doc(db, 'cateringTemplates', tmplId);
  const snap = await getDoc(tmplRef);
  if (snap.exists()) {
    await updateDoc(tmplRef, {
      useCount: (snap.data().useCount || 0) + 1,
      lastUsedAt: serverTimestamp(),
    });

    // Feature #31: Add entry to usageLog subcollection
    await addDoc(collection(db, 'cateringTemplates', tmplId, 'usageLog'), {
      userId: userId || 'anonymous',
      usedAt: serverTimestamp(),
    });
  }
}

/**
 * Fetch public templates for discovery marketplace (Feature #29).
 */
export async function fetchPublicTemplates(options?: {
  cuisineCategory?: string;
  sortBy?: 'popular' | 'newest';
  limit?: number;
}): Promise<OrderTemplate[]> {
  const limitCount = options?.limit ?? 20;

  // Use single-field where to avoid composite index requirement; sort client-side
  const q = query(
    collection(db, 'cateringTemplates'),
    where('isPublic', '==', true),
  );

  const snap = await getDocs(q);
  const templates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderTemplate));

  // Client-side sort
  if (options?.sortBy === 'newest') {
    templates.sort((a, b) => {
      const aTime = toEpochMs(a.createdAt);
      const bTime = toEpochMs(b.createdAt);
      return bTime - aTime;
    });
  } else {
    templates.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
  }

  return templates.slice(0, limitCount);
}

/**
 * Fetch template usage stats (Feature #31).
 */
export async function fetchTemplateUsageStats(
  tmplId: string,
): Promise<{
  totalUses: number;
  last7Days: number;
  last30Days: number;
  recentUsers: Array<{ userId: string; usedAt: any }>;
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const usageLogCol = collection(db, 'cateringTemplates', tmplId, 'usageLog');
  const snap = await getDocs(usageLogCol);

  const allLogs = snap.docs.map((d) => ({
    userId: d.data().userId,
    usedAt: d.data().usedAt,
  }));

  const last7Days = allLogs.filter((log) => {
    const logTime = toDate(log.usedAt);
    return logTime >= sevenDaysAgo;
  }).length;

  const last30Days = allLogs.filter((log) => {
    const logTime = toDate(log.usedAt);
    return logTime >= thirtyDaysAgo;
  }).length;

  // Sort by recent and take first 5
  const recentUsers = allLogs
    .sort((a, b) => {
      const aTime = toEpochMs(a.usedAt);
      const bTime = toEpochMs(b.usedAt);
      return bTime - aTime;
    })
    .slice(0, 5);

  return {
    totalUses: allLogs.length,
    last7Days,
    last30Days,
    recentUsers,
  };
}

/**
 * Fetch archived version history entries (older versions moved to subcollection).
 */
export async function fetchArchivedVersions(templateId: string): Promise<any[]> {
  const q = query(
    collection(db, 'cateringTemplates', templateId, 'versionArchive'),
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Sort by version number descending
  results.sort((a: any, b: any) => (b.version || 0) - (a.version || 0));
  return results;
}

/**
 * Subscribe to templates for a user (own + org).
 */
export function subscribeToTemplates(
  userId: string,
  organizationId: string | null,
  callback: (templates: OrderTemplate[]) => void,
): Unsubscribe {
  // Subscribe to user's own templates
  const qOwn = query(
    collection(db, 'cateringTemplates'),
    where('creatorId', '==', userId),
  );

  let ownTemplates: OrderTemplate[] = [];
  let orgTemplates: OrderTemplate[] = [];

  const unsubOwn = onSnapshot(qOwn, (snap) => {
    ownTemplates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderTemplate));
    callback(dedupeTemplates([...ownTemplates, ...orgTemplates]));
  }, (err) => {
    console.warn('subscribeToTemplates (own) listener error:', err);
  });

  let unsubOrg: Unsubscribe | null = null;
  if (organizationId) {
    const qOrg = query(
      collection(db, 'cateringTemplates'),
      where('organizationId', '==', organizationId),
    );
    unsubOrg = onSnapshot(qOrg, (snap) => {
      orgTemplates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderTemplate));
      callback(dedupeTemplates([...ownTemplates, ...orgTemplates]));
    }, (err) => {
      console.warn('subscribeToTemplates (org) listener error:', err);
    });
  }

  return () => {
    unsubOwn();
    if (unsubOrg) unsubOrg();
  };
}
