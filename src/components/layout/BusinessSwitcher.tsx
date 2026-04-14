// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS SWITCHER DROPDOWN
// Top-bar / vendor-dashboard dropdown for multi-business owners. Renders a pill
// trigger, and on click opens a dropdown positioned using viewport-edge-aware
// logic — the dropdown never clips off the left, right, top, or bottom of the
// visual viewport regardless of where the trigger is placed on the page.
//
// Cross-browser strategy:
//   • position: fixed + getBoundingClientRect() — identical math in Chrome /
//     Safari / Firefox / iOS Safari / Android Chrome, and avoids clipping from
//     ancestors with `overflow: hidden`, `transform`, or `filter` (all of which
//     create a new containing block on different browsers).
//   • window.visualViewport when available (Safari/iOS pinch-zoom + keyboard)
//     falls back to window.innerWidth/Height elsewhere.
//   • Position recomputed on open, scroll, resize, and orientationchange.
//   • -webkit- prefixes on overflow scrolling, tap highlight, backdrop.
//   • maxHeight clamps to viewport minus margins so dropdown stays scrollable
//     even on short phones / landscape.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
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

// Dropdown sizing constraints — kept in one place so the positioning math stays
// aligned with the actual rendered width.
const DROPDOWN_MIN_WIDTH = 240;
const DROPDOWN_MAX_WIDTH = 320;
const VIEWPORT_MARGIN = 8;   // px — minimum gap to viewport edge
const TRIGGER_GAP = 6;        // px — vertical gap between trigger and dropdown

// Pre-SSR safe check for `document` (our app is CSR, but guards cheap)
const isBrowser = typeof window !== 'undefined';

// Small helper — visualViewport on Safari/iOS gives us the real
// (pinch-zoom-aware) dimensions. Fallback to innerWidth/Height.
function getViewport() {
  if (!isBrowser) return { width: 1024, height: 768, offsetLeft: 0, offsetTop: 0 };
  const vv = window.visualViewport;
  if (vv) {
    return {
      width: vv.width,
      height: vv.height,
      offsetLeft: vv.offsetLeft,
      offsetTop: vv.offsetTop,
    };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    offsetLeft: 0,
    offsetTop: 0,
  };
}

interface Position {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  origin: 'top-left' | 'top-right';
}

