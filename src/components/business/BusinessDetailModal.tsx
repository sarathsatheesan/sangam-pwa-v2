import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Phone, Mail, Globe, Clock, Star, ChevronRight, ChevronLeft,
  X, Heart, Sparkles, ShoppingBag, ExternalLink, Trash2, Edit3,
  MoreHorizontal, Share2,
} from 'lucide-react';
import { getGoogleMapsUrl } from '@/components/business/businessValidation';
import PhotoLightbox from '@/components/business/PhotoLightbox';
import type { Business, BusinessReview } from '@/reducers/businessReducer';

// ── Photo carousel (local to detail modal) ──
const BusinessPhotoCarousel: React.FC<{
  photos: string[];
  title: string;
}> = ({ photos, title }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const touchStartRef = useRef<{ x: number; time: number } | null>(null);
  if (!photos.length) return null;

  const goPrev = () => setCurrentIndex((p) => (p - 1 + photos.length) % photos.length);
  const goNext = () => setCurrentIndex((p) => (p + 1) % photos.length);

  // Touch swipe handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, time: Date.now() };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dt = Date.now() - touchStartRef.current.time;
    if (Math.abs(dx) > 40 && dt < 400) {
      if (dx > 0) goPrev();
      else goNext();
    }
    touchStartRef.current = null;
  };

  return (
    <>
      <div
        className="relative w-full h-full z-[2]"
        role="region"
        aria-label={`Photo gallery for ${title}`}
        aria-roledescription="carousel"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={photos[currentIndex]}
          alt={`${title} — photo ${currentIndex + 1} of ${photos.length}`}
          decoding="async"
          className="w-full h-full object-cover cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setShowLightbox(true); }}
          role="button"
          tabIndex={0}
          aria-label="Click to enlarge photo"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setShowLightbox(true); } }}
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              aria-label="Previous photo"
              className="absolute left-2 bottom-8 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              aria-label="Next photo"
              className="absolute right-2 bottom-8 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-2.5 py-0.5 rounded-full text-xs" aria-live="polite" aria-atomic="true">
              {currentIndex + 1} / {photos.length}
            </div>
          </>
        )}
      </div>
      {showLightbox && (
        <PhotoLightbox
          photos={photos}
          initialIndex={currentIndex}
          title={title}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </>
  );
};

export interface BusinessDetailModalProps {
  business: Business;
  favorites: Set<string>;
  businessReviews: BusinessReview[];
  showReviewForm: boolean;
  newReview: { rating: number; text: string };
  user: any;
  isOwnerOrAdmin: (b: Business) => boolean;
  dispatch: React.Dispatch<any>;
  toggleFavorite: (id: string, e: React.MouseEvent) => void;
  openMenu: (id: string, e: React.MouseEvent) => void;
  handleStartEdit: () => void;
  handleDeleteBusiness: (id: string) => void;
  handleAddReview: () => void;
}

