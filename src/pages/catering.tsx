// ═════════════════════════════════════════════════════════════════════════════════
// CATERING PAGE
// Main entry for the catering module. Supports:
//   - Category grid browsing
//   - Menu item listing grouped by business
//   - Cart + checkout (Path A: Place Order)
//   - Request for Price (Path B: RFP — privacy-first quotes)
//   - My Quotes (customer views received quotes)
//   - Vendor dashboard (for business owners)
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useReducer, useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  ArrowLeft, ShoppingCart, ChefHat, Loader2, Store, Search,
  Send, FileText, ClipboardList, Star, Heart, Repeat, Share2, Pencil, Package,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { cateringReducer, createInitialState } from '@/reducers/cateringReducer';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { CateringMenuItem, OrderItem, QuoteRequestItem, CateringQuoteRequest, FavoriteOrder, OrderTemplate } from '@/services/cateringService';
import {
  fetchCateringBusinesses,
  fetchCateringBusinessesByCategory,
  fetchMenuItemsByCategory,
  createOrder,
  calculateOrderTotal,
  createQuoteRequest,
  updateQuoteRequest,
  isQuoteRequestEditable,
  quoteEditTimeRemaining,
  subscribeToCustomerQuoteRequests,
  saveFavoriteOrder,
} from '@/services/cateringService';
import {
  notifyQuoteRequestSubmitted,
  notifyQuoteRequestEdited,
} from '@/services/notificationService';

// ── Components (eager: lightweight, needed on first render) ──
import CateringCategoryGrid from '@/components/catering/CateringCategoryGrid';
import CateringItemList from '@/components/catering/CateringItemList';
import CateringCart from '@/components/catering/CateringCart';

// ── Components (lazy: heavy, only loaded when navigated to) ──
const CateringCheckout = React.lazy(() => import('@/components/catering/CateringCheckout'));
const VendorCateringDashboard = React.lazy(() => import('@/components/catering/VendorCateringDashboard'));
const VendorQuoteResponse = React.lazy(() => import('@/components/catering/VendorQuoteResponse'));
const RequestForPriceForm = React.lazy(() => import('@/components/catering/RequestForPriceForm'));
const QuoteComparison = React.lazy(() => import('@/components/catering/QuoteComparison'));
const CateringOrderStatus = React.lazy(() => import('@/components/catering/CateringOrderStatus'));
const VendorAnalytics = React.lazy(() => import('@/components/catering/VendorAnalytics'));
const CateringReviews = React.lazy(() => import('@/components/catering/CateringReviews'));

// Phase 6: Favorites, Recurring, Templates
const FavoriteOrders = React.lazy(() => import('@/components/catering/FavoriteOrders'));
const RecurringOrderManager = React.lazy(() => import('@/components/catering/RecurringOrderManager'));
const VendorInventoryManager = React.lazy(() => import('@/components/catering/VendorInventoryManager'));
const OrderTemplates = React.lazy(() => import('@/components/catering/OrderTemplates'));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
    </div>
  );
}

