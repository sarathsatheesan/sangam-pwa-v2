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
  UtensilsCrossed, FileText, Star, Ban,
} from 'lucide-react';
import type { CateringOrder } from '@/services/cateringService';
import { subscribeToCustomerOrders, formatPrice, hasReviewedOrder, cancelOrder } from '@/services/cateringService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import CateringReviewForm from './CateringReviewForm';

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

// ── Status timeline configuration ──
const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: FileText, color: '#F59E0B', description: 'Waiting for caterer to confirm' },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: '#6366F1', description: 'Caterer has accepted your order' },
  { key: 'preparing', label: 'Preparing', icon: UtensilsCrossed, color: '#8B5CF6', description: 'Your food is being prepared' },
  { key: 'ready', label: 'Ready', icon: Package, color: '#10B981', description: 'Order is ready for pickup/delivery' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck, color: '#0EA5E9', description: 'Your order is on the way' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, color: '#059669', description: 'Order has been delivered' },
] as const;

const CANCELLED_STEP = { key: 'cancelled', label: 'Cancelled', icon: XCircle, color: '#EF4444', description: 'Order was cancelled' };

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : -1;
}

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function CateringOrderStatus({ onBack }: CateringOrderStatusProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [reviewingOrder, setReviewingOrder] = useState<CateringOrder | null>(null);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(new Set());
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
      await cancelOrder(cancellingOrderId, reason, 'customer');
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

  // Check which delivered orders have already been reviewed
  useEffect(() => {
    if (!user || orders.length === 0) return;
    const deliveredIds = orders.filter(o => o.status === 'delivered').map(o => o.id);
    if (deliveredIds.length === 0) return;
    Promise.all(deliveredIds.map(id => hasReviewedOrder(user.uid, id).then(reviewed => reviewed ? id : null)))
      .then(results => {
        setReviewedOrderIds(new Set(results.filter((id): id is string => id !== null)));
      })
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
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                        {order.businessName}
                      </span>
                      <StatusBadge status={order.status} />
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
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="opacity-40" /> : <ChevronDown size={18} className="opacity-40" />}
                </button>

                {/* Expanded: Timeline + Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                    {/* Status Timeline */}
                    <div className="pt-4">
                      <OrderTimeline
                        status={order.status}
                        statusHistory={order.statusHistory}
                        createdAt={order.createdAt}
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

                      {/* Leave a Review CTA — only for delivered orders */}
                      {order.status === 'delivered' && (
                        reviewedOrderIds.has(order.id) ? (
                          <div
                            className="flex items-center gap-2 p-3 rounded-xl"
                            style={{ backgroundColor: 'rgba(245, 158, 11, 0.06)' }}
                          >
                            <Star size={14} fill="#F59E0B" stroke="#F59E0B" />
                            <span className="text-sm font-medium" style={{ color: '#92400E' }}>
                              You reviewed this order
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReviewingOrder(order)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                            style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                          >
                            <Star size={16} />
                            Leave a Review
                          </button>
                        )
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

      {/* Cancel order dialog */}
      {cancellingOrderId && (
        <div ref={cancelModalRef} onKeyDown={cancelKeyDown} className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Cancel order">
          <div className="absolute inset-0 bg-black/40" onClick={() => !cancelSubmitting && setCancellingOrderId(null)} />
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

// ── Status Badge ──
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: '#92400E', bg: '#FEF3C7' },
    confirmed: { label: 'Confirmed', color: '#3730A3', bg: '#EEF2FF' },
    preparing: { label: 'Preparing', color: '#5B21B6', bg: '#F5F3FF' },
    ready: { label: 'Ready', color: '#065F46', bg: '#D1FAE5' },
    out_for_delivery: { label: 'On the Way', color: '#0369A1', bg: '#E0F2FE' },
    delivered: { label: 'Delivered', color: '#059669', bg: '#A7F3D0' },
    cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2' },
  };
  const c = config[status] || config.pending;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

// ── Order Timeline (vertical status stepper) ──
function OrderTimeline({ status, statusHistory, createdAt }: {
  status: string;
  statusHistory?: Array<{ status: string; timestamp: any }>;
  createdAt?: any;
}) {
  const isCancelled = status === 'cancelled';
  const currentIdx = getStepIndex(status);

  // Build timestamp lookup from statusHistory
  const historyMap = new Map<string, any>();
  if (createdAt) historyMap.set('pending', createdAt);
  (statusHistory || []).forEach((h) => {
    historyMap.set(h.status, h.timestamp);
  });

  const steps = isCancelled
    ? [...STATUS_STEPS.slice(0, Math.max(currentIdx + 1, 1)), CANCELLED_STEP]
    : STATUS_STEPS;

  return (
    <div className="relative">
      {steps.map((step, idx) => {
        const isCompleted = !isCancelled && currentIdx >= idx;
        const isCurrent = !isCancelled && currentIdx === idx;
        const isCancelledStep = step.key === 'cancelled';
        const isLast = idx === steps.length - 1;
        const timestamp = historyMap.get(step.key);

        const Icon = step.icon;
        const dotColor = isCancelledStep ? '#EF4444' : isCompleted ? step.color : 'var(--aurora-border)';
        const lineColor = !isLast && (isCompleted && !isCurrent) ? step.color : 'var(--aurora-border)';

        return (
          <div key={step.key} className="flex items-start gap-3 relative" style={{ minHeight: isLast ? 'auto' : 48 }}>
            {/* Vertical line */}
            {!isLast && (
              <div
                className="absolute left-[15px] top-[30px] w-0.5"
                style={{
                  height: 'calc(100% - 16px)',
                  backgroundColor: lineColor,
                  opacity: isCompleted && !isCurrent ? 1 : 0.3,
                }}
              />
            )}

            {/* Step dot */}
            <div
              className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 z-10 transition-all"
              style={{
                backgroundColor: isCompleted || isCancelledStep ? dotColor : 'transparent',
                border: isCompleted || isCancelledStep ? 'none' : '2px solid var(--aurora-border)',
                boxShadow: isCurrent ? `0 0 0 4px ${dotColor}20` : undefined,
              }}
            >
              <Icon
                size={14}
                style={{
                  color: isCompleted || isCancelledStep ? '#fff' : 'var(--aurora-text-muted)',
                }}
              />
            </div>

            {/* Step text */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <p
                  className="text-sm font-medium"
                  style={{
                    color: isCompleted || isCancelledStep
                      ? 'var(--aurora-text)'
                      : 'var(--aurora-text-muted)',
                  }}
                >
                  {step.label}
                </p>
                {isCurrent && !isCancelled && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: step.color }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: step.color }} />
                  </span>
                )}
              </div>
              <p className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                {timestamp ? formatTimestamp(timestamp) : step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
