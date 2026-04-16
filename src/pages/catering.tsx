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
import ErrorBoundary from '@/components/ErrorBoundary';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  ArrowLeft, ShoppingCart, ChefHat, Loader2, Store, Search,
  Send, FileText, ClipboardList, Star, Heart, Repeat, Share2, Pencil, Package, CheckCircle,
  MoreHorizontal, UtensilsCrossed, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useBusinessSwitcher } from '@/contexts/BusinessSwitcherContext';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { cateringReducer, createInitialState } from '@/reducers/cateringReducer';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { CateringMenuItem, OrderItem, QuoteRequestItem, CateringQuoteRequest, FavoriteOrder, OrderTemplate } from '@/services/cateringService';
import {
  fetchCateringBusinesses,
  fetchCateringBusinessesByCategory,
  fetchMenuItemsByCategory,
  createOrder,
  calculateOrderTotal,
  formatPrice,
  createQuoteRequest,
  updateQuoteRequest,
  isQuoteRequestEditable,
  quoteEditTimeRemaining,
  subscribeToCustomerQuoteRequests,
  saveFavoriteOrder,
  notifyVendorNewOrder,
} from '@/services/cateringService';
import {
  notifyQuoteRequestSubmitted,
  notifyQuoteRequestEdited,
  notifyVendorsNewRFQ,
} from '@/services/notificationService';
import { notifyVendorsNewQuoteRequest } from '@/services/catering/cateringNotifications';

