// ═══════════════════════════════════════════════════════════════════════
// TIMEZONE EDGE CASE TESTS
// DST transitions, month/year boundaries, and delivery ETA validation
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { validateDeliveryETA, validateTimeEta } from '../cateringOrders';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Timezone Edge Cases: validateDeliveryETA', () => {
  describe('Basic future/past validation', () => {
    it('should accept a valid future ETA', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const futureEta = new Date('2026-06-16T10:00:00Z');
      const result = validateDeliveryETA(futureEta);
      expect(result.valid).toBe(true);
    });

    it('should reject an ETA in the past', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const pastEta = new Date('2026-06-15T10:00:00Z');
      const result = validateDeliveryETA(pastEta);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('should reject ETA at exactly now (not strictly future)', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const nowEta = new Date('2026-06-15T12:00:00Z');
      const result = validateDeliveryETA(nowEta);
      expect(result.valid).toBe(false);
    });

    it('should accept ISO string format ETA', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const result = validateDeliveryETA('2026-06-16T10:00:00Z');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = validateDeliveryETA('not-a-date');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should reject empty string', () => {
      const result = validateDeliveryETA('');
      expect(result.valid).toBe(false);
    });
  });

  describe('Event date constraint', () => {
    it('should accept ETA before event date (string format)', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const eta = new Date('2026-06-16T10:00:00Z');
      const eventDate = '2026-06-18';
      const result = validateDeliveryETA(eta, eventDate);
      expect(result.valid).toBe(true);
    });

    it('should reject ETA after event date (string format)', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const eta = new Date('2026-06-20T10:00:00Z');
      const eventDate = '2026-06-18';
      const result = validateDeliveryETA(eta, eventDate);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('after');
    });

    it('should accept ETA on event date (before end-of-day)', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const eta = new Date('2026-06-18T10:00:00Z');
      const eventDate = '2026-06-18';
      const result = validateDeliveryETA(eta, eventDate);
      expect(result.valid).toBe(true);
    });

    it('should handle Date object as eventDate', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const eta = new Date('2026-06-16T10:00:00Z');
      const eventDate = new Date('2026-06-18T23:59:59Z');
      const result = validateDeliveryETA(eta, eventDate);
      expect(result.valid).toBe(true);
    });
  });

  describe('Timezone handling', () => {
    it('should use provided timezone for comparison', () => {
      // Mock system time: 2026-06-15 22:00 UTC
      vi.setSystemTime(new Date('2026-06-15T22:00:00Z'));

      // In US/Pacific (-7), this is 15:00 (3 PM)
      // Request ETA for 17:00 Pacific same day (10 PM UTC)
      // Should be valid (future in Pacific time)
      const eta = new Date('2026-06-15T22:30:00Z'); // 15:30 Pacific
      const result = validateDeliveryETA(eta, undefined, 'America/Los_Angeles');
      expect(result.valid).toBe(true);
    });

    it('should use system timezone when none provided', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const eta = new Date('2026-06-16T10:00:00Z');
      // This should use whatever the system's Intl.DateTimeFormat returns
      const result = validateDeliveryETA(eta);
      expect(result.valid).toBe(true);
    });
  });

  describe('DST edge cases', () => {
    it('should handle US DST spring forward (2026-03-08 02:00 -> 03:00)', () => {
      // Just before spring forward
      vi.setSystemTime(new Date('2026-03-08T06:00:00Z')); // 00:00 PST
      const eta = new Date('2026-03-09T10:00:00Z'); // 02:00 PDT next day
      const result = validateDeliveryETA(eta, undefined, 'America/Los_Angeles');
      // Should be valid (tomorrow at 02:00 PDT)
      expect(result.valid).toBe(true);
    });

    it('should handle US DST fall back (2026-11-01 02:00 -> 01:00)', () => {
      // Just before fall back
      vi.setSystemTime(new Date('2026-11-01T06:00:00Z')); // 00:00 PDT
      const eta = new Date('2026-11-02T10:00:00Z'); // 02:00 PST next day
      const result = validateDeliveryETA(eta, undefined, 'America/Los_Angeles');
      // Should be valid (tomorrow at 02:00 PST)
      expect(result.valid).toBe(true);
    });

    it('should handle Europe DST spring forward (2026-03-29 01:00 -> 02:00)', () => {
      vi.setSystemTime(new Date('2026-03-29T00:00:00Z')); // 01:00 CET
      const eta = new Date('2026-03-30T10:00:00Z'); // 12:00 CEST
      const result = validateDeliveryETA(eta, undefined, 'Europe/London');
      expect(result.valid).toBe(true);
    });
  });

  describe('Month and year boundaries', () => {
    it('should handle Jan 31 -> Feb 1 transition', () => {
      vi.setSystemTime(new Date('2026-01-31T23:00:00Z'));
      const eta = new Date('2026-02-01T10:00:00Z');
      const result = validateDeliveryETA(eta);
      expect(result.valid).toBe(true);
    });

    it('should handle Dec 31 -> Jan 1 (year boundary)', () => {
      vi.setSystemTime(new Date('2026-12-31T23:00:00Z'));
      const eta = new Date('2027-01-01T10:00:00Z');
      const result = validateDeliveryETA(eta);
      expect(result.valid).toBe(true);
    });

    it('should handle leap year (Feb 28 -> 29)', () => {
      // 2024 is a leap year
      vi.setSystemTime(new Date('2024-02-28T23:00:00Z'));
      const eta = new Date('2024-02-29T10:00:00Z');
      const result = validateDeliveryETA(eta);
      expect(result.valid).toBe(true);
    });

    it('should handle non-leap year (Feb 28 -> Mar 1)', () => {
      // 2026 is not a leap year
      vi.setSystemTime(new Date('2026-02-28T23:00:00Z'));
      const eta = new Date('2026-03-01T10:00:00Z');
      const result = validateDeliveryETA(eta);
      expect(result.valid).toBe(true);
    });

    it('should handle 30-day month (Apr 30 -> May 1)', () => {
      vi.setSystemTime(new Date('2026-04-30T23:00:00Z'));
      const eta = new Date('2026-05-01T10:00:00Z');
      const result = validateDeliveryETA(eta);
      expect(result.valid).toBe(true);
    });
  });

  describe('Event date with timezone context', () => {
    // FIXED (Session 51): validateDeliveryETA now converts the event's
    // end-of-day to a real epoch via zonedTimeToEpochMs (Intl-based), so
    // results are independent of the machine timezone. To PROVE that, this
    // block deliberately pins the process to Asia/Kolkata — the timezone
    // that originally exposed the bug (an LA event's EOD computed hours
    // early on IST machines, wrongly rejecting valid ETAs). If these tests
    // fail again, TZ-independence has regressed.
    const ORIGINAL_TZ = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = 'Asia/Kolkata';
    });
    afterAll(() => {
      if (ORIGINAL_TZ === undefined) delete process.env.TZ;
      else process.env.TZ = ORIGINAL_TZ;
    });

    it('should enforce event date end-of-day in user timezone', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));

      // ETA just before midnight in Pacific time
      const eta = new Date('2026-06-19T06:59:59Z'); // 23:59:59 PDT
      const eventDate = '2026-06-19';

      const result = validateDeliveryETA(eta, eventDate, 'America/Los_Angeles');
      expect(result.valid).toBe(true);
    });

    it('should reject ETA after event date EOD in user timezone', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));

      // ETA just after midnight in Pacific time
      const eta = new Date('2026-06-20T07:00:01Z'); // 00:00:01 PDT
      const eventDate = '2026-06-19';

      const result = validateDeliveryETA(eta, eventDate, 'America/Los_Angeles');
      expect(result.valid).toBe(false);
    });
  });

  describe('Type flexibility', () => {
    it('should handle Date object', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const eta = new Date('2026-06-16T10:00:00Z');
      const result = validateDeliveryETA(eta);
      expect(result.valid).toBe(true);
    });

    it('should handle ISO string', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const result = validateDeliveryETA('2026-06-16T10:00:00Z');
      expect(result.valid).toBe(true);
    });

    it('should handle Date string without time', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      // Note: Date parsing of "2026-06-16" varies by timezone
      // This test verifies the function handles it without crashing
      const result = validateDeliveryETA('2026-06-16');
      // Result depends on system timezone, so we just check it doesn't crash
      expect(result).toHaveProperty('valid');
      expect(typeof result.valid).toBe('boolean');
    });
  });

  describe('Error messages', () => {
    it('should provide clear error message for past ETA', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const result = validateDeliveryETA(new Date('2026-06-15T10:00:00Z'));
      expect(result.error).toBe('ETA must be in the future');
    });

    it('should provide clear error message for after event date', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const result = validateDeliveryETA(new Date('2026-06-20T10:00:00Z'), '2026-06-18');
      expect(result.error).toContain('after');
    });

    it('should provide clear error message for invalid format', () => {
      const result = validateDeliveryETA('garbage-value');
      expect(result.error).toContain('Invalid');
    });
  });

  describe('Extreme edge cases', () => {
    it('should handle far-future dates (year 2100)', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const eta = new Date('2100-06-15T12:00:00Z');
      const result = validateDeliveryETA(eta);
      expect(result.valid).toBe(true);
    });

    it('should handle dates just seconds into the future', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const eta = new Date('2026-06-15T12:00:01Z');
      const result = validateDeliveryETA(eta);
      expect(result.valid).toBe(true);
    });

    it('should handle microsecond-precision ISO strings', () => {
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const result = validateDeliveryETA('2026-06-16T10:00:00.000Z');
      expect(result.valid).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// validateTimeEta — OrderCard's 'time'-mode ETA wrapper (Session 51).
// The UI cannot reach the failure branch until an order's event day arrives
// (checkout enforces future event dates), so the guard is verified here.
// ═══════════════════════════════════════════════════════════════════════
describe('validateTimeEta (OrderCard time-mode ETA wrapper)', () => {
  class FakeTimestamp {
    constructor(private readonly date: Date) {}
    toDate(): Date { return this.date; }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    // "Now" = June 15, 2026, 12:00 local
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
  });

  it('accepts a time on a FUTURE event date (any clock time)', () => {
    expect(validateTimeEta('09:00', '2026-06-20')).toBeNull();
    expect(validateTimeEta('23:59', '2026-06-20')).toBeNull();
  });

  it('event-day order: accepts a time later than now', () => {
    expect(validateTimeEta('14:30', '2026-06-15')).toBeNull();
  });

  it('event-day order: REJECTS a time earlier than now (the untestable-in-UI branch)', () => {
    const err = validateTimeEta('09:00', '2026-06-15');
    expect(err).toBe('ETA must be in the future');
  });

  it('normalizes Firestore Timestamp-like eventDate', () => {
    const eventDay = new FakeTimestamp(new Date(2026, 5, 15, 0, 0, 0));
    expect(validateTimeEta('14:30', eventDay)).toBeNull();
    expect(validateTimeEta('09:00', eventDay)).toBe('ETA must be in the future');
  });

  it('normalizes plain Date eventDate', () => {
    expect(validateTimeEta('14:30', new Date(2026, 5, 15))).toBeNull();
    expect(validateTimeEta('09:00', new Date(2026, 5, 15))).toBe('ETA must be in the future');
  });

  it('returns null (no validation) when eventDate is missing/unusable', () => {
    expect(validateTimeEta('09:00', undefined)).toBeNull();
    expect(validateTimeEta('09:00', null)).toBeNull();
    expect(validateTimeEta('09:00', 'not-a-date')).toBeNull();
  });

  it('rejects malformed time strings', () => {
    expect(validateTimeEta('bogus', '2026-06-20')).toBe('Invalid time');
  });
});
