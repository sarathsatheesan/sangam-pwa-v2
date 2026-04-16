import React from 'react';
import { ChevronDown, Timer, Clock, BellRing } from 'lucide-react';

interface Reminder {
  id: string;
  type: string;
  message: string;
  orderId: string;
}

interface ReminderAlertsProps {
  reminders: Reminder[];
  onExpand: (orderId: string, sectionKey: string) => void;
  onDismiss?: (reminderId: string) => void;
}

export function ReminderAlerts({ reminders, onExpand }: ReminderAlertsProps) {
  if (reminders.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {reminders.slice(0, 3).map((r) => (
        <button
          key={r.id}
          onClick={() => {
            const sectionKey = r.type === 'event' ? 'active' : r.type;
            onExpand(r.orderId, sectionKey);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-colors hover:opacity-80"
          style={{
            backgroundColor: r.type === 'pending' ? '#FEF3C7' : r.type === 'preparing' ? '#DBEAFE' : '#F3E8FF',
            color: r.type === 'pending' ? '#92400E' : r.type === 'preparing' ? '#1E40AF' : '#6B21A8',
          }}
        >
          {r.type === 'pending' ? <Timer size={14} /> : r.type === 'preparing' ? <Clock size={14} /> : <BellRing size={14} />}
          <span className="font-medium flex-1">{r.message}</span>
          <ChevronDown size={12} />
        </button>
      ))}
      {reminders.length > 3 && (
        <p className="text-[10px] text-center" style={{ color: 'var(--aurora-text-muted)' }}>
          +{reminders.length - 3} more reminders
        </p>
      )}
    </div>
  );
}
