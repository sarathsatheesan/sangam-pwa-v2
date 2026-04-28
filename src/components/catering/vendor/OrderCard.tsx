import React, { memo, useState } from 'react';
import {
  ChevronDown, ChevronUp, User, MapPin, Phone, Users, Square, CheckSquare,
  Pencil, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';
import { calculateOrderTotal, getTaxRate } from '@/services/cateringService';
import type { CateringOrder, OrderItem } from '@/services/cateringService';
import { formatPrice, vendorModifyOrder } from '@/services/cateringService';
import { useToast } from '@/contexts/ToastContext';
import OrderTimeline from '../OrderTimeline';
import OrderMessages from '../OrderMessages';

interface OrderCardProps {
  order: CateringOrder;
  isExpanded: boolean;
  isActionLoading: boolean;
  statusConfig: { label: string; color: string; bgColor: string; icon: React.ReactNode };
  batchMode?: boolean;
  isSelected?: boolean;
  onToggleBatchSelect?: (orderId: string) => void;
  onToggleExpand: (orderId: string | null) => void;
  onStatusChange: (orderId: string, status: CateringOrder['status'], extra?: Record<string, any>) => Promise<void>;
  onCancel?: (orderId: string) => void;
  businessName?: string;
  currentUserId?: string;
  userRole?: 'vendor';
  formatEventDate: (eventDate: any) => string;
  showCancelButton?: boolean;
}

function OrderCardInner({
  order,
  isExpanded,
  isActionLoading,
  statusConfig,
  batchMode = false,
  isSelected = false,
  onToggleBatchSelect,
  onToggleExpand,
  onStatusChange,
  onCancel,
  businessName = 'Vendor',
  currentUserId,
  userRole = 'vendor',
  formatEventDate,
  showCancelButton = false,
}: OrderCardProps) {
  const { addToast } = useToast();
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editNote, setEditNote] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const startEditOrder = () => {
    setEditingOrderId(order.id);
    setEditItems([...order.items]);
    setEditNote('');
  };

  const handleSaveModification = async () => {
    if (!editNote.trim()) {
      addToast('Please add a note explaining the change', 'error');
      return;
    }
    setEditSaving(true);

    const subtotal = editItems.reduce((s, it) => s + it.unitPrice * it.qty, 0);
    const tax = Math.round(subtotal * getTaxRate(order.deliveryAddress?.state));
    const total = subtotal + tax;

    try {
      await vendorModifyOrder(order.id, {
        items: editItems,
        subtotal,
        tax,
        total,
        note: editNote.trim(),
      });
      addToast('Order modified. Customer will be notified.', 'success');
      setEditingOrderId(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to modify order', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--aurora-surface, #fff)',
        borderColor: 'var(--aurora-border, #E2E5EF)',
      }}
    >
      {/* Order header */}
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => {
          if (batchMode && order.status === 'pending' && onToggleBatchSelect) {
            onToggleBatchSelect(order.id);
          } else {
            onToggleExpand(isExpanded ? null : order.id);
          }
        }}
      >
        {/* Batch checkbox */}
        {batchMode && order.status === 'pending' && (
          <div
            className="mr-3 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleBatchSelect) onToggleBatchSelect(order.id);
            }}
          >
            {isSelected ? (
              <CheckSquare size={18} style={{ color: 'var(--aurora-accent)' }} />
            ) : (
              <Square size={18} style={{ color: 'var(--aurora-text-muted)' }} />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
              {order.customerName} · {formatEventDate(order.eventDate)}
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </span>
            {order.rfpOrigin && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}
              >
                RFP
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
            {order.status === 'pending' && (
              <span className="flex items-center gap-1">
                <Users size={12} />
                {order.headcount} guests
              </span>
            )}
            <span className="font-medium" style={{ color: 'var(--aurora-text)' }}>
              {formatPrice(order.total)}
            </span>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {/* Expanded details */}
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
                  .filter(Boolean)
                  .join(', ')}
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
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                {order.serviceFee != null && order.serviceFee > 0 && (
                  <div className="flex justify-between text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                    <span>Service Fee</span>
                    <span>{formatPrice(order.serviceFee)}</span>
                  </div>
                )}
                {order.deliveryFee != null && order.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                    <span>Delivery Fee</span>
                    <span>{formatPrice(order.deliveryFee)}</span>
                  </div>
                )}
                {order.tax != null && order.tax > 0 && (
                  <div className="flex justify-between text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                    <span>Tax</span>
                    <span>{formatPrice(order.tax)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between text-sm font-semibold pt-1 border-t"
                  style={{ borderColor: 'var(--aurora-border)' }}
                >
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Order modification form */}
          {editingOrderId === order.id ? (
            <div
              className="p-3 rounded-xl border space-y-2"
              style={{ borderColor: 'var(--aurora-accent)', backgroundColor: 'rgba(99,102,241,0.02)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--aurora-accent)' }}>
                Modify Order Items
              </p>
              {editItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <input
                    type="number"
                    min="0"
                    value={editItems[i].qty}
                    onChange={(e) =>
                      setEditItems((prev) =>
                        prev.map((it, idx) =>
                          idx === i ? { ...it, qty: Math.max(0, parseInt(e.target.value) || 0) } : it
                        )
                      )
                    }
                    className="w-14 text-center rounded-lg border px-2 py-1 text-xs"
                    style={{ borderColor: 'var(--aurora-border)' }}
                  />
                  {item.menuItemId.startsWith('added_') ? (
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const updated = [...editItems];
                        const idx = updated.findIndex((it) => it.menuItemId === item.menuItemId);
                        if (idx >= 0) updated[idx] = { ...updated[idx], name: e.target.value };
                        setEditItems(updated);
                      }}
                      placeholder="Item name"
                      className="flex-1 text-sm border rounded px-2 py-1"
                      style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                    />
                  ) : (
                    <span className="flex-1 truncate" style={{ color: 'var(--aurora-text)' }}>
                      {item.name}
                    </span>
                  )}
                  <span className="text-xs mr-0.5" style={{ color: 'var(--aurora-text-muted)' }}>
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={(editItems[i].unitPrice / 100).toFixed(2)}
                    onChange={(e) =>
                      setEditItems((prev) =>
                        prev.map((it, idx) =>
                          idx === i
                            ? { ...it, unitPrice: Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)) }
                            : it
                        )
                      )
                    }
                    placeholder="0.00"
                    className="w-20 text-center text-sm border rounded px-1 py-1"
                    style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
                  />
                  <span style={{ color: 'var(--aurora-text-secondary)' }}>
                    {formatPrice(item.unitPrice * editItems[i].qty)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--aurora-border)' }}>
                <button
                  onClick={() => {
                    setEditItems((prev) => [
                      ...prev,
                      {
                        menuItemId: `added_${Date.now()}`,
                        name: '',
                        qty: 1,
                        unitPrice: 0,
                        pricingType: 'per_person',
                      },
                    ]);
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  + Add Item
                </button>
              </div>
              <p className="text-xs font-medium text-right" style={{ color: 'var(--aurora-text)' }}>
                New total: {formatPrice(editItems.reduce((s, it) => s + it.unitPrice * it.qty, 0))}
              </p>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Reason for modification (e.g. item out of stock)..."
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-xs outline-none resize-none"
                style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingOrderId(null)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border"
                  style={{ borderColor: 'var(--aurora-border)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveModification}
                  disabled={editSaving}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--aurora-accent)' }}
                >
                  {editSaving ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Vendor modification notice */}
              {order.vendorModified && (
                <div>
                  <div
                    className="text-xs p-2 rounded-lg"
                    style={{
                      backgroundColor: (order as any).modificationRejected ? '#FEE2E2' : '#FEF3C7',
                      color: (order as any).modificationRejected ? '#991B1B' : '#92400E',
                    }}
                  >
                    <span className="font-medium">
                      {(order as any).modificationRejected
                        ? '✗ Customer rejected modification: '
                        : (order as any).modificationAccepted
                          ? '✓ Customer accepted modification: '
                          : 'Modified: '}
                    </span>
                    {order.vendorModificationNote || 'Items adjusted by vendor'}
                  </div>
                </div>
              )}
              {/* Edit order button for confirmed/preparing */}
              {['confirmed', 'preparing'].includes(order.status) && (
                <button
                  onClick={startEditOrder}
                  className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: 'var(--aurora-accent)' }}
                >
                  <Pencil size={12} /> Modify order items
                </button>
              )}
            </>
          )}

          {/* Special instructions */}
          {order.specialInstructions && (
            <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)' }}>
              <span className="font-medium">Note: </span>
              {order.specialInstructions}
            </div>
          )}

          {/* Cancellation reason display */}
          {order.status === 'cancelled' && (order.cancellationReason || order.declinedReason) && (
            <div className="text-sm p-2 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
              <span className="font-medium" style={{ color: '#991B1B' }}>
                {order.cancelledBy === 'customer' ? 'Cancelled by customer: ' : 'Reason: '}
              </span>
              <span style={{ color: '#DC2626' }}>{order.cancellationReason || order.declinedReason}</span>
            </div>
          )}

          {/* In-order messages */}
          {!['cancelled'].includes(order.status) && currentUserId && (
            <OrderMessages
              orderId={order.id}
              currentUserId={currentUserId}
              currentUserName={businessName}
              currentUserRole={userRole}
              orderStatus={order.status}
              deliveredAt={order.statusHistory?.find((s: any) => s.status === 'delivered')?.timestamp}
            />
          )}

          {/* Action buttons for pending orders */}
          {order.status === 'pending' && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onStatusChange(order.id, 'confirmed')}
                disabled={isActionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#10B981' }}
              >
                {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Accept
              </button>
              <button
                onClick={() => onCancel?.(order.id)}
                disabled={isActionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#EF4444' }}
              >
                {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Decline
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const OrderCard = memo(OrderCardInner);
