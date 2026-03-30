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
exports.processRecurringCateringOrders = exports.transcribeVoiceMessage = exports.sendNewMessageNotification = void 0;
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
 */
function computeNextRunDateServer(schedule, afterDate) {
    const after = afterDate ? new Date(afterDate) : new Date();
    after.setHours(0, 0, 0, 0);
    const skipSet = new Set(schedule.skipDates || []);
    // Calendar-based: specific days of week
    if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
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
        return "";
    }
    // Calendar-based: specific day of month
    if (schedule.dayOfMonth) {
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
        return "";
    }
    // Simple interval mode
    const intervalDays = {
        daily: 1,
        weekly: 7,
        biweekly: 14,
        monthly: 30,
    };
    const days = intervalDays[schedule.interval || "weekly"] || 7;
    const candidate = new Date(after);
    candidate.setDate(candidate.getDate() + days);
    for (let i = 0; i < 365; i++) {
        const iso = candidate.toISOString().slice(0, 10);
        if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate))
            return iso;
        candidate.setDate(candidate.getDate() + 1);
    }
    return "";
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
            const nextRun = computeNextRunDateServer(rec.schedule, today);
            // Update the recurring order document
            const updates = {
                lastRunDate: today,
                totalOrdersPlaced: (rec.totalOrdersPlaced || 0) + 1,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (nextRun) {
                updates.nextRunDate = nextRun;
            }
            else {
                // No more valid dates — deactivate
                updates.active = false;
                updates.nextRunDate = "";
            }
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
//# sourceMappingURL=index.js.map