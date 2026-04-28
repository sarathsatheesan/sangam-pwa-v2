// ═════════════════════════════════════════════════════════════════════════════════
// COMPLETED ORDERS SECTION
// Displays delivered orders in read-only format with order details and messaging
// ═════════════════════════════════════════════════════════════════════════════════

import React from 'react';
import {
  ChevronDown, ChevronUp, User, Phone, MapPin
} from 'lucide-react';
import type { CateringOrder } from '@/services/cateringService';
import { formatPrice } from '@/services/cateringService';
import OrderTimeline from '../OrderTimeline';
import OrderMessages from '../OrderMessages';

interface CompletedOrdersSectionProps {
  completedOrders: CateringOrder[];
  expandedOrder: string | null;
  sectionExpanded: boolean;
  sortDir: string;

  onToggleSection: () => void;
  onSetSort: (value: string) => void;
  onExpandOrder: (orderId: string | null) => void;

  businessName: string;
  user?: { uid: string };
  formatEventDate: (eventDate: any, eventTime?: string) => string;
  STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }>;
}

export default function CompletedOrdersSection({
  completedOrders,
  expandedOrder,
  sectionExpanded,
  sortDir,
  onToggleSection,
  onSetSort,
  onExpandOrder,
  businessName,
  user,
  formatEventDate,
  STATUS_CONFIG,
}: CompletedOrdersSectionProps) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--aurora-border)' }}>
      {/* Section Header */}
      <button
        onClick={onToggleSection}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-opacity-50"
        style={{
          backgroundColor: sectionExpanded ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.04)',
          borderBottom: sectionExpanded ? '1px solid var(--aurora-border)' : 'none'
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold" style={{ color: '#22C55E' }}>Completed Orders</h3>
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#22C55E' }}>
              {completedOrders.length}
            </span>
          </div>
        </div>
        <select
          value={sortDir}
          onChange={(e) => { e.stopPropagation(); onSetSort(e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium rounded-lg border px-2 py-1 outline-none appearance-none cursor-pointer"
          style={{ color: '#22C55E', borderColor: 'rgba(34, 197, 94, 0.3)', backgroundColor: 'rgba(34, 197, 94, 0.06)', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '1.5rem', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2322C55E\' stroke-width=\'2\'%3E%3Cpath d=\'M7 10l5 5 5-5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center' }}
        >
          <option value="date-newest">Date: Newest</option>
          <option value="date-oldest">Date: Oldest</option>
          <option value="name-asc">Name: A → Z</option>
          <option value="name-desc">Name: Z → A</option>
        </select>
        {sectionExpanded ? <ChevronUp size={18} style={{ color: '#22C55E' }} /> : <ChevronDown size={18} style={{ color: '#22C55E' }} />}
      </button>

      {/* Section Content */}
      {sectionExpanded && (
        <div className="p-3 space-y-3">
          {completedOrders.length === 0 ? (
            <div className="text-center py-6 text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
              No completed orders
            </div>
          ) : (
            completedOrders.map((order) => {
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                          {order.customerName} · {formatEventDate(order.eventDate, order.eventTime)}
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
                        <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>
                          {formatPrice(order.total)}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>

                  {/* Expanded details - Read-only for completed orders */}
                  {isExpanded && (
                    <div className="mx-3 mb-4 mt-1 p-4 space-y-3 rounded-lg border shadow-sm" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
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

                      {/* Special instructions */}
                      {order.specialInstructions && (
                        <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)' }}>
                          <span className="font-medium">Note: </span>
                          {order.specialInstructions}
                        </div>
                      )}

                      {/* ── In-order messages (available for 48hrs after delivery) ── */}
                      {!['cancelled'].includes(order.status) && user && (
                        <OrderMessages
                          orderId={order.id}
                          currentUserId={user.uid}
                          currentUserName={businessName || 'Vendor'}
                          currentUserRole="vendor"
                          orderStatus={order.status}
                          deliveredAt={order.statusHistory?.find((s: any) => s.status === 'delivered')?.timestamp}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
