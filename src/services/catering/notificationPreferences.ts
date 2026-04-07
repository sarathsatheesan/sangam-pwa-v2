// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES SERVICE
// CRUD operations for user notification preferences stored in Firestore
// ═══════════════════════════════════════════════════════════════════════

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  type NotificationPreferences,
  type NotificationCategory,
  type NotificationUrgency,
  DEFAULT_NOTIFICATION_PREFERENCES,
  URGENCY_CHANNELS,
} from './notificationTypes';

const PREFS_COL = 'notificationPreferences';

/**
 * Fetch the user's notification preferences.
 * Returns defaults if no preferences document exists.
 */
export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const ref = doc(db, PREFS_COL, userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return { userId, ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  return { userId, ...DEFAULT_NOTIFICATION_PREFERENCES, ...snap.data() } as NotificationPreferences;
}

/**
 * Save or update notification preferences for a user.
 */
export async function saveNotificationPreferences(
  userId: string,
  prefs: Partial<Omit<NotificationPreferences, 'userId'>>,
): Promise<void> {
  const ref = doc(db, PREFS_COL, userId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, { ...prefs, updatedAt: serverTimestamp() });
  } else {
    await setDoc(ref, {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...prefs,
      userId,
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Toggle a specific channel for a specific category.
 */
export async function toggleCategoryChannel(
  userId: string,
  category: NotificationCategory,
  channel: 'in_app' | 'push' | 'email' | 'sms',
  enabled: boolean,
): Promise<void> {
  const ref = doc(db, PREFS_COL, userId);
  await setDoc(ref, {
    [`channels.${category}.${channel}`]: enabled,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Update quiet hours settings.
 */
export async function updateQuietHours(
  userId: string,
  quietHours: NotificationPreferences['quietHours'],
): Promise<void> {
  const ref = doc(db, PREFS_COL, userId);
  await setDoc(ref, {
    quietHours,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Determine which channels should be used for a given notification,
 * respecting the user's preferences and urgency-based waterfall.
 *
 * Returns the list of channels the notification should be sent through.
 */
export function resolveChannels(
  prefs: NotificationPreferences,
  category: NotificationCategory,
  urgency: NotificationUrgency,
): ('in_app' | 'push' | 'email' | 'sms')[] {
  // Start with urgency-based waterfall
  const urgencyChannels = URGENCY_CHANNELS[urgency];

  // Filter by user's global toggles
  const globalEnabled = urgencyChannels.filter((ch) => {
    if (ch === 'email' && !prefs.emailEnabled) return false;
    if (ch === 'sms' && !prefs.smsEnabled) return false;
    if (ch === 'push' && !prefs.pushEnabled) return false;
    return true;
  });

  // Filter by category-specific preferences
  const categoryPrefs = prefs.channels[category];
  if (!categoryPrefs) return globalEnabled;

  return globalEnabled.filter((ch) => categoryPrefs[ch] !== false);
}

/**
 * Check if a notification should be suppressed due to quiet hours.
 * Only suppresses push and SMS (in-app and email still go through).
 */
export function isInQuietHours(prefs: NotificationPreferences): boolean {
  if (!prefs.quietHours.enabled) return false;

  const { start, end, timezone } = prefs.quietHours;

  try {
    // Get current time in user's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const currentTime = currentHour * 60 + currentMinute;

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }

    return currentTime >= startTime && currentTime < endTime;
  } catch {
    return false;
  }
}

/**
 * Get the effective channels for a notification, considering preferences
 * and quiet hours. This is the main function to call before sending.
 */
export function getEffectiveChannels(
  prefs: NotificationPreferences,
  category: NotificationCategory,
  urgency: NotificationUrgency,
): ('in_app' | 'push' | 'email' | 'sms')[] {
  const channels = resolveChannels(prefs, category, urgency);

  if (isInQuietHours(prefs)) {
    // During quiet hours: suppress push and SMS (but not critical)
    if (urgency === 'critical') return channels;
    return channels.filter(ch => ch !== 'push' && ch !== 'sms');
  }

  return channels;
}
