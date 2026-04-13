const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat,
} = require("docx");

// ── Design tokens ──
const NAVY = "1A365D";
const BLUE = "2B6CB0";
const GREEN = "276749";
const ORANGE = "C05621";
const RED = "9B2C2C";
const GRAY = "718096";
const LIGHT_GRAY = "A0AEC0";
const LIGHT_BG = "F7FAFC";
const BLUE_BG = "EBF4FF";
const GREEN_BG = "F0FFF4";
const ORANGE_BG = "FFFAF0";
const RED_BG = "FFF5F5";
const PURPLE = "553C9A";
const PURPLE_BG = "FAF5FF";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E0" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellPad = { top: 60, bottom: 60, left: 100, right: 100 };

function cell(text, width, bg = "FFFFFF", color = "2D3748", bold = false, align = AlignmentType.LEFT, fontSize = 18) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: cellPad, verticalAlign: "center",
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text, font: "Arial", size: fontSize, color, bold })] })],
  });
}

function multiLineCell(lines, width, bg = "FFFFFF") {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: cellPad, verticalAlign: "center",
    children: lines.map(l => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: l.text, font: "Arial", size: l.size || 18, color: l.color || "2D3748", bold: l.bold || false, italics: l.italics || false })] })),
  });
}

function headerRow(labels, widths) {
  return new TableRow({
    children: labels.map((l, i) => cell(l, widths[i], NAVY, "FFFFFF", true, AlignmentType.CENTER)),
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 0, after: 200 },
    children: [new TextRun({ text, font: "Arial", size: 32, bold: true, color: NAVY })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color: NAVY })],
  });
}
function h3(text) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22, bold: true, color: BLUE })],
  });
}
function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after || 160 },
    children: [new TextRun({ text, font: "Arial", size: opts.size || 22, color: opts.color || "2D3748", bold: opts.bold || false, italics: opts.italics || false })],
  });
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION PLAN DATA
// ═══════════════════════════════════════════════════════════════════

const orderFlowNotifications = [
  // ── ORDER LIFECYCLE: CUSTOMER ──
  {
    phase: "Order Placement",
    trigger: "Customer submits a new order",
    recipient: "Customer",
    inApp: { title: "Order Placed!", body: "Your order #{{orderId}} with {{businessName}} has been submitted. We'll notify you when the vendor confirms." },
    email: { subject: "Order Confirmed \u2014 {{businessName}}", body: "Hi {{customerName}},\n\nYour catering order (#{{orderId}}) for {{eventDate}} has been submitted to {{businessName}}.\n\nItems: {{itemSummary}}\nTotal: {{total}}\n\nYou'll receive updates as the vendor processes your order." },
    sms: "ethniCity: Your order #{{orderId}} with {{businessName}} (${{total}}) has been placed! We'll text you when confirmed.",
    channels: "In-App (instant) > Push > Email > SMS",
    priority: "High",
  },
  {
    phase: "Order Confirmed",
    trigger: "Vendor confirms the order",
    recipient: "Customer",
    inApp: { title: "Order Confirmed", body: "{{businessName}} has confirmed your catering order for {{eventDate}}." },
    email: { subject: "Confirmed! {{businessName}} accepted your order", body: "Great news, {{customerName}}!\n\n{{businessName}} has confirmed your catering order for {{eventDate}}.\n\nNext step: The vendor will begin preparation closer to your event date." },
    sms: "ethniCity: {{businessName}} confirmed your order for {{eventDate}}!",
    channels: "In-App (instant) > Push > Email",
    priority: "High",
  },
  {
    phase: "Order Preparing",
    trigger: "Vendor starts preparing the order",
    recipient: "Customer",
    inApp: { title: "Being Prepared", body: "{{businessName}} has started preparing your order." },
    email: null,
    sms: null,
    channels: "In-App (instant) > Push",
    priority: "Medium",
  },
  {
    phase: "Order Ready",
    trigger: "Vendor marks order as ready",
    recipient: "Customer",
    inApp: { title: "Order Ready!", body: "Your order from {{businessName}} is ready for pickup/delivery." },
    email: null,
    sms: "ethniCity: Your order from {{businessName}} is READY! ETA: {{eta}}",
    channels: "In-App (instant) > Push > SMS",
    priority: "High",
  },
  {
    phase: "Out for Delivery",
    trigger: "Order leaves the vendor",
    recipient: "Customer",
    inApp: { title: "On Its Way!", body: "Your order from {{businessName}} is out for delivery. ETA: {{eta}}" },
    email: null,
    sms: "ethniCity: Your order is on its way! ETA {{eta}}",
    channels: "In-App (instant) > Push > SMS",
    priority: "High",
  },
  {
    phase: "Delivered",
    trigger: "Order marked as delivered",
    recipient: "Customer",
    inApp: { title: "Delivered!", body: "Your order from {{businessName}} has been delivered. Enjoy! Leave a review?" },
    email: { subject: "How was your order from {{businessName}}?", body: "Hi {{customerName}},\n\nYour catering order has been delivered! We'd love to hear how it went.\n\n[Leave a Review] [Report an Issue]\n\nThanks for using ethniCity!" },
    sms: null,
    channels: "In-App (instant) > Push > Email (30 min delay)",
    priority: "Medium",
  },
  {
    phase: "Order Cancelled",
    trigger: "Order is cancelled (by customer or vendor)",
    recipient: "Customer",
    inApp: { title: "Order Cancelled", body: "Your order from {{businessName}} has been cancelled. {{reason}}" },
    email: { subject: "Order Cancelled \u2014 {{businessName}}", body: "Hi {{customerName}},\n\nYour order #{{orderId}} with {{businessName}} has been cancelled.\n\nReason: {{reason}}\n\n{{#if refundPending}}A refund has been initiated and will be processed within 5-7 business days.{{/if}}" },
    sms: "ethniCity: Your order #{{orderId}} has been cancelled. {{#if refundPending}}Refund initiated.{{/if}}",
    channels: "In-App (instant) > Push > Email > SMS",
    priority: "Critical",
  },
  // ── ORDER LIFECYCLE: VENDOR ──
  {
    phase: "New Order Received",
    trigger: "Customer places a new order",
    recipient: "Vendor",
    inApp: { title: "New Catering Order!", body: "{{customerName}} placed a ${{total}} order for {{eventDate}} ({{headcount}} guests)." },
    email: { subject: "New Order: ${{total}} for {{eventDate}}", body: "You have a new catering order!\n\nCustomer: {{customerName}}\nEvent: {{eventDate}} ({{headcount}} guests)\nItems: {{itemSummary}}\nTotal: ${{total}}\n\n[View & Confirm Order]" },
    sms: "ethniCity Vendor: New ${{total}} order from {{customerName}} for {{eventDate}}. Open app to confirm.",
    channels: "In-App (instant) > Push > SMS (if not opened in 5 min) > Email",
    priority: "Critical",
  },
  {
    phase: "Order Cancelled by Customer",
    trigger: "Customer cancels a confirmed order",
    recipient: "Vendor",
    inApp: { title: "Order Cancelled", body: "{{customerName}} cancelled their order for {{eventDate}}. Reason: {{reason}}" },
    email: { subject: "Order Cancelled by Customer", body: "{{customerName}} has cancelled their order.\n\nReason: {{reason}}\nOriginal Event Date: {{eventDate}}\n\nYour calendar has been updated." },
    sms: "ethniCity: {{customerName}} cancelled their {{eventDate}} order. Reason: {{reason}}",
    channels: "In-App (instant) > Push > Email",
    priority: "High",
  },
];

