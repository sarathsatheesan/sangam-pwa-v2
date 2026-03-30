import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { SpeechClient } from "@google-cloud/speech";

admin.initializeApp();
const db = admin.firestore();
const speechClient = new SpeechClient();

/**
 * Cloud Function: sendNewMessageNotification
 *
 * Triggers when a new message is created in any conversation.
 * Looks up FCM tokens for all participants (except the sender),
 * and sends a push notification via Firebase Cloud Messaging.
 *
 * Firestore path: /conversations/{conversationId}/messages/{messageId}
 */
export const sendNewMessageNotification = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const messageData = snap.data();
    const senderId = messageData.senderId as string;
    const conversationId = event.params.conversationId;

    // Skip system messages or messages without a sender
    if (!senderId || senderId === "system") return;

    // Get the conversation to find participants
    const convDoc = await db
      .collection("conversations")
      .doc(conversationId)
      .get();

    if (!convDoc.exists) return;
    const convData = convDoc.data();
    if (!convData) return;

    const participants: string[] = convData.participants || [];

    // Get recipient IDs (everyone except the sender)
    const recipientIds = participants.filter((id) => id !== senderId);
    if (recipientIds.length === 0) return;

    // Get sender's name for the notification
    const senderDoc = await db.collection("users").doc(senderId).get();
    const senderName = senderDoc.exists
      ? (senderDoc.data()?.name as string) || "Someone"
      : "Someone";

    // Build notification body based on message type
    let notificationBody = "Sent you a message";
    const text = messageData.text as string | undefined;
    const image = messageData.image as string | undefined;
    const voiceMessage = messageData.voiceMessage as
      | Record<string, unknown>
      | undefined;
    const file = messageData.file as Record<string, unknown> | undefined;

    if (voiceMessage) {
      notificationBody = "Sent a voice message";
    } else if (file) {
      notificationBody = `Sent a file: ${(file.name as string) || "document"}`;
    } else if (image && !text) {
      notificationBody = "Sent a photo";
    } else if (text) {
      // Truncate long messages, handle encrypted messages
      const isEncrypted = messageData.encrypted as boolean | undefined;
      if (isEncrypted) {
        notificationBody = "Sent an encrypted message";
      } else {
        notificationBody = text.length > 100 ? text.slice(0, 100) + "..." : text;
      }
    }

    // Collect FCM tokens from all recipients
    const tokens: string[] = [];
    const tokenToUserMap: Map<string, string> = new Map();

    for (const recipientId of recipientIds) {
      const userDoc = await db.collection("users").doc(recipientId).get();
      if (!userDoc.exists) continue;

      const userData = userDoc.data();
      const fcmTokens = userData?.fcmTokens as string[] | undefined;

      if (fcmTokens && fcmTokens.length > 0) {
        fcmTokens.forEach((token) => {
          tokens.push(token);
          tokenToUserMap.set(token, recipientId);
        });
      }
    }

    if (tokens.length === 0) return;

    // Build the notification payload
    const isGroup = convData.isGroup as boolean | undefined;
    const groupName = convData.groupName as string | undefined;

    const notification: admin.messaging.NotificationMessagePayload = {
      title: isGroup ? `${senderName} in ${groupName || "Group"}` : senderName,
      body: notificationBody,
    };

    const data: Record<string, string> = {
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
      const tokensToRemove: { userId: string; token: string }[] = [];
      response.responses.forEach((resp, idx) => {
        if (
          !resp.success &&
          resp.error?.code === "messaging/registration-token-not-registered"
        ) {
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
  }
);

/**
 * Cloud Function: transcribeVoiceMessage
 *
 * Callable function that takes a conversationId + messageId,
 * reads the voice message audio from Firestore, sends it to
 * Google Cloud Speech-to-Text, and stores the transcription
 * back on the message document.
 */
export const transcribeVoiceMessage = onCall(
  { maxInstances: 10, timeoutSeconds: 120, invoker: "public" },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in to transcribe.");
    }

    const { conversationId, messageId, audioData } = request.data as {
      conversationId?: string;
      messageId?: string;
      audioData?: string; // decrypted base64 audio from client (data URL or raw base64)
    };

    if (!conversationId || !messageId) {
      throw new HttpsError("invalid-argument", "conversationId and messageId are required.");
    }

    if (!audioData) {
      throw new HttpsError("invalid-argument", "audioData is required (decrypted audio from client).");
    }

    // Extract base64 audio content and detect mime type
    let audioBytes: string;
    let mimeType = "audio/webm";

    if (audioData.startsWith("data:")) {
      const commaIdx = audioData.indexOf(",");
      const header = audioData.substring(0, commaIdx);
      audioBytes = audioData.substring(commaIdx + 1);
      const mimeMatch = header.match(/data:([^;]+)/);
      if (mimeMatch) mimeType = mimeMatch[1];
    } else {
      audioBytes = audioData;
    }

    // Map MIME type to Speech-to-Text encoding enum values
    // See: https://cloud.google.com/speech-to-text/docs/encoding
    let encoding = 9; // WEBM_OPUS = 9
    if (mimeType.includes("mp4")) {
      encoding = 0; // ENCODING_UNSPECIFIED — let API auto-detect for mp4
    } else if (mimeType.includes("ogg")) {
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

      const transcription =
        response.results
          ?.map((r) => r.alternatives?.[0]?.transcript || "")
          .join(" ")
          .trim() || "";

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
    } catch (err: unknown) {
      console.error("[transcribeVoiceMessage] Speech-to-Text error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      throw new HttpsError("internal", `Transcription failed: ${errorMessage}`);
    }
  }
);


// ═════════════════════════════════════════════════════════════════════════════════
// PHASE 6: RECURRING CATERING ORDERS — SCHEDULED FUNCTION
// Runs every day at 6:00 AM UTC. Finds recurring orders whose nextRunDate is
// today, places the order, bumps stats, and computes the next run date.
// ═════════════════════════════════════════════════════════════════════════════════

/**
 * Compute the next run date from a schedule config (server-side mirror of client logic).
 */
function computeNextRunDateServer(
  schedule: {
    interval?: string;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    timeOfDay: string;
    startDate: string;
    endDate?: string;
    skipDates?: string[];
  },
  afterDate?: string
): string {
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
        if (!schedule.endDate || iso <= schedule.endDate) return iso;
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
        if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate)) return iso;
      }
      candidate.setDate(candidate.getDate() + 1);
    }
    return "";
  }

  // Simple interval mode
  const intervalDays: Record<string, number> = {
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
    if (!skipSet.has(iso) && (!schedule.endDate || iso <= schedule.endDate)) return iso;
    candidate.setDate(candidate.getDate() + 1);
  }
  return "";
}

