// ═══════════════════════════════════════════════════════════════════════
// GLOBAL TEST SETUP — Firebase mock layer
// Intercepts all Firestore calls to provide deterministic unit testing
// without a live database connection.
// ═══════════════════════════════════════════════════════════════════════

import { vi } from 'vitest';

// ── Timestamp mock ──
export class MockTimestamp {
  constructor(public seconds: number, public nanoseconds: number = 0) {}
  toMillis() { return this.seconds * 1000; }
  static now() { return new MockTimestamp(Math.floor(Date.now() / 1000)); }
  static fromMillis(ms: number) { return new MockTimestamp(Math.floor(ms / 1000)); }
}

// ── In-memory Firestore store ──
// Keeps track of documents by collection path → docId → data
export const firestoreStore: Record<string, Record<string, any>> = {};

export function resetFirestoreStore() {
  for (const key of Object.keys(firestoreStore)) {
    delete firestoreStore[key];
  }
}

export function seedDoc(collectionPath: string, docId: string, data: any) {
  if (!firestoreStore[collectionPath]) firestoreStore[collectionPath] = {};
  firestoreStore[collectionPath][docId] = { ...data };
}

function getDocData(collectionPath: string, docId: string) {
  return firestoreStore[collectionPath]?.[docId] ?? null;
}

function setDocData(collectionPath: string, docId: string, data: any) {
  if (!firestoreStore[collectionPath]) firestoreStore[collectionPath] = {};
  firestoreStore[collectionPath][docId] = { ...data };
}

// Counter for auto-generating doc IDs
let autoIdCounter = 0;
function nextAutoId() { return `auto_${++autoIdCounter}`; }

// ── Mock document/collection references ──
function mockDocRef(collectionPath: string, docId: string) {
  return { id: docId, path: `${collectionPath}/${docId}`, _col: collectionPath, _id: docId };
}

function mockCollectionRef(collectionPath: string) {
  return { id: collectionPath, path: collectionPath, _col: collectionPath };
}

function mockSnap(collectionPath: string, docId: string) {
  const data = getDocData(collectionPath, docId);
  return {
    exists: () => data !== null,
    data: () => data ? { ...data } : undefined,
    id: docId,
    ref: mockDocRef(collectionPath, docId),
  };
}

// Normalize a value for orderBy comparison (Timestamp-likes → epoch millis)
function orderableValue(v: any) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v && typeof v.seconds === 'number') return v.seconds * 1000;
  return v;
}

// Materialize a mock query: apply where filters, orderBy sorts, then limit —
// mirroring real Firestore query semantics. Service code relies on
// server-side pagination (e.g. FIX-M1: orderBy('createdAt','desc') + limit()
// in subscribeToOrderNotes since commit d8a5072), so the mock must honor
// these constraints or pagination tests silently receive the whole collection.
function runQuery(q: any) {
  const col = q._col || q.collectionPath || q.path || '';
  const docs = firestoreStore[col] || {};
  let entries = Object.entries(docs).map(([id, data]) => ({
    id,
    data: () => ({ ...data }),
    ref: mockDocRef(col, id),
    exists: () => true,
  }));
  // Apply where filters
  for (const f of q._filters || []) {
    entries = entries.filter((e) => {
      const val = e.data()[f.field];
      switch (f.op) {
        case '==': return val === f.value;
        case 'array-contains': return Array.isArray(val) && val.includes(f.value);
        default: return true;
      }
    });
  }
  // Apply orderBy clauses (reversed stable sorts ⇒ multi-key ordering)
  for (const o of [...(q._orderBys || [])].reverse()) {
    entries.sort((a, b) => {
      const av = orderableValue(a.data()[o.field]);
      const bv = orderableValue(b.data()[o.field]);
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return o.direction === 'desc' ? -cmp : cmp;
    });
  }
  // Apply limit
  if (typeof q._limit === 'number') entries = entries.slice(0, q._limit);
  return entries;
}

