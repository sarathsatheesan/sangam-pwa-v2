import type { FC } from 'react';
import { Plus, Utensils, Users } from 'lucide-react';
import type { CateringMenuItem } from '@/services/cateringService';
import { formatPrice } from '@/services/cateringService';

interface CateringItemCardProps {
  item: CateringMenuItem;
  onAddToCart: (item: CateringMenuItem) => void;
}

const DIETARY_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  vegetarian: { bg: 'bg-green-100', text: 'text-green-700' },
  vegan: { bg: 'bg-green-100', text: 'text-green-700' },
  halal: { bg: 'bg-blue-100', text: 'text-blue-700' },
  kosher: { bg: 'bg-blue-100', text: 'text-blue-700' },
  gluten_free: { bg: 'bg-amber-100', text: 'text-amber-700' },
  dairy_free: { bg: 'bg-purple-100', text: 'text-purple-700' },
  nut_free: { bg: 'bg-pink-100', text: 'text-pink-700' },
};

export default function CateringItemCard({
  item,
  onAddToCart,
}: CateringItemCardProps): ReturnType<FC> {
  const handleAddToCart = () => {
    onAddToCart(item);
  };

  const pricingLabel = {
    per_person: '/ person',
    per_tray: '/ tray',
    flat_rate: 'flat rate',
  }[item.pricingType] || '/ person';

  const isUnavailable = item.available === false;
  const isOutOfStock = item.stockStatus === 'out_of_stock' || (item.stockCount !== undefined && item.stockCount !== null && item.stockCount <= 0);
  const isDisabled = isUnavailable || isOutOfStock;

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow duration-200 ${isDisabled ? 'opacity-50 pointer-events-none' : 'hover:shadow-md'}`} role="article" aria-label={`${item.name} — ${formatPrice(item.price)} ${pricingLabel}${isDisabled ? ' — ' : ''}${isOutOfStock ? 'out of stock' : isDisabled ? 'currently unavailable' : ''}`}>
      {/* Photo area */}
      <div className="relative h-40 w-full bg-gray-100">
        {item.photoUrl ? (
          <img
            src={item.photoUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <Utensils className="h-8 w-8 text-gray-400" strokeWidth={1.5} />
          </div>
        )}

        {/* Category badge - top right */}
        <div className="absolute right-3 top-3">
          <span
            className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--aurora-primary, #6366F1)' }}
          >
            {item.category}
          </span>
        </div>

        {/* Low Stock badge */}
        {item.stockStatus === 'low_stock' && !isDisabled && (
          <div className="absolute left-3 top-3">
            <span className="inline-block rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white">
              Low Stock
            </span>
          </div>
        )}

        {/* Unavailable / Out of Stock overlay */}
        {isDisabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white">
              {isOutOfStock ? 'Out of Stock' : 'Currently Unavailable'}
            </span>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col p-4">
        {/* Name */}
        <h3 className="font-semibold text-gray-900">{item.name}</h3>

        {/* Description */}
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">
            {item.description}
          </p>
        )}

        {/* Dietary tags */}
        {item.dietaryTags && item.dietaryTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.dietaryTags.map(tag => {
              const colors = DIETARY_TAG_COLORS[tag] || {
                bg: 'bg-gray-100',
                text: 'text-gray-700',
              };
              return (
                <span
                  key={tag}
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}
                >
                  {tag.replace(/_/g, ' ')}
                </span>
              );
            })}
          </div>
        )}

        {/* Price and button area */}
        <div className="mt-auto flex items-center justify-between pt-4">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900">
              {formatPrice(item.price)}
            </span>
            <span className="text-xs text-gray-500">{pricingLabel}</span>
            {item.servesCount && (
              <span className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Users size={10} aria-hidden="true" />
                Serves {item.servesCount}
              </span>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isDisabled}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--aurora-primary, #6366F1)',
            }}
            onMouseEnter={e => {
              if (!isDisabled) e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={e => {
              if (!isDisabled) e.currentTarget.style.opacity = '1';
            }}
            aria-label={`Add ${item.name} to cart — ${formatPrice(item.price)} ${pricingLabel}`}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            <span className="text-sm">Add</span>
          </button>
        </div>
      </div>
    </div>
  );
}