// ── Components (eager: lightweight, needed on first render) ──
import CateringCategoryGrid from '@/components/catering/CateringCategoryGrid';
import CateringItemList from '@/components/catering/CateringItemList';
import CateringCart from '@/components/catering/CateringCart';
import { BusinessSwitcher } from '@/components/layout/BusinessSwitcher';

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
const VendorMenuEditor = React.lazy(() => import('@/components/catering/VendorMenuEditor'));
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
  const { businesses: ownedBusinesses, selectedBusiness: ctxBusiness, selectBusiness, loading: bizLoading } = useBusinessSwitcher();
  const { businessId: routeBusinessId } = useParams<{ businessId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, dispatch] = useReducer(cateringReducer, undefined, createInitialState);
  const [businessCounts, setBusinessCounts] = useState<Record<string, number>>({});
  const [allCateringBusinesses, setAllCateringBusinesses] = useState<any[]>([]);

  // ── Multi-business: resolve owned business from URL param or context ──
  const userOwnedBusiness = useMemo(() => {
    // If URL has a businessId, find it in the user's owned list
    if (routeBusinessId) {
      return ownedBusinesses.find((b) => b.id === routeBusinessId) || null;
    }
    // Otherwise use the context-selected business
    return ctxBusiness;
  }, [routeBusinessId, ownedBusinesses, ctxBusiness]);

  // Sync URL businessId → context when entering via direct link
  useEffect(() => {
    if (routeBusinessId && ctxBusiness?.id !== routeBusinessId && ownedBusinesses.some((b) => b.id === routeBusinessId)) {
      selectBusiness(routeBusinessId);
    }
  }, [routeBusinessId, ctxBusiness?.id, ownedBusinesses, selectBusiness]);

  // Auto-switch to vendor view whenever a user lands on /vendor/:id/* with a
  // non-vendor view — whether by direct URL, deep link, or browser back from a
  // personal-scope route. The earlier race (navigate('/catering') + SET_VIEW
  // dispatching on separate render ticks caused this effect to clobber the
  // personal view during the intermediate tick) is prevented via the
  // suppressVendorAutoSwitchRef below: switchToPersonalView sets it so the
  // first post-click render skips this effect, and it clears on the next tick
  // once React-Router has propagated the new (empty) routeBusinessId.
  const suppressVendorAutoSwitchRef = useRef(false);
  useEffect(() => {
    if (suppressVendorAutoSwitchRef.current) {
      suppressVendorAutoSwitchRef.current = false;
      return;
    }
    if (routeBusinessId && userOwnedBusiness && state.view !== 'vendor') {
      dispatch({ type: 'SET_VIEW', payload: 'vendor' });
    }
  }, [routeBusinessId, userOwnedBusiness, state.view]);

  // ── Deep-link handling: navigate from notification click to specific order/quote ──
  // Reads ?view=orders&orderId=xxx or ?view=quotes&quoteRequestId=xxx from URL.
  // Sets the correct view, expands the order (via hash), or selects the quote.
  // Consumes the params after processing to keep the URL clean.
  // Runs once on mount + whenever searchParams change (e.g. service worker navigates).
  const deepLinkProcessedRef = useRef(false);
  useEffect(() => {
    const viewParam = searchParams.get('view');
    const orderIdParam = searchParams.get('orderId');
    const quoteRequestIdParam = searchParams.get('quoteRequestId');
    const vendorViewParam = searchParams.get('vendorView');

    if (!viewParam && !orderIdParam && !quoteRequestIdParam && !vendorViewParam) return;

    // Prevent double-processing in StrictMode / fast re-renders
    if (deepLinkProcessedRef.current) return;
    deepLinkProcessedRef.current = true;

    // Vendor order deep-link: /catering?vendorView=orders&orderId=xxx
    // MUST be checked before the customer order branch, because both may
    // include orderId — vendorView disambiguates.
    if (vendorViewParam === 'orders') {
      dispatch({ type: 'SET_VIEW', payload: 'vendor' });
      setVendorTab('orders');
      if (orderIdParam) {
        window.history.replaceState(null, '', `${window.location.pathname}#order-${orderIdParam}`);
      }
    }
    // Customer order deep-link: /catering?view=orders&orderId=xxx
    else if (viewParam === 'orders' || orderIdParam) {
      dispatch({ type: 'SET_VIEW', payload: 'orders' });
      // CateringOrderStatus reads #order-{id} from hash to auto-expand
      if (orderIdParam) {
        window.history.replaceState(null, '', `${window.location.pathname}#order-${orderIdParam}`);
      }
    }
    // Customer quote deep-link: /catering?view=quotes&quoteRequestId=xxx
    else if (viewParam === 'quotes' || quoteRequestIdParam) {
      dispatch({ type: 'SET_VIEW', payload: 'quotes' });
      // If we have a quoteRequestId, we need to find and select the quote request
      // once the real-time subscription delivers it. Store it for deferred selection.
      if (quoteRequestIdParam) {
        pendingDeepLinkQuoteRef.current = quoteRequestIdParam;
      }
    }

    // Clean up search params to keep URL tidy (without triggering navigation)
    const cleaned = new URLSearchParams(searchParams);
    cleaned.delete('view');
    cleaned.delete('orderId');
    cleaned.delete('quoteRequestId');
    cleaned.delete('vendorView');
    const remaining = cleaned.toString();
    // Use replaceState to avoid adding a history entry
    const hash = window.location.hash;
    window.history.replaceState(
      null, '',
      window.location.pathname + (remaining ? `?${remaining}` : '') + hash,
    );

    // Reset processed flag after a tick so future deep-link navigations work
    requestAnimationFrame(() => { deepLinkProcessedRef.current = false; });
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deferred quote selection: when deep-linking to a quote, the real-time
  // subscription may not have delivered the data yet. This ref holds the
  // pending quoteRequestId and the subscription effect below resolves it.
  const pendingDeepLinkQuoteRef = useRef<string | null>(null);

  // Switch from Vendor context into a Personal-scope view (My Orders, My Quotes,
  // Saved Orders, Templates). If we're currently on the /vendor/:id/dashboard
  // route, navigate to /catering first so the auto-switch effect above doesn't
  // immediately force state.view back to 'vendor'. Works identically on Chrome,
  // Safari, Firefox desktop + iOS Safari + Android Chrome because it uses
  // react-router-dom navigate() (pushState under the hood with popstate fallback).
  const switchToPersonalView = useCallback(
    (view: 'orders' | 'quotes' | 'favorites' | 'templates' | 'categories') => {
      if (routeBusinessId) {
        // Arm the auto-switch suppressor for the in-between render where
        // React-Router hasn't yet published the new (empty) businessId.
        suppressVendorAutoSwitchRef.current = true;
        navigate('/catering');
      }
      dispatch({ type: 'SET_VIEW', payload: view });
    },
    [routeBusinessId, navigate],
  );
  const [submitting, setSubmitting] = useState(false);
  const [vendorTab, setVendorTab] = useState<'orders' | 'quotes' | 'analytics' | 'reviews' | 'inventory' | 'menu'>('quotes');
  const [selectedQuoteRequest, setSelectedQuoteRequest] = useState<CateringQuoteRequest | null>(null);
  const [editingQuoteRequestId, setEditingQuoteRequestId] = useState<string | null>(null);
  const [selectedFavoriteForRecurring, setSelectedFavoriteForRecurring] = useState<FavoriteOrder | null>(null);
  const [selectedFavoriteForTemplate, setSelectedFavoriteForTemplate] = useState<FavoriteOrder | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false); // SB-06: "More" dropdown for secondary pills
  const selectedQuoteRequestRef = useRef<CateringQuoteRequest | null>(null);
  const businessesRef = useRef<any[]>([]); // F-10: stable ref to avoid useCallback recreation

  // Keep businesses ref in sync with state
  useEffect(() => {
    businessesRef.current = state.businesses;
  }, [state.businesses]);

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

  // ── Business detection now handled by BusinessSwitcherContext ──
  // (Removed old single-business Firestore query — context provides real-time list)

  // ── Deep-link: listen for service worker NOTIFICATION_CLICK messages (Firefox fallback) ──
  // When the service worker can't use client.navigate() it falls back to postMessage.
  // We parse the URL and apply the same deep-link logic as the searchParams effect.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    function handleSWMessage(event: MessageEvent) {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.url) {
        try {
          const url = new URL(event.data.url, window.location.origin);
          if (url.pathname === '/catering' || url.pathname.startsWith('/catering')) {
            const orderId = url.searchParams.get('orderId');
            const quoteRequestId = url.searchParams.get('quoteRequestId');
            const view = url.searchParams.get('view');
            const vendorView = url.searchParams.get('vendorView');

            // Vendor check first — both vendor and customer may have orderId;
            // vendorView disambiguates.
            if (vendorView === 'orders') {
              dispatch({ type: 'SET_VIEW', payload: 'vendor' });
              setVendorTab('orders');
              if (orderId) {
                window.history.replaceState(null, '', `${window.location.pathname}#order-${orderId}`);
              }
            } else if (view === 'orders' || orderId) {
              dispatch({ type: 'SET_VIEW', payload: 'orders' });
              if (orderId) {
                window.history.replaceState(null, '', `${window.location.pathname}#order-${orderId}`);
              }
            } else if (view === 'quotes' || quoteRequestId) {
              dispatch({ type: 'SET_VIEW', payload: 'quotes' });
              if (quoteRequestId) {
                pendingDeepLinkQuoteRef.current = quoteRequestId;
              }
            }
          }
        } catch { /* malformed URL — ignore */ }
      }
    }
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        // F-08: Also clear orphaned checkout form if cart expired/empty
        try { sessionStorage.removeItem('sangam_catering_order_form'); } catch {}
      }
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY);
      try { sessionStorage.removeItem('sangam_catering_order_form'); } catch {}
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

      // Deep-link: if a pending quoteRequestId was set by the deep-link effect,
      // select it now that real-time data is available
      if (pendingDeepLinkQuoteRef.current) {
        const target = requests.find((r) => r.id === pendingDeepLinkQuoteRef.current);
        if (target) {
          setSelectedQuoteRequest(target);
          pendingDeepLinkQuoteRef.current = null;
        }
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
    const biz = businessesRef.current.find((b: any) => b.id === item.businessId);
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
  }, [addToast]);

  const handleUpdateCartQty = useCallback((menuItemId: string, qty: number) => {
    dispatch({ type: 'UPDATE_CART_ITEM', payload: { itemId: menuItemId, qty } });
  }, []);

  const handleRemoveFromCart = useCallback((menuItemId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: menuItemId });
  }, []);

  const handlePlaceOrder = useCallback(async () => {
    // Guard against double-submit
    if (submitting) return;
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
      const subtotal = calculateOrderTotal(cart.items);
      // SB-02: Include estimated tax in the order total so cart and order match
      const ESTIMATED_TAX_RATE = 0.0825;
      const estimatedTax = Math.round(subtotal * ESTIMATED_TAX_RATE);
      const total = subtotal + estimatedTax;
      const orderId = await createOrder({
        customerId: user.uid,
        customerName: userProfile.name || '',
        customerEmail: userProfile.email || user.email || '',
        customerPhone: orderForm.contactPhone,
        businessId: cart.businessId!,
        businessName: cart.businessName || '',
        items: cart.items,
        subtotal,
        tax: estimatedTax,
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

      // Notify vendor of new order (Sprint 27 — U-12)
      // Resolve ownerId from business doc — notifyVendorNewOrder expects a userId, not businessId (F-01 fix)
      const vendorBiz = allCateringBusinesses.find((b: any) => b.id === cart.businessId);
      if (vendorBiz?.ownerId) {
        notifyVendorNewOrder(
          vendorBiz.ownerId,
          orderId,
          userProfile?.name || user.email || 'Customer',
          cart.businessName || 'Business',
          total,
        ).catch(console.warn);
      }

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

      // SB-01: Show order confirmation screen instead of jumping to orders list
      dispatch({
        type: 'SET_ORDER_CONFIRMATION',
        payload: {
          orderId,
          businessName: cart.businessName || '',
          total,
          tax: estimatedTax,
          subtotal,
          itemCount: cart.items.length,
          eventDate: orderForm.eventDate,
          contactName: orderForm.contactName,
        },
      });
      dispatch({ type: 'CLEAR_CART' });
      localStorage.removeItem(CART_STORAGE_KEY);
      dispatch({ type: 'SET_VIEW', payload: 'order_confirmation' });
      addToast('Order placed successfully!', 'success', 3000);
    } catch (err: any) {
      addToast(err.message || 'Failed to place order', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, userProfile, state, addToast, allCateringBusinesses, submitting]);

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

        const newRequestId = await createQuoteRequest({
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
        // Fire-and-forget: notify customer (email/SMS/push)
        notifyQuoteRequestSubmitted(
          user.uid, newRequestId, state.selectedCategory || '', rfpForm.eventDate, rfpForm.headcount,
        ).catch(() => {});

        // Fire-and-forget: notify vendors (in-app + email/SMS/push)
        // For targeted RFPs, notify only those businesses. For broadcast, skip (vendors discover via dashboard).
        if (rfpForm.targetBusinessIds.length > 0) {
          (async () => {
            try {
              const ownerIds: string[] = [];
              for (const bizId of rfpForm.targetBusinessIds) {
                const bizSnap = await getDoc(doc(db, 'businesses', bizId));
                const ownerId = bizSnap.data()?.ownerId;
                if (ownerId) ownerIds.push(ownerId);
              }
              if (ownerIds.length > 0) {
                // In-app bell notifications
                notifyVendorsNewQuoteRequest(
                  ownerIds, newRequestId, state.selectedCategory || '', rfpForm.deliveryCity,
                  rfpForm.headcount, rfpForm.eventDate,
                ).catch(() => {});
                // Multi-channel (email/SMS/push)
                notifyVendorsNewRFQ(
                  ownerIds, newRequestId, state.selectedCategory || '', rfpForm.deliveryCity, rfpForm.headcount,
                ).catch(() => {});
              }
            } catch { /* non-blocking */ }
          })();
        }
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

  // View title — 'vendor' returns empty string so only the Chef-cap icon renders
  // in the sticky header (the Dashboard CTA + breadcrumb already identify the route).
  const getTitle = () => {
    switch (state.view) {
      case 'categories': return '';
      case 'items': return state.selectedCategory || 'Menu';
      case 'checkout': return 'Checkout';
      case 'rfp': return 'Request for Price';
      case 'quotes': return selectedQuoteRequest ? 'Quote Responses' : 'My Quotes';
      case 'orders': return 'My Orders';
      case 'order_confirmation': return 'Order Confirmed';
      case 'vendor': return '';
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
    if (state.view === 'order_confirmation') {
      dispatch({ type: 'SET_VIEW', payload: 'orders' });
      dispatch({ type: 'SET_ORDER_CONFIRMATION', payload: null });
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
      {/* Header — responsive: stacks title + pills vertically on mobile */}
      <div
        className="sticky top-0 z-30 px-4 py-3 border-b"
        style={{
          backgroundColor: 'var(--aurora-surface, #fff)',
          borderColor: 'var(--aurora-border, #E2E5EF)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {state.view !== 'categories' && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg transition-colors shrink-0"
                style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--aurora-bg)' }}
              >
                <ArrowLeft size={20} style={{ color: 'var(--aurora-text)' }} />
              </button>
            )}
            {/* On the vendor view the title text is intentionally empty so only the
                Chef-cap icon shows (the Dashboard CTA + breadcrumb identify the route).
                On every other view the icon + title text render together as before. */}
            {(getTitle() || state.view === 'vendor') && (
              <div className="flex items-center gap-2 min-w-0">
                <ChefHat size={22} className="shrink-0" style={{ color: 'var(--aurora-primary, #6366F1)' }} />
                <h1 className="text-lg font-bold truncate hidden sm:block" style={{ color: 'var(--aurora-text, #1E2132)' }}>
                  {getTitle()}
                </h1>
                {/* Mobile: shorter title to prevent truncation */}
                <h1 className="text-base font-bold truncate sm:hidden" style={{ color: 'var(--aurora-text, #1E2132)' }}>
                  {(() => {
                    const title = getTitle();
                    const shortNames: Record<string, string> = {
                      'Restaurant & Food': 'Food',
                      'Grocery & Market': 'Grocery',
                      'Vendor Dashboard': 'Dashboard',
                      'My Orders': 'Orders',
                      'My Quotes': 'Quotes',
                      'Saved Orders': 'Saved',
                      'Request for Price': 'RFP',
                      'Quote Responses': 'Quotes',
                      'Order Confirmed': 'Confirmed',
                      'My Favorites': 'Favorites',
                      'Recurring Orders': 'Recurring',
                      'Order Templates': 'Templates',
                    };
                    return shortNames[title || ''] || title;
                  })()}
                </h1>
              </div>
            )}
          </div>

          {/* Pills row — scrollable on mobile, flex-wrap on larger screens */}
          <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* "My Orders" pill — always visible when logged in.
              Labeled "My Orders" (not just "Orders") so vendors can clearly
              distinguish their personal buyer orders from the vendor orders
              managed inside the Vendor Dashboard. Routes through
              switchToPersonalView so a vendor-context user (on
              /vendor/:id/dashboard) drops the vendor route and lands on their
              personal orders, not a vendor-scoped view. */}
          {user && (
            <button
              onClick={() => {
                if (state.view === 'orders') {
                  switchToPersonalView('categories');
                } else {
                  switchToPersonalView('orders');
                }
              }}
              aria-label="Open my personal orders"
              className="flex items-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 whitespace-nowrap"
              style={{
                backgroundColor: state.view === 'orders' ? '#6366F1' : 'var(--aurora-surface-variant, #EDF0F7)',
                color: state.view === 'orders' ? '#fff' : 'var(--aurora-text-secondary)',
                minHeight: '36px',
                WebkitTapHighlightColor: 'transparent',
                WebkitAppearance: 'none',
                appearance: 'none',
              } as React.CSSProperties}
            >
              <ClipboardList size={15} className="shrink-0" />
              My Orders
            </button>
          )}

          {/* SB-06: "More" dropdown — groups secondary pills (Quotes, Saved, Templates) */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="flex items-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 whitespace-nowrap"
                style={{
                  backgroundColor: ['quotes', 'favorites', 'recurring', 'templates'].includes(state.view) ? '#6366F1' : 'var(--aurora-surface-variant, #EDF0F7)',
                  color: ['quotes', 'favorites', 'recurring', 'templates'].includes(state.view) ? '#fff' : 'var(--aurora-text-secondary)',
                  minHeight: '36px',
                }}
                aria-expanded={showMoreMenu}
                aria-haspopup="true"
              >
                <MoreHorizontal size={15} className="shrink-0" />
                {['quotes', 'favorites', 'recurring', 'templates'].includes(state.view)
                  ? state.view === 'quotes' ? 'Quotes' : state.view === 'templates' ? 'Templates' : 'Saved'
                  : 'More'
                }
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <div
                    className="absolute right-0 top-full mt-1 w-44 rounded-xl border shadow-lg z-50 py-1"
                    style={{ backgroundColor: 'var(--aurora-surface, #fff)', borderColor: 'var(--aurora-border)' }}
                  >
                    <button
                      onClick={() => {
                        setSelectedQuoteRequest(null);
                        setShowMoreMenu(false);
                        switchToPersonalView('quotes');
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: state.view === 'quotes' ? '#6366F1' : 'var(--aurora-text)', backgroundColor: 'var(--aurora-bg)' }}
                    >
                      <FileText size={15} />
                      My Quotes
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        switchToPersonalView('favorites');
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: ['favorites', 'recurring'].includes(state.view) ? '#6366F1' : 'var(--aurora-text)', backgroundColor: 'var(--aurora-bg)' }}
                    >
                      <Heart size={15} />
                      Saved Orders
                    </button>
                    <button
                      onClick={() => {
                        setSelectedFavoriteForTemplate(null);
                        setShowMoreMenu(false);
                        switchToPersonalView('templates');
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: state.view === 'templates' ? '#6366F1' : 'var(--aurora-text)', backgroundColor: 'var(--aurora-bg)' }}
                    >
                      <ClipboardList size={15} />
                      Templates
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Dashboard CTA — always visible when user owns a catering business.
              Replaces the old business-name pill; keeps the nav concise and
              routes directly to the Vendor Dashboard. Business switching lives
              in the breadcrumb BusinessSwitcher on the dashboard itself. */}
          {ownedBusiness && (
            <button
              onClick={() => {
                if (state.view === 'vendor') {
                  dispatch({ type: 'SET_VIEW', payload: 'categories' });
                  // Navigate back to /catering when leaving vendor view
                  if (routeBusinessId) navigate('/catering');
                } else {
                  dispatch({ type: 'SET_VIEW', payload: 'vendor' });
                  // Navigate to vendor-scoped URL
                  navigate(`/vendor/${ownedBusiness.id}/dashboard`);
                }
              }}
              aria-label="Open Vendor Dashboard"
              className="flex items-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 whitespace-nowrap"
              style={{
                backgroundColor: state.view === 'vendor' ? '#6366F1' : 'var(--aurora-surface-variant, #EDF0F7)',
                color: state.view === 'vendor' ? '#fff' : 'var(--aurora-text-secondary)',
                minHeight: '36px',
                WebkitTapHighlightColor: 'transparent',
                WebkitAppearance: 'none',
                appearance: 'none',
              } as React.CSSProperties}
            >
              <LayoutDashboard size={15} className="shrink-0" />
              Dashboard
            </button>
          )}

          {/* Cart button */}
          {!['checkout', 'vendor', 'rfp', 'quotes', 'orders'].includes(state.view) && (
            <button
              onClick={() => dispatch({ type: 'TOGGLE_CART' })}
              className="relative p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--aurora-bg)' }}
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
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {/* Breadcrumb navigation */}
        {state.view !== 'categories' && (
          <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm mb-4 min-w-0" aria-label="Breadcrumb">
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'categories' })}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Categories
            </button>
            {['items', 'checkout', 'orders'].includes(state.view) && state.selectedCategory && (
              <>
                <span style={{ color: 'var(--aurora-text-muted)' }}>/</span>
                <button
                  onClick={() => dispatch({ type: 'SET_VIEW', payload: 'items' })}
                  className={`font-medium ${state.view === 'items' ? '' : 'text-indigo-600 hover:text-indigo-800'}`}
                  style={{ color: state.view === 'items' ? 'var(--aurora-text)' : undefined }}
                >
                  {state.selectedCategory === 'all' ? 'All Items' : state.selectedCategory}
                </button>
              </>
            )}
            {state.view === 'checkout' && (
              <>
                <span style={{ color: 'var(--aurora-text-muted)' }}>/</span>
                <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>Checkout</span>
              </>
            )}
            {state.view === 'orders' && (
              <>
                <span style={{ color: 'var(--aurora-text-muted)' }}>/</span>
                <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>My Orders</span>
              </>
            )}
            {state.view === 'order_confirmation' && (
              <>
                <span style={{ color: 'var(--aurora-text-muted)' }}>/</span>
                <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>Order Confirmed</span>
              </>
            )}
            {['favorites', 'recurring', 'templates'].includes(state.view) && (
              <>
                <span style={{ color: 'var(--aurora-text-muted)' }}>/</span>
                <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>
                  {state.view === 'favorites' ? 'Saved' : state.view === 'recurring' ? 'Recurring' : 'Templates'}
                </span>
              </>
            )}
            {state.view === 'rfp' && (
              <>
                <span style={{ color: 'var(--aurora-text-muted)' }}>/</span>
                <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>Request for Quotes</span>
              </>
            )}
            {state.view === 'quotes' && (
              <>
                <span style={{ color: 'var(--aurora-text-muted)' }}>/</span>
                <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>Compare Quotes</span>
              </>
            )}
            {state.view === 'vendor' && (
              <>
                <span style={{ color: 'var(--aurora-text-muted)' }}>/</span>
                <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>Vendor Dashboard</span>
                {/* BusinessSwitcher — placed in the breadcrumb trail per UX review.
                    Keeps the sticky header uncluttered while still giving vendors a
                    one-click way to switch the active business from the top of the page.
                    The dropdown itself uses position:fixed + visualViewport math so it
                    renders correctly regardless of horizontal position on Chrome, Safari,
                    Firefox, iOS Safari, and Android Chrome. */}
                {ownedBusiness && (
                  <>
                    <span style={{ color: 'var(--aurora-text-muted)' }}>/</span>
                    <div className="min-w-0 shrink" style={{ WebkitTapHighlightColor: 'transparent' }}>
                      <BusinessSwitcher />
                    </div>
                  </>
                )}
              </>
            )}
          </nav>
        )}

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
                <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: 'var(--aurora-border)' }}>
                  <div>
                    <div className="shimmer h-5 w-36 rounded" />
                    <div className="shimmer h-3 w-24 rounded mt-2" />
                  </div>
                </div>
                {/* Item cards grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((c) => (
                    <div key={c} className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
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
            {/* UI-01: Hero banner with featured caterers */}
            {allCateringBusinesses.length > 0 && (
              <div className="relative overflow-hidden rounded-2xl mb-6" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)' }}>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="relative px-6 py-8 sm:py-10 sm:px-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    Catering for every occasion
                  </h2>
                  <p className="text-sm text-white/80 mb-5 max-w-md">
                    From intimate dinners to grand celebrations — find the perfect caterer for your next event.
                  </p>
                  {/* Featured caterer pills */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {allCateringBusinesses.slice(0, 5).map((biz) => (
                      <button
                        key={biz.id}
                        onClick={() => {
                          dispatch({ type: 'SET_SEARCH_QUERY', payload: biz.name || '' });
                          handleSelectCategory('all');
                        }}
                        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-transform hover:scale-105 shrink-0"
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                      >
                        <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}>
                          {(biz.name || 'C').charAt(0).toUpperCase()}
                        </span>
                        {biz.name}
                      </button>
                    ))}
                    {allCateringBusinesses.length > 5 && (
                      <button
                        onClick={() => handleSelectCategory('all')}
                        className="flex items-center rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-transform hover:scale-105 shrink-0"
                        style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                      >
                        +{allCateringBusinesses.length - 5} more
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
              Browse caterers by cuisine type and place orders for your next event.
            </p>

            {/* Global cross-category search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--aurora-text-muted)' }} />
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
                    className="flex flex-col items-center justify-center rounded-xl p-6 border"
                    style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)', borderLeft: '4px solid var(--aurora-border)' }}
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
            {/* SB-07: Dual ordering path choice card */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div
                className="p-3 rounded-xl border-2 cursor-default"
                style={{ borderColor: '#6366F1', backgroundColor: 'rgba(99, 102, 241, 0.04)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart size={16} style={{ color: '#6366F1' }} />
                  <p className="text-sm font-semibold" style={{ color: '#6366F1' }}>Order Directly</p>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--aurora-text-secondary)' }}>
                  Browse items with fixed prices and add to your cart.
                </p>
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'rfp' })}
                className="p-3 rounded-xl border-2 text-left hover:shadow-md transition-shadow"
                style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface, #fff)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Send size={16} style={{ color: 'var(--aurora-text-secondary)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>Request Quotes</p>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--aurora-text-secondary)' }}>
                  Compare prices from multiple caterers for custom events.
                </p>
              </button>
            </div>

            <CateringItemList
              items={state.menuItems}
              businesses={state.businesses}
              onAddToCart={handleAddToCart}
              onUpdateQty={handleUpdateCartQty}
              onRemoveFromCart={handleRemoveFromCart}
              cartItems={state.cart.items}
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

        {/* SB-01: Order Confirmation Screen */}
        {state.view === 'order_confirmation' && state.lastOrderConfirmation && (
          <div className="max-w-lg mx-auto py-8">
            <div
              className="rounded-2xl border p-8 text-center"
              style={{ backgroundColor: 'var(--aurora-surface, #fff)', borderColor: 'var(--aurora-border, #E2E5EF)' }}
            >
              {/* Success icon */}
              <div className="flex justify-center mb-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#D1FAE5' }}
                >
                  <CheckCircle size={32} style={{ color: '#059669' }} />
                </div>
              </div>

              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--aurora-text, #1E2132)' }}>
                Order Confirmed!
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--aurora-text-secondary)' }}>
                Your order has been submitted to {state.lastOrderConfirmation.businessName}
              </p>

              {/* Order details card */}
              <div
                className="rounded-xl border p-4 text-left mb-6 space-y-3"
                style={{ borderColor: 'var(--aurora-border, #E2E5EF)', backgroundColor: 'var(--aurora-bg, #F5F6FA)' }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--aurora-text-muted)' }}>
                    Order ID
                  </span>
                  <span className="text-sm font-mono font-semibold" style={{ color: 'var(--aurora-text)' }}>
                    #{state.lastOrderConfirmation.orderId.slice(-8).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--aurora-text-muted)' }}>
                    Event Date
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
                    {new Date(state.lastOrderConfirmation.eventDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--aurora-text-muted)' }}>
                    Items
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
                    {state.lastOrderConfirmation.itemCount} item{state.lastOrderConfirmation.itemCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="border-t pt-2" style={{ borderColor: 'var(--aurora-border)' }}>
                  <div className="flex justify-between items-center text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                    <span>Subtotal</span>
                    <span>{formatPrice(state.lastOrderConfirmation.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                    <span>Est. Tax</span>
                    <span>{formatPrice(state.lastOrderConfirmation.tax)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>Total</span>
                    <span className="text-lg font-bold" style={{ color: '#6366F1' }}>
                      {formatPrice(state.lastOrderConfirmation.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* What happens next */}
              <div
                className="rounded-xl border p-4 text-left mb-6"
                style={{ borderColor: 'rgba(99, 102, 241, 0.2)', backgroundColor: 'rgba(99, 102, 241, 0.04)' }}
              >
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--aurora-text)' }}>
                  What happens next?
                </h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5" style={{ backgroundColor: '#6366F1' }}>1</span>
                    <span>The vendor will review and confirm your order (usually within 1–2 hours).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5" style={{ backgroundColor: '#6366F1' }}>2</span>
                    <span>You&apos;ll get a notification when the status changes. Track progress in My Orders.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5" style={{ backgroundColor: '#6366F1' }}>3</span>
                    <span>If the vendor modifies items or pricing, you&apos;ll be asked to accept or reject.</span>
                  </div>
                </div>
              </div>

              {/* CTA buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_VIEW', payload: 'orders' });
                    dispatch({ type: 'SET_ORDER_CONFIRMATION', payload: null });
                  }}
                  className="flex-1 px-5 py-3 rounded-xl font-medium text-white transition-colors"
                  style={{ backgroundColor: '#6366F1' }}
                >
                  Track This Order
                </button>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_VIEW', payload: 'categories' });
                    dispatch({ type: 'SET_ORDER_CONFIRMATION', payload: null });
                  }}
                  className="flex-1 px-5 py-3 rounded-xl font-medium border transition-colors"
                  style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                >
                  Continue Browsing
                </button>
              </div>
            </div>
          </div>
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
            {/* BusinessSwitcher moved to the sticky header (inline with "Vendor Dashboard" title).
                The old "MANAGING" strip here was redundant now that the dropdown sits right
                next to the page title. */}

            {/* SB-08: Simplified vendor tab bar — primary tabs + bottom border indicator */}
            <div
              className="flex gap-1 overflow-x-auto scrollbar-hide border-b pb-0"
              style={{ borderColor: 'var(--aurora-border)', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              {([
                { key: 'orders' as const, label: 'Orders' },
                { key: 'quotes' as const, label: 'Quotes' },
                { key: 'analytics' as const, label: 'Analytics' },
                { key: 'reviews' as const, label: 'Reviews', icon: <Star size={13} /> },
                { key: 'inventory' as const, label: 'Inventory', icon: <Package size={13} /> },
                { key: 'menu' as const, label: 'Menu', icon: <UtensilsCrossed size={13} /> },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setVendorTab(tab.key)}
                  className="flex items-center gap-1.5 px-3 py-2.5 sm:px-4 text-sm font-medium transition-colors shrink-0 whitespace-nowrap border-b-2"
                  style={{
                    borderColor: vendorTab === tab.key ? '#6366F1' : 'transparent',
                    color: vendorTab === tab.key ? '#6366F1' : 'var(--aurora-text-secondary)',
                    marginBottom: '-1px',
                    minHeight: '44px',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <ErrorBoundary fallbackMessage="Something went wrong loading this tab. Click below to retry.">
            <React.Suspense fallback={<LazyFallback />}>
            {vendorTab === 'orders' && (
              <VendorCateringDashboard
                businessId={ownedBusiness.id}
                businessName={ownedBusiness.name}
                onSwitchVendorTab={setVendorTab}
              />
            )}
            {vendorTab === 'quotes' && (
              <VendorQuoteResponse
                businessId={ownedBusiness.id}
                businessName={ownedBusiness.name}
                businessHeritage={Array.isArray(ownedBusiness.heritage) ? ownedBusiness.heritage[0] : ownedBusiness.heritage}
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
            {vendorTab === 'menu' && (
                <VendorMenuEditor
                  businessId={ownedBusiness.id}
                  businessName={ownedBusiness.name}
                  onBack={() => setVendorTab('orders')}
                />
            )}
            </React.Suspense>
            </ErrorBoundary>
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
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
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
            {state.cart.items.length > 0 && state.cart.items.length <= 5 && (
              <ul className="text-xs mb-2 ml-3 space-y-0.5" style={{ color: 'var(--aurora-text-muted)' }}>
                {state.cart.items.map(ci => (
                  <li key={ci.menuItemId}>• {ci.name} × {ci.qty}</li>
                ))}
              </ul>
            )}
            <p className="text-sm mb-5" style={{ color: 'var(--aurora-text-secondary)' }}>
              Adding from <strong>{state.pendingVendorSwitch.businessName}</strong> will replace your current cart.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => dispatch({ type: 'CANCEL_VENDOR_SWITCH' })}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--aurora-border, #E2E5EF)', color: 'var(--aurora-text)', backgroundColor: 'var(--aurora-bg)' }}
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
