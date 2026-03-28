import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { Search, Star, UtensilsCrossed, Badge } from 'lucide-react';
import type { CateringMenuItem } from '@/services/cateringService';
import CateringItemCard from './CateringItemCard';

interface CateringItemListProps {
  items: CateringMenuItem[];
  businesses: any[];
  onAddToCart: (item: CateringMenuItem) => void;
  searchQuery: string;
  dietaryFilter: string[];
  onSearchChange: (q: string) => void;
  onDietaryToggle: (tag: string) => void;
}

const DIETARY_OPTIONS = [
  'vegetarian',
  'vegan',
  'halal',
  'kosher',
  'gluten_free',
];

export default function CateringItemList({
  items,
  businesses,
  onAddToCart,
  searchQuery,
  dietaryFilter,
  onSearchChange,
  onDietaryToggle,
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

      // Dietary filter (all selected tags must be present)
      const matchesDietary =
        dietaryFilter.length === 0 ||
        dietaryFilter.every(tag =>
          item.dietaryTags?.includes(tag) ?? false
        );

      return matchesSearch && matchesDietary;
    });
  }, [items, searchQuery, dietaryFilter]);

  // Group items by business
  const groupedByBusiness = useMemo(() => {
    const grouped = new Map<string, CateringMenuItem[]>();

    filteredItems.forEach(item => {
      if (!grouped.has(item.businessId)) {
        grouped.set(item.businessId, []);
      }
      grouped.get(item.businessId)!.push(item);
    });

    return grouped;
  }, [filteredItems]);

  const hasResults = groupedByBusiness.size > 0;

  return (
    <div className="w-full space-y-6">
      {/* Search and Filter Section */}
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items by name or description..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 transition-colors duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            style={{
              borderColor: 'var(--aurora-border, #E5E7EB)',
              backgroundColor: 'var(--aurora-surface, #FFFFFF)',
              color: 'var(--aurora-text, #111827)',
            }}
          />
        </div>

        {/* Dietary filter pills */}
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
                    : 'border border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: 'var(--aurora-secondary, #10B981)',
                      }
                    : undefined
                }
              >
                {displayLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Items grouped by business */}
      {hasResults ? (
        <div className="space-y-8">
          {Array.from(groupedByBusiness.entries()).map(
            ([businessId, businessItems]) => {
              const business = businessMap[businessId];

              if (!business) return null;

              return (
                <div key={businessId} className="space-y-4">
                  {/* Business header */}
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <h2 className="font-semibold text-gray-900">
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
                                      : 'text-gray-300'
                                  }`}
                                  strokeWidth={2}
                                />
                              ))}
                              <span className="text-xs text-gray-600">
                                {business.rating.toFixed(1)}
                              </span>
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-12">
          <UtensilsCrossed className="h-12 w-12 text-gray-400" strokeWidth={1.5} />
          <h3 className="mt-4 font-semibold text-gray-900">No items found</h3>
          <p className="mt-1 text-sm text-gray-600">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
}
