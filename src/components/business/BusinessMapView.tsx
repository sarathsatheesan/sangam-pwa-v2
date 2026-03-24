// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS MAP VIEW
// Interactive OpenStreetMap with Leaflet showing business locations as pins.
// Leaflet is loaded via CDN (no npm dependency required).
// Supports: pin markers, native popups, hover tooltips, "Near Me" geolocation.
// Cross-browser: Chrome, Safari, Firefox desktop + iOS Safari + Android Chrome.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import type { Business } from '@/reducers/businessReducer';

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
        resolve();
      };
      document.head.appendChild(script);
    } else {
      leafletLoaded = true;
      leafletLoading = false;
      resolve();
    }
  });
}

// ── Inject custom popup styles into head (once) ──

let popupStylesInjected = false;
function injectPopupStyles() {
  if (popupStylesInjected) return;
  popupStylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .biz-popup .leaflet-popup-content-wrapper {
      border-radius: 12px;
      padding: 0;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(0,0,0,0.18);
      min-width: 240px;
      max-width: 280px;
    }
    .biz-popup .leaflet-popup-content {
      margin: 0;
      width: 100% !important;
    }
    .biz-popup .leaflet-popup-tip {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .biz-popup-header {
      position: relative;
      height: 100px;
      overflow: hidden;
    }
    .biz-popup-header img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .biz-popup-header-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
    }
    .biz-popup-header-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px 10px 6px;
      background: linear-gradient(transparent, rgba(0,0,0,0.65));
    }
    .biz-popup-header-overlay h3 {
      color: white;
      font-size: 13px;
      font-weight: 600;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .biz-popup-header-overlay p {
      color: rgba(255,255,255,0.8);
      font-size: 11px;
      margin: 0;
    }
    .biz-popup-body {
      padding: 10px 12px 12px;
    }
    .biz-popup-rating {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 6px;
    }
    .biz-popup-rating .star {
      color: #F59E0B;
      font-size: 13px;
    }
    .biz-popup-rating .score {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }
    .biz-popup-rating .count {
      font-size: 11px;
      color: #94a3b8;
    }
    .biz-popup-location {
      font-size: 11px;
      color: #64748b;
      margin-left: auto;
    }
    .biz-popup-desc {
      font-size: 11px;
      color: #475569;
      margin-bottom: 8px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .biz-popup-links {
      display: flex;
      gap: 10px;
      margin-bottom: 8px;
    }
    .biz-popup-links a {
      font-size: 11px;
      color: #4F46E5;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .biz-popup-links a:hover {
      color: #3730A3;
    }
    .biz-popup-btn {
      width: 100%;
      padding: 8px 0;
      background: #4F46E5;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    .biz-popup-btn:hover {
      background: #4338CA;
    }
    .leaflet-tooltip.biz-tooltip {
      background: #1e293b;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .leaflet-tooltip.biz-tooltip::before {
      border-top-color: #1e293b;
    }
    .custom-business-marker {
      background: none !important;
      border: none !important;
    }
    .custom-business-marker:hover {
      z-index: 1000 !important;
    }
    .custom-business-marker div {
      transition: transform 0.15s ease;
    }
    .custom-business-marker:hover div {
      transform: rotate(-45deg) scale(1.15) !important;
    }
  `;
  document.head.appendChild(style);
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

  const loc = (biz.location || '').toLowerCase();
  for (const [key, coords] of Object.entries(UTAH_LOCATIONS)) {
    if (loc.includes(key)) {
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

// ── Build popup HTML for a business ──

function buildPopupHTML(biz: Business, index: number): string {
  const coverPhoto = biz.photos?.[biz.coverPhotoIndex ?? 0];
  const websiteUrl = biz.website
    ? biz.website.startsWith('http') ? biz.website : `https://${biz.website}`
    : '';

  const headerHTML = coverPhoto
    ? `<img src="${coverPhoto}" alt="${biz.name}" loading="lazy" />`
    : `<div class="biz-popup-header-placeholder" style="background:${biz.bgColor || '#E0E7FF'}">${biz.emoji || '🏢'}</div>`;

  const descHTML = biz.desc
    ? `<div class="biz-popup-desc">${biz.desc}</div>`
    : '';

  const linksHTML = [
    biz.phone ? `<a href="tel:${biz.phone}">📞 Call</a>` : '',
    websiteUrl ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer">🌐 Website</a>` : '',
  ].filter(Boolean).join('');

  return `
    <div class="biz-popup-header">
      ${headerHTML}
      <div class="biz-popup-header-overlay">
        <h3>${biz.name}</h3>
        <p>${biz.category}</p>
      </div>
    </div>
    <div class="biz-popup-body">
      <div class="biz-popup-rating">
        <span class="star">★</span>
        <span class="score">${biz.rating ?? '–'}</span>
        <span class="count">(${biz.reviews ?? 0})</span>
        <span class="biz-popup-location">${biz.location || ''}</span>
      </div>
      ${descHTML}
      ${linksHTML ? `<div class="biz-popup-links">${linksHTML}</div>` : ''}
      <button class="biz-popup-btn" data-biz-index="${index}">
        ↗ View Details
      </button>
    </div>
  `;
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
  const bizIndexMapRef = useRef<Map<number, Business>>(new Map());
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      injectPopupStyles();
      await loadLeaflet();
      if (cancelled || !mapContainerRef.current) return;

      const L = (window as any).L;
      if (!L) {
        setError('Failed to load map library. Check your internet connection.');
        setLoading(false);
        return;
      }

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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
      setLoading(false);
      setMapReady(true);

      // Safari rendering fix
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

  // Delegated click handler for "View Details" buttons inside Leaflet popups
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('.biz-popup-btn') as HTMLElement | null;
      if (!btn) return;
      const idx = Number(btn.dataset.bizIndex);
      const biz = bizIndexMapRef.current.get(idx);
      if (biz) {
        onSelectBusiness(biz);
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [onSelectBusiness]);

  // Update markers when businesses change or map becomes ready
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    bizIndexMapRef.current.clear();

    const bounds: [number, number][] = [];

    businesses.forEach((biz, index) => {
      const coords = getBusinessCoords(biz);
      if (!coords) return;

      bounds.push(coords);
      bizIndexMapRef.current.set(index, biz);
      const color = getCategoryColor(biz.category);

      // Custom teardrop marker with category emoji
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
        popupAnchor: [0, -34],
      });

      const marker = L.marker(coords, { icon });

      // Native Leaflet popup with rich business card
      marker.bindPopup(buildPopupHTML(biz, index), {
        className: 'biz-popup',
        maxWidth: 280,
        minWidth: 240,
        closeButton: true,
        autoPan: true,
        autoPanPadding: L.point(40, 40),
      });

      // Hover tooltip showing business name
      marker.bindTooltip(biz.name, {
        className: 'biz-tooltip',
        direction: 'top',
        offset: L.point(0, -34),
      });

      marker.addTo(map);
      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [businesses, mapReady]);

  // Update user location marker
  useEffect(() => {
    if (!mapReady) return;
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
  }, [userLocation, mapReady]);

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
    </div>
  );
};

export default React.memo(BusinessMapView);
