import React from 'react';
import { Timestamp } from 'firebase/firestore';
import type { LinkPreviewData, User, PresenceStatus } from '@/types/messages';
import {
  MESSAGE_CONFIG,
  PRESENCE_OFFLINE_THRESHOLD,
  URL_REGEX,
} from '@/constants/messages';

// ===== LINK PREVIEW =====

export const linkPreviewCache = new Map<string, LinkPreviewData | null>();

export const fetchLinkPreview = async (url: string): Promise<LinkPreviewData | null> => {
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

// ===== HELPER FUNCTIONS =====

/**
 * Generate a consistent conversation ID from two user IDs
 * Ensures the same ID regardless of order: (uid1, uid2) = (uid2, uid1)
 */
export const generateConvId = (uid1: string, uid2: string): string => {
  return [uid1, uid2].sort().join('__');
};

/**
 * Format a Firestore Timestamp to a human-readable date
 * Example: "Mar 1, 2026" or "Mar 1" if current year
 */
export const formatTimestamp = (ts: Timestamp | null | undefined): string => {
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
export const formatMessageTime = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '';
  const d = ts.toDate();
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

/**
 * Get a date label (Today/Yesterday/Date) for a timestamp
 * Used for message grouping in conversation view
 */
export const getDateLabel = (ts: Timestamp | null | undefined): string => {
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
export const isMessageEditable = (createdAt: Timestamp | null | undefined): boolean => {
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
export const truncateText = (text: string, maxLength: number = 50): string => {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};

/**
 * Calculate time since message was sent
 * Example: "5m ago", "2h ago", etc.
 */
export const getRelativeTime = (ts: Timestamp | null | undefined): string => {
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
 * Format disappearing message timer duration
 */
export const formatDisappearingTimer = (ms: number): string => {
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
export const derivePresenceStatus = (u: User): PresenceStatus => {
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
export const getPresenceText = (u: User): string => {
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
export const getPresenceDotColor = (u: User): string | null => {
  const status = derivePresenceStatus(u);
  if (status === 'online') return '#22c55e'; // green-500
  if (status === 'away') return '#f59e0b'; // amber-500
  return null; // offline — no dot
};

/**
 * Validate message text before sending
 * Checks for length and content requirements
 */
export const validateMessage = (text: string): { valid: boolean; error?: string } => {
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
export const renderFormattedText = (text: string): React.ReactNode => {
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
        <a key={`link-${key++}`} href={urlMatch[0]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--aurora-accent)', textDecoration: 'underline', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
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

/**
 * Compress an image file to base64 data URL for inline Firestore storage
 */
export const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
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
