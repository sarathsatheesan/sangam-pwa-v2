import React from 'react';
import { Bell, X } from 'lucide-react';
import { formatPrice } from '@/services/cateringService';

interface NewOrderBannerProps {
  banner: {
    orderId: string;
    customerName: string;
    total: number;
  } | null;
  onDismiss: () => void;
  onView: (orderId: string) => void;
}

export function NewOrderBanner({ banner, onDismiss, onView }: NewOrderBannerProps) {
  if (!banner) return null;

  return (
    <div
      className="flex items-center justify-between p-3 rounded-xl border animate-pulse"
      style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F59E0B' }}>
          <Bell size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#92400E' }}>
            New order from {banner.customerName}
          </p>
          <p className="text-xs" style={{ color: '#A16207' }}>
            {formatPrice(banner.total)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onView(banner.orderId)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
          style={{ backgroundColor: '#F59E0B' }}
        >
          View Order
        </button>
        <button
          onClick={onDismiss}
          className="p-2.5 rounded hover:bg-amber-200 transition-colors"
          style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Dismiss"
        >
          <X size={16} style={{ color: '#92400E' }} />
        </button>
      </div>
    </div>
  );
}
