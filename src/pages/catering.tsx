// ═════════════════════════════════════════════════════════════════════════════════
// CATERING PAGE
// Main entry for the catering module. Supports:
//   - Category grid browsing
//   - Menu item listing grouped by business
//   - Cart + checkout (Path A: Place Order)
//   - Vendor dashboard (for business owners)
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useReducer, useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, ShoppingCart, ChefHat, Loader2, Store,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { cateringReducer, createInitialState } from '@/reducers/cateringReducer';
import type { CateringMenuItem, OrderItem } from '@/services/cateringService';
import {
  fetchCateringBusinesses,
  fetchCateringBusinessesByCategory,
  fetchMenuItemsByCategory,
  createOrder,
  calculateOrderTotal,
} from '@/services/cateringService';

// ── Components ──
import CateringCategoryGrid from '@/components/catering/CateringCategoryGrid';
import CateringItemList from '@/components/catering/CateringItemList';
import CateringCart from '@/components/catering/CateringCart';
import CateringCheckout from '@/components/catering/CateringCheckout';
import VendorCateringDashboard from '@/components/catering/VendorCateringDashboard';

export default function CateringPage() {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const [state, dispatch] = useReducer(cateringReducer, undefined, createInitialState);
  const [businessCounts, setBusinessCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // ── Load business counts for category grid ──
  useEffect(() => {
    fetchCateringBusinesses()
      .then((businesses) => {
        const counts: Record<string, number> = {};
        businesses.forEach((b) => {
          counts[b.category] = (counts[b.category] || 0) + 1;
        });
        setBusinessCounts(counts);
      })
      .catch((err) => console.warn('Failed to load catering business counts:', err));
  }, []);

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

  // ── Handlers ──
  const handleSelectCategory = useCallback((category: string) => {
    dispatch({ type: 'SET_CATEGORY', payload: category });
    dispatch({ type: 'SET_VIEW', payload: 'items' });
  }, []);

  const handleAddToCart = useCallback((item: CateringMenuItem) => {
    // Find the business for this item
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

  const handleBackToCategories = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'categories' });
    dispatch({ type: 'SET_CATEGORY', payload: null });
  }, []);

  const handleBackToItems = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'items' });
  }, []);

  // Check if current user owns a catering-enabled business
  const ownedBusiness = state.businesses.find(
    (b: any) => b.ownerId === user?.uid
  );

  const cartItemCount = state.cart.items.reduce((sum, item) => sum + item.qty, 0);

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
              onClick={state.view === 'checkout' ? handleBackToItems : handleBackToCategories}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} style={{ color: 'var(--aurora-text)' }} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <ChefHat size={22} style={{ color: 'var(--aurora-primary, #6366F1)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--aurora-text, #1E2132)' }}>
              {state.view === 'categories' && 'Catering'}
              {state.view === 'items' && (state.selectedCategory || 'Menu')}
              {state.view === 'checkout' && 'Checkout'}
              {state.view === 'vendor' && 'Vendor Dashboard'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Vendor dashboard toggle */}
          {ownedBusiness && state.view !== 'vendor' && (
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'vendor' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
                color: 'var(--aurora-text-secondary)',
              }}
            >
              <Store size={16} />
              My Orders
            </button>
          )}

          {/* Cart button */}
          {state.view !== 'checkout' && state.view !== 'vendor' && (
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

        {/* Items view */}
        {state.view === 'items' && !state.loading && !state.error && (
          <CateringItemList
            items={state.menuItems}
            businesses={state.businesses}
            onAddToCart={handleAddToCart}
            searchQuery={state.searchQuery}
            dietaryFilter={state.dietaryFilter}
            onSearchChange={(q) => dispatch({ type: 'SET_SEARCH_QUERY', payload: q })}
            onDietaryToggle={(tag) => dispatch({ type: 'TOGGLE_DIETARY_FILTER', payload: tag })}
          />
        )}

        {/* Checkout view */}
        {state.view === 'checkout' && (
          <CateringCheckout
            cart={state.cart}
            orderForm={state.orderForm}
            onUpdateForm={(updates) => dispatch({ type: 'UPDATE_ORDER_FORM', payload: updates })}
            onPlaceOrder={handlePlaceOrder}
            onBack={handleBackToItems}
            loading={submitting}
          />
        )}

        {/* Vendor dashboard */}
        {state.view === 'vendor' && ownedBusiness && (
          <VendorCateringDashboard
            businessId={ownedBusiness.id}
            businessName={ownedBusiness.name}
          />
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
