// ═════════════════════════════════════════════════════════════════════════════════
// CATERING ORDER STATUS TIMELINE
// Customer-facing order tracking view with visual status timeline,
// order details, and real-time status updates.
// Phase 3: Polish & Admin
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  ArrowLeft, Clock, CheckCircle2, Package, Truck, XCircle, MapPin,
  User, Phone, Calendar, Users, ChevronDown, ChevronUp, Loader2,
  UtensilsCrossed, FileText, Star, Ban, CreditCard, ExternalLink,
  MessageSquare, AlertTriangle,
} from 'lucide-react';
import type { CateringOrder } from '@/services/cateringService';
import { subscribeToCustomerOrders, formatPrice, batchHasReviewedOrders, cancelOrder, getBusinessPaymentInfo, notifyVendorModificationRejected, updateOrderPaymentStatus } from '@/services/cateringService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import CateringReviewForm from './CateringReviewForm';
import OrderTimeline from './OrderTimeline';
import OrderMessages from './OrderMessages';
import { doc, getDoc, updateDoc, serverTimestamp, collection, addDoc, query, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { STATUS_THEME, CUSTOMER_STATUS_LABELS } from '@/constants/cateringStatusTheme';

const CUSTOMER_CANCEL_REASONS = [
  'Changed plans',
  'Found another caterer',
  'Ordered by mistake',
  'Event postponed',
  'Other',
];

interface CateringOrderStatusProps {
  onBack: () => void;
}

// ── Status timeline configuration — SB-10: colors from shared STATUS_THEME ──
const STATUS_STEP_ICONS: Record<string, any> = {
  pending: FileText,
  confirmed: CheckCircle2,
  preparing: UtensilsCrossed,
  ready: Package,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
};

const STATUS_STEPS = [
  { key: 'pending', label: CUSTOMER_STATUS_LABELS.pending, icon: STATUS_STEP_ICONS.pending, color: STATUS_THEME.pending.color, description: STATUS_THEME.pending.description },
  { key: 'confirmed', label: CUSTOMER_STATUS_LABELS.confirmed, icon: STATUS_STEP_ICONS.confirmed, color: STATUS_THEME.confirmed.color, description: STATUS_THEME.confirmed.description },
  { key: 'preparing', label: CUSTOMER_STATUS_LABELS.preparing, icon: STATUS_STEP_ICONS.preparing, color: STATUS_THEME.preparing.color, description: STATUS_THEME.preparing.description },
  { key: 'ready', label: CUSTOMER_STATUS_LABELS.ready, icon: STATUS_STEP_ICONS.ready, color: STATUS_THEME.ready.color, description: STATUS_THEME.ready.description },
  { key: 'out_for_delivery', label: CUSTOMER_STATUS_LABELS.out_for_delivery, icon: STATUS_STEP_ICONS.out_for_delivery, color: STATUS_THEME.out_for_delivery.color, description: STATUS_THEME.out_for_delivery.description },
  { key: 'delivered', label: CUSTOMER_STATUS_LABELS.delivered, icon: STATUS_STEP_ICONS.delivered, color: STATUS_THEME.delivered.color, description: STATUS_THEME.delivered.description },
] as const;

const CANCELLED_STEP = { key: 'cancelled', label: CUSTOMER_STATUS_LABELS.cancelled, icon: XCircle, color: STATUS_THEME.cancelled.color, description: STATUS_THEME.cancelled.description };

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : -1;
}

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZoneName: 'short',
  });
}

