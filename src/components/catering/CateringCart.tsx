import { useState, useEffect, useRef } from 'react';
import { X, ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import type { OrderItem } from '@/services/cateringService';
import { calculateOrderTotal, formatPrice } from '@/services/cateringService';
import { useModalA11y } from '@/hooks/useModalA11y';

/** Editable quantity input — lets users clear the field, type freely, and commits on blur/Enter */
function QtyInput({
  value,
  min,
  max,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number | undefined;
  onChange: (qty: number) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(String(value));

  // Keep draft in sync when value changes externally (e.g. via +/- buttons)
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (isNaN(parsed) || parsed < min) {
      onChange(min);
      setDraft(String(min));
    } else if (max && parsed > max) {
      onChange(max);
      setDraft(String(max));
    } else {
      onChange(parsed);
      setDraft(String(parsed));
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
      onFocus={(e) => e.target.select()}
      className="w-12 text-center font-medium bg-transparent outline-none"
      style={{ color: 'var(--aurora-text)' }}
      aria-label={ariaLabel}
    />
  );
}

interface CateringCartProps {
  items: OrderItem[];
  businessName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateQty: (menuItemId: string, qty: number) => void;
  onRemove: (menuItemId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  /** Minimum order amount in cents. Pass 0 to disable the indicator. */
  minOrderAmount?: number;
}

export default function CateringCart({
  items,
  businessName,
  isOpen,
  onClose,
  onUpdateQty,
  onRemove,
  onClear,
  onCheckout,
  minOrderAmount = 5000,
}: CateringCartProps) {
  const isEmpty = items.length === 0;
  const total = calculateOrderTotal(items);
  const meetsMinimum = minOrderAmount <= 0 || total >= minOrderAmount;
  const progressPct = minOrderAmount > 0 ? Math.min(100, Math.round((total / minOrderAmount) * 100)) : 100;
  const remaining = minOrderAmount > 0 ? Math.max(0, minOrderAmount - total) : 0;
  const { modalRef, handleKeyDown } = useModalA11y(isOpen, onClose);

  const [removedItem, setRemovedItem] = useState<{ item: OrderItem; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  // Filter out visually hidden items
  const visibleItems = items.filter(i => i.menuItemId !== removedItem?.item.menuItemId);

  const handleRemoveClick = (item: OrderItem, index: number) => {
    // If there's already a pending removal, commit it immediately
    if (removedItem && undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      onRemove(removedItem.item.menuItemId);
    }

    // Store the current item as pending removal
    setRemovedItem({ item, index });

    // Start a 5-second timer
    const timer = setTimeout(() => {
      onRemove(item.menuItemId);
      setRemovedItem(null);
    }, 5000);

    undoTimerRef.current = timer;
  };

  const handleUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setRemovedItem(null);
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={onClose}
          role="presentation"
        />
      )}

      {/* Slide-out Panel */}
      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        className={`fixed right-0 top-0 h-full w-full max-w-md shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--aurora-surface)', willChange: 'transform', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        role="dialog"
        aria-modal={isOpen}
        aria-label="Shopping cart"
      >
        {/* Header */}
        <div className="sticky top-0 border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>Your Cart</h2>
            {businessName && (
              <p className="text-sm mt-1" style={{ color: 'var(--aurora-text-secondary)' }}>{businessName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" style={{ color: 'var(--aurora-text-secondary)' }} />
          </button>
        </div>

        {/* Minimum order progress indicator */}
        {!isEmpty && minOrderAmount > 0 && (
          <div className="px-6 py-3 border-b" style={{ borderColor: 'var(--aurora-border)', backgroundColor: meetsMinimum ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium" style={{ color: meetsMinimum ? '#059669' : '#D97706' }}>
                {meetsMinimum ? 'Minimum order met!' : `Add ${formatPrice(remaining)} more`}
              </span>
              <span className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                {formatPrice(total)} / {formatPrice(minOrderAmount)}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--aurora-surface-variant, #E5E7EB)' }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: meetsMinimum ? '#10B981' : '#F59E0B',
                }}
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={meetsMinimum ? 'Minimum order amount met' : `${progressPct}% towards minimum order of ${formatPrice(minOrderAmount)}`}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col h-full">
          {isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
              <ShoppingCart className="w-12 h-12 mb-4" style={{ color: 'var(--aurora-text-muted)' }} />
              <p className="text-center" style={{ color: 'var(--aurora-text-secondary)' }}>
                Your cart is empty. Add items to get started!
              </p>
            </div>
          ) : (
            <>
              {/* Items List */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {visibleItems.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="border rounded-lg p-4"
                    style={{ borderColor: 'var(--aurora-border)' }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium" style={{ color: 'var(--aurora-text)' }}>{item.name}</h3>
                      <button
                        onClick={() => handleRemoveClick(item, items.indexOf(item))}
                        className="p-2 hover:bg-red-50 rounded transition-colors"
                        style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 border rounded-lg w-fit" style={{ borderColor: 'var(--aurora-border)' }}>
                        <button
                          onClick={() => {
                            const minQty = item.minOrderQty || 1;
                            onUpdateQty(item.menuItemId, Math.max(minQty, item.qty - 1));
                          }}
                          disabled={item.qty <= (item.minOrderQty || 1)}
                          className="p-2.5 hover:bg-gray-100 transition-colors disabled:opacity-30"
                          style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-4 h-4" style={{ color: 'var(--aurora-text-secondary)' }} />
                        </button>
                        <QtyInput
                          value={item.qty}
                          min={item.minOrderQty || 1}
                          max={item.maxOrderQty || undefined}
                          onChange={(qty) => onUpdateQty(item.menuItemId, qty)}
                          ariaLabel={`Quantity for ${item.name}`}
                        />
                        <button
                          onClick={() =>
                            onUpdateQty(item.menuItemId, item.qty + 1)
                          }
                          disabled={!!item.maxOrderQty && item.qty >= item.maxOrderQty}
                          className="p-2.5 hover:bg-gray-100 transition-colors disabled:opacity-30"
                          style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-4 h-4" style={{ color: 'var(--aurora-text-secondary)' }} />
                        </button>
                      </div>
                      {(item.minOrderQty || item.maxOrderQty) && (
                        <p className="text-[10px] mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
                          {item.minOrderQty ? `Min: ${item.minOrderQty}` : ''}
                          {item.minOrderQty && item.maxOrderQty ? ' · ' : ''}
                          {item.maxOrderQty ? `Max: ${item.maxOrderQty}` : ''}
                        </p>
                      )}

                      <div className="text-right">
                        <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                          {formatPrice(item.unitPrice)} each
                        </p>
                        <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                          {formatPrice(item.unitPrice * item.qty)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Undo Bar */}
                {removedItem && (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-lg mb-2" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}>
                    <span className="text-sm" style={{ color: '#92400E' }}>
                      Removed {removedItem.item.name}
                    </span>
                    <button
                      onClick={handleUndo}
                      className="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors"
                      style={{ color: '#6366F1', backgroundColor: 'rgba(99,102,241,0.1)' }}
                    >
                      Undo
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 border-t px-6 py-4 space-y-3" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: 'var(--aurora-text-muted)' }}>Subtotal</span>
                    <span style={{ color: 'var(--aurora-text)' }}>{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: 'var(--aurora-text-muted)' }}>Est. tax (8.25%)</span>
                    <span style={{ color: 'var(--aurora-text)' }}>{formatPrice(Math.round(total * 0.0825))}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: 'var(--aurora-text-muted)' }}>Delivery</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                    <span className="font-semibold" style={{ color: 'var(--aurora-text)' }}>Est. Total</span>
                    <span className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>
                      {formatPrice(total + Math.round(total * 0.0825))}
                    </span>
                  </div>
                  <p className="text-[10px] italic mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
                    Tax is estimated. Final total may vary based on vendor confirmation.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClear}
                    className="flex-1 font-medium text-sm transition-colors hover:opacity-80"
                    style={{ color: 'var(--color-aurora-indigo, #6366F1)' }}
                  >
                    Clear Cart
                  </button>
                  <button
                    onClick={onCheckout}
                    disabled={!meetsMinimum}
                    className="flex-1 text-white font-medium rounded-lg py-2.5 transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-aurora-indigo, #6366F1)' }}
                    aria-label={meetsMinimum ? 'Proceed to checkout' : `Add ${formatPrice(remaining)} more to meet minimum order`}
                  >
                    {meetsMinimum ? 'Proceed to Checkout' : `${formatPrice(remaining)} more to checkout`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
