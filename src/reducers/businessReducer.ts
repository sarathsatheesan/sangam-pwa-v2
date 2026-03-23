// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS PAGE STATE REDUCER
// Replaces 48 individual useState hooks with a single typed reducer.
// Every state transition is an explicit, traceable action.
// ═════════════════════════════════════════════════════════════════════════════════

import { QueryDocumentSnapshot } from 'firebase/firestore';
import { CATEGORIES } from '@/components/business/businessConstants';

// ── Interfaces (shared with business.tsx) ──

export interface Business {
  id: string;
  name: string;
  emoji: string;
  category: string;
  desc: string;
  location: string;
  phone?: string;
  website?: string;
  email?: string;
  hours?: string;
  rating: number;
  reviews: number;
  promoted: boolean;
  bgColor: string;
  ownerId?: string;
  heritage?: string | string[];
  menu?: string;
  services?: string;
  createdAt?: any;
  specialtyTags?: string[];
  paymentMethods?: string[];
  deliveryOptions?: string[];
  priceRange?: string;
  yearEstablished?: number;
  deals?: Deal[];
  photos?: string[];
  coverPhotoIndex?: number;
  isHidden?: boolean;
  hiddenAt?: string;
  hiddenReason?: string;
}

export interface Deal {
  id: string;
  title: string;
  description?: string;
  discount?: number;
  code?: string;
  expiresAt?: any;
}

export interface BusinessReview {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: any;
}

export interface BusinessOrder {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  items: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: any;
}

export interface MenuItem {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  available: boolean;
  createdAt: any;
}

// ── Form data shape ──

export interface BusinessFormData {
  name: string;
  category: string;
  desc: string;
  location: string;
  phone: string;
  website: string;
  email: string;
  hours: string;
  menu: string;
  services: string;
  priceRange: string;
  yearEstablished: number;
  paymentMethods: string[];
  deliveryOptions: string[];
  specialtyTags: string[];
}

// ── State shape ──

export interface BusinessState {
  // Data
  businesses: Business[];
  reviews: BusinessReview[];
  businessReviews: BusinessReview[];

  // Loading
  loading: boolean;
  loadingMore: boolean;
  saving: boolean;

  // UI: modals & panels
  showCreateModal: boolean;
  showTinVerificationModal: boolean;
  selectedBusiness: Business | null;
  isEditing: boolean;
  activeTab: 'about' | 'services' | 'reviews';
  showReviewForm: boolean;
  showDeleteConfirm: boolean;
  deleteBusinessId: string | null;

  // Search & filter
  selectedCategory: string;
  selectedHeritage: string[];
  searchQuery: string;
  debouncedSearchQuery: string;
  searchFocused: boolean;
  activeCollection: 'all' | 'topRated' | 'new' | 'mostReviewed' | 'favorites';

  // Favorites
  favorites: Set<string>;

  // Edit state
  editData: any;
  editPhotos: string[];
  editCoverPhotoIndex: number;

  // Reviews form
  newReview: { rating: number; text: string };

  // Toast
  toastMessage: string | null;

  // Create form
  formData: BusinessFormData;
  formErrors: Record<string, string>;
  formPhotos: string[];
  coverPhotoIndex: number;

  // Context menu
  menuBusinessId: string | null;
  menuPosition: { top: number; right: number } | null;

  // Report / Block / Mute
  showReportModal: boolean;
  reportBusinessId: string | null;
  reportReason: string;
  reportDetails: string;
  reportedBusinesses: Set<string>;
  mutedBusinesses: Set<string>;
  reportSubmitting: boolean;
  blockedUsers: Set<string>;
  showBlockConfirm: boolean;
  blockTargetUser: { uid: string; name: string } | null;

