// ═════════════════════════════════════════════════════════════════════════════════
// STEP 1 — IDENTITY
// Business name, category, email, phone, country (US / Canada)
// ═════════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { CATEGORIES } from '../businessConstants';
import type { BusinessFormData } from '../../../reducers/businessReducer';
import { CUISINE_CATEGORIES, CUISINE_CATEGORY_KEYS } from '@/constants/cateringFoodItems';

// ── Shared types for step components ──

export interface StepProps {
  formData: Partial<BusinessFormData>;
  updateField: <K extends keyof BusinessFormData>(field: K, value: BusinessFormData[K]) => void;
  errors: Record<string, string>;
  country: 'US' | 'CA';
}

// ── Reusable form field wrapper ──

export const FormField: React.FC<{
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, error, required, children }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--aurora-text-primary)' }}>
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && (
      <p className="mt-1 text-xs text-red-500" role="alert">{error}</p>
    )}
  </div>
);

// ── Input style helper ──

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  background: 'var(--aurora-surface)',
  border: `1.5px solid ${hasError ? '#ef4444' : 'var(--aurora-border)'}`,
  color: 'var(--aurora-text-primary)',
  borderRadius: '0.75rem',
});

// ── Component ──

const StepIdentity: React.FC<StepProps> = ({ formData, updateField, errors }) => {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
          Business Identity
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
          Tell us about your business. All fields marked with * are required.
        </p>
      </div>

      {/* Business Name */}
      <FormField label="Business Name" error={errors.name} required>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="e.g., Spice Garden Restaurant"
          className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40"
          style={inputStyle(!!errors.name)}
          maxLength={100}
          autoFocus
        />
      </FormField>

      {/* Category */}
      <FormField label="Category" error={errors.category} required>
        <select
          value={formData.category || ''}
          onChange={(e) => updateField('category', e.target.value)}
          className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40 appearance-none"
          style={inputStyle(!!errors.category)}
        >
          <option value="">Select a category...</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </FormField>

      {/* Country */}
      <FormField label="Country" error={errors.country} required>
        <div className="flex gap-3">
          {[
            { value: 'US' as const, label: 'United States', flag: '🇺🇸' },
            { value: 'CA' as const, label: 'Canada', flag: '🇨🇦' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateField('country', opt.value)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: formData.country === opt.value
                  ? 'var(--aurora-accent)'
                  : 'var(--aurora-surface)',
                color: formData.country === opt.value
                  ? 'white'
                  : 'var(--aurora-text-primary)',
                border: `1.5px solid ${
                  formData.country === opt.value
                    ? 'var(--aurora-accent)'
                    : errors.country
                      ? '#ef4444'
                      : 'var(--aurora-border)'
                }`,
              }}
            >
              <span className="text-lg">{opt.flag}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </FormField>

      {/* Email */}
      <FormField label="Business Email" error={errors.email} required>
        <input
          type="email"
          value={formData.email || ''}
          onChange={(e) => updateField('email', e.target.value)}
          placeholder="hello@yourbusiness.com"
          className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40"
          style={inputStyle(!!errors.email)}
        />
      </FormField>

      {/* Phone */}
      <FormField label="Phone Number" error={errors.phone} required>
        <input
          type="tel"
          value={formData.phone || ''}
          onChange={(e) => updateField('phone', e.target.value)}
          placeholder={formData.country === 'CA' ? '+1 (416) 555-1234' : '+1 (555) 123-4567'}
          className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40"
          style={inputStyle(!!errors.phone)}
        />
      </FormField>

      {/* Description (optional) */}
      <FormField label="Short Description">
        <textarea
          value={formData.desc || ''}
          onChange={(e) => updateField('desc', e.target.value)}
          placeholder="Briefly describe what your business does..."
          className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40 resize-none"
          style={inputStyle(false)}
          rows={3}
          maxLength={300}
        />
        <p className="text-right text-[10px] mt-0.5" style={{ color: 'var(--aurora-text-tertiary)' }}>
          {(formData.desc || '').length}/300
        </p>
      </FormField>

      {/* Maximum Service Radius */}
      <FormField label="Maximum Service Radius (Miles)" error={errors.serviceRadius} required>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            step={1}
            value={formData.serviceRadius ?? 25}
            onChange={(e) => {
              const val = e.target.value === '' ? ('' as const) : parseInt(e.target.value, 10) || 0;
              updateField('serviceRadius', val);
            }}
            placeholder="25"
            className="w-full px-3 py-2.5 pr-14 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40"
            style={{ ...inputStyle(!!errors.serviceRadius), appearance: 'auto' } as React.CSSProperties}
            aria-required={true}
            aria-describedby="service-radius-hint"
          />
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none"
            style={{ color: 'var(--aurora-text-tertiary)' }}
            aria-hidden="true"
          >
            miles
          </span>
        </div>
        <p id="service-radius-hint" className="text-[10px] mt-1" style={{ color: 'var(--aurora-text-tertiary)' }}>
          How far will you travel or deliver? (1–100 miles)
        </p>
      </FormField>

      {/* Cuisine Types — only show for food-related categories */}
      {(formData.category === 'Restaurant & Food' || formData.category === 'Restaurant & Food Catering') && (
        <FormField label="Cuisine Types Served" error="">
          <p className="text-[10px] mb-2" style={{ color: 'var(--aurora-text-tertiary)' }}>
            Select the cuisines your business offers for catering
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CUISINE_CATEGORY_KEYS.map((key) => {
              const cat = CUISINE_CATEGORIES[key];
              const currentCuisines = (formData.cuisineTypes || []) as string[];
              const isSelected = currentCuisines.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const updated = isSelected
                      ? currentCuisines.filter((k) => k !== key)
                      : [...currentCuisines, key];
                    updateField('cuisineTypes', updated);
                  }}
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-[var(--aurora-border)] hover:border-indigo-400/40'
                  }`}
                  style={isSelected ? {} : {
                    background: 'var(--aurora-surface)',
                    color: 'var(--aurora-text-secondary)',
                  }}
                >
                  {cat.emoji} {cat.label}
                </button>
              );
            })}
          </div>
          {((formData.cuisineTypes || []) as string[]).length > 0 && (
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--aurora-text-tertiary)' }}>
              {((formData.cuisineTypes || []) as string[]).length} cuisine{((formData.cuisineTypes || []) as string[]).length !== 1 ? 's' : ''} selected
            </p>
          )}
        </FormField>
      )}
    </div>
  );
};

export default StepIdentity;
