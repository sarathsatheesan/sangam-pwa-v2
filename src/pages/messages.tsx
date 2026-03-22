'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClickOutsideOverlay } from '@/components/ClickOutsideOverlay';
import {
  collection, query, orderBy, where, getDocs, addDoc, doc, setDoc, updateDoc,
  onSnapshot, serverTimestamp, Timestamp, getDoc, deleteDoc, arrayUnion, writeBatch,
} from 'firebase/firestore';
import { db, functions, httpsCallable, initMessaging, getToken, onMessage } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureSettings } from '@/contexts/FeatureSettingsContext';
import {
  generateConversationKey, encryptMessage, decryptMessage,
  getOrCreateKeyPair, deriveSharedKey, e2eEncrypt, e2eDecrypt,
  generateGroupKey, exportGroupKey, wrapGroupKeyForMember,
  unwrapGroupKeyWithECDH, wrapGroupKeyForMemberWithECDH,
  getDeterministicSharedKey,
  type ExportedPublicKey,
} from '@/utils/encryption';
import {
  Search, X, Send, Smile, MoreVertical,
  Trash2,
  MessageSquare, Edit3, Loader2, ArrowLeft,
  Mic, ImagePlus,
  ChevronDown, Type, Bold, Italic, Code,
  Strikethrough, MicOff, Pause, Play, Search as SearchIcon,
  ChevronUp, Palette, Minimize2, Maximize2, AlertCircle, CheckCircle,
  Check, CheckCheck, Paperclip, Users, Shield, UserPlus, UserMinus, Crown, Settings,
  Flag, Ban, VolumeX,
  Phone, PhoneOff, Video, VideoOff,
  Download, Share2, Reply, BellOff, Bell, Archive, ArchiveRestore,
  Pin, PinOff, Star, StarOff, Forward, FileText, Timer, TimerOff,
} from 'lucide-react';
import {
  getCallManager,
  type CallState, type CallType,
} from '@/utils/webrtc';
import {
  getGroupCallManager,
  GroupCallManager,
  type GroupCallState, type GroupCallType,
} from '@/utils/groupWebrtc';

// ===== TYPES =====
/**
 * User type for messaging participants
 * Includes profile information and messaging preferences
 */
type PresenceStatus = 'online' | 'away' | 'offline';

type User = {
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
type Message = {
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
type Conversation = {
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
type ViewState = 'list' | 'room';

/**
 * Notification types for user feedback
 */
type NotificationType = 'success' | 'error' | 'info' | 'warning';

// ===== LINK PREVIEW =====

type LinkPreviewData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

const linkPreviewCache = new Map<string, LinkPreviewData | null>();

const fetchLinkPreview = async (url: string): Promise<LinkPreviewData | null> => {
  if (linkPreviewCache.has(url)) return linkPreviewCache.get(url) || null;
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
    if (!res.ok) { linkPreviewCache.set(url, null); return null; }
    const json = await res.json();
    if (json.status !== 'success' || !json.data) { linkPreviewCache.set(url, null); return null; }
    const data = json.data;
    const preview: LinkPreviewData = {
      url,
      title: data.title || undefined,
      description: data.description || undefined,
      image: data.image?.url || undefined,
      siteName: data.publisher || new URL(url).hostname,
    };
    linkPreviewCache.set(url, preview);
    return preview;
  } catch {
    linkPreviewCache.set(url, null);
    return null;
  }
};

/**
 * LinkPreviewCard component — renders an OG preview card below message text.
 * Cross-browser: uses onClick + onTouchStart for iOS Safari, proper cursor styling.
 */
const LinkPreviewCard = ({ url }: { url: string }) => {
  const [preview, setPreview] = React.useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLinkPreview(url).then((data) => {
      if (!cancelled) { setPreview(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return (
    <div className="mt-1.5 px-2 py-1.5 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(99,102,241,0.06)', minHeight: '40px' }}>
      <div className="h-3 w-24 rounded" style={{ backgroundColor: 'rgba(99,102,241,0.12)' }} />
    </div>
  );
  if (!preview || (!preview.title && !preview.description)) return null;

  const openLink = () => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <div
      className="mt-1.5 rounded-lg overflow-hidden"
      style={{ backgroundColor: 'rgba(99,102,241,0.06)', borderLeft: '3px solid #6366F1', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      onClick={openLink}
      onTouchStart={openLink}
      role="link"
      tabIndex={0}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          className="w-full object-cover"
          style={{ maxHeight: '140px' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="px-2.5 py-1.5">
        {preview.siteName && (
          <div className="text-[10.5px] uppercase font-semibold tracking-wide mb-0.5" style={{ color: '#6366F1' }}>
            {preview.siteName}
          </div>
        )}
        {preview.title && (
          <div className="text-[13px] font-medium leading-tight line-clamp-2" style={{ color: 'var(--msg-text)' }}>
            {preview.title}
          </div>
        )}
        {preview.description && (
          <div className="text-[11.5px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'var(--msg-secondary)' }}>
            {preview.description}
          </div>
        )}
      </div>
    </div>
  );
};

// ===== CONSTANTS =====

/**
 * Wallpaper presets for chat background customization
 * Each preset includes a label and CSS styling
 */
const WALLPAPER_PRESETS = {
  default: {
    label: 'Aurora',
    description: 'Subtle aurora indigo pattern',
    style: {
      backgroundColor: 'var(--msg-own-bubble-hover)',
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cstyle%3E.d%7Bfill:%236366F1;opacity:0.06%7D%3C/style%3E%3C/defs%3E%3Ccircle class='d' cx='20' cy='30' r='3'/%3E%3Crect class='d' x='60' y='15' width='8' height='10' rx='2'/%3E%3Ccircle class='d' cx='110' cy='25' r='4'/%3E%3Crect class='d' x='155' y='20' width='6' height='8' rx='1'/%3E%3Ccircle class='d' cx='40' cy='80' r='3.5'/%3E%3Crect class='d' x='90' y='70' width='10' height='6' rx='2'/%3E%3Ccircle class='d' cx='140' cy='85' r='3'/%3E%3Crect class='d' x='175' y='75' width='7' height='9' rx='1.5'/%3E%3Ccircle class='d' cx='25' cy='140' r='4'/%3E%3Crect class='d' x='70' y='130' width='9' height='7' rx='2'/%3E%3Ccircle class='d' cx='120' cy='145' r='3'/%3E%3Crect class='d' x='165' y='135' width='8' height='6' rx='1'/%3E%3Ccircle class='d' cx='50' cy='185' r='3'/%3E%3Crect class='d' x='100' y='180' width='7' height='9' rx='2'/%3E%3Ccircle class='d' cx='150' cy='175' r='4'/%3E%3C/svg%3E")`,
    } as React.CSSProperties,
  },
  gradient_blue: {
    label: 'Ocean',
    description: 'Cool blue gradient',
    style: {
      backgroundImage: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(99,102,241,0.08) 50%, rgba(139,92,246,0.05) 100%)',
    } as React.CSSProperties,
  },
  gradient_sunset: {
    label: 'Sunset',
    description: 'Warm sunset gradient',
    style: {
      backgroundImage: 'linear-gradient(135deg, rgba(251,146,60,0.05) 0%, rgba(244,63,94,0.08) 50%, rgba(168,85,247,0.05) 100%)',
    } as React.CSSProperties,
  },
  dark_minimal: {
    label: 'Minimal',
    description: 'Dark minimal style',
    style: { backgroundColor: 'var(--aurora-bg)' } as React.CSSProperties,
  },
  teal: {
    label: 'Indigo Dark',
    description: 'Deep indigo night',
    style: {
      backgroundColor: 'var(--aurora-bg)',
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cstyle%3E.d%7Bfill:%23ffffff;opacity:0.03%7D%3C/style%3E%3C/defs%3E%3Ccircle class='d' cx='20' cy='30' r='3'/%3E%3Crect class='d' x='60' y='15' width='8' height='10' rx='2'/%3E%3Ccircle class='d' cx='110' cy='25' r='4'/%3E%3Ccircle class='d' cx='40' cy='80' r='3.5'/%3E%3Crect class='d' x='90' y='70' width='10' height='6' rx='2'/%3E%3Ccircle class='d' cx='140' cy='85' r='3'/%3E%3Ccircle class='d' cx='25' cy='140' r='4'/%3E%3Crect class='d' x='70' y='130' width='9' height='7' rx='2'/%3E%3C/svg%3E")`,
    } as React.CSSProperties,
  },
  geometric: {
    label: 'Geo',
    description: 'Geometric pattern',
    style: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0 L60 30 L30 60 L0 30Z' fill='none' stroke='%2363668808' stroke-width='0.5'/%3E%3C/svg%3E")`,
    } as React.CSSProperties,
  },
};

/**
 * Emoji picker categories with curated emoji selections
 */
const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Recent': [],
  'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥳','🥸','😎','🤓','🧐'],
  'Gestures': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏'],
  'People': ['👶','👧','🧒','👦','👩','🧑','👨','👩‍🦱','🧑‍🦱','👨‍🦱','👩‍🦰','🧑‍🦰','👨‍🦰','👱‍♀️','👱','👱‍♂️','👩‍🦳','🧑‍🦳','👨‍🦳','👩‍🦲','🧑‍🦲','👨‍🦲','🧔‍♀️','🧔','🧔‍♂️','👵','🧓','👴','👲','👳‍♀️','👳','👳‍♂️','🧕','👮‍♀️','👮','👮‍♂️','👷‍♀️','👷','👷‍♂️'],
  'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟'],
  'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🦂','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈'],
  'Food': ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🍕','🍔','🌮','🍩','🍰','🍪','☕','🍵','🥤'],
  'Activities': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🎱','🏓','🏸','🏒','🎳','🎯','🎮','🎲','⛳','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🧘'],
  'Travel': ['🚗','🚕','🚙','🚌','🚎','🚓','🚑','🚒','🚐','🚚','🚛','🏎️','✈️','🚀','🚁','🛳️','🚢','⛵','🚤','🚂','🚆','🚇','🚞','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🗼','⛪','🕌'],
  'Objects': ['🎉','🎊','🎈','🎁','🏆','⭐','🌟','💫','✨','🔥','💯','🎯','💡','📱','💻','📸','🎵','🎶','☕','🧩','🎮','📚','🖼️','🎨','🎭'],
  'Symbols': ['❤️','💔','💕','💞','💓','💗','💖','💘','💝','💟','✔️','❌','⭕','✨','⚡','💥','🔔','📢','📣','🎺','🎸','🎹','🎤','🎧','📻'],
  'Flags': ['🏳️','🏴','🏁','🚩','🏳️‍🌈','🇺🇸','🇬🇧','🇮🇳','🇨🇦','🇦🇺','🇫🇷','🇩🇪','🇯🇵','🇰🇷','🇨🇳','🇧🇷','🇲🇽','🇮🇹','🇪🇸','🇷🇺','🇿🇦','🇳🇬','🇰🇪'],
};

/**
 * Quick reply suggestions for fast message composition
 */
const QUICK_REPLIES = ['Got it!', 'Thanks!', 'Sure!', 'OK', 'Nice!', 'See you!'];

/**
 * Configuration constants for message behavior
 */
const MESSAGE_CONFIG = {
  TYPING_DEBOUNCE_MS: 3000,
  MESSAGE_EDIT_WINDOW_MS: 15 * 60 * 1000,
  UNDO_TOAST_DURATION_MS: 5000,
  MAX_MESSAGE_LENGTH: 5000,
  PAGINATION_SIZE: 50,
} as const;

// ===== HELPER FUNCTIONS =====

/**
 * Generate a consistent conversation ID from two user IDs
 * Ensures the same ID regardless of order: (uid1, uid2) = (uid2, uid1)
 */
const generateConvId = (uid1: string, uid2: string): string => {
  return [uid1, uid2].sort().join('__');
};

/**
 * Format a Firestore Timestamp to a human-readable date
 * Example: "Mar 1, 2026" or "Mar 1" if current year
 */
const formatTimestamp = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '';
  const d = ts.toDate();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
};

/**
 * Format a Firestore Timestamp to a human-readable time
 * Example: "3:45 PM"
 */
const formatMessageTime = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '';
  const d = ts.toDate();
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

/**
 * Get a date label (Today/Yesterday/Date) for a timestamp
 * Used for message grouping in conversation view
 */
const getDateLabel = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '';
  const d = ts.toDate();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatTimestamp(ts);
};

/**
 * Check if a message is within the edit window (15 minutes)
 * Used to determine if edit button should be shown
 */
const isMessageEditable = (createdAt: Timestamp | null | undefined): boolean => {
  if (!createdAt) return false;
  return (
    Date.now() - createdAt.toDate().getTime() <
    MESSAGE_CONFIG.MESSAGE_EDIT_WINDOW_MS
  );
};

/**
 * Truncate text to a specified length with ellipsis
 * Example: truncateText("Hello World", 5) = "Hello..."
 */
const truncateText = (text: string, maxLength: number = 50): string => {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};

/**
 * Calculate time since message was sent
 * Example: "5m ago", "2h ago", etc.
 */
const getRelativeTime = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '';
  const now = Date.now();
  const then = ts.toDate().getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatTimestamp(ts);
};

/**
 * Presence system constants
 * HEARTBEAT_INTERVAL: How often to write "I'm still here" to Firestore (60s)
 * AWAY_TIMEOUT: How long after tab blur before marking as "away" (5 min)
 * OFFLINE_THRESHOLD: If lastSeen is older than this, consider user offline (2.5 min)
 */
const PRESENCE_HEARTBEAT_INTERVAL = 60_000;
const PRESENCE_AWAY_TIMEOUT = 5 * 60_000;
const PRESENCE_OFFLINE_THRESHOLD = 2.5 * 60_000;

/**
 * Disappearing message timer presets (in milliseconds).
 * Used for conversation-level default and per-message override.
 */
const DISAPPEARING_TIMER_OPTIONS: { label: string; value: number }[] = [
  { label: '30 seconds', value: 30_000 },
  { label: '5 minutes', value: 5 * 60_000 },
  { label: '1 hour', value: 60 * 60_000 },
  { label: '24 hours', value: 24 * 60 * 60_000 },
  { label: '7 days', value: 7 * 24 * 60 * 60_000 },
];

const formatDisappearingTimer = (ms: number): string => {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 24 * 60 * 60_000) return `${Math.round(ms / (60 * 60_000))}h`;
  return `${Math.round(ms / (24 * 60 * 60_000))}d`;
};

/**
 * Derive presence status from Firestore user data.
 * If the user has a presenceStatus field and a recent lastSeen, trust it.
 * Otherwise, compute from lastSeen timestamp.
 */
const derivePresenceStatus = (u: User): PresenceStatus => {
  if (!u.lastSeen) return 'offline';
  const elapsed = Date.now() - u.lastSeen.toDate().getTime();
  // If lastSeen is stale (> threshold), user is offline regardless of stored status
  if (elapsed > PRESENCE_OFFLINE_THRESHOLD) return 'offline';
  // Trust the stored presenceStatus if present and lastSeen is fresh
  if (u.presenceStatus === 'away') return 'away';
  return 'online';
};

/**
 * Get presence status text for chat header
 */
const getPresenceText = (u: User): string => {
  const status = derivePresenceStatus(u);
  if (status === 'online') return 'online';
  if (status === 'away') return 'away';
  if (u.lastSeen) return `last seen ${getRelativeTime(u.lastSeen)}`;
  return '';
};

/**
 * Get presence dot color
 * Green = online, Yellow/Amber = away, Gray = offline (no dot shown)
 */
const getPresenceDotColor = (u: User): string | null => {
  const status = derivePresenceStatus(u);
  if (status === 'online') return '#22c55e'; // green-500
  if (status === 'away') return '#f59e0b'; // amber-500
  return null; // offline — no dot
};

/**
 * Validate message text before sending
 * Checks for length and content requirements
 */
