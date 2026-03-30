// ═════════════════════════════════════════════════════════════════════════════════
// ADDRESS AUTOCOMPLETE
// Reusable component wrapping Google Places Autocomplete for address entry.
// Falls back to a plain text input when the API key is not configured.
// Phase 7 Sprint 2: Address Autocomplete
// ═════════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

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
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  onBlur?: () => void;
}

// Check if Google Maps Places API is available
function isGooglePlacesAvailable(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    (window as any).google?.maps?.places?.AutocompleteService
  );
}

interface Prediction {
  description: string;
  place_id: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = '123 Main Street',
  className = '',
  id,
  disabled,
  onBlur,
  ...ariaProps
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasApi, setHasApi] = useState(false);
  const serviceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Initialize Google Places service
  useEffect(() => {
    if (isGooglePlacesAvailable()) {
      setHasApi(true);
      serviceRef.current = new (window as any).google.maps.places.AutocompleteService();
      // PlacesService needs a dummy element
      const div = document.createElement('div');
      placesServiceRef.current = new (window as any).google.maps.places.PlacesService(div);
    }
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchSuggestions = useCallback((input: string) => {
    if (!serviceRef.current || input.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    serviceRef.current.getPlacePredictions(
      {
        input,
        types: ['address'],
        componentRestrictions: { country: 'us' },
      },
      (predictions: Prediction[] | null, status: string) => {
        setLoading(false);
        if (status === 'OK' && predictions) {
          setSuggestions(predictions.slice(0, 5));
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      },
    );
  }, []);

  const handleInputChange = (val: string) => {
    onChange(val);
    if (hasApi) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
    }
  };

  const handleSelectSuggestion = (prediction: Prediction) => {
    setShowSuggestions(false);
    setSuggestions([]);

    if (!placesServiceRef.current) {
      onChange(prediction.description);
      return;
    }

    placesServiceRef.current.getDetails(
      { placeId: prediction.place_id, fields: ['address_components', 'geometry', 'formatted_address'] },
      (place: any, status: string) => {
        if (status !== 'OK' || !place) {
          onChange(prediction.description);
          return;
        }

        const components = place.address_components || [];
        const get = (type: string): string => {
          const comp = components.find((c: any) => c.types.includes(type));
          return comp?.short_name || comp?.long_name || '';
        };

        const streetNumber = get('street_number');
        const route = get('route');
        const street = streetNumber ? `${streetNumber} ${route}` : route;

        const result: AddressResult = {
          street,
          city: get('locality') || get('sublocality_level_1') || get('administrative_area_level_2'),
          state: get('administrative_area_level_1'),
          zip: get('postal_code'),
          formattedAddress: place.formatted_address,
        };

        if (place.geometry?.location) {
          result.lat = place.geometry.location.lat();
          result.lng = place.geometry.location.lng();
        }

        onChange(result.street);
        onSelect(result);
      },
    );
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-9 ${className}`}
          autoComplete="off"
          {...ariaProps}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg overflow-hidden"
          style={{ borderColor: 'var(--aurora-border, #E5E7EB)' }}
        >
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors flex items-start gap-2"
              style={{ color: 'var(--aurora-text)' }}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click
                handleSelectSuggestion(s);
              }}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
              <span>{s.description}</span>
            </button>
          ))}
          <div className="px-4 py-1.5 text-[10px] text-gray-400 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