  // Pagination
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

// ── Initial state factory ──

export function createInitialState(): BusinessState {
  return {
    businesses: [],
    reviews: [],
    businessReviews: [],

    loading: true,
    loadingMore: false,
    saving: false,

    showCreateModal: false,
    showTinVerificationModal: false,
    selectedBusiness: null,
    isEditing: false,
    activeTab: 'about',
    showReviewForm: false,
    showDeleteConfirm: false,
    deleteBusinessId: null,

    selectedCategory: 'All',
    selectedHeritage: [],
    searchQuery: '',
    debouncedSearchQuery: '',
    searchFocused: false,
    activeCollection: 'all',

    favorites: new Set(),

    editData: {},
    editPhotos: [],
    editCoverPhotoIndex: 0,

    newReview: { rating: 5, text: '' },

    toastMessage: null,

    formData: {
      name: '',
      category: CATEGORIES[0],
      desc: '',
      location: '',
      phone: '',
      website: '',
      email: '',
      hours: '',
      menu: '',
      services: '',
      priceRange: '',
      yearEstablished: new Date().getFullYear(),
      paymentMethods: [],
      deliveryOptions: [],
      specialtyTags: [],
    },
    formErrors: {},
    formPhotos: [],
    coverPhotoIndex: 0,

    menuBusinessId: null,
    menuPosition: null,

    showReportModal: false,
    reportBusinessId: null,
    reportReason: '',
    reportDetails: '',
    reportedBusinesses: new Set(),
    mutedBusinesses: new Set(),
    reportSubmitting: false,
    blockedUsers: new Set(),
    showBlockConfirm: false,
    blockTargetUser: null,

    lastDoc: null,
    hasMore: true,
  };
}

// ── Action types ──

export type BusinessAction =
  // Data
  | { type: 'SET_BUSINESSES'; payload: Business[] }
  | { type: 'APPEND_BUSINESSES'; payload: Business[] }
  | { type: 'UPDATE_BUSINESS'; payload: Business }
  | { type: 'REMOVE_BUSINESS'; payload: string }
  | { type: 'SET_BUSINESS_REVIEWS'; payload: BusinessReview[] }
  | { type: 'ADD_OPTIMISTIC_REVIEW'; payload: BusinessReview }

  // Loading
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_MORE'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }

  // UI modals
  | { type: 'SELECT_BUSINESS'; payload: Business | null }
  | { type: 'SET_ACTIVE_TAB'; payload: 'about' | 'services' | 'reviews' }
  | { type: 'OPEN_CREATE_MODAL' }
  | { type: 'CLOSE_CREATE_MODAL' }
  | { type: 'SET_SHOW_TIN_MODAL'; payload: boolean }
  | { type: 'SET_IS_EDITING'; payload: boolean }
  | { type: 'SET_SHOW_REVIEW_FORM'; payload: boolean }
  | { type: 'OPEN_DELETE_CONFIRM'; payload: string }
  | { type: 'CLOSE_DELETE_CONFIRM' }

