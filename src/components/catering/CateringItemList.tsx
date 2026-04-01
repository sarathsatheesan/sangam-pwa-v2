import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { Search, Star, UtensilsCrossed, Badge, ArrowUpDown } from 'lucide-react';
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
      className="flex flex-col overflow-hidden rounded-xl border shadow-sm animate-pulse"
      style={{
        borderColor: 'var(--aurora-border)',
        backgroundColor: 'var(--aurora-surface)',
      }}
    >
      <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-40 w-full" />
      <div className="flex flex-1 flex-col p-4 space-y-3">
        <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-4 w-3/4 rounded" />
        <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-3 w-full rounded" />
        <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-3 w-1/2 rounded" />
        <div className="mt-auto flex items-center justify-between pt-4">
          <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-5 w-16 rounded" />
          <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }} className="h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CateringItemList({
  items,
  businesses,
  onAddToCart,
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
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchLower) ||
        (item.description?.toLowerCase().includes(searchLower) ?? false);

      // Dietary filter (OR logic — item matches if it has ANY of the selected tags)
      const matchesDietary =
        dietaryFilter.length === 0 ||
        dietaryFilter.some(tag =>
          item.dietaryTags?.includes(tag) ?? false
        );

      return matchesSearch && matchesDietary;
    });
  }, [items, searchQuery, dietaryFilter]);

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
      {/* Search and Filter Section */}
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
            style={{ color: 'var(--aurora-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search items by name or description..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            aria-label="Search catering items by name or description"
            className="w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm placeholder-gray-500 transition-colors duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            style={{
              borderColor: 'var(--aurora-border)',
              backgroundColor: 'var(--aurora-surface)',
              color: 'var(--aurora-text)',
            }}
          />
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
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? 'text-white'
                      : 'border hover:border-gray-300'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: 'var(--aurora-secondary, #10B981)',
                        }
                      : {
                          borderColor: 'var(--aurora-border)',
                          color: 'var(--aurora-text-secondary)',
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
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-all duration-200"
                aria-label="Clear all dietary filters"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          {onSortChange && (
            <div className="relative flex items-center gap-1.5">
              <ArrowUpDown
                className="h-3.5 w-3.5"
                style={{ color: 'var(--aurora-text-muted)' }}
              />
              <select
                value={sortOrder}
                onChange={(e) => onSortChange(e.target.value as SortOrder)}
                className="appearance-none bg-transparent text-xs font-medium pr-5 cursor-pointer outline-none transition-colors hover:text-gray-900"
                aria-label="Sort items"
                style={{ color: 'var(--aurora-text-secondary)' }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Loading skeleton or items grouped by business */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      ) : hasResults ? (
        <div className="space-y-8">
          {Array.from(groupedByBusiness.entries()).map(
            ([businessId, businessItems]) => {
              const business = businessMap[businessId];

              if (!business) return null;

              return (
                <div
                  key={businessId}
                  className="space-y-4"
                  style={{ contentVisibility: 'auto', containIntrinsicBlockSize: 'auto 400px' } as React.CSSProperties}
                >
                  {/* Business header */}
                  <div
                    className="flex items-center justify-between border-b pb-3"
                    style={{ borderColor: 'var(--aurora-border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <h2 className="font-semibold" style={{ color: 'var(--aurora-text)' }}>
                          {business.name}
                        </h2>
                        <div className="mt-1 flex items-center gap-3">
                          {/* Rating stars */}
                          {business.rating && (
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${
                                    i < Math.floor(business.rating)
                                      ? 'fill-amber-400 text-amber-400'
                                      : ''
                                  }`}
                                  strokeWidth={2}
                                  style={
                                    i < Math.floor(business.rating)
                                      ? undefined
                                      : { color: 'var(--aurora-text-muted)' }
                                  }
                                />
                              ))}
                              <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                                {business.rating?.toFixed(1) ?? 'N/A'}
                              </span>
                              {business.reviews > 0 && (
                                <span className="text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                                  ({business.reviews})
                                </span>
                              )}
                            </div>
                          )}

                          {/* Verified badge */}
                          {business.verified && (
                            <div className="flex items-center gap-1">
                              <Badge className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-xs font-medium text-green-600">
                                Verified
                              </span>
                            </div>
                          )}

                          {/* Heritage tag */}
                          {business.heritage && (
                            <span className="inline-block rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                              {business.heritage}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {businessItems.map(item => (
                      <CateringItemCard
                        key={item.id}
                        item={item}
                        onAddToCart={onAddToCart}
                      />
                    ))}
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : (
        /* Empty state */
        <div
          className="flex flex-col items-center justify-center rounded-lg border py-12"
          style={{
            borderColor: 'var(--aurora-border)',
            backgroundColor: 'var(--aurora-bg)',
          }}
        >
          <UtensilsCrossed
            className="h-12 w-12"
            strokeWidth={1.5}
            style={{ color: 'var(--aurora-text-muted)' }}
          />
          <h3 className="mt-4 font-semibold" style={{ color: 'var(--aurora-text)' }}>
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
