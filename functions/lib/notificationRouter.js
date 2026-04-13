"use strict";
// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION ROUTER — Multi-channel dispatch with preferences,
// rate limiting, deduplication, quiet hours, and fallback channels
// Replaces the simple processNotification with a full router
// ═══════════════════════════════════════════════════════════════════════
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeNotification = routeNotification;
exports.recordNotificationAnalytics = recordNotificationAnalytics;
const admin = __importStar(require("firebase-admin"));
const emailTemplates_1 = require("./emailTemplates");
const smsTemplates_1 = require("./smsTemplates");
const db = admin.firestore();
// ─── Configuration ──────────────────────────────────────────────────
const APP_URL = 'https://mithr-1e5f4.web.app';
// Rate limiting: max notifications per user per channel per hour
const RATE_LIMITS = {
    email: 10,
    sms: 5,
    push: 20,
};
// Deduplication window in milliseconds (5 minutes)
const DEDUP_WINDOW_MS = 5 * 60 * 1000;
// ─── Category Mapping ───────────────────────────────────────────────
const TEMPLATE_TO_CATEGORY = {
    new_order: 'order_lifecycle',
    order_confirmed: 'order_lifecycle',
    order_status_changed: 'order_lifecycle',
    recurring_order_reminder: 'order_lifecycle',
    order_modified: 'order_modifications',
    modification_rejected: 'order_modifications',
    quote_request_submitted: 'rfp_quotes',
    quote_request_edited: 'rfp_quotes',
    vendor_quote_received: 'rfp_quotes',
    quote_accepted: 'rfp_quotes',
    quote_expired: 'rfp_quotes',
    vendor_new_rfq: 'rfp_quotes',
    vendor_rfq_edited: 'rfp_quotes',
    payment_received: 'payments',
    payment_failed: 'payments',
    refund_processed: 'payments',
    vendor_new_review: 'messaging',
    review_flagged: 'messaging',
};
// Urgency mapping (critical bypasses quiet hours + rate limits)
const TEMPLATE_URGENCY = {
    payment_failed: 'critical',
    order_cancelled: 'critical',
    new_order: 'high',
    order_confirmed: 'high',
    quote_accepted: 'high',
    vendor_quote_received: 'high',
    vendor_new_rfq: 'high',
    order_modified: 'high',
    modification_rejected: 'high',
    order_status_changed: 'medium',
    quote_request_submitted: 'medium',
    recurring_order_reminder: 'medium',
    vendor_new_review: 'low',
    review_flagged: 'low',
};
const DEFAULT_PREFS = {
    channels: {
        order_lifecycle: { in_app: true, push: true, email: true, sms: true },
        order_modifications: { in_app: true, push: true, email: true, sms: false },
        rfp_quotes: { in_app: true, push: true, email: true, sms: false },
        payments: { in_app: true, push: true, email: true, sms: true },
        messaging: { in_app: true, push: true, email: false, sms: false },
    },
    quietHours: { enabled: false, start: '22:00', end: '08:00', timezone: 'America/Los_Angeles' },
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
};
// ─── Preference Resolution ──────────────────────────────────────────
async function getUserPreferences(userId) {
    try {
        const snap = await db.collection('notificationPreferences').doc(userId).get();
        if (!snap.exists)
            return DEFAULT_PREFS;
        return { ...DEFAULT_PREFS, ...snap.data() };
    }
    catch (_a) {
        return DEFAULT_PREFS;
    }
}
function isChannelAllowed(prefs, channel, template) {
    // Global toggle check
    if (channel === 'email' && !prefs.emailEnabled)
        return false;
    if (channel === 'sms' && !prefs.smsEnabled)
        return false;
    if (channel === 'push' && !prefs.pushEnabled)
        return false;
    // Category-level check
    const category = TEMPLATE_TO_CATEGORY[template] || 'order_lifecycle';
    const catPrefs = prefs.channels[category];
    if (!catPrefs)
        return true;
    return catPrefs[channel] !== false;
}
function isInQuietHours(prefs) {
    var _a, _b;
    if (!prefs.quietHours.enabled)
        return false;
    try {
        const { start, end, timezone } = prefs.quietHours;
        const now = new Date();
        // Use Intl to get current time in user's timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
        });
        const parts = formatter.formatToParts(now);
        const h = parseInt(((_a = parts.find(p => p.type === 'hour')) === null || _a === void 0 ? void 0 : _a.value) || '0');
        const m = parseInt(((_b = parts.find(p => p.type === 'minute')) === null || _b === void 0 ? void 0 : _b.value) || '0');
        const current = h * 60 + m;
        const [sH, sM] = start.split(':').map(Number);
        const [eH, eM] = end.split(':').map(Number);
        const startMin = sH * 60 + sM;
        const endMin = eH * 60 + eM;
        // Overnight range (e.g., 22:00 - 08:00)
        if (startMin > endMin)
            return current >= startMin || current < endMin;
        return current >= startMin && current < endMin;
    }
    catch (_c) {
        return false;
    }
}
// ─── Rate Limiting ──────────────────────────────────────────────────
async function isRateLimited(userId, channel) {
    const limit = RATE_LIMITS[channel];
    if (!limit)
        return false;
    const oneHourAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 3600000);
    const snap = await db.collection('notifications')
        .where('recipientId', '==', userId)
        .where('channel', '==', channel)
        .where('status', '==', 'sent')
        .where('sentAt', '>=', oneHourAgo)
        .limit(limit + 1)
        .get();
    return snap.size >= limit;
}
// ─── Deduplication ──────────────────────────────────────────────────
async function isDuplicate(userId, template, channel, deduplicationKey) {
    const key = deduplicationKey || `${userId}:${template}:${channel}`;
    const windowAgo = admin.firestore.Timestamp.fromMillis(Date.now() - DEDUP_WINDOW_MS);
    // Check for recent identical notification
    let q = db.collection('notifications')
        .where('recipientId', '==', userId)
        .where('template', '==', template)
        .where('channel', '==', channel)
        .where('createdAt', '>=', windowAgo)
        .limit(1);
    const snap = await q.get();
    return !snap.empty;
}
// ─── Channel Dispatchers ────────────────────────────────────────────
async function sendEmail(email, template, data, userName) {
    const sendgridKey = process.env.SENDGRID_API_KEY || '';
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@ethnicity.app';
    // Get HTML template
    const emailContent = (0, emailTemplates_1.getEmailTemplate)(template, { ...data, userName });
    if (!emailContent) {
        // Fallback to plain text
        return sendPlainTextEmail(email, template, data, userName, sendgridKey, fromEmail);
    }
    if (!sendgridKey) {
        console.log(`[router] SendGrid not configured. Would send to ${email}: "${emailContent.subject}"`);
        return { success: true }; // Counts as "logged"
    }
    try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sendgridKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email, name: userName || undefined }] }],
                from: { email: fromEmail, name: 'ethniCity Catering' },
                subject: emailContent.subject,
                content: [
                    { type: 'text/plain', value: emailContent.text },
                    { type: 'text/html', value: emailContent.html },
                ],
            }),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`SendGrid ${response.status}: ${errText}`);
        }
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function sendPlainTextEmail(email, template, data, userName, sendgridKey, fromEmail) {
    // Legacy plain text fallback — use the template definitions from index.ts
    const PLAIN_TEMPLATES = {
        quote_request_submitted: {
            subject: 'Your catering quote request has been submitted',
            body: (d) => `Your ${d.cuisineCategory} request for ${d.headcount} guests on ${d.eventDate} is live.`,
        },
        order_status_changed: {
            subject: 'Order status update',
            body: (d) => `Your order from ${d.businessName} is now: ${d.newStatus}.`,
        },
    };
    const tmpl = PLAIN_TEMPLATES[template];
    if (!tmpl)
        return { success: false, error: `No plain text template for ${template}` };
    if (!sendgridKey) {
        console.log(`[router] Would send to ${email}: ${tmpl.subject}`);
        return { success: true };
    }
    try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sendgridKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email }] }],
                from: { email: fromEmail, name: 'ethniCity Catering' },
                subject: tmpl.subject,
                content: [{ type: 'text/plain', value: tmpl.body({ ...data, userName }) }],
            }),
        });
        if (!response.ok)
            throw new Error(`SendGrid ${response.status}`);
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function sendSms(phone, template, data) {
    // Validate phone
    if (!(0, smsTemplates_1.isValidSmsPhone)(phone)) {
        return { success: false, error: 'Invalid phone number' };
    }
    const smsContent = (0, smsTemplates_1.getSmsTemplate)(template, data);
    if (!smsContent) {
        return { success: false, error: `No SMS template for ${template}` };
    }
    const twilioSid = process.env.TWILIO_ACCOUNT_SID || '';
    const twilioToken = process.env.TWILIO_AUTH_TOKEN || '';
    const twilioFrom = process.env.TWILIO_FROM_NUMBER || '';
    if (!twilioSid || !twilioToken || !twilioFrom) {
        console.log(`[router] Twilio not configured. Would send to ${phone}: ${smsContent.body}`);
        return { success: true };
    }
    try {
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
            method: 'POST',
            headers: {
                Authorization: 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                To: phone,
                From: twilioFrom,
                Body: smsContent.body,
            }).toString(),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Twilio ${response.status}: ${errText}`);
        }
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function sendPush(userId, template, data, subject, body) {
    var _a, _b, _c;
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const fcmTokens = [
            ...(((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens) || []),
            ...(((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.fcmToken) ? [(_c = userDoc.data()) === null || _c === void 0 ? void 0 : _c.fcmToken] : []),
        ].filter(Boolean);
        if (fcmTokens.length === 0) {
            return { success: false, error: 'No FCM tokens' };
        }
        const result = await admin.messaging().sendEachForMulticast({
            tokens: fcmTokens,
            notification: { title: subject, body },
            data: {
                type: template,
                ...Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
            },
            webpush: {
                fcmOptions: { link: APP_URL },
                notification: {
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: `notif-${template}`,
                },
            },
        });
        // Clean up invalid tokens
        const invalidTokens = [];
        result.responses.forEach((resp, idx) => {
            var _a;
            if (!resp.success && ((_a = resp.error) === null || _a === void 0 ? void 0 : _a.code) === 'messaging/registration-token-not-registered') {
                invalidTokens.push(fcmTokens[idx]);
            }
        });
        if (invalidTokens.length > 0) {
            await db.collection('users').doc(userId).update({
                fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
            });
        }
        return { success: result.successCount > 0 };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
/**
 * Route a notification through all applicable channels based on user
 * preferences, rate limits, quiet hours, and deduplication.
 *
 * This is called by the processNotification Cloud Function for each
 * notification document created in the `notifications` collection.
 */
async function routeNotification(notifId, channel, recipientId, template, templateData, notifRef) {
    const urgency = TEMPLATE_URGENCY[template] || 'medium';
    const isCritical = urgency === 'critical';
    // ── 1. Resolve recipient info ──
    let email = '';
    let phone = '';
    let userName = '';
    if (recipientId) {
        try {
            const userDoc = await db.collection('users').doc(recipientId).get();
            const userData = userDoc.data();
            if (userData) {
                userName = userData.preferredName || userData.name || '';
                email = userData.email || '';
                phone = userData.phone || '';
            }
            if (!email) {
                try {
                    const authUser = await admin.auth().getUser(recipientId);
                    email = authUser.email || '';
                }
                catch ( /* no auth user */_a) { /* no auth user */ }
            }
        }
        catch (err) {
            console.error(`[router] Error resolving user ${recipientId}:`, err);
        }
    }
    // ── 2. Check user preferences (critical bypasses) ──
    if (!isCritical) {
        const prefs = await getUserPreferences(recipientId);
        if (!isChannelAllowed(prefs, channel, template)) {
            await notifRef.update({ status: 'skipped', reason: 'pref_disabled' });
            return { channel, status: 'pref_disabled' };
        }
        // Quiet hours (suppress push + SMS, not email or critical)
        if ((channel === 'push' || channel === 'sms') && isInQuietHours(prefs)) {
            await notifRef.update({ status: 'skipped', reason: 'quiet_hours' });
            return { channel, status: 'quiet_hours' };
        }
    }
    // ── 3. Deduplication check ──
    const isDup = await isDuplicate(recipientId, template, channel);
    if (isDup) {
        await notifRef.update({ status: 'skipped', reason: 'duplicate' });
        return { channel, status: 'deduplicated' };
    }
    // ── 4. Rate limiting (critical bypasses) ──
    if (!isCritical) {
        const limited = await isRateLimited(recipientId, channel);
        if (limited) {
            await notifRef.update({ status: 'skipped', reason: 'rate_limited' });
            return { channel, status: 'rate_limited' };
        }
    }
    // ── 5. Dispatch ──
    try {
        let result;
        if (channel === 'email') {
            if (!email) {
                await notifRef.update({ status: 'skipped', reason: 'no_email' });
                return { channel, status: 'skipped', error: 'no_email' };
            }
            result = await sendEmail(email, template, templateData, userName);
        }
        else if (channel === 'sms') {
            if (!phone) {
                await notifRef.update({ status: 'skipped', reason: 'no_phone' });
                return { channel, status: 'skipped', error: 'no_phone' };
            }
            result = await sendSms(phone, template, templateData);
        }
        else if (channel === 'push') {
            // Get subject/body from email template fallback
            const emailContent = (0, emailTemplates_1.getEmailTemplate)(template, { ...templateData, userName });
            const subject = (emailContent === null || emailContent === void 0 ? void 0 : emailContent.subject) || template.replace(/_/g, ' ');
            const body = (emailContent === null || emailContent === void 0 ? void 0 : emailContent.text) || 'You have a new notification.';
            result = await sendPush(recipientId, template, templateData, subject, body);
        }
        else {
            result = { success: false, error: `Unknown channel: ${channel}` };
        }
        if (result.success) {
            const isConfigured = (channel === 'email' && !!process.env.SENDGRID_API_KEY)
                || (channel === 'sms' && !!process.env.TWILIO_ACCOUNT_SID)
                || channel === 'push';
            await notifRef.update({
                status: isConfigured ? 'sent' : 'logged',
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { channel, status: isConfigured ? 'sent' : 'logged' };
        }
        // ── 6. Fallback channels ──
        if (channel === 'email' && result.error) {
            // Email failed → try push as fallback
            console.warn(`[router] Email failed for ${recipientId}, attempting push fallback`);
            const emailContent = (0, emailTemplates_1.getEmailTemplate)(template, { ...templateData, userName });
            const pushResult = await sendPush(recipientId, template, templateData, (emailContent === null || emailContent === void 0 ? void 0 : emailContent.subject) || template, (emailContent === null || emailContent === void 0 ? void 0 : emailContent.text) || 'Notification');
            if (pushResult.success) {
                await notifRef.update({
                    status: 'sent',
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                    fallbackChannel: 'push',
                });
                return { channel: 'push', status: 'sent' };
            }
        }
        if (channel === 'sms' && result.error) {
            // SMS failed → try push as fallback
            console.warn(`[router] SMS failed for ${recipientId}, attempting push fallback`);
            const emailContent = (0, emailTemplates_1.getEmailTemplate)(template, { ...templateData, userName });
            const pushResult = await sendPush(recipientId, template, templateData, (emailContent === null || emailContent === void 0 ? void 0 : emailContent.subject) || template, (emailContent === null || emailContent === void 0 ? void 0 : emailContent.text) || 'Notification');
            if (pushResult.success) {
                await notifRef.update({
                    status: 'sent',
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                    fallbackChannel: 'push',
                });
                return { channel: 'push', status: 'sent' };
            }
        }
        // All attempts failed
        await notifRef.update({ status: 'failed', error: result.error });
        return { channel, status: 'failed', error: result.error };
    }
    catch (err) {
        await notifRef.update({ status: 'failed', error: err.message });
        return { channel, status: 'failed', error: err.message };
    }
}
// ─── Analytics Helper ───────────────────────────────────────────────
/**
 * Record notification analytics for dashboard reporting.
 */
async function recordNotificationAnalytics(template, channel, status) {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const docId = `${today}_${template}_${channel}`;
        const ref = db.collection('notificationAnalytics').doc(docId);
        await ref.set({
            date: today,
            template,
            channel,
            [`count_${status}`]: admin.firestore.FieldValue.increment(1),
            totalCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (err) {
        console.error('[router] Analytics recording failed:', err);
    }
}
//# sourceMappingURL=notificationRouter.js.map