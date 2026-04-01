// ═════════════════════════════════════════════════════════════════════════════════
// FAVORITE ORDERS
// Save favorite orders for quick reorder (e.g., weekly office lunch).
// Supports: save from delivered order, rename, reorder with date override, delete.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Heart, ShoppingCart, Trash2, Edit3, ArrowLeft, Repeat, Clock,
  ChevronDown, ChevronUp, Loader2, Calendar, Users, MapPin, Star, Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { FavoriteOrder, DeliveryAddress } from '@/services/cateringService';
import {
  subscribeToFavorites,
  deleteFavoriteOrder,
  updateFavoriteOrder,
  reorderFromFavorite,
  formatPrice,
  calculateOrderTotal,
} from '@/services/cateringService';

interface FavoriteOrdersProps {
  onBack: () => void;
  onSetupRecurring?: (fav: FavoriteOrder) => void;
  onCreateTemplate?: (fav: FavoriteOrder) => void;
}

export default function FavoriteOrders({ onBack, onSetupRecurring, onCreateTemplate }: FavoriteOrdersProps) {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const [favorites, setFavorites] = useState<FavoriteOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderDate, setReorderDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddress, setEditAddress] = useState<DeliveryAddress>({ street: '', city: '', state: '', zip: '' });
  const [reorderQtys, setReorderQtys] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Subscribe to favorites
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const unsub = subscribeToFavorites(user.uid, (favs) => {
      setFavorites(favs);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // Filter favorites based on search query
  const filteredFavorites = useMemo(() => {
    if (!searchQuery.trim()) return favorites;
    const q = searchQuery.toLowerCase();
    return favorites.filter(fav =>
      fav.label.toLowerCase().includes(q) ||
      fav.businessName.toLowerCase().includes(q) ||
      fav.items.some(item => item.name.toLowerCase().includes(q))
    );
  }, [favorites, searchQuery]);

  // ── Handlers ──

  const handleDelete = useCallback(async (favId: string) => {
    // Optimistic update: remove from local state immediately
    const previousFavorites = favorites;
    setFavorites(prev => prev.filter(f => f.id !== favId));

    try {
      await deleteFavoriteOrder(favId);
      addToast('Favorite removed', 'success', 2000);
    } catch (err: any) {
      // Revert on error: restore the deleted favorite
      setFavorites(previousFavorites);
      addToast(err.message || 'Failed to remove favorite', 'error');
    }
  }, [addToast, favorites]);

  const handleRename = useCallback(async (favId: string) => {
    if (!editLabel.trim()) return;

    // Optimistic update: update local state immediately
    const previousFavorites = favorites;
    const newLabel = editLabel.trim();
    setFavorites(prev => prev.map(f => f.id === favId ? { ...f, label: newLabel } : f));
    setEditingId(null);

    try {
      await updateFavoriteOrder(favId, { label: newLabel });
      addToast('Favorite renamed', 'success', 2000);
    } catch (err: any) {
      // Revert on error: restore previous state and reopen edit UI
      setFavorites(previousFavorites);
      setEditingId(favId);
      addToast(err.message || 'Failed to rename', 'error');
    }
  }, [editLabel, addToast, favorites]);

  const handleSaveAddress = useCallback(async (favId: string) => {
    if (!editAddress.street.trim() || !editAddress.city.trim()) {
      addToast('Please fill in the address', 'error');
      return;
    }

    // Optimistic update: update local state immediately
    const previousFavorites = favorites;
    const newAddress = editAddress;
    setFavorites(prev => prev.map(f => f.id === favId ? { ...f, deliveryAddress: newAddress } : f));
    setEditingAddressId(null);

    try {
      await updateFavoriteOrder(favId, { deliveryAddress: newAddress });
      addToast('Address updated', 'success', 2000);
    } catch (err: any) {
      // Revert on error: restore previous state and reopen edit form
      setFavorites(previousFavorites);
      setEditingAddressId(favId);
      addToast(err.message || 'Failed to update address', 'error');
    }
  }, [editAddress, addToast, favorites]);

  const handleQuickReorder = useCallback(async (fav: FavoriteOrder) => {
    if (!user || !userProfile || !reorderDate) {
      addToast('Please select a delivery date', 'error');
      return;
    }
    const address = editingAddressId === fav.id ? editAddress : fav.deliveryAddress;
    if (!address?.street) {
      addToast('This favorite has no saved delivery address. Please place a new order instead.', 'error');
      return;
    }
    // Apply adjusted quantities
    const adjustedItems = fav.items.map(item => ({
      ...item,
      qty: reorderQtys[item.menuItemId] ?? item.qty,
    }));
    const adjustedFav = { ...fav, items: adjustedItems };
    setSubmitting(true);
    try {
      await reorderFromFavorite(adjustedFav, {
        customerId: user.uid,
        customerName: userProfile.name || '',
        customerEmail: userProfile.email || user.email || '',
        contactName: userProfile.name || '',
        contactPhone: userProfile.phone || '',
        eventDate: reorderDate,
        deliveryAddress: address,
        headcount: fav.headcount,
      });
      addToast('Order placed! Check My Orders to track it.', 'success', 4000);
      setReorderingId(null);
      setReorderDate('');
    } catch (err: any) {
      addToast(err.message || 'Failed to reorder', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, userProfile, reorderDate, reorderQtys, editAddress, editingAddressId, addToast]);

  // ═══════════════════ RENDER ═══════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-opacity-50 transition-colors">
          <ArrowLeft size={20} style={{ color: 'var(--aurora-text)' }} />
        </button>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>
            My Favorites
          </h2>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            Quick reorder your saved catering orders
          </p>
        </div>
      </div>

      {/* Auto-save explanation */}
      {favorites.length > 0 && (
        <div
          className="flex items-start gap-2 p-3 rounded-xl mb-4 text-xs"
          style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', color: 'var(--aurora-text-secondary)' }}
        >
          <Heart size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#6366F1' }} />
          <span>Your orders are automatically saved here after placement. Rename them for easy reference or use quick reorder to place again with a new date.</span>
        </div>
      )}

      {/* Search input - shown only when more than 3 favorites */}
      {favorites.length > 3 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--aurora-text-muted)' }} />
          <input
            type="text"
            placeholder="Search favorites by name, restaurant, or item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)', color: 'var(--aurora-text)' }}
          />
        </div>
      )}

      {/* Empty state */}
      {favorites.length === 0 && (
        <div className="text-center py-16">
          <Heart size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
            No favorites yet
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
            After placing an order, tap the heart icon to save it for quick reorder.
          </p>
        </div>
      )}

      {/* Favorites list */}
      <div className="space-y-3">
        {filteredFavorites.map((fav) => {
          const isExpanded = expandedId === fav.id;
          const isEditing = editingId === fav.id;
          const isReordering = reorderingId === fav.id;
          const total = calculateOrderTotal(fav.items);

          return (
            <div
              key={fav.id}
              className="rounded-2xl border overflow-hidden transition-shadow hover:shadow-md"
              style={{
                backgroundColor: 'var(--aurora-surface, #fff)',
                borderColor: 'var(--aurora-border, #E2E5EF)',
              }}
            >
              {/* Header row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : fav.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart size={16} fill="#EF4444" style={{ color: '#EF4444' }} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRename(fav.id); }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-semibold border rounded px-2 py-0.5 flex-1"
                        style={{ color: 'var(--aurora-text)', borderColor: 'var(--aurora-border)' }}
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--aurora-text)' }}>
                        {fav.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                    {fav.businessName} · {fav.items.length} item{fav.items.length !== 1 ? 's' : ''} · {formatPrice(total)}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {fav.headcount && (
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                        <Users size={10} /> {fav.headcount} guests
                      </span>
                    )}
                    {fav.useCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                        <Repeat size={10} /> Ordered {fav.useCount}x
                      </span>
                    )}
                    {fav.lastOrderedAt && (
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                        <Clock size={10} /> Last: {new Date(fav.lastOrderedAt.toDate?.() || fav.lastOrderedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {isExpanded ? <ChevronUp size={16} className="opacity-40" /> : <ChevronDown size={16} className="opacity-40" />}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                  {/* Items table */}
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--aurora-text-muted)' }}>
                      Items
                    </p>
                    {fav.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs py-1">
                        <span style={{ color: 'var(--aurora-text)' }}>
                          {item.qty}x {item.name}
                        </span>
                        <span style={{ color: 'var(--aurora-text-secondary)' }}>
                          {formatPrice(item.unitPrice * item.qty)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-1 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                      <span style={{ color: 'var(--aurora-text)' }}>Total</span>
                      <span style={{ color: '#6366F1' }}>{formatPrice(total)}</span>
                    </div>
                  </div>

                  {/* Delivery address (editable) */}
                  {fav.deliveryAddress && editingAddressId !== fav.id && (
                    <div className="flex items-start gap-1.5 mt-3 text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                      <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                      <span className="flex-1">{fav.deliveryAddress.street}, {fav.deliveryAddress.city}, {fav.deliveryAddress.state} {fav.deliveryAddress.zip}</span>
                      <button
                        onClick={() => { setEditingAddressId(fav.id); setEditAddress(fav.deliveryAddress!); }}
                        className="ml-1 text-indigo-500 hover:text-indigo-700 flex-shrink-0"
                        aria-label="Edit delivery address"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  )}
                  {editingAddressId === fav.id && (
                    <div className="mt-3 p-3 rounded-xl space-y-2" style={{ backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                      <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Edit Address</label>
                      <input type="text" value={editAddress.street} onChange={(e) => setEditAddress(a => ({ ...a, street: e.target.value }))} placeholder="Street" className="w-full px-3 py-1.5 rounded-lg border text-xs" style={{ borderColor: 'var(--aurora-border)' }} />
                      <div className="flex gap-2">
                        <input type="text" value={editAddress.city} onChange={(e) => setEditAddress(a => ({ ...a, city: e.target.value }))} placeholder="City" className="flex-1 px-3 py-1.5 rounded-lg border text-xs" style={{ borderColor: 'var(--aurora-border)' }} />
                        <input type="text" value={editAddress.state} onChange={(e) => setEditAddress(a => ({ ...a, state: e.target.value }))} placeholder="State" className="w-16 px-3 py-1.5 rounded-lg border text-xs" style={{ borderColor: 'var(--aurora-border)' }} />
                        <input type="text" value={editAddress.zip} onChange={(e) => setEditAddress(a => ({ ...a, zip: e.target.value }))} placeholder="ZIP" className="w-20 px-3 py-1.5 rounded-lg border text-xs" style={{ borderColor: 'var(--aurora-border)' }} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveAddress(fav.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#6366F1' }}>Save</button>
                        <button onClick={() => setEditingAddressId(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Reorder section */}
                  {isReordering && (
                    <div className="mt-3 p-3 rounded-xl space-y-3" style={{ backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                      {/* Adjust quantities */}
                      <div>
                        <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>
                          Adjust Quantities
                        </label>
                        <div className="space-y-1 mt-1">
                          {fav.items.map((item) => {
                            const qty = reorderQtys[item.menuItemId] ?? item.qty;
                            return (
                              <div key={item.menuItemId} className="flex items-center justify-between">
                                <span className="text-xs truncate flex-1" style={{ color: 'var(--aurora-text)' }}>{item.name}</span>
                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={() => setReorderQtys(prev => ({ ...prev, [item.menuItemId]: Math.max(1, qty - 1) }))}
                                    className="w-6 h-6 flex items-center justify-center rounded border text-xs hover:bg-opacity-50"
                                    style={{ borderColor: 'var(--aurora-border)' }}
                                  >−</button>
                                  <span className="w-6 text-center text-xs font-medium">{qty}</span>
                                  <button
                                    onClick={() => setReorderQtys(prev => ({ ...prev, [item.menuItemId]: qty + 1 }))}
                                    className="w-6 h-6 flex items-center justify-center rounded border text-xs hover:bg-opacity-50"
                                    style={{ borderColor: 'var(--aurora-border)' }}
                                  >+</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Delivery date */}
                      <div>
                        <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>
                          Delivery Date
                        </label>
                        <input
                          type="date"
                          value={reorderDate}
                          onChange={(e) => setReorderDate(e.target.value)}
                          min={new Date().toISOString().slice(0, 10)}
                          className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                          style={{ borderColor: 'var(--aurora-border)' }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleQuickReorder(fav)}
                          disabled={submitting || !reorderDate}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#059669' }}
                        >
                          {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                          {submitting ? 'Placing...' : 'Place Order'}
                        </button>
                        <button
                          onClick={() => { setReorderingId(null); setReorderDate(''); setReorderQtys({}); }}
                          className="px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                          style={{ color: 'var(--aurora-text-secondary)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {!isReordering && (
                      <button
                        onClick={() => { setReorderingId(fav.id); setReorderDate(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white"
                        style={{ backgroundColor: '#6366F1' }}
                      >
                        <ShoppingCart size={12} />
                        Quick Reorder
                      </button>
                    )}
                    {onSetupRecurring && (
                      <button
                        onClick={() => onSetupRecurring(fav)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
                        style={{ color: '#6366F1', borderColor: '#6366F1' }}
                      >
                        <Calendar size={12} />
                        Set Recurring
                      </button>
                    )}
                    {onCreateTemplate && (
                      <button
                        onClick={() => onCreateTemplate(fav)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
                        style={{ color: '#059669', borderColor: '#059669' }}
                      >
                        <Star size={12} />
                        Save as Template
                      </button>
                    )}
                    {isEditing ? (
                      <button
                        onClick={() => handleRename(fav.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                        style={{ color: '#6366F1' }}
                      >
                        Save Name
                      </button>
                    ) : (
                      <button
                        onClick={() => { setEditingId(fav.id); setEditLabel(fav.label); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                        style={{ color: 'var(--aurora-text-secondary)' }}
                      >
                        <Edit3 size={12} />
                        Rename
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(fav.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                      style={{ color: '#EF4444' }}
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
