import React from 'react';
import {
  MapPin, Phone, Heart, Sparkles, Store, Star, MoreHorizontal,
} from 'lucide-react';
import { CATEGORY_ICONS } from '@/components/business/businessConstants';
import type { Business } from '@/reducers/businessReducer';

// Re-use the StarRating helper inline (tiny, no need for a separate file)
const StarRating = ({ rating, reviews }: { rating: number; reviews: number }) => (
  <div className="flex items-center gap-0.5">
    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
    <span className="text-xs font-semibold text-aurora-text">{rating.toFixed(1)}</span>
    <span className="text-xs text-aurora-text-muted">({reviews})</span>
  </div>
);

export interface BusinessCardProps {
  business: Business;
  isFavorite: boolean;
  toggleFavorite: (id: string, e: React.MouseEvent) => void;
  openMenu: (id: string, e: React.MouseEvent) => void;
  onSelect: (business: Business) => void;
  user: any;
}

const BusinessCard: React.FC<BusinessCardProps> = React.memo(({
  business,
  isFavorite,
  toggleFavorite,
  openMenu,
  onSelect,
  user,
}) => {
  const CategoryIcon = CATEGORY_ICONS[business.category] || Store;
  const heritageArr = business.heritage
    ? (Array.isArray(business.heritage) ? business.heritage : [business.heritage])
    : [];

  return (
    <div
      className="group bg-aurora-surface rounded-2xl border border-aurora-border overflow-visible
                 cursor-pointer hover:shadow-lg hover:border-aurora-border/80 transition-all duration-200"
      onClick={() => onSelect(business)}
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
              isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'
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
          <StarRating rating={business.rating} reviews={business.reviews} />
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
});

BusinessCard.displayName = 'BusinessCard';
export default BusinessCard;
