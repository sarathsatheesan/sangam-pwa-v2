"use strict";
// ═══════════════════════════════════════════════════════════════════════
// SMS TEMPLATES — Twilio-optimized templates with 160-char validation
// Each template produces a concise SMS message under the segment limit
// ═══════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSmsTemplate = getSmsTemplate;
exports.isValidSmsPhone = isValidSmsPhone;
const BRAND_PREFIX = '[ethniCity]';
const MAX_SMS_LENGTH = 160;
/**
 * Truncate text to fit within SMS character limit.
 * Reserves space for the brand prefix and a trailing ellipsis.
 */
function truncate(text, maxLen) {
    if (text.length <= maxLen)
        return text;
    return text.slice(0, maxLen - 3) + '...';
}
/**
 * Calculate the number of SMS segments a message will use.
 * Single segment = 160 chars, multi-segment = 153 chars each (7 chars for UDH header).
 */
function calculateSegments(text) {
    if (text.length <= 160)
        return 1;
    return Math.ceil(text.length / 153);
}
/**
 * Format a price from cents to dollars.
 */
function fmtPrice(cents) {
    return `$${(cents / 100).toFixed(2)}`;
}
// ─── Template Generators ────────────────────────────────────────────
const SMS_TEMPLATES = {
    // ── ORDER LIFECYCLE ───────────────────────────────────────────────
    new_order: (d) => `${BRAND_PREFIX} New order! ${d.customerName} placed a ${d.headcount}-guest order (${fmtPrice(d.total)}). Open the app to confirm.`,
    order_confirmed: (d) => d.role === 'vendor'
        ? `${BRAND_PREFIX} Order confirmed for ${fmtPrice(d.totalPrice)}. Check your dashboard.`
        : `${BRAND_PREFIX} ${d.businessName} confirmed your order (${fmtPrice(d.totalPrice)}).`,
    order_status_changed: (d) => {
        const labels = {
            preparing: 'being prepared', ready: 'ready for pickup',
            out_for_delivery: 'out for delivery', delivered: 'delivered', cancelled: 'cancelled',
        };
        return `${BRAND_PREFIX} Your order from ${d.businessName} is now ${labels[d.newStatus] || d.newStatus}.`;
    },
    // ── QUOTES & RFP ─────────────────────────────────────────────────
    quote_request_submitted: (d) => `${BRAND_PREFIX} Quote request submitted for ${d.headcount} guests on ${d.eventDate}. Vendors will respond soon.`,
    vendor_quote_received: (d) => `${BRAND_PREFIX} ${d.vendorName} quoted ${fmtPrice(d.totalPrice)} for your catering. Open app to compare.`,
    quote_accepted: (d) => `${BRAND_PREFIX} Your quote (${fmtPrice(d.totalPrice)}) was accepted by ${d.customerName}! Check your dashboard.`,
    vendor_new_rfq: (d) => `${BRAND_PREFIX} New request: ${d.cuisineCategory} for ${d.headcount} guests in ${d.deliveryCity}. Submit a quote!`,
    vendor_rfq_edited: () => `${BRAND_PREFIX} A customer updated their catering request. Please review and re-quote.`,
    quote_expired: () => `${BRAND_PREFIX} Your quote request has expired. Create a new one anytime.`,
    quote_request_edited: (d) => d.requiresRequote
        ? `${BRAND_PREFIX} Your quote request was updated. Vendors will be asked to re-quote.`
        : `${BRAND_PREFIX} Your quote request has been updated.`,
    // ── PAYMENTS ──────────────────────────────────────────────────────
    payment_received: (d) => `${BRAND_PREFIX} Payment of ${fmtPrice(d.amount)} received for your catering order.`,
    payment_failed: (d) => `${BRAND_PREFIX} Payment of ${fmtPrice(d.amount)} failed. Update your payment method to avoid cancellation.`,
    refund_processed: (d) => `${BRAND_PREFIX} Refund of ${fmtPrice(d.amount)} processed. Allow 5-10 business days.`,
    // ── MODIFICATIONS ─────────────────────────────────────────────────
    order_modified: (d) => `${BRAND_PREFIX} ${d.businessName} modified your order. Open the app to review and accept/reject.`,
    modification_rejected: (d) => `${BRAND_PREFIX} ${d.customerName} rejected your order modification. Order reverted.`,
    // ── RECURRING ORDERS ──────────────────────────────────────────────
    recurring_order_reminder: (d) => `${BRAND_PREFIX} Reminder: "${truncate(d.label, 30)}" from ${d.businessName} is scheduled for tomorrow. Edit or skip in the app.`,
    // ── REVIEWS ───────────────────────────────────────────────────────
    vendor_new_review: (d) => `${BRAND_PREFIX} New ${d.rating}-star review for ${d.businessName} from ${d.reviewerName}. Check your dashboard.`,
    review_flagged: (d) => `${BRAND_PREFIX} A review for ${d.businessName} was flagged: ${truncate(d.reason, 50)}.`,
};
// ─── Public API ─────────────────────────────────────────────────────
/**
 * Generate an SMS message for a given template and data.
 * Returns the body text plus segment metadata.
 */
function getSmsTemplate(template, data) {
    const generator = SMS_TEMPLATES[template];
    if (!generator)
        return null;
    try {
        let body = generator(data);
        // Ensure the message fits in 1 segment when possible
        if (body.length > MAX_SMS_LENGTH) {
            // Try to fit within 2 segments max (306 chars)
            body = truncate(body, 306);
        }
        const segments = calculateSegments(body);
        return {
            body,
            isMultiSegment: segments > 1,
            segments,
        };
    }
    catch (err) {
        console.error(`[smsTemplates] Error generating ${template}:`, err);
        return null;
    }
}
/**
 * Validate a phone number has minimum structure for SMS.
 * Returns true if the phone number looks valid enough to try sending.
 */
function isValidSmsPhone(phone) {
    // Must have at least 10 digits
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10;
}
//# sourceMappingURL=smsTemplates.js.map