// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS MAP VIEW
// Interactive OpenStreetMap with Leaflet showing business locations as pins.
// Leaflet is loaded via CDN (no npm dependency required).
// Supports: pin markers, info popups, "Near Me" geolocation, cluster-free design.
// Cross-browser: Chrome, Safari, Firefox desktop + iOS Safari + Android Chrome.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Loader2, X, Star, Phone, Globe, ExternalLink } from 'lucide-react';
import type { Business, BusinessState } from '@/reducers/businessReducer';

// ── Types ──

interface BusinessMapViewProps {
  businesses: Business[];
  userLocation: { lat: number; lng: number } | null;
  geolocating: boolean;
  onRequestGeolocation: () => void;
  onSelectBusiness: (business: Business) => void;
}

// Default center: Salt Lake City, Utah area
const DEFAULT_CENTER: [number, number] = [40.7608, -111.891];
const DEFAULT_ZOOM = 11;

// ── Leaflet CDN loader ──

let leafletLoaded = false;
let leafletLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadLeaflet(): Promise<void> {
  if (leafletLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    if (leafletLoading) {
      loadCallbacks.push(resolve);
      return;
    }
    leafletLoading = true;

    // Load CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Load JS
    if (!(window as any).L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.crossOrigin = '';
      script.onload = () => {
        leafletLoaded = true;
        leafletLoading = false;
        resolve();
        loadCallbacks.forEach((cb) => cb());
        loadCallbacks.length = 0;
      };
      script.onerror = () => {
        leafletLoading = false;
        resolve(); // Resolve anyway so UI can show error state
      };
      document.head.appendChild(script);
    } else {
      leafletLoaded = true;
      leafletLoading = false;
      resolve();
    }
  });
}

// ── Known Utah business coordinates (fallback for businesses without lat/lng) ──

const UTAH_LOCATIONS: Record<string, [number, number]> = {
  'south salt lake': [40.7188, -111.8883],
  'salt lake city': [40.7608, -111.891],
  'south jordan': [40.5622, -111.9297],
  'sugar house': [40.7231, -111.8579],
  'sandy': [40.5649, -111.8389],
  'draper': [40.5246, -111.8638],
  'murray': [40.6669, -111.8879],
  'west jordan': [40.6097, -111.9391],
  'orem': [40.2969, -111.6946],
  'provo': [40.2338, -111.6585],
  'ogden': [41.223, -111.9738],
  'layton': [41.0602, -111.9711],
  'lehi': [40.3916, -111.8508],
  'bountiful': [40.8893, -111.8808],
  'taylorsville': [40.6677, -111.9388],
  'riverton': [40.5219, -111.9391],
  'herriman': [40.5142, -112.0328],
  'midvale': [40.6111, -111.8999],
  'cottonwood heights': [40.6197, -111.8102],
  'holladay': [40.6688, -111.8246],
  'millcreek': [40.6866, -111.8755],
  'west valley city': [40.6916, -112.0011],
};

function getBusinessCoords(biz: Business): [number, number] | null {
  if (biz.latitude && biz.longitude) return [biz.latitude, biz.longitude];

  // Try to match known locations from the location string
  const loc = (biz.location || '').toLowerCase();
  for (const [key, coords] of Object.entries(UTAH_LOCATIONS)) {
    if (loc.includes(key)) {
      // Add small random offset so pins don't stack
      const jitter = () => (Math.random() - 0.5) * 0.008;
      return [coords[0] + jitter(), coords[1] + jitter()];
    }
  }
  return null;
}

// ── Category colors for pins ──

const CATEGORY_COLORS: Record<string, string> = {
  'Restaurant': '#EF4444',
  'Restaurant & Food': '#EF4444',
  'Grocery': '#22C55E',
  'Technology': '#3B82F6',
  'Healthcare': '#06B6D4',
  'Beauty & Wellness': '#EC4899',
  'Non-Profit': '#8B5CF6',
  'Non-Profit Organizations': '#8B5CF6',
  'Financial Services': '#F59E0B',
  'Real Estate': '#6366F1',
  'Jewelry': '#D97706',
  'Hotels': '#0EA5E9',
  'Henna': '#F97316',
  'Legal': '#64748B',
  'Tiffin': '#DC2626',
  'Travel': '#14B8A6',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#6366F1';
}

// ── Component ──

