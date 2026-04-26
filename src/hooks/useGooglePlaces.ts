// ═════════════════════════════════════════════════════════════════════════════════
// GOOGLE PLACES AUTOCOMPLETE HOOK — Places API (New)
// Uses the modern AutocompleteSuggestion API instead of the legacy
// AutocompleteService. Loads Google Maps JS API on demand, provides address
// autocomplete suggestions, and parses place details into structured components.
//
// Cross-browser: Chrome, Safari (desktop + iOS), Firefox, Android Chrome.
// Requires "Places API (New)" to be enabled in Google Cloud Console.
// ═════════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Google Maps type declarations (minimal — avoids @types/google.maps dependency) ──
declare namespace google.maps {
  function importLibrary(name: string): Promise<any>;
  namespace places {
    class AutocompleteSessionToken {}
  }
}

// ── Types ──

export interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface PlaceResult {
  placeId: string;
  formattedAddress: string;
  addressComponents: AddressComponents;
  latitude: number;
  longitude: number;
}

export interface UseGooglePlacesOptions {
  apiKey: string;
  country?: 'US' | 'CA' | '';
  types?: string[];
}

// Prediction shape exposed to consumers (normalized from the new API)
export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  // Internal: keep the raw suggestion for toPlace()
  _raw?: any;
}

// ── Script loader (singleton) ──
// Prevents duplicate script injection even when many components mount concurrently.

let scriptLoadPromise: Promise<void> | null = null;

/**
 * Safely check if Google Maps is already loaded.
 * Uses try/catch to avoid ReferenceError in strict-mode Safari/Firefox.
 */
function isGoogleMapsReady(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof (window as any).google !== 'undefined' &&
      typeof (window as any).google.maps?.importLibrary === 'function'
    );
  } catch {
    return false;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  if (isGoogleMapsReady()) return Promise.resolve();

  // Check if a script tag already exists (another component may have added one)
  const existingScript = document.querySelector(
    'script[src*="maps.googleapis.com/maps/api/js"]',
  ) as HTMLScriptElement | null;

  if (existingScript) {
    // Wait for the existing script to finish loading
    scriptLoadPromise = new Promise<void>((resolve, reject) => {
      if (isGoogleMapsReady()) {
        resolve();
        return;
      }
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => {
        scriptLoadPromise = null;
        reject(new Error('Failed to load Google Maps script'));
      });
    });
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

// ── Parse address components from Places API (New) result ──
// New API uses `longText` / `shortText` instead of `long_name` / `short_name`

function parseAddressComponents(
  components: any[],
): AddressComponents {
  if (!components || !Array.isArray(components)) {
    return { street: '', city: '', state: '', zip: '', country: '' };
  }

  const get = (type: string): string =>
    components.find((c: any) => c.types?.includes(type))?.longText || '';
  const getShort = (type: string): string =>
    components.find((c: any) => c.types?.includes(type))?.shortText || '';

  const streetNumber = get('street_number');
  const route = get('route');

  return {
    street: streetNumber ? `${streetNumber} ${route}` : route,
    city: get('locality') || get('sublocality_level_1') || get('administrative_area_level_2'),
    state: getShort('administrative_area_level_1'),
    zip: get('postal_code'),
    country: getShort('country'),
  };
}

/**
 * Safely extract text from a Places API (New) text object.
 * The value may be: a string, an object with .text property, or have .toString().
 */
function safeText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val.text === 'string') return val.text;
  return String(val);
}

// ── Hook ──

export function useGooglePlaces({ apiKey, country, types }: UseGooglePlacesOptions) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const sessionToken = useRef<any>(null);

  // Load the script and import the places library
  useEffect(() => {
    if (!apiKey) {
      setLoadError('No Google Maps API key provided');
      return;
    }

    let cancelled = false;

    // Set a timeout — if loading takes > 10s, give up and show manual entry
    const timeout = setTimeout(() => {
      if (!cancelled && !isLoaded) {
        setLoadError('Google Places took too long to load. Please enter address manually.');
      }
    }, 10_000);

    loadGoogleMapsScript(apiKey)
      .then(async () => {
        if (cancelled) return;
        // Import the places library using the new API
        if (!isGoogleMapsReady()) {
          throw new Error('Google Maps failed to initialize');
        }
        await (window as any).google.maps.importLibrary('places');
        if (cancelled) return;
        sessionToken.current = new (window as any).google.maps.places.AutocompleteSessionToken();
        setIsLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('Google Places load error:', err);
          setLoadError(err.message || 'Failed to load Google Places');
        }
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get autocomplete predictions using Places API (New)
  const getPlacePredictions = useCallback(
    async (input: string) => {
      if (!isLoaded || !input.trim()) {
        setPredictions([]);
        return;
      }

      setIsSearching(true);

      try {
        const request: any = {
          input,
          sessionToken: sessionToken.current,
          includedPrimaryTypes: types || ['street_address', 'premise', 'subpremise', 'route', 'geocode'],
          ...(country && {
            includedRegionCodes: [country.toLowerCase()],
          }),
        };

        const placesLib = (window as any).google.maps.places;
        const { suggestions } = await placesLib.AutocompleteSuggestion
          .fetchAutocompleteSuggestions(request);

        // Normalize predictions to match the shape consumers expect
        const normalized: PlacePrediction[] = (suggestions || [])
          .filter((s: any) => s.placePrediction)
          .map((s: any) => {
            const pred = s.placePrediction;
            return {
              place_id: pred.placeId || pred.place_id || '',
              description: safeText(pred.text),
              structured_formatting: {
                main_text: safeText(pred.mainText),
                secondary_text: safeText(pred.secondaryText),
              },
              _raw: pred,
            };
          });

        setPredictions(normalized);
      } catch (err: any) {
        console.warn('Places autocomplete error:', err);
        setPredictions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [isLoaded, country, types],
  );

  // Get full place details from a prediction using Places API (New)
  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<PlaceResult | null> => {
      if (!isLoaded) return null;

      try {
        const placesLib = (window as any).google.maps.places;

        // Find the raw prediction with this placeId to use toPlace()
        const rawPrediction = predictions.find((p) => p.place_id === placeId)?._raw;

        let place: any;

        if (rawPrediction?.toPlace) {
          // Preferred: use toPlace() from the prediction (uses session token automatically)
          place = rawPrediction.toPlace();
        } else {
          // Fallback: construct a Place object directly
          place = new placesLib.Place({ id: placeId });
        }

        await place.fetchFields({
          fields: ['addressComponents', 'formattedAddress', 'location', 'id'],
        });

        // Refresh session token after fetchFields (per Google billing best practices)
        sessionToken.current = new placesLib.AutocompleteSessionToken();

        const addressComponents = parseAddressComponents(
          place.addressComponents || [],
        );

        return {
          placeId: place.id || placeId,
          formattedAddress: place.formattedAddress || '',
          addressComponents,
          latitude: place.location?.lat?.() ?? place.location?.lat ?? 0,
          longitude: place.location?.lng?.() ?? place.location?.lng ?? 0,
        };
      } catch (err: any) {
        console.warn('Place details error:', err);
        // Refresh session token even on error
        try {
          sessionToken.current = new (window as any).google.maps.places.AutocompleteSessionToken();
        } catch (_) { /* ignore */ }
        return null;
      }
    },
    [isLoaded, predictions],
  );

  // Clear predictions
  const clearPredictions = useCallback(() => {
    setPredictions([]);
  }, []);

  return {
    isLoaded,
    loadError,
    predictions,
    isSearching,
    getPlacePredictions,
    getPlaceDetails,
    clearPredictions,
  };
}
