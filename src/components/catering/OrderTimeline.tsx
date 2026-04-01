import React from 'react';
import {
  FileText, CheckCircle2, UtensilsCrossed, Package, Truck, XCircle,
  Clock, AlertTriangle, Edit3, MessageSquare,
} from 'lucide-react';
import type { CateringOrder } from '@/services/cateringService';

interface OrderTimelineProps {
  order: CateringOrder;
  perspective: 'customer' | 'vendor';
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: FileText, color: '#F59E0B', label: 'Order Placed' },
  confirmed: { icon: CheckCircle2, color: '#6366F1', label: 'Order Confirmed' },
  preparing: { icon: UtensilsCrossed, color: '#8B5CF6', label: 'Preparing' },
  ready: { icon: Package, color: '#10B981', label: 'Ready for Pickup/Delivery' },
  out_for_delivery: { icon: Truck, color: '#0EA5E9', label: 'Out for Delivery' },
  delivered: { icon: CheckCircle2, color: '#059669', label: 'Delivered' },
  cancelled: { icon: XCircle, color: '#EF4444', label: 'Cancelled' },
};

function formatTimelineDate(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

export default function OrderTimeline({ order, perspective }: OrderTimelineProps) {
  // Build timeline events from statusHistory + modification + cancellation
  const events: Array<{ status: string; timestamp: any; note?: string }> = [];

  // Add status history
  if (order.statusHistory && order.statusHistory.length > 0) {
    order.statusHistory.forEach(entry => {
      events.push({ status: entry.status, timestamp: entry.timestamp });
    });
  } else {
    // Fallback: at minimum show current status with createdAt
    events.push({ status: 'pending', timestamp: order.createdAt });
    if (order.confirmedAt && order.status !== 'pending') {
      events.push({ status: 'confirmed', timestamp: order.confirmedAt });
    }
  }

  // Add vendor modification event
  if (order.vendorModified && order.vendorModifiedAt) {
    events.push({
      status: 'modified',
      timestamp: order.vendorModifiedAt,
      note: order.vendorModificationNote || 'Order was modified by vendor',
    });
  }

  // Add cancellation event
  if (order.status === 'cancelled' && order.cancelledAt) {
    const alreadyHasCancelled = events.some(e => e.status === 'cancelled');
    if (!alreadyHasCancelled) {
      events.push({
        status: 'cancelled',
        timestamp: order.cancelledAt,
        note: order.cancellationReason
          ? `Reason: ${order.cancellationReason} (by ${order.cancelledBy || 'unknown'})`
          : undefined,
      });
    }
  }

  // Sort chronologically
  events.sort((a, b) => {
    const aMs = a.timestamp?.toMillis?.() || a.timestamp?.seconds * 1000 || 0;
    const bMs = b.timestamp?.toMillis?.() || b.timestamp?.seconds * 1000 || 0;
    return aMs - bMs;
  });

  return (
    <div className="space-y-0">
      <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--aurora-text-muted)' }}>
        Order Timeline
      </h4>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-2 bottom-2 w-0.5" style={{ backgroundColor: 'var(--aurora-border)' }} />

        {events.map((event, idx) => {
          const isModified = event.status === 'modified';
          const config = isModified
            ? { icon: Edit3, color: '#F59E0B', label: 'Vendor Modified Order' }
            : STATUS_CONFIG[event.status] || { icon: Clock, color: '#6B7280', label: event.status };
          const Icon = config.icon;
          const isLast = idx === events.length - 1;

          return (
            <div key={idx} className="relative flex items-start gap-3 pb-4">
              {/* Dot */}
              <div
                className="relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: isLast ? config.color : '#E5E7EB' }}
              >
                <Icon size={12} className={isLast ? 'text-white' : ''} strokeWidth={2.5} style={{ color: isLast ? 'inherit' : 'var(--aurora-text-muted)' }} />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: isLast ? 'var(--aurora-text)' : 'var(--aurora-text-secondary)' }}>
                    {config.label}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>{formatTimelineDate(event.timestamp)}</span>
                {event.note && (
                  <p className="text-xs mt-0.5 italic" style={{ color: 'var(--aurora-text-muted)' }}>{event.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
