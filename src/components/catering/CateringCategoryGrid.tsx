import type { FC } from 'react';
import { CATEGORIES, CATEGORY_EMOJI_MAP, CATEGORY_COLORS } from '@/components/business/businessConstants';

interface CateringCategoryGridProps {
  onSelectCategory: (category: string) => void;
  businessCounts?: Record<string, number>;
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
}: CateringCategoryGridProps): ReturnType<FC> {
  const filteredCategories = CATEGORIES.filter(cat =>
    CATERING_CATEGORIES.includes(cat)
  );

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredCategories.map(category => {
          const emoji = CATEGORY_EMOJI_MAP[category] || '🍽️';
          const color = CATEGORY_COLORS[category] || '#6366F1';
          const count = businessCounts[category] || 0;

          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className="group relative flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm transition-transform duration-200 ease-out hover:scale-[1.02] cursor-pointer border border-gray-100"
              style={{
                borderLeft: `4px solid ${color}`,
              }}
            >
              {/* Left accent border handled via inline style */}
              <div className="mb-3 text-5xl">{emoji}</div>
              <h3 className="text-center text-sm font-semibold text-gray-900 line-clamp-2">
                {category}
              </h3>
              {count > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  {count} {count === 1 ? 'caterer' : 'caterers'}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
