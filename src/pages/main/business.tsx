import React, { useState, useEffect, useRef, useCallback, useReducer, useMemo, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  Search, MapPin, Phone, Star, X, Plus, Heart, Sparkles, Store,
  Filter, Loader2, TrendingUp, Map, List, Navigation, UserPlus, Upload, Clock,
} from 'lucide-react';
import { useFeatureSettings } from '@/contexts/FeatureSettingsContext';
import EthnicityFilterDropdown from '@/components/EthnicityFilterDropdown';
import {
  CATEGORIES, CATEGORY_ICONS,
} from '@/components/business/businessConstants';
import { businessReducer, createInitialState, type Business } from '@/reducers/businessReducer';
import { useBusinessData } from '@/hooks/useBusinessData';
import { useBusinessFilters, getBusinessDistance } from '@/hooks/useBusinessFilters';
import { useBusinessModeration } from '@/hooks/useBusinessModeration';
import { useBusinessReviews } from '@/hooks/useBusinessReviews';

// ── Extracted components (Phase 2 Step 7) ──
import BusinessCard from '@/components/business/BusinessCard';
import FeaturedCarousel from '@/components/business/FeaturedCarousel';
import BusinessDetailModal from '@/components/business/BusinessDetailModal';
import BusinessEditModal from '@/components/business/BusinessEditModal';
import BusinessCreateModal from '@/components/business/BusinessCreateModal';
import {
  TinVerificationModal,
  DeleteConfirmModal,
  ContextMenu,
  ReportModal,
  BlockConfirmModal,
} from '@/components/business/BusinessModals';
import { recordFavorite } from '@/services/businessAnalytics';

// Lazy-load map view (loads Leaflet CDN on demand)
const BusinessMapView = lazy(() => import('@/components/business/BusinessMapView'));
// Lazy-load CSV import modal (#37)
const BusinessCSVImport = lazy(() => import('@/components/business/BusinessCSVImport'));
// Lazy-load virtualized grid (#40)
const VirtualizedBusinessGrid = lazy(() => import('@/components/business/VirtualizedBusinessGrid'));

// ═════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════════

