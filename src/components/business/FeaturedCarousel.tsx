import React, { useMemo } from 'react';
import {
  MapPin, Heart, Sparkles, Star, Navigation,
} from 'lucide-react';
import { parseOpenNow, formatDistance } from '@/components/business/businessUtils';
import type { Business } from '@/reducers/businessReducer';

export interface FeaturedCarouselProps {
  businesses: Business[];
  favorites: Set<string>;
  toggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSelect: (business: Business) => void;
  getDistance?: (business: Business) => number | null;
}

const FeaturedCarousel: React.FC<FeaturedCarouselProps> = React.memo(({
  businesses,
  favorites,
  toggleFavorite,
  onSelect,
  getDistance,
}) => {
  if (businesses.length === 0) return null;

  return (
    <section aria-label="Featured businesses" className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 id="featured-heading" className="text-lg font-bold text-aurora-text flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="7" />
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
          </svg>
          Featured
        </h2>
      </div>
      <div role="list" aria-labelledby="featured-heading" className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4" tabIndex={0} onKeyDown={(e) => { const el = e.currentTarget; if (e.key === 'ArrowRight') { el.scrollBy({ left: 200, behavior: 'smooth' }); } else if (e.key === 'ArrowLeft') { el.scrollBy({ left: -200, behavior: 'smooth' }); } }}>
        {businesses.map((business) => (
          <div
            key={business.id}
            role="listitem"
            tabIndex={0}
            aria-label={`Featured: ${business.name} — ${business.category}, rated ${business.rating.toFixed(1)} stars`}
            className="flex-shrink-0 w-80 rounded-2xl overflow-hidden cursor-pointer group
                       shadow-sm hover:shadow-lg transition-all duration-200 border border-aurora-border
                       focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:ring-offset-2 focus-visible:outline-none"
            style={{ background: `linear-gradient(180deg, ${business.bgColor}22 0%, ${business.bgColor}11 100%)` }}
            onClick={() => onSelect(business)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(business); } }}
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
                  loading="lazy"
                  decoding="async"
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
                aria-label={favorites.has(business.id) ? `Remove ${business.name} from favorites` : `Add ${business.name} to favorites`}
                aria-pressed={favorites.has(business.id)}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center
                           hover:bg-white transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none"
              >
                <Heart className={`w-4 h-4 ${favorites.has(business.id) ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
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
            <div className="p-3">
              <p className="text-xs text-aurora-text-secondary line-clamp-1 mb-2">{business.desc}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-semibold text-aurora-text">{business.rating.toFixed(1)}</span>
                  <span className="text-xs text-aurora-text-muted">({business.reviews})</span>
                </div>
                {(() => {
                  const status = parseOpenNow(business.hours);
                  if (!status) return null;
                  return (
                    <span className={'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none ' + (
                      status.isOpen
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                    )}>
                      <span className={'w-1.5 h-1.5 rounded-full flex-shrink-0 ' + (status.isOpen ? 'bg-emerald-500' : 'bg-red-500')} />
                      {status.label}
                    </span>
                  );
                })()}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-aurora-text-muted flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {business.location || 'No location'}
                  </span>
                  {(() => { const d = getDistance?.(business); return d != null ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      <Navigation className="w-2.5 h-2.5" />
                      {formatDistance(d)}
                    </span>
                  ) : null; })()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

FeaturedCarousel.displayName = 'FeaturedCarousel';
export default FeaturedCarousel;
