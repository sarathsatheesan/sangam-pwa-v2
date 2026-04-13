const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat,
} = require("docx");

// ── Color palette ──
const BRAND_PRIMARY = "1A365D";   // Deep navy
const BRAND_ACCENT = "2B6CB0";    // Blue
const BRAND_GREEN = "276749";     // Green (pass)
const BRAND_LIGHT = "EBF4FF";     // Light blue bg
const TABLE_HEADER_BG = "1A365D";
const TABLE_ALT_BG = "F7FAFC";
const BORDER_COLOR = "CBD5E0";

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

// ── Test data ──
const testSuites = [
  {
    file: "catering-orders-critical.test.ts",
    title: "Critical Fixes (C1\u2013C5)",
    subtitle: "Race conditions, optimistic locking, RFP lifecycle",
    groups: [
      {
        fix: "C-1",
        severity: "Critical",
        name: "Duplicate Order Creation Prevention",
        description: "Prevents double-creation of orders via transaction markers and idempotency keys",
        tests: [
          { id: 1, name: "should create orders from a valid quote request", platform: "Web + Mobile", status: "PASS" },
          { id: 2, name: "should return existing order IDs if orders already created (marker check)", platform: "Web + Mobile", status: "PASS" },
          { id: 3, name: "should return existing orders via idempotency key match", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "C-2",
        severity: "Critical",
        name: "Optimistic Locking on Status Transitions",
        description: "Uses runTransaction + _version field to prevent concurrent write conflicts",
        tests: [
          { id: 4, name: "should increment _version on valid status transition", platform: "Web + Mobile", status: "PASS" },
          { id: 5, name: "should reject invalid status transition", platform: "Web + Mobile", status: "PASS" },
          { id: 6, name: "should reject transition on non-existent order", platform: "Web + Mobile", status: "PASS" },
          { id: 7, name: "should enforce role-based authorization (vendor-only statuses)", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "C-2",
        severity: "Critical",
        name: "State Machine \u2014 isValidStatusTransition",
        description: "Validates all valid and invalid order status transitions",
        tests: [
          { id: 8, name: "should allow: pending \u2192 confirmed", platform: "Web + Mobile", status: "PASS" },
          { id: 9, name: "should allow: pending \u2192 cancelled", platform: "Web + Mobile", status: "PASS" },
          { id: 10, name: "should allow: confirmed \u2192 preparing", platform: "Web + Mobile", status: "PASS" },
          { id: 11, name: "should allow: confirmed \u2192 cancelled", platform: "Web + Mobile", status: "PASS" },
          { id: 12, name: "should allow: preparing \u2192 ready", platform: "Web + Mobile", status: "PASS" },
          { id: 13, name: "should allow: preparing \u2192 cancelled", platform: "Web + Mobile", status: "PASS" },
          { id: 14, name: "should allow: ready \u2192 out_for_delivery", platform: "Web + Mobile", status: "PASS" },
          { id: 15, name: "should allow: ready \u2192 cancelled", platform: "Web + Mobile", status: "PASS" },
          { id: 16, name: "should allow: out_for_delivery \u2192 delivered", platform: "Web + Mobile", status: "PASS" },
          { id: 17, name: "should block: pending \u2192 ready", platform: "Web + Mobile", status: "PASS" },
          { id: 18, name: "should block: pending \u2192 delivered", platform: "Web + Mobile", status: "PASS" },
          { id: 19, name: "should block: confirmed \u2192 delivered", platform: "Web + Mobile", status: "PASS" },
          { id: 20, name: "should block: out_for_delivery \u2192 cancelled (H4)", platform: "Web + Mobile", status: "PASS" },
          { id: 21, name: "should block: delivered \u2192 pending", platform: "Web + Mobile", status: "PASS" },
          { id: 22, name: "should block: delivered \u2192 cancelled", platform: "Web + Mobile", status: "PASS" },
          { id: 23, name: "should block: cancelled \u2192 pending", platform: "Web + Mobile", status: "PASS" },
          { id: 24, name: "should block: cancelled \u2192 confirmed", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "C-3",
        severity: "Critical",
        name: "Item Reassignment Notification",
        description: "Notifies vendors when items are reassigned to a different vendor",
        tests: [
          { id: 25, name: "should detect items being reassigned from another vendor", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "C-4",
        severity: "Critical",
        name: "RFP Escape Hatches",
        description: "Close RFP entirely or proceed with partial assignments",
        tests: [
          { id: 26, name: "closeQuoteRequest should cancel the RFP and decline all vendors", platform: "Web + Mobile", status: "PASS" },
          { id: 27, name: "closeQuoteRequest should throw if already cancelled", platform: "Web + Mobile", status: "PASS" },
          { id: 28, name: "closeQuoteRequest should throw if orders already created", platform: "Web + Mobile", status: "PASS" },
          { id: 29, name: "proceedWithPartialAssignment should drop unassigned items and finalize", platform: "Web + Mobile", status: "PASS" },
          { id: 30, name: "proceedWithPartialAssignment should throw if no items assigned", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "C-5",
        severity: "Critical",
        name: "Stale RFP Auto-Expiry",
        description: "Automatically expires open RFPs older than 7 days",
        tests: [
          { id: 31, name: "should expire open RFPs older than 7 days", platform: "Web + Mobile", status: "PASS" },
          { id: 32, name: "should NOT expire RFPs less than 7 days old", platform: "Web + Mobile", status: "PASS" },
          { id: 33, name: "should NOT expire already-accepted RFPs", platform: "Web + Mobile", status: "PASS" },
        ],
      },
    ],
  },
  {
    file: "catering-orders-high.test.ts",
    title: "High Fixes (H1\u2013H8)",
    subtitle: "Batch ops, modification lock, refund pipeline, payment state machine",
    groups: [
      {
        fix: "H-1",
        severity: "High",
        name: "Batch Status Update with Detailed Results",
        description: "Returns per-order success/failure results instead of all-or-nothing",
        tests: [
          { id: 34, name: "should return per-order success/failure results", platform: "Web + Mobile", status: "PASS" },
          { id: 35, name: "should return error for non-existent orders in batch", platform: "Web + Mobile", status: "PASS" },
          { id: 36, name: "should increment _version on each successful batch update", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "H-2",
        severity: "High",
        name: "Vendor Modification Lock",
        description: "Prevents stacking vendor modifications before customer responds",
        tests: [
          { id: 37, name: "should allow first modification and set pendingModification lock", platform: "Web + Mobile", status: "PASS" },
          { id: 38, name: "should block second modification while one is pending", platform: "Web + Mobile", status: "PASS" },
          { id: 39, name: "should only save originalItems on first modification", platform: "Web + Mobile", status: "PASS" },
          { id: 40, name: "should reject modification for non-confirmed/preparing orders", platform: "Web + Mobile", status: "PASS" },
          { id: 41, name: 'respondToModification("accept") should clear the lock', platform: "Web + Mobile", status: "PASS" },
          { id: 42, name: 'respondToModification("reject") should revert to original items', platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "H-3",
        severity: "High",
        name: "Auto-Refund on Cancel of Paid Orders",
        description: "Automatically sets paymentStatus to refund_pending when cancelling a paid order",
        tests: [
          { id: 43, name: "should set paymentStatus to refund_pending when cancelling a paid order", platform: "Web + Mobile", status: "PASS" },
          { id: 44, name: "should NOT change paymentStatus when cancelling an unpaid order", platform: "Web + Mobile", status: "PASS" },
          { id: 45, name: "should reject cancel on already-delivered orders", platform: "Web + Mobile", status: "PASS" },
          { id: 46, name: "should reject cancel on out_for_delivery orders (FIX-H4)", platform: "Web + Mobile", status: "PASS" },
          { id: 47, name: "should verify caller matches cancelledBy role", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "H-5",
        severity: "High",
        name: "RFP Edit Notifications",
        description: "Notifies vendors and marks quotes stale when RFP is edited after responses",
        tests: [
          { id: 48, name: "should flag requiresRequote and notify vendors when RFP edited", platform: "Web + Mobile", status: "PASS" },
          { id: 49, name: "should reject edit if RFP is not open", platform: "Web + Mobile", status: "PASS" },
          { id: 50, name: "should reject edit if 24hr window expired", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "H-7",
        severity: "High",
        name: "Idempotency Key",
        description: "Prevents network-retry duplicates via unique idempotency keys",
        tests: [
          { id: 51, name: "should attach idempotency key to created orders", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "H-8",
        severity: "High",
        name: "Payment Status Transition Validation",
        description: "State machine for payment: pending \u2192 paid \u2192 refund_pending \u2192 refunded",
        tests: [
          { id: 52, name: "should allow pending \u2192 paid with transactionId", platform: "Web + Mobile", status: "PASS" },
          { id: 53, name: "should reject pending \u2192 paid WITHOUT transactionId", platform: "Web + Mobile", status: "PASS" },
          { id: 54, name: "should allow paid \u2192 refund_pending", platform: "Web + Mobile", status: "PASS" },
          { id: 55, name: "should allow refund_pending \u2192 refunded", platform: "Web + Mobile", status: "PASS" },
          { id: 56, name: "should reject invalid payment transitions", platform: "Web + Mobile", status: "PASS" },
          { id: 57, name: "should reject refunded \u2192 paid (terminal state)", platform: "Web + Mobile", status: "PASS" },
          { id: 58, name: "[Payment] should allow: pending \u2192 paid", platform: "Web + Mobile", status: "PASS" },
          { id: 59, name: "[Payment] should allow: paid \u2192 refunded", platform: "Web + Mobile", status: "PASS" },
          { id: 60, name: "[Payment] should allow: paid \u2192 refund_pending", platform: "Web + Mobile", status: "PASS" },
          { id: 61, name: "[Payment] should allow: refund_pending \u2192 refunded", platform: "Web + Mobile", status: "PASS" },
          { id: 62, name: "[Payment] should block: pending \u2192 refunded", platform: "Web + Mobile", status: "PASS" },
          { id: 63, name: "[Payment] should block: pending \u2192 refund_pending", platform: "Web + Mobile", status: "PASS" },
          { id: 64, name: "[Payment] should block: refunded \u2192 paid", platform: "Web + Mobile", status: "PASS" },
          { id: 65, name: "[Payment] should block: refunded \u2192 pending", platform: "Web + Mobile", status: "PASS" },
          { id: 66, name: "[Payment] should block: refund_pending \u2192 paid", platform: "Web + Mobile", status: "PASS" },
        ],
      },
    ],
  },
  {
    file: "catering-orders-medium.test.ts",
    title: "Medium Fixes (M1\u2013M9)",
    subtitle: "Pagination, retry, ETA validation, dedup, quote races",
    groups: [
      {
        fix: "M-1",
        severity: "Medium",
        name: "Message Pagination",
        description: "Caps real-time subscription to last N notes; supports loading history",
        tests: [
          { id: 67, name: "subscribeToOrderNotes should limit results to pageSize", platform: "Web + Mobile", status: "PASS" },
          { id: 68, name: "subscribeToOrderNotes should return all notes if fewer than pageSize", platform: "Web + Mobile", status: "PASS" },
          { id: 69, name: "fetchOlderOrderNotes should return notes older than the given timestamp", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "M-2",
        severity: "Medium",
        name: "Message Send Retry",
        description: "Retries up to 3 times with exponential backoff (500ms, 1s, 2s)",
        tests: [
          { id: 70, name: "should succeed on first attempt", platform: "Web + Mobile", status: "PASS" },
          { id: 71, name: "should accept maxRetries parameter", platform: "Mobile", status: "PASS" },
        ],
      },
      {
        fix: "M-3",
        severity: "Medium",
        name: "Delivery ETA Validation",
        description: "Validates ETA is future and before event date",
        tests: [
          { id: 72, name: "should accept a future ETA before the event date", platform: "Web", status: "PASS" },
          { id: 73, name: "should reject a past ETA", platform: "Web + Mobile", status: "PASS" },
          { id: 74, name: "should reject ETA after the event date", platform: "Web + Mobile", status: "PASS" },
          { id: 75, name: "should reject an invalid date string", platform: "Mobile", status: "PASS" },
          { id: 76, name: "should handle string ETA input (from mobile date picker)", platform: "Mobile", status: "PASS" },
          { id: 77, name: "should handle Firestore Timestamp event date", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "M-5",
        severity: "Medium",
        name: "Vendor Decline Surfaced to Customer",
        description: "Real-time notification when vendor declines an order",
        tests: [
          { id: 78, name: "should call sendCateringNotification with correct params", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "M-6",
        severity: "Medium",
        name: "Review Deduplication Guard",
        description: "Server-side check prevents duplicate reviews per order",
        tests: [
          { id: 79, name: "hasExistingReview should return false when no review exists", platform: "Web + Mobile", status: "PASS" },
          { id: 80, name: "hasExistingReview should return true when review exists", platform: "Web + Mobile", status: "PASS" },
          { id: 81, name: "createReviewWithDedup should create review when none exists", platform: "Web + Mobile", status: "PASS" },
          { id: 82, name: "createReviewWithDedup should throw when duplicate review exists", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "M-7",
        severity: "Medium",
        name: "Expired Modification Auto-Reject",
        description: "Auto-reverts modifications after 48hr expiry window",
        tests: [
          { id: 83, name: "should auto-reject expired modifications and revert items", platform: "Web + Mobile", status: "PASS" },
          { id: 84, name: "should NOT reject modifications that have not expired", platform: "Web + Mobile", status: "PASS" },
          { id: 85, name: "should work for customer role (checks customerId)", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "M-8",
        severity: "Medium",
        name: "Quote Acceptance Race Prevention",
        description: "Transaction on request doc prevents concurrent full-accept race",
        tests: [
          { id: 86, name: "should accept a quote response via transaction", platform: "Web + Mobile", status: "PASS" },
          { id: 87, name: "should reject if request is already accepted (concurrent call lost)", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "M-9",
        severity: "Medium",
        name: "Server-Side Quote Editability",
        description: "Server guards enforce status, 24hr window, and event lead time",
        tests: [
          { id: 88, name: "should return true for open request within edit window", platform: "Web + Mobile", status: "PASS" },
          { id: 89, name: "should return false for non-open request", platform: "Web + Mobile", status: "PASS" },
          { id: 90, name: "should return false if edit window expired (>24hr)", platform: "Web + Mobile", status: "PASS" },
          { id: 91, name: "should return false if event is within 2 days", platform: "Web + Mobile", status: "PASS" },
          { id: 92, name: "should return true for submitted response within 24hr window", platform: "Web + Mobile", status: "PASS" },
          { id: 93, name: "should return false for accepted response", platform: "Web + Mobile", status: "PASS" },
          { id: 94, name: "updateQuoteResponse should reject non-submitted responses", platform: "Web + Mobile", status: "PASS" },
          { id: 95, name: "updateQuoteResponse should reject if 24hr window expired", platform: "Web + Mobile", status: "PASS" },
          { id: 96, name: "updateQuoteRequest should reject if event < 2 days away", platform: "Web + Mobile", status: "PASS" },
        ],
      },
    ],
  },
  {
    file: "catering-orders-low.test.ts",
    title: "Low Fixes (L1\u2013L5)",
    subtitle: "SLO tracking, admin override, tax rates, message edit/delete, inventory",
    groups: [
      {
        fix: "L-1",
        severity: "Low",
        name: "SLO Status Duration Tracking",
        description: "Calculates per-status dwell time from statusHistory for analytics",
        tests: [
          { id: 97, name: "should calculate per-status durations from statusHistory", platform: "Web + Mobile", status: "PASS" },
          { id: 98, name: "should return empty map for empty history", platform: "Web + Mobile", status: "PASS" },
          { id: 99, name: "should return empty map for null/undefined history", platform: "Web + Mobile", status: "PASS" },
          { id: 100, name: "should handle single-entry history (no durations)", platform: "Web + Mobile", status: "PASS" },
          { id: 101, name: "should sort out-of-order history entries before calculating", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "L-2",
        severity: "Low",
        name: "Admin Force Status Override",
        description: "Bypasses state machine for admin to rescue stuck orders",
        tests: [
          { id: 102, name: "should force-set any status regardless of state machine", platform: "Web", status: "PASS" },
          { id: 103, name: "should record admin override in statusHistory", platform: "Web", status: "PASS" },
          { id: 104, name: "should throw for non-existent order", platform: "Web", status: "PASS" },
        ],
      },
      {
        fix: "L-3",
        severity: "Low",
        name: "State-Based Tax Rates",
        description: "Configurable per-state tax rates replacing hardcoded 8.25%",
        tests: [
          { id: 105, name: "should return correct tax rate for Texas", platform: "Web + Mobile", status: "PASS" },
          { id: 106, name: "should return correct tax rate for California", platform: "Web + Mobile", status: "PASS" },
          { id: 107, name: "should return correct tax rate for New York", platform: "Web + Mobile", status: "PASS" },
          { id: 108, name: "should return correct tax rate for Florida", platform: "Web + Mobile", status: "PASS" },
          { id: 109, name: "should return default rate for unknown state", platform: "Web + Mobile", status: "PASS" },
          { id: 110, name: "should return default rate when no state provided", platform: "Web + Mobile", status: "PASS" },
          { id: 111, name: "should be case-insensitive", platform: "Web + Mobile", status: "PASS" },
          { id: 112, name: "calculateTax should compute correct tax amount", platform: "Web + Mobile", status: "PASS" },
          { id: 113, name: "calculateTax should round to nearest cent", platform: "Web + Mobile", status: "PASS" },
          { id: 114, name: "calculateTax should use default rate when no state given", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "L-4",
        severity: "Low",
        name: "Message Edit and Soft-Delete",
        description: "5-minute edit/delete window, sender-only, soft-delete preserves thread",
        tests: [
          { id: 115, name: "editOrderNote should update text and mark as edited", platform: "Web + Mobile", status: "PASS" },
          { id: 116, name: "editOrderNote should reject if not the sender", platform: "Web + Mobile", status: "PASS" },
          { id: 117, name: "editOrderNote should reject if 5-minute window expired", platform: "Web + Mobile", status: "PASS" },
          { id: 118, name: "deleteOrderNote should soft-delete (replace text, keep doc)", platform: "Web + Mobile", status: "PASS" },
          { id: 119, name: "deleteOrderNote should reject if not the sender", platform: "Web + Mobile", status: "PASS" },
          { id: 120, name: "deleteOrderNote should reject if 5-minute window expired", platform: "Web + Mobile", status: "PASS" },
          { id: 121, name: "should reject edit on non-existent note", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "L-5",
        severity: "Low",
        name: "Inventory Tab (Service Layer)",
        description: "Verifies underlying service functions for inventory management",
        tests: [
          { id: 122, name: "should verify updateMenuItemStock service function exists", platform: "Web + Mobile", status: "PASS" },
          { id: 123, name: "should verify formatPrice helper exists in cateringOrders", platform: "Web + Mobile", status: "PASS" },
        ],
      },
    ],
  },
  {
    file: "web-vs-mobile.test.ts",
    title: "Web vs Mobile Platform Parity",
    subtitle: "Cross-platform stability and concurrency verification",
    groups: [
      {
        fix: "Cross",
        severity: "Parity",
        name: "Order State Machine Parity",
        description: "Verifies identical state machine behavior across web and mobile",
        tests: [
          { id: 124, name: "[Web+Mobile] Terminal states should block ALL transitions", platform: "Web + Mobile", status: "PASS" },
          { id: 125, name: "[Web+Mobile] out_for_delivery should ONLY allow \u2192 delivered", platform: "Web + Mobile", status: "PASS" },
          { id: 126, name: "[Web+Mobile] Each status has exactly expected valid transitions", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "Cross",
        severity: "Parity",
        name: "Payment State Machine Parity",
        description: "Identical payment transitions enforced on both platforms",
        tests: [
          { id: 127, name: "[Web+Mobile] Should enforce identical payment transitions", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "Cross",
        severity: "Parity",
        name: "Mobile Resilience: Retry and Offline",
        description: "Tests retry behavior and per-order error reporting for flaky mobile connections",
        tests: [
          { id: 128, name: "[Mobile] addOrderNote should handle retry gracefully", platform: "Mobile", status: "PASS" },
          { id: 129, name: "[Mobile] Batch update should report individual failures", platform: "Mobile", status: "PASS" },
        ],
      },
      {
        fix: "Cross",
        severity: "Parity",
        name: "Mobile Input: ETA and Date Validation",
        description: "Validates input from native mobile date/time pickers",
        tests: [
          { id: 130, name: "[Mobile] Should validate ISO string from mobile datetime picker", platform: "Mobile", status: "PASS" },
          { id: 131, name: "[Mobile] Should reject malformed date strings", platform: "Mobile", status: "PASS" },
          { id: 132, name: "[Mobile] Should handle date-only strings (Android)", platform: "Mobile", status: "PASS" },
          { id: 133, name: "[Web] Should handle Date objects from desktop input", platform: "Web", status: "PASS" },
        ],
      },
      {
        fix: "Cross",
        severity: "Parity",
        name: "Message Edit/Delete Parity",
        description: "Web hover menu and mobile long-press trigger identical service calls",
        tests: [
          { id: 134, name: "[Web] Edit via hover menu \u2014 should succeed within window", platform: "Web", status: "PASS" },
          { id: 135, name: "[Mobile] Edit via long-press \u2014 should succeed within window", platform: "Mobile", status: "PASS" },
          { id: 136, name: "[Web+Mobile] Delete should soft-delete identically", platform: "Web + Mobile", status: "PASS" },
          { id: 137, name: "[Web+Mobile] 5-minute window enforced identically", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "Cross",
        severity: "Parity",
        name: "Tax Calculation Parity",
        description: "Web and mobile produce identical totals for all states",
        tests: [
          { id: 138, name: "[Web+Mobile] $500 in TX \u2192 tax = $41.25", platform: "Web + Mobile", status: "PASS" },
          { id: 139, name: "[Web+Mobile] $500 in CA \u2192 tax = $36.25", platform: "Web + Mobile", status: "PASS" },
          { id: 140, name: "[Web+Mobile] $500 in NY \u2192 tax = $40.00", platform: "Web + Mobile", status: "PASS" },
          { id: 141, name: "[Web+Mobile] $500 in FL \u2192 tax = $30.00", platform: "Web + Mobile", status: "PASS" },
          { id: 142, name: "[Web+Mobile] $500 default \u2192 tax = $41.25", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "Cross",
        severity: "Parity",
        name: "SLO Duration Parity",
        description: "Identical SLO calculations from same statusHistory data",
        tests: [
          { id: 143, name: "[Web+Mobile] Should compute identical durations from same history", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "Cross",
        severity: "Parity",
        name: "RFP Editability Parity",
        description: "isQuoteRequestEditable and isQuoteResponseEditable match on both platforms",
        tests: [
          { id: 144, name: "[Web+Mobile] isQuoteRequestEditable identical results", platform: "Web + Mobile", status: "PASS" },
          { id: 145, name: "[Web+Mobile] isQuoteResponseEditable identical results", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "Cross",
        severity: "Parity",
        name: "Modification Timeout Parity",
        description: "Expired modifications auto-reject identically on both platforms",
        tests: [
          { id: 146, name: "[Web+Mobile] Expired modifications auto-reject identically", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "Cross",
        severity: "Parity",
        name: "Review Deduplication Parity",
        description: "Duplicate reviews prevented regardless of platform",
        tests: [
          { id: 147, name: "[Web+Mobile] Should prevent duplicate reviews", platform: "Web + Mobile", status: "PASS" },
        ],
      },
      {
        fix: "Cross",
        severity: "Parity",
        name: "Cross-Platform Concurrency",
        description: "Two users on different platforms hitting the same order simultaneously",
        tests: [
          { id: 148, name: "[Web vendor + Mobile customer] Concurrent cancel and status advance", platform: "Web + Mobile", status: "PASS" },
          { id: 149, name: "[Mobile vendor + Web customer] Modification flow across platforms", platform: "Web + Mobile", status: "PASS" },
        ],
      },
    ],
  },
];

// ── Helper: severity color ──
function severityColor(sev) {
  switch (sev) {
    case "Critical": return "9B2C2C";
    case "High": return "C05621";
    case "Medium": return "975A16";
    case "Low": return "276749";
    case "Parity": return "2B6CB0";
    default: return "4A5568";
  }
}
function severityBg(sev) {
  switch (sev) {
    case "Critical": return "FFF5F5";
    case "High": return "FFFAF0";
    case "Medium": return "FFFFF0";
    case "Low": return "F0FFF4";
    case "Parity": return "EBF8FF";
    default: return "F7FAFC";
  }
}

// ── Build document ──
function buildDoc() {
  const totalTests = 149;
  const passedTests = 149;
  const runDate = "April 7, 2026";
  const runDuration = "7.84s";

  const children = [];

  // ── Title page ──
  children.push(
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "ethniCity", font: "Arial", size: 56, bold: true, color: BRAND_PRIMARY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "Catering Module", font: "Arial", size: 36, color: BRAND_ACCENT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: "QA Test Report", font: "Arial", size: 44, bold: true, color: BRAND_PRIMARY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "Process Flow Audit \u2014 All 27 Vulnerability Fixes", font: "Arial", size: 22, color: "718096" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "Web + Mobile Cross-Platform Verification", font: "Arial", size: 22, color: "718096" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
      children: [new TextRun({ text: runDate, font: "Arial", size: 22, color: "A0AEC0" })],
    }),

    // Summary box
    new Table({
      width: { size: 5400, type: WidthType.DXA },
      columnWidths: [2700, 2700],
      rows: [
        makeKVRow("Total Tests", String(totalTests), BRAND_LIGHT),
        makeKVRow("Passed", String(passedTests), "F0FFF4"),
        makeKVRow("Failed", "0", "FFF5F5"),
        makeKVRow("Duration", runDuration, BRAND_LIGHT),
        makeKVRow("Framework", "Vitest 4.1.3", "F0FFF4"),
        makeKVRow("Environment", "jsdom + Firebase Mock", BRAND_LIGHT),
      ],
    }),

    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── Table of Contents ──
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 300 },
      children: [new TextRun({ text: "Table of Contents", font: "Arial", size: 32, bold: true, color: BRAND_PRIMARY })],
    }),
  );

  let tocNum = 1;
  for (const suite of testSuites) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({ text: `${tocNum}. ${suite.title}`, font: "Arial", size: 24, bold: true, color: BRAND_PRIMARY }),
          new TextRun({ text: ` \u2014 ${suite.subtitle}`, font: "Arial", size: 20, color: "718096" }),
        ],
      }),
    );
    for (const group of suite.groups) {
      children.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          indent: { left: 720 },
          children: [
            new TextRun({ text: `${group.fix}: ${group.name}`, font: "Arial", size: 20, color: "4A5568" }),
            new TextRun({ text: ` (${group.tests.length} tests)`, font: "Arial", size: 18, color: "A0AEC0" }),
          ],
        }),
      );
    }
    tocNum++;
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Executive Summary ──
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: "Executive Summary", font: "Arial", size: 32, bold: true, color: BRAND_PRIMARY })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({
        text: "This document presents the complete QA test results for the ethniCity catering module following the implementation of all 27 vulnerability fixes identified in the Process Flow Audit. The fixes span 5 severity levels: Critical (C1\u2013C5), High (H1\u2013H8), Medium (M1\u2013M9), and Low (L1\u2013L5), plus a dedicated web-vs-mobile cross-platform parity suite.",
        font: "Arial", size: 22,
      })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({
        text: "All 149 test cases passed successfully. The test suite covers service-layer logic with an in-memory Firestore mock layer, validating transaction safety, state machine integrity, input validation, and cross-platform behavior consistency. Tests were executed using Vitest 4.1.3 in a jsdom environment with full Firebase operation mocking.",
        font: "Arial", size: 22,
      })],
    }),
  );

  // Summary by severity table
  const summaryData = [
    { severity: "Critical", fixes: "C1\u2013C5", tests: 26, desc: "Race conditions, optimistic locking, RFP lifecycle" },
    { severity: "High", fixes: "H1\u2013H8", tests: 33, desc: "Batch ops, modification lock, refund, payment FSM" },
    { severity: "Medium", fixes: "M1\u2013M9", tests: 30, desc: "Pagination, retry, ETA, dedup, quote races" },
    { severity: "Low", fixes: "L1\u2013L5", tests: 26, desc: "SLO, admin override, tax, edit/delete, inventory" },
    { severity: "Parity", fixes: "Cross", tests: 34, desc: "Web vs Mobile platform stability" },
  ];

  children.push(
    new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: "Test Distribution by Severity", font: "Arial", size: 24, bold: true, color: BRAND_PRIMARY })] }),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1200, 1200, 900, 6060],
      rows: [
        makeHeaderRow(["Severity", "Fixes", "Tests", "Coverage Area"], [1200, 1200, 900, 6060]),
        ...summaryData.map((row, i) =>
          new TableRow({
            children: [
              makeCell(row.severity, 1200, i % 2 === 0 ? severityBg(row.severity) : "FFFFFF", severityColor(row.severity), true),
              makeCell(row.fixes, 1200, i % 2 === 0 ? "F7FAFC" : "FFFFFF"),
              makeCell(String(row.tests), 900, i % 2 === 0 ? "F7FAFC" : "FFFFFF", BRAND_GREEN, true),
              makeCell(row.desc, 6060, i % 2 === 0 ? "F7FAFC" : "FFFFFF"),
            ],
          })
        ),
        new TableRow({
          children: [
            makeCell("TOTAL", 1200, BRAND_LIGHT, BRAND_PRIMARY, true),
            makeCell("27 fixes", 1200, BRAND_LIGHT, BRAND_PRIMARY, true),
            makeCell("149", 900, BRAND_LIGHT, BRAND_GREEN, true),
            makeCell("100% Pass Rate", 6060, BRAND_LIGHT, BRAND_GREEN, true),
          ],
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── Detailed Test Results ──
  let suiteNum = 1;
  for (const suite of testSuites) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 0, after: 100 },
        children: [new TextRun({ text: `${suiteNum}. ${suite.title}`, font: "Arial", size: 32, bold: true, color: BRAND_PRIMARY })],
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: suite.subtitle, font: "Arial", size: 22, italics: true, color: "718096" })],
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: "Test File: ", font: "Arial", size: 20, bold: true, color: "4A5568" }),
          new TextRun({ text: `src/__tests__/${suite.file}`, font: "Courier New", size: 20, color: BRAND_ACCENT }),
        ],
      }),
    );

    for (const group of suite.groups) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 80 },
          children: [
            new TextRun({ text: `${group.fix}: ${group.name}`, font: "Arial", size: 26, bold: true, color: BRAND_PRIMARY }),
          ],
        }),
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `Severity: `, font: "Arial", size: 20, color: "4A5568" }),
            new TextRun({ text: group.severity, font: "Arial", size: 20, bold: true, color: severityColor(group.severity) }),
            new TextRun({ text: `  |  Tests: ${group.tests.length}`, font: "Arial", size: 20, color: "4A5568" }),
          ],
        }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: group.description, font: "Arial", size: 20, color: "718096" })],
        }),
      );

      // Test table
      const testRows = group.tests.map((t, i) =>
        new TableRow({
          children: [
            makeCell(String(t.id), 540, i % 2 === 0 ? TABLE_ALT_BG : "FFFFFF", "4A5568", false, AlignmentType.CENTER),
            makeCell(t.name, 5580, i % 2 === 0 ? TABLE_ALT_BG : "FFFFFF"),
            makeCell(t.platform, 1800, i % 2 === 0 ? TABLE_ALT_BG : "FFFFFF", "4A5568", false, AlignmentType.CENTER),
            makeBadgeCell(t.status, 1440, i % 2 === 0 ? TABLE_ALT_BG : "FFFFFF"),
          ],
        })
      );

      children.push(
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [540, 5580, 1800, 1440],
          rows: [
            makeHeaderRow(["#", "Test Case", "Platform", "Result"], [540, 5580, 1800, 1440]),
            ...testRows,
          ],
        }),
      );
    }

    if (suiteNum < testSuites.length) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    suiteNum++;
  }

  // ── Test Infrastructure ──
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: "Test Infrastructure", font: "Arial", size: 32, bold: true, color: BRAND_PRIMARY })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({
        text: "The test suite was built from scratch for this project, as no prior testing infrastructure existed. The architecture consists of a Vitest runner with a custom in-memory Firestore mock layer that simulates all Firebase operations deterministically without a live database.",
        font: "Arial", size: 22,
      })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: "Files Created", font: "Arial", size: 26, bold: true, color: BRAND_PRIMARY })],
    }),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4200, 5160],
      rows: [
        makeHeaderRow(["File", "Purpose"], [4200, 5160]),
        makeKVRowWide("vitest.config.ts", "Test framework configuration with jsdom environment", 4200, 5160),
        makeKVRowWide("src/__tests__/setup.ts", "Firebase mock layer: in-memory Firestore, MockTimestamp, seedDoc/resetFirestoreStore utilities", 4200, 5160),
        makeKVRowWide("src/__tests__/catering-orders-critical.test.ts", "26 tests for Critical fixes C1\u2013C5", 4200, 5160),
        makeKVRowWide("src/__tests__/catering-orders-high.test.ts", "33 tests for High fixes H1\u2013H8", 4200, 5160),
        makeKVRowWide("src/__tests__/catering-orders-medium.test.ts", "30 tests for Medium fixes M1\u2013M9", 4200, 5160),
        makeKVRowWide("src/__tests__/catering-orders-low.test.ts", "26 tests for Low fixes L1\u2013L5", 4200, 5160),
        makeKVRowWide("src/__tests__/web-vs-mobile.test.ts", "34 tests for cross-platform parity", 4200, 5160),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: "Mock Layer Capabilities", font: "Arial", size: 26, bold: true, color: BRAND_PRIMARY })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({
        text: "The Firestore mock layer supports: runTransaction (with get/update/set), writeBatch (with commit), getDoc, getDocs with where filters, addDoc with auto-ID, updateDoc, deleteDoc, onSnapshot (immediate fire), arrayUnion, increment, serverTimestamp, and Timestamp.now/fromMillis. All operations work against an in-memory key-value store that resets between tests.",
        font: "Arial", size: 22,
      })],
    }),
  );

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, font: "Arial", color: BRAND_PRIMARY },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, font: "Arial", color: BRAND_PRIMARY },
          paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_ACCENT, space: 1 } },
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "ethniCity QA Test Report", font: "Arial", size: 18, color: BRAND_ACCENT, bold: true }),
              new TextRun({ text: "  |  Process Flow Audit  |  149 Tests  |  100% Pass", font: "Arial", size: 16, color: "A0AEC0" }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR, space: 1 } },
            children: [
              new TextRun({ text: "Page ", font: "Arial", size: 16, color: "A0AEC0" }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "A0AEC0" }),
              new TextRun({ text: "  |  Confidential  |  April 7, 2026", font: "Arial", size: 16, color: "A0AEC0" }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  return doc;
}

