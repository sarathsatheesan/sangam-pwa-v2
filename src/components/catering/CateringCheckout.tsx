import { ArrowLeft, Loader2 } from 'lucide-react';
import type {
  OrderItem,
  DeliveryAddress,
  OrderForContext,
} from '@/services/cateringService';
import { formatPrice, calculateOrderTotal } from '@/services/cateringService';
import OrderForSelector from './OrderForSelector';

interface CateringCheckoutProps {
  cart: {
    items: OrderItem[];
    businessId: string | null;
    businessName: string | null;
  };
  orderForm: {
    eventDate: string;
    headcount: number;
    deliveryAddress: DeliveryAddress | null;
    specialInstructions: string;
    contactName: string;
    contactPhone: string;
    orderForContext: OrderForContext;
  };
  onUpdateForm: (
    updates: Partial<CateringCheckoutProps['orderForm']>
  ) => void;
  onPlaceOrder: () => void;
  onBack: () => void;
  loading: boolean;
}

export default function CateringCheckout({
  cart,
  orderForm,
  onUpdateForm,
  onPlaceOrder,
  onBack,
  loading,
}: CateringCheckoutProps) {
  const total = calculateOrderTotal(cart.items);

  const handleAddressChange = (field: keyof DeliveryAddress, value: string) => {
    const updatedAddress = {
      ...(orderForm.deliveryAddress || {
        street: '',
        city: '',
        state: '',
        zip: '',
      }),
      [field]: value,
    };
    onUpdateForm({ deliveryAddress: updatedAddress });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        </div>

        <div className="space-y-6">
          {/* Section 1: Event Details */}
          <section className="bg-white rounded-lg p-6 border-t-4 border-indigo-500">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Event Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Date
                </label>
                <input
                  type="date"
                  value={orderForm.eventDate}
                  onChange={(e) =>
                    onUpdateForm({ eventDate: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Headcount
                </label>
                <input
                  type="number"
                  min="1"
                  value={orderForm.headcount}
                  onChange={(e) =>
                    onUpdateForm({ headcount: parseInt(e.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={orderForm.contactName}
                  onChange={(e) =>
                    onUpdateForm({ contactName: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={orderForm.contactPhone}
                  onChange={(e) =>
                    onUpdateForm({ contactPhone: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Delivery Address */}
          <section className="bg-white rounded-lg p-6 border-t-4 border-indigo-500">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Delivery Address
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  value={orderForm.deliveryAddress?.street || ''}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={orderForm.deliveryAddress?.city || ''}
                    onChange={(e) =>
                      handleAddressChange('city', e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={orderForm.deliveryAddress?.state || ''}
                    onChange={(e) =>
                      handleAddressChange('state', e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ZIP Code
                </label>
                <input
                  type="text"
                  value={orderForm.deliveryAddress?.zip || ''}
                  onChange={(e) => handleAddressChange('zip', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Order For Context */}
          <section className="bg-white rounded-lg p-6 border-t-4 border-indigo-500">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Who is this order for?
            </h2>
            <OrderForSelector
              value={orderForm.orderForContext}
              onChange={(ctx) => onUpdateForm({ orderForContext: ctx })}
            />
          </section>

          {/* Section 4: Special Instructions */}
          <section className="bg-white rounded-lg p-6 border-t-4 border-indigo-500">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Special Instructions
            </h2>
            <textarea
              value={orderForm.specialInstructions}
              onChange={(e) =>
                onUpdateForm({ specialInstructions: e.target.value })
              }
              placeholder="Add any special requests or dietary restrictions..."
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors resize-none"
            />
          </section>

          {/* Section 5: Order Summary */}
          <section className="bg-white rounded-lg p-6 border-t-4 border-indigo-500">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Order Summary
            </h2>

            {cart.businessName && (
              <p className="text-sm text-gray-600 mb-4">From: {cart.businessName}</p>
            )}

            <div className="space-y-3 mb-4">
              {cart.items.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex justify-between items-center text-gray-900"
                >
                  <span>
                    {item.name} × {item.qty}
                  </span>
                  <span className="font-medium">
                    {formatPrice(item.unitPrice * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">
                  Subtotal
                </span>
                <span className="text-lg font-bold text-indigo-600">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </section>

          {/* Footer Actions */}
          <div className="flex gap-3 sticky bottom-0 bg-gray-50 py-4 -mx-4 px-4 border-t border-gray-200">
            <button
              onClick={onBack}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={onPlaceOrder}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Place Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
