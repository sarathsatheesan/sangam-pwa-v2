// ═══════════════════════════════════════════════════════════════════════
// CATERING UTILITIES — Shared helpers to eliminate duplication
// ═══════════════════════════════════════════════════════════════════════

/**
 * Safely extract epoch milliseconds from a Firestore Timestamp, epoch number, Date, or ISO string.
 * Returns 0 when the value is unrecognisable — callers treat 0 as "no timestamp".
 *
 * Handles all Firestore Timestamp variants:
 *   - Firestore Timestamp with .toMillis() method
 *   - Plain object with { seconds, nanoseconds } (from Firestore REST / serialized)
 *   - JavaScript Date
 *   - Epoch number (milliseconds)
 *   - ISO-8601 string (Android WebView sometimes serialises dates this way)
 */
export function toEpochMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Convert a Firestore Timestamp (or similar) to a JavaScript Date.
 * Returns `new Date(0)` for unrecognised values.
 */
export function toDate(ts: any): Date {
  const ms = toEpochMs(ts);
  return ms > 0 ? new Date(ms) : new Date(0);
}

/**
 * Format cents (integer) to a dollar string: 1500 → "$15.00"
 * Re-exported from cateringOrders for convenience; this is the canonical version.
 */
export function formatCents(amount: number): string {
  return `$${(amount / 100).toFixed(2)}`;
}
