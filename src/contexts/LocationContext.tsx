import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { US_STATES_CITIES, ZIP_TO_CITY_STATE } from '../constants/config';

// US state name ↔ abbreviation mapping for flexible matching
const STATE_ABBR_MAP: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
};

// Reverse map: abbreviation → full name
const ABBR_STATE_MAP: Record<string, string> = {};
Object.entries(STATE_ABBR_MAP).forEach(([name, abbr]) => {
  ABBR_STATE_MAP[abbr.toLowerCase()] = name;
});

function getStateAbbr(state: string): string {
  if (!state) return '';
  const lower = state.toLowerCase().trim();
  if (lower.length === 2 && ABBR_STATE_MAP[lower]) return state.toUpperCase();
  return STATE_ABBR_MAP[lower] || state;
}

function getStateFull(state: string): string {
  if (!state) return '';
  const lower = state.toLowerCase().trim();
  if (STATE_ABBR_MAP[lower]) return state;
  const full = ABBR_STATE_MAP[lower];
  if (full) return full.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return state;
}

function cleanZip(zip: string): string {
  return (zip || '').replace(/[^0-9]/g, '').slice(0, 5);
}

// Get states list from US_STATES_CITIES
const AVAILABLE_STATES = Object.keys(US_STATES_CITIES).sort();

export interface LocationData {
  city: string;
  state: string;      // Full state name (e.g., "Utah")
  stateAbbr: string;  // 2-letter abbreviation (e.g., "UT")
  zip: string;        // 5-digit zip
}

interface LocationContextType {
  selectedLocation: LocationData | null;
  allStates: string[];
  citiesForState: (state: string) => string[];
  setSelectedLocation: (location: LocationData | null) => void;
  setLocationByZip: (zip: string) => Promise<boolean>;
  setLocationByGeo: () => Promise<void>;
  setLocationByStateCity: (state: string, city: string) => void;
  clearLocation: () => void;
}

const LocationContext = createContext<LocationContextType>({
  selectedLocation: null,
  allStates: AVAILABLE_STATES,
  citiesForState: () => [],
  setSelectedLocation: () => {},
  setLocationByZip: async () => false,
  setLocationByGeo: async () => {},
  setLocationByStateCity: () => {},
  clearLocation: () => {},
});

export const useLocation = () => useContext(LocationContext);

async function lookupZipCode(zip: string): Promise<LocationData | null> {
  const cleanedZip = cleanZip(zip);
  if (cleanedZip.length < 5) return null;

  try {
    const response = await fetch(`https://api.zippopotam.us/us/${cleanedZip}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.places && data.places.length > 0) {
        const place = data.places[0];
        const city = place['place name'] || '';
        const stateFull = place['state'] || '';
        const stateAbbr = place['state abbreviation'] || getStateAbbr(stateFull);
        return { city, state: stateFull, stateAbbr, zip: cleanedZip };
      }
    }
  } catch (_err) {}

  const local = ZIP_TO_CITY_STATE[cleanedZip];
  if (local) {
    return {
      city: local.city,
      state: local.state,
      stateAbbr: getStateAbbr(local.state),
      zip: cleanedZip,
    };
  }

  return null;
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

  const citiesForState = useCallback((state: string) => {
    return state ? (US_STATES_CITIES[state] || []) : [];
  }, []);

  const setLocationByZip = useCallback(async (zip: string): Promise<boolean> => {
    const result = await lookupZipCode(zip);
    if (result) {
      setSelectedLocation(result);
      return true;
    }
    return false;
  }, []);

  const setLocationByGeo = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
                { headers: { 'User-Agent': 'ethniCityApp/1.0' } }
              );
              const data = await response.json();
              const address = data.address;

              if (address) {
                const rawZip = address.postcode || '';
                const zip = cleanZip(rawZip);

                if (zip && zip.length === 5) {
                  const apiResult = await lookupZipCode(zip);
                  if (apiResult) {
                    setSelectedLocation(apiResult);
                    resolve();
                    return;
                  }
                }

                const city = address.city || address.town || address.village || address.county || '';
                const state = address.state || '';
                const stateAbbr = address['ISO3166-2-lvl4']?.replace('US-', '') || getStateAbbr(state);

                if (city) {
                  setSelectedLocation({
                    city,
                    state: state || getStateFull(stateAbbr),
                    stateAbbr: stateAbbr || getStateAbbr(state),
                    zip,
                  });
                  resolve();
                  return;
                }
              }
              reject(new Error('Could not determine city from your location'));
            } catch (_err) {
              reject(new Error('Failed to reverse geocode your location'));
            }
          },
          (_err) => {
            reject(new Error('Location access denied. Please enter a zip code instead.'));
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      });
    } else {
      throw new Error('Geolocation is not available on this device');
    }
  }, []);

  const setLocationByStateCity = useCallback((state: string, city: string) => {
    setSelectedLocation({
      city,
      state,
      stateAbbr: getStateAbbr(state),
      zip: '',
    });
  }, []);

  const clearLocation = useCallback(() => {
    setSelectedLocation(null);
  }, []);

  const value = useMemo(
    () => ({
      selectedLocation,
      allStates: AVAILABLE_STATES,
      citiesForState,
      setSelectedLocation,
      setLocationByZip,
      setLocationByGeo,
      setLocationByStateCity,
      clearLocation,
    }),
    [selectedLocation, citiesForState, setLocationByZip, setLocationByGeo, setLocationByStateCity, clearLocation]
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}