export default function BusinessPage() {
  const { user, userRole, userProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, dispatch] = useReducer(businessReducer, undefined, createInitialState);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const { isFeatureEnabled } = useFeatureSettings();
  const photosEnabled = isFeatureEnabled('business_photos');
  const merchantView = false; // My Businesses moved to Profile page
  const menuRef = useRef<HTMLDivElement>(null);
  const [showCSVImport, setShowCSVImport] = useState(false);

  // ── #42: Autocomplete state ──
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Blur guard: prevents autocomplete from closing when tapping suggestions on iOS Safari
  // When the user taps a suggestion, the input blurs — we use this flag to ignore that blur
  const blurGuardRef = useRef(false);

  // ── Custom hooks (Phase 2 Steps 3-6) ──
  const {
    loadMoreRef, toggleFavorite, handleOpenCreateModal, handleAddBusiness,
    handleDeleteBusiness, confirmDeleteBusiness, handleStartEdit, handleSaveEdit, PAGE_SIZE,
  } = useBusinessData(state, dispatch, user, userRole, userProfile);

  const { filteredBusinesses, featuredBusinesses, categoryCounts } = useBusinessFilters(state, dispatch);

  const { openReportModal, handleSubmitReport, handleBlockUser, openBlockConfirm } = useBusinessModeration(state, dispatch, user, userProfile);

  const { handleAddReview } = useBusinessReviews(state, dispatch, user, userProfile);

  // ── #42: Recent searches (persisted in localStorage) ──
  const RECENT_SEARCHES_KEY = 'ethniCity_recent_business_searches';
  const MAX_RECENT = 5;

  const getRecentSearches = useCallback((): string[] => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }, []);

  const addRecentSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    try {
      const recent = getRecentSearches().filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      recent.unshift(trimmed);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
    } catch { /* localStorage full or unavailable */ }
  }, [getRecentSearches]);

  const clearRecentSearches = useCallback(() => {
    try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch { /* noop */ }
  }, []);

  // ── #42: Autocomplete suggestions ──
  const autocompleteSuggestions = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return { categories: [] as string[], businesses: [] as Business[], recent: getRecentSearches() };

    // Category matches
    const categories = CATEGORIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 3);

    // Business name/location matches (top 5)
    const businesses = state.businesses
      .filter((b) =>
        b.name.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q) ||
        (b.specialtyTags || []).some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, 5);

    // Recent searches that match
    const recent = getRecentSearches().filter((s) => s.toLowerCase().includes(q));

    return { categories, businesses, recent };
  }, [state.searchQuery, state.businesses, getRecentSearches]);

  const hasAutocompleteSuggestions = showAutocomplete && (
    autocompleteSuggestions.categories.length > 0 ||
    autocompleteSuggestions.businesses.length > 0 ||
    autocompleteSuggestions.recent.length > 0
  );

  // Close autocomplete when clicking/tapping outside (mousedown + touchstart for iOS Safari)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        autocompleteRef.current && !autocompleteRef.current.contains(target) &&
        searchInputRef.current && !searchInputRef.current.contains(target)
      ) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Apply a search suggestion
  const applySearchSuggestion = useCallback((value: string, type: 'category' | 'text') => {
    if (type === 'category') {
      dispatch({ type: 'SET_SELECTED_CATEGORY', payload: value });
      dispatch({ type: 'SET_SEARCH_QUERY', payload: '' });
    } else {
      dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
      addRecentSearch(value);
    }
    setShowAutocomplete(false);
    searchInputRef.current?.blur();
  }, [dispatch, addRecentSearch]);

  // ── Context menu (memoized) ──
  const openMenu = useCallback((businessId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (state.menuBusinessId === businessId) {
      dispatch({ type: 'CLOSE_MENU' });
      return;
    }
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    dispatch({ type: 'OPEN_MENU', payload: { businessId, position: { top: rect.bottom + 4, right: window.innerWidth - rect.right } } });
  }, [state.menuBusinessId, dispatch]);

  const closeMenu = useCallback(() => {
    dispatch({ type: 'CLOSE_MENU' });
  }, [dispatch]);

  // ── Select business handler (memoized for card/carousel) ──
  const handleSelectBusiness = useCallback((business: Business) => {
    dispatch({ type: 'SELECT_BUSINESS', payload: business });
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'about' });
  }, [dispatch]);

  // ── Geolocation handler (cross-browser: Chrome, Safari, Firefox, iOS Safari, Android Chrome) ──
  const handleRequestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      dispatch({ type: 'SET_TOAST', payload: 'Geolocation is not supported by your browser.' });
      return;
    }

    // HTTPS check — geolocation requires secure context (except localhost)
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      dispatch({ type: 'SET_TOAST', payload: 'Location requires a secure (HTTPS) connection.' });
      return;
    }

    dispatch({ type: 'SET_GEOLOCATING', payload: true });

    // Detect iOS for platform-specific error messages
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const onSuccess = (position: GeolocationPosition) => {
      dispatch({
        type: 'SET_USER_LOCATION',
        payload: { lat: position.coords.latitude, lng: position.coords.longitude },
      });
      dispatch({ type: 'SET_TOAST', payload: 'Location found! Showing nearest businesses.' });
    };

    const getErrorMessage = (error: GeolocationPositionError): string => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          return isIOS
            ? 'Location access denied. Open Settings → Privacy & Security → Location Services and enable it for your browser.'
            : 'Location access denied. Please allow location access in your browser settings and try again.';
        case error.POSITION_UNAVAILABLE:
          return isIOS
            ? 'Could not determine your location. Check that Location Services is enabled in Settings → Privacy & Security.'
            : 'Unable to determine your location. Check that location/GPS is enabled on your device.';
        case error.TIMEOUT:
          return ''; // Handled by fallback below
        default:
          return 'Could not get your location. Please try again.';
      }
    };

    // Safety-net timeout for Firefox (dismissing the prompt doesn't always trigger the error callback)
    // and for general hanging — 20s total max wait
    const safetyTimeout = setTimeout(() => {
      dispatch({ type: 'SET_GEOLOCATING', payload: false });
      dispatch({ type: 'SET_TOAST', payload: 'Location request timed out. Please check your browser permissions and try again.' });
    }, 20000);

    const clearSafety = () => clearTimeout(safetyTimeout);

    // Phase 1: Try high-accuracy (GPS) — works great on most devices
    // But iOS Safari can timeout on GPS cold start, so we use a shorter timeout
    // and fall back to low-accuracy (Wi-Fi/cell tower) if it fails
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearSafety();
        onSuccess(position);
      },
      (error) => {
        // If it's a timeout, try again with low accuracy (Wi-Fi/cell tower)
        // This is critical for iOS Safari where GPS cold start can take >10s
        if (error.code === error.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              clearSafety();
              onSuccess(position);
            },
            (fallbackError) => {
              clearSafety();
              dispatch({ type: 'SET_GEOLOCATING', payload: false });
              const msg = getErrorMessage(fallbackError);
              dispatch({ type: 'SET_TOAST', payload: msg || 'Location request timed out. Please check that location services are enabled and try again.' });
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
          );
          return;
        }
        // Non-timeout error — show appropriate message
        clearSafety();
        dispatch({ type: 'SET_GEOLOCATING', payload: false });
        dispatch({ type: 'SET_TOAST', payload: getErrorMessage(error) });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  }, [dispatch]);

  // ── Map view business selection ──
  const handleMapSelectBusiness = useCallback((business: Business) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: 'list' });
    dispatch({ type: 'SELECT_BUSINESS', payload: business });
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'about' });
  }, [dispatch]);

  // ── Follow/Unfollow business ──
  const toggleFollow = useCallback(async (businessId: string) => {
    if (!user?.uid) return;
    const isFollowing = state.following.has(businessId);
    dispatch({ type: 'TOGGLE_FOLLOW', payload: businessId });
    try {
      const bizRef = doc(db, 'businesses', businessId);
      if (isFollowing) {
        await updateDoc(bizRef, {
          followers: arrayRemove(user.uid),
          followerCount: increment(-1),
        });
      } else {
        await updateDoc(bizRef, {
          followers: arrayUnion(user.uid),
          followerCount: increment(1),
        });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      dispatch({ type: 'TOGGLE_FOLLOW', payload: businessId }); // revert on failure
    }
  }, [user?.uid, state.following, dispatch]);

  // ── Save deals for a business ──
  const handleSaveDeals = useCallback(async (businessId: string, deals: import('@/reducers/businessReducer').Deal[]) => {
    try {
      const bizRef = doc(db, 'businesses', businessId);
      // Sanitize deals — Firestore rejects undefined values
      const sanitized = deals.map((d) => {
        const clean: Record<string, any> = { id: d.id, title: d.title };
        if (d.description != null) clean.description = d.description;
        if (d.discount != null) clean.discount = d.discount;
        if (d.code != null) clean.code = d.code;
        if (d.expiresAt != null) clean.expiresAt = d.expiresAt;
        return clean;
      });
      await updateDoc(bizRef, { deals: sanitized });
      // Update local state
      const biz = state.businesses.find((b) => b.id === businessId);
      if (biz) {
        dispatch({ type: 'UPDATE_BUSINESS', payload: { ...biz, deals } });
      }
      dispatch({ type: 'SET_TOAST', payload: 'Deals updated successfully!' });
    } catch (err) {
      console.error('Failed to save deals:', err);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to save deals. Please try again.' });
    }
  }, [state.businesses, dispatch]);

  // ── Admin: Toggle business verification ──
  const handleVerifyToggle = useCallback(async (biz: Business) => {
    const newVerified = !biz.verified;
    try {
      const bizRef = doc(db, 'businesses', biz.id);
      if (newVerified) {
        await updateDoc(bizRef, {
          verified: true,
          verifiedAt: new Date(),
          verificationMethod: 'admin',
        });
      } else {
        await updateDoc(bizRef, {
          verified: false,
          verifiedAt: null,
          verificationMethod: null,
        });
      }
      dispatch({ type: 'UPDATE_BUSINESS', payload: { ...biz, verified: newVerified, verifiedAt: newVerified ? new Date() : null, verificationMethod: newVerified ? 'admin' : undefined } });
      dispatch({ type: 'SET_TOAST', payload: newVerified ? `${biz.name} has been verified!` : `Verification removed from ${biz.name}` });
    } catch (err) {
      console.error('Failed to toggle verification:', err);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to update verification. Please try again.' });
    }
  }, [dispatch]);

  // ── Load following state on mount ──
  useEffect(() => {
    if (!user?.uid || state.businesses.length === 0) return;
    const followedIds = new Set<string>();
    for (const biz of state.businesses) {
      if (biz.followers?.includes(user.uid)) {
        followedIds.add(biz.id);
      }
    }
    if (followedIds.size > 0) {
      dispatch({ type: 'SET_FOLLOWING', payload: followedIds });
    }
  }, [user?.uid, state.businesses.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-dismiss toast ──
  useEffect(() => {
    if (state.toastMessage) {
      const t = setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 3500);
      return () => clearTimeout(t);
    }
  }, [state.toastMessage, dispatch]);

  // ── Deep-link: open specific business from profile activity ──
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && state.businesses.length > 0) {
      const found = state.businesses.find((b: any) => b.id === openId);
      if (found) {
        dispatch({ type: 'SELECT_BUSINESS', payload: found });
        dispatch({ type: 'SET_ACTIVE_TAB', payload: 'about' });
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, state.businesses, setSearchParams, dispatch]);

  // ── Derived values ──
  const canAddBusiness = userRole === 'admin' || userRole === 'business_owner' || userProfile?.accountType === 'business';
  const isOwnerOrAdmin = useCallback((b: Business) => b.ownerId === user?.uid || userRole === 'admin', [user?.uid, userRole]);
  const ownedBusinesses = state.businesses.filter((b) => b.ownerId === user?.uid || userRole === 'admin');

  // Skeleton card
  const SkeletonCard = () => (
    <div className="bg-aurora-surface rounded-2xl border border-aurora-border overflow-hidden animate-pulse" aria-hidden="true">
      <div className="h-36 bg-aurora-surface-variant shimmer" />
      <div className="p-4">
        <div className="h-4 w-3/4 bg-aurora-surface-variant shimmer rounded mb-2" />
        <div className="h-3 w-1/2 bg-aurora-surface-variant shimmer rounded mb-3" />
        <div className="flex gap-2">
          <div className="h-3 w-16 bg-aurora-surface-variant shimmer rounded" />
          <div className="h-3 w-20 bg-aurora-surface-variant shimmer rounded" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-aurora-bg">
      {/* ─── Sticky Header: Search + Category ─── */}
      <div className="sticky top-0 z-20 bg-aurora-surface shadow-sm">
      {/* ── Search & Filter Bar ── */}
      <div className="relative bg-gradient-to-br from-aurora-indigo/8 via-aurora-surface to-emerald-500/8 border-b border-aurora-border z-30">
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-3">
          {!merchantView && (
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-muted z-10" />
                <input
                  ref={searchInputRef}
                  type="search"
                  aria-label="Search businesses"
                  aria-expanded={hasAutocompleteSuggestions}
                  aria-autocomplete="list"
                  aria-controls="business-autocomplete"
                  placeholder="Search restaurants, services, markets..."
                  value={state.searchQuery}
                  onChange={(e) => {
                    dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value });
                    setShowAutocomplete(true);
                  }}
                  onFocus={() => {
                    dispatch({ type: 'SET_SEARCH_FOCUSED', payload: true });
                    setShowAutocomplete(true);
                  }}
                  onBlur={() => {
                    dispatch({ type: 'SET_SEARCH_FOCUSED', payload: false });
                    // Delay closing autocomplete so tap/click on suggestion can register first
                    // This is critical for iOS Safari where blur fires before click
                    if (!blurGuardRef.current) {
                      setTimeout(() => {
                        if (!blurGuardRef.current) setShowAutocomplete(false);
                      }, 200);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setShowAutocomplete(false); searchInputRef.current?.blur(); }
                    if (e.key === 'Enter' && state.searchQuery.trim()) {
                      addRecentSearch(state.searchQuery.trim());
                      setShowAutocomplete(false);
                    }
                  }}
                  className={`w-full pl-11 pr-10 py-2.5 bg-aurora-surface border rounded-full
                             text-sm text-aurora-text placeholder:text-aurora-text-muted
                             focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all
                             ${state.searchFocused ? 'border-aurora-indigo shadow-md' : 'border-aurora-border'}`}
                />
                {state.searchQuery && (
                  <button
                    onClick={() => { dispatch({ type: 'SET_SEARCH_QUERY', payload: '' }); setShowAutocomplete(false); }}
                    aria-label="Clear search"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none rounded-full z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* ── #42: Autocomplete Dropdown (cross-browser: Chrome, Safari, Firefox, iOS Safari, Android Chrome) ── */}
                {hasAutocompleteSuggestions && (
                  <div
                    ref={autocompleteRef}
                    id="business-autocomplete"
                    role="listbox"
                    // Set blur guard on any interaction start — prevents input onBlur from closing dropdown
                    // before onClick fires. Uses both mouse and touch events for cross-browser support.
                    onMouseDown={() => { blurGuardRef.current = true; }}
                    onTouchStart={() => { blurGuardRef.current = true; }}
                    className="absolute top-full left-0 right-0 mt-1 bg-aurora-surface border border-aurora-border rounded-xl shadow-lg overflow-hidden z-50 max-h-[320px] overflow-y-auto"
                  >
                    {/* Recent Searches */}
                    {autocompleteSuggestions.recent.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-aurora-text-muted">Recent</span>
                          {!state.searchQuery && (
                            <button
                              onClick={() => { blurGuardRef.current = false; clearRecentSearches(); setShowAutocomplete(false); }}
                              className="text-[10px] text-aurora-text-muted hover:text-red-500 transition-colors"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        {autocompleteSuggestions.recent.map((term) => (
                          <button
                            key={`recent-${term}`}
                            role="option"
                            onClick={() => { blurGuardRef.current = false; applySearchSuggestion(term, 'text'); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-aurora-text hover:bg-aurora-surface-variant active:bg-aurora-surface-variant transition-colors text-left"
                          >
                            <Clock className="w-3.5 h-3.5 text-aurora-text-muted flex-shrink-0" />
                            <span className="truncate">{term}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Category Suggestions */}
                    {autocompleteSuggestions.categories.length > 0 && (
                      <div>
                        <div className="px-3 pt-2.5 pb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-aurora-text-muted">Categories</span>
                        </div>
                        {autocompleteSuggestions.categories.map((cat) => (
                          <button
                            key={`cat-${cat}`}
                            role="option"
                            onClick={() => { blurGuardRef.current = false; applySearchSuggestion(cat, 'category'); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-aurora-text hover:bg-aurora-surface-variant active:bg-aurora-surface-variant transition-colors text-left"
                          >
                            <Filter className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            <span className="truncate">{cat}</span>
                            {categoryCounts[cat] != null && (
                              <span className="ml-auto text-[10px] text-aurora-text-muted bg-aurora-surface-variant px-1.5 py-0.5 rounded-full">{categoryCounts[cat]}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Business Name Matches */}
                    {autocompleteSuggestions.businesses.length > 0 && (
                      <div>
                        <div className="px-3 pt-2.5 pb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-aurora-text-muted">Businesses</span>
                        </div>
                        {autocompleteSuggestions.businesses.map((biz) => (
                          <button
                            key={`biz-${biz.id}`}
                            role="option"
                            onClick={() => {
                              blurGuardRef.current = false;
                              setShowAutocomplete(false);
                              addRecentSearch(biz.name);
                              handleSelectBusiness(biz);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-aurora-text hover:bg-aurora-surface-variant active:bg-aurora-surface-variant transition-colors text-left"
                          >
                            <span className="text-base flex-shrink-0">{biz.emoji}</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{biz.name}</div>
                              <div className="truncate text-[11px] text-aurora-text-muted">{biz.category} · {biz.location}</div>
                            </div>
                            {biz.verified && (
                              <span className="text-[10px] text-blue-500 font-semibold flex-shrink-0">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* EthniZity Dropdown */}
              <EthnicityFilterDropdown
                selected={state.selectedHeritage}
                onChange={(heritage) => dispatch({ type: 'SET_SELECTED_HERITAGE', payload: heritage })}
              />
            </div>
          )}
        </div>
      </div>
      </div>{/* end sticky header wrapper */}

      {!merchantView && (
          <div className="bg-aurora-surface/95 backdrop-blur-md border-b border-aurora-border">
            <div className="max-w-6xl mx-auto px-4">
              <div
                ref={categoryScrollRef}
                role="tablist"
                aria-label="Business categories"
                className="flex gap-1 py-3 overflow-x-auto hide-scrollbar"
              >
                {/* All */}
                <button
                  role="tab"
                  aria-selected={state.selectedCategory === 'All'}
                  onClick={() => dispatch({ type: 'SET_SELECTED_CATEGORY', payload: 'All' })}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[64px] flex-shrink-0 transition-all focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none ${state.selectedCategory === 'All'
                      ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 text-white shadow-md'
                      : 'text-aurora-text-secondary hover:bg-aurora-surface-variant'
                  }`}
                >
                  <Store className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[11px] font-medium whitespace-nowrap">All</span>
                </button>
                {CATEGORIES.map((cat) => {
                  const IconComp = CATEGORY_ICONS[cat] || Store;
                  const count = categoryCounts[cat] || 0;
                  return (
                    <button
                      key={cat}
                      role="tab"
                      aria-selected={state.selectedCategory === cat}
                      onClick={() => dispatch({ type: 'SET_SELECTED_CATEGORY', payload: cat })}
                      className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[64px] flex-shrink-0 transition-all focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none ${state.selectedCategory === cat
                          ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 text-white shadow-md'
                          : 'text-aurora-text-secondary hover:bg-aurora-surface-variant'
                      }`}
                    >
                      <IconComp className="w-5 h-5" aria-hidden="true" />
                      <span className="text-[11px] font-medium whitespace-nowrap">{cat.split(' & ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Smart Discovery Collections */}
            <div className="border-t border-aurora-border bg-aurora-surface">
              <div className="max-w-6xl mx-auto px-4 py-3">
                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                  {(['all', 'topRated', 'new', 'mostReviewed', 'nearest', 'favorites', 'following'] as const).map((collection) => {
                    const labels: Record<string, string> = {
                      all: 'All',
                      topRated: 'Top Rated',
                      new: 'New',
                      mostReviewed: 'Most Reviewed',
                      nearest: 'Nearest',
                      favorites: 'Favorites',
                      following: 'Following',
                    };
                    return (
                      <button
                        key={collection}
                        aria-pressed={state.activeCollection === collection}
                        onClick={() => {
                          dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: collection });
                          // Auto-trigger geolocation when "Nearest" is tapped and we don't have location yet
                          if (collection === 'nearest' && !state.userLocation && !state.geolocating) {
                            handleRequestGeolocation();
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none ${state.activeCollection === collection
                            ? 'bg-aurora-indigo text-white'
                            : 'bg-aurora-surface-variant text-aurora-text-secondary hover:text-aurora-text'
                        }`}
                      >
                        {collection === 'topRated' && <TrendingUp className="w-3 h-3" />}
                        {collection === 'nearest' && <Navigation className="w-3 h-3" />}
                        {collection === 'favorites' && <Heart className="w-3 h-3" />}
                        {collection === 'following' && <UserPlus className="w-3 h-3" />}
                        {labels[collection]}
                        {collection === 'nearest' && state.geolocating && <Loader2 className="w-3 h-3 animate-spin" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
      )}

      {!merchantView && (
        <>
          {/* ── Content ── */}
          <div className="max-w-6xl mx-auto px-4 py-5 pb-4">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-aurora-text-secondary" aria-live="polite" aria-atomic="true">
                {state.loading ? 'Loading...' : (
                  <>
                    <span className="font-semibold text-aurora-text">{filteredBusinesses.length}</span>
                    {' '}business{filteredBusinesses.length !== 1 ? 'es' : ''}
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                {/* Map / List Toggle */}
                <div className="flex bg-aurora-surface-variant rounded-lg p-0.5 border border-aurora-border" role="radiogroup" aria-label="View mode">
                  <button
                    role="radio"
                    aria-checked={state.viewMode === 'list'}
                    onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'list' })}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none ${
                      state.viewMode === 'list'
                        ? 'bg-aurora-surface text-aurora-text shadow-sm'
                        : 'text-aurora-text-muted hover:text-aurora-text'
                    }`}
                    aria-label="Grid view"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">List</span>
                  </button>
                  <button
                    role="radio"
                    aria-checked={state.viewMode === 'map'}
                    onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'map' })}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none ${
                      state.viewMode === 'map'
                        ? 'bg-aurora-surface text-aurora-text shadow-sm'
                        : 'text-aurora-text-muted hover:text-aurora-text'
                    }`}
                    aria-label="Map view"
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Map</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Active Filter Chips (#25) ── */}
            {(() => {
              const hasCategory = state.selectedCategory !== 'All';
              const hasHeritage = state.selectedHeritage.length > 0;
              const hasSearch = state.debouncedSearchQuery.trim().length > 0;
              const hasCollection = state.activeCollection !== 'all';
              const collectionLabels: Record<string, string> = { topRated: 'Top Rated', new: 'New', mostReviewed: 'Most Reviewed', nearest: 'Nearest', favorites: 'Favorites', following: 'Following' };
              const anyActive = hasCategory || hasHeritage || hasSearch || hasCollection;
              if (!anyActive) return null;
              const chipCount = (hasCategory ? 1 : 0) + (hasSearch ? 1 : 0) + (hasCollection ? 1 : 0) + state.selectedHeritage.length;
              return (
                <div className="flex items-center gap-2 mb-3 flex-wrap" role="list" aria-label="Active filters">
                  {hasSearch && (
                    <span role="listitem" className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                      <Search className="w-3 h-3" aria-hidden="true" />
                      <span className="max-w-[120px] truncate">&ldquo;{state.debouncedSearchQuery.trim()}&rdquo;</span>
                      <button
                        onClick={() => dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                        aria-label={`Remove search filter "${state.debouncedSearchQuery.trim()}"`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {hasCategory && (
                    <span role="listitem" className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {(() => { const IC = CATEGORY_ICONS[state.selectedCategory]; return IC ? <IC className="w-3 h-3" aria-hidden="true" /> : null; })()}
                      {state.selectedCategory}
                      <button
                        onClick={() => dispatch({ type: 'SET_SELECTED_CATEGORY', payload: 'All' })}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                        aria-label={`Remove category filter "${state.selectedCategory}"`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {state.selectedHeritage.map((h) => (
                    <span key={h} role="listitem" className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                      {h}
                      <button
                        onClick={() => dispatch({ type: 'SET_SELECTED_HERITAGE', payload: state.selectedHeritage.filter((x) => x !== h) })}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
                        aria-label={`Remove heritage filter "${h}"`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {hasCollection && (
                    <span role="listitem" className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {state.activeCollection === 'favorites' && <Heart className="w-3 h-3" aria-hidden="true" />}
                      {state.activeCollection === 'following' && <UserPlus className="w-3 h-3" aria-hidden="true" />}
                      {state.activeCollection === 'topRated' && <TrendingUp className="w-3 h-3" aria-hidden="true" />}
                      {state.activeCollection === 'nearest' && <Navigation className="w-3 h-3" aria-hidden="true" />}
                      {collectionLabels[state.activeCollection] || state.activeCollection}
                      <button
                        onClick={() => dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: 'all' })}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                        aria-label={`Remove "${collectionLabels[state.activeCollection]}" sort`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {chipCount > 1 && (
                    <button
                      onClick={() => {
                        dispatch({ type: 'SET_SELECTED_CATEGORY', payload: 'All' });
                        dispatch({ type: 'SET_SELECTED_HERITAGE', payload: [] });
                        dispatch({ type: 'SET_SEARCH_QUERY', payload: '' });
                        dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: 'all' });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-aurora-text-muted hover:text-aurora-text hover:bg-aurora-surface-variant border border-aurora-border transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none"
                      aria-label="Clear all filters"
                    >
                      <X className="w-3 h-3" />
                      Clear all
                    </button>
                  )}
                </div>
              );
            })()}

            {/* ── Map View ── */}
            {state.viewMode === 'map' && !state.loading && (
              <Suspense fallback={
                <div className="flex items-center justify-center py-20 gap-2 text-aurora-text-muted">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading map...
                </div>
              }>
                <BusinessMapView
                  businesses={filteredBusinesses}
                  userLocation={state.userLocation}
                  geolocating={state.geolocating}
                  onRequestGeolocation={handleRequestGeolocation}
                  onSelectBusiness={handleMapSelectBusiness}
                />
              </Suspense>
            )}

            {/* ── List View ── */}
            {state.viewMode === 'list' && (
              <>
                {/* Featured Carousel */}
                {featuredBusinesses.length > 0 && !state.searchQuery && (
                  <FeaturedCarousel
                    businesses={featuredBusinesses}
                    favorites={state.favorites}
                    toggleFavorite={toggleFavorite}
                    onSelect={handleSelectBusiness}
                    getDistance={state.userLocation ? (b) => getBusinessDistance(b, state.userLocation) : undefined}
                  />
                )}
              </>
            )}

            {state.viewMode === 'list' && state.loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : state.viewMode === 'list' && state.activeCollection === 'nearest' && !state.userLocation ? (
              /* Nearest selected but no location yet — show waiting/permission state */
              <div className="flex flex-col items-center justify-center py-16 text-center" role="status">
                <div className="w-24 h-24 mb-5">
                  <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <circle cx="48" cy="38" r="20" className="stroke-aurora-text-muted fill-aurora-surface-variant" strokeWidth="2.5" />
                    <path d="M48 58C48 58 24 44 24 30C24 20 35 14 48 14C61 14 72 20 72 30C72 44 48 58 48 58Z" className="stroke-aurora-text-muted" strokeWidth="2.5" strokeLinejoin="round" />
                    <circle cx="48" cy="32" r="6" className="stroke-aurora-border" strokeWidth="2" />
                  </svg>
                </div>
                {state.geolocating ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-5 h-5 animate-spin text-aurora-indigo" />
                      <h3 className="text-lg font-semibold text-aurora-text">Finding your location...</h3>
                    </div>
                    <p className="text-sm text-aurora-text-secondary max-w-xs">
                      Please allow location access when your browser asks. This helps us show you the nearest businesses.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-aurora-text mb-1">Location needed</h3>
                    <p className="text-sm text-aurora-text-secondary max-w-xs mb-4">
                      We need your location to sort businesses by distance. Tap the button below to try again.
                    </p>
                    <button
                      onClick={handleRequestGeolocation}
                      className="px-5 py-2.5 bg-aurora-indigo text-white rounded-xl font-medium text-sm
                                 hover:bg-aurora-indigo/90 shadow-sm flex items-center gap-2 mx-auto"
                    >
                      <Navigation className="w-4 h-4" />
                      Enable Location
                    </button>
                  </>
                )}
              </div>
            ) : state.viewMode === 'list' && filteredBusinesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center" role="status">
                {/* Contextual SVG illustration */}
                <div className="w-24 h-24 mb-5">
                  {state.searchQuery ? (
                    <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <circle cx="42" cy="42" r="28" className="stroke-aurora-text-muted" strokeWidth="3" strokeDasharray="6 4" />
                      <line x1="62" y1="62" x2="82" y2="82" className="stroke-aurora-text-muted" strokeWidth="3" strokeLinecap="round" />
                      <line x1="34" y1="36" x2="50" y2="48" className="stroke-aurora-border" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1="50" y1="36" x2="34" y2="48" className="stroke-aurora-border" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  ) : state.activeCollection === 'favorites' ? (
                    <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M48 80S16 60 16 36c0-12 10-20 20-20a22 22 0 0 1 12 4 22 22 0 0 1 12-4c10 0 20 8 20 20 0 24-32 44-32 44Z" className="stroke-aurora-text-muted fill-aurora-surface-variant" strokeWidth="2.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <rect x="16" y="32" width="64" height="44" rx="6" className="stroke-aurora-text-muted fill-aurora-surface-variant" strokeWidth="2.5" />
                      <rect x="24" y="20" width="48" height="16" rx="4" className="stroke-aurora-border" strokeWidth="2" strokeDasharray="4 3" />
                      <circle cx="48" cy="54" r="10" className="stroke-aurora-border" strokeWidth="2" />
                      <path d="M48 49v10M43 54h10" className="stroke-aurora-text-muted" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-aurora-text mb-1">
                  {state.searchQuery ? 'No results found'
                    : state.activeCollection === 'favorites' ? 'No favorites yet'
                    : state.activeCollection === 'following' ? 'Not following anyone yet'
                    : 'No businesses found'}
                </h3>
                <p className="text-sm text-aurora-text-secondary max-w-xs">
                  {state.searchQuery ? `We couldn't find anything matching "${state.searchQuery}". Try different keywords or browse categories.`
                    : state.activeCollection === 'favorites' ? 'Heart the businesses you love and they will appear here.'
                    : state.activeCollection === 'following' ? 'Follow businesses to get updates and see them here.'
                    : state.selectedHeritage.length > 0
                    ? `No businesses under "${state.selectedHeritage.join(', ')}" heritage yet. Be the first to add one!`
                    : state.selectedCategory !== 'All'
                    ? `No businesses in "${state.selectedCategory}" yet. Know one? Add it!`
                    : 'No businesses listed yet. Be the first to share your favorite local spot!'}
                </p>
                <div className="flex gap-3 mt-5">
                  {state.searchQuery && (
                    <button
                      onClick={() => dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })}
                      className="px-4 py-2 border border-aurora-border text-aurora-text-secondary rounded-xl font-medium text-sm hover:bg-aurora-surface-variant transition-colors"
                    >
                      Clear Search
                    </button>
                  )}
                  {canAddBusiness && (
                    <button
                      onClick={handleOpenCreateModal}
                      className="px-5 py-2 bg-aurora-indigo text-white rounded-xl font-medium text-sm
                                 hover:bg-aurora-indigo/90 shadow-sm flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Add Business
                    </button>
                  )}
                </div>
              </div>
            ) : state.viewMode === 'list' ? (
              <Suspense fallback={
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              }>
                <VirtualizedBusinessGrid
                  businesses={filteredBusinesses}
                  favorites={state.favorites}
                  toggleFavorite={toggleFavorite}
                  openMenu={openMenu}
                  onSelect={handleSelectBusiness}
                  user={user}
                  getDistanceMiles={state.userLocation ? (b: Business) => getBusinessDistance(b, state.userLocation) : undefined}
                />
              </Suspense>
            ) : null}

            {/* Infinite scroll sentinel (list view only) */}
            {state.viewMode === 'list' && <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
              {state.loadingMore && (
                <div className="flex items-center gap-2 text-aurora-text-muted text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading more businesses...
                </div>
              )}
              {!state.hasMore && state.businesses.length > PAGE_SIZE && (
                <p className="text-xs text-aurora-text-muted py-4">You've reached the end</p>
              )}
            </div>}
          </div>
        </>
      )}

      {/* Merchant Dashboard View */}
      {merchantView && canAddBusiness && (
        <div className="max-w-6xl mx-auto px-4 py-5 pb-4">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-aurora-text">Your Businesses</h2>
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-aurora-indigo text-white rounded-xl
                           font-medium text-sm hover:bg-aurora-indigo/90 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add New
              </button>
            </div>

            {ownedBusinesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-aurora-surface rounded-2xl border border-aurora-border">
                <Store className="w-12 h-12 text-aurora-text-muted mb-3" />
                <p className="text-aurora-text font-medium mb-1">No businesses yet</p>
                <p className="text-sm text-aurora-text-secondary mb-4">Create your first business listing</p>
                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 bg-aurora-indigo text-white rounded-xl font-medium text-sm hover:bg-aurora-indigo/90"
                >
                  <Plus className="w-4 h-4 inline mr-1.5" /> Add Business
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ownedBusinesses.map((business) => (
                  <div key={business.id} className="bg-aurora-surface rounded-2xl border border-aurora-border p-4 hover:shadow-lg transition-all">
                    {business.photos && business.photos.length > 0 && (
                      <div className="relative h-28 -mx-4 -mt-4 mb-3 rounded-t-2xl overflow-hidden">
                        <img
                          src={business.photos[business.coverPhotoIndex || 0]}
                          alt={business.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{business.emoji}</div>
                        <div>
                          <h3 className="font-bold text-aurora-text">{business.name}</h3>
                          <p className="text-xs text-aurora-text-muted">{business.category}</p>
                        </div>
                      </div>
                      {business.promoted && (
                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded">
                          FEATURED
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 mb-4 text-sm">
                      {business.location && (
                        <p className="text-aurora-text-secondary flex items-center gap-2">
                          <MapPin className="w-4 h-4 flex-shrink-0" /> {business.location}
                        </p>
                      )}
                      {business.phone && (
                        <p className="text-aurora-text-secondary flex items-center gap-2">
                          <Phone className="w-4 h-4 flex-shrink-0" /> {business.phone}
                        </p>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-aurora-text font-semibold">{business.rating.toFixed(1)}</span>
                          <span className="text-aurora-text-muted text-xs">({business.reviews})</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectBusiness(business)}
                        className="flex-1 px-3 py-2 bg-aurora-surface-variant text-aurora-text rounded-lg text-sm font-medium hover:bg-aurora-border/30 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => { dispatch({ type: 'SELECT_BUSINESS', payload: business }); handleStartEdit(); }}
                        className="flex-1 px-3 py-2 bg-aurora-indigo text-white rounded-lg text-sm font-medium hover:bg-aurora-indigo/90 transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Business Detail Modal ===== */}
      {state.selectedBusiness && !state.isEditing && (
        <BusinessDetailModal
          business={state.selectedBusiness}
          favorites={state.favorites}
          following={state.following}
          businessReviews={state.businessReviews}
          showReviewForm={state.showReviewForm}
          newReview={state.newReview}
          user={user}
          isOwnerOrAdmin={isOwnerOrAdmin}
          dispatch={dispatch}
          toggleFavorite={toggleFavorite}
          toggleFollow={toggleFollow}
          openMenu={openMenu}
          handleStartEdit={handleStartEdit}
          handleDeleteBusiness={handleDeleteBusiness}
          handleAddReview={handleAddReview}
          handleSaveDeals={handleSaveDeals}
          analyticsData={state.analyticsData}
          analyticsLoading={state.analyticsLoading}
        />
      )}

      {/* ===== Edit Modal ===== */}
      {state.isEditing && state.selectedBusiness && (
        <BusinessEditModal
          editData={state.editData}
          editPhotos={state.editPhotos}
          editCoverPhotoIndex={state.editCoverPhotoIndex}
          saving={state.saving}
          photosEnabled={photosEnabled}
          dispatch={dispatch}
          handleSaveEdit={handleSaveEdit}
        />
      )}

      {/* ─── Floating Action Buttons ─── */}
      {canAddBusiness && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-10 flex flex-col items-center gap-3">
          {/* CSV Import FAB (secondary) */}
          <button
            onClick={() => setShowCSVImport(true)}
            aria-label="Bulk import businesses from CSV"
            className="w-11 h-11 bg-aurora-surface text-aurora-indigo rounded-full shadow-lg border border-aurora-border flex items-center justify-center hover:bg-aurora-surface-variant transition-all focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Upload className="w-5 h-5" />
          </button>
          {/* Add Business FAB (primary) */}
          <button
            onClick={handleOpenCreateModal}
            aria-label="Add new business"
            className="w-14 h-14 aurora-gradient text-white rounded-full shadow-aurora-glow-lg flex items-center justify-center hover:shadow-aurora-4 transition-all btn-press focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      )}

      {/* ===== Create Modal ===== */}
      {state.showCreateModal && (
        <BusinessCreateModal
          formData={state.formData}
          formErrors={state.formErrors}
          formPhotos={state.formPhotos}
          coverPhotoIndex={state.coverPhotoIndex}
          saving={state.saving}
          photosEnabled={photosEnabled}
          dispatch={dispatch}
          handleAddBusiness={handleAddBusiness}
        />
      )}

      {/* TIN Verification Modal */}
      {state.showTinVerificationModal && (
        <TinVerificationModal dispatch={dispatch} />
      )}

      {/* Delete Business Confirmation Modal */}
      {state.showDeleteConfirm && (
        <DeleteConfirmModal
          saving={state.saving}
          dispatch={dispatch}
          confirmDeleteBusiness={confirmDeleteBusiness}
        />
      )}

      {/* Shared Three-dot Context Menu */}
      {state.menuBusinessId && state.menuPosition && (() => {
        const biz = state.businesses.find((b) => b.id === state.menuBusinessId) || state.selectedBusiness;
        if (!biz) return null;
        return (
          <ContextMenu
            biz={biz}
            menuPosition={state.menuPosition}
            isOwnerOrAdmin={isOwnerOrAdmin}
            userRole={userRole}
            user={user}
            reportedBusinesses={state.reportedBusinesses}
            blockedUsers={state.blockedUsers}
            closeMenu={closeMenu}
            handleStartEdit={handleStartEdit}
            handleDeleteBusiness={handleDeleteBusiness}
            openReportModal={openReportModal}
            openBlockConfirm={openBlockConfirm}
            onVerifyToggle={handleVerifyToggle}
            dispatch={dispatch}
            selectedBusiness={state.selectedBusiness}
          />
        );
      })()}

      {/* Report Business Modal */}
      {state.showReportModal && (
        <ReportModal
          reportReason={state.reportReason}
          reportDetails={state.reportDetails}
          reportSubmitting={state.reportSubmitting}
          dispatch={dispatch}
          handleSubmitReport={handleSubmitReport}
        />
      )}

      {/* Block User Confirmation Modal */}
      {state.showBlockConfirm && state.blockTargetUser && (
        <BlockConfirmModal
          blockTargetUser={state.blockTargetUser}
          dispatch={dispatch}
          handleBlockUser={handleBlockUser}
        />
      )}

      {/* CSV Bulk Import Modal (#37) */}
      {showCSVImport && (
        <Suspense fallback={null}>
          <BusinessCSVImport
            isOpen={showCSVImport}
            onClose={() => setShowCSVImport(false)}
            userId={user?.uid || ''}
            userName={userProfile?.name || user?.displayName || 'Unknown'}
            userRole={userRole || 'user'}
            userHeritage={userProfile?.heritage}
            onImportComplete={(count) => {
              if (count > 0) {
                dispatch({ type: 'SET_TOAST', payload: `Successfully imported ${count} business${count !== 1 ? 'es' : ''}!` });
                // onSnapshot listener will automatically pick up new businesses — no reload needed
              }
            }}
          />
        </Suspense>
      )}

      {/* Toast Notification */}
      {state.toastMessage && (
        <div role="alert" aria-live="assertive" className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg z-[80] text-sm font-medium max-w-md text-center">
          {state.toastMessage}
        </div>
      )}
    </div>
  );
}
