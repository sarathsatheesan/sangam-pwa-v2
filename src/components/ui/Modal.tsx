import React, { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useModalA11y } from '../../hooks/useModalA11y';

/**
 * Shared modal shell (Session 45).
 *
 * One implementation of the things every bespoke modal in events/housing/
 * forum/marketplace was missing or re-implementing:
 *   - ESC to close + focus trap + focus restore (via useModalA11y)
 *   - body scroll lock while open
 *   - backdrop click to close (panel clicks stopPropagation)
 *   - ARIA dialog semantics
 *   - mobile bottom-sheet, desktop centered card (Aurora styling, dark mode)
 *
 * Z-scale policy: 'base' (z-50) for page-level modals, 'high' (z-[70]) for
 * modals stacked on other modals (e.g. report-on-top-of-detail). Matches the
 * levels already used by the business module.
 *
 * MIGRATION RULE: this is a SHELL. Page migrations move their existing modal
 * body content inside unchanged — fields, buttons, and handlers must be
 * preserved exactly (feature parity, Session 44 ground rule).
 */

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
} as const;

const Z = {
  base: 'z-50',
  high: 'z-[70]',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name. Rendered as the header title unless hideHeader. */
  title: string;
  size?: keyof typeof SIZES;
  /** 'high' for modals stacked on top of other modals. */
  layer?: keyof typeof Z;
  /** Hide the built-in header (title stays as aria-label). */
  hideHeader?: boolean;
  /** Disable closing via backdrop click (ESC still closes). */
  disableBackdropClose?: boolean;
  /** Extra classes for the panel (e.g. overflow handling). */
  panelClassName?: string;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  layer = 'base',
  hideHeader = false,
  disableBackdropClose = false,
  panelClassName = '',
  children,
}: ModalProps) {
  const { modalRef, handleKeyDown } = useModalA11y(open, onClose);

  // Body scroll lock while open (restores previous value on close/unmount)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${Z[layer]} flex items-end sm:items-center justify-center sm:p-4`}
      onClick={disableBackdropClose ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${SIZES[size]} max-h-[90dvh] sm:max-h-[85dvh] flex flex-col
          bg-aurora-surface border border-aurora-border shadow-aurora-4
          rounded-t-2xl sm:rounded-2xl focus:outline-none ${panelClassName}`}
      >
        {!hideHeader && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-aurora-border shrink-0">
            <h2 className="text-lg font-semibold text-aurora-text">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-full text-aurora-text-secondary hover:bg-aurora-bg
                focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain grow">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