const BusinessDetailModal: React.FC<BusinessDetailModalProps> = ({
  business,
  favorites,
  businessReviews,
  showReviewForm,
  newReview,
  user,
  isOwnerOrAdmin,
  dispatch,
  toggleFavorite,
  openMenu,
  handleStartEdit,
  handleDeleteBusiness,
  handleAddReview,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Share business
  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/business?open=${business.id}`;
    const shareData = {
      title: business.name,
      text: `Check out ${business.name} — ${business.category} on Sangam`,
      url: shareUrl,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareToast('Link copied to clipboard!');
        setTimeout(() => setShareToast(null), 2500);
      }
    } catch (err: any) {
      // User cancelled share or clipboard failed — try fallback
      if (err.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setShareToast('Link copied to clipboard!');
          setTimeout(() => setShareToast(null), 2500);
        } catch {
          setShareToast('Could not share. Please copy the URL manually.');
          setTimeout(() => setShareToast(null), 3000);
        }
      }
    }
  }, [business.id, business.name, business.category]);

  // Prevent body scroll behind modal (including iOS Safari)
  useEffect(() => {
    const htmlEl = document.documentElement;
    const prevHtml = htmlEl.style.overflow;
    const prevBody = document.body.style.overflow;
    htmlEl.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      htmlEl.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  // Focus trap + ESC-to-close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT_BUSINESS', payload: null });
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus the modal on mount
    const prev = document.activeElement as HTMLElement;
    modalRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prev?.focus?.();
    };
  }, [dispatch]);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={() => dispatch({ type: 'SELECT_BUSINESS', payload: null })}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${business.name} details`}
        tabIndex={-1}
        className="bg-aurora-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl
                   max-h-[92vh] flex flex-col border border-aurora-border relative focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal action buttons */}
        <button
          onClick={() => dispatch({ type: 'SELECT_BUSINESS', payload: null })}
          aria-label="Close business details"
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center text-white transition-colors z-[5] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <X className="w-5 h-5" />
        </button>
        {user && (
          <button
            onClick={(e) => openMenu(business.id, e)}
            aria-label={`More options for ${business.name}`}
            aria-haspopup="menu"
            className="absolute top-3 right-14 z-[5] w-10 h-10 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center text-white transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleShare}
          aria-label={`Share ${business.name}`}
          className={`absolute top-3 ${user ? 'right-[8.5rem]' : 'right-24'} w-10 h-10 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center text-white transition-colors z-[5] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none`}
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => toggleFavorite(business.id, e)}
          aria-label={favorites.has(business.id) ? `Remove ${business.name} from favorites` : `Add ${business.name} to favorites`}
          aria-pressed={favorites.has(business.id)}
          className={`absolute top-3 ${user ? 'right-24' : 'right-14'} w-10 h-10 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center transition-colors z-[5] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none`}
        >
          <Heart className={`w-4 h-4 ${favorites.has(business.id) ? 'fill-red-400 text-red-400' : 'text-white'}`} />
        </button>

        {/* Hero Banner */}
        <div
          className="relative h-40 sm:rounded-t-2xl flex items-end p-5 overflow-hidden"
          style={{
            background: business.photos?.length ? '#000' : `linear-gradient(135deg, ${business.bgColor}, ${business.bgColor}cc)`,
          }}
        >
          {business.photos && business.photos.length > 0 && (
            <div className="absolute inset-0">
              <BusinessPhotoCarousel photos={business.photos} title={business.name} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent sm:rounded-t-2xl pointer-events-none z-[3]" />
          {business.promoted && (
            <div className="absolute top-3 left-3 z-[4]">
              <span className="px-2.5 py-1 bg-amber-400 text-amber-900 text-[11px] font-bold rounded-lg flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> FEATURED
              </span>
            </div>
          )}
          <div className="relative z-[4] flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl">
              {business.emoji}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">{business.name}</h2>
              <p className="text-white/80 text-sm">{business.category}</p>
              <div className="flex items-center gap-2 mt-1">
                <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                <span className="text-white font-semibold text-sm">{business.rating.toFixed(1)}</span>
                <span className="text-white/70 text-xs">({business.reviews} reviews)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-6">

            {/* About */}
            {business.desc && (
              <div>
                <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">About</h4>
                <p className="text-sm text-aurora-text-secondary leading-relaxed">{business.desc}</p>
              </div>
            )}

            {/* Quick Info Row */}
            {(business.yearEstablished || business.priceRange) && (
              <div className="flex gap-3 flex-wrap">
                {business.yearEstablished && (
                  <div className="flex-1 min-w-[120px] bg-aurora-surface-variant rounded-xl p-3 text-center">
                    <p className="text-[10px] font-semibold text-aurora-text-muted uppercase tracking-wider">Established</p>
                    <p className="text-sm font-bold text-aurora-text mt-1">{business.yearEstablished}</p>
                  </div>
                )}
                {business.priceRange && (
                  <div className="flex-1 min-w-[120px] bg-aurora-surface-variant rounded-xl p-3 text-center">
                    <p className="text-[10px] font-semibold text-aurora-text-muted uppercase tracking-wider">Price Range</p>
                    <p className="text-sm font-bold text-aurora-text mt-1">{business.priceRange}</p>
                  </div>
                )}
              </div>
            )}

            {/* Heritage */}
            {business.heritage && (
              <div>
                <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Heritage</h4>
                <div className="flex gap-2 flex-wrap">
                  {(Array.isArray(business.heritage) ? business.heritage : [business.heritage]).map((h) => (
                    <span key={h} className="text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-200/50 dark:border-amber-500/20">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Specialties */}
            {business.specialtyTags && business.specialtyTags.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Specialties</h4>
                <div className="flex gap-2 flex-wrap">
                  {business.specialtyTags.map((tag) => (
                    <span key={tag} className="text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Methods */}
            {business.paymentMethods && business.paymentMethods.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Payment Methods</h4>
                <div className="flex gap-2 flex-wrap">
                  {business.paymentMethods.map((method) => (
                    <span key={method} className="text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-3 py-1 rounded-full">
                      {method}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contact */}
            <div>
              <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Contact</h4>
              <div className="space-y-2">
                {business.location && (
                  <a
                    href={getGoogleMapsUrl(business.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-aurora-indigo/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-aurora-indigo" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-aurora-text truncate">{business.location}</p>
                      <p className="text-xs text-aurora-indigo mt-0.5">Open in Google Maps</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-aurora-text-muted flex-shrink-0" />
                  </a>
                )}
                {business.phone && (
                  <a
                    href={`tel:${business.phone}`}
                    className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-aurora-text">{business.phone}</p>
                      <p className="text-xs text-aurora-text-muted mt-0.5">Tap to call</p>
                    </div>
                  </a>
                )}
                {business.email && (
                  <a
                    href={`mailto:${business.email}`}
                    className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-aurora-text truncate">{business.email}</p>
                      <p className="text-xs text-aurora-text-muted mt-0.5">Send email</p>
                    </div>
                  </a>
                )}
                {business.website && (
                  <a
                    href={business.website.startsWith('http') ? business.website : `https://${business.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-aurora-indigo truncate">{business.website}</p>
                      <p className="text-xs text-aurora-text-muted mt-0.5">Visit website</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-aurora-text-muted flex-shrink-0" />
                  </a>
                )}
              </div>
            </div>

            {/* Hours */}
            {business.hours && (
              <div>
                <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Hours</h4>
                <div className="flex items-start gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3">
                  <Clock className="w-4 h-4 text-aurora-text-muted mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-aurora-text-secondary whitespace-pre-line">{business.hours}</p>
                </div>
              </div>
            )}

            {/* Deals */}
            {business.deals && business.deals.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Current Deals</h4>
                <div className="space-y-2">
                  {business.deals.map((deal, idx) => (
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

            <div className="border-t border-aurora-border" />

            {/* Services */}
            {business.services && (
              <div>
                <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Services Offered</h4>
                <div className="bg-aurora-surface-variant rounded-xl p-4">
                  <p className="text-sm text-aurora-text-secondary whitespace-pre-line leading-relaxed">{business.services}</p>
                </div>
              </div>
            )}

            {business.menu && (
              <div>
                <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">
                  {business.category === 'Restaurant & Food' ? 'Menu' : 'Products'}
                </h4>
                <div className="bg-aurora-surface-variant rounded-xl p-4">
                  <p className="text-sm text-aurora-text-secondary whitespace-pre-line leading-relaxed">{business.menu}</p>
                </div>
              </div>
            )}

            {!business.services && !business.menu && isOwnerOrAdmin(business) && (
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

            <div className="border-t border-aurora-border" />

            {/* Reviews Section */}
            <div className="space-y-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Reviews</h4>
                  {businessReviews.length > 0 && (
                    <p className="text-sm text-aurora-text mt-1">{businessReviews.length} review{businessReviews.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
                {!showReviewForm && user && businessReviews.length > 0 && (
                  <button
                    onClick={() => dispatch({ type: 'SET_SHOW_REVIEW_FORM', payload: true })}
                    className="px-3 py-1.5 bg-aurora-indigo text-white rounded-lg text-xs font-medium hover:bg-aurora-indigo/90 transition-colors flex items-center gap-1"
                  >
                    <Star className="w-3.5 h-3.5" />
                    Write a Review
                  </button>
                )}
              </div>

              {showReviewForm && (
                <div className="space-y-4 bg-aurora-surface-variant rounded-xl p-4 border border-aurora-indigo/20">
                  <h4 className="text-sm font-semibold text-aurora-text">Write a Review</h4>
                  <div>
                    <label id="rating-label" className="text-xs font-medium text-aurora-text block mb-2">Rating</label>
                    <div className="flex gap-1 mb-3" role="radiogroup" aria-labelledby="rating-label">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          role="radio"
                          aria-checked={rating === newReview.rating}
                          aria-label={`${rating} star${rating !== 1 ? 's' : ''}`}
                          onClick={() => dispatch({ type: 'SET_NEW_REVIEW', payload: { ...newReview, rating } })}
                          className="transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none rounded"
                        >
                          <Star
                            className={`w-6 h-6 ${rating <= newReview.rating ? 'fill-amber-400 text-amber-400' : 'text-aurora-border'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <textarea
                      placeholder="Share your experience..."
                      value={newReview.text}
                      onChange={(e) => dispatch({ type: 'SET_NEW_REVIEW', payload: { ...newReview, text: e.target.value } })}
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

              {businessReviews.length > 0 ? (
                <div className="space-y-3">
                  {businessReviews.map((review) => (
                    <div key={review.id} className="bg-aurora-surface-variant rounded-xl p-3.5">
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <p className="text-sm font-semibold text-aurora-text">{review.userName}</p>
                          <div className="flex items-center gap-1 mt-0.5" role="img" aria-label={`${review.rating} out of 5 stars`}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                aria-hidden="true"
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
              ) : !showReviewForm ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-4">
                    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <circle cx="40" cy="40" r="30" className="fill-amber-50 dark:fill-amber-500/10" />
                      <path d="M40 22l5.5 11.2 12.3 1.8-8.9 8.7 2.1 12.2L40 50.2l-11 5.7 2.1-12.2-8.9-8.7 12.3-1.8L40 22z" className="stroke-amber-400" strokeWidth="2" fill="none" />
                      <circle cx="33" cy="40" r="1.5" className="fill-amber-400" />
                      <circle cx="47" cy="40" r="1.5" className="fill-amber-400" />
                      <path d="M35 46c2 2 8 2 10 0" className="stroke-amber-400" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-aurora-text mb-1">No reviews yet</p>
                  <p className="text-xs text-aurora-text-muted mb-4">Your feedback helps others discover great businesses</p>
                  {user && (
                    <button
                      onClick={() => dispatch({ type: 'SET_SHOW_REVIEW_FORM', payload: true })}
                      className="px-4 py-2 bg-aurora-indigo text-white rounded-xl text-sm font-medium hover:bg-aurora-indigo/90 transition-colors flex items-center gap-1.5 mx-auto"
                    >
                      <Star className="w-3.5 h-3.5" /> Write the First Review
                    </button>
                  )}
                  {!user && (
                    <p className="text-xs text-aurora-text-secondary">Sign in to leave a review</p>
                  )}
                </div>
              ) : null}

              {businessReviews.length > 0 && !showReviewForm && user && (
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

        {/* Share toast */}
        {shareToast && (
          <div role="alert" aria-live="assertive" className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-xl shadow-lg z-10 text-sm font-medium whitespace-nowrap">
            {shareToast}
          </div>
        )}

        {/* Action Buttons */}
        {isOwnerOrAdmin(business) && (
          <div className="border-t border-aurora-border p-4 flex gap-3 bg-aurora-surface sm:rounded-b-2xl">
            <button
              onClick={handleStartEdit}
              className="flex-1 flex items-center justify-center gap-2 bg-aurora-indigo text-white py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 transition-colors"
            >
              <Edit3 className="w-4 h-4" /> Edit Business
            </button>
            <button
              onClick={() => handleDeleteBusiness(business.id)}
              className="px-4 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl font-medium text-sm hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessDetailModal;
