// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION TYPES — Unified type system for multi-channel notifications
// Covers in-app, email, SMS, and push across all catering events
// ═══════════════════════════════════════════════════════════════════════

// ─── Urgency Levels ─────────────────────────────────────────────────

export type NotificationUrgency = 'critical' | 'high' | 'medium' | 'low';

/**
 * Channel waterfall by urgency:
 * - critical → In-App + Push + Email + SMS  (e.g. order cancelled, payment failed)
 * - high     → In-App + Push + Email        (e.g. new order, quote accepted)
 * - medium   → In-App + Push               (e.g. status updates, ETA changes)
 * - low      → In-App only                  (e.g. reviews, reminders)
 */
export const URGENCY_CHANNELS: Record<NotificationUrgency, ('in_app' | 'push' | 'email' | 'sms')[]> = {
  critical: ['in_app', 'push', 'email', 'sms'],
  high:     ['in_app', 'push', 'email'],
  medium:   ['in_app', 'push'],
  low:      ['in_app'],
};

// ─── Notification Categories ────────────────────────────────────────

export type NotificationCategory =
  | 'order_lifecycle'
  | 'order_modifications'
  | 'rfp_quotes'
  | 'payments'
  | 'messaging';

// ─── All Notification Event Types ───────────────────────────────────

export type NotificationEventType =
  // Order Lifecycle (9 events)
  | 'new_order'
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_ready'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'order_cancelled'
  | 'eta_updated'
  | 'recurring_order_reminder'
  // Order Modifications (4 events)
  | 'order_modified'
  | 'modification_accepted'
  | 'modification_rejected'
  | 'modification_timeout'
  // RFP / Quotes (9 events)
  | 'rfp_submitted'
  | 'rfp_broadcast'
  | 'quote_received'
  | 'quote_accepted'
  | 'quote_declined'
  | 'rfp_edited'
  | 'rfp_expired'
  | 'finalization_expired'
  | 'item_reassigned'
  // Payments (3 events)
  | 'payment_received'
  | 'payment_failed'
  | 'refund_processed'
  // Messaging (2 events)
  | 'new_message'
  | 'vendor_reply';

// ─── Notification Event Metadata ────────────────────────────────────

export interface NotificationEventConfig {
  type: NotificationEventType;
  category: NotificationCategory;
  urgency: NotificationUrgency;
  recipient: 'customer' | 'vendor' | 'both';
  defaultEnabled: boolean;
  description: string;
}

