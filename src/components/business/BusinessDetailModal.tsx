import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MapPin, Phone, Mail, Globe, Clock, Star, ChevronRight,
  X, Heart, Sparkles, ShoppingBag, ExternalLink, Trash2, Edit3,
  MoreHorizontal, Share2, BarChart3, MessageCircle, BadgeCheck, UserPlus,
  UserMinus, Plus, Calendar, Percent, Tag, Trash, CalendarClock,
} from 'lucide-react';
import { copyToClipboard } from '@/utils/clipboard';
import { getGoogleMapsUrl } from '@/components/business/businessValidation';
import PhotoLightbox from '@/components/business/PhotoLightbox';
import BusinessAnalyticsTab from '@/components/business/BusinessAnalyticsTab';
import BusinessQASection from '@/components/business/BusinessQASection';
import type { Business, BusinessReview, BusinessAnalytics } from '@/reducers/businessReducer';
import { recordView, recordContactClick, recordShare } from '@/services/businessAnalytics';
import { parseOpenNow } from '@/components/business/businessUtils';

// ── Photo carousel (local to detail modal) ──
// Navigation arrows are rendered at hero-banner level (not inside this component)
// so they sit above the gradient overlay z-index stacking context.
const BusinessPhotoCarousel: React.FC<{
  photos: string[];
  title: string;
  currentIndex: number;
  onShowLightbox: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}> = ({ photos, title, currentIndex, onShowLightbox, onTouchStart, onTouchEnd }) => {
  if (!photos.length) return null;

  return (
    <div
      className="relative w-full h-full z-[2]"
      role="region"
      aria-label={`Photo gallery for ${title}`}
      aria-roledescription="carousel"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={photos[currentIndex]}
        alt={`${title} — photo ${currentIndex + 1} of ${photos.length}`}
        decoding="async"
        className="w-full h-full object-cover cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onShowLightbox(); }}
        role="button"
        tabIndex={0}
        aria-label="Click to enlarge photo"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onShowLightbox(); } }}
      />
    </div>
  );
};

export interface BusinessDetailModalProps {
  business: Business;
  favorites: Set<string>;
  following: Set<string>;
  businessReviews: BusinessReview[];
  showReviewForm: boolean;
  newReview: { rating: number; text: string };
  user: any;
  isOwnerOrAdmin: (b: Business) => boolean;
  dispatch: React.Dispatch<any>;
  toggleFavorite: (id: string, e: React.MouseEvent) => void;
  toggleFollow: (id: string) => void;
  openMenu: (id: string, e: React.MouseEvent) => void;
  handleStartEdit: () => void;
  handleDeleteBusiness: (id: string) => void;
  handleAddReview: () => void;
  handleSaveDeals: (businessId: string, deals: import('@/reducers/businessReducer').Deal[]) => void;
  // Analytics (owner dashboard)
  analyticsData: BusinessAnalytics | null;
  analyticsLoading: boolean;
}