// ── Firebase/Firestore mock ──

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((_db: any, ...pathSegments: string[]) => {
      const collectionPath = pathSegments.join('/');
      return mockCollectionRef(collectionPath);
    }),
    doc: vi.fn((_dbOrCol: any, ...args: string[]) => {
      // doc(db, 'collection', 'id') or doc(collectionRef, 'id') or doc(collection(db, a, b, c))
      if (_dbOrCol?._col) {
        // doc(collectionRef) — auto-generate ID
        if (args.length === 0) {
          const id = nextAutoId();
          return mockDocRef(_dbOrCol._col, id);
        }
        // doc(collectionRef, docId)
        return mockDocRef(_dbOrCol._col, args[0]);
      }
      // doc(db, col, id)
      if (args.length >= 2) {
        const colPath = args.slice(0, -1).join('/');
        const docId = args[args.length - 1];
        return mockDocRef(colPath, docId);
      }
      // doc(db, col) auto-ID
      return mockDocRef(args[0], nextAutoId());
    }),
    getDoc: vi.fn(async (ref: any) => mockSnap(ref._col, ref._id)),
    getDocs: vi.fn(async (q: any) => {
      const entries = runQuery(q);
      return { docs: entries, size: entries.length, empty: entries.length === 0 };
    }),
    addDoc: vi.fn(async (colRef: any, data: any) => {
      const id = nextAutoId();
      setDocData(colRef._col, id, { ...data, createdAt: MockTimestamp.now() });
      return mockDocRef(colRef._col, id);
    }),
    updateDoc: vi.fn(async (ref: any, data: any) => {
      const existing = getDocData(ref._col, ref._id);
      if (!existing) throw new Error('Document not found for update');
      setDocData(ref._col, ref._id, { ...existing, ...data });
    }),
    deleteDoc: vi.fn(async (ref: any) => {
      if (firestoreStore[ref._col]) {
        delete firestoreStore[ref._col][ref._id];
      }
    }),
    query: vi.fn((colRef: any, ...constraints: any[]) => {
      const filters: Array<{ field: string; op: string; value: any }> = [];
      const orderBys: Array<{ field: string; direction: 'asc' | 'desc' }> = [];
      let limitN: number | undefined;
      for (const c of constraints) {
        if (c?._type === 'where') filters.push(c);
        else if (c?._type === 'orderBy') orderBys.push(c);
        else if (c?._type === 'limit') limitN = c.n;
      }
      const col = colRef._col || colRef.path;
      return { _col: col, _filters: filters, _orderBys: orderBys, _limit: limitN, collectionPath: col };
    }),
    where: vi.fn((field: string, op: string, value: any) => ({ _type: 'where', field, op, value })),
    orderBy: vi.fn((field: string, direction: 'asc' | 'desc' = 'asc') => ({ _type: 'orderBy', field, direction })),
    limit: vi.fn((n: number) => ({ _type: 'limit', n })),
    startAfter: vi.fn(() => ({ _type: 'startAfter' })),
    serverTimestamp: vi.fn(() => MockTimestamp.now()),
    onSnapshot: vi.fn((_q: any, onNext: any, _onError?: any) => {
      // Immediate fire with current data (honors where/orderBy/limit like getDocs)
      const entries = runQuery(_q);
      if (typeof onNext === 'function') {
        onNext({ docs: entries, size: entries.length, empty: entries.length === 0 });
      }
      return vi.fn(); // unsubscribe
    }),
    arrayUnion: vi.fn((...items: any[]) => ({ _type: 'arrayUnion', items })),
    increment: vi.fn((n: number) => ({ _type: 'increment', value: n })),
    Timestamp: MockTimestamp,
    runTransaction: vi.fn(async (_db: any, updateFn: (transaction: any) => Promise<any>) => {
      // Simulate a transaction with get/update/set
      const transaction = {
        get: vi.fn(async (ref: any) => mockSnap(ref._col, ref._id)),
        update: vi.fn(async (ref: any, data: any) => {
          const existing = getDocData(ref._col, ref._id);
          if (!existing) throw new Error('Transaction: document not found');
          setDocData(ref._col, ref._id, { ...existing, ...data });
        }),
        set: vi.fn(async (ref: any, data: any) => {
          setDocData(ref._col, ref._id, data);
        }),
      };
      return updateFn(transaction);
    }),
    writeBatch: vi.fn(() => {
      const ops: Array<{ type: string; ref: any; data: any }> = [];
      return {
        set: vi.fn((ref: any, data: any) => ops.push({ type: 'set', ref, data })),
        update: vi.fn((ref: any, data: any) => ops.push({ type: 'update', ref, data })),
        delete: vi.fn((ref: any) => ops.push({ type: 'delete', ref, data: null })),
        commit: vi.fn(async () => {
          for (const op of ops) {
            if (op.type === 'set') setDocData(op.ref._col, op.ref._id, op.data);
            else if (op.type === 'update') {
              const existing = getDocData(op.ref._col, op.ref._id);
              setDocData(op.ref._col, op.ref._id, { ...existing, ...op.data });
            } else if (op.type === 'delete') {
              if (firestoreStore[op.ref._col]) delete firestoreStore[op.ref._col][op.ref._id];
            }
          }
        }),
      };
    }),
  };
});

