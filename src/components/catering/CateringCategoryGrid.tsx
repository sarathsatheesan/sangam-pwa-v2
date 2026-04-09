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

// UI-02: Rich gradient backgrounds per category for glass-morphism cards
const CATEGORY_GRADIENTS: Record<string, string> = {
  'Restaurant & Food': 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
  'Tiffin': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  'Grocery & Market': 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
  'Other': 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* All Categories button */}
        <button
          onClick={() => onSelectCategory('all')}
          className="group relative flex flex-col items-center justify-center rounded-xl p-4 shadow-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-md cursor-pointer overflow-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600 focus-visible:outline-none"
          style={{ backgroundImage: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)', minHeight: '120px' }}
          aria-label={`Browse all categories — ${totalAvailable} ${totalAvailable === 1 ? 'caterer' : 'caterers'} available`}
        >
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10" style={{ backgroundColor: 'white' }} />
          <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full opacity-10" style={{ backgroundColor: 'white' }} />
          <div className="relative z-10 mb-2 text-3xl drop-shadow-md">🔍</div>
          <div className="relative z-10 rounded-lg px-2.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            <h3 className="text-center text-xs font-semibold text-white line-clamp-2">
              All Categories
            </h3>
          </div>
          {totalBusinessCount > 0 && (
            <p className="relative z-10 mt-1.5 text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {totalBusinessCount} {totalBusinessCount === 1 ? 'caterer' : 'caterers'}
            </p>
          )}
        </button>

        {filteredCategories.map(category => {
          const emoji = CATEGORY_EMOJI_MAP[category] || '🍽️';
          const gradient = CATEGORY_GRADIENTS[category] || 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)';
          const count = businessCounts[category] || 0;

          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className="group relative flex flex-col items-center justify-center rounded-xl p-4 shadow-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-md cursor-pointer overflow-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none"
              style={{ backgroundImage: gradient, minHeight: '120px' }}
              aria-label={`Browse ${category} — ${count} ${count === 1 ? 'caterer' : 'caterers'} available`}
            >
              {/* Decorative circles — scaled down */}
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20" style={{ backgroundColor: 'white' }} />
              <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full opacity-10" style={{ backgroundColor: 'white' }} />

              <div className="relative z-10 mb-2 text-3xl drop-shadow-md">{emoji}</div>
              {/* Glass-morphism label */}
              <div className="relative z-10 rounded-lg px-2.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                <h3 className="text-center text-xs font-semibold text-white line-clamp-2">
                  {category}
                </h3>
              </div>
              <p className="relative z-10 mt-1.5 text-[10px] font-medium" style={{ color: count > 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>
                {count > 0
                  ? `${count} ${count === 1 ? 'caterer' : 'caterers'}`
                  : 'No caterers yet'}
              </p>
            </button>
          );
        })}
        </div>
      )}
    </div>
  );
}
