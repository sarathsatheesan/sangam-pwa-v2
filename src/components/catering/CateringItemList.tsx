import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { Search, Star, UtensilsCrossed, Badge, ArrowUpDown, X, ChevronDown } from 'lucide-react';
import type { CateringMenuItem } from '@/services/cateringService';
import CateringItemCard from './CateringItemCard';

type SortOrder = 'default' | 'price_asc' | 'price_desc' | 'rating' | 'name_asc';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A to Z' },
  { value: 'rating', label: 'Highest Rated' },
];

interface CateringItemListProps {
  items: CateringMenuItem[];
  businesses: any[];
  onAddToCart: (item: CateringMenuItem) => void;
  onUpdateQty?: (menuItemId: string, qty: number) => void;
  onRemoveFromCart?: (menuItemId: string) => void;
  cartItems?: Array<{ menuItemId: string; qty: number }>;
  searchQuery: string;
  dietaryFilter: string[];
  sortOrder?: SortOrder;
  onSearchChange: (q: string) => void;
  onDietaryToggle: (tag: string) => void;
  onClearDietaryFilter?: () => void;
  onSortChange?: (sort: SortOrder) => void;
  loading?: boolean;
}

const DIETARY_OPTIONS = [
  'vegetarian',
  'vegan',
  'halal',
  'kosher',
  'gluten_free',
];

