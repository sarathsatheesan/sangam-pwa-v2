import { X, ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import type { OrderItem } from '@/services/cateringService';
import { calculateOrderTotal, formatPrice } from '@/services/cateringService';

interface CateringCartProps {
  items: OrderItem[];
  businessName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateQty: (menuItemId: string, qty: number) => void;
  onRemove: (menuItemId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
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
}: CateringCartProps) {
  const isEmpty = items.length === 0;
  const total = calculateOrderTotal(items);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
          onClick={onClose}
          role="presentation"
        />
      )}

      {/* Slide-out Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Your Cart</h2>
            {businessName && (
              <p className="text-sm text-gray-600 mt-1">{businessName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close cart"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-full">
          {isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
              <ShoppingCart className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-600 text-center">
                Your cart is empty. Add items to get started!
              </p>
            </div>
          ) : (
            <>
              {/* Items List */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {items.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <button
                        onClick={() => onRemove(item.menuItemId)}
                        className="p-1 hover:bg-red-50 rounded transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 border border-gray-200 rounded-lg w-fit">
                        <button
                          onClick={() =>
                            onUpdateQty(
                              item.menuItemId,
                              Math.max(1, item.qty - 1)
                            )
                          }
                          className="p-1.5 hover:bg-gray-100 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="w-8 text-center font-medium text-gray-900">
                          {item.qty}
                        </span>
                        <button
                          onClick={() =>
                            onUpdateQty(item.menuItemId, item.qty + 1)
                          }
                          className="p-1.5 hover:bg-gray-100 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {formatPrice(item.unitPrice)} each
                        </p>
                        <p className="font-semibold text-gray-900">
                          {formatPrice(item.unitPrice * item.qty)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatPrice(total)}
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClear}
                    className="flex-1 text-indigo-600 hover:text-indigo-700 font-medium text-sm transition-colors"
                  >
                    Clear Cart
                  </button>
                  <button
                    onClick={onCheckout}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg py-2.5 transition-colors"
                  >
                    Proceed to Checkout
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