// ── Mock firebase app ──
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({})),
}));

// ── Mock the local firebase config ──
vi.mock('@/services/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

// ── Mock notification service (non-critical side effects) ──
// ⚠ KEEP IN SYNC with the real exports of
//   src/services/catering/cateringNotifications.ts
// vi.mock() replaces the ENTIRE module, so any function exported there but
// missing here resolves to `undefined` — and the service that calls it blows
// up with a cryptic "notifyX is not a function" TypeError mid-test. This
// happened when notifyCustomerRfpCancelled was added (commit 5bec82d, "patch
// 12 notification gaps") without updating this mock, breaking the
// closeQuoteRequest tests. When you add a new export to
// cateringNotifications.ts, add a matching vi.fn() entry below.
// (The `CateringNotification` interface is type-only and needs no mock.)
vi.mock('@/services/catering/cateringNotifications', () => ({
  sendCateringNotification: vi.fn(async () => {}),
  notifyVendorNewOrder: vi.fn(async () => {}),
  notifyCustomerStatusChange: vi.fn(async () => {}),
  notifyCustomerOrderModified: vi.fn(async () => {}),
  notifyVendorModificationRejected: vi.fn(async () => {}),
  fetchCateringNotifications: vi.fn(async () => []),
  subscribeToCateringNotifications: vi.fn(() => vi.fn()),
  markNotificationRead: vi.fn(async () => {}),
  markAllNotificationsRead: vi.fn(async () => {}),
  getUnreadNotificationCount: vi.fn(async () => 0),
  notifyVendorItemReassigned: vi.fn(async () => {}),
  notifyVendorsRfpEdited: vi.fn(async () => {}),
  notifyCustomerRfpExpired: vi.fn(async () => {}),
  notifyCustomerFinalizationExpired: vi.fn(async () => {}),
  notifyVendorsNewQuoteRequest: vi.fn(async () => {}),
  notifyCustomerQuoteReceived: vi.fn(async () => {}),
  notifyVendorQuoteDeclined: vi.fn(async () => {}),
  notifyOrderCancelled: vi.fn(async () => {}),
  notifyVendorRfpCancelled: vi.fn(async () => {}),
  notifyCustomerRfpCancelled: vi.fn(async () => {}),
  notifyVendorQuoteAccepted: vi.fn(async () => {}),
  notifyVendorRepriceRequested: vi.fn(async () => {}),
  notifyCustomerRepriceResponse: vi.fn(async () => {}),
  notifyVendorCounterResolved: vi.fn(async () => {}),
}));
