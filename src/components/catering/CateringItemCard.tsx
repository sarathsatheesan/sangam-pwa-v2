import type { FC } from 'react';
import { memo, useState } from 'react';
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
  vegetarian: { bg: 'bg-green-50', text: 'text-green-700', icon: '🥬' },
  vegan: { bg: 'bg-green-50', text: 'text-green-700', icon: '🌱' },
  halal: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '☪️' },
  kosher: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '✡️' },
  gluten_free: { bg: 'bg-amber-50', text: 'text-amber-700', icon: '🌾' },
  dairy_free: { bg: 'bg-purple-50', text: 'text-purple-700', icon: '🥛' },
  nut_free: { bg: 'bg-pink-50', text: 'text-pink-700', icon: '🥜' },
  __default: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🏷️' },
};

function CateringItemCard({
  item,
  onAddToCart,
  onUpdateQty,
  onRemoveFromCart,
  cartQty,
}: CateringItemCardProps): ReturnType<FC> {
  const [localQty, setLocalQty] = useState(0);
  const [addBounce, setAddBounce] = useState(false);
  const qty = cartQty ?? localQty;

  const minQty = item.minOrderQty || 1;
  const maxQty = item.maxOrderQty;

  const handleAddToCart = () => {
    setLocalQty(minQty);
    onAddToCart(item);
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
      className={`flex flex-row items-stretch rounded-xl border transition-shadow duration-200 overflow-hidden ${
        isDisabled ? 'opacity-50 pointer-events-none' : 'hover:shadow-md cursor-pointer'
      }`}
      style={{
        backgroundColor: 'var(--aurora-surface, #FFFFFF)',
        borderColor: 'var(--aurora-border, #E5E7EB)',
        /* Horizontal card — Uber Eats style */
        minHeight: '148px',
      }}
      role="article"
      aria-label={`${item.name} — ${formatPrice(item.price)} ${pricingLabel}${isOutOfStock ? ' — out of stock' : isUnavailable ? ' — currently unavailable' : ''}`}
    >
      {/* ── Left: Text content ── */}
      <div className="flex flex-1 flex-col justify-between gap-1.5 p-3 sm:p-4 min-w-0">
        {/* Name */}
        <h3
          className="font-semibold text-sm sm:text-base leading-snug line-clamp-2"
          style={{ color: 'var(--aurora-text, #1F2937)' }}
        >
          {item.name}
        </h3>

        {/* Price + pricing type — prominent, Uber Eats puts this right after name */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm sm:text-base font-semibold" style={{ color: 'var(--aurora-text, #1F2937)' }}>
            {formatPrice(item.price)}
          </span>
          <span className="text-xs" style={{ color: 'var(--aurora-text-muted, #9CA3AF)' }}>
            {pricingLabel}
          </span>
        </div>

        {/* Quick info: serves · prep time — inline like Uber Eats calorie text */}
        {((item.prepTimeMinutes != null && item.prepTimeMinutes > 0) || item.servesCount || (item.popularityScore != null && item.popularityScore >= 70)) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.servesCount && (
              <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: 'var(--aurora-text-muted, #6B7280)' }}>
                <Users size={10} aria-hidden="true" />
                Serves {item.servesCount}
              </span>
            )}
            {item.servesCount && item.prepTimeMinutes != null && item.prepTimeMinutes > 0 && (
              <span className="text-xs" style={{ color: 'var(--aurora-text-muted, #D1D5DB)' }}>·</span>
            )}
            {item.prepTimeMinutes != null && item.prepTimeMinutes > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: 'var(--aurora-text-muted, #6B7280)' }}>
                <Clock size={10} aria-hidden="true" />
                {item.prepTimeMinutes < 60 ? `${item.prepTimeMinutes}m` : `${Math.floor(item.prepTimeMinutes / 60)}h${item.prepTimeMinutes % 60 ? ` ${item.prepTimeMinutes % 60}m` : ''}`}
              </span>
            )}
            {item.popularityScore != null && item.popularityScore >= 70 && (
              <>
                <span className="text-xs" style={{ color: 'var(--aurora-text-muted, #D1D5DB)' }}>·</span>
                <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: '#B45309' }}>
                  <TrendingUp size={10} aria-hidden="true" />
                  Popular
                </span>
              </>
            )}
          </div>
        )}

        {/* Description — muted, clamp 2 lines */}
        {item.description && (
          <p
            className="line-clamp-2 text-xs sm:text-sm leading-relaxed"
            style={{ color: 'var(--aurora-text-muted, #6B7280)' }}
          >
            {item.description}
          </p>
        )}

        {/* Dietary tags — compact inline row */}
        {item.dietaryTags && item.dietaryTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-1">
            {item.dietaryTags.map(tag => {
              const info = DIETARY_TAG_INFO[tag] || DIETARY_TAG_INFO.__default;
              return (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium ${info.bg} ${info.text}`}
                >
                  <span aria-hidden="true" className="text-[10px]">{info.icon}</span>
                  {tag.replace(/_/g, ' ')}
                </span>
              );
            })}
          </div>
        )}

        {/* Low stock / unavailable text badge */}
        {item.stockStatus === 'low_stock' && !isDisabled && (
          <span className="text-[11px] font-medium text-amber-600">
            {item.stockCount != null && item.stockCount > 0
              ? `Only ${item.stockCount} left`
              : 'Low Stock'}
          </span>
        )}
        {isDisabled && (
          <span className="text-[11px] font-semibold" style={{ color: '#EF4444' }}>
            {isOutOfStock ? 'Out of Stock' : 'Currently Unavailable'}
          </span>
        )}
      </div>

      {/* ── Right: Square image + Add button ── */}
      <div className="relative flex-shrink-0" style={{ width: '128px' }}>
        {/* Image — square, Uber Eats style */}
        <div
          className="h-full w-full"
          style={{ backgroundColor: 'var(--aurora-surface-variant, #F3F4F6)' }}
        >
          {item.photoUrl ? (
            <img
              src={item.photoUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
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
              }}
            >
              <div className="flex flex-col items-center gap-1 opacity-50">
                {(() => {
                  const icons: Record<string, React.ReactNode> = {
                    Appetizer: <Salad className="h-8 w-8" strokeWidth={1.2} style={{ color: '#92400E' }} />,
                    Entree: <UtensilsCrossed className="h-8 w-8" strokeWidth={1.2} style={{ color: '#1E40AF' }} />,
                    Dessert: <Cake className="h-8 w-8" strokeWidth={1.2} style={{ color: '#BE185D' }} />,
                    Side: <Soup className="h-8 w-8" strokeWidth={1.2} style={{ color: '#047857' }} />,
                    Beverage: <Coffee className="h-8 w-8" strokeWidth={1.2} style={{ color: '#6D28D9' }} />,
                  };
                  return icons[item.category] || <Utensils className="h-8 w-8" strokeWidth={1.2} style={{ color: '#6B7280' }} />;
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Category badge — top-left of image */}
        <div className="absolute left-2 top-2">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
          >
            {item.category}
          </span>
        </div>

        {/* ── Add / Stepper button — bottom-right overlapping image, exactly like Uber Eats ── */}
        <div className="absolute right-2 bottom-2">
          {qty === 0 ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleAddToCart(); }}
              disabled={isDisabled}
              className="inline-flex items-center justify-center rounded-full shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'var(--aurora-surface, #FFFFFF)',
                color: 'var(--aurora-text, #1F2937)',
                transform: addBounce ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s',
                /* Cross-browser shadow */
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              }}
              aria-label={`Add ${item.name} to cart — ${formatPrice(item.price)} ${pricingLabel}`}
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            </button>
          ) : (
            <div
              className="inline-flex items-center gap-0 rounded-full shadow-md"
              style={{
                backgroundColor: 'var(--aurora-surface, #FFFFFF)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); handleDecrement(); }}
                disabled={isDisabled}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-200 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--aurora-surface, #FFFFFF)',
                  color: 'var(--aurora-text, #1F2937)',
                }}
                aria-label={`Decrease quantity of ${item.name}`}
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              </button>
              <span
                className="text-xs font-bold min-w-5 text-center"
                style={{ color: 'var(--aurora-text, #1F2937)' }}
              >
                {qty}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleIncrement(); }}
                disabled={isDisabled || (maxQty !== undefined && qty >= maxQty)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-200 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--aurora-surface, #FFFFFF)',
                  color: 'var(--aurora-text, #1F2937)',
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

export default memo(CateringItemCard);
