// ═══════════════════════════════════════════════════════════════════════
// SB-12: Shared Modal / Drawer Component
// Provides consistent animation, backdrop, Escape handling, and focus
// trapping for all catering module dialogs.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SharedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** 'center' = fixed center overlay, 'drawer' = slide-in from right */
  variant?: 'center' | 'drawer';
  /** Max width for center variant */
  maxWidth?: string;
  /** Whether to show close button */
  showClose?: boolean;
  /** Disable closing (e.g. during form submission) */
  disableClose?: boolean;
}

export default function SharedModal({
  isOpen,
  onClose,
  title,
  children,
  variant = 'center',
  maxWidth = '28rem',
  showClose = true,
  disableClose = false,
}: SharedModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    if (!isOpen || disableClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, disableClose]);

  // Focus trap — focus first focusable element when opened
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length > 0) focusable[0].focus();
  }, [isOpen]);

  // Lock body scroll when open
  // Cross-browser: iOS Safari ignores overflow:hidden on body — use position:fixed pattern
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      const originalStyles = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
      };
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      return () => {
        document.body.style.overflow = originalStyles.overflow;
        document.body.style.position = originalStyles.position;
        document.body.style.top = originalStyles.top;
        document.body.style.left = originalStyles.left;
        document.body.style.right = originalStyles.right;
        document.body.style.width = originalStyles.width;
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (variant === 'drawer') {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={disableClose ? undefined : onClose}
          role="presentation"
        />
        <div
          ref={modalRef}
          className="fixed right-0 top-0 h-full w-full shadow-lg z-50 transform transition-transform duration-300 ease-in-out translate-x-0"
          style={{ maxWidth, willChange: 'transform', WebkitOverflowScrolling: 'touch', backgroundColor: 'var(--aurora-surface)' } as React.CSSProperties}
          role="dialog"
          aria-modal={true}
          aria-label={title || 'Dialog'}
        >
          {(title || showClose) && (
            <div className="sticky top-0 border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}>
              {title && <h2 className="text-lg font-semibold" style={{ color: 'var(--aurora-text)' }}>{title}</h2>}
              {showClose && (
                <button
                  onClick={disableClose ? undefined : onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                  disabled={disableClose}
                >
                  <X className="w-5 h-5" style={{ color: 'var(--aurora-text-secondary)' }} />
                </button>
              )}
            </div>
          )}
          {children}
        </div>
      </>
    );
  }

  // Center variant
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={disableClose ? undefined : onClose}
        role="presentation"
      />
      <div
        ref={modalRef}
        className="relative w-full rounded-2xl shadow-xl overflow-hidden"
        style={{ maxWidth, backgroundColor: 'var(--aurora-surface, #fff)' }}
        role="dialog"
        aria-modal={true}
        aria-label={title || 'Dialog'}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            {title && <h3 className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>{title}</h3>}
            {showClose && (
              <button
                onClick={disableClose ? undefined : onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close"
                disabled={disableClose}
              >
                <X className="w-5 h-5" style={{ color: 'var(--aurora-text-secondary)' }} />
              </button>
            )}
          </div>
        )}
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}
