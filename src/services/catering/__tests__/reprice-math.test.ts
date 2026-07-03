// ═══════════════════════════════════════════════════════════════════════
// REPRICE NEGOTIATION MATH TESTS
// requestReprice / respondToReprice / resolveCounterOffer in cateringQuotes.ts
// Regression tests asserting EXACT current money math and guards.
// Firestore is mocked globally in src/__tests__/setup.ts (in-memory store +
// vi.fn wrappers), so updateDoc payloads can be captured directly.
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { updateDoc } from 'firebase/firestore';
import { resetFirestoreStore, seedDoc, MockTimestamp, firestoreStore } from '../../../__tests__/setup';
import {
  requestReprice,
  respondToReprice,
  resolveCounterOffer,
} from '../cateringQuotes';

const COL = 'cateringQuoteResponses';
const REPRICE_WINDOW_MS = 24 * 60 * 60 * 1000; // mirrors cateringQuotes.ts constant

// Whole-second instant so MockTimestamp (second precision) math stays exact
const NOW = new Date('2026-07-01T12:00:00Z');
const futureTs = () => MockTimestamp.fromMillis(NOW.getTime() + 60 * 60 * 1000); // +1h
const pastTs = () => MockTimestamp.fromMillis(NOW.getTime() - 60 * 1000); // -1min

/** Baseline submitted quote: items subtotal 550 + delivery fee 50 = total 600 */
function seedResponse(overrides: Record<string, unknown> = {}) {
  seedDoc(COL, 'resp-1', {
    quoteRequestId: 'qr-1',
    businessId: 'biz-1',
    status: 'submitted',
    subtotal: 550,
    deliveryFee: 50,
    total: 600,
    ...overrides,
  });
}

/** Payload of the most recent updateDoc call */
function lastUpdate(): Record<string, any> {
  const calls = vi.mocked(updateDoc).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][1] as Record<string, any>;
}

function storedDoc(): Record<string, any> {
  return firestoreStore[COL]['resp-1'];
}

