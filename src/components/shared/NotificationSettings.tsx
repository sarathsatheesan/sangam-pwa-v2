// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION SETTINGS — Preference center for notification channels,
// categories, and quiet hours. Accessible at /notifications/settings
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Moon,
  Clock,
  Globe,
  Save,
  Check,
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import type { NotificationCategory, NotificationPreferences } from '../../services/catering/notificationTypes';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../../services/catering/notificationTypes';

// ─── Category Metadata ──────────────────────────────────────────────

const CATEGORIES: {
  key: NotificationCategory;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'order_lifecycle',
    label: 'Order Updates',
    description: 'New orders, status changes, delivery updates',
    icon: <Bell size={18} />,
  },
  {
    key: 'order_modifications',
    label: 'Order Modifications',
    description: 'Vendor modifications, approvals, rejections',
    icon: <MessageSquare size={18} />,
  },
  {
    key: 'rfp_quotes',
    label: 'Quotes & Requests',
    description: 'Quote submissions, acceptances, RFP updates',
    icon: <Mail size={18} />,
  },
  {
    key: 'payments',
    label: 'Payments',
    description: 'Payment confirmations, failures, refunds',
    icon: <Smartphone size={18} />,
  },
  {
    key: 'messaging',
    label: 'Messages',
    description: 'Chat messages from vendors and customers',
    icon: <MessageSquare size={18} />,
  },
];

const CHANNELS = [
  { key: 'in_app' as const, label: 'In-App', icon: <Bell size={14} /> },
  { key: 'push' as const, label: 'Push', icon: <Smartphone size={14} /> },
  { key: 'email' as const, label: 'Email', icon: <Mail size={14} /> },
  { key: 'sms' as const, label: 'SMS', icon: <MessageSquare size={14} /> },
];

const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Anchorage',
  'Pacific/Honolulu',
];

// ─── Toggle Switch ──────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: '40px',
        height: '22px',
        borderRadius: '11px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: checked ? '#6366F1' : '#D1D5DB',
        transition: 'background-color 0.2s',
        padding: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '20px' : '2px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}

