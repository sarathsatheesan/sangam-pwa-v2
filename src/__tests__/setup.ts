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
      const col = q._col || q.collectionPath || '';
      const docs = firestoreStore[col] || {};
      const filters = q._filters || [];
      let entries = Object.entries(docs).map(([id, data]) => ({
        id,
        data: () => ({ ...data }),
        ref: mockDocRef(col, id),
        exists: () => true,
      }));
      // Apply where filters
      for (const f of filters) {
        entries = entries.filter((e) => {
          const val = e.data()[f.field];
          switch (f.op) {
            case '==': return val === f.value;
            case 'array-contains': return Array.isArray(val) && val.includes(f.value);
            default: return true;
          }
        });
      }
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
      for (const c of constraints) {
        if (c?._type === 'where') filters.push(c);
      }
      return { _col: colRef._col || colRef.path, _filters: filters, collectionPath: colRef._col || colRef.path };
    }),
    where: vi.fn((field: string, op: string, value: any) => ({ _type: 'where', field, op, value })),
    orderBy: vi.fn(() => ({ _type: 'orderBy' })),
    limit: vi.fn(() => ({ _type: 'limit' })),
    startAfter: vi.fn(() => ({ _type: 'startAfter' })),
    serverTimestamp: vi.fn(() => MockTimestamp.now()),
    onSnapshot: vi.fn((_q: any, onNext: any, _onError?: any) => {
      // Immediate fire with current data
      const col = _q._col || _q.collectionPath || '';
      const docs = firestoreStore[col] || {};
      const entries = Object.entries(docs).map(([id, data]) => ({
        id,
        data: () => ({ ...data }),
        ref: mockDocRef(col, id),
        exists: () => true,
      }));
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
vi.mock('@/services/catering/cateringNotifications', () => ({
  notifyCustomerStatusChange: vi.fn(async () => {}),
  notifyCustomerOrderModified: vi.fn(async () => {}),
  notifyVendorItemReassigned: vi.fn(async () => {}),
  notifyVendorsRfpEdited: vi.fn(async () => {}),
  notifyCustomerRfpExpired: vi.fn(async () => {}),
  notifyCustomerFinalizationExpired: vi.fn(async () => {}),
  sendCateringNotification: vi.fn(async () => {}),
}));