const modificationNotifications = [
  {
    phase: "Vendor Modifies Order",
    trigger: "Vendor edits items/pricing on a confirmed order",
    recipient: "Customer",
    inApp: { title: "Order Modified", body: "{{businessName}} updated your order: {{modNote}}. Review and approve/reject the changes." },
    email: { subject: "{{businessName}} modified your order \u2014 action needed", body: "Hi {{customerName}},\n\n{{businessName}} has made changes to your order:\n\n{{modNote}}\n\nNew total: ${{newTotal}} (was ${{oldTotal}})\n\nPlease review and accept or reject within 48 hours.\n\n[Accept Changes] [Reject Changes]" },
    sms: "ethniCity: {{businessName}} modified your order. New total: ${{newTotal}}. Open app to accept/reject (48hr window).",
    channels: "In-App (instant) > Push > Email > SMS (if no response in 2hr)",
    priority: "High",
  },
  {
    phase: "Customer Accepts Modification",
    trigger: "Customer approves vendor's changes",
    recipient: "Vendor",
    inApp: { title: "Changes Approved", body: "{{customerName}} accepted your modifications to their order." },
    email: null,
    sms: null,
    channels: "In-App (instant) > Push",
    priority: "Medium",
  },
  {
    phase: "Customer Rejects Modification",
    trigger: "Customer rejects vendor's changes",
    recipient: "Vendor",
    inApp: { title: "Changes Rejected", body: "{{customerName}} rejected your modifications. The order has been reverted to the original items." },
    email: { subject: "Modification Rejected \u2014 Order Reverted", body: "{{customerName}} rejected your proposed changes. The order has been reverted to the original items and pricing. No further action needed." },
    sms: null,
    channels: "In-App (instant) > Push > Email",
    priority: "High",
  },
  {
    phase: "Modification Auto-Expired",
    trigger: "48hr modification window expires without response",
    recipient: "Both",
    inApp: { title: "Modification Expired", body: "The pending modification was not responded to within 48 hours and has been auto-rejected. Original items restored." },
    email: { subject: "Modification expired \u2014 original order restored", body: "The pending modification on order #{{orderId}} was not responded to within the 48-hour window.\n\nThe order has been automatically reverted to its original items." },
    sms: null,
    channels: "In-App (instant) > Push > Email",
    priority: "Medium",
  },
];