export const NOTIFICATION_EVENTS: Record<NotificationEventType, NotificationEventConfig> = {
  // ── Order Lifecycle ──
  new_order: {
    type: 'new_order',
    category: 'order_lifecycle',
    urgency: 'high',
    recipient: 'vendor',
    defaultEnabled: true,
    description: 'New order received',
  },
  order_confirmed: {
    type: 'order_confirmed',
    category: 'order_lifecycle',
    urgency: 'high',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Order confirmed by vendor',
  },
  order_preparing: {
    type: 'order_preparing',
    category: 'order_lifecycle',
    urgency: 'medium',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Order is being prepared',
  },
  order_ready: {
    type: 'order_ready',
    category: 'order_lifecycle',
    urgency: 'high',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Order ready for pickup/delivery',
  },
  order_out_for_delivery: {
    type: 'order_out_for_delivery',
    category: 'order_lifecycle',
    urgency: 'high',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Order is out for delivery',
  },
  order_delivered: {
    type: 'order_delivered',
    category: 'order_lifecycle',
    urgency: 'medium',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Order has been delivered',
  },
  order_cancelled: {
    type: 'order_cancelled',
    category: 'order_lifecycle',
    urgency: 'critical',
    recipient: 'both',
    defaultEnabled: true,
    description: 'Order has been cancelled',
  },
  eta_updated: {
    type: 'eta_updated',
    category: 'order_lifecycle',
    urgency: 'medium',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Delivery ETA has been updated',
  },
  recurring_order_reminder: {
    type: 'recurring_order_reminder',
    category: 'order_lifecycle',
    urgency: 'medium',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Reminder for upcoming recurring order',
  },
  // ── Order Modifications ──
  order_modified: {
    type: 'order_modified',
    category: 'order_modifications',
    urgency: 'high',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Order has been modified by vendor',
  },
  modification_accepted: {
    type: 'modification_accepted',
    category: 'order_modifications',
    urgency: 'medium',
    recipient: 'vendor',
    defaultEnabled: true,
    description: 'Customer accepted order modification',
  },
  modification_rejected: {
    type: 'modification_rejected',
    category: 'order_modifications',
    urgency: 'high',
    recipient: 'vendor',
    defaultEnabled: true,
    description: 'Customer rejected order modification',
  },
  modification_timeout: {
    type: 'modification_timeout',
    category: 'order_modifications',
    urgency: 'high',
    recipient: 'both',
    defaultEnabled: true,
    description: 'Modification response window expired',
  },
  // ── RFP / Quotes ──
  rfp_submitted: {
    type: 'rfp_submitted',
    category: 'rfp_quotes',
    urgency: 'medium',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Quote request submitted successfully',
  },
  rfp_broadcast: {
    type: 'rfp_broadcast',
    category: 'rfp_quotes',
    urgency: 'high',
    recipient: 'vendor',
    defaultEnabled: true,
    description: 'New catering request in your area',
  },
  quote_received: {
    type: 'quote_received',
    category: 'rfp_quotes',
    urgency: 'high',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'New vendor quote received',
  },
  quote_accepted: {
    type: 'quote_accepted',
    category: 'rfp_quotes',
    urgency: 'high',
    recipient: 'vendor',
    defaultEnabled: true,
    description: 'Your quote has been accepted',
  },
  quote_declined: {
    type: 'quote_declined',
    category: 'rfp_quotes',
    urgency: 'medium',
    recipient: 'vendor',
    defaultEnabled: true,
    description: 'Your quote was not selected',
  },
  rfp_edited: {
    type: 'rfp_edited',
    category: 'rfp_quotes',
    urgency: 'high',
    recipient: 'vendor',
    defaultEnabled: true,
    description: 'Quote request was edited — review your quote',
  },
  rfp_expired: {
    type: 'rfp_expired',
    category: 'rfp_quotes',
    urgency: 'medium',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Quote request has expired',
  },
  finalization_expired: {
    type: 'finalization_expired',
    category: 'rfp_quotes',
    urgency: 'high',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Quote finalization window expired',
  },
  item_reassigned: {
    type: 'item_reassigned',
    category: 'rfp_quotes',
    urgency: 'high',
    recipient: 'vendor',
    defaultEnabled: true,
    description: 'Items were reassigned to another vendor',
  },
  // ── Payments ──
  payment_received: {
    type: 'payment_received',
    category: 'payments',
    urgency: 'high',
    recipient: 'both',
    defaultEnabled: true,
    description: 'Payment has been received',
  },
  payment_failed: {
    type: 'payment_failed',
    category: 'payments',
    urgency: 'critical',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Payment failed — action required',
  },
  refund_processed: {
    type: 'refund_processed',
    category: 'payments',
    urgency: 'high',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Refund has been processed',
  },
  // ── Messaging ──
  new_message: {
    type: 'new_message',
    category: 'messaging',
    urgency: 'medium',
    recipient: 'both',
    defaultEnabled: true,
    description: 'New message in order conversation',
  },
  vendor_reply: {
    type: 'vendor_reply',
    category: 'messaging',
    urgency: 'medium',
    recipient: 'customer',
    defaultEnabled: true,
    description: 'Vendor replied to your message',
  },
};

// ─── User Notification Preferences ──────────────────────────────────

export interface NotificationPreferences {
  userId: string;
  // Per-category channel toggles
  channels: {
    [K in NotificationCategory]: {
      in_app: boolean;
      push: boolean;
      email: boolean;
      sms: boolean;
    };
  };
  // Quiet hours (suppress push + SMS)
  quietHours: {
    enabled: boolean;
    start: string; // "22:00" (24h format)
    end: string;   // "08:00"
    timezone: string; // "America/Los_Angeles"
  };
  // Global toggles
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  // Timestamps
  updatedAt?: any;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'updatedAt'> = {
  channels: {
    order_lifecycle: { in_app: true, push: true, email: true, sms: true },
    order_modifications: { in_app: true, push: true, email: true, sms: false },
    rfp_quotes: { in_app: true, push: true, email: true, sms: false },
    payments: { in_app: true, push: true, email: true, sms: true },
    messaging: { in_app: true, push: true, email: false, sms: false },
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
    timezone: 'America/Los_Angeles',
  },
  emailEnabled: true,
  smsEnabled: true,
  pushEnabled: true,
};

// ─── Notification Document (Firestore) ──────────────────────────────

export interface NotificationDocument {
  id: string;
  recipientId: string;
  type: NotificationEventType;
  category: NotificationCategory;
  urgency: NotificationUrgency;
  title: string;
  body: string;
  // Context
  orderId?: string;
  quoteRequestId?: string;
  businessId?: string;
  businessName?: string;
  // State
  read: boolean;
  archived: boolean;
  // Multi-channel tracking
  channelsSent: ('in_app' | 'push' | 'email' | 'sms')[];
  // Deduplication
  deduplicationKey?: string;
  // Timestamps
  createdAt?: any;
  readAt?: any;
}

// ─── Email Template Definition ──────────────────────────────────────

export interface EmailTemplate {
  subject: string;
  preheader: string;
  heading: string;
  body: (data: Record<string, any>) => string;
  ctaText?: string;
  ctaUrl?: (data: Record<string, any>) => string;
}

// ─── SMS Template Definition ────────────────────────────────────────

export interface SmsTemplate {
  body: (data: Record<string, any>) => string;
  maxLength: number; // 160 for single segment
}
