import React from 'react';
import { useToast } from '@/contexts/ToastContext';

interface OnboardingPillsProps {
  hasPaymentInfo: boolean;
  onOpenPaymentSettings: () => void;
  onSwitchVendorTab?: (tab: 'menu') => void;
}

export function OnboardingPills({
  hasPaymentInfo,
  onOpenPaymentSettings,
  onSwitchVendorTab,
}: OnboardingPillsProps) {
  const { addToast } = useToast();

  return (
    <div className="text-left space-y-3 mb-5">
      <button
        type="button"
        onClick={onOpenPaymentSettings}
        aria-label="Set up payment info (optional)"
        className="group w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2"
        style={{
          borderColor: 'rgba(99, 102, 241, 0.22)',
          backgroundColor: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(10px) saturate(140%)',
          WebkitBackdropFilter: 'blur(10px) saturate(140%)',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
          WebkitTapHighlightColor: 'transparent',
          WebkitAppearance: 'none',
          appearance: 'none',
          minHeight: 44,
          '--tw-ring-color': 'var(--aurora-accent)',
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = 'rgba(99, 102, 241, 0.55)';
          el.style.backgroundColor = 'rgba(255, 255, 255, 0.72)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = 'rgba(99, 102, 241, 0.22)';
          el.style.backgroundColor = 'rgba(255, 255, 255, 0.55)';
        }}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: 'var(--aurora-accent)', boxShadow: '0 2px 6px rgba(99, 102, 241, 0.35)' }}
        >
          1
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium flex items-center justify-between gap-2"
            style={{ color: 'var(--aurora-text, #1a1a2e)' }}
          >
            <span>
              Set up payment info <span className="text-[10px] font-normal" style={{ color: 'var(--aurora-text-muted, #6b7280)' }}>
                (optional)
              </span>
            </span>
            <span
              className="text-[11px] font-semibold shrink-0"
              style={{ color: 'var(--aurora-accent)' }}
              aria-hidden="true"
            >
              Open →
            </span>
          </p>
          <p className="text-xs" style={{ color: 'var(--aurora-text-muted, #6b7280)' }}>
            Add your payment link so customers can pay you — you can skip and add this later
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => {
          if (onSwitchVendorTab) onSwitchVendorTab('menu');
          else addToast('Open the Menu tab to add items', 'info');
        }}
        aria-label="Add menu items — opens the Menu tab"
        className="group w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2"
        style={{
          borderColor: 'rgba(139, 92, 246, 0.22)',
          backgroundColor: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(10px) saturate(140%)',
          WebkitBackdropFilter: 'blur(10px) saturate(140%)',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
          WebkitTapHighlightColor: 'transparent',
          WebkitAppearance: 'none',
          appearance: 'none',
          minHeight: 44,
          '--tw-ring-color': '#8B5CF6',
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = 'rgba(139, 92, 246, 0.55)';
          el.style.backgroundColor = 'rgba(255, 255, 255, 0.72)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = 'rgba(139, 92, 246, 0.22)';
          el.style.backgroundColor = 'rgba(255, 255, 255, 0.55)';
        }}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: '#8B5CF6', boxShadow: '0 2px 6px rgba(139, 92, 246, 0.35)' }}
        >
          2
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium flex items-center justify-between gap-2"
            style={{ color: 'var(--aurora-text, #1a1a2e)' }}
          >
            <span>Add menu items</span>
            <span
              className="text-[11px] font-semibold shrink-0"
              style={{ color: '#8B5CF6' }}
              aria-hidden="true"
            >
              Open →
            </span>
          </p>
          <p className="text-xs" style={{ color: 'var(--aurora-text-muted, #6b7280)' }}>
            Create your catering menu so customers can browse
          </p>
        </div>
      </button>

      <div
        className="flex items-start gap-3 p-3 rounded-xl border"
        style={{
          borderColor: 'rgba(16, 185, 129, 0.22)',
          backgroundColor: 'rgba(236, 253, 245, 0.55)',
          backdropFilter: 'blur(10px) saturate(140%)',
          WebkitBackdropFilter: 'blur(10px) saturate(140%)',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        }}
        aria-label="Your first order will appear here — informational"
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: '#10B981', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.35)' }}
        >
          3
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium flex items-center gap-2" style={{ color: '#065F46' }}>
            <span>Your first order will appear here</span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#047857' }}
              aria-hidden="true"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10B981' }} />
              Waiting
            </span>
          </p>
          <p className="text-xs" style={{ color: '#047857' }}>
            You&apos;ll get an alert with a chime when a new order comes in
          </p>
        </div>
      </div>
    </div>
  );
}
