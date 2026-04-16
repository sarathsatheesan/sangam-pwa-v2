import React from 'react';
import { Loader2 } from 'lucide-react';

const VENDOR_CANCEL_REASONS = [
  'Item unavailable',
  'Cannot fulfill timeline',
  'Customer no-show',
  'Kitchen issue',
  'Other',
];

interface CancelOrderModalProps {
  isOpen: boolean;
  cancelReason: string;
  cancelOtherText: string;
  onReasonChange: (reason: string) => void;
  onOtherTextChange: (text: string) => void;
  onSubmit: () => Promise<void>;
  onClose: () => void;
  loading: boolean;
  modalRef?: React.RefObject<HTMLDivElement | null>;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function CancelOrderModal({
  isOpen,
  cancelReason,
  cancelOtherText,
  onReasonChange,
  onOtherTextChange,
  onSubmit,
  onClose,
  loading,
  modalRef,
  onKeyDown,
}: CancelOrderModalProps) {
  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Cancel order"
    >
      <div
        className="absolute inset-0 bg-black/40"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={() => !loading && onClose()}
      />
      <div
        className="relative mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--aurora-surface, #fff)' }}
      >
        <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--aurora-text)' }}>
          Cancel Order
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
          Please select a reason for cancelling this order.
        </p>
        <div className="space-y-2 mb-4">
          {VENDOR_CANCEL_REASONS.map((reason) => (
            <label
              key={reason}
              className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <input
                type="radio"
                name="vendor-cancel-reason"
                value={reason}
                checked={cancelReason === reason}
                onChange={() => onReasonChange(reason)}
                className="accent-red-500"
              />
              <span className="text-sm" style={{ color: 'var(--aurora-text)' }}>
                {reason}
              </span>
            </label>
          ))}
          {cancelReason === 'Other' && (
            <textarea
              value={cancelOtherText}
              onChange={(e) => onOtherTextChange(e.target.value)}
              placeholder="Please describe..."
              rows={2}
              maxLength={200}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-red-300"
              style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
            />
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
          >
            Go Back
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || !cancelReason}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#EF4444' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