const rfpNotifications = [
  {
    phase: "RFP Submitted",
    trigger: "Customer creates a new quote request",
    recipient: "Customer",
    inApp: { title: "Quote Request Sent!", body: "Your request for {{headcount}} guests on {{eventDate}} has been sent to {{vendorCount}} vendors." },
    email: { subject: "Quote Request Submitted \u2014 {{itemCount}} items", body: "Hi {{customerName}},\n\nYour catering quote request has been submitted!\n\nEvent: {{eventDate}} | {{headcount}} guests\nItems requested: {{itemCount}}\nVendors notified: {{vendorCount}}\n\nYou'll receive quotes as vendors respond." },
    sms: null,
    channels: "In-App (instant) > Email",
    priority: "Medium",
  },
  {
    phase: "New RFP Available",
    trigger: "A new quote request matches vendor's category/city",
    recipient: "Vendor",
    inApp: { title: "New Quote Request", body: "A customer is looking for catering for {{headcount}} guests on {{eventDate}} in {{city}}." },
    email: { subject: "New catering opportunity \u2014 {{headcount}} guests, {{eventDate}}", body: "A new quote request just came in!\n\nEvent: {{eventDate}}\nGuests: {{headcount}}\nLocation: {{city}}\nItems: {{itemSummary}}\n\nBe one of the first to respond!\n\n[Submit Your Quote]" },
    sms: "ethniCity: New catering request! {{headcount}} guests on {{eventDate}} in {{city}}. Open app to quote.",
    channels: "In-App (instant) > Push > SMS (if not opened in 10 min) > Email",
    priority: "High",
  },
  {
    phase: "Quote Received",
    trigger: "A vendor submits a quote response",
    recipient: "Customer",
    inApp: { title: "New Quote!", body: "{{businessName}} submitted a quote: ${{total}} for your {{eventDate}} event." },
    email: null,
    sms: "ethniCity: {{businessName}} quoted ${{total}} for your event! Open app to compare.",
    channels: "In-App (instant) > Push > SMS (first quote only)",
    priority: "High",
  },
  {
    phase: "Quote Accepted",
    trigger: "Customer accepts a vendor's quote",
    recipient: "Vendor",
    inApp: { title: "Quote Accepted!", body: "Your quote for {{eventDate}} has been accepted! Customer details are now visible." },
    email: { subject: "Your quote was accepted! \u2014 {{eventDate}}", body: "Congratulations!\n\nYour catering quote has been accepted.\n\nCustomer: {{customerName}}\nPhone: {{customerPhone}}\nEmail: {{customerEmail}}\nEvent: {{eventDate}}\n\n[View Order Details]" },
    sms: "ethniCity: Your quote was ACCEPTED! Customer: {{customerName}} ({{customerPhone}}). Open app for details.",
    channels: "In-App (instant) > Push > SMS > Email",
    priority: "Critical",
  },
  {
    phase: "Quote Declined",
    trigger: "Customer declines a vendor's quote",
    recipient: "Vendor",
    inApp: { title: "Quote Not Selected", body: "The customer chose another vendor for their {{eventDate}} event. Keep quoting \u2014 your next win is around the corner!" },
    email: null,
    sms: null,
    channels: "In-App only",
    priority: "Low",
  },
  {
    phase: "Item Reassigned (C3)",
    trigger: "Customer moves an item from one vendor to another",
    recipient: "Vendor (losing)",
    inApp: { title: "Items Reassigned", body: "The customer reassigned {{itemNames}} to another vendor. These items are no longer part of your assignment." },
    email: null,
    sms: null,
    channels: "In-App (instant) > Push",
    priority: "Medium",
  },
  {
    phase: "RFP Edited (H5)",
    trigger: "Customer edits an RFP after vendors have quoted",
    recipient: "Vendor",
    inApp: { title: "Quote Request Updated", body: "A request you quoted on was edited: {{editSummary}}. Your existing quote may need updating." },
    email: { subject: "Quote Request Updated \u2014 review your quote", body: "A catering request you responded to has been modified:\n\nChanges: {{editSummary}}\n\nYour existing quote may be outdated. Please review and update if needed.\n\n[Review Quote Request]" },
    sms: null,
    channels: "In-App (instant) > Push > Email",
    priority: "High",
  },
  {
    phase: "RFP Expired (C5)",
    trigger: "Open RFP older than 7 days with no orders created",
    recipient: "Customer",
    inApp: { title: "Request Expired", body: "Your quote request with {{itemCount}} items expired after 7 days. You can create a new one anytime." },
    email: { subject: "Your quote request has expired", body: "Hi {{customerName}},\n\nYour quote request ({{itemCount}} items, {{headcount}} guests) expired after 7 days without being finalized.\n\nReady to try again? Create a new request and you may receive quotes even faster.\n\n[Create New Request]" },
    sms: null,
    channels: "In-App (instant) > Email",
    priority: "Low",
  },
  {
    phase: "Finalization Expired (H6)",
    trigger: "Accepted quote not finalized within 72 hours",
    recipient: "Customer",
    inApp: { title: "Finalization Expired", body: "Your accepted items were not finalized within 72 hours. Vendor capacity has been released." },
    email: { subject: "Finalization window expired \u2014 action needed", body: "Hi {{customerName}},\n\nYour accepted catering items were not finalized within 72 hours. Vendor availability has been released.\n\nYou can re-accept items to start a new 72-hour finalization window.\n\n[Re-Accept Items]" },
    sms: "ethniCity: Your catering finalization expired. Vendor capacity released. Re-accept items in the app to restart.",
    channels: "In-App (instant) > Push > Email > SMS",
    priority: "High",
  },
];

