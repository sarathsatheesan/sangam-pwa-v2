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

// Soft background colors for category icon containers (Uber Eats style)
const CATEGORY_BG_COLORS: Record<string, string> = {
  'Restaurant & Food': '#FEF3E2',
  'Tiffin': '#E8F5E9',
  'Grocery & Market': '#E3F2FD',
  'Other': '#F3E5F5',
};

export default function CateringCategoryGrid({
  onSelectCategory,
  businessCounts = {},
  totalBusinessCount = 0,
}: CateringCategoryGridProps): ReturnType<FC> {
  const filteredCategories = CATEGORIES.filter(cat =>
    CATERING_CATEGORIES.includes(cat)
  );

  // BUG-012: Use totalBusinessCount if provided, otherwise derive from category counts (avoid double-counting)
  const totalAvailable = totalBusinessCount > 0 ? totalBusinessCount : Object.values(businessCounts).reduce((sum, c) => sum + c, 0);
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
        <div
          className="category-scroll flex gap-4 overflow-x-auto pb-2 px-1"
          style={{
            scrollBehavior: 'smooth',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Hide scrollbar for WebKit browsers */}
          <style>{`
            .category-scroll::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* All Categories button */}
          <button
            onClick={() => onSelectCategory('all')}
            className="flex flex-col items-center justify-center flex-shrink-0 rounded-2xl p-3 transition-all duration-200 ease-out hover:shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            style={{
              backgroundColor: 'var(--aurora-bg)',
              borderColor: 'var(--aurora-border)',
              border: '1px solid var(--aurora-border)',
              color: 'var(--aurora-text)',
              width: '80px',
              minWidth: '80px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
            }}
            aria-label={`Browse all categories — ${totalAvailable} ${totalAvailable === 1 ? 'caterer' : 'caterers'} available`}
          >
            <div className="text-2xl mb-2">🔍</div>
            <div className="text-center">
              <h3 className="text-xs font-semibold leading-snug line-clamp-2" style={{ color: 'var(--aurora-text)' }}>
                All
              </h3>
            </div>
            {totalBusinessCount > 0 && (
              <p className="mt-1 text-[10px] font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
                {totalBusinessCount}
              </p>
            )}
          </button>

          {/* Category pills */}
          {filteredCategories.map(category => {
            const emoji = CATEGORY_EMOJI_MAP[category] || '🍽️';
            const bgColor = CATEGORY_BG_COLORS[category] || '#F5F5F5';
            const count = businessCounts[category] || 0;

            return (
              <button
                key={category}
                onClick={() => onSelectCategory(category)}
                className="flex flex-col items-center justify-center flex-shrink-0 rounded-2xl p-3 transition-all duration-200 ease-out hover:shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                style={{
                  backgroundColor: bgColor,
                  color: 'var(--aurora-text)',
                  width: '80px',
                  minWidth: '80px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
                }}
                aria-label={`Browse ${category} — ${count} ${count === 1 ? 'caterer' : 'caterers'} available`}
              >
                {/* Icon container */}
                <div className="text-2xl mb-2">
                  {emoji}
                </div>

                {/* Category name */}
                <h3 className="text-xs font-semibold text-center leading-snug line-clamp-2" style={{ color: 'var(--aurora-text)' }}>
                  {category}
                </h3>

                {/* Business count */}
                <p className="mt-1 text-[10px] font-medium" style={{ color: count > 0 ? 'var(--aurora-text-secondary)' : 'var(--aurora-text-muted, #9CA3AF)' }}>
                  {count > 0
                    ? `${count}`
                    : '—'}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