const validateMessage = (text: string): { valid: boolean; error?: string } => {
  if (!text || !text.trim()) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  if (text.length > MESSAGE_CONFIG.MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message exceeds maximum length of ${MESSAGE_CONFIG.MAX_MESSAGE_LENGTH} characters`,
    };
  }
  return { valid: true };
};

// ===== MARKDOWN RENDERING =====

/**
 * Render markdown-formatted text with support for bold, italic, strikethrough, and code
 * Syntax: **bold**, *italic*, ~~strike~~, \`code\`
 * 
 * Example usage:
 * renderFormattedText("Hello **world** and *welcome*")
 * Output: "Hello <strong>world</strong> and <em>welcome</em>"
 */
const renderFormattedText = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let key = 0;
  const combined = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const full = match[0];
    if (full.startsWith('**')) {
      parts.push(
        <strong key={key++} className="font-bold">
          {match[2]}
        </strong>
      );
    } else if (full.startsWith('~~')) {
      parts.push(
        <span key={key++} className="line-through">
          {match[4]}
        </span>
      );
    } else if (full.startsWith('`')) {
      parts.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[13px] font-mono">
          {match[5]}
        </code>
      );
    } else if (full.startsWith('*')) {
      parts.push(
        <em key={key++} className="italic">
          {match[3]}
        </em>
      );
    }
    lastIndex = combined.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  // Second pass: linkify URLs in plain text segments
  const linkedParts: React.ReactNode[] = [];
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  for (const part of parts) {
    if (typeof part !== 'string') { linkedParts.push(part); continue; }
    let urlMatch;
    let urlLastIndex = 0;
    urlPattern.lastIndex = 0;
    let hasUrlMatch = false;
    while ((urlMatch = urlPattern.exec(part)) !== null) {
      hasUrlMatch = true;
      if (urlMatch.index > urlLastIndex) linkedParts.push(part.slice(urlLastIndex, urlMatch.index));
      linkedParts.push(
        <a key={`link-${key++}`} href={urlMatch[0]} target="_blank" rel="noopener noreferrer" style={{ color: '#6366F1', textDecoration: 'underline', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          {urlMatch[0].length > 50 ? urlMatch[0].slice(0, 47) + '...' : urlMatch[0]}
        </a>
      );
      urlLastIndex = urlPattern.lastIndex;
    }
    if (hasUrlMatch && urlLastIndex < part.length) linkedParts.push(part.slice(urlLastIndex));
    if (!hasUrlMatch) linkedParts.push(part);
  }

  return linkedParts.length > 0 ? <>{linkedParts}</> : text;
};

// ===== COMPONENTS =====

/**
 * ChatAvatar Component
 * Displays user avatar with intelligent fallback:
 * 1. URL-based image (http/data URL)
 * 2. Emoji
 * 3. User initials on gradient background
 */
function ChatAvatar({ user, size = 'md', showOnlineStatus = false }: { user?: User; size?: string; showOnlineStatus?: boolean }) {
  const sizeClasses: Record<string, string> = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-11 h-11',
    lg: 'w-12 h-12',
  };
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  if (!user) {
    return <div className={`${sizeClass} rounded-full`} style={{ backgroundColor: 'var(--aurora-surface-variant)' }} />;
  }

  const isUrl = user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('data:'));
  const isEmoji = user.avatar && !isUrl;

  const avatarElement = isUrl ? (
    <img src={user.avatar} alt={user.name} className={`${sizeClass} rounded-full object-cover`} />
  ) : isEmoji ? (
    <div className={`${sizeClass} rounded-full flex items-center justify-center text-lg`} style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>{user.avatar}</div>
  ) : (
    <>
      {(() => {
        const initials = user.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        const colors = ['#6366F1', '#818CF8', '#4F46E5', '#34B7F1', '#6366F1'];
        const colorIndex = user.id.charCodeAt(0) % colors.length;
        return (
          <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white`} style={{ backgroundColor: colors[colorIndex] }}>
            {initials}
          </div>
        );
      })()}
    </>
  );

  if (!showOnlineStatus) return <>{avatarElement}</>;

  const dotColor = getPresenceDotColor(user);

  return (
    <div className="relative flex-shrink-0">
      {avatarElement}
      {dotColor && (
        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800" style={{ backgroundColor: dotColor }} />
      )}
    </div>
  );
}

/**
 * SkeletonConversation Component
 * Loading skeleton for conversation list items
 */
function SkeletonConversation() {
  return (
    <div className="px-4 py-3 animate-pulse flex items-center gap-3 border-b" style={{ borderColor: 'var(--msg-divider)' }}>
      <div className="w-12 h-12 rounded-full" style={{ backgroundColor: 'var(--aurora-surface-variant)' }} />
      <div className="flex-1">
        <div className="h-4 w-28 rounded mb-2" style={{ backgroundColor: 'var(--aurora-surface-variant)' }} />
        <div className="h-3 w-44 rounded" style={{ backgroundColor: 'var(--aurora-surface-variant)' }} />
      </div>
    </div>
  );
}

/**
 * TypingIndicator Component
 * Animated typing indicator with bouncing dots
 */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 text-sm" style={{ color: '#6366F1' }}>
      <span>typing</span>
      <span className="flex gap-0.5">
        <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
    </div>
  );
}

/**
 * ScrollToBottomButton Component
 * Floating button to jump to latest messages
 */
function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-full bg-aurora-indigo text-white shadow-lg hover:bg-opacity-90 transition"
      title="Scroll to bottom"
    >
      <ChevronDown size={18} />
    </button>
  );
}

/**
 * QuickReactionBar Component
 * Modal overlay with quick reaction emoji buttons
 */
function QuickReactionBar({ onReact, onClose }: { onReact: (emoji: string) => void; onClose: () => void }) {
  const reactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose} onTouchStart={onClose} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div
        className="flex gap-2 p-3 rounded-full bg-white dark:bg-[var(--aurora-surface)] shadow-lg"
        onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
        {reactions.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onReact(emoji);
              onClose();
            }}
            className="w-8 h-8 hover:scale-125 transition text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

const MESSAGE_REPORT_CATEGORIES = [
  { id: 'spam', label: 'Spam or Misleading', icon: '🚫', description: 'Unwanted promotional, repetitive, or misleading content' },
  { id: 'harassment', label: 'Harassment or Bullying', icon: '🛑', description: 'Threatening, abusive, or intimidating messages' },
  { id: 'hate_speech', label: 'Hate Speech', icon: '⚠️', description: 'Content targeting race, ethnicity, religion, gender, or identity' },
  { id: 'inappropriate', label: 'Inappropriate Content', icon: '🔞', description: 'Sexual, violent, or graphic content not suitable for the community' },
  { id: 'scam', label: 'Scam or Fraud', icon: '🎣', description: 'Phishing, financial fraud, or deceptive schemes' },
  { id: 'other', label: 'Other', icon: '📋', description: 'Something else that violates community guidelines' },
];

/**
 * MessageContextMenu Component
 * Context menu for message actions (edit, delete, report, block)
 */
function MessageContextMenu({
  isMine,
  onDelete,
  onEdit,
  onReport,
  onBlock,
  onReply,
  onForward,
  onPin,
  onStar,
  onClose,
  isRecent,
  isPinned,
  isStarred,
}: {
  isMine: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  onPin?: () => void;
  onStar?: () => void;
  onClose: () => void;
  isRecent: boolean;
  isPinned?: boolean;
  isStarred?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose} onTouchStart={onClose} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div className="bg-white dark:bg-[var(--aurora-surface)] rounded-lg shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        {onReply && (
          <button onClick={() => { onReply(); onClose(); }} className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm" style={{ color: 'var(--msg-text)' }}>
            <Reply size={15} className="text-aurora-indigo" /> Reply
          </button>
        )}
        {onForward && (
          <button onClick={() => { onForward(); onClose(); }} className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm" style={{ color: 'var(--msg-text)' }}>
            <Forward size={15} className="text-aurora-indigo" /> Forward
          </button>
        )}
        {onPin && (
          <button onClick={() => { onPin(); onClose(); }} className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm" style={{ color: 'var(--msg-text)' }}>
            {isPinned ? <PinOff size={15} className="text-aurora-indigo" /> : <Pin size={15} className="text-aurora-indigo" />}
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
        )}
        {onStar && (
          <button onClick={() => { onStar(); onClose(); }} className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm" style={{ color: 'var(--msg-text)' }}>
            {isStarred ? <StarOff size={15} className="text-amber-500" /> : <Star size={15} className="text-amber-500" />}
            {isStarred ? 'Unstar' : 'Star'}
          </button>
        )}
        {isMine && isRecent && onEdit && (
          <button
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm"
          >
            <Edit3 size={15} className="text-aurora-indigo" /> Edit
          </button>
        )}
        {isMine && onDelete && (
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm text-red-500"
          >
            <Trash2 size={15} /> Delete
          </button>
        )}
        {!isMine && onReport && (
          <button
            onClick={() => {
              onReport();
              onClose();
            }}
            className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm"
            style={{ color: 'var(--msg-secondary)' }}
          >
            <Flag size={15} /> Report Message
          </button>
        )}
        {!isMine && onBlock && (
          <button
            onClick={() => {
              onBlock();
              onClose();
            }}
            className="w-48 px-4 py-2.5 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm text-red-500"
          >
            <Ban size={15} /> Block User
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * FormattingToolbar Component
 * Inline formatting options for markdown syntax
 */
function FormattingToolbar({ onFormat }: { onFormat: (label: string, wrap: string) => void }) {
  const buttons = [
    { icon: Bold, label: 'Bold', wrap: '**' },
    { icon: Italic, label: 'Italic', wrap: '*' },
    { icon: Strikethrough, label: 'Strike', wrap: '~~' },
    { icon: Code, label: 'Code', wrap: '`' },
  ];

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-[var(--aurora-surface)] border-t border-[var(--aurora-border)]">
      {buttons.map(({ icon: Icon, label, wrap }) => (
        <button
          key={label}
          onClick={() => onFormat(label, wrap)}
          className="p-1.5 rounded hover:bg-[var(--aurora-input)] transition text-aurora-text"
          title={label}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}

/**
 * EmojiPicker Component
 * Modal emoji picker with search, category tabs, and grid view
 */
function EmojiPicker({ onSelect, onClose, recentEmojis }: { onSelect: (emoji: string) => void; onClose: () => void; recentEmojis: string[] }) {
  const [activeCategory, setActiveCategory] = useState<string>(recentEmojis.length > 0 ? 'Recent' : 'Smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const categories = Object.keys(EMOJI_CATEGORIES);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const allEmojis = useMemo(() => {
    return Object.values(EMOJI_CATEGORIES).flat();
  }, []);

  const displayEmojis = searchQuery
    ? allEmojis.filter(() => true)
    : activeCategory === 'Recent'
    ? recentEmojis
    : EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES] || [];

  const categoryIcons: Record<string, string> = {
    'Recent': '🕒', 'Smileys': '😀', 'Gestures': '👋', 'People': '👤', 'Hearts': '❤️',
    'Animals': '🐶', 'Food': '🍕', 'Activities': '⚽', 'Travel': '✈️', 'Objects': '💡', 'Symbols': '💠', 'Flags': '🏳️',
  };

  return (
    <>
    {/* Invisible backdrop — onClick for desktop, onTouchStart for iOS Safari/mobile */}
    <div className="fixed inset-0 z-30" onClick={onClose} onTouchStart={onClose} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} />
    <div className="absolute bottom-16 left-0 w-[calc(100vw-2rem)] sm:w-80 max-h-[360px] bg-white dark:bg-[var(--aurora-surface)] rounded-lg shadow-lg border border-[var(--aurora-border)] z-40 flex flex-col overflow-hidden">
      {/* Search */}
      <div className="px-2 pt-2">
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--aurora-border)] bg-[var(--aurora-input)] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-muted)] focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40"
        />
      </div>
      {/* Category tabs */}
      {!searchQuery && (
        <div className="flex items-center gap-1 px-2 pt-2 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-8 gap-0.5">
        {displayEmojis.length > 0 ? displayEmojis.map((emoji, idx) => (
          <button
            key={idx}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-9 h-9 flex items-center justify-center text-xl hover:scale-110 hover:bg-[var(--aurora-input)] rounded transition"
          >
            {emoji}
          </button>
        )) : (
          <div className="col-span-8 py-4 text-center text-sm text-[var(--aurora-text-muted)]">
            {activeCategory === 'Recent' ? 'No recent emojis yet' : 'No emojis found'}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

/**
 * Compress an image file to base64 data URL for inline Firestore storage
 */
const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = (h * maxWidth) / w;
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject('Canvas error'); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject('Failed to load image');
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject('Failed to read file');
    reader.readAsDataURL(file);
  });
};

/**
 * GifPicker Component
 * Giphy-powered GIF search and trending grid for chat.
 * Cross-browser: uses onClick + onTouchStart, proper cursor styling.
 */
const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'; // Public beta key

function GifPicker({ onSelect, onClose }: { onSelect: (gifUrl: string) => void; onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string; width: number; height: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const endpoint = query.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Giphy API error');
      const data = await res.json();
      setGifs(data.data.map((g: { id: string; images: { fixed_width: { url: string; width: string; height: string }; fixed_width_still: { url: string } } }) => ({
        id: g.id,
        url: g.images.fixed_width.url,
        preview: g.images.fixed_width_still.url,
        width: parseInt(g.images.fixed_width.width),
        height: parseInt(g.images.fixed_width.height),
      })));
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGifs(''); }, [fetchGifs]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => fetchGifs(searchQuery), 400);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, fetchGifs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div style={{ backgroundColor: 'var(--aurora-surface)', borderTop: '1px solid var(--aurora-border)' }}>
      <div className="px-3 pt-2 pb-1.5 flex items-center gap-2">
        <Search size={14} style={{ color: 'var(--msg-icon)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search GIFs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm placeholder-gray-400"
          style={{ color: 'var(--msg-text)' }}
          autoFocus
        />
        <button onClick={onClose} onTouchStart={onClose} className="p-1 rounded-full hover:bg-gray-200/60" style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} aria-label="Close GIF picker">
          <X size={16} style={{ color: 'var(--msg-icon)' }} />
        </button>
      </div>
      <div className="overflow-y-auto px-1.5 pb-1.5" style={{ maxHeight: '280px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
          </div>
        ) : gifs.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--msg-secondary)' }}>
            {searchQuery ? 'No GIFs found' : 'Unable to load GIFs'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => (
              <div
                key={gif.id}
                className="rounded-lg overflow-hidden"
                style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', aspectRatio: `${gif.width}/${gif.height}` }}
                onClick={() => { onSelect(gif.url); onClose(); }}
                onTouchStart={() => { onSelect(gif.url); onClose(); }}
                role="button"
                tabIndex={0}
              >
                <img
                  src={gif.url}
                  alt="GIF"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 py-1 text-center" style={{ borderTop: '1px solid var(--aurora-border)' }}>
        <span className="text-[10px]" style={{ color: 'var(--msg-secondary)' }}>Powered by GIPHY</span>
      </div>
    </div>
  );
}

/**
 * VoiceRecorder Component
 * Voice message recording UI with timer and waveform animation
 */
function VoiceRecorder({ onSend, onCancel }: { onSend: (duration: number, audioBlob: Blob) => void; onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  useEffect(() => {
    // Start recording on mount
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.start(200); // collect chunks every 200ms
      } catch {
        setRecError('Microphone access denied. Please allow microphone access in your browser settings and try again.');
      }
    })();
    return () => {
      // Cleanup on unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  };

  const handleSend = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') { onCancel(); return; }
    const dur = seconds;
    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      onSend(dur, blob);
    };
    recorder.stop();
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={handleCancel} onTouchStart={handleCancel} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div
        className="bg-white dark:bg-[var(--aurora-surface)] rounded-lg p-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
        {recError ? (
          <div className="text-red-500 text-sm text-center max-w-[250px]">{recError}</div>
        ) : (
          <>
            <div className="text-3xl font-bold text-aurora-indigo">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <div className="flex gap-2 items-center">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-8 bg-aurora-indigo rounded animate-pulse"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </>
        )}
        <div className="flex gap-3">
          <button onClick={handleCancel} className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600">
            <MicOff size={18} />
          </button>
          {!recError && (
            <button onClick={handleSend} className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600">
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * VoiceMessageBubble Component
 * Displays voice message with play/pause button and duration
 */
function VoiceMessageBubble({ duration, audioUrl, isMine, transcription, msgId, convId, voiceToTextEnabled = true }: { duration: number; audioUrl?: string; isMine: boolean; transcription?: string; msgId?: string; convId?: string; voiceToTextEnabled?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [localTranscription, setLocalTranscription] = useState<string | null>(transcription || null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const handleTranscribe = async () => {
    if (!audioUrl || !msgId || !convId || transcribing) return;
    if (audioUrl.startsWith('{')) {
      setTranscribeError('Audio is encrypted — cannot transcribe');
      return;
    }
    setTranscribing(true);
    setTranscribeError(null);
    try {
      const transcribeVoice = httpsCallable(functions, 'transcribeVoiceMessage');
      const result = await transcribeVoice({ conversationId: convId, messageId: msgId, audioData: audioUrl });
      const data = result.data as { transcription?: string; error?: string };
      if (data.transcription) {
        setLocalTranscription(data.transcription);
      } else {
        setTranscribeError(data.error || 'No speech detected');
      }
    } catch (err: unknown) {
      console.error('[Transcribe] Error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setTranscribeError(msg.includes('internal') ? 'Transcription failed. Check Speech API is enabled.' : msg);
    } finally {
      setTranscribing(false);
    }
  };

  useEffect(() => {
    if (!audioUrl) return;
    // Check if audioUrl is still encrypted JSON (decryption failed/pending)
    if (audioUrl.startsWith('{')) {
      console.warn('[VoiceMessage] audioUrl appears to be encrypted JSON, decryption may be pending');
      setAudioError(true);
      return;
    }
    setAudioError(false);

    // Convert data URL to blob URL for better cross-browser compatibility
    let objectUrl: string | null = null;
    try {
      if (audioUrl.startsWith('data:')) {
        const [header, b64Data] = audioUrl.split(',');
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : 'audio/webm';
        const binary = atob(b64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
      } else {
        objectUrl = audioUrl;
      }
    } catch (err) {
      console.error('[VoiceMessage] Failed to convert data URL to blob:', err);
      objectUrl = audioUrl; // fallback to raw URL
    }

    const audio = new Audio(objectUrl);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); setCurrentTime(0); };
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onerror = (e) => {
      console.error('[VoiceMessage] Audio playback error:', e);
      setAudioError(true);
    };
    return () => {
      audio.pause();
      audio.src = '';
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl || audioError) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch((err) => {
        console.error('[VoiceMessage] play() failed:', err);
        setAudioError(true);
      });
      setPlaying(true);
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const displayTime = playing ? Math.floor(currentTime) : 0;
  const mins = Math.floor((playing ? displayTime : duration) / 60);
  const secs = (playing ? displayTime : duration) % 60;

  return (
    <div className="py-1">
      <div className="flex items-center gap-3">
        <button onClick={togglePlay} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: audioError ? '#EF4444' : '#6366F1' }} title={audioError ? 'Unable to play audio' : undefined}>
          {audioError ? <VolumeX size={16} className="text-white" /> : playing ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white" style={{ marginLeft: '2px' }} />}
        </button>
        <div className="flex gap-[3px] items-end flex-1">
          {[...Array(20)].map((_, i) => {
            const barProgress = (i + 1) / 20;
            const isActive = playing && barProgress <= progress;
            return (
              <div
                key={i}
                className="w-[2.5px] rounded-full transition-colors"
                style={{
                  height: `${4 + Math.abs(Math.sin(i * 0.8)) * 14}px`,
                  backgroundColor: isActive ? '#6366F1' : '#A5B4FC',
                }}
              />
            );
          })}
        </div>
        <span className="text-[11px] font-mono" style={{ color: 'var(--msg-secondary)' }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>
      {/* Transcription display or button */}
      {localTranscription ? (
        <div className="mt-1.5 px-1">
          <div className="flex items-center gap-1 mb-0.5">
            <FileText size={10} style={{ color: 'var(--msg-secondary)' }} />
            <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'var(--msg-secondary)' }}>Transcript</span>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--msg-text)', opacity: 0.85 }}>{localTranscription}</p>
        </div>
      ) : voiceToTextEnabled ? (
        <button
          onClick={handleTranscribe}
          onTouchStart={handleTranscribe}
          disabled={transcribing || !audioUrl}
          className="mt-1 flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
          style={{ color: transcribeError ? '#EF4444' : '#6366F1', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        >
          {transcribing ? (
            <><Loader2 size={12} className="animate-spin" /> Transcribing...</>
          ) : transcribeError ? (
            <><AlertCircle size={12} /> {transcribeError}</>
          ) : (
            <><FileText size={12} /> Transcribe</>
          )}
        </button>
      ) : null}
    </div>
  );
}

/**
 * CallEventBubble Component
 * Displays missed/completed/rejected call events in chat
 */
function CallEventBubble({ callEvent, isMine }: { callEvent: NonNullable<Message['callEvent']>; isMine: boolean }) {
  const isMissed = callEvent.type === 'missed' || callEvent.type === 'rejected';
  const isVideo = callEvent.callType === 'video';

  const icon = isMissed
    ? <PhoneOff size={16} className="text-red-500" />
    : isVideo
      ? <Video size={16} className="text-green-600" />
      : <Phone size={16} className="text-green-600" />;

  let label = '';
  if (callEvent.type === 'missed') {
    label = isMine ? `Unanswered ${isVideo ? 'video' : 'voice'} call` : `Missed ${isVideo ? 'video' : 'voice'} call`;
  } else if (callEvent.type === 'rejected') {
    label = isMine ? `Declined ${isVideo ? 'video' : 'voice'} call` : `${isVideo ? 'Video' : 'Voice'} call declined`;
  } else if (callEvent.type === 'cancelled') {
    label = isMine ? `Cancelled ${isVideo ? 'video' : 'voice'} call` : `Missed ${isVideo ? 'video' : 'voice'} call`;
  } else {
    // completed
    const dur = callEvent.duration || 0;
    const m = Math.floor(dur / 60);
    const s = dur % 60;
    const durStr = dur > 0 ? ` (${m}:${String(s).padStart(2, '0')})` : '';
    label = `${isVideo ? 'Video' : 'Voice'} call${durStr}`;
  }

  return (
    <div className="flex items-center gap-2 py-1 px-1">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isMissed ? 'bg-red-50' : 'bg-green-50'}`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className={`text-[13px] font-medium ${isMissed ? 'text-red-600' : 'text-gray-700'}`}>
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * WallpaperPicker Component
 * Modal for selecting chat wallpaper from presets
 */
function WallpaperPicker({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (preset: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose} onTouchStart={onClose} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div
        className="bg-white dark:bg-[var(--aurora-surface)] rounded-lg p-4 sm:p-6 max-w-[90vw] sm:max-w-md"
        onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">Chat Wallpaper</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(WALLPAPER_PRESETS).map(([key, { label, description, style }]) => (
            <button
              key={key}
              onClick={() => {
                onSelect(key);
                onClose();
              }}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center ${
                current === key ? 'border-aurora-indigo' : 'border-[var(--aurora-border)]'
              }`}
              style={style}
              title={description}
            >
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* UndoToast Component — COMMENTED OUT (duplicate of delete functionality)
function UndoToast({ onUndo, onDismiss }: { onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, MESSAGE_CONFIG.UNDO_TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-xs bg-white dark:bg-[var(--aurora-surface)] rounded-lg shadow-lg p-4 flex items-center justify-between border border-[var(--aurora-border)]">
      <span className="text-sm">Message sent</span>
      <button onClick={onUndo} className="text-xs font-bold text-aurora-indigo hover:underline">
        Undo
      </button>
    </div>
  );
}
*/

/**
 * NotificationToast Component
 * General-purpose notification toast with configurable type and auto-dismiss
 */
function NotificationToast({
  message,
  type = 'info',
  onDismiss,
  duration = 3000,
}: {
  message: string;
  type?: NotificationType;
  onDismiss: () => void;
  duration?: number;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  const bgColor = {
    success: 'bg-green-50 dark:bg-green-900/20',
    error: 'bg-red-50 dark:bg-red-900/20',
    info: 'bg-blue-50 dark:bg-blue-900/20',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20',
  };

  const textColor = {
    success: 'text-green-700 dark:text-green-200',
    error: 'text-red-700 dark:text-red-200',
    info: 'text-blue-700 dark:text-blue-200',
    warning: 'text-yellow-700 dark:text-yellow-200',
  };

  const iconColor = {
    success: 'text-green-500',
    error: 'text-red-500',
    info: 'text-blue-500',
    warning: 'text-yellow-500',
  };

  const Icon = type === 'error' ? AlertCircle : CheckCircle;

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[90vw] max-w-md ${bgColor[type]} rounded-xl shadow-2xl p-4 flex items-start gap-3 border ${textColor[type]}`}
      style={{ borderColor: type === 'error' ? '#fca5a5' : type === 'success' ? '#86efac' : type === 'warning' ? '#fde047' : '#93c5fd' }}
    >
      <Icon size={20} className={`${iconColor[type]} shrink-0 mt-0.5`} />
      <span className="text-sm font-medium leading-snug flex-1">{message}</span>
      <button onClick={onDismiss} onTouchStart={onDismiss} className="shrink-0 ml-1" style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
        <X size={18} />
      </button>
    </div>
  );
}

/**
 * MessageSearchBar Component
 * Search input with navigation through results
 */
function MessageSearchBar({
  messages,
  onNavigate,
  onClose,
}: {
  messages: Message[];
  onNavigate: (index: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return messages.filter((m) => m.text.toLowerCase().includes(query.toLowerCase()));
  }, [messages, query]);

  useEffect(() => {
    if (matches.length > 0) {
      const idx = messages.findIndex((m) => m.id === matches[currentMatch]?.id);
      onNavigate(idx);
    }
  }, [currentMatch, matches, messages, onNavigate]);

  return (
    <div className="flex items-center gap-2 p-3 border-b border-[var(--aurora-border)] bg-[var(--aurora-surface)]">
      <SearchIcon size={18} className="text-aurora-text" />
      <input
        autoFocus
        type="text"
        placeholder="Search messages..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setCurrentMatch(0);
        }}
        className="flex-1 bg-transparent text-base outline-none"
      />
      {matches.length > 0 && (
        <span className="text-xs text-aurora-text/70">
          {currentMatch + 1} / {matches.length}
        </span>
      )}
      {matches.length > 1 && (
        <>
          <button
            onClick={() => setCurrentMatch((i) => (i > 0 ? i - 1 : matches.length - 1))}
            className="p-2 hover:bg-[var(--aurora-input)] rounded"
            aria-label="Previous search result"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => setCurrentMatch((i) => (i < matches.length - 1 ? i + 1 : 0))}
            className="p-2 hover:bg-[var(--aurora-input)] rounded"
            aria-label="Next search result"
          >
            <ChevronDown size={16} />
          </button>
        </>
      )}
      <button onClick={onClose} className="p-2 hover:bg-[var(--aurora-input)] rounded" aria-label="Close search">
        <X size={16} />
      </button>
    </div>
  );
}

// ===== MAIN COMPONENT =====

/**
 * MessagesPage Component
 * 
 * Main messaging page with conversation list and chat room views
 * 
 * Features:
 * - Real-time message syncing with Firebase Firestore
 * - Message encryption/decryption support
 * - Typing indicators and online status
 * - Message editing and deletion with undo window
 * - Emoji reactions with user tracking
 * - Voice message support
 * - Full-text message search with navigation
 * - Customizable wallpapers
 * - Markdown text formatting (bold, italic, strikethrough, code)
 * - Compact/comfortable display modes
 * - User presence and last seen tracking
 * - Message validation and error handling
 * 
 * State Management:
 * - Conversations, messages, users - data from Firestore
 * - UI state - view, selections, modals, notifications
 * - Message state - editing, undo, search
 * - User interaction - typing, reactions, formatting
 */
export default function MessagesPage() {
  const { user, userProfile } = useAuth();
  const { isFeatureEnabled } = useFeatureSettings();
  const groupMessagingEnabled = isFeatureEnabled('messages_groupMessaging');
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewState, setViewState] = useState<ViewState>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const encryptionEnabled = isFeatureEnabled('messages_encryption');
  const voiceMessagesEnabled = isFeatureEnabled('messages_voiceMessages');
  const voiceToTextEnabled = isFeatureEnabled('messages_voiceToText');
  const fileSharingEnabled = isFeatureEnabled('messages_fileSharing');
  const linkPreviewsEnabled = isFeatureEnabled('messages_linkPreviews');
  const gifStickersEnabled = isFeatureEnabled('messages_gifStickers');
  const disappearingMessagesEnabled = isFeatureEnabled('messages_disappearingMessages');
  const groupCallsEnabled = isFeatureEnabled('messages_groupCalls');
  const oneToOneCallsEnabled = isFeatureEnabled('messages_oneToOneCalls');
  const screenSharingEnabled = isFeatureEnabled('messages_screenSharing');
  const pushNotificationsEnabled = isFeatureEnabled('messages_pushNotifications');
  const onlineLastSeenEnabled = isFeatureEnabled('messages_onlineLastSeen');
  const pinnedMessagesEnabled = isFeatureEnabled('messages_pinnedMessages');
  const starredMessagesEnabled = isFeatureEnabled('messages_starredMessages');
  const forwardMessagesEnabled = isFeatureEnabled('messages_forwardMessages');
  const deleteMessagesEnabled = isFeatureEnabled('messages_deleteMessages');
  const emojiPickerEnabled = isFeatureEnabled('messages_emojiPicker');
  const wallpaperEnabled = isFeatureEnabled('messages_wallpaper');
  const searchEnabled = isFeatureEnabled('messages_search');
  const readReceiptsEnabled = isFeatureEnabled('messages_readReceipts');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'connects' | 'archived'>('all');
  const [showPenMenu, setShowPenMenu] = useState(false);
  const [showNewMsgPicker, setShowNewMsgPicker] = useState(false);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<User[]>([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [editGroupNameValue, setEditGroupNameValue] = useState('');
  const [showAddMemberPicker, setShowAddMemberPicker] = useState(false);
  const [addMemberSearchTerm, setAddMemberSearchTerm] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  // UI State
  const [showFormatting, setShowFormatting] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  // const [undoMessageId, setUndoMessageId] = useState<string | null>(null); // COMMENTED OUT — undo feature disabled
  // const [showUndoToast, setShowUndoToast] = useState(false); // COMMENTED OUT — undo feature disabled
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [chatSearch, setChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchIndex, setChatSearchIndex] = useState(0);
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>('default');
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  // useClickOutside hook replaced with ClickOutsideOverlay component in JSX
  const [compactMode, setCompactMode] = useState(false);

  // Notification State
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<NotificationType>('info');

  // Message context menu state
  const [contextMenuMsg, setContextMenuMsg] = useState<Message | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete confirmation modal state
  const [showDeleteMsgConfirm, setShowDeleteMsgConfirm] = useState(false);
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);

  // Image message state
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [imageCompressing, setImageCompressing] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number; type: string; data: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxForwardOpen, setLightboxForwardOpen] = useState(false);
  const [forwardingImage, setForwardingImage] = useState(false);

  // Batch 2: Forward, Pin, Star, Export state
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinnedBanner, setShowPinnedBanner] = useState(true);
  const [showStarredView, setShowStarredView] = useState(false);
  const [showPinnedView, setShowPinnedView] = useState(false);
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);
  const [disappearingPerMessage, setDisappearingPerMessage] = useState<number | null>(null); // per-message override (ms)
  const [showPerMsgTimerPicker, setShowPerMsgTimerPicker] = useState(false);

  // E2EE state
  const e2ePrivateKeyRef = useRef<CryptoKey | null>(null);
  const e2ePublicKeyRef = useRef<ExportedPublicKey | null>(null);
  const e2eSharedKeysRef = useRef<Map<string, CryptoKey>>(new Map());
  const e2eGroupKeysRef = useRef<Map<string, CryptoKey>>(new Map());
  const [e2eReady, setE2eReady] = useState(false);
  // Bumped whenever a shared/group key is derived so message listener re-decrypts
  const [e2eKeyVersion, setE2eKeyVersion] = useState(0);

  // Report / Block state
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [reportMessageText, setReportMessageText] = useState('');
  const [reportSenderId, setReportSenderId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockTargetUser, setBlockTargetUser] = useState<{ uid: string; name: string } | null>(null);

  // Call state — subscribe to CallManager for header button states
  const [callState, setCallState] = useState<CallState>(getCallManager().getState());
  const callManagerRef = useRef(getCallManager());

  // Group call state
  const [groupCallState, setGroupCallState] = useState<GroupCallState>(getGroupCallManager().getState());
  const groupCallManagerRef = useRef(getGroupCallManager());
  const [activeGroupCallId, setActiveGroupCallId] = useState<string | null>(null);

  // Refs
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load wallpaper from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('selectedWallpaper');
    if (saved && saved in WALLPAPER_PRESETS) {
      setSelectedWallpaper(saved);
    }
  }, []);

  // Subscribe to call manager state changes (for header button enabled/disabled state)
  useEffect(() => {
    const unsub = callManagerRef.current.subscribe((state) => {
      setCallState(state);
    });
    return unsub;
  }, []);

  // Subscribe to group call manager state changes
  useEffect(() => {
    const unsub = groupCallManagerRef.current.subscribe((state) => {
      setGroupCallState(state);
    });
    return unsub;
  }, []);

  // Check for active group call when selecting a group conversation
  useEffect(() => {
    if (!selectedConvId) { setActiveGroupCallId(null); return; }
    const conv = conversations.find((c) => c.id === selectedConvId);
    if (!conv?.isGroup) { setActiveGroupCallId(null); return; }
    let cancelled = false;
    GroupCallManager.getActiveCall(selectedConvId).then((roomId) => {
      if (!cancelled) setActiveGroupCallId(roomId);
    }).catch(() => {});
    // Also listen for groupCalls changes for this conversation
    const q = query(
      collection(db, 'groupCalls'),
      where('conversationId', '==', selectedConvId),
      where('status', '==', 'active'),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!cancelled) {
        setActiveGroupCallId(snap.empty ? null : snap.docs[0].id);
      }
    });
    return () => { cancelled = true; unsub(); };
  }, [selectedConvId, conversations]);

  // E2EE: Generate/load ECDH key pair on mount (syncs across devices via Firestore)
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    const initE2E = async () => {
      try {
        const { publicKey, privateKey } = await getOrCreateKeyPair(user.uid);
        if (cancelled) return;
        e2ePrivateKeyRef.current = privateKey;
        e2ePublicKeyRef.current = publicKey;
        // Ensure public key is published (getOrCreateKeyPair handles full sync for new keys)
        await updateDoc(doc(db, 'users', user.uid), {
          e2ePublicKey: publicKey,
        });
        setE2eReady(true);
        console.log('[E2EE] Initialized successfully');
      } catch (err) {
        console.error('E2EE init failed:', err);
        // Fall back to legacy encryption if E2EE init fails
      }
    };
    initE2E();
    return () => { cancelled = true; };
  }, [user?.uid]);

  // E2EE: Derive shared key when opening a 1:1 conversation
  useEffect(() => {
    if (!user?.uid || !selectedUser || !e2eReady || !e2ePrivateKeyRef.current) return;
    let cancelled = false;
    const deriveKey = async () => {
      const cacheKey = selectedUser.id;
      // Skip if already cached
      if (e2eSharedKeysRef.current.has(cacheKey)) return;
      try {
        // Fetch peer's public key from Firestore
        const peerDoc = await getDoc(doc(db, 'users', selectedUser.id));
        const peerData = peerDoc.data();
        if (!peerData?.e2ePublicKey) {
          // Peer hasn't set up E2EE yet — will fall back to legacy
          return;
        }
        if (cancelled) return;
        const sharedKey = await deriveSharedKey(
          e2ePrivateKeyRef.current!,
          peerData.e2ePublicKey as ExportedPublicKey
        );
        if (!cancelled) {
          e2eSharedKeysRef.current.set(cacheKey, sharedKey);
          setE2eKeyVersion((v) => v + 1); // trigger message re-decryption
        }
      } catch (err) {
        console.error('E2EE shared key derivation failed:', err);
      }
    };
    deriveKey();
    return () => { cancelled = true; };
  }, [user?.uid, selectedUser, e2eReady]);

  // E2EE: Unwrap group key when opening a group conversation
  useEffect(() => {
    if (!user?.uid || !selectedConvId || !e2eReady || !e2ePrivateKeyRef.current) return;
    const activeConv = conversations.find((c) => c.id === selectedConvId);
    if (!activeConv?.isGroup) return;
    // Skip if already cached
    if (e2eGroupKeysRef.current.has(selectedConvId)) return;

    let cancelled = false;
    const unwrapKey = async () => {
      try {
        // Fetch group conversation for e2eGroupKeys
        const convDoc = await getDoc(doc(db, 'conversations', selectedConvId));
        const convData = convDoc.data();
        if (!convData?.e2eGroupKeys || !convData.e2eGroupKeys[user.uid]) {
          // No group key distributed for us yet
          return;
        }
        const wrappedKey = convData.e2eGroupKeys[user.uid];
        const distributorUid = convData.e2eKeyDistributor || convData.groupCreatedBy;

        // Fetch distributor's public key
        const distributorDoc = await getDoc(doc(db, 'users', distributorUid));
        const distributorData = distributorDoc.data();
        if (!distributorData?.e2ePublicKey) return;

        if (cancelled) return;
        const groupKey = await unwrapGroupKeyWithECDH(
          wrappedKey,
          e2ePrivateKeyRef.current!,
          distributorData.e2ePublicKey as ExportedPublicKey
        );
        if (!cancelled) {
          e2eGroupKeysRef.current.set(selectedConvId, groupKey);
          setE2eKeyVersion((v) => v + 1); // trigger message re-decryption
        }
      } catch (err) {
        console.error('E2EE group key unwrap failed:', err);
      }
    };
    unwrapKey();
    return () => { cancelled = true; };
  }, [user?.uid, selectedConvId, conversations, e2eReady]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Fetch users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const usersData: User[] = [];
        snap.forEach((d) => {
          usersData.push({ id: d.id, ...d.data() } as User);
        });
        setUsers(usersData);
      } catch (err) {
        console.error('Error fetching users:', err);
        showNotif('Failed to load users', 'error');
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchUsers();
    }
  }, [user]);

  // Auto-select user from URL param (e.g. from Discover page "Message" button)
  useEffect(() => {
    const targetUserId = searchParams.get('user');
    if (targetUserId && users.length > 0 && !selectedUser) {
      const targetUser = users.find((u) => u.id === targetUserId);
      if (targetUser) {
        setSelectedUser(targetUser);
        setViewState('room');
        // Clean up the URL param
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, users, selectedUser, setSearchParams]);

  // Auto-join group call from deep link (e.g. ?joinCall=gc_xxx&conv=yyy)
  useEffect(() => {
    const joinCallId = searchParams.get('joinCall');
    const convId = searchParams.get('conv');
    if (!joinCallId || !convId || !user?.uid || !conversations.length) return;
    // Find the conversation
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    // Clean up URL params immediately to prevent re-triggering
    setSearchParams({}, { replace: true });
    // Select the conversation
    if (conv.isGroup) {
      setSelectedConvId(convId);
      setSelectedUser(null);
      setViewState('room');
    }
    // Join the call after a short delay to let state settle
    const timer = setTimeout(() => {
      const myName = userProfile?.name || userProfile?.preferredName || user.displayName || 'User';
      groupCallManagerRef.current.joinCall(joinCallId, user.uid, myName)
        .then(() => { setActiveGroupCallId(joinCallId); })
        .catch((err: Error) => showNotif(err.message || 'Failed to join call', 'error'));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchParams, user, conversations, userProfile]);

  // ===== PRESENCE SYSTEM =====
  // Writes current user's presence to Firestore and listens for other users' presence.
  // Uses heartbeat (60s), visibilitychange (away detection), and beforeunload (offline).
  useEffect(() => {
    if (!user?.uid || !onlineLastSeenEnabled) return;
    const userDocRef = doc(db, 'users', user.uid);
    let heartbeatTimer: ReturnType<typeof setInterval>;
    let awayTimer: ReturnType<typeof setTimeout>;

    const updatePresence = async (status: PresenceStatus) => {
      try {
        await updateDoc(userDocRef, {
          presenceStatus: status,
          isOnline: status !== 'offline',
          lastSeen: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error updating presence:', err);
      }
    };

    // Set online immediately
    updatePresence('online');

    // Heartbeat: refresh lastSeen every 60s while tab is visible
    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence('online');
      }
    }, PRESENCE_HEARTBEAT_INTERVAL);

    // Visibility change: tab hidden → start away timer, tab visible → set online
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        awayTimer = setTimeout(() => {
          updatePresence('away');
        }, PRESENCE_AWAY_TIMEOUT);
      } else {
        clearTimeout(awayTimer);
        updatePresence('online');
      }
    };

    // Before unload / pagehide: set offline (best-effort, may not always fire)
    // `pagehide` is more reliable than `beforeunload` on iOS Safari and Android Chrome.
    // We listen on both for maximum cross-browser coverage.
    const handleBeforeUnload = () => {
      updatePresence('offline');
    };
    const handlePageHide = () => {
      updatePresence('offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      clearInterval(heartbeatTimer);
      clearTimeout(awayTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      // Set offline on unmount
      updatePresence('offline');
    };
  }, [user?.uid]);

  // Real-time presence listener for users in active conversations
  // Subscribes to presence changes for all users we have conversations with
  useEffect(() => {
    if (!user?.uid || conversations.length === 0) return;

    // Collect unique other-user IDs from 1:1 conversations
    const otherUserIds = new Set<string>();
    conversations.forEach((conv) => {
      if (!conv.isGroup && conv.participants) {
        conv.participants.forEach((pid: string) => {
          if (pid !== user.uid) otherUserIds.add(pid);
        });
      }
    });

    if (otherUserIds.size === 0) return;

    // Subscribe to each user's presence (Firestore doesn't support 'in' with onSnapshot for > 30)
    const unsubscribes: (() => void)[] = [];
    const userIdArray = Array.from(otherUserIds);

    // Batch into groups of 10 for Firestore 'in' query limit
    for (let i = 0; i < userIdArray.length; i += 10) {
      const batch = userIdArray.slice(i, i + 10);
      const q = query(
        collection(db, 'users'),
        where('__name__', 'in', batch)
      );
      const unsub = onSnapshot(q, (snap) => {
        setUsers((prev) => {
          const updated = [...prev];
          snap.docChanges().forEach((change) => {
            if (change.type === 'modified' || change.type === 'added') {
              const data = change.doc.data();
              const idx = updated.findIndex((u) => u.id === change.doc.id);
              if (idx >= 0) {
                updated[idx] = {
                  ...updated[idx],
                  isOnline: data.isOnline ?? false,
                  lastSeen: data.lastSeen ?? undefined,
                  presenceStatus: data.presenceStatus ?? 'offline',
                };
              }
            }
          });
          return updated;
        });
      }, (err) => {
        console.error('Error listening to user presence:', err);
      });
      unsubscribes.push(unsub);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [user?.uid, conversations]);

  // Fetch conversations with real-time updates
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid), orderBy('updatedAt', 'desc')),
      (snap) => {
        const convs: Conversation[] = [];
        snap.forEach((d) => {
          convs.push({ id: d.id, ...d.data() } as Conversation);
        });
        setConversations(convs);
      },
      (err) => {
        console.error('Error fetching conversations:', err);
        showNotif('Failed to load conversations', 'error');
      }
    );
    unsubscribersRef.current.push(unsubscribe);
    return () => unsubscribe();
  }, [user]);

  // Fetch and listen to messages for selected conversation (1:1 or group)
  useEffect(() => {
    if (!user?.uid) return;
    // Determine conversation ID
    let convId: string | null = null;
    if (selectedConvId) {
      convId = selectedConvId;
    } else if (selectedUser) {
      convId = generateConvId(user.uid, selectedUser.id);
    }
    if (!convId) return;
    setMessagesLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc')),
      async (snap) => {
        const rawMsgs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        const msgs: Message[] = [];
        for (const rawMsg of rawMsgs) {
          let text = (rawMsg as Record<string, unknown>).text as string || '';
          let image = (rawMsg as Record<string, unknown>).image as string | undefined;
          let voiceMessage = (rawMsg as Record<string, unknown>).voiceMessage as Message['voiceMessage'];

          const isEncrypted = (rawMsg as Record<string, unknown>).encrypted;

          if (isEncrypted) {
            // Determine which decryption key to use
            const activeConv = selectedConvId ? conversations.find((c) => c.id === selectedConvId) : null;
            const isGroupConv = !!activeConv?.isGroup;

            // Helper to check if a string is still encrypted (decryption failed)
            const isStillEncrypted = (s: string): boolean => {
              try {
                const p = JSON.parse(s);
                return !!(p.v === 2 && p.iv && p.ct);
              } catch { return false; }
            };

            // Helper to try decrypting all fields with a given key.
            // Returns true if at least one field was successfully decrypted.
            // Does NOT replace text with friendly message — caller handles that after all strategies.
            const tryDecryptAllFields = async (key: CryptoKey): Promise<boolean> => {
              let anyDecrypted = false;

              // Try to decrypt text (skip if empty or not v2 JSON)
              if (text) {
                try {
                  const textParsed = JSON.parse(text);
                  if (textParsed.v === 2) {
                    const decryptedText = await e2eDecrypt(text, key);
                    if (!isStillEncrypted(decryptedText)) {
                      text = decryptedText;
                      anyDecrypted = true;
                    }
                  }
                } catch { /* text is not v2 JSON — skip */ }
              }

              // Try to decrypt image
              if (image) {
                try {
                  const imgParsed = JSON.parse(image);
                  if (imgParsed.v === 2) {
                    const decryptedImg = await e2eDecrypt(image, key);
                    if (!isStillEncrypted(decryptedImg)) {
                      image = decryptedImg;
                      anyDecrypted = true;
                    } else {
                      image = undefined; // Can't decrypt — hide broken image
                    }
                  }
                } catch { /* not encrypted or not JSON */ }
              }

              // Try to decrypt voice message
              if (voiceMessage?.audioUrl) {
                try {
                  const voiceParsed = JSON.parse(voiceMessage.audioUrl);
                  if (voiceParsed.v === 2) {
                    const decryptedAudio = await e2eDecrypt(voiceMessage.audioUrl, key);
                    if (!isStillEncrypted(decryptedAudio)) {
                      voiceMessage = { ...voiceMessage, audioUrl: decryptedAudio };
                      anyDecrypted = true;
                    }
                  }
                } catch { /* not encrypted or not JSON */ }
              }

              return anyDecrypted;
            };

            if (isGroupConv && selectedConvId) {
              // Group decryption
              const groupKey = e2eGroupKeysRef.current.get(selectedConvId);
              if (groupKey) {
                let groupIsV2 = false;
                try { const p = JSON.parse(text); groupIsV2 = p.v === 2; } catch {}
                if (!groupIsV2 && image) {
                  try { const p = JSON.parse(image); groupIsV2 = p.v === 2; } catch {}
                }
                if (groupIsV2) {
                  const ok = await tryDecryptAllFields(groupKey);
                  if (!ok) {
                    text = '\u{1F512} This message cannot be decrypted on this device';
                  }
                }
              }
            } else if (selectedUser) {
              // 1:1 decryption — try strategies in order:
              // 1) Deterministic V2 key (new default, cross-device safe)
              // 2) ECDH shared key (old V2 messages)
              // 3) Per-message ECDH key (old V2 messages with stored sender key)
              // 4) Legacy V1 (oldest messages)
              // Check if EITHER text or image is v2 encrypted
              let isV2 = false;
              try { const p = JSON.parse(text); isV2 = p.v === 2; } catch { /* not v2 text */ }
              if (!isV2 && image) {
                try { const p = JSON.parse(image); isV2 = p.v === 2; } catch { /* not v2 image */ }
              }

              if (isV2) {
                let decrypted = false;

                // Strategy 1: Deterministic key (works cross-device, cross-browser)
                try {
                  const detKey = await getDeterministicSharedKey(user.uid, selectedUser.id);
                  decrypted = await tryDecryptAllFields(detKey);
                } catch (err) {
                  console.warn('[E2EE] Deterministic decrypt failed:', err);
                }

                // Strategy 2: ECDH shared key (for old messages encrypted with ECDH)
                if (!decrypted) {
                  const sharedKey = e2eSharedKeysRef.current.get(selectedUser.id);
                  if (sharedKey) {
                    try {
                      decrypted = await tryDecryptAllFields(sharedKey);
                    } catch { /* ECDH decrypt failed */ }
                  }
                }

                // Strategy 3: Per-message sender public key ECDH
                if (!decrypted) {
                  const msgSenderPubKey = (rawMsg as Record<string, unknown>).senderPublicKey as ExportedPublicKey | undefined;
                  const msgSenderId = (rawMsg as Record<string, unknown>).senderId as string;
                  if (msgSenderPubKey && e2ePrivateKeyRef.current) {
                    try {
                      const peerPubKey = msgSenderId === user.uid
                        ? (await getDoc(doc(db, 'users', selectedUser.id))).data()?.e2ePublicKey as ExportedPublicKey
                        : msgSenderPubKey;
                      if (peerPubKey) {
                        const perMsgKey = await deriveSharedKey(e2ePrivateKeyRef.current, peerPubKey);
                        decrypted = await tryDecryptAllFields(perMsgKey);
                      }
                    } catch { /* per-message ECDH failed */ }
                  }
                }

                // All V2 strategies failed — show friendly message
                if (!decrypted) {
                  text = '\u{1F512} This message cannot be decrypted on this device';
                  image = undefined;
                }
              } else {
                // Not a v2 payload — try legacy v1 decrypt
                try {
                  const convKey = generateConversationKey(user.uid, selectedUser.id);
                  if (text) text = decryptMessage(text, convKey);
                } catch {
                  text = '[Encrypted]';
                }
              }
            }
          }

          msgs.push({ ...(rawMsg as Record<string, unknown>), id: (rawMsg as Record<string, unknown>).id as string, text, image, voiceMessage } as Message);
        }
        setMessages(msgs);
        setPinnedMessages(msgs.filter(m => m.pinned));
        setMessagesLoading(false);
        setTimeout(() => scrollToBottom(), 100);

        // Mark unread messages from other user(s) as read
        if (convId && document.visibilityState === 'visible') {
          const unreadFromOthers = snap.docs.filter((d) => {
            const data = d.data();
            return data.senderId !== user.uid && !data.read;
          });
          if (unreadFromOthers.length > 0) {
            try {
              const batch = writeBatch(db);
              unreadFromOthers.forEach((d) => {
                batch.update(doc(db, 'conversations', convId!, 'messages', d.id), {
                  read: true,
                  readAt: serverTimestamp(),
                });
              });
              // Also reset unreadCount and mark last message as read on the conversation doc
              batch.update(doc(db, 'conversations', convId!), { unreadCount: 0, lastMessageRead: true });
              await batch.commit();
            } catch (err) {
              console.error('Error marking messages as read:', err);
            }
          }
        }
      },
      (err) => {
        console.error('Error fetching messages:', err);
        showNotif('Failed to load messages', 'error');
      }
    );
    unsubscribersRef.current.push(unsubscribe);
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, selectedConvId, user, encryptionEnabled, e2eKeyVersion]);

  // Mark messages as read when user returns to the tab (cross-browser: visibilitychange)
  // This handles the case where messages arrived while the tab was hidden.
  useEffect(() => {
    const convId = selectedConvId || (selectedUser ? undefined : undefined);
    const activeConvId = selectedConvId || conversations.find((c) =>
      !c.isGroup && c.participants.includes(user?.uid || '') && c.participants.includes(selectedUser?.id || '')
    )?.id;
    if (!activeConvId || !user?.uid) return;
    const handleVisibilityForRead = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const msgsRef = collection(db, 'conversations', activeConvId, 'messages');
        const msgsSnap = await getDocs(msgsRef);
        const unreadFromOthers = msgsSnap.docs.filter((d) => {
          const data = d.data();
          return data.senderId !== user.uid && !data.read;
        });
        if (unreadFromOthers.length > 0) {
          const batch = writeBatch(db);
          unreadFromOthers.forEach((d) => {
            batch.update(doc(db, 'conversations', activeConvId, 'messages', d.id), {
              read: true,
              readAt: serverTimestamp(),
            });
          });
          batch.update(doc(db, 'conversations', activeConvId), { unreadCount: 0, lastMessageRead: true });
          await batch.commit();
        }
      } catch (err) {
        console.error('Error marking messages as read on visibility change:', err);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityForRead);
    return () => document.removeEventListener('visibilitychange', handleVisibilityForRead);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.id, selectedConvId, user?.uid, conversations]);

  // Clear message input when switching conversations to prevent accidental cross-sends
  useEffect(() => {
    setMessageText('');
    setPendingImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [selectedUser?.id, selectedConvId]);

  // Cleanup unsubscribers on unmount
  useEffect(() => {
    return () => {
      unsubscribersRef.current.forEach((unsub) => unsub());
    };
  }, []);

  // Load blocked users from Firestore
  useEffect(() => {
    if (!user) return;
    const loadBlocked = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.blockedUsers) setBlockedUsers(new Set(data.blockedUsers));
        }
      } catch (e) { console.error('Error loading blocked users:', e); }
    };
    loadBlocked();
  }, [user]);

  // ===== REPORT & BLOCK HANDLERS =====

  const openReportModal = (msgId: string, msgText: string, senderId: string) => {
    setReportMessageId(msgId);
    setReportMessageText(msgText);
    setReportSenderId(senderId);
    setReportReason('');
    setReportDetails('');
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReason || !reportMessageId || !user || !reportSenderId) return;
    try {
      setReportSubmitting(true);
      const categoryObj = MESSAGE_REPORT_CATEGORIES.find((c) => c.id === reportReason);
      const senderUser = users.find((u) => u.id === reportSenderId);

      // Write to reports collection
      await addDoc(collection(db, 'reports'), {
        type: 'message',
        messageId: reportMessageId,
        messageText: reportMessageText.slice(0, 200),
        reportedUserId: reportSenderId,
        reportedUserName: senderUser?.name || 'Unknown',
        reportedBy: user.uid,
        reporterName: user.displayName || 'Anonymous',
        category: reportReason,
        categoryLabel: categoryObj?.label || reportReason,
        details: reportDetails.trim() || '',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      // Write to moderationQueue
      const modQueueQuery = query(
        collection(db, 'moderationQueue'),
        where('contentId', '==', reportMessageId)
      );
      const existingMods = await getDocs(modQueueQuery);
      let totalReportCount = 1;

      if (existingMods.docs.length > 0) {
        const existingDoc = existingMods.docs[0];
        totalReportCount = (existingDoc.data().reportCount || 1) + 1;
        await updateDoc(doc(db, 'moderationQueue', existingDoc.id), {
          reportCount: totalReportCount,
          reporters: arrayUnion({
            uid: user.uid,
            name: user.displayName || 'Anonymous',
            category: reportReason,
            details: reportDetails.trim() || '',
            createdAt: new Date().toISOString(),
          }),
        });
      } else {
        await addDoc(collection(db, 'moderationQueue'), {
          type: 'message',
          content: reportMessageText.slice(0, 200),
          contentId: reportMessageId,
          collection: 'messages',
          authorId: reportSenderId,
          authorName: senderUser?.name || 'Unknown',
          authorAvatar: senderUser?.avatar || '',
          category: reportReason,
          categoryLabel: categoryObj?.label || reportReason,
          reason: `${categoryObj?.label || reportReason}${reportDetails.trim() ? ': ' + reportDetails.trim() : ''}`,
          reportedBy: user.uid,
          reporterName: user.displayName || 'Anonymous',
          reportCount: 1,
          reporters: [{
            uid: user.uid,
            name: user.displayName || 'Anonymous',
            category: reportReason,
            details: reportDetails.trim() || '',
            createdAt: new Date().toISOString(),
          }],
          createdAt: serverTimestamp(),
        });
      }

      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
      showNotif('Report submitted. Thank you for helping keep the community safe.', 'success');
    } catch (error) {
      console.error('Error submitting report:', error);
      showNotif('Failed to submit report.', 'error');
    } finally {
      setReportSubmitting(false);
    }
  };

  const openBlockConfirm = (uid: string, name: string) => {
    setBlockTargetUser({ uid, name });
    setShowBlockConfirm(true);
  };

  const handleBlockUser = async () => {
    if (!user || !blockTargetUser) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: arrayUnion(blockTargetUser.uid),
      });
      setBlockedUsers((prev) => new Set(prev).add(blockTargetUser.uid));
      setShowBlockConfirm(false);
      setBlockTargetUser(null);
      showNotif(`${blockTargetUser.name} has been blocked. Their messages will be hidden.`, 'success');
    } catch (error) {
      console.error('Error blocking user:', error);
      showNotif('Failed to block user. Please try again.', 'error');
    }
  };

  // ===== UTILITY FUNCTIONS =====

  const showNotif = useCallback((msg: string, type: NotificationType = 'info') => {
    setNotificationMessage(msg);
    setNotificationType(type);
    setShowNotification(true);
  }, []);

  // ===== PUSH NOTIFICATIONS (FCM) =====
  // Cross-browser: Chrome, Firefox, Safari desktop, Android Chrome, iOS Safari 16.4+ (PWA).
  // Guards: isSupported(), navigator.serviceWorker check, Notification API check.
  useEffect(() => {
    if (!user?.uid || !pushNotificationsEnabled) return;
    const setupPushNotifications = async () => {
      try {
        // Guard: service workers not available in all contexts
        // (e.g. some private/incognito modes, older iOS Safari non-PWA)
        if (!('serviceWorker' in navigator)) {
          console.warn('[PushNotif] Service workers not supported in this browser context');
          return;
        }
        // Guard: Notification API not available (e.g. some in-app browsers)
        if (typeof Notification === 'undefined') {
          console.warn('[PushNotif] Notification API not available');
          return;
        }
        const messaging = await initMessaging();
        if (!messaging) {
          console.warn('[PushNotif] FCM not supported in this browser');
          return;
        }
        // Request permission — Safari requires user gesture, so this may silently fail
        // if called outside a gesture context; it will succeed next time user interacts.
        let permission = Notification.permission;
        if (permission === 'default') {
          try {
            permission = await Notification.requestPermission();
          } catch {
            // Safari <16.4 uses callback-based API, handle gracefully
            permission = await new Promise<NotificationPermission>((resolve) => {
              Notification.requestPermission((p) => resolve(p));
            });
          }
        }
        if (permission !== 'granted') {
          console.warn('[PushNotif] Notification permission not granted:', permission);
          return;
        }
        // Register or reuse existing service worker
        // Safari and Firefox both support this, but the scope must match
        let swRegistration: ServiceWorkerRegistration;
        const existingReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (existingReg) {
          swRegistration = existingReg;
        } else {
          swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        }
        // Wait for the service worker to be ready (important for Firefox first-load)
        await navigator.serviceWorker.ready;
        const token = await getToken(messaging, {
          vapidKey: 'PENDING_VAPID_KEY',
          serviceWorkerRegistration: swRegistration,
        });
        if (token) {
          await updateDoc(doc(db, 'users', user.uid), {
            fcmTokens: arrayUnion(token),
          });
          console.log('[PushNotif] FCM token registered successfully');
        }
        // Listen for foreground messages (all browsers)
        const unsubscribe = onMessage(messaging, (payload) => {
          const senderId = payload.data?.senderId;
          if (senderId === user.uid) return; // Don't notify for own messages
          const title = payload.notification?.title || 'New Message';
          const body = payload.notification?.body || '';
          showNotif(`${title}: ${body}`, 'info');
        });
        return unsubscribe;
      } catch (err) {
        // Graceful failure — push notifications are an enhancement, not critical
        console.error('[PushNotif] Error setting up push notifications:', err);
      }
    };
    let unsubForeground: (() => void) | undefined;
    setupPushNotifications().then((unsub) => { unsubForeground = unsub; });
    return () => { if (unsubForeground) unsubForeground(); };
  }, [user?.uid, showNotif]);

  // Firefox fallback: listen for postMessage from service worker when client.navigate() is unavailable
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.url) {
        window.location.href = event.data.url;
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }, []);

  // ===== DISAPPEARING MESSAGES — CLIENT-SIDE CLEANUP =====
  // Uses a ref so the interval is stable and doesn't re-create on every message change.
  const messagesRefForCleanup = useRef(messages);
  messagesRefForCleanup.current = messages;
  useEffect(() => {
    if (!selectedConvId || !user?.uid) return;
    const convId = selectedConvId;
    const timer = setInterval(async () => {
      const now = Date.now();
      const expired = messagesRefForCleanup.current.filter(
        (m) => m.disappearing === true && m.expiresAt && m.expiresAt.toMillis() <= now && !m.deleted
      );
      if (expired.length === 0) return;
      const expiredIds = new Set(expired.map((m) => m.id));
      for (const msg of expired) {
        try { await deleteDoc(doc(db, 'conversations', convId, 'messages', msg.id)); } catch (err) { console.error('[Disappearing] delete error:', err); }
      }
      // Update conversation lastMessage to the latest non-expired message
      try {
        const remaining = messagesRefForCleanup.current.filter(
          (m) => !expiredIds.has(m.id) && !m.deleted
        );
        if (remaining.length > 0) {
          const latest = remaining[remaining.length - 1];
          const preview = latest.image ? '📷 Photo' : latest.file ? `📎 ${latest.file.name}` : latest.voiceMessage ? '🎤 Voice message' : (latest.text || '').slice(0, 60);
          await updateDoc(doc(db, 'conversations', convId), {
            lastMessage: preview,
            lastMessageTime: latest.createdAt || serverTimestamp(),
            lastMessageSenderId: latest.senderId || '',
          });
        } else {
          // All messages expired — clear the preview
          await updateDoc(doc(db, 'conversations', convId), {
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            lastMessageSenderId: '',
          });
        }
      } catch (err) { console.error('[Disappearing] lastMessage update error:', err); }
    }, 15_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConvId, user?.uid]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ===== MESSAGE FUNCTIONS =====

  const editMessage = async (messageId: string, newText: string) => {
    if (!user?.uid) return;
    const convId = getActiveConvId();
    if (!convId) return;
    const validation = validateMessage(newText);
    if (!validation.valid) {
      showNotif(validation.error || 'Invalid message', 'error');
      return;
    }
    let payload = newText.trim();
    if (!selectedConvId && encryptionEnabled && selectedUser) {
      const sharedKey = e2eSharedKeysRef.current.get(selectedUser.id);
      if (sharedKey) {
        payload = await e2eEncrypt(payload, sharedKey);
      } else {
        const convKey = generateConversationKey(user.uid, selectedUser.id);
        payload = encryptMessage(newText.trim(), convKey);
      }
    }
    try {
      await updateDoc(doc(db, 'conversations', convId, 'messages', messageId), {
        text: payload,
        editedAt: serverTimestamp(),
      });
      setEditingMessage(null);
      setMessageText('');
      showNotif('Message updated', 'success');
    } catch (err) {
      console.error('Error editing message:', err);
      showNotif('Failed to edit message', 'error');
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user?.uid) return;
    const convId = getActiveConvId();
    if (!convId) return;
    const msgRef = doc(db, 'conversations', convId, 'messages', messageId);
    try {
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) return;
      const reactions = msgSnap.data().reactions || {};
      const usersWhoReacted = reactions[emoji] || [];
      if (usersWhoReacted.includes(user.uid)) {
        reactions[emoji] = usersWhoReacted.filter((id: string) => id !== user.uid);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...usersWhoReacted, user.uid];
      }
      await updateDoc(msgRef, { reactions });
    } catch (err) {
      console.error('Error toggling reaction:', err);
    }
  };

  const setTypingStatus = async (isTyping: boolean) => {
    if (!user?.uid) return;
    const convId = getActiveConvId();
    if (!convId) return;
    try {
      await updateDoc(doc(db, 'conversations', convId), {
        [`typing.${user.uid}`]: isTyping,
      });
    } catch {}
  };

  const handleFormat = (label: string, wrap: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = messageText.slice(start, end);
    const newText =
      messageText.slice(0, start) +
      wrap +
      (selected || label.toLowerCase()) +
      wrap +
      messageText.slice(end);
    setMessageText(newText);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + wrap.length + (selected ? selected.length : label.toLowerCase().length) + wrap.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const sendMessage = async () => {
    if (!user?.uid || (!messageText.trim() && !pendingImage && !pendingFile)) return;
    // Determine conversation ID
    let convId: string | null = null;
    const activeConv = selectedConvId ? conversations.find((c) => c.id === selectedConvId) : null;
    const isGroup = !!activeConv?.isGroup;
    if (selectedConvId) {
      convId = selectedConvId;
    } else if (selectedUser) {
      convId = generateConvId(user.uid, selectedUser.id);
    }
    if (!convId) return;

    if (messageText.trim()) {
      const validation = validateMessage(messageText);
      if (!validation.valid) {
        showNotif(validation.error || 'Message validation failed', 'error');
        return;
      }
    }

    let payload = messageText.trim();
    let imageToSend = pendingImage;
    let shouldEncrypt = false;

    if (encryptionEnabled) {
      if (isGroup && convId) {
        // Group E2EE: use cached group key
        const groupKey = e2eGroupKeysRef.current.get(convId);
        if (groupKey) {
          shouldEncrypt = true;
          if (payload) {
            payload = await e2eEncrypt(payload, groupKey);
          }
          if (imageToSend) {
            imageToSend = await e2eEncrypt(imageToSend, groupKey);
          }
        }
      } else if (selectedUser) {
        // 1:1 E2EE: use deterministic AES-256-GCM key (cross-device safe)
        shouldEncrypt = true;
        try {
          const detKey = await getDeterministicSharedKey(user.uid, selectedUser.id);
          if (payload) {
            payload = await e2eEncrypt(payload, detKey);
          }
          if (imageToSend) {
            imageToSend = await e2eEncrypt(imageToSend, detKey);
          }
        } catch (err) {
          console.error('[E2EE] Deterministic key encryption failed, falling back to v1:', err);
          if (payload) {
            const convKey = generateConversationKey(user.uid, selectedUser.id);
            payload = encryptMessage(payload, convKey);
          }
        }
      }
    }

    try {
      const msgData: Record<string, unknown> = {
        text: payload || '',
        senderId: user.uid,
        time: formatMessageTime(Timestamp.now()),
        createdAt: serverTimestamp(),
        encrypted: !!shouldEncrypt,
      };
      // Store sender's public key with v2 encrypted messages so recipients
      // can always derive the correct shared key, even after key rotation
      if (shouldEncrypt && e2ePublicKeyRef.current) {
        msgData.senderPublicKey = e2ePublicKeyRef.current;
      }
      if (imageToSend) {
        msgData.image = imageToSend;
      }
      if (pendingFile) {
        msgData.file = {
          name: pendingFile.name,
          size: pendingFile.size,
          type: pendingFile.type,
          data: pendingFile.data,
        };
      }
      if (replyingTo) {
        msgData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text.slice(0, 100),
          senderId: replyingTo.senderId,
        };
      }
      const disappearingExtra = getDisappearingFields(convId);
      const msgRef = await addDoc(collection(db, 'conversations', convId, 'messages'), { ...msgData, ...disappearingExtra });
      // setUndoMessageId(msgRef.id); // COMMENTED OUT — undo feature disabled
      // setShowUndoToast(true); // COMMENTED OUT — undo feature disabled
      void msgRef; // suppress unused variable warning
      setMessageText('');
      setPendingImage(null);
      setPendingFile(null);
      setReplyingTo(null);
      if (disappearingPerMessage) setDisappearingPerMessage(null);
      const lastMsgPreview = pendingFile ? `📎 ${pendingFile.name}` : imageToSend ? (payload ? `📷 ${messageText.slice(0, 40)}` : '📷 Photo') : messageText.slice(0, 50);
      const convUpdateData: Record<string, unknown> = {
        lastMessage: lastMsgPreview,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageRead: false,
      };
      // For 1:1 chats, ensure conversation document exists with participants
      if (!isGroup && selectedUser) {
        convUpdateData.participants = [user.uid, selectedUser.id].sort();
      }
      await setDoc(doc(db, 'conversations', convId), convUpdateData, { merge: true });
      if (!isGroup) await setTypingStatus(false);
    } catch (err) {
      console.error('Error sending message:', err);
      showNotif('Failed to send message', 'error');
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotif('Please select an image file', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotif('Image must be under 10MB', 'error');
      return;
    }
    setImageCompressing(true);
    try {
      const compressed = await compressImage(file, 800, 0.7);
      setPendingImage(compressed);
    } catch {
      showNotif('Failed to process image', 'error');
    } finally {
      setImageCompressing(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate by MIME type OR file extension (browsers sometimes set empty/unexpected MIME types)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
    ];
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.zip'];
    const fileExtension = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    const typeOk = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension);

    // Clear input immediately so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!typeOk) {
      showNotif(`"${file.name}" is not a supported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP`, 'error');
      return;
    }

    // Firestore 1MB doc limit — base64 adds ~33% overhead, so cap raw file at 700KB
    const MAX_FILE_SIZE = 700 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeStr = formatFileSize(file.size);
      showNotif(`"${file.name}" (${fileSizeStr}) exceeds the 700 KB limit. Please share large files via a cloud link instead.`, 'error');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPendingFile({ name: file.name, size: file.size, type: file.type || 'application/octet-stream', data: base64 });
        showNotif(`"${file.name}" attached`, 'success');
      };
      reader.onerror = () => {
        showNotif(`Could not read "${file.name}". The file may be corrupted or locked.`, 'error');
      };
      reader.readAsDataURL(file);
    } catch {
      showNotif(`Failed to process "${file.name}". Please try again.`, 'error');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string): string => {
    if (type === 'application/pdf') return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel') || type === 'text/csv') return '📊';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📑';
    if (type === 'text/plain') return '📃';
    if (type.includes('zip')) return '🗜️';
    return '📎';
  };

  const downloadFile = (fileData: string, fileName: string) => {
    // iOS Safari doesn't always respect the download attribute — use window.open as fallback
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.open(fileData, '_blank');
      return;
    }
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendGif = async (gifUrl: string) => {
    if (!user?.uid) return;
    let convId: string | null = null;
    const activeConv = selectedConvId ? conversations.find((c) => c.id === selectedConvId) : null;
    const isGroup = !!activeConv?.isGroup;
    if (selectedConvId) { convId = selectedConvId; }
    else if (selectedUser) { convId = generateConvId(user.uid, selectedUser.id); }
    if (!convId) return;
    try {
      const msgData: Record<string, unknown> = {
        text: '',
        senderId: user.uid,
        time: formatMessageTime(Timestamp.now()),
        createdAt: serverTimestamp(),
        image: gifUrl,
        encrypted: false,
      };
      await addDoc(collection(db, 'conversations', convId, 'messages'), { ...msgData, ...getDisappearingFields(convId) });
      if (disappearingPerMessage) setDisappearingPerMessage(null);
      const convUpdateData: Record<string, unknown> = {
        lastMessage: 'GIF',
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageRead: false,
      };
      if (!isGroup && selectedUser) {
        convUpdateData.participants = [user.uid, selectedUser.id].sort();
      }
      await setDoc(doc(db, 'conversations', convId), convUpdateData, { merge: true });
    } catch (err) {
      console.error('Failed to send GIF:', err);
      showNotif('Failed to send GIF', 'error');
    }
  };

  // Forward an image to another conversation
  const forwardImageToConversation = async (targetConvId: string) => {
    if (!user?.uid || !lightboxImage) return;
    setForwardingImage(true);
    try {
      const targetConv = conversations.find((c) => c.id === targetConvId);
      let imageToSend = lightboxImage;

      // Encrypt for target conversation
      if (encryptionEnabled) {
        if (targetConv?.isGroup) {
          const convDoc = await getDoc(doc(db, 'conversations', targetConvId));
          const groupKeyData = convDoc.data()?.groupKey;
          if (groupKeyData) {
            const raw = await crypto.subtle.exportKey('raw', await crypto.subtle.importKey('raw', new Uint8Array(Object.values(groupKeyData)), { name: 'AES-GCM' }, true, ['encrypt']));
            const groupKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
            imageToSend = await e2eEncrypt(imageToSend, groupKey);
          }
        } else {
          // 1:1 — derive/use shared key
          const peerId = targetConv?.participants.find((p) => p !== user.uid) || '';
          const cachedKey = e2eSharedKeysRef.current.get(peerId);
          if (cachedKey) {
            imageToSend = await e2eEncrypt(imageToSend, cachedKey);
          }
        }
      }

      const msgData: Record<string, unknown> = {
        text: '',
        senderId: user.uid,
        createdAt: serverTimestamp(),
        image: imageToSend,
      };
      await addDoc(collection(db, 'conversations', targetConvId, 'messages'), { ...msgData, ...getDisappearingFields(targetConvId) });
      await updateDoc(doc(db, 'conversations', targetConvId), {
        lastMessage: '📷 Forwarded photo',
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: user.uid,
        updatedAt: serverTimestamp(),
        lastMessageRead: false,
      });

      showNotif('Image forwarded', 'success');
      setLightboxForwardOpen(false);
      setLightboxImage(null);
    } catch (err) {
      console.error('Error forwarding image:', err);
      showNotif('Failed to forward image', 'error');
    } finally {
      setForwardingImage(false);
    }
  };

  // Download image from lightbox
  const downloadLightboxImage = () => {
    if (!lightboxImage) return;
    const link = document.createElement('a');
    link.href = lightboxImage;
    link.download = `image_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const sendVoiceMessage = async (duration: number, audioBlob?: Blob) => {
    if (!user?.uid) return;
    let convId: string | null = null;
    const activeConv = selectedConvId ? conversations.find((c) => c.id === selectedConvId) : null;
    const isGroup = !!activeConv?.isGroup;
    if (selectedConvId) {
      convId = selectedConvId;
    } else if (selectedUser) {
      convId = generateConvId(user.uid, selectedUser.id);
    }
    if (!convId) return;

    try {
      let audioData: string | undefined;

      // Convert audio blob to base64 data URL for Firestore storage
      // Firestore doc limit is ~1MB, base64 adds ~33% overhead, so cap blob at ~700KB
      if (audioBlob && audioBlob.size > 0) {
        if (audioBlob.size > 700 * 1024) {
          showNotif('Voice message is too long. Please keep it under 60 seconds.', 'error');
          return;
        }
        audioData = await blobToBase64(audioBlob);
      }

      // Encrypt voice data
      let shouldEncryptVoice = false;
      let encryptedText = '🎤 Voice message';
      let encryptedAudioUrl = audioData;

      if (encryptionEnabled) {
        if (isGroup && convId) {
          const groupKey = e2eGroupKeysRef.current.get(convId);
          if (groupKey) {
            shouldEncryptVoice = true;
            encryptedText = await e2eEncrypt(encryptedText, groupKey);
            if (encryptedAudioUrl) {
              encryptedAudioUrl = await e2eEncrypt(encryptedAudioUrl, groupKey);
            }
          }
        } else if (selectedUser) {
          try {
            const detKey = await getDeterministicSharedKey(user.uid, selectedUser.id);
            shouldEncryptVoice = true;
            encryptedText = await e2eEncrypt(encryptedText, detKey);
            if (encryptedAudioUrl) {
              encryptedAudioUrl = await e2eEncrypt(encryptedAudioUrl, detKey);
            }
          } catch (err) {
            console.error('[E2EE] Voice deterministic key failed:', err);
          }
        }
      }

      const voiceMsgData: Record<string, unknown> = {
        text: encryptedText,
        senderId: user.uid,
        time: formatMessageTime(Timestamp.now()),
        createdAt: serverTimestamp(),
        encrypted: !!shouldEncryptVoice,
        voiceMessage: { duration, ...(encryptedAudioUrl ? { audioUrl: encryptedAudioUrl } : {}) },
      };
      if (shouldEncryptVoice && e2ePublicKeyRef.current) {
        voiceMsgData.senderPublicKey = e2ePublicKeyRef.current;
      }
      const msgRef = await addDoc(collection(db, 'conversations', convId, 'messages'), { ...voiceMsgData, ...getDisappearingFields(convId) });
      // setUndoMessageId(msgRef.id); // COMMENTED OUT — undo feature disabled
      // setShowUndoToast(true); // COMMENTED OUT — undo feature disabled
      void msgRef;
      if (disappearingPerMessage) setDisappearingPerMessage(null);
      const convUpdateData: Record<string, unknown> = {
        lastMessage: '🎤 Voice message',
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageRead: false,
      };
      // For 1:1 chats, ensure conversation document exists with participants
      if (!isGroup && selectedUser) {
        convUpdateData.participants = [user.uid, selectedUser.id].sort();
      }
      await setDoc(doc(db, 'conversations', convId), convUpdateData, { merge: true });
    } catch (err) {
      console.error('Error sending voice message:', err);
      showNotif('Failed to send voice message', 'error');
    }
  };

  const createGroup = async () => {
    if (!user?.uid || !groupName.trim() || selectedGroupMembers.length === 0) {
      showNotif('Please enter a group name and select at least one member', 'warning');
      return;
    }
    try {
      const participantIds = [user.uid, ...selectedGroupMembers.map((m) => m.id)];
      const groupId = `group__${Date.now()}__${user.uid}`;

      // Generate and distribute E2EE group key
      let e2eGroupKeys: Record<string, string> = {};
      if (encryptionEnabled && e2eReady && e2ePrivateKeyRef.current) {
        try {
          const groupKey = await generateGroupKey();
          const wrappedKeys: Record<string, string> = {};

          // Wrap group key for each participant (including self)
          for (const memberId of participantIds) {
            const memberDoc = await getDoc(doc(db, 'users', memberId));
            const memberData = memberDoc.data();
            if (memberData?.e2ePublicKey) {
              wrappedKeys[memberId] = await wrapGroupKeyForMemberWithECDH(
                groupKey,
                e2ePrivateKeyRef.current,
                memberData.e2ePublicKey as ExportedPublicKey
              );
            }
          }
          e2eGroupKeys = wrappedKeys;
          // Cache the group key locally
          e2eGroupKeysRef.current.set(groupId, groupKey);
        } catch (err) {
          console.error('Failed to generate group E2EE keys:', err);
          // Continue without encryption — group still created
        }
      }

      await setDoc(doc(db, 'conversations', groupId), {
        participants: participantIds,
        isGroup: true,
        groupName: groupName.trim(),
        groupCreatedBy: user.uid,
        groupAdmins: [user.uid],
        lastMessage: `Group "${groupName.trim()}" created`,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageRead: false,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        ...(Object.keys(e2eGroupKeys).length > 0 ? {
          e2eGroupKeys,
          e2eKeyDistributor: user.uid,
        } : {}),
      });
      // Add a system message
      await addDoc(collection(db, 'conversations', groupId, 'messages'), {
        text: `Group "${groupName.trim()}" created by ${user.displayName || 'you'}`,
        senderId: 'system',
        time: formatMessageTime(Timestamp.now()),
        createdAt: serverTimestamp(),
      });
      showNotif(`Group "${groupName.trim()}" created!`, 'success');
      setShowGroupCreator(false);
      setGroupName('');
      setSelectedGroupMembers([]);
      setGroupSearchTerm('');
      // Select the group conversation
      setSelectedConvId(groupId);
      setViewState('room');
    } catch (err) {
      console.error('Error creating group:', err);
      showNotif('Failed to create group', 'error');
    }
  };

  const toggleGroupMember = (u: User) => {
    setSelectedGroupMembers((prev) =>
      prev.find((m) => m.id === u.id)
        ? prev.filter((m) => m.id !== u.id)
        : [...prev, u]
    );
  };

  // === Group Management Functions ===

  const isGroupAdmin = (conv: Conversation | null | undefined): boolean => {
    if (!conv || !user?.uid) return false;
    // Creator is always admin (backward compat for groups created before groupAdmins field)
    if (conv.groupCreatedBy === user.uid) return true;
    return conv.groupAdmins?.includes(user.uid) || false;
  };

  const updateGroupName = async (newName: string) => {
    if (!selectedConvId || !newName.trim()) return;
    const conv = conversations.find((c) => c.id === selectedConvId);
    if (!isGroupAdmin(conv)) {
      showNotif('Only group admins can edit the group name', 'warning');
      return;
    }
    try {
      await updateDoc(doc(db, 'conversations', selectedConvId), {
        groupName: newName.trim(),
        updatedAt: serverTimestamp(),
      });
      // System message
      await addDoc(collection(db, 'conversations', selectedConvId, 'messages'), {
        text: `${user?.displayName || 'Admin'} changed the group name to "${newName.trim()}"`,
        senderId: 'system',
        time: formatMessageTime(Timestamp.now()),
        createdAt: serverTimestamp(),
      });
      showNotif('Group name updated!', 'success');
      setEditingGroupName(false);
    } catch (err) {
      console.error('Error updating group name:', err);
      showNotif('Failed to update group name', 'error');
    }
  };

  const addMemberToGroup = async (newMember: User) => {
    if (!selectedConvId || !user?.uid) return;
    const conv = conversations.find((c) => c.id === selectedConvId);
    if (!isGroupAdmin(conv)) {
      showNotif('Only group admins can add members', 'warning');
      return;
    }
    if (conv?.participants.includes(newMember.id)) {
      showNotif(`${newMember.name} is already in the group`, 'info');
      return;
    }
    try {
      const updatedParticipants = [...(conv?.participants || []), newMember.id];
      const updateData: Record<string, unknown> = {
        participants: updatedParticipants,
        updatedAt: serverTimestamp(),
      };

      // Wrap group key for the new member
      if (encryptionEnabled && e2ePrivateKeyRef.current) {
        const groupKey = e2eGroupKeysRef.current.get(selectedConvId);
        if (groupKey) {
          try {
            const memberDoc = await getDoc(doc(db, 'users', newMember.id));
            const memberData = memberDoc.data();
            if (memberData?.e2ePublicKey) {
              const wrappedKey = await wrapGroupKeyForMemberWithECDH(
                groupKey,
                e2ePrivateKeyRef.current,
                memberData.e2ePublicKey as ExportedPublicKey
              );
              updateData[`e2eGroupKeys.${newMember.id}`] = wrappedKey;
              updateData.e2eKeyDistributor = user.uid;
            }
          } catch (err) {
            console.error('Failed to wrap group key for new member:', err);
          }
        }
      }

      await updateDoc(doc(db, 'conversations', selectedConvId), updateData);
      await addDoc(collection(db, 'conversations', selectedConvId, 'messages'), {
        text: `${user?.displayName || 'Admin'} added ${newMember.name} to the group`,
        senderId: 'system',
        time: formatMessageTime(Timestamp.now()),
        createdAt: serverTimestamp(),
      });
      showNotif(`${newMember.name} added to the group`, 'success');
    } catch (err) {
      console.error('Error adding member:', err);
      showNotif('Failed to add member', 'error');
    }
  };

  const removeMemberFromGroup = async (memberId: string) => {
    if (!selectedConvId || !user?.uid) return;
    const conv = conversations.find((c) => c.id === selectedConvId);
    if (!isGroupAdmin(conv)) {
      showNotif('Only group admins can remove members', 'warning');
      return;
    }
    if (memberId === conv?.groupCreatedBy) {
      showNotif('Cannot remove the group creator', 'warning');
      return;
    }
    const memberUser = users.find((u) => u.id === memberId);
    try {
      const updatedParticipants = conv?.participants.filter((p) => p !== memberId) || [];
      const updatedAdmins = (conv?.groupAdmins || []).filter((a) => a !== memberId);
      await updateDoc(doc(db, 'conversations', selectedConvId), {
        participants: updatedParticipants,
        groupAdmins: updatedAdmins,
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'conversations', selectedConvId, 'messages'), {
        text: `${user?.displayName || 'Admin'} removed ${memberUser?.name || 'a member'} from the group`,
        senderId: 'system',
        time: formatMessageTime(Timestamp.now()),
        createdAt: serverTimestamp(),
      });
      showNotif(`${memberUser?.name || 'Member'} removed from the group`, 'success');
    } catch (err) {
      console.error('Error removing member:', err);
      showNotif('Failed to remove member', 'error');
    }
  };

  const toggleAdmin = async (memberId: string) => {
    if (!selectedConvId || !user?.uid) return;
    const conv = conversations.find((c) => c.id === selectedConvId);
    // Only the group creator can promote/demote admins
    if (conv?.groupCreatedBy !== user.uid) {
      showNotif('Only the group creator can manage admins', 'warning');
      return;
    }
    if (memberId === conv?.groupCreatedBy) {
      showNotif('The group creator is always an admin', 'info');
      return;
    }
    const currentAdmins = conv?.groupAdmins || [];
    const isCurrentlyAdmin = currentAdmins.includes(memberId);
    const memberUser = users.find((u) => u.id === memberId);
    try {
      const newAdmins = isCurrentlyAdmin
        ? currentAdmins.filter((a) => a !== memberId)
        : [...currentAdmins, memberId];
      await updateDoc(doc(db, 'conversations', selectedConvId), {
        groupAdmins: newAdmins,
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'conversations', selectedConvId, 'messages'), {
        text: isCurrentlyAdmin
          ? `${user?.displayName || 'Creator'} removed ${memberUser?.name || 'a member'} as admin`
          : `${user?.displayName || 'Creator'} made ${memberUser?.name || 'a member'} a group admin`,
        senderId: 'system',
        time: formatMessageTime(Timestamp.now()),
        createdAt: serverTimestamp(),
      });
      showNotif(
        isCurrentlyAdmin
          ? `${memberUser?.name || 'Member'} is no longer an admin`
          : `${memberUser?.name || 'Member'} is now a group admin`,
        'success'
      );
    } catch (err) {
      console.error('Error toggling admin:', err);
      showNotif('Failed to update admin status', 'error');
    }
  };

  const getActiveConvId = (): string | null => {
    if (selectedConvId) return selectedConvId;
    if (selectedUser && user?.uid) return generateConvId(user.uid, selectedUser.id);
    return null;
  };

  const deleteMessage = (messageId: string) => {
    if ((!selectedUser && !selectedConvId) || !user?.uid) return;
    setDeleteMsgId(messageId);
    setShowDeleteMsgConfirm(true);
  };

  const confirmDeleteMessage = async () => {
    if (!deleteMsgId || !user?.uid) return;
    const convId = getActiveConvId();
    if (!convId) return;
    try {
      await deleteDoc(doc(db, 'conversations', convId, 'messages', deleteMsgId));
      showNotif('Message deleted', 'success');
    } catch (err) {
      console.error('Error deleting message:', err);
      showNotif('Failed to delete message', 'error');
    } finally {
      setShowDeleteMsgConfirm(false);
      setDeleteMsgId(null);
    }
  };

  /* undoSend — COMMENTED OUT (duplicate of delete functionality)
  const undoSend = async () => {
    if (!undoMessageId) return;
    if (!user?.uid) return;
    const convId = getActiveConvId();
    if (!convId) return;
    try {
      await deleteDoc(doc(db, 'conversations', convId, 'messages', undoMessageId));
      showNotif('Message deleted', 'success');
    } catch (err) {
      console.error('Error deleting message:', err);
      showNotif('Failed to delete message', 'error');
    }
    setUndoMessageId(null);
    setShowUndoToast(false);
  };
  */

  const toggleMuteConversation = async (convId: string, currentMuted: boolean) => {
    try {
      await updateDoc(doc(db, 'conversations', convId), { notificationsMuted: !currentMuted });
      showNotif(!currentMuted ? 'Conversation muted' : 'Conversation unmuted', 'info');
    } catch {
      showNotif('Failed to update mute setting', 'error');
    }
  };

  const toggleArchiveConversation = async (convId: string, currentArchived: boolean) => {
    try {
      await updateDoc(doc(db, 'conversations', convId), { archived: !currentArchived });
      showNotif(!currentArchived ? 'Conversation archived' : 'Conversation unarchived', 'info');
    } catch {
      showNotif('Failed to update archive setting', 'error');
    }
  };

  // === Batch 2: Forward Message ===
  const forwardMessageToConversation = async (targetConvId: string) => {
    if (!user?.uid || !forwardingMessage) return;
    setForwardingMsg(true);
    try {
      const msgData: Record<string, unknown> = {
        text: forwardingMessage.text || '',
        senderId: user.uid,
        createdAt: serverTimestamp(),
        time: formatMessageTime(Timestamp.now()),
        forwarded: true,
      };
      if (forwardingMessage.image) {
        msgData.image = forwardingMessage.image;
      }
      await addDoc(collection(db, 'conversations', targetConvId, 'messages'), { ...msgData, ...getDisappearingFields(targetConvId) });
      const preview = forwardingMessage.image
        ? (forwardingMessage.text ? `↪ 📷 ${forwardingMessage.text.slice(0, 30)}` : '↪ 📷 Photo')
        : `↪ ${forwardingMessage.text.slice(0, 40)}`;
      await updateDoc(doc(db, 'conversations', targetConvId), {
        lastMessage: preview,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: user.uid,
        updatedAt: serverTimestamp(),
        lastMessageRead: false,
      });
      showNotif('Message forwarded', 'success');
      setShowForwardPicker(false);
      setForwardingMessage(null);
    } catch (err) {
      console.error('Error forwarding message:', err);
      showNotif('Failed to forward message', 'error');
    } finally {
      setForwardingMsg(false);
    }
  };

  // === Batch 5: Compute disappearing fields for a new message ===
  // Returns the extra fields to spread into msgData (or empty object if not applicable).
  // IMPORTANT: pure computation only — no state updates here to avoid re-render during send.
  const getDisappearingFields = (convId: string): Record<string, unknown> => {
    try {
      const timer = disappearingPerMessage || conversations.find(c => c.id === convId)?.disappearingTimer;
      if (timer && timer > 0) {
        return {
          disappearing: true,
          disappearingDuration: timer,
          expiresAt: Timestamp.fromMillis(Date.now() + timer),
        };
      }
    } catch (err) {
      console.error('[Disappearing] Error computing fields:', err);
    }
    return {};
  };

  // === Batch 2: Pin/Unpin Message ===
  const togglePinMessage = async (msg: Message) => {
    if (!selectedConvId) return;
    try {
      const newPinned = !msg.pinned;
      await updateDoc(doc(db, 'conversations', selectedConvId, 'messages', msg.id), { pinned: newPinned });
      showNotif(newPinned ? 'Message pinned' : 'Message unpinned', 'info');
    } catch (err) {
      console.error('Failed to pin message:', err);
      showNotif('Failed to pin message', 'error');
    }
  };

  // === Batch 2: Star/Unstar Message ===
  const toggleStarMessage = async (msg: Message) => {
    if (!selectedConvId) return;
    try {
      const newStarred = !msg.starred;
      await updateDoc(doc(db, 'conversations', selectedConvId, 'messages', msg.id), { starred: newStarred });
      showNotif(newStarred ? 'Message starred' : 'Message unstarred', 'info');
    } catch (err) {
      console.error('Failed to star message:', err);
      showNotif('Failed to star message', 'error');
    }
  };

  // === Batch 2: Export Chat ===
  const exportChat = () => {
    if (!messages.length) {
      showNotif('No messages to export', 'info');
      return;
    }
    const activeConv = selectedConvId ? conversations.find(c => c.id === selectedConvId) : null;
    const chatName = activeConv?.isGroup ? activeConv.groupName : (selectedUser?.name || 'Chat');
    const lines = messages
      .filter(m => !m.deleted)
      .map(m => {
        const sender = m.senderId === user?.uid ? 'You' : (selectedUser?.name || m.senderId);
        const time = m.time || '';
        let content = m.text || '';
        if (m.image) content = content ? `[Photo] ${content}` : '[Photo]';
        if (m.voiceMessage) content = `[Voice message ${m.voiceMessage.duration}s]`;
        if (m.callEvent) content = `[${m.callEvent.callType} call - ${m.callEvent.type}${m.callEvent.duration ? ` ${m.callEvent.duration}s` : ''}]`;
        if (m.forwarded) content = `[Forwarded] ${content}`;
        if (m.pinned) content = `📌 ${content}`;
        if (m.starred) content = `⭐ ${content}`;
        return `[${time}] ${sender}: ${content}`;
      });
    const header = `EthniZity Chat Export — ${chatName}\nExported: ${new Date().toLocaleString()}\nMessages: ${lines.length}\n${'─'.repeat(40)}\n`;
    const blob = new Blob([header + lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ethnizity-chat-${chatName?.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showNotif('Chat exported', 'success');
  };

  const handleMessageInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    if (!selectedUser) return;
    if (e.target.value.trim()) {
      setTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(false);
      }, MESSAGE_CONFIG.TYPING_DEBOUNCE_MS);
    } else {
      setTypingStatus(false);
    }
  };

  // Get typing users
  const selectedConversation = selectedConvId
    ? conversations.find((c) => c.id === selectedConvId)
    : conversations.find(
        (c) =>
          c.participants.includes(selectedUser?.id || '') &&
          c.participants.includes(user?.uid || '')
      );
  const isOtherUserTyping = selectedConversation?.typing
    ? Object.entries(selectedConversation.typing).some(
        ([uid, typing]) => uid !== user?.uid && typing
      )
    : false;

  const filteredUsers = users.filter(
    (u) => u.id !== user?.uid && u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ===== RENDER =====

  // Filter conversations based on activeFilter
  const filteredConversations = useMemo(() => {
    let result = conversations.filter((conv) => {
      // Hide group conversations if group messaging is disabled
      if (conv.isGroup && !groupMessagingEnabled) return false;

      // Filter out archived conversations when not viewing archived tab
      if (conv.archived && activeFilter !== 'archived') return false;

      // Filter out conversations with blocked users (1:1 only)
      if (!conv.isGroup && blockedUsers.size > 0) {
        const otherParticipant = conv.participants.find((p) => p !== user?.uid);
        if (otherParticipant && blockedUsers.has(otherParticipant)) return false;
      }

      // Group conversations: search by group name
      if (conv.isGroup) {
        return (conv.groupName || 'Group').toLowerCase().includes(searchTerm.toLowerCase());
      }

      // 1:1 conversations: search by other user's name
      const otherParticipant = conv.participants.find((p) => p !== user?.uid);
      const otherUser = users.find((u) => u.id === otherParticipant);
      if (!otherUser) return false;
      return otherUser.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (activeFilter === 'unread') {
      result = result.filter((conv) => (conv.unreadCount || 0) > 0 && conv.lastMessageSenderId !== user?.uid);
    } else if (activeFilter === 'connects') {
      // Show only group conversations
      result = result.filter((conv) => conv.isGroup === true);
    } else if (activeFilter === 'archived') {
      result = result.filter((conv) => conv.archived === true);
    }

    return result;
  }, [conversations, searchTerm, activeFilter, user?.uid, users, groupMessagingEnabled, blockedUsers]);

  // === Conversation list panel (reused in both mobile and desktop) ===
  const conversationListPanel = (
    <div className="h-full flex flex-col relative overflow-hidden" style={{ backgroundColor: 'var(--aurora-surface)' }}>
      {/* Header - purple gradient on mobile + desktop dark, light purple on desktop light */}
      <div className="px-4 pt-3 pb-2" style={{ background: 'var(--msg-header-bg, linear-gradient(to right, #7e22ce, #7c3aed, #4f46e5))' }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-wide" style={{ color: 'var(--msg-header-text, #ffffff)' }}>Messages</h1>
          <div className="relative">
            <button
              onClick={() => setShowPenMenu(!showPenMenu)}
              className="p-1.5 rounded-full transition-colors"
              style={{ color: 'var(--msg-header-text, #ffffff)' }}
              aria-label="New message or group"
            >
              <Edit3 size={20} />
            </button>
            {/* Pen dropdown menu */}
            {showPenMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPenMenu(false)} onTouchStart={() => setShowPenMenu(false)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} />
                <div
                  className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg overflow-hidden z-50"
                  style={{ backgroundColor: 'var(--aurora-surface)', border: '1px solid var(--aurora-border)' }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowPenMenu(false); setShowNewMsgPicker(true); }}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--msg-hover-bg)] transition-colors"
                  >
                    <MessageSquare size={18} style={{ color: 'var(--msg-icon)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--msg-text)' }}>New Message</span>
                  </button>
                  {groupMessagingEnabled && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowPenMenu(false); setShowGroupCreator(true); setGroupName(''); setSelectedGroupMembers([]); setGroupSearchTerm(''); }}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--msg-hover-bg)] transition-colors"
                      style={{ borderTop: '1px solid #F0F2F5' }}
                    >
                      <Users size={18} style={{ color: 'var(--msg-icon)' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--msg-text)' }}>Create Group</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-muted" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-aurora-surface border border-aurora-border rounded-full text-base text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-4 py-2 flex gap-1.5 overflow-x-auto border-b border-aurora-border bg-aurora-surface/95 backdrop-blur-md">
        {(['all', 'unread', 'connects', 'archived'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
              activeFilter === filter
                ? 'bg-aurora-indigo text-white border-aurora-indigo'
                : 'bg-aurora-surface border-aurora-border text-aurora-text-muted hover:text-aurora-text-secondary hover:border-aurora-text-muted/30'
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Conversation list - always visible and scrollable */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <SkeletonConversation key={i} />
            ))}
          </>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((conv) => {
            // Group conversation
            if (conv.isGroup) {
              const isSelected = selectedConvId === conv.id;
              const hasUnread = (conv.unreadCount || 0) > 0 && conv.lastMessageSenderId !== user?.uid;
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConvId(conv.id);
                    setSelectedUser(null);
                    setViewState('room');
                  }}
                  className="w-full text-left transition-colors"
                  style={{ backgroundColor: isSelected ? 'var(--msg-divider)' : undefined }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--msg-hover-bg)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = ''; }}
                >
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-[45px] h-[45px] rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>
                      <Users size={22} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0 border-b py-1" style={{ borderColor: 'var(--msg-divider)' }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-[16px]" style={{ color: 'var(--msg-text)' }}>{conv.groupName || 'Group'}</span>
                          {conv.notificationsMuted && <BellOff size={14} className="text-aurora-text-muted shrink-0" />}
                        </div>
                        {conv.lastMessageTime && (
                          <span className="text-xs flex-shrink-0 ml-2" style={{ color: hasUnread ? '#6366F1' : 'var(--msg-secondary)' }}>
                            {getRelativeTime(conv.lastMessageTime)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] truncate flex-1" style={{ color: 'var(--msg-secondary)' }}>
                          {conv.lastMessage || 'No messages'}
                        </div>
                        {hasUnread && (
                          <span className="ml-2 min-w-[20px] h-5 flex items-center justify-center rounded-full text-white text-xs font-bold px-1.5 flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            }
            // 1:1 conversation
            const otherParticipant = conv.participants.find((p) => p !== user?.uid);
            const otherUser = users.find((u) => u.id === otherParticipant);
            if (!otherUser) return null;
            const isTyping = conv.typing && Object.entries(conv.typing).some(([uid, typing]) => uid !== user?.uid && typing);
            const hasUnread = (conv.unreadCount || 0) > 0 && conv.lastMessageSenderId !== user?.uid;
            const isSelected = selectedUser?.id === otherUser.id;
            return (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedUser(otherUser);
                  setSelectedConvId(conv.id);
                  setViewState('room');
                }}
                className="w-full text-left transition-colors"
                style={{ backgroundColor: isSelected ? 'var(--msg-divider)' : undefined }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--msg-hover-bg)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = ''; }}
              >
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <ChatAvatar user={otherUser} size="lg" showOnlineStatus={true} />
                  <div className="flex-1 min-w-0 border-b py-1" style={{ borderColor: 'var(--msg-divider)' }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-[16px]" style={{ color: 'var(--msg-text)' }}>{otherUser.name}</span>
                        {conv.notificationsMuted && <BellOff size={14} className="text-aurora-text-muted shrink-0" />}
                      </div>
                      {conv.lastMessageTime && (
                        <span className="text-xs flex-shrink-0 ml-2" style={{ color: hasUnread ? '#6366F1' : 'var(--msg-secondary)' }}>
                          {getRelativeTime(conv.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] truncate flex-1" style={{ color: isTyping ? '#6366F1' : 'var(--msg-secondary)' }}>
                        {isTyping ? (
                          <TypingIndicator />
                        ) : (
                          <span className="flex items-center gap-1">
                            {conv.lastMessageSenderId === user?.uid && (
                              conv.lastMessageRead
                                ? <CheckCheck size={14} className="flex-shrink-0" style={{ color: '#53BDEB' }} />
                                : <Check size={14} className="flex-shrink-0" style={{ color: '#B0B6B9' }} />
                            )}
                            {conv.lastMessage || 'No messages'}
                          </span>
                        )}
                      </div>
                      {hasUnread && (
                        <span className="ml-2 min-w-[20px] h-5 flex items-center justify-center rounded-full text-white text-xs font-bold px-1.5 flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        ) : activeFilter === 'connects' ? (
          <div className="p-8 text-center" style={{ color: 'var(--msg-secondary)' }}>
            <MessageSquare size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No group chats yet</p>
            <p className="text-xs mt-1">Create a group to start chatting with multiple people</p>
          </div>
        ) : activeFilter === 'archived' ? (
          <div className="p-8 text-center" style={{ color: 'var(--msg-secondary)' }}>
            <Archive size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No archived conversations</p>
            <p className="text-xs mt-1">Archive conversations to hide them from your main list</p>
          </div>
        ) : (
          <div className="p-8 text-center" style={{ color: 'var(--msg-secondary)' }}>
            <MessageSquare size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">{searchTerm ? 'No conversations found' : 'No conversations yet'}</p>
          </div>
        )}
      </div>

      {/* New Message picker modal */}
      {showNewMsgPicker && (
        <div className="absolute inset-0 z-50 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--aurora-surface)' }}>
          <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid #F0F2F5' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowNewMsgPicker(false)} className="p-1">
                  <ArrowLeft size={20} style={{ color: 'var(--msg-icon)' }} />
                </button>
                <h2 className="text-lg font-bold" style={{ color: 'var(--msg-text)' }}>New Message</h2>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
              <Search size={16} style={{ color: 'var(--msg-secondary)' }} className="flex-shrink-0" />
              <input
                type="text"
                placeholder="Search people"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 py-1 bg-transparent outline-none text-base placeholder-gray-400"
                style={{ color: 'var(--msg-text)' }}
                autoFocus
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="p-0.5">
                  <X size={14} style={{ color: 'var(--msg-secondary)' }} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedUser(u);
                    setViewState('room');
                    setShowNewMsgPicker(false);
                    setSearchTerm('');
                  }}
                  className="w-full text-left transition-colors hover:bg-[var(--msg-hover-bg)]"
                >
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <ChatAvatar user={u} size="lg" showOnlineStatus={true} />
                    <div className="flex-1 min-w-0 border-b py-1" style={{ borderColor: 'var(--msg-divider)' }}>
                      <span className="font-medium text-[16px]" style={{ color: 'var(--msg-text)' }}>{u.name}</span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center" style={{ color: 'var(--msg-secondary)' }}>
                <p className="text-sm">{searchTerm ? 'No users found' : 'No community members available'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group Creator overlay */}
      {showGroupCreator && (
        <div className="absolute inset-0 z-50 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--aurora-surface)' }}>
          <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid #F0F2F5' }}>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => { setShowGroupCreator(false); setGroupName(''); setSelectedGroupMembers([]); setGroupSearchTerm(''); }} className="p-1">
                <ArrowLeft size={20} style={{ color: 'var(--msg-icon)' }} />
              </button>
              <h2 className="text-lg font-bold" style={{ color: 'var(--msg-text)' }}>Create Group</h2>
            </div>
            {/* Group name input */}
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
              <Users size={16} style={{ color: 'var(--msg-secondary)' }} className="flex-shrink-0" />
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="flex-1 py-1 bg-transparent outline-none text-base placeholder-gray-400"
                style={{ color: 'var(--msg-text)' }}
                autoFocus
              />
            </div>
            {/* Selected members chips */}
            {selectedGroupMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedGroupMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: 'var(--msg-own-bubble-hover)', color: '#4F46E5' }}
                  >
                    {m.name}
                    <button onClick={() => toggleGroupMember(m)} className="hover:opacity-70">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Search members */}
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
              <Search size={16} style={{ color: 'var(--msg-secondary)' }} className="flex-shrink-0" />
              <input
                type="text"
                placeholder="Search people to add"
                value={groupSearchTerm}
                onChange={(e) => setGroupSearchTerm(e.target.value)}
                className="flex-1 py-1 bg-transparent outline-none text-base placeholder-gray-400"
                style={{ color: 'var(--msg-text)' }}
              />
            </div>
          </div>
          {/* Members list */}
          <div className="flex-1 overflow-y-auto">
            {users.filter((u) => u.id !== user?.uid && u.name.toLowerCase().includes(groupSearchTerm.toLowerCase())).map((u) => {
              const isAdded = selectedGroupMembers.find((m) => m.id === u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggleGroupMember(u)}
                  className="w-full text-left transition-colors hover:bg-[var(--msg-hover-bg)]"
                  style={{ backgroundColor: isAdded ? 'var(--msg-own-bubble-hover)' : undefined }}
                >
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <ChatAvatar user={u} size="lg" showOnlineStatus={true} />
                    <div className="flex-1 min-w-0 border-b py-1" style={{ borderColor: 'var(--msg-divider)' }}>
                      <span className="font-medium text-[16px]" style={{ color: 'var(--msg-text)' }}>{u.name}</span>
                    </div>
                    <div className="flex-shrink-0">
                      {isAdded ? (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#6366F1' }}>
                          <Check size={14} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2" style={{ borderColor: 'var(--aurora-border)' }} />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {/* Create button */}
          <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #F0F2F5' }}>
            <button
              onClick={createGroup}
              disabled={!groupName.trim() || selectedGroupMembers.length === 0}
              className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#6366F1' }}
            >
              Create Group{selectedGroupMembers.length > 0 ? ` (${selectedGroupMembers.length} member${selectedGroupMembers.length > 1 ? 's' : ''})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // === Chat room panel - handle both 1:1 and group conversations ===
  const activeGroupConv = selectedConvId ? conversations.find((c) => c.id === selectedConvId && c.isGroup) : null;

  const chatRoomPanel = (selectedUser || activeGroupConv) ? (
    <div
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--aurora-surface-variant)' }}
    >
      {/* Chat header */}
      <div className="px-2 py-2 flex items-center gap-2 bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-600">
        {/* Back button - only show on mobile */}
        <button
          onClick={() => {
            setViewState('list');
            setSelectedUser(null);
            setSelectedConvId(null);
            setShowGroupSettings(false);
          }}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors md:hidden"
          aria-label="Back to conversations list"
        >
          <ArrowLeft size={22} className="text-white" />
        </button>
        {activeGroupConv ? (
          <>
            <button
              onClick={() => { setShowGroupSettings(true); setEditGroupNameValue(activeGroupConv.groupName || ''); }}
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-80 transition"
              style={{ backgroundColor: '#818CF8' }}
            >
              <Users size={18} className="text-white" />
            </button>
            <button
              onClick={() => { setShowGroupSettings(true); setEditGroupNameValue(activeGroupConv.groupName || ''); }}
              className="flex-1 min-w-0 text-left hover:opacity-80 transition"
            >
              <h2 className="font-medium text-white text-[15px] leading-tight">{activeGroupConv.groupName || 'Group'}</h2>
              <div className="text-xs leading-tight truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {activeGroupConv.participants.length} members
              </div>
            </button>
          </>
        ) : selectedUser ? (
          <>
            <ChatAvatar user={selectedUser} size="sm" showOnlineStatus={onlineLastSeenEnabled} />
            <div className="flex-1 min-w-0">
              <h2 className="font-medium text-white text-[15px] leading-tight">{selectedUser.name}</h2>
              {onlineLastSeenEnabled && (
              <div className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {isOtherUserTyping ? 'typing...' : getPresenceText(selectedUser)}
              </div>
              )}
            </div>
          </>
        ) : null}
        <div className="flex gap-1">
          {/* Audio call button — 1:1 */}
          {oneToOneCallsEnabled && selectedUser && !activeGroupConv && (
            <button
              onClick={() => initiateCall('audio')}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Audio call"
              disabled={callState.status !== 'idle'}
            >
              <Phone size={18} className="text-white" />
            </button>
          )}
          {/* Video call button — 1:1 */}
          {oneToOneCallsEnabled && selectedUser && !activeGroupConv && (
            <button
              onClick={() => initiateCall('video')}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Video call"
              disabled={callState.status !== 'idle'}
            >
              <Video size={18} className="text-white" />
            </button>
          )}
          {/* Group call buttons */}
          {groupCallsEnabled && activeGroupConv && (
            <>
              <button
                onClick={() => initiateGroupCall('audio')}
                onTouchStart={(e) => { e.preventDefault(); initiateGroupCall('audio'); }}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Group audio call"
                disabled={groupCallState.status !== 'idle'}
                style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              >
                <Phone size={18} className="text-white" />
              </button>
              <button
                onClick={() => initiateGroupCall('video')}
                onTouchStart={(e) => { e.preventDefault(); initiateGroupCall('video'); }}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Group video call"
                disabled={groupCallState.status !== 'idle'}
                style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              >
                <Video size={18} className="text-white" />
              </button>
            </>
          )}
          {searchEnabled && (
          <button
            onClick={() => setChatSearch(!chatSearch)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Search messages"
          >
            <SearchIcon size={18} className="text-white" />
          </button>
          )}
          <div className="relative" ref={chatMenuRef}>
            <button
              onClick={() => setShowChatMenu(!showChatMenu)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <MoreVertical size={18} className="text-white" />
            </button>
            <ClickOutsideOverlay isOpen={showChatMenu} onClose={() => setShowChatMenu(false)} />
            {showChatMenu && (
              <>
              <div className="absolute top-10 right-0 bg-white dark:bg-[var(--aurora-surface)] rounded-lg shadow-xl z-50 min-w-[180px] py-1 overflow-hidden">
                {activeGroupConv && (
                  <button
                    onClick={() => {
                      setShowGroupSettings(true);
                      setEditGroupNameValue(activeGroupConv.groupName || '');
                      setShowChatMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm"
                    style={{ color: 'var(--msg-text)' }}
                  >
                    <Settings size={16} style={{ color: 'var(--msg-secondary)' }} /> Group Info
                  </button>
                )}
                {wallpaperEnabled && (
                <button
                  onClick={() => {
                    setShowWallpaperPicker(true);
                    setShowChatMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm"
                  style={{ color: 'var(--msg-text)' }}
                >
                  <Palette size={16} style={{ color: 'var(--msg-secondary)' }} /> Wallpaper
                </button>
                )}
                <button
                  onClick={() => {
                    setCompactMode(!compactMode);
                    setShowChatMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm"
                  style={{ color: 'var(--msg-text)' }}
                >
                  {compactMode ? <Maximize2 size={16} style={{ color: 'var(--msg-secondary)' }} /> : <Minimize2 size={16} style={{ color: 'var(--msg-secondary)' }} />}
                  {compactMode ? 'Comfortable' : 'Compact'}
                </button>
                {/* Mute/Unmute option */}
                {selectedConvId && (
                  <button
                    onClick={() => {
                      const conv = conversations.find(c => c.id === selectedConvId);
                      if (conv) toggleMuteConversation(conv.id, !!conv.notificationsMuted);
                      setShowChatMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm"
                    style={{ color: 'var(--msg-text)' }}
                  >
                    {((conversations.find(c => c.id === selectedConvId)?.notificationsMuted) ? <Bell size={16} /> : <BellOff size={16} />)}
                    {(conversations.find(c => c.id === selectedConvId)?.notificationsMuted) ? 'Unmute' : 'Mute'}
                  </button>
                )}
                {/* Archive/Unarchive option */}
                {selectedConvId && (
                  <button
                    onClick={() => {
                      const conv = conversations.find(c => c.id === selectedConvId);
                      if (conv) toggleArchiveConversation(conv.id, !!conv.archived);
                      setShowChatMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm"
                    style={{ color: 'var(--msg-text)' }}
                  >
                    {(conversations.find(c => c.id === selectedConvId)?.archived) ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    {(conversations.find(c => c.id === selectedConvId)?.archived) ? 'Unarchive' : 'Archive'}
                  </button>
                )}
                {/* Starred Messages view */}
                {starredMessagesEnabled && (
                <button
                  onClick={() => {
                    setShowStarredView(true);
                    setShowChatMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm"
                  style={{ color: 'var(--msg-text)' }}
                >
                  <Star size={16} className="text-amber-500" /> Starred Messages
                </button>
                )}
                {/* Pinned Messages view */}
                {pinnedMessagesEnabled && (
                <button
                  onClick={() => {
                    setShowPinnedView(true);
                    setShowChatMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm"
                  style={{ color: 'var(--msg-text)' }}
                >
                  <Pin size={16} className="text-amber-600" /> Pinned Messages
                </button>
                )}
                {/* Disappearing Messages */}
                {disappearingMessagesEnabled && selectedConvId && (
                  <button
                    onClick={() => {
                      setShowDisappearingMenu(true);
                      setShowChatMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm"
                    style={{ color: 'var(--msg-text)' }}
                  >
                    <Timer size={16} className="text-emerald-500" />
                    <span className="flex-1">Disappearing Messages</span>
                    {(() => {
                      const conv = conversations.find(c => c.id === selectedConvId);
                      return conv?.disappearingTimer ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
                          {formatDisappearingTimer(conv.disappearingTimer)}
                        </span>
                      ) : null;
                    })()}
                  </button>
                )}
                {/* Export Chat */}
                <button
                  onClick={() => {
                    exportChat();
                    setShowChatMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm"
                  style={{ color: 'var(--msg-text)' }}
                >
                  <FileText size={16} style={{ color: 'var(--msg-secondary)' }} /> Export Chat
                </button>
                {/* Block User option - only for 1:1 chats */}
                {selectedUser && (
                  <button
                    onClick={() => {
                      openBlockConfirm(selectedUser.id, selectedUser.name);
                      setShowChatMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-red-50 transition flex items-center gap-3 text-sm text-red-600"
                  >
                    <Ban size={16} /> Block User
                  </button>
                )}
              </div>
              </>
            )}
          </div>
        </div>
      </div>

      {chatSearch && (
        <MessageSearchBar
          messages={messages}
          onNavigate={(idx) => {
            if (idx >= 0 && messagesContainerRef.current) {
              const elem = messagesContainerRef.current.children[idx] as HTMLElement;
              elem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          onClose={() => setChatSearch(false)}
        />
      )}

      {/* Active group call banner — shown when there's an active call in this group conversation */}
      {activeGroupCallId && activeGroupConv && groupCallState.status === 'idle' && (
        <div
          className="flex items-center gap-2 px-3 py-2 border-b cursor-pointer"
          style={{
            background: 'linear-gradient(90deg, #7e22ce15, #4f46e515)',
            borderColor: 'rgba(124, 58, 206, 0.2)',
            WebkitTapHighlightColor: 'transparent',
          }}
          onClick={() => {
            if (!user?.uid) return;
            groupCallManagerRef.current.joinCall(
              activeGroupCallId,
              user.uid,
              userProfile?.name || userProfile?.preferredName || user.displayName || 'User',
            ).catch((err: Error) => showNotif(err.message || 'Failed to join call', 'error'));
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            if (!user?.uid) return;
            groupCallManagerRef.current.joinCall(
              activeGroupCallId,
              user.uid,
              userProfile?.name || userProfile?.preferredName || user.displayName || 'User',
            ).catch((err: Error) => showNotif(err.message || 'Failed to join call', 'error'));
          }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center animate-pulse" style={{ background: '#7e22ce30' }}>
            <Phone size={14} className="text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-semibold text-purple-700 dark:text-purple-400">Group call in progress</span>
            <span className="text-[11px] text-purple-500 dark:text-purple-500 ml-2">Tap to join</span>
          </div>
          <div className="px-3 py-1 rounded-full text-[11px] font-semibold text-white" style={{ background: '#7e22ce' }}>
            Join
          </div>
        </div>
      )}

      {/* Disappearing messages active banner */}
      {selectedConvId && conversations.find(c => c.id === selectedConvId)?.disappearingTimer ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800/30">
          <Timer size={13} className="text-emerald-600" />
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
            Disappearing messages: {DISAPPEARING_TIMER_OPTIONS.find(o => o.value === conversations.find(c => c.id === selectedConvId)?.disappearingTimer)?.label || 'On'}
          </span>
        </div>
      ) : null}

      {/* Pinned messages banner */}
      {pinnedMessagesEnabled && pinnedMessages.length > 0 && showPinnedBanner && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/30" style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={() => {
          const lastPinned = pinnedMessages[pinnedMessages.length - 1];
          const idx = messages.findIndex(m => m.id === lastPinned.id);
          if (idx >= 0 && messagesContainerRef.current) {
            const elem = messagesContainerRef.current.children[idx] as HTMLElement;
            elem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }} onTouchStart={() => {
          const lastPinned = pinnedMessages[pinnedMessages.length - 1];
          const idx = messages.findIndex(m => m.id === lastPinned.id);
          if (idx >= 0 && messagesContainerRef.current) {
            const elem = messagesContainerRef.current.children[idx] as HTMLElement;
            elem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}>
          <Pin size={14} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">{pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}</span>
            <p className="text-xs truncate" style={{ color: 'var(--msg-secondary)' }}>{pinnedMessages[pinnedMessages.length - 1]?.text || '📷 Photo'}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setShowPinnedBanner(false); }} onTouchStart={(e) => { e.stopPropagation(); setShowPinnedBanner(false); }} className="p-1 rounded-full hover:bg-amber-200/50">
            <X size={14} className="text-amber-600" />
          </button>
        </div>
      )}

      {/* Starred messages overlay */}
      {showStarredView && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--aurora-surface)' }}>
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-600">
            <button onClick={() => setShowStarredView(false)} className="p-1 rounded-full hover:bg-white/10" onTouchStart={() => setShowStarredView(false)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h3 className="text-white font-semibold">Starred Messages</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.filter(m => m.starred && !m.deleted).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Star size={40} className="text-amber-400 mb-3" />
                <p className="font-medium" style={{ color: 'var(--msg-text)' }}>No starred messages</p>
                <p className="text-sm mt-1" style={{ color: 'var(--msg-secondary)' }}>Long press a message and tap Star to save it here</p>
              </div>
            ) : messages.filter(m => m.starred && !m.deleted).map(msg => {
              const handleStarredClick = () => {
                setShowStarredView(false);
                const idx = messages.findIndex(m => m.id === msg.id);
                if (idx >= 0 && messagesContainerRef.current) {
                  setTimeout(() => {
                    const elem = messagesContainerRef.current?.children[idx] as HTMLElement;
                    elem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }
              };
              return (
              <div key={msg.id} className="rounded-lg p-3 border border-[var(--aurora-border)] bg-white dark:bg-[var(--aurora-surface-variant)]" onClick={handleStarredClick} onTouchStart={handleStarredClick} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: '#6366F1' }}>
                    {msg.senderId === user?.uid ? 'You' : (users.find(u => u.id === msg.senderId)?.name || 'Unknown')}
                  </span>
                  <div className="flex items-center gap-1">
                    <Star size={11} className="text-amber-500" fill="#f59e0b" />
                    <span className="text-[10px]" style={{ color: 'var(--msg-secondary)' }}>{msg.time}</span>
                  </div>
                </div>
                {msg.image && <div className="text-xs mb-1" style={{ color: 'var(--msg-secondary)' }}>📷 Photo</div>}
                {msg.text && <p className="text-sm break-words" style={{ color: 'var(--msg-text)' }}>{msg.text.slice(0, 200)}{msg.text.length > 200 ? '...' : ''}</p>}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pinned messages overlay */}
      {showPinnedView && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--aurora-surface)' }}>
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-600">
            <button onClick={() => setShowPinnedView(false)} className="p-1 rounded-full hover:bg-white/10" onTouchStart={() => setShowPinnedView(false)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h3 className="text-white font-semibold">Pinned Messages</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.filter(m => m.pinned && !m.deleted).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Pin size={40} className="text-amber-600 mb-3" />
                <p className="font-medium" style={{ color: 'var(--msg-text)' }}>No pinned messages</p>
                <p className="text-sm mt-1" style={{ color: 'var(--msg-secondary)' }}>Long press a message and tap Pin to save it here</p>
              </div>
            ) : messages.filter(m => m.pinned && !m.deleted).map(msg => {
              const handlePinnedClick = () => {
                setShowPinnedView(false);
                const idx = messages.findIndex(m => m.id === msg.id);
                if (idx >= 0 && messagesContainerRef.current) {
                  setTimeout(() => {
                    const elem = messagesContainerRef.current?.children[idx] as HTMLElement;
                    elem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }
              };
              const handleUnpin = (e: React.MouseEvent | React.TouchEvent) => {
                e.stopPropagation();
                e.preventDefault();
                togglePinMessage(msg);
              };
              return (
              <div key={msg.id} className="rounded-lg p-3 border border-[var(--aurora-border)] bg-white dark:bg-[var(--aurora-surface-variant)]" onClick={handlePinnedClick} onTouchStart={handlePinnedClick} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: '#6366F1' }}>
                    {msg.senderId === user?.uid ? 'You' : (users.find(u => u.id === msg.senderId)?.name || 'Unknown')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]" style={{ color: 'var(--msg-secondary)' }}>{msg.time}</span>
                    <button
                      onClick={handleUnpin}
                      onTouchStart={handleUnpin}
                      className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                      aria-label="Unpin message"
                    >
                      <PinOff size={14} className="text-red-500" />
                    </button>
                  </div>
                </div>
                {msg.image && <div className="text-xs mb-1" style={{ color: 'var(--msg-secondary)' }}>📷 Photo</div>}
                {msg.text && <p className="text-sm break-words" style={{ color: 'var(--msg-text)' }}>{msg.text.slice(0, 200)}{msg.text.length > 200 ? '...' : ''}</p>}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Disappearing messages settings overlay */}
      {showDisappearingMenu && selectedConvId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDisappearingMenu(false)} onTouchStart={() => setShowDisappearingMenu(false)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
          <div className="bg-white dark:bg-[var(--aurora-surface)] rounded-xl shadow-xl w-[90%] max-w-sm overflow-hidden" onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <div className="px-4 py-3 bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-600 flex items-center gap-3">
              <Timer size={18} className="text-white" />
              <h3 className="text-white font-semibold">Disappearing Messages</h3>
            </div>
            <div className="p-4">
              <p className="text-xs mb-3" style={{ color: 'var(--msg-secondary)' }}>
                New messages will be automatically deleted after the selected time.
              </p>
              {/* Off option */}
              <button
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'conversations', selectedConvId!), { disappearingTimer: null });
                    showNotif('Disappearing messages turned off', 'info');
                    setShowDisappearingMenu(false);
                  } catch (err) {
                    console.error('Error updating disappearing timer:', err);
                    showNotif('Failed to update setting', 'error');
                  }
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm rounded-lg mb-1"
                style={{ color: 'var(--msg-text)' }}
              >
                <TimerOff size={16} className="text-gray-400" />
                <span className="flex-1">Off</span>
                {!conversations.find(c => c.id === selectedConvId)?.disappearingTimer && (
                  <Check size={16} className="text-emerald-500" />
                )}
              </button>
              {/* Timer options */}
              {DISAPPEARING_TIMER_OPTIONS.map(opt => {
                const activeTimer = conversations.find(c => c.id === selectedConvId)?.disappearingTimer;
                return (
                  <button
                    key={opt.value}
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'conversations', selectedConvId!), { disappearingTimer: opt.value });
                        showNotif(`Disappearing messages set to ${opt.label}`, 'success');
                        setShowDisappearingMenu(false);
                      } catch (err) {
                        console.error('Error updating disappearing timer:', err);
                        showNotif('Failed to update setting', 'error');
                      }
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 text-sm rounded-lg mb-1"
                    style={{ color: 'var(--msg-text)' }}
                  >
                    <Timer size={16} className="text-emerald-500" />
                    <span className="flex-1">{opt.label}</span>
                    {activeTimer === opt.value && (
                      <Check size={16} className="text-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Forward message picker modal */}
      {showForwardPicker && forwardingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowForwardPicker(false); setForwardingMessage(null); }} onTouchStart={() => { setShowForwardPicker(false); setForwardingMessage(null); }} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
          <div className="bg-white dark:bg-[var(--aurora-surface)] rounded-xl shadow-xl w-[90%] max-w-md max-h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-[var(--aurora-border)] flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: 'var(--msg-text)' }}>Forward to...</h3>
              <button onClick={() => { setShowForwardPicker(false); setForwardingMessage(null); }} className="p-1 rounded-full hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="px-3 py-2 border-b border-[var(--aurora-border)] bg-gray-50 dark:bg-[var(--aurora-surface-variant)]">
              <p className="text-xs truncate" style={{ color: 'var(--msg-secondary)' }}>
                <Forward size={11} className="inline mr-1" />
                {forwardingMessage.text ? forwardingMessage.text.slice(0, 60) : '📷 Photo'}
                {forwardingMessage.text && forwardingMessage.text.length > 60 ? '...' : ''}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.filter(c => c.id !== selectedConvId).map(conv => {
                const otherUser = !conv.isGroup ? users.find(u => conv.participants.includes(u.id) && u.id !== user?.uid) : null;
                const displayName = conv.isGroup ? conv.groupName : (otherUser?.name || 'Unknown');
                return (
                  <button
                    key={conv.id}
                    onClick={() => forwardMessageToConversation(conv.id)}
                    disabled={forwardingMsg}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition flex items-center gap-3 border-b border-[var(--aurora-border)]/50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--aurora-primary)] to-[var(--aurora-primary-dark)] flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {conv.isGroup ? <Users size={16} /> : (displayName?.charAt(0).toUpperCase() || '?')}
                    </div>
                    <span className="font-medium text-sm truncate" style={{ color: 'var(--msg-text)' }}>{displayName}</span>
                  </button>
                );
              })}
              {conversations.filter(c => c.id !== selectedConvId).length === 0 && (
                <div className="p-6 text-center text-sm" style={{ color: 'var(--msg-secondary)' }}>No other conversations</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group Settings Panel - slides over the chat */}
      {showGroupSettings && activeGroupConv && (() => {
        const amAdmin = isGroupAdmin(activeGroupConv);
        const amCreator = activeGroupConv.groupCreatedBy === user?.uid;
        const admins = activeGroupConv.groupAdmins || (activeGroupConv.groupCreatedBy ? [activeGroupConv.groupCreatedBy] : []);
        const nonMemberUsers = users.filter(
          (u) => u.id !== user?.uid && !activeGroupConv.participants.includes(u.id) && u.name.toLowerCase().includes(addMemberSearchTerm.toLowerCase())
        );

        return (
          <div className="absolute inset-0 z-50 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--aurora-surface)' }}>
            {/* Header */}
            <div className="px-4 pt-3 pb-3 flex items-center gap-3 bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-600">
              <button
                onClick={() => { setShowGroupSettings(false); setEditingGroupName(false); setShowAddMemberPicker(false); setAddMemberSearchTerm(''); }}
                className="p-1 rounded-full hover:bg-white/10 transition"
              >
                <ArrowLeft size={20} className="text-white" />
              </button>
              <h2 className="text-base font-semibold text-white">Group Info</h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Group Name Section */}
              <div className="px-4 py-4" style={{ borderBottom: '8px solid #F0F2F5' }}>
                <div className="flex items-center justify-center mb-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#818CF8' }}>
                    <Users size={32} className="text-white" />
                  </div>
                </div>
                {editingGroupName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editGroupNameValue}
                      onChange={(e) => setEditGroupNameValue(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg text-base outline-none"
                      style={{ backgroundColor: 'var(--aurora-surface-variant)', color: 'var(--aurora-text)' }}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') updateGroupName(editGroupNameValue); }}
                    />
                    <button
                      onClick={() => updateGroupName(editGroupNameValue)}
                      className="p-2 rounded-full"
                      style={{ backgroundColor: '#6366F1' }}
                    >
                      <Check size={16} className="text-white" />
                    </button>
                    <button
                      onClick={() => setEditingGroupName(false)}
                      className="p-2 rounded-full"
                      style={{ backgroundColor: 'var(--aurora-surface-variant)' }}
                    >
                      <X size={16} style={{ color: 'var(--msg-secondary)' }} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-xl font-semibold text-center" style={{ color: 'var(--msg-text)' }}>
                      {activeGroupConv.groupName || 'Group'}
                    </h3>
                    {amAdmin && (
                      <button
                        onClick={() => { setEditingGroupName(true); setEditGroupNameValue(activeGroupConv.groupName || ''); }}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[var(--aurora-surface-variant)] transition"
                      >
                        <Edit3 size={16} style={{ color: 'var(--msg-secondary)' }} />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-center text-sm mt-1" style={{ color: 'var(--msg-secondary)' }}>
                  Group &middot; {activeGroupConv.participants.length} members
                </p>
              </div>

              {/* Members Section */}
              <div className="px-4 py-3" style={{ borderBottom: '8px solid #F0F2F5' }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold" style={{ color: '#4F46E5' }}>
                    {activeGroupConv.participants.length} Members
                  </h4>
                  {amAdmin && (
                    <button
                      onClick={() => setShowAddMemberPicker(!showAddMemberPicker)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition hover:opacity-80"
                      style={{ backgroundColor: 'var(--msg-own-bubble-hover)', color: '#4F46E5' }}
                    >
                      <UserPlus size={14} />
                      Add Member
                    </button>
                  )}
                </div>

                {/* Add Member Picker */}
                {showAddMemberPicker && amAdmin && (
                  <div className="mb-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--aurora-border)' }}>
                    <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
                      <Search size={16} style={{ color: 'var(--msg-secondary)' }} />
                      <input
                        type="text"
                        placeholder="Search people to add..."
                        value={addMemberSearchTerm}
                        onChange={(e) => setAddMemberSearchTerm(e.target.value)}
                        className="flex-1 py-1 bg-transparent outline-none text-base placeholder-gray-400"
                        style={{ color: 'var(--msg-text)' }}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {nonMemberUsers.length === 0 ? (
                        <div className="px-4 py-3 text-center text-sm" style={{ color: 'var(--msg-secondary)' }}>
                          No members to add
                        </div>
                      ) : (
                        nonMemberUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => addMemberToGroup(u)}
                            className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition"
                          >
                            <ChatAvatar user={u} size="sm" showOnlineStatus={false} />
                            <span className="flex-1 text-sm font-medium" style={{ color: 'var(--msg-text)' }}>{u.name}</span>
                            <UserPlus size={16} style={{ color: '#6366F1' }} />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Members List */}
                {activeGroupConv.participants.map((pid) => {
                  const memberUser = users.find((u) => u.id === pid);
                  const isCreator = pid === activeGroupConv.groupCreatedBy;
                  const isMemberAdmin = admins.includes(pid);
                  const isMe = pid === user?.uid;

                  return (
                    <div
                      key={pid}
                      className="flex items-center gap-3 py-2.5"
                      style={{ borderBottom: '1px solid #F0F2F5' }}
                    >
                      {memberUser ? (
                        <ChatAvatar user={memberUser} size="lg" showOnlineStatus={true} />
                      ) : (
                        <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
                          <Users size={18} style={{ color: 'var(--msg-secondary)' }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[15px] font-medium" style={{ color: 'var(--msg-text)' }}>
                            {isMe ? 'You' : memberUser?.name || pid.slice(0, 8)}
                          </span>
                          {isCreator && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: 'var(--aurora-surface-variant)', color: '#E65100' }}>
                              <Crown size={10} /> Creator
                            </span>
                          )}
                          {isMemberAdmin && !isCreator && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#E3F2FD', color: '#1565C0' }}>
                              <Shield size={10} /> Admin
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Admin actions */}
                      {!isMe && amAdmin && (
                        <div className="flex items-center gap-1">
                          {amCreator && (
                            <button
                              onClick={() => toggleAdmin(pid)}
                              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[var(--aurora-surface-variant)] transition"
                              title={isMemberAdmin ? 'Remove admin' : 'Make admin'}
                            >
                              <Shield size={16} style={{ color: isMemberAdmin ? '#1565C0' : '#B0B6B9' }} />
                            </button>
                          )}
                          {!isCreator && (
                            <button
                              onClick={() => removeMemberFromGroup(pid)}
                              className="p-1.5 rounded-full hover:bg-red-50 transition"
                              title="Remove from group"
                            >
                              <UserMinus size={16} style={{ color: '#E53935' }} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Admin info section */}
              <div className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <Shield size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--msg-secondary)' }} />
                  <p className="text-xs" style={{ color: 'var(--msg-secondary)' }}>
                    {amCreator
                      ? 'As the group creator, you can edit the group name, add/remove members, and promote members to admin. Admins can edit the group name and add/remove members.'
                      : amAdmin
                        ? 'As a group admin, you can edit the group name and add/remove members. Only the group creator can promote or demote admins.'
                        : 'Only group admins can edit the group name and manage members.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Messages area with WhatsApp wallpaper */}
      <div
        className="flex-1 overflow-y-auto px-3 sm:px-[5%] py-2"
        ref={messagesContainerRef}
        style={WALLPAPER_PRESETS[selectedWallpaper as keyof typeof WALLPAPER_PRESETS]?.style}
      >
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={32} className="animate-spin" style={{ color: '#6366F1' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="bg-white/80 rounded-lg px-6 py-4 shadow-sm">
              <MessageSquare size={40} className="mx-auto mb-2" style={{ color: '#B0B6B9' }} />
              <p className="text-sm" style={{ color: 'var(--msg-secondary)' }}>No messages yet. Say hello!</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isMine = msg.senderId === user?.uid;
              const prevMsg = messages[idx - 1];
              const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
              const showDateLabel = !prevMsg || getDateLabel(prevMsg.createdAt) !== getDateLabel(msg.createdAt);
              const isSearchMatch = chatSearchQuery && msg.text.toLowerCase().includes(chatSearchQuery.toLowerCase());
              const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId || showDateLabel;

              return (
                <div key={msg.id}>
                  {showDateLabel && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm" style={{ backgroundColor: 'var(--aurora-surface-variant)', color: 'var(--aurora-text-muted)' }}>
                        {getDateLabel(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${msg.senderId === 'system' ? 'justify-center' : isMine ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-2' : 'mt-0.5'}`}>
                    <div
                      className={`relative max-w-[85%] sm:max-w-[65%] ${isSearchMatch ? 'ring-2 ring-amber-400 rounded-lg' : ''}`}
                    >
                      {/* WhatsApp bubble tail */}
                      {isFirstInGroup && (
                        <div
                          className="absolute top-0"
                          style={{
                            [isMine ? 'right' : 'left']: '-6px',
                            width: 0,
                            height: 0,
                            borderTop: `8px solid ${isMine ? 'var(--msg-own-bubble)' : 'var(--aurora-surface)'}`,
                            [isMine ? 'borderLeft' : 'borderRight']: '8px solid transparent',
                          }}
                        />
                      )}
                      {(() => {
                        const hasImage = !!(msg.image && !msg.image.startsWith('{'));
                        const isImageOnly = hasImage && !msg.text;
                        const isImageWithText = hasImage && !!msg.text;
                        const roundedClass = isFirstInGroup
                          ? (isMine ? 'rounded-tl-lg rounded-tr-sm' : 'rounded-tr-lg rounded-tl-sm')
                          : 'rounded-t-lg';
                        return (
                          <div
                            className={`overflow-hidden ${roundedClass} rounded-b-lg shadow-sm cursor-pointer select-none`}
                            style={{
                              backgroundColor: msg.senderId === 'system' ? 'var(--aurora-surface-variant)' : isMine ? 'var(--msg-own-bubble)' : 'var(--aurora-surface)',
                              boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)',
                              WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                            }}
                            onContextMenu={(e) => { e.preventDefault(); setContextMenuMsg(msg); }}
                            onTouchStart={() => {
                              longPressTimerRef.current = setTimeout(() => setContextMenuMsg(msg), 500);
                            }}
                            onTouchEnd={() => {
                              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                            }}
                            onTouchMove={() => {
                              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                            }}
                          >
                            {/* Group sender name */}
                            {activeGroupConv && !isMine && msg.senderId !== 'system' && isFirstInGroup && (
                              <div className="text-[12px] font-semibold px-2.5 pt-1.5 mb-0.5" style={{ color: '#6366F1' }}>
                                {users.find((u) => u.id === msg.senderId)?.name || 'Unknown'}
                              </div>
                            )}
                            {msg.forwarded && (
                              <div className="px-2.5 pt-1 flex items-center gap-1" style={{ color: 'var(--msg-secondary)' }}>
                                <Forward size={11} /> <span className="text-[11px] italic">Forwarded</span>
                              </div>
                            )}
                            {msg.replyTo && (() => {
                              const rt = msg.replyTo!;
                              return (
                                <div className="mx-2 mt-1.5 mb-1 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: isMine ? 'rgba(0,0,0,0.06)' : 'rgba(99,102,241,0.08)', borderLeftColor: '#6366F1', borderLeftWidth: '3px', borderLeftStyle: 'solid' }}>
                                  <div className="text-[11px] font-semibold" style={{ color: '#6366F1' }}>
                                    {rt.senderId === user?.uid ? 'You' : (users.find(u => u.id === rt.senderId)?.name || 'Unknown')}
                                  </div>
                                  <div className="text-[12px] truncate" style={{ color: 'var(--msg-secondary)' }}>
                                    {rt.text || '📷 Photo/File'}
                                  </div>
                                </div>
                              );
                            })()}
                            {msg.callEvent ? (
                              <div className="px-2.5 pt-1.5 pb-1">
                                <CallEventBubble callEvent={msg.callEvent} isMine={isMine} />
                              </div>
                            ) : msg.voiceMessage ? (
                              <div className="px-2.5 pt-1.5 pb-1">
                                <VoiceMessageBubble duration={msg.voiceMessage.duration} audioUrl={msg.voiceMessage.audioUrl} isMine={isMine} transcription={msg.voiceMessage.transcription} msgId={msg.id} convId={selectedConvId || undefined} voiceToTextEnabled={voiceToTextEnabled} />
                              </div>
                            ) : msg.file ? (
                              <div className="px-2.5 pt-1.5 pb-1">
                                <div
                                  className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer"
                                  style={{ backgroundColor: isMine ? 'rgba(0,0,0,0.06)' : 'rgba(99,102,241,0.08)', minWidth: '200px', WebkitTapHighlightColor: 'transparent' }}
                                  onClick={() => downloadFile(msg.file!.data, msg.file!.name)}
                                  onTouchStart={() => downloadFile(msg.file!.data, msg.file!.name)}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isMine ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)' }}>
                                    <span className="text-lg">{getFileIcon(msg.file.type)}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium truncate" style={{ color: 'var(--msg-text)' }}>{msg.file.name}</div>
                                    <div className="text-[11px]" style={{ color: 'var(--msg-secondary)' }}>{formatFileSize(msg.file.size)}</div>
                                  </div>
                                  <Download size={16} style={{ color: 'var(--msg-secondary)', flexShrink: 0 }} />
                                </div>
                                {msg.text && (
                                  <div className="text-[14.2px] leading-[19px] break-words mt-1" style={{ color: 'var(--msg-text)' }}>
                                    {renderFormattedText(msg.text)}
                                  </div>
                                )}
                                <div className="flex justify-end mt-0.5">
                                  <span className="flex items-center gap-0.5 whitespace-nowrap">

                                    {msg.disappearing === true && <Timer size={11} className="text-emerald-500" />}
                                    {msg.starred && <Star size={11} className="text-amber-500" fill="#f59e0b" />}
                                    {msg.editedAt && <span className="text-[10.5px] italic" style={{ color: 'var(--msg-secondary)' }}>edited</span>}
                                    <span className="text-[10.5px]" style={{ color: 'var(--msg-secondary)' }}>{formatMessageTime(msg.createdAt)}</span>
                                    {isMine && (
                                      msg.read
                                        ? <CheckCheck size={14} style={{ color: '#53BDEB' }} />
                                        : <Check size={14} style={{ color: '#B0B6B9' }} />
                                    )}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <>
                                {hasImage && (
                                  <div className="relative">
                                    <img
                                      src={msg.image}
                                      alt="Shared image"
                                      className="w-full max-w-[280px] object-cover cursor-pointer"
                                      style={{ maxHeight: '300px', display: 'block' }}
                                      onClick={() => setLightboxImage(msg.image!)}
                                    />
                                    {/* Overlay timestamp on image-only messages */}
                                    {isImageOnly && (
                                      <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                                        {msg.editedAt && <span className="text-[10.5px] italic text-white">edited</span>}
                                        <span className="text-[10.5px] text-white">{formatMessageTime(msg.createdAt)}</span>
                                        {isMine && (
                                          msg.read
                                            ? <CheckCheck size={14} style={{ color: '#53BDEB' }} />
                                            : <Check size={14} style={{ color: '#FFFFFF' }} />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!isImageOnly && (
                                  <div className={`px-2.5 ${isImageWithText ? 'pt-1' : 'pt-1.5'} pb-1`}>
                                    <div className={`text-[14.2px] leading-[19px] break-words ${compactMode ? 'text-[13px]' : ''}`} style={{ color: msg.senderId === 'system' ? 'var(--msg-system-text)' : 'var(--msg-text)' }}>
                                      {msg.text && renderFormattedText(msg.text)}
                                      {/* Link preview for URLs in message */}
                                      {linkPreviewsEnabled && msg.text && !msg.deleted && (() => {
                                        const urls = msg.text.match(URL_REGEX);
                                        if (!urls || urls.length === 0) return null;
                                        return <LinkPreviewCard url={urls[0]} />;
                                      })()}
                                      {/* Inline timestamp + read receipt (WhatsApp style) */}
                                      <span className="float-right ml-2 mt-1 flex items-center gap-0.5 whitespace-nowrap" style={{ marginBottom: '-3px' }}>

                                        {msg.disappearing === true && <Timer size={11} className="text-emerald-500" />}
                                        {msg.starred && <Star size={11} className="text-amber-500" fill="#f59e0b" />}
                                        {msg.editedAt && <span className="text-[10.5px] italic" style={{ color: 'var(--msg-secondary)' }}>edited</span>}
                                        <span className="text-[10.5px]" style={{ color: 'var(--msg-secondary)' }}>
                                          {formatMessageTime(msg.createdAt)}
                                        </span>
                                        {readReceiptsEnabled && isMine && (
                                          msg.read
                                            ? <CheckCheck size={14} style={{ color: '#53BDEB' }} />
                                            : <Check size={14} style={{ color: '#B0B6B9' }} />
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                      {/* Reactions */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex gap-1 flex-wrap mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className="text-xs px-1.5 py-0.5 rounded-full bg-white dark:bg-[var(--aurora-surface)] shadow-sm border border-gray-100 dark:border-[var(--aurora-border)] hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] transition"
                            >
                              {emoji} {userIds.length > 1 && userIds.length}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* WhatsApp-style input area */}
      <div style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
        {replyingTo && (
          <div className="px-4 py-2 flex items-center justify-between border-b" style={{ backgroundColor: 'var(--msg-own-bubble-hover)', borderColor: 'var(--aurora-border)' }}>
            <div className="text-sm min-w-0 flex-1" style={{ color: '#4F46E5' }}>
              <span className="font-semibold">Replying to {replyingTo.senderId === user?.uid ? 'yourself' : (users.find(u => u.id === replyingTo.senderId)?.name || 'Unknown')}:</span>{' '}
              <span className="opacity-70">{truncateText(replyingTo.text, 50)}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 rounded hover:bg-white/50 shrink-0 ml-2" aria-label="Cancel reply">
              <X size={16} style={{ color: '#4F46E5' }} />
            </button>
          </div>
        )}
        {editingMessage && (
          <div className="px-4 py-2 flex items-center justify-between border-b" style={{ backgroundColor: 'var(--msg-own-bubble-hover)', borderColor: 'var(--aurora-border)' }}>
            <div className="text-sm" style={{ color: '#4F46E5' }}>
              <span className="font-semibold">Editing:</span> {truncateText(editingMessage.text, 40)}
            </div>
            <button onClick={() => setEditingMessage(null)} className="p-1 rounded hover:bg-white/50" aria-label="Cancel editing">
              <X size={16} style={{ color: '#4F46E5' }} />
            </button>
          </div>
        )}
        {showFormatting && <FormattingToolbar onFormat={handleFormat} />}
        {/* Image preview strip */}
        {pendingImage && (
          <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ backgroundColor: 'var(--msg-own-bubble-hover)', borderColor: 'var(--aurora-border)' }}>
            <img src={pendingImage} alt="Preview" className="w-14 h-14 rounded-lg object-cover" />
            <span className="text-sm flex-1" style={{ color: '#4F46E5' }}>Image attached</span>
            <button onClick={() => setPendingImage(null)} className="p-1 rounded hover:bg-white/50" aria-label="Remove image">
              <X size={16} style={{ color: '#4F46E5' }} />
            </button>
          </div>
        )}
        {imageCompressing && (
          <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ backgroundColor: 'var(--aurora-surface-variant)', borderColor: 'var(--aurora-border)' }}>
            <Loader2 size={16} className="animate-spin" style={{ color: '#E65100' }} />
            <span className="text-sm" style={{ color: '#E65100' }}>Compressing image...</span>
          </div>
        )}
        {/* File preview strip */}
        {pendingFile && (
          <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ backgroundColor: 'var(--msg-own-bubble-hover)', borderColor: 'var(--aurora-border)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(99,102,241,0.12)' }}>
              <span className="text-lg">{getFileIcon(pendingFile.type)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: '#4F46E5' }}>{pendingFile.name}</div>
              <div className="text-xs" style={{ color: 'var(--msg-secondary)' }}>{formatFileSize(pendingFile.size)}</div>
            </div>
            <button onClick={() => setPendingFile(null)} className="p-1 rounded hover:bg-white/50" aria-label="Remove file" onTouchStart={() => setPendingFile(null)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <X size={16} style={{ color: '#4F46E5' }} />
            </button>
          </div>
        )}
        <input type="file" accept="image/*" ref={imageInputRef} onChange={handleImagePick} className="hidden" />
        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" ref={fileInputRef} onChange={handleFilePick} className="hidden" />
        <div className="px-1 sm:px-3 py-1.5 flex items-end gap-1 sm:gap-2" style={{ overflow: 'hidden' }}>
          <div className="flex gap-0 flex-shrink-0 pb-1">
            {emojiPickerEnabled && (
            <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }} className="p-1.5 rounded-full hover:bg-gray-200/60 transition-colors" aria-label="Toggle emoji picker">
              <Smile size={20} style={{ color: 'var(--msg-icon)' }} />
            </button>
            )}
            <button onClick={() => imageInputRef.current?.click()} className="p-1.5 rounded-full hover:bg-gray-200/60 transition-colors" aria-label="Attach image">
              <ImagePlus size={20} style={{ color: 'var(--msg-icon)' }} />
            </button>
            {fileSharingEnabled && (
            <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-full hover:bg-gray-200/60 transition-colors" aria-label="Attach file" onTouchStart={() => fileInputRef.current?.click()} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <Paperclip size={20} style={{ color: 'var(--msg-icon)' }} />
            </button>
            )}
            {gifStickersEnabled && (
            <button
              onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
              onTouchStart={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
              className="px-1 py-1 rounded-full hover:bg-gray-200/60 transition-colors"
              style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              aria-label="Send GIF"
            >
              <span className="text-xs font-bold" style={{ color: 'var(--msg-icon)' }}>GIF</span>
            </button>
            )}
            {/* Disappearing message per-message timer toggle */}
            {disappearingMessagesEnabled && (
            <div className="relative">
              <button
                onClick={() => setShowPerMsgTimerPicker(!showPerMsgTimerPicker)}
                onTouchStart={() => setShowPerMsgTimerPicker(!showPerMsgTimerPicker)}
                className="p-1.5 rounded-full hover:bg-gray-200/60 transition-colors relative"
                style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                aria-label="Set disappearing message timer"
              >
                <Timer size={20} style={{ color: (disappearingPerMessage || conversations.find(c => c.id === selectedConvId)?.disappearingTimer) ? '#10b981' : 'var(--msg-icon)' }} />
                {(disappearingPerMessage || conversations.find(c => c.id === selectedConvId)?.disappearingTimer) ? (
                  <span className="absolute -top-1 -right-1 text-[7px] font-bold bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {formatDisappearingTimer(disappearingPerMessage || conversations.find(c => c.id === selectedConvId)?.disappearingTimer || 0)}
                  </span>
                ) : null}
              </button>
              {showPerMsgTimerPicker && (() => {
                const btnEl = document.querySelector('[aria-label="Set disappearing message timer"]');
                const rect = btnEl?.getBoundingClientRect();
                const popupBottom = rect ? rect.top - 8 : 200;
                const popupLeft = rect ? Math.max(8, rect.left + rect.width / 2 - 80) : 40;
                return (
                <>
                  <div
                    className="fixed inset-0"
                    style={{ zIndex: 9998, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                    onClick={() => setShowPerMsgTimerPicker(false)}
                    onTouchStart={() => setShowPerMsgTimerPicker(false)}
                  />
                  <div
                    className="fixed rounded-xl shadow-lg border py-1.5 w-40"
                    style={{
                      zIndex: 9999,
                      bottom: `${window.innerHeight - popupBottom}px`,
                      left: `${popupLeft}px`,
                      backgroundColor: 'var(--aurora-surface)',
                      borderColor: 'var(--aurora-border)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    }}
                  >
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--msg-secondary)' }}>
                      Timer for next message
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDisappearingPerMessage(null); setShowPerMsgTimerPicker(false); }}
                      onTouchStart={(e) => { e.stopPropagation(); setDisappearingPerMessage(null); setShowPerMsgTimerPicker(false); }}
                      className="w-full px-3 py-1.5 text-left text-sm flex items-center justify-between hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                      style={{ color: !disappearingPerMessage ? '#10b981' : 'var(--msg-text)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                    >
                      <span className="flex items-center gap-2"><TimerOff size={14} /> Off</span>
                      {!disappearingPerMessage && <span className="text-emerald-500 text-xs">✓</span>}
                    </button>
                    {DISAPPEARING_TIMER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={(e) => { e.stopPropagation(); setDisappearingPerMessage(opt.value); setShowPerMsgTimerPicker(false); }}
                        onTouchStart={(e) => { e.stopPropagation(); setDisappearingPerMessage(opt.value); setShowPerMsgTimerPicker(false); }}
                        className="w-full px-3 py-1.5 text-left text-sm flex items-center justify-between hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        style={{ color: disappearingPerMessage === opt.value ? '#10b981' : 'var(--msg-text)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                      >
                        <span className="flex items-center gap-2"><Timer size={14} /> {opt.label}</span>
                        {disappearingPerMessage === opt.value && <span className="text-emerald-500 text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
                );
              })()}
            </div>
            )}
          </div>
          <div className="flex-1 min-w-0 rounded-3xl px-3 py-2 flex items-center" style={{ backgroundColor: 'var(--aurora-surface)', minHeight: '42px' }}>
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleMessageInput}
              placeholder="Type a message"
              className="flex-1 bg-transparent outline-none text-sm sm:text-base resize-none leading-[20px] placeholder-gray-400"
              style={{ color: 'var(--msg-text)', maxHeight: '100px', textAlign: 'left' }}
              rows={1}
              maxLength={MESSAGE_CONFIG.MAX_MESSAGE_LENGTH}
            />
          </div>
          <div className="flex-shrink-0 pb-0.5">
            {(messageText.trim() || pendingImage || pendingFile) ? (
              <button
                onClick={() => {
                  if (editingMessage) {
                    editMessage(editingMessage.id, messageText);
                  } else {
                    sendMessage();
                  }
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: '#6366F1' }}
                aria-label="Send message"
              >
                <Send size={18} className="text-white" style={{ marginLeft: '2px' }} />
              </button>
            ) : voiceMessagesEnabled ? (
              <button
                onClick={async () => {
                  // Quick check if mic permission is explicitly denied (non-blocking)
                  try {
                    const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                    if (perm.state === 'denied') {
                      showNotif('Microphone access is blocked. Please enable it in your browser settings.', 'error');
                      return;
                    }
                  } catch {
                    // permissions.query not supported — proceed and let VoiceRecorder handle it
                  }
                  // Open VoiceRecorder — it will request mic access via getUserMedia internally
                  setIsRecording(true);
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: '#6366F1' }}
                aria-label="Start voice recording"
              >
                <Mic size={20} className="text-white" />
              </button>
            ) : null}
          </div>
        </div>
        {emojiPickerEnabled && showEmojiPicker && (
          <EmojiPicker
            recentEmojis={recentEmojis}
            onSelect={(emoji) => {
              setMessageText(messageText + emoji);
              setRecentEmojis(prev => [emoji, ...prev.filter(e => e !== emoji)].slice(0, 24));
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
        {gifStickersEnabled && showGifPicker && (
          <GifPicker
            onSelect={(gifUrl) => { sendGif(gifUrl); setShowGifPicker(false); }}
            onClose={() => setShowGifPicker(false)}
          />
        )}
      </div>
    </div>
  ) : null;

  // === Empty chat placeholder for desktop when no conversation selected ===
  const emptyRightPanel = (
    <div className="h-full flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
      <div className="text-center">
        <div className="w-[200px] h-[200px] mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--msg-own-bubble-hover)' }}>
          <MessageSquare size={80} style={{ color: '#6366F1' }} />
        </div>
        <h2 className="text-2xl font-light mb-3" style={{ color: '#41525D' }}>EthniZity Messages</h2>
        <p className="text-sm max-w-[340px] mx-auto" style={{ color: 'var(--msg-secondary)' }}>
          Send and receive messages with your community members. Select a conversation to start chatting.
        </p>
      </div>
    </div>
  );

  // === Call Helper Functions ===
  const initiateCall = async (callType: CallType) => {
    console.log('[Call] initiateCall triggered, type:', callType, 'status:', callManagerRef.current.getState().status);
    if (!user?.uid || !selectedUser) {
      console.warn('[Call] No user or selectedUser, aborting');
      return;
    }
    try {
      await callManagerRef.current.startCall(
        user.uid,
        userProfile?.name || userProfile?.preferredName || user.displayName || 'User',
        selectedUser.id,
        selectedUser.name,
        callType
      );
    } catch (err) {
      console.error('[Call] Failed to initiate call:', err);
      const msg = err instanceof Error ? err.message : '';
      let errorText = 'Failed to start call. Please try again.';
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        errorText = callType === 'video'
          ? 'Camera and microphone access is required. Please allow access in your browser settings.'
          : 'Microphone access is required. Please allow access in your browser settings.';
      } else if (msg.includes('Camera access failed') || msg.includes('NotFound') || msg.includes('NotReadable')) {
        errorText = 'Camera not available. Please check your camera is not in use by another app.';
      } else if (msg.includes('timed out')) {
        errorText = 'Camera took too long to respond. Please close other apps using the camera and try again.';
      } else if (msg.includes('Already in a call')) {
        errorText = 'You are already in a call. Please end the current call first.';
      }
      showNotif(errorText, 'error');
    }
  };

  // === Group Call Helper ===
  const initiateGroupCall = async (callType: GroupCallType) => {
    if (!user?.uid || !selectedConvId || !activeGroupConv) return;
    const myName = userProfile?.name || userProfile?.preferredName || user.displayName || 'User';
    try {
      if (activeGroupCallId) {
        // Join existing group call
        await groupCallManagerRef.current.joinCall(activeGroupCallId, user.uid, myName);
      } else {
        // Start new group call
        const roomId = await groupCallManagerRef.current.startCall(selectedConvId, callType, user.uid, myName);
        setActiveGroupCallId(roomId);
        // Write a system message to the conversation
        try {
          await addDoc(collection(db, 'conversations', selectedConvId, 'messages'), {
            text: `${myName} started a group ${callType} call`,
            senderId: 'system',
            createdAt: serverTimestamp(),
            callEvent: { type: 'group_call_started', callType },
          });
        } catch (e) { console.error('[GroupCall] system msg error:', e); }
      }
    } catch (err) {
      console.error('[GroupCall] Failed:', err);
      const msg = err instanceof Error ? err.message : '';
      let errorText = 'Failed to start group call.';
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        errorText = callType === 'video'
          ? 'Camera and microphone access required. Please allow in browser settings.'
          : 'Microphone access required. Please allow in browser settings.';
      } else if (msg.includes('full')) {
        errorText = 'Call is full (max 8 participants).';
      } else if (msg.includes('Already')) {
        errorText = 'You are already in a call.';
      } else if (msg.includes('ended')) {
        errorText = 'This call has already ended.';
      }
      showNotif(errorText, 'error');
    }
  };

  // Call overlay UI is now in GlobalCallOverlay (src/components/GlobalCallOverlay.tsx)
  // Group call overlay is in GroupCallOverlay (src/components/GroupCallOverlay.tsx)

  // === MOBILE LAYOUT: full-screen chat when in room view ===
  // === DESKTOP LAYOUT (md+): side-by-side panels like WhatsApp Web ===
  return (
    <div className={`h-full flex overflow-hidden ${viewState === 'room' ? 'fixed inset-0 z-50 bg-white md:relative md:inset-auto md:z-auto' : ''}`}>
      {/* Left panel - conversation list */}
      {/* On mobile: show only when viewState is 'list' */}
      {/* On desktop: always show */}
      <div
        className={`${viewState === 'room' ? 'hidden md:flex' : 'flex'} flex-col h-full w-full md:w-[380px] lg:w-[420px] md:min-w-[340px] md:max-w-[420px] flex-shrink-0`}
        style={{ borderRight: '1px solid var(--aurora-border)' }}
      >
        {conversationListPanel}
      </div>

      {/* Right panel - chat room or empty state */}
      {/* On mobile: show only when viewState is 'room' */}
      {/* On desktop: always show */}
      <div className={`${viewState === 'list' ? 'hidden md:flex' : 'flex'} flex-col h-full flex-1 min-w-0`}>
        {(selectedUser || activeGroupConv) ? chatRoomPanel : emptyRightPanel}
      </div>

      {/* Global overlays */}
      {contextMenuMsg && (
        <MessageContextMenu
          isMine={contextMenuMsg.senderId === user?.uid}
          isRecent={isMessageEditable(contextMenuMsg.createdAt)}
          isPinned={!!contextMenuMsg.pinned}
          isStarred={!!contextMenuMsg.starred}
          onReply={() => {
            setReplyingTo(contextMenuMsg);
            setContextMenuMsg(null);
            textareaRef.current?.focus();
          }}
          onForward={forwardMessagesEnabled ? () => {
            setForwardingMessage(contextMenuMsg);
            setShowForwardPicker(true);
            setContextMenuMsg(null);
          } : undefined}
          onPin={pinnedMessagesEnabled ? () => {
            togglePinMessage(contextMenuMsg);
            setContextMenuMsg(null);
          } : undefined}
          onStar={starredMessagesEnabled ? () => {
            toggleStarMessage(contextMenuMsg);
            setContextMenuMsg(null);
          } : undefined}
          onEdit={() => {
            setEditingMessage(contextMenuMsg);
            setMessageText(contextMenuMsg.text);
            setContextMenuMsg(null);
          }}
          onDelete={deleteMessagesEnabled ? () => {
            deleteMessage(contextMenuMsg.id);
            setContextMenuMsg(null);
          } : undefined}
          onReport={contextMenuMsg.senderId !== user?.uid ? () => {
            openReportModal(contextMenuMsg.id, contextMenuMsg.text, contextMenuMsg.senderId);
            setContextMenuMsg(null);
          } : undefined}
          onBlock={contextMenuMsg.senderId !== user?.uid ? () => {
            const senderUser = users.find((u) => u.id === contextMenuMsg.senderId);
            openBlockConfirm(contextMenuMsg.senderId, senderUser?.name || 'this user');
            setContextMenuMsg(null);
          } : undefined}
          onClose={() => setContextMenuMsg(null)}
        />
      )}
      {isRecording && <VoiceRecorder onSend={(dur, blob) => { setIsRecording(false); sendVoiceMessage(dur, blob); }} onCancel={() => setIsRecording(false)} />}
      {showWallpaperPicker && (
        <WallpaperPicker
          current={selectedWallpaper}
          onSelect={(preset) => {
            setSelectedWallpaper(preset);
            localStorage.setItem('selectedWallpaper', preset);
          }}
          onClose={() => setShowWallpaperPicker(false)}
        />
      )}
      {/* COMMENTED OUT — undo feature disabled (duplicate of delete) */}
      {/* {showUndoToast && <UndoToast onUndo={undoSend} onDismiss={() => setShowUndoToast(false)} />} */}
      {showNotification && (
        <NotificationToast
          message={notificationMessage}
          type={notificationType}
          onDismiss={() => setShowNotification(false)}
          duration={notificationType === 'error' ? 5000 : 3000}
        />
      )}
      {showDeleteMsgConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={() => { setShowDeleteMsgConfirm(false); setDeleteMsgId(null); }} onTouchStart={() => { setShowDeleteMsgConfirm(false); setDeleteMsgId(null); }} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mx-4 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Message</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Are you sure you want to delete this message? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowDeleteMsgConfirm(false); setDeleteMsgId(null); }} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
              <button onClick={confirmDeleteMessage} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Report Message Modal ===== */}
      {showReportModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={() => setShowReportModal(false)} onTouchStart={() => setShowReportModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Report Message</h3>
              <button onClick={() => setShowReportModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-[var(--aurora-surface-variant)] dark:hover:bg-gray-700 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Why are you reporting this message? Your report is confidential.</p>
              {MESSAGE_REPORT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setReportReason(cat.id)}
                  className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    reportReason === cat.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-500'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{cat.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{cat.description}</p>
                  </div>
                </button>
              ))}
              {reportReason && (
                <textarea
                  placeholder="Additional details (optional)..."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                />
              )}
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-5 py-4 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={!reportReason || reportSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {reportSubmitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Flag size={16} /> Submit Report</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Block User Confirmation Modal ===== */}
      {showBlockConfirm && blockTargetUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={() => setShowBlockConfirm(false)} onTouchStart={() => setShowBlockConfirm(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <Ban className="w-7 h-7 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Block {blockTargetUser.name}?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Their messages and conversations will be hidden. They won't appear in your discover, events, or other listings. You can unblock them from your Profile page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockUser}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 flex items-center justify-center gap-2"
              >
                <Ban size={16} /> Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== IMAGE LIGHTBOX MODAL ===== */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col"
          style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setLightboxImage(null); setLightboxForwardOpen(false); } }}
          onTouchStart={(e) => { if (e.target === e.currentTarget) { setLightboxImage(null); setLightboxForwardOpen(false); } }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={downloadLightboxImage}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Download image"
              >
                <Download size={22} className="text-white" />
              </button>
              <button
                onClick={() => setLightboxForwardOpen(true)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Forward image"
              >
                <Share2 size={22} className="text-white" />
              </button>
            </div>
            <button
              onClick={() => { setLightboxImage(null); setLightboxForwardOpen(false); }}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X size={26} className="text-white" />
            </button>
          </div>

          {/* Image area */}
          <div className="flex-1 flex items-center justify-center overflow-auto p-4">
            <img
              src={lightboxImage}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-lg select-none"
              style={{ maxHeight: 'calc(100vh - 120px)' }}
              draggable={false}
            />
          </div>

          {/* Forward picker overlay */}
          {lightboxForwardOpen && (
            <div
              className="absolute inset-0 z-[10000] flex items-end sm:items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              onClick={(e) => { if (e.target === e.currentTarget) setLightboxForwardOpen(false); }}
              onTouchStart={(e) => { if (e.target === e.currentTarget) setLightboxForwardOpen(false); }}
            >
              <div
                className="w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl max-h-[70vh] flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
              >
                {/* Forward header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Forward to</h3>
                  <button
                    onClick={() => setLightboxForwardOpen(false)}
                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[var(--aurora-surface-variant)] dark:hover:bg-gray-700 transition-colors"
                  >
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto">
                  {conversations.filter((c) => !c.archived).length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">No conversations to forward to</div>
                  ) : (
                    conversations.filter((c) => !c.archived).map((conv) => {
                      const otherUser = conv.isGroup
                        ? null
                        : users.find((u) => u.id === conv.participants.find((p) => p !== user?.uid));
                      const displayName = conv.isGroup ? (conv.groupName || 'Group') : (otherUser?.name || 'Unknown');
                      const displayAvatar = conv.isGroup ? null : otherUser?.avatar;
                      const isCurrent = conv.id === selectedConvId;

                      return (
                        <button
                          key={conv.id}
                          onClick={() => !forwardingImage && forwardImageToConversation(conv.id)}
                          disabled={forwardingImage}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--aurora-surface-variant)] dark:hover:bg-gray-700 transition-colors text-left ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''} ${forwardingImage ? 'opacity-50' : ''}`}
                        >
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: conv.isGroup ? '#6366F1' : '#E8E2F8' }}>
                            {displayAvatar ? (
                              <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                            ) : conv.isGroup ? (
                              <Users size={18} className="text-white" />
                            ) : (
                              <span className="text-sm font-semibold" style={{ color: '#6366F1' }}>
                                {displayName.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName}</div>
                            {isCurrent && <div className="text-xs text-indigo-500">Current chat</div>}
                          </div>
                          {/* Send icon */}
                          <Send size={18} className="text-gray-400 flex-shrink-0" />
                        </button>
                      );
                    })
                  )}
                </div>

                {forwardingImage && (
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin text-indigo-500" />
                    <span className="text-sm text-gray-500">Forwarding...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