  // Search & filter
  | { type: 'SET_SELECTED_CATEGORY'; payload: string }
  | { type: 'SET_SELECTED_HERITAGE'; payload: string[] }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; payload: string }
  | { type: 'SET_SEARCH_FOCUSED'; payload: boolean }
  | { type: 'SET_ACTIVE_COLLECTION'; payload: 'all' | 'topRated' | 'new' | 'mostReviewed' | 'favorites' }

  // Favorites
  | { type: 'SET_FAVORITES'; payload: Set<string> }

  // Edit
  | { type: 'SET_EDIT_DATA'; payload: any }
  | { type: 'SET_EDIT_PHOTOS'; payload: string[] }
  | { type: 'SET_EDIT_COVER_INDEX'; payload: number }

  // Reviews form
  | { type: 'SET_NEW_REVIEW'; payload: { rating: number; text: string } }

  // Toast
  | { type: 'SET_TOAST'; payload: string | null }

  // Create form
  | { type: 'SET_FORM_DATA'; payload: BusinessFormData }
  | { type: 'UPDATE_FORM_FIELD'; field: string; value: any }
  | { type: 'SET_FORM_ERRORS'; payload: Record<string, string> }
  | { type: 'CLEAR_FORM_ERROR'; field: string }
  | { type: 'SET_FORM_PHOTOS'; payload: string[] }
  | { type: 'SET_COVER_PHOTO_INDEX'; payload: number }
  | { type: 'RESET_CREATE_FORM' }

  // Context menu
  | { type: 'OPEN_MENU'; payload: { businessId: string; position: { top: number; right: number } } }
  | { type: 'CLOSE_MENU' }

  // Report
  | { type: 'OPEN_REPORT'; payload: string }
  | { type: 'CLOSE_REPORT' }
  | { type: 'SET_REPORT_REASON'; payload: string }
  | { type: 'SET_REPORT_DETAILS'; payload: string }
  | { type: 'SET_REPORT_SUBMITTING'; payload: boolean }
  | { type: 'ADD_REPORTED_BUSINESS'; payload: string }
  | { type: 'SET_MUTED_BUSINESSES'; payload: Set<string> }
  | { type: 'ADD_MUTED_BUSINESS'; payload: string }

  // Block
  | { type: 'SET_BLOCKED_USERS'; payload: Set<string> }
  | { type: 'ADD_BLOCKED_USER'; payload: string }
  | { type: 'OPEN_BLOCK_CONFIRM'; payload: { uid: string; name: string } }
  | { type: 'CLOSE_BLOCK_CONFIRM' }

  // Pagination
  | { type: 'SET_LAST_DOC'; payload: QueryDocumentSnapshot | null }
  | { type: 'SET_HAS_MORE'; payload: boolean }
  | { type: 'RESET_PAGINATION' };

// ── Reducer ──

