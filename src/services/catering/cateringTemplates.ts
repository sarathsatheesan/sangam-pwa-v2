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
  Unsubscribe,
} from 'firebase/firestore';

import { db } from '../firebase';
import { OrderTemplate } from './cateringTypes';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a short unique share code.
 */
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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
    const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
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
 * Update a template.
 */
export async function updateOrderTemplate(
  tmplId: string,
  updates: Partial<OrderTemplate>,
): Promise<void> {
  const { id, ...data } = updates as any;
  await updateDoc(doc(db, 'cateringTemplates', tmplId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a template.
 */
export async function deleteOrderTemplate(tmplId: string): Promise<void> {
  await deleteDoc(doc(db, 'cateringTemplates', tmplId));
}

/**
 * Record a template usage (when someone uses a template to start an order).
 */
export async function recordTemplateUsage(tmplId: string): Promise<void> {
  const tmplRef = doc(db, 'cateringTemplates', tmplId);
  const snap = await getDoc(tmplRef);
  if (snap.exists()) {
    await updateDoc(tmplRef, {
      useCount: (snap.data().useCount || 0) + 1,
      lastUsedAt: serverTimestamp(),
    });
  }
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
    });
  }

  return () => {
    unsubOwn();
    if (unsubOrg) unsubOrg();
  };
}
