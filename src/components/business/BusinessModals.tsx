import React, { useEffect, useRef } from 'react';
import {
  X, Trash2, Edit3, Loader2, Flag, Ban, Scale,
} from 'lucide-react';
import { REPORT_CATEGORIES } from '@/components/business/businessConstants';
import type { Business } from '@/reducers/businessReducer';

// ── Shared focus-trap + ESC-to-close hook ──
function useModalA11y(
  ref: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  // Prevent body scroll behind modal (including iOS Safari)
  useEffect(() => {
    const htmlEl = document.documentElement;
    const prevHtml = htmlEl.style.overflow;
    const prevBody = document.body.style.overflow;
    htmlEl.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      htmlEl.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab' && ref.current) {
        const focusable = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const prev = document.activeElement as HTMLElement;
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prev?.focus?.();
    };
  }, [ref, onClose]);
}

// ═════════════════════════════════════════════════════════════════════════════════
// TIN Verification Modal
// ═════════════════════════════════════════════════════════════════════════════════

export interface TinVerificationModalProps {
  dispatch: React.Dispatch<any>;
}

export const TinVerificationModal: React.FC<TinVerificationModalProps> = ({ dispatch }) => {
  const ref = useRef<HTMLDivElement>(null);
  const close = () => dispatch({ type: 'SET_SHOW_TIN_MODAL', payload: false });
  useModalA11y(ref, close);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tin-modal-title"
        aria-describedby="tin-modal-desc"
        tabIndex={-1}
        className="bg-aurora-surface rounded-2xl shadow-2xl max-w-md w-full p-6 border border-aurora-border focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
            <Scale className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <h2 id="tin-modal-title" className="text-xl font-bold text-aurora-text">TIN Verification Required</h2>
          <p id="tin-modal-desc" className="text-sm text-aurora-text-secondary mt-2">
            Your registered business TIN/EIN must be verified before you can create listings.
          </p>
        </div>
        <div className="space-y-2.5">
          <button
            onClick={() => { close(); window.location.href = '/profile'; }}
            className="w-full bg-aurora-indigo text-white py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Go to Profile
          </button>
          <button
            onClick={close}
            className="w-full bg-aurora-surface-variant text-aurora-text-secondary py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-border/30 transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════════
// Delete Confirmation Modal
// ═════════════════════════════════════════════════════════════════════════════════

export interface DeleteConfirmModalProps {
  saving: boolean;
  dispatch: React.Dispatch<any>;
  confirmDeleteBusiness: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ saving, dispatch, confirmDeleteBusiness }) => {
  const ref = useRef<HTMLDivElement>(null);
  const close = () => dispatch({ type: 'CLOSE_DELETE_CONFIRM' });
  useModalA11y(ref, close);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={close}>
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-desc"
        tabIndex={-1}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trash2 size={24} className="text-red-500" aria-hidden="true" />
          </div>
          <h3 id="delete-modal-title" className="text-lg font-semibold text-gray-900 mb-2">Delete Business?</h3>
          <p id="delete-modal-desc" className="text-sm text-gray-500 mb-5">
            Are you sure you want to delete this business listing? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={close}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteBusiness}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Deleting...</> : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════════
// Context Menu (Three-dot menu)
// ═════════════════════════════════════════════════════════════════════════════════