export default function CateringOrderStatus({ onBack }: CateringOrderStatusProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  // SB-41: Detect prefers-reduced-motion for animations
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mq.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, []);
  // SB-43: Initialize expandedOrder from URL hash
  const [expandedOrder, setExpandedOrder] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#order-', '');
      return hash && hash !== '' ? hash : null;
    }
    return null;
  });
  const [reviewingOrder, setReviewingOrder] = useState<CateringOrder | null>(null);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(new Set());
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOtherText, setCancelOtherText] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  // messagingOrderId removed — messaging is now inline via OrderMessages component
  const [respondingToModification, setRespondingToModification] = useState<string | null>(null);

  const cancelDialogClose = useCallback(() => {
    if (!cancelSubmitting) setCancellingOrderId(null);
  }, [cancelSubmitting]);
  const { modalRef: cancelModalRef, handleKeyDown: cancelKeyDown } = useModalA11y(
    !!cancellingOrderId,
    cancelDialogClose,
  );

  // SB-43: Sync expanded order state to URL hash
  const toggleExpandedOrder = useCallback((orderId: string) => {
    setExpandedOrder((prev) => {
      const newExpanded = prev === orderId ? null : orderId;
      if (typeof window !== 'undefined') {
        if (newExpanded) {
          window.history.replaceState(null, '', `#order-${newExpanded}`);
        } else {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
      return newExpanded;
    });
  }, []);

  const handleCancelOrder = async () => {
    if (!cancellingOrderId) return;
    const reason = cancelReason === 'Other' ? cancelOtherText.trim() || 'Other' : cancelReason;
    if (!reason) { addToast('Please select a reason', 'error'); return; }
    setCancelSubmitting(true);

    // Optimistic: update local state immediately
    const prevOrders = orders;
    setOrders(prev => prev.map(o =>
      o.id === cancellingOrderId ? { ...o, status: 'cancelled' as const, cancellationReason: reason, cancelledBy: 'customer' as const } : o,
    ));
    setCancellingOrderId(null);
    setCancelReason('');
    setCancelOtherText('');

    try {
      await cancelOrder(cancellingOrderId, reason, 'customer');
      addToast('Order cancelled', 'success');
    } catch (err: any) {
      // Revert on error
      setOrders(prevOrders);
      addToast(err.message || 'Failed to cancel order', 'error');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Check which delivered orders have already been reviewed (F-11: batched query)
  useEffect(() => {
    if (!user || orders.length === 0) return;
    const deliveredIds = orders.filter(o => o.status === 'delivered').map(o => o.id);
    if (deliveredIds.length === 0) return;
    batchHasReviewedOrders(user.uid, deliveredIds)
      .then(setReviewedOrderIds)
      .catch(() => { /* silent */ });
  }, [user, orders]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToCustomerOrders(user.uid, (incoming) => {
      setOrders(incoming);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} style={{ color: 'var(--aurora-text)' }} />
        </button>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>My Orders</h2>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            Track your catering orders in real time
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Package size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
            No orders yet
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
            Browse a category and place an order to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrder === order.id;
            const isCancelled = order.status === 'cancelled';
            const currentIdx = getStepIndex(order.status);

            return (
              <div
                key={order.id}
                className="rounded-2xl border overflow-hidden"
                style={{
                  backgroundColor: 'var(--aurora-surface)',
                  borderColor: isCancelled ? '#FCA5A5' : currentIdx >= 5 ? '#6EE7B7' : 'var(--aurora-border)',
                }}
              >
                {/* Order header */}
                <button
                  onClick={() => toggleExpandedOrder(order.id)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                        {order.businessName}
                      </span>
                      <StatusBadge status={order.status} />
                      {order.rfpOrigin && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}>
                          RFP
                        </span>
                      )}
                      {order.vendorModified && !order.modificationAccepted && !order.modificationRejected && (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className={`absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 ${!prefersReducedMotion ? 'animate-ping' : ''}`} />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                        </span>
                      )}
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
                      <span className="font-semibold" style={{ color: '#6366F1' }}>
                        {formatPrice(order.total)}
                      </span>
                    </div>
                    {/* SB-35: Notification for pending vendor modifications */}
                    {order.vendorModified && !order.modificationAccepted && !order.modificationRejected && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <AlertTriangle size={12} className="text-amber-500" />
                        <span className="text-[11px] font-medium text-amber-700">
                          Vendor modified this order — review needed
                        </span>
                      </div>
                    )}
                    {/* ETA badge — shown for active orders with estimated delivery time */}
                    {order.estimatedDeliveryTime && !['delivered', 'cancelled'].includes(order.status) && (
                      <div
                        className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium w-fit"
                        style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0369A1' }}
                      >
                        <Clock size={10} />
                        ETA: {order.estimatedDeliveryTime}
                      </div>
                    )}

                    {/* SB-17: Pulsing badge for "preparing" status */}
                    {order.status === 'preparing' && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${!prefersReducedMotion ? 'animate-ping' : ''}`} style={{ backgroundColor: '#8B5CF6' }} />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: '#8B5CF6' }} />
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: '#6D28D9' }}>
                          Your chef is working on it{order.estimatedDeliveryTime ? ` — ready by ${order.estimatedDeliveryTime}` : ''}
                        </span>
                      </div>
                    )}

                    {/* SB-16: Delivery celebration */}
                    {order.status === 'delivered' && (
                      <div
                        className="flex items-center gap-2 mt-1.5 px-3 py-1.5 rounded-lg"
                        style={{ backgroundColor: '#D1FAE5' }}
                      >
                        <span className="text-base">&#127881;</span>
                        <span className="text-xs font-semibold" style={{ color: '#065F46' }}>
                          Your food is here! Enjoy your meal.
                        </span>
                      </div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="opacity-40" /> : <ChevronDown size={18} className="opacity-40" />}
                </button>

                {/* Expanded: Timeline + Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--aurora-border)' }}>

                    {/* ── Order Progress Stepper — shows full pipeline with current step highlighted ── */}
                    {!isCancelled && (
                      <div className="pt-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--aurora-text-muted)' }}>
                          Order Progress
                        </h4>
                        <div className="flex items-start justify-between relative">
                          {/* Connecting line behind the dots */}
                          <div
                            className="absolute top-4 left-0 right-0 h-0.5"
                            style={{ backgroundColor: 'var(--aurora-border)', marginLeft: '1rem', marginRight: '1rem' }}
                          />
                          {/* Filled progress line */}
                          <div
                            className="absolute top-4 left-0 h-0.5 transition-all duration-500"
                            style={{
                              backgroundColor: STATUS_STEPS[Math.min(currentIdx, STATUS_STEPS.length - 1)]?.color || '#6366F1',
                              marginLeft: '1rem',
                              width: currentIdx >= 0 ? `calc(${(currentIdx / (STATUS_STEPS.length - 1)) * 100}% - 2rem)` : '0',
                            }}
                          />
                          {STATUS_STEPS.map((step, idx) => {
                            const StepIcon = step.icon;
                            const isCompleted = idx < currentIdx;
                            const isCurrent = idx === currentIdx;
                            const isFuture = idx > currentIdx;
                            return (
                              <div key={step.key} className="flex flex-col items-center relative z-10" style={{ flex: '1 1 0', minWidth: 0 }}>
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                                  style={{
                                    backgroundColor: isCurrent ? step.color : isCompleted ? step.color : 'var(--aurora-bg)',
                                    boxShadow: isCurrent ? `0 0 0 4px ${step.color}22` : 'none',
                                  }}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 size={14} className="text-white" strokeWidth={2.5} />
                                  ) : (
                                    <StepIcon
                                      size={14}
                                      strokeWidth={2}
                                      style={{ color: isCurrent ? '#fff' : isFuture ? 'var(--aurora-text-muted)' : '#fff' }}
                                    />
                                  )}
                                </div>
                                <span
                                  className="text-[10px] sm:text-[11px] mt-1.5 text-center leading-tight font-medium px-0.5"
                                  style={{
                                    color: isCurrent ? step.color : isCompleted ? 'var(--aurora-text)' : 'var(--aurora-text-muted)',
                                  }}
                                >
                                  {step.label}
                                </span>
                                {isCurrent && (
                                  <span
                                    className="text-[9px] mt-0.5 text-center leading-tight"
                                    style={{ color: step.color }}
                                  >
                                    Current
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Cancelled banner */}
                    {isCancelled && (
                      <div className="pt-4 flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#FEF2F2' }}>
                        <XCircle size={16} style={{ color: '#EF4444' }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#991B1B' }}>Order Cancelled</p>
                          {order.cancellationReason && (
                            <p className="text-xs mt-0.5" style={{ color: '#B91C1C' }}>
                              Reason: {order.cancellationReason}
                              {order.cancelledBy ? ` (by ${order.cancelledBy})` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Status Timeline — detailed event log */}
                    <div className="pt-2">
                      <OrderTimeline
                        order={order}
                        perspective="customer"
                      />
                    </div>

                    {/* Order details */}
                    <div className="space-y-3">
                      {/* Contact & Delivery */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                          <User size={14} className="shrink-0" />
                          <span className="truncate">{order.contactName}</span>
                        </div>
                        <div className="flex items-center gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                          <Phone size={14} className="shrink-0" />
                          <span className="truncate">{order.contactPhone}</span>
                        </div>
                        <div className="col-span-2 flex items-start gap-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                          <MapPin size={14} className="mt-0.5 shrink-0" />
                          <span className="text-xs">
                            {order.deliveryAddress?.formattedAddress ||
                              [order.deliveryAddress?.street, order.deliveryAddress?.city, order.deliveryAddress?.state, order.deliveryAddress?.zip]
                                .filter(Boolean).join(', ')}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--aurora-surface-variant, #F8F9FC)' }}>
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
                            <span style={{ color: '#6366F1' }}>{formatPrice(order.total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Special instructions */}
                      {order.specialInstructions && (
                        <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
                          <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>Note: </span>
                          <span style={{ color: 'var(--aurora-text-secondary)' }}>{order.specialInstructions}</span>
                        </div>
                      )}

                      {/* Declined / Cancellation reason */}
                      {order.status === 'cancelled' && (order.cancellationReason || order.declinedReason) && (
                        <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
                          <span className="font-medium" style={{ color: '#991B1B' }}>
                            {order.cancelledBy === 'vendor' ? 'Cancelled by vendor: ' : 'Reason: '}
                          </span>
                          <span style={{ color: '#DC2626' }}>{order.cancellationReason || order.declinedReason}</span>
                        </div>
                      )}

                      {/* ── Vendor modification re-approval flow (H-06) ── */}
                      {order.vendorModified && order.vendorModifiedAt && (
                        <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle size={14} className="text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">Order Modified by Vendor</span>
                          </div>
                          {order.vendorModificationNote && (
                            <p className="text-xs text-amber-700 mb-2">{order.vendorModificationNote}</p>
                          )}
                          {/* Show original vs modified items comparison */}
                          {order.originalItems && (
                            <div className="text-xs text-amber-700 mb-2">
                              <p className="font-medium">Changes:</p>
                              {order.items.map((item, i) => {
                                const orig = order.originalItems?.find(o => o.menuItemId === item.menuItemId);
                                if (!orig) return <p key={i}>+ Added: {item.qty}x {item.name}</p>;
                                if (orig.qty !== item.qty) return <p key={i}>{item.name}: {orig.qty} → {item.qty}</p>;
                                return null;
                              })}
                              {order.originalItems.filter(o => !order.items.find(i => i.menuItemId === o.menuItemId)).map((item, i) => (
                                <p key={`removed-${i}`}>- Removed: {item.qty}x {item.name}</p>
                              ))}
                            </div>
                          )}
                          {/* Accept/Reject buttons (only if not yet responded) */}
                          {!order.modificationAccepted && !order.modificationRejected && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={async () => {
                                  setRespondingToModification(order.id);
                                  try {
                                    await updateDoc(doc(db, 'cateringOrders', order.id), {
                                      modificationAccepted: true,
                                      modificationRespondedAt: serverTimestamp(),
                                    });
                                    addToast('Modification accepted', 'success');
                                  } catch { addToast('Failed to respond', 'error'); }
                                  setRespondingToModification(null);
                                }}
                                disabled={respondingToModification === order.id}
                                className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                Accept Changes
                              </button>
                              <button
                                onClick={async () => {
                                  setRespondingToModification(order.id);
                                  try {
                                    await updateDoc(doc(db, 'cateringOrders', order.id), {
                                      modificationRejected: true,
                                      modificationRespondedAt: serverTimestamp(),
                                    });
                                    // SB-36: Revert to original items on rejection
                                    if (order.originalItems) {
                                      await updateDoc(doc(db, 'cateringOrders', order.id), {
                                        items: order.originalItems,
                                        total: order.originalItems.reduce((sum: number, i: any) => sum + i.unitPrice * i.qty, 0),
                                        vendorModified: false,
                                      });
                                    }
                                    // F-06: Notify vendor of rejection
                                    const bizSnap = await getDoc(doc(db, 'businesses', order.businessId));
                                    const vendorOwnerId = bizSnap.exists() ? bizSnap.data()?.ownerId : null;
                                    if (vendorOwnerId) {
                                      notifyVendorModificationRejected(
                                        vendorOwnerId,
                                        order.id,
                                        order.contactName || 'Customer',
                                        order.businessName,
                                      ).catch(console.warn);
                                    }
                                    addToast('Modification rejected — vendor has been notified', 'success');
                                  } catch { addToast('Failed to respond', 'error'); }
                                  setRespondingToModification(null);
                                }}
                                disabled={respondingToModification === order.id}
                                className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject Changes
                              </button>
                            </div>
                          )}
                          {order.modificationAccepted && (
                            <p className="text-xs text-green-700 mt-1 font-medium">✓ You accepted these changes</p>
                          )}
                          {order.modificationRejected && (
                            <p className="text-xs text-red-700 mt-1 font-medium">✗ Changes rejected — order reverted to original items. Vendor has been notified.</p>
                          )}
                        </div>
                      )}

                      {/* ── Delivery tracking status display (H-07) ── */}
                      {order.status === 'out_for_delivery' && (
                        <div className="mt-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
                          <div className="flex items-center gap-2 mb-1">
                            <Truck size={14} className="text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Out for Delivery</span>
                          </div>
                          {order.estimatedDeliveryTime && (
                            <p className="text-xs text-blue-700">
                              Estimated arrival: <strong>{order.estimatedDeliveryTime}</strong>
                            </p>
                          )}
                          <p className="text-xs text-blue-600 mt-1">
                            Your order is on the way. The vendor will mark it as delivered upon completion.
                          </p>
                        </div>
                      )}

                      {/* ── Payment info (#13) ── */}
                      {order.paymentStatus && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                          order.paymentStatus === 'refunded' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {order.paymentStatus === 'paid' ? '✓ Paid' :
                           order.paymentStatus === 'refunded' ? '↩ Refunded' :
                           '⏳ Payment Pending'}
                        </span>
                      )}
                      {['confirmed', 'preparing', 'ready'].includes(order.status) && (
                        <PaymentInfoSection
                          businessId={order.businessId}
                          orderId={order.id}
                          total={order.total}
                          paymentStatus={order.paymentStatus}
                          onPaymentConfirmed={() => {
                            addToast('Payment confirmed! Vendor has been notified.', 'success');
                          }}
                        />
                      )}

                      {/* ── In-order messages (OrderNotes subcollection — works for both customer & vendor) ── */}
                      {!['cancelled'].includes(order.status) && user && (
                        <OrderMessages
                          orderId={order.id}
                          currentUserId={user.uid}
                          currentUserName={user.displayName || 'Customer'}
                          currentUserRole="customer"
                        />
                      )}

                      {/* Cancel Order button — for pending/confirmed orders */}
                      {['pending', 'confirmed'].includes(order.status) && (
                        <button
                          onClick={() => { setCancellingOrderId(order.id); setCancelReason(''); setCancelOtherText(''); }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border"
                          style={{ borderColor: '#FCA5A5', color: '#DC2626', backgroundColor: '#FEF2F2' }}
                        >
                          <Ban size={14} />
                          Cancel Order
                        </button>
                      )}

                      {/* SB-04: Disabled cancel with explanation for preparing/ready orders */}
                      {['preparing', 'ready'].includes(order.status) && (
                        <div className="group relative">
                          <button
                            disabled
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border opacity-40 cursor-not-allowed"
                            style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-muted)', backgroundColor: 'var(--aurora-bg)' }}
                          >
                            <Ban size={14} />
                            Cancel Order
                          </button>
                          <div className="mt-1.5 flex items-start gap-1.5 px-1">
                            <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-700">
                              This order is already being {order.status === 'preparing' ? 'prepared' : 'readied'}. To request cancellation, please message the vendor directly.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── Review prompt after delivery (H-08) ── */}
                      {order.status === 'delivered' && !reviewedOrderIds.has(order.id) && (
                        <div className="mt-3 p-3 rounded-lg border border-green-200 bg-green-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-800">How was your order?</p>
                              <p className="text-xs text-green-600 mt-0.5">Your feedback helps other customers and the vendor</p>
                            </div>
                            <button
                              onClick={() => setReviewingOrder(order)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg text-white"
                              style={{ backgroundColor: '#6366F1' }}
                            >
                              <Star size={12} className="inline mr-1" />
                              Leave Review
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Already reviewed indicator */}
                      {order.status === 'delivered' && reviewedOrderIds.has(order.id) && (
                        <div
                          className="flex items-center gap-2 p-3 rounded-xl"
                          style={{ backgroundColor: 'rgba(245, 158, 11, 0.06)' }}
                        >
                          <Star size={14} fill="#F59E0B" stroke="#F59E0B" />
                          <span className="text-sm font-medium" style={{ color: '#92400E' }}>
                            You reviewed this order
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review modal */}
      {reviewingOrder && (
        <CateringReviewForm
          order={reviewingOrder}
          onClose={() => setReviewingOrder(null)}
          onSubmitted={() => {
            setReviewedOrderIds(prev => new Set([...prev, reviewingOrder.id]));
            setReviewingOrder(null);
          }}
        />
      )}

      {/* Messaging is now handled inline via OrderMessages component on each order card */}

      {/* Cancel order dialog */}
      {cancellingOrderId && (
        <div ref={cancelModalRef} onKeyDown={cancelKeyDown} className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Cancel order">
          <div className="absolute inset-0 bg-black/40" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => !cancelSubmitting && setCancellingOrderId(null)} />
          <div className="relative mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--aurora-surface, #fff)' }}>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--aurora-text)' }}>Cancel Order</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
              Please let us know why you're cancelling.
            </p>
            <div className="space-y-2 mb-4">
              {CUSTOMER_CANCEL_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="cancel-reason"
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
                Keep Order
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

// ── Payment Info Section (SB-27) ──
function PaymentInfoSection({
  businessId,
  orderId,
  total,
  paymentStatus,
  onPaymentConfirmed,
}: {
  businessId: string;
  orderId: string;
  total: number;
  paymentStatus?: string;
  onPaymentConfirmed?: () => void;
}) {
  const { addToast } = useToast();
  const [info, setInfo] = useState<{ paymentUrl?: string; paymentMethod?: string; paymentNote?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paymentLinkClicked, setPaymentLinkClicked] = useState(false);

  useEffect(() => {
    getBusinessPaymentInfo(businessId)
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) return null;
  if (!info || (!info.paymentUrl && !info.paymentMethod && !info.paymentNote)) return null;

  // Already paid
  if (paymentStatus === 'paid') {
    return (
      <div className="rounded-xl border p-3 flex items-center gap-2" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
        <CheckCircle2 size={16} style={{ color: '#059669' }} />
        <span className="text-sm font-medium" style={{ color: '#059669' }}>Payment confirmed</span>
      </div>
    );
  }

  const handleConfirmPayment = async () => {
    setConfirming(true);
    try {
      await updateOrderPaymentStatus(orderId, 'paid', {
        paymentMethod: info?.paymentMethod || 'External',
        paymentNote: 'Customer confirmed payment via app',
      });
      if (onPaymentConfirmed) onPaymentConfirmed();
      setShowConfirmDialog(false);
    } catch (err) {
      console.error('Failed to confirm payment:', err);
      addToast('Payment confirmation failed. Please try again.', 'error');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'rgba(99,102,241,0.03)' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={14} style={{ color: '#6366F1' }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6366F1' }}>Payment Required</span>
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>{formatPrice(total)}</span>
        </div>

        {/* Payment Method */}
        {info.paymentMethod && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>Method:</span>
            {info.paymentMethod}
          </div>
        )}

        {/* Instructions */}
        {info.paymentNote && (
          <div className="text-xs p-2.5 rounded-lg" style={{ backgroundColor: 'var(--aurora-bg)', color: 'var(--aurora-text-secondary)' }}>
            {info.paymentNote}
          </div>
        )}

        {/* Steps */}
        <div className="space-y-2 pt-1">
          {/* Step 1: Pay via external link */}
          {info.paymentUrl && (
            <a
              href={info.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setPaymentLinkClicked(true)}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#6366F1' }}
            >
              <ExternalLink size={14} />
              Step 1: Pay {formatPrice(total)}
            </a>
          )}

          {/* Step 2: Confirm payment */}
          <button
            onClick={() => setShowConfirmDialog(true)}
            disabled={info.paymentUrl ? !paymentLinkClicked : false}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: (info.paymentUrl && !paymentLinkClicked) ? 'var(--aurora-surface-variant)' : '#059669',
              color: (info.paymentUrl && !paymentLinkClicked) ? 'var(--aurora-text-muted)' : '#fff',
              border: (info.paymentUrl && !paymentLinkClicked) ? '1px solid var(--aurora-border)' : 'none',
            }}
          >
            <CheckCircle2 size={14} />
            {info.paymentUrl ? 'Step 2: I\'ve Completed Payment' : 'I\'ve Completed Payment'}
          </button>
        </div>

        {info.paymentUrl && !paymentLinkClicked && (
          <p className="text-[10px] text-center" style={{ color: 'var(--aurora-text-muted)' }}>
            Click the payment link above first, then confirm your payment.
          </p>
        )}
      </div>

      {/* Confirm Payment Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ backgroundColor: 'var(--aurora-surface)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
                <CheckCircle2 size={20} style={{ color: '#059669' }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>Confirm Payment</h3>
            </div>
            <p className="text-sm mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
              Please confirm that you have completed payment of <strong>{formatPrice(total)}</strong>.
            </p>
            <p className="text-xs mb-5" style={{ color: 'var(--aurora-text-muted)' }}>
              The vendor will be notified that you've marked this order as paid. If payment hasn't been received, the vendor may follow up.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2.5 text-sm rounded-lg border font-medium transition-colors"
                style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
              >
                Not Yet
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={confirming}
                className="px-4 py-2.5 text-sm rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#059669' }}
              >
                {confirming && <Loader2 size={14} className="animate-spin" />}
                Yes, I've Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Message Vendor Button (#14) ──
function MessageVendorButton({
  businessId,
  businessName,
  orderId,
  onOpenMessaging,
}: {
  businessId: string;
  businessName: string;
  orderId: string;
  onOpenMessaging: () => void;
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleMessage = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await findOrCreateConversation(
        user.uid,
        businessId,
        `Order #${orderId.slice(-6)}`,
      );
      addToast(`Chat opened with ${businessName}`, 'success');
      onOpenMessaging();
    } catch {
      addToast('Failed to start conversation', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleMessage}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border disabled:opacity-50"
      style={{ borderColor: '#6366F1', color: '#6366F1', backgroundColor: 'rgba(99,102,241,0.04)' }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
      Message {businessName}
    </button>
  );
}

// ── Status Badge ──
function StatusBadge({ status }: { status: string }) {
  // SB-42: Add icons for color-blind accessibility
  const config: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending: { label: 'Pending', color: '#92400E', bg: '#FEF3C7', icon: '⏳' },
    confirmed: { label: 'Confirmed', color: '#3730A3', bg: '#EEF2FF', icon: '✓' },
    preparing: { label: 'Preparing', color: '#5B21B6', bg: '#F5F3FF', icon: '🍳' },
    ready: { label: 'Ready', color: '#065F46', bg: '#D1FAE5', icon: '✔' },
    out_for_delivery: { label: 'On the Way', color: '#0369A1', bg: '#E0F2FE', icon: '🚗' },
    delivered: { label: 'Delivered', color: '#059669', bg: '#A7F3D0', icon: '✅' },
    cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2', icon: '✗' },
  };
  const c = config[status] || config.pending;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      <span aria-hidden="true" className="mr-0.5">{c.icon}</span>
      {c.label}
    </span>
  );
}


// ── Inline Messaging Modal ──
function InlineMessagingModal({
  orderId,
  onClose,
  orders,
}: {
  orderId: string;
  onClose: () => void;
  orders: CateringOrder[];
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Array<{
    id: string;
    text: string;
    senderName: string;
    senderRole: string;
    timestamp: any;
  }>>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const order = orders.find(o => o.id === orderId);
  if (!order) return null;

  // Load existing messages and subscribe to real-time updates
  useEffect(() => {
    if (!user || !order) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        const convId = await findOrCreateConversation(
          user.uid,
          order.businessId,
          `Order #${orderId.slice(-6)}`,
        );
        if (cancelled) return;
        setConversationId(convId);

        // Subscribe to real-time message updates
        const messagesRef = collection(db, 'conversations', convId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!cancelled) {
            setMessages(
              snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
              } as any))
            );
            setLoadingMessages(false);
          }
        }, (error) => {
          console.error('Message subscription error:', error);
          if (!cancelled) setLoadingMessages(false);
        });
      } catch (error) {
        console.error('Failed to load messages:', error);
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [user, order, orderId]);

  const handleSendMessage = async () => {
    if (!user || !message.trim() || !conversationId) return;
    setSending(true);
    try {
      // SB-44: Write message to Firestore
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: user.displayName || 'Customer',
        senderRole: 'customer',
        text: message.trim(),
        timestamp: serverTimestamp(),
        read: false,
      });

      // Update conversation's lastMessage metadata for preview
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: message.trim().slice(0, 100),
        lastMessageAt: serverTimestamp(),
        lastMessageBy: user.uid,
      });

      setMessage('');
      // Don't close modal — messages update in real-time via onSnapshot
    } catch (error) {
      console.error('Failed to send message:', error);
      addToast('Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="relative mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col max-h-[80vh]" style={{ backgroundColor: 'var(--aurora-surface, #fff)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>
              Message {order.businessName}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
              Order #{orderId.slice(-6)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <span className="text-lg">×</span>
          </button>
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--aurora-background, #f9fafb)' }}>
          {loadingMessages ? (
            <div className="flex items-center justify-center h-24" style={{ color: 'var(--aurora-text-secondary)' }}>
              <Loader2 size={16} className="animate-spin mr-2" />
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--aurora-text-secondary)' }}>
              No messages yet. Start the conversation!
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-sm ${
                    msg.senderRole === 'customer' ? 'ml-4' : 'mr-4'
                  }`}
                  style={{
                    backgroundColor: msg.senderRole === 'customer' ? '#E0E7FF' : '#F3F4F6',
                    color: 'var(--aurora-text)',
                  }}
                >
                  <p className="font-medium text-xs mb-1" style={{ color: 'var(--aurora-text-secondary)' }}>
                    {msg.senderName}
                  </p>
                  <p className="text-xs break-words">{msg.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={3}
            maxLength={500}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-300"
            style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
            {message.length}/500
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSendMessage}
            disabled={sending || !message.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#6366F1' }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
