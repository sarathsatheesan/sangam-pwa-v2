// ═════════════════════════════════════════════════════════════════════════════════
// ADDRESS AUTOCOMPLETE
// Reusable component wrapping Google Places Autocomplete for address entry.
// Uses the modern Places API (New) via useGooglePlaces hook.
// Falls back to a plain text input when the API key is not configured.
//
// Cross-browser: Chrome, Safari (desktop + iOS), Firefox, Android Chrome.
// ═════════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { useGooglePlaces } from '../../hooks/useGooglePlaces';
import type { PlacePrediction } from '../../hooks/useGooglePlaces';

export interface AddressResult {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: AddressResult) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Restrict results to a specific country (ISO 3166-1 alpha-2) */
  country?: 'US' | 'CA' | '';
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  onBlur?: () => void;
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing your address...',
  className = '',
  id,
  disabled,
  country,
  onBlur,
  ...ariaProps
}: AddressAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const {
    isLoaded,
    loadError,
    predictions,
    isSearching,
    getPlacePredictions,
    getPlaceDetails,
    clearPredictions,
  } = useGooglePlaces({
    apiKey: API_KEY,
    country: country || undefined,
    types: ['street_address', 'premise', 'subpremise', 'route'],
  });

  // Close suggestions on outside click / touch
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  // Debounced search
  const handleInputChange = useCallback((val: string) => {
    onChange(val);
    if (!isLoaded) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length >= 3) {
      debounceRef.current = setTimeout(() => {
        getPlacePredictions(val);
        setShowSuggestions(true);
      }, 300);
    } else {
      clearPredictions();
      setShowSuggestions(false);
    }
  }, [isLoaded, onChange, getPlacePredictions, clearPredictions]);

  // Select a prediction → fetch full details → emit structured result
  const handleSelectPrediction = useCallback(async (pred: PlacePrediction) => {
    setShowSuggestions(false);
    clearPredictions();

    // Set the description immediately for visual feedback
    onChange(pred.description);

    const details = await getPlaceDetails(pred.place_id);
    if (details) {
      const result: AddressResult = {
        street: details.addressComponents.street,
        city: details.addressComponents.city,
        state: details.addressComponents.state,
        zip: details.addressComponents.zip,
        lat: details.latitude,
        lng: details.longitude,
        formattedAddress: details.formattedAddress,
      };

      // Update the visible input to show the street
      onChange(result.street || pred.description);
      onSelect(result);
    }
  }, [getPlaceDetails, clearPredictions, onChange, onSelect]);

  // Compute placeholder based on API state
  const effectivePlaceholder = isLoaded
    ? placeholder
    : loadError
      ? 'Enter address manually'
      : 'Loading address search...';

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: 'var(--aurora-text-tertiary, #9CA3AF)' }}
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => predictions.length > 0 && setShowSuggestions(true)}
          onBlur={onBlur}
          placeholder={effectivePlaceholder}
          disabled={disabled}
          className={`pl-9 ${className}`}
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions && predictions.length > 0}
          aria-autocomplete="list"
          aria-controls={id ? `${id}-listbox` : undefined}
          {...ariaProps}
        />
        {isSearching && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
            style={{ color: 'var(--aurora-text-tertiary, #9CA3AF)' }}
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && predictions.length > 0 && (
        <div
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-xl border shadow-lg overflow-hidden"
          style={{
            background: 'var(--aurora-surface, #FFFFFF)',
            borderColor: 'var(--aurora-border, #E5E7EB)',
          }}
        >
          {predictions.map((pred) => (
            <button
              key={pred.place_id}
              type="button"
              role="option"
              className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-start gap-2"
              style={{ color: 'var(--aurora-text, #1F2937)' }}
              // onMouseDown for desktop; onTouchEnd for mobile Safari/Android
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click
                handleSelectPrediction(pred);
              }}
              onTouchEnd={(e) => {
                e.preventDefault(); // prevent ghost click + blur on mobile
                handleSelectPrediction(pred);
              }}
            >
              <MapPin
                className="h-4 w-4 mt-0.5 shrink-0"
                style={{ color: 'var(--aurora-text-tertiary, #9CA3AF)' }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">
                  {pred.structured_formatting?.main_text || pred.description}
                </div>
                {pred.structured_formatting?.secondary_text && (
                  <div
                    className="text-xs mt-0.5 truncate"
                    style={{ color: 'var(--aurora-text-secondary, #6B7280)' }}
                  >
                    {pred.structured_formatting.secondary_text}
                  </div>
                )}
              </div>
            </button>
          ))}
          <div
            className="px-4 py-1.5 text-[10px] border-t"
            style={{
              color: 'var(--aurora-text-tertiary, #9CA3AF)',
              borderColor: 'var(--aurora-border, #E5E7EB)',
            }}
          >
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
