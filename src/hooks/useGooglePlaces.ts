// ═════════════════════════════════════════════════════════════════════════════════
// GOOGLE PLACES AUTOCOMPLETE HOOK
// Loads Google Maps JS API on demand and provides address autocomplete.
//
// Strategy: tries the modern "Places API (New)" first (AutocompleteSuggestion).
// If that API isn't available, falls back to the legacy AutocompleteService.
// This ensures autocomplete works regardless of which API is enabled in the
// Google Cloud Console.
//
// Cross-browser: Chrome, Safari (desktop + iOS), Firefox, Android Chrome.
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

// Prediction shape exposed to consumers (normalized)
export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  // Internal: keep the raw suggestion for toPlace() (new API only)
  _raw?: any;
}

// ── Script loader (singleton) ──

let scriptLoadPromise: Promise<void> | null = null;

/** Safely check if Google Maps is already loaded. */
function isGoogleMapsReady(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof (window as any).google !== 'undefined' &&
      typeof (window as any).google.maps !== 'undefined'
    );
  } catch {
    return false;
  }
}

/** Check if the new Places API (AutocompleteSuggestion) is available */
function hasNewPlacesAPI(): boolean {
  try {
    return typeof (window as any).google?.maps?.places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions === 'function';
  } catch {
    return false;
  }
}

