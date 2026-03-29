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

import React, { useReducer, useCallback, useEffect, useState, useRef } from 'react';
import {
  ArrowLeft, ShoppingCart, ChefHat, Loader2, Store,
  Send, FileText, ClipboardList, Star,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { cateringReducer, createInitialState } from '@/reducers/cateringReducer';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { CateringMenuItem, OrderItem, QuoteRequestItem, CateringQuoteRequest } from '@/services/cateringService';
import {
  fetchCateringBusinesses,
  fetchCateringBusinessesByCategory,
  fetchMenuItemsByCategory,
  createOrder,
  calculateOrderTotal,
  createQuoteRequest,
  subscribeToCustomerQuoteRequests,
} from '@/services/cateringService';

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
  const [vendorTab, setVendorTab] = useState<'orders' | 'quotes' | 'analytics' | 'reviews'>('orders');
  const [selectedQuoteRequest, setSelectedQuoteRequest] = useState<CateringQuoteRequest | null>(null);
  const selectedQuoteRequestRef = useRef<CateringQuoteRequest | null>(null);
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
      qty: 1,
      unitPrice: item.price,
      pricingType: item.pricingType,
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
        specialInstructions: orderForm.specialInstructions || undefined,
        orderForContext: orderForm.orderForContext,
        contactName: orderForm.contactName,
        contactPhone: orderForm.contactPhone,
      });

      addToast('Order placed successfully! The caterer will confirm shortly.', 'success', 5000);
      dispatch({ type: 'CLEAR_CART' });
      dispatch({ type: 'SET_VIEW', payload: 'categories' });
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
        ...(rfpForm.targetBusinessIds.length > 0 ? { targetBusinessIds: rfpForm.targetBusinessIds } : {}),
      });

      addToast('Quote request sent! Caterers will respond with their quotes.', 'success', 5000);
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
      case 'categories': return 'Catering';
      case 'items': return state.selectedCategory || 'Menu';
      case 'checkout': return 'Checkout';
      case 'rfp': return 'Request for Price';
      case 'quotes': return selectedQuoteRequest ? 'Quote Responses' : 'My Quotes';
      case 'orders': return 'My Orders';
      case 'vendor': return 'Vendor Dashboard';
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
          <div className="flex items-center gap-2">
            <ChefHat size={22} style={{ color: 'var(--aurora-primary, #6366F1)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--aurora-text, #1E2132)' }}>
              {getTitle()}
            </h1>
          </div>
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
        {/* Loading */}
        {state.loading && (
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
            <CateringCategoryGrid
              onSelectCategory={handleSelectCategory}
              businessCounts={businessCounts}
            />
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
              onSearchChange={(q) => dispatch({ type: 'SET_SEARCH_QUERY', payload: q })}
              onDietaryToggle={(tag) => dispatch({ type: 'TOGGLE_DIETARY_FILTER', payload: tag })}
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
                  return (
                    <button
                      key={req.id}
                      onClick={() => setSelectedQuoteRequest(req)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-colors hover:shadow-md"
                      style={{
                        backgroundColor: 'var(--aurora-surface)',
                        borderColor: 'var(--aurora-border)',
                      }}
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
                        </p>
                      </div>
                      <ArrowLeft size={16} className="rotate-180 opacity-30 ml-2" />
                    </button>
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
            />
          </React.Suspense>
        )}

        {/* Vendor dashboard with tabs */}
        {state.view === 'vendor' && ownedBusiness && (
          <div className="space-y-4">
            {/* Tab toggle */}
            <div className="flex gap-2">
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
            </React.Suspense>
          </div>
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
          dispatch({ type: 'SET_VIEW', payload: 'checkout' });
        }}
      />
    </div>
  );
}
