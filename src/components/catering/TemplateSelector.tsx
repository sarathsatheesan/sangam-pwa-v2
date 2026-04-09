import React from 'react';
import { X, ChevronRight } from 'lucide-react';
import { MENU_TEMPLATES } from '@/services/catering/menuTemplates';
import type { MenuTemplateItem } from '@/services/cateringService';

interface TemplateSelectorProps {
  businessId: string;
  onSelectTemplate: (items: MenuTemplateItem[]) => void;
  onClose: () => void;
}

const TEMPLATE_ICONS: Record<string, string> = {
  'south-indian': '🫘',
  'north-indian': '🍛',
  'pakistani': '🥘',
  'sri-lankan': '🥥',
  'tiffin': '📦',
  'chaat-street': '🧆',
  'sweets': '🍬',
  'blank': '✨',
};

export default function TemplateSelector({
  businessId,
  onSelectTemplate,
  onClose,
}: TemplateSelectorProps) {
  const handleTemplateSelect = (template: typeof MENU_TEMPLATES[0]) => {
    onSelectTemplate(template.items);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--aurora-text-primary)' }}>
            Choose a Template
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg transition-colors"
          style={{
            color: 'var(--aurora-text-secondary)',
            backgroundColor: 'var(--aurora-bg-secondary)',
          }}
          aria-label="Close template selector"
        >
          <X size={20} />
        </button>
      </div>

      {/* Info Text */}
      <p
        className="text-sm mb-8"
        style={{ color: 'var(--aurora-text-secondary)' }}
      >
        Pick a starting point — you'll customize names, prices, and details before publishing.
      </p>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MENU_TEMPLATES.map((template) => {
          const isBlank = template.id === 'blank';
          const icon = TEMPLATE_ICONS[template.id] || '📝';
          const itemCount = template.items.length;
          const itemLabel = itemCount === 0 ? 'Start fresh' : `${itemCount} items`;

          return (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              className={`p-5 rounded-xl transition-all duration-200 text-left group ${
                isBlank
                  ? 'border-2 border-dashed'
                  : 'border border-solid shadow-sm hover:shadow-md'
              } hover:scale-[1.02]`}
              style={
                isBlank
                  ? {
                      borderColor: 'var(--aurora-border-secondary)',
                      backgroundColor: 'var(--aurora-bg-tertiary)',
                    }
                  : {
                      borderColor: 'var(--aurora-border-primary)',
                      backgroundColor: 'var(--aurora-bg-primary)',
                    }
              }
            >
              {/* Icon and Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">{icon}</div>
                <ChevronRight
                  size={18}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--aurora-text-secondary)' }}
                />
              </div>

              {/* Template Name */}
              <h3
                className="font-bold text-lg mb-1"
                style={{ color: 'var(--aurora-text-primary)' }}
              >
                {template.name}
              </h3>

              {/* Cuisine Label */}
              <div className="text-xs font-medium mb-2 inline-block px-2 py-1 rounded">
                <span style={{ color: 'var(--aurora-text-secondary)' }}>
                  {template.cuisine}
                </span>
              </div>

              {/* Description */}
              <p
                className="text-sm mb-3"
                style={{ color: 'var(--aurora-text-secondary)' }}
              >
                {template.description}
              </p>

              {/* Item Count Badge */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs font-semibold"
                  style={{ color: 'var(--aurora-text-tertiary)' }}
                >
                  {itemLabel}
                </span>
              </div>

              {/* Preview Items */}
              {itemCount > 0 && (
                <div className="pt-3 border-t" style={{ borderColor: 'var(--aurora-border-secondary)' }}>
                  <ul className="space-y-1">
                    {template.items.slice(0, 4).map((item, index) => (
                      <li
                        key={index}
                        className="text-xs"
                        style={{ color: 'var(--aurora-text-tertiary)' }}
                      >
                        • {item.name}
                      </li>
                    ))}
                    {itemCount > 4 && (
                      <li
                        className="text-xs"
                        style={{ color: 'var(--aurora-text-tertiary)' }}
                      >
                        + {itemCount - 4} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
