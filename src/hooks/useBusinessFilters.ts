// ═════════════════════════════════════════════════════════════════════════════════
// useBusinessFilters — Search, category, heritage filtering + debounce
// Phase 2 Step 4: Extract from business.tsx
// #38: Added distance-based sorting ("nearest") using Haversine formula
// ═════════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef } from 'react';
import { fuzzyMatch } from '@/components/business/businessValidation';
import { getDistanceMiles } from '@/components/business/businessUtils';
import type { BusinessState, BusinessAction, Business } from '@/reducers/businessReducer';

// ── Distance cache to avoid recalculating per render ─────────────────────────
// Key = `${businessId}_${lat}_${lng}`, Value = distance in miles
const distanceCache = new Map<string, number>();

export function getBusinessDistance(
  business: Business,
  userLocation: { lat: number; lng: number } | null,
): number | null {
  if (!userLocation || business.latitude == null || business.longitude == null) return null;
  const key = `${business.id}_${userLocation.lat}_${userLocation.lng}`;
  if (distanceCache.has(key)) return distanceCache.get(key)!;
  const d = getDistanceMiles(userLocation.lat, userLocation.lng, business.latitude, business.longitude);
  distanceCache.set(key, d);
  return d;
}

export function useBusinessFilters(
  state: BusinessState,
  dispatch: React.Dispatch<BusinessAction>,
) {
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounce search query ──
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      dispatch({ type: 'SET_DEBOUNCED_SEARCH', payload: state.searchQuery });
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [state.searchQuery, dispatch]);

  // ── Filtered businesses ──
  const filteredBusinesses = useMemo(() => {
    let filtered = state.businesses.filter((b) => {
      if (state.mutedBusinesses.has(b.id)) return false;
      if (b.ownerId && state.blockedUsers.has(b.ownerId)) return false;
      return true;
    });
    if (state.selectedCategory !== 'All') {
      filtered = filtered.filter((b) => b.category === state.selectedCategory);
    }
    if (state.selectedHeritage.length > 0) {
      filtered = filtered.filter((b) => {
        if (Array.isArray(b.heritage)) return b.heritage.some((h: string) => state.selectedHeritage.includes(h));
        return b.heritage ? state.selectedHeritage.includes(b.heritage) : false;
      });
    }
    if (state.debouncedSearchQuery.trim()) {
      filtered = filtered.filter(
        (b) =>
          fuzzyMatch(b.name, state.debouncedSearchQuery) ||
          fuzzyMatch(b.category, state.debouncedSearchQuery) ||
          fuzzyMatch(b.location, state.debouncedSearchQuery) ||
          fuzzyMatch(b.desc, state.debouncedSearchQuery)
      );
    }

    // Smart discovery sorting
    if (state.activeCollection === 'topRated') {
      filtered = filtered.sort((a, b) => b.rating - a.rating);
    } else if (state.activeCollection === 'new') {
      filtered = filtered.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    } else if (state.activeCollection === 'mostReviewed') {
      filtered = filtered.sort((a, b) => b.reviews - a.reviews);
    } else if (state.activeCollection === 'favorites') {
      filtered = filtered.filter((b) => state.favorites.has(b.id));
    } else if (state.activeCollection === 'following') {
      filtered = filtered.filter((b) => state.following.has(b.id));
    } else if (state.activeCollection === 'nearest') {
      // Sort by distance from user location — businesses without coordinates go to the end
      if (state.userLocation) {
        filtered = filtered.sort((a, b) => {
          const distA = getBusinessDistance(a, state.userLocation);
          const distB = getBusinessDistance(b, state.userLocation);
          if (distA == null && distB == null) return 0;
          if (distA == null) return 1;
          if (distB == null) return -1;
          return distA - distB;
        });
      }
    } else {
      filtered = filtered.sort((a, b) => {
        if (a.promoted && !b.promoted) return -1;
        if (!a.promoted && b.promoted) return 1;
        return b.rating - a.rating;
      });
    }
    return filtered;
  }, [state.businesses, state.selectedCategory, state.selectedHeritage, state.debouncedSearchQuery, state.activeCollection, state.favorites, state.following, state.mutedBusinesses, state.blockedUsers, state.userLocation]);

  // ── Featured businesses ──
  const featuredBusinesses = useMemo(() => {
    let featured = state.businesses.filter((b) => b.promoted);
    if (state.selectedCategory !== 'All') {
      featured = featured.filter((b) => b.category === state.selectedCategory);
    }
    if (state.selectedHeritage.length > 0) {
      featured = featured.filter((b) => {
        if (Array.isArray(b.heritage)) return b.heritage.some((h: string) => state.selectedHeritage.includes(h));
        return b.heritage ? state.selectedHeritage.includes(b.heritage) : false;
      });
    }
    return featured;
  }, [state.businesses, state.selectedCategory, state.selectedHeritage]);

  // ── Category counts ──
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    state.businesses.forEach((b) => {
      counts[b.category] = (counts[b.category] || 0) + 1;
    });
    return counts;
  }, [state.businesses]);

  return {
    filteredBusinesses,
    featuredBusinesses,
    categoryCounts,
  };
}
