import React, { useState, useRef, useEffect } from 'react';
import {
  X, Plus, ArrowLeft, Loader2, Upload, Star,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_EMOJI_MAP } from '@/components/business/businessConstants';
import { compressImage, MAX_FILE_SIZE } from '@/components/business/imageUtils';
import type { BusinessFormData } from '@/reducers/businessReducer';

// ── Local form helpers (kept outside component to avoid re-mount) ──
const FormInput = ({ label, required, error, ...props }: any) => (
  <div>
    <label className="block text-sm font-medium text-aurora-text mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      {...props}
      className={`w-full px-4 py-2.5 bg-aurora-surface border rounded-xl
                 text-sm text-aurora-text placeholder:text-aurora-text-muted
                 focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition-all
                 ${error ? 'border-red-400 ring-1 ring-red-400/30' : 'border-aurora-border'}`}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

const FormTextarea = ({ label, ...props }: any) => (
  <div>
    <label className="block text-sm font-medium text-aurora-text mb-1.5">{label}</label>
    <textarea
      {...props}
      className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl
                 text-sm text-aurora-text placeholder:text-aurora-text-muted resize-none
                 focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition-all"
    />
  </div>
);

// ── Photo uploader (self-contained with own state) ──
const BusinessPhotoUploader: React.FC<{
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onCoverChange: (index: number) => void;
  coverIndex: number;
}> = ({ photos, onPhotosChange, onCoverChange, coverIndex }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setPhotoError(null);
    const remaining = 5 - photos.length;
    const toProcess = Array.from(files).slice(0, remaining);

    for (const file of toProcess) {
      if (file.size > MAX_FILE_SIZE) {
        setPhotoError(`"${file.name}" exceeds the 5MB size limit. Please choose a smaller file.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setPhotoUploading(true);
    const newPhotos = [...photos];
    let failCount = 0;
    for (const file of toProcess) {
      try {
        const compressed = await compressImage(file);
        newPhotos.push(compressed);
      } catch (err) {
        console.error('Error compressing image:', err);
        failCount++;
      }
    }
    if (failCount > 0) {
      setPhotoError(`${failCount} photo(s) failed to upload. Please try again.`);
    }
    onPhotosChange(newPhotos);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPhotoUploading(false);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-aurora-text mb-2">Photos (max 5)</h3>
      {photoError && (
        <div className="mb-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {photoError}
        </div>
      )}
      {photos.length < 5 && (
        <button
          type="button"
          onClick={() => !photoUploading && fileInputRef.current?.click()}
          disabled={photoUploading}
          className={`w-full border-2 border-dashed border-aurora-border rounded-xl p-4 flex flex-col items-center gap-2 text-aurora-text-muted hover:border-aurora-indigo hover:text-aurora-indigo transition-colors ${photoUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {photoUploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Upload className="w-6 h-6" />
          )}
          <span className="text-sm">{photoUploading ? 'Uploading...' : 'Click to upload photos'}</span>
          <span className="text-xs text-aurora-text-muted">PNG, JPG up to 5MB each</span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoSelect}
        className="hidden"
      />
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative group">
              <img
                src={photo}
                alt={`Photo ${idx + 1}`}
                loading="lazy"
                decoding="async"
                className={`w-full h-24 object-cover rounded-lg cursor-pointer ${
                  idx === coverIndex ? 'ring-2 ring-aurora-indigo' : ''
                }`}
                onClick={() => onCoverChange(idx)}
              />
              {idx === coverIndex && (
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-aurora-indigo text-white text-[10px] font-bold rounded pointer-events-none flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-white" /> Cover
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const updated = photos.filter((_, i) => i !== idx);
                  onPhotosChange(updated);
                  if (coverIndex >= updated.length) onCoverChange(Math.max(0, updated.length - 1));
                }}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length > 0 && (
        <p className="text-xs text-aurora-text-muted mt-2">Tap a photo to set it as cover image. {photos.length}/5 uploaded.</p>
      )}
    </div>
  );
};

export interface BusinessCreateModalProps {
  formData: BusinessFormData;
  formErrors: Record<string, string>;
  formPhotos: string[];
  coverPhotoIndex: number;
  saving: boolean;
  photosEnabled: boolean;
  dispatch: React.Dispatch<any>;
  handleAddBusiness: () => void;
}

const BusinessCreateModal: React.FC<BusinessCreateModalProps> = ({
  formData,
  formErrors,
  formPhotos,
  coverPhotoIndex,
  saving,
  photosEnabled,
  dispatch,
  handleAddBusiness,
}) => {
  const handleClose = () => {
    dispatch({ type: 'CLOSE_CREATE_MODAL' });
    dispatch({ type: 'SET_FORM_PHOTOS', payload: [] });
    dispatch({ type: 'SET_COVER_PHOTO_INDEX', payload: 0 });
  };

  // ESC-to-close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="create-modal-title" className="fixed inset-0 bg-aurora-bg z-50 flex flex-col">
      <div className="flex-shrink-0 bg-aurora-surface border-b border-aurora-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleClose} aria-label="Go back" className="p-1 hover:bg-aurora-surface-variant rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none">
            <ArrowLeft className="w-5 h-5 text-aurora-text-secondary" />
          </button>
          <h2 id="create-modal-title" className="text-lg font-bold text-aurora-text">Add Business</h2>
        </div>
        <button
          onClick={handleClose}
          aria-label="Close form"
          className="text-aurora-text-muted hover:text-aurora-text-secondary focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4 max-w-lg mx-auto w-full">
        <FormInput label="Business Name" required error={formErrors.name} type="text" value={formData.name} onChange={(e: any) => { dispatch({ type: 'UPDATE_FORM_FIELD', field: 'name', value: e.target.value }); dispatch({ type: 'CLEAR_FORM_ERROR', field: 'name' }); }} placeholder="Enter business name" />
        <div>
          <label className="block text-sm font-medium text-aurora-text mb-1.5">Category <span className="text-red-500">*</span></label>
          <select
            value={formData.category}
            onChange={(e) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'category', value: e.target.value })}
            className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
          >
            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{CATEGORY_EMOJI_MAP[cat]} {cat}</option>)}
          </select>
        </div>
        <FormTextarea label="Description" value={formData.desc} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'desc', value: e.target.value })} rows={3} placeholder="Tell customers about your business..." />
        {photosEnabled && (
          <BusinessPhotoUploader
            photos={formPhotos}
            onPhotosChange={(photos) => dispatch({ type: 'SET_FORM_PHOTOS', payload: photos })}
            onCoverChange={(index) => dispatch({ type: 'SET_COVER_PHOTO_INDEX', payload: index })}
            coverIndex={coverPhotoIndex}
          />
        )}
        <FormInput label="Location / Address" required error={formErrors.location} type="text" value={formData.location} onChange={(e: any) => { dispatch({ type: 'UPDATE_FORM_FIELD', field: 'location', value: e.target.value }); dispatch({ type: 'CLEAR_FORM_ERROR', field: 'location' }); }} placeholder="123 Main St, City, State" />
        {/* Map coordinates (optional — for map pin placement) */}
        <div className="grid grid-cols-2 gap-3">
          <FormInput label="Latitude" type="number" value={formData.latitude} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'latitude', value: e.target.value === '' ? '' : parseFloat(e.target.value) })} placeholder="40.7608" />
          <FormInput label="Longitude" type="number" value={formData.longitude} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'longitude', value: e.target.value === '' ? '' : parseFloat(e.target.value) })} placeholder="-111.891" />
        </div>
        <p className="text-[10px] text-aurora-text-muted -mt-2">Optional — enables your business on the map view. Find coordinates on Google Maps.</p>
        <FormInput label="Phone" required error={formErrors.phone} type="tel" value={formData.phone} onChange={(e: any) => { dispatch({ type: 'UPDATE_FORM_FIELD', field: 'phone', value: e.target.value }); dispatch({ type: 'CLEAR_FORM_ERROR', field: 'phone' }); }} placeholder="(555) 123-4567" />
        <FormInput label="Email" required error={formErrors.email} type="email" value={formData.email} onChange={(e: any) => { dispatch({ type: 'UPDATE_FORM_FIELD', field: 'email', value: e.target.value }); dispatch({ type: 'CLEAR_FORM_ERROR', field: 'email' }); }} placeholder="contact@business.com" />
        <FormInput label="Website" error={formErrors.website} type="url" value={formData.website} onChange={(e: any) => { dispatch({ type: 'UPDATE_FORM_FIELD', field: 'website', value: e.target.value }); dispatch({ type: 'CLEAR_FORM_ERROR', field: 'website' }); }} placeholder="https://www.mybusiness.com" />
        <FormTextarea label="Business Hours" value={formData.hours} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'hours', value: e.target.value })} rows={3} placeholder="Mon-Fri: 9am-5pm&#10;Sat: 10am-2pm&#10;Sun: Closed" />
        <FormInput label="Year Established" type="number" value={formData.yearEstablished} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'yearEstablished', value: parseInt(e.target.value) })} />
        <FormInput label="Price Range" type="text" value={formData.priceRange} placeholder="$$-$$$" onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'priceRange', value: e.target.value })} />
        <FormTextarea label="Services" value={formData.services} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'services', value: e.target.value })} rows={3} placeholder="List your services..." />
        <FormTextarea label={formData.category === 'Restaurant & Food' ? 'Menu' : 'Products / Merchandise'} value={formData.menu} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'menu', value: e.target.value })} rows={4} placeholder="List your menu items or products..." />
      </div>
      <div className="sticky bottom-0 bg-aurora-surface border-t border-aurora-border p-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleAddBusiness}
            disabled={saving}
            className="w-full bg-aurora-indigo text-white py-3 rounded-xl font-semibold text-sm hover:bg-aurora-indigo/90 shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><Plus className="w-4 h-4" /> Add Business</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessCreateModal;
