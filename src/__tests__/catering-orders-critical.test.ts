// ═══════════════════════════════════════════════════════════════════════
// CRITICAL FIX TESTS (C1–C5)
// Race conditions, optimistic locking, RFP lifecycle
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetFirestoreStore, seedDoc, MockTimestamp, firestoreStore } from './setup';
import {
  updateOrderStatus,
  cancelOrder,
  isValidStatusTransition,
  createOrdersFromQuote,
} from '@/services/catering/cateringOrders';
import {
  closeQuoteRequest,
  proceedWithPartialAssignment,
  expireStaleQuoteRequests,
  acceptQuoteResponseItems,
} from '@/services/catering/cateringQuotes';

beforeEach(() => {
  resetFirestoreStore();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// C-1: Duplicate order creation guard (idempotency + transaction marker)
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-C1: Duplicate order creation prevention', () => {
  const baseQuoteRequest = {
    id: 'qr-1',
    customerId: 'cust-1',
    eventDate: '2026-06-15',
    headcount: 50,
    items: [{ name: 'Biryani', qty: 50, pricingType: 'per_person' }],
    status: 'accepted',
    responseCount: 1,
    itemAssignments: [
      {
        itemName: 'Biryani',
        responseId: 'resp-1',
        businessId: 'biz-1',
        businessName: 'Spice Palace',
        assignedAt: MockTimestamp.now(),
      },
    ],
  };

  const baseResponse = {
    id: 'resp-1',
    quoteRequestId: 'qr-1',
    businessId: 'biz-1',
    businessName: 'Spice Palace',
    status: 'accepted',
    quotedItems: [{ name: 'Biryani', qty: 50, unitPrice: 1200, pricingType: 'per_person' }],
    subtotal: 60000,
    total: 64950,
    customerName: 'John',
    customerEmail: 'john@test.com',
    customerPhone: '555-0100',
    createdAt: MockTimestamp.now(),
  };

  it('should create orders from a valid quote request', async () => {
    seedDoc('cateringQuoteRequests', 'qr-1', { ...baseQuoteRequest, ordersCreated: false });

    const ids = await createOrdersFromQuote(
      baseQuoteRequest as any,
      [baseResponse as any],
      { street: '123 Main', city: 'Austin', state: 'TX', zip: '78701' },
    );

    expect(ids.length).toBeGreaterThan(0);
  });

  it('should return existing order IDs if orders already created (marker check)', async () => {
    // Seed with ordersCreated = true (another call already succeeded)
    seedDoc('cateringQuoteRequests', 'qr-1', { ...baseQuoteRequest, ordersCreated: true });
    seedDoc('cateringOrders', 'existing-1', { quoteRequestId: 'qr-1', status: 'confirmed' });

    const ids = await createOrdersFromQuote(
      baseQuoteRequest as any,
      [baseResponse as any],
      { street: '123 Main', city: 'Austin', state: 'TX', zip: '78701' },
    );

    expect(ids).toContain('existing-1');
  });

  it('should return existing orders via idempotency key match', async () => {
    seedDoc('cateringQuoteRequests', 'qr-1', { ...baseQuoteRequest, ordersCreated: false });
    seedDoc('cateringOrders', 'idem-order-1', { quoteRequestId: 'qr-1', idempotencyKey: 'key-abc', status: 'confirmed' });

    const ids = await createOrdersFromQuote(
      baseQuoteRequest as any,
      [baseResponse as any],
      { street: '123 Main', city: 'Austin', state: 'TX', zip: '78701' },
      'key-abc',
    );

    expect(ids).toContain('idem-order-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// C-2: Optimistic locking via _version + transaction
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-C2: Optimistic locking on status transitions', () => {
  it('should increment _version on valid status transition', async () => {
    seedDoc('cateringOrders', 'ord-1', {
      status: 'pending',
      _version: 1,
      customerId: 'cust-1',
      businessName: 'Test Biz',
    });

    await updateOrderStatus('ord-1', 'confirmed');

    const updated = firestoreStore['cateringOrders']['ord-1'];
    expect(updated.status).toBe('confirmed');
    expect(updated._version).toBe(2);
  });

  it('should reject invalid status transition', async () => {
    seedDoc('cateringOrders', 'ord-2', {
      status: 'delivered',
      _version: 3,
      customerId: 'cust-1',
      businessName: 'Test Biz',
    });

    await expect(updateOrderStatus('ord-2', 'pending')).rejects.toThrow(
      'Invalid status transition',
    );
  });

  it('should reject transition on non-existent order', async () => {
    await expect(updateOrderStatus('nonexistent', 'confirmed')).rejects.toThrow(
      'Order not found',
    );
  });

  it('should enforce role-based authorization (vendor-only statuses)', async () => {
    seedDoc('cateringOrders', 'ord-3', {
      status: 'pending',
      _version: 1,
      customerId: 'cust-1',
      businessName: 'Test Biz',
    });

    await expect(
      updateOrderStatus('ord-3', 'confirmed', undefined, { uid: 'cust-1', role: 'customer' }),
    ).rejects.toThrow('Only the vendor can advance order status');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// C-2 continued: State machine validation
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-C2: State machine — isValidStatusTransition', () => {
  // Web + Mobile: Both platforms must enforce the same transition rules
  const validTransitions = [
    ['pending', 'confirmed'],
    ['pending', 'cancelled'],
    ['confirmed', 'preparing'],
    ['confirmed', 'cancelled'],
    ['preparing', 'ready'],
    ['preparing', 'cancelled'],
    ['ready', 'out_for_delivery'],
    ['ready', 'cancelled'],
    ['out_for_delivery', 'delivered'],
  ];

  const invalidTransitions = [
    ['pending', 'ready'],
    ['pending', 'delivered'],
    ['confirmed', 'delivered'],
    ['out_for_delivery', 'cancelled'], // FIX-H4: Cannot cancel once out for delivery
    ['delivered', 'pending'],
    ['delivered', 'cancelled'],
    ['cancelled', 'pending'],
    ['cancelled', 'confirmed'],
  ];

  for (const [from, to] of validTransitions) {
    it(`should allow: ${from} → ${to}`, () => {
      expect(isValidStatusTransition(from, to)).toBe(true);
    });
  }

  for (const [from, to] of invalidTransitions) {
    it(`should block: ${from} → ${to}`, () => {
      expect(isValidStatusTransition(from, to)).toBe(false);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// C-3: Vendor reassignment notification on item re-accept
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-C3: Item reassignment notification', () => {
  it('should detect items being reassigned from another vendor', async () => {
    const { notifyVendorItemReassigned } = await import('@/services/catering/cateringNotifications');

    seedDoc('cateringQuoteRequests', 'qr-3', {
      status: 'partially_accepted',
      items: [
        { name: 'Samosa', qty: 100, pricingType: 'per_piece' },
        { name: 'Curry', qty: 50, pricingType: 'per_person' },
      ],
      responseCount: 2,
      itemAssignments: [
        { itemName: 'Samosa', responseId: 'resp-old', businessId: 'biz-old', businessName: 'Old Vendor', assignedAt: MockTimestamp.now() },
      ],
    });

    seedDoc('cateringQuoteResponses', 'resp-new', {
      quoteRequestId: 'qr-3',
      businessId: 'biz-new',
      businessName: 'New Vendor',
      status: 'submitted',
      quotedItems: [{ name: 'Samosa', qty: 100, unitPrice: 500, pricingType: 'per_piece' }],
    });

    seedDoc('cateringQuoteResponses', 'resp-old', {
      quoteRequestId: 'qr-3',
      businessId: 'biz-old',
      businessName: 'Old Vendor',
      vendorOwnerId: 'vendor-owner-old',
      status: 'partially_accepted',
      quotedItems: [{ name: 'Samosa', qty: 100, unitPrice: 600, pricingType: 'per_piece' }],
    });

    await acceptQuoteResponseItems(
      'resp-new',
      'qr-3',
      ['Samosa'],
      { customerName: 'Jane', customerEmail: 'jane@test.com', customerPhone: '555-0200' },
    );

    // The old vendor should have been notified about losing the Samosa item
    expect(notifyVendorItemReassigned).toHaveBeenCalledWith(
      'vendor-owner-old',
      'Old Vendor',
      ['Samosa'],
      'qr-3',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// C-4: RFP escape hatches — Close and Proceed-with-partial
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-C4: RFP escape hatches', () => {
  it('closeQuoteRequest should cancel the RFP and decline all vendors', async () => {
    seedDoc('cateringQuoteRequests', 'qr-close', {
      status: 'open',
      items: [{ name: 'Naan', qty: 100 }],
      responseCount: 1,
    });

    seedDoc('cateringQuoteResponses', 'resp-close', {
      quoteRequestId: 'qr-close',
      status: 'submitted',
      businessId: 'biz-1',
    });

    await closeQuoteRequest('qr-close');

    expect(firestoreStore['cateringQuoteRequests']['qr-close'].status).toBe('cancelled');
    expect(firestoreStore['cateringQuoteResponses']['resp-close'].status).toBe('declined');
  });

  it('closeQuoteRequest should throw if already cancelled', async () => {
    seedDoc('cateringQuoteRequests', 'qr-dup-cancel', { status: 'cancelled' });

    await expect(closeQuoteRequest('qr-dup-cancel')).rejects.toThrow('already cancelled');
  });

  it('closeQuoteRequest should throw if orders already created', async () => {
    seedDoc('cateringQuoteRequests', 'qr-has-orders', { status: 'open', ordersCreated: true });

    await expect(closeQuoteRequest('qr-has-orders')).rejects.toThrow('Orders have already been created');
  });

  it('proceedWithPartialAssignment should drop unassigned items and finalize', async () => {
    seedDoc('cateringQuoteRequests', 'qr-partial', {
      status: 'partially_accepted',
      items: [
        { name: 'Biryani', qty: 50 },
        { name: 'Raita', qty: 50 },
        { name: 'Lassi', qty: 50 },
      ],
      itemAssignments: [
        { itemName: 'Biryani', businessId: 'biz-1', businessName: 'Vendor A', responseId: 'r1', assignedAt: MockTimestamp.now() },
      ],
      responseCount: 1,
    });

    seedDoc('cateringQuoteResponses', 'resp-partial-sub', {
      quoteRequestId: 'qr-partial',
      status: 'submitted',
      businessId: 'biz-2',
    });

    const result = await proceedWithPartialAssignment('qr-partial');

    expect(result.droppedItems).toContain('Raita');
    expect(result.droppedItems).toContain('Lassi');
    expect(result.droppedItems).not.toContain('Biryani');
    expect(firestoreStore['cateringQuoteRequests']['qr-partial'].status).toBe('accepted');
    expect(firestoreStore['cateringQuoteRequests']['qr-partial'].partialProceed).toBe(true);
  });

  it('proceedWithPartialAssignment should throw if no items assigned', async () => {
    seedDoc('cateringQuoteRequests', 'qr-empty', {
      status: 'open',
      items: [{ name: 'Naan' }],
      itemAssignments: [],
    });

    await expect(proceedWithPartialAssignment('qr-empty')).rejects.toThrow(
      'No items have been assigned yet',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// C-5: Auto-expire stale RFPs (7-day TTL)
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-C5: Stale RFP expiry', () => {
  it('should expire open RFPs older than 7 days', async () => {
    const eightDaysAgo = MockTimestamp.fromMillis(Date.now() - 8 * 24 * 60 * 60 * 1000);

    seedDoc('cateringQuoteRequests', 'qr-stale', {
      status: 'open',
      createdAt: eightDaysAgo,
    });

    seedDoc('cateringQuoteResponses', 'resp-stale', {
      quoteRequestId: 'qr-stale',
      status: 'submitted',
    });

    const count = await expireStaleQuoteRequests();

    expect(count).toBe(1);
    expect(firestoreStore['cateringQuoteRequests']['qr-stale'].status).toBe('expired');
    expect(firestoreStore['cateringQuoteResponses']['resp-stale'].status).toBe('expired');
  });

  it('should NOT expire RFPs less than 7 days old', async () => {
    const threeDaysAgo = MockTimestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);

    seedDoc('cateringQuoteRequests', 'qr-fresh', {
      status: 'open',
      createdAt: threeDaysAgo,
    });

    const count = await expireStaleQuoteRequests();
    expect(count).toBe(0);
    expect(firestoreStore['cateringQuoteRequests']['qr-fresh'].status).toBe('open');
  });

  it('should NOT expire already-accepted RFPs', async () => {
    const tenDaysAgo = MockTimestamp.fromMillis(Date.now() - 10 * 24 * 60 * 60 * 1000);

    seedDoc('cateringQuoteRequests', 'qr-accepted', {
      status: 'accepted',
      createdAt: tenDaysAgo,
    });

    const count = await expireStaleQuoteRequests();
    expect(count).toBe(0);
  });
});
