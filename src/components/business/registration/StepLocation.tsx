// ═════════════════════════════════════════════════════════════════════════════════
// STEP 2 — LOCATION
// Google Places autocomplete for address, parsed into structured components,
// with manual override fields and Leaflet map preview.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGooglePlaces } from '../../../hooks/useGooglePlaces';
import type { PlaceResult } from '../../../hooks/useGooglePlaces';
import type { BusinessFormData } from '../../../reducers/businessReducer';
import { FormField } from './StepIdentity';
import type { StepProps } from './StepIdentity';

// Google Maps API key from Vite env
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface StepLocationProps extends StepProps {
  formPhotos: string[];
}

// ── Input style helper ──

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  background: 'var(--aurora-surface)',
  border: `1.5px solid ${hasError ? '#ef4444' : 'var(--aurora-border)'}`,
  color: 'var(--aurora-text-primary)',
  borderRadius: '0.75rem',
});

// ── US States & Canadian Provinces ──

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const CA_PROVINCES = [
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT',
];

// ── Leaflet CDN loader (reuses same CDN as BusinessMapView) ──

declare const L: any;

let leafletReady = false;
let leafletLoadingPromise: Promise<void> | null = null;

function ensureLeaflet(): Promise<void> {
  if (leafletReady && typeof L !== 'undefined') return Promise.resolve();
  if (leafletLoadingPromise) return leafletLoadingPromise;

  leafletLoadingPromise = new Promise<void>((resolve, reject) => {
    // CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
    // JS
    if (typeof L !== 'undefined') {
      leafletReady = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => { leafletReady = true; resolve(); };
    script.onerror = () => { leafletLoadingPromise = null; reject(new Error('Leaflet failed to load')); };
    document.head.appendChild(script);
  });

  return leafletLoadingPromise;
}

// ── Leaflet map preview sub-component ──

const LeafletMapPreview: React.FC<{ latitude: number; longitude: number; name: string }> = ({
  latitude,
  longitude,
  name,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    ensureLeaflet().then(() => {
      if (cancelled || !containerRef.current) return;

      // Create map if not yet initialized
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          touchZoom: false,
          doubleClickZoom: false,
        }).setView([latitude, longitude], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(mapRef.current);
      } else {
        mapRef.current.setView([latitude, longitude], 15);
      }

      // Update marker
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        const icon = L.divIcon({
          className: '',
          html: `<div style="font-size:28px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3))">📍</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
        markerRef.current = L.marker([latitude, longitude], { icon }).addTo(mapRef.current);
      }
    });

    return () => { cancelled = true; };
  }, [latitude, longitude]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="rounded-xl overflow-hidden border mb-4" style={{ borderColor: 'var(--aurora-border)' }}>
      <div ref={containerRef} className="h-40 w-full" />
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ background: 'var(--aurora-surface-alt)' }}
      >
        <span className="text-[10px]" style={{ color: 'var(--aurora-text-tertiary)' }}>
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </span>
        <span className="text-[10px] font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
          {name}
        </span>
      </div>
    </div>
  );
};

// ── Component ──

const StepLocation: React.FC<StepLocationProps> = ({ formData, updateField, errors, country }) => {
  const [searchInput, setSearchInput] = useState(formData.location || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showManualFields, setShowManualFields] = useState(!!formData.addressComponents);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const {
    isLoaded: placesLoaded,
    loadError: placesError,
    predictions,
    isSearching,
    getPlacePredictions,
    getPlaceDetails,
    clearPredictions,
  } = useGooglePlaces({
    apiKey: GOOGLE_API_KEY,
    country: country || undefined,
    types: ['street_address', 'premise', 'subpremise', 'route', 'establishment'],
  });

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => {
        getPlacePredictions(value);
        setShowDropdown(true);
      }, 300);
    } else {
      clearPredictions();
      setShowDropdown(false);
    }
  }, [getPlacePredictions, clearPredictions]);

  // Select a prediction
  const handleSelectPrediction = useCallback(async (placeId: string, description: string) => {
    setShowDropdown(false);
    clearPredictions();
    setSearchInput(description);
    updateField('location', description);

    const details = await getPlaceDetails(placeId);
    if (details) {
      updateField('placeId', details.placeId);
      updateField('addressComponents', details.addressComponents);
      updateField('latitude', details.latitude);
      updateField('longitude', details.longitude);
      setShowManualFields(true);
    }
  }, [getPlaceDetails, updateField, clearPredictions]);

  // Update individual address component
  const updateAddressField = useCallback((field: string, value: string) => {
    const current = formData.addressComponents || { street: '', city: '', state: '', zip: '', country: '' };
    updateField('addressComponents', { ...current, [field]: value });
  }, [formData.addressComponents, updateField]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const stateOptions = country === 'CA' ? CA_PROVINCES : US_STATES;
  const stateLabel = country === 'CA' ? 'Province' : 'State';
  const zipLabel = country === 'CA' ? 'Postal Code' : 'ZIP Code';

  const addr = formData.addressComponents;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
          Business Location
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
          Search for your business address. We'll verify the location for your listing.
        </p>
      </div>

      {/* Address search with autocomplete */}
      <div className="relative mb-4" ref={dropdownRef}>
        <FormField label="Business Address" error={errors.location || errors.address} required>
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => predictions.length > 0 && setShowDropdown(true)}
              placeholder={
                placesLoaded
                  ? 'Start typing your address...'
                  : placesError
                    ? 'Enter address manually below'
                    : 'Loading Google Places...'
              }
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40 pr-9"
              style={inputStyle(!!errors.location || !!errors.address)}
              autoComplete="off"
            />
            {isSearching && (
              <div
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--aurora-border)', borderTopColor: 'var(--aurora-accent)' }}
              />
            )}
          </div>
        </FormField>

        {/* Predictions dropdown */}
        {showDropdown && predictions.length > 0 && (
          <div
            className="absolute z-50 left-0 right-0 mt-1 rounded-xl shadow-lg overflow-hidden border"
            style={{
              background: 'var(--aurora-surface)',
              borderColor: 'var(--aurora-border)',
            }}
          >
            {predictions.map((pred) => (
              <button
                key={pred.place_id}
                type="button"
                onClick={() => handleSelectPrediction(pred.place_id, pred.description)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-black/5 transition-colors border-b last:border-b-0 flex items-start gap-2"
                style={{
                  color: 'var(--aurora-text-primary)',
                  borderColor: 'var(--aurora-border)',
                }}
              >
                <span className="text-base mt-0.5" style={{ color: 'var(--aurora-text-tertiary)' }}>📍</span>
                <div>
                  <div className="font-medium text-sm">
                    {pred.structured_formatting?.main_text || pred.description}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
                    {pred.structured_formatting?.secondary_text || ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual fallback / No Google API key */}
      {(!placesLoaded || placesError) && !showManualFields && (
        <button
          type="button"
          onClick={() => setShowManualFields(true)}
          className="mb-4 text-xs font-medium underline"
          style={{ color: 'var(--aurora-accent)' }}
        >
          Enter address manually
        </button>
      )}

      {/* Structured address fields (shown after autocomplete selection or manual entry) */}
      {showManualFields && (
        <div
          className="rounded-xl p-4 mb-4 space-y-3 border"
          style={{
            background: 'var(--aurora-surface-alt)',
            borderColor: 'var(--aurora-border)',
          }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
            Confirm or edit your address details:
          </p>

          {/* Street */}
          <FormField label="Street Address" error={errors.street} required>
            <input
              type="text"
              value={addr?.street || ''}
              onChange={(e) => updateAddressField('street', e.target.value)}
              placeholder="123 Main Street"
              className="w-full px-3 py-2 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40"
              style={inputStyle(!!errors.street)}
            />
          </FormField>

          {/* City + State row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="City" error={errors.city} required>
                <input
                  type="text"
                  value={addr?.city || ''}
                  onChange={(e) => updateAddressField('city', e.target.value)}
                  placeholder="City"
                  className="w-full px-3 py-2 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40"
                  style={inputStyle(!!errors.city)}
                />
              </FormField>
            </div>
            <div className="w-28">
              <FormField label={stateLabel} error={errors.state} required>
                <select
                  value={addr?.state || ''}
                  onChange={(e) => updateAddressField('state', e.target.value)}
                  className="w-full px-2 py-2 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40 appearance-none"
                  style={inputStyle(!!errors.state)}
                >
                  <option value="">--</option>
                  {stateOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>

          {/* ZIP */}
          <FormField label={zipLabel} error={errors.zip} required>
            <input
              type="text"
              value={addr?.zip || ''}
              onChange={(e) => updateAddressField('zip', e.target.value)}
              placeholder={country === 'CA' ? 'A1A 1A1' : '12345'}
              className="w-full px-3 py-2 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40"
              style={inputStyle(!!errors.zip)}
              maxLength={country === 'CA' ? 7 : 10}
            />
          </FormField>
        </div>
      )}

      {/* Leaflet map preview */}
      {formData.latitude && formData.longitude && (
        <LeafletMapPreview
          latitude={typeof formData.latitude === 'number' ? formData.latitude : 0}
          longitude={typeof formData.longitude === 'number' ? formData.longitude : 0}
          name={formData.name || 'Your Business'}
        />
      )}

      {/* State of Incorporation (optional, for verification step context) */}
      <FormField label={country === 'CA' ? 'Province of Incorporation' : 'State of Incorporation'}>
        <select
          value={formData.stateOfIncorp || ''}
          onChange={(e) => updateField('stateOfIncorp', e.target.value)}
          className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-indigo-400/40 appearance-none"
          style={inputStyle(false)}
        >
          <option value="">Select (optional)...</option>
          {stateOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </FormField>
    </div>
  );
};

export default StepLocation;
