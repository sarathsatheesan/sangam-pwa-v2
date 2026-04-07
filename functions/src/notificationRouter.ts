// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION ROUTER — Multi-channel dispatch with preferences,
// rate limiting, deduplication, quiet hours, and fallback channels
// Replaces the simple processNotification with a full router
// ═══════════════════════════════════════════════════════════════════════

import * as admin from 'firebase-admin';
import { getEmailTemplate } from './emailTemplates';
import { getSmsTemplate, isValidSmsPhone } from './smsTemplates';

const db = admin.firestore();

// ─── Configuration ──────────────────────────────────────────────────

const APP_URL = 'https://mithr-1e5f4.web.app';

// Rate limiting: max notifications per user per channel per hour
const RATE_LIMITS: Record<string, number> = {
  email: 10,
  sms: 5,
  push: 20,
};

// Deduplication window in milliseconds (5 minutes)
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

// ─── Category Mapping ───────────────────────────────────────────────

const TEMPLATE_TO_CATEGORY: Record<string, string> = {
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
const TEMPLATE_URGENCY: Record<string, string> = {
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

// ─── User Preference Defaults ───────────────────────────────────────

interface ChannelPrefs {
  in_app: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
}

interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
}

interface UserNotifPrefs {
  channels: Record<string, ChannelPrefs>;
  quietHours: QuietHours;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
}

const DEFAULT_PREFS: UserNotifPrefs = {
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

async function getUserPreferences(userId: string): Promise<UserNotifPrefs> {
  try {
    const snap = await db.collection('notificationPreferences').doc(userId).get();
    if (!snap.exists) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...snap.data() } as UserNotifPrefs;
  } catch {
    return DEFAULT_PREFS;
  }
}

function isChannelAllowed(
  prefs: UserNotifPrefs,
  channel: string,
  template: string,
): boolean {
  // Global toggle check
  if (channel === 'email' && !prefs.emailEnabled) return false;
  if (channel === 'sms' && !prefs.smsEnabled) return false;
  if (channel === 'push' && !prefs.pushEnabled) return false;

  // Category-level check
  const category = TEMPLATE_TO_CATEGORY[template] || 'order_lifecycle';
  const catPrefs = prefs.channels[category];
  if (!catPrefs) return true;

  return catPrefs[channel as keyof ChannelPrefs] !== false;
}

function isInQuietHours(prefs: UserNotifPrefs): boolean {
  if (!prefs.quietHours.enabled) return false;

  try {
    const { start, end, timezone } = prefs.quietHours;
    const now = new Date();

    // Use Intl to get current time in user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
    });
    const parts = formatter.formatToParts(now);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const current = h * 60 + m;

    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;

    // Overnight range (e.g., 22:00 - 08:00)
    if (startMin > endMin) return current >= startMin || current < endMin;
    return current >= startMin && current < endMin;
  } catch {
    return false;
  }
}

// ─── Rate Limiting ──────────────────────────────────────────────────