beforeEach(() => {
  resetFirestoreStore();
  vi.clearAllMocks();
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════
// requestReprice — customer proposes a new items-only price
// ═══════════════════════════════════════════════════════════════════════
describe('requestReprice', () => {
  it('writes the full reprice payload with a 24h expiry window', async () => {
    seedResponse();
    await requestReprice('resp-1', 400, 'Budget is tight', ['Biryani', 'Naan']);

    const update = lastUpdate();
    expect(update.repriceStatus).toBe('requested');
    expect(update.repriceRequestedPrice).toBe(400);
    expect(update.repriceReason).toBe('Budget is tight');
    expect(update.repriceItemNames).toEqual(['Biryani', 'Naan']);
    expect(update.repriceRequestedAt.toMillis()).toBe(NOW.getTime());
    // Expiry is exactly REPRICE_WINDOW_MS after the request timestamp
    expect(update.repriceExpiresAt.toMillis() - update.repriceRequestedAt.toMillis()).toBe(REPRICE_WINDOW_MS);
    // Total is NOT touched at request time
    expect('total' in update).toBe(false);
    expect(storedDoc().total).toBe(600);
  });

  it('defaults reason to "" and item names to [] when omitted', async () => {
    seedResponse();
    await requestReprice('resp-1', 400);

    const update = lastUpdate();
    expect(update.repriceReason).toBe('');
    expect(update.repriceItemNames).toEqual([]);
  });

  it('throws when the quote response does not exist', async () => {
    await expect(requestReprice('missing-id', 400)).rejects.toThrow('Quote response not found');
  });

  it('throws when the quote is not in submitted status', async () => {
    seedResponse({ status: 'accepted' });
    await expect(requestReprice('resp-1', 400)).rejects.toThrow('Can only request a reprice on a submitted quote');
  });

  it('throws when a reprice was already requested (one-shot guard)', async () => {
    seedResponse({ repriceStatus: 'requested' });
    await expect(requestReprice('resp-1', 400)).rejects.toThrow('A reprice has already been requested for this quote');

    seedResponse({ repriceStatus: 'vendor_denied' });
    await expect(requestReprice('resp-1', 400)).rejects.toThrow('A reprice has already been requested for this quote');
  });

  it('allows a reprice when repriceStatus is explicitly "none"', async () => {
    seedResponse({ repriceStatus: 'none' });
    await requestReprice('resp-1', 400);
    expect(storedDoc().repriceStatus).toBe('requested');
  });

  it('CURRENT BEHAVIOR: does not validate requestedPrice — 0 and negative are accepted', async () => {
    // There is no price validation in requestReprice (unlike counterPrice in
    // respondToReprice). Documenting as-is; flagged as a latent gap.
    seedResponse();
    await requestReprice('resp-1', 0);
    expect(storedDoc().repriceRequestedPrice).toBe(0);

    seedResponse(); // reset status
    await requestReprice('resp-1', -100);
    expect(storedDoc().repriceRequestedPrice).toBe(-100);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// respondToReprice — vendor accepts / denies / counters
// ═══════════════════════════════════════════════════════════════════════
describe('respondToReprice', () => {
  function seedRequested(overrides: Record<string, unknown> = {}) {
    seedResponse({
      repriceStatus: 'requested',
      repriceRequestedPrice: 400,
      repriceExpiresAt: futureTs(),
      ...overrides,
    });
  }

  describe('accept', () => {
    it('sets total = repriceRequestedPrice + deliveryFee (items-only price + fee)', async () => {
      seedRequested(); // requested 400, fee 50
      await respondToReprice('resp-1', 'accept', undefined, 'Deal');

      const update = lastUpdate();
      expect(update.repriceStatus).toBe('vendor_accepted');
      expect(update.total).toBe(450); // 400 + 50
      expect(update.repriceVendorNote).toBe('Deal');
      expect(update.repriceRespondedAt.toMillis()).toBe(NOW.getTime());
      expect(storedDoc().total).toBe(450);
    });

    it('treats missing deliveryFee as 0', async () => {
      seedRequested({ deliveryFee: undefined });
      await respondToReprice('resp-1', 'accept');
      expect(lastUpdate().total).toBe(400); // 400 + 0
    });

    it('CURRENT BEHAVIOR: missing repriceRequestedPrice falls back to 0 — total becomes deliveryFee only', async () => {
      seedRequested({ repriceRequestedPrice: undefined });
      await respondToReprice('resp-1', 'accept');
      expect(lastUpdate().total).toBe(50); // (0) + 50 — flagged as a latent hazard
    });

    it('defaults vendorNote to ""', async () => {
      seedRequested();
      await respondToReprice('resp-1', 'accept');
      expect(lastUpdate().repriceVendorNote).toBe('');
    });
  });

  describe('deny', () => {
    it('sets vendor_denied and does NOT touch total', async () => {
      seedRequested();
      await respondToReprice('resp-1', 'deny', undefined, 'Cannot go lower');

      const update = lastUpdate();
      expect(update.repriceStatus).toBe('vendor_denied');
      expect('total' in update).toBe(false);
      expect(storedDoc().total).toBe(600); // original stands
    });
  });

  describe('counter', () => {
    it('sets repriceCounterPrice and a fresh 24h customer-acceptance window', async () => {
      seedRequested();
      await respondToReprice('resp-1', 'counter', 475, 'Best I can do');

      const update = lastUpdate();
      expect(update.repriceStatus).toBe('vendor_countered');
      expect(update.repriceCounterPrice).toBe(475);
      expect(update.repriceVendorNote).toBe('Best I can do');
      expect(update.repriceCounterExpiresAt.toMillis() - update.repriceRespondedAt.toMillis()).toBe(REPRICE_WINDOW_MS);
      // Countering does not change the total (only customer acceptance does)
      expect('total' in update).toBe(false);
      expect(storedDoc().total).toBe(600);
    });

    it('rejects counterPrice of 0, undefined, and negative values', async () => {
      seedRequested();
      await expect(respondToReprice('resp-1', 'counter', 0)).rejects.toThrow('Counter price is required');

      seedRequested();
      await expect(respondToReprice('resp-1', 'counter', undefined)).rejects.toThrow('Counter price is required');

      seedRequested();
      await expect(respondToReprice('resp-1', 'counter', -50)).rejects.toThrow('Counter price is required');
    });
  });

  describe('guards', () => {
    it('throws when the quote response does not exist', async () => {
      await expect(respondToReprice('missing-id', 'accept')).rejects.toThrow('Quote response not found');
    });

    it('throws when repriceStatus is not "requested"', async () => {
      seedResponse(); // no repriceStatus at all
      await expect(respondToReprice('resp-1', 'accept')).rejects.toThrow('No pending reprice request to respond to');

      seedResponse({ repriceStatus: 'vendor_denied', repriceExpiresAt: futureTs() });
      await expect(respondToReprice('resp-1', 'accept')).rejects.toThrow('No pending reprice request to respond to');
    });

    it('throws when the reprice window has expired', async () => {
      seedRequested({ repriceExpiresAt: pastTs() });
      await expect(respondToReprice('resp-1', 'accept')).rejects.toThrow('The reprice request has expired');
      // Total untouched on failed guard
      expect(storedDoc().total).toBe(600);
    });

    it('CURRENT BEHAVIOR: missing repriceExpiresAt is treated as already expired (expiresMs falls back to 0)', async () => {
      seedRequested({ repriceExpiresAt: undefined });
      await expect(respondToReprice('resp-1', 'accept')).rejects.toThrow('The reprice request has expired');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// resolveCounterOffer — customer accepts / declines the vendor counter
// ═══════════════════════════════════════════════════════════════════════
describe('resolveCounterOffer', () => {
  function seedCountered(overrides: Record<string, unknown> = {}) {
    seedResponse({
      repriceStatus: 'vendor_countered',
      repriceRequestedPrice: 400,
      repriceCounterPrice: 475,
      repriceCounterExpiresAt: futureTs(),
      ...overrides,
    });
  }

  describe('accept', () => {
    it('sets total = repriceCounterPrice + deliveryFee (NOT the requested price)', async () => {
      seedCountered(); // counter 475, fee 50
      await resolveCounterOffer('resp-1', 'accept');

      const update = lastUpdate();
      expect(update.repriceStatus).toBe('counter_accepted');
      expect(update.total).toBe(525); // 475 + 50
      expect(update.repriceResolvedAt.toMillis()).toBe(NOW.getTime());
      expect(storedDoc().total).toBe(525);
    });

    it('treats missing deliveryFee as 0', async () => {
      seedCountered({ deliveryFee: undefined });
      await resolveCounterOffer('resp-1', 'accept');
      expect(lastUpdate().total).toBe(475);
    });

    it('CURRENT BEHAVIOR: missing repriceCounterPrice falls back to 0 — total becomes deliveryFee only', async () => {
      seedCountered({ repriceCounterPrice: undefined });
      await resolveCounterOffer('resp-1', 'accept');
      expect(lastUpdate().total).toBe(50); // (0) + 50 — flagged as a latent hazard
    });
  });

  describe('decline', () => {
    it('sets counter_declined and leaves the original total in place (never modified during negotiation)', async () => {
      seedCountered();
      await resolveCounterOffer('resp-1', 'decline');

      const update = lastUpdate();
      expect(update.repriceStatus).toBe('counter_declined');
      // "Restores original" == total was never written during the negotiation,
      // so decline simply does not touch it.
      expect('total' in update).toBe(false);
      expect(storedDoc().total).toBe(600);
    });
  });

  describe('guards', () => {
    it('throws when the quote response does not exist', async () => {
      await expect(resolveCounterOffer('missing-id', 'accept')).rejects.toThrow('Quote response not found');
    });

    it('throws when repriceStatus is not "vendor_countered"', async () => {
      seedResponse({ repriceStatus: 'requested', repriceExpiresAt: futureTs() });
      await expect(resolveCounterOffer('resp-1', 'accept')).rejects.toThrow('No pending counter-offer to resolve');

      seedResponse({ repriceStatus: 'vendor_accepted' });
      await expect(resolveCounterOffer('resp-1', 'accept')).rejects.toThrow('No pending counter-offer to resolve');
    });

    it('throws when the counter-offer window has expired', async () => {
      seedCountered({ repriceCounterExpiresAt: pastTs() });
      await expect(resolveCounterOffer('resp-1', 'accept')).rejects.toThrow('The counter-offer has expired');
      expect(storedDoc().total).toBe(600); // untouched
    });

    it('CURRENT BEHAVIOR: missing repriceCounterExpiresAt is treated as already expired', async () => {
      seedCountered({ repriceCounterExpiresAt: undefined });
      await expect(resolveCounterOffer('resp-1', 'accept')).rejects.toThrow('The counter-offer has expired');
    });
  });
});