/** Check if the legacy Places API (AutocompleteService) is available */
function hasLegacyPlacesAPI(): boolean {
  try {
    return typeof (window as any).google?.maps?.places?.AutocompleteService === 'function';
  } catch {
    return false;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  if (isGoogleMapsReady()) return Promise.resolve();

  // Check if a script tag already exists
  const existingScript = document.querySelector(
    'script[src*="maps.googleapis.com/maps/api/js"]',
  ) as HTMLScriptElement | null;

  if (existingScript) {
    scriptLoadPromise = new Promise<void>((resolve, reject) => {
      if (isGoogleMapsReady()) { resolve(); return; }
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

// ── Address component parsers ──

/** Parse from Places API (New) — uses longText/shortText */
function parseNewApiComponents(components: any[]): AddressComponents {
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

/** Parse from legacy Places API — uses long_name/short_name */
function parseLegacyComponents(components: any[]): AddressComponents {
  if (!components || !Array.isArray(components)) {
    return { street: '', city: '', state: '', zip: '', country: '' };
  }
  const get = (type: string): string => {
    const c = components.find((c: any) => c.types?.includes(type));
    return c?.long_name || c?.short_name || '';
  };
  const getShort = (type: string): string => {
    const c = components.find((c: any) => c.types?.includes(type));
    return c?.short_name || c?.long_name || '';
  };

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

/** Safely extract text from a Places API (New) text object. */
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
  // Track which API variant is available: 'new' | 'legacy' | null
  const apiMode = useRef<'new' | 'legacy' | null>(null);
  // Legacy API refs
  const legacyService = useRef<any>(null);
  const legacyPlacesService = useRef<any>(null);

  // Load the script and import the places library
  useEffect(() => {
    if (!apiKey) {
      setLoadError('No Google Maps API key provided');
      return;
    }

    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled && !isLoaded) {
        setLoadError('Google Places took too long to load. Please enter address manually.');
      }
    }, 12_000);

    loadGoogleMapsScript(apiKey)
      .then(async () => {
        if (cancelled) return;

        // Try to import the places library using the new dynamic import API
        const g = (window as any).google;
        if (g?.maps?.importLibrary) {
          try {
            await g.maps.importLibrary('places');
          } catch {
            // importLibrary may fail if only legacy API is enabled — that's ok
          }
        }

        if (cancelled) return;

        // Determine which API is available
        if (hasNewPlacesAPI()) {
          apiMode.current = 'new';
          sessionToken.current = new (window as any).google.maps.places.AutocompleteSessionToken();
        } else if (hasLegacyPlacesAPI()) {
          apiMode.current = 'legacy';
          legacyService.current = new (window as any).google.maps.places.AutocompleteService();
          // PlacesService needs a DOM element
          const div = document.createElement('div');
          legacyPlacesService.current = new (window as any).google.maps.places.PlacesService(div);
        } else {
          throw new Error('Google Places API not available. Check that "Places API" or "Places API (New)" is enabled in Google Cloud Console.');
        }

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

  // ── NEW API: get predictions ──
  const getNewApiPredictions = useCallback(
    async (input: string) => {
      const request: any = {
        input,
        sessionToken: sessionToken.current,
        includedPrimaryTypes: types || ['street_address', 'premise', 'subpremise', 'route', 'geocode'],
        ...(country && { includedRegionCodes: [country.toLowerCase()] }),
      };

      const placesLib = (window as any).google.maps.places;
      const { suggestions } = await placesLib.AutocompleteSuggestion
        .fetchAutocompleteSuggestions(request);

      return (suggestions || [])
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
          } as PlacePrediction;
        });
    },
    [country, types],
  );

  // ── LEGACY API: get predictions ──
  const getLegacyPredictions = useCallback(
    (input: string): Promise<PlacePrediction[]> => {
      return new Promise((resolve) => {
        if (!legacyService.current) { resolve([]); return; }

        const request: any = {
          input,
          types: ['address'],
          ...(country && { componentRestrictions: { country: country.toLowerCase() } }),
        };

        legacyService.current.getPlacePredictions(
          request,
          (results: any[] | null, status: string) => {
            if (status === 'OK' && results) {
              resolve(
                results.slice(0, 5).map((r: any) => ({
                  place_id: r.place_id,
                  description: r.description,
                  structured_formatting: {
                    main_text: r.structured_formatting?.main_text || r.description,
                    secondary_text: r.structured_formatting?.secondary_text || '',
                  },
                })),
              );
            } else {
              resolve([]);
            }
          },
        );
      });
    },
    [country],
  );

  // ── Public: get predictions (dispatches to correct API) ──
  const getPlacePredictions = useCallback(
    async (input: string) => {
      if (!isLoaded || !input.trim()) {
        setPredictions([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = apiMode.current === 'new'
          ? await getNewApiPredictions(input)
          : await getLegacyPredictions(input);
        setPredictions(results);
      } catch (err: any) {
        console.warn('Places autocomplete error:', err);
        setPredictions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [isLoaded, getNewApiPredictions, getLegacyPredictions],
  );

  // ── NEW API: get place details ──
  const getNewApiDetails = useCallback(
    async (placeId: string, rawPrediction: any): Promise<PlaceResult | null> => {
      const placesLib = (window as any).google.maps.places;

      let place: any;
      if (rawPrediction?.toPlace) {
        place = rawPrediction.toPlace();
      } else {
        place = new placesLib.Place({ id: placeId });
      }

      await place.fetchFields({
        fields: ['addressComponents', 'formattedAddress', 'location', 'id'],
      });

      sessionToken.current = new placesLib.AutocompleteSessionToken();

      return {
        placeId: place.id || placeId,
        formattedAddress: place.formattedAddress || '',
        addressComponents: parseNewApiComponents(place.addressComponents || []),
        latitude: place.location?.lat?.() ?? place.location?.lat ?? 0,
        longitude: place.location?.lng?.() ?? place.location?.lng ?? 0,
      };
    },
    [],
  );

  // ── LEGACY API: get place details ──
  const getLegacyDetails = useCallback(
    (placeId: string): Promise<PlaceResult | null> => {
      return new Promise((resolve) => {
        if (!legacyPlacesService.current) { resolve(null); return; }

        legacyPlacesService.current.getDetails(
          { placeId, fields: ['address_components', 'geometry', 'formatted_address'] },
          (place: any, status: string) => {
            if (status !== 'OK' || !place) { resolve(null); return; }

            const addr = parseLegacyComponents(place.address_components || []);
            resolve({
              placeId,
              formattedAddress: place.formatted_address || '',
              addressComponents: addr,
              latitude: place.geometry?.location?.lat?.() ?? 0,
              longitude: place.geometry?.location?.lng?.() ?? 0,
            });
          },
        );
      });
    },
    [],
  );

  // ── Public: get place details (dispatches to correct API) ──
  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<PlaceResult | null> => {
      if (!isLoaded) return null;

      try {
        if (apiMode.current === 'new') {
          const rawPrediction = predictions.find((p) => p.place_id === placeId)?._raw;
          return await getNewApiDetails(placeId, rawPrediction);
        }
        return await getLegacyDetails(placeId);
      } catch (err: any) {
        console.warn('Place details error:', err);
        // Refresh session token even on error (new API only)
        if (apiMode.current === 'new') {
          try {
            sessionToken.current = new (window as any).google.maps.places.AutocompleteSessionToken();
          } catch (_) { /* ignore */ }
        }
        return null;
      }
    },
    [isLoaded, predictions, getNewApiDetails, getLegacyDetails],
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