export default function CateringPage() {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const [state, dispatch] = useReducer(cateringReducer, undefined, createInitialState);
  const [businessCounts, setBusinessCounts] = useState<Record<string, number>>({});
  const [allCateringBusinesses, setAllCateringBusinesses] = useState<any[]>([]);
  const [userOwnedBusiness, setUserOwnedBusiness] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [vendorTab, setVendorTab] = useState<'orders' | 'quotes' | 'analytics' | 'reviews' | 'inventory'>('quotes');
  const [selectedQuoteRequest, setSelectedQuoteRequest] = useState<CateringQuoteRequest | null>(null);
  const [editingQuoteRequestId, setEditingQuoteRequestId] = useState<string | null>(null);
  const [selectedFavoriteForRecurring, setSelectedFavoriteForRecurring] = useState<FavoriteOrder | null>(null);
  const [selectedFavoriteForTemplate, setSelectedFavoriteForTemplate] = useState<FavoriteOrder | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const selectedQuoteRequestRef = useRef<CateringQuoteRequest | null>(null);

  // Vendor-switch dialog a11y (Escape + focus trap)
  const vendorSwitchClose = useCallback(
    () => dispatch({ type: 'CANCEL_VENDOR_SWITCH' }),
    [],
  );
  const { modalRef: vendorSwitchRef, handleKeyDown: vendorSwitchKeyDown } = useModalA11y(
    !!state.pendingVendorSwitch,
    vendorSwitchClose,
  );

  // Keep ref in sync with state so real-time subscription callback can access latest value
  useEffect(() => {
    selectedQuoteRequestRef.current = selectedQuoteRequest;
  }, [selectedQuoteRequest]);

  // ── Load all catering businesses on mount (for counts + vendor detection) ──
  useEffect(() => {
    fetchCateringBusinesses()
      .then((businesses) => {
        setAllCateringBusinesses(businesses);
        const counts: Record<string, number> = {};
        businesses.forEach((b) => {
          counts[b.category] = (counts[b.category] || 0) + 1;
        });
        setBusinessCounts(counts);
      })
      .catch((err) => console.warn('Failed to load catering business counts:', err));
  }, []);

  // ── Detect if current user owns ANY approved business (for vendor pill visibility) ──
  useEffect(() => {
    if (!user?.uid) { setUserOwnedBusiness(null); return; }
    // First check if they own a catering-enabled business
    const cateringBiz = allCateringBusinesses.find((b: any) => b.ownerId === user.uid);
    if (cateringBiz) {
      setUserOwnedBusiness(cateringBiz);
      return;
    }
    // Otherwise check all approved businesses (broader query)
    const q = query(
      collection(db, 'businesses'),
      where('ownerId', '==', user.uid),
      where('registrationStatus', '==', 'approved'),
    );
    getDocs(q).then((snap) => {
      if (!snap.empty) {
        const biz = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setUserOwnedBusiness(biz);
      }
    }).catch(() => {});
  }, [user?.uid, allCateringBusinesses]);

  // ── Cart persistence: hydrate from localStorage on mount ──
  const CART_STORAGE_KEY = 'ethniCity_catering_cart';
  const CART_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (
        stored?.version === 1 &&
        stored?.cart?.items?.length > 0 &&
        stored?.updatedAt &&
        Date.now() - new Date(stored.updatedAt).getTime() < CART_EXPIRY_MS
      ) {
        dispatch({ type: 'HYDRATE_CART', payload: stored.cart });
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cart persistence: save to localStorage on every cart change ──
  useEffect(() => {
    if (state.cart.items.length === 0) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return;
    }
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          cart: {
            items: state.cart.items,
            businessId: state.cart.businessId,
            businessName: state.cart.businessName,
          },
          updatedAt: new Date().toISOString(),
        })
      );
    } catch { /* quota exceeded — non-blocking */ }
  }, [state.cart.items, state.cart.businessId, state.cart.businessName]);

  // ── Load items when category is selected ──
  useEffect(() => {
    if (!state.selectedCategory) return;
    dispatch({ type: 'SET_LOADING', payload: true });

    Promise.all([
      fetchCateringBusinessesByCategory(state.selectedCategory),
      fetchMenuItemsByCategory(state.selectedCategory),
    ])
      .then(([businesses, items]) => {
        dispatch({ type: 'SET_BUSINESSES', payload: businesses });
        dispatch({ type: 'SET_MENU_ITEMS', payload: items });
      })
      .catch((err) => {
        dispatch({ type: 'SET_ERROR', payload: err.message || 'Failed to load menu items' });
      })
      .finally(() => {
        dispatch({ type: 'SET_LOADING', payload: false });
      });
  }, [state.selectedCategory]);

  // ── Real-time subscription to customer's quote requests ──
  useEffect(() => {
    if (!user) return;
    // Subscribe always (not just when viewing quotes) so data is ready when user navigates
    const unsub = subscribeToCustomerQuoteRequests(user.uid, (requests) => {
      dispatch({ type: 'SET_QUOTE_REQUESTS', payload: requests });
      // Keep selectedQuoteRequest in sync with latest data (item assignments, status)
      // Use ref to avoid stale closure — the effect only runs once per user
      const current = selectedQuoteRequestRef.current;
      if (current) {
        const updated = requests.find((r) => r.id === current.id);
        if (updated) setSelectedQuoteRequest(updated);
      }
    });
    return unsub;
  }, [user]);

  // ── Handlers ──
  const handleSelectCategory = useCallback((category: string) => {
    dispatch({ type: 'SET_CATEGORY', payload: category });
    dispatch({ type: 'SET_VIEW', payload: 'items' });
  }, []);

  const handleAddToCart = useCallback((item: CateringMenuItem) => {
    const biz = state.businesses.find((b: any) => b.id === item.businessId);
    const orderItem: OrderItem = {
      menuItemId: item.id,
      name: item.name,
      qty: item.minOrderQty || 1,
      unitPrice: item.price,
      pricingType: item.pricingType,
      ...(item.minOrderQty ? { minOrderQty: item.minOrderQty } : {}),
      ...(item.maxOrderQty ? { maxOrderQty: item.maxOrderQty } : {}),
    };
    dispatch({
      type: 'ADD_TO_CART',
      payload: {
        item: orderItem,
        businessId: item.businessId,
        businessName: biz?.name || 'Unknown Caterer',
      },
    });
    addToast(`${item.name} added to cart`, 'success', 2000);
  }, [state.businesses, addToast]);

  const handleUpdateCartQty = useCallback((menuItemId: string, qty: number) => {
    dispatch({ type: 'UPDATE_CART_ITEM', payload: { itemId: menuItemId, qty } });
  }, []);

  const handleRemoveFromCart = useCallback((menuItemId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: menuItemId });
  }, []);

  const handlePlaceOrder = useCallback(async () => {
    if (!user || !userProfile) {
      addToast('You must be logged in to place an order', 'error');
      return;
    }
    if (state.cart.items.length === 0 || !state.cart.businessId) {
      addToast('Your cart is empty', 'error');
      return;
    }
    const { orderForm, cart } = state;
    if (!orderForm.eventDate || !orderForm.headcount || !orderForm.contactName || !orderForm.contactPhone) {
      addToast('Please fill in all required fields', 'error');
      return;
    }
    if (!orderForm.deliveryAddress?.street || !orderForm.deliveryAddress?.city) {
      addToast('Please provide a delivery address', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const total = calculateOrderTotal(cart.items);
      await createOrder({
        customerId: user.uid,
        customerName: userProfile.name || '',
        customerEmail: userProfile.email || user.email || '',
        customerPhone: orderForm.contactPhone,
        businessId: cart.businessId!,
        businessName: cart.businessName || '',
        items: cart.items,
        subtotal: total,
        total,
        status: 'pending',
        eventDate: orderForm.eventDate,
        deliveryAddress: orderForm.deliveryAddress!,
        headcount: orderForm.headcount,
        ...(orderForm.specialInstructions ? { specialInstructions: orderForm.specialInstructions } : {}),
        orderForContext: orderForm.orderForContext,
        contactName: orderForm.contactName,
        contactPhone: orderForm.contactPhone,
      });

      // Auto-save as favorite for quick reorder
      try {
        await saveFavoriteOrder({
          userId: user.uid,
          businessId: cart.businessId!,
          businessName: cart.businessName || '',
          label: `${cart.businessName || 'Order'} — ${new Date().toLocaleDateString()}`,
          items: cart.items,
          headcount: orderForm.headcount,
          ...(orderForm.specialInstructions ? { specialInstructions: orderForm.specialInstructions } : {}),
          ...(orderForm.deliveryAddress ? { deliveryAddress: orderForm.deliveryAddress } : {}),
          orderForContext: orderForm.orderForContext,
        });
      } catch { /* non-blocking — don't fail the order */ }

      addToast('Order placed! Saved to Favorites for quick reorder.', 'success', 5000);
      dispatch({ type: 'CLEAR_CART' });
      localStorage.removeItem(CART_STORAGE_KEY);
      dispatch({ type: 'SET_VIEW', payload: 'orders' });
    } catch (err: any) {
      addToast(err.message || 'Failed to place order', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, userProfile, state, addToast]);

  // ── RFP Handlers ──
  const handleSubmitRFP = useCallback(async () => {
    if (!user) {
      addToast('You must be logged in to request quotes', 'error');
      return;
    }
    const { rfpForm } = state;
    if (!rfpForm.deliveryCity.trim() || !rfpForm.eventDate || rfpForm.headcount <= 0 || rfpForm.items.length === 0) {
      addToast('Please fill in all required fields and add at least one item', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingQuoteRequestId) {
        // ── Update existing quote request ──
        await updateQuoteRequest(editingQuoteRequestId, {
          deliveryCity: rfpForm.deliveryCity,
          eventType: rfpForm.eventType || undefined,
          eventDate: rfpForm.eventDate,
          headcount: rfpForm.headcount,
          items: rfpForm.items,
          specialInstructions: rfpForm.specialInstructions || '',
        });
        addToast('Quote request updated successfully!', 'success', 5000);
        // Fire-and-forget notification
        notifyQuoteRequestEdited(user.uid, editingQuoteRequestId, false, []).catch(() => {});
        setEditingQuoteRequestId(null);
      } else {
        // ── Create new quote request ──
        const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

        await createQuoteRequest({
          customerId: user.uid,
          deliveryCity: rfpForm.deliveryCity,
          cuisineCategory: state.selectedCategory || '',
          eventType: rfpForm.eventType || undefined,
          eventDate: rfpForm.eventDate,
          headcount: rfpForm.headcount,
          items: rfpForm.items,
          specialInstructions: rfpForm.specialInstructions || '',
          orderForContext: rfpForm.orderForContext,
          status: 'open',
          expiresAt,
          ...(rfpForm.targetBusinessIds.length > 0 ? { targetBusinessIds: rfpForm.targetBusinessIds } : {}),
        });

        addToast('Quote request sent! You can edit it within 24 hours (if the event is more than 2 days away).', 'success', 7000);
        // Fire-and-forget notification
        notifyQuoteRequestSubmitted(
          user.uid, '', state.selectedCategory || '', rfpForm.eventDate, rfpForm.headcount,
        ).catch(() => {});
      }
      dispatch({ type: 'CLEAR_RFP_FORM' });
      dispatch({ type: 'SET_VIEW', payload: 'quotes' });
    } catch (err: any) {
      addToast(err.message || 'Failed to submit quote request', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, state, addToast]);

  const handleBackToCategories = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'categories' });
    dispatch({ type: 'SET_CATEGORY', payload: null });
    setSelectedQuoteRequest(null);
  }, []);

  const handleBackToItems = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'items' });
  }, []);

  // Use the pre-loaded vendor business detection (covers all approved businesses, not just catering-enabled)
  const ownedBusiness = userOwnedBusiness;

  const cartItemCount = state.cart.items.reduce((sum, item) => sum + item.qty, 0);

  // View title
  const getTitle = () => {
    switch (state.view) {
      case 'categories': return '';
      case 'items': return state.selectedCategory || 'Menu';
      case 'checkout': return 'Checkout';
      case 'rfp': return 'Request for Price';
      case 'quotes': return selectedQuoteRequest ? 'Quote Responses' : 'My Quotes';
      case 'orders': return 'My Orders';
      case 'vendor': return 'Vendor Dashboard';
      case 'favorites': return 'My Favorites';
      case 'recurring': return 'Recurring Orders';
      case 'templates': return 'Order Templates';
      default: return 'Catering';
    }
  };

  // Back button handler
  const handleBack = () => {
    if (state.view === 'checkout') return handleBackToItems();
    if (state.view === 'rfp') return handleBackToItems();
    if (state.view === 'quotes' && selectedQuoteRequest) {
      setSelectedQuoteRequest(null);
      return;
    }
    if (state.view === 'orders') return handleBackToCategories();
    if (state.view === 'recurring') {
      setSelectedFavoriteForRecurring(null);
      dispatch({ type: 'SET_VIEW', payload: 'favorites' });
      return;
    }
    if (state.view === 'templates') {
      setSelectedFavoriteForTemplate(null);
      dispatch({ type: 'SET_VIEW', payload: 'favorites' });
      return;
    }
    if (state.view === 'favorites') return handleBackToCategories();
    return handleBackToCategories();
  };

  // ═══════════════════ RENDER ═══════════════════

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--aurora-bg, #F5F6FA)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b"
        style={{
          backgroundColor: 'var(--aurora-surface, #fff)',
          borderColor: 'var(--aurora-border, #E2E5EF)',
        }}
      >
        <div className="flex items-center gap-3">
          {state.view !== 'categories' && (
            <button
              onClick={handleBack}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} style={{ color: 'var(--aurora-text)' }} />
            </button>
          )}
          {getTitle() && (
            <div className="flex items-center gap-2">
              <ChefHat size={22} style={{ color: 'var(--aurora-primary, #6366F1)' }} />
              <h1 className="text-lg font-bold" style={{ color: 'var(--aurora-text, #1E2132)' }}>
                {getTitle()}
              </h1>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* My Orders pill — always visible when logged in */}
          {user && (
            <button
              onClick={() => {
                if (state.view === 'orders') {
                  dispatch({ type: 'SET_VIEW', payload: 'categories' });
                } else {
                  dispatch({ type: 'SET_VIEW', payload: 'orders' });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: state.view === 'orders' ? '#6366F1' : 'var(--aurora-surface-variant, #EDF0F7)',
                color: state.view === 'orders' ? '#fff' : 'var(--aurora-text-secondary)',
              }}
            >
              <ClipboardList size={16} />
              Orders
            </button>
          )}

          {/* My Quotes pill — always visible when logged in */}
          {user && (
            <button
              onClick={() => {
                if (state.view === 'quotes') {
                  dispatch({ type: 'SET_VIEW', payload: 'categories' });
                  setSelectedQuoteRequest(null);
                } else {
                  dispatch({ type: 'SET_VIEW', payload: 'quotes' });
                  setSelectedQuoteRequest(null);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: state.view === 'quotes' ? '#6366F1' : 'var(--aurora-surface-variant, #EDF0F7)',
                color: state.view === 'quotes' ? '#fff' : 'var(--aurora-text-secondary)',
              }}
            >
              <FileText size={16} />
              Quotes
            </button>
          )}

          {/* Phase 6 pills — Favorites dropdown */}
          {user && (
            <div className="relative group">
              <button
                onClick={() => {
                  if (state.view === 'favorites') {
                    dispatch({ type: 'SET_VIEW', payload: 'categories' });
                  } else {
                    dispatch({ type: 'SET_VIEW', payload: 'favorites' });
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: ['favorites', 'recurring', 'templates'].includes(state.view) ? '#6366F1' : 'var(--aurora-surface-variant, #EDF0F7)',
                  color: ['favorites', 'recurring', 'templates'].includes(state.view) ? '#fff' : 'var(--aurora-text-secondary)',
                }}
              >
                <Heart size={16} />
                Saved
              </button>
            </div>
          )}

          {/* Vendor pill — always visible when user owns a catering business */}
          {ownedBusiness && (
            <button
              onClick={() => {
                if (state.view === 'vendor') {
                  dispatch({ type: 'SET_VIEW', payload: 'categories' });
                } else {
                  dispatch({ type: 'SET_VIEW', payload: 'vendor' });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: state.view === 'vendor' ? '#6366F1' : 'var(--aurora-surface-variant, #EDF0F7)',
                color: state.view === 'vendor' ? '#fff' : 'var(--aurora-text-secondary)',
              }}
            >
              <Store size={16} />
              Vendor
            </button>
          )}

          {/* Cart button */}
          {!['checkout', 'vendor', 'rfp', 'quotes', 'orders'].includes(state.view) && (
            <button
              onClick={() => dispatch({ type: 'TOGGLE_CART' })}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ShoppingCart size={22} style={{ color: 'var(--aurora-text)' }} />
              {cartItemCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center"
                  style={{ backgroundColor: 'var(--aurora-primary, #6366F1)' }}
                >
                  {cartItemCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {/* Loading — show skeleton loaders instead of plain spinner */}
        {state.loading && state.view === 'items' && (
          <div className="space-y-6">
            {/* Search skeleton */}
            <div className="shimmer h-10 w-full rounded-lg" />
            {/* Filter pills skeleton */}
            <div className="flex gap-2">
              {[80, 64, 56, 72, 88].map((w, i) => (
                <div key={i} className="shimmer h-8 rounded-full" style={{ width: w }} />
              ))}
            </div>
            {/* Business group skeletons (2 groups) */}
            {[0, 1].map((g) => (
              <div key={g} className="space-y-4">
                {/* Business header */}
                <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                  <div>
                    <div className="shimmer h-5 w-36 rounded" />
                    <div className="shimmer h-3 w-24 rounded mt-2" />
                  </div>
                </div>
                {/* Item cards grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((c) => (
                    <div key={c} className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
                      <div className="shimmer h-32 w-full rounded-lg" />
                      <div className="shimmer h-4 w-3/4 rounded" />
                      <div className="shimmer h-3 w-1/2 rounded" />
                      <div className="flex justify-between items-center">
                        <div className="shimmer h-5 w-16 rounded" />
                        <div className="shimmer h-8 w-8 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {state.loading && state.view !== 'items' && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--aurora-primary)' }} />
            <span className="ml-3 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
              Loading...
            </span>
          </div>
        )}

        {/* Error */}
        {state.error && !state.loading && (
          <div className="text-center py-12">
            <p className="text-sm text-red-500 mb-2">{state.error}</p>
            <button
              onClick={handleBackToCategories}
              className="text-sm font-medium"
              style={{ color: 'var(--aurora-primary)' }}
            >
              Back to categories
            </button>
          </div>
        )}

        {/* Categories view */}
        {state.view === 'categories' && !state.loading && (
          <div>
            <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
              Browse caterers by cuisine type and place orders for your next event.
            </p>

            {/* Global cross-category search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search all menu items across categories..."
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  if (e.target.value.trim().length >= 2) {
                    dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value.trim() });
                    // Load all items for cross-category search
                    handleSelectCategory('all');
                  }
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500/30"
                style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)', color: 'var(--aurora-text)' }}
                aria-label="Search all catering items across categories"
              />
            </div>
            {allCateringBusinesses.length === 0 && !state.error ? (
              /* Category grid skeleton while business counts load */
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center justify-center rounded-xl bg-white p-6 border border-gray-100"
                    style={{ borderLeft: '4px solid #E5E7EB' }}
                  >
                    <div className="shimmer h-12 w-12 rounded-full mb-3" />
                    <div className="shimmer h-4 w-20 rounded mb-2" />
                    <div className="shimmer h-3 w-14 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <CateringCategoryGrid
                onSelectCategory={handleSelectCategory}
                businessCounts={businessCounts}
              />
            )}
          </div>
        )}

        {/* Items view — with RFP call-to-action */}
        {state.view === 'items' && !state.loading && !state.error && (
          <div>
            {/* RFP banner */}
            <div
              className="flex items-center justify-between p-4 rounded-2xl border mb-4"
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
                borderColor: 'rgba(99, 102, 241, 0.15)',
              }}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                  Not sure what to order?
                </p>
                <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                  Request quotes from multiple caterers. Your details stay private until you choose.
                </p>
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'rfp' })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white ml-3 flex-shrink-0"
                style={{ backgroundColor: '#6366F1' }}
              >
                <Send size={14} />
                Get Quotes
              </button>
            </div>

            <CateringItemList
              items={state.menuItems}
              businesses={state.businesses}
              onAddToCart={handleAddToCart}
              searchQuery={state.searchQuery}
              dietaryFilter={state.dietaryFilter}
              sortOrder={state.sortOrder}
              onSearchChange={(q) => dispatch({ type: 'SET_SEARCH_QUERY', payload: q })}
              onDietaryToggle={(tag) => dispatch({ type: 'TOGGLE_DIETARY_FILTER', payload: tag })}
              onClearDietaryFilter={() => dispatch({ type: 'CLEAR_DIETARY_FILTER' })}
              onSortChange={(sort) => dispatch({ type: 'SET_SORT_ORDER', payload: sort })}
            />
          </div>
        )}

        {/* Checkout view (Path A) */}
        {state.view === 'checkout' && (
          <React.Suspense fallback={<LazyFallback />}>
            <CateringCheckout
              cart={state.cart}
              orderForm={state.orderForm}
              onUpdateForm={(updates) => dispatch({ type: 'UPDATE_ORDER_FORM', payload: updates })}
              onPlaceOrder={handlePlaceOrder}
              onBack={handleBackToItems}
              loading={submitting}
            />
          </React.Suspense>
        )}

        {/* My Orders view with status timeline */}
        {state.view === 'orders' && (
          <React.Suspense fallback={<LazyFallback />}>
            <CateringOrderStatus onBack={handleBackToCategories} />
          </React.Suspense>
        )}

        {/* RFP form view (Path B) */}
        {state.view === 'rfp' && (
          <React.Suspense fallback={<LazyFallback />}>
          <RequestForPriceForm
            rfpForm={state.rfpForm}
            businesses={state.businesses}
            cuisineCategory={state.selectedCategory || ''}
            onUpdateForm={(updates) => dispatch({ type: 'UPDATE_RFP_FORM', payload: updates })}
            onAddItem={(item: QuoteRequestItem) => dispatch({ type: 'ADD_RFP_ITEM', payload: item })}
            onUpdateItem={(index: number, item: QuoteRequestItem) => dispatch({ type: 'UPDATE_RFP_ITEM', payload: { index, item } })}
            onRemoveItem={(index: number) => dispatch({ type: 'REMOVE_RFP_ITEM', payload: index })}
            onSubmit={handleSubmitRFP}
            onBack={handleBackToItems}
            loading={submitting}
          />
          </React.Suspense>
        )}

        {/* My Quotes view */}
        {state.view === 'quotes' && !selectedQuoteRequest && (
          <div className="max-w-2xl mx-auto space-y-4">
            <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
              Track your quote requests and compare responses from caterers.
            </p>

            {state.quoteRequests.length === 0 ? (
              <div className="text-center py-16">
                <FileText size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
                  No quote requests yet
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
                  Browse a category and tap "Get Quotes" to send your first RFP.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {state.quoteRequests.map((req) => {
                  const statusColors: Record<string, { bg: string; text: string }> = {
                    open: { bg: '#D1FAE5', text: '#059669' },
                    reviewing: { bg: '#EEF2FF', text: '#6366F1' },
                    partially_accepted: { bg: '#FEF3C7', text: '#D97706' },
                    accepted: { bg: '#DBEAFE', text: '#2563EB' },
                    expired: { bg: '#F3F4F6', text: '#6B7280' },
                    cancelled: { bg: '#FEE2E2', text: '#EF4444' },
                  };
                  const sc = statusColors[req.status] || statusColors.open;
                  const editable = isQuoteRequestEditable(req);
                  const editMs = editable ? quoteEditTimeRemaining(req) : 0;
                  const editHrsLeft = Math.ceil(editMs / (1000 * 60 * 60));

                  return (
                    <div
                      key={req.id}
                      className="rounded-2xl border overflow-hidden transition-colors hover:shadow-md"
                      style={{
                        backgroundColor: 'var(--aurora-surface)',
                        borderColor: 'var(--aurora-border)',
                      }}
                    >
                      <button
                        onClick={() => setSelectedQuoteRequest(req)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                              {req.cuisineCategory} Catering
                            </span>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize"
                              style={{ backgroundColor: sc.bg, color: sc.text }}
                            >
                              {req.status === 'partially_accepted' ? 'In Progress' : req.status}
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                            {req.eventType && <span className="capitalize">{req.eventType.replace(/_/g, ' ')} · </span>}
                            {req.headcount} guests · {req.deliveryCity} · {req.items.length} item{req.items.length !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-muted)' }}>
                            {req.responseCount} response{req.responseCount !== 1 ? 's' : ''}
                            {req.itemAssignments && req.itemAssignments.length > 0 && (
                              <span style={{ color: '#059669' }}>
                                {' '} · {req.itemAssignments.length}/{req.items.length} items assigned
                              </span>
                            )}
                            {req.expiresAt && req.status === 'open' && (() => {
                              const expiryDate = req.expiresAt?.toDate?.() || new Date(req.expiresAt);
                              const hoursLeft = Math.max(0, Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60)));
                              const daysLeft = Math.floor(hoursLeft / 24);
                              const isUrgent = hoursLeft < 24;
                              return (
                                <span style={{ color: isUrgent ? '#DC2626' : '#D97706' }}>
                                  {' '} · {daysLeft > 0 ? `${daysLeft}d left` : `${hoursLeft}h left`}
                                </span>
                              );
                            })()}
                          </p>
                        </div>
                        <ArrowLeft size={16} className="rotate-180 opacity-30 ml-2" />
                      </button>

                      {/* Edit strip — shown within 24hr window & event >2 days away */}
                      {editable && (
                        <div
                          className="flex items-center justify-between px-4 py-2 border-t"
                          style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'rgba(99,102,241,0.04)' }}
                        >
                          <span className="text-[11px]" style={{ color: 'var(--aurora-text-secondary)' }}>
                            Editable for {editHrsLeft}h
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingQuoteRequestId(req.id);
                              dispatch({
                                type: 'UPDATE_RFP_FORM',
                                payload: {
                                  deliveryCity: req.deliveryCity,
                                  eventType: req.eventType || '',
                                  eventDate: req.eventDate?.toDate?.()
                                    ? req.eventDate.toDate().toISOString().slice(0, 10)
                                    : (req.eventDate || ''),
                                  headcount: req.headcount,
                                  items: req.items,
                                  specialInstructions: req.specialInstructions || '',
                                },
                              });
                              dispatch({ type: 'SET_CATEGORY', payload: req.cuisineCategory });
                              dispatch({ type: 'SET_VIEW', payload: 'rfp' });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                            style={{ backgroundColor: '#6366F1' }}
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quote comparison view (viewing responses for a specific request) */}
        {state.view === 'quotes' && selectedQuoteRequest && (
          <React.Suspense fallback={<LazyFallback />}>
            <QuoteComparison
              quoteRequest={selectedQuoteRequest}
              onBack={() => setSelectedQuoteRequest(null)}
              onViewOrders={() => {
                setSelectedQuoteRequest(null);
                dispatch({ type: 'SET_VIEW', payload: 'orders' });
              }}
            />
          </React.Suspense>
        )}

        {/* Vendor dashboard with tabs */}
        {state.view === 'vendor' && ownedBusiness && (
          <div className="space-y-4">
            {/* Tab toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setVendorTab('quotes')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: vendorTab === 'quotes' ? '#6366F1' : 'var(--aurora-surface-variant)',
                  color: vendorTab === 'quotes' ? '#fff' : 'var(--aurora-text-secondary)',
                }}
              >
                Quote Requests
              </button>
              <button
                onClick={() => setVendorTab('orders')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: vendorTab === 'orders' ? '#6366F1' : 'var(--aurora-surface-variant)',
                  color: vendorTab === 'orders' ? '#fff' : 'var(--aurora-text-secondary)',
                }}
              >
                Direct Orders
              </button>
              <button
                onClick={() => setVendorTab('analytics')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: vendorTab === 'analytics' ? '#6366F1' : 'var(--aurora-surface-variant)',
                  color: vendorTab === 'analytics' ? '#fff' : 'var(--aurora-text-secondary)',
                }}
              >
                Analytics
              </button>
              <button
                onClick={() => setVendorTab('reviews')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: vendorTab === 'reviews' ? '#6366F1' : 'var(--aurora-surface-variant)',
                  color: vendorTab === 'reviews' ? '#fff' : 'var(--aurora-text-secondary)',
                }}
              >
                <Star size={14} />
                Reviews
              </button>
              <button
                onClick={() => setVendorTab('inventory')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: vendorTab === 'inventory' ? '#6366F1' : 'var(--aurora-surface-variant)',
                  color: vendorTab === 'inventory' ? '#fff' : 'var(--aurora-text-secondary)',
                }}
              >
                <Package size={14} />
                Inventory
              </button>
            </div>

            <React.Suspense fallback={<LazyFallback />}>
            {vendorTab === 'orders' && (
              <VendorCateringDashboard
                businessId={ownedBusiness.id}
                businessName={ownedBusiness.name}
              />
            )}
            {vendorTab === 'quotes' && (
              <VendorQuoteResponse
                businessId={ownedBusiness.id}
                businessName={ownedBusiness.name}
                businessHeritage={ownedBusiness.heritage}
                businessRating={ownedBusiness.rating}
              />
            )}
            {vendorTab === 'analytics' && (
                <VendorAnalytics
                  businessId={ownedBusiness.id}
                  businessName={ownedBusiness.name}
                />
            )}
            {vendorTab === 'reviews' && (
                <CateringReviews
                  businessId={ownedBusiness.id}
                  businessName={ownedBusiness.name}
                  isVendor={true}
                  onBack={() => setVendorTab('orders')}
                />
            )}
            {vendorTab === 'inventory' && (
                <VendorInventoryManager
                  businessId={ownedBusiness.id}
                  businessName={ownedBusiness.name}
                  onBack={() => setVendorTab('orders')}
                />
            )}
            </React.Suspense>
          </div>
        )}
        {/* Phase 6: Favorites view */}
        {state.view === 'favorites' && (
          <React.Suspense fallback={<LazyFallback />}>
            <FavoriteOrders
              onBack={handleBackToCategories}
              onSetupRecurring={(fav) => {
                setSelectedFavoriteForRecurring(fav);
                dispatch({ type: 'SET_VIEW', payload: 'recurring' });
              }}
              onCreateTemplate={(fav) => {
                setSelectedFavoriteForTemplate(fav);
                dispatch({ type: 'SET_VIEW', payload: 'templates' });
              }}
            />
          </React.Suspense>
        )}

        {/* Phase 6: Recurring Orders view */}
        {state.view === 'recurring' && (
          <React.Suspense fallback={<LazyFallback />}>
            <RecurringOrderManager
              onBack={() => {
                setSelectedFavoriteForRecurring(null);
                dispatch({ type: 'SET_VIEW', payload: 'favorites' });
              }}
              prefillFromFavorite={selectedFavoriteForRecurring}
            />
          </React.Suspense>
        )}

        {/* Phase 6: Order Templates view */}
        {state.view === 'templates' && (
          <React.Suspense fallback={<LazyFallback />}>
            <OrderTemplates
              onBack={() => {
                setSelectedFavoriteForTemplate(null);
                dispatch({ type: 'SET_VIEW', payload: 'favorites' });
              }}
              prefillFromFavorite={selectedFavoriteForTemplate}
              onUseTemplate={(tmpl) => {
                // Load template items into cart
                dispatch({ type: 'CLEAR_CART' });
                tmpl.items.forEach((item) => {
                  dispatch({
                    type: 'ADD_TO_CART',
                    payload: {
                      item,
                      businessId: tmpl.businessId,
                      businessName: tmpl.businessName,
                    },
                  });
                });
                dispatch({ type: 'SET_VIEW', payload: 'checkout' });
                addToast('Template loaded into cart! Customize and place your order.', 'success', 4000);
              }}
            />
          </React.Suspense>
        )}
      </div>

      {/* Cart slide-out */}
      <CateringCart
        items={state.cart.items}
        businessName={state.cart.businessName}
        isOpen={state.cartOpen}
        onClose={() => dispatch({ type: 'TOGGLE_CART' })}
        onUpdateQty={handleUpdateCartQty}
        onRemove={handleRemoveFromCart}
        onClear={() => dispatch({ type: 'CLEAR_CART' })}
        onCheckout={() => {
          dispatch({ type: 'TOGGLE_CART' });
          // Auto-populate checkout form from user profile
          if (userProfile) {
            const prefill: Record<string, any> = {};
            if (!state.orderForm.contactName && userProfile.name) prefill.contactName = userProfile.name;
            if (!state.orderForm.contactPhone && userProfile.phone) prefill.contactPhone = userProfile.phone;
            if (!state.orderForm.deliveryAddress?.city && userProfile.city) {
              prefill.deliveryAddress = {
                ...(state.orderForm.deliveryAddress || { street: '', city: '', state: '', zip: '' }),
                city: userProfile.city,
              };
            }
            if (Object.keys(prefill).length > 0) {
              dispatch({ type: 'UPDATE_ORDER_FORM', payload: prefill });
            }
          }
          dispatch({ type: 'SET_VIEW', payload: 'checkout' });
        }}
      />

      {/* Vendor switch confirmation dialog */}
      {state.pendingVendorSwitch && (
        <div
          ref={vendorSwitchRef}
          onKeyDown={vendorSwitchKeyDown}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Switch vendor confirmation"
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--aurora-surface, #fff)' }}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--aurora-text)' }}>
              Switch Vendor?
            </h3>
            <p className="text-sm mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
              Your cart has {state.cart.items.length} item{state.cart.items.length !== 1 ? 's' : ''} from{' '}
              <strong>{state.cart.businessName}</strong>.
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--aurora-text-secondary)' }}>
              Adding from <strong>{state.pendingVendorSwitch.businessName}</strong> will replace your current cart.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => dispatch({ type: 'CANCEL_VENDOR_SWITCH' })}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--aurora-border, #E2E5EF)', color: 'var(--aurora-text)' }}
              >
                Keep Current Cart
              </button>
              <button
                onClick={() => {
                  dispatch({ type: 'CONFIRM_VENDOR_SWITCH' });
                  addToast(`${state.pendingVendorSwitch!.item.name} added to cart`, 'success', 2000);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#6366F1' }}
              >
                Switch Vendor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
