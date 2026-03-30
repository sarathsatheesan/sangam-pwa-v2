// ═════════════════════════════════════════════════════════════════════════════════
// VENDOR CATERING DASHBOARD
// Business owners view incoming catering orders and manage them.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  Package, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  User, MapPin, Phone, Calendar, Users, Loader2, AlertCircle, Truck, Ban,
  Square, CheckSquare, Pencil, CreditCard, ExternalLink, Save, X,
} from 'lucide-react';
import type { CateringOrder, OrderItem } from '@/services/cateringService';
import {
  subscribeToBusinessOrders,
  updateOrderStatus,
  cancelOrder,
  batchUpdateOrderStatus,
  vendorModifyOrder,
  updateBusinessPaymentInfo,
  getBusinessPaymentInfo,
  formatPrice,
  calculateOrderTotal,
} from '@/services/cateringService';
import { useToast } from '@/contexts/ToastContext';

const VENDOR_CANCEL_REASONS = [
  'Item unavailable',
  'Cannot fulfill timeline',
  'Customer no-show',
  'Kitchen issue',
  'Other',
];

interface VendorCateringDashboardProps {
  businessId: string;
  businessName: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: '#F59E0B', bgColor: '#FEF3C7', icon: <Clock size={14} /> },
  confirmed: { label: 'Confirmed', color: '#6366F1', bgColor: '#EEF2FF', icon: <CheckCircle2 size={14} /> },
  preparing: { label: 'Preparing', color: '#8B5CF6', bgColor: '#F5F3FF', icon: <Package size={14} /> },
  ready: { label: 'Ready', color: '#10B981', bgColor: '#D1FAE5', icon: <CheckCircle2 size={14} /> },
  out_for_delivery: { label: 'On the Way', color: '#0EA5E9', bgColor: '#E0F2FE', icon: <Truck size={14} /> },
  delivered: { label: 'Delivered', color: '#059669', bgColor: '#A7F3D0', icon: <CheckCircle2 size={14} /> },
  cancelled: { label: 'Cancelled', color: '#EF4444', bgColor: '#FEE2E2', icon: <XCircle size={14} /> },
};