const BusinessMapView: React.FC<BusinessMapViewProps> = ({
  businesses,
  userLocation,
  geolocating,
  onRequestGeolocation,
  onSelectBusiness,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<Business | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      await loadLeaflet();
      if (cancelled || !mapContainerRef.current) return;

      const L = (window as any).L;
      if (!L) {
        setError('Failed to load map library. Check your internet connection.');
        setLoading(false);
        return;
      }

      // Don't reinitialize if map already exists
      if (mapInstanceRef.current) {
        setLoading(false);
        return;
      }

      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: true,
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add zoom control to top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
      setLoading(false);

      // Force a resize after mount (fixes Safari rendering issue)
      setTimeout(() => map.invalidateSize(), 100);
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when businesses change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds: [number, number][] = [];

    businesses.forEach((biz) => {
      const coords = getBusinessCoords(biz);
      if (!coords) return;

      bounds.push(coords);
      const color = getCategoryColor(biz.category);

      // Custom SVG marker
      const icon = L.divIcon({
        className: 'custom-business-marker',
        html: `<div style="
          width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
          background: ${color}; transform: rotate(-45deg);
          display: flex; align-items: center; justify-content: center;
          border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
        ">
          <span style="transform: rotate(45deg); font-size: 14px; line-height: 1;">${biz.emoji || '📍'}</span>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const marker = L.marker(coords, { icon });

      marker.on('click', () => {
        setSelectedPin(biz);
      });

      marker.addTo(map);
      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [businesses]);

  // Update user location marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const icon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="
          width: 16px; height: 16px; border-radius: 50%;
          background: #3B82F6; border: 3px solid white;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.2);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon }).addTo(map);
      map.setView([userLocation.lat, userLocation.lng], 13, { animate: true });
    }
  }, [userLocation]);

  const handleViewBusiness = useCallback(() => {
    if (selectedPin) {
      onSelectBusiness(selectedPin);
      setSelectedPin(null);
    }
  }, [selectedPin, onSelectBusiness]);

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-xl overflow-hidden border border-aurora-border"
        role="application"
        aria-label="Map showing business locations"
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-aurora-surface/80 flex items-center justify-center rounded-xl z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-sm text-aurora-text-secondary">Loading map...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 bg-aurora-surface flex items-center justify-center rounded-xl z-10">
          <div className="flex flex-col items-center gap-2 text-center p-6">
            <MapPin className="w-10 h-10 text-aurora-text-muted" />
            <p className="text-sm text-aurora-text-secondary">{error}</p>
          </div>
        </div>
      )}

      {/* Near Me button */}
      <button
        onClick={onRequestGeolocation}
        disabled={geolocating}
        className="absolute bottom-4 right-4 z-20 bg-aurora-surface shadow-lg rounded-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-aurora-text hover:bg-aurora-surface-variant transition-colors border border-aurora-border focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none disabled:opacity-50"
        aria-label="Find businesses near my location"
      >
        {geolocating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Navigation className="w-4 h-4 text-indigo-500" />
        )}
        {geolocating ? 'Locating...' : 'Near Me'}
      </button>

      {/* Business count badge */}
      <div className="absolute top-4 left-4 z-20 bg-aurora-surface/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-aurora-text-secondary border border-aurora-border shadow-sm">
        <MapPin className="w-3 h-3 inline-block mr-1 -mt-0.5" />
        {businesses.filter((b) => getBusinessCoords(b) !== null).length} of {businesses.length} on map
      </div>

      {/* Selected business popup card */}
      {selectedPin && (
        <div
          className="absolute bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-30 bg-aurora-surface rounded-xl shadow-2xl border border-aurora-border overflow-hidden"
          role="dialog"
          aria-label={`Business info: ${selectedPin.name}`}
        >
          {/* Header with photo */}
          <div className="relative h-28">
            {selectedPin.photos?.[selectedPin.coverPhotoIndex ?? 0] ? (
              <img
                src={selectedPin.photos[selectedPin.coverPhotoIndex ?? 0]}
                alt={selectedPin.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-4xl"
                style={{ backgroundColor: selectedPin.bgColor || '#E0E7FF' }}
              >
                {selectedPin.emoji || '🏢'}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <button
              onClick={() => setSelectedPin(null)}
              className="absolute top-2 right-2 bg-black/40 text-white p-1 rounded-full hover:bg-black/60 transition-colors"
              aria-label="Close business info"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-2 left-3 right-3">
              <h3 className="text-white font-semibold text-sm truncate">{selectedPin.name}</h3>
              <p className="text-white/80 text-xs">{selectedPin.category}</p>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="text-sm font-medium">{selectedPin.rating}</span>
                <span className="text-xs text-aurora-text-muted">({selectedPin.reviews})</span>
              </div>
              <span className="text-xs text-aurora-text-muted">{selectedPin.location}</span>
            </div>

            {selectedPin.desc && (
              <p className="text-xs text-aurora-text-secondary line-clamp-2">{selectedPin.desc}</p>
            )}

            <div className="flex gap-2">
              {selectedPin.phone && (
                <a
                  href={`tel:${selectedPin.phone}`}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                  aria-label={`Call ${selectedPin.name}`}
                >
                  <Phone className="w-3 h-3" />
                  Call
                </a>
              )}
              {selectedPin.website && (
                <a
                  href={selectedPin.website.startsWith('http') ? selectedPin.website : `https://${selectedPin.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                  aria-label={`Visit ${selectedPin.name} website`}
                >
                  <Globe className="w-3 h-3" />
                  Website
                </a>
              )}
            </div>

            <button
              onClick={handleViewBusiness}
              className="w-full mt-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BusinessMapView);
