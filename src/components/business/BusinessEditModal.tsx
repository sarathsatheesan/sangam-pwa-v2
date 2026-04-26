import React, { useState, useRef, useEffect } from 'react';
import {
  X, ArrowLeft, Loader2, Upload, Star,
} from 'lucide-react';
import { CATEGORIES } from '@/components/business/businessConstants';
import { compressImagesParallel, MAX_FILE_SIZE } from '@/components/business/imageUtils';
import type { BusinessFormData } from '@/reducers/businessReducer';
import AddressAutocomplete from '@/components/shared/AddressAutocomplete';
import type { AddressResult } from '@/components/shared/AddressAutocomplete';

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
  const [photoProgress, setPhotoProgress] = useState({ completed: 0, total: 0 });
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
    setPhotoProgress({ completed: 0, total: toProcess.length });

    const { images, failCount } = await compressImagesParallel(
      toProcess,
      (completed, total) => setPhotoProgress({ completed, total }),
    );

    if (failCount > 0) {
      setPhotoError(`${failCount} photo(s) failed to process. Please try again.`);
    }
    onPhotosChange([...photos, ...images]);
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
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Compressing {photoProgress.completed}/{photoProgress.total}...</span>
              <div className="w-full max-w-[200px] h-1.5 bg-aurora-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-aurora-indigo rounded-full transition-all duration-300"
                  style={{ width: `${photoProgress.total > 0 ? (photoProgress.completed / photoProgress.total) * 100 : 0}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6" />
              <span className="text-sm">Click to upload photos</span>
              <span className="text-xs text-aurora-text-muted">PNG, JPG up to 5MB each</span>
            </>
          )}
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

export interface BusinessEditModalProps {
  editData: BusinessFormData;
  editPhotos: string[];
  editCoverPhotoIndex: number;
  saving: boolean;
  photosEnabled: boolean;
  dispatch: React.Dispatch<any>;
  handleSaveEdit: () => void;
}

const BusinessEditModal: React.FC<BusinessEditModalProps> = ({
  editData,
  editPhotos,
  editCoverPhotoIndex,
  saving,
  photosEnabled,
  dispatch,
  handleSaveEdit,
}) => {
  const handleClose = () => dispatch({ type: 'SET_IS_EDITING', payload: false });

  // ESC-to-close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="edit-modal-title" className="fixed inset-0 bg-aurora-bg z-50 flex flex-col">
      <div className="flex-shrink-0 bg-aurora-surface border-b border-aurora-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleClose} aria-label="Go back" className="p-1 hover:bg-aurora-surface-variant rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none">
            <ArrowLeft className="w-5 h-5 text-aurora-text-secondary" />
          </button>
          <h2 id="edit-modal-title" className="text-lg font-bold text-aurora-text">Edit Business</h2>
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
        <FormInput label="Business Name" required type="text" value={editData.name} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, name: e.target.value } })} />
        <div>
          <label className="block text-sm font-medium text-aurora-text mb-1.5">Category</label>
          <select
            value={editData.category}
            onChange={(e) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, category: e.target.value } })}
            className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
          >
            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <FormTextarea label="Description" value={editData.desc} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, desc: e.target.value } })} rows={3} />
        {photosEnabled && (
          <BusinessPhotoUploader
            photos={editPhotos}
            onPhotosChange={(photos) => dispatch({ type: 'SET_EDIT_PHOTOS', payload: photos })}
            onCoverChange={(index) => dispatch({ type: 'SET_EDIT_COVER_INDEX', payload: index })}
            coverIndex={editCoverPhotoIndex}
          />
        )}
        {/* Location / Address with Google Places Autocomplete */}
        <div>
          <label className="block text-sm font-medium text-aurora-text mb-1.5">Location / Address</label>
          <AddressAutocomplete
            id="edit-biz-address"
            value={editData.location}
            onChange={(val) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, location: val } })}
            onSelect={(result: AddressResult) => {
              dispatch({ type: 'SET_EDIT_DATA', payload: {
                ...editData,
                location: result.formattedAddress || result.street,
                addressComponents: { street: result.street, city: result.city, state: result.state, zip: result.zip, country: 'US' },
                ...(result.lat ? { latitude: result.lat } : {}),
                ...(result.lng ? { longitude: result.lng } : {}),
              }});
            }}
            placeholder="Start typing your address..."
            className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl
                       text-sm text-aurora-text placeholder:text-aurora-text-muted
                       focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition-all"
          />
        </div>
        <FormInput label="Phone" type="tel" value={editData.phone} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, phone: e.target.value } })} />
        <FormInput label="Email" type="email" value={editData.email} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, email: e.target.value } })} />
        <FormInput label="Website" type="url" value={editData.website} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, website: e.target.value } })} />
        <FormInput label="Booking / Reservation URL" type="url" value={editData.bookingUrl || ''} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, bookingUrl: e.target.value } })} placeholder="https://www.opentable.com/mybusiness" />
        <div>
          <label className="block text-sm font-medium text-aurora-text mb-1.5">
            Max Service Radius (Miles) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              step={1}
              value={editData.serviceRadius ?? ''}
              onChange={(e: any) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0;
                dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, serviceRadius: val } });
              }}
              placeholder="25"
              className="w-full px-4 py-2.5 pr-14 bg-aurora-surface border border-aurora-border rounded-xl
                         text-sm text-aurora-text placeholder:text-aurora-text-muted
                         focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition-all"
              style={{ appearance: 'auto' } as React.CSSProperties}
              aria-required={true}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-aurora-text-muted pointer-events-none" aria-hidden="true">
              miles
            </span>
          </div>
          <p className="text-[10px] text-aurora-text-muted mt-1">How far will you travel or deliver? (1–100 miles)</p>
        </div>
        <FormTextarea label="Business Hours" value={editData.hours} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, hours: e.target.value } })} rows={3} placeholder="Mon-Fri: 9am-5pm&#10;Sat: 10am-2pm&#10;Sun: Closed" />
        <FormInput label="Year Established" type="number" value={editData.yearEstablished} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, yearEstablished: parseInt(e.target.value) } })} />
        <FormInput label="Price Range" type="text" value={editData.priceRange} placeholder="$$-$$$" onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, priceRange: e.target.value } })} />
        <FormTextarea label="Services" value={editData.services} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, services: e.target.value } })} rows={3} placeholder="List your services..." />
        <FormTextarea label={editData.category === 'Restaurant & Food' ? 'Menu' : 'Products / Merchandise'} value={editData.menu} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...editData, menu: e.target.value } })} rows={4} placeholder="List your menu items or products..." />
      </div>
      <div className="sticky bottom-0 bg-aurora-surface border-t border-aurora-border p-4">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={handleClose}
            className="flex-1 bg-aurora-surface-variant text-aurora-text-secondary py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-border/30 transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="flex-1 bg-aurora-indigo text-white py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessEditModal;
