// ═════════════════════════════════════════════════════════════════════════════════
// GOOGLE PLACES AUTOCOMPLETE HOOK
// Loads Google Maps JS API on demand and provides address autocomplete.
//
// Strategy: tries the modern "Places API (New)" first (AutocompleteSuggestion).
// If that API isn't available, falls back to the legacy AutocompleteService.
// This ensures autocomplete works regardless of which API variant is enabled
// in the Google Cloud Console.
//
// Cross-browser: Chrome, Safari (desktop + iOS), Firefox, Android Chrome.
// ═════════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

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

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  _raw?: any;
}

// ── Helpers ──

function gm(): any { return (window as any).google?.maps; }
function gp(): any { return gm()?.places; }

function hasNewAPI(): boolean {
  try { return typeof gp()?.AutocompleteSuggestion?.fetchAutocompleteSuggestions === 'function'; }
  catch { return false; }
}

function hasLegacyAPI(): boolean {
  try { return typeof gp()?.AutocompleteService === 'function'; }
  catch { return false; }
}

function safeText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val.text === 'string') return val.text;
  return String(val);
}

// ── Script loader (singleton) ──

let loadPromise: Promise<void> | null = null;

/**
 * Poll until google.maps is truly ready (importLibrary exists or places namespace is populated).
 * With `loading=async`, `script.onload` fires before google.maps is fully bootstrapped.
 */
function waitForGoogleMaps(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already ready?
    if (gm()?.importLibrary || gp()?.AutocompleteService) {
      resolve();
      return;
    }
    const start = Date.now();
    const check = () => {
      if (gm()?.importLibrary || gp()?.AutocompleteService) {
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error('Google Maps failed to initialize after script load'));
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (loadPromise) return loadPromise;

  // Already fully ready
  if (gm()?.importLibrary || gp()?.AutocompleteService) {
    return Promise.resolve();
  }

  // Another part of the app may have injected the script already
  const existing = document.querySelector(
    'script[src*="maps.googleapis.com/maps/api/js"]',
  ) as HTMLScriptElement | null;

  if (existing) {
    loadPromise = new Promise<void>((resolve, reject) => {
      // Already loaded?
      if (gm()) { waitForGoogleMaps().then(resolve, reject); return; }
      existing.addEventListener('load', () => waitForGoogleMaps().then(resolve, reject));
      existing.addEventListener('error', () => { loadPromise = null; reject(new Error('Google Maps script failed')); });
    });
    return loadPromise;
  }

  // Inject new script
  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => waitForGoogleMaps().then(resolve, reject);
    script.onerror = () => { loadPromise = null; reject(new Error('Failed to load Google Maps script')); };
    document.head.appendChild(script);
  });

  return loadPromise;
}

// ── Address component parsers ──

function parseNewComponents(components: any[]): AddressComponents {
  if (!Array.isArray(components)) return { street: '', city: '', state: '', zip: '', country: '' };
  const get = (t: string) => components.find((c: any) => c.types?.includes(t))?.longText || '';
  const getS = (t: string) => components.find((c: any) => c.types?.includes(t))?.shortText || '';
  const num = get('street_number'), route = get('route');
  return {
    street: num ? `${num} ${route}` : route,
    city: get('locality') || get('sublocality_level_1') || get('administrative_area_level_2'),
    state: getS('administrative_area_level_1'),
    zip: get('postal_code'),
    country: getS('country'),
  };
}

function parseLegacyComponents(components: any[]): AddressComponents {
  if (!Array.isArray(components)) return { street: '', city: '', state: '', zip: '', country: '' };
  const get = (t: string) => { const c = components.find((x: any) => x.types?.includes(t)); return c?.long_name || c?.short_name || ''; };
  const getS = (t: string) => { const c = components.find((x: any) => x.types?.includes(t)); return c?.short_name || c?.long_name || ''; };
  const num = get('street_number'), route = get('route');
  return {
    street: num ? `${num} ${route}` : route,
    city: get('locality') || get('sublocality_level_1') || get('administrative_area_level_2'),
    state: getS('administrative_area_level_1'),
    zip: get('postal_code'),
    country: getS('country'),
  };
}

// ── Hook ──

