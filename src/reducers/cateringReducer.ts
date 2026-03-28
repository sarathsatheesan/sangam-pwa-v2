// ═════════════════════════════════════════════════════════════════════════════════
// CATERING MODULE STATE REDUCER
// Replaces multiple useState hooks with a single typed reducer.
// Every state transition is an explicit, traceable action.
// ═════════════════════════════════════════════════════════════════════════════════

import { QueryDocumentSnapshot } from 'firebase/firestore';
import type { CateringMenuItem, CateringOrder, OrderItem, DeliveryAddress, OrderForContext } from '@/services/cateringService';

// ── State shape ──

export interface CateringState {
  // Navigation
  view: 'categories' | 'items' | 'checkout' | 'orders' | 'vendor';
  selectedCategory: string | null;

  // Menu & Catalog
  menuItems: CateringMenuItem[];
  businesses: any[];

  // Cart management
  cart: {
    items: OrderItem[];
    businessId: string | null;
    businessName: string | null;
  };
  cartOpen: boolean;

  // Checkout flow
  checkoutStep: 'details' | 'review' | 'confirm';
  orderForm: {
    eventDate: string;
    headcount: number;
    deliveryAddress: DeliveryAddress | null;
    specialInstructions: string;
    contactName: string;
    contactPhone: string;
    orderForContext: OrderForContext;
  };

  // Orders history
  orders: CateringOrder[];

  // UI state
  loading: boolean;
  error: string | null;

  // Search & filtering
  searchQuery: string;
  dietaryFilter: string[];
}

// ── Initial state factory ──

export function createInitialState(): CateringState {
  return {
    view: 'categories',
    selectedCategory: null,

    menuItems: [],
    businesses: [],

    cart: {
      items: [],
      businessId: null,
      businessName: null,
    },
    cartOpen: false,

    checkoutStep: 'details',
    orderForm: {
      eventDate: '',
      headcount: 0,
      deliveryAddress: null,
      specialInstructions: '',
      contactName: '',
      contactPhone: '',
      orderForContext: { type: 'self' as const },
    },

    orders: [],

    loading: false,
    error: null,

    searchQuery: '',
    dietaryFilter: [],
  };
}

// ── Action types ──

export type CateringAction =
  // Navigation
  | { type: 'SET_VIEW'; payload: 'categories' | 'items' | 'checkout' | 'orders' | 'vendor' }
  | { type: 'SET_CATEGORY'; payload: string | null }

  // Menu & Catalog
  | { type: 'SET_MENU_ITEMS'; payload: CateringMenuItem[] }
  | { type: 'SET_BUSINESSES'; payload: any[] }

  // Cart management
  | {
      type: 'ADD_TO_CART';
      payload: {
        item: OrderItem;
        businessId: string;
        businessName: string;
      };
    }
  | {
      type: 'UPDATE_CART_ITEM';
      payload: {
        itemId: string;
        qty: number;
      };
    }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_CART' }

  // Checkout
  | { type: 'SET_CHECKOUT_STEP'; payload: 'details' | 'review' | 'confirm' }
  | {
      type: 'UPDATE_ORDER_FORM';
      payload: Partial<CateringState['orderForm']>;
    }

  // Orders history
  | { type: 'SET_ORDERS'; payload: CateringOrder[] }

  // UI state
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

  // Search & filtering
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'TOGGLE_DIETARY_FILTER'; payload: string }

  // Reset
  | { type: 'RESET' };

// ── Reducer ──

export function cateringReducer(state: CateringState, action: CateringAction): CateringState {
  switch (action.type) {
    // ── Navigation ──
    case 'SET_VIEW':
      return { ...state, view: action.payload };

    case 'SET_CATEGORY':
      return {
        ...state,
        selectedCategory: action.payload,
        menuItems: [],
        businesses: [],
      };

    // ── Menu & Catalog ──
    case 'SET_MENU_ITEMS':
      return { ...state, menuItems: action.payload };

    case 'SET_BUSINESSES':
      return { ...state, businesses: action.payload };

    // ── Cart management ──
    case 'ADD_TO_CART': {
      const { item, businessId, businessName } = action.payload;
      const nextCart = { ...state.cart };

      // If switching businesses, clear the cart first
      if (nextCart.businessId && nextCart.businessId !== businessId) {
        nextCart.items = [];
      }

      // Add or update item
      const existingIndex = nextCart.items.findIndex((i) => i.menuItemId === item.menuItemId);
      if (existingIndex >= 0) {
        nextCart.items[existingIndex] = {
          ...nextCart.items[existingIndex],
          qty: nextCart.items[existingIndex].qty + item.qty,
        };
      } else {
        nextCart.items.push(item);
      }

      nextCart.businessId = businessId;
      nextCart.businessName = businessName;

      return { ...state, cart: nextCart };
    }

    case 'UPDATE_CART_ITEM': {
      const { itemId, qty } = action.payload;
      const nextCart = { ...state.cart };

      if (qty <= 0) {
        nextCart.items = nextCart.items.filter((i) => i.menuItemId !== itemId);
      } else {
        nextCart.items = nextCart.items.map((i) =>
          i.menuItemId === itemId ? { ...i, qty } : i
        );
      }

      return { ...state, cart: nextCart };
    }

    case 'REMOVE_FROM_CART': {
      const nextCart = { ...state.cart };
      nextCart.items = nextCart.items.filter((i) => i.menuItemId !== action.payload);
      return { ...state, cart: nextCart };
    }

    case 'CLEAR_CART':
      return {
        ...state,
        cart: {
          items: [],
          businessId: null,
          businessName: null,
        },
      };

    case 'TOGGLE_CART':
      return { ...state, cartOpen: !state.cartOpen };

    // ── Checkout ──
    case 'SET_CHECKOUT_STEP':
      return { ...state, checkoutStep: action.payload };

    case 'UPDATE_ORDER_FORM':
      return {
        ...state,
        orderForm: { ...state.orderForm, ...action.payload },
      };

    // ── Orders history ──
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };

    // ── UI state ──
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    // ── Search & filtering ──
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'TOGGLE_DIETARY_FILTER': {
      const nextFilter = [...state.dietaryFilter];
      const index = nextFilter.indexOf(action.payload);
      if (index >= 0) {
        nextFilter.splice(index, 1);
      } else {
        nextFilter.push(action.payload);
      }
      return { ...state, dietaryFilter: nextFilter };
    }

    // ── Reset ──
    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

// ── Named exports (for consistency with businessReducer) ──

export { cateringReducer as default };
