import { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Plus, Minus, Trash2 } from 'lucide-react';
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
    eventTime: string;
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
  onUpdateCartItem: (itemId: string, qty: number) => void;
  onRemoveCartItem: (itemId: string) => void;
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
  eventTime?: string;
  headcount?: string;
  contactName?: string;
  contactPhone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  recipientName?: string;
  recipientContact?: string;
  organizationName?: string;
}

function validateForm(form: CateringCheckoutProps['orderForm']): FieldError {
  const errors: FieldError = {};
  const tomorrow = getTomorrow();

  if (!form.eventDate) {
    errors.eventDate = 'Event date is required';
  } else if (form.eventDate < tomorrow) {
    errors.eventDate = 'Event date must be in the future';
  }

  if (!form.eventTime) {
    errors.eventTime = 'Event time is required';
  }

  if (!form.headcount || form.headcount < 1) {
    errors.headcount = 'Headcount must be at least 1';
  } else if (form.headcount > 10000) {
    errors.headcount = 'Headcount cannot exceed 10,000';
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

  // OrderForContext validation (SB-26)
  if (form.orderForContext.type === 'individual') {
    if (!form.orderForContext.recipientName?.trim()) {
      errors.recipientName = 'Recipient name is required';
    }
    if (!form.orderForContext.recipientContact?.trim()) {
      errors.recipientContact = 'Recipient contact is required';
    }
  } else if (form.orderForContext.type === 'organization') {
    if (!form.orderForContext.organizationName?.trim()) {
      errors.organizationName = 'Organization name is required';
    }
  }

  return errors;
}

// SB-28: State-based estimated tax rates (approximate, not authoritative)
const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.04, AZ: 0.056, AR: 0.065, CA: 0.0725, CO: 0.029,
  CT: 0.0635, DE: 0, FL: 0.06, GA: 0.04, HI: 0.04,
  ID: 0.06, IL: 0.0625, IN: 0.07, IA: 0.06, KS: 0.065,
  KY: 0.06, LA: 0.0445, ME: 0.055, MD: 0.06, MA: 0.0625,
  MI: 0.06, MN: 0.06875, MS: 0.07, MO: 0.04225, MT: 0,
  NE: 0.055, NV: 0.0685, NH: 0, NJ: 0.06625, NM: 0.05125,
  NY: 0.04, NC: 0.0475, ND: 0.05, OH: 0.0575, OK: 0.045,
  OR: 0, PA: 0.06, RI: 0.07, SC: 0.06, SD: 0.042,
  TN: 0.07, TX: 0.0625, UT: 0.061, VT: 0.06, VA: 0.053,
  WA: 0.065, WV: 0.06, WI: 0.05, WY: 0.04, DC: 0.06,
};
const DEFAULT_TAX_RATE = 0.0825;

function getEstimatedTaxRate(state?: string): number {
  if (!state) return DEFAULT_TAX_RATE;
  const normalized = state.trim().toUpperCase();
  return STATE_TAX_RATES[normalized] ?? DEFAULT_TAX_RATE;
}

const DELIVERY_FEE = 0; // $0 placeholder — vendor-specific in future

// SB-20: Persist checkout form to sessionStorage
const CHECKOUT_FORM_KEY = 'ethnicity_checkout_form';