/* ── Skeleton matching the horizontal card layout ── */
function ItemCardSkeleton() {
  return (
    <div
      className="flex flex-row items-stretch overflow-hidden rounded-xl border animate-pulse"
      style={{
        backgroundColor: 'var(--aurora-surface, #FFFFFF)',
        borderColor: 'var(--aurora-border, #E5E7EB)',
        minHeight: '148px',
      }}
    >
      {/* Text skeleton */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-4 gap-2">
        <div style={{ backgroundColor: 'var(--aurora-surface-variant, #E5E7EB)' }} className="h-4 w-3/4 rounded" />
        <div style={{ backgroundColor: 'var(--aurora-surface-variant, #E5E7EB)' }} className="h-3 w-1/3 rounded" />
        <div style={{ backgroundColor: 'var(--aurora-surface-variant, #E5E7EB)' }} className="h-3 w-full rounded" />
        <div style={{ backgroundColor: 'var(--aurora-surface-variant, #E5E7EB)' }} className="h-3 w-2/3 rounded" />
        <div className="flex gap-1.5 mt-auto">
          <div style={{ backgroundColor: 'var(--aurora-surface-variant, #E5E7EB)' }} className="h-4 w-14 rounded-full" />
          <div style={{ backgroundColor: 'var(--aurora-surface-variant, #E5E7EB)' }} className="h-4 w-12 rounded-full" />
        </div>
      </div>
      {/* Image skeleton */}
      <div
        className="flex-shrink-0"
        style={{
          width: '128px',
          backgroundColor: 'var(--aurora-surface-variant, #E5E7EB)',
        }}
      />
    </div>
  );
}

export default function CateringItemList({
  items,
  businesses,
  onAddToCart,
  onUpdateQty,
  onRemoveFromCart,
  cartItems,
  searchQuery,
  dietaryFilter,
  sortOrder = 'default',
  onSearchChange,
  onDietaryToggle,
  onClearDietaryFilter,
  onSortChange,
  loading = false,
}: CateringItemListProps): ReturnType<FC> {
  const businessMap = useMemo(
    () =>
      businesses.reduce(
        (acc, biz) => {
          acc[biz.id] = biz;
          return acc;
        },
        {} as Record<string, any>
      ),
    [businesses]
  );

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      const bizName = businessMap[item.businessId]?.name?.toLowerCase() || '';
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchLower) ||
        (item.description?.toLowerCase().includes(searchLower) ?? false) ||
        bizName.includes(searchLower);

      const matchesDietary =
        dietaryFilter.length === 0 ||
        dietaryFilter.some(tag =>
          item.dietaryTags?.includes(tag) ?? false
        );

      return matchesSearch && matchesDietary;
    });
  }, [items, searchQuery, dietaryFilter, businessMap]);

  const sortedItems = useMemo(() => {
    if (sortOrder === 'default') return filteredItems;
    return [...filteredItems].sort((a, b) => {
      switch (sortOrder) {
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'rating': {
          const rA = businessMap[a.businessId]?.rating || 0;
          const rB = businessMap[b.businessId]?.rating || 0;
          return rB - rA;
        }
        default: return 0;
      }
    });
  }, [filteredItems, sortOrder, businessMap]);

  const groupedByBusiness = useMemo(() => {
    const grouped = new Map<string, CateringMenuItem[]>();
    sortedItems.forEach(item => {
      if (!grouped.has(item.businessId)) {
        grouped.set(item.businessId, []);
      }
      grouped.get(item.businessId)!.push(item);
    });
    return grouped;
  }, [sortedItems]);

  const hasResults = groupedByBusiness.size > 0;

  return (
    <div className="w-full space-y-6">
      {/* ── Search & Filter — sticky on mobile ── */}
      <div
        className="space-y-3 sticky top-0 z-10 -mx-4 px-4 pt-2 pb-3 sm:static sm:mx-0 sm:px-0 sm:pt-0 sm:pb-0 sm:z-auto"
        style={{
          backgroundColor: 'var(--aurora-bg)',
          paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
        }}
      >
        {/* Search bar — pill */}
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
            style={{ color: 'var(--aurora-text-muted, #9CA3AF)' }}
          />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            aria-label="Search catering items by name or description"
            className="w-full rounded-full py-3 pl-12 pr-10 text-sm sm:text-base transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              backgroundColor: 'var(--aurora-surface, #f3f4f6)',
              color: 'var(--aurora-text)',
              '--tw-ring-color': 'var(--aurora-text-muted, #9CA3AF)',
              '--tw-ring-offset-color': 'var(--aurora-bg)',
            } as React.CSSProperties}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors hover:opacity-70"
              aria-label="Clear search"
            >
              <X size={16} style={{ color: 'var(--aurora-text-muted)' }} />
            </button>
          )}
        </div>

        {/* Dietary filter pills + Sort */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map(tag => {
              const isSelected = dietaryFilter.includes(tag);
              const displayLabel = tag
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

              return (
                <button
                  key={tag}
                  onClick={() => onDietaryToggle(tag)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                    isSelected ? 'text-white' : 'border'
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: '#1F2937' }
                      : {
                          borderColor: 'var(--aurora-border)',
                          color: 'var(--aurora-text-secondary)',
                          backgroundColor: 'transparent',
                        }
                  }
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={`Filter by ${displayLabel}`}
                >
                  {displayLabel}
                </button>
              );
            })}

            {dietaryFilter.length > 0 && onClearDietaryFilter && (
              <button
                onClick={onClearDietaryFilter}
                className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all duration-200"
                style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
                aria-label="Clear all dietary filters"
              >
                Clear
              </button>
            )}
          </div>

          {onSortChange && (
            <div
              className="relative flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'transparent' }}
            >
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--aurora-text-muted)' }} />
              <select
                value={sortOrder}
                onChange={(e) => onSortChange(e.target.value as SortOrder)}
                className="appearance-none bg-transparent text-xs font-medium pr-2 cursor-pointer outline-none"
                aria-label="Sort items"
                style={{ color: 'var(--aurora-text-secondary)' }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 shrink-0 pointer-events-none" style={{ color: 'var(--aurora-text-muted)' }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Content: skeleton / grouped items / empty ── */}
      {loading ? (
        /* Skeleton — 1 col mobile, 2 col desktop like Uber Eats */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      ) : hasResults ? (
        <div className="space-y-10">
          {Array.from(groupedByBusiness.entries()).map(
            ([businessId, businessItems]) => {
              const business = businessMap[businessId];

              if (!business) {
                if (import.meta.env.DEV) {
                  console.warn(`[CateringItemList] Missing business data for id: ${businessId}`);
                }
                return null;
              }

              return (
                <div
                  key={businessId}
                  className="space-y-4"
                  style={{ contentVisibility: 'auto', containIntrinsicBlockSize: 'auto 400px' } as React.CSSProperties}
                >
                  {/* ── Business header — clean divider style ── */}
                  <div
                    className="pb-3 border-b"
                    style={{ borderColor: 'var(--aurora-border, #E5E7EB)' }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Vendor avatar */}
                      <div
                        className="flex items-center justify-center w-11 h-11 rounded-full shrink-0 font-bold text-base text-white"
                        style={{
                          backgroundColor: (() => {
                            const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];
                            let hash = 0;
                            for (let i = 0; i < (business.name || '').length; i++) hash = business.name.charCodeAt(i) + ((hash << 5) - hash);
                            return colors[Math.abs(hash) % colors.length];
                          })(),
                        }}
                        aria-hidden="true"
                      >
                        {(business.name || 'V').charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h2 className="text-base sm:text-lg font-bold truncate" style={{ color: 'var(--aurora-text)' }}>
                          {business.name}
                        </h2>
                        <div className="mt-0.5 flex items-center gap-2 flex-wrap text-xs">
                          {/* Rating — inline "4.5 ★ (120)" */}
                          {business.rating && (
                            <span className="flex items-center gap-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
                              {business.rating?.toFixed(1)}
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" strokeWidth={0} />
                              {business.reviews > 0 && (
                                <span style={{ color: 'var(--aurora-text-muted)' }}>({business.reviews})</span>
                              )}
                            </span>
                          )}

                          {/* Verified */}
                          {business.verified && (
                            <span className="flex items-center gap-0.5 text-green-600 font-medium">
                              <Badge className="h-3 w-3" />
                              Verified
                            </span>
                          )}

                          {/* Heritage tag */}
                          {business.heritage && (
                            <span
                              className="inline-block rounded-full px-2 py-0.5 font-medium"
                              style={{
                                backgroundColor: 'var(--aurora-surface, #f3f4f6)',
                                color: 'var(--aurora-text-secondary)',
                                fontSize: '11px',
                              }}
                            >
                              {business.heritage}
                            </span>
                          )}

                          {/* Item count */}
                          <span style={{ color: 'var(--aurora-text-muted)' }}>
                            {businessItems.length} {businessItems.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Items grid: 1 col mobile → 2 col desktop (Uber Eats) ── */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                    {businessItems.map(item => {
                      const cartItem = cartItems?.find(ci => ci.menuItemId === item.id);
                      return (
                        <CateringItemCard
                          key={item.id}
                          item={item}
                          onAddToCart={onAddToCart}
                          onUpdateQty={onUpdateQty}
                          onRemoveFromCart={onRemoveFromCart}
                          cartQty={cartItem?.qty}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : (
        /* Empty state */
        <div
          className="flex flex-col items-center justify-center rounded-xl py-16"
          style={{ backgroundColor: 'var(--aurora-surface, #f9fafb)' }}
        >
          <div
            className="mb-4 p-4 rounded-full"
            style={{ backgroundColor: 'var(--aurora-bg)' }}
          >
            <UtensilsCrossed
              className="h-8 w-8"
              strokeWidth={1.5}
              style={{ color: 'var(--aurora-text-muted)' }}
            />
          </div>
          <h3 className="font-semibold text-base" style={{ color: 'var(--aurora-text)' }}>
            No items found
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
}
