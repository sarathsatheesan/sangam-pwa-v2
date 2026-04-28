// ═════════════════════════════════════════════════════════════════════════════════
// CANCELLED ORDERS SECTION
// Displays cancelled orders in a compact read-only format with cancellation reasons
// ═════════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CateringOrder } from '@/services/cateringService';
import { formatPrice } from '@/services/cateringService';

interface CancelledOrdersSectionProps {
  cancelledOrders: CateringOrder[];
  expandedOrder: string | null;
  sectionExpanded: boolean;
  sortDir: string;

  onToggleSection: () => void;
  onSetSort: (value: string) => void;
  onExpandOrder: (orderId: string | null) => void;

  formatEventDate: (eventDate: any, eventTime?: string) => string;
  STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }>;
}

export default function CancelledOrdersSection({
  cancelledOrders,
  expandedOrder,
  sectionExpanded,
  sortDir,
  onToggleSection,
  onSetSort,
  onExpandOrder,
  formatEventDate,
  STATUS_CONFIG,
}: CancelledOrdersSectionProps) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)' }}>
      {/* Section Header */}
      <button
        onClick={onToggleSection}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-opacity-50"
        style={{
          backgroundColor: sectionExpanded ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
          borderBottom: sectionExpanded ? '1px solid var(--aurora-border)' : 'none'
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold" style={{ color: '#EF4444' }}>Cancelled Orders</h3>
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#EF4444' }}>
              {cancelledOrders.length}
            </span>
          </div>
        </div>
        <select
          value={sortDir}
          onChange={(e) => { e.stopPropagation(); onSetSort(e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium rounded-lg border px-2 py-1 outline-none appearance-none cursor-pointer"
          style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.06)', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23EF4444\' stroke-width=\'2\'%3E%3Cpath d=\'M7 10l5 5 5-5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center' }}
        >
          <option value="date-newest">Date: Newest</option>
          <option value="date-oldest">Date: Oldest</option>
          <option value="name-asc">Name: A → Z</option>
          <option value="name-desc">Name: Z → A</option>
        </select>
        {sectionExpanded ? <ChevronUp size={18} style={{ color: '#EF4444' }} /> : <ChevronDown size={18} style={{ color: '#EF4444' }} />}
      </button>

      {/* Section Content */}
      {sectionExpanded && (
        <div className="p-3 space-y-3">
          {cancelledOrders.map((order) => {
            const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const isExpanded = expandedOrder === order.id;

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
                  onClick={() => onExpandOrder(isExpanded ? null : order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm" style={{ color: 'var(--aurora-text)' }}>
                        {order.contactName || order.customerName} &middot; {formatEventDate(order.eventDate)}
                      </p>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                      >
                        {statusCfg.icon} {statusCfg.label}
                      </span>
                      {order.rfpOrigin && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide" style={{ backgroundColor: '#EFF6FF', color: 'var(--aurora-accent)' }}>RFP</span>
                      )}
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
                      {formatPrice(order.total)}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp size={18} style={{ color: 'var(--aurora-text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--aurora-text-muted)' }} />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t p-4 space-y-3" style={{ borderColor: 'var(--aurora-border)' }}>
                    {/* Customer info */}
                    <div className="space-y-1">
                      <p className="text-sm" style={{ color: 'var(--aurora-text)' }}>
                        <span className="font-medium">Customer:</span> {order.contactName || order.customerName}
                      </p>
                      {order.contactPhone && (
                        <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                          Phone: {order.contactPhone}
                        </p>
                      )}
                      {order.deliveryAddress && (
                        <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                          Address: {[order.deliveryAddress.street, order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.zip].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>

                    {/* Items */}
                    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--aurora-surface-variant, #F8F9FC)' }}>
                      <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--aurora-text-muted)' }}>Items</h4>
                      <div className="space-y-1">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span style={{ color: 'var(--aurora-text)' }}>{item.qty}x {item.name}</span>
                            <span style={{ color: 'var(--aurora-text-secondary)' }}>{formatPrice(item.unitPrice * item.qty)}</span>
                          </div>
                        ))}
                        {/* Fee breakdown */}
                        <div className="pt-1 border-t space-y-0.5" style={{ borderColor: 'var(--aurora-border)' }}>
                          <div className="flex justify-between text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                            <span>Subtotal</span>
                            <span>{formatPrice((order as any).originalSubtotal || order.subtotal)}</span>
                          </div>
                          {((order as any).repriceDiscount != null && (order as any).repriceDiscount > 0) && (
                            <div className="flex justify-between text-sm" style={{ color: '#059669' }}>
                              <span>Negotiated Discount</span>
                              <span>-{formatPrice((order as any).repriceDiscount)}</span>
                            </div>
                          )}
                          {(order.serviceFee != null && order.serviceFee > 0) && (
                            <div className="flex justify-between text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                              <span>Service Fee</span>
                              <span>{formatPrice(order.serviceFee)}</span>
                            </div>
                          )}
                          {(order.deliveryFee != null && order.deliveryFee > 0) && (
                            <div className="flex justify-between text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                              <span>Delivery Fee</span>
                              <span>{formatPrice(order.deliveryFee)}</span>
                            </div>
                          )}
                          {(order.tax != null && order.tax > 0) && (
                            <div className="flex justify-between text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                              <span>Tax</span>
                              <span>{formatPrice(order.tax)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-semibold pt-1 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                            <span>Total</span>
                            <span>{formatPrice(order.total)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cancellation reason */}
                    {(order.cancellationReason || order.declinedReason) && (
                      <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: '#FEF2F2' }}>
                        <span className="font-medium" style={{ color: '#EF4444' }}>Reason: </span>
                        <span style={{ color: '#991B1B' }}>{order.cancellationReason || order.declinedReason}</span>
                      </div>
                    )}

                    {/* Special instructions */}
                    {order.specialInstructions && (
                      <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)' }}>
                        <span className="font-medium">Note: </span>
                        {order.specialInstructions}
                      </div>
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
