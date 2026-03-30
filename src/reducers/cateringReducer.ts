// ═════════════════════════════════════════════════════════════════════════════════
// CATERING MODULE STATE REDUCER
// Replaces multiple useState hooks with a single typed reducer.
// Every state transition is an explicit, traceable action.
// ═════════════════════════════════════════════════════════════════════════════════

import { QueryDocumentSnapshot } from 'firebase/firestore';
import type { CateringMenuItem, CateringOrder, OrderItem, DeliveryAddress, OrderForContext, CateringQuoteRequest, CateringQuoteResponse, QuoteRequestItem, ItemAssignment, FavoriteOrder, RecurringOrder, OrderTemplate } from '@/services/cateringService';

// ── State shape ──

export interface CateringState {
  // Navigation
  view: 'categories' | 'items' | 'checkout' | 'orders' | 'vendor' | 'rfp' | 'quotes' | 'favorites' | 'recurring' | 'templates';
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

  // Vendor switch confirmation
  pendingVendorSwitch: {
    item: OrderItem;
    businessId: string;
    businessName: string;
  } | null;

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
  sortOrder: 'default' | 'price_asc' | 'price_desc' | 'rating' | 'name_asc';

  // Phase 6: Favorites, Recurring, Templates
  favorites: FavoriteOrder[];
  recurringOrders: RecurringOrder[];
  templates: OrderTemplate[];

  // Quote requests (Phase 2 - RFP)
  quoteRequests: CateringQuoteRequest[];
  quoteResponses: CateringQuoteResponse[];
  activeQuoteRequestId: string | null;
  rfpForm: {
    deliveryCity: string;
    eventType: string;
    eventDate: string;
    headcount: number;
    specialInstructions: string;
    items: QuoteRequestItem[];
    orderForContext: OrderForContext;
    targetBusinessIds: string[];
  };
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
    pendingVendorSwitch: null,

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

    favorites: [],
    recurringOrders: [],
    templates: [],

    loading: false,
    error: null,

    searchQuery: '',
    dietaryFilter: [],
    sortOrder: 'default',

    quoteRequests: [],
    quoteResponses: [],
    activeQuoteRequestId: null,
    rfpForm: {
      deliveryCity: '',
      eventType: '',
      eventDate: '',
      headcount: 0,
      specialInstructions: '',
      items: [],
      orderForContext: { type: 'self' as const },
      targetBusinessIds: [],
    },
  };
}

// ── Action types ──

export type CateringAction =
  // Navigation
  | { type: 'SET_VIEW'; payload: CateringState['view'] }
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
  | { type: 'CONFIRM_VENDOR_SWITCH' }
  | { type: 'CANCEL_VENDOR_SWITCH' }

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
  | { type: 'CLEAR_DIETARY_FILTER' }
  | { type: 'SET_SORT_ORDER'; payload: CateringState['sortOrder'] }

  // RFP (Phase 2)
  | { type: 'SET_QUOTE_REQUESTS'; payload: CateringQuoteRequest[] }
  | { type: 'SET_QUOTE_RESPONSES'; payload: CateringQuoteResponse[] }
  | { type: 'SET_ACTIVE_QUOTE_REQUEST'; payload: string | null }
  | { type: 'UPDATE_RFP_FORM'; payload: Partial<CateringState['rfpForm']> }
  | { type: 'ADD_RFP_ITEM'; payload: QuoteRequestItem }
  | { type: 'UPDATE_RFP_ITEM'; payload: { index: number; item: QuoteRequestItem } }
  | { type: 'REMOVE_RFP_ITEM'; payload: number }
  | { type: 'CLEAR_RFP_FORM' }

  // Phase 6: Favorites, Recurring, Templates
  | { type: 'SET_FAVORITES'; payload: FavoriteOrder[] }
  | { type: 'SET_RECURRING_ORDERS'; payload: RecurringOrder[] }
  | { type: 'SET_TEMPLATES'; payload: OrderTemplate[] }

  // Cart persistence
  | { type: 'HYDRATE_CART'; payload: { items: OrderItem[]; businessId: string; businessName: string } }

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

      // If switching businesses, ask for confirmation instead of silently clearing
      if (nextCart.businessId && nextCart.businessId !== businessId && nextCart.items.length > 0) {
        return {
          ...state,
          pendingVendorSwitch: { item, businessId, businessName },
        };
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

      return { ...state, cart: nextCart, pendingVendorSwitch: null };
    }

    case 'CONFIRM_VENDOR_SWITCH': {
      if (!state.pendingVendorSwitch) return state;
      const { item, businessId, businessName } = state.pendingVendorSwitch;
      return {
        ...state,
        cart: {
          items: [item],
          businessId,
          businessName,
        },
        pendingVendorSwitch: null,
      };
    }

    case 'CANCEL_VENDOR_SWITCH':
      return { ...state, pendingVendorSwitch: null };

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

    case 'CLEAR_DIETARY_FILTER':
      return { ...state, dietaryFilter: [] };

    case 'SET_SORT_ORDER':
      return { ...state, sortOrder: action.payload };

    // ── RFP (Phase 2) ──
    case 'SET_QUOTE_REQUESTS':
      return { ...state, quoteRequests: action.payload };

    case 'SET_QUOTE_RESPONSES':
      return { ...state, quoteResponses: action.payload };

    case 'SET_ACTIVE_QUOTE_REQUEST':
      return { ...state, activeQuoteRequestId: action.payload };

    case 'UPDATE_RFP_FORM':
      return { ...state, rfpForm: { ...state.rfpForm, ...action.payload } };

    case 'ADD_RFP_ITEM':
      return { ...state, rfpForm: { ...state.rfpForm, items: [...state.rfpForm.items, action.payload] } };

    case 'UPDATE_RFP_ITEM': {
      const items = [...state.rfpForm.items];
      items[action.payload.index] = action.payload.item;
      return { ...state, rfpForm: { ...state.rfpForm, items } };
    }

    case 'REMOVE_RFP_ITEM': {
      const items = state.rfpForm.items.filter((_, i) => i !== action.payload);
      return { ...state, rfpForm: { ...state.rfpForm, items } };
    }

    case 'CLEAR_RFP_FORM':
      return {
        ...state,
        rfpForm: {
          deliveryCity: '',
          eventType: '',
          eventDate: '',
          headcount: 0,
          specialInstructions: '',
          items: [],
          orderForContext: { type: 'self' as const },
          targetBusinessIds: [],
        },
      };

    // ── Phase 6: Favorites, Recurring, Templates ──
    case 'SET_FAVORITES':
      return { ...state, favorites: action.payload };

    case 'SET_RECURRING_ORDERS':
      return { ...state, recurringOrders: action.payload };

    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };

    // ── Cart persistence ──
    case 'HYDRATE_CART':
      return {
        ...state,
        cart: {
          items: action.payload.items,
          businessId: action.payload.businessId,
          businessName: action.payload.businessName,
        },
      };

    // ── Reset ──
    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

// ── Named exports (for consistency with businessReducer) ──

export { cateringReducer as default };