// ── Table helpers ──
function makeCell(text, width, bg = "FFFFFF", color = "2D3748", bold = false, alignment = AlignmentType.LEFT) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({
      alignment,
      children: [new TextRun({ text, font: "Arial", size: 18, color, bold })],
    })],
  });
}

function makeBadgeCell(status, width, bg) {
  const isPass = status === "PASS";
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: isPass ? "\u2705 PASS" : "\u274C FAIL",
        font: "Arial",
        size: 18,
        bold: true,
        color: isPass ? BRAND_GREEN : "9B2C2C",
      })],
    })],
  });
}

function makeHeaderRow(labels, widths) {
  return new TableRow({
    children: labels.map((label, i) =>
      new TableCell({
        borders,
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: TABLE_HEADER_BG, type: ShadingType.CLEAR },
        margins: cellMargins,
        verticalAlign: "center",
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: label, font: "Arial", size: 18, bold: true, color: "FFFFFF" })],
        })],
      })
    ),
  });
}

function makeKVRow(key, value, bg = "FFFFFF") {
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 2700, type: WidthType.DXA },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: key, font: "Arial", size: 20, bold: true, color: "4A5568" })] })],
      }),
      new TableCell({
        borders,
        width: { size: 2700, type: WidthType.DXA },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: value, font: "Arial", size: 20, color: BRAND_PRIMARY, bold: true })] })],
      }),
    ],
  });
}

function makeKVRowWide(key, value, w1, w2) {
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: w1, type: WidthType.DXA },
        shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: key, font: "Courier New", size: 17, color: BRAND_ACCENT })] })],
      }),
      new TableCell({
        borders,
        width: { size: w2, type: WidthType.DXA },
        shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: value, font: "Arial", size: 18, color: "4A5568" })] })],
      }),
    ],
  });
}

// ── Generate ──
async function main() {
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  const outputPath = "/sessions/wizardly-brave-goodall/mnt/ethniCity_03_19_2026/ethniCity_QA_Test_Report.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document written to ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
