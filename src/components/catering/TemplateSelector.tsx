import React, { useState, useMemo } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { MENU_TEMPLATES } from '@/services/catering/menuTemplates';
import type { MenuTemplateItem, MenuTemplateType } from '@/services/cateringService';

interface TemplateSelectorProps {
  businessId: string;
  onSelectTemplate: (items: MenuTemplateItem[]) => void;
  onClose: () => void;
}

type FilterOption = 'all' | MenuTemplateType;

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'catering', label: 'Catering' },
  { value: 'grocery', label: 'Grocery' },
];

const TEMPLATE_ICONS: Record<string, string> = {
  // Catering
  'south-indian': '\uD83E\uDED8',
  'north-indian': '\uD83C\uDF5B',
  'pakistani': '\uD83E\uDD58',
  'sri-lankan': '\uD83E\uDD65',
  'tiffin': '\uD83D\uDCE6',
  'chaat-street': '\uD83E\uDDC6',
  'sweets': '\uD83C\uDF6C',
  // Grocery
  'grocery-south-asian': '\uD83C\uDF3E',
  'grocery-spices': '\uD83E\uDDC2',
  'grocery-snacks': '\uD83C\uDF5C',
  'grocery-fresh': '\uD83E\uDD6C',
  'grocery-beverages': '\u2615',
  // Blank
  'blank': '\u2728',
};

/* ── Cross-browser safe color tokens ────────────────────────────────── */
const COLORS = {
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F8FAFC',
  bgTertiary: '#F1F5F9',
  borderPrimary: '#E2E8F0',
  borderSecondary: '#CBD5E1',
  accent: '#6366F1',        // Indigo-500
  accentLight: '#EEF2FF',   // Indigo-50
  accentText: '#FFFFFF',
};

export default function TemplateSelector({
  businessId,
  onSelectTemplate,
  onClose,
}: TemplateSelectorProps) {
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  const filteredTemplates = useMemo(() => {
    if (activeFilter === 'all') return MENU_TEMPLATES;
    return MENU_TEMPLATES.filter((t) => t.type === activeFilter);
  }, [activeFilter]);

  const handleTemplateSelect = (template: (typeof MENU_TEMPLATES)[0]) => {
    onSelectTemplate(template.items);
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: COLORS.textPrimary,
            margin: 0,
          }}
        >
          Choose a Template
        </h2>
        <button
          onClick={onClose}
          aria-label="Close template selector"
          style={{
            padding: '8px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.textSecondary,
            backgroundColor: COLORS.bgSecondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Info Text */}
      <p
        style={{
          fontSize: '0.875rem',
          color: COLORS.textSecondary,
          marginBottom: '16px',
          marginTop: 0,
        }}
      >
        Pick a starting point — you'll customize names, prices, and details before publishing.
      </p>

      {/* ── Filter Pills ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setActiveFilter(opt.value)}
              style={{
                padding: '6px 16px',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: `2px solid ${isActive ? COLORS.accent : COLORS.borderPrimary}`,
                backgroundColor: isActive ? COLORS.accent : COLORS.bgPrimary,
                color: isActive ? COLORS.accentText : COLORS.textSecondary,
                transition: 'all 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
                outline: 'none',
                lineHeight: '1.4',
              }}
              aria-pressed={isActive}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* ── Template Grid ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '16px',
        }}
      >
        {filteredTemplates.map((template) => {
          const isBlank = template.id === 'blank';
          const icon = TEMPLATE_ICONS[template.id] || '\uD83D\uDCDD';
          const itemCount = template.items.length;
          const itemLabel =
            itemCount === 0 ? 'Start fresh' : `${itemCount} items`;
          const isGrocery = template.type === 'grocery';

          return (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              style={{
                padding: '20px',
                borderRadius: '12px',
                textAlign: 'left' as const,
                cursor: 'pointer',
                border: isBlank
                  ? `2px dashed ${COLORS.borderSecondary}`
                  : `1px solid ${COLORS.borderPrimary}`,
                backgroundColor: isBlank
                  ? COLORS.bgTertiary
                  : COLORS.bgPrimary,
                boxShadow: isBlank
                  ? 'none'
                  : '0 1px 3px rgba(0,0,0,0.08)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                width: '100%',
                display: 'block',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  'scale(1.02)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 4px 12px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = isBlank
                  ? 'none'
                  : '0 1px 3px rgba(0,0,0,0.08)';
              }}
            >
              {/* Icon and Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>
                  {icon}
                </span>
                <ChevronRight
                  size={18}
                  style={{
                    color: COLORS.textTertiary,
                    opacity: 0.4,
                    transition: 'opacity 0.15s',
                  }}
                />
              </div>

              {/* Template Name */}
              <h3
                style={{
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  marginBottom: '4px',
                  marginTop: 0,
                  color: COLORS.textPrimary,
                }}
              >
                {template.name}
              </h3>

              {/* Type + Cuisine Labels */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {/* Type badge */}
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.03em',
                    backgroundColor: isGrocery ? '#FEF3C7' : COLORS.accentLight,
                    color: isGrocery ? '#92400E' : COLORS.accent,
                  }}
                >
                  {template.type}
                </span>
                {/* Cuisine label */}
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: COLORS.textSecondary,
                    lineHeight: '1.6',
                  }}
                >
                  {template.cuisine}
                </span>
              </div>

              {/* Description */}
              <p
                style={{
                  fontSize: '0.8125rem',
                  marginBottom: '12px',
                  marginTop: 0,
                  color: COLORS.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                {template.description}
              </p>

              {/* Item Count */}
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: COLORS.textTertiary,
                }}
              >
                {itemLabel}
              </span>

              {/* Preview Items */}
              {itemCount > 0 && (
                <div
                  style={{
                    paddingTop: '12px',
                    marginTop: '12px',
                    borderTop: `1px solid ${COLORS.borderPrimary}`,
                  }}
                >
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                    }}
                  >
                    {template.items.slice(0, 4).map((item, index) => (
                      <li
                        key={index}
                        style={{
                          fontSize: '0.75rem',
                          color: COLORS.textTertiary,
                          paddingBottom: '2px',
                        }}
                      >
                        {'\u2022'} {item.name}
                      </li>
                    ))}
                    {itemCount > 4 && (
                      <li
                        style={{
                          fontSize: '0.75rem',
                          color: COLORS.textTertiary,
                        }}
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