export default function VendorCateringDashboard({ businessId, businessName }: VendorCateringDashboardProps) {
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const { addToast } = useToast();

  useEffect(() => {
    const unsub = subscribeToBusinessOrders(businessId, (incoming) => {
      setOrders(incoming);
      setLoading(false);
    });
    return unsub;
  }, [businessId]);

  // ETA inputs per order (vendor enters before dispatching for delivery)
  const [etaInputs, setEtaInputs] = useState<Record<string, string>>({});

  // ── Batch selection state (#17) ──
  const [batchMode, setBatchMode] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  const handleBatchAction = async (action: 'confirmed' | 'cancelled') => {
    if (selectedOrders.size === 0) return;
    setBatchLoading(true);
    try {
      const result = await batchUpdateOrderStatus([...selectedOrders], action);
      addToast(`${result.success} order(s) ${action}${result.failed ? `, ${result.failed} failed` : ''}`, 'success');
      setSelectedOrders(new Set());
      setBatchMode(false);
    } catch (err: any) {
      addToast(err.message || 'Batch action failed', 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  // ── Order modification state (#18) ──
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editNote, setEditNote] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const startEditOrder = (order: CateringOrder) => {
    setEditingOrderId(order.id);
    setEditItems([...order.items]);
    setEditNote('');
  };

  const handleSaveModification = async (order: CateringOrder) => {
    if (!editNote.trim()) { addToast('Please add a note explaining the change', 'error'); return; }
    setEditSaving(true);
    try {
      const subtotal = editItems.reduce((s, it) => s + it.unitPrice * it.qty, 0);
      const tax = Math.round(subtotal * 0.0825);
      await vendorModifyOrder(order.id, {
        items: editItems,
        subtotal,
        tax,
        total: subtotal + tax,
        note: editNote.trim(),
      });
      addToast('Order modified. Customer will be notified.', 'success');
      setEditingOrderId(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to modify order', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Payment settings state (#13) ──
  const [showPaymentSettings, setShowPaymentSettings] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);

  useEffect(() => {
    getBusinessPaymentInfo(businessId).then(info => {
      setPaymentUrl(info.paymentUrl || '');
      setPaymentMethod(info.paymentMethod || '');
      setPaymentNote(info.paymentNote || '');
    }).catch(() => {});
  }, [businessId]);

  const handleSavePayment = async () => {
    setPaymentSaving(true);
    try {
      await updateBusinessPaymentInfo(businessId, { paymentUrl, paymentMethod, paymentNote });
      addToast('Payment info saved', 'success');
      setShowPaymentSettings(false);
    } catch (err: any) {
      addToast(err.message || 'Failed to save', 'error');
    } finally {
      setPaymentSaving(false);
    }
  };

  // Cancel order state
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOtherText, setCancelOtherText] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const cancelDialogClose = useCallback(() => {
    if (!cancelSubmitting) setCancellingOrderId(null);
  }, [cancelSubmitting]);
  const { modalRef: cancelModalRef, handleKeyDown: cancelKeyDown } = useModalA11y(
    !!cancellingOrderId,
    cancelDialogClose,
  );

  const handleCancelOrder = async () => {
    if (!cancellingOrderId) return;
    const reason = cancelReason === 'Other' ? cancelOtherText.trim() || 'Other' : cancelReason;
    if (!reason) { addToast('Please select a reason', 'error'); return; }
    setCancelSubmitting(true);
    try {
      await cancelOrder(cancellingOrderId, reason, 'vendor');
      addToast('Order cancelled', 'success');
      setCancellingOrderId(null);
      setCancelReason('');
      setCancelOtherText('');
    } catch (err: any) {
      addToast(err.message || 'Failed to cancel order', 'error');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: CateringOrder['status'], extra?: Record<string, any>) => {
    setActionLoading(orderId);
    try {
      await updateOrderStatus(orderId, newStatus, extra);
      addToast(`Order ${newStatus.replace(/_/g, ' ')}`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to update order', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'pending') return o.status === 'pending';
    if (filter === 'active') return ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status);
    if (filter === 'completed') return ['delivered', 'cancelled'].includes(o.status);
    return true;
  });

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--aurora-primary, #6366F1)' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>
            Catering Orders
          </h2>
          <p className="text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
            {businessName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPaymentSettings(!showPaymentSettings)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
          >
            <CreditCard size={12} />
            Payment
          </button>
          <button
            onClick={() => { setBatchMode(!batchMode); setSelectedOrders(new Set()); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor: batchMode ? '#6366F1' : 'var(--aurora-border)',
              color: batchMode ? '#6366F1' : 'var(--aurora-text-secondary)',
              backgroundColor: batchMode ? 'rgba(99,102,241,0.05)' : 'transparent',
            }}
          >
            <CheckSquare size={12} />
            {batchMode ? 'Cancel' : 'Batch'}
          </button>
          {pendingCount > 0 && (
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
            >
              <AlertCircle size={12} />
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* ── Payment settings panel (#13) ── */}
      {showPaymentSettings && (
        <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.03)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#6366F1' }}>Payment Settings</p>
            <button onClick={() => setShowPaymentSettings(false)} className="p-1"><X size={14} style={{ color: 'var(--aurora-text-muted)' }} /></button>
          </div>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            Customers will see this info so they can pay you directly.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium" style={{ color: 'var(--aurora-text-muted)' }}>Payment Method</label>
              <input type="text" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="e.g. Venmo, PayPal, Zelle"
                className="w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }} />
            </div>
            <div>
              <label className="text-[11px] font-medium" style={{ color: 'var(--aurora-text-muted)' }}>Payment URL</label>
              <input type="url" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)} placeholder="https://venmo.com/your-handle"
                className="w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium" style={{ color: 'var(--aurora-text-muted)' }}>Payment Instructions</label>
            <textarea value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g. Please include order # in the memo"
              rows={2} className="w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none resize-none" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }} />
          </div>
          <button onClick={handleSavePayment} disabled={paymentSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#6366F1' }}
          >
            {paymentSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Payment Info
          </button>
        </div>
      )}

      {/* ── Batch action bar (#17) ── */}
      {batchMode && selectedOrders.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'rgba(99,102,241,0.06)' }}>
          <span className="text-sm font-medium" style={{ color: '#6366F1' }}>
            {selectedOrders.size} order(s) selected
          </span>
          <div className="flex gap-2">
            <button onClick={() => handleBatchAction('confirmed')} disabled={batchLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#10B981' }}
            >
              {batchLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Accept All
            </button>
            <button onClick={() => handleBatchAction('cancelled')} disabled={batchLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#EF4444' }}
            >
              {batchLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              Decline All
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize"
            style={{
              backgroundColor: filter === f ? 'var(--aurora-primary, #6366F1)' : 'var(--aurora-surface-variant, #EDF0F7)',
              color: filter === f ? '#fff' : 'var(--aurora-text-secondary)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
            No {filter === 'all' ? '' : filter} orders yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const isExpanded = expandedOrder === order.id;
            const isActionLoading = actionLoading === order.id;

            return (
              <div
                key={order.id}
                className="rounded-xl border overflow-hidden"
                style={{
                  backgroundColor: 'var(--aurora-surface, #fff)',
                  borderColor: 'var(--aurora-border, #E2E5EF)',
                }}
              >
                {/* Order header */}
                <button
                  className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => batchMode && order.status === 'pending' ? toggleOrderSelection(order.id) : setExpandedOrder(isExpanded ? null : order.id)}
                >
                  {/* Batch checkbox */}
                  {batchMode && order.status === 'pending' && (
                    <div className="mr-3 flex-shrink-0" onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order.id); }}>
                      {selectedOrders.has(order.id)
                        ? <CheckSquare size={18} style={{ color: '#6366F1' }} />
                        : <Square size={18} style={{ color: 'var(--aurora-text-muted)' }} />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                        {order.customerName}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {order.eventDate?.toDate?.()
                          ? order.eventDate.toDate().toLocaleDateString('en-US')
                          : order.eventDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {order.headcount} guests
                      </span>
                      <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>
                        {formatPrice(order.total)}
                      </span>
                      {order.estimatedDeliveryTime && order.status === 'out_for_delivery' && (
                        <span className="flex items-center gap-1 font-medium" style={{ color: '#0369A1' }}>
                          <Truck size={12} />
                          ETA: {order.estimatedDeliveryTime}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                    {/* Contact info */}
                    <div className="grid grid-cols-2 gap-3 pt-3 text-sm">
                      <div className="flex items-center gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                        <User size={14} />
                        {order.contactName}
                      </div>
                      <div className="flex items-center gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                        <Phone size={14} />
                        {order.contactPhone}
                      </div>
                      <div className="col-span-2 flex items-start gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                        <MapPin size={14} className="mt-0.5 shrink-0" />
                        {order.deliveryAddress?.formattedAddress ||
                          [order.deliveryAddress?.street, order.deliveryAddress?.city, order.deliveryAddress?.state, order.deliveryAddress?.zip]
                            .filter(Boolean).join(', ')}
                      </div>
                    </div>

                    {/* Items */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--aurora-text-muted)' }}>
                        Items
                      </h4>
                      <div className="space-y-1">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span style={{ color: 'var(--aurora-text)' }}>
                              {item.qty}x {item.name}
                            </span>
                            <span style={{ color: 'var(--aurora-text-secondary)' }}>
                              {formatPrice(item.unitPrice * item.qty)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold pt-1 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                          <span>Total</span>
                          <span>{formatPrice(order.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* ── Order modification form (#18) ── */}
                    {editingOrderId === order.id ? (
                      <div className="p-3 rounded-xl border space-y-2" style={{ borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.02)' }}>
                        <p className="text-xs font-semibold" style={{ color: '#6366F1' }}>Modify Order Items</p>
                        {editItems.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <input type="number" min="0" value={editItems[i].qty}
                              onChange={(e) => setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: Math.max(0, parseInt(e.target.value) || 0) } : it))}
                              className="w-14 text-center rounded-lg border px-2 py-1 text-xs" style={{ borderColor: 'var(--aurora-border)' }}
                            />
                            <span className="flex-1 truncate" style={{ color: 'var(--aurora-text)' }}>{item.name}</span>
                            <span style={{ color: 'var(--aurora-text-secondary)' }}>{formatPrice(item.unitPrice * editItems[i].qty)}</span>
                          </div>
                        ))}
                        <p className="text-xs font-medium text-right" style={{ color: 'var(--aurora-text)' }}>
                          New total: {formatPrice(editItems.reduce((s, it) => s + it.unitPrice * it.qty, 0))}
                        </p>
                        <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Reason for modification (e.g. item out of stock)..." rows={2}
                          className="w-full rounded-lg border px-3 py-2 text-xs outline-none resize-none" style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => setEditingOrderId(null)} className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--aurora-border)' }}>Cancel</button>
                          <button onClick={() => handleSaveModification(order)} disabled={editSaving}
                            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#6366F1' }}
                          >{editSaving ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Save Changes'}</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Vendor modification notice */}
                        {order.vendorModified && (
                          <div className="text-xs p-2 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                            <span className="font-medium">Modified: </span>{order.vendorModificationNote || 'Items adjusted by vendor'}
                          </div>
                        )}
                        {/* Edit order button for confirmed/preparing */}
                        {['confirmed', 'preparing'].includes(order.status) && (
                          <button onClick={() => startEditOrder(order)}
                            className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#6366F1' }}
                          >
                            <Pencil size={12} /> Modify order items
                          </button>
                        )}
                      </>
                    )}

                    {/* Special instructions */}
                    {order.specialInstructions && (
                      <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)' }}>
                        <span className="font-medium">Note: </span>
                        {order.specialInstructions}
                      </div>
                    )}

                    {/* Action buttons */}
                    {order.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleStatusChange(order.id, 'confirmed')}
                          disabled={isActionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#10B981' }}
                        >
                          {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Accept
                        </button>
                        <button
                          onClick={() => handleStatusChange(order.id, 'cancelled')}
                          disabled={isActionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#EF4444' }}
                        >
                          {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                          Decline
                        </button>
                      </div>
                    )}
                    {order.status === 'confirmed' && (
                      <button
                        onClick={() => handleStatusChange(order.id, 'preparing')}
                        disabled={isActionLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                        style={{ backgroundColor: 'var(--aurora-primary, #6366F1)' }}
                      >
                        {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                        Mark as Preparing
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button
                        onClick={() => handleStatusChange(order.id, 'ready')}
                        disabled={isActionLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                        style={{ backgroundColor: '#10B981' }}
                      >
                        {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Mark as Ready
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="ETA (e.g. 2:30 PM, 30 min)"
                            value={etaInputs[order.id] || ''}
                            onChange={(e) => setEtaInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
                            style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                          />
                        </div>
                        <button
                          onClick={() => {
                            const eta = etaInputs[order.id]?.trim();
                            handleStatusChange(order.id, 'out_for_delivery', eta ? { estimatedDeliveryTime: eta } : undefined);
                          }}
                          disabled={isActionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#0EA5E9' }}
                        >
                          {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                          Dispatch for Delivery
                        </button>
                      </div>
                    )}
                    {order.status === 'out_for_delivery' && (
                      <div className="space-y-2">
                        {order.estimatedDeliveryTime && (
                          <div className="flex items-center gap-1.5 text-xs p-2 rounded-lg" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}>
                            <Clock size={12} />
                            <span className="font-medium">ETA: {order.estimatedDeliveryTime}</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleStatusChange(order.id, 'delivered')}
                          disabled={isActionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#059669' }}
                        >
                          {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Mark as Delivered
                        </button>
                      </div>
                    )}

                    {/* Cancel button for non-pending active orders */}
                    {['confirmed', 'preparing', 'ready'].includes(order.status) && (
                      <button
                        onClick={() => { setCancellingOrderId(order.id); setCancelReason(''); setCancelOtherText(''); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border mt-2"
                        style={{ borderColor: '#FCA5A5', color: '#DC2626', backgroundColor: '#FEF2F2' }}
                      >
                        <Ban size={14} />
                        Cancel Order
                      </button>
                    )}

                    {/* Cancellation reason display */}
                    {order.status === 'cancelled' && (order.cancellationReason || order.declinedReason) && (
                      <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
                        <span className="font-medium" style={{ color: '#991B1B' }}>
                          {order.cancelledBy === 'customer' ? 'Cancelled by customer: ' : 'Reason: '}
                        </span>
                        <span style={{ color: '#DC2626' }}>{order.cancellationReason || order.declinedReason}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Cancel order dialog */}
      {cancellingOrderId && (
        <div ref={cancelModalRef} onKeyDown={cancelKeyDown} className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Cancel order">
          <div className="absolute inset-0 bg-black/40" onClick={() => !cancelSubmitting && setCancellingOrderId(null)} />
          <div className="relative mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--aurora-surface, #fff)' }}>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--aurora-text)' }}>Cancel Order</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
              Please select a reason for cancelling this order.
            </p>
            <div className="space-y-2 mb-4">
              {VENDOR_CANCEL_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="vendor-cancel-reason"
                    value={reason}
                    checked={cancelReason === reason}
                    onChange={() => setCancelReason(reason)}
                    className="accent-red-500"
                  />
                  <span className="text-sm" style={{ color: 'var(--aurora-text)' }}>{reason}</span>
                </label>
              ))}
              {cancelReason === 'Other' && (
                <textarea
                  value={cancelOtherText}
                  onChange={(e) => setCancelOtherText(e.target.value)}
                  placeholder="Please describe..."
                  rows={2}
                  maxLength={200}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-red-300"
                  style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                />
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancellingOrderId(null)}
                disabled={cancelSubmitting}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
              >
                Go Back
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelSubmitting || !cancelReason}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#EF4444' }}
              >
                {cancelSubmitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
