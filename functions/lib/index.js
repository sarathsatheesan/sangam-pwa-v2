"use strict";
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
exports.processNotification = exports.remindRecurringOrders = exports.expireStaleQuoteRequests = exports.onCateringOrderStatusChange = exports.processRecurringCateringOrders = exports.transcribeVoiceMessage = exports.sendNewMessageNotification = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const speech_1 = require("@google-cloud/speech");
admin.initializeApp();
const db = admin.firestore();
const speechClient = new speech_1.SpeechClient();
/**
 * Cloud Function: sendNewMessageNotification
 *
 * Triggers when a new message is created in any conversation.
 * Looks up FCM tokens for all participants (except the sender),
 * and sends a push notification via Firebase Cloud Messaging.
 *
 * Firestore path: /conversations/{conversationId}/messages/{messageId}
 */
exports.sendNewMessageNotification = (0, firestore_1.onDocumentCreated)("conversations/{conversationId}/messages/{messageId}", async (event) => {
    var _a;
    const snap = event.data;
    if (!snap)
        return;
    const messageData = snap.data();
    const senderId = messageData.senderId;
    const conversationId = event.params.conversationId;
    // Skip system messages or messages without a sender
    if (!senderId || senderId === "system")
        return;
    // Get the conversation to find participants
    const convDoc = await db
        .collection("conversations")
        .doc(conversationId)
        .get();
    if (!convDoc.exists)
        return;
    const convData = convDoc.data();
    if (!convData)
        return;
    const participants = convData.participants || [];
    // Get recipient IDs (everyone except the sender)
    const recipientIds = participants.filter((id) => id !== senderId);
    if (recipientIds.length === 0)
        return;
    // Get sender's name for the notification
    const senderDoc = await db.collection("users").doc(senderId).get();
    const senderName = senderDoc.exists
        ? ((_a = senderDoc.data()) === null || _a === void 0 ? void 0 : _a.name) || "Someone"
        : "Someone";
    // Build notification body based on message type
    let notificationBody = "Sent you a message";
    const text = messageData.text;
    const image = messageData.image;
    const voiceMessage = messageData.voiceMessage;
    const file = messageData.file;
    if (voiceMessage) {
        notificationBody = "Sent a voice message";
    }
    else if (file) {
        notificationBody = `Sent a file: ${file.name || "document"}`;
    }
    else if (image && !text) {
        notificationBody = "Sent a photo";
    }
    else if (text) {
        // Truncate long messages, handle encrypted messages
        const isEncrypted = messageData.encrypted;
        if (isEncrypted) {
            notificationBody = "Sent an encrypted message";
        }
        else {
            notificationBody = text.length > 100 ? text.slice(0, 100) + "..." : text;
        }
    }
    // Collect FCM tokens from all recipients
    const tokens = [];
    const tokenToUserMap = new Map();
    for (const recipientId of recipientIds) {
        const userDoc = await db.collection("users").doc(recipientId).get();
        if (!userDoc.exists)
            continue;
        const userData = userDoc.data();
        const fcmTokens = userData === null || userData === void 0 ? void 0 : userData.fcmTokens;
        if (fcmTokens && fcmTokens.length > 0) {
            fcmTokens.forEach((token) => {
                tokens.push(token);
                tokenToUserMap.set(token, recipientId);
            });
        }
    }
    if (tokens.length === 0)
        return;
    // Build the notification payload
    const isGroup = convData.isGroup;
    const groupName = convData.groupName;
    const notification = {
        title: isGroup ? `${senderName} in ${groupName || "Group"}` : senderName,
        body: notificationBody,
    };
    const data = {
        type: "new_message",
        conversationId,
        senderId,
        senderName,
        click_action: `https://mithr-1e5f4.web.app/messages`,
    };
    // Send to all tokens
    const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification,
        data,
        webpush: {
            fcmOptions: {
                link: `https://mithr-1e5f4.web.app/messages`,
            },
            notification: {
                icon: "/icon-192.png",
                badge: "/icon-192.png",
                tag: `msg-${conversationId}`,
                renotify: true,
            },
        },
    });
    // Clean up invalid tokens
    if (response.failureCount > 0) {
        const tokensToRemove = [];
        response.responses.forEach((resp, idx) => {
            var _a;
            if (!resp.success &&
                ((_a = resp.error) === null || _a === void 0 ? void 0 : _a.code) === "messaging/registration-token-not-registered") {
                const token = tokens[idx];
                const userId = tokenToUserMap.get(token);
                if (userId) {
                    tokensToRemove.push({ userId, token });
                }
            }
        });
        // Remove stale tokens from user docs
        for (const { userId, token } of tokensToRemove) {
            await db
                .collection("users")
                .doc(userId)
                .update({
                fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
            });
        }
    }
});
/**
 * Cloud Function: transcribeVoiceMessage
 *
 * Callable function that takes a conversationId + messageId,
 * reads the voice message audio from Firestore, sends it to
 * Google Cloud Speech-to-Text, and stores the transcription
 * back on the message document.
 */
