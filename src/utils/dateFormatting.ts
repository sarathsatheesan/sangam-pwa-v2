import { Timestamp } from 'firebase/firestore';

/**
 * Safely convert any Firestore timestamp-like value to a Date.
 * Handles: Firestore Timestamp, {seconds} object, Date, string, number.
 */
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Relative time string (e.g., "2h ago", "3d ago", "Just now").
 */
export function timeAgo(ts: any, fallback = ''): string {
  const date = toDate(ts);
  if (!date) return fallback;
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

/**
 * Format a Firestore timestamp to a locale date string.
 * E.g., "Jan 15, 2026" or "Jan 15, 2026, 3:42 PM" with includeTime.
 */
export function formatTimestamp(ts: any, options?: { includeTime?: boolean; fallback?: string }): string {
  const date = toDate(ts);
  if (!date) return options?.fallback || '';
  const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  if (options?.includeTime) {
    dateOpts.hour = 'numeric';
    dateOpts.minute = '2-digit';
  }
  return date.toLocaleDateString('en-US', dateOpts);
}

/**
 * Format a date string or timestamp to short display.
 * E.g., "Mon, Jan 15"
 */
export function formatDate(ts: any, fallback = ''): string {
  const date = toDate(ts);
  if (!date) return fallback;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
