import { useState, useMemo } from 'react';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import type {
  OrderItem,
  DeliveryAddress,
  OrderForContext,
} from '@/services/cateringService';
import { formatPrice, calculateOrderTotal } from '@/services/cateringService';
import OrderForSelector from './OrderForSelector';
import AddressAutocomplete from '@/components/shared/AddressAutocomplete';
import type { AddressResult } from '@/components/shared/AddressAutocomplete';

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

const SPECIAL_INSTRUCTIONS_MAX = 500;

// Compute tomorrow's date string for min date constraint
function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface FieldError {
  eventDate?: string;
  headcount?: string;
  contactName?: string;
  contactPhone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

function validateForm(form: CateringCheckoutProps['orderForm']): FieldError {
  const errors: FieldError = {};
  const tomorrow = getTomorrow();

  if (!form.eventDate) {
    errors.eventDate = 'Event date is required';
  } else if (form.eventDate < tomorrow) {
    errors.eventDate = 'Event date must be in the future';
  }

  if (!form.headcount || form.headcount < 1) {
    errors.headcount = 'Headcount must be at least 1';
  }

  if (!form.contactName.trim()) {
    errors.contactName = 'Contact name is required';
  }

  if (!form.contactPhone.trim()) {
    errors.contactPhone = 'Contact phone is required';
  } else if (!/^[\d\s\-+()]{7,15}$/.test(form.contactPhone.trim())) {
    errors.contactPhone = 'Please enter a valid phone number';
  }

  if (!form.deliveryAddress?.street?.trim()) {
    errors.street = 'Street address is required';
  }
  if (!form.deliveryAddress?.city?.trim()) {
    errors.city = 'City is required';
  }
  if (!form.deliveryAddress?.state?.trim()) {
    errors.state = 'State is required';
  }
  if (!form.deliveryAddress?.zip?.trim()) {
    errors.zip = 'ZIP code is required';
  } else if (!/^\d{5}(-\d{4})?$/.test(form.deliveryAddress.zip.trim())) {
    errors.zip = 'Please enter a valid ZIP code';
  }

  return errors;
}

const ESTIMATED_TAX_RATE = 0.0825; // 8.25% default
const DELIVERY_FEE = 0; // $0 placeholder — vendor-specific in future

export default function CateringCheckout({
  cart,
  orderForm,
  onUpdateForm,
  onPlaceOrder,
  onBack,
  loading,
}: CateringCheckoutProps) {
  const subtotal = calculateOrderTotal(cart.items);
  const estimatedTax = Math.round(subtotal * ESTIMATED_TAX_RATE);
  const total = subtotal + estimatedTax + DELIVERY_FEE;
  const tomorrow = useMemo(() => getTomorrow(), []);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const errors = useMemo(() => validateForm(orderForm), [orderForm]);
  const hasErrors = Object.keys(errors).length > 0;

  const showError = (field: keyof FieldError) =>
    (touched[field] || submitAttempted) && errors[field];

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

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

  const handleAddressAutocomplete = (result: AddressResult) => {
    onUpdateForm({
      deliveryAddress: {
        street: result.street,
        city: result.city,
        state: result.state,
        zip: result.zip,
        ...(result.lat ? { lat: result.lat } : {}),
        ...(result.lng ? { lng: result.lng } : {}),
        ...(result.formattedAddress ? { formattedAddress: result.formattedAddress } : {}),
      },
    });
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (hasErrors) return;
    onPlaceOrder();
  };

  const inputClass = (field: keyof FieldError) =>
    `w-full rounded-lg border px-4 py-2.5 outline-none transition-colors ${
      showError(field)
        ? 'border-red-400 focus:ring-2 focus:ring-red-300 focus:border-red-500'
        : 'border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Go back to menu"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        </div>

        <div className="space-y-6">
          {/* Section 1: Event Details */}
          <section className="bg-white rounded-lg p-6 border-t-4 border-indigo-500" aria-labelledby="event-details-heading">
            <h2 id="event-details-heading" className="text-lg font-semibold text-gray-900 mb-4">
              Event Details
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="event-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Event Date <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="event-date"
                  type="date"
                  min={tomorrow}
                  value={orderForm.eventDate}
                  onChange={(e) => onUpdateForm({ eventDate: e.target.value })}
                  onBlur={() => handleBlur('eventDate')}
                  className={inputClass('eventDate')}
                  aria-required={true}
                  aria-invalid={!!showError('eventDate')}
                  aria-describedby={showError('eventDate') ? 'event-date-error' : undefined}
                />
                {showError('eventDate') && (
                  <p id="event-date-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                    <AlertCircle size={12} /> {errors.eventDate}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="headcount" className="block text-sm font-medium text-gray-700 mb-2">
                  Headcount <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="headcount"
                  type="number"
                  min="1"
                  value={orderForm.headcount || ''}
                  onChange={(e) => onUpdateForm({ headcount: parseInt(e.target.value) || 0 })}
                  onBlur={() => handleBlur('headcount')}
                  placeholder="Number of guests"
                  className={inputClass('headcount')}
                  aria-required={true}
                  aria-invalid={!!showError('headcount')}
                  aria-describedby={showError('headcount') ? 'headcount-error' : undefined}
                />
                {showError('headcount') && (
                  <p id="headcount-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                    <AlertCircle size={12} /> {errors.headcount}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={orderForm.contactName}
                  onChange={(e) => onUpdateForm({ contactName: e.target.value })}
                  onBlur={() => handleBlur('contactName')}
                  placeholder="Full name"
                  className={inputClass('contactName')}
                  aria-required={true}
                  aria-invalid={!!showError('contactName')}
                  aria-describedby={showError('contactName') ? 'contact-name-error' : undefined}
                />
                {showError('contactName') && (
                  <p id="contact-name-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                    <AlertCircle size={12} /> {errors.contactName}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Phone <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  value={orderForm.contactPhone}
                  onChange={(e) => onUpdateForm({ contactPhone: e.target.value })}
                  onBlur={() => handleBlur('contactPhone')}
                  placeholder="(555) 123-4567"
                  className={inputClass('contactPhone')}
                  aria-required={true}
                  aria-invalid={!!showError('contactPhone')}
                  aria-describedby={showError('contactPhone') ? 'contact-phone-error' : undefined}
                />
                {showError('contactPhone') && (
                  <p id="contact-phone-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                    <AlertCircle size={12} /> {errors.contactPhone}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Section 2: Delivery Address */}
          <section className="bg-white rounded-lg p-6 border-t-4 border-indigo-500" aria-labelledby="delivery-heading">
            <h2 id="delivery-heading" className="text-lg font-semibold text-gray-900 mb-4">
              Delivery Address
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <AddressAutocomplete
                  id="street"
                  value={orderForm.deliveryAddress?.street || ''}
                  onChange={(val) => handleAddressChange('street', val)}
                  onSelect={handleAddressAutocomplete}
                  onBlur={() => handleBlur('street')}
                  placeholder="123 Main Street"
                  className={inputClass('street')}
                  aria-required={true}
                  aria-invalid={!!showError('street')}
                  aria-describedby={showError('street') ? 'street-error' : undefined}
                />
                {showError('street') && (
                  <p id="street-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                    <AlertCircle size={12} /> {errors.street}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                    City <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={orderForm.deliveryAddress?.city || ''}
                    onChange={(e) => handleAddressChange('city', e.target.value)}
                    onBlur={() => handleBlur('city')}
                    className={inputClass('city')}
                    aria-required={true}
                    aria-invalid={!!showError('city')}
                    aria-describedby={showError('city') ? 'city-error' : undefined}
                  />
                  {showError('city') && (
                    <p id="city-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                      <AlertCircle size={12} /> {errors.city}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                    State <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={orderForm.deliveryAddress?.state || ''}
                    onChange={(e) => handleAddressChange('state', e.target.value)}
                    onBlur={() => handleBlur('state')}
                    className={inputClass('state')}
                    aria-required={true}
                    aria-invalid={!!showError('state')}
                    aria-describedby={showError('state') ? 'state-error' : undefined}
                  />
                  {showError('state') && (
                    <p id="state-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                      <AlertCircle size={12} /> {errors.state}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-2">
                  ZIP Code <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="zip"
                  type="text"
                  value={orderForm.deliveryAddress?.zip || ''}
                  onChange={(e) => handleAddressChange('zip', e.target.value)}
                  onBlur={() => handleBlur('zip')}
                  placeholder="95112"
                  className={inputClass('zip')}
                  aria-required={true}
                  aria-invalid={!!showError('zip')}
                  aria-describedby={showError('zip') ? 'zip-error' : undefined}
                />
                {showError('zip') && (
                  <p id="zip-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                    <AlertCircle size={12} /> {errors.zip}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Order For Context */}
          <section className="bg-white rounded-lg p-6 border-t-4 border-indigo-500" aria-labelledby="orderfor-heading">
            <h2 id="orderfor-heading" className="text-lg font-semibold text-gray-900 mb-4">
              Who is this order for?
            </h2>
            <OrderForSelector
              value={orderForm.orderForContext}
              onChange={(ctx) => onUpdateForm({ orderForContext: ctx })}
            />
          </section>

          {/* Section 4: Special Instructions */}
          <section className="bg-white rounded-lg p-6 border-t-4 border-indigo-500" aria-labelledby="instructions-heading">
            <h2 id="instructions-heading" className="text-lg font-semibold text-gray-900 mb-4">
              Special Instructions
            </h2>
            <textarea
              id="special-instructions"
              value={orderForm.specialInstructions}
              onChange={(e) => {
                if (e.target.value.length <= SPECIAL_INSTRUCTIONS_MAX) {
                  onUpdateForm({ specialInstructions: e.target.value });
                }
              }}
              placeholder="Add any special requests or dietary restrictions..."
              rows={4}
              maxLength={SPECIAL_INSTRUCTIONS_MAX}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors resize-none"
              aria-label="Special instructions"
              aria-describedby="instructions-count"
            />
            <p id="instructions-count" className="text-xs text-gray-400 text-right mt-1">
              {orderForm.specialInstructions.length}/{SPECIAL_INSTRUCTIONS_MAX}
            </p>
          </section>

          {/* Section 5: Order Summary */}
          <section className="bg-white rounded-lg p-6 border-t-4 border-indigo-500" aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="text-lg font-semibold text-gray-900 mb-4">
              Order Summary
            </h2>

            {cart.businessName && (
              <p className="text-sm text-gray-600 mb-4">From: {cart.businessName}</p>
            )}

            <div className="space-y-3 mb-4" role="list" aria-label="Order items">
              {cart.items.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex justify-between items-center text-gray-900"
                  role="listitem"
                >
                  <span>
                    {item.name} &times; {item.qty}
                  </span>
                  <span className="font-medium">
                    {formatPrice(item.unitPrice * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-200 space-y-2">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Estimated Tax (8.25%)</span>
                <span>{formatPrice(estimatedTax)}</span>
              </div>
              {DELIVERY_FEE > 0 ? (
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Delivery Fee</span>
                  <span>{formatPrice(DELIVERY_FEE)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-sm text-green-600">
                  <span>Delivery Fee</span>
                  <span>Free</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-lg font-semibold text-gray-900">
                  Estimated Total
                </span>
                <span className="text-lg font-bold text-indigo-600">
                  {formatPrice(total)}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 italic">
                Final amount may vary based on vendor confirmation.
              </p>
            </div>
          </section>

          {/* Validation summary on submit */}
          {submitAttempted && hasErrors && (
            <div
              className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Please fix the following before placing your order:</p>
                <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                  {Object.values(errors).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex gap-3 sticky bottom-0 bg-gray-50 py-4 -mx-4 px-4 border-t border-gray-200">
            <button
              onClick={onBack}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Go back to menu"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              aria-label="Place your catering order"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Place Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