const paymentNotifications = [
  {
    phase: "Payment Received",
    trigger: "Customer marks order as paid (transactionId recorded)",
    recipient: "Vendor",
    inApp: { title: "Payment Received", body: "{{customerName}} marked order #{{orderId}} as paid (${{total}})." },
    email: { subject: "Payment received \u2014 ${{total}}", body: "Payment confirmed for order #{{orderId}}.\n\nAmount: ${{total}}\nTransaction ID: {{transactionId}}\nPayment method: {{paymentMethod}}" },
    sms: null,
    channels: "In-App (instant) > Push > Email",
    priority: "High",
  },
  {
    phase: "Refund Initiated",
    trigger: "Paid order cancelled, paymentStatus set to refund_pending",
    recipient: "Customer",
    inApp: { title: "Refund Initiated", body: "A refund for ${{total}} from {{businessName}} has been initiated." },
    email: { subject: "Refund initiated \u2014 ${{total}}", body: "Hi {{customerName}},\n\nWe've initiated a refund of ${{total}} for your cancelled order from {{businessName}}.\n\nPlease allow 5-7 business days for processing." },
    sms: "ethniCity: Refund of ${{total}} initiated for your {{businessName}} order. Allow 5-7 days.",
    channels: "In-App (instant) > Push > Email > SMS",
    priority: "Critical",
  },
  {
    phase: "Refund Completed",
    trigger: "paymentStatus transitions to refunded",
    recipient: "Customer",
    inApp: { title: "Refund Complete", body: "Your ${{total}} refund from {{businessName}} has been processed." },
    email: { subject: "Refund complete \u2014 ${{total}}", body: "Good news! Your refund of ${{total}} from {{businessName}} has been processed.\n\nIf you don't see it within 3-5 business days, contact your payment provider." },
    sms: null,
    channels: "In-App (instant) > Email",
    priority: "Medium",
  },
];

const messagingNotifications = [
  {
    phase: "New Message",
    trigger: "Customer or vendor sends an order note",
    recipient: "Other party",
    inApp: { title: "New Message", body: "{{senderName}}: {{messagePreview}}" },
    email: null,
    sms: null,
    channels: "In-App (instant) > Push",
    priority: "Medium",
  },
  {
    phase: "Message Unread Reminder",
    trigger: "Message unread for 30+ minutes",
    recipient: "Recipient",
    inApp: null,
    email: { subject: "Unread message from {{senderName}}", body: "You have an unread message about your catering order:\n\n\"{{messagePreview}}\"\n\n[View Conversation]" },
    sms: null,
    channels: "Email (30 min delay, batch digest)",
    priority: "Low",
  },
];

// ═══════════════════════════════════════════════════════════════════
// BUILD DOCUMENT
// ═══════════════════════════════════════════════════════════════════

function buildNotificationTable(items, colWidths) {
  // colWidths: [phase, trigger, recipient, channels, priority]
  // total = 9360
  const rows = items.map((item, i) => {
    const bg = i % 2 === 0 ? LIGHT_BG : "FFFFFF";
    const prColor = item.priority === "Critical" ? RED : item.priority === "High" ? ORANGE : item.priority === "Medium" ? BLUE : GREEN;
    return new TableRow({
      children: [
        cell(item.phase, colWidths[0], bg, NAVY, true, AlignmentType.LEFT, 17),
        cell(item.trigger, colWidths[1], bg, "4A5568", false, AlignmentType.LEFT, 17),
        cell(item.recipient, colWidths[2], bg, PURPLE, true, AlignmentType.CENTER, 17),
        cell(item.channels, colWidths[3], bg, "4A5568", false, AlignmentType.LEFT, 16),
        cell(item.priority, colWidths[4], bg, prColor, true, AlignmentType.CENTER, 17),
      ],
    });
  });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      headerRow(["Phase", "Trigger Point", "To", "Channel Priority", "Urgency"], colWidths),
      ...rows,
    ],
  });
}

