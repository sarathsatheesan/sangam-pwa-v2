import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Loader2, Send, ShieldCheck, ChevronDown, Search, X, Check } from 'lucide-react';
import type { QuoteRequestItem, OrderForContext } from '@/services/cateringService';
import { CUISINE_CATEGORIES, CUISINE_CATEGORY_KEYS } from '@/constants/cateringFoodItems';
import type { CuisineFoodItem } from '@/constants/cateringFoodItems';
import OrderForSelector from './OrderForSelector';

interface RequestForPriceFormProps {
  rfpForm: {
    deliveryCity: string;
    eventType: string;
    eventDate: string;
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

  const canSubmit = rfpForm.deliveryCity.trim() && rfpForm.eventDate && rfpForm.headcount > 0 && rfpForm.items.length > 0;

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
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
              Delivery City *
            </label>
            <input
              type="text"
              value={rfpForm.deliveryCity}
              onChange={(e) => onUpdateForm({ deliveryCity: e.target.value })}
              placeholder="e.g. Toronto, San Francisco"
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              style={{
                backgroundColor: 'var(--aurora-bg)',
                borderColor: 'var(--aurora-border)',
                color: 'var(--aurora-text)',
              }}
            />
          </div>

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
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
                Event Date *
              </label>
              <input
                type="date"
                value={rfpForm.eventDate}
                onChange={(e) => onUpdateForm({ eventDate: e.target.value })}
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                style={{
                  backgroundColor: 'var(--aurora-bg)',
                  borderColor: 'var(--aurora-border)',
                  color: 'var(--aurora-text)',
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
                Headcount *
              </label>
              <input
                type="number"
                min="1"
                value={rfpForm.headcount || ''}
                onChange={(e) => onUpdateForm({ headcount: parseInt(e.target.value) || 0 })}
                placeholder="e.g. 50"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                style={{
                  backgroundColor: 'var(--aurora-bg)',
                  borderColor: 'var(--aurora-border)',
                  color: 'var(--aurora-text)',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Menu Items Wanted */}
      <section
        className="rounded-2xl p-5 border"
        style={{
          backgroundColor: 'var(--aurora-surface, #fff)',
          borderColor: 'var(--aurora-border)',
        }}
      >
        <h2 className="text-base font-bold mb-4" style={{ color: 'var(--aurora-text)' }}>
          What do you need? *
        </h2>

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
                  <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
                    {item.name}
                  </p>
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

      {/* Section 5: Target specific caterers (optional)
       * COMMENTED OUT — We don't want to reveal caterer names until responses come back.
       * Keeping the code for potential repurposing later.
       *
      {businesses.length > 0 && (
        <section
          className="rounded-2xl p-5 border"
          style={{
            backgroundColor: 'var(--aurora-surface, #fff)',
            borderColor: 'var(--aurora-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold" style={{ color: 'var(--aurora-text)' }}>
              Target Caterers
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--aurora-bg)', color: 'var(--aurora-text-secondary)' }}>Optional</span>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--aurora-text-secondary)' }}>
            Leave empty to broadcast to all {cuisineCategory} caterers, or select specific ones.
          </p>
          <div className="space-y-2">
            {businesses.map((biz: any) => {
              const selected = rfpForm.targetBusinessIds.includes(biz.id);
              return (
                <button
                  key={biz.id}
                  onClick={() => {
                    const next = selected
                      ? rfpForm.targetBusinessIds.filter((id) => id !== biz.id)
                      : [...rfpForm.targetBusinessIds, biz.id];
                    onUpdateForm({ targetBusinessIds: next });
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors"
                  style={{
                    backgroundColor: selected ? 'rgba(99,102,241,0.06)' : 'var(--aurora-bg)',
                    borderColor: selected ? '#6366F1' : 'var(--aurora-border)',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: selected ? '#6366F1' : 'var(--aurora-border)',
                      backgroundColor: selected ? '#6366F1' : 'transparent',
                    }}
                  >
                    {selected && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>{biz.name}</p>
                    {biz.heritage && <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>{biz.heritage}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
      */}

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
          onClick={onSubmit}
          disabled={loading || !canSubmit}
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
