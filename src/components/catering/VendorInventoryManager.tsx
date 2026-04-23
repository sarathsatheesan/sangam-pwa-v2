// ═════════════════════════════════════════════════════════════════════════════════
// VENDOR INVENTORY MANAGER (#19)
// Allows vendors to manage menu item stock status, counts, and availability.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, Package, AlertCircle, CheckCircle2, XCircle,
  Loader2, Calendar, Save, RefreshCw,
} from 'lucide-react';
import type { CateringMenuItem } from '@/services/cateringService';
import { fetchMenuItemsByBusiness, updateMenuItemStock, formatPrice } from '@/services/cateringService';
import { useToast } from '@/contexts/ToastContext';

interface VendorInventoryManagerProps {
  businessId: string;
  businessName: string;
  onBack: () => void;
}

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

const STOCK_CONFIG: Record<StockStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  in_stock: { label: 'In Stock', color: '#059669', bg: '#D1FAE5', icon: <CheckCircle2 size={12} /> },
  low_stock: { label: 'Low Stock', color: '#D97706', bg: '#FEF3C7', icon: <AlertCircle size={12} /> },
  out_of_stock: { label: 'Out of Stock', color: '#DC2626', bg: '#FEE2E2', icon: <XCircle size={12} /> },
};

export default function VendorInventoryManager({ businessId, businessName, onBack }: VendorInventoryManagerProps) {
  const { addToast } = useToast();
  const [items, setItems] = useState<CateringMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<StockStatus>('in_stock');
  const [editCount, setEditCount] = useState<string>('');
  const [editAvailFrom, setEditAvailFrom] = useState('');
  const [editAvailUntil, setEditAvailUntil] = useState('');
  const [undoAction, setUndoAction] = useState<{
    itemId: string;
    previousStock: { stockStatus?: StockStatus; stockCount?: number };
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | StockStatus>('all');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMenuItemsByBusiness(businessId);
      setItems(data);
    } catch {
      addToast('Failed to load menu items', 'error');
    } finally {
      setLoading(false);
    }
  }, [businessId, addToast]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const startEdit = (item: CateringMenuItem) => {
    setEditingId(item.id);
    setEditStock(item.stockStatus || 'in_stock');
    setEditCount(item.stockCount?.toString() || '');
    setEditAvailFrom(item.availableFrom || '');
    setEditAvailUntil(item.availableUntil || '');
  };

  const handleSave = async (item: CateringMenuItem) => {
    setSavingId(item.id);
    try {
      // Store previous stock state for undo
      const prevStock = { stockStatus: item.stockStatus, stockCount: item.stockCount };

      const updates: Parameters<typeof updateMenuItemStock>[1] = {
        stockStatus: editStock,
        available: editStock !== 'out_of_stock',
      };
      if (editCount) updates.stockCount = parseInt(editCount, 10);
      if (editAvailFrom) updates.availableFrom = editAvailFrom;
      if (editAvailUntil) updates.availableUntil = editAvailUntil;

      await updateMenuItemStock(item.id, updates);
      // Optimistic local update
      setItems(prev => prev.map(i =>
        i.id === item.id
          ? { ...i, stockStatus: editStock, stockCount: editCount ? parseInt(editCount, 10) : undefined, available: editStock !== 'out_of_stock', availableFrom: editAvailFrom || undefined, availableUntil: editAvailUntil || undefined }
          : i,
      ));
      setEditingId(null);

      // Set up undo action
      const timer = setTimeout(() => setUndoAction(null), 8000);
      setUndoAction({ itemId: item.id, previousStock: prevStock, timer });
      addToast('Stock updated — Undo available for 8s', 'success');
    } catch {
      addToast('Failed to update stock', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const quickToggle = async (item: CateringMenuItem) => {
    const newStatus: StockStatus = item.stockStatus === 'out_of_stock' ? 'in_stock' : 'out_of_stock';
    setSavingId(item.id);
    try {
      await updateMenuItemStock(item.id, { stockStatus: newStatus, available: newStatus !== 'out_of_stock' });
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, stockStatus: newStatus, available: newStatus !== 'out_of_stock' } : i,
      ));
      addToast(newStatus === 'out_of_stock' ? 'Marked out of stock' : 'Marked in stock', 'success');
    } catch {
      addToast('Failed to update', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const filteredItems = filterStatus === 'all'
    ? items
    : items.filter(i => (i.stockStatus || 'in_stock') === filterStatus);

  const outOfStockCount = items.filter(i => i.stockStatus === 'out_of_stock').length;
  const lowStockCount = items.filter(i => i.stockStatus === 'low_stock').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>Loading inventory...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} style={{ color: 'var(--aurora-text)' }} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>Inventory</h2>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>{businessName} — {items.length} items</p>
        </div>
        <button onClick={loadItems} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <RefreshCw size={16} style={{ color: 'var(--aurora-text-muted)' }} />
        </button>
      </div>

      {/* Summary bar */}
      {(outOfStockCount > 0 || lowStockCount > 0) && (
        <div className="flex gap-3">
          {outOfStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
              <XCircle size={12} />
              {outOfStockCount} out of stock
            </div>
          )}
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
              <AlertCircle size={12} />
              {lowStockCount} low stock
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: filterStatus === f ? '#6366F1' : 'var(--aurora-surface-variant, #EDF0F7)',
              color: filterStatus === f ? '#fff' : 'var(--aurora-text-secondary)',
            }}
          >
            {f === 'all' ? `All (${items.length})` : `${STOCK_CONFIG[f].label} (${items.filter(i => (i.stockStatus || 'in_stock') === f).length})`}
          </button>
        ))}
      </div>

      {/* Item list */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-8">
          <Package size={32} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
            {items.length === 0 ? 'No menu items found' : 'No items match this filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const status = item.stockStatus || 'in_stock';
            const cfg = STOCK_CONFIG[status];
            const isEditing = editingId === item.id;

            return (
              <div
                key={item.id}
                className="rounded-xl border p-3"
                style={{ borderColor: isEditing ? '#6366F1' : 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}
              >
                <div className="flex items-center gap-3">
                  {/* Stock badge */}
                  <button
                    onClick={() => quickToggle(item)}
                    disabled={savingId === item.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-colors"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    title="Click to quick-toggle stock status"
                  >
                    {savingId === item.id ? <Loader2 size={10} className="animate-spin" /> : cfg.icon}
                    {cfg.label}
                  </button>

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--aurora-text)' }}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                      <span>{item.category}</span>
                      <span>{formatPrice(item.price)}/{item.pricingType.replace(/_/g, ' ')}</span>
                      {item.stockCount != null && <span>Qty: {item.stockCount}</span>}
                    </div>
                  </div>

                  {/* Edit button */}
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(item)}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors"
                      style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
                    >
                      Edit
                    </button>
                  )}
                </div>

                {/* Availability window indicator */}
                {!isEditing && (item.availableFrom || item.availableUntil) && (
                  <div className="flex items-center gap-1 mt-1.5 text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                    <Calendar size={10} />
                    {item.availableFrom && <span>From: {item.availableFrom}</span>}
                    {item.availableUntil && <span>Until: {item.availableUntil}</span>}
                  </div>
                )}

                {/* Edit form */}
                {isEditing && (
                  <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: 'var(--aurora-border)' }}>
                    {/* Stock status */}
                    <div className="flex gap-2">
                      {(['in_stock', 'low_stock', 'out_of_stock'] as StockStatus[]).map((s) => {
                        const c = STOCK_CONFIG[s];
                        return (
                          <button
                            key={s}
                            onClick={() => setEditStock(s)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                            style={{
                              borderColor: editStock === s ? c.color : 'var(--aurora-border)',
                              backgroundColor: editStock === s ? c.bg : 'transparent',
                              color: editStock === s ? c.color : 'var(--aurora-text-secondary)',
                            }}
                          >
                            {c.icon}
                            {c.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Stock count */}
                    <div>
                      <label className="text-[10px] font-medium" style={{ color: 'var(--aurora-text-muted)' }}>
                        Stock Count (leave blank for unlimited)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editCount}
                        onChange={(e) => setEditCount(e.target.value)}
                        placeholder="Unlimited"
                        className="w-full mt-1 rounded-lg border px-3 py-1.5 text-sm outline-none"
                        style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                      />
                    </div>

                    {/* Availability window */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-medium" style={{ color: 'var(--aurora-text-muted)' }}>Available From</label>
                        <input
                          type="date"
                          value={editAvailFrom}
                          onChange={(e) => setEditAvailFrom(e.target.value)}
                          onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
                          className="w-full mt-1 rounded-lg border px-3 py-1.5 text-xs outline-none"
                          style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium" style={{ color: 'var(--aurora-text-muted)' }}>Available Until</label>
                        <input
                          type="date"
                          value={editAvailUntil}
                          onChange={(e) => setEditAvailUntil(e.target.value)}
                          onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
                          className="w-full mt-1 rounded-lg border px-3 py-1.5 text-xs outline-none"
                          style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs"
                        style={{ color: 'var(--aurora-text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(item)}
                        disabled={savingId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: '#6366F1' }}
                      >
                        {savingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Undo toast */}
      {undoAction && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg">
          <span className="text-sm">Stock updated</span>
          <button
            onClick={async () => {
              clearTimeout(undoAction.timer);
              try {
                await updateMenuItemStock(undoAction.itemId, undoAction.previousStock);
                setItems(prev => prev.map(i => i.id === undoAction.itemId ? { ...i, ...undoAction.previousStock } : i));
                addToast('Change reverted', 'success');
              } catch {
                addToast('Failed to undo', 'error');
              }
              setUndoAction(null);
            }}
            className="rounded px-3 py-1 text-sm font-medium hover:bg-gray-100"
            style={{ backgroundColor: 'var(--aurora-surface)', color: 'var(--aurora-text)' }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