export interface ContextMenuProps {
  biz: Business;
  menuPosition: { top: number; right: number };
  isOwnerOrAdmin: (b: Business) => boolean;
  user: any;
  reportedBusinesses: Set<string>;
  blockedUsers: Set<string>;
  closeMenu: () => void;
  handleStartEdit: () => void;
  handleDeleteBusiness: (id: string) => void;
  openReportModal: (id: string) => void;
  openBlockConfirm: (ownerId: string, name: string) => void;
  dispatch: React.Dispatch<any>;
  selectedBusiness: Business | null;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  biz,
  menuPosition,
  isOwnerOrAdmin,
  user,
  reportedBusinesses,
  blockedUsers,
  closeMenu,
  handleStartEdit,
  handleDeleteBusiness,
  openReportModal,
  openBlockConfirm,
  dispatch,
  selectedBusiness,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeMenu(); return; }
      // Arrow key navigation within menu
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
        if (!buttons?.length) return;
        const arr = Array.from(buttons);
        const idx = arr.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'ArrowDown') {
          arr[(idx + 1) % arr.length].focus();
        } else {
          arr[(idx - 1 + arr.length) % arr.length].focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus first menu item
    const firstBtn = menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    firstBtn?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeMenu]);

  return (
    <>
      <div className="fixed inset-0 z-[55]" onClick={closeMenu} aria-hidden="true" />
      <div
        ref={menuRef}
        role="menu"
        aria-label={`Actions for ${biz.name}`}
        className="fixed bg-aurora-surface rounded-xl shadow-aurora-3 border border-aurora-border py-1.5 z-[56] min-w-[200px]"
        style={{ top: menuPosition.top, right: menuPosition.right }}
      >
        {isOwnerOrAdmin(biz) && (
          <>
            <button
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); closeMenu(); if (!selectedBusiness) dispatch({ type: 'SELECT_BUSINESS', payload: biz }); setTimeout(() => handleStartEdit(), 50); }}
              className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-text-secondary hover:bg-aurora-surface-variant transition-colors focus-visible:bg-aurora-surface-variant focus-visible:outline-none"
            >
              <Edit3 size={16} aria-hidden="true" /> Edit Business
            </button>
            <button
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); closeMenu(); handleDeleteBusiness(biz.id); }}
              className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-danger hover:bg-aurora-danger/10 transition-colors focus-visible:bg-aurora-danger/10 focus-visible:outline-none"
            >
              <Trash2 size={16} aria-hidden="true" /> Delete Business
            </button>
          </>
        )}
        <button
          role="menuitem"
          onClick={(e) => { e.stopPropagation(); closeMenu(); openReportModal(biz.id); }}
          className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-text-secondary hover:bg-aurora-surface-variant transition-colors focus-visible:bg-aurora-surface-variant focus-visible:outline-none"
          disabled={reportedBusinesses.has(biz.id)}
        >
          <Flag size={16} aria-hidden="true" /> {reportedBusinesses.has(biz.id) ? 'Reported' : 'Report Business'}
        </button>
        {biz.ownerId && biz.ownerId !== user?.uid && (
          <button
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); closeMenu(); openBlockConfirm(biz.ownerId!, biz.name); }}
            className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-danger hover:bg-aurora-danger/10 transition-colors focus-visible:bg-aurora-danger/10 focus-visible:outline-none"
          >
            <Ban size={16} aria-hidden="true" /> {blockedUsers.has(biz.ownerId!) ? 'Blocked' : 'Block Owner'}
          </button>
        )}
      </div>
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════════════
// Report Business Modal
// ═════════════════════════════════════════════════════════════════════════════════

