import React from 'react';
import { Bell } from 'lucide-react';
import type { CateringNotification } from '@/services/cateringService';
import { markNotificationRead, markAllNotificationsRead } from '@/services/cateringService';

interface VendorNotificationPanelProps {
  notifications: CateringNotification[];
  showPanel: boolean;
  onToggle: (show: boolean) => void;
  onNotificationClick: (notification: CateringNotification) => void;
  userId?: string;
}

export function VendorNotificationPanel({
  notifications,
  showPanel,
  onToggle,
  onNotificationClick,
  userId,
}: VendorNotificationPanelProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onToggle(!showPanel)}
        className="relative inline-flex items-center justify-center rounded-lg transition-colors"
        style={{
          color: 'var(--aurora-text-secondary, #6b7280)',
          width: 32,
          height: 32,
          WebkitTapHighlightColor: 'transparent',
          WebkitAppearance: 'none',
          appearance: 'none',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ top: 2, right: 2, width: 14, height: 14, backgroundColor: '#EF4444' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {showPanel && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border shadow-lg z-50"
          style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}
        >
          <div
            className="p-3 border-b flex items-center justify-between sticky top-0"
            style={{ borderColor: 'var(--aurora-border)', backgroundColor: 'var(--aurora-surface)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  if (!userId) return;
                  markAllNotificationsRead(userId).catch(console.warn);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{ color: 'var(--aurora-text-muted)' }}>
              No notifications yet
            </div>
          ) : (
            notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  // Mark this notification as read
                  if (!n.read) {
                    markNotificationRead(n.id).catch(console.warn);
                  }
                  onToggle(false);
                  onNotificationClick(n);
                }}
                className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-indigo-50/50' : ''}`}
              >
                <div className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
                  {n.title}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
                  {n.body}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