function buildMessageTable(items) {
  const rows = [];
  for (const item of items) {
    // In-App row
    if (item.inApp) {
      rows.push(new TableRow({ children: [
        cell(item.phase, 1400, BLUE_BG, NAVY, true, AlignmentType.LEFT, 17),
        cell("In-App", 900, BLUE_BG, BLUE, true, AlignmentType.CENTER, 17),
        multiLineCell([
          { text: item.inApp.title, bold: true, size: 18, color: NAVY },
          { text: item.inApp.body, size: 16, color: "4A5568" },
        ], 7060, BLUE_BG),
      ]}));
    }
    // Email row
    if (item.email) {
      rows.push(new TableRow({ children: [
        cell(item.phase, 1400, ORANGE_BG, NAVY, true, AlignmentType.LEFT, 17),
        cell("Email", 900, ORANGE_BG, ORANGE, true, AlignmentType.CENTER, 17),
        multiLineCell([
          { text: `Subject: ${item.email.subject}`, bold: true, size: 17, color: NAVY },
          { text: item.email.body.replace(/\n/g, " | ").substring(0, 200) + "...", size: 15, color: "4A5568", italics: true },
        ], 7060, ORANGE_BG),
      ]}));
    }
    // SMS row
    if (item.sms) {
      rows.push(new TableRow({ children: [
        cell(item.phase, 1400, GREEN_BG, NAVY, true, AlignmentType.LEFT, 17),
        cell("SMS", 900, GREEN_BG, GREEN, true, AlignmentType.CENTER, 17),
        cell(item.sms, 7060, GREEN_BG, "4A5568", false, AlignmentType.LEFT, 16),
      ]}));
    }
  }

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1400, 900, 7060],
    rows: [
      headerRow(["Phase", "Channel", "Message Content"], [1400, 900, 7060]),
      ...rows,
    ],
  });
}