export function useGooglePlaces({ apiKey, country, types }: UseGooglePlacesOptions) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const sessionToken = useRef<any>(null);
  const apiMode = useRef<'new' | 'legacy' | null>(null);
  const legacySvc = useRef<any>(null);
  const legacyPlacesSvc = useRef<any>(null);

  // ── Load script + initialize ──
  useEffect(() => {
    if (!apiKey) { setLoadError('No Google Maps API key provided'); return; }

    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled && !isLoaded) {
        setLoadError('Google Places took too long to load. Please enter address manually.');
      }
    }, 15_000);

    (async () => {
      try {
        await loadGoogleMapsScript(apiKey);
        if (cancelled) return;

        // Import the places library (required for loading=async scripts)
        if (typeof gm()?.importLibrary === 'function') {
          await gm().importLibrary('places');
        }

        if (cancelled) return;

        // Determine which API variant is available
        if (hasNewAPI()) {
          apiMode.current = 'new';
          sessionToken.current = new (gp().AutocompleteSessionToken as any)();
        } else if (hasLegacyAPI()) {
          apiMode.current = 'legacy';
          legacySvc.current = new (gp().AutocompleteService as any)();
          const el = document.createElement('div');
          legacyPlacesSvc.current = new (gp().PlacesService as any)(el);
        } else {
          throw new Error(
            'Places API not available. Enable "Places API" or "Places API (New)" in Google Cloud Console.',
          );
        }

        setIsLoaded(true);
      } catch (err: any) {
        if (!cancelled) {
          console.warn('Google Places init error:', err);
          setLoadError(err.message || 'Failed to load Google Places');
        }
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Predictions (new API) ──
  const fetchNew = useCallback(async (input: string): Promise<PlacePrediction[]> => {
    const req: any = {
      input,
      sessionToken: sessionToken.current,
      includedPrimaryTypes: types || ['street_address', 'premise', 'subpremise', 'route', 'geocode'],
      ...(country && { includedRegionCodes: [country.toLowerCase()] }),
    };
    const { suggestions } = await gp().AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
    return (suggestions || []).filter((s: any) => s.placePrediction).map((s: any) => {
      const p = s.placePrediction;
      return {
        place_id: p.placeId || p.place_id || '',
        description: safeText(p.text),
        structured_formatting: { main_text: safeText(p.mainText), secondary_text: safeText(p.secondaryText) },
        _raw: p,
      };
    });
  }, [country, types]);

  // ── Predictions (legacy API) ──
  const fetchLegacy = useCallback((input: string): Promise<PlacePrediction[]> => {
    return new Promise((resolve) => {
      if (!legacySvc.current) { resolve([]); return; }
      legacySvc.current.getPlacePredictions(
        { input, types: ['address'], ...(country && { componentRestrictions: { country: country.toLowerCase() } }) },
        (res: any[] | null, status: string) => {
          if (status === 'OK' && res) {
            resolve(res.slice(0, 5).map((r: any) => ({
              place_id: r.place_id,
              description: r.description,
              structured_formatting: { main_text: r.structured_formatting?.main_text || r.description, secondary_text: r.structured_formatting?.secondary_text || '' },
            })));
          } else { resolve([]); }
        },
      );
    });
  }, [country]);

  // ── Public: getPlacePredictions ──
  const getPlacePredictions = useCallback(async (input: string) => {
    if (!isLoaded || !input.trim()) { setPredictions([]); return; }
    setIsSearching(true);
    try {
      const results = apiMode.current === 'new' ? await fetchNew(input) : await fetchLegacy(input);
      setPredictions(results);
    } catch (err) {
      console.warn('Places autocomplete error:', err);
      setPredictions([]);
    } finally {
      setIsSearching(false);
    }
  }, [isLoaded, fetchNew, fetchLegacy]);

  // ── Details (new API) ──
  const detailsNew = useCallback(async (placeId: string, raw: any): Promise<PlaceResult | null> => {
    let place: any;
    if (raw?.toPlace) { place = raw.toPlace(); }
    else { place = new (gp().Place as any)({ id: placeId }); }
    await place.fetchFields({ fields: ['addressComponents', 'formattedAddress', 'location', 'id'] });
    sessionToken.current = new (gp().AutocompleteSessionToken as any)();
    return {
      placeId: place.id || placeId,
      formattedAddress: place.formattedAddress || '',
      addressComponents: parseNewComponents(place.addressComponents || []),
      latitude: place.location?.lat?.() ?? place.location?.lat ?? 0,
      longitude: place.location?.lng?.() ?? place.location?.lng ?? 0,
    };
  }, []);

  // ── Details (legacy API) ──
  const detailsLegacy = useCallback((placeId: string): Promise<PlaceResult | null> => {
    return new Promise((resolve) => {
      if (!legacyPlacesSvc.current) { resolve(null); return; }
      legacyPlacesSvc.current.getDetails(
        { placeId, fields: ['address_components', 'geometry', 'formatted_address'] },
        (place: any, status: string) => {
          if (status !== 'OK' || !place) { resolve(null); return; }
          resolve({
            placeId,
            formattedAddress: place.formatted_address || '',
            addressComponents: parseLegacyComponents(place.address_components || []),
            latitude: place.geometry?.location?.lat?.() ?? 0,
            longitude: place.geometry?.location?.lng?.() ?? 0,
          });
        },
      );
    });
  }, []);

  // ── Public: getPlaceDetails ──
  const getPlaceDetails = useCallback(async (placeId: string): Promise<PlaceResult | null> => {
    if (!isLoaded) return null;
    try {
      if (apiMode.current === 'new') {
        const raw = predictions.find((p) => p.place_id === placeId)?._raw;
        return await detailsNew(placeId, raw);
      }
      return await detailsLegacy(placeId);
    } catch (err) {
      console.warn('Place details error:', err);
      if (apiMode.current === 'new') {
        try { sessionToken.current = new (gp().AutocompleteSessionToken as any)(); } catch {}
      }
      return null;
    }
  }, [isLoaded, predictions, detailsNew, detailsLegacy]);

  const clearPredictions = useCallback(() => setPredictions([]), []);

  return { isLoaded, loadError, predictions, isSearching, getPlacePredictions, getPlaceDetails, clearPredictions };
}
