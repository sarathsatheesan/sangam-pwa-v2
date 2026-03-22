import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
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
