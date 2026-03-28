// ═════════════════════════════════════════════════════════════════════════════════
// CATERING SERVICE
// Firestore CRUD for catering menu items, orders, and quote requests.
// Phase 1: Menu items + Direct Orders (Path A)
// ═════════════════════════════════════════════════════════════════════════════════

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ──

export interface CateringMenuItem {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  price: number;              // cents (1299 = $12.99)
  pricingType: 'per_person' | 'per_tray' | 'flat_rate';
  servesCount?: number;
  category: 'Appetizer' | 'Entree' | 'Side' | 'Dessert' | 'Beverage' | 'Package';
  dietaryTags?: string[];     // vegetarian, vegan, halal, kosher, gluten_free, dairy_free, nut_free
  photoUrl?: string;
  available: boolean;
  minOrderQty?: number;
  maxOrderQty?: number;
  createdAt?: any;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;          // cents
  pricingType: string;
  specialInstructions?: string;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
}

export interface OrderForContext {
  type: 'self' | 'individual' | 'organization' | 'anonymous';
  recipientName?: string;
  recipientContact?: string;
  organizationName?: string;
  department?: string;
  relationship?: string;
}

export interface CateringOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  businessId: string;
  businessName: string;
  items: OrderItem[];
  subtotal: number;           // cents
  tax?: number;               // cents
  total: number;              // cents
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  eventDate: any;
  deliveryAddress: DeliveryAddress;
  headcount: number;
  specialInstructions?: string;
  orderForContext?: OrderForContext;
  contactName: string;
  contactPhone: string;
  createdAt?: any;
  confirmedAt?: any;
  declinedReason?: string;
}

// ── Menu Items ──

const MENU_ITEMS_COL = 'cateringMenuItems';

export async function fetchMenuItemsByBusiness(businessId: string): Promise<CateringMenuItem[]> {
  const q = query(
    collection(db, MENU_ITEMS_COL),
    where('businessId', '==', businessId),
    where('available', '==', true),
    orderBy('category'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringMenuItem));
}

export async function fetchMenuItemsByCategory(cuisineCategory: string): Promise<CateringMenuItem[]> {
  // First get all catering-enabled businesses in this category
  const bizQ = query(
    collection(db, 'businesses'),
    where('category', '==', cuisineCategory),
    where('isCateringEnabled', '==', true),
  );
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
  const docRef = await addDoc(collection(db, MENU_ITEMS_COL), {
    ...item,
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

// ── Orders ──

const ORDERS_COL = 'cateringOrders';

export async function createOrder(order: Omit<CateringOrder, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, ORDERS_COL), {
    ...order,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function fetchOrdersByCustomer(customerId: string): Promise<CateringOrder[]> {
  const q = query(
    collection(db, ORDERS_COL),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringOrder));
}

export async function fetchOrdersByBusiness(businessId: string): Promise<CateringOrder[]> {
  const q = query(
    collection(db, ORDERS_COL),
    where('businessId', '==', businessId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringOrder));
}

export function subscribeToBusinessOrders(
  businessId: string,
  callback: (orders: CateringOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, ORDERS_COL),
    where('businessId', '==', businessId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as CateringOrder)));
  });
}

export async function updateOrderStatus(
  orderId: string,
  status: CateringOrder['status'],
  extra?: Record<string, any>,
): Promise<void> {
  const ref = doc(db, ORDERS_COL, orderId);
  const updates: Record<string, any> = { status, ...extra };
  if (status === 'confirmed') updates.confirmedAt = serverTimestamp();
  await updateDoc(ref, updates);
}

// ── Catering-enabled businesses ──

export async function fetchCateringBusinesses(): Promise<any[]> {
  const q = query(
    collection(db, 'businesses'),
    where('isCateringEnabled', '==', true),
    where('registrationStatus', '==', 'approved'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchCateringBusinessesByCategory(category: string): Promise<any[]> {
  const q = query(
    collection(db, 'businesses'),
    where('category', '==', category),
    where('isCateringEnabled', '==', true),
    where('registrationStatus', '==', 'approved'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Helpers ──

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function calculateOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
}
