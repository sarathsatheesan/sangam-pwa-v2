import React from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface BatchActionBarProps {
  batchMode: boolean;
  selectedOrders: Set<string>;
  onConfirmAll: () => Promise<void>;
  onDeclineAll: () => void;
  loading: boolean;
}

export function BatchActionBar({
  batchMode,
  selectedOrders,
  onConfirmAll,
  onDeclineAll,
  loading,
}: BatchActionBarProps) {
  if (!batchMode || selectedOrders.size === 0) return null;

  return (
    <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'rgba(99,102,241,0.06)' }}>
      <span className="text-sm font-medium" style={{ color: 'var(--aurora-accent)' }}>
        {selectedOrders.size} order(s) selected
      </span>
      <div className="flex gap-2">
        <button
          onClick={onConfirmAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: '#10B981' }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          Accept All
        </button>
        <button
          onClick={onDeclineAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: '#EF4444' }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
          Decline All
        </button>
      </div>
    </div>
  );
}
