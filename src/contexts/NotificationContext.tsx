// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION CONTEXT — Global notification state + real-time subscriptions
// Provides unread count, notification list, and actions to all components
// ═══════════════════════════════════════════════════════════════════════

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  subscribeToCateringNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type CateringNotification,
} from '../services/catering/cateringNotifications';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from '../services/catering/notificationPreferences';
import type { NotificationPreferences } from '../services/catering/notificationTypes';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../services/catering/notificationTypes';

// ─── Context Shape ──────────────────────────────────────────────────

interface NotificationContextValue {
  // Notification state
  notifications: CateringNotification[];
  unreadCount: number;
  isLoading: boolean;

  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearNotification: (notificationId: string) => void;

  // Bell state
  isBellOpen: boolean;
  toggleBell: () => void;
  closeBell: () => void;

  // Preferences
  preferences: NotificationPreferences | null;
  updatePreferences: (prefs: Partial<Omit<NotificationPreferences, 'userId'>>) => Promise<void>;

  // Request push permission
  requestPushPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────

interface NotificationProviderProps {
  userId: string | null;
  children: ReactNode;
}

export function NotificationProvider({ userId, children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<CateringNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    unsubRef.current = subscribeToCateringNotifications(userId, (notifs) => {
      setNotifications(notifs);
      setIsLoading(false);
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [userId]);

  // Load preferences
  useEffect(() => {
    if (!userId) {
      setPreferences(null);
      return;
    }

    getNotificationPreferences(userId).then(setPreferences).catch(console.error);
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    try {
      await markAllNotificationsRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [userId]);

  const clearNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const toggleBell = useCallback(() => setIsBellOpen((prev) => !prev), []);
  const closeBell = useCallback(() => setIsBellOpen(false), []);

  const updatePreferences = useCallback(
    async (prefs: Partial<Omit<NotificationPreferences, 'userId'>>) => {
      if (!userId) return;
      try {
        await saveNotificationPreferences(userId, prefs);
        setPreferences((prev) =>
          prev ? { ...prev, ...prefs } : { userId, ...DEFAULT_NOTIFICATION_PREFERENCES, ...prefs },
        );
      } catch (err) {
        console.error('Failed to update notification preferences:', err);
      }
    },
    [userId],
  );

  const requestPushPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!('Notification' in window)) return false;
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }, []);

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllRead,
    clearNotification,
    isBellOpen,
    toggleBell,
    closeBell,
    preferences,
    updatePreferences,
    requestPushPermission,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
