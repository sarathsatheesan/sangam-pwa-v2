import React from 'react';
import { CreditCard, Clock3, X, Loader2, Save } from 'lucide-react';

interface PaymentSetupBannerProps {
  visible: boolean;
  showPaymentReminder: boolean;
  paymentUrl: string;
  paymentMethod: string;
  paymentNote: string;
  paymentSkippedUntil: number | null;
  hasPaymentInfo: boolean;
  showPaymentSettings: boolean;
  setShowPaymentSettings: (show: boolean) => void;
  onSave: () => Promise<void>;
  onDefer: (days: number) => Promise<void>;
  onDeferPayment: (days: number) => void;
  paymentSaving: boolean;
  paymentDeferring: boolean;
  onPaymentMethodChange: (value: string) => void;
  onPaymentUrlChange: (value: string) => void;
  onPaymentNoteChange: (value: string) => void;
  formatSnoozeDate: (ms: number) => string;
}

export function PaymentSetupBanner({
  visible,
  showPaymentReminder,
  paymentUrl,
  paymentMethod,
  paymentNote,
  paymentSkippedUntil,
  hasPaymentInfo,
  showPaymentSettings,
  setShowPaymentSettings,
  onSave,
  onDefer,
  onDeferPayment,
  paymentSaving,
  paymentDeferring,
  onPaymentMethodChange,
  onPaymentUrlChange,
  onPaymentNoteChange,
  formatSnoozeDate,
}: PaymentSetupBannerProps) {
  if (!visible) return null;

  return (
    <>
      {/* Reminder banner */}
      {showPaymentReminder && (
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border mb-4"
          style={{
            borderColor: '#FCD34D',
            backgroundColor: '#FFFBEB',
            WebkitTapHighlightColor: 'transparent',
          }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2 min-w-0">
            <CreditCard size={18} style={{ color: '#B45309', flexShrink: 0, marginTop: 2 }} />
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: '#78350F' }}>
                Add a payment link (optional)
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>
                Orders will still come through without it — set it up whenever you're ready.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowPaymentSettings(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-medium text-white transition-colors"
              style={{
                backgroundColor: 'var(--aurora-accent)',
                minHeight: 40,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Set up now
            </button>
            <button
              type="button"
              onClick={() => onDeferPayment(7)}
              disabled={paymentDeferring}
              className="inline-flex items-center justify-center px-3 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
              style={{
                borderColor: '#FCD34D',
                color: '#78350F',
                backgroundColor: 'rgba(255,255,255,0.7)',
                minHeight: 40,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {paymentDeferring ? <Loader2 size={12} className="animate-spin" /> : 'Remind me later'}
            </button>
          </div>
        </div>
      )}

      {/* Deferred state info */}
      {!hasPaymentInfo && paymentSkippedUntil !== null && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg mb-4 text-xs"
          style={{
            backgroundColor: 'var(--aurora-surface-variant, #EDF0F7)',
            color: 'var(--aurora-text-secondary, #6b7280)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={12} />
            Payment setup reminder snoozed until {formatSnoozeDate(paymentSkippedUntil)}
          </span>
          <button
            type="button"
            onClick={() => setShowPaymentSettings(true)}
            className="font-medium underline"
            style={{ color: 'var(--aurora-accent)', WebkitTapHighlightColor: 'transparent' }}
          >
            Set up now
          </button>
        </div>
      )}

      {/* Payment settings form */}
      {showPaymentSettings && (
        <div
          className="p-4 rounded-xl border space-y-3"
          style={{ borderColor: 'var(--aurora-accent)', backgroundColor: 'rgba(99,102,241,0.03)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--aurora-accent)' }}>
              Payment Settings
            </p>
            <button
              type="button"
              onClick={() => setShowPaymentSettings(false)}
              aria-label="Close payment settings"
              className="inline-flex items-center justify-center rounded-md"
              style={{ minWidth: 32, minHeight: 32, WebkitTapHighlightColor: 'transparent' }}
            >
              <X size={16} style={{ color: 'var(--aurora-text-muted, #6b7280)' }} />
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary, #6b7280)' }}>
            Add your payment link so customers can pay you directly. You can skip this for now — orders will still come through.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium" style={{ color: 'var(--aurora-text-muted, #6b7280)' }}>
                Payment Method
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => onPaymentMethodChange(e.target.value)}
                placeholder="e.g. Venmo, PayPal, Zelle"
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                className="w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: 'var(--aurora-border, #e5e7eb)',
                  color: 'var(--aurora-text, #1a1a2e)',
                  backgroundColor: 'var(--aurora-surface, #fff)',
                  fontSize: '16px',
                  WebkitAppearance: 'none',
                  minHeight: 44,
                }}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium" style={{ color: 'var(--aurora-text-muted, #6b7280)' }}>
                Payment URL
              </label>
              <input
                type="url"
                inputMode="url"
                value={paymentUrl}
                onChange={(e) => onPaymentUrlChange(e.target.value)}
                placeholder="https://venmo.com/your-handle"
                autoComplete="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: 'var(--aurora-border, #e5e7eb)',
                  color: 'var(--aurora-text, #1a1a2e)',
                  backgroundColor: 'var(--aurora-surface, #fff)',
                  fontSize: '16px',
                  WebkitAppearance: 'none',
                  minHeight: 44,
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium" style={{ color: 'var(--aurora-text-muted, #6b7280)' }}>
              Payment Instructions
            </label>
            <textarea
              value={paymentNote}
              onChange={(e) => onPaymentNoteChange(e.target.value)}
              placeholder="e.g. Please include order # in the memo"
              rows={2}
              className="w-full mt-1 rounded-lg border px-3 py-2 text-sm outline-none resize-none"
              style={{
                borderColor: 'var(--aurora-border, #e5e7eb)',
                color: 'var(--aurora-text, #1a1a2e)',
                backgroundColor: 'var(--aurora-surface, #fff)',
                fontSize: '16px',
                WebkitAppearance: 'none',
              }}
            />
          </div>

          {/* Action row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onSave}
              disabled={paymentSaving || paymentDeferring}
              className="inline-flex items-center justify-center gap-1.5 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{
                backgroundColor: 'var(--aurora-accent)',
                minHeight: 44,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {paymentSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Payment Info
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onDeferPayment(7)}
                disabled={paymentSaving || paymentDeferring}
                className="inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-sm font-medium border disabled:opacity-50 transition-colors"
                style={{
                  borderColor: 'var(--aurora-border, #e5e7eb)',
                  color: 'var(--aurora-text-secondary, #6b7280)',
                  backgroundColor: 'var(--aurora-surface, #fff)',
                  minHeight: 44,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {paymentDeferring ? <Loader2 size={14} className="animate-spin" /> : <Clock3 size={14} />}
                Remind me in 7 days
              </button>
              <button
                type="button"
                onClick={() => onDeferPayment(30)}
                disabled={paymentSaving || paymentDeferring}
                className="inline-flex items-center justify-center px-3 rounded-lg text-sm font-medium border disabled:opacity-50 transition-colors"
                style={{
                  borderColor: 'var(--aurora-border, #e5e7eb)',
                  color: 'var(--aurora-text-secondary, #6b7280)',
                  backgroundColor: 'var(--aurora-surface, #fff)',
                  minHeight: 44,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                Remind me in 30 days
              </button>
            </div>
          </div>
          <p className="text-[11px] pt-1" style={{ color: 'var(--aurora-text-muted, #9ca3af)' }}>
            You can set up payment any time from this dashboard — customers can still place orders in the meantime.
          </p>
        </div>
      )}
    </>
  );
}