export const processRecurringCateringOrders = onSchedule(
  {
    schedule: "every day 06:00",
    timeZone: "America/Los_Angeles",
    retryCount: 2,
    maxInstances: 1,
  },
  async () => {
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
        const total = (rec.items || []).reduce(
          (sum: number, item: { unitPrice: number; qty: number }) =>
            sum + item.unitPrice * item.qty,
          0
        );

        // Get customer info for the order
        const userSnap = await db.collection("users").doc(rec.userId).get();
        const userData = userSnap.exists ? userSnap.data() : {};

        // Create the catering order
        await db.collection("cateringOrders").add({
          customerId: rec.userId,
          customerName: userData?.name || rec.contactName || "",
          customerEmail: userData?.email || "",
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
        const updates: Record<string, unknown> = {
          lastRunDate: today,
          totalOrdersPlaced: (rec.totalOrdersPlaced || 0) + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (nextRun) {
          updates.nextRunDate = nextRun;
        } else {
          // No more valid dates — deactivate
          updates.active = false;
          updates.nextRunDate = "";
        }

        await recDoc.ref.update(updates);
        processed++;

        console.log(
          `[recurring-catering] Placed order for ${rec.label} (${rec.businessName}). Next: ${nextRun || "deactivated"}`
        );
      } catch (err) {
        failed++;
        console.error(
          `[recurring-catering] Error processing ${recDoc.id}:`,
          err
        );
      }
    }

    console.log(`[recurring-catering] Done. Processed: ${processed}, Failed: ${failed}`);
  }
);


// ═════════════════════════════════════════════════════════════════════════════════
// PHASE 7: ORDER STATUS CHANGE NOTIFICATIONS
// Sends FCM push notifications to customers when their order status changes,
// and to vendors when a new order is placed.
// ═════════════════════════════════════════════════════════════════════════════════

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Confirmed",
  preparing: "Being Prepared",
  ready: "Ready for Pickup/Delivery",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const onCateringOrderStatusChange = onDocumentUpdated(
  "cateringOrders/{orderId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const oldStatus = before.status as string;
    const newStatus = after.status as string;

    // Only fire if status actually changed
    if (oldStatus === newStatus) return;

    const orderId = event.params.orderId;
    const businessName = after.businessName || "Your caterer";
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;

    console.log(`[order-status-notify] Order ${orderId}: ${oldStatus} → ${newStatus}`);

    // ── Notify the customer ──
    const customerId = after.customerId as string;
    if (customerId) {
      try {
        const userDoc = await db.collection("users").doc(customerId).get();
        const fcmTokens: string[] = userDoc.data()?.fcmTokens || [];
        const fcmToken: string | undefined = userDoc.data()?.fcmToken;
        const allTokens = [...fcmTokens, ...(fcmToken ? [fcmToken] : [])].filter(Boolean);

        if (allTokens.length > 0) {
          const notification = {
            title: `Order ${statusLabel}`,
            body: newStatus === "cancelled"
              ? `Your order from ${businessName} has been cancelled.${after.cancellationReason ? ` Reason: ${after.cancellationReason}` : ""}`
              : `Your order from ${businessName} is now ${statusLabel.toLowerCase()}.`,
          };

          const message: admin.messaging.MulticastMessage = {
            tokens: allTokens,
            notification,
            data: {
              type: "catering_order_status",
              orderId,
              status: newStatus,
            },
          };

          const result = await admin.messaging().sendEachForMulticast(message);
          console.log(
            `[order-status-notify] Customer notification: ${result.successCount} sent, ${result.failureCount} failed`
          );
        }
      } catch (err) {
        console.error(`[order-status-notify] Error notifying customer ${customerId}:`, err);
      }
    }

    // ── Notify vendor when a new order is placed (pending) ──
    if (newStatus === "pending" && oldStatus !== "pending") return; // Only notify on creation
    if (oldStatus === "" || !before.status) {
      // This is a newly created order — notify the vendor
      const businessId = after.businessId as string;
      if (businessId) {
        try {
          const bizDoc = await db.collection("businesses").doc(businessId).get();
          const ownerId = bizDoc.data()?.ownerId as string;
          if (ownerId) {
            const ownerDoc = await db.collection("users").doc(ownerId).get();
            const ownerTokens: string[] = ownerDoc.data()?.fcmTokens || [];
            const ownerToken: string | undefined = ownerDoc.data()?.fcmToken;
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
        } catch (err) {
          console.error(`[order-status-notify] Error notifying vendor:`, err);
        }
      }
    }
  }
);


// ═════════════════════════════════════════════════════════════════════════════════
// PHASE 7: AUTO-EXPIRE STALE QUOTE REQUESTS
// Runs daily. Finds open quote requests past their expiresAt date and marks
// them as expired. Notifies the customer via FCM.
// ═════════════════════════════════════════════════════════════════════════════════

export const expireStaleQuoteRequests = onSchedule(
  {
    schedule: "every day 07:00",
    timeZone: "America/Los_Angeles",
    retryCount: 1,
    maxInstances: 1,
  },
  async () => {
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
        const customerId = reqDoc.data().customerId as string;
        if (customerId) {
          const userDoc = await db.collection("users").doc(customerId).get();
          const tokens: string[] = [
            ...(userDoc.data()?.fcmTokens || []),
            ...(userDoc.data()?.fcmToken ? [userDoc.data()?.fcmToken] : []),
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
      } catch (err) {
        console.error(`[expire-rfq] Error expiring ${reqDoc.id}:`, err);
      }
    }

    console.log(`[expire-rfq] Done. Expired: ${expired}`);
  }
);
