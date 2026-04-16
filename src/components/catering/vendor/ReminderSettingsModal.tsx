import React from 'react';
import { X } from 'lucide-react';

interface ReminderSettings {
  pendingAlert: boolean;
  preparingReminder: boolean;
  eventDayReminder: boolean;
  reminderLeadHours: number;
}

interface ReminderSettingsModalProps {
  isOpen: boolean;
  reminderSettings: ReminderSettings;
  onSaveSettings: (settings: ReminderSettings) => void;
  onClose: () => void;
}

export function ReminderSettingsModal({
  isOpen,
  reminderSettings,
  onSaveSettings,
  onClose,
}: ReminderSettingsModalProps) {
  if (!isOpen) return null;

  const handleSettingChange = (key: keyof ReminderSettings, value: boolean | number) => {
    onSaveSettings({ ...reminderSettings, [key]: value });
  };

  return (
    <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.03)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: '#8B5CF6' }}>
          Reminder Settings
        </p>
        <button
          onClick={onClose}
          className="p-1"
          aria-label="Close reminder settings"
        >
          <X size={14} style={{ color: 'var(--aurora-text-muted)' }} />
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
        Configure when you receive order reminders and alerts.
      </p>
      <label className="flex items-center justify-between gap-3 py-2">
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
            Pending order alerts
          </span>
          <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
            Alert when an order sits pending for 30+ minutes
          </p>
        </div>
        <input
          type="checkbox"
          checked={reminderSettings.pendingAlert}
          onChange={(e) => handleSettingChange('pendingAlert', e.target.checked)}
          className="accent-purple-600 w-4 h-4"
        />
      </label>
      <label className="flex items-center justify-between gap-3 py-2">
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
            Preparing too long
          </span>
          <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
            Remind when an order has been preparing for 2+ hours
          </p>
        </div>
        <input
          type="checkbox"
          checked={reminderSettings.preparingReminder}
          onChange={(e) => handleSettingChange('preparingReminder', e.target.checked)}
          className="accent-purple-600 w-4 h-4"
        />
      </label>
      <label className="flex items-center justify-between gap-3 py-2">
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
            Event day reminder
          </span>
          <p className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
            Remind when an event date is approaching
          </p>
        </div>
        <input
          type="checkbox"
          checked={reminderSettings.eventDayReminder}
          onChange={(e) => handleSettingChange('eventDayReminder', e.target.checked)}
          className="accent-purple-600 w-4 h-4"
        />
      </label>
      {reminderSettings.eventDayReminder && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
            Remind
          </label>
          <select
            value={reminderSettings.reminderLeadHours}
            onChange={(e) => handleSettingChange('reminderLeadHours', Number(e.target.value))}
            className="rounded-lg border px-2 py-1.5 text-xs outline-none"
            style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
          >
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
          </select>
          <span className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            before the event
          </span>
        </div>
      )}
    </div>
  );
}
