// ═════════════════════════════════════════════════════════════════════════════════
// GOOGLE PLACES AUTOCOMPLETE HOOK
// Loads Google Maps JS API on demand, provides address autocomplete suggestions,
// and parses place details into structured address components.
// ═════════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Google Maps type declarations (avoids @types/google.maps dependency) ──
declare namespace google.maps {
  class LatLng { lat(): number; lng(): number; }
  interface GeocoderAddressComponent { long_name: string; short_name: string; types: string[]; }
  namespace places {
    class AutocompleteService { getPlacePredictions(req: any, cb: (results: any, status: any) => void): void; }
    class PlacesService { constructor(el: HTMLElement); getDetails(req: any, cb: (place: any, status: any) => void): void; }
    class AutocompleteSessionToken {}
    interface AutocompletePrediction { place_id: string; description: string; structured_formatting?: { main_text?: string; secondary_text?: string }; }
    interface AutocompletionRequest { input: string; sessionToken?: any; types?: string[]; componentRestrictions?: any; }
    const PlacesServiceStatus: { OK: string };
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

// ── Script loader (singleton) ──

let scriptLoadPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  if (typeof google !== 'undefined' && google.maps?.places) {
    return Promise.resolve();
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
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

// ── Parse address components from Google Place result ──

function parseAddressComponents(
  components: any[],
): AddressComponents {
  const get = (type: string): string =>
    components.find((c) => c.types.includes(type))?.long_name || '';
  const getShort = (type: string): string =>
    components.find((c) => c.types.includes(type))?.short_name || '';

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

// ── Hook ──

export function useGooglePlaces({ apiKey, country, types }: UseGooglePlacesOptions) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);
  const sessionToken = useRef<any>(null);
  const dummyDiv = useRef<HTMLDivElement | null>(null);

  // Load the script
  useEffect(() => {
    if (!apiKey) return;

    loadGoogleMapsScript(apiKey)
      .then(() => {
        autocompleteService.current = new google.maps.places.AutocompleteService();
        // PlacesService needs a DOM element (hidden)
        if (!dummyDiv.current) {
          dummyDiv.current = document.createElement('div');
        }
        placesService.current = new google.maps.places.PlacesService(dummyDiv.current);
        sessionToken.current = new google.maps.places.AutocompleteSessionToken();
        setIsLoaded(true);
      })
      .catch((err) => {
        setLoadError(err.message);
      });
  }, [apiKey]);

  // Get autocomplete predictions
  const getPlacePredictions = useCallback(
    (input: string) => {
      if (!autocompleteService.current || !input.trim()) {
        setPredictions([]);
        return;
      }

      setIsSearching(true);

      const request: any = {
        input,
        sessionToken: sessionToken.current!,
        types: types || ['address'],
        ...(country && {
          componentRestrictions: { country: country.toLowerCase() },
        }),
      };

      autocompleteService.current.getPlacePredictions(request, (results: any, status: any) => {
        setIsSearching(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results);
        } else {
          setPredictions([]);
        }
      });
    },
    [country, types],
  );

  // Get full place details from a prediction
  const getPlaceDetails = useCallback(
    (placeId: string): Promise<PlaceResult | null> => {
      return new Promise((resolve) => {
        if (!placesService.current) {
          resolve(null);
          return;
        }

        placesService.current.getDetails(
          {
            placeId,
            fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
            sessionToken: sessionToken.current!,
          },
          (place: any, status: any) => {
            // Refresh session token after getDetails (per Google billing best practices)
            sessionToken.current = new google.maps.places.AutocompleteSessionToken();

            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              const addressComponents = parseAddressComponents(
                place.address_components || [],
              );
              resolve({
                placeId: place.place_id || placeId,
                formattedAddress: place.formatted_address || '',
                addressComponents,
                latitude: place.geometry?.location?.lat() || 0,
                longitude: place.geometry?.location?.lng() || 0,
              });
            } else {
              resolve(null);
            }
          },
        );
      });
    },
    [],
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
