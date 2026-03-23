import React, { useEffect, useRef, useCallback, useReducer } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search, MapPin, Phone, Star, X, Plus, Heart, Sparkles, Store,
  Filter, Loader2, TrendingUp,
} from 'lucide-react';
import { useFeatureSettings } from '@/contexts/FeatureSettingsContext';
import EthnicityFilterDropdown from '@/components/EthnicityFilterDropdown';
import {
  CATEGORIES, CATEGORY_ICONS,
} from '@/components/business/businessConstants';
import { businessReducer, createInitialState, type Business } from '@/reducers/businessReducer';
import { useBusinessData } from '@/hooks/useBusinessData';
import { useBusinessFilters } from '@/hooks/useBusinessFilters';
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

  // ── Select business handler (memoized for card/carousel) ──
  const handleSelectBusiness = useCallback((business: Business) => {
    dispatch({ type: 'SELECT_BUSINESS', payload: business });
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'about' });
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
              <FeaturedCarousel
                businesses={featuredBusinesses}
                favorites={state.favorites}
                toggleFavorite={toggleFavorite}
                onSelect={handleSelectBusiness}
              />
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
                {filteredBusinesses.map((business) => (
                  <BusinessCard
                    key={business.id}
                    business={business}
                    isFavorite={state.favorites.has(business.id)}
                    toggleFavorite={toggleFavorite}
                    openMenu={openMenu}
                    onSelect={handleSelectBusiness}
                    user={user}
                  />
                ))}
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
          businessReviews={state.businessReviews}
          showReviewForm={state.showReviewForm}
          newReview={state.newReview}
          user={user}
          isOwnerOrAdmin={isOwnerOrAdmin}
          dispatch={dispatch}
          toggleFavorite={toggleFavorite}
          openMenu={openMenu}
          handleStartEdit={handleStartEdit}
          handleDeleteBusiness={handleDeleteBusiness}
          handleAddReview={handleAddReview}
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
            user={user}
            reportedBusinesses={state.reportedBusinesses}
            blockedUsers={state.blockedUsers}
            closeMenu={closeMenu}
            handleStartEdit={handleStartEdit}
            handleDeleteBusiness={handleDeleteBusiness}
            openReportModal={openReportModal}
            openBlockConfirm={openBlockConfirm}
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

      {/* Toast Notification */}
      {state.toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg z-[80] text-sm font-medium max-w-md text-center">
          {state.toastMessage}
        </div>
      )}
    </div>
  );
}
