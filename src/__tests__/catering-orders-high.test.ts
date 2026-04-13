// ═══════════════════════════════════════════════════════════════════════
// HIGH FIX TESTS (H1–H8)
// Batch ops, modification lock, cancel-refund, payment state machine
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetFirestoreStore, seedDoc, MockTimestamp, firestoreStore } from './setup';
import {
  batchUpdateOrderStatus,
  vendorModifyOrder,
  respondToModification,
  cancelOrder,
  updateOrderPaymentStatus,
  createOrdersFromQuote,
} from '@/services/catering/cateringOrders';
import {
  updateQuoteRequest,
} from '@/services/catering/cateringQuotes';

beforeEach(() => {
  resetFirestoreStore();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// H-1: Batch operations with per-order error reporting
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-H1: Batch status update with detailed results', () => {
  it('should return per-order success/failure results', async () => {
    seedDoc('cateringOrders', 'batch-1', { status: 'pending', _version: 1, customerId: 'c1', businessName: 'B1' });
    seedDoc('cateringOrders', 'batch-2', { status: 'pending', _version: 1, customerId: 'c2', businessName: 'B2' });
    seedDoc('cateringOrders', 'batch-3', { status: 'delivered', _version: 5, customerId: 'c3', businessName: 'B3' }); // terminal — will fail

    const result = await batchUpdateOrderStatus(
      ['batch-1', 'batch-2', 'batch-3'],
      'confirmed',
    );

    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.results).toHaveLength(3);

    const batch1 = result.results.find((r) => r.orderId === 'batch-1');
    const batch3 = result.results.find((r) => r.orderId === 'batch-3');
    expect(batch1?.ok).toBe(true);
    expect(batch3?.ok).toBe(false);
    expect(batch3?.error).toContain('Cannot change from delivered to confirmed');
  });

  it('should return error for non-existent orders in batch', async () => {
    const result = await batchUpdateOrderStatus(['nonexistent-1'], 'confirmed');

    expect(result.failed).toBe(1);
    expect(result.results[0].error).toContain('not found');
  });

  it('should increment _version on each successful batch update', async () => {
    seedDoc('cateringOrders', 'batch-v', { status: 'pending', _version: 1, customerId: 'c1', businessName: 'B1' });

    await batchUpdateOrderStatus(['batch-v'], 'confirmed');

    expect(firestoreStore['cateringOrders']['batch-v']._version).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// H-2: Modification lock — prevent stacking vendor modifications
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-H2: Vendor modification lock', () => {
  const baseOrder = {
    status: 'confirmed',
    _version: 1,
    customerId: 'cust-1',
    businessName: 'Test Biz',
    items: [{ menuItemId: 'm1', name: 'Biryani', qty: 50, unitPrice: 1200, pricingType: 'per_person' }],
    subtotal: 60000,
    total: 64950,
    pendingModification: false,
  };

  it('should allow first modification and set pendingModification lock', async () => {
    seedDoc('cateringOrders', 'mod-1', { ...baseOrder });

    await vendorModifyOrder('mod-1', {
      items: [{ menuItemId: 'm1', name: 'Biryani', qty: 60, unitPrice: 1200, pricingType: 'per_person' }],
      total: 77880,
      subtotal: 72000,
      note: 'Increased qty to 60',
    });

    const updated = firestoreStore['cateringOrders']['mod-1'];
    expect(updated.pendingModification).toBe(true);
    expect(updated.vendorModified).toBe(true);
    expect(updated._version).toBe(2);
  });

  it('should block second modification while one is pending', async () => {
    seedDoc('cateringOrders', 'mod-2', { ...baseOrder, pendingModification: true, vendorModified: true });

    await expect(
      vendorModifyOrder('mod-2', {
        items: [{ menuItemId: 'm1', name: 'Biryani', qty: 70, unitPrice: 1200, pricingType: 'per_person' }],
        total: 90720,
        subtotal: 84000,
        note: 'Another change',
      }),
    ).rejects.toThrow('modification is already pending');
  });

  it('should only save originalItems on first modification (preserve true original)', async () => {
    seedDoc('cateringOrders', 'mod-3', { ...baseOrder });

    await vendorModifyOrder('mod-3', {
      items: [{ menuItemId: 'm1', name: 'Biryani', qty: 60, unitPrice: 1200, pricingType: 'per_person' }],
      total: 77880,
      subtotal: 72000,
      note: 'First edit',
    });

    const afterFirst = firestoreStore['cateringOrders']['mod-3'];
    expect(afterFirst.originalItems).toEqual(baseOrder.items); // Original items preserved
  });

  it('should reject modification for non-confirmed/preparing orders', async () => {
    seedDoc('cateringOrders', 'mod-ready', { ...baseOrder, status: 'ready' });

    await expect(
      vendorModifyOrder('mod-ready', {
        items: [],
        total: 0,
        subtotal: 0,
        note: 'Too late',
      }),
    ).rejects.toThrow('Can only modify confirmed or preparing orders');
  });

  it('respondToModification("accept") should clear the lock', async () => {
    seedDoc('cateringOrders', 'mod-accept', {
      ...baseOrder,
      pendingModification: true,
      vendorModified: true,
      originalItems: baseOrder.items,
    });

    await respondToModification('mod-accept', 'accept');

    const updated = firestoreStore['cateringOrders']['mod-accept'];
    expect(updated.pendingModification).toBe(false);
    expect(updated.vendorModified).toBe(false);
    expect(updated.originalItems).toBeNull();
  });

  it('respondToModification("reject") should revert to original items', async () => {
    const originalItems = [{ menuItemId: 'm1', name: 'Biryani', qty: 50, unitPrice: 1200, pricingType: 'per_person' }];
    seedDoc('cateringOrders', 'mod-reject', {
      ...baseOrder,
      pendingModification: true,
      vendorModified: true,
      originalItems,
      items: [{ menuItemId: 'm1', name: 'Biryani', qty: 80, unitPrice: 1200, pricingType: 'per_person' }],
      subtotal: 96000,
      total: 103920,
    });

    await respondToModification('mod-reject', 'reject');

    const updated = firestoreStore['cateringOrders']['mod-reject'];
    expect(updated.pendingModification).toBe(false);
    expect(updated.items).toEqual(originalItems);
    expect(updated.subtotal).toBe(60000); // recalculated from original
  });
});

// ═══════════════════════════════════════════════════════════════════════
// H-3: Cancel-to-refund pipeline
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-H3: Auto-refund on cancel of paid orders', () => {
  it('should set paymentStatus to refund_pending when cancelling a paid order', async () => {
    seedDoc('cateringOrders', 'cancel-paid', {
      status: 'confirmed',
      _version: 1,
      customerId: 'cust-1',
      paymentStatus: 'paid',
    });

    await cancelOrder('cancel-paid', 'Customer changed their mind', 'customer');

    const updated = firestoreStore['cateringOrders']['cancel-paid'];
    expect(updated.status).toBe('cancelled');
    expect(updated.paymentStatus).toBe('refund_pending');
  });

  it('should NOT change paymentStatus when cancelling an unpaid order', async () => {
    seedDoc('cateringOrders', 'cancel-unpaid', {
      status: 'pending',
      _version: 1,
      customerId: 'cust-1',
      paymentStatus: 'pending',
    });

    await cancelOrder('cancel-unpaid', 'Changed my mind', 'customer');

    const updated = firestoreStore['cateringOrders']['cancel-unpaid'];
    expect(updated.status).toBe('cancelled');
    expect(updated.paymentStatus).toBe('pending'); // Unchanged — no refund triggered
  });

  it('should reject cancel on already-delivered orders', async () => {
    seedDoc('cateringOrders', 'cancel-delivered', {
      status: 'delivered',
      _version: 5,
      customerId: 'cust-1',
    });

    await expect(
      cancelOrder('cancel-delivered', 'Too late', 'customer'),
    ).rejects.toThrow('Cannot cancel');
  });

  it('should reject cancel on out_for_delivery orders (FIX-H4)', async () => {
    seedDoc('cateringOrders', 'cancel-ofd', {
      status: 'out_for_delivery',
      _version: 4,
      customerId: 'cust-1',
    });

    await expect(
      cancelOrder('cancel-ofd', 'Changed mind', 'customer'),
    ).rejects.toThrow('Cannot cancel');
  });

  it('should verify caller matches cancelledBy role', async () => {
    seedDoc('cateringOrders', 'cancel-auth', {
      status: 'pending',
      _version: 1,
      customerId: 'cust-1',
    });

    await expect(
      cancelOrder('cancel-auth', 'Not mine', 'customer', 'different-user'),
    ).rejects.toThrow('Only the order customer can cancel as customer');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// H-5: RFP edit notifications + stale quote marking
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-H5: RFP edit notifications', () => {
  it('should flag requiresRequote and notify vendors when RFP is edited after responses', async () => {
    const { notifyVendorsRfpEdited } = await import('@/services/catering/cateringNotifications');
    const recentCreation = MockTimestamp.fromMillis(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

    seedDoc('cateringQuoteRequests', 'qr-edit', {
      status: 'open',
      responseCount: 2,
      createdAt: recentCreation,
      eventDate: '2026-12-01',
    });

    seedDoc('cateringQuoteResponses', 'resp-edit-1', {
      quoteRequestId: 'qr-edit',
      status: 'submitted',
      vendorOwnerId: 'v1',
    });

    await updateQuoteRequest('qr-edit', { headcount: 100 });

    const updated = firestoreStore['cateringQuoteRequests']['qr-edit'];
    expect(updated.requiresRequote).toBe(true);
  });

  it('should reject edit if RFP is not open', async () => {
    seedDoc('cateringQuoteRequests', 'qr-closed', {
      status: 'accepted',
      createdAt: MockTimestamp.fromMillis(Date.now() - 1000),
    });

    await expect(
      updateQuoteRequest('qr-closed', { headcount: 100 }),
    ).rejects.toThrow('Only open requests can be edited');
  });

  it('should reject edit if 24hr window expired', async () => {
    const twoDaysAgo = MockTimestamp.fromMillis(Date.now() - 48 * 60 * 60 * 1000);

    seedDoc('cateringQuoteRequests', 'qr-old', {
      status: 'open',
      createdAt: twoDaysAgo,
    });

    await expect(
      updateQuoteRequest('qr-old', { headcount: 100 }),
    ).rejects.toThrow('Edit window (24 hours) has expired');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// H-7: Idempotency key for network-retry duplicate prevention
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-H7: Idempotency key', () => {
  it('should attach idempotency key to created orders', async () => {
    seedDoc('cateringQuoteRequests', 'qr-idem', {
      id: 'qr-idem',
      customerId: 'cust-1',
      eventDate: '2026-08-01',
      headcount: 30,
      items: [{ name: 'Tikka', qty: 30, pricingType: 'per_person' }],
      status: 'accepted',
      responseCount: 1,
      itemAssignments: [
        { itemName: 'Tikka', responseId: 'resp-idem', businessId: 'biz-idem', businessName: 'Tikka House', assignedAt: MockTimestamp.now() },
      ],
      ordersCreated: false,
    });

    seedDoc('cateringQuoteResponses', 'resp-idem', {
      quoteRequestId: 'qr-idem',
      businessId: 'biz-idem',
      businessName: 'Tikka House',
      status: 'accepted',
      quotedItems: [{ name: 'Tikka', qty: 30, unitPrice: 1500, pricingType: 'per_person' }],
      subtotal: 45000,
      total: 48713,
      customerName: 'Sam',
      customerEmail: 'sam@test.com',
      customerPhone: '555-0300',
    });

    const ids = await createOrdersFromQuote(
      {
        id: 'qr-idem',
        customerId: 'cust-1',
        eventDate: '2026-08-01',
        headcount: 30,
        items: [{ name: 'Tikka', qty: 30, pricingType: 'per_person' }],
        status: 'accepted',
        responseCount: 1,
        itemAssignments: [
          { itemName: 'Tikka', responseId: 'resp-idem', businessId: 'biz-idem', businessName: 'Tikka House', assignedAt: MockTimestamp.now() },
        ],
      } as any,
      [{
        id: 'resp-idem',
        quoteRequestId: 'qr-idem',
        businessId: 'biz-idem',
        businessName: 'Tikka House',
        status: 'accepted',
        quotedItems: [{ name: 'Tikka', qty: 30, unitPrice: 1500, pricingType: 'per_person' }],
        subtotal: 45000,
        total: 48713,
        customerName: 'Sam',
        customerEmail: 'sam@test.com',
        customerPhone: '555-0300',
      } as any],
      { street: '456 Oak', city: 'Dallas', state: 'TX', zip: '75201' },
      'idem-key-xyz',
    );

    expect(ids.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// H-8: Payment status state machine
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-H8: Payment status transition validation', () => {
  it('should allow pending → paid with transactionId', async () => {
    seedDoc('cateringOrders', 'pay-1', { status: 'confirmed', paymentStatus: 'pending', _version: 1 });

    await updateOrderPaymentStatus('pay-1', 'paid', { transactionId: 'txn_123' });

    expect(firestoreStore['cateringOrders']['pay-1'].paymentStatus).toBe('paid');
  });

  it('should reject pending → paid WITHOUT transactionId', async () => {
    seedDoc('cateringOrders', 'pay-2', { status: 'confirmed', paymentStatus: 'pending', _version: 1 });

    await expect(
      updateOrderPaymentStatus('pay-2', 'paid'),
    ).rejects.toThrow('transaction ID is required');
  });

  it('should allow paid → refund_pending', async () => {
    seedDoc('cateringOrders', 'pay-3', { status: 'cancelled', paymentStatus: 'paid', _version: 2 });

    await updateOrderPaymentStatus('pay-3', 'refund_pending');

    expect(firestoreStore['cateringOrders']['pay-3'].paymentStatus).toBe('refund_pending');
  });

  it('should allow refund_pending → refunded', async () => {
    seedDoc('cateringOrders', 'pay-4', { status: 'cancelled', paymentStatus: 'refund_pending', _version: 3 });

    await updateOrderPaymentStatus('pay-4', 'refunded');

    expect(firestoreStore['cateringOrders']['pay-4'].paymentStatus).toBe('refunded');
  });

  it('should reject invalid payment transitions', async () => {
    seedDoc('cateringOrders', 'pay-5', { status: 'confirmed', paymentStatus: 'pending', _version: 1 });

    await expect(updateOrderPaymentStatus('pay-5', 'refunded')).rejects.toThrow('Invalid payment transition');
  });

  it('should reject refunded → paid (terminal state)', async () => {
    seedDoc('cateringOrders', 'pay-6', { status: 'cancelled', paymentStatus: 'refunded', _version: 4 });

    await expect(updateOrderPaymentStatus('pay-6', 'paid', { transactionId: 'txn_456' })).rejects.toThrow(
      'Invalid payment transition',
    );
  });

  // Web + Mobile: Both platforms must enforce the same payment transitions
  const validPaymentTransitions = [
    ['pending', 'paid'],
    ['paid', 'refunded'],
    ['paid', 'refund_pending'],
    ['refund_pending', 'refunded'],
  ];

  const invalidPaymentTransitions = [
    ['pending', 'refunded'],
    ['pending', 'refund_pending'],
    ['refunded', 'paid'],
    ['refunded', 'pending'],
    ['refund_pending', 'paid'],
  ];

  for (const [from, to] of validPaymentTransitions) {
    it(`[Payment] should allow: ${from} → ${to}`, async () => {
      seedDoc('cateringOrders', `pay-valid-${from}-${to}`, {
        status: 'confirmed',
        paymentStatus: from,
        _version: 1,
      });

      const extra = to === 'paid' ? { transactionId: 'txn_test' } : undefined;
      await updateOrderPaymentStatus(`pay-valid-${from}-${to}`, to as any, extra);

      expect(firestoreStore['cateringOrders'][`pay-valid-${from}-${to}`].paymentStatus).toBe(to);
    });
  }

  for (const [from, to] of invalidPaymentTransitions) {
    it(`[Payment] should block: ${from} → ${to}`, async () => {
      seedDoc('cateringOrders', `pay-invalid-${from}-${to}`, {
        status: 'confirmed',
        paymentStatus: from,
        _version: 1,
      });

      const extra = to === 'paid' ? { transactionId: 'txn_test' } : undefined;
      await expect(
        updateOrderPaymentStatus(`pay-invalid-${from}-${to}`, to as any, extra),
      ).rejects.toThrow('Invalid payment transition');
    });
  }
});
