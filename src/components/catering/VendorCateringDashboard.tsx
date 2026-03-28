// ═════════════════════════════════════════════════════════════════════════════════
// VENDOR CATERING DASHBOARD
// Business owners view incoming catering orders and manage them.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  Package, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  User, MapPin, Phone, Calendar, Users, Loader2, AlertCircle,
} from 'lucide-react';
import type { CateringOrder } from '@/services/cateringService';
import {
  subscribeToBusinessOrders,
  updateOrderStatus,
  formatPrice,
} from '@/services/cateringService';
import { useToast } from '@/contexts/ToastContext';

interface VendorCateringDashboardProps {
  businessId: string;
  businessName: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: '#F59E0B', bgColor: '#FEF3C7', icon: <Clock size={14} /> },
  confirmed: { label: 'Confirmed', color: '#6366F1', bgColor: '#EEF2FF', icon: <CheckCircle2 size={14} /> },
  preparing: { label: 'Preparing', color: '#8B5CF6', bgColor: '#F5F3FF', icon: <Package size={14} /> },
  ready: { label: 'Ready', color: '#10B981', bgColor: '#D1FAE5', icon: <CheckCircle2 size={14} /> },
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

  const handleStatusChange = async (orderId: string, newStatus: CateringOrder['status']) => {
    setActionLoading(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      addToast(`Order ${newStatus}`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to update order', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'pending') return o.status === 'pending';
    if (filter === 'active') return ['confirmed', 'preparing', 'ready'].includes(o.status);
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
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
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
                          ? order.eventDate.toDate().toLocaleDateString()
                          : order.eventDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {order.headcount} guests
                      </span>
                      <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>
                        {formatPrice(order.total)}
                      </span>
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
                      <button
                        onClick={() => handleStatusChange(order.id, 'delivered')}
                        disabled={isActionLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                        style={{ backgroundColor: '#059669' }}
                      >
                        {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Mark as Delivered
                      </button>
                    )}
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