export function businessReducer(state: BusinessState, action: BusinessAction): BusinessState {
  switch (action.type) {
    // ── Data ──
    case 'SET_BUSINESSES':
      return { ...state, businesses: action.payload };
    case 'APPEND_BUSINESSES':
      return { ...state, businesses: [...state.businesses, ...action.payload] };
    case 'UPDATE_BUSINESS': {
      const updated = action.payload;
      return {
        ...state,
        businesses: state.businesses.map((b) => (b.id === updated.id ? updated : b)),
        selectedBusiness: state.selectedBusiness?.id === updated.id ? updated : state.selectedBusiness,
      };
    }
    case 'REMOVE_BUSINESS':
      return {
        ...state,
        businesses: state.businesses.filter((b) => b.id !== action.payload),
        selectedBusiness: state.selectedBusiness?.id === action.payload ? null : state.selectedBusiness,
      };
    case 'SET_BUSINESS_REVIEWS':
      return { ...state, businessReviews: action.payload };
    case 'ADD_OPTIMISTIC_REVIEW':
      return { ...state, businessReviews: [action.payload, ...state.businessReviews] };

    // ── Loading ──
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_LOADING_MORE':
      return { ...state, loadingMore: action.payload };
    case 'SET_SAVING':
      return { ...state, saving: action.payload };

    // ── UI modals ──
    case 'SELECT_BUSINESS':
      return { ...state, selectedBusiness: action.payload, activeTab: 'about', isEditing: false };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'OPEN_CREATE_MODAL':
      return { ...state, showCreateModal: true };
    case 'CLOSE_CREATE_MODAL':
      return { ...state, showCreateModal: false, formPhotos: [], coverPhotoIndex: 0, formErrors: {} };
    case 'SET_SHOW_TIN_MODAL':
      return { ...state, showTinVerificationModal: action.payload };
    case 'SET_IS_EDITING':
      return { ...state, isEditing: action.payload };
    case 'SET_SHOW_REVIEW_FORM':
      return { ...state, showReviewForm: action.payload };
    case 'OPEN_DELETE_CONFIRM':
      return { ...state, showDeleteConfirm: true, deleteBusinessId: action.payload };
    case 'CLOSE_DELETE_CONFIRM':
      return { ...state, showDeleteConfirm: false, deleteBusinessId: null };

    // ── Search & filter ──
    case 'SET_SELECTED_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    case 'SET_SELECTED_HERITAGE':
      return { ...state, selectedHeritage: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, debouncedSearchQuery: action.payload };
    case 'SET_SEARCH_FOCUSED':
      return { ...state, searchFocused: action.payload };
    case 'SET_ACTIVE_COLLECTION':
      return { ...state, activeCollection: action.payload };

    // ── Favorites ──
    case 'SET_FAVORITES':
      return { ...state, favorites: action.payload };

    // ── Edit ──
    case 'SET_EDIT_DATA':
      return { ...state, editData: action.payload };
    case 'SET_EDIT_PHOTOS':
      return { ...state, editPhotos: action.payload };
    case 'SET_EDIT_COVER_INDEX':
      return { ...state, editCoverPhotoIndex: action.payload };

    // ── Reviews form ──
    case 'SET_NEW_REVIEW':
      return { ...state, newReview: action.payload };

    // ── Toast ──
    case 'SET_TOAST':
      return { ...state, toastMessage: action.payload };

    // ── Create form ──
    case 'SET_FORM_DATA':
      return { ...state, formData: action.payload };
    case 'UPDATE_FORM_FIELD':
      return { ...state, formData: { ...state.formData, [action.field]: action.value } };
    case 'SET_FORM_ERRORS':
      return { ...state, formErrors: action.payload };
    case 'CLEAR_FORM_ERROR':
      return { ...state, formErrors: { ...state.formErrors, [action.field]: '' } };
    case 'SET_FORM_PHOTOS':
      return { ...state, formPhotos: action.payload };
    case 'SET_COVER_PHOTO_INDEX':
      return { ...state, coverPhotoIndex: action.payload };
    case 'RESET_CREATE_FORM':
      return {
        ...state,
        formData: createInitialState().formData,
        formPhotos: [],
        coverPhotoIndex: 0,
        formErrors: {},
        showCreateModal: false,
      };

    // ── Context menu ──
    case 'OPEN_MENU':
      return { ...state, menuBusinessId: action.payload.businessId, menuPosition: action.payload.position };
    case 'CLOSE_MENU':
      return { ...state, menuBusinessId: null, menuPosition: null };

    // ── Report ──
    case 'OPEN_REPORT':
      return {
        ...state,
        showReportModal: true,
        reportBusinessId: action.payload,
        reportReason: '',
        reportDetails: '',
        menuBusinessId: null,
        menuPosition: null,
      };
    case 'CLOSE_REPORT':
      return { ...state, showReportModal: false, reportBusinessId: null, reportReason: '', reportDetails: '' };
    case 'SET_REPORT_REASON':
      return { ...state, reportReason: action.payload };
    case 'SET_REPORT_DETAILS':
      return { ...state, reportDetails: action.payload };
    case 'SET_REPORT_SUBMITTING':
      return { ...state, reportSubmitting: action.payload };
    case 'ADD_REPORTED_BUSINESS': {
      const next = new Set(state.reportedBusinesses);
      next.add(action.payload);
      return { ...state, reportedBusinesses: next };
    }
    case 'SET_MUTED_BUSINESSES':
      return { ...state, mutedBusinesses: action.payload };
    case 'ADD_MUTED_BUSINESS': {
      const next = new Set(state.mutedBusinesses);
      next.add(action.payload);
      return { ...state, mutedBusinesses: next };
    }

    // ── Block ──
    case 'SET_BLOCKED_USERS':
      return { ...state, blockedUsers: action.payload };
    case 'ADD_BLOCKED_USER': {
      const next = new Set(state.blockedUsers);
      next.add(action.payload);
      return { ...state, blockedUsers: next };
    }
    case 'OPEN_BLOCK_CONFIRM':
      return { ...state, showBlockConfirm: true, blockTargetUser: action.payload, menuBusinessId: null, menuPosition: null };
    case 'CLOSE_BLOCK_CONFIRM':
      return { ...state, showBlockConfirm: false, blockTargetUser: null };

    // ── Pagination ──
    case 'SET_LAST_DOC':
      return { ...state, lastDoc: action.payload };
    case 'SET_HAS_MORE':
      return { ...state, hasMore: action.payload };
    case 'RESET_PAGINATION':
      return { ...state, lastDoc: null, hasMore: true };

    default:
      return state;
  }
}
