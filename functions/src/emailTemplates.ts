// ═══════════════════════════════════════════════════════════════════════
// HTML EMAIL TEMPLATES — Responsive, branded email templates for SendGrid
// Each template produces mobile-friendly HTML with CTA buttons
// ═══════════════════════════════════════════════════════════════════════

const APP_URL = 'https://mithr-1e5f4.web.app';
const BRAND_COLOR = '#6366F1';
const BRAND_NAME = 'ethniCity';

// ─── Base HTML Layout ───────────────────────────────────────────────

function wrapInLayout(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${BRAND_NAME}</title>
<!--[if mso]><style>table,td{border-collapse:collapse;}</style><![endif]-->
<style>
  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
  table { border-collapse: collapse; }
  img { border: 0; outline: none; text-decoration: none; }
  a { color: ${BRAND_COLOR}; text-decoration: none; }
  .preheader { display: none !important; visibility: hidden; opacity: 0; height: 0; width: 0; max-height: 0; max-width: 0; overflow: hidden; }
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; padding: 16px !important; }
    .content-cell { padding: 24px 16px !important; }
    .cta-btn { display: block !important; width: 100% !important; text-align: center !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<span class="preheader">${preheader}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;">
<tr><td align="center" style="padding:24px 16px;">
<table class="container" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
<!-- Header -->
<tr><td style="background-color:${BRAND_COLOR};padding:20px 32px;">
<table width="100%"><tr>
<td style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">${BRAND_NAME}</td>
<td align="right" style="color:rgba(255,255,255,0.8);font-size:12px;">Catering</td>
</tr></table>
</td></tr>
<!-- Content -->
<tr><td class="content-cell" style="padding:32px;">
${content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid #E5E7EB;background-color:#FAFBFC;">
<table width="100%"><tr>
<td style="color:#9CA3AF;font-size:12px;line-height:1.5;">
You're receiving this because you have an account on ${BRAND_NAME}.<br>
<a href="${APP_URL}/notifications/settings" style="color:#6B7280;">Manage notification preferences</a>
&nbsp;&middot;&nbsp;
<a href="${APP_URL}" style="color:#6B7280;">Open app</a>
</td>
</tr></table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── CTA Button Helper ──────────────────────────────────────────────

function ctaButton(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
<tr><td align="center" style="background-color:${BRAND_COLOR};border-radius:8px;">
<a class="cta-btn" href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
${text}
</a>
</td></tr>
</table>`;
}

// ─── Status Badge Helper ────────────────────────────────────────────

function statusBadge(status: string, color: string): string {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:12px;background-color:${color}15;color:${color};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${status}</span>`;
}

// ─── Template Interface ─────────────────────────────────────────────

interface EmailTemplateResult {
  subject: string;
  html: string;
  text: string;
}

type TemplateData = Record<string, any>;

// ─── Template Generators ────────────────────────────────────────────

export const EMAIL_TEMPLATES: Record<string, (d: TemplateData) => EmailTemplateResult> = {

  // ── ORDER LIFECYCLE ───────────────────────────────────────────────

  new_order: (d) => ({
    subject: `New catering order from ${d.customerName}`,
    text: `${d.customerName} placed a ${d.headcount}-guest catering order for ${d.businessName}. Total: $${(d.total / 100).toFixed(2)}. Open the app to review and confirm.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">New Order Received</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">A new catering order needs your attention.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;border-radius:8px;padding:16px;margin-bottom:16px;">
      <tr><td style="padding:16px;">
        <table width="100%">
        <tr><td style="color:#6B7280;font-size:12px;padding-bottom:4px;">CUSTOMER</td></tr>
        <tr><td style="color:#111827;font-size:15px;font-weight:600;padding-bottom:12px;">${d.customerName}</td></tr>
        <tr><td style="color:#6B7280;font-size:12px;padding-bottom:4px;">DETAILS</td></tr>
        <tr><td style="color:#111827;font-size:14px;padding-bottom:4px;">${d.headcount} guests &middot; ${d.eventDate || 'TBD'}</td></tr>
        <tr><td style="color:#111827;font-size:20px;font-weight:700;padding-top:8px;">$${(d.total / 100).toFixed(2)}</td></tr>
        </table>
      </td></tr>
      </table>
      ${ctaButton('Review Order', `${APP_URL}/catering/vendor`)}
    `, `New ${d.headcount}-guest order from ${d.customerName}`),
  }),

  order_confirmed: (d) => ({
    subject: d.role === 'vendor'
      ? `Order confirmed — ${d.businessName}`
      : `Your order from ${d.businessName} is confirmed!`,
    text: d.role === 'vendor'
      ? `Order for $${(d.totalPrice / 100).toFixed(2)} has been confirmed. Check your dashboard.`
      : `Great news! ${d.businessName} has confirmed your catering order for $${(d.totalPrice / 100).toFixed(2)}.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Order Confirmed ${statusBadge('Confirmed', '#10B981')}</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">
        ${d.role === 'vendor' ? 'The order has been confirmed and is ready to prepare.' : `${d.businessName} has confirmed your catering order.`}
      </p>
      <table width="100%" style="background-color:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
      <tr><td style="padding:16px;">
        <p style="margin:0;color:#166534;font-size:14px;font-weight:500;">
          Order Total: <strong>$${(d.totalPrice / 100).toFixed(2)}</strong>
        </p>
      </td></tr>
      </table>
      ${ctaButton('View Order', `${APP_URL}/catering/orders/${d.orderId}`)}
    `, `Order confirmed - $${(d.totalPrice / 100).toFixed(2)}`),
  }),

  order_status_changed: (d) => {
    const statusColors: Record<string, string> = {
      preparing: '#F59E0B', ready: '#10B981', out_for_delivery: '#3B82F6',
      delivered: '#10B981', cancelled: '#EF4444',
    };
    const statusLabels: Record<string, string> = {
      preparing: 'Being Prepared', ready: 'Ready for Pickup',
      out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled',
    };
    const color = statusColors[d.newStatus] || '#6B7280';
    const label = statusLabels[d.newStatus] || d.newStatus;

    return {
      subject: `Order update: ${label} — ${d.businessName}`,
      text: `Your order from ${d.businessName} is now ${label.toLowerCase()}.`,
      html: wrapInLayout(`
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Order Status Update</h2>
        <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Your order from <strong>${d.businessName}</strong> has a new status.</p>
        <div style="text-align:center;padding:24px;background-color:#F9FAFB;border-radius:8px;margin-bottom:16px;">
          ${statusBadge(label, color)}
        </div>
        ${d.newStatus === 'cancelled' && d.cancellationReason
          ? `<p style="margin:8px 0 16px;color:#991B1B;font-size:13px;background-color:#FEF2F2;padding:12px;border-radius:8px;">Reason: ${d.cancellationReason}</p>`
          : ''}
        ${ctaButton('Track Order', `${APP_URL}/catering/orders/${d.orderId}`)}
      `, `Your order is now ${label.toLowerCase()}`),
    };
  },

  // ── QUOTES & RFP ─────────────────────────────────────────────────

  quote_request_submitted: (d) => ({
    subject: 'Your catering quote request has been submitted',
    text: `Your ${d.cuisineCategory} catering request for ${d.headcount} guests on ${d.eventDate} is live. Vendors will respond shortly.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Quote Request Submitted</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Your request is now live and vendors in your area are being notified.</p>
      <table width="100%" style="background-color:#F9FAFB;border-radius:8px;">
      <tr><td style="padding:16px;">
        <table width="100%">
        <tr><td style="color:#6B7280;font-size:12px;">CUISINE</td><td align="right" style="color:#111827;font-size:14px;font-weight:500;">${d.cuisineCategory}</td></tr>
        <tr><td colspan="2" style="padding:4px 0;"><hr style="border:0;border-top:1px solid #E5E7EB;"></td></tr>
        <tr><td style="color:#6B7280;font-size:12px;">GUESTS</td><td align="right" style="color:#111827;font-size:14px;font-weight:500;">${d.headcount}</td></tr>
        <tr><td colspan="2" style="padding:4px 0;"><hr style="border:0;border-top:1px solid #E5E7EB;"></td></tr>
        <tr><td style="color:#6B7280;font-size:12px;">EVENT DATE</td><td align="right" style="color:#111827;font-size:14px;font-weight:500;">${d.eventDate}</td></tr>
        </table>
      </td></tr>
      </table>
      ${ctaButton('View Request', `${APP_URL}/catering/quotes`)}
    `, `Request submitted for ${d.headcount} guests`),
  }),

  vendor_quote_received: (d) => ({
    subject: `New quote from ${d.vendorName} — $${(d.totalPrice / 100).toFixed(2)}`,
    text: `${d.vendorName} submitted a quote of $${(d.totalPrice / 100).toFixed(2)}. Log in to compare and accept.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">New Vendor Quote</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">A vendor has responded to your catering request.</p>
      <table width="100%" style="background-color:#EEF2FF;border-radius:8px;border:1px solid #C7D2FE;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="margin:0 0 4px;color:#6B7280;font-size:12px;">QUOTE FROM</p>
        <p style="margin:0 0 12px;color:#111827;font-size:16px;font-weight:600;">${d.vendorName}</p>
        <p style="margin:0;color:${BRAND_COLOR};font-size:28px;font-weight:700;">$${(d.totalPrice / 100).toFixed(2)}</p>
      </td></tr>
      </table>
      ${ctaButton('Compare Quotes', `${APP_URL}/catering/quotes/${d.requestId}`)}
    `, `${d.vendorName} quoted $${(d.totalPrice / 100).toFixed(2)}`),
  }),

  quote_accepted: (d) => ({
    subject: `Your quote was accepted by ${d.customerName}!`,
    text: `${d.customerName} accepted your quote of $${(d.totalPrice / 100).toFixed(2)}. Check your vendor dashboard.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Quote Accepted! ${statusBadge('Accepted', '#10B981')}</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Great news — your quote has been selected.</p>
      <table width="100%" style="background-color:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="margin:0 0 4px;color:#166534;font-size:13px;">ACCEPTED BY</p>
        <p style="margin:0 0 8px;color:#111827;font-size:16px;font-weight:600;">${d.customerName}</p>
        <p style="margin:0;color:#166534;font-size:24px;font-weight:700;">$${(d.totalPrice / 100).toFixed(2)}</p>
      </td></tr>
      </table>
      ${ctaButton('View in Dashboard', `${APP_URL}/catering/vendor`)}
    `, `${d.customerName} accepted your $${(d.totalPrice / 100).toFixed(2)} quote`),
  }),

  vendor_new_rfq: (d) => ({
    subject: `New catering request — ${d.cuisineCategory} for ${d.headcount} in ${d.deliveryCity}`,
    text: `A customer in ${d.deliveryCity} needs ${d.cuisineCategory} catering for ${d.headcount} guests. Submit your quote now.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">New Catering Request</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">A customer in your area is looking for catering — submit your quote!</p>
      <table width="100%" style="background-color:#FFF7ED;border-radius:8px;border:1px solid #FED7AA;">
      <tr><td style="padding:16px;">
        <table width="100%">
        <tr><td style="color:#9A3412;font-size:13px;"><strong>${d.cuisineCategory}</strong> &middot; ${d.headcount} guests &middot; ${d.deliveryCity}</td></tr>
        </table>
      </td></tr>
      </table>
      ${ctaButton('Submit a Quote', `${APP_URL}/catering/vendor/quotes`)}
    `, `${d.cuisineCategory} for ${d.headcount} guests in ${d.deliveryCity}`),
  }),

  vendor_rfq_edited: (d) => ({
    subject: 'A quote request has been updated — please re-quote',
    text: d.message || 'A customer updated their catering request. Please review and submit an updated quote.',
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Quote Request Updated ${statusBadge('Re-quote Needed', '#F59E0B')}</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">${d.message || 'A customer has updated their catering request. Your existing quote may need adjustments.'}</p>
      ${ctaButton('Review Changes', `${APP_URL}/catering/vendor/quotes`)}
    `, 'A quote request was updated'),
  }),

  quote_expired: (d) => ({
    subject: 'Your quote request has expired',
    text: 'Your catering quote request has expired. Create a new one anytime.',
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Quote Request Expired</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Your catering quote request has reached its expiration date. You can create a new request at any time.</p>
      ${ctaButton('Create New Request', `${APP_URL}/catering`)}
    `, 'Your quote request has expired'),
  }),

  // ── PAYMENTS ──────────────────────────────────────────────────────

  payment_received: (d) => ({
    subject: `Payment received — $${(d.amount / 100).toFixed(2)}`,
    text: `Payment of $${(d.amount / 100).toFixed(2)} for order ${d.orderId} has been processed.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Payment Received ${statusBadge('Paid', '#10B981')}</h2>
      <div style="text-align:center;padding:24px;background-color:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;margin-bottom:16px;">
        <p style="margin:0;color:#166534;font-size:28px;font-weight:700;">$${(d.amount / 100).toFixed(2)}</p>
        <p style="margin:4px 0 0;color:#166534;font-size:13px;">Payment confirmed</p>
      </div>
      ${ctaButton('View Receipt', `${APP_URL}/catering/orders/${d.orderId}`)}
    `, `$${(d.amount / 100).toFixed(2)} payment confirmed`),
  }),

  payment_failed: (d) => ({
    subject: 'Payment failed — action required',
    text: `Payment of $${(d.amount / 100).toFixed(2)} failed. Please update your payment method.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Payment Failed ${statusBadge('Action Required', '#EF4444')}</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">We couldn't process your payment. Please update your payment method to avoid order cancellation.</p>
      <div style="text-align:center;padding:20px;background-color:#FEF2F2;border-radius:8px;border:1px solid #FECACA;">
        <p style="margin:0;color:#991B1B;font-size:20px;font-weight:600;">$${(d.amount / 100).toFixed(2)}</p>
        <p style="margin:4px 0 0;color:#991B1B;font-size:13px;">${d.errorMessage || 'Payment could not be processed'}</p>
      </div>
      ${ctaButton('Update Payment', `${APP_URL}/catering/orders/${d.orderId}`)}
    `, 'Payment failed - update your payment method'),
  }),

  refund_processed: (d) => ({
    subject: `Refund processed — $${(d.amount / 100).toFixed(2)}`,
    text: `Your refund of $${(d.amount / 100).toFixed(2)} has been processed. It may take 5-10 business days to appear.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Refund Processed ${statusBadge('Refunded', '#6366F1')}</h2>
      <div style="text-align:center;padding:20px;background-color:#EEF2FF;border-radius:8px;border:1px solid #C7D2FE;margin-bottom:16px;">
        <p style="margin:0;color:${BRAND_COLOR};font-size:24px;font-weight:700;">$${(d.amount / 100).toFixed(2)}</p>
        <p style="margin:4px 0 0;color:#6B7280;font-size:13px;">Refund may take 5-10 business days</p>
      </div>
      ${ctaButton('View Order', `${APP_URL}/catering/orders/${d.orderId}`)}
    `, `$${(d.amount / 100).toFixed(2)} refund processed`),
  }),

  // ── MODIFICATIONS ─────────────────────────────────────────────────

  order_modified: (d) => ({
    subject: `${d.businessName} modified your order — review needed`,
    text: `${d.businessName} updated your order: ${d.modificationNote}. Please review and accept or reject.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Order Modified ${statusBadge('Review Needed', '#F59E0B')}</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;"><strong>${d.businessName}</strong> has made changes to your order.</p>
      ${d.modificationNote ? `<div style="padding:12px 16px;background-color:#FFF7ED;border-radius:8px;border-left:3px solid #F59E0B;margin-bottom:16px;">
        <p style="margin:0;color:#92400E;font-size:13px;font-style:italic;">"${d.modificationNote}"</p>
      </div>` : ''}
      ${ctaButton('Review Changes', `${APP_URL}/catering/orders/${d.orderId}`)}
    `, `${d.businessName} modified your order`),
  }),

  modification_rejected: (d) => ({
    subject: `${d.customerName} rejected your order modification`,
    text: `${d.customerName} rejected the changes you made. The order has been reverted.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Modification Rejected ${statusBadge('Rejected', '#EF4444')}</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;"><strong>${d.customerName}</strong> has rejected your order changes. The order has been reverted to its original state.</p>
      ${ctaButton('View Order', `${APP_URL}/catering/vendor`)}
    `, `${d.customerName} rejected order changes`),
  }),

  // ── RECURRING ORDERS ──────────────────────────────────────────────

  recurring_order_reminder: (d) => ({
    subject: `Reminder: "${d.label}" order tomorrow`,
    text: `Your recurring order "${d.label}" from ${d.businessName} is scheduled for ${d.nextRunDate}. Open the app to edit, skip, or adjust.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Upcoming Recurring Order</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Your recurring order is scheduled for tomorrow.</p>
      <table width="100%" style="background-color:#EEF2FF;border-radius:8px;border:1px solid #C7D2FE;">
      <tr><td style="padding:16px;">
        <p style="margin:0 0 4px;color:#111827;font-size:15px;font-weight:600;">${d.label}</p>
        <p style="margin:0;color:#6B7280;font-size:13px;">${d.businessName} &middot; ${d.nextRunDate}</p>
      </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#6B7280;font-size:13px;">Need to make changes? You can edit, skip, or adjust this order before it goes through.</p>
      ${ctaButton('Manage Order', `${APP_URL}/catering/recurring`)}
    `, `"${d.label}" order scheduled for tomorrow`),
  }),

  // ── REVIEWS ───────────────────────────────────────────────────────

  vendor_new_review: (d) => ({
    subject: `New ${d.rating}-star review for ${d.businessName}`,
    text: `${d.reviewerName} left a ${d.rating}-star review for ${d.businessName}: "${d.reviewText}". Log in to read and respond.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">New Customer Review</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">A customer left a review for <strong>${d.businessName}</strong>.</p>
      <div style="padding:16px;background-color:#F9FAFB;border-radius:8px;margin-bottom:16px;">
        <div style="color:#F59E0B;font-size:20px;margin-bottom:8px;">${'&#9733;'.repeat(d.rating)}${'&#9734;'.repeat(5 - d.rating)}</div>
        <p style="margin:0 0 8px;color:#374151;font-size:14px;font-style:italic;">"${(d.reviewText || '').slice(0, 200)}${(d.reviewText || '').length > 200 ? '...' : ''}"</p>
        <p style="margin:0;color:#9CA3AF;font-size:12px;">— ${d.reviewerName}</p>
      </div>
      ${ctaButton('Respond to Review', `${APP_URL}/catering/vendor`)}
    `, `${d.rating}-star review from ${d.reviewerName}`),
  }),

  review_flagged: (d) => ({
    subject: 'A review has been flagged for your business',
    text: `A review for ${d.businessName} was flagged: ${d.reason}. Our team will review it.`,
    html: wrapInLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Review Flagged ${statusBadge('Under Review', '#F59E0B')}</h2>
      <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">A review for <strong>${d.businessName}</strong> has been flagged.</p>
      <div style="padding:12px 16px;background-color:#FEF2F2;border-radius:8px;border-left:3px solid #EF4444;">
        <p style="margin:0;color:#991B1B;font-size:13px;">Reason: ${d.reason}</p>
      </div>
      <p style="margin:16px 0 0;color:#6B7280;font-size:13px;">Our team will review this and take appropriate action.</p>
    `, `Review flagged: ${d.reason}`),
  }),
};

// ─── Fallback for unknown templates ─────────────────────────────────

export function getEmailTemplate(template: string, data: TemplateData): EmailTemplateResult | null {
  const generator = EMAIL_TEMPLATES[template];
  if (!generator) return null;
  try {
    return generator(data);
  } catch (err) {
    console.error(`[emailTemplates] Error generating ${template}:`, err);
    return null;
  }
}
