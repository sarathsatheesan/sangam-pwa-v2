import type { FC } from 'react';
import { useState } from 'react';
import { Plus, Minus, Utensils, Users, Cake, Coffee, UtensilsCrossed, Soup, Salad } from 'lucide-react';
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
  vegetarian: { bg: 'bg-green-100', text: 'text-green-700', icon: '🥬' },
  vegan: { bg: 'bg-green-100', text: 'text-green-700', icon: '🌱' },
  halal: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '☪️' },
  kosher: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '✡️' },
  gluten_free: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '🌾' },
  dairy_free: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '🥛' },
  nut_free: { bg: 'bg-pink-100', text: 'text-pink-700', icon: '🥜' },
  __default: { bg: 'var(--aurora-surface-variant)', text: 'var(--aurora-text-secondary)', icon: '🏷️' },
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
  const qty = cartQty ?? localQty;

  const minQty = item.minOrderQty || 1;
  const maxQty = item.maxOrderQty;

  const handleAddToCart = () => {
    setLocalQty(minQty);
    onAddToCart(item);
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
    <div className={`flex flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 ${isDisabled ? 'opacity-50 pointer-events-none' : 'hover:shadow-md'}`} style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }} role="article" aria-label={`${item.name} — ${formatPrice(item.price)} ${pricingLabel}${isDisabled ? ' — ' : ''}${isOutOfStock ? 'out of stock' : isDisabled ? 'currently unavailable' : ''}`}>
      {/* Photo area */}
      <div className="relative aspect-[5/3] w-full" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
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
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--aurora-text-muted)' }}>
                No photo yet
              </span>
            </div>
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
              {item.stockCount != null && item.stockCount > 0
                ? `${item.stockCount} left`
                : 'Low Stock'}
            </span>
          </div>
        )}

        {/* Unavailable / Out of Stock overlay */}
        {isDisabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: '#1f2937' }}>
              {isOutOfStock ? 'Out of Stock' : 'Currently Unavailable'}
            </span>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col p-4">
        {/* Name */}
        <h3 className="font-semibold" style={{ color: 'var(--aurora-text)' }}>{item.name}</h3>

        {/* Description */}
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
            {item.description}
          </p>
        )}

        {/* Dietary tags */}
        {item.dietaryTags && item.dietaryTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.dietaryTags.map(tag => {
              const info = DIETARY_TAG_INFO[tag] || DIETARY_TAG_INFO.__default;
              const isDefault = !DIETARY_TAG_INFO[tag];
              return (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${isDefault ? '' : `${info.bg} ${info.text}`}`}
                  style={isDefault ? { backgroundColor: info.bg, color: info.text } : {}}
                >
                  <span aria-hidden="true">{info.icon}</span>
                  {tag.replace(/_/g, ' ')}
                </span>
              );
            })}
          </div>
        )}

        {/* Price and button area */}
        <div className="mt-auto flex items-center justify-between pt-4">
          <div className="flex flex-col">
            <span className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>
              {formatPrice(item.price)}
            </span>
            <span className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>{pricingLabel}</span>
            {item.servesCount && (
              <span className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--aurora-text-muted)' }}>
                <Users size={10} aria-hidden="true" />
                Serves {item.servesCount}
              </span>
            )}
          </div>

          {qty === 0 ? (
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
          ) : (
            <div className="inline-flex items-center gap-2 rounded-lg px-2 py-2 border" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
              <button
                onClick={handleDecrement}
                disabled={isDisabled}
                className="inline-flex items-center justify-center h-7 w-7 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80"
                style={{
                  backgroundColor: qty > minQty ? 'var(--aurora-primary, #6366F1)' : 'var(--aurora-surface-variant)',
                  color: qty > minQty ? 'white' : 'var(--aurora-text-secondary)',
                }}
                aria-label={`Decrease quantity of ${item.name}`}
              >
                <Minus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold min-w-8 text-center" style={{ color: 'var(--aurora-text)' }}>
                {qty}
              </span>
              <button
                onClick={handleIncrement}
                disabled={isDisabled || (maxQty !== undefined && qty >= maxQty)}
                className="inline-flex items-center justify-center h-7 w-7 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-80"
                style={{
                  backgroundColor: 'var(--aurora-primary, #6366F1)',
                  color: 'white',
                }}
                aria-label={`Increase quantity of ${item.name}`}
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