export interface ReportModalProps {
  reportReason: string;
  reportDetails: string;
  reportSubmitting: boolean;
  dispatch: React.Dispatch<any>;
  handleSubmitReport: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  reportReason,
  reportDetails,
  reportSubmitting,
  dispatch,
  handleSubmitReport,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const close = () => dispatch({ type: 'CLOSE_REPORT' });
  useModalA11y(ref, close);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={close}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        tabIndex={-1}
        className="bg-aurora-surface rounded-2xl shadow-aurora-4 w-full max-w-md border border-aurora-border overflow-hidden focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-aurora-border bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 id="report-modal-title" className="text-lg font-bold text-aurora-text flex items-center gap-2">
                <Flag size={18} className="text-red-500" aria-hidden="true" />
                Report Business
              </h3>
              <p className="text-sm text-aurora-text-muted mt-0.5">Select a category that best describes the issue</p>
            </div>
            <button
              onClick={close}
              aria-label="Close report dialog"
              className="p-1.5 rounded-full hover:bg-aurora-surface-variant transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none"
            >
              <X size={18} className="text-aurora-text-muted" />
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="px-5 py-3 space-y-2 max-h-[40vh] overflow-y-auto" role="radiogroup" aria-label="Report reason">
          {REPORT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              role="radio"
              aria-checked={reportReason === cat.id}
              onClick={() => dispatch({ type: 'SET_REPORT_REASON', payload: cat.id })}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none ${reportReason === cat.id
                  ? 'border-red-400 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-300'
                  : 'border-aurora-border hover:border-aurora-border-glass hover:bg-aurora-surface-variant'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg shrink-0" aria-hidden="true">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${reportReason === cat.id ? 'text-red-700 dark:text-red-400' : 'text-aurora-text'}`}>
                    {cat.label}
                  </p>
                  <p className="text-xs text-aurora-text-muted mt-0.5 leading-relaxed">{cat.description}</p>
                </div>
                {reportReason === cat.id && (
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Optional Details */}
        {reportReason && (
          <div className="px-5 py-3 border-t border-aurora-border/50">
            <label htmlFor="report-details" className="text-xs font-semibold text-aurora-text-secondary uppercase tracking-wider">Additional Details (Optional)</label>
            <textarea
              id="report-details"
              value={reportDetails}
              onChange={(e) => dispatch({ type: 'SET_REPORT_DETAILS', payload: e.target.value })}
              placeholder="Provide more context about why you're reporting this business..."
              maxLength={500}
              rows={3}
              className="mt-1.5 w-full px-3 py-2.5 bg-aurora-surface-variant border border-aurora-border rounded-xl text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-red-300/50 resize-none"
            />
            <p className="text-[10px] text-aurora-text-muted text-right mt-1" aria-live="polite">{reportDetails.length}/500</p>
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-4 border-t border-aurora-border flex gap-3">
          <button
            onClick={close}
            className="flex-1 py-2.5 rounded-xl border border-aurora-border text-aurora-text-secondary font-medium hover:bg-aurora-surface-variant transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitReport}
            disabled={!reportReason || reportSubmitting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition-colors btn-press flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
          >
            {reportSubmitting ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" /> Submitting...</>
            ) : (
              <><Flag size={14} aria-hidden="true" /> Submit Report</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════════
// Block User Confirmation Modal
// ═════════════════════════════════════════════════════════════════════════════════

export interface BlockConfirmModalProps {
  blockTargetUser: { uid: string; name: string };
  dispatch: React.Dispatch<any>;
  handleBlockUser: () => void;
}

export const BlockConfirmModal: React.FC<BlockConfirmModalProps> = ({
  blockTargetUser,
  dispatch,
  handleBlockUser,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const close = () => dispatch({ type: 'CLOSE_BLOCK_CONFIRM' });
  useModalA11y(ref, close);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={close}>
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="block-modal-title"
        aria-describedby="block-modal-desc"
        tabIndex={-1}
        className="bg-aurora-surface rounded-2xl shadow-aurora-4 border border-aurora-border max-w-sm w-full p-6 text-center focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <Ban size={24} className="text-red-500" aria-hidden="true" />
        </div>
        <h3 id="block-modal-title" className="text-lg font-bold text-aurora-text mb-2">Block {blockTargetUser.name}?</h3>
        <p id="block-modal-desc" className="text-sm text-aurora-text-muted mb-6">
          They won't be notified. Their businesses will be hidden from your listings. You can unblock them anytime from your Profile settings.
        </p>
        <div className="flex gap-3">
          <button
            onClick={close}
            className="flex-1 py-2.5 rounded-xl border border-aurora-border text-aurora-text-secondary font-medium hover:bg-aurora-surface-variant transition-colors focus-visible:ring-2 focus-visible:ring-aurora-indigo focus-visible:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleBlockUser}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
          >
            Block
          </button>
        </div>
      </div>
    </div>
  );
};