// ─── Component ──────────────────────────────────────────────────────

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { preferences, updatePreferences, requestPushPermission } = useNotifications();
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs({ ...preferences });
    }
  }, [preferences]);

  const handleCategoryToggle = useCallback(
    (category: NotificationCategory, channel: 'in_app' | 'push' | 'email' | 'sms', value: boolean) => {
      setLocalPrefs((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          channels: {
            ...prev.channels,
            [category]: {
              ...prev.channels[category],
              [channel]: value,
            },
          },
        };
      });
      setSaved(false);
    },
    [],
  );

  const handleGlobalToggle = useCallback(
    (key: 'emailEnabled' | 'smsEnabled' | 'pushEnabled', value: boolean) => {
      setLocalPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
      setSaved(false);
    },
    [],
  );

  const handleQuietHoursToggle = useCallback((enabled: boolean) => {
    setLocalPrefs((prev) => {
      if (!prev) return prev;
      return { ...prev, quietHours: { ...prev.quietHours, enabled } };
    });
    setSaved(false);
  }, []);

  const handleQuietHoursChange = useCallback(
    (field: 'start' | 'end' | 'timezone', value: string) => {
      setLocalPrefs((prev) => {
        if (!prev) return prev;
        return { ...prev, quietHours: { ...prev.quietHours, [field]: value } };
      });
      setSaved(false);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!localPrefs) return;
    setIsSaving(true);
    try {
      const { userId, ...rest } = localPrefs;
      await updatePreferences(rest);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setIsSaving(false);
    }
  }, [localPrefs, updatePreferences]);

  const handleEnablePush = useCallback(async () => {
    const granted = await requestPushPermission();
    if (granted) {
      handleGlobalToggle('pushEnabled', true);
    }
  }, [requestPushPermission, handleGlobalToggle]);

  if (!localPrefs) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
        Loading preferences...
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '16px',
        minHeight: '100vh',
        backgroundColor: '#FAFBFC',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex' }}
          >
            <ArrowLeft size={20} color="#374151" />
          </button>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#111827' }}>
            Notification Settings
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            backgroundColor: saved ? '#10B981' : '#6366F1',
            color: '#fff',
            transition: 'background-color 0.2s',
          }}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Global Channel Toggles */}
      <section
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          padding: '20px',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600, color: '#111827' }}>
          Notification Channels
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#9CA3AF' }}>
          Enable or disable entire notification channels
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Smartphone size={16} color="#6B7280" />
              <div>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>Push Notifications</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>Browser & mobile push alerts</p>
              </div>
            </div>
            <Toggle checked={localPrefs.pushEnabled} onChange={(v) => handleGlobalToggle('pushEnabled', v)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mail size={16} color="#6B7280" />
              <div>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>Email</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>Detailed email updates via SendGrid</p>
              </div>
            </div>
            <Toggle checked={localPrefs.emailEnabled} onChange={(v) => handleGlobalToggle('emailEnabled', v)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={16} color="#6B7280" />
              <div>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>SMS / Text</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>Short text message alerts via Twilio</p>
              </div>
            </div>
            <Toggle checked={localPrefs.smsEnabled} onChange={(v) => handleGlobalToggle('smsEnabled', v)} />
          </div>
        </div>
      </section>

      {/* Category-Level Preferences */}
      <section
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          padding: '20px',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600, color: '#111827' }}>
          Category Preferences
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#9CA3AF' }}>
          Fine-tune which channels are used for each notification category
        </p>

        {CATEGORIES.map((cat, catIdx) => (
          <div key={cat.key}>
            {catIdx > 0 && <hr style={{ border: 'none', borderTop: '1px solid #F3F4F6', margin: '16px 0' }} />}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ color: '#6B7280' }}>{cat.icon}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{cat.label}</span>
              </div>
              <p style={{ margin: '0 0 10px 26px', fontSize: '12px', color: '#9CA3AF' }}>
                {cat.description}
              </p>
              <div style={{ display: 'flex', gap: '8px', marginLeft: '26px', flexWrap: 'wrap' }}>
                {CHANNELS.map((ch) => {
                  const isOn = localPrefs.channels[cat.key]?.[ch.key] ?? true;
                  const isGlobalOff =
                    (ch.key === 'email' && !localPrefs.emailEnabled) ||
                    (ch.key === 'sms' && !localPrefs.smsEnabled) ||
                    (ch.key === 'push' && !localPrefs.pushEnabled);

                  return (
                    <button
                      key={ch.key}
                      onClick={() => handleCategoryToggle(cat.key, ch.key, !isOn)}
                      disabled={isGlobalOff}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        borderRadius: '16px',
                        border: `1px solid ${isGlobalOff ? '#E5E7EB' : isOn ? '#C7D2FE' : '#E5E7EB'}`,
                        backgroundColor: isGlobalOff ? '#F9FAFB' : isOn ? '#EEF2FF' : '#fff',
                        color: isGlobalOff ? '#D1D5DB' : isOn ? '#6366F1' : '#9CA3AF',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: isGlobalOff ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                        opacity: isGlobalOff ? 0.5 : 1,
                      }}
                    >
                      {ch.icon}
                      {ch.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Quiet Hours */}
      <section
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          padding: '20px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Moon size={18} color="#6B7280" />
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827' }}>
              Quiet Hours
            </h2>
          </div>
          <Toggle checked={localPrefs.quietHours.enabled} onChange={handleQuietHoursToggle} />
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#9CA3AF' }}>
          Suppress push and SMS notifications during specified hours. In-app and email are unaffected.
          Critical alerts (payment failures, cancellations) always come through.
        </p>

        {localPrefs.quietHours.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                  <Clock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Start
                </label>
                <input
                  type="time"
                  value={localPrefs.quietHours.start}
                  onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                  onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    fontSize: '14px',
                    color: '#111827',
                    appearance: 'auto' as const,
                  }}
                />
              </div>
              <span style={{ marginTop: '20px', color: '#9CA3AF' }}>to</span>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                  <Clock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  End
                </label>
                <input
                  type="time"
                  value={localPrefs.quietHours.end}
                  onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                  onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch {} }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    fontSize: '14px',
                    color: '#111827',
                    appearance: 'auto' as const,
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                <Globe size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Timezone
              </label>
              <select
                value={localPrefs.quietHours.timezone}
                onChange={(e) => handleQuietHoursChange('timezone', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '14px',
                  color: '#111827',
                  backgroundColor: '#fff',
                }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {/* Info */}
      <div
        style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: '#EEF2FF',
          border: '1px solid #C7D2FE',
          fontSize: '13px',
          color: '#4338CA',
          lineHeight: 1.5,
          marginBottom: '32px',
        }}
      >
        <strong>Note:</strong> Critical notifications (payment failures, order cancellations) are always
        delivered through all channels regardless of your preferences.
      </div>
    </div>
  );
}