export default function CateringCheckout({
  cart,
  orderForm,
  onUpdateForm,
  onPlaceOrder,
  onBack,
  onUpdateCartItem,
  onRemoveCartItem,
  loading,
}: CateringCheckoutProps) {
  const subtotal = calculateOrderTotal(cart.items);
  const taxRate = getEstimatedTaxRate(orderForm.deliveryAddress?.state);
  const estimatedTax = Math.round(subtotal * taxRate);
  const total = subtotal + estimatedTax + DELIVERY_FEE;
  const tomorrow = useMemo(() => getTomorrow(), []);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1, 2, 3]));

  const errors = useMemo(() => validateForm(orderForm), [orderForm]);
  const hasErrors = Object.keys(errors).length > 0;

  // SB-19: Helper to check if a section is valid
  const isSectionValid = useMemo(() => ({
    1: !errors.eventDate && !errors.eventTime && !errors.headcount,
    2: !errors.contactName && !errors.contactPhone && !errors.street && !errors.city && !errors.state && !errors.zip,
    3: true, // Order Preferences section is always valid (mostly optional)
  }), [errors]);

  const toggleSection = (sectionNum: number) => {
    setOpenSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionNum)) {
        newSet.delete(sectionNum);
      } else {
        newSet.add(sectionNum);
      }
      return newSet;
    });
  };

  // Guard: if cart becomes empty during inline editing, navigate back
  useEffect(() => {
    if (cart.items.length === 0) onBack();
  }, [cart.items.length, onBack]);

  // SB-20: Restore saved checkout form on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CHECKOUT_FORM_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if it looks like a valid form object
        if (parsed && typeof parsed === 'object' && parsed.eventDate !== undefined) {
          onUpdateForm(parsed);
        }
      }
    } catch { /* ignore parse errors */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SB-20: Persist checkout form to sessionStorage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(CHECKOUT_FORM_KEY, JSON.stringify(orderForm));
    } catch { /* quota exceeded or private browsing */ }
  }, [orderForm]);

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
    if (hasErrors) {
      setShowValidationModal(true);
      return;
    }
    // SB-20: Clear sessionStorage when order is successfully placed
    sessionStorage.removeItem(CHECKOUT_FORM_KEY);
    onPlaceOrder();
  };

  const inputClass = (field: keyof FieldError) =>
    `w-full rounded-lg border px-4 py-2.5 outline-none transition-colors ${
      showError(field)
        ? 'border-red-400 focus:ring-2 focus:ring-red-300 focus:border-red-500'
        : 'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
    }`;
  const inputStyle = { borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)', color: 'var(--aurora-text)' };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aurora-bg)' }}>
      {/* Cross-browser: hide number input spinners for qty stepper */}
      <style>{`
        input[type="number"].co-qty-input::-webkit-outer-spin-button,
        input[type="number"].co-qty-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
      {/* UI-16: checkPop keyframe now in global index.css (BUG-005) */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors" style={{ backgroundColor: 'transparent' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--aurora-surface-variant, #F3F4F6)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Go back to menu"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: 'var(--aurora-text-secondary)' }} />
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--aurora-text)' }}>Checkout</h1>
        </div>

        <div className="lg:grid lg:grid-cols-5 lg:gap-8">
        {/* Left column: form sections */}
        <div className="lg:col-span-3 space-y-6">
          {/* SB-19: Section 1: Event Details (Collapsible) */}
          <section className="rounded-lg border" style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }} aria-labelledby="section-1-heading">
            <button
              onClick={() => toggleSection(1)}
              className="w-full px-6 py-4 flex items-center gap-3 hover:opacity-80 transition-opacity"
              aria-expanded={openSections.has(1)}
              aria-controls="section-1-content"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full font-semibold text-white transition-colors duration-300" style={{ backgroundColor: isSectionValid[1] ? 'var(--aurora-success, #10B981)' : 'var(--aurora-primary, #6366f1)' }}>
                {isSectionValid[1] ? '✓' : '1'}
              </div>
              <h2 id="section-1-heading" className="text-lg font-semibold flex-1 text-left" style={{ color: 'var(--aurora-text)' }}>
                Event Details
              </h2>
              {isSectionValid[1] && (
                <CheckCircle2 size={20} className="flex-shrink-0" aria-hidden="true" style={{ color: 'var(--aurora-success, #10B981)', animation: 'checkPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }} />
              )}
              {openSections.has(1) ? (
                <ChevronUp size={20} style={{ color: 'var(--aurora-text-secondary)' }} aria-hidden="true" />
              ) : (
                <ChevronDown size={20} style={{ color: 'var(--aurora-text-secondary)' }} aria-hidden="true" />
              )}
            </button>
            {openSections.has(1) && (
              <>
                <div className="border-t" style={{ borderColor: 'var(--aurora-border)' }} />
                <div id="section-1-content" className="px-6 py-4 space-y-4">
                  <div>
                    <label htmlFor="event-date" className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                      Event Date <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="event-date"
                      type="date"
                      min={tomorrow}
                      value={orderForm.eventDate}
                      onChange={(e) => onUpdateForm({ eventDate: e.target.value })}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
                      onBlur={() => handleBlur('eventDate')}
                      className={inputClass('eventDate')}
                      aria-required={true}
                      aria-invalid={!!showError('eventDate')}
                      aria-describedby={showError('eventDate') ? 'event-date-error' : undefined}
                      style={{ ...inputStyle, appearance: 'auto' } as React.CSSProperties}
                    />
                    {showError('eventDate') && (
                      <p id="event-date-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                        <AlertCircle size={12} /> {errors.eventDate}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="event-time" className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                      Event Time <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="event-time"
                      type="time"
                      value={orderForm.eventTime}
                      onChange={(e) => onUpdateForm({ eventTime: e.target.value })}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
                      onBlur={() => handleBlur('eventTime')}
                      className={inputClass('eventTime')}
                      aria-required={true}
                      aria-invalid={!!showError('eventTime')}
                      aria-describedby={showError('eventTime') ? 'event-time-error' : undefined}
                      style={{ ...inputStyle, appearance: 'auto' } as React.CSSProperties}
                    />
                    {showError('eventTime') && (
                      <p id="event-time-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                        <AlertCircle size={12} /> {errors.eventTime}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="headcount" className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                      Headcount <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="headcount"
                      type="number"
                      min="1"
                      max="10000"
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
                </div>
              </>
            )}
          </section>

          {/* SB-19: Section 2: Contact & Delivery (Collapsible) */}
          <section className="rounded-lg border" style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }} aria-labelledby="section-2-heading">
            <button
              onClick={() => toggleSection(2)}
              className="w-full px-6 py-4 flex items-center gap-3 hover:opacity-80 transition-opacity"
              aria-expanded={openSections.has(2)}
              aria-controls="section-2-content"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full font-semibold text-white transition-colors duration-300" style={{ backgroundColor: isSectionValid[2] ? 'var(--aurora-success, #10B981)' : 'var(--aurora-primary, #6366f1)' }}>
                {isSectionValid[2] ? '✓' : '2'}
              </div>
              <h2 id="section-2-heading" className="text-lg font-semibold flex-1 text-left" style={{ color: 'var(--aurora-text)' }}>
                Contact & Delivery
              </h2>
              {isSectionValid[2] && (
                <CheckCircle2 size={20} className="flex-shrink-0" aria-hidden="true" style={{ color: 'var(--aurora-success, #10B981)', animation: 'checkPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }} />
              )}
              {openSections.has(2) ? (
                <ChevronUp size={20} style={{ color: 'var(--aurora-text-secondary)' }} aria-hidden="true" />
              ) : (
                <ChevronDown size={20} style={{ color: 'var(--aurora-text-secondary)' }} aria-hidden="true" />
              )}
            </button>
            {openSections.has(2) && (
              <>
                <div className="border-t" style={{ borderColor: 'var(--aurora-border)' }} />
                <div id="section-2-content" className="px-6 py-4 space-y-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
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
                    <label htmlFor="contact-phone" className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
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
                  <div>
                    <label htmlFor="street" className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
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
                      <label htmlFor="city" className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
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
                      <label htmlFor="state" className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
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
                    <label htmlFor="zip" className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
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
              </>
            )}
          </section>

          {/* SB-19: Section 3: Order Preferences (Collapsible) */}
          <section className="rounded-lg border" style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }} aria-labelledby="section-3-heading">
            <button
              onClick={() => toggleSection(3)}
              className="w-full px-6 py-4 flex items-center gap-3 hover:opacity-80 transition-opacity"
              aria-expanded={openSections.has(3)}
              aria-controls="section-3-content"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full font-semibold text-white transition-colors duration-300" style={{ backgroundColor: isSectionValid[3] ? 'var(--aurora-success, #10B981)' : 'var(--aurora-primary, #6366f1)' }}>
                {isSectionValid[3] ? '✓' : '3'}
              </div>
              <h2 id="section-3-heading" className="text-lg font-semibold flex-1 text-left" style={{ color: 'var(--aurora-text)' }}>
                Order Preferences
              </h2>
              {isSectionValid[3] && (
                <CheckCircle2 size={20} className="flex-shrink-0" aria-hidden="true" style={{ color: 'var(--aurora-success, #10B981)', animation: 'checkPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }} />
              )}
              {openSections.has(3) ? (
                <ChevronUp size={20} style={{ color: 'var(--aurora-text-secondary)' }} aria-hidden="true" />
              ) : (
                <ChevronDown size={20} style={{ color: 'var(--aurora-text-secondary)' }} aria-hidden="true" />
              )}
            </button>
            {openSections.has(3) && (
              <>
                <div className="border-t" style={{ borderColor: 'var(--aurora-border)' }} />
                <div id="section-3-content" className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                      Who is this order for?
                    </label>
                    <OrderForSelector
                      value={orderForm.orderForContext}
                      onChange={(ctx) => onUpdateForm({ orderForContext: ctx })}
                      errors={submitAttempted || touched['recipientName'] || touched['recipientContact'] || touched['organizationName'] ? {
                        recipientName: touched['recipientName'] || submitAttempted ? errors.recipientName : undefined,
                        recipientContact: touched['recipientContact'] || submitAttempted ? errors.recipientContact : undefined,
                        organizationName: touched['organizationName'] || submitAttempted ? errors.organizationName : undefined,
                      } : undefined}
                      onBlur={(field) => handleBlur(field)}
                    />
                  </div>

                  <div>
                    <label htmlFor="special-instructions" className="block text-sm font-medium mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                      Special Instructions
                    </label>
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
                      className="w-full rounded-lg border px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors resize-none"
                      style={{ borderColor: 'var(--aurora-border)' }}
                      aria-label="Special instructions"
                      aria-describedby="instructions-count"
                    />
                    <p id="instructions-count" className="text-xs text-right mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
                      {orderForm.specialInstructions.length}/{SPECIAL_INSTRUCTIONS_MAX}
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Validation error modal — triggered on submit attempt with errors */}
          {showValidationModal && hasErrors && (
            <CheckoutValidationModal
              errors={Object.values(errors).filter(Boolean) as string[]}
              onClose={() => setShowValidationModal(false)}
            />
          )}

        </div>

        {/* Right column: Order Summary (sticky on desktop) */}
        <div className="lg:col-span-2 mt-6 lg:mt-0">
          <div className="lg:sticky lg:top-8 space-y-6">
          {/* Section 5: Order Summary */}
          <section className="rounded-lg p-6 border-t-4 border-indigo-500" style={{ backgroundColor: 'var(--aurora-surface)' }} aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="text-lg font-semibold mb-4" style={{ color: 'var(--aurora-text)' }}>
              Order Summary
            </h2>

            {cart.businessName && (
              <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>From: {cart.businessName}</p>
            )}

            <div className="space-y-3 mb-4" role="list" aria-label="Order items">
              {cart.items.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex items-center gap-2"
                  style={{ color: 'var(--aurora-text)' }}
                  role="listitem"
                >
                  {/* Item name — truncated on narrow screens */}
                  <span className="flex-1 text-sm truncate" title={item.name}>
                    {item.name}
                  </span>

                  {/* Inline qty stepper */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.qty <= 1 ? (
                      <button
                        onClick={() => onRemoveCartItem(item.menuItemId)}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
                        aria-label={`Remove ${item.name}`}
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={() => onUpdateCartItem(item.menuItemId, item.qty - 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                        style={{ backgroundColor: 'var(--aurora-bg, #F5F6FA)', color: 'var(--aurora-text-secondary)' }}
                        aria-label={`Decrease ${item.name} quantity`}
                        type="button"
                      >
                        <Minus size={13} />
                      </button>
                    )}

                    <input
                      type="number"
                      min={item.minOrderQty || 1}
                      max={item.maxOrderQty || 9999}
                      value={item.qty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (val <= 0) {
                          onRemoveCartItem(item.menuItemId);
                        } else {
                          onUpdateCartItem(item.menuItemId, val);
                        }
                      }}
                      className="w-10 h-7 text-center text-sm font-medium rounded-md border outline-none co-qty-input"
                      style={{
                        borderColor: 'var(--aurora-border)',
                        backgroundColor: 'var(--aurora-bg)',
                        color: 'var(--aurora-text)',
                        /* Cross-browser: hide number spinners */
                        MozAppearance: 'textfield',
                        WebkitAppearance: 'none',
                        appearance: 'textfield',
                      } as React.CSSProperties}
                      aria-label={`${item.name} quantity`}
                    />

                    <button
                      onClick={() => onUpdateCartItem(item.menuItemId, item.qty + 1)}
                      disabled={(item.maxOrderQty || 9999) <= item.qty}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                      style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}
                      aria-label={`Increase ${item.name} quantity`}
                      type="button"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {/* Line total */}
                  <span className="font-medium text-sm w-16 text-right flex-shrink-0">
                    {formatPrice(item.unitPrice * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 space-y-2" style={{ borderTop: `1px solid var(--aurora-border)` }}>
              <div className="flex justify-between items-center text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div>
                <div className="flex justify-between items-center text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                  <span>Estimated Tax</span>
                  <span>{formatPrice(estimatedTax)}</span>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--aurora-text-muted)' }}>
                  {orderForm.deliveryAddress?.state
                    ? `Based on ${orderForm.deliveryAddress.state.toUpperCase()} state rate (~${(taxRate * 100).toFixed(1)}%). Actual tax may vary.`
                    : 'Estimate only — enter delivery address for a better estimate.'}
                </p>
              </div>
              {DELIVERY_FEE > 0 ? (
                <div className="flex justify-between items-center text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
                  <span>Delivery Fee</span>
                  <span>{formatPrice(DELIVERY_FEE)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-sm text-green-600">
                  <span>Delivery Fee</span>
                  <span>Free</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2" style={{ borderTop: `1px solid var(--aurora-border)` }}>
                <span className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>
                  Estimated Total
                </span>
                <span className="text-lg font-bold text-indigo-600">
                  {formatPrice(total)}
                </span>
              </div>
              <p className="text-[11px] italic" style={{ color: 'var(--aurora-text-muted)' }}>
                Final amount may vary based on vendor confirmation.
              </p>
            </div>
          </section>

          {/* Footer Actions */}
          {/* BUG-004: Use sticky on mobile only; lg:static avoids nested sticky conflict */}
          <div className="flex gap-3 sticky bottom-0 py-4 lg:static lg:py-0 -mx-4 px-4 lg:mx-0 lg:px-0" style={{ backgroundColor: 'var(--aurora-bg)', borderTop: `1px solid var(--aurora-border)` }}>
            <button
              onClick={onBack}
              disabled={loading}
              className="flex-1 px-6 py-3 border font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed lg:hidden hover:opacity-80"
              style={{ borderColor: 'var(--aurora-border-glass)', color: 'var(--aurora-text-secondary)' }}
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
      </div>
    </div>
  );
}

// ── Checkout Validation Error Modal ──
// Cross-browser: iOS Safari scroll lock, dvh height, ESC key, backdrop click/touch, prefers-reduced-motion
function CheckoutValidationModal({ errors, onClose }: { errors: string[]; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    modalRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);

    // Lock body scroll (iOS Safari fix — position:fixed prevents rubber-banding)
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  const handleBackdropInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        height: '100vh',
        // @ts-ignore — dvh is valid CSS but not in React's CSSProperties type
        ...(CSS.supports?.('height', '100dvh') ? { height: '100dvh' } : {}),
        animation: 'coValidationFadeIn 0.2s ease-out',
      }}
      onClick={handleBackdropInteraction}
      onTouchEnd={handleBackdropInteraction}
      role="alertdialog"
      aria-modal="true"
      aria-label="Validation errors"
    >
      <style>{`
        @keyframes coValidationFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes coValidationSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .co-validation-modal-card {
            animation: none !important;
          }
        }
        /* Cross-browser: hide number input spinners */
        input[type="number"].co-qty-input::-webkit-outer-spin-button,
        input[type="number"].co-qty-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden outline-none co-validation-modal-card"
        style={{
          backgroundColor: 'var(--aurora-bg, #fff)',
          animation: 'coValidationSlideUp 0.25s ease-out',
          WebkitTextSizeAdjust: '100%',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #EF4444, #F87171)' }}
        >
          <AlertCircle size={22} style={{ color: 'rgba(255,255,255,0.95)' }} />
          <h2 className="text-base font-bold text-white" style={{ lineHeight: 1.3 }}>
            Please fix before placing order
          </h2>
        </div>

        {/* Error list */}
        <div className="px-5 py-4" style={{ maxHeight: '50vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <ul className="space-y-2.5">
            {errors.map((msg, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm"
                style={{ color: 'var(--aurora-text, #1E2132)' }}
              >
                <span
                  className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
                >
                  {i + 1}
                </span>
                <span>{msg}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: '#6366F1' }}
          >
            Got it, I'll fix these
          </button>
        </div>
      </div>
    </div>
  );
}
