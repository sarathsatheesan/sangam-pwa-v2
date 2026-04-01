// ═════════════════════════════════════════════════════════════════════════════════
// VENDOR CATERING DASHBOARD
// Business owners view incoming catering orders and manage them.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  Package, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  User, MapPin, Phone, Calendar, Users, Loader2, AlertCircle, Truck, Ban,
  Square, CheckSquare, Pencil, CreditCard, ExternalLink, Save, X, Bell,
  MessageSquare,
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
  findOrCreateConversation,
  subscribeToCateringNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/cateringService';
import type { CateringNotification } from '@/services/cateringService';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import OrderTimeline from './OrderTimeline';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { STATUS_THEME } from '@/constants/cateringStatusTheme';

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

// SB-10: Derive vendor STATUS_CONFIG from shared STATUS_THEME + add icons
const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={14} />,
  confirmed: <CheckCircle2 size={14} />,
  preparing: <Package size={14} />,
  ready: <CheckCircle2 size={14} />,
  out_for_delivery: <Truck size={14} />,
  delivered: <CheckCircle2 size={14} />,
  cancelled: <XCircle size={14} />,
};
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> =
  Object.fromEntries(
    Object.entries(STATUS_THEME).map(([key, theme]) => [
      key,
      { ...theme, icon: STATUS_ICONS[key] || <Clock size={14} /> },
    ]),
  );

