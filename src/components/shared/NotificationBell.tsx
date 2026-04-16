// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION BELL — Header icon with unread badge + dropdown panel
// Works for both customers and vendors across web and mobile viewports
// ═══════════════════════════════════════════════════════════════════════

import React, { useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Settings, ExternalLink } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import type { CateringNotification } from '../../services/catering/cateringNotifications';

// ─── Notification Icon Mapping ──────────────────────────────────────

function getNotificationIcon(type: CateringNotification['type']): string {
  const icons: Record<string, string> = {
    new_order: '\uD83D\uDCE6',
    order_confirmed: '\u2705',
    order_preparing: '\uD83D\uDC68\u200D\uD83C\uDF73',
    order_ready: '\uD83C\uDF7D\uFE0F',
    order_out_for_delivery: '\uD83D\uDE9A',
    order_delivered: '\uD83C\uDF89',
    order_cancelled: '\u274C',
    order_modified: '\u270F\uFE0F',
    modification_rejected: '\uD83D\uDEAB',
    quote_received: '\uD83D\uDCCB',
    quote_accepted: '\uD83E\uDD1D',
    item_reassigned: '\uD83D\uDD04',
    rfp_edited: '\uD83D\uDCDD',
    rfp_expired: '\u23F0',
    finalization_expired: '\u26A0\uFE0F',
  };
  return icons[type] || '\uD83D\uDD14';
}

function formatTimestamp(createdAt: any): string {
  if (!createdAt) return '';
  const ms = createdAt?.toMillis?.() || createdAt?.seconds * 1000 || 0;
  if (!ms) return '';

  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

// ─── Component ──────────────────────────────────────────────────────

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isBellOpen,
    toggleBell,
    closeBell,
    markAsRead,
    markAllRead,
  } = useNotifications();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeBell();
      }
    }
    if (isBellOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isBellOpen, closeBell]);

  // Close on escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') closeBell();
    }
    if (isBellOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isBellOpen, closeBell]);

  // Fallback set for notifications created before the `role` field was added.
  // New notifications always carry role='vendor'|'customer' directly.
  const VENDOR_TYPE_FALLBACK = new Set([
    'new_order', 'modification_rejected', 'quote_accepted',
    'item_reassigned', 'rfp_edited', 'reprice_requested',
  ]);

  const handleNotificationClick = useCallback(
    async (notif: CateringNotification) => {
      if (!notif.read) {
        await markAsRead(notif.id);
      }
      closeBell();

      // Prefer the explicit `role` field; fall back to type-based inference
      // for older notifications that predate the role field.
      // Special case: `order_cancelled` and `reprice_resolved` are sent to
      // both parties with the same type, so VENDOR_TYPE_FALLBACK can't handle
      // them. For legacy notifications without `role`, infer from body text —
      // vendor recipients get "The customer …" while customer recipients get
      // "{businessName} …".
      const BOTH_PARTY_TYPES = new Set(['order_cancelled', 'reprice_resolved']);
      const isVendor = notif.role
        ? notif.role === 'vendor'
        : BOTH_PARTY_TYPES.has(notif.type)
          ? notif.body?.startsWith('The customer')
          : VENDOR_TYPE_FALLBACK.has(notif.type);

      // Deep-link: navigate to /catering with query params that the catering
      // page reads to auto-switch view and expand the correct order/quote.
      // CateringOrderStatus reads #order-{id} from hash to auto-expand.
      if (notif.orderId) {
        const prefix = isVendor ? 'vendorView' : 'view';
        navigate(`/catering?${prefix}=orders&orderId=${notif.orderId}`);
      } else if (notif.quoteRequestId) {
        if (isVendor) {
          // Vendor quote notifications → vendor dashboard quotes tab
          navigate('/catering?vendorView=quotes');
        } else {
          // Customer quote notifications → customer My Quotes with auto-select
          navigate(`/catering?view=quotes&quoteRequestId=${notif.quoteRequestId}`);
        }
      }
    },
    [markAsRead, closeBell, navigate],
  );

  const recentNotifications = notifications.slice(0, 8);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Bell Button */}
      <button
        onClick={toggleBell}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isBellOpen}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '50%',
          transition: 'background-color 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <Bell size={22} strokeWidth={2} color="#374151" />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              backgroundColor: '#EF4444',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
              border: '2px solid #fff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isBellOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '380px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: '480px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #E5E7EB',
            overflow: 'hidden',
            zIndex: 9999,
            animation: 'notifSlideIn 0.2s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid #F3F4F6',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
              Notifications
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#6366F1',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EEF2FF')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => {
                  closeBell();
                  navigate('/notifications/settings');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Notification settings"
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Settings size={16} color="#6B7280" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{ overflowY: 'auto', maxHeight: '380px' }}>
            {recentNotifications.length === 0 ? (
              <div
                style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  color: '#9CA3AF',
                }}
              >
                <Bell size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '14px' }}>No notifications yet</p>
              </div>
            ) : (
              recentNotifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: notif.read ? '#fff' : '#F0F5FF',
                    border: 'none',
                    borderBottom: '1px solid #F3F4F6',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = notif.read ? '#F9FAFB' : '#E8EFFE')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = notif.read ? '#fff' : '#F0F5FF')
                  }
                >
                  {/* Icon */}
                  <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0, marginTop: '2px' }}>
                    {getNotificationIcon(notif.type)}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: notif.read ? 500 : 600,
                          color: '#111827',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {notif.title}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#9CA3AF',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatTimestamp(notif.createdAt)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: '12px',
                        color: '#6B7280',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {notif.body}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#6366F1',
                        flexShrink: 0,
                        marginTop: '6px',
                      }}
                    />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 8 && (
            <div
              style={{
                padding: '10px 16px',
                borderTop: '1px solid #F3F4F6',
                textAlign: 'center',
              }}
            >
              <button
                onClick={() => {
                  closeBell();
                  navigate('/notifications');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#6366F1',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EEF2FF')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                View all notifications
                <ExternalLink size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Animation keyframes */}
      <style>{`
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