export const BusinessSwitcher: React.FC = () => {
  const { businesses, selectedBusiness, selectBusiness, loading, isMultiBusiness } = useBusinessSwitcher();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  // Separate refs — the wrapper positions the trigger in the flow; the dropdown
  // renders at document root so ancestor overflow/transform cannot clip it.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Position computation ────────────────────────────────────────────────
  // Re-measures the trigger and picks the best dropdown placement so it stays
  // fully inside the visual viewport. Called on open, scroll, resize, and
  // orientationchange to survive soft keyboard, rotation, and pinch-zoom.
  const recomputePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const vp = getViewport();

    // Decide width: the dropdown should be at least as wide as the trigger,
    // but clamped to our min/max and the viewport (minus margins).
    const availableViewportWidth = Math.max(0, vp.width - VIEWPORT_MARGIN * 2);
    const idealWidth = Math.max(DROPDOWN_MIN_WIDTH, rect.width);
    const width = Math.min(DROPDOWN_MAX_WIDTH, idealWidth, availableViewportWidth);

    // Horizontal placement: prefer aligning the dropdown's LEFT edge with the
    // trigger's LEFT edge. If that would overflow the right viewport edge,
    // right-align instead. If both would clip (narrow viewport), clamp to the
    // viewport with a minimum margin — never let it escape the screen.
    const leftAligned = rect.left;                            // dropdown left at trigger left
    const rightAligned = rect.right - width;                  // dropdown right at trigger right
    const maxLeft = vp.offsetLeft + vp.width - VIEWPORT_MARGIN - width;
    const minLeft = vp.offsetLeft + VIEWPORT_MARGIN;

    let left: number;
    let origin: Position['origin'];
    if (leftAligned + width <= vp.offsetLeft + vp.width - VIEWPORT_MARGIN) {
      // Fits with left alignment
      left = leftAligned;
      origin = 'top-left';
    } else if (rightAligned >= minLeft) {
      // Fits with right alignment
      left = rightAligned;
      origin = 'top-right';
    } else {
      // Neither — clamp. Decide origin based on which side the trigger is closer to.
      const triggerCenter = rect.left + rect.width / 2;
      origin = triggerCenter > vp.offsetLeft + vp.width / 2 ? 'top-right' : 'top-left';
      left = Math.max(minLeft, Math.min(leftAligned, maxLeft));
    }
    // Final safety clamp — covers subpixel overflow on Safari/iOS
    left = Math.max(minLeft, Math.min(left, maxLeft));

    // Vertical placement: open below by default. If there's less room below
    // than above AND the dropdown would overflow bottom, flip to open above.
    const spaceBelow = vp.offsetTop + vp.height - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - vp.offsetTop - VIEWPORT_MARGIN;

    let top: number;
    let maxHeight: number;
    if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
      // Open below
      top = rect.bottom + TRIGGER_GAP;
      maxHeight = Math.max(160, spaceBelow - TRIGGER_GAP);
    } else {
      // Open above — top equals bottom-of-dropdown; we offset by maxHeight later
      // via `bottom` equivalent. Easier: just compute top after clamping height.
      maxHeight = Math.max(160, spaceAbove - TRIGGER_GAP);
      top = rect.top - TRIGGER_GAP - maxHeight;
      // Clamp to top edge
      if (top < vp.offsetTop + VIEWPORT_MARGIN) top = vp.offsetTop + VIEWPORT_MARGIN;
    }

    setPosition({ left, top, width, maxHeight, origin });
  }, []);

  // Recompute on open
  useLayoutEffect(() => {
    if (!open) return;
    recomputePosition();
  }, [open, recomputePosition]);

  // Recompute on scroll, resize, orientationchange, and visualViewport events.
  // Use capture-phase scroll listener so parent scroll containers also trigger.
  useEffect(() => {
    if (!open) return;
    const handler = () => recomputePosition();
    window.addEventListener('scroll', handler, true); // capture for nested scrollers
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    const vv = isBrowser ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener('resize', handler);
      vv.addEventListener('scroll', handler);
    }
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
      if (vv) {
        vv.removeEventListener('resize', handler);
        vv.removeEventListener('scroll', handler);
      }
    };
  }, [open, recomputePosition]);

  // Close on outside click — must check BOTH trigger and dropdown refs because
  // they are no longer in the same DOM subtree (dropdown is portaled to body).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    // Use both mousedown and touchstart — iOS Safari sometimes fires touch
    // first. pointerdown would be cleanest but needs polyfill on older iOS.
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
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
      if (location.pathname.includes('/vendor/')) {
        const pathParts = location.pathname.split('/');
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
    navigate('/business?action=add');
  }, [navigate]);

  if (loading || businesses.length === 0) return null;

  // Single business — compact pill (no dropdown)
  if (!isMultiBusiness && selectedBusiness) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
        style={{
          backgroundColor: COLORS.primaryBg,
          color: COLORS.primary,
          maxWidth: '200px',
        }}
        title={selectedBusiness.name}
      >
        <Store size={13} className="shrink-0" />
        <span className="truncate">{selectedBusiness.name}</span>
      </div>
    );
  }

  return (
    <>
      {/* Trigger stays in the flow */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{
          backgroundColor: open ? COLORS.primaryHover : COLORS.primaryBg,
          color: COLORS.primary,
          maxWidth: '220px',
          WebkitTapHighlightColor: 'transparent',
          WebkitAppearance: 'none',
          appearance: 'none',
          minHeight: 36,
          cursor: 'pointer',
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

      {/* Dropdown — position: fixed using measured coords. Because it's fixed
          to the viewport, ancestor overflow:hidden or transform cannot clip it. */}
      {open && position && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Select a business"
          className="rounded-xl overflow-hidden"
          style={{
            position: 'fixed',
            left: `${position.left}px`,
            top: `${position.top}px`,
            width: `${position.width}px`,
            maxHeight: `${position.maxHeight}px`,
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            boxShadow: COLORS.shadow,
            zIndex: 9999,
            transformOrigin: position.origin === 'top-right' ? 'top right' : 'top left',
            animation: 'businessSwitcherFadeIn 0.15s ease-out',
            // Hardware-accelerate transform animation on Safari/iOS
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Business list — constrained height, internal scroll */}
          <div
            className="py-1"
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',     // iOS momentum scroll
              overscrollBehavior: 'contain',         // block scroll-chain on Chrome/Safari
            } as React.CSSProperties}
          >
            {businesses.map((biz) => {
              const isSelected = biz.id === selectedBusiness?.id;
              return (
                <button
                  key={biz.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(biz.id)}
                  title={biz.name}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{
                    backgroundColor: isSelected ? COLORS.primaryBg : 'transparent',
                    color: COLORS.text,
                    WebkitTapHighlightColor: 'transparent',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    minHeight: 44,
                    cursor: 'pointer',
                    border: 'none',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span
                    className="rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: COLORS.surfaceVariant,
                    }}
                  >
                    {biz.emoji || '🏪'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold"
                      style={{
                        color: COLORS.text,
                        // Preserve 1-line elegance but wrap gracefully if someone
                        // has a name with no spaces (e.g. "AVeryLongBusinessName")
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {biz.name}
                    </div>
                    <div
                      className="text-[10px]"
                      style={{
                        color: COLORS.textSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {biz.category}
                    </div>
                  </div>
                  {isSelected && <Check size={16} style={{ color: COLORS.primary }} className="shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Divider + Add Business (sticky at bottom of panel) */}
          <div style={{ borderTop: `1px solid ${COLORS.border}`, flex: '0 0 auto' }}>
            <button
              type="button"
              onClick={handleAddBusiness}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
              style={{
                color: COLORS.primary,
                WebkitTapHighlightColor: 'transparent',
                WebkitAppearance: 'none',
                appearance: 'none',
                minHeight: 44,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
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

      {/* Keyframe for dropdown animation — injected once. Scoped via unique name. */}
      <style>{`
        @keyframes businessSwitcherFadeIn {
          from { opacity: 0; transform: translateY(-4px) translateZ(0); }
          to   { opacity: 1; transform: translateY(0) translateZ(0); }
        }
      `}</style>
    </>
  );
};

export default BusinessSwitcher;
