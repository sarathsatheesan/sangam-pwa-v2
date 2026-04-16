import React from 'react';
import type { CateringOrder } from '@/services/cateringService';
import { formatPrice, updateOrderStatus } from '@/services/cateringService';
import { Clock, CheckCircle2, Package, ChefHat, Store } from 'lucide-react';

interface CateringPanelProps {
  cateringLoading: boolean;
  cateringOrders: CateringOrder[];
  cateringBusinesses: any[];
  cateringFilter: 'all' | 'pending' | 'active' | 'completed';
  onCateringFilterChange: (filter: 'all' | 'pending' | 'active' | 'completed') => void;
  cateringActionLoading: string | null;
  onStatusChange: (orderId: string, newStatus: CateringOrder['status']) => Promise<void>;
  onRefresh: () => void;
}

export function CateringPanel({
  cateringLoading,
  cateringOrders,
  cateringBusinesses,
  cateringFilter,
  onCateringFilterChange,
  cateringActionLoading,
  onStatusChange,
  onRefresh,
}: CateringPanelProps) {
  const filtered = cateringOrders.filter((o) => {
    if (cateringFilter === 'pending') return o.status === 'pending';
    if (cateringFilter === 'active') return ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status);
    if (cateringFilter === 'completed') return ['delivered', 'cancelled'].includes(o.status);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Catering Management</h2>
          <p className="text-sm text-[var(--aurora-text-secondary)]">Monitor catering orders and caterer businesses</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl text-sm font-medium text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition"
        >
          Refresh
        </button>
      </div>

      {/* Catering stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package size={16} className="text-[#6366F1]" />
            <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">Total Orders</span>
          </div>
          <p className="text-2xl font-bold text-[var(--aurora-text)]">{cateringOrders.length}</p>
        </div>
        <div className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-amber-500" />
            <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{cateringOrders.filter(o => o.status === 'pending').length}</p>
        </div>
        <div className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">Delivered</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{cateringOrders.filter(o => o.status === 'delivered').length}</p>
        </div>
        <div className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Store size={16} className="text-[#6366F1]" />
            <span className="text-xs font-medium text-[var(--aurora-text-secondary)]">Active Caterers</span>
          </div>
          <p className="text-2xl font-bold text-[var(--aurora-text)]">{cateringBusinesses.length}</p>
        </div>
      </div>

      {/* Catering-enabled businesses */}
      <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--aurora-border)]">
          <p className="text-sm font-semibold text-[var(--aurora-text)]">
            Catering-Enabled Businesses ({cateringBusinesses.length})
          </p>
        </div>
        {cateringLoading ? (
          <div className="text-center py-8 text-[var(--aurora-text-secondary)]">Loading...</div>
        ) : cateringBusinesses.length === 0 ? (
          <div className="text-center py-8 text-[var(--aurora-text-secondary)]">
            No catering-enabled businesses yet. Run the seed script or enable catering on a business.
          </div>
        ) : (
          <div className="divide-y divide-[var(--aurora-border)]">
            {cateringBusinesses.map((biz: any) => (
              <div key={biz.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--aurora-text)]">{biz.name}</p>
                  <p className="text-xs text-[var(--aurora-text-secondary)]">{biz.category} — {biz.location || biz.city || 'No location'}</p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                  <ChefHat size={12} /> Catering Active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--aurora-text-secondary)]">Orders:</span>
        {(['all', 'pending', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => onCateringFilterChange(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              cateringFilter === f
                ? 'bg-[#FF3008] text-white'
                : 'bg-[var(--aurora-surface)] text-[var(--aurora-text-secondary)] border border-[var(--aurora-border)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--aurora-border)]">
          <p className="text-sm font-semibold text-[var(--aurora-text)]">Catering Orders</p>
        </div>
        {cateringLoading ? (
          <div className="text-center py-8 text-[var(--aurora-text-secondary)]">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm text-[var(--aurora-text-secondary)]">No {cateringFilter === 'all' ? '' : cateringFilter} orders</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--aurora-border)]">
            {filtered.map((order) => {
              const statusColors: Record<string, string> = {
                pending: '#F59E0B',
                confirmed: '#6366F1',
                preparing: '#8B5CF6',
                ready: '#10B981',
                delivered: '#059669',
                cancelled: '#EF4444',
              };
              const statusColor = statusColors[order.status] || '#6B7280';
              const isActionLoading = cateringActionLoading === order.id;
              return (
                <div key={order.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-[var(--aurora-text)]">{order.customerName}</span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                        style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
                      >
                        {order.status}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-[var(--aurora-text)]">{formatPrice(order.total)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--aurora-text-secondary)] mb-2">
                    <span>{order.businessName}</span>
                    <span>{order.headcount} guests</span>
                    <span>
                      {order.eventDate?.toDate?.()
                        ? order.eventDate.toDate().toLocaleDateString()
                        : typeof order.eventDate === 'string' ? order.eventDate : ''}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--aurora-text-secondary)] mb-2">
                    Items: {order.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                  </div>
                  {/* Admin actions */}
                  {order.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => onStatusChange(order.id, 'confirmed')}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition disabled:opacity-50"
                      >
                        {isActionLoading ? 'Updating...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => onStatusChange(order.id, 'cancelled')}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {isActionLoading ? 'Updating...' : 'Decline'}
                      </button>
                    </div>
                  )}
                  {['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status) && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => onStatusChange(order.id, 'preparing')}
                          disabled={isActionLoading}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#6366F1] hover:bg-[#5558E6] transition disabled:opacity-50"
                        >
                          Mark Preparing
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          onClick={() => onStatusChange(order.id, 'ready')}
                          disabled={isActionLoading}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition disabled:opacity-50"
                        >
                          Mark Ready
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <button
                          onClick={() => onStatusChange(order.id, 'out_for_delivery')}
                          disabled={isActionLoading}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 transition disabled:opacity-50"
                        >
                          Out for Delivery
                        </button>
                      )}
                      {order.status === 'out_for_delivery' && (
                        <button
                          onClick={() => onStatusChange(order.id, 'delivered')}
                          disabled={isActionLoading}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          Mark Delivered
                        </button>
                      )}
                      <button
                        onClick={() => onStatusChange(order.id, 'cancelled')}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
