import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();
const db = admin.firestore();

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
