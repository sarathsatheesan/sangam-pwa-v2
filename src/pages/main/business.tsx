import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search, MapPin, Phone, Mail, Globe, Clock, Star, ChevronRight,
  X, Plus, Heart, Sparkles, Store, ShoppingBag, Filter, ArrowLeft,
  ExternalLink, Trash2, Edit3, Loader2, Award, TrendingUp,
  ChevronDown, ChevronLeft, Upload, Image as ImageIcon, Camera,
  Flag, Ban, AlertTriangle, MoreHorizontal, Scale
} from 'lucide-react';
import { useFeatureSettings } from '@/contexts/FeatureSettingsContext';
import EthnicityFilterDropdown from '@/components/EthnicityFilterDropdown';
import {
  CATEGORIES, CATEGORY_EMOJI_MAP, CATEGORY_COLORS, CATEGORY_ICONS, REPORT_CATEGORIES,
} from '@/components/business/businessConstants';
import { getGoogleMapsUrl } from '@/components/business/businessValidation';
import { businessReducer, createInitialState, type Business, type BusinessReview } from '@/reducers/businessReducer';
import { compressImage, MAX_FILE_SIZE } from '@/components/business/imageUtils';
import { useBusinessData } from '@/hooks/useBusinessData';
import { useBusinessFilters } from '@/hooks/useBusinessFilters';
import { useBusinessModeration } from '@/hooks/useBusinessModeration';
import { useBusinessReviews } from '@/hooks/useBusinessReviews';

// Constants, fuzzyMatch, getGoogleMapsUrl, compressImage, validateBusinessForm
// are now imported from @/components/business/*
// Interfaces are now imported from @/reducers/businessReducer