async function isRateLimited(
  userId: string,
  channel: string,
): Promise<boolean> {
  const limit = RATE_LIMITS[channel];
  if (!limit) return false;

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

async function isDuplicate(
  userId: string,
  template: string,
  channel: string,
  deduplicationKey?: string,
): Promise<boolean> {
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

async function sendEmail(
  email: string,
  template: string,
  data: Record<string, any>,
  userName: string,
): Promise<{ success: boolean; error?: string }> {
  const sendgridKey = process.env.SENDGRID_API_KEY || '';
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@ethnicity.app';

  // Get HTML template
  const emailContent = getEmailTemplate(template, { ...data, userName });

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
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendPlainTextEmail(
  email: string,
  template: string,
  data: Record<string, any>,
  userName: string,
  sendgridKey: string,
  fromEmail: string,
): Promise<{ success: boolean; error?: string }> {
  // Legacy plain text fallback — use the template definitions from index.ts
  const PLAIN_TEMPLATES: Record<string, { subject: string; body: (d: any) => string }> = {
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
  if (!tmpl) return { success: false, error: `No plain text template for ${template}` };

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

    if (!response.ok) throw new Error(`SendGrid ${response.status}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendSms(
  phone: string,
  template: string,
  data: Record<string, any>,
): Promise<{ success: boolean; error?: string }> {
  // Validate phone
  if (!isValidSmsPhone(phone)) {
    return { success: false, error: 'Invalid phone number' };
  }

  const smsContent = getSmsTemplate(template, data);
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
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
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
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Twilio ${response.status}: ${errText}`);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendPush(
  userId: string,
  template: string,
  data: Record<string, any>,
  subject: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const fcmTokens: string[] = [
      ...(userDoc.data()?.fcmTokens || []),
      ...(userDoc.data()?.fcmToken ? [userDoc.data()?.fcmToken] : []),
    ].filter(Boolean);

    if (fcmTokens.length === 0) {
      return { success: false, error: 'No FCM tokens' };
    }

    const result = await admin.messaging().sendEachForMulticast({
      tokens: fcmTokens,
      notification: { title: subject, body },
      data: {
        type: template,
        ...Object.fromEntries(
          Object.entries(data || {}).map(([k, v]) => [k, String(v)]),
        ),
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
    const invalidTokens: string[] = [];
    result.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        invalidTokens.push(fcmTokens[idx]);
      }
    });
    if (invalidTokens.length > 0) {
      await db.collection('users').doc(userId).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      });
    }

    return { success: result.successCount > 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Main Router ────────────────────────────────────────────────────

export interface RouteResult {
  channel: string;
  status: 'sent' | 'skipped' | 'rate_limited' | 'deduplicated' | 'quiet_hours' | 'pref_disabled' | 'failed' | 'logged';
  error?: string;
}

/**
 * Route a notification through all applicable channels based on user
 * preferences, rate limits, quiet hours, and deduplication.
 *
 * This is called by the processNotification Cloud Function for each
 * notification document created in the `notifications` collection.
 */
export async function routeNotification(
  notifId: string,
  channel: string,
  recipientId: string,
  template: string,
  templateData: Record<string, any>,
  notifRef: admin.firestore.DocumentReference,
): Promise<RouteResult> {
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
        } catch { /* no auth user */ }
      }
    } catch (err) {
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
    let result: { success: boolean; error?: string };

    if (channel === 'email') {
      if (!email) {
        await notifRef.update({ status: 'skipped', reason: 'no_email' });
        return { channel, status: 'skipped', error: 'no_email' };
      }
      result = await sendEmail(email, template, templateData, userName);

    } else if (channel === 'sms') {
      if (!phone) {
        await notifRef.update({ status: 'skipped', reason: 'no_phone' });
        return { channel, status: 'skipped', error: 'no_phone' };
      }
      result = await sendSms(phone, template, templateData);

    } else if (channel === 'push') {
      // Get subject/body from email template fallback
      const emailContent = getEmailTemplate(template, { ...templateData, userName });
      const subject = emailContent?.subject || template.replace(/_/g, ' ');
      const body = emailContent?.text || 'You have a new notification.';
      result = await sendPush(recipientId, template, templateData, subject, body);

    } else {
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
      const emailContent = getEmailTemplate(template, { ...templateData, userName });
      const pushResult = await sendPush(
        recipientId, template, templateData,
        emailContent?.subject || template, emailContent?.text || 'Notification',
      );
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
      const emailContent = getEmailTemplate(template, { ...templateData, userName });
      const pushResult = await sendPush(
        recipientId, template, templateData,
        emailContent?.subject || template, emailContent?.text || 'Notification',
      );
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

  } catch (err: any) {
    await notifRef.update({ status: 'failed', error: err.message });
    return { channel, status: 'failed', error: err.message };
  }
}

// ─── Analytics Helper ───────────────────────────────────────────────

/**
 * Record notification analytics for dashboard reporting.
 */
export async function recordNotificationAnalytics(
  template: string,
  channel: string,
  status: string,
): Promise<void> {
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
  } catch (err) {
    console.error('[router] Analytics recording failed:', err);
  }
}
