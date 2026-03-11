'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, orderBy, where, getDocs, addDoc, doc, setDoc, updateDoc,
  onSnapshot, serverTimestamp, Timestamp, getDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureSettings } from '../../contexts/FeatureSettingsContext';
import {
  generateConversationKey, encryptMessage, decryptMessage,
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
} from 'lucide-react';

// ===== TYPES =====
/**
 * User type for messaging participants
 * Includes profile information and messaging preferences
 */
type User = {
  id: string;
  name: string;
  avatar?: string;
  messagingPrivacy?: 'Everyone' | 'Contacts' | 'Nobody';
  lastSeen?: Timestamp;
  isOnline?: boolean;
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
  voiceMessage?: { duration: number };
  image?: string;
  read?: boolean;
  readAt?: Timestamp;
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

// ===== CONSTANTS =====

/**
 * Wallpaper presets for chat background customization
 * Each preset includes a label and CSS styling
 */
const WALLPAPER_PRESETS = {
  default: {
    label: 'WhatsApp',
    description: 'Classic WhatsApp doodle',
    style: {
      backgroundColor: '#ECE5DD',
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cstyle%3E.d%7Bfill:%23c8c3ba;opacity:0.15%7D%3C/style%3E%3C/defs%3E%3Ccircle class='d' cx='20' cy='30' r='3'/%3E%3Crect class='d' x='60' y='15' width='8' height='10' rx='2'/%3E%3Ccircle class='d' cx='110' cy='25' r='4'/%3E%3Crect class='d' x='155' y='20' width='6' height='8' rx='1'/%3E%3Ccircle class='d' cx='40' cy='80' r='3.5'/%3E%3Crect class='d' x='90' y='70' width='10' height='6' rx='2'/%3E%3Ccircle class='d' cx='140' cy='85' r='3'/%3E%3Crect class='d' x='175' y='75' width='7' height='9' rx='1.5'/%3E%3Ccircle class='d' cx='25' cy='140' r='4'/%3E%3Crect class='d' x='70' y='130' width='9' height='7' rx='2'/%3E%3Ccircle class='d' cx='120' cy='145' r='3'/%3E%3Crect class='d' x='165' y='135' width='8' height='6' rx='1'/%3E%3Ccircle class='d' cx='50' cy='185' r='3'/%3E%3Crect class='d' x='100' y='180' width='7' height='9' rx='2'/%3E%3Ccircle class='d' cx='150' cy='175' r='4'/%3E%3C/svg%3E")`,
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
    label: 'Teal',
    description: 'WhatsApp dark teal',
    style: {
      backgroundColor: '#0D1418',
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
const EMOJI_CATEGORIES = {
  'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥳','🥸','😎','🤓','🧐'],
  'Gestures': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏'],
  'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟'],
  'Objects': ['🎉','🎊','🎈','🎁','🏆','⭐','🌟','💫','✨','🔥','💯','🎯','💡','📱','💻','📸','🎵','🎶','☕','🍕','🍔','🌮','🍩','🍰','🧋'],
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

  return parts.length > 0 ? <>{parts}</> : text;
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
    return <div className={`${sizeClass} rounded-full`} style={{ backgroundColor: '#DFE5E7' }} />;
  }

  const isUrl = user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('data:'));
  const isEmoji = user.avatar && !isUrl;

  const avatarElement = isUrl ? (
    <img src={user.avatar} alt={user.name} className={`${sizeClass} rounded-full object-cover`} />
  ) : isEmoji ? (
    <div className={`${sizeClass} rounded-full flex items-center justify-center text-lg`} style={{ backgroundColor: '#DFE5E7' }}>{user.avatar}</div>
  ) : (
    <>
      {(() => {
        const initials = user.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        const colors = ['#25D366', '#128C7E', '#075E54', '#34B7F1', '#00A884'];
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

  return (
    <div className="relative flex-shrink-0">
      {avatarElement}
      {user.isOnline && (
        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: '#25D366' }} />
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
    <div className="px-4 py-3 animate-pulse flex items-center gap-3 border-b" style={{ borderColor: '#f0f0f0' }}>
      <div className="w-12 h-12 rounded-full" style={{ backgroundColor: '#E8E8E8' }} />
      <div className="flex-1">
        <div className="h-4 w-28 rounded mb-2" style={{ backgroundColor: '#E8E8E8' }} />
        <div className="h-3 w-44 rounded" style={{ backgroundColor: '#E8E8E8' }} />
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
    <div className="flex items-center gap-1 text-sm" style={{ color: '#25D366' }}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="flex gap-2 p-3 rounded-full bg-white dark:bg-[var(--aurora-surface)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
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

/**
 * MessageContextMenu Component
 * Context menu for message actions (edit, delete)
 * Only shows edit option for own messages within 15-minute window
 */
function MessageContextMenu({
  isMine,
  onDelete,
  onEdit,
  onClose,
  isRecent,
}: {
  isMine: boolean;
  onDelete: () => void;
  onEdit?: () => void;
  onClose: () => void;
  isRecent: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-[var(--aurora-surface)] rounded-lg shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {isMine && isRecent && onEdit && (
          <button
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="w-40 px-4 py-2 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm"
          >
            <Edit3 size={15} className="text-aurora-indigo" /> Edit
          </button>
        )}
        {isMine && (
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-40 px-4 py-2 text-left hover:bg-[var(--aurora-input)] transition flex items-center gap-2 text-sm text-red-500"
          >
            <Trash2 size={15} /> Delete
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
 * Modal emoji picker with category tabs and grid view
 */
function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState<string>('Smileys');
  const categories = Object.keys(EMOJI_CATEGORIES);
  const currentEmojis = EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES] || [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="absolute bottom-16 left-0 w-[calc(100vw-2rem)] sm:w-80 max-h-96 bg-white dark:bg-[var(--aurora-surface)] rounded-lg shadow-lg border border-[var(--aurora-border)] z-40 flex flex-col overflow-hidden">
      <div className="flex gap-1 p-2 border-b border-[var(--aurora-border)] overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded text-sm whitespace-nowrap transition ${
              activeCategory === cat ? 'bg-aurora-indigo text-white' : 'hover:bg-[var(--aurora-input)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-6 sm:grid-cols-8 gap-2">
        {currentEmojis.map((emoji, idx) => (
          <button
            key={idx}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-10 h-10 flex items-center justify-center text-xl hover:scale-125 transition"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
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
 * VoiceRecorder Component
 * Voice message recording UI with timer and waveform animation
 */
function VoiceRecorder({ onSend, onCancel }: { onSend: (duration: number) => void; onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div
        className="bg-white dark:bg-[var(--aurora-surface)] rounded-lg p-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600">
            <MicOff size={18} />
          </button>
          <button onClick={() => onSend(seconds)} className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * VoiceMessageBubble Component
 * Displays voice message with play/pause button and duration
 */
function VoiceMessageBubble({ duration, isMine }: { duration: number; isMine: boolean }) {
  const [playing, setPlaying] = useState(false);

  const mins = Math.floor(duration / 60);
  const secs = duration % 60;

  return (
    <div className="flex items-center gap-3 py-1">
      <button onClick={() => setPlaying(!playing)} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#00A884' }}>
        {playing ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white" style={{ marginLeft: '2px' }} />}
      </button>
      <div className="flex gap-[3px] items-end flex-1">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="w-[2.5px] rounded-full"
            style={{
              height: `${4 + Math.abs(Math.sin(i * 0.8)) * 14}px`,
              backgroundColor: playing ? '#00A884' : '#8AACB0',
            }}
          />
        ))}
      </div>
      <span className="text-[11px] font-mono" style={{ color: '#667781' }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white dark:bg-[var(--aurora-surface)] rounded-lg p-4 sm:p-6 max-w-[90vw] sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
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

/**
 * UndoToast Component
 * Notification toast for message undo functionality with auto-dismiss
 */
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
      className={`fixed top-4 left-4 right-4 max-w-xs ${bgColor[type]} rounded-lg shadow-lg p-3 flex items-center gap-3 border border-current ${textColor[type]}`}
    >
      <Icon size={18} className={iconColor[type]} />
      <span className="text-sm">{message}</span>
      <button onClick={onDismiss} className="ml-auto">
        <X size={16} />
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
        className="flex-1 bg-transparent text-sm outline-none"
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
  const { user } = useAuth();
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
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'connects'>('all');
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
  const [undoMessageId, setUndoMessageId] = useState<string | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [chatSearch, setChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchIndex, setChatSearchIndex] = useState(0);
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>('default');
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
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

  // Refs
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load wallpaper from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('selectedWallpaper');
    if (saved && saved in WALLPAPER_PRESETS) {
      setSelectedWallpaper(saved);
    }
  }, []);

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
      (snap) => {
        const msgs: Message[] = [];
        snap.forEach((d) => {
          let text = d.data().text || '';
          if (d.data().encrypted && encryptionEnabled && selectedUser) {
            try {
              const convKey = generateConversationKey(user.uid, selectedUser.id);
              text = decryptMessage(text, convKey);
            } catch {
              text = '[Encrypted]';
            }
          }
          msgs.push({ ...d.data(), id: d.id, text } as Message);
        });
        setMessages(msgs);
        setMessagesLoading(false);
        setTimeout(() => scrollToBottom(), 100);
      },
      (err) => {
        console.error('Error fetching messages:', err);
        showNotif('Failed to load messages', 'error');
      }
    );
    unsubscribersRef.current.push(unsubscribe);
    return () => unsubscribe();
  }, [selectedUser, selectedConvId, user, encryptionEnabled]);

  // Cleanup unsubscribers on unmount
  useEffect(() => {
    return () => {
      unsubscribersRef.current.forEach((unsub) => unsub());
    };
  }, []);

  // ===== UTILITY FUNCTIONS =====

  const showNotif = useCallback((msg: string, type: NotificationType = 'info') => {
    setNotificationMessage(msg);
    setNotificationType(type);
    setShowNotification(true);
  }, []);

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
      const convKey = generateConversationKey(user.uid, selectedUser.id);
      payload = encryptMessage(newText.trim(), convKey);
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
    if (!user?.uid || (!messageText.trim() && !pendingImage)) return;
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
    const shouldEncrypt = !isGroup && encryptionEnabled && selectedUser;
    if (shouldEncrypt && selectedUser && payload) {
      const convKey = generateConversationKey(user.uid, selectedUser.id);
      payload = encryptMessage(payload, convKey);
    }

    const imageToSend = pendingImage;

    try {
      const msgData: Record<string, unknown> = {
        text: payload || '',
        senderId: user.uid,
        time: formatMessageTime(Timestamp.now()),
        createdAt: serverTimestamp(),
        encrypted: !!shouldEncrypt,
      };
      if (imageToSend) {
        msgData.image = imageToSend;
      }
      const msgRef = await addDoc(collection(db, 'conversations', convId, 'messages'), msgData);
      setUndoMessageId(msgRef.id);
      setShowUndoToast(true);
      setMessageText('');
      setPendingImage(null);
      const lastMsgPreview = imageToSend ? (payload ? `📷 ${messageText.slice(0, 40)}` : '📷 Photo') : messageText.slice(0, 50);
      const convUpdateData: Record<string, unknown> = {
        lastMessage: lastMsgPreview,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
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

  const sendVoiceMessage = async (duration: number) => {
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
      const msgRef = await addDoc(collection(db, 'conversations', convId, 'messages'), {
        text: '🎤 Voice message',
        senderId: user.uid,
        time: formatMessageTime(Timestamp.now()),
        createdAt: serverTimestamp(),
        voiceMessage: { duration },
      });
      setUndoMessageId(msgRef.id);
      setShowUndoToast(true);
      const convUpdateData: Record<string, unknown> = {
        lastMessage: '🎤 Voice message',
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
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
      await setDoc(doc(db, 'conversations', groupId), {
        participants: participantIds,
        isGroup: true,
        groupName: groupName.trim(),
        groupCreatedBy: user.uid,
        groupAdmins: [user.uid],
        lastMessage: `Group "${groupName.trim()}" created`,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: user.uid,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
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
      await updateDoc(doc(db, 'conversations', selectedConvId), {
        participants: updatedParticipants,
        updatedAt: serverTimestamp(),
      });
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
      // Show all users you've connected with (all conversations)
      // No additional filtering needed - shows all conversations
    }

    return result;
  }, [conversations, searchTerm, activeFilter, user?.uid, users, groupMessagingEnabled]);

  // === Conversation list panel (reused in both mobile and desktop) ===
  const conversationListPanel = (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: 'var(--aurora-surface)' }}>
      {/* Header - purple on mobile, light purple on desktop */}
      <div className="px-4 pt-3 pb-2 sm:bg-gradient-to-r sm:from-purple-50 sm:via-violet-50 sm:to-indigo-50 bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-600">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-wide sm:text-purple-700 text-white">Messages</h1>
          <div className="relative">
            <button
              onClick={() => setShowPenMenu(!showPenMenu)}
              className="p-1.5 rounded-full transition-colors sm:hover:bg-purple-100 hover:bg-white/10"
              aria-label="New message or group"
            >
              <Edit3 size={20} className="sm:text-purple-600 text-white" />
            </button>
            {/* Pen dropdown menu */}
            {showPenMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPenMenu(false)} />
                <div
                  className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg overflow-hidden z-50"
                  style={{ backgroundColor: 'var(--aurora-surface)', border: '1px solid var(--aurora-border)' }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowPenMenu(false); setShowNewMsgPicker(true); }}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#F5F6F6] transition-colors"
                  >
                    <MessageSquare size={18} style={{ color: '#54656F' }} />
                    <span className="text-sm font-medium" style={{ color: '#111B21' }}>New Message</span>
                  </button>
                  {groupMessagingEnabled && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowPenMenu(false); setShowGroupCreator(true); setGroupName(''); setSelectedGroupMembers([]); setGroupSearchTerm(''); }}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#F5F6F6] transition-colors"
                      style={{ borderTop: '1px solid #F0F2F5' }}
                    >
                      <Users size={18} style={{ color: '#54656F' }} />
                      <span className="text-sm font-medium" style={{ color: '#111B21' }}>Create Group</span>
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
            className="w-full pl-10 pr-10 py-2.5 bg-aurora-surface border border-aurora-border rounded-full text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all"
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
        {(['all', 'unread', 'connects'] as const).map((filter) => (
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
                  style={{ backgroundColor: isSelected ? '#F0F2F5' : undefined }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--aurora-surface-variant)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = ''; }}
                >
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-[45px] h-[45px] rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#25D366' }}>
                      <Users size={22} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0 border-b py-1" style={{ borderColor: '#F0F2F5' }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-[16px]" style={{ color: '#111B21' }}>{conv.groupName || 'Group'}</span>
                        {conv.lastMessageTime && (
                          <span className="text-xs flex-shrink-0 ml-2" style={{ color: hasUnread ? '#25D366' : '#667781' }}>
                            {getRelativeTime(conv.lastMessageTime)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] truncate flex-1" style={{ color: '#667781' }}>
                          {conv.lastMessage || 'No messages'}
                        </div>
                        {hasUnread && (
                          <span className="ml-2 min-w-[20px] h-5 flex items-center justify-center rounded-full text-white text-xs font-bold px-1.5 flex-shrink-0" style={{ backgroundColor: '#25D366' }}>
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
                style={{ backgroundColor: isSelected ? '#F0F2F5' : undefined }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F5F6F6'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = ''; }}
              >
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <ChatAvatar user={otherUser} size="lg" showOnlineStatus={true} />
                  <div className="flex-1 min-w-0 border-b py-1" style={{ borderColor: '#F0F2F5' }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-[16px]" style={{ color: '#111B21' }}>{otherUser.name}</span>
                      {conv.lastMessageTime && (
                        <span className="text-xs flex-shrink-0 ml-2" style={{ color: hasUnread ? '#25D366' : '#667781' }}>
                          {getRelativeTime(conv.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] truncate flex-1" style={{ color: isTyping ? '#25D366' : '#667781' }}>
                        {isTyping ? (
                          <TypingIndicator />
                        ) : (
                          <span className="flex items-center gap-1">
                            {conv.lastMessageSenderId === user?.uid && (
                              <CheckCheck size={14} className="flex-shrink-0" style={{ color: '#53BDEB' }} />
                            )}
                            {conv.lastMessage || 'No messages'}
                          </span>
                        )}
                      </div>
                      {hasUnread && (
                        <span className="ml-2 min-w-[20px] h-5 flex items-center justify-center rounded-full text-white text-xs font-bold px-1.5 flex-shrink-0" style={{ backgroundColor: '#25D366' }}>
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
          <div className="p-8 text-center" style={{ color: '#667781' }}>
            <MessageSquare size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No connects yet</p>
            <p className="text-xs mt-1">Start a conversation to build your connections</p>
          </div>
        ) : (
          <div className="p-8 text-center" style={{ color: '#667781' }}>
            <MessageSquare size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">{searchTerm ? 'No conversations found' : 'No conversations yet'}</p>
          </div>
        )}
      </div>

      {/* New Message picker modal */}
      {showNewMsgPicker && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--aurora-surface)' }}>
          <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid #F0F2F5' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowNewMsgPicker(false)} className="p-1">
                  <ArrowLeft size={20} style={{ color: '#54656F' }} />
                </button>
                <h2 className="text-lg font-bold" style={{ color: '#111B21' }}>New Message</h2>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
              <Search size={16} style={{ color: '#667781' }} className="flex-shrink-0" />
              <input
                type="text"
                placeholder="Search people"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 py-1 bg-transparent outline-none text-sm placeholder-gray-400"
                style={{ color: '#111B21' }}
                autoFocus
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="p-0.5">
                  <X size={14} style={{ color: '#667781' }} />
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
                  className="w-full text-left transition-colors hover:bg-[#F5F6F6]"
                >
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <ChatAvatar user={u} size="lg" showOnlineStatus={true} />
                    <div className="flex-1 min-w-0 border-b py-1" style={{ borderColor: '#F0F2F5' }}>
                      <span className="font-medium text-[16px]" style={{ color: '#111B21' }}>{u.name}</span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center" style={{ color: '#667781' }}>
                <p className="text-sm">{searchTerm ? 'No users found' : 'No community members available'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group Creator overlay */}
      {showGroupCreator && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--aurora-surface)' }}>
          <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid #F0F2F5' }}>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => { setShowGroupCreator(false); setGroupName(''); setSelectedGroupMembers([]); setGroupSearchTerm(''); }} className="p-1">
                <ArrowLeft size={20} style={{ color: '#54656F' }} />
              </button>
              <h2 className="text-lg font-bold" style={{ color: '#111B21' }}>Create Group</h2>
            </div>
            {/* Group name input */}
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
              <Users size={16} style={{ color: '#667781' }} className="flex-shrink-0" />
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="flex-1 py-1 bg-transparent outline-none text-sm placeholder-gray-400"
                style={{ color: '#111B21' }}
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
                    style={{ backgroundColor: '#E8F5E9', color: '#075E54' }}
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
              <Search size={16} style={{ color: '#667781' }} className="flex-shrink-0" />
              <input
                type="text"
                placeholder="Search people to add"
                value={groupSearchTerm}
                onChange={(e) => setGroupSearchTerm(e.target.value)}
                className="flex-1 py-1 bg-transparent outline-none text-sm placeholder-gray-400"
                style={{ color: '#111B21' }}
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
                  className="w-full text-left transition-colors hover:bg-[#F5F6F6]"
                  style={{ backgroundColor: isAdded ? '#F0FFF4' : undefined }}
                >
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <ChatAvatar user={u} size="lg" showOnlineStatus={true} />
                    <div className="flex-1 min-w-0 border-b py-1" style={{ borderColor: '#F0F2F5' }}>
                      <span className="font-medium text-[16px]" style={{ color: '#111B21' }}>{u.name}</span>
                    </div>
                    <div className="flex-shrink-0">
                      {isAdded ? (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#25D366' }}>
                          <Check size={14} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2" style={{ borderColor: '#CCD0D5' }} />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {/* Create button */}
          <div className="px-4 py-3" style={{ borderTop: '1px solid #F0F2F5' }}>
            <button
              onClick={createGroup}
              disabled={!groupName.trim() || selectedGroupMembers.length === 0}
              className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#25D366' }}
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
      {/* WhatsApp-style chat header */}
      <div className="px-2 py-2 flex items-center gap-2" style={{ backgroundColor: '#075E54' }}>
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
              style={{ backgroundColor: '#128C7E' }}
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
            <ChatAvatar user={selectedUser} size="sm" showOnlineStatus={true} />
            <div className="flex-1 min-w-0">
              <h2 className="font-medium text-white text-[15px] leading-tight">{selectedUser.name}</h2>
              <div className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {isOtherUserTyping ? 'typing...' : selectedUser.isOnline ? 'online' : selectedUser.lastSeen ? `last seen ${getRelativeTime(selectedUser.lastSeen)}` : ''}
              </div>
            </div>
          </>
        ) : null}
        <div className="flex gap-1">
          <button
            onClick={() => setChatSearch(!chatSearch)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Search messages"
          >
            <SearchIcon size={18} className="text-white" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowChatMenu(!showChatMenu)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <MoreVertical size={18} className="text-white" />
            </button>
            {showChatMenu && (
              <>
              <div className="fixed inset-0 z-30" onClick={() => setShowChatMenu(false)} />
              <div className="absolute top-10 right-0 bg-white rounded-lg shadow-xl z-40 min-w-[180px] py-1 overflow-hidden">
                {activeGroupConv && (
                  <button
                    onClick={() => {
                      setShowGroupSettings(true);
                      setEditGroupNameValue(activeGroupConv.groupName || '');
                      setShowChatMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 text-sm"
                    style={{ color: '#111B21' }}
                  >
                    <Settings size={16} style={{ color: '#667781' }} /> Group Info
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowWallpaperPicker(true);
                    setShowChatMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 text-sm"
                  style={{ color: '#111B21' }}
                >
                  <Palette size={16} style={{ color: '#667781' }} /> Wallpaper
                </button>
                <button
                  onClick={() => {
                    setCompactMode(!compactMode);
                    setShowChatMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 text-sm"
                  style={{ color: '#111B21' }}
                >
                  {compactMode ? <Maximize2 size={16} style={{ color: '#667781' }} /> : <Minimize2 size={16} style={{ color: '#667781' }} />}
                  {compactMode ? 'Comfortable' : 'Compact'}
                </button>
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

      {/* Group Settings Panel - slides over the chat */}
      {showGroupSettings && activeGroupConv && (() => {
        const amAdmin = isGroupAdmin(activeGroupConv);
        const amCreator = activeGroupConv.groupCreatedBy === user?.uid;
        const admins = activeGroupConv.groupAdmins || (activeGroupConv.groupCreatedBy ? [activeGroupConv.groupCreatedBy] : []);
        const nonMemberUsers = users.filter(
          (u) => u.id !== user?.uid && !activeGroupConv.participants.includes(u.id) && u.name.toLowerCase().includes(addMemberSearchTerm.toLowerCase())
        );

        return (
          <div className="absolute inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--aurora-surface)' }}>
            {/* Header */}
            <div className="px-4 pt-3 pb-3 flex items-center gap-3" style={{ backgroundColor: '#075E54' }}>
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
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#128C7E' }}>
                    <Users size={32} className="text-white" />
                  </div>
                </div>
                {editingGroupName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editGroupNameValue}
                      onChange={(e) => setEditGroupNameValue(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ backgroundColor: 'var(--aurora-surface-variant)', color: 'var(--aurora-text)' }}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') updateGroupName(editGroupNameValue); }}
                    />
                    <button
                      onClick={() => updateGroupName(editGroupNameValue)}
                      className="p-2 rounded-full"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <Check size={16} className="text-white" />
                    </button>
                    <button
                      onClick={() => setEditingGroupName(false)}
                      className="p-2 rounded-full"
                      style={{ backgroundColor: 'var(--aurora-surface-variant)' }}
                    >
                      <X size={16} style={{ color: '#667781' }} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-xl font-semibold text-center" style={{ color: '#111B21' }}>
                      {activeGroupConv.groupName || 'Group'}
                    </h3>
                    {amAdmin && (
                      <button
                        onClick={() => { setEditingGroupName(true); setEditGroupNameValue(activeGroupConv.groupName || ''); }}
                        className="p-1.5 rounded-full hover:bg-gray-100 transition"
                      >
                        <Edit3 size={16} style={{ color: '#667781' }} />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-center text-sm mt-1" style={{ color: '#667781' }}>
                  Group &middot; {activeGroupConv.participants.length} members
                </p>
              </div>

              {/* Members Section */}
              <div className="px-4 py-3" style={{ borderBottom: '8px solid #F0F2F5' }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold" style={{ color: '#075E54' }}>
                    {activeGroupConv.participants.length} Members
                  </h4>
                  {amAdmin && (
                    <button
                      onClick={() => setShowAddMemberPicker(!showAddMemberPicker)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition hover:opacity-80"
                      style={{ backgroundColor: '#E8F5E9', color: '#075E54' }}
                    >
                      <UserPlus size={14} />
                      Add Member
                    </button>
                  )}
                </div>

                {/* Add Member Picker */}
                {showAddMemberPicker && amAdmin && (
                  <div className="mb-3 rounded-lg overflow-hidden" style={{ border: '1px solid #E8E8E8' }}>
                    <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
                      <Search size={16} style={{ color: '#667781' }} />
                      <input
                        type="text"
                        placeholder="Search people to add..."
                        value={addMemberSearchTerm}
                        onChange={(e) => setAddMemberSearchTerm(e.target.value)}
                        className="flex-1 py-1 bg-transparent outline-none text-sm placeholder-gray-400"
                        style={{ color: '#111B21' }}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {nonMemberUsers.length === 0 ? (
                        <div className="px-4 py-3 text-center text-sm" style={{ color: '#667781' }}>
                          No members to add
                        </div>
                      ) : (
                        nonMemberUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => addMemberToGroup(u)}
                            className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition"
                          >
                            <ChatAvatar user={u} size="sm" showOnlineStatus={false} />
                            <span className="flex-1 text-sm font-medium" style={{ color: '#111B21' }}>{u.name}</span>
                            <UserPlus size={16} style={{ color: '#25D366' }} />
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
                        <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center" style={{ backgroundColor: '#DFE5E7' }}>
                          <Users size={18} style={{ color: '#667781' }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[15px] font-medium" style={{ color: '#111B21' }}>
                            {isMe ? 'You' : memberUser?.name || pid.slice(0, 8)}
                          </span>
                          {isCreator && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>
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
                              className="p-1.5 rounded-full hover:bg-gray-100 transition"
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
                  <Shield size={16} className="mt-0.5 flex-shrink-0" style={{ color: '#667781' }} />
                  <p className="text-xs" style={{ color: '#667781' }}>
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
            <Loader2 size={32} className="animate-spin" style={{ color: '#25D366' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="bg-white/80 rounded-lg px-6 py-4 shadow-sm">
              <MessageSquare size={40} className="mx-auto mb-2" style={{ color: '#B0B6B9' }} />
              <p className="text-sm" style={{ color: '#667781' }}>No messages yet. Say hello!</p>
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
                            borderTop: `8px solid ${isMine ? '#DCF8C6' : 'var(--aurora-surface)'}`,
                            [isMine ? 'borderLeft' : 'borderRight']: '8px solid transparent',
                          }}
                        />
                      )}
                      <div
                        className={`px-2.5 pt-1.5 pb-1 ${isFirstInGroup ? (isMine ? 'rounded-tl-lg rounded-tr-sm' : 'rounded-tr-lg rounded-tl-sm') : 'rounded-t-lg'} rounded-b-lg shadow-sm cursor-pointer select-none`}
                        style={{
                          backgroundColor: msg.senderId === 'system' ? 'var(--aurora-surface-variant)' : isMine ? '#DCF8C6' : 'var(--aurora-surface)',
                          boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)',
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
                          <div className="text-[12px] font-semibold mb-0.5" style={{ color: '#25D366' }}>
                            {users.find((u) => u.id === msg.senderId)?.name || 'Unknown'}
                          </div>
                        )}
                        {msg.voiceMessage ? (
                          <VoiceMessageBubble duration={msg.voiceMessage.duration} isMine={isMine} />
                        ) : (
                          <>
                            {msg.image && (
                              <div className="-mx-[9px] -mt-[6px] mb-1">
                                <img
                                  src={msg.image}
                                  alt="Shared image"
                                  className="rounded-t-[7.5px] w-full max-w-[280px] object-cover cursor-pointer"
                                  style={{ maxHeight: '300px' }}
                                  onClick={() => window.open(msg.image, '_blank')}
                                />
                              </div>
                            )}
                            <div className={`text-[14.2px] leading-[19px] break-words ${compactMode ? 'text-[13px]' : ''}`} style={{ color: msg.senderId === 'system' ? '#4A6E7F' : '#111B21' }}>
                              {msg.text && renderFormattedText(msg.text)}
                              {/* Inline timestamp + read receipt (WhatsApp style) */}
                              <span className="float-right ml-2 mt-1 flex items-center gap-0.5 whitespace-nowrap" style={{ marginBottom: '-3px' }}>
                                {msg.editedAt && <span className="text-[10.5px] italic" style={{ color: '#667781' }}>edited</span>}
                                <span className="text-[10.5px]" style={{ color: msg.image && !msg.text ? '#FFFFFF' : '#667781' }}>
                                  {formatMessageTime(msg.createdAt)}
                                </span>
                                {isMine && (
                                  msg.read
                                    ? <CheckCheck size={14} style={{ color: '#53BDEB' }} />
                                    : <CheckCheck size={14} style={{ color: msg.image && !msg.text ? '#FFFFFF' : '#B0B6B9' }} />
                                )}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      {/* Reactions */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex gap-1 flex-wrap mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className="text-xs px-1.5 py-0.5 rounded-full bg-white shadow-sm border border-gray-100 hover:bg-gray-50 transition"
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
        {editingMessage && (
          <div className="px-4 py-2 flex items-center justify-between border-b" style={{ backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }}>
            <div className="text-sm" style={{ color: '#075E54' }}>
              <span className="font-semibold">Editing:</span> {truncateText(editingMessage.text, 40)}
            </div>
            <button onClick={() => setEditingMessage(null)} className="p-1 rounded hover:bg-white/50" aria-label="Cancel editing">
              <X size={16} style={{ color: '#075E54' }} />
            </button>
          </div>
        )}
        {showFormatting && <FormattingToolbar onFormat={handleFormat} />}
        {/* Image preview strip */}
        {pendingImage && (
          <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }}>
            <img src={pendingImage} alt="Preview" className="w-14 h-14 rounded-lg object-cover" />
            <span className="text-sm flex-1" style={{ color: '#075E54' }}>Image attached</span>
            <button onClick={() => setPendingImage(null)} className="p-1 rounded hover:bg-white/50" aria-label="Remove image">
              <X size={16} style={{ color: '#075E54' }} />
            </button>
          </div>
        )}
        {imageCompressing && (
          <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }}>
            <Loader2 size={16} className="animate-spin" style={{ color: '#E65100' }} />
            <span className="text-sm" style={{ color: '#E65100' }}>Compressing image...</span>
          </div>
        )}
        <input type="file" accept="image/*" ref={imageInputRef} onChange={handleImagePick} className="hidden" />
        <div className="px-2 sm:px-3 py-1.5 flex items-end gap-1.5 sm:gap-2">
          <div className="flex gap-0.5 flex-shrink-0 pb-1">
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 rounded-full hover:bg-gray-200/60 transition-colors" aria-label="Toggle emoji picker">
              <Smile size={22} style={{ color: '#54656F' }} />
            </button>
            <button onClick={() => imageInputRef.current?.click()} className="p-2 rounded-full hover:bg-gray-200/60 transition-colors" aria-label="Attach image">
              <ImagePlus size={22} style={{ color: '#54656F' }} />
            </button>
          </div>
          <div className="flex-1 rounded-3xl px-3 py-2 flex items-end" style={{ backgroundColor: 'var(--aurora-surface)', minHeight: '42px' }}>
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleMessageInput}
              placeholder="Type a message"
              className="flex-1 bg-transparent outline-none text-[15px] resize-none leading-[20px] placeholder-gray-400"
              style={{ color: '#111B21', maxHeight: '100px' }}
              rows={1}
              maxLength={MESSAGE_CONFIG.MAX_MESSAGE_LENGTH}
            />
          </div>
          <div className="flex-shrink-0 pb-0.5">
            {(messageText.trim() || pendingImage) ? (
              <button
                onClick={() => {
                  if (editingMessage) {
                    editMessage(editingMessage.id, messageText);
                  } else {
                    sendMessage();
                  }
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: '#00A884' }}
                aria-label="Send message"
              >
                <Send size={18} className="text-white" style={{ marginLeft: '2px' }} />
              </button>
            ) : (
              <button
                onClick={() => setIsRecording(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: '#00A884' }}
                aria-label="Start voice recording"
              >
                <Mic size={20} className="text-white" />
              </button>
            )}
          </div>
        </div>
        {showEmojiPicker && (
          <EmojiPicker onSelect={(e) => setMessageText(messageText + e)} onClose={() => setShowEmojiPicker(false)} />
        )}
      </div>
    </div>
  ) : null;

  // === Empty chat placeholder for desktop when no conversation selected ===
  const emptyRightPanel = (
    <div className="h-full flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--aurora-surface-variant)' }}>
      <div className="text-center">
        <div className="w-[200px] h-[200px] mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E8F5E9' }}>
          <MessageSquare size={80} style={{ color: '#25D366' }} />
        </div>
        <h2 className="text-2xl font-light mb-3" style={{ color: '#41525D' }}>ethniCity Messages</h2>
        <p className="text-sm max-w-[340px] mx-auto" style={{ color: '#667781' }}>
          Send and receive messages with your community members. Select a conversation to start chatting.
        </p>
      </div>
    </div>
  );

  // === MOBILE LAYOUT: single panel switching ===
  // === DESKTOP LAYOUT (md+): side-by-side panels like WhatsApp Web ===
  return (
    <div className="h-full flex">
      {/* Left panel - conversation list */}
      {/* On mobile: show only when viewState is 'list' */}
      {/* On desktop: always show */}
      <div
        className={`${viewState === 'room' ? 'hidden md:flex' : 'flex'} flex-col h-full w-full md:w-[380px] lg:w-[420px] md:min-w-[340px] md:max-w-[420px] flex-shrink-0`}
        style={{ borderRight: '1px solid #E8E8E8' }}
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
          onEdit={() => {
            setEditingMessage(contextMenuMsg);
            setMessageText(contextMenuMsg.text);
            setContextMenuMsg(null);
          }}
          onDelete={() => {
            deleteMessage(contextMenuMsg.id);
            setContextMenuMsg(null);
          }}
          onClose={() => setContextMenuMsg(null)}
        />
      )}
      {isRecording && <VoiceRecorder onSend={(dur) => { setIsRecording(false); sendVoiceMessage(dur); }} onCancel={() => setIsRecording(false)} />}
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
      {showUndoToast && <UndoToast onUndo={undoSend} onDismiss={() => setShowUndoToast(false)} />}
      {showNotification && (
        <NotificationToast
          message={notificationMessage}
          type={notificationType}
          onDismiss={() => setShowNotification(false)}
        />
      )}
      {showDeleteMsgConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={() => { setShowDeleteMsgConfirm(false); setDeleteMsgId(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mx-4 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Message</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Are you sure you want to delete this message? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowDeleteMsgConfirm(false); setDeleteMsgId(null); }} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
              <button onClick={confirmDeleteMessage} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
