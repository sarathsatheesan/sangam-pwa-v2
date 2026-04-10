// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS SWITCHER DROPDOWN
// Top-bar dropdown for multi-business owners. Shows in the header when the user
// owns at least one approved business. If only one business exists it renders a
// compact pill. If multiple exist, it opens a dropdown to switch between them.
// Cross-browser: all inline styles, no non-existent CSS vars.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Store, ChevronDown, Check, Plus } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBusinessSwitcher } from '../../contexts/BusinessSwitcherContext';

// Hardcoded colors — avoids missing aurora CSS vars across browsers
const COLORS = {
  primary: '#6366F1',
  primaryBg: 'rgba(99, 102, 241, 0.08)',
  primaryHover: 'rgba(99, 102, 241, 0.14)',
  surface: 'var(--aurora-surface, #fff)',
  surfaceVariant: 'var(--aurora-surface-variant, #EDF0F7)',
  text: 'var(--aurora-text, #1a1a2e)',
  textSecondary: 'var(--aurora-text-secondary, #6b7280)',
  border: 'var(--aurora-border, #e5e7eb)',
  shadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08)',
};

export const BusinessSwitcher: React.FC = () => {
  const { businesses, selectedBusiness, selectBusiness, loading, isMultiBusiness } = useBusinessSwitcher();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSelect = useCallback(
    (businessId: string) => {
      selectBusiness(businessId);
      setOpen(false);
      // If currently on a vendor-scoped route, navigate to the new business
      if (location.pathname.includes('/vendor/')) {
        const pathParts = location.pathname.split('/');
        // Replace the businessId segment: /vendor/:oldId/... → /vendor/:newId/...
        const vendorIdx = pathParts.indexOf('vendor');
        if (vendorIdx !== -1 && pathParts[vendorIdx + 1]) {
          pathParts[vendorIdx + 1] = businessId;
          navigate(pathParts.join('/'));
        }
      }
    },
    [selectBusiness, navigate, location.pathname],
  );

  const handleAddBusiness = useCallback(() => {
    setOpen(false);
    navigate('/business/register');
  }, [navigate]);

  // Don't render if user has no businesses or still loading
  if (loading || businesses.length === 0) return null;

  // Single business — compact pill (no dropdown)
  if (!isMultiBusiness && selectedBusiness) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
        style={{
          backgroundColor: COLORS.primaryBg,
          color: COLORS.primary,
          maxWidth: '180px',
        }}
        title={selectedBusiness.name}
      >
        <Store size={13} className="shrink-0" />
        <span className="truncate">{selectedBusiness.name}</span>
      </div>
    );
  }

  // Multi-business — dropdown
  return (
    <div ref={dropdownRef} className="relative" style={{ zIndex: 50 }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{
          backgroundColor: open ? COLORS.primaryHover : COLORS.primaryBg,
          color: COLORS.primary,
          maxWidth: '200px',
          WebkitTapHighlightColor: 'transparent',
          minHeight: '36px',
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Store size={13} className="shrink-0" />
        <span className="truncate">{selectedBusiness?.name || 'Select Business'}</span>
        <ChevronDown
          size={13}
          className="shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute top-full mt-1.5 right-0 min-w-[220px] max-w-[300px] rounded-xl overflow-hidden"
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            boxShadow: COLORS.shadow,
            /* Cross-browser smooth entry */
            animation: 'businessSwitcherFadeIn 0.15s ease-out',
          }}
          role="listbox"
          aria-label="Select a business"
        >
          {/* Business list */}
          <div className="py-1 max-h-[240px] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {businesses.map((biz) => {
              const isSelected = biz.id === selectedBusiness?.id;
              return (
                <button
                  key={biz.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(biz.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{
                    backgroundColor: isSelected ? COLORS.primaryBg : 'transparent',
                    color: COLORS.text,
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: '44px', /* Touch target */
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* Business emoji/icon */}
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: COLORS.surfaceVariant }}
                  >
                    {biz.emoji || '🏪'}
                  </span>
                  {/* Name + category */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: COLORS.text }}>
                      {biz.name}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: COLORS.textSecondary }}>
                      {biz.category}
                    </div>
                  </div>
                  {/* Check mark */}
                  {isSelected && <Check size={16} style={{ color: COLORS.primary }} className="shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Divider + Add Business */}
          <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <button
              type="button"
              onClick={handleAddBusiness}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
              style={{
                color: COLORS.primary,
                WebkitTapHighlightColor: 'transparent',
                minHeight: '44px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.primaryBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Plus size={16} className="shrink-0" />
              <span className="text-sm font-medium">Add Business</span>
            </button>
          </div>
        </div>
      )}

      {/* Keyframe for dropdown animation — injected once */}
      <style>{`
        @keyframes businessSwitcherFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BusinessSwitcher;