export default function VendorCateringDashboard({ businessId, businessName }: VendorCateringDashboardProps) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const { addToast } = useToast();

  // ── SB-14: New order alert state ──
  const [newOrderBanner, setNewOrderBanner] = useState<{ orderId: string; customerName: string; total: number } | null>(null);
  const prevOrderIdsRef = React.useRef<Set<string>>(new Set());
  const isFirstLoadRef = React.useRef(true);

  // ── Vendor messaging state (H-04) ──
  const [messagingOrderId, setMessagingOrderId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    const unsub = subscribeToBusinessOrders(businessId, async (incoming) => {
      // SB-14: Detect genuinely new orders after initial load
      if (isFirstLoadRef.current) {
        prevOrderIdsRef.current = new Set(incoming.map(o => o.id));
        isFirstLoadRef.current = false;
      } else {
        const prevIds = prevOrderIdsRef.current;
        const newPendingOrders = incoming.filter(o => !prevIds.has(o.id) && o.status === 'pending');
        if (newPendingOrders.length > 0) {
          const newest = newPendingOrders[0];
          setNewOrderBanner({ orderId: newest.id, customerName: newest.customerName || 'Customer', total: newest.total });
          // Play audio chime (Web Audio API — no external dependency)
          // Cross-browser: resume() required for iOS Safari & Chrome autoplay policy
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            // iOS Safari / Chrome require explicit resume after user gesture
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.5);
            // Clean up audio context after playback to free resources (Safari memory)
            setTimeout(() => { audioCtx.close().catch(() => {}); }, 1000);
          } catch { /* audio not available — silent fallback */ }
          // Auto-dismiss banner after 15 seconds
          setTimeout(() => setNewOrderBanner(null), 15000);
        }
        prevOrderIdsRef.current = new Set(incoming.map(o => o.id));
      }
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

    // Capture previous statuses for rollback
    const previousStatuses = new Map<string, CateringOrder['status']>();
    orders.forEach(order => {
      if (selectedOrders.has(order.id)) {
        previousStatuses.set(order.id, order.status);
      }
    });

    // Optimistically update local state
    setOrders(prev => prev.map(o =>
      selectedOrders.has(o.id) ? { ...o, status: action } : o
    ));

    // Clear selection immediately
    setSelectedOrders(new Set());

    try {
      const result = await batchUpdateOrderStatus([...previousStatuses.keys()], action);
      addToast(`${result.success} order(s) ${action}${result.failed ? `, ${result.failed} failed` : ''}`, 'success');
      setBatchMode(false);
    } catch (err: any) {
      // Revert to previous statuses
      setOrders(prev => prev.map(o =>
        previousStatuses.has(o.id) ? { ...o, status: previousStatuses.get(o.id)! } : o
      ));
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

  // ── Pagination state (V-06) ──
  const ORDERS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // ── Notification state (V-12) — subscribed to real-time feed (F-05 fix) ──
  const [notifications, setNotifications] = useState<CateringNotification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // F-05: Subscribe to vendor notifications
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToCateringNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
    });
    return unsub;
  }, [user?.uid]);

  const startEditOrder = (order: CateringOrder) => {
    setEditingOrderId(order.id);
    setEditItems([...order.items]);
    setEditNote('');
  };

  const handleSaveModification = async (order: CateringOrder) => {
    if (!editNote.trim()) { addToast('Please add a note explaining the change', 'error'); return; }
    setEditSaving(true);

    // Calculate new totals
    const subtotal = editItems.reduce((s, it) => s + it.unitPrice * it.qty, 0);
    const tax = Math.round(subtotal * 0.0825);
    const total = subtotal + tax;

    // Capture previous state for rollback
    const previousItems = order.items;
    const previousSubtotal = order.subtotal;
    const previousTax = order.tax;
    const previousTotal = order.total;

    // Optimistically update local state
    setOrders(prev => prev.map(o =>
      o.id === order.id
        ? { ...o, items: editItems, subtotal, tax, total }
        : o
    ));

    // Close edit form immediately
    setEditingOrderId(null);

    try {
      await vendorModifyOrder(order.id, {
        items: editItems,
        subtotal,
        tax,
        total,
        note: editNote.trim(),
      });
      addToast('Order modified. Customer will be notified.', 'success');
    } catch (err: any) {
      // Revert to previous state
      setOrders(prev => prev.map(o =>
        o.id === order.id
          ? {
              ...o,
              items: previousItems,
              subtotal: previousSubtotal,
              tax: previousTax,
              total: previousTotal,
            }
          : o
      ));
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

    // Capture previous status for rollback
    const orderToCancel = orders.find(o => o.id === cancellingOrderId);
    const previousStatus = orderToCancel?.status;

    // Optimistically set status to cancelled
    setOrders(prev => prev.map(o =>
      o.id === cancellingOrderId ? { ...o, status: 'cancelled' } : o
    ));

    // Close dialog immediately
    setCancellingOrderId(null);
    setCancelReason('');
    setCancelOtherText('');

    try {
      await cancelOrder(cancellingOrderId, reason, 'vendor');
      addToast('Order cancelled', 'success');
    } catch (err: any) {
      // Revert to previous status
      if (previousStatus) {
        setOrders(prev => prev.map(o =>
          o.id === cancellingOrderId ? { ...o, status: previousStatus } : o
        ));
      }
      addToast(err.message || 'Failed to cancel order', 'error');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: CateringOrder['status'], extra?: Record<string, any>) => {
    setActionLoading(orderId);

    // Capture previous status for rollback
    const orderToUpdate = orders.find(o => o.id === orderId);
    const prevStatus = orderToUpdate?.status;

    // Optimistically update local state
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: newStatus } : o
    ));

    try {
      await updateOrderStatus(orderId, newStatus, extra);
      addToast(`Order ${newStatus.replace(/_/g, ' ')}`, 'success');
    } catch (err: any) {
      // Revert to previous status
      if (prevStatus) {
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, status: prevStatus } : o
        ));
      }
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

  // Reset page to 1 when filter changes (V-06)
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Compute paginated orders (V-06)
  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE,
  );

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
      {/* SB-14: New order persistent banner */}
      {newOrderBanner && (
        <div
          className="flex items-center justify-between p-3 rounded-xl border animate-pulse"
          style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F59E0B' }}>
              <Bell size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400E' }}>
                New order from {newOrderBanner.customerName}
              </p>
              <p className="text-xs" style={{ color: '#A16207' }}>
                {formatPrice(newOrderBanner.total)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setExpandedOrder(newOrderBanner.orderId);
                setFilter('pending');
                setNewOrderBanner(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: '#F59E0B' }}
            >
              View Order
            </button>
            <button
              onClick={() => setNewOrderBanner(null)}
              className="p-2.5 rounded hover:bg-amber-200 transition-colors"
              style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Dismiss"
            >
              <X size={16} style={{ color: '#92400E' }} />
            </button>
          </div>
        </div>
      )}

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
          {/* V-12: Notification bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={`Notifications${notifications.filter(n => !n.read).length > 0 ? ` (${notifications.filter(n => !n.read).length} unread)` : ''}`}
            >
              <Bell size={20} className="text-gray-600" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            {showNotifPanel && (
              <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg z-50">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
                  <span className="text-sm font-semibold text-gray-900">Notifications</span>
                  {notifications.filter(n => !n.read).length > 0 && (
                    <button
                      onClick={() => {
                        if (!user?.uid) return;
                        markAllNotificationsRead(user.uid).catch(console.warn);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500">No notifications yet</div>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        // Mark this notification as read
                        if (!n.read) {
                          markNotificationRead(n.id).catch(console.warn);
                        }
                        // Expand the related order if it exists
                        if (n.orderId) {
                          setExpandedOrder(n.orderId);
                          setShowNotifPanel(false);
                        }
                      }}
                      className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-indigo-50/50' : ''}`}
                    >
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{n.body}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
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
          {/* SB-09: Onboarding empty state for new vendors */}
          {filter === 'all' && orders.length === 0 ? (
            <div className="max-w-sm mx-auto">
              <Package size={40} className="mx-auto mb-4 opacity-30" />
              <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--aurora-text)' }}>
                Welcome to Your Dashboard!
              </h3>
              <p className="text-sm mb-5" style={{ color: 'var(--aurora-text-secondary)' }}>
                You&apos;re all set to receive catering orders. Here&apos;s how to get started:
              </p>
              <div className="text-left space-y-3 mb-5">
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>1</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>Set up payment info</p>
                    <p className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>Add your payment link so customers can pay you</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>2</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>Add menu items</p>
                    <p className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>Create your catering menu so customers can browse</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>3</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>Your first order will appear here</p>
                    <p className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>You&apos;ll get an alert with a chime when a new order comes in</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentSettings(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#6366F1' }}
              >
                <CreditCard size={14} className="inline mr-1.5 -mt-0.5" />
                Set Up Payment Info
              </button>
            </div>
          ) : (
            <>
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
                No {filter === 'all' ? '' : filter} orders yet
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedOrders.map((order) => {
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

                    {/* Order Timeline */}
                    <div className="pt-2">
                      <OrderTimeline order={order} perspective="vendor" />
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
                            {/* V-07: Make new item names editable */}
                            {item.menuItemId.startsWith('added_') ? (
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => {
                                  const updated = [...editItems];
                                  const idx = updated.findIndex(it => it.menuItemId === item.menuItemId);
                                  if (idx >= 0) updated[idx] = { ...updated[idx], name: e.target.value };
                                  setEditItems(updated);
                                }}
                                placeholder="Item name"
                                className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
                                style={{ color: 'var(--aurora-text)' }}
                              />
                            ) : (
                              <span className="flex-1 truncate" style={{ color: 'var(--aurora-text)' }}>{item.name}</span>
                            )}
                            {/* SB-03: Display price in dollars, store in cents */}
                            <span className="text-xs text-gray-400 mr-0.5">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={(editItems[i].unitPrice / 100).toFixed(2)}
                              onChange={(e) => setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, unitPrice: Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)) } : it))}
                              placeholder="0.00"
                              className="w-20 text-center text-sm border border-gray-200 rounded px-1 py-1"
                              style={{ color: 'var(--aurora-text)' }}
                            />
                            <span style={{ color: 'var(--aurora-text-secondary)' }}>{formatPrice(item.unitPrice * editItems[i].qty)}</span>
                          </div>
                        ))}
                        {/* V-07: Add new item button */}
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <button
                            onClick={() => {
                              setEditItems(prev => [...prev, {
                                menuItemId: `added_${Date.now()}`,
                                name: '',
                                qty: 1,
                                unitPrice: 0,
                                pricingType: 'per_person',
                              }]);
                            }}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            + Add Item
                          </button>
                        </div>
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
                        {/* Vendor modification notice + rejection badge (F-06) + SB-15 recovery */}
                        {order.vendorModified && (
                          <div>
                            <div className="text-xs p-2 rounded-lg" style={{ backgroundColor: (order as any).modificationRejected ? '#FEE2E2' : '#FEF3C7', color: (order as any).modificationRejected ? '#991B1B' : '#92400E' }}>
                              <span className="font-medium">
                                {(order as any).modificationRejected ? '✗ Customer rejected modification: ' : (order as any).modificationAccepted ? '✓ Customer accepted modification: ' : 'Modified: '}
                              </span>
                              {order.vendorModificationNote || 'Items adjusted by vendor'}
                            </div>
                            {/* SB-15: Rejection recovery — Revert + Counter-Proposal */}
                            {(order as any).modificationRejected && order.originalItems && ['confirmed', 'preparing'].includes(order.status) && (
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      const origSubtotal = calculateOrderTotal(order.originalItems!);
                                      const origTax = Math.round(origSubtotal * 0.0825);
                                      await vendorModifyOrder(order.id, {
                                        items: order.originalItems!,
                                        subtotal: origSubtotal,
                                        tax: origTax,
                                        total: origSubtotal + origTax,
                                        note: 'Reverted to original order items per customer request',
                                      });
                                      addToast('Order reverted to original items', 'success');
                                    } catch (err: any) {
                                      addToast(err.message || 'Failed to revert order', 'error');
                                    }
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border"
                                  style={{ borderColor: '#10B981', color: '#059669', backgroundColor: '#ECFDF5' }}
                                >
                                  Revert to Original
                                </button>
                                <button
                                  onClick={() => startEditOrder(order)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border"
                                  style={{ borderColor: '#6366F1', color: '#6366F1', backgroundColor: '#EEF2FF' }}
                                >
                                  <Pencil size={10} /> Send Counter-Proposal
                                </button>
                              </div>
                            )}
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

                    {/* Message Customer button */}
                    {!['cancelled', 'delivered'].includes(order.status) && (
                      <button
                        onClick={async () => {
                          try {
                            await findOrCreateConversation(
                              order.customerId, user!.uid, `Re: Order #${order.id.slice(0, 8)}`
                            );
                            setMessagingOrderId(order.id);
                          } catch (err) {
                            addToast('Could not start conversation', 'error');
                          }
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border"
                        style={{ borderColor: '#6366F1', color: '#6366F1', backgroundColor: 'rgba(99,102,241,0.04)' }}
                      >
                        <MessageSquare size={14} />
                        Message Customer
                      </button>
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
                      <div className="space-y-2">
                        {/* SB-17: Prep time estimate input */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Est. ready by (e.g. 2:30 PM)"
                            value={etaInputs[`prep_${order.id}`] || ''}
                            onChange={(e) => setEtaInputs(prev => ({ ...prev, [`prep_${order.id}`]: e.target.value }))}
                            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/30"
                            style={{ backgroundColor: 'var(--aurora-bg)', borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                          />
                          {etaInputs[`prep_${order.id}`]?.trim() && (
                            <button
                              onClick={() => {
                                const eta = etaInputs[`prep_${order.id}`]?.trim();
                                if (eta) {
                                  handleStatusChange(order.id, 'preparing' as any, { estimatedDeliveryTime: eta }).catch(() => {});
                                  addToast('Prep time estimate shared with customer', 'success');
                                }
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-medium text-white"
                              style={{ backgroundColor: '#8B5CF6' }}
                            >
                              Share
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => handleStatusChange(order.id, 'ready')}
                          disabled={isActionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#10B981' }}
                        >
                          {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Mark as Ready
                        </button>
                      </div>
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
          {/* V-06: Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-4">
              <span className="text-sm text-gray-600">
                Showing {(currentPage - 1) * ORDERS_PER_PAGE + 1}–{Math.min(currentPage * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Cancel order dialog */}
      {cancellingOrderId && (
        <div ref={cancelModalRef} onKeyDown={cancelKeyDown} className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Cancel order">
          <div className="absolute inset-0 bg-black/40" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => !cancelSubmitting && setCancellingOrderId(null)} />
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

      {/* Inline messaging modal (H-04) */}
      {messagingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-3">Message Customer</h3>
            <p className="text-sm text-gray-500 mb-3">Order #{messagingOrderId.slice(0, 8)}</p>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              maxLength={500}
              rows={4}
              className="w-full rounded-lg border border-gray-200 p-3 text-sm resize-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
            />
            <div className="text-xs text-gray-400 text-right mt-1">{messageText.length}/500</div>
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => { setMessagingOrderId(null); setMessageText(''); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!messageText.trim()) return;
                  setSendingMessage(true);
                  try {
                    const order = orders.find(o => o.id === messagingOrderId);
                    if (!order) throw new Error('Order not found');
                    const convId = await findOrCreateConversation(order.customerId, user!.uid);
                    await addDoc(collection(db, 'conversations', convId, 'messages'), {
                      text: messageText.trim(),
                      senderId: user!.uid,
                      createdAt: Timestamp.now(),
                      encrypted: false,
                    });
                    addToast('Message sent!', 'success');
                    setMessagingOrderId(null);
                    setMessageText('');
                  } catch (err) {
                    addToast('Failed to send message', 'error');
                  } finally {
                    setSendingMessage(false);
                  }
                }}
                disabled={sendingMessage || !messageText.trim()}
                className="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: '#6366F1' }}
              >
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
