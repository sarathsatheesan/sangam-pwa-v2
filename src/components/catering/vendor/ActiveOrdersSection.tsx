// ═════════════════════════════════════════════════════════════════════════════════
// ACTIVE ORDERS SECTION
// Displays confirmed, preparing, ready, and out-for-delivery orders with status controls
// ═════════════════════════════════════════════════════════════════════════════════

import React from 'react';
import {
  ChevronDown, ChevronUp
} from 'lucide-react';
import type { CateringOrder } from '@/services/cateringService';
import { OrderCard } from './OrderCard';

interface ActiveOrdersSectionProps {
  activeOrders: CateringOrder[];
  expandedOrder: string | null;
  sectionExpanded: boolean;
  sortDir: string;
  actionLoading: string | null;

  onToggleSection: () => void;
  onSetSort: (value: string) => void;
  onExpandOrder: (orderId: string | null) => void;
  onStatusChange: (orderId: string, newStatus: CateringOrder['status'], extra?: Record<string, any>) => Promise<void>;
  onCancelOrderClick: (orderId: string) => void;

  businessName: string;
  currentUserId?: string;
  formatEventDate: (eventDate: any) => string;
  STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }>;
}

export default function ActiveOrdersSection({
  activeOrders,
  expandedOrder,
  sectionExpanded,
  sortDir,
  actionLoading,
  onToggleSection,
  onSetSort,
  onExpandOrder,
  onStatusChange,
  onCancelOrderClick,
  businessName,
  currentUserId,
  formatEventDate,
  STATUS_CONFIG,
}: ActiveOrdersSectionProps) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)' }}>
      {/* Section Header */}
      <button
        onClick={onToggleSection}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-opacity-50"
        style={{
          backgroundColor: sectionExpanded ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
          borderBottom: sectionExpanded ? '1px solid var(--aurora-border)' : 'none'
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold" style={{ color: 'var(--aurora-accent)' }}>Active Orders</h3>
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: 'var(--aurora-accent)' }}>
              {activeOrders.length}
            </span>
          </div>
        </div>
        <select
          value={sortDir}
          onChange={(e) => { e.stopPropagation(); onSetSort(e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium rounded-lg border px-2 py-1 outline-none appearance-none cursor-pointer"
          style={{ color: 'var(--aurora-accent)', borderColor: 'rgba(99, 102, 241, 0.3)', backgroundColor: 'rgba(99, 102, 241, 0.06)', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236366F1\' stroke-width=\'2\'%3E%3Cpath d=\'M7 10l5 5 5-5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center' }}
        >
          <option value="date-newest">Date: Newest</option>
          <option value="date-oldest">Date: Oldest</option>
          <option value="name-asc">Name: A &rarr; Z</option>
          <option value="name-desc">Name: Z &rarr; A</option>
        </select>
        {sectionExpanded ? <ChevronUp size={18} style={{ color: 'var(--aurora-accent)' }} /> : <ChevronDown size={18} style={{ color: 'var(--aurora-accent)' }} />}
      </button>

      {/* Section Content */}
      {sectionExpanded && (
        <div className="p-3 space-y-3">
          {activeOrders.length === 0 ? (
            <div className="text-center py-6 text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
              No active orders
            </div>
          ) : (
            activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isExpanded={expandedOrder === order.id}
                isActionLoading={actionLoading === order.id}
                statusConfig={STATUS_CONFIG[order.status] || { label: order.status, color: '#6B7280', bgColor: 'rgba(107,114,128,0.1)', icon: null }}
                onToggleExpand={() => onExpandOrder(expandedOrder === order.id ? null : order.id)}
                onStatusChange={onStatusChange}
                onCancel={onCancelOrderClick}
                businessName={businessName}
                currentUserId={currentUserId}
                formatEventDate={formatEventDate}
                showCancelButton={true}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
