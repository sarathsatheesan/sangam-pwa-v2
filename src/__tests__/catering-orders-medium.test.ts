// ═══════════════════════════════════════════════════════════════════════
// MEDIUM FIX TESTS (M1–M9)
// Pagination, retry, ETA validation, dedup, quote races
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetFirestoreStore, seedDoc, MockTimestamp, firestoreStore } from './setup';
import {
  addOrderNote,
  subscribeToOrderNotes,
  fetchOlderOrderNotes,
  validateDeliveryETA,
  notifyCustomerOfVendorDecline,
  hasExistingReview,
  createReviewWithDedup,
  checkAndRejectExpiredModifications,
} from '@/services/catering/cateringOrders';
import {
  isQuoteRequestEditable,
  isQuoteResponseEditable,
  updateQuoteRequest,
  updateQuoteResponse,
  acceptQuoteResponse,
} from '@/services/catering/cateringQuotes';

beforeEach(() => {
  resetFirestoreStore();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// M-1: Message pagination
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-M1: Message pagination', () => {
  it('subscribeToOrderNotes should limit results to pageSize', () => {
    // Seed 60 notes
    const notesCol = 'cateringOrders/ord-msg/notes';
    for (let i = 0; i < 60; i++) {
      seedDoc(notesCol, `note-${i}`, {
        text: `Message ${i}`,
        senderId: 'user-1',
        createdAt: MockTimestamp.fromMillis(Date.now() - (60 - i) * 1000),
      });
    }

    let receivedNotes: any[] = [];
    subscribeToOrderNotes('ord-msg', (notes) => {
      receivedNotes = notes;
    }, 50);

    // Should cap at 50 (the pageSize)
    expect(receivedNotes.length).toBe(50);
  });

  it('subscribeToOrderNotes should return all notes if fewer than pageSize', () => {
    const notesCol = 'cateringOrders/ord-small/notes';
    for (let i = 0; i < 10; i++) {
      seedDoc(notesCol, `note-${i}`, {
        text: `Message ${i}`,
        senderId: 'user-1',
        createdAt: MockTimestamp.fromMillis(Date.now() - (10 - i) * 1000),
      });
    }

    let receivedNotes: any[] = [];
    subscribeToOrderNotes('ord-small', (notes) => {
      receivedNotes = notes;
    });

    expect(receivedNotes.length).toBe(10);
  });

  it('fetchOlderOrderNotes should return notes older than the given timestamp', async () => {
    const notesCol = 'cateringOrders/ord-older/notes';
    const baseTime = Date.now();

    // Note at t-5s (should be fetched)
    seedDoc(notesCol, 'old-1', {
      text: 'Old message',
      senderId: 'user-1',
      createdAt: MockTimestamp.fromMillis(baseTime - 5000),
    });
    // Note at t-1s (this is the "oldest" in current page)
    seedDoc(notesCol, 'current-1', {
      text: 'Current message',
      senderId: 'user-1',
      createdAt: MockTimestamp.fromMillis(baseTime - 1000),
    });

    const olderNotes = await fetchOlderOrderNotes(
      'ord-older',
      MockTimestamp.fromMillis(baseTime - 1000),
    );

    expect(olderNotes.length).toBe(1);
    expect(olderNotes[0].text).toBe('Old message');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// M-2: Send retry with exponential backoff
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-M2: Message send retry', () => {
  it('should succeed on first attempt', async () => {
    const id = await addOrderNote('ord-retry', {
      text: 'Hello',
      senderId: 'user-1',
      senderName: 'Test User',
    });

    expect(id).toBeTruthy();
  });

  it('should accept maxRetries parameter', async () => {
    // With default mock, this should succeed immediately
    const id = await addOrderNote('ord-retry2', {
      text: 'Testing retries',
      senderId: 'user-1',
      senderName: 'Test User',
    }, 5);

    expect(id).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// M-3: ETA validation
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-M3: Delivery ETA validation', () => {
  // Web: Full datetime picker available
  // Mobile: Native date/time pickers — same validation applies

  it('should accept a future ETA before the event date', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
    const eventDate = '2026-12-31';

    const result = validateDeliveryETA(futureDate, eventDate);
    expect(result.valid).toBe(true);
  });

  it('should reject a past ETA', () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

    const result = validateDeliveryETA(pastDate);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be in the future');
  });

  it('should reject ETA after the event date', () => {
    const farFuture = new Date('2027-06-01T10:00:00');
    const eventDate = '2027-01-15';

    const result = validateDeliveryETA(farFuture, eventDate);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('after the event date');
  });

  it('should reject an invalid date string', () => {
    const result = validateDeliveryETA('not-a-date');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid date/time format');
  });

  it('should handle string ETA input (from mobile date picker)', () => {
    const futureIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const result = validateDeliveryETA(futureIso);
    expect(result.valid).toBe(true);
  });

  it('should handle Firestore Timestamp event date', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const eventTimestamp = MockTimestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = validateDeliveryETA(futureDate, eventTimestamp);
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// M-5: Vendor decline notification to customer
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-M5: Vendor decline surfaced to customer', () => {
  it('should call sendCateringNotification with correct params', async () => {
    const { sendCateringNotification } = await import('@/services/catering/cateringNotifications');

    await notifyCustomerOfVendorDecline('cust-1', 'ord-decline', 'Spice Palace', 'Too busy');

    expect(sendCateringNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'cust-1',
        type: 'order_cancelled',
        orderId: 'ord-decline',
        businessName: 'Spice Palace',
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// M-6: Review deduplication
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-M6: Review deduplication guard', () => {
  it('hasExistingReview should return false when no review exists', async () => {
    const exists = await hasExistingReview('ord-no-review', 'cust-1');
    expect(exists).toBe(false);
  });

  it('hasExistingReview should return true when review exists', async () => {
    seedDoc('cateringReviews', 'rev-1', {
      orderId: 'ord-reviewed',
      customerId: 'cust-1',
      rating: 5,
    });

    const exists = await hasExistingReview('ord-reviewed', 'cust-1');
    expect(exists).toBe(true);
  });

  it('createReviewWithDedup should create review when none exists', async () => {
    const id = await createReviewWithDedup({
      orderId: 'ord-new-review',
      customerId: 'cust-2',
      businessId: 'biz-1',
      rating: 4,
      comment: 'Great food!',
    });

    expect(id).toBeTruthy();
  });

  it('createReviewWithDedup should throw when duplicate review exists', async () => {
    seedDoc('cateringReviews', 'rev-dup', {
      orderId: 'ord-dup-review',
      customerId: 'cust-3',
      rating: 3,
    });

    await expect(
      createReviewWithDedup({
        orderId: 'ord-dup-review',
        customerId: 'cust-3',
        businessId: 'biz-2',
        rating: 5,
      }),
    ).rejects.toThrow('already reviewed');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// M-7: Modification timeout enforcement
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-M7: Expired modification auto-reject', () => {
  it('should auto-reject expired modifications and revert items', async () => {
    const expiredAt = MockTimestamp.fromMillis(Date.now() - 60 * 60 * 1000); // expired 1hr ago
    const originalItems = [
      { menuItemId: 'm1', name: 'Curry', qty: 30, unitPrice: 1000, pricingType: 'per_person' },
    ];

    seedDoc('cateringOrders', 'mod-expired', {
      businessId: 'biz-timer',
      customerId: 'cust-timer',
      status: 'confirmed',
      _version: 2,
      pendingModification: true,
      modificationExpiresAt: expiredAt,
      originalItems,
      items: [{ menuItemId: 'm1', name: 'Curry', qty: 50, unitPrice: 1000, pricingType: 'per_person' }],
      subtotal: 50000,
      total: 54125,
    });

    const count = await checkAndRejectExpiredModifications('biz-timer', 'vendor');

    expect(count).toBe(1);
    const updated = firestoreStore['cateringOrders']['mod-expired'];
    expect(updated.pendingModification).toBe(false);
    expect(updated.items).toEqual(originalItems);
    expect(updated.subtotal).toBe(30000); // reverted
  });

  it('should NOT reject modifications that have not expired', async () => {
    const futureExpiry = MockTimestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

    seedDoc('cateringOrders', 'mod-active', {
      businessId: 'biz-timer',
      customerId: 'cust-timer',
      status: 'confirmed',
      _version: 2,
      pendingModification: true,
      modificationExpiresAt: futureExpiry,
      originalItems: [{ menuItemId: 'm1', name: 'Curry', qty: 30, unitPrice: 1000, pricingType: 'per_person' }],
    });

    const count = await checkAndRejectExpiredModifications('biz-timer', 'vendor');
    expect(count).toBe(0);
  });

  it('should work for customer role (checks customerId)', async () => {
    const expiredAt = MockTimestamp.fromMillis(Date.now() - 1000);
    const originalItems = [{ menuItemId: 'm1', name: 'Rice', qty: 20, unitPrice: 500, pricingType: 'per_person' }];

    seedDoc('cateringOrders', 'mod-cust-exp', {
      businessId: 'biz-other',
      customerId: 'cust-timer',
      status: 'confirmed',
      _version: 2,
      pendingModification: true,
      modificationExpiresAt: expiredAt,
      originalItems,
      items: [{ menuItemId: 'm1', name: 'Rice', qty: 40, unitPrice: 500, pricingType: 'per_person' }],
    });

    const count = await checkAndRejectExpiredModifications('cust-timer', 'customer');
    expect(count).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// M-8: Duplicate quote acceptance race condition
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-M8: Quote acceptance race prevention', () => {
  it('should accept a quote response via transaction', async () => {
    seedDoc('cateringQuoteRequests', 'qr-race', {
      status: 'open',
      items: [{ name: 'Samosa', qty: 100 }],
      responseCount: 1,
    });

    seedDoc('cateringQuoteResponses', 'resp-race', {
      quoteRequestId: 'qr-race',
      businessId: 'biz-race',
      businessName: 'Samosa King',
      status: 'submitted',
      quotedItems: [{ name: 'Samosa', qty: 100, unitPrice: 500, pricingType: 'per_piece' }],
    });

    await acceptQuoteResponse(
      'resp-race',
      'qr-race',
      { customerName: 'Amy', customerEmail: 'amy@test.com', customerPhone: '555-0400' },
    );

    const request = firestoreStore['cateringQuoteRequests']['qr-race'];
    expect(request.status).toBe('accepted');
    expect(request.selectedResponseId).toBe('resp-race');
  });

  it('should reject if request is already accepted (concurrent call lost)', async () => {
    seedDoc('cateringQuoteRequests', 'qr-already', {
      status: 'accepted',
      selectedResponseId: 'resp-winner',
    });

    seedDoc('cateringQuoteResponses', 'resp-loser', {
      quoteRequestId: 'qr-already',
      businessId: 'biz-2',
      status: 'submitted',
    });

    await expect(
      acceptQuoteResponse(
        'resp-loser',
        'qr-already',
        { customerName: 'Bob', customerEmail: 'bob@test.com', customerPhone: '555-0500' },
      ),
    ).rejects.toThrow('already been fully accepted');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// M-9: Server-side quote editability enforcement
// ═══════════════════════════════════════════════════════════════════════
describe('FIX-M9: Server-side quote editability', () => {
  // isQuoteRequestEditable
  it('should return true for open request within edit window with sufficient lead time', () => {
    const result = isQuoteRequestEditable({
      status: 'open',
      createdAt: MockTimestamp.fromMillis(Date.now() - 1 * 60 * 60 * 1000), // 1hr ago
      eventDate: '2026-12-31',
    } as any);
    expect(result).toBe(true);
  });

  it('should return false for non-open request', () => {
    const result = isQuoteRequestEditable({
      status: 'accepted',
      createdAt: MockTimestamp.fromMillis(Date.now()),
      eventDate: '2026-12-31',
    } as any);
    expect(result).toBe(false);
  });

  it('should return false if edit window expired (>24hr)', () => {
    const result = isQuoteRequestEditable({
      status: 'open',
      createdAt: MockTimestamp.fromMillis(Date.now() - 25 * 60 * 60 * 1000),
      eventDate: '2026-12-31',
    } as any);
    expect(result).toBe(false);
  });

  it('should return false if event is within 2 days', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result = isQuoteRequestEditable({
      status: 'open',
      createdAt: MockTimestamp.fromMillis(Date.now() - 1000),
      eventDate: tomorrow.toISOString().split('T')[0],
    } as any);
    expect(result).toBe(false);
  });

  // isQuoteResponseEditable
  it('should return true for submitted response within 24hr window', () => {
    const result = isQuoteResponseEditable({
      status: 'submitted',
      createdAt: MockTimestamp.fromMillis(Date.now() - 60 * 1000), // 1 min ago
    } as any);
    expect(result).toBe(true);
  });

  it('should return false for accepted response', () => {
    const result = isQuoteResponseEditable({
      status: 'accepted',
      createdAt: MockTimestamp.fromMillis(Date.now() - 60 * 1000),
    } as any);
    expect(result).toBe(false);
  });

  // Server-side guard on updateQuoteResponse
  it('updateQuoteResponse should reject non-submitted responses', async () => {
    seedDoc('cateringQuoteResponses', 'resp-closed', {
      status: 'accepted',
      createdAt: MockTimestamp.fromMillis(Date.now()),
    });

    await expect(
      updateQuoteResponse('resp-closed', { message: 'Updated message' }),
    ).rejects.toThrow('Only submitted quotes can be edited');
  });

  it('updateQuoteResponse should reject if 24hr window expired', async () => {
    seedDoc('cateringQuoteResponses', 'resp-old', {
      status: 'submitted',
      createdAt: MockTimestamp.fromMillis(Date.now() - 25 * 60 * 60 * 1000),
    });

    await expect(
      updateQuoteResponse('resp-old', { message: 'Too late' }),
    ).rejects.toThrow('Edit window (24 hours) has expired');
  });

  // Server-side guard on updateQuoteRequest
  it('updateQuoteRequest should reject if event is less than 2 days away', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    seedDoc('cateringQuoteRequests', 'qr-soon', {
      status: 'open',
      createdAt: MockTimestamp.fromMillis(Date.now() - 1000),
      eventDate: tomorrow.toISOString().split('T')[0],
    });

    await expect(
      updateQuoteRequest('qr-soon', { headcount: 200 }),
    ).rejects.toThrow('less than 2 days away');
  });
});
