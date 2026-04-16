import { Timestamp } from 'firebase/firestore';

// ===== TYPES =====

/**
 * Presence status for users
 */
export type PresenceStatus = 'online' | 'away' | 'offline';

/**
 * User type for messaging participants
 * Includes profile information and messaging preferences
 */
export type User = {
  id: string;
  name: string;
  avatar?: string;
  messagingPrivacy?: 'Everyone' | 'Contacts' | 'Nobody';
  lastSeen?: Timestamp;
  isOnline?: boolean;
  presenceStatus?: PresenceStatus;
};

/**
 * Message type with rich metadata support
 * Supports text, voice, reactions, edits, and replies
 */
export type Message = {
  id: string;
  text: string;
  senderId: string;
  time: string;
  createdAt: Timestamp;
  deleted?: boolean;
  editedAt?: Timestamp;
  encrypted?: boolean;
  replyTo?: { id: string; text: string; senderId: string };
  reactions?: Record<string, string[]>;
  voiceMessage?: { duration: number; audioUrl?: string; transcription?: string };
  image?: string;
  read?: boolean;
  readAt?: Timestamp;
  callEvent?: {
    type: 'missed' | 'completed' | 'rejected' | 'cancelled';
    callType: 'audio' | 'video';
    duration?: number; // seconds, only for completed calls
  };
  pinned?: boolean;
  starred?: boolean;
  forwarded?: boolean;
  file?: {
    name: string;
    size: number;
    type: string;
    data: string; // base64 encoded
  };
  disappearing?: boolean;
  disappearingDuration?: number; // milliseconds
  expiresAt?: Timestamp;
};

/**
 * Conversation metadata including typing indicators and timestamps
 * Tracks all participants and conversation state
 */
export type Conversation = {
  id: string;
  participants: string[];
  updatedAt: Timestamp;
  createdAt?: Timestamp;
  lastMessage?: string;
  lastMessageTime?: Timestamp;
  lastMessageSenderId?: string;
  unreadCount?: number;
  typing?: Record<string, boolean>;
  archived?: boolean;
  pinned?: boolean;
  notificationsMuted?: boolean;
  isGroup?: boolean;
  groupName?: string;
  groupCreatedBy?: string;
  groupAdmins?: string[];
  lastMessageRead?: boolean;
  disappearingTimer?: number | null; // milliseconds — null or 0 means off
};

/**
 * Navigation state for the messages page
 * list = conversation list view, room = chat room view
 */
export type ViewState = 'list' | 'room';

/**
 * Notification types for user feedback
 */
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

/**
 * Link preview data for URL unfurling
 */
export type LinkPreviewData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};
