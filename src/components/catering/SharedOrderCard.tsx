// ═══════════════════════════════════════════════════════════════════════
// SB-13: Shared Order Card Base Component
// Provides a consistent card structure for both Customer and Vendor
// personas with a "from/to" mental model.
// ═══════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { STATUS_THEME } from '@/constants/cateringStatusTheme';
import { formatPrice } from '@/services/cateringService';

interface SharedOrderCardProps {
  /** Customer sees "From: [Business]", Vendor sees "From: [Customer]" */
  perspective: 'customer' | 'vendor';
  /** The counterpart name (business name for customer, customer name for vendor) */
  counterpartName: string;
  /** Order status */
  status: string;
  /** Event date (formatted string) */
  eventDate?: string;
  /** Total in cents */
  total: number;
  /** Whether the card is expanded */
  isExpanded: boolean;
  /** Toggle expand callback */
  onToggle: () => void;
  /** Badge content — rendered after the status badge */
  badge?: ReactNode;
  /** Expandable content */
  children: ReactNode;
  /** Optional: modification banner */
  modificationBanner?: ReactNode;
  /** Optional className */
  className?: string;
}

export default function SharedOrderCard({
  perspective,
  counterpartName,
  status,
  eventDate,
  total,
  isExpanded,
  onToggle,
  badge,
  children,
  modificationBanner,
  className = '',
}: SharedOrderCardProps) {
  const theme = STATUS_THEME[status] || STATUS_THEME.pending;
  const fromLabel = perspective === 'customer' ? 'From' : 'From';

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${className}`}
      style={{ backgroundColor: 'var(--aurora-surface, #fff)', borderColor: 'var(--aurora-border, #E2E5EF)' }}
    >
      {/* Modification banner (if any) */}
      {modificationBanner}

      {/* Header — clickable to expand */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          {/* Counterpart + status */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium" style={{ color: 'var(--aurora-text-muted)' }}>
              {fromLabel}:
            </span>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--aurora-text)' }}>
              {counterpartName}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
              style={{ backgroundColor: theme.bgColor, color: theme.color }}
            >
              {theme.label}
            </span>
            {badge}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            {eventDate && <span>{eventDate}</span>}
            <span className="font-semibold" style={{ color: 'var(--aurora-text)' }}>
              {formatPrice(total)}
            </span>
          </div>
        </div>

        {/* Expand indicator */}
        <div className="ml-2 flex-shrink-0">
          {isExpanded
            ? <ChevronUp size={18} style={{ color: 'var(--aurora-text-muted)' }} />
            : <ChevronDown size={18} style={{ color: 'var(--aurora-text-muted)' }} />
          }
        </div>
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="border-t px-4 pb-4" style={{ borderColor: 'var(--aurora-border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