exports.transcribeVoiceMessage = (0, https_1.onCall)({ maxInstances: 10, timeoutSeconds: 120, invoker: "public" }, async (request) => {
    var _a;
    // Require authentication
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in to transcribe.");
    }
    const { conversationId, messageId, audioData } = request.data;
    if (!conversationId || !messageId) {
        throw new https_1.HttpsError("invalid-argument", "conversationId and messageId are required.");
    }
    if (!audioData) {
        throw new https_1.HttpsError("invalid-argument", "audioData is required (decrypted audio from client).");
    }
    // Extract base64 audio content and detect mime type
    let audioBytes;
    let mimeType = "audio/webm";
    if (audioData.startsWith("data:")) {
        const commaIdx = audioData.indexOf(",");
        const header = audioData.substring(0, commaIdx);
        audioBytes = audioData.substring(commaIdx + 1);
        const mimeMatch = header.match(/data:([^;]+)/);
        if (mimeMatch)
            mimeType = mimeMatch[1];
    }
    else {
        audioBytes = audioData;
    }
    // Map MIME type to Speech-to-Text encoding enum values
    // See: https://cloud.google.com/speech-to-text/docs/encoding
    let encoding = 9; // WEBM_OPUS = 9
    if (mimeType.includes("mp4")) {
        encoding = 0; // ENCODING_UNSPECIFIED — let API auto-detect for mp4
    }
    else if (mimeType.includes("ogg")) {
        encoding = 6; // OGG_OPUS = 6
    }
    try {
        const [response] = await speechClient.recognize({
            audio: { content: audioBytes },
            config: {
                encoding: encoding,
                sampleRateHertz: encoding === 0 ? 0 : 48000, // 0 = auto-detect for mp4
                languageCode: "en-US",
                alternativeLanguageCodes: ["ml-IN", "hi-IN", "ta-IN", "te-IN"],
                model: "latest_long",
                enableAutomaticPunctuation: true,
            },
        });
        const transcription = ((_a = response.results) === null || _a === void 0 ? void 0 : _a.map((r) => { var _a, _b; return ((_b = (_a = r.alternatives) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.transcript) || ""; }).join(" ").trim()) || "";
        if (!transcription) {
            return { transcription: "", error: "No speech detected in this audio" };
        }
        // Save transcription back to Firestore message document
        const msgRef = db
            .collection("conversations")
            .doc(conversationId)
            .collection("messages")
            .doc(messageId);
        await msgRef.update({
            "voiceMessage.transcription": transcription,
        });
        return { transcription };
    }
    catch (err) {
        console.error("[transcribeVoiceMessage] Speech-to-Text error:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        throw new https_1.HttpsError("internal", `Transcription failed: ${errorMessage}`);
    }
});
// ═════════════════════════════════════════════════════════════════════════════════
// PHASE 6: RECURRING CATERING ORDERS — SCHEDULED FUNCTION
// Runs every day at 6:00 AM UTC. Finds recurring orders whose nextRunDate is
// today, places the order, bumps stats, and computes the next run date.
// ═════════════════════════════════════════════════════════════════════════════════
/**
 * Compute the next run date from a schedule config (server-side mirror of client logic).
 * Throws if schedule is invalid or no valid date found within 365 days.
 */
function computeNextRunDateServer(schedule, afterDate) {
    // Input validation
    if (!schedule)
        throw new Error("Schedule is required");
    const hasCalendarDays = schedule.daysOfWeek && schedule.daysOfWeek.length > 0;
    const hasDayOfMonth = !!schedule.dayOfMonth;
    const hasInterval = !!schedule.interval;
    if (!hasCalendarDays && !hasDayOfMonth && !hasInterval) {
        throw new Error("Schedule must specify daysOfWeek, dayOfMonth, or interval");
    }
    const after = afterDate ? new Date(afterDate) : new Date();
    if (isNaN(after.getTime()))
        throw new Error(`Invalid afterDate: ${afterDate}`);
    after.setHours(0, 0, 0, 0);
    const skipSet = new Set(schedule.skipDates || []);
    // Calendar-based: specific days of week
    if (hasCalendarDays) {
        // Validate day numbers
        if (schedule.daysOfWeek.some(d => d < 0 || d > 6)) {
            throw new Error("daysOfWeek must contain values 0-6 (Sun-Sat)");
        }
        const candidate = new Date(after);
        candidate.setDate(candidate.getDate() + 1);
        for (let i = 0; i < 365; i++) {
            const iso = candidate.toISOString().slice(0, 10);
            if (schedule.daysOfWeek.includes(candidate.getDay()) && !skipSet.has(iso)) {
                if (!schedule.endDate || iso <= schedule.endDate)
                    return iso;
            }
            candidate.setDate(candidate.getDate() + 1);
        }
        throw new Error("No valid run date found within 365 days for daysOfWeek schedule");
    }
    // Calendar-based: specific day of month
    if (hasDayOfMonth) {
        if (schedule.dayOfMonth < 1 || schedule.dayOfMonth > 31) {
            throw new Error("dayOfMonth must be between 1 and 31");
        }
        const candidate = new Date(after);
        candidate.setDate(candidate.getDate() + 1);
        for (let i = 0; i < 365; i++) {
            if (candidate.getDate() === schedule.dayOfMonth) {
                const iso = candidate.toISOString().slice(0, 10);
                if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate))
                    return iso;
            }
            candidate.setDate(candidate.getDate() + 1);
        }
        throw new Error("No valid run date found within 365 days for dayOfMonth schedule");
    }
    // Simple interval mode
    const intervalDays = {
        daily: 1,
        weekly: 7,
        biweekly: 14,
        monthly: 30,
    };
    const days = intervalDays[schedule.interval];
    if (!days)
        throw new Error(`Unknown interval: ${schedule.interval}`);
    const candidate = new Date(after);
    candidate.setDate(candidate.getDate() + days);
    for (let i = 0; i < 365; i++) {
        const iso = candidate.toISOString().slice(0, 10);
        if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate))
            return iso;
        candidate.setDate(candidate.getDate() + 1);
    }
    throw new Error("No valid run date found within 365 days for interval schedule");
}
exports.processRecurringCateringOrders = (0, scheduler_1.onSchedule)({
    schedule: "every day 06:00",
    timeZone: "America/Los_Angeles",
    retryCount: 2,
    maxInstances: 1,
}, async () => {
    const today = new Date().toISOString().slice(0, 10);
    console.log(`[recurring-catering] Processing orders for ${today}`);
    // Find all active recurring orders whose nextRunDate is today
    const snap = await db
        .collection("cateringRecurring")
        .where("active", "==", true)
        .where("nextRunDate", "==", today)
        .get();
    if (snap.empty) {
        console.log("[recurring-catering] No orders to process today.");
        return;
    }
    console.log(`[recurring-catering] Found ${snap.size} recurring order(s) to process.`);
    // Process each recurring order sequentially to avoid batch race conditions
    let processed = 0;
    let failed = 0;
    for (const recDoc of snap.docs) {
        const rec = recDoc.data();
        try {
            // Calculate total from items
            const total = (rec.items || []).reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
            // Get customer info for the order
            const userSnap = await db.collection("users").doc(rec.userId).get();
            const userData = userSnap.exists ? userSnap.data() : {};
            // Create the catering order
            await db.collection("cateringOrders").add({
                customerId: rec.userId,
                customerName: (userData === null || userData === void 0 ? void 0 : userData.name) || rec.contactName || "",
                customerEmail: (userData === null || userData === void 0 ? void 0 : userData.email) || "",
                customerPhone: rec.contactPhone || "",
                businessId: rec.businessId,
                businessName: rec.businessName,
                items: rec.items,
                subtotal: total,
                total: total,
                status: "pending",
                eventDate: today,
                deliveryAddress: rec.deliveryAddress,
                headcount: rec.headcount || 1,
                specialInstructions: rec.specialInstructions || "",
                orderForContext: rec.orderForContext || { type: "self" },
                contactName: rec.contactName,
                contactPhone: rec.contactPhone,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                statusHistory: [
                    {
                        status: "pending",
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    },
                ],
                isRecurring: true,
                recurringOrderId: recDoc.id,
            });
            // Compute next run date
            let nextRun;
            try {
                nextRun = computeNextRunDateServer(rec.schedule, today);
            }
            catch (scheduleErr) {
                // If schedule is invalid, deactivate the recurring order
                console.warn(`[recurring-catering] Invalid schedule for ${recDoc.id}: ${scheduleErr.message}. Deactivating.`);
                await recDoc.ref.update({
                    active: false,
                    nextRunDate: "",
                    lastRunDate: today,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                failed++;
                continue;
            }
            // Update the recurring order document
            const updates = {
                lastRunDate: today,
                totalOrdersPlaced: (rec.totalOrdersPlaced || 0) + 1,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                nextRunDate: nextRun,
            };
            await recDoc.ref.update(updates);
            processed++;
            console.log(`[recurring-catering] Placed order for ${rec.label} (${rec.businessName}). Next: ${nextRun || "deactivated"}`);
        }
        catch (err) {
            failed++;
            console.error(`[recurring-catering] Error processing ${recDoc.id}:`, err);
        }
    }
    console.log(`[recurring-catering] Done. Processed: ${processed}, Failed: ${failed}`);
});
// ═════════════════════════════════════════════════════════════════════════════════
// PHASE 7: ORDER STATUS CHANGE NOTIFICATIONS
// Sends FCM push notifications to customers when their order status changes,
// and to vendors when a new order is placed.
// ═════════════════════════════════════════════════════════════════════════════════
const STATUS_LABELS = {
    pending: "Order Placed",
    confirmed: "Confirmed",
    preparing: "Being Prepared",
    ready: "Ready for Pickup/Delivery",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
};
exports.onCateringOrderStatusChange = (0, firestore_1.onDocumentUpdated)("cateringOrders/{orderId}", async (event) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    if (!before || !after)
        return;
    const oldStatus = before.status;
    const newStatus = after.status;
    // Only fire if status actually changed
    if (oldStatus === newStatus)
        return;
    const orderId = event.params.orderId;
    const businessName = after.businessName || "Your caterer";
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    console.log(`[order-status-notify] Order ${orderId}: ${oldStatus} → ${newStatus}`);
    // ── Notify the customer ──
    const customerId = after.customerId;
    if (customerId) {
        try {
            const userDoc = await db.collection("users").doc(customerId).get();
            const fcmTokens = ((_e = userDoc.data()) === null || _e === void 0 ? void 0 : _e.fcmTokens) || [];
            const fcmToken = (_f = userDoc.data()) === null || _f === void 0 ? void 0 : _f.fcmToken;
            const allTokens = [...fcmTokens, ...(fcmToken ? [fcmToken] : [])].filter(Boolean);
            if (allTokens.length > 0) {
                const notification = {
                    title: `Order ${statusLabel}`,
                    body: newStatus === "cancelled"
                        ? `Your order from ${businessName} has been cancelled.${after.cancellationReason ? ` Reason: ${after.cancellationReason}` : ""}`
                        : `Your order from ${businessName} is now ${statusLabel.toLowerCase()}.`,
                };
                const message = {
                    tokens: allTokens,
                    notification,
                    data: {
                        type: "catering_order_status",
                        orderId,
                        status: newStatus,
                    },
                };
                const result = await admin.messaging().sendEachForMulticast(message);
                console.log(`[order-status-notify] Customer notification: ${result.successCount} sent, ${result.failureCount} failed`);
            }
        }
        catch (err) {
            console.error(`[order-status-notify] Error notifying customer ${customerId}:`, err);
        }
    }
    // ── Notify vendor when a new order is placed (pending) ──
    if (newStatus === "pending" && oldStatus !== "pending")
        return; // Only notify on creation
    if (oldStatus === "" || !before.status) {
        // This is a newly created order — notify the vendor
        const businessId = after.businessId;
        if (businessId) {
            try {
                const bizDoc = await db.collection("businesses").doc(businessId).get();
                const ownerId = (_g = bizDoc.data()) === null || _g === void 0 ? void 0 : _g.ownerId;
                if (ownerId) {
                    const ownerDoc = await db.collection("users").doc(ownerId).get();
                    const ownerTokens = ((_h = ownerDoc.data()) === null || _h === void 0 ? void 0 : _h.fcmTokens) || [];
                    const ownerToken = (_j = ownerDoc.data()) === null || _j === void 0 ? void 0 : _j.fcmToken;
                    const allOwnerTokens = [...ownerTokens, ...(ownerToken ? [ownerToken] : [])].filter(Boolean);
                    if (allOwnerTokens.length > 0) {
                        const customerName = after.customerName || "A customer";
                        await admin.messaging().sendEachForMulticast({
                            tokens: allOwnerTokens,
                            notification: {
                                title: "New Catering Order!",
                                body: `${customerName} placed a catering order for ${after.headcount || "?"} guests.`,
                            },
                            data: {
                                type: "catering_new_order",
                                orderId,
                            },
                        });
                        console.log(`[order-status-notify] Vendor ${ownerId} notified of new order`);
                    }
                }
            }
            catch (err) {
                console.error(`[order-status-notify] Error notifying vendor:`, err);
            }
        }
    }
});
// ═════════════════════════════════════════════════════════════════════════════════
// PHASE 7: AUTO-EXPIRE STALE QUOTE REQUESTS
// Runs daily. Finds open quote requests past their expiresAt date and marks
// them as expired. Notifies the customer via FCM.
// ═════════════════════════════════════════════════════════════════════════════════
exports.expireStaleQuoteRequests = (0, scheduler_1.onSchedule)({
    schedule: "every day 07:00",
    timeZone: "America/Los_Angeles",
    retryCount: 1,
    maxInstances: 1,
}, async () => {
    var _a, _b, _c;
    const now = admin.firestore.Timestamp.now();
    console.log(`[expire-rfq] Checking for expired quote requests at ${now.toDate().toISOString()}`);
    // Find open requests that have passed their expiration
    const snap = await db
        .collection("cateringQuoteRequests")
        .where("status", "==", "open")
        .where("expiresAt", "<=", now)
        .get();
    if (snap.empty) {
        console.log("[expire-rfq] No expired requests found.");
        return;
    }
    console.log(`[expire-rfq] Found ${snap.size} expired request(s).`);
    let expired = 0;
    for (const reqDoc of snap.docs) {
        try {
            await reqDoc.ref.update({ status: "expired" });
            // Notify customer
            const customerId = reqDoc.data().customerId;
            if (customerId) {
                const userDoc = await db.collection("users").doc(customerId).get();
                const tokens = [
                    ...(((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens) || []),
                    ...(((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.fcmToken) ? [(_c = userDoc.data()) === null || _c === void 0 ? void 0 : _c.fcmToken] : []),
                ].filter(Boolean);
                if (tokens.length > 0) {
                    const category = reqDoc.data().cuisineCategory || "Catering";
                    await admin.messaging().sendEachForMulticast({
                        tokens,
                        notification: {
                            title: "Quote Request Expired",
                            body: `Your ${category} quote request has expired. You can create a new one anytime.`,
                        },
                        data: {
                            type: "rfq_expired",
                            requestId: reqDoc.id,
                        },
                    });
                }
            }
            expired++;
        }
        catch (err) {
            console.error(`[expire-rfq] Error expiring ${reqDoc.id}:`, err);
        }
    }
    console.log(`[expire-rfq] Done. Expired: ${expired}`);
});
// ═════════════════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════════
// PHASE 7B: RECURRING ORDER 24HR REMINDER
// Runs daily at 8:00 AM. Finds active recurring orders whose nextRunDate is
// tomorrow, and sends a push/email/SMS reminder so users can modify or skip.
// ═════════════════════════════════════════════════════════════════════════════════
exports.remindRecurringOrders = (0, scheduler_1.onSchedule)({
    schedule: "every day 08:00",
    timeZone: "America/Los_Angeles",
    retryCount: 1,
    maxInstances: 1,
}, async () => {
    var _a;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    console.log(`[recurring-remind] Checking for orders due on ${tomorrowStr}`);
    const snap = await db
        .collection("cateringRecurring")
        .where("active", "==", true)
        .where("nextRunDate", "==", tomorrowStr)
        .get();
    if (snap.empty) {
        console.log("[recurring-remind] No orders due tomorrow.");
        return;
    }
    console.log(`[recurring-remind] Found ${snap.size} order(s) due tomorrow.`);
    let sent = 0;
    for (const recDoc of snap.docs) {
        const rec = recDoc.data();
        const userId = rec.userId;
        if (!userId)
            continue;
        // Check if already skipped
        if ((_a = rec.nextOccurrenceOverride) === null || _a === void 0 ? void 0 : _a.skip) {
            console.log(`[recurring-remind] Order ${recDoc.id} is marked skip, ignoring.`);
            continue;
        }
        try {
            // Queue notification via the notifications collection
            await db.collection("notifications").add({
                channel: "push",
                recipientId: userId,
                template: "recurring_order_reminder",
                data: {
                    orderId: recDoc.id,
                    label: rec.label || "Recurring Order",
                    businessName: rec.businessName || "",
                    nextRunDate: tomorrowStr,
                    hasOverride: !!rec.nextOccurrenceOverride,
                },
                status: "queued",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Also queue email
            await db.collection("notifications").add({
                channel: "email",
                recipientId: userId,
                template: "recurring_order_reminder",
                data: {
                    orderId: recDoc.id,
                    label: rec.label || "Recurring Order",
                    businessName: rec.businessName || "",
                    nextRunDate: tomorrowStr,
                },
                status: "queued",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            sent++;
        }
        catch (err) {
            console.error(`[recurring-remind] Error notifying user ${userId}:`, err);
        }
    }
    console.log(`[recurring-remind] Done. Reminded: ${sent} user(s).`);
});
// PHASE 8: ENHANCED NOTIFICATION ROUTER
// Processes queued notification documents through the multi-channel router
// with user preferences, rate limiting, deduplication, quiet hours,
// HTML email templates (SendGrid), SMS templates (Twilio), and fallback channels.
// ═════════════════════════════════════════════════════════════════════════════════
const notificationRouter_1 = require("./notificationRouter");
/**
 * Process queued notifications through the enhanced notification router.
 * Triggered when a new doc is added to the `notifications` collection.
 *
 * The router handles:
 * - User preference checking (global + category-level)
 * - Quiet hours suppression (push + SMS)
 * - Rate limiting per channel
 * - Deduplication within 5-minute window
 * - HTML email templates via SendGrid
 * - SMS templates with 160-char validation via Twilio
 * - FCM push notifications with stale token cleanup
 * - Fallback channels (email fail → push, SMS fail → push)
 * - Analytics recording
 */
exports.processNotification = (0, firestore_1.onDocumentCreated)("notifications/{notificationId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    const { channel, recipientId, template, data: templateData } = data;
    const notifId = event.params.notificationId;
    console.log(`[notify] Processing ${channel} notification ${notifId}: ${template}`);
    // Route through the enhanced notification router
    const result = await (0, notificationRouter_1.routeNotification)(notifId, channel, recipientId, template, templateData || {}, snap.ref);
    console.log(`[notify] Result for ${notifId}: ${result.channel} → ${result.status}${result.error ? ` (${result.error})` : ""}`);
    // Record analytics
    await (0, notificationRouter_1.recordNotificationAnalytics)(template, result.channel, result.status);
});
//# sourceMappingURL=index.js.map