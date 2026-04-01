import type { FC } from 'react';
import { CATEGORIES, CATEGORY_EMOJI_MAP, CATEGORY_COLORS } from '@/components/business/businessConstants';

interface CateringCategoryGridProps {
  onSelectCategory: (category: string) => void;
  businessCounts?: Record<string, number>;
  totalBusinessCount?: number;
}

// Catering-relevant categories
const CATERING_CATEGORIES = [
  'Restaurant & Food',
  'Tiffin',
  'Grocery & Market',
  'Other',
];

export default function CateringCategoryGrid({
  onSelectCategory,
  businessCounts = {},
  totalBusinessCount = 0,
}: CateringCategoryGridProps): ReturnType<FC> {
  const filteredCategories = CATEGORIES.filter(cat =>
    CATERING_CATEGORIES.includes(cat)
  );

  const totalAvailable = Object.values(businessCounts).reduce((sum, c) => sum + c, 0) + totalBusinessCount;
  const showEmptyState = totalAvailable === 0;

  return (
    <div className="w-full">
      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-12 mt-4" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-bg)' }}>
          <div className="text-5xl mb-4">🍽️</div>
          <h3 className="font-semibold" style={{ color: 'var(--aurora-text)' }}>No caterers available yet</h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
            Check back soon — new caterers are joining regularly
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* All Categories button */}
        <button
          onClick={() => onSelectCategory('all')}
          className="group relative flex flex-col items-center justify-center rounded-xl p-6 shadow-sm transition-transform duration-200 ease-out hover:scale-[1.02] cursor-pointer border"
          style={{
            borderLeft: '4px solid #6366F1',
            backgroundColor: '#6366F1',
            borderColor: 'var(--aurora-border)',
          }}
          aria-label={`Browse all categories — ${totalBusinessCount} ${totalBusinessCount === 1 ? 'caterer' : 'caterers'} available`}
        >
          <div className="mb-3 text-5xl">🔍</div>
          <h3 className="text-center text-sm font-semibold text-white line-clamp-2">
            All Categories
          </h3>
          {totalBusinessCount > 0 && (
            <p className="mt-2 text-xs text-white">
              {totalBusinessCount} {totalBusinessCount === 1 ? 'caterer' : 'caterers'}
            </p>
          )}
        </button>

        {filteredCategories.map(category => {
          const emoji = CATEGORY_EMOJI_MAP[category] || '🍽️';
          const color = CATEGORY_COLORS[category] || '#6366F1';
          const count = businessCounts[category] || 0;

          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className="group relative flex flex-col items-center justify-center rounded-xl p-6 shadow-sm transition-transform duration-200 ease-out hover:scale-[1.02] cursor-pointer border"
              style={{
                borderLeft: `4px solid ${color}`,
                backgroundColor: 'var(--aurora-surface)',
                borderColor: 'var(--aurora-border)',
              }}
              aria-label={`Browse ${category} — ${count} ${count === 1 ? 'caterer' : 'caterers'} available`}
            >
              {/* Left accent border handled via inline style */}
              <div className="mb-3 text-5xl">{emoji}</div>
              <h3 className="text-center text-sm font-semibold line-clamp-2" style={{ color: 'var(--aurora-text)' }}>
                {category}
              </h3>
              {count > 0 && (
                <p className="mt-2 text-xs" style={{ color: 'var(--aurora-text-muted)' }}>
                  {count} {count === 1 ? 'caterer' : 'caterers'}
                </p>
              )}
            </button>
          );
        })}
        </div>
      )}
    </div>
  );
}
