import type { FC } from 'react';
import { useState } from 'react';
import { Plus, Minus, Utensils, Users, Cake, Coffee, UtensilsCrossed, Soup, Salad, Clock, TrendingUp } from 'lucide-react';
import type { CateringMenuItem } from '@/services/cateringService';
import { formatPrice } from '@/services/cateringService';

interface CateringItemCardProps {
  item: CateringMenuItem;
  onAddToCart: (item: CateringMenuItem) => void;
  onUpdateQty?: (menuItemId: string, qty: number) => void;
  onRemoveFromCart?: (menuItemId: string) => void;
  cartQty?: number;
}

const DIETARY_TAG_INFO: Record<string, { bg: string; text: string; icon: string }> = {
  vegetarian: { bg: 'bg-green-50', text: 'text-green-600', icon: '🥬' },
  vegan: { bg: 'bg-green-50', text: 'text-green-600', icon: '🌱' },
  halal: { bg: 'bg-blue-50', text: 'text-blue-600', icon: '☪️' },
  kosher: { bg: 'bg-blue-50', text: 'text-blue-600', icon: '✡️' },
  gluten_free: { bg: 'bg-amber-50', text: 'text-amber-600', icon: '🌾' },
  dairy_free: { bg: 'bg-purple-50', text: 'text-purple-600', icon: '🥛' },
  nut_free: { bg: 'bg-pink-50', text: 'text-pink-600', icon: '🥜' },
  __default: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🏷️' },
};