const BusinessDetailModal: React.FC<BusinessDetailModalProps> = ({
  business,
  favorites,
  following,
  businessReviews,
  showReviewForm,
  newReview,
  user,
  isOwnerOrAdmin,
  dispatch,
  toggleFavorite,
  toggleFollow,
  openMenu,
  handleStartEdit,
  handleDeleteBusiness,
  handleAddReview,
  handleSaveDeals,
  analyticsData,
  analyticsLoading,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [editingDeals, setEditingDeals] = useState<import('@/reducers/businessReducer').Deal[]>(business.deals || []);
  const [newDeal, setNewDeal] = useState({ title: '', description: '', discount: '', code: '', expiresAt: '' });

  // ── Photo carousel state (lifted here so arrows render at hero-banner z-level) ──
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const carouselTouchRef = useRef<{ x: number; time: number } | null>(null);
  const carouselPhotos = business.photos || [];
  const carouselGoPrev = useCallback(() => {
    if (carouselPhotos.length < 2) return;
    setCarouselIndex((p) => (p - 1 + carouselPhotos.length) % carouselPhotos.length);
  }, [carouselPhotos.length]);
  const carouselGoNext = useCallback(() => {
    if (carouselPhotos.length < 2) return;
    setCarouselIndex((p) => (p + 1) % carouselPhotos.length);
  }, [carouselPhotos.length]);
  const handleCarouselTouchStart = useCallback((e: React.TouchEvent) => {
    if (!e.touches || e.touches.length === 0) return;
    carouselTouchRef.current = { x: e.touches[0].clientX, time: Date.now() };
  }, []);
  const handleCarouselTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!carouselTouchRef.current || !e.changedTouches || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - carouselTouchRef.current.x;
    const dt = Date.now() - carouselTouchRef.current.time;
    if (Math.abs(dx) > 40 && dt < 400) {
      if (dx > 0) carouselGoPrev();
      else carouselGoNext();
    }
    carouselTouchRef.current = null;
  }, [carouselGoPrev, carouselGoNext]);

  // Share business
  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/business?open=${business.id}`;
    const shareData = {
      title: business.name,
      text: `Check out ${business.name} — ${business.category} on Sangam`,
      url: shareUrl,
    };

    try {
      if (typeof navigator.share === 'function' && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        recordShare(business.id);
      } else {
        await copyToClipboard(shareUrl);
        setShareToast('Link copied to clipboard!');
        setTimeout(() => setShareToast(null), 2500);
        recordShare(business.id);
      }
    } catch (err: any) {
      // User cancelled share or clipboard failed — try fallback
      if (err && err.name !== 'AbortError') {
        try {
          await copyToClipboard(shareUrl);
          setShareToast('Link copied to clipboard!');
          setTimeout(() => setShareToast(null), 2500);
        } catch {
          setShareToast('Could not share. Please copy the URL manually.');
          setTimeout(() => setShareToast(null), 3000);
        }
      }
    }
  }, [business.id, business.name, business.category]);

  // Record view for analytics (debounced per session in the service)
  useEffect(() => {
    recordView(business.id);
  }, [business.id]);

  // Prevent body scroll behind modal (including iOS Safari)
  useEffect(() => {
    const htmlEl = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const prevHtml = htmlEl.style.overflow;
    const prevBody = body.style.overflow;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;

    htmlEl.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    // iOS Safari fix: position:fixed prevents elastic scroll-through
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      htmlEl.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      window.scrollTo(0, scrollY); // Restore scroll position
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
          className="relative h-56 sm:rounded-t-2xl flex items-end p-5 overflow-hidden"
          style={{
            background: business.photos?.length ? '#000' : `linear-gradient(135deg, ${business.bgColor}, ${business.bgColor}cc)`,
          }}
        >
          {carouselPhotos.length > 0 && (
            <div className="absolute inset-0">
              <BusinessPhotoCarousel
                photos={carouselPhotos}
                title={business.name}
                currentIndex={carouselIndex}
                onShowLightbox={() => setShowLightbox(true)}
                onTouchStart={handleCarouselTouchStart}
                onTouchEnd={handleCarouselTouchEnd}
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent sm:rounded-t-2xl pointer-events-none z-[3]" />
          {/* Photo counter — swipe to navigate on touch, click image to open lightbox with full arrows */}
          {carouselPhotos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-2.5 py-0.5 rounded-full text-xs z-[4]" aria-live="polite" aria-atomic="true">
              {carouselIndex + 1} / {carouselPhotos.length}
            </div>
          )}
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
              <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-bold text-white leading-tight">{business.name}</h2>
                {business.verified && (
                  <BadgeCheck className="w-5 h-5 text-blue-400 flex-shrink-0" aria-label="Verified business" />
                )}
              </div>
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

            {/* Verification Badge Banner */}
            {business.verified && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl px-4 py-2.5 border border-blue-200/50 dark:border-blue-500/20">
                <BadgeCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Verified Business</p>
                  <p className="text-[11px] text-blue-600/70 dark:text-blue-400/60">
                    {business.verificationMethod === 'tin' ? 'Verified via TIN / Tax ID'
                      : business.verificationMethod === 'admin' ? 'Verified by admin'
                      : business.verificationMethod === 'document' ? 'Verified via document review'
                      : 'Identity confirmed'}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons Row: Message + Follow */}
            {user && business.ownerId && business.ownerId !== user.uid && (
              <div className="flex gap-2">
                <a
                  href={`/messages?user=${business.ownerId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    recordContactClick(business.id);
                    window.location.href = `/messages?user=${business.ownerId}`;
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-aurora-indigo text-white py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none"
                  aria-label={`Message ${business.name}`}
                >
                  <MessageCircle className="w-4 h-4" />
                  Message Business
                </a>
                <button
                  onClick={() => toggleFollow(business.id)}
                  aria-label={following.has(business.id) ? `Unfollow ${business.name}` : `Follow ${business.name}`}
                  aria-pressed={following.has(business.id)}
                  className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none ${
                    following.has(business.id)
                      ? 'bg-aurora-indigo/10 text-aurora-indigo border border-aurora-indigo/30 hover:bg-aurora-indigo/20'
                      : 'bg-aurora-surface-variant text-aurora-text hover:bg-aurora-border/30 border border-aurora-border'
                  }`}
                >
                  {following.has(business.id) ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {following.has(business.id) ? 'Following' : 'Follow'}
                </button>
              </div>
            )}

            {/* About */}
            {business.desc && (
              <div>
                <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">About{business.yearEstablished ? ` (Since ${business.yearEstablished})` : ''}</h4>
                <p className="text-sm text-aurora-text-secondary leading-relaxed">{business.desc}</p>
              </div>
            )}

            {/* Quick Info Row */}
            {business.priceRange && (
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[120px] bg-aurora-surface-variant rounded-xl p-3 text-center">
                  <p className="text-[10px] font-semibold text-aurora-text-muted uppercase tracking-wider">Price Range</p>
                  <p className="text-sm font-bold text-aurora-text mt-1">{business.priceRange}</p>
                </div>
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
                    onClick={() => recordContactClick(business.id)}
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
                    onClick={() => recordContactClick(business.id)}
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
                    onClick={() => recordContactClick(business.id)}
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
                {/* Booking / Reservation link (#36) */}
                {business.bookingUrl && (
                  <a
                    href={business.bookingUrl.startsWith('http') ? business.bookingUrl : `https://${business.bookingUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-gradient-to-r from-aurora-indigo/5 to-purple-500/5 rounded-xl px-4 py-3 hover:from-aurora-indigo/10 hover:to-purple-500/10 transition-colors border border-aurora-indigo/20"
                    onClick={() => recordContactClick(business.id)}
                  >
                    <div className="w-9 h-9 rounded-full bg-aurora-indigo/10 flex items-center justify-center flex-shrink-0">
                      <CalendarClock className="w-4 h-4 text-aurora-indigo" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-aurora-indigo">Book a Reservation</p>
                      <p className="text-xs text-aurora-text-muted mt-0.5">Schedule online</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-aurora-indigo/60 flex-shrink-0" />
                  </a>
                )}
              </div>
            </div>

            {/* Hours + Open Now indicator (#24) */}
            {business.hours && (() => {
              const openStatus = parseOpenNow(business.hours);
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Hours</h4>
                    {openStatus && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        openStatus.isOpen
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${openStatus.isOpen ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {openStatus.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3">
                    <Clock className="w-4 h-4 text-aurora-text-muted mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-aurora-text-secondary whitespace-pre-line">{business.hours}</p>
                  </div>
                </div>
              );
            })()}

            {/* Deals */}
            {(business.deals && business.deals.length > 0) || isOwnerOrAdmin(business) ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Current Deals</h4>
                  {isOwnerOrAdmin(business) && (
                    <button
                      onClick={() => setShowDealForm((v) => !v)}
                      className="text-xs text-aurora-indigo font-medium hover:underline flex items-center gap-1"
                      aria-expanded={showDealForm}
                    >
                      <Plus className="w-3.5 h-3.5" /> {showDealForm ? 'Cancel' : 'Manage Deals'}
                    </button>
                  )}
                </div>

                {/* Deal creation form (owner only) */}
                {showDealForm && isOwnerOrAdmin(business) && (
                  <div className="space-y-3 bg-aurora-surface-variant rounded-xl p-4 border border-aurora-indigo/20 mb-3">
                    <h5 className="text-sm font-semibold text-aurora-text">Add New Deal</h5>
                    <input
                      type="text"
                      placeholder="Deal title (e.g., Grand Opening Special)"
                      value={newDeal.title}
                      onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                      className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-lg text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={newDeal.description}
                      onChange={(e) => setNewDeal({ ...newDeal, description: e.target.value })}
                      className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-lg text-sm text-aurora-text placeholder:text-aurora-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-aurora-text-muted font-medium uppercase flex items-center gap-1 mb-1"><Percent className="w-3 h-3" /> Discount %</label>
                        <input
                          type="number"
                          placeholder="e.g., 20"
                          value={newDeal.discount}
                          onChange={(e) => setNewDeal({ ...newDeal, discount: e.target.value })}
                          className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-lg text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-aurora-text-muted font-medium uppercase flex items-center gap-1 mb-1"><Tag className="w-3 h-3" /> Promo Code</label>
                        <input
                          type="text"
                          placeholder="e.g., SAVE20"
                          value={newDeal.code}
                          onChange={(e) => setNewDeal({ ...newDeal, code: e.target.value })}
                          className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-lg text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-aurora-text-muted font-medium uppercase flex items-center gap-1 mb-1"><Calendar className="w-3 h-3" /> Expires</label>
                      <input
                        type="date"
                        value={newDeal.expiresAt}
                        onChange={(e) => setNewDeal({ ...newDeal, expiresAt: e.target.value })}
                        onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
                        className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-lg text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (!newDeal.title.trim()) return;
                        // Build deal without undefined values — Firestore rejects undefined
                        const deal: import('@/reducers/businessReducer').Deal = {
                          id: `deal_${Date.now()}`,
                          title: newDeal.title.trim(),
                        };
                        if (newDeal.description.trim()) deal.description = newDeal.description.trim();
                        if (newDeal.discount) deal.discount = Number(newDeal.discount);
                        if (newDeal.code.trim()) deal.code = newDeal.code.trim();
                        if (newDeal.expiresAt) deal.expiresAt = newDeal.expiresAt;
                        const updatedDeals = [...editingDeals, deal];
                        setEditingDeals(updatedDeals);
                        handleSaveDeals(business.id, updatedDeals);
                        setNewDeal({ title: '', description: '', discount: '', code: '', expiresAt: '' });
                      }}
                      disabled={!newDeal.title.trim()}
                      className="w-full px-3 py-2.5 bg-aurora-indigo text-white rounded-xl text-sm font-medium hover:bg-aurora-indigo/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Deal
                    </button>
                  </div>
                )}

                {/* Display existing deals */}
                <div className="space-y-2">
                  {editingDeals.map((deal, idx) => (
                    <div key={deal.id || idx} className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 border border-red-200/50 dark:border-red-500/20 relative">
                      <h5 className="font-semibold text-red-700 dark:text-red-400 text-sm">{deal.title}</h5>
                      {deal.description && <p className="text-sm text-red-600 dark:text-red-300/80 mt-1">{deal.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        {deal.discount != null && <span className="text-sm text-red-700 dark:text-red-400 font-bold">{deal.discount}% Off</span>}
                        {deal.code && <span className="text-xs text-red-600 dark:text-red-300/60">Code: <span className="font-mono font-bold">{deal.code}</span></span>}
                        {deal.expiresAt && <span className="text-xs text-red-500/60">Expires: {typeof deal.expiresAt === 'string' ? deal.expiresAt : ''}</span>}
                      </div>
                      {isOwnerOrAdmin(business) && showDealForm && (
                        <button
                          onClick={() => {
                            const updatedDeals = editingDeals.filter((_, i) => i !== idx);
                            setEditingDeals(updatedDeals);
                            handleSaveDeals(business.id, updatedDeals);
                          }}
                          aria-label={`Remove deal: ${deal.title}`}
                          className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-red-200/50 dark:hover:bg-red-500/20 transition-colors"
                        >
                          <Trash className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                  {editingDeals.length === 0 && isOwnerOrAdmin(business) && !showDealForm && (
                    <div className="text-center py-4 bg-aurora-surface-variant rounded-xl">
                      <Tag className="w-5 h-5 text-aurora-text-muted mx-auto mb-1.5" />
                      <p className="text-xs text-aurora-text-muted">No active deals</p>
                      <button onClick={() => setShowDealForm(true)} className="text-xs text-aurora-indigo font-medium hover:underline mt-1">Create your first deal</button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

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

            {/* Q&A Section (#35) */}
            <BusinessQASection
              business={business}
              user={user}
              isOwnerOrAdmin={isOwnerOrAdmin(business)}
            />

            {/* Owner Analytics Section */}
            {isOwnerOrAdmin(business) && (
              <div>
                <button
                  onClick={() => setShowAnalytics((v) => !v)}
                  className="flex items-center gap-2 w-full text-left"
                  aria-expanded={showAnalytics}
                  aria-controls="analytics-panel"
                >
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Analytics Dashboard</h4>
                  <ChevronRight className={`w-4 h-4 text-aurora-text-muted ml-auto transition-transform ${showAnalytics ? 'rotate-90' : ''}`} />
                </button>
                {showAnalytics && (
                  <div id="analytics-panel" className="mt-3">
                    <BusinessAnalyticsTab
                      businessId={business.id}
                      analyticsData={analyticsData}
                      analyticsLoading={analyticsLoading}
                      dispatch={dispatch}
                    />
                  </div>
                )}
              </div>
            )}

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
      {/* Photo lightbox — rendered outside modal container for full-screen overlay */}
      {showLightbox && carouselPhotos.length > 0 && (
        <PhotoLightbox
          photos={carouselPhotos}
          initialIndex={carouselIndex}
          title={business.name}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </div>
  );
};

export default BusinessDetailModal;
