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

function ItemCardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg animate-pulse"
      style={{
        backgroundColor: 'var(--aurora-surface)',
      }}
    >
      <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="w-full aspect-video" />
      <div className="flex flex-1 flex-col p-3 space-y-2.5">
        <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-4 w-3/4 rounded" />
        <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-3 w-full rounded" />
        <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-3 w-2/3 rounded" />
        <div className="mt-auto flex items-center justify-between pt-3">
          <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-5 w-14 rounded" />
          <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-8 w-16 rounded-lg" />
        </div>
      </div>
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
  // Create a map for quick business lookup
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

  // Filter items based on search and dietary preferences
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const bizName = businessMap[item.businessId]?.name?.toLowerCase() || '';
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchLower) ||
        (item.description?.toLowerCase().includes(searchLower) ?? false) ||
        bizName.includes(searchLower);

      // Dietary filter (OR logic — item matches if it has ANY of the selected tags)
      const matchesDietary =
        dietaryFilter.length === 0 ||
        dietaryFilter.some(tag =>
          item.dietaryTags?.includes(tag) ?? false
        );

      return matchesSearch && matchesDietary;
    });
  }, [items, searchQuery, dietaryFilter, businessMap]);

  // Sort items within groups
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

  // Group items by business
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
      {/* Search and Filter Section — sticky on mobile for easy access while scrolling */}
      <div className="space-y-4 sticky top-0 z-10 -mx-4 px-4 pt-2 pb-3 sm:static sm:mx-0 sm:px-0 sm:pt-0 sm:pb-0 sm:z-auto" style={{ backgroundColor: 'var(--aurora-bg)', paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}>
        {/* Search bar — pill-shaped, Uber Eats style */}
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
            style={{ color: 'var(--aurora-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            aria-label="Search catering items by name or description"
            className="w-full rounded-full py-3 pl-12 pr-10 text-base placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
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

        {/* Dietary filter pills + Sort dropdown row */}
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
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? 'text-white'
                      : 'border'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: '#1F2937',
                          borderColor: '#1F2937',
                        }
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

            {/* Clear all filters */}
            {dietaryFilter.length > 0 && onClearDietaryFilter && (
              <button
                onClick={onClearDietaryFilter}
                className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-medium border transition-all duration-200"
                style={{
                  borderColor: 'var(--aurora-border)',
                  color: 'var(--aurora-text-secondary)',
                }}
                aria-label="Clear all dietary filters"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort dropdown — pill style */}
          {onSortChange && (
            <div
              className="relative flex items-center gap-1.5 rounded-full border px-4 py-2 transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'transparent' }}
            >
              <ArrowUpDown
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--aurora-text-muted)' }}
              />
              <select
                value={sortOrder}
                onChange={(e) => onSortChange(e.target.value as SortOrder)}
                className="appearance-none bg-transparent text-xs font-medium pr-2 cursor-pointer outline-none transition-colors"
                aria-label="Sort items"
                style={{ color: 'var(--aurora-text-secondary)' }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="h-3 w-3 shrink-0 pointer-events-none"
                style={{ color: 'var(--aurora-text-muted)' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Loading skeleton or items grouped by business */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
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
                  {/* Business header — cleaner, divider style */}
                  <div
                    className="pb-4 border-b"
                    style={{ borderColor: 'var(--aurora-border)' }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Vendor avatar */}
                      <div
                        className="flex items-center justify-center w-14 h-14 rounded-full shrink-0 font-bold text-lg text-white"
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
                        <h2 className="text-lg font-bold truncate" style={{ color: 'var(--aurora-text)' }}>
                          {business.name}
                        </h2>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {/* Rating inline format */}
                          {business.rating && (
                            <div className="flex items-center gap-1 text-sm">
                              <span style={{ color: 'var(--aurora-text-secondary)' }}>
                                {business.rating?.toFixed(1) ?? 'N/A'}
                              </span>
                              <Star
                                className="h-4 w-4 fill-amber-400 text-amber-400"
                                strokeWidth={0}
                              />
                              {business.reviews > 0 && (
                                <span style={{ color: 'var(--aurora-text-muted)' }}>
                                  ({business.reviews})
                                </span>
                              )}
                            </div>
                          )}

                          {/* Verified checkmark */}
                          {business.verified && (
                            <div className="flex items-center gap-1" title="Verified">
                              <Badge className="h-4 w-4 text-green-600" />
                              <span className="text-xs font-medium text-green-600">
                                Verified
                              </span>
                            </div>
                          )}

                          {/* Heritage tag — subtle */}
                          {business.heritage && (
                            <span className="inline-block rounded-full text-xs font-medium px-2.5 py-0.5" style={{
                              backgroundColor: 'var(--aurora-surface, #f3f4f6)',
                              color: 'var(--aurora-text-secondary)',
                            }}>
                              {business.heritage}
                            </span>
                          )}

                          {/* Item count */}
                          <span className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                            {businessItems.length} {businessItems.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items grid — 2 cols mobile, 3 tablet, 4 large */}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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
        /* Empty state — softer Uber Eats feel */
        <div
          className="flex flex-col items-center justify-center rounded-lg py-12"
          style={{
            backgroundColor: 'var(--aurora-surface, #f9fafb)',
          }}
        >
          <div className="mb-4 p-3 rounded-full" style={{ backgroundColor: 'var(--aurora-bg)' }}>
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