// Star rating component
const StarRating = ({ rating, reviews, size = 'sm' }: { rating: number; reviews: number; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeConfig = {
    sm: { star: 'w-3.5 h-3.5', text: 'text-xs', gap: 'gap-0.5' },
    md: { star: 'w-4 h-4', text: 'text-sm', gap: 'gap-1' },
    lg: { star: 'w-5 h-5', text: 'text-base', gap: 'gap-1' },
  };
  const config = sizeConfig[size];

  return (
    <div className={`flex items-center ${config.gap}`}>
      <Star className={`${config.star} fill-amber-400 text-amber-400`} />
      <span className={`${config.text} font-semibold text-aurora-text`}>{rating.toFixed(1)}</span>
      <span className={`${config.text} text-aurora-text-muted`}>({reviews})</span>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════════
// FORM COMPONENTS (defined outside to prevent re-mount on every keystroke)
// ═════════════════════════════════════════════════════════════════════════════════

const FormInput = ({ label, required, error, ...props }: any) => (
  <div>
    <label className="block text-sm font-medium text-aurora-text mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      {...props}
      className={`w-full px-4 py-2.5 bg-aurora-surface border rounded-xl
                 text-sm text-aurora-text placeholder:text-aurora-text-muted
                 focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition-all
                 ${error ? 'border-red-400 ring-1 ring-red-400/30' : 'border-aurora-border'}`}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

const FormTextarea = ({ label, ...props }: any) => (
  <div>
    <label className="block text-sm font-medium text-aurora-text mb-1.5">{label}</label>
    <textarea
      {...props}
      className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl
                 text-sm text-aurora-text placeholder:text-aurora-text-muted resize-none
                 focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition-all"
    />
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════════
// IMAGE & PHOTO COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════════

const BusinessPhotoUploader: React.FC<{
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onCoverChange: (index: number) => void;
  coverIndex: number;
}> = ({ photos, onPhotosChange, onCoverChange, coverIndex }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setPhotoError(null);
    const remaining = 5 - photos.length;
    const toProcess = Array.from(files).slice(0, remaining);

    // Validate file sizes
    for (const file of toProcess) {
      if (file.size > MAX_FILE_SIZE) {
        setPhotoError(`"${file.name}" exceeds the 5MB size limit. Please choose a smaller file.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setPhotoUploading(true);
    const newPhotos = [...photos];
    let failCount = 0;
    for (const file of toProcess) {
      try {
        const compressed = await compressImage(file);
        newPhotos.push(compressed);
      } catch (err) {
        console.error('Error compressing image:', err);
        failCount++;
      }
    }
    if (failCount > 0) {
      setPhotoError(`${failCount} photo(s) failed to upload. Please try again.`);
    }
    onPhotosChange(newPhotos);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPhotoUploading(false);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-aurora-text mb-2">Photos (max 5)</h3>
      {photoError && (
        <div className="mb-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {photoError}
        </div>
      )}
      {photos.length < 5 && (
        <button
          type="button"
          onClick={() => !photoUploading && fileInputRef.current?.click()}
          disabled={photoUploading}
          className={`w-full border-2 border-dashed border-aurora-border rounded-xl p-4 flex flex-col items-center gap-2 text-aurora-text-muted hover:border-aurora-indigo hover:text-aurora-indigo transition-colors ${photoUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {photoUploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Upload className="w-6 h-6" />
          )}
          <span className="text-sm">{photoUploading ? 'Uploading...' : 'Click to upload photos'}</span>
          <span className="text-xs text-aurora-text-muted">PNG, JPG up to 5MB each</span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoSelect}
        className="hidden"
      />
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative group">
              <img
                src={photo}
                alt={`Photo ${idx + 1}`}
                className={`w-full h-24 object-cover rounded-lg cursor-pointer ${
                  idx === coverIndex ? 'ring-2 ring-aurora-indigo' : ''
                }`}
                onClick={() => onCoverChange(idx)}
              />
              {idx === coverIndex && (
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-aurora-indigo text-white text-[10px] font-bold rounded pointer-events-none flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-white" /> Cover
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const updated = photos.filter((_, i) => i !== idx);
                  onPhotosChange(updated);
                  if (coverIndex >= updated.length) onCoverChange(Math.max(0, updated.length - 1));
                }}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length > 0 && (
        <p className="text-xs text-aurora-text-muted mt-2">Tap a photo to set it as cover image. {photos.length}/5 uploaded.</p>
      )}
    </div>
  );
};

const BusinessPhotoCarousel: React.FC<{
  photos: string[];
  title: string;
}> = ({ photos, title }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!photos.length) return null;

  return (
    <div className="relative w-full h-full">
      <img
        src={photos[currentIndex]}
        alt={`${title} - ${currentIndex + 1}`}
        className="w-full h-full object-cover"
      />
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((p) => (p - 1 + photos.length) % photos.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((p) => (p + 1) % photos.length); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-2.5 py-0.5 rounded-full text-xs">
            {currentIndex + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
};

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

  // ── Custom hooks (Phase 2 Steps 3-6) ──
  const {
    loadMoreRef, toggleFavorite, handleOpenCreateModal, handleAddBusiness,
    handleDeleteBusiness, confirmDeleteBusiness, handleStartEdit, handleSaveEdit, PAGE_SIZE,
  } = useBusinessData(state, dispatch, user, userRole, userProfile);

  const { filteredBusinesses, featuredBusinesses, categoryCounts } = useBusinessFilters(state, dispatch);

  const { openReportModal, handleSubmitReport, handleBlockUser, openBlockConfirm } = useBusinessModeration(state, dispatch, user, userProfile);

  const { handleAddReview } = useBusinessReviews(state, dispatch, user, userProfile);

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
    <div className="bg-aurora-surface rounded-2xl border border-aurora-border overflow-hidden animate-pulse">
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
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-muted" />
                <input
                  type="text"
                  placeholder="Search restaurants, services, markets..."
                  value={state.searchQuery}
                  onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
                  onFocus={() => dispatch({ type: 'SET_SEARCH_FOCUSED', payload: true })}
                  onBlur={() => dispatch({ type: 'SET_SEARCH_FOCUSED', payload: false })}
                  className={`w-full pl-11 pr-10 py-2.5 bg-aurora-surface border rounded-full
                             text-sm text-aurora-text placeholder:text-aurora-text-muted
                             focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all
                             ${state.searchFocused ? 'border-aurora-indigo shadow-md' : 'border-aurora-border'}`}
                />
                {state.searchQuery && (
                  <button
                    onClick={() => dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
                className="flex gap-1 py-3 overflow-x-auto scrollbar-hide"
              >
                {/* All */}
                <button
                  onClick={() => dispatch({ type: 'SET_SELECTED_CATEGORY', payload: 'All' })}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[64px] flex-shrink-0 transition-all ${state.selectedCategory === 'All'
                      ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 text-white shadow-md'
                      : 'text-aurora-text-secondary hover:bg-aurora-surface-variant'
                  }`}
                >
                  <Store className="w-5 h-5" />
                  <span className="text-[11px] font-medium whitespace-nowrap">All</span>
                </button>
                {CATEGORIES.map((cat) => {
                  const IconComp = CATEGORY_ICONS[cat] || Store;
                  const count = categoryCounts[cat] || 0;
                  return (
                    <button
                      key={cat}
                      onClick={() => dispatch({ type: 'SET_SELECTED_CATEGORY', payload: cat })}
                      className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[64px] flex-shrink-0 transition-all ${state.selectedCategory === cat
                          ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 text-white shadow-md'
                          : 'text-aurora-text-secondary hover:bg-aurora-surface-variant'
                      }`}
                    >
                      <IconComp className="w-5 h-5" />
                      <span className="text-[11px] font-medium whitespace-nowrap">{cat.split(' & ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Smart Discovery Collections */}
            <div className="border-t border-aurora-border bg-aurora-surface">
              <div className="max-w-6xl mx-auto px-4 py-3">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  {(['all', 'topRated', 'new', 'mostReviewed', 'favorites'] as const).map((collection) => {
                    const labels = {
                      all: 'All',
                      topRated: 'Top Rated',
                      new: 'New',
                      mostReviewed: 'Most Reviewed',
                      favorites: 'Favorites',
                    };
                    return (
                      <button
                        key={collection}
                        onClick={() => dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: collection })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all flex items-center gap-1 ${state.activeCollection === collection
                            ? 'bg-aurora-indigo text-white'
                            : 'bg-aurora-surface-variant text-aurora-text-secondary hover:text-aurora-text'
                        }`}
                      >
                        {collection === 'topRated' && <TrendingUp className="w-3 h-3" />}
                        {collection === 'favorites' && <Heart className="w-3 h-3" />}
                        {labels[collection]}
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
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-aurora-text-secondary">
                {state.loading ? 'Loading...' : (
                  <>
                    <span className="font-semibold text-aurora-text">{filteredBusinesses.length}</span>
                    {' '}business{filteredBusinesses.length !== 1 ? 'es' : ''}
                    {state.selectedCategory !== 'All' && <> in <span className="font-medium text-aurora-text">{state.selectedCategory}</span></>}
                    {state.selectedHeritage.length > 0 && <> · {state.selectedHeritage.join(', ')}</>}
                  </>
                )}
              </p>
              {(state.selectedCategory !== 'All' || state.selectedHeritage.length > 0 || state.searchQuery || state.activeCollection !== 'all') && (
                <button
                  onClick={() => { dispatch({ type: 'SET_SELECTED_CATEGORY', payload: 'All' }); dispatch({ type: 'SET_SELECTED_HERITAGE', payload: [] }); dispatch({ type: 'SET_SEARCH_QUERY', payload: '' }); dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: 'all' }); }}
                  className="text-xs text-aurora-indigo font-medium flex items-center gap-1 hover:text-aurora-indigo/80"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>

            {/* Featured Carousel */}
            {featuredBusinesses.length > 0 && !state.searchQuery && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-aurora-text flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    Featured
                  </h2>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                  {featuredBusinesses.map((business) => (
                    <div
                      key={business.id}
                      className="flex-shrink-0 w-80 rounded-2xl overflow-hidden cursor-pointer group
                                 shadow-sm hover:shadow-lg transition-all duration-200 border border-aurora-border"
                      onClick={() => { dispatch({ type: 'SELECT_BUSINESS', payload: business }); dispatch({ type: 'SET_ACTIVE_TAB', payload: 'about' }); }}
                    >
                      {/* Color banner */}
                      <div
                        className="relative h-28 flex items-end p-4 overflow-hidden"
                        style={{
                          background: business.photos?.length ? '#000' : `linear-gradient(135deg, ${business.bgColor}, ${business.bgColor}dd)`,
                        }}
                      >
                        {business.photos && business.photos.length > 0 ? (
                          <img
                            src={business.photos[business.coverPhotoIndex || 0]}
                            alt={business.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute top-3 left-3">
                          <span className="px-2.5 py-1 bg-amber-400 text-amber-900 text-[11px] font-bold rounded-lg flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> FEATURED
                          </span>
                        </div>
                        <button
                          onClick={(e) => toggleFavorite(business.id, e)}
                          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center
                                     hover:bg-white transition-colors shadow-sm"
                        >
                          <Heart className={`w-4 h-4 ${state.favorites.has(business.id) ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                        </button>
                        <div className="relative flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">
                            {business.emoji}
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-base leading-tight">{business.name}</h3>
                            <p className="text-white/80 text-xs">{business.category}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-aurora-surface p-3">
                        <p className="text-xs text-aurora-text-secondary line-clamp-1 mb-2">{business.desc}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-semibold text-aurora-text">{business.rating.toFixed(1)}</span>
                            <span className="text-xs text-aurora-text-muted">({business.reviews})</span>
                          </div>
                          <span className="text-xs text-aurora-text-muted flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {business.location || 'No location'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-aurora-surface-variant flex items-center justify-center mb-4">
                  <Store className="w-7 h-7 text-aurora-text-muted" />
                </div>
                <h3 className="text-lg font-semibold text-aurora-text mb-1">No businesses found</h3>
                <p className="text-sm text-aurora-text-secondary max-w-xs">
                  {state.searchQuery ? `No results for "${state.searchQuery}". Try a different search.`
                    : state.selectedHeritage.length > 0
                    ? `No businesses under "${state.selectedHeritage.join(', ')}" heritage yet.`
                    : state.selectedCategory !== 'All'
                    ? `No businesses in "${state.selectedCategory}" yet.`
                    : 'No businesses listed yet. Be the first!'}
                </p>
                {canAddBusiness && (
                  <button
                    onClick={handleOpenCreateModal}
                    className="mt-4 px-5 py-2 bg-aurora-indigo text-white rounded-xl font-medium text-sm
                               hover:bg-aurora-indigo/90 shadow-sm flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Business
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBusinesses.map((business) => {
                  const CategoryIcon = CATEGORY_ICONS[business.category] || Store;
                  const heritageArr = business.heritage
                    ? (Array.isArray(business.heritage) ? business.heritage : [business.heritage])
                    : [];

                  return (
                    <div
                      key={business.id}
                      className="group bg-aurora-surface rounded-2xl border border-aurora-border overflow-visible
                                 cursor-pointer hover:shadow-lg hover:border-aurora-border/80 transition-all duration-200"
                      onClick={() => { dispatch({ type: 'SELECT_BUSINESS', payload: business }); dispatch({ type: 'SET_ACTIVE_TAB', payload: 'about' }); }}
                    >
                      {/* Card Image Area */}
                      <div
                        className="relative h-36 flex items-center justify-center overflow-hidden rounded-t-2xl"
                        style={{
                          background: business.photos?.length ? undefined : `linear-gradient(135deg, ${business.bgColor}22, ${business.bgColor}44)`,
                        }}
                      >
                        {business.photos && business.photos.length > 0 ? (
                          <img
                            src={business.photos[business.coverPhotoIndex || 0]}
                            alt={business.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <span className="text-6xl opacity-80 group-hover:scale-110 transition-transform duration-200">
                            {business.emoji}
                          </span>
                        )}

                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <button
                            onClick={(e) => toggleFavorite(business.id, e)}
                            className="w-10 h-10 rounded-full bg-white/90 dark:bg-aurora-surface/90
                                       flex items-center justify-center hover:bg-white dark:hover:bg-aurora-surface
                                       transition-colors shadow-sm"
                          >
                            <Heart className={`w-4 h-4 transition-colors ${
                              state.favorites.has(business.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'
                            }`} />
                          </button>
                          {user && (
                            <button
                              onClick={(e) => openMenu(business.id, e)}
                              className="w-10 h-10 rounded-full bg-white/90 dark:bg-aurora-surface/90
                                         flex items-center justify-center hover:bg-white dark:hover:bg-aurora-surface
                                         transition-colors shadow-sm"
                            >
                              <MoreHorizontal className="w-4 h-4 text-gray-500" />
                            </button>
                          )}
                        </div>

                        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                          {business.promoted && (
                            <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-md flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> FEATURED
                            </span>
                          )}
                          {business.rating >= 4.5 && business.reviews > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-md">
                              TOP RATED
                            </span>
                          )}
                          {business.deals && business.deals.length > 0 && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-md flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> DEAL
                            </span>
                          )}
                        </div>

                        <div
                          className="absolute bottom-3 left-3 w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md"
                          style={{ backgroundColor: business.bgColor }}
                        >
                          <CategoryIcon className="w-4.5 h-4.5" />
                        </div>
                      </div>

                      {/* Card Info */}
                      <div className="p-4">
                        <h3 className="font-semibold text-aurora-text text-[15px] leading-tight mb-0.5 line-clamp-1 group-hover:text-aurora-indigo transition-colors">
                          {business.name}
                        </h3>
                        <p className="text-xs text-aurora-text-muted mb-2">{business.category}</p>

                        <div className="flex items-center justify-between mb-2.5">
                          <StarRating rating={business.rating} reviews={business.reviews} size="sm" />
                          {business.location && (
                            <span className="text-xs text-aurora-text-muted flex items-center gap-0.5 truncate max-w-[140px]">
                              <MapPin className="w-3 h-3 flex-shrink-0" /> {business.location}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-aurora-text-secondary line-clamp-2 mb-2.5">
                          {business.desc || 'No description provided.'}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex gap-1 flex-wrap">
                            {heritageArr.slice(0, 2).map((h) => (
                              <span key={h} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20">
                                {h}
                              </span>
                            ))}
                          </div>
                          {business.phone && (
                            <span className="text-[11px] text-aurora-text-muted flex items-center gap-0.5">
                              <Phone className="w-3 h-3" /> {business.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
              {state.loadingMore && (
                <div className="flex items-center gap-2 text-aurora-text-muted text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading more businesses...
                </div>
              )}
              {!state.hasMore && state.businesses.length > PAGE_SIZE && (
                <p className="text-xs text-aurora-text-muted py-4">You've reached the end</p>
              )}
            </div>
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
                        onClick={() => { dispatch({ type: 'SELECT_BUSINESS', payload: business }); dispatch({ type: 'SET_ACTIVE_TAB', payload: 'about' }); }}
                        className="flex-1 px-3 py-2 bg-aurora-surface-variant text-aurora-text rounded-lg text-sm font-medium hover:bg-aurora-border/30 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => { dispatch({ type: 'SELECT_BUSINESS', payload: business }); handleStartEdit(); }}
                        className="flex-1 px-3 py-2 bg-aurora-indigo text-white rounded-lg text-sm font-medium hover:bg-aurora-indigo/90 transition-colors flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-4 h-4" /> Edit
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
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => dispatch({ type: 'SELECT_BUSINESS', payload: null })}
        >
          <div
            className="bg-aurora-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl
                       max-h-[92vh] flex flex-col border border-aurora-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal action buttons — positioned outside hero to avoid overflow-hidden clipping */}
            <button
              onClick={() => dispatch({ type: 'SELECT_BUSINESS', payload: null })}
              className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center text-white transition-colors z-[5]"
            >
              <X className="w-5 h-5" />
            </button>
            {user && (
              <button
                onClick={(e) => openMenu(state.selectedBusiness!.id, e)}
                className="absolute top-3 right-14 z-[5] w-10 h-10 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => toggleFavorite(state.selectedBusiness!.id, e)}
              className={`absolute top-3 ${user ? 'right-24' : 'right-14'} w-10 h-10 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center transition-colors z-[5]`}
            >
              <Heart className={`w-4 h-4 ${state.favorites.has(state.selectedBusiness!.id) ? 'fill-red-400 text-red-400' : 'text-white'}`} />
            </button>

            {/* Hero Banner */}
            <div
              className="relative h-40 sm:rounded-t-2xl flex items-end p-5 overflow-hidden"
              style={{
                background: state.selectedBusiness.photos?.length ? '#000' : `linear-gradient(135deg, ${state.selectedBusiness.bgColor}, ${state.selectedBusiness.bgColor}cc)`,
              }}
            >
              {state.selectedBusiness.photos && state.selectedBusiness.photos.length > 0 && (
                <div className="absolute inset-0">
                  <BusinessPhotoCarousel photos={state.selectedBusiness.photos} title={state.selectedBusiness.name} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent sm:rounded-t-2xl" />
              {state.selectedBusiness.promoted && (
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 bg-amber-400 text-amber-900 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> FEATURED
                  </span>
                </div>
              )}
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl">
                  {state.selectedBusiness.emoji}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white leading-tight">{state.selectedBusiness.name}</h2>
                  <p className="text-white/80 text-sm">{state.selectedBusiness.category}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                    <span className="text-white font-semibold text-sm">{state.selectedBusiness.rating.toFixed(1)}</span>
                    <span className="text-white/70 text-xs">({state.selectedBusiness.reviews} reviews)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Content - Single scroll layout */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-6">

                {/* ── About Section ── */}
                {state.selectedBusiness.desc && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">About</h4>
                    <p className="text-sm text-aurora-text-secondary leading-relaxed">{state.selectedBusiness.desc}</p>
                  </div>
                )}

                {/* Quick Info Row */}
                {(state.selectedBusiness.yearEstablished || state.selectedBusiness.priceRange) && (
                  <div className="flex gap-3 flex-wrap">
                    {state.selectedBusiness.yearEstablished && (
                      <div className="flex-1 min-w-[120px] bg-aurora-surface-variant rounded-xl p-3 text-center">
                        <p className="text-[10px] font-semibold text-aurora-text-muted uppercase tracking-wider">Established</p>
                        <p className="text-sm font-bold text-aurora-text mt-1">{state.selectedBusiness.yearEstablished}</p>
                      </div>
                    )}
                    {state.selectedBusiness.priceRange && (
                      <div className="flex-1 min-w-[120px] bg-aurora-surface-variant rounded-xl p-3 text-center">
                        <p className="text-[10px] font-semibold text-aurora-text-muted uppercase tracking-wider">Price Range</p>
                        <p className="text-sm font-bold text-aurora-text mt-1">{state.selectedBusiness.priceRange}</p>
                      </div>
                    )}
                  </div>
                )}

                {state.selectedBusiness.heritage && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Heritage</h4>
                    <div className="flex gap-2 flex-wrap">
                      {(Array.isArray(state.selectedBusiness.heritage) ? state.selectedBusiness.heritage : [state.selectedBusiness.heritage]).map((h) => (
                        <span key={h} className="text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-200/50 dark:border-amber-500/20">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {state.selectedBusiness.specialtyTags && state.selectedBusiness.specialtyTags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Specialties</h4>
                    <div className="flex gap-2 flex-wrap">
                      {state.selectedBusiness.specialtyTags.map((tag) => (
                        <span key={tag} className="text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {state.selectedBusiness.paymentMethods && state.selectedBusiness.paymentMethods.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Payment Methods</h4>
                    <div className="flex gap-2 flex-wrap">
                      {state.selectedBusiness.paymentMethods.map((method) => (
                        <span key={method} className="text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-3 py-1 rounded-full">
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Contact Section ── */}
                <div>
                  <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Contact</h4>
                  <div className="space-y-2">
                    {state.selectedBusiness.location && (
                      <a
                        href={getGoogleMapsUrl(state.selectedBusiness.location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-aurora-indigo/10 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-aurora-indigo" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aurora-text truncate">{state.selectedBusiness.location}</p>
                          <p className="text-xs text-aurora-indigo mt-0.5">Open in Google Maps</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-aurora-text-muted flex-shrink-0" />
                      </a>
                    )}
                    {state.selectedBusiness.phone && (
                      <a
                        href={`tel:${state.selectedBusiness.phone}`}
                        className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                          <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aurora-text">{state.selectedBusiness.phone}</p>
                          <p className="text-xs text-aurora-text-muted mt-0.5">Tap to call</p>
                        </div>
                      </a>
                    )}
                    {state.selectedBusiness.email && (
                      <a
                        href={`mailto:${state.selectedBusiness.email}`}
                        className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aurora-text truncate">{state.selectedBusiness.email}</p>
                          <p className="text-xs text-aurora-text-muted mt-0.5">Send email</p>
                        </div>
                      </a>
                    )}
                    {state.selectedBusiness.website && (
                      <a
                        href={state.selectedBusiness.website.startsWith('http') ? state.selectedBusiness.website : `https://${state.selectedBusiness.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                          <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aurora-indigo truncate">{state.selectedBusiness.website}</p>
                          <p className="text-xs text-aurora-text-muted mt-0.5">Visit website</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-aurora-text-muted flex-shrink-0" />
                      </a>
                    )}
                  </div>
                </div>

                {state.selectedBusiness.hours && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Hours</h4>
                    <div className="flex items-start gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3">
                      <Clock className="w-4 h-4 text-aurora-text-muted mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-aurora-text-secondary whitespace-pre-line">{state.selectedBusiness.hours}</p>
                    </div>
                  </div>
                )}

                {state.selectedBusiness.deals && state.selectedBusiness.deals.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Current Deals</h4>
                    <div className="space-y-2">
                      {state.selectedBusiness.deals.map((deal, idx) => (
                        <div key={idx} className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 border border-red-200/50 dark:border-red-500/20">
                          <h5 className="font-semibold text-red-700 dark:text-red-400 text-sm">{deal.title}</h5>
                          {deal.description && <p className="text-sm text-red-600 dark:text-red-300/80 mt-1">{deal.description}</p>}
                          {deal.discount && <p className="text-sm text-red-700 dark:text-red-400 font-bold mt-1">{deal.discount}% Off</p>}
                          {deal.code && <p className="text-xs text-red-600 dark:text-red-300/60 mt-1">Code: <span className="font-mono font-bold">{deal.code}</span></p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Divider ── */}
                <div className="border-t border-aurora-border" />

                {/* ── Services Section ── */}
                {state.selectedBusiness.services && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Services Offered</h4>
                    <div className="bg-aurora-surface-variant rounded-xl p-4">
                      <p className="text-sm text-aurora-text-secondary whitespace-pre-line leading-relaxed">{state.selectedBusiness.services}</p>
                    </div>
                  </div>
                )}

                {state.selectedBusiness.menu && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">
                      {state.selectedBusiness.category === 'Restaurant & Food' ? 'Menu' : 'Products'}
                    </h4>
                    <div className="bg-aurora-surface-variant rounded-xl p-4">
                      <p className="text-sm text-aurora-text-secondary whitespace-pre-line leading-relaxed">{state.selectedBusiness.menu}</p>
                    </div>
                  </div>
                )}

                {!state.selectedBusiness.services && !state.selectedBusiness.menu && isOwnerOrAdmin(state.selectedBusiness) && (
                  <div className="text-center py-6 bg-aurora-surface-variant rounded-xl">
                    <ShoppingBag className="w-6 h-6 text-aurora-text-muted mx-auto mb-2" />
                    <p className="text-sm text-aurora-text-muted mb-1">No services or menu listed yet</p>
                    <button
                      onClick={handleStartEdit}
                      className="mt-1 text-sm text-aurora-indigo font-medium hover:underline"
                    >
                      Add services info
                    </button>
                  </div>
                )}

                {/* ── Divider ── */}
                <div className="border-t border-aurora-border" />

                {/* ── Reviews Section ── */}
                <div className="space-y-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Reviews</h4>
                      {state.businessReviews.length > 0 && (
                        <p className="text-sm text-aurora-text mt-1">{state.businessReviews.length} review{state.businessReviews.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                    {!state.showReviewForm && user && state.businessReviews.length > 0 && (
                      <button
                        onClick={() => dispatch({ type: 'SET_SHOW_REVIEW_FORM', payload: true })}
                        className="px-3 py-1.5 bg-aurora-indigo text-white rounded-lg text-xs font-medium hover:bg-aurora-indigo/90 transition-colors flex items-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5" />
                        Write a Review
                      </button>
                    )}
                  </div>

                  {state.showReviewForm && (
                    <div className="space-y-4 bg-aurora-surface-variant rounded-xl p-4 border border-aurora-indigo/20">
                      <h4 className="text-sm font-semibold text-aurora-text">Write a Review</h4>
                      <div>
                        <label className="text-xs font-medium text-aurora-text block mb-2">Rating</label>
                        <div className="flex gap-1 mb-3">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              onClick={() => dispatch({ type: 'SET_NEW_REVIEW', payload: { ...state.newReview, rating } })}
                              className="transition-transform hover:scale-110"
                            >
                              <Star
                                className={`w-6 h-6 ${rating <= state.newReview.rating ? 'fill-amber-400 text-amber-400' : 'text-aurora-border'}`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <textarea
                          placeholder="Share your experience..."
                          value={state.newReview.text}
                          onChange={(e) => dispatch({ type: 'SET_NEW_REVIEW', payload: { ...state.newReview, text: e.target.value } })}
                          className="w-full px-3 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text placeholder:text-aurora-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { dispatch({ type: 'SET_SHOW_REVIEW_FORM', payload: false }); dispatch({ type: 'SET_NEW_REVIEW', payload: { rating: 5, text: '' } }); }}
                          className="flex-1 px-3 py-2.5 bg-aurora-surface text-aurora-text rounded-xl text-sm font-medium hover:bg-aurora-border/30 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddReview}
                          className="flex-1 px-3 py-2.5 bg-aurora-indigo text-white rounded-xl text-sm font-medium hover:bg-aurora-indigo/90 transition-colors"
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  )}

                  {state.businessReviews.length > 0 ? (
                    <div className="space-y-3">
                      {state.businessReviews.map((review) => (
                        <div key={review.id} className="bg-aurora-surface-variant rounded-xl p-3.5">
                          <div className="flex items-start justify-between mb-1.5">
                            <div>
                              <p className="text-sm font-semibold text-aurora-text">{review.userName}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-aurora-border'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-aurora-text-secondary leading-relaxed">{review.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : !state.showReviewForm ? (
                    <div className="text-center py-8">
                      <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                        <Star className="w-6 h-6 text-amber-500" />
                      </div>
                      <p className="text-sm font-medium text-aurora-text mb-1">No reviews yet</p>
                      <p className="text-xs text-aurora-text-muted mb-4">Be the first to share your experience</p>
                      {user && (
                        <button
                          onClick={() => dispatch({ type: 'SET_SHOW_REVIEW_FORM', payload: true })}
                          className="px-4 py-2 bg-aurora-indigo text-white rounded-xl text-sm font-medium hover:bg-aurora-indigo/90 transition-colors"
                        >
                          Write a Review
                        </button>
                      )}
                      {!user && (
                        <p className="text-xs text-aurora-text-secondary">Sign in to leave a review</p>
                      )}
                    </div>
                  ) : null}

                  {state.businessReviews.length > 0 && !state.showReviewForm && user && (
                    <button
                      onClick={() => dispatch({ type: 'SET_SHOW_REVIEW_FORM', payload: true })}
                      className="w-full px-4 py-2.5 bg-aurora-indigo/10 text-aurora-indigo rounded-xl text-sm font-medium hover:bg-aurora-indigo/20 transition-colors border border-aurora-indigo/30"
                    >
                      Add Your Review
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* Action Buttons */}
            {state.selectedBusiness && isOwnerOrAdmin(state.selectedBusiness) && (
              <div className="border-t border-aurora-border p-4 flex gap-3 bg-aurora-surface sm:rounded-b-2xl">
                <button
                  onClick={handleStartEdit}
                  className="flex-1 flex items-center justify-center gap-2 bg-aurora-indigo text-white py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 transition-colors"
                >
                  <Edit3 className="w-4 h-4" /> Edit Business
                </button>
                <button
                  onClick={() => handleDeleteBusiness(state.selectedBusiness!.id)}
                  className="px-4 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl font-medium text-sm hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Edit Modal ===== */}
      {state.isEditing && state.selectedBusiness && (
        <div className="fixed inset-0 bg-aurora-bg z-50 flex flex-col">
          <div className="flex-shrink-0 bg-aurora-surface border-b border-aurora-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => dispatch({ type: 'SET_IS_EDITING', payload: false })} className="p-1 hover:bg-aurora-surface-variant rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-aurora-text-secondary" />
              </button>
              <h2 className="text-lg font-bold text-aurora-text">Edit Business</h2>
            </div>
            <button
              onClick={() => dispatch({ type: 'SET_IS_EDITING', payload: false })}
              className="text-aurora-text-muted hover:text-aurora-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4 max-w-lg mx-auto w-full">
            <FormInput label="Business Name" required type="text" value={state.editData.name} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, name: e.target.value } })} />
            <div>
              <label className="block text-sm font-medium text-aurora-text mb-1.5">Category</label>
              <select
                value={state.editData.category}
                onChange={(e) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, category: e.target.value } })}
                className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
              >
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <FormTextarea label="Description" value={state.editData.desc} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, desc: e.target.value } })} rows={3} />
            {photosEnabled && (
              <BusinessPhotoUploader
                photos={state.editPhotos}
                onPhotosChange={(photos) => dispatch({ type: 'SET_EDIT_PHOTOS', payload: photos })}
                onCoverChange={(index) => dispatch({ type: 'SET_EDIT_COVER_INDEX', payload: index })}
                coverIndex={state.editCoverPhotoIndex}
              />
            )}
            <FormInput label="Location / Address" type="text" value={state.editData.location} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, location: e.target.value } })} />
            <FormInput label="Phone" type="tel" value={state.editData.phone} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, phone: e.target.value } })} />
            <FormInput label="Email" type="email" value={state.editData.email} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, email: e.target.value } })} />
            <FormInput label="Website" type="url" value={state.editData.website} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, website: e.target.value } })} />
            <FormTextarea label="Business Hours" value={state.editData.hours} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, hours: e.target.value } })} rows={3} placeholder="Mon-Fri: 9am-5pm&#10;Sat: 10am-2pm&#10;Sun: Closed" />
            <FormInput label="Year Established" type="number" value={state.editData.yearEstablished} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, yearEstablished: parseInt(e.target.value) } })} />
            <FormInput label="Price Range" type="text" value={state.editData.priceRange} placeholder="$$-$$$" onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, priceRange: e.target.value } })} />
            <FormTextarea label="Services" value={state.editData.services} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, services: e.target.value } })} rows={3} placeholder="List your services..." />
            <FormTextarea label={state.editData.category === 'Restaurant & Food' ? 'Menu' : 'Products / Merchandise'} value={state.editData.menu} onChange={(e: any) => dispatch({ type: 'SET_EDIT_DATA', payload: { ...state.editData, menu: e.target.value } })} rows={4} placeholder="List your menu items or products..." />
          </div>
          <div className="sticky bottom-0 bg-aurora-surface border-t border-aurora-border p-4">
            <div className="flex gap-3 max-w-lg mx-auto">
              <button
                onClick={() => dispatch({ type: 'SET_IS_EDITING', payload: false })}
                className="flex-1 bg-aurora-surface-variant text-aurora-text-secondary py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-border/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={state.saving}
                className="flex-1 bg-aurora-indigo text-white py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {state.saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Floating Action Button ─── */}
      {canAddBusiness && (
        <button
          onClick={handleOpenCreateModal}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 aurora-gradient text-white rounded-full shadow-aurora-glow-lg flex items-center justify-center hover:shadow-aurora-4 transition-all z-10 btn-press"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {/* ===== Create Modal ===== */}
      {state.showCreateModal && (
        <div className="fixed inset-0 bg-aurora-bg z-50 flex flex-col">
          <div className="flex-shrink-0 bg-aurora-surface border-b border-aurora-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => { dispatch({ type: 'CLOSE_CREATE_MODAL' }); dispatch({ type: 'SET_FORM_PHOTOS', payload: [] }); dispatch({ type: 'SET_COVER_PHOTO_INDEX', payload: 0 }); }} className="p-1 hover:bg-aurora-surface-variant rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-aurora-text-secondary" />
              </button>
              <h2 className="text-lg font-bold text-aurora-text">Add Business</h2>
            </div>
            <button
              onClick={() => { dispatch({ type: 'CLOSE_CREATE_MODAL' }); dispatch({ type: 'SET_FORM_PHOTOS', payload: [] }); dispatch({ type: 'SET_COVER_PHOTO_INDEX', payload: 0 }); }}
              className="text-aurora-text-muted hover:text-aurora-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4 max-w-lg mx-auto w-full">
            <FormInput label="Business Name" required error={state.formErrors.name} type="text" value={state.formData.name} onChange={(e: any) => { dispatch({ type: 'UPDATE_FORM_FIELD', field: 'name', value: e.target.value }); dispatch({ type: 'CLEAR_FORM_ERROR', field: 'name' }); }} placeholder="Enter business name" />
            <div>
              <label className="block text-sm font-medium text-aurora-text mb-1.5">Category <span className="text-red-500">*</span></label>
              <select
                value={state.formData.category}
                onChange={(e) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'category', value: e.target.value })}
                className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
              >
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{CATEGORY_EMOJI_MAP[cat]} {cat}</option>)}
              </select>
            </div>
            <FormTextarea label="Description" value={state.formData.desc} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'desc', value: e.target.value })} rows={3} placeholder="Tell customers about your business..." />
            {photosEnabled && (
              <BusinessPhotoUploader
                photos={state.formPhotos}
                onPhotosChange={(photos) => dispatch({ type: 'SET_FORM_PHOTOS', payload: photos })}
                onCoverChange={(index) => dispatch({ type: 'SET_COVER_PHOTO_INDEX', payload: index })}
                coverIndex={state.coverPhotoIndex}
              />
            )}
            <FormInput label="Location / Address" required error={state.formErrors.location} type="text" value={state.formData.location} onChange={(e: any) => { dispatch({ type: 'UPDATE_FORM_FIELD', field: 'location', value: e.target.value }); dispatch({ type: 'CLEAR_FORM_ERROR', field: 'location' }); }} placeholder="123 Main St, City, State" />
            <FormInput label="Phone" required error={state.formErrors.phone} type="tel" value={state.formData.phone} onChange={(e: any) => { dispatch({ type: 'UPDATE_FORM_FIELD', field: 'phone', value: e.target.value }); dispatch({ type: 'CLEAR_FORM_ERROR', field: 'phone' }); }} placeholder="(555) 123-4567" />
            <FormInput label="Email" required error={state.formErrors.email} type="email" value={state.formData.email} onChange={(e: any) => { dispatch({ type: 'UPDATE_FORM_FIELD', field: 'email', value: e.target.value }); dispatch({ type: 'CLEAR_FORM_ERROR', field: 'email' }); }} placeholder="contact@business.com" />
            <FormInput label="Website" error={state.formErrors.website} type="url" value={state.formData.website} onChange={(e: any) => { dispatch({ type: 'UPDATE_FORM_FIELD', field: 'website', value: e.target.value }); dispatch({ type: 'CLEAR_FORM_ERROR', field: 'website' }); }} placeholder="https://www.mybusiness.com" />
            <FormTextarea label="Business Hours" value={state.formData.hours} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'hours', value: e.target.value })} rows={3} placeholder="Mon-Fri: 9am-5pm&#10;Sat: 10am-2pm&#10;Sun: Closed" />
            <FormInput label="Year Established" type="number" value={state.formData.yearEstablished} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'yearEstablished', value: parseInt(e.target.value) })} />
            <FormInput label="Price Range" type="text" value={state.formData.priceRange} placeholder="$$-$$$" onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'priceRange', value: e.target.value })} />
            <FormTextarea label="Services" value={state.formData.services} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'services', value: e.target.value })} rows={3} placeholder="List your services..." />
            <FormTextarea label={state.formData.category === 'Restaurant & Food' ? 'Menu' : 'Products / Merchandise'} value={state.formData.menu} onChange={(e: any) => dispatch({ type: 'UPDATE_FORM_FIELD', field: 'menu', value: e.target.value })} rows={4} placeholder="List your menu items or products..." />
          </div>
          <div className="sticky bottom-0 bg-aurora-surface border-t border-aurora-border p-4">
            <div className="max-w-lg mx-auto">
              <button
                onClick={handleAddBusiness}
                disabled={state.saving}
                className="w-full bg-aurora-indigo text-white py-3 rounded-xl font-semibold text-sm hover:bg-aurora-indigo/90 shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {state.saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><Plus className="w-4 h-4" /> Add Business</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TIN Verification Modal */}
      {state.showTinVerificationModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => dispatch({ type: 'SET_SHOW_TIN_MODAL', payload: false })}
        >
          <div
            className="bg-aurora-surface rounded-2xl shadow-2xl max-w-md w-full p-6 border border-aurora-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                <Scale className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-aurora-text">TIN Verification Required</h2>
              <p className="text-sm text-aurora-text-secondary mt-2">
                Your registered business TIN/EIN must be verified before you can create listings.
              </p>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={() => { dispatch({ type: 'SET_SHOW_TIN_MODAL', payload: false }); window.location.href = '/profile'; }}
                className="w-full bg-aurora-indigo text-white py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 transition-colors"
              >
                Go to Profile
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_SHOW_TIN_MODAL', payload: false })}
                className="w-full bg-aurora-surface-variant text-aurora-text-secondary py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-border/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Business Confirmation Modal */}
      {state.showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={() => { dispatch({ type: 'CLOSE_DELETE_CONFIRM' }); }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Business?</h3>
              <p className="text-sm text-gray-500 mb-5">
                Are you sure you want to delete this business listing? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { dispatch({ type: 'CLOSE_DELETE_CONFIRM' }); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteBusiness}
                  disabled={state.saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {state.saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SHARED THREE-DOT CONTEXT MENU (fixed-position, escapes all overflow)
          ═══════════════════════════════════════════════════════════════════ */}
      {state.menuBusinessId && state.menuPosition && (() => {
        const biz = state.businesses.find((b) => b.id === state.menuBusinessId) || state.selectedBusiness;
        if (!biz) return null;
        return (
          <>
            <div className="fixed inset-0 z-[55]" onClick={closeMenu} />
            <div
              className="fixed bg-aurora-surface rounded-xl shadow-aurora-3 border border-aurora-border py-1.5 z-[56] min-w-[200px]"
              style={{ top: state.menuPosition.top, right: state.menuPosition.right }}
            >
              {isOwnerOrAdmin(biz) && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); closeMenu(); if (!state.selectedBusiness) dispatch({ type: 'SELECT_BUSINESS', payload: biz }); setTimeout(() => handleStartEdit(), 50); }}
                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-text-secondary hover:bg-aurora-surface-variant transition-colors"
                  >
                    <Edit3 size={16} /> Edit Business
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); closeMenu(); handleDeleteBusiness(biz.id); }}
                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-danger hover:bg-aurora-danger/10 transition-colors"
                  >
                    <Trash2 size={16} /> Delete Business
                  </button>
                </>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); closeMenu(); openReportModal(biz.id); }}
                className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-text-secondary hover:bg-aurora-surface-variant transition-colors"
                disabled={state.reportedBusinesses.has(biz.id)}
              >
                <Flag size={16} /> {state.reportedBusinesses.has(biz.id) ? 'Reported' : 'Report Business'}
              </button>
              {biz.ownerId && biz.ownerId !== user?.uid && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeMenu(); openBlockConfirm(biz.ownerId!, biz.name); }}
                  className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-danger hover:bg-aurora-danger/10 transition-colors"
                >
                  <Ban size={16} /> {state.blockedUsers.has(biz.ownerId!) ? 'Blocked' : 'Block Owner'}
                </button>
              )}
            </div>
          </>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════
          REPORT BUSINESS MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {state.showReportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-aurora-surface rounded-2xl shadow-aurora-4 w-full max-w-md border border-aurora-border overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
            {/* Header */}
            <div className="px-5 py-4 border-b border-aurora-border bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 id="report-modal-title" className="text-lg font-bold text-aurora-text flex items-center gap-2">
                    <Flag size={18} className="text-red-500" />
                    Report Business
                  </h3>
                  <p className="text-sm text-aurora-text-muted mt-0.5">Select a category that best describes the issue</p>
                </div>
                <button onClick={() => dispatch({ type: 'CLOSE_REPORT' })} className="p-1.5 rounded-full hover:bg-aurora-surface-variant transition-colors">
                  <X size={18} className="text-aurora-text-muted" />
                </button>
              </div>
            </div>

            {/* Categories */}
            <div className="px-5 py-3 space-y-2 max-h-[40vh] overflow-y-auto">
              {REPORT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => dispatch({ type: 'SET_REPORT_REASON', payload: cat.id })}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${state.reportReason === cat.id
                      ? 'border-red-400 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-300'
                      : 'border-aurora-border hover:border-aurora-border-glass hover:bg-aurora-surface-variant'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg shrink-0">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${state.reportReason === cat.id ? 'text-red-700 dark:text-red-400' : 'text-aurora-text'}`}>
                        {cat.label}
                      </p>
                      <p className="text-xs text-aurora-text-muted mt-0.5 leading-relaxed">{cat.description}</p>
                    </div>
                    {state.reportReason === cat.id && (
                      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Optional Details */}
            {state.reportReason && (
              <div className="px-5 py-3 border-t border-aurora-border/50">
                <label className="text-xs font-semibold text-aurora-text-secondary uppercase tracking-wider">Additional Details (Optional)</label>
                <textarea
                  value={state.reportDetails}
                  onChange={(e) => dispatch({ type: 'SET_REPORT_DETAILS', payload: e.target.value })}
                  placeholder="Provide more context about why you're reporting this business..."
                  maxLength={500}
                  rows={3}
                  className="mt-1.5 w-full px-3 py-2.5 bg-aurora-surface-variant border border-aurora-border rounded-xl text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-red-300/50 resize-none"
                />
                <p className="text-[10px] text-aurora-text-muted text-right mt-1">{state.reportDetails.length}/500</p>
              </div>
            )}

            {/* Actions */}
            <div className="px-5 py-4 border-t border-aurora-border flex gap-3">
              <button
                onClick={() => { dispatch({ type: 'CLOSE_REPORT' }); }}
                className="flex-1 py-2.5 rounded-xl border border-aurora-border text-aurora-text-secondary font-medium hover:bg-aurora-surface-variant transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={!state.reportReason || state.reportSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition-colors btn-press flex items-center justify-center gap-2"
              >
                {state.reportSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                ) : (
                  <><Flag size={14} /> Submit Report</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          BLOCK USER CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {state.showBlockConfirm && state.blockTargetUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-aurora-surface rounded-2xl shadow-aurora-4 border border-aurora-border max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <Ban size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-aurora-text mb-2">Block {state.blockTargetUser.name}?</h3>
            <p className="text-sm text-aurora-text-muted mb-6">
              They won't be notified. Their businesses will be hidden from your listings. You can unblock them anytime from your Profile settings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { dispatch({ type: 'CLOSE_BLOCK_CONFIRM' }); }}
                className="flex-1 py-2.5 rounded-xl border border-aurora-border text-aurora-text-secondary font-medium hover:bg-aurora-surface-variant transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockUser}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {state.toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg z-[80] text-sm font-medium max-w-md text-center">
          {state.toastMessage}
        </div>
      )}
    </div>
  );
}