function build() {
  const children = [];
  const colW = [1500, 2700, 900, 3060, 1200];

  // ── TITLE PAGE ──
  children.push(
    new Paragraph({ spacing: { before: 2000 }, children: [] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "ethniCity", font: "Arial", size: 56, bold: true, color: NAVY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Catering Module", font: "Arial", size: 36, color: BLUE })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "Notification System Plan", font: "Arial", size: 44, bold: true, color: NAVY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "UX-Focused Design for In-App, Email, and SMS Channels", font: "Arial", size: 22, color: GRAY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Web + Mobile Cross-Platform Architecture", font: "Arial", size: 22, color: GRAY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800 }, children: [new TextRun({ text: "April 7, 2026  |  Version 1.0", font: "Arial", size: 20, color: LIGHT_GRAY })] }),
    // Stats box
    new Table({
      width: { size: 5400, type: WidthType.DXA }, columnWidths: [2700, 2700],
      rows: [
        new TableRow({ children: [cell("Notification Events", 2700, BLUE_BG, "4A5568", true), cell("28", 2700, BLUE_BG, NAVY, true)] }),
        new TableRow({ children: [cell("Channels", 2700, LIGHT_BG, "4A5568", true), cell("In-App, Push, Email, SMS", 2700, LIGHT_BG, NAVY, true)] }),
        new TableRow({ children: [cell("Target Audiences", 2700, BLUE_BG, "4A5568", true), cell("Customer + Vendor", 2700, BLUE_BG, NAVY, true)] }),
        new TableRow({ children: [cell("Platforms", 2700, LIGHT_BG, "4A5568", true), cell("React Web PWA + Mobile", 2700, LIGHT_BG, NAVY, true)] }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── TABLE OF CONTENTS ──
  children.push(
    h1("Table of Contents"),
    para("1. Executive Summary"),
    para("2. Architecture Overview"),
    para("3. Channel Strategy & Priority Matrix"),
    para("4. Order Lifecycle Notifications (Trigger Map)"),
    para("5. Order Lifecycle \u2014 Message Content"),
    para("6. Order Modification Notifications"),
    para("7. Order Modification \u2014 Message Content"),
    para("8. RFP / Quote Flow Notifications"),
    para("9. RFP / Quote Flow \u2014 Message Content"),
    para("10. Payment Notifications"),
    para("11. Payment \u2014 Message Content"),
    para("12. Messaging / Chat Notifications"),
    para("13. User Preferences & Opt-Out Design"),
    para("14. Technical Architecture"),
    para("15. Implementation Roadmap"),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 1. EXECUTIVE SUMMARY ──
  children.push(
    h1("1. Executive Summary"),
    para("This document defines the complete notification plan for the ethniCity catering module. It maps every meaningful event in the order and quote lifecycle to specific notification messages across four channels: in-app (real-time), push notifications, email, and SMS."),
    para("The current system supports only in-app notifications via Firestore (14 notification types, real-time subscription). This plan extends coverage to email and SMS while introducing a channel-priority waterfall that respects user preferences, urgency levels, and platform context (web vs mobile)."),
    para("Design principles: notifications should be timely, actionable, and never spammy. Every message should tell the recipient what happened and what to do next. Low-priority events stay in-app only; critical events cascade across all channels."),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 2. ARCHITECTURE OVERVIEW ──
  children.push(
    h1("2. Architecture Overview"),
    h2("Current State (In-App Only)"),
    para("The existing notification system writes documents to a Firestore \"cateringNotifications\" collection. Each document contains a recipientId, type, title, body, and read flag. Clients subscribe via onSnapshot for real-time delivery. There are 14 notification types covering order status changes, modifications, quote events, and audit-fix additions (item_reassigned, rfp_edited, rfp_expired, finalization_expired)."),
    h2("Proposed Architecture (Multi-Channel)"),
    para("The plan adds three layers on top of the existing Firestore pipeline:"),
    h3("Layer 1: Notification Router (Cloud Function)"),
    para("A Firestore onCreate trigger on the cateringNotifications collection. When a new notification document is written, the router reads the notification type, recipient preferences, and urgency level, then fans out to the appropriate channels. This keeps the existing service layer untouched \u2014 all current sendCateringNotification() calls automatically gain multi-channel support."),
    h3("Layer 2: Channel Adapters"),
    para("Email Adapter: Firebase Extensions (Trigger Email from Firestore) or a lightweight SendGrid/Mailgun integration. Writes to a \"mail\" collection that the extension picks up. SMS Adapter: Twilio Functions or Firebase + Twilio extension. Writes to an \"sms\" collection. Push Adapter: Firebase Cloud Messaging (FCM) for both web and mobile. FCM tokens stored per-user in Firestore."),
    h3("Layer 3: Preference Engine"),
    para("A per-user \"notificationPreferences\" document in Firestore. Users can toggle channels (email, sms, push) per notification category (order updates, quote alerts, payment, messages). Defaults are opt-in for all channels."),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 3. CHANNEL STRATEGY ──
  children.push(
    h1("3. Channel Strategy & Priority Matrix"),
    para("Each notification event is assigned a urgency level that determines which channels fire and in what order. The waterfall ensures critical events reach users even when they're not in the app, while low-priority events avoid notification fatigue."),
    new Table({
      width: { size: 9360, type: WidthType.DXA }, columnWidths: [1200, 2400, 2400, 3360],
      rows: [
        headerRow(["Urgency", "Channels (Waterfall)", "Timing", "Examples"], [1200, 2400, 2400, 3360]),
        new TableRow({ children: [
          cell("Critical", 1200, RED_BG, RED, true, AlignmentType.CENTER),
          cell("In-App > Push > Email > SMS", 2400, RED_BG),
          cell("All fire within 30 seconds", 2400, RED_BG),
          cell("New order (vendor), cancellation, refund, quote accepted", 3360, RED_BG),
        ]}),
        new TableRow({ children: [
          cell("High", 1200, ORANGE_BG, ORANGE, true, AlignmentType.CENTER),
          cell("In-App > Push > Email", 2400, ORANGE_BG),
          cell("Instant in-app/push; email within 2 min", 2400, ORANGE_BG),
          cell("Order confirmed, ready, out for delivery, modification pending", 3360, ORANGE_BG),
        ]}),
        new TableRow({ children: [
          cell("Medium", 1200, BLUE_BG, BLUE, true, AlignmentType.CENTER),
          cell("In-App > Push", 2400, BLUE_BG),
          cell("Instant in-app; push if app backgrounded", 2400, BLUE_BG),
          cell("Preparing, new message, modification accepted, refund complete", 3360, BLUE_BG),
        ]}),
        new TableRow({ children: [
          cell("Low", 1200, GREEN_BG, GREEN, true, AlignmentType.CENTER),
          cell("In-App only", 2400, GREEN_BG),
          cell("Next time user opens app", 2400, GREEN_BG),
          cell("Quote declined, RFP expired, unread message digest", 3360, GREEN_BG),
        ]}),
      ],
    }),
    h3("SMS Budget Protection"),
    para("SMS is the most expensive channel. It fires only for Critical events and select High events (order ready, vendor new order escalation, finalization expiry). To control costs: batch low-value SMS into daily digests, deduplicate within 5-minute windows, and cap at 10 SMS per user per day."),
    h3("Push Notification Strategy"),
    para("Web: Uses the Web Push API via Firebase Cloud Messaging (FCM). Users opt in via browser prompt on first order. Mobile PWA: Same FCM integration. Native apps (Flutter): FCM for Android, APNs via FCM for iOS. Push fires for Critical, High, and Medium events. Collapsed/grouped on mobile to prevent notification overload."),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 4. ORDER LIFECYCLE TRIGGER MAP ──
  children.push(
    h1("4. Order Lifecycle Notifications"),
    para("The following table maps every order lifecycle event to its notification recipient, channel priority, and urgency level."),
    buildNotificationTable(orderFlowNotifications, colW),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 5. ORDER LIFECYCLE MESSAGES ──
  children.push(
    h1("5. Order Lifecycle \u2014 Message Content"),
    para("Exact message templates per channel. Variables in {{handlebars}} are populated at send time."),
    buildMessageTable(orderFlowNotifications),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 6. MODIFICATION TRIGGER MAP ──
  children.push(
    h1("6. Order Modification Notifications"),
    buildNotificationTable(modificationNotifications, colW),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 7. MODIFICATION MESSAGES ──
  children.push(
    h1("7. Order Modification \u2014 Message Content"),
    buildMessageTable(modificationNotifications),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 8. RFP TRIGGER MAP ──
  children.push(
    h1("8. RFP / Quote Flow Notifications"),
    buildNotificationTable(rfpNotifications, colW),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 9. RFP MESSAGES ──
  children.push(
    h1("9. RFP / Quote Flow \u2014 Message Content"),
    buildMessageTable(rfpNotifications),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 10. PAYMENT TRIGGER MAP ──
  children.push(
    h1("10. Payment Notifications"),
    buildNotificationTable(paymentNotifications, colW),
  );

  // ── 11. PAYMENT MESSAGES ──
  children.push(
    h1("11. Payment \u2014 Message Content"),
    buildMessageTable(paymentNotifications),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 12. MESSAGING ──
  children.push(
    h1("12. Messaging / Chat Notifications"),
    buildNotificationTable(messagingNotifications, colW),
    h2("Message Content"),
    buildMessageTable(messagingNotifications),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 13. USER PREFERENCES ──
  children.push(
    h1("13. User Preferences & Opt-Out Design"),
    h2("Default Settings (Opt-In)"),
    para("All users start with all channels enabled. This maximizes engagement for new users while respecting the ability to customize later."),
    new Table({
      width: { size: 9360, type: WidthType.DXA }, columnWidths: [2400, 1740, 1740, 1740, 1740],
      rows: [
        headerRow(["Category", "In-App", "Push", "Email", "SMS"], [2400, 1740, 1740, 1740, 1740]),
        new TableRow({ children: [cell("Order Updates", 2400, LIGHT_BG, NAVY, true), cell("Always On", 1740, LIGHT_BG, GREEN, true, AlignmentType.CENTER), cell("On", 1740, LIGHT_BG, GREEN, false, AlignmentType.CENTER), cell("On", 1740, LIGHT_BG, GREEN, false, AlignmentType.CENTER), cell("Critical Only", 1740, LIGHT_BG, ORANGE, false, AlignmentType.CENTER)] }),
        new TableRow({ children: [cell("Quote Alerts", 2400, "FFFFFF", NAVY, true), cell("Always On", 1740, "FFFFFF", GREEN, true, AlignmentType.CENTER), cell("On", 1740, "FFFFFF", GREEN, false, AlignmentType.CENTER), cell("On", 1740, "FFFFFF", GREEN, false, AlignmentType.CENTER), cell("Off", 1740, "FFFFFF", RED, false, AlignmentType.CENTER)] }),
        new TableRow({ children: [cell("Payment", 2400, LIGHT_BG, NAVY, true), cell("Always On", 1740, LIGHT_BG, GREEN, true, AlignmentType.CENTER), cell("On", 1740, LIGHT_BG, GREEN, false, AlignmentType.CENTER), cell("On", 1740, LIGHT_BG, GREEN, false, AlignmentType.CENTER), cell("Critical Only", 1740, LIGHT_BG, ORANGE, false, AlignmentType.CENTER)] }),
        new TableRow({ children: [cell("Messages", 2400, "FFFFFF", NAVY, true), cell("Always On", 1740, "FFFFFF", GREEN, true, AlignmentType.CENTER), cell("On", 1740, "FFFFFF", GREEN, false, AlignmentType.CENTER), cell("Digest", 1740, "FFFFFF", BLUE, false, AlignmentType.CENTER), cell("Off", 1740, "FFFFFF", RED, false, AlignmentType.CENTER)] }),
        new TableRow({ children: [cell("Marketing", 2400, LIGHT_BG, NAVY, true), cell("On", 1740, LIGHT_BG, GREEN, false, AlignmentType.CENTER), cell("Off", 1740, LIGHT_BG, RED, false, AlignmentType.CENTER), cell("On", 1740, LIGHT_BG, GREEN, false, AlignmentType.CENTER), cell("Off", 1740, LIGHT_BG, RED, false, AlignmentType.CENTER)] }),
      ],
    }),
    h2("Preference UI"),
    para("Both web and mobile display a \"Notification Settings\" screen under Profile > Settings. Each category shows toggles for Push, Email, and SMS (In-App is always on and cannot be disabled). On mobile, the screen follows native toggle patterns (iOS-style switches). On web, standard toggle components with immediate save (no submit button needed)."),
    h2("Quiet Hours"),
    para("Users can set quiet hours (e.g., 10 PM \u2013 7 AM) during which push and SMS are suppressed. Critical notifications (cancellations, refunds) bypass quiet hours. Email is never suppressed by quiet hours since users check email on their own schedule."),
    h2("Vendor-Specific Defaults"),
    para("Vendors default to more aggressive notification settings since missed orders directly impact revenue. New Order and Quote Accepted always fire on all channels. Vendors cannot disable In-App or Push for order-related events. SMS escalation fires if a new order is not opened within 5 minutes."),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 14. TECHNICAL ARCHITECTURE ──
  children.push(
    h1("14. Technical Architecture"),
    h2("Firestore Data Model"),
    para("notificationPreferences/{userId} \u2014 Channel toggles per category, quiet hours, phone number, FCM tokens. cateringNotifications/{notifId} \u2014 Existing collection, no changes. mail/{mailId} \u2014 Firebase Trigger Email extension reads this. sms/{smsId} \u2014 Cloud Function processes and sends via Twilio."),
    h2("Cloud Function: notificationRouter"),
    para("Triggered by: firestore.document('cateringNotifications/{notifId}').onCreate(). Reads the new document, looks up user preferences, and writes to the appropriate channel collections (mail, sms) and sends FCM push. The function is idempotent (checks for duplicate notifId). Expected latency: under 2 seconds for all channels."),
    h2("Cross-Platform Compatibility"),
    new Table({
      width: { size: 9360, type: WidthType.DXA }, columnWidths: [1800, 3780, 3780],
      rows: [
        headerRow(["Channel", "Web (React PWA)", "Mobile (Flutter / React Native)"], [1800, 3780, 3780]),
        new TableRow({ children: [cell("In-App", 1800, LIGHT_BG, NAVY, true), cell("Firestore onSnapshot \u2014 real-time, already implemented", 3780, LIGHT_BG), cell("Same Firestore subscription via native SDK", 3780, LIGHT_BG)] }),
        new TableRow({ children: [cell("Push", 1800, "FFFFFF", NAVY, true), cell("Web Push API via FCM; browser permission prompt", 3780, "FFFFFF"), cell("FCM (Android) / APNs via FCM (iOS); system permissions", 3780, "FFFFFF")] }),
        new TableRow({ children: [cell("Email", 1800, LIGHT_BG, NAVY, true), cell("Server-side only (Cloud Function + SendGrid/Mailgun)", 3780, LIGHT_BG), cell("Same server-side pipeline; no client code needed", 3780, LIGHT_BG)] }),
        new TableRow({ children: [cell("SMS", 1800, "FFFFFF", NAVY, true), cell("Server-side only (Cloud Function + Twilio)", 3780, "FFFFFF"), cell("Same server-side pipeline; no client code needed", 3780, "FFFFFF")] }),
      ],
    }),
    h2("Rate Limiting & Deduplication"),
    para("Per-user: max 10 SMS/day, max 50 emails/day, max 100 push/day. Deduplication window: 5 minutes (same type + recipient + orderId). Batch digests: unread messages grouped into a single email every 30 minutes. Exponential backoff on channel failures (same pattern as FIX-M2 message retry)."),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── 15. IMPLEMENTATION ROADMAP ──
  children.push(
    h1("15. Implementation Roadmap"),
    new Table({
      width: { size: 9360, type: WidthType.DXA }, columnWidths: [1200, 2400, 3360, 2400],
      rows: [
        headerRow(["Phase", "Scope", "Deliverables", "Timeline"], [1200, 2400, 3360, 2400]),
        new TableRow({ children: [
          cell("Phase 1", 1200, GREEN_BG, GREEN, true, AlignmentType.CENTER),
          cell("Push Notifications", 2400, GREEN_BG),
          cell("FCM integration, token management, Web Push prompt, notification grouping", 3360, GREEN_BG),
          cell("1 week", 2400, GREEN_BG, GREEN, true, AlignmentType.CENTER),
        ]}),
        new TableRow({ children: [
          cell("Phase 2", 1200, BLUE_BG, BLUE, true, AlignmentType.CENTER),
          cell("Email Channel", 2400, BLUE_BG),
          cell("Cloud Function router, SendGrid integration, email templates, Trigger Email extension", 3360, BLUE_BG),
          cell("1 week", 2400, BLUE_BG, BLUE, true, AlignmentType.CENTER),
        ]}),
        new TableRow({ children: [
          cell("Phase 3", 1200, ORANGE_BG, ORANGE, true, AlignmentType.CENTER),
          cell("SMS Channel", 2400, ORANGE_BG),
          cell("Twilio integration, phone verification, SMS templates, rate limiting", 3360, ORANGE_BG),
          cell("1 week", 2400, ORANGE_BG, ORANGE, true, AlignmentType.CENTER),
        ]}),
        new TableRow({ children: [
          cell("Phase 4", 1200, PURPLE_BG, PURPLE, true, AlignmentType.CENTER),
          cell("Preferences & Polish", 2400, PURPLE_BG),
          cell("Preference UI (web + mobile), quiet hours, batch digests, dedup, analytics dashboard", 3360, PURPLE_BG),
          cell("1 week", 2400, PURPLE_BG, PURPLE, true, AlignmentType.CENTER),
        ]}),
      ],
    }),
    para(""),
    para("Total estimated effort: 4 weeks for a single developer, with each phase independently deployable. Phase 1 (push) delivers the highest impact with the lowest effort, since the existing Firestore pipeline already handles in-app delivery."),
  );

  // ── Build document ──
  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, font: "Arial", color: NAVY }, paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: "Arial", color: NAVY }, paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 } },
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
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 1 } },
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "ethniCity Notification Plan", font: "Arial", size: 18, color: BLUE, bold: true }),
              new TextRun({ text: "  |  In-App + Email + SMS  |  Web + Mobile", font: "Arial", size: 16, color: LIGHT_GRAY }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E0", space: 1 } },
            children: [
              new TextRun({ text: "Page ", font: "Arial", size: 16, color: LIGHT_GRAY }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: LIGHT_GRAY }),
              new TextRun({ text: "  |  Confidential  |  April 7, 2026", font: "Arial", size: 16, color: LIGHT_GRAY }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  return doc;
}

async function main() {
  const doc = build();
  const buffer = await Packer.toBuffer(doc);
  const outPath = "/sessions/wizardly-brave-goodall/mnt/ethniCity_03_19_2026/ethniCity_Notification_Plan.docx";
  fs.writeFileSync(outPath, buffer);
  console.log(`Written to ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
