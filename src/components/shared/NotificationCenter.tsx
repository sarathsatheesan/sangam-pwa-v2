// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION CENTER — Full-page notification history with filtering
// Accessible at /notifications route
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Settings,
  Filter,
  ArrowLeft,
  Package,
  FileText,
  CreditCard,
  MessageSquare,
  Edit3,
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import type { CateringNotification } from '../../services/catering/cateringNotifications';

// ─── Filter Tabs ────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'orders' | 'quotes' | 'other';

const FILTER_TABS: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All', icon: <Bell size={14} /> },
  { key: 'unread', label: 'Unread', icon: <Filter size={14} /> },
  { key: 'orders', label: 'Orders', icon: <Package size={14} /> },
  { key: 'quotes', label: 'Quotes', icon: <FileText size={14} /> },
  { key: 'other', label: 'Other', icon: <MessageSquare size={14} /> },
];

const ORDER_TYPES = new Set([
  'new_order', 'order_confirmed', 'order_preparing', 'order_ready',
  'order_out_for_delivery', 'order_delivered', 'order_cancelled',
  'order_modified', 'modification_rejected',
]);
const QUOTE_TYPES = new Set([
  'quote_received', 'quote_accepted', 'item_reassigned',
  'rfp_edited', 'rfp_expired', 'finalization_expired',
]);

// ─── Notification Icon ──────────────────────────────────────────────

function getNotifIcon(type: CateringNotification['type']): string {
  const icons: Record<string, string> = {
    new_order: '\uD83D\uDCE6', order_confirmed: '\u2705',
    order_preparing: '\uD83D\uDC68\u200D\uD83C\uDF73', order_ready: '\uD83C\uDF7D\uFE0F',
    order_out_for_delivery: '\uD83D\uDE9A', order_delivered: '\uD83C\uDF89',
    order_cancelled: '\u274C', order_modified: '\u270F\uFE0F',
    modification_rejected: '\uD83D\uDEAB', quote_received: '\uD83D\uDCCB',
    quote_accepted: '\uD83E\uDD1D', item_reassigned: '\uD83D\uDD04',
    rfp_edited: '\uD83D\uDCDD', rfp_expired: '\u23F0',
    finalization_expired: '\u26A0\uFE0F',
  };
  return icons[type] || '\uD83D\uDD14';
}

function formatTime(createdAt: any): string {
  if (!createdAt) return '';
  const ms = createdAt?.toMillis?.() || createdAt?.seconds * 1000 || 0;
  if (!ms) return '';

  const date = new Date(ms);
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Component ──────────────────────────────────────────────────────

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return notifications.filter((n) => !n.read);
      case 'orders':
        return notifications.filter((n) => ORDER_TYPES.has(n.type));
      case 'quotes':
        return notifications.filter((n) => QUOTE_TYPES.has(n.type));
      case 'other':
        return notifications.filter((n) => !ORDER_TYPES.has(n.type) && !QUOTE_TYPES.has(n.type));
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { label: string; items: CateringNotification[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayItems: CateringNotification[] = [];
    const yesterdayItems: CateringNotification[] = [];
    const olderItems: CateringNotification[] = [];

    for (const n of filteredNotifications) {
      const ms = n.createdAt?.toMillis?.() || n.createdAt?.seconds * 1000 || 0;
      if (!ms) { olderItems.push(n); continue; }
      const date = new Date(ms);
      date.setHours(0, 0, 0, 0);
      if (date.getTime() === today.getTime()) todayItems.push(n);
      else if (date.getTime() === yesterday.getTime()) yesterdayItems.push(n);
      else olderItems.push(n);
    }

    if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
    if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', items: yesterdayItems });
    if (olderItems.length > 0) groups.push({ label: 'Earlier', items: olderItems });

    return groups;
  }, [filteredNotifications]);

  const handleNotifClick = useCallback(
    async (notif: CateringNotification) => {
      if (!notif.read) await markAsRead(notif.id);
      if (notif.orderId) navigate(`/catering/orders/${notif.orderId}`);
      else if (notif.quoteRequestId) navigate(`/catering/quotes/${notif.quoteRequestId}`);
    },
    [markAsRead, navigate],
  );

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
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
            }}
          >
            <ArrowLeft size={20} color="#374151" />
          </button>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#111827' }}>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span
              style={{
                backgroundColor: '#EEF2FF',
                color: '#6366F1',
                fontSize: '12px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '10px',
              }}
            >
              {unreadCount} new
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background: '#EEF2FF',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
          <button
            onClick={() => navigate('/notifications/settings')}
            style={{
              background: '#F3F4F6',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
            }}
          >
            <Settings size={18} color="#6B7280" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '16px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              backgroundColor: activeFilter === tab.key ? '#6366F1' : '#F3F4F6',
              color: activeFilter === tab.key ? '#fff' : '#6B7280',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.key === 'unread' && unreadCount > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: activeFilter === tab.key ? 'rgba(255,255,255,0.2)' : '#E5E7EB',
                  padding: '1px 6px',
                  borderRadius: '8px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification Groups */}
      {grouped.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#9CA3AF',
          }}
        >
          <Bell size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 4px' }}>
            {activeFilter === 'unread' ? 'All caught up!' : 'No notifications'}
          </p>
          <p style={{ fontSize: '13px', margin: 0 }}>
            {activeFilter === 'unread'
              ? 'You\'ve read all your notifications'
              : 'Notifications will appear here as they come in'}
          </p>
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.label} style={{ marginBottom: '20px' }}>
            <h3
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: '0 0 8px 4px',
              }}
            >
              {group.label}
            </h3>
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid #E5E7EB',
              }}
            >
              {group.items.map((notif, idx) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: notif.read ? '#fff' : '#FAFBFF',
                    border: 'none',
                    borderBottom: idx < group.items.length - 1 ? '1px solid #F3F4F6' : 'none',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = notif.read ? '#F9FAFB' : '#F0F3FF')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = notif.read ? '#fff' : '#FAFBFF')
                  }
                >
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>
                    {getNotifIcon(notif.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: notif.read ? 500 : 600, color: '#111827' }}>
                        {notif.title}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#6B7280', lineHeight: 1.4 }}>
                      {notif.body}
                    </p>
                    {notif.businessName && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: '6px',
                          fontSize: '11px',
                          color: '#6366F1',
                          backgroundColor: '#EEF2FF',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: 500,
                        }}
                      >
                        {notif.businessName}
                      </span>
                    )}
                  </div>
                  {!notif.read && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#6366F1',
                        flexShrink: 0,
                        marginTop: '8px',
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
