// ═════════════════════════════════════════════════════════════════════════════════
// STEP 4 — DETAILS & PHOTOS
// Business hours, website, description, menu/services, photos upload.
// All fields optional — users can always come back to fill these later.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef } from 'react';
import type { BusinessFormData } from '../../../reducers/businessReducer';
import { FormField } from './StepIdentity';
import type { StepProps } from './StepIdentity';

// ── Input style helper ──

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  background: 'var(--aurora-surface)',
  border: `1.5px solid ${hasError ? '#ef4444' : 'var(--aurora-border)'}`,
  color: 'var(--aurora-text-primary)',
  borderRadius: '0.75rem',
  appearance: 'auto',
});

// ── Day-of-week hours helper ──

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

function parseHours(hoursStr: string): Record<string, DayHours> {
  const defaults: Record<string, DayHours> = {};
  for (const day of DAYS) {
    defaults[day] = { open: '09:00', close: '17:00', closed: false };
  }
  if (!hoursStr) return defaults;
  try {
    return JSON.parse(hoursStr);
  } catch {
    return defaults;
  }
}

function serializeHours(hours: Record<string, DayHours>): string {
  return JSON.stringify(hours);
}

// ── Photo upload sub-component ──

interface PhotoUploadProps {
  photos: string[];
  onAdd: (dataUrl: string) => void;
  onRemove: (index: number) => void;
  onSetCover: (index: number) => void;
  coverIndex: number;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ photos, onAdd, onRemove, onSetCover, coverIndex }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) continue; // skip >5MB
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') onAdd(reader.result);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (inputRef.current) inputRef.current.value = '';
  }, [onAdd]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {photos.map((photo, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border" style={{ borderColor: i === coverIndex ? 'var(--aurora-accent)' : 'var(--aurora-border)' }}>
            <img src={photo} alt={`Business photo ${i + 1}`} className="w-full h-full object-cover" />
            {/* Cover badge */}
            {i === coverIndex && (
              <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: 'var(--aurora-accent)' }}>
                Cover
              </div>
            )}
            {/* Actions overlay */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 hover:opacity-100">
              {i !== coverIndex && (
                <button
                  type="button"
                  onClick={() => onSetCover(i)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold text-white bg-black/60"
                >
                  Set Cover
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold text-white bg-red-500/80"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {/* Add photo button */}
        {photos.length < 10 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors hover:border-indigo-400"
            style={{ borderColor: 'var(--aurora-border)' }}
          >
            <span className="text-2xl mb-0.5">📷</span>
            <span className="text-[10px] font-medium" style={{ color: 'var(--aurora-text-tertiary)' }}>
              Add Photo
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <p className="text-[10px]" style={{ color: 'var(--aurora-text-tertiary)' }}>
        {photos.length}/10 photos — JPG, PNG, or WebP — max 5 MB each
      </p>
    </div>
  );
};

// ── Price range options ──

const PRICE_RANGES = [
  { value: '$', label: '$', desc: 'Budget-friendly' },
  { value: '$$', label: '$$', desc: 'Moderate' },
  { value: '$$$', label: '$$$', desc: 'Upscale' },
  { value: '$$$$', label: '$$$$', desc: 'Fine dining / Premium' },
];

// ── Main Component ──

interface StepDetailsProps extends StepProps {
  formPhotos: string[];
  setFormPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  coverPhotoIndex: number;
  setCoverPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
}

const StepDetails: React.FC<StepDetailsProps> = ({
  formData,
  updateField,
  errors,
  formPhotos,
  setFormPhotos,
  coverPhotoIndex,
  setCoverPhotoIndex,
}) => {
  const [hours, setHours] = useState<Record<string, DayHours>>(() => parseHours(formData.hours || ''));
  const [showHoursEditor, setShowHoursEditor] = useState(false);

  // Sync hours back to formData
  const updateHours = useCallback((day: string, field: keyof DayHours, value: string | boolean) => {
    setHours((prev) => {
      const updated = { ...prev, [day]: { ...prev[day], [field]: value } };
      updateField('hours', serializeHours(updated));
      return updated;
    });
  }, [updateField]);

  const handleAddPhoto = useCallback((dataUrl: string) => {
    setFormPhotos((prev) => [...prev, dataUrl]);
  }, [setFormPhotos]);

  const handleRemovePhoto = useCallback((index: number) => {
    setFormPhotos((prev) => prev.filter((_, i) => i !== index));
    if (coverPhotoIndex >= index && coverPhotoIndex > 0) {
      setCoverPhotoIndex((prev) => prev - 1);
    }
  }, [setFormPhotos, coverPhotoIndex, setCoverPhotoIndex]);

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
          Details & Photos
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
          Add details to make your listing stand out. All fields are optional — you can update them later.
        </p>
      </div>

      {/* ── Photos ── */}
      <div
        className="rounded-xl p-4 border mb-4"
        style={{ background: 'var(--aurora-surface-alt)', borderColor: 'var(--aurora-border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📸</span>
          <h3 className="text-sm font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
            Business Photos
          </h3>
        </div>
        <PhotoUpload
          photos={formPhotos}
          onAdd={handleAddPhoto}
          onRemove={handleRemovePhoto}
          onSetCover={setCoverPhotoIndex}
          coverIndex={coverPhotoIndex}
        />
      </div>

      {/* ── Website ── */}
      <FormField label="Website" error={errors.website}>
        <input
          type="url"
          value={formData.website || ''}
          onChange={(e) => updateField('website', e.target.value)}
          placeholder="https://yourbusiness.com"
          className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40"
          style={inputStyle(!!errors.website)}
        />
      </FormField>

      {/* ── Business Hours ── */}
      <div
        className="rounded-xl p-4 border mb-4"
        style={{ background: 'var(--aurora-surface-alt)', borderColor: 'var(--aurora-border)' }}
      >
        <button
          type="button"
          onClick={() => setShowHoursEditor((v) => !v)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🕐</span>
            <h3 className="text-sm font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
              Business Hours
            </h3>
          </div>
          <span className="text-xs" style={{ color: 'var(--aurora-accent)' }}>
            {showHoursEditor ? 'Collapse' : 'Edit'}
          </span>
        </button>

        {showHoursEditor && (
          <div className="mt-3 space-y-2">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-2">
                <span className="text-xs w-12 font-medium" style={{ color: 'var(--aurora-text-primary)' }}>
                  {day.slice(0, 3)}
                </span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hours[day]?.closed}
                    onChange={(e) => updateHours(day, 'closed', !e.target.checked)}
                    className="w-3.5 h-3.5 rounded"
                  />
                  <span className="text-[10px]" style={{ color: 'var(--aurora-text-tertiary)' }}>Open</span>
                </label>
                {!hours[day]?.closed ? (
                  <>
                    <input
                      type="time"
                      value={hours[day]?.open || '09:00'}
                      onChange={(e) => updateHours(day, 'open', e.target.value)}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
                      className="px-2 py-1 text-xs rounded-lg outline-none"
                      style={inputStyle(false)}
                    />
                    <span className="text-xs" style={{ color: 'var(--aurora-text-tertiary)' }}>to</span>
                    <input
                      type="time"
                      value={hours[day]?.close || '17:00'}
                      onChange={(e) => updateHours(day, 'close', e.target.value)}
                      onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
                      className="px-2 py-1 text-xs rounded-lg outline-none"
                      style={inputStyle(false)}
                    />
                  </>
                ) : (
                  <span className="text-xs italic" style={{ color: 'var(--aurora-text-tertiary)' }}>Closed</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Price Range ── */}
      <FormField label="Price Range">
        <div className="flex gap-2">
          {PRICE_RANGES.map((pr) => (
            <button
              key={pr.value}
              type="button"
              onClick={() => updateField('priceRange', pr.value)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: formData.priceRange === pr.value ? 'var(--aurora-accent)' : 'var(--aurora-surface)',
                color: formData.priceRange === pr.value ? 'white' : 'var(--aurora-text-primary)',
                border: `1.5px solid ${formData.priceRange === pr.value ? 'var(--aurora-accent)' : 'var(--aurora-border)'}`,
              }}
            >
              {pr.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] mt-1" style={{ color: 'var(--aurora-text-tertiary)' }}>
          {PRICE_RANGES.find((p) => p.value === formData.priceRange)?.desc || 'Select a price range'}
        </p>
      </FormField>

      {/* ── Menu / Services ── */}
      <FormField label="Menu or Services">
        <textarea
          value={formData.menu || formData.services || ''}
          onChange={(e) => {
            updateField('menu', e.target.value);
            updateField('services', e.target.value);
          }}
          placeholder="List your key menu items, services, or offerings..."
          className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40 resize-none"
          style={inputStyle(false)}
          rows={4}
          maxLength={1000}
        />
        <p className="text-right text-[10px] mt-0.5" style={{ color: 'var(--aurora-text-tertiary)' }}>
          {(formData.menu || formData.services || '').length}/1000
        </p>
      </FormField>

      {/* ── Year Established ── */}
      <FormField label="Year Established">
        <input
          type="number"
          value={formData.yearEstablished || ''}
          onChange={(e) => updateField('yearEstablished', parseInt(e.target.value) || new Date().getFullYear())}
          placeholder={`${new Date().getFullYear()}`}
          min={1800}
          max={new Date().getFullYear()}
          className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40"
          style={inputStyle(false)}
        />
      </FormField>
    </div>
  );
};

export default StepDetails;
