import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Loader2, Send, ShieldCheck, ChevronDown, Search, X, Check, Store, TrendingUp, Info, AlertCircle, MapPin, Calendar, Clock, Users, UtensilsCrossed, Eye } from 'lucide-react';
import type { QuoteRequestItem, OrderForContext, DeliveryAddress } from '@/services/cateringService';
import { CUISINE_CATEGORIES, CUISINE_CATEGORY_KEYS } from '@/constants/cateringFoodItems';
import type { CuisineFoodItem } from '@/constants/cateringFoodItems';
import AddressAutocomplete from '../shared/AddressAutocomplete';
import type { AddressResult } from '../shared/AddressAutocomplete';
import { getDistanceMiles } from '../business/businessUtils';
import OrderForSelector from './OrderForSelector';

// Shared date constraint — identical to CateringCheckout
function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface RequestForPriceFormProps {
  rfpForm: {
    deliveryCity: string;
    deliveryAddress: DeliveryAddress | null;
    eventType: string;
    eventDate: string;
    eventTime?: string;
    headcount: number;
    specialInstructions: string;
    items: QuoteRequestItem[];
    orderForContext: OrderForContext;
    targetBusinessIds: string[];
  };
  businesses: any[];
  cuisineCategory: string;
  onUpdateForm: (updates: Partial<RequestForPriceFormProps['rfpForm']>) => void;
  onAddItem: (item: QuoteRequestItem) => void;
  onUpdateItem: (index: number, item: QuoteRequestItem) => void;
  onRemoveItem: (index: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}

const EVENT_TYPES = [
  { value: 'corporate_meeting', label: 'Corporate Meeting', emoji: '💼' },
  { value: 'wedding', label: 'Wedding', emoji: '💍' },
  { value: 'cultural_festival', label: 'Cultural Festival', emoji: '🎊' },
  { value: 'religious', label: 'Religious Event', emoji: '🙏' },
  { value: 'birthday', label: 'Birthday Party', emoji: '🎂' },
  { value: 'sangeet', label: 'Sangeet / Mehndi', emoji: '💃' },
  { value: 'pooja', label: 'Pooja / Puja', emoji: '🪔' },
  { value: 'eid', label: 'Eid Celebration', emoji: '🌙' },
  { value: 'graduation', label: 'Graduation', emoji: '🎓' },
  { value: 'baby_shower', label: 'Baby Shower', emoji: '👶' },
  { value: 'community_gathering', label: 'Community Gathering', emoji: '🤝' },
  { value: 'other', label: 'Other', emoji: '🍽️' },
];

const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten_free', 'dairy_free', 'nut_free'];
const PRICING_TYPES: Array<{ value: QuoteRequestItem['pricingType']; label: string }> = [
  { value: 'per_person', label: 'Per Person' },
  { value: 'per_tray', label: 'Per Tray' },
  { value: 'flat_rate', label: 'Flat Rate' },
];

// ── Market price guidance (approximate ranges for common catering) ──
const PRICE_GUIDANCE: Record<string, { perPerson: [number, number]; trayServes: string; note: string }> = {
  indian: { perPerson: [18, 35], trayServes: '8–12', note: 'Includes appetizer, 2 mains, rice, naan, dessert' },
  chinese: { perPerson: [15, 30], trayServes: '8–10', note: 'Family-style trays with 3–4 dishes + rice' },
  mexican: { perPerson: [14, 28], trayServes: '10–12', note: 'Taco/burrito bar with proteins, sides, and salsa' },
  italian: { perPerson: [16, 32], trayServes: '8–10', note: 'Pasta trays, salad, garlic bread, dessert' },
  thai: { perPerson: [16, 30], trayServes: '8–10', note: 'Curry, stir-fry, rice, appetizers' },
  japanese: { perPerson: [20, 40], trayServes: '6–8', note: 'Sushi platters, bento boxes, or tempura trays' },
  korean: { perPerson: [18, 35], trayServes: '8–10', note: 'BBQ platters, banchan, rice, and stew' },
  middle_eastern: { perPerson: [16, 30], trayServes: '10–12', note: 'Kebab platters, hummus, rice, salads' },
  ethiopian: { perPerson: [16, 28], trayServes: '8–10', note: 'Injera platters with assorted stews' },
  caribbean: { perPerson: [15, 28], trayServes: '8–10', note: 'Jerk chicken, rice & peas, plantains' },
  default: { perPerson: [15, 35], trayServes: '8–12', note: 'Varies by cuisine and menu complexity' },
};

export default function RequestForPriceForm({
  rfpForm,
  businesses,
  cuisineCategory,
  onUpdateForm,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSubmit,
  onBack,
  loading,
}: RequestForPriceFormProps) {
  // Cuisine picker state
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [cuisineDropdownOpen, setCuisineDropdownOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const cuisineRef = useRef<HTMLDivElement>(null);
  const itemPickerRef = useRef<HTMLDivElement>(null);

  // Manual add item state (fallback / custom items)
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [newItem, setNewItem] = useState<QuoteRequestItem>({
    name: '',
    qty: 1,
    pricingType: 'per_person',
    dietaryTags: [],
  });

  // Qty validation state for P-09
  const [showQtyWarning, setShowQtyWarning] = useState(false);
  const [confirmedDefaultQty, setConfirmedDefaultQty] = useState(false);

  // Phase 3: Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Date validation — same constraint as CateringCheckout
  const tomorrow = useMemo(() => getTomorrow(), []);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const handleBlur = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  // Submit-attempt state — shows all errors at once when user tries to submit
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Validation errors — identical logic to CateringCheckout
  const cityError = useMemo(() => {
    if (!rfpForm.deliveryCity.trim()) return 'Delivery city is required';
    return '';
  }, [rfpForm.deliveryCity]);

  const dateError = useMemo(() => {
    if (!rfpForm.eventDate) return 'Event date is required';
    if (rfpForm.eventDate < tomorrow) return 'Event date must be in the future';
    return '';
  }, [rfpForm.eventDate, tomorrow]);

  const timeError = useMemo(() => {
    if (!rfpForm.eventTime) return 'Event time is required';
    return '';
  }, [rfpForm.eventTime]);

  const headcountError = useMemo(() => {
    if (!rfpForm.headcount || rfpForm.headcount < 1) return 'Headcount must be at least 1';
    return '';
  }, [rfpForm.headcount]);

  const itemsError = useMemo(() => {
    if (rfpForm.items.length === 0) return 'At least one menu item is required';
    return '';
  }, [rfpForm.items.length]);

  // Progressive disclosure: show errors after field touched OR after submit attempt
  const showError = (field: string, error: string) =>
    error && (touched[field] || submitAttempted);

  const showCityError = showError('deliveryCity', cityError);
  const showDateError = showError('eventDate', dateError);
  const showTimeError = showError('eventTime', timeError);
  const showHeadcountError = showError('headcount', headcountError);
  const showItemsError = submitAttempted && !!itemsError;

  // Collect all current errors for the validation summary
  const allErrors = useMemo(() => {
    const errs: string[] = [];
    if (cityError) errs.push(cityError);
    if (dateError) errs.push(dateError);
    if (timeError) errs.push(timeError);
    if (headcountError) errs.push(headcountError);
    if (itemsError) errs.push(itemsError);
    return errs;
  }, [cityError, dateError, timeError, headcountError, itemsError]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cuisineRef.current && !cuisineRef.current.contains(e.target as Node)) {
        setCuisineDropdownOpen(false);
      }
      if (itemPickerRef.current && !itemPickerRef.current.contains(e.target as Node)) {
        setItemPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddItem = () => {
    if (!newItem.name.trim()) return;
    onAddItem({ ...newItem });
    setNewItem({ name: '', qty: 1, pricingType: 'per_person', dietaryTags: [] });
  };

  const toggleNewItemDietary = (tag: string) => {
    setNewItem((prev) => {
      const tags = prev.dietaryTags || [];
      return {
        ...prev,
        dietaryTags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
      };
    });
  };

  // Check if a food item is already in the RFP
  const isItemAdded = (itemName: string) => rfpForm.items.some((i) => i.name === itemName);

  // Add a preset food item from the cuisine picker
  const handleTogglePresetItem = (foodItem: CuisineFoodItem) => {
    if (isItemAdded(foodItem.name)) {
      // Remove it
      const idx = rfpForm.items.findIndex((i) => i.name === foodItem.name);
      if (idx >= 0) onRemoveItem(idx);
    } else {
      // Add it with default qty 1
      onAddItem({
        name: foodItem.name,
        qty: 1,
        pricingType: foodItem.pricingType,
        dietaryTags: foodItem.dietaryTags || [],
      });
    }
  };

  // Get items for the selected cuisine, filtered by search
  const cuisineItems = selectedCuisine ? CUISINE_CATEGORIES[selectedCuisine]?.items || [] : [];
  const filteredCuisineItems = itemSearchQuery
    ? cuisineItems.filter((item) => item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()))
    : cuisineItems;

  const canSubmit = allErrors.length === 0;

  // ── Vendor match count: how many caterers can serve this delivery location ──
  const reachableVendorCount = useMemo(() => {
    const addr = rfpForm.deliveryAddress;
    if (!addr?.lat || !addr?.lng || !businesses || businesses.length === 0) return null;
    let count = 0;
    for (const biz of businesses) {
      if (biz.latitude == null || biz.longitude == null) continue;
      const radius = biz.serviceRadius || 25; // default 25 miles
      const dist = getDistanceMiles(addr.lat, addr.lng, biz.latitude, biz.longitude);
      if (dist <= radius) count++;
    }
    return count;
  }, [rfpForm.deliveryAddress, businesses]);

  // Handle submit with qty validation
  const handleSubmitWithQtyCheck = () => {
    setSubmitAttempted(true);
    if (!canSubmit) return;

    const itemsWithDefaultQty = rfpForm.items.filter(i => i.qty === 1);
    if (itemsWithDefaultQty.length > 0 && !confirmedDefaultQty) {
      setShowQtyWarning(true);
      return;
    }
    // All items have been checked or confirmed — show confirmation modal
    setShowQtyWarning(false);
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    setShowConfirmModal(false);
    setConfirmedDefaultQty(false);
    onSubmit();
  };

  // Event type label lookup
  const eventTypeLabel = EVENT_TYPES.find(e => e.value === rfpForm.eventType);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Privacy banner */}
      <div
        className="flex items-start gap-3 p-4 rounded-2xl border"
        style={{
          backgroundColor: 'rgba(99, 102, 241, 0.05)',
          borderColor: 'rgba(99, 102, 241, 0.2)',
        }}
      >
        <ShieldCheck size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
            Your privacy is protected
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
            Your name, email, and phone are hidden from caterers until you choose a quote. Only your delivery city is shared.
          </p>
        </div>
      </div>

      {/* Section 1: Event Details */}
      <section
        className="rounded-2xl p-5 border"
        style={{
          backgroundColor: 'var(--aurora-surface, #fff)',
          borderColor: 'var(--aurora-border)',
        }}
      >
        <h2 className="text-base font-bold mb-4" style={{ color: 'var(--aurora-text)' }}>
          Event Details
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="rfp-delivery-address" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
              Delivery Address <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <AddressAutocomplete
              id="rfp-delivery-address"
              value={rfpForm.deliveryAddress?.formattedAddress || rfpForm.deliveryCity || ''}
              onChange={(val) => {
                // User is typing freely — clear structured address (will be re-set on selection)
                // Keep deliveryCity in sync as fallback for manual entry
                onUpdateForm({ deliveryCity: val, deliveryAddress: null });
              }}
              onSelect={(addr: AddressResult) => {
                // Store full structured address + extract city for vendor-facing field
                onUpdateForm({
                  deliveryCity: addr.city,
                  deliveryAddress: {
                    street: addr.street,
                    city: addr.city,
                    state: addr.state,
                    zip: addr.zip,
                    lat: addr.lat,
                    lng: addr.lng,
                    formattedAddress: addr.formattedAddress || `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`,
                  },
                });
              }}
              onBlur={() => handleBlur('deliveryCity')}
              placeholder="Start typing your delivery address..."
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${
                showCityError
                  ? 'border-red-400 focus:ring-2 focus:ring-red-300 focus:border-red-500'
                  : 'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500'
              }`}
              aria-required={true}
              aria-invalid={!!showCityError}
              aria-describedby={showCityError ? 'rfp-delivery-city-error' : undefined}
            />
            {showCityError && (
              <p id="rfp-delivery-city-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                <AlertCircle size={12} /> {cityError}
              </p>
            )}
            {/* Privacy note: only city is shared with vendors */}
            {rfpForm.deliveryAddress && (
              <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--aurora-text-muted)' }}>
                <ShieldCheck size={11} />
                Only "{rfpForm.deliveryAddress.city}" will be shared with caterers — your full address stays private until you accept a quote.
              </p>
            )}
          </div>

          {/* Leaflet map preview — shown after address selection */}
          {rfpForm.deliveryAddress?.lat && rfpForm.deliveryAddress?.lng && (
            <RfpMapPreview
              lat={rfpForm.deliveryAddress.lat}
              lng={rfpForm.deliveryAddress.lng}
              label={rfpForm.deliveryAddress.formattedAddress || rfpForm.deliveryCity}
            />
          )}

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
              Event Type
            </label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((et) => {
                const isSelected = rfpForm.eventType === et.value;
                return (
                  <button
                    key={et.value}
                    type="button"
                    onClick={() => onUpdateForm({ eventType: isSelected ? '' : et.value })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                    style={{
                      backgroundColor: isSelected ? '#6366F1' : 'var(--aurora-bg)',
                      color: isSelected ? '#fff' : 'var(--aurora-text-secondary)',
                      borderColor: isSelected ? '#6366F1' : 'var(--aurora-border)',
                    }}
                  >
                    <span>{et.emoji}</span>
                    {et.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="rfp-event-date" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
                Event Date <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="rfp-event-date"
                type="date"
                min={tomorrow}
                value={rfpForm.eventDate}
                onChange={(e) => onUpdateForm({ eventDate: e.target.value })}
                onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
                onBlur={() => handleBlur('eventDate')}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${
                  showDateError
                    ? 'border-red-400 focus:ring-2 focus:ring-red-300 focus:border-red-500'
                    : 'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500'
                }`}
                aria-required={true}
                aria-invalid={!!showDateError}
                aria-describedby={showDateError ? 'rfp-event-date-error' : undefined}
                style={{
                  backgroundColor: 'var(--aurora-bg)',
                  borderColor: showDateError ? undefined : 'var(--aurora-border)',
                  color: 'var(--aurora-text)',
                  appearance: 'auto',
                } as React.CSSProperties}
              />
              {showDateError && (
                <p id="rfp-event-date-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                  <AlertCircle size={12} /> {dateError}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="rfp-headcount" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
                Headcount <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="rfp-headcount"
                type="number"
                min="1"
                value={rfpForm.headcount || ''}
                onChange={(e) => onUpdateForm({ headcount: parseInt(e.target.value) || 0 })}
                onBlur={() => handleBlur('headcount')}
                placeholder="e.g. 50"
                className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${
                  showHeadcountError
                    ? 'border-red-400 focus:ring-2 focus:ring-red-300 focus:border-red-500'
                    : 'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500'
                }`}
                aria-required={true}
                aria-invalid={!!showHeadcountError}
                aria-describedby={showHeadcountError ? 'rfp-headcount-error' : undefined}
                style={{
                  backgroundColor: 'var(--aurora-bg)',
                  borderColor: showHeadcountError ? undefined : 'var(--aurora-border)',
                  color: 'var(--aurora-text)',
                }}
              />
              {showHeadcountError && (
                <p id="rfp-headcount-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                  <AlertCircle size={12} /> {headcountError}
                </p>
              )}
            </div>
          </div>

          {/* Event Time — required, matches Order Placement module */}
          <div>
            <label htmlFor="rfp-event-time" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
              Event Time <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="rfp-event-time"
              type="time"
              value={rfpForm.eventTime || ''}
              onChange={(e) => onUpdateForm({ eventTime: e.target.value })}
              onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
              onBlur={() => handleBlur('eventTime')}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${
                showTimeError
                  ? 'border-red-400 focus:ring-2 focus:ring-red-300 focus:border-red-500'
                  : 'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500'
              }`}
              aria-required={true}
              aria-invalid={!!showTimeError}
              aria-describedby={showTimeError ? 'rfp-event-time-error' : undefined}
              style={{
                backgroundColor: 'var(--aurora-bg)',
                borderColor: showTimeError ? undefined : 'var(--aurora-border)',
                color: 'var(--aurora-text)',
                appearance: 'auto',
              } as React.CSSProperties}
            />
            {showTimeError && (
              <p id="rfp-event-time-error" className="flex items-center gap-1 mt-1 text-xs text-red-500" role="alert">
                <AlertCircle size={12} /> {timeError}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Price Guidance Banner ── */}
      {rfpForm.headcount > 0 && (
        <PriceGuidanceBanner cuisineCategory={cuisineCategory || selectedCuisine || ''} headcount={rfpForm.headcount} />
      )}

      {/* Section 2: Menu Items Wanted */}
      <section
        className="rounded-2xl p-5 border"
        style={{
          backgroundColor: 'var(--aurora-surface, #fff)',
          borderColor: 'var(--aurora-border)',
        }}
      >
        <h2 className="text-base font-bold mb-2" style={{ color: 'var(--aurora-text)' }}>
          What do you need? <span className="text-red-500" aria-hidden="true">*</span>
        </h2>
        {showItemsError && (
          <p className="flex items-center gap-1 mb-3 text-xs text-red-500" role="alert">
            <AlertCircle size={12} /> {itemsError}
          </p>
        )}

        {/* Cuisine Type Picker */}
        <div className="space-y-3 mb-4">
          <label className="block text-sm font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
            Select a cuisine type to browse items
          </label>

          {/* Cuisine dropdown */}
          <div ref={cuisineRef} className="relative">
            <button
              type="button"
              onClick={() => setCuisineDropdownOpen(!cuisineDropdownOpen)}
              className="w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors"
              style={{
                backgroundColor: 'var(--aurora-bg)',
                borderColor: cuisineDropdownOpen ? '#6366F1' : 'var(--aurora-border)',
                color: selectedCuisine ? 'var(--aurora-text)' : 'var(--aurora-text-muted)',
              }}
            >
              <span>
                {selectedCuisine
                  ? `${CUISINE_CATEGORIES[selectedCuisine].emoji} ${CUISINE_CATEGORIES[selectedCuisine].label}`
                  : 'Choose a cuisine type...'}
              </span>
              <ChevronDown
                size={16}
                className="transition-transform"
                style={{ transform: cuisineDropdownOpen ? 'rotate(180deg)' : 'none' }}
              />
            </button>

            {cuisineDropdownOpen && (
              <div
                className="absolute z-20 w-full mt-1 rounded-xl border shadow-lg overflow-hidden"
                style={{
                  backgroundColor: 'var(--aurora-surface, #fff)',
                  borderColor: 'var(--aurora-border)',
                }}
              >
                <div className="max-h-64 overflow-y-auto py-1">
                  {CUISINE_CATEGORY_KEYS.map((key) => {
                    const cat = CUISINE_CATEGORIES[key];
                    const isSelected = selectedCuisine === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedCuisine(key);
                          setCuisineDropdownOpen(false);
                          setItemPickerOpen(true);
                          setItemSearchQuery('');
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors"
                        style={{
                          backgroundColor: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
                          color: 'var(--aurora-text)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isSelected ? 'rgba(99,102,241,0.08)' : 'var(--aurora-bg)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? 'rgba(99,102,241,0.08)' : 'transparent')}
                      >
                        <span className="text-base">{cat.emoji}</span>
                        <span className="font-medium">{cat.label}</span>
                        <span className="text-xs ml-auto" style={{ color: 'var(--aurora-text-muted)' }}>
                          {cat.items.length} items
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Item multi-select picker — shown when cuisine is selected */}
          {selectedCuisine && (
            <div ref={itemPickerRef} className="relative">
              <button
                type="button"
                onClick={() => setItemPickerOpen(!itemPickerOpen)}
                className="w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--aurora-bg)',
                  borderColor: itemPickerOpen ? '#6366F1' : 'var(--aurora-border)',
                  color: 'var(--aurora-text)',
                }}
              >
                <span style={{ color: 'var(--aurora-text-secondary)' }}>
                  Select items from {CUISINE_CATEGORIES[selectedCuisine].label}...
                </span>
                <ChevronDown
                  size={16}
                  className="transition-transform"
                  style={{ transform: itemPickerOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>

              {itemPickerOpen && (
                <div
                  className="absolute z-10 w-full mt-1 rounded-xl border shadow-lg overflow-hidden"
                  style={{
                    backgroundColor: 'var(--aurora-surface, #fff)',
                    borderColor: 'var(--aurora-border)',
                  }}
                >
                  {/* Search within items */}
                  <div className="px-3 pt-3 pb-2">
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--aurora-text-muted)' }}
                      />
                      <input
                        type="text"
                        value={itemSearchQuery}
                        onChange={(e) => setItemSearchQuery(e.target.value)}
                        placeholder="Search items..."
                        className="w-full pl-8 pr-8 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                        style={{
                          backgroundColor: 'var(--aurora-bg)',
                          borderColor: 'var(--aurora-border)',
                          color: 'var(--aurora-text)',
                        }}
                      />
                      {itemSearchQuery && (
                        <button
                          onClick={() => setItemSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded"
                        >
                          <X size={14} style={{ color: 'var(--aurora-text-muted)' }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Item list with checkboxes */}
                  <div className="max-h-64 overflow-y-auto px-1 pb-2">
                    {filteredCuisineItems.length === 0 ? (
                      <p className="text-sm text-center py-4" style={{ color: 'var(--aurora-text-muted)' }}>
                        No items found
                      </p>
                    ) : (
                      filteredCuisineItems.map((foodItem) => {
                        const added = isItemAdded(foodItem.name);
                        return (
                          <button
                            key={foodItem.name}
                            onClick={() => handleTogglePresetItem(foodItem)}
                            className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg mx-1 transition-colors"
                            style={{
                              backgroundColor: added ? 'rgba(99,102,241,0.06)' : 'transparent',
                              width: 'calc(100% - 0.5rem)',
                            }}
                            onMouseEnter={(e) => {
                              if (!added) e.currentTarget.style.backgroundColor = 'var(--aurora-bg)';
                            }}
                            onMouseLeave={(e) => {
                              if (!added) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {/* Checkbox */}
                            <div
                              className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0"
                              style={{
                                borderColor: added ? '#6366F1' : 'var(--aurora-border)',
                                backgroundColor: added ? '#6366F1' : 'transparent',
                              }}
                            >
                              {added && <Check size={12} className="text-white" />}
                            </div>

                            {/* Item details */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--aurora-text)' }}>
                                {foodItem.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: 'var(--aurora-bg)',
                                    color: 'var(--aurora-text-muted)',
                                  }}
                                >
                                  {foodItem.pricingType.replace('_', ' ')}
                                </span>
                                {foodItem.dietaryTags && foodItem.dietaryTags.length > 0 && (
                                  <span className="text-xs" style={{ color: '#059669' }}>
                                    {foodItem.dietaryTags.map((t) => t.replace('_', ' ')).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Footer with count */}
                  {filteredCuisineItems.length > 0 && (
                    <div
                      className="px-4 py-3 border-t text-xs font-medium flex items-center justify-between"
                      style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
                    >
                      <span>
                        {rfpForm.items.length} item{rfpForm.items.length !== 1 ? 's' : ''} selected
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setItemPickerOpen(false); }}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ backgroundColor: '#6366F1', color: '#fff' }}
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected items list */}
        {rfpForm.items.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--aurora-text-muted)' }}>
              Selected Items ({rfpForm.items.length})
            </p>
            {rfpForm.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-xl border"
                style={{
                  backgroundColor: 'var(--aurora-bg)',
                  borderColor: 'var(--aurora-border)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
                      {item.name}
                    </p>
                    {item.qty === 1 && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        Qty is 1 — adjust if needed
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                    {item.pricingType.replace('_', ' ')}
                    {item.dietaryTags && item.dietaryTags.length > 0 && ` · ${item.dietaryTags.join(', ')}`}
                  </p>
                </div>
                {/* Qty control */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const newQty = Math.max(1, item.qty - 1);
                      onUpdateItem(idx, { ...item, qty: newQty });
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold border transition-colors"
                    style={{
                      borderColor: 'var(--aurora-border)',
                      color: 'var(--aurora-text-secondary)',
                      backgroundColor: 'var(--aurora-surface)',
                    }}
                  >
                    −
                  </button>
                  <span
                    className="w-8 text-center text-sm font-semibold"
                    style={{ color: 'var(--aurora-text)' }}
                  >
                    {item.qty}
                  </span>
                  <button
                    onClick={() => {
                      onUpdateItem(idx, { ...item, qty: item.qty + 1 });
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold border transition-colors"
                    style={{
                      borderColor: 'var(--aurora-border)',
                      color: 'var(--aurora-text-secondary)',
                      backgroundColor: 'var(--aurora-surface)',
                    }}
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => onRemoveItem(idx)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toggle for manual custom item */}
        <div className="pt-2 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
          <button
            onClick={() => setShowManualAdd(!showManualAdd)}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: '#6366F1' }}
          >
            <Plus size={16} />
            {showManualAdd ? 'Hide custom item form' : 'Add a custom item'}
          </button>

          {showManualAdd && (
            <div
              className="mt-3 p-4 rounded-xl border-2 border-dashed space-y-3"
              style={{ borderColor: 'var(--aurora-border)' }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Item name (e.g. Butter Chicken Tray)"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                  style={{
                    backgroundColor: 'var(--aurora-surface)',
                    borderColor: 'var(--aurora-border)',
                    color: 'var(--aurora-text)',
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
                />
                <input
                  type="number"
                  min="1"
                  value={newItem.qty}
                  onChange={(e) => setNewItem((p) => ({ ...p, qty: parseInt(e.target.value) || 1 }))}
                  className="w-16 rounded-lg border px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-indigo-500/30"
                  style={{
                    backgroundColor: 'var(--aurora-surface)',
                    borderColor: 'var(--aurora-border)',
                    color: 'var(--aurora-text)',
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>Pricing:</label>
                {PRICING_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    onClick={() => setNewItem((p) => ({ ...p, pricingType: pt.value }))}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: newItem.pricingType === pt.value ? '#6366F1' : 'var(--aurora-bg)',
                      color: newItem.pricingType === pt.value ? '#fff' : 'var(--aurora-text-secondary)',
                      border: `1px solid ${newItem.pricingType === pt.value ? '#6366F1' : 'var(--aurora-border)'}`,
                    }}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DIETARY_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleNewItemDietary(tag)}
                    className="px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: newItem.dietaryTags?.includes(tag) ? '#10B98120' : 'var(--aurora-bg)',
                      color: newItem.dietaryTags?.includes(tag) ? '#059669' : 'var(--aurora-text-secondary)',
                      border: `1px solid ${newItem.dietaryTags?.includes(tag) ? '#10B981' : 'var(--aurora-border)'}`,
                    }}
                  >
                    {tag.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <button
                onClick={handleAddItem}
                disabled={!newItem.name.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                style={{
                  backgroundColor: '#6366F115',
                  color: '#6366F1',
                }}
              >
                <Plus size={16} /> Add Item
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Order For Context */}
      <section
        className="rounded-2xl p-5 border"
        style={{
          backgroundColor: 'var(--aurora-surface, #fff)',
          borderColor: 'var(--aurora-border)',
        }}
      >
        <h2 className="text-base font-bold mb-4" style={{ color: 'var(--aurora-text)' }}>
          Who is this for?
        </h2>
        <OrderForSelector
          value={rfpForm.orderForContext}
          onChange={(ctx) => onUpdateForm({ orderForContext: ctx })}
        />
      </section>

      {/* Section 4: Special Instructions */}
      <section
        className="rounded-2xl p-5 border"
        style={{
          backgroundColor: 'var(--aurora-surface, #fff)',
          borderColor: 'var(--aurora-border)',
        }}
      >
        <h2 className="text-base font-bold mb-4" style={{ color: 'var(--aurora-text)' }}>
          Special Instructions
        </h2>
        <textarea
          value={rfpForm.specialInstructions}
          onChange={(e) => onUpdateForm({ specialInstructions: e.target.value })}
          placeholder="Any special requests, allergies, setup needs..."
          rows={3}
          className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors resize-none focus:ring-2 focus:ring-indigo-500/30"
          style={{
            backgroundColor: 'var(--aurora-bg)',
            borderColor: 'var(--aurora-border)',
            color: 'var(--aurora-text)',
          }}
        />
      </section>

      {/* Qty warning dialog */}
      {showQtyWarning && (
        <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800 font-medium">
            {rfpForm.items.filter(i => i.qty === 1).length} item(s) still have quantity set to 1. Are you sure?
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                setConfirmedDefaultQty(true);
                setShowQtyWarning(false);
                handleSubmitWithQtyCheck();
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white font-medium transition-colors hover:bg-amber-700"
            >
              Yes, submit as-is
            </button>
            <button
              onClick={() => setShowQtyWarning(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 font-medium transition-colors hover:bg-amber-50"
            >
              Go back and adjust
            </button>
          </div>
        </div>
      )}

      {/* Validation summary on submit attempt */}
      {submitAttempted && allErrors.length > 0 && (
        <div
          className="border border-red-200 rounded-2xl p-4 flex items-start gap-3"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
          role="alert"
          aria-live="polite"
        >
          <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Please fix the following before submitting:</p>
            <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
              {allErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Vendor targeting info — shows reachable count when address is set */}
      <div
        className="flex items-start gap-2 p-3 rounded-xl text-xs"
        style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', color: 'var(--aurora-text-secondary)' }}
      >
        <Store size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#6366F1' }} />
        <span>
          {reachableVendorCount !== null ? (
            reachableVendorCount > 0 ? (
              <>
                <strong>{reachableVendorCount} {cuisineCategory || ''} caterer{reachableVendorCount !== 1 ? 's' : ''}</strong> can deliver to your area.
                {' '}Your request will be sent to them.
                {' '}Vendor identities remain private until they respond with quotes.
              </>
            ) : (
              <>
                No {cuisineCategory || ''} caterers currently cover your delivery area.
                {' '}Your request will still be posted — caterers may expand their coverage.
              </>
            )
          ) : (
            <>
              Your request will be sent to <strong>all {cuisineCategory || ''} caterers</strong> on the platform.
              {' '}Vendor identities remain private until they respond with quotes.
              {' '}You can then compare and choose the best option.
            </>
          )}
        </span>
      </div>

      {/* ── Phase 3: Confirmation Modal ── */}
      {showConfirmModal && (
        <RfpConfirmationModal
          rfpForm={rfpForm}
          eventTypeLabel={eventTypeLabel ? `${eventTypeLabel.emoji} ${eventTypeLabel.label}` : rfpForm.eventType || 'Not specified'}
          cuisineCategory={cuisineCategory}
          reachableVendorCount={reachableVendorCount}
          loading={loading}
          onConfirm={handleConfirmSubmit}
          onClose={() => setShowConfirmModal(false)}
        />
      )}

      {/* Footer Actions */}
      <div
        className="flex gap-3 sticky bottom-0 py-4 -mx-4 px-4 border-t"
        style={{
          backgroundColor: 'var(--aurora-bg)',
          borderColor: 'var(--aurora-border)',
        }}
      >
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 px-6 py-3 border font-medium rounded-xl text-sm transition-colors disabled:opacity-50"
          style={{
            borderColor: 'var(--aurora-border)',
            color: 'var(--aurora-text-secondary)',
          }}
        >
          Back
        </button>
        <button
          onClick={handleSubmitWithQtyCheck}
          disabled={loading}
          className="flex-1 px-6 py-3 text-white font-medium rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: '#6366F1' }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
          Request Quotes
        </button>
      </div>
    </div>
  );
}

// ── Price Guidance Banner Component ──
function PriceGuidanceBanner({ cuisineCategory, headcount }: { cuisineCategory: string; headcount: number }) {
  const [dismissed, setDismissed] = useState(false);
  const guidance = PRICE_GUIDANCE[cuisineCategory] || PRICE_GUIDANCE.default;
  const lowEst = guidance.perPerson[0] * headcount;
  const highEst = guidance.perPerson[1] * headcount;

  if (dismissed) return null;

  return (
    <div
      className="relative rounded-2xl border p-4"
      style={{ borderColor: 'rgba(99,102,241,0.2)', backgroundColor: 'rgba(99,102,241,0.03)' }}
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <X size={12} style={{ color: 'var(--aurora-text-muted)' }} />
      </button>
      <div className="flex items-start gap-3">
        <TrendingUp size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
        <div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#6366F1' }}>
            Price Guidance
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--aurora-text-secondary)' }}>
            For <strong>{headcount} guests</strong>, expect quotes in the
            {' '}<strong>${lowEst.toLocaleString()} – ${highEst.toLocaleString()}</strong> range
            {' '}(${guidance.perPerson[0]}–${guidance.perPerson[1]} per person).
          </p>
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--aurora-text-muted)' }}>
            {guidance.note} · Trays typically serve {guidance.trayServes} people
          </p>
          <p className="text-[10px] mt-1 italic" style={{ color: 'var(--aurora-text-muted)' }}>
            Estimates based on market averages — actual quotes may vary by vendor.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Phase 3: RFP Confirmation Modal ──
// Shows a summary of the request before final submission with price guidance.

interface RfpConfirmationModalProps {
  rfpForm: {
    deliveryCity: string;
    deliveryAddress: DeliveryAddress | null;
    eventType: string;
    eventDate: string;
    eventTime?: string;
    headcount: number;
    specialInstructions: string;
    items: QuoteRequestItem[];
    orderForContext: OrderForContext;
    targetBusinessIds: string[];
  };
  eventTypeLabel: string;
  cuisineCategory: string;
  reachableVendorCount: number | null;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function RfpConfirmationModal({
  rfpForm,
  eventTypeLabel,
  cuisineCategory,
  reachableVendorCount,
  loading,
  onConfirm,
  onClose,
}: RfpConfirmationModalProps) {
  // ESC to close + body scroll lock (critical for iOS Safari)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);

    // Lock body scroll to prevent background scrolling (iOS Safari fix)
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      // Restore body scroll position
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  // Price guidance calculation
  const guidance = PRICE_GUIDANCE[cuisineCategory] || PRICE_GUIDANCE.default;
  const lowEst = guidance.perPerson[0] * rfpForm.headcount;
  const highEst = guidance.perPerson[1] * rfpForm.headcount;
  const priceBarMin = guidance.perPerson[0];
  const priceBarMax = guidance.perPerson[1];
  // Map range for visual bar (normalize to 0-100%)
  const globalMin = 10; // lowest possible per-person price
  const globalMax = 50; // highest possible per-person price
  const barLeft = Math.max(0, ((priceBarMin - globalMin) / (globalMax - globalMin)) * 100);
  const barWidth = Math.max(10, ((priceBarMax - priceBarMin) / (globalMax - globalMin)) * 100);

  // Format date for display
  const formattedDate = rfpForm.eventDate
    ? new Date(rfpForm.eventDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  // Format time for display
  const formattedTime = rfpForm.eventTime
    ? (() => {
        const [h, m] = rfpForm.eventTime.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
      })()
    : '';

  // Backdrop click/touch handler — works on both desktop and iOS
  const handleBackdropInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        /* iOS Safari: use dvh with vh fallback for correct viewport height */
        height: '100vh',
        // @ts-ignore — dvh is valid CSS but not in React's CSSProperties type
        ...(CSS.supports?.('height', '100dvh') ? { height: '100dvh' } : {}),
      }}
      onClick={handleBackdropInteraction}
      onTouchEnd={handleBackdropInteraction}
      role="dialog"
      aria-modal="true"
      aria-label="Review your quote request"
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--aurora-bg, #fff)',
          maxHeight: '90vh',
          /* Prevent iOS text size adjustment */
          WebkitTextSizeAdjust: '100%',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)' }}
        >
          <div className="flex items-center gap-2.5">
            <Eye size={20} style={{ color: 'rgba(255,255,255,0.9)' }} />
            <h2 className="text-lg font-bold text-white">Review Your Request</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Close"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Scrollable body — -webkit-overflow-scrolling for iOS momentum scroll */}
        <div
          className="px-6 py-5 space-y-4 overflow-y-auto"
          style={{
            maxHeight: 'calc(90vh - 140px)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Event details grid */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="flex items-start gap-2.5 p-3 rounded-xl"
              style={{ backgroundColor: 'var(--aurora-surface, #f8f9fa)' }}
            >
              <MapPin size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--aurora-text-muted)' }}>Delivery City</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                  {rfpForm.deliveryAddress?.city || rfpForm.deliveryCity || '—'}
                </p>
              </div>
            </div>

            <div
              className="flex items-start gap-2.5 p-3 rounded-xl"
              style={{ backgroundColor: 'var(--aurora-surface, #f8f9fa)' }}
            >
              <Calendar size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--aurora-text-muted)' }}>Event Date</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                  {formattedDate || '—'}
                </p>
              </div>
            </div>

            <div
              className="flex items-start gap-2.5 p-3 rounded-xl"
              style={{ backgroundColor: 'var(--aurora-surface, #f8f9fa)' }}
            >
              <Users size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--aurora-text-muted)' }}>Headcount</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                  {rfpForm.headcount > 0 ? `${rfpForm.headcount} guests` : '—'}
                </p>
              </div>
            </div>

            <div
              className="flex items-start gap-2.5 p-3 rounded-xl"
              style={{ backgroundColor: 'var(--aurora-surface, #f8f9fa)' }}
            >
              <Clock size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--aurora-text-muted)' }}>Event Time</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                  {formattedTime || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Event type */}
          {rfpForm.eventType && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
              style={{ backgroundColor: 'var(--aurora-surface, #f8f9fa)', color: 'var(--aurora-text)' }}
            >
              <span className="font-medium" style={{ color: 'var(--aurora-text-muted)' }}>Event:</span>
              <span className="font-semibold">{eventTypeLabel}</span>
            </div>
          )}

          {/* Items list */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UtensilsCrossed size={14} style={{ color: '#6366F1' }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--aurora-text-muted)' }}>
                Menu Items ({rfpForm.items.length})
              </p>
            </div>
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'var(--aurora-border)' }}
            >
              {rfpForm.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                  style={{
                    backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--aurora-surface, #f8f9fa)',
                    /* Border between items — skip first item (cross-browser safe vs divide-y) */
                    ...(idx > 0 ? { borderTop: '1px solid var(--aurora-border, #e5e7eb)' } : {}),
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--aurora-text)' }}>{item.name}</span>
                    {item.dietaryTags && item.dietaryTags.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366F1' }}>
                        {item.dietaryTags.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                    <span className="font-medium">Qty: {item.qty}</span>
                    <span className="capitalize">{item.pricingType.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Special instructions */}
          {rfpForm.specialInstructions.trim() && (
            <div
              className="px-3 py-2 rounded-xl text-sm"
              style={{ backgroundColor: 'rgba(251, 191, 36, 0.08)', color: 'var(--aurora-text-secondary)' }}
            >
              <span className="font-medium" style={{ color: 'var(--aurora-text-muted)' }}>Notes: </span>
              {rfpForm.specialInstructions}
            </div>
          )}

          {/* Price Guidance — visual bar */}
          {rfpForm.headcount > 0 && (
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'rgba(99,102,241,0.2)', backgroundColor: 'rgba(99,102,241,0.03)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} style={{ color: '#6366F1' }} />
                <p className="text-xs font-semibold" style={{ color: '#6366F1' }}>Estimated Price Range</p>
              </div>

              {/* Visual range bar */}
              <div className="mb-3">
                <div
                  className="relative h-2.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}
                >
                  <div
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: `${barLeft}%`,
                      width: `${barWidth}%`,
                      background: 'linear-gradient(90deg, #818CF8, #6366F1)',
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs font-bold" style={{ color: '#6366F1' }}>
                    ${lowEst.toLocaleString()}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                    ${guidance.perPerson[0]}–${guidance.perPerson[1]} per person
                  </span>
                  <span className="text-xs font-bold" style={{ color: '#6366F1' }}>
                    ${highEst.toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--aurora-text-muted)' }}>
                {guidance.note}. Trays typically serve {guidance.trayServes} people.
              </p>
              <p className="text-[10px] mt-1 italic" style={{ color: 'var(--aurora-text-muted)' }}>
                Estimates based on market averages — actual quotes may vary.
              </p>
            </div>
          )}

          {/* Vendor reach info */}
          <div
            className="flex items-start gap-2 p-3 rounded-xl text-xs"
            style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', color: 'var(--aurora-text-secondary)' }}
          >
            <Store size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#6366F1' }} />
            <span>
              {reachableVendorCount !== null && reachableVendorCount > 0 ? (
                <>Sending to <strong>{reachableVendorCount} caterer{reachableVendorCount !== 1 ? 's' : ''}</strong> in your area.</>
              ) : (
                <>Your request will be visible to all caterers on the platform.</>
              )}
              {' '}Only your delivery <strong>city</strong> is shared — full address stays private until you accept a quote.
            </span>
          </div>
        </div>

        {/* Footer buttons */}
        <div
          className="px-6 py-4 flex gap-3 border-t"
          style={{
            borderColor: 'var(--aurora-border)',
            /* Safe area inset for iOS notch/home indicator */
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border font-medium rounded-xl text-sm transition-colors disabled:opacity-50"
            style={{
              borderColor: 'var(--aurora-border)',
              color: 'var(--aurora-text-secondary)',
              WebkitTapHighlightColor: 'transparent',
              minHeight: '44px', /* iOS minimum tap target */
            }}
          >
            Go Back & Edit
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #6366F1, #818CF8)',
              WebkitTapHighlightColor: 'transparent',
              minHeight: '44px', /* iOS minimum tap target */
            }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
            Confirm & Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leaflet Map Preview for RFP delivery address ──
// Lightweight map showing the delivery pin. Customer-side only.

declare const L: any;

let _leafletReady = false;
let _leafletPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (_leafletReady && typeof L !== 'undefined') return Promise.resolve();
  if (_leafletPromise) return _leafletPromise;

  _leafletPromise = new Promise<void>((resolve, reject) => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
    if (typeof L !== 'undefined') { _leafletReady = true; resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => { _leafletReady = true; resolve(); };
    s.onerror = () => { _leafletPromise = null; reject(new Error('Leaflet load failed')); };
    document.head.appendChild(s);
  });
  return _leafletPromise;
}

function RfpMapPreview({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);

  React.useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(() => {
      if (cancelled || !containerRef.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: false, attributionControl: false,
          dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false,
        }).setView([lat, lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapRef.current);
      } else {
        mapRef.current.setView([lat, lng], 14);
      }
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const icon = L.divIcon({
          className: '',
          html: '<div style="font-size:24px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3))">📍</div>',
          iconSize: [24, 24], iconAnchor: [12, 24],
        });
        markerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current);
      }
    });
    return () => { cancelled = true; };
  }, [lat, lng]);

  React.useEffect(() => {
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
  }, []);

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: 'var(--aurora-border)' }}
    >
      <div ref={containerRef} className="h-32 w-full" />
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ background: 'var(--aurora-surface-alt, var(--aurora-bg))' }}
      >
        <span className="text-[10px]" style={{ color: 'var(--aurora-text-tertiary, var(--aurora-text-muted))' }}>
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
        <span className="text-[10px] font-medium truncate ml-2" style={{ color: 'var(--aurora-text-secondary)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}
