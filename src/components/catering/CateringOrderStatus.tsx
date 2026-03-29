// ═════════════════════════════════════════════════════════════════════════════════
// CATERING ORDER STATUS TIMELINE
// Customer-facing order tracking view with visual status timeline,
// order details, and real-time status updates.
// Phase 3: Polish & Admin
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Clock, CheckCircle2, Package, Truck, XCircle, MapPin,
  User, Phone, Calendar, Users, ChevronDown, ChevronUp, Loader2,
  UtensilsCrossed, FileText,
} from 'lucide-react';
import type { CateringOrder } from '@/services/cateringService';
import { subscribeToCustomerOrders, formatPrice } from '@/services/cateringService';
import { useAuth } from '@/contexts/AuthContext';

interface CateringOrderStatusProps {
  onBack: () => void;
}

// ── Status timeline configuration ──
const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: FileText, color: '#F59E0B', description: 'Waiting for caterer to confirm' },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: '#6366F1', description: 'Caterer has accepted your order' },
  { key: 'preparing', label: 'Preparing', icon: UtensilsCrossed, color: '#8B5CF6', description: 'Your food is being prepared' },
  { key: 'ready', label: 'Ready', icon: Package, color: '#10B981', description: 'Order is ready for pickup/delivery' },
  { key: 'delivered', label: 'Delivered', icon: Truck, color: '#059669', description: 'Order has been delivered' },
] as const;

const CANCELLED_STEP = { key: 'cancelled', label: 'Cancelled', icon: XCircle, color: '#EF4444', description: 'Order was cancelled' };

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : -1;
}

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function CateringOrderStatus({ onBack }: CateringOrderStatusProps) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

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
                  borderColor: isCancelled ? '#FCA5A5' : currentIdx >= 4 ? '#6EE7B7' : 'var(--aurora-border)',
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
                          ? order.eventDate.toDate().toLocaleDateString()
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

                      {/* Declined reason */}
                      {order.status === 'cancelled' && order.declinedReason && (
                        <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
                          <span className="font-medium" style={{ color: '#991B1B' }}>Reason: </span>
                          <span style={{ color: '#DC2626' }}>{order.declinedReason}</span>
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
