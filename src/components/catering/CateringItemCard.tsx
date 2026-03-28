import type { FC } from 'react';
import { Plus, Utensils } from 'lucide-react';
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

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
      {/* Photo area */}
      <div className="relative h-40 w-full bg-gray-100">
        {item.photoUrl ? (
          <img
            src={item.photoUrl}
            alt={item.name}
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
          </div>

          <button
            onClick={handleAddToCart}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-white transition-colors duration-200"
            style={{
              backgroundColor: 'var(--aurora-primary, #6366F1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="text-sm">Add</span>
          </button>
        </div>
      </div>
    </div>
  );
}
