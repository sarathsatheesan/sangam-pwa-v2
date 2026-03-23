import React from 'react';
import {
  MapPin, Heart, Sparkles, Star,
} from 'lucide-react';
import type { Business } from '@/reducers/businessReducer';

export interface FeaturedCarouselProps {
  businesses: Business[];
  favorites: Set<string>;
  toggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSelect: (business: Business) => void;
}

const FeaturedCarousel: React.FC<FeaturedCarouselProps> = React.memo(({
  businesses,
  favorites,
  toggleFavorite,
  onSelect,
}) => {
  if (businesses.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-aurora-text flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="7" />
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
          </svg>
          Featured
        </h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
        {businesses.map((business) => (
          <div
            key={business.id}
            className="flex-shrink-0 w-80 rounded-2xl overflow-hidden cursor-pointer group
                       shadow-sm hover:shadow-lg transition-all duration-200 border border-aurora-border"
            onClick={() => onSelect(business)}
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
  );
});

FeaturedCarousel.displayName = 'FeaturedCarousel';
export default FeaturedCarousel;
