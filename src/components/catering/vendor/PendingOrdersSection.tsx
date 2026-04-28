// ═════════════════════════════════════════════════════════════════════════════════
// PENDING ORDERS SECTION
// Displays orders awaiting vendor response with accept/decline actions and batch mode
// ═════════════════════════════════════════════════════════════════════════════════

import React from 'react';
import {
  ChevronDown, ChevronUp
} from 'lucide-react';
import type { CateringOrder } from '@/services/cateringService';
import { OrderCard } from './OrderCard';

interface PendingOrdersSectionProps {
  pendingOrders: CateringOrder[];
  expandedOrder: string | null;
  sectionExpanded: boolean;
  sortDir: string;
  batchMode: boolean;
  selectedOrders: Set<string>;
  actionLoading: string | null;

  onToggleSection: () => void;
  onSetSort: (value: string) => void;
  onToggleOrderSelection: (orderId: string) => void;
  onExpandOrder: (orderId: string | null) => void;
  onStatusChange: (orderId: string, newStatus: CateringOrder['status'], extra?: Record<string, any>) => Promise<void>;
  onCancelOrderClick: (orderId: string) => void;

  businessName: string;
  currentUserId?: string;
  formatEventDate: (eventDate: any) => string;
  STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }>;
}

export default function PendingOrdersSection({
  pendingOrders,
  expandedOrder,
  sectionExpanded,
  sortDir,
  batchMode,
  selectedOrders,
  actionLoading,
  onToggleSection,
  onSetSort,
  onToggleOrderSelection,
  onExpandOrder,
  onStatusChange,
  onCancelOrderClick,
  businessName,
  currentUserId,
  formatEventDate,
  STATUS_CONFIG,
}: PendingOrdersSectionProps) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)' }}>
      {/* Section Header */}
      <button
        onClick={onToggleSection}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-opacity-50"
        style={{
          backgroundColor: sectionExpanded ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.04)',
          borderBottom: sectionExpanded ? '1px solid var(--aurora-border)' : 'none'
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold" style={{ color: '#F59E0B' }}>Pending Orders</h3>
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#F59E0B' }}>
              {pendingOrders.length}
            </span>
          </div>
        </div>
        <select
          value={sortDir}
          onChange={(e) => { e.stopPropagation(); onSetSort(e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium rounded-lg border px-2 py-1 outline-none appearance-none cursor-pointer"
          style={{ color: '#F59E0B', borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.06)', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23F59E0B\' stroke-width=\'2\'%3E%3Cpath d=\'M7 10l5 5 5-5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center' }}
        >
          <option value="date-newest">Date: Newest</option>
          <option value="date-oldest">Date: Oldest</option>
          <option value="name-asc">Name: A &rarr; Z</option>
          <option value="name-desc">Name: Z &rarr; A</option>
        </select>
        {sectionExpanded ? <ChevronUp size={18} style={{ color: '#F59E0B' }} /> : <ChevronDown size={18} style={{ color: '#F59E0B' }} />}
      </button>

      {/* Section Content */}
      {sectionExpanded && (
        <div className="p-3 space-y-3">
          {pendingOrders.length === 0 ? (
            <div className="text-center py-6 text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
              No pending orders
            </div>
          ) : (
            pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isExpanded={expandedOrder === order.id}
                isActionLoading={actionLoading === order.id}
                statusConfig={STATUS_CONFIG[order.status] || { label: order.status, color: '#6B7280', bgColor: 'rgba(107,114,128,0.1)', icon: null }}
                batchMode={batchMode && order.status === 'pending'}
                isSelected={selectedOrders.has(order.id)}
                onToggleBatchSelect={batchMode && order.status === 'pending' ? () => onToggleOrderSelection(order.id) : undefined}
                onToggleExpand={() => onExpandOrder(expandedOrder === order.id ? null : order.id)}
                onStatusChange={onStatusChange}
                onCancel={onCancelOrderClick}
                businessName={businessName}
                currentUserId={currentUserId}
                formatEventDate={formatEventDate}
                showCancelButton={order.status === 'pending'}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