export default function CateringItemCard({
  item,
  onAddToCart,
  onUpdateQty,
  onRemoveFromCart,
  cartQty,
}: CateringItemCardProps): ReturnType<FC> {
  // Use cartQty from parent (source of truth) if available, otherwise local state
  const [localQty, setLocalQty] = useState(0);
  const [addBounce, setAddBounce] = useState(false);
  const qty = cartQty ?? localQty;

  const minQty = item.minOrderQty || 1;
  const maxQty = item.maxOrderQty;

  const handleAddToCart = () => {
    setLocalQty(minQty);
    onAddToCart(item);
    // UI-11: bounce micro-animation
    setAddBounce(true);
    setTimeout(() => setAddBounce(false), 300);
  };

  const handleIncrement = () => {
    if (!maxQty || qty < maxQty) {
      const newQty = qty + 1;
      setLocalQty(newQty);
      if (onUpdateQty) {
        onUpdateQty(item.id, newQty);
      } else {
        onAddToCart(item);
      }
    }
  };

  const handleDecrement = () => {
    const newQty = qty - 1;
    if (newQty <= 0) {
      setLocalQty(0);
      if (onRemoveFromCart) {
        onRemoveFromCart(item.id);
      }
    } else {
      setLocalQty(newQty);
      if (onUpdateQty) {
        onUpdateQty(item.id, newQty);
      }
    }
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
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border transition-shadow duration-200 ${
        isDisabled ? 'opacity-50 pointer-events-none shadow-sm' : 'shadow-sm hover:shadow-md'
      }`}
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}
      role="article"
      aria-label={`${item.name} — ${formatPrice(item.price)} ${pricingLabel}${isOutOfStock ? ' — out of stock' : isUnavailable ? ' — currently unavailable' : ''}`}
    >
      {/* Photo area - 16:9 aspect ratio */}
      <div className="relative w-full" style={{ aspectRatio: '16/9', backgroundColor: '#F3F4F6' }}>
        {item.photoUrl ? (
          <img
            src={item.photoUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{
            backgroundImage: (() => {
              const gradients: Record<string, string> = {
                Appetizer: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                Entree: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
                Dessert: 'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)',
                Side: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
                Beverage: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)',
              };
              return gradients[item.category] || 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)';
            })(),
          }}>
            <div className="flex flex-col items-center gap-1.5 opacity-60">
              {(() => {
                const icons: Record<string, React.ReactNode> = {
                  Appetizer: <Salad className="h-10 w-10" strokeWidth={1.2} style={{ color: '#92400E' }} />,
                  Entree: <UtensilsCrossed className="h-10 w-10" strokeWidth={1.2} style={{ color: '#1E40AF' }} />,
                  Dessert: <Cake className="h-10 w-10" strokeWidth={1.2} style={{ color: '#BE185D' }} />,
                  Side: <Soup className="h-10 w-10" strokeWidth={1.2} style={{ color: '#047857' }} />,
                  Beverage: <Coffee className="h-10 w-10" strokeWidth={1.2} style={{ color: '#6D28D9' }} />,
                };
                return icons[item.category] || <Utensils className="h-10 w-10" strokeWidth={1.2} style={{ color: '#6B7280' }} />;
              })()}
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>
                No photo yet
              </span>
            </div>
          </div>
        )}

        {/* Category badge - top left, subtle semi-transparent dark background */}
        <div className="absolute left-3 top-3">
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          >
            {item.category}
          </span>
        </div>

        {/* Low Stock badge - subtle amber pill */}
        {item.stockStatus === 'low_stock' && !isDisabled && (
          <div className="absolute right-3 top-3">
            <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              {item.stockCount != null && item.stockCount > 0
                ? `${item.stockCount} left`
                : 'Low Stock'}
            </span>
          </div>
        )}

        {/* Unavailable / Out of Stock overlay */}
        {isDisabled && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)' }}>
            <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
              {isOutOfStock ? 'Out of Stock' : 'Currently Unavailable'}
            </span>
          </div>
        )}
      </div>

      {/* Content area - clean white with generous padding */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Name - font-semibold text-base */}
        <h3 className="font-semibold text-base" style={{ color: '#1F2937' }}>{item.name}</h3>

        {/* Description - text-sm with line-clamp-2 */}
        {item.description && (
          <p className="line-clamp-2 text-sm" style={{ color: '#6B7280' }}>
            {item.description}
          </p>
        )}

        {/* UI-07: Quick info pills — prep time, serves, popularity (subtle, inline, muted) */}
        {((item.prepTimeMinutes != null && item.prepTimeMinutes > 0) || item.servesCount || (item.popularityScore != null && item.popularityScore >= 70)) && (
          <div className="flex flex-wrap gap-1.5">
            {item.prepTimeMinutes != null && item.prepTimeMinutes > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100" style={{ color: '#6B7280' }}>
                <Clock size={9} aria-hidden="true" />
                {item.prepTimeMinutes < 60 ? `${item.prepTimeMinutes}m` : `${Math.floor(item.prepTimeMinutes / 60)}h${item.prepTimeMinutes % 60 ? ` ${item.prepTimeMinutes % 60}m` : ''}`}
              </span>
            )}
            {item.servesCount && (
              <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100" style={{ color: '#6B7280' }}>
                <Users size={9} aria-hidden="true" />
                Serves {item.servesCount}
              </span>
            )}
            {item.popularityScore != null && item.popularityScore >= 70 && (
              <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-50" style={{ color: '#92400E' }}>
                <TrendingUp size={9} aria-hidden="true" />
                Popular
              </span>
            )}
          </div>
        )}

        {/* Dietary tags - softer colors, smaller pills, reduced visual weight */}
        {item.dietaryTags && item.dietaryTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.dietaryTags.map(tag => {
              const info = DIETARY_TAG_INFO[tag] || DIETARY_TAG_INFO.__default;
              return (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${info.bg} ${info.text}`}
                >
                  <span aria-hidden="true">{info.icon}</span>
                  {tag.replace(/_/g, ' ')}
                </span>
              );
            })}
          </div>
        )}

        {/* Spacer to push price/button to bottom */}
        <div className="flex-1" />

        {/* Price and button area */}
        <div className="flex items-end justify-between gap-3">
          {/* Price section - text-xl font-bold with muted label below */}
          <div className="flex flex-col">
            <span className="text-xl font-bold" style={{ color: '#1F2937' }}>
              {formatPrice(item.price)}
            </span>
            <span className="text-xs" style={{ color: '#9CA3AF' }}>{pricingLabel}</span>
          </div>

          {/* Add button or stepper */}
          {qty === 0 ? (
            <button
              onClick={handleAddToCart}
              disabled={isDisabled}
              className="inline-flex items-center justify-center rounded-full px-5 py-2 font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#000000',
                transform: addBounce ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s',
              }}
              onMouseEnter={e => {
                if (!isDisabled) e.currentTarget.style.backgroundColor = '#1F2937';
              }}
              onMouseLeave={e => {
                if (!isDisabled) e.currentTarget.style.backgroundColor = '#000000';
              }}
              aria-label={`Add ${item.name} to cart — ${formatPrice(item.price)} ${pricingLabel}`}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            </button>
          ) : (
            <div className="inline-flex items-center gap-0 rounded-full border" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
              <button
                onClick={handleDecrement}
                disabled={isDisabled}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: qty > minQty ? '#000000' : '#F3F4F6',
                  color: qty > minQty ? 'white' : '#6B7280',
                }}
                aria-label={`Decrease quantity of ${item.name}`}
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold min-w-8 text-center" style={{ color: '#1F2937' }}>
                {qty}
              </span>
              <button
                onClick={handleIncrement}
                disabled={isDisabled || (maxQty !== undefined && qty >= maxQty)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#000000',
                  color: 'white',
                }}
                aria-label={`Increase quantity of ${item.name}`}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
