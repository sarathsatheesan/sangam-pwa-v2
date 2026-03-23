'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  where,
  limit,
  onSnapshot,
  setDoc,
  getDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { FORUM_TOPICS, HERITAGE_OPTIONS, REPORT_REASONS } from '@/constants/config';
import type { ForumTopic } from '@/constants/config';
import { moderateContent, smartFilter } from '@/utils/contentModeration';
import type { ModerationResult } from '@/utils/contentModeration';
import { sanitizeText, sanitizeURL } from '@/utils/sanitize';
import { ClickOutsideOverlay } from '@/components/ClickOutsideOverlay';
import {
  MessageSquare, Heart, Share2, Bookmark,
  MoreHorizontal, ChevronLeft, ChevronDown, ChevronUp, Plus, X,
  Send, Search, SlidersHorizontal, TrendingUp, Clock, Flame,
  MessageCircle, Pin, Flag, Trash2, Edit3, Eye, Users,
  Loader2, AlertTriangle, Filter, Hash, ArrowUp, ArrowDown,
  ThumbsUp, Award, Sparkles, ChevronRight, CornerDownRight,
  Shield, Ban, CheckCircle, XCircle, Reply, Trophy, CheckCircle2
} from 'lucide-react';

/* ─── constants ─── */
const THREAD_FLAIRS = [
  { id: 'discussion', label: 'Discussion', emoji: '💬', color: 'bg-indigo-500 text-white dark:bg-indigo-600 dark:text-white' },
  { id: 'question', label: 'Question', emoji: '❓', color: 'bg-blue-500 text-white dark:bg-blue-600 dark:text-white' },
  { id: 'advice', label: 'Advice', emoji: '💡', color: 'bg-emerald-500 text-white dark:bg-emerald-600 dark:text-white' },
  { id: 'news', label: 'News', emoji: '📰', color: 'bg-amber-500 text-white dark:bg-amber-600 dark:text-white' },
  { id: 'event', label: 'Event', emoji: '📅', color: 'bg-purple-500 text-white dark:bg-purple-600 dark:text-white' },
];

const FORUM_REPORT_CATEGORIES = [
  { id: 'spam', label: 'Spam or Misleading', icon: '🚫', description: 'Unwanted promotional, repetitive, or misleading content' },
  { id: 'harassment', label: 'Harassment or Bullying', icon: '🛑', description: 'Threatening, abusive, or intimidating posts or replies' },
  { id: 'hate_speech', label: 'Hate Speech', icon: '⚠️', description: 'Content targeting race, ethnicity, religion, gender, or identity' },
  { id: 'inappropriate', label: 'Inappropriate Content', icon: '🔞', description: 'Sexual, violent, or graphic content not suitable for the community' },
  { id: 'misinformation', label: 'Misinformation', icon: '❌', description: 'False or misleading information that could cause harm' },
  { id: 'scam', label: 'Scam or Fraud', icon: '🎣', description: 'Phishing, financial fraud, or deceptive schemes' },
  { id: 'other', label: 'Other', icon: '📋', description: 'Something else that violates community guidelines' },
];

/* ─── types ─── */
interface ForumThread {
  id: string;
  topicId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  heritage: string[];
  replyCount: number;
  lastReplyAt: any;
  likes: number;
  upvotes?: number;
  downvotes?: number;
  voteScore?: number;
  isPinned: boolean;
  isFlagged: boolean;
  isRemoved: boolean;
  createdAt: any;
  flair?: string;
  acceptedReplyId?: string;
}

interface ForumReply {
  id: string;
  threadId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  heritage: string[];
  likes: number;
  upvotes?: number;
  downvotes?: number;
  voteScore?: number;
  isFlagged: boolean;
  isRemoved: boolean;
  createdAt: any;
  parentReplyId?: string;
  parentAuthorName?: string;
  depth?: number;
  isAccepted?: boolean;
}

interface TopicWithCount {
  id: string;
  name: string;
  icon: string;
  description: string;
  threadCount: number;
}

type ViewMode = 'topics' | 'threads' | 'detail';
type SortBy = 'newest' | 'topScore' | 'hot';

/* ─── helpers ─── */
const timeAgo = (timestamp: any): string => {
  if (!timestamp) return '';
  const now = new Date();
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
};

const formatCount = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const getAgeInHours = (timestamp: any): number => {
  if (!timestamp) return 1;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  return Math.max(1, Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60)));
};

const calculateHotScore = (voteScore: number, replyCount: number, timestamp: any): number => {
  const ageInHours = getAgeInHours(timestamp);
  return (voteScore + replyCount * 2) / Math.pow(ageInHours + 2, 1.5);
};

// Rich text rendering with URL and hashtag detection
const renderForumContent = (content: string): React.ReactElement[] => {
  const elements: React.ReactElement[] = [];
  let lastIndex = 0;

  // Combined regex for URLs, hashtags, bold, and italic
  const urlRegex = /https?:\/\/[^\s]+/g;
  const hashtagRegex = /#\w+/g;
  const boldRegex = /\*\*(.+?)\*\*/g;
  const italicRegex = /\*(.+?)\*/g;

  // Find all matches and their positions
  const matches: Array<{ type: string; match: string; index: number; endIndex: number }> = [];

  let urlMatch;
  while ((urlMatch = urlRegex.exec(content)) !== null) {
    matches.push({ type: 'url', match: urlMatch[0], index: urlMatch.index, endIndex: urlMatch.index + urlMatch[0].length });
  }

  let hashtagMatch;
  while ((hashtagMatch = hashtagRegex.exec(content)) !== null) {
    matches.push({ type: 'hashtag', match: hashtagMatch[0], index: hashtagMatch.index, endIndex: hashtagMatch.index + hashtagMatch[0].length });
  }

  // Sort by position
  matches.sort((a, b) => a.index - b.index);

  // Build elements with text between matches
  matches.forEach((match, idx) => {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      elements.push(<span key={`text-${idx}`}>{text}</span>);
    }

    if (match.type === 'url') {
      elements.push(
        <a
          key={`url-${idx}`}
          href={match.match}
          target="_blank"
          rel="noopener noreferrer"
          className="text-aurora-indigo underline hover:text-aurora-indigo/80"
        >
          {match.match}
        </a>
      );
    } else if (match.type === 'hashtag') {
      elements.push(
        <span key={`hashtag-${idx}`} className="text-aurora-indigo font-medium">
          {match.match}
        </span>
      );
    }

    lastIndex = match.endIndex;
  });

  // Add remaining text
  if (lastIndex < content.length) {
    elements.push(<span key={`text-final`}>{content.slice(lastIndex)}</span>);
  }

  return elements.length === 0 ? [<span key="empty">{content}</span>] : elements;
};

/* ─── sub-components ─── */

function VotingButtons({
  score = 0,
  userVote = null,
  onUpvote,
  onDownvote,
  disabled,
  size = 'md',
}: {
  score: number;
  userVote?: 'up' | 'down' | null;
  onUpvote: () => void;
  onDownvote: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const iconSize = size === 'sm' ? 16 : 18;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); onUpvote(); }}
        disabled={disabled}
        className={`p-1 rounded-md transition-all ${
          userVote === 'up'
            ? 'text-orange-500 bg-orange-500/10'
            : 'text-[var(--aurora-text-muted)] hover:text-orange-500 hover:bg-orange-500/5'
        } disabled:opacity-40`}
      >
        <ChevronUp size={iconSize} className={userVote === 'up' ? 'fill-current' : ''} />
      </button>

      <span className={`font-semibold tabular-nums ${size === 'sm' ? 'text-xs w-6 text-center' : 'text-sm w-8 text-center'} ${
        score > 0 ? 'text-orange-500' : score < 0 ? 'text-red-500' : 'text-[var(--aurora-text-secondary)]'
      }`}>
        {formatCount(score)}
      </span>

      <button
        onClick={(e) => { e.stopPropagation(); onDownvote(); }}
        disabled={disabled}
        className={`p-1 rounded-md transition-all ${
          userVote === 'down'
            ? 'text-red-500 bg-red-500/10'
            : 'text-[var(--aurora-text-muted)] hover:text-red-500 hover:bg-red-500/5'
        } disabled:opacity-40`}
      >
        <ChevronDown size={iconSize} className={userVote === 'down' ? 'fill-current' : ''} />
      </button>
    </div>
  );
}

function Avatar({
  name,
  avatar,
  size = 'md',
}: {
  name: string;
  avatar?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-11 h-11 text-base' : 'w-9 h-9 text-sm';
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const bgColors = ['bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-teal-500'];
  const bgColor = bgColors[initial.charCodeAt(0) % bgColors.length];

  if (avatar && (avatar.startsWith('http') || avatar.startsWith('data:'))) {
    return <img src={avatar} alt="" className={`${dims} rounded-full object-cover`} />;
  }

  return (
    <div className={`${dims} ${bgColor} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initial}
    </div>
  );
}

function HeritageBadge({ heritage }: { heritage: string }) {
  return (
    <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
      {heritage}
    </span>
  );
}

function TopicBadge({ topic }: { topic: TopicWithCount | ForumTopic }) {
  return (
    <span className="text-[10px] bg-aurora-indigo/10 text-aurora-indigo px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
      <Hash size={9} /> {topic.name}
    </span>
  );
}

function FlairBadge({ flairId }: { flairId?: string }) {
  if (!flairId) return null;
  const flair = THREAD_FLAIRS.find((f) => f.id === flairId);
  if (!flair) return null;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${flair.color}`}>
      {flair.emoji} {flair.label}
    </span>
  );
}

function KarmaBadge({ karma }: { karma: number }) {
  let color = 'text-gray-400';
  let tier = 'New';

  if (karma > 200) {
    color = 'text-yellow-500';
    tier = 'Leader';
  } else if (karma > 50) {
    color = 'text-gray-500';
    tier = 'Trusted';
  } else if (karma > 10) {
    color = 'text-amber-600';
    tier = 'Active';
  }

  return (
    <span className={`text-[10px] font-medium flex items-center gap-0.5 ${color}`} title={`Karma: ${karma} (${tier})`}>
      <Award size={10} /> {karma}
    </span>
  );
}

function SkeletonPost() {
  return (
    <div className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[var(--aurora-surface-variant)]" />
        <div className="h-3 bg-[var(--aurora-surface-variant)] rounded w-24" />
        <div className="h-3 bg-[var(--aurora-surface-variant)] rounded w-12" />
      </div>
      <div className="h-5 bg-[var(--aurora-surface-variant)] rounded w-3/4" />
      <div className="h-3 bg-[var(--aurora-surface-variant)] rounded w-full" />
      <div className="h-3 bg-[var(--aurora-surface-variant)] rounded w-2/3" />
      <div className="flex gap-4 pt-2">
        <div className="h-4 bg-[var(--aurora-surface-variant)] rounded w-12" />
        <div className="h-4 bg-[var(--aurora-surface-variant)] rounded w-16" />
        <div className="h-4 bg-[var(--aurora-surface-variant)] rounded w-12" />
      </div>
    </div>
  );
}

/* ─── main component ─── */
export default function ForumScreen() {
  const { user, userProfile, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  /* view state */
  const [viewMode, setViewMode] = useState<ViewMode>('topics');
  const [selectedTopic, setSelectedTopic] = useState<TopicWithCount | null>(null);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [heritageFilter, setHeritageFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedFlair, setSelectedFlair] = useState<string>('All');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyingToName, setReplyingToName] = useState<string | null>(null);

  /* data state */
  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [karmaMap, setKarmaMap] = useState<Map<string, number>>(new Map());

  /* modal state */
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportingContent, setReportingContent] = useState<{
    contentId: string;
    contentType: 'thread' | 'reply';
  } | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  /* enhanced report modal state */
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  /* block user state */
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockTargetUser, setBlockTargetUser] = useState<{ uid: string; name: string } | null>(null);

  /* form state */
  const [threadTitle, setThreadTitle] = useState('');
  const [threadContent, setThreadContent] = useState('');
  const [threadFlair, setThreadFlair] = useState<string>('discussion');
  const [replyContent, setReplyContent] = useState('');
  const [showReplyBar, setShowReplyBar] = useState(false);
  const [collapsedReplies, setCollapsedReplies] = useState<Set<string>>(new Set());
  const [reportReason, setReportReason] = useState<string>('');
  const [reportDetails, setReportDetails] = useState('');
  const [likingInProgress, setLikingInProgress] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* vote tracking */
  const [upvotedThreadIds, setUpvotedThreadIds] = useState<Set<string>>(new Set());
  const [downvotedThreadIds, setDownvotedThreadIds] = useState<Set<string>>(new Set());
  const [upvotedReplyIds, setUpvotedReplyIds] = useState<Set<string>>(new Set());
  const [downvotedReplyIds, setDownvotedReplyIds] = useState<Set<string>>(new Set());

  /* legacy like support */
  const [likedThreadIds, setLikedThreadIds] = useState<Set<string>>(new Set());
  const [likedReplyIds, setLikedReplyIds] = useState<Set<string>>(new Set());

  /* custom modal/toast state (replaces native confirm/alert) */
  const [showDeleteThreadConfirm, setShowDeleteThreadConfirm] = useState(false);
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const [showDeleteReplyConfirm, setShowDeleteReplyConfirm] = useState(false);
  const [deleteReplyInfo, setDeleteReplyInfo] = useState<{ replyId: string; threadId?: string } | null>(null);
  const [showContentWarning, setShowContentWarning] = useState(false);
  const [contentWarningMessage, setContentWarningMessage] = useState('');
  const [contentWarningCallback, setContentWarningCallback] = useState<(() => Promise<void>) | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [savedThreads, setSavedThreads] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('savedForumThreads') || '[]')); }
    catch { return new Set(); }
  });

  /* saved persistence */
  useEffect(() => {
    localStorage.setItem('savedForumThreads', JSON.stringify([...savedThreads]));
  }, [savedThreads]);

  // useClickOutside hook replaced with ClickOutsideOverlay component in JSX

  const toggleSaveThread = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSavedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /* ─── data loaders ─── */
  const loadTopics = useCallback(async () => {
    try {
      setLoading(true);
      const initialTopics = FORUM_TOPICS.map((topic: ForumTopic) => ({ ...topic, threadCount: 0 }));
      setTopics(initialTopics);
      const allThreadsSnapshot = await getDocs(query(collection(db, 'forumThreads')));
      const countMap: Record<string, number> = {};
      allThreadsSnapshot.docs.forEach((d) => {
        const data = d.data();
        if (!data.isRemoved) countMap[data.topicId] = (countMap[data.topicId] || 0) + 1;
      });
      const topicsWithCounts = FORUM_TOPICS.map((topic: ForumTopic) => ({
        ...topic,
        threadCount: countMap[topic.id] || 0,
      }));
      setTopics(topicsWithCounts);
    } catch (error) {
      console.error('Error loading topics:', error instanceof Error ? error.message : 'Unknown error');
      setTopics(FORUM_TOPICS.map((topic: ForumTopic) => ({ ...topic, threadCount: 0 })));
    } finally {
      setLoading(false);
    }
  }, []);

  const buildReplyTree = (replyList: ForumReply[]): ForumReply[] => {
    // Group children by parentReplyId
    const childMap = new Map<string, ForumReply[]>();
    const topLevel: ForumReply[] = [];

    // Sort all replies by creation time first
    const sorted = [...replyList].sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(0);
      const bTime = b.createdAt?.toDate?.() || new Date(0);
      return aTime.getTime() - bTime.getTime();
    });

    sorted.forEach((reply) => {
      if (!reply.parentReplyId) {
        topLevel.push(reply);
      } else {
        const children = childMap.get(reply.parentReplyId) || [];
        children.push(reply);
        childMap.set(reply.parentReplyId, children);
      }
    });

    // Flatten tree: parent followed by its children recursively
    const result: ForumReply[] = [];
    const addWithChildren = (reply: ForumReply) => {
      result.push(reply);
      const children = childMap.get(reply.id) || [];
      children.forEach((child) => addWithChildren(child));
    };
    topLevel.forEach((reply) => addWithChildren(reply));

    return result;
  };

  // Load user's votes for threads — cleans up old docs AND resets corrupted scores
  const loadThreadVotes = useCallback(async (threadIds: string[]) => {
    if (!user?.uid || threadIds.length === 0) return;
    try {
      const upvoted = new Set<string>();
      const downvoted = new Set<string>();
      await Promise.all(threadIds.map(async (threadId) => {
        const threadDocRef = doc(db, 'forumThreads', threadId);
        const likesCollRef = collection(threadDocRef, 'forumLikes');

        // Read ALL vote docs in this thread's subcollection
        const allVotes = await getDocs(likesCollRef);
        let foundVoteType: string | null = null;
        const toDelete: Promise<void>[] = [];
        let correctScore = 0;

        // Group by userId to find duplicates
        const userVoteMap = new Map<string, { docId: string; voteType: string; ref: any }[]>();
        allVotes.docs.forEach((d) => {
          const data = d.data();
          const uid = data.userId;
          if (!uid) { toDelete.push(deleteDoc(d.ref)); return; } // orphan doc
          const arr = userVoteMap.get(uid) || [];
          arr.push({ docId: d.id, voteType: data.voteType, ref: d.ref });
          userVoteMap.set(uid, arr);
        });

        // For each user, keep only the deterministic doc (id === userId), delete the rest
        userVoteMap.forEach((docs, uid) => {
          let kept: { voteType: string } | null = null;
          // Prefer the deterministic doc
          const detDoc = docs.find((d) => d.docId === uid);
          if (detDoc) {
            kept = detDoc;
            // Delete all non-deterministic docs for this user
            docs.forEach((d) => { if (d.docId !== uid) toDelete.push(deleteDoc(d.ref)); });
          } else {
            // No deterministic doc — keep the first, delete the rest, migrate
            kept = docs[0];
            docs.slice(1).forEach((d) => toDelete.push(deleteDoc(d.ref)));
          }

          if (kept) {
            if (kept.voteType === 'up') correctScore++;
            else if (kept.voteType === 'down') correctScore--;
          }

          // Track current user's vote
          if (uid === user.uid && kept) {
            foundVoteType = kept.voteType;
          }
        });

        // Execute all deletions
        if (toDelete.length > 0) await Promise.all(toDelete);

        // Migrate current user's vote to deterministic doc if needed
        if (foundVoteType && !allVotes.docs.some((d) => d.id === user.uid)) {
          await setDoc(doc(likesCollRef, user.uid), { userId: user.uid, voteType: foundVoteType, createdAt: serverTimestamp() });
        }

        // Fix the thread's score to the correct absolute value
        await updateDoc(threadDocRef, { voteScore: correctScore, likes: correctScore });

        if (foundVoteType === 'up') upvoted.add(threadId);
        else if (foundVoteType === 'down') downvoted.add(threadId);

        // Update local thread state with corrected score
        setThreads((prev) => prev.map((t) => t.id === threadId ? { ...t, voteScore: correctScore, likes: correctScore } : t));
        if (selectedThread?.id === threadId) {
          setSelectedThread((prev) => prev ? { ...prev, voteScore: correctScore, likes: correctScore } : null);
        }
      }));
      setUpvotedThreadIds(upvoted);
      setDownvotedThreadIds(downvoted);
    } catch (error) {
      console.error('Error loading thread votes:', error);
    }
  }, [user?.uid]);

  // Load user's votes for replies — cleans up old docs AND resets corrupted scores
  const loadReplyVotes = useCallback(async (replyIds: string[]) => {
    if (!user?.uid || replyIds.length === 0) return;
    try {
      const upvoted = new Set<string>();
      const downvoted = new Set<string>();
      await Promise.all(replyIds.map(async (replyId) => {
        const replyDocRef = doc(db, 'forumReplies', replyId);
        const likesCollRef = collection(replyDocRef, 'forumLikes');

        const allVotes = await getDocs(likesCollRef);
        let foundVoteType: string | null = null;
        const toDelete: Promise<void>[] = [];
        let correctScore = 0;

        const userVoteMap = new Map<string, { docId: string; voteType: string; ref: any }[]>();
        allVotes.docs.forEach((d) => {
          const data = d.data();
          const uid = data.userId;
          if (!uid) { toDelete.push(deleteDoc(d.ref)); return; }
          const arr = userVoteMap.get(uid) || [];
          arr.push({ docId: d.id, voteType: data.voteType, ref: d.ref });
          userVoteMap.set(uid, arr);
        });

        userVoteMap.forEach((docs, uid) => {
          let kept: { voteType: string } | null = null;
          const detDoc = docs.find((d) => d.docId === uid);
          if (detDoc) {
            kept = detDoc;
            docs.forEach((d) => { if (d.docId !== uid) toDelete.push(deleteDoc(d.ref)); });
          } else {
            kept = docs[0];
            docs.slice(1).forEach((d) => toDelete.push(deleteDoc(d.ref)));
          }

          if (kept) {
            if (kept.voteType === 'up') correctScore++;
            else if (kept.voteType === 'down') correctScore--;
          }

          if (uid === user.uid && kept) {
            foundVoteType = kept.voteType;
          }
        });

        if (toDelete.length > 0) await Promise.all(toDelete);

        if (foundVoteType && !allVotes.docs.some((d) => d.id === user.uid)) {
          await setDoc(doc(likesCollRef, user.uid), { userId: user.uid, voteType: foundVoteType, createdAt: serverTimestamp() });
        }

        await updateDoc(replyDocRef, { voteScore: correctScore, likes: correctScore });

        if (foundVoteType === 'up') upvoted.add(replyId);
        else if (foundVoteType === 'down') downvoted.add(replyId);

        // Update local reply state with corrected score
        setReplies((prev) => prev.map((r) => r.id === replyId ? { ...r, voteScore: correctScore, likes: correctScore } : r));
      }));
      setUpvotedReplyIds(upvoted);
      setDownvotedReplyIds(downvoted);
    } catch (error) {
      console.error('Error loading reply votes:', error);
    }
  }, [user?.uid]);

  const loadThreads = useCallback(async () => {
    if (!selectedTopic) return;
    try {
      setLoading(true);
      const threadsQuery = query(
        collection(db, 'forumThreads'),
        where('topicId', '==', selectedTopic.id),
        limit(50)
      );
      const snapshot = await getDocs(threadsQuery);
      let threadsList: ForumThread[] = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as ForumThread))
        .filter((t) => !t.isRemoved)
        .filter((t) => !blockedUsers.has(t.authorId));

      // Calculate karma map
      const karmaMapTemp = new Map<string, number>();
      threadsList.forEach((thread) => {
        const score = thread.voteScore !== undefined ? thread.voteScore : thread.likes || 0;
        karmaMapTemp.set(thread.authorId, (karmaMapTemp.get(thread.authorId) || 0) + score);
      });
      setKarmaMap(karmaMapTemp);

      // Apply flair filter
      if (selectedFlair !== 'All') {
        threadsList = threadsList.filter((t) => t.flair === selectedFlair);
      }

      // Sort threads
      threadsList.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        const aScore = a.voteScore !== undefined ? a.voteScore : a.likes || 0;
        const bScore = b.voteScore !== undefined ? b.voteScore : b.likes || 0;

        if (sortBy === 'topScore') return bScore - aScore;
        if (sortBy === 'hot') {
          const aHot = calculateHotScore(aScore, a.replyCount, a.createdAt);
          const bHot = calculateHotScore(bScore, b.replyCount, b.createdAt);
          return bHot - aHot;
        }
        // newest
        const aTime = a.lastReplyAt?.toDate?.() || new Date(0);
        const bTime = b.lastReplyAt?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime();
      });

      if (heritageFilter.length > 0) {
        threadsList = threadsList.filter((thread) =>
          thread.heritage?.some((h) => heritageFilter.includes(h))
        );
      }

      setThreads(threadsList);
      // Load user's votes for these threads
      if (user?.uid && threadsList.length > 0) {
        loadThreadVotes(threadsList.map((t) => t.id));
      }
    } catch (error) {
      console.error('Error loading threads:', error instanceof Error ? error.message : 'Unknown error');
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTopic, heritageFilter, sortBy, selectedFlair, user?.uid, loadThreadVotes, blockedUsers]);

  const loadReplies = useCallback(async () => {
    if (!selectedThread) return;
    try {
      const repliesQuery = query(
        collection(db, 'forumReplies'),
        where('threadId', '==', selectedThread.id),
        limit(100)
      );
      const snapshot = await getDocs(repliesQuery);
      const repliesList: ForumReply[] = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as ForumReply))
        .filter((r) => !r.isRemoved)
        .filter((r) => !blockedUsers.has(r.authorId));

      // Build reply tree
      const treeReplies = buildReplyTree(repliesList);
      setReplies(treeReplies);
      // Load user's votes for these replies
      if (user?.uid && repliesList.length > 0) {
        loadReplyVotes(repliesList.map((r) => r.id));
      }
    } catch (error) {
      console.error('Error loading replies:', error instanceof Error ? error.message : 'Unknown error');
      setReplies([]);
    }
  }, [selectedThread, user?.uid, loadReplyVotes]);

  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { if (viewMode === 'threads' && selectedTopic) loadThreads(); }, [viewMode, selectedTopic, loadThreads]);
  useEffect(() => { if (viewMode === 'detail' && selectedThread) loadReplies(); }, [viewMode, selectedThread, loadReplies]);

  // Load blocked users
  useEffect(() => {
    if (!user?.uid) return;
    const loadBlockedUsers = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.blockedUsers) setBlockedUsers(new Set(data.blockedUsers));
        }
      } catch (error) {
        console.error('Error loading blocked users:', error);
      }
    };
    loadBlockedUsers();
  }, [user?.uid]);

  // Deep-link: open specific thread from profile activity
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;
    setSearchParams({}, { replace: true });
    // Fetch thread directly from Firestore since threads may not be loaded yet
    (async () => {
      try {
        const threadDoc = await getDoc(doc(db, 'forumThreads', openId));
        if (threadDoc.exists()) {
          const data = threadDoc.data();
          const thread: ForumThread = {
            id: threadDoc.id,
            topicId: data.topicId || '',
            title: data.title || '',
            content: data.content || '',
            authorId: data.authorId || '',
            authorName: data.authorName || '',
            authorAvatar: data.authorAvatar || '🧑',
            createdAt: data.createdAt,
            lastReplyAt: data.lastReplyAt || data.createdAt,
            replyCount: data.replyCount || 0,
            voteScore: data.voteScore || 0,
            likes: data.likes || data.voteScore || 0,
            isPinned: data.isPinned || false,
            isFlagged: data.isFlagged || false,
            isRemoved: data.isRemoved || false,
            heritage: data.heritage || [],
            flair: data.flair,
            acceptedReplyId: data.acceptedReplyId,
          };
          setSelectedThread(thread);
          setViewMode('detail');
        }
      } catch (err) {
        console.error('Deep-link: error fetching thread', err);
      }
    })();
  }, [searchParams, setSearchParams]);

  /* toast auto-dismiss */
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  /* ─── action handlers ─── */
  const handleCreateThread = useCallback(async () => {
    if (!user) { setToastMessage('Please sign in to create a thread'); return; }
    if (!userProfile) { setToastMessage('Your profile is still loading. Please try again in a moment.'); return; }
    if (!selectedTopic) return;
    if (!threadTitle.trim() || !threadContent.trim()) { setToastMessage('Please fill in both title and content'); return; }

    const proceedWithPost = async () => {
      try {
        setSubmitting(true);
        const enableModeration = false as boolean;
        let moderation: ModerationResult | null = null;
        if (enableModeration) {
          moderation = moderateContent(threadTitle + ' ' + threadContent);
          if (moderation && moderation.severity === 'high') {
            setToastMessage(moderation.message || 'Your post was blocked due to policy violations');
            return;
          }
        }
        const heritage = Array.isArray(userProfile.heritage) ? userProfile.heritage : userProfile.heritage ? [userProfile.heritage] : [];
        const threadRef = await addDoc(collection(db, 'forumThreads'), {
          topicId: selectedTopic.id,
          title: sanitizeText(threadTitle),
          content: sanitizeText(threadContent),
          authorId: user.uid,
          authorName: userProfile.name || 'Anonymous',
          authorAvatar: userProfile.avatar || '',
          heritage,
          replyCount: 0,
          lastReplyAt: serverTimestamp(),
          likes: 0,
          upvotes: 0,
          downvotes: 0,
          voteScore: 0,
          isPinned: false,
          isFlagged: moderation ? moderation.severity === 'medium' || moderation.severity === 'low' : false,
          isRemoved: false,
          createdAt: serverTimestamp(),
          flair: threadFlair,
        });
        if (moderation && (moderation.severity === 'medium' || moderation.severity === 'low')) {
          await addDoc(collection(db, 'moderationQueue'), {
            contentId: threadRef.id, contentType: 'thread', authorId: user.uid,
            authorName: userProfile.name || 'Anonymous', content: threadTitle + ' ' + threadContent,
            topicId: selectedTopic.id, flaggedCategories: moderation.flaggedCategories,
            severity: moderation.severity, flaggedWords: moderation.flaggedWords,
            status: 'pending', createdAt: serverTimestamp(),
          });
        }
        setThreadTitle(''); setThreadContent(''); setThreadFlair('discussion'); setShowCreateThread(false);
        await loadThreads(); await loadTopics();
      } catch (error) {
        console.error('Error creating thread:', error instanceof Error ? error.message : 'Unknown error');
        setToastMessage('Failed to create thread. Please try again.');
      } finally { setSubmitting(false); }
    };

    try {
      setSubmitting(true);
      const enableSmartFilter = false as boolean;
      if (enableSmartFilter) {
        const filterResult = smartFilter(threadTitle + ' ' + threadContent);
        if (filterResult.recommendation === 'block') { setToastMessage(filterResult.friendlyMessage); setSubmitting(false); return; }
        if (filterResult.recommendation === 'warn') { setSubmitting(false); setContentWarningMessage(filterResult.friendlyMessage); setContentWarningCallback(() => proceedWithPost); setShowContentWarning(true); return; }
      }
      setSubmitting(false);
      await proceedWithPost();
    } catch (error) {
      console.error('Error in thread creation filter:', error instanceof Error ? error.message : 'Unknown error');
      setSubmitting(false);
    }
  }, [user, userProfile, selectedTopic, threadTitle, threadContent, threadFlair, loadThreads, loadTopics]);

  const handleCreateReply = useCallback(async () => {
    if (!user) { setToastMessage('Please sign in to reply'); return; }
    if (!userProfile) { setToastMessage('Your profile is still loading. Please try again in a moment.'); return; }
    if (!selectedThread) return;
    if (!replyContent.trim()) { setToastMessage('Please enter reply content'); return; }

    const proceedWithPost = async () => {
      try {
        setSubmitting(true);
        const enableModeration = false as boolean;
        let moderation: ModerationResult | null = null;
        if (enableModeration) {
          moderation = moderateContent(replyContent);
          if (moderation && moderation.severity === 'high') { setToastMessage(moderation.message || 'Your reply was blocked due to policy violations'); return; }
        }
        const heritage = Array.isArray(userProfile.heritage) ? userProfile.heritage : userProfile.heritage ? [userProfile.heritage] : [];

        // Determine depth
        let depth = 0;
        if (replyingToId) {
          const parentReply = replies.find((r) => r.id === replyingToId);
          depth = Math.min(3, (parentReply?.depth || 0) + 1);
        }

        const replyRef = await addDoc(collection(db, 'forumReplies'), {
          threadId: selectedThread.id, content: sanitizeText(replyContent),
          authorId: user.uid, authorName: userProfile.name || 'Anonymous',
          authorAvatar: userProfile.avatar || '', heritage, likes: 0,
          upvotes: 0, downvotes: 0, voteScore: 0,
          isFlagged: moderation ? moderation.severity === 'medium' || moderation.severity === 'low' : false,
          isRemoved: false, createdAt: serverTimestamp(),
          parentReplyId: replyingToId || undefined,
          parentAuthorName: replyingToName || undefined,
          depth: depth,
        });
        const threadRef = doc(db, 'forumThreads', selectedThread.id);
        await updateDoc(threadRef, { replyCount: increment(1), lastReplyAt: serverTimestamp() });
        if (moderation && (moderation.severity === 'medium' || moderation.severity === 'low')) {
          await addDoc(collection(db, 'moderationQueue'), {
            contentId: replyRef.id, contentType: 'reply', authorId: user.uid,
            authorName: userProfile.name || 'Anonymous', content: replyContent,
            topicId: selectedThread.topicId, flaggedCategories: moderation.flaggedCategories,
            severity: moderation.severity, flaggedWords: moderation.flaggedWords,
            status: 'pending', createdAt: serverTimestamp(),
          });
        }
        // Auto-collapse the parent reply thread after submitting
        if (replyingToId) {
          setCollapsedReplies((prev) => { const n = new Set(prev); n.add(replyingToId); return n; });
        }
        setReplyContent('');
        setReplyingToId(null);
        setReplyingToName(null);
        setShowReplyBar(false);
        await loadReplies();
        setSelectedThread((prev) => prev ? { ...prev, replyCount: prev.replyCount + 1 } : null);
      } catch (error) {
        console.error('Error creating reply:', error instanceof Error ? error.message : 'Unknown error');
        setToastMessage('Failed to create reply. Please try again.');
      } finally { setSubmitting(false); }
    };

    try {
      setSubmitting(true);
      const enableSmartFilter = false as boolean;
      if (enableSmartFilter) {
        const filterResult = smartFilter(replyContent);
        if (filterResult.recommendation === 'block') { setToastMessage(filterResult.friendlyMessage); setSubmitting(false); return; }
        if (filterResult.recommendation === 'warn') { setSubmitting(false); setContentWarningMessage(filterResult.friendlyMessage); setContentWarningCallback(() => proceedWithPost); setShowContentWarning(true); return; }
      }
      setSubmitting(false);
      await proceedWithPost();
    } catch (error) {
      console.error('Error in reply creation filter:', error instanceof Error ? error.message : 'Unknown error');
      setSubmitting(false);
    }
  }, [user, userProfile, selectedThread, replyContent, replyingToId, replyingToName, replies, loadReplies]);

  const openReportModal = useCallback((contentId: string, contentType: 'thread' | 'reply') => {
    setReportingContent({ contentId, contentType });
    setReportReason('');
    setReportDetails('');
    setShowReportModal(true);
    setShowMoreMenu(null);
  }, []);

  const handleSubmitReport = useCallback(async () => {
    if (!user || !reportingContent || !reportReason) { setToastMessage('Please select a reason'); return; }
    setReportSubmitting(true);
    try {
      const reportedThread = threads.find((t) => t.id === reportingContent.contentId);
      const reportedReply = replies.find((r) => r.id === reportingContent.contentId);
      const flaggedContent = reportedThread?.content || reportedReply?.content || '';
      const authorId = reportedThread?.authorId || reportedReply?.authorId || '';
      const authorName = reportedThread?.authorName || reportedReply?.authorName || 'Unknown';
      const authorAvatar = reportedThread?.authorAvatar || reportedReply?.authorAvatar || '';
      const categoryObj = FORUM_REPORT_CATEGORIES.find((c) => c.id === reportReason);

      // Write to reports collection
      await addDoc(collection(db, 'reports'), {
        contentId: reportingContent.contentId,
        contentType: reportingContent.contentType,
        type: reportingContent.contentType === 'thread' ? 'forum_thread' : 'forum_reply',
        reportedBy: user.uid,
        reporterName: user.displayName || userProfile?.name || 'Anonymous',
        reporterAvatar: userProfile?.avatar || '',
        reportedUserId: authorId,
        reportedUserName: authorName,
        category: reportReason,
        categoryLabel: categoryObj?.label || reportReason,
        details: reportDetails.trim() || '',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Write to moderationQueue (check for existing entry)
      const modQueueQuery = query(
        collection(db, 'moderationQueue'),
        where('contentId', '==', reportingContent.contentId)
      );
      const existingMods = await getDocs(modQueueQuery);

      if (existingMods.docs.length > 0) {
        const existingDoc = existingMods.docs[0];
        await updateDoc(doc(db, 'moderationQueue', existingDoc.id), {
          reportCount: (existingDoc.data().reportCount || 1) + 1,
          reporters: arrayUnion({
            uid: user.uid,
            name: user.displayName || userProfile?.name || 'Anonymous',
            category: reportReason,
            details: reportDetails.trim() || '',
            createdAt: new Date().toISOString(),
          }),
        });
      } else {
        await addDoc(collection(db, 'moderationQueue'), {
          type: reportingContent.contentType === 'thread' ? 'forum_thread' : 'forum_reply',
          content: flaggedContent.substring(0, 500),
          contentId: reportingContent.contentId,
          collection: reportingContent.contentType === 'thread' ? 'forumThreads' : 'forumReplies',
          authorId,
          authorName,
          authorAvatar,
          category: reportReason,
          categoryLabel: categoryObj?.label || reportReason,
          reason: `${categoryObj?.label || reportReason}${reportDetails.trim() ? ': ' + reportDetails.trim() : ''}`,
          reportedBy: user.uid,
          reporterName: user.displayName || userProfile?.name || 'Anonymous',
          reportCount: 1,
          reporters: [{
            uid: user.uid,
            name: user.displayName || userProfile?.name || 'Anonymous',
            category: reportReason,
            details: reportDetails.trim() || '',
            createdAt: new Date().toISOString(),
          }],
          createdAt: serverTimestamp(),
        });
      }

      setReportReason(''); setReportDetails(''); setReportingContent(null); setShowReportModal(false);
      setToastMessage('Report submitted. Thank you for helping keep our community safe.');
    } catch (error) {
      console.error('Error submitting report:', error instanceof Error ? error.message : 'Unknown error');
      setToastMessage('Failed to submit report. Please try again.');
    } finally {
      setReportSubmitting(false);
    }
  }, [user, userProfile, reportingContent, reportReason, reportDetails, threads, replies]);

  const openBlockConfirm = useCallback((uid: string, name: string) => {
    setBlockTargetUser({ uid, name });
    setShowBlockConfirm(true);
    setShowMoreMenu(null);
  }, []);

  const handleBlockUser = useCallback(async () => {
    if (!user || !blockTargetUser) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: arrayUnion(blockTargetUser.uid),
      });
      setBlockedUsers((prev) => new Set(prev).add(blockTargetUser.uid));
      setShowBlockConfirm(false);
      setBlockTargetUser(null);
      setToastMessage(`${blockTargetUser.name} has been blocked. You can unblock them from your Profile page.`);
    } catch (error) {
      console.error('Error blocking user:', error);
      setToastMessage('Failed to block user. Please try again.');
    }
  }, [user, blockTargetUser]);

  const handleVoteThread = useCallback(async (threadId: string, voteType: 'up' | 'down') => {
    if (!user || likingInProgress) return;
    setLikingInProgress(threadId);

    // 1) Determine current vote from LOCAL state (no Firestore read)
    const currentVoteType = upvotedThreadIds.has(threadId) ? 'up' : downvotedThreadIds.has(threadId) ? 'down' : null;

    // 2) Compute delta from local state
    let scoreDelta = 0;
    const isToggleOff = currentVoteType === voteType;
    if (isToggleOff) {
      scoreDelta = currentVoteType === 'up' ? -1 : 1;
    } else if (currentVoteType === null) {
      scoreDelta = voteType === 'up' ? 1 : -1;
    } else {
      scoreDelta = voteType === 'up' ? 2 : -2;
    }

    // 3) Immediately update local UI (before any Firestore calls)
    const newVote = isToggleOff ? null : voteType;
    setThreads((prev) => prev.map((t) => {
      if (t.id !== threadId) return t;
      const newScore = (t.voteScore ?? t.likes ?? 0) + scoreDelta;
      return { ...t, voteScore: newScore, likes: newScore };
    }));
    if (selectedThread?.id === threadId) {
      setSelectedThread((prev) => {
        if (!prev) return null;
        const newScore = (prev.voteScore ?? prev.likes ?? 0) + scoreDelta;
        return { ...prev, voteScore: newScore, likes: newScore };
      });
    }
    setUpvotedThreadIds((prev) => { const n = new Set(prev); n.delete(threadId); if (newVote === 'up') n.add(threadId); return n; });
    setDownvotedThreadIds((prev) => { const n = new Set(prev); n.delete(threadId); if (newVote === 'down') n.add(threadId); return n; });

    // 4) Persist to Firestore in background
    try {
      const threadRef = doc(db, 'forumThreads', threadId);
      const likesCollRef = collection(threadRef, 'forumLikes');
      const voteDocRef = doc(likesCollRef, user.uid);

      // Clean up old random-ID vote docs
      const oldVotes = await getDocs(query(likesCollRef, where('userId', '==', user.uid)));
      const toDelete: Promise<void>[] = [];
      oldVotes.docs.forEach((d) => { if (d.id !== user.uid) toDelete.push(deleteDoc(d.ref)); });
      if (toDelete.length > 0) await Promise.all(toDelete);

      // Write or delete the vote doc
      if (isToggleOff) {
        await deleteDoc(voteDocRef);
      } else {
        await setDoc(voteDocRef, { userId: user.uid, voteType, createdAt: serverTimestamp() });
      }

      // Update thread score using increment (atomic, no read needed)
      await updateDoc(threadRef, { voteScore: increment(scoreDelta), likes: increment(scoreDelta) });
    } catch (error) {
      console.error('Error voting on thread:', error);
      // Revert local state on error
      setThreads((prev) => prev.map((t) => {
        if (t.id !== threadId) return t;
        const reverted = (t.voteScore ?? t.likes ?? 0) - scoreDelta;
        return { ...t, voteScore: reverted, likes: reverted };
      }));
      if (selectedThread?.id === threadId) {
        setSelectedThread((prev) => {
          if (!prev) return null;
          const reverted = (prev.voteScore ?? prev.likes ?? 0) - scoreDelta;
          return { ...prev, voteScore: reverted, likes: reverted };
        });
      }
      // Revert vote sets
      setUpvotedThreadIds((prev) => { const n = new Set(prev); n.delete(threadId); if (currentVoteType === 'up') n.add(threadId); return n; });
      setDownvotedThreadIds((prev) => { const n = new Set(prev); n.delete(threadId); if (currentVoteType === 'down') n.add(threadId); return n; });
    } finally { setLikingInProgress(null); }
  }, [user, selectedThread, likingInProgress, upvotedThreadIds, downvotedThreadIds]);

  const handleVoteReply = useCallback(async (replyId: string, voteType: 'up' | 'down') => {
    if (!user || !selectedThread || likingInProgress) return;
    setLikingInProgress(replyId);

    // 1) Determine current vote from LOCAL state
    const currentVoteType = upvotedReplyIds.has(replyId) ? 'up' : downvotedReplyIds.has(replyId) ? 'down' : null;

    // 2) Compute delta
    let scoreDelta = 0;
    const isToggleOff = currentVoteType === voteType;
    if (isToggleOff) {
      scoreDelta = currentVoteType === 'up' ? -1 : 1;
    } else if (currentVoteType === null) {
      scoreDelta = voteType === 'up' ? 1 : -1;
    } else {
      scoreDelta = voteType === 'up' ? 2 : -2;
    }

    // 3) Immediately update local UI
    const newVote = isToggleOff ? null : voteType;
    setReplies((prev) => prev.map((r) => {
      if (r.id !== replyId) return r;
      const newScore = (r.voteScore ?? r.likes ?? 0) + scoreDelta;
      return { ...r, voteScore: newScore, likes: newScore };
    }));
    setUpvotedReplyIds((prev) => { const n = new Set(prev); n.delete(replyId); if (newVote === 'up') n.add(replyId); return n; });
    setDownvotedReplyIds((prev) => { const n = new Set(prev); n.delete(replyId); if (newVote === 'down') n.add(replyId); return n; });

    // 4) Persist to Firestore in background
    try {
      const replyRef = doc(db, 'forumReplies', replyId);
      const likesCollRef = collection(replyRef, 'forumLikes');
      const voteDocRef = doc(likesCollRef, user.uid);

      // Clean up old random-ID vote docs
      const oldVotes = await getDocs(query(likesCollRef, where('userId', '==', user.uid)));
      const toDelete: Promise<void>[] = [];
      oldVotes.docs.forEach((d) => { if (d.id !== user.uid) toDelete.push(deleteDoc(d.ref)); });
      if (toDelete.length > 0) await Promise.all(toDelete);

      // Write or delete the vote doc
      if (isToggleOff) {
        await deleteDoc(voteDocRef);
      } else {
        await setDoc(voteDocRef, { userId: user.uid, voteType, createdAt: serverTimestamp() });
      }

      // Update reply score using increment (atomic)
      await updateDoc(replyRef, { voteScore: increment(scoreDelta), likes: increment(scoreDelta) });
    } catch (error) {
      console.error('Error voting on reply:', error);
      // Revert local state on error
      setReplies((prev) => prev.map((r) => {
        if (r.id !== replyId) return r;
        const reverted = (r.voteScore ?? r.likes ?? 0) - scoreDelta;
        return { ...r, voteScore: reverted, likes: reverted };
      }));
      setUpvotedReplyIds((prev) => { const n = new Set(prev); n.delete(replyId); if (currentVoteType === 'up') n.add(replyId); return n; });
      setDownvotedReplyIds((prev) => { const n = new Set(prev); n.delete(replyId); if (currentVoteType === 'down') n.add(replyId); return n; });
    } finally { setLikingInProgress(null); }
  }, [user, selectedThread, likingInProgress, upvotedReplyIds, downvotedReplyIds]);

  const handleAcceptReply = useCallback(async (replyId: string) => {
    if (!user || !selectedThread || selectedThread.authorId !== user.uid) return;
    try {
      const threadRef = doc(db, 'forumThreads', selectedThread.id);
      const replyRef = doc(db, 'forumReplies', replyId);

      // Unmark previous accepted reply if exists
      if (selectedThread.acceptedReplyId) {
        const prevReplyRef = doc(db, 'forumReplies', selectedThread.acceptedReplyId);
        await updateDoc(prevReplyRef, { isAccepted: false });
      }

      // Mark new accepted reply
      await updateDoc(replyRef, { isAccepted: true });
      await updateDoc(threadRef, { acceptedReplyId: replyId });

      setSelectedThread((prev) => prev ? { ...prev, acceptedReplyId: replyId } : null);
      await loadReplies();
    } catch (error) {
      console.error('Error accepting reply:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [user, selectedThread, loadReplies]);

  const handleUnacceptReply = useCallback(async (replyId: string) => {
    if (!user || !selectedThread || selectedThread.authorId !== user.uid) return;
    try {
      const threadRef = doc(db, 'forumThreads', selectedThread.id);
      const replyRef = doc(db, 'forumReplies', replyId);

      await updateDoc(replyRef, { isAccepted: false });
      await updateDoc(threadRef, { acceptedReplyId: undefined });

      setSelectedThread((prev) => prev ? { ...prev, acceptedReplyId: undefined } : null);
      await loadReplies();
    } catch (error) {
      console.error('Error unaccepting reply:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [user, selectedThread, loadReplies]);

  const handleDeleteThread = useCallback((threadId: string, authorId?: string) => {
    if (!isAdmin && (!user || authorId !== user.uid)) return;
    setDeleteThreadId(threadId);
    setShowDeleteThreadConfirm(true);
  }, [isAdmin, user]);

  const confirmDeleteThread = useCallback(async () => {
    if (!deleteThreadId) return;
    try {
      await updateDoc(doc(db, 'forumThreads', deleteThreadId), { isRemoved: true });
      if (viewMode === 'detail') { setViewMode(selectedTopic ? 'threads' : 'topics'); setSelectedThread(null); }
      await loadThreads();
    } catch (error) {
      console.error('Error deleting thread:', error instanceof Error ? error.message : 'Unknown error');
      setToastMessage('Failed to delete thread. Please try again.');
    } finally {
      setShowDeleteThreadConfirm(false);
      setDeleteThreadId(null);
    }
  }, [deleteThreadId, loadThreads, viewMode]);

  const handleDeleteReply = useCallback((replyId: string, authorId?: string, threadId?: string) => {
    if (!isAdmin && (!user || authorId !== user.uid)) return;
    setDeleteReplyInfo({ replyId, threadId });
    setShowDeleteReplyConfirm(true);
  }, [isAdmin, user]);

  const confirmDeleteReply = useCallback(async () => {
    if (!deleteReplyInfo) return;
    try {
      await updateDoc(doc(db, 'forumReplies', deleteReplyInfo.replyId), { isRemoved: true });
      if (deleteReplyInfo.threadId) await updateDoc(doc(db, 'forumThreads', deleteReplyInfo.threadId), { replyCount: increment(-1) });
      await loadReplies();
      setSelectedThread((prev) => prev ? { ...prev, replyCount: Math.max(0, prev.replyCount - 1) } : null);
    } catch (error) {
      console.error('Error deleting reply:', error instanceof Error ? error.message : 'Unknown error');
      setToastMessage('Failed to delete reply. Please try again.');
    } finally {
      setShowDeleteReplyConfirm(false);
      setDeleteReplyInfo(null);
    }
  }, [deleteReplyInfo, loadReplies]);

  const handleShare = async (title: string, content: string) => {
    const text = `${title}\n${content.slice(0, 100)}...`;
    if (navigator.share) {
      try { await navigator.share({ title, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setToastMessage('Copied to clipboard!');
    }
  };

  /* total threads count for header */
  const totalThreads = useMemo(() => topics.reduce((sum, t) => sum + t.threadCount, 0), [topics]);

  /* filtered topics */
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return topics;
    const q = searchQuery.toLowerCase();
    return topics.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }, [topics, searchQuery]);

  /* Helper to get user vote on thread */
  const getUserVoteThread = (threadId: string): 'up' | 'down' | null => {
    if (upvotedThreadIds.has(threadId)) return 'up';
    if (downvotedThreadIds.has(threadId)) return 'down';
    return null;
  };

  /* Helper to get user vote on reply */
  const getUserVoteReply = (replyId: string): 'up' | 'down' | null => {
    if (upvotedReplyIds.has(replyId)) return 'up';
    if (downvotedReplyIds.has(replyId)) return 'down';
    return null;
  };

  /* ═══════ RENDER ═══════ */

  /* ─── Overlay components (modals + toast) ─── */
  const renderOverlays = () => (
    <>
      {/* Delete Thread Confirm Modal */}
      {showDeleteThreadConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => { setShowDeleteThreadConfirm(false); setDeleteThreadId(null); }}>
          <div className="bg-[var(--aurora-surface)] w-full max-w-sm rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="font-bold text-lg text-[var(--aurora-text)] mb-2">Delete Thread?</h3>
              <p className="text-sm text-[var(--aurora-text-muted)] mb-6">This thread will be removed. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteThreadConfirm(false); setDeleteThreadId(null); }} className="flex-1 py-2.5 rounded-xl border border-[var(--aurora-border)] text-sm font-semibold text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-variant)] transition-colors">Cancel</button>
                <button onClick={confirmDeleteThread} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Reply Confirm Modal */}
      {showDeleteReplyConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => { setShowDeleteReplyConfirm(false); setDeleteReplyInfo(null); }}>
          <div className="bg-[var(--aurora-surface)] w-full max-w-sm rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageCircle size={24} className="text-red-500" />
              </div>
              <h3 className="font-bold text-lg text-[var(--aurora-text)] mb-2">Delete Reply?</h3>
              <p className="text-sm text-[var(--aurora-text-muted)] mb-6">This reply will be removed. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteReplyConfirm(false); setDeleteReplyInfo(null); }} className="flex-1 py-2.5 rounded-xl border border-[var(--aurora-border)] text-sm font-semibold text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-variant)] transition-colors">Cancel</button>
                <button onClick={confirmDeleteReply} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Warning Modal */}
      {showContentWarning && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => { setShowContentWarning(false); setContentWarningCallback(null); }}>
          <div className="bg-[var(--aurora-surface)] w-full max-w-sm rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={24} className="text-amber-500" />
              </div>
              <h3 className="font-bold text-lg text-[var(--aurora-text)] mb-2">Content Warning</h3>
              <p className="text-sm text-[var(--aurora-text-muted)] mb-6">{contentWarningMessage}</p>
              <div className="flex gap-3">
                <button onClick={() => { setShowContentWarning(false); setContentWarningCallback(null); }} className="flex-1 py-2.5 rounded-xl border border-[var(--aurora-border)] text-sm font-semibold text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-variant)] transition-colors">Cancel</button>
                <button onClick={async () => { setShowContentWarning(false); if (contentWarningCallback) await contentWarningCallback(); setContentWarningCallback(null); }} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors">Post Anyway</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReportModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Report {reportingContent?.contentType === 'thread' ? 'Thread' : 'Reply'}
              </h3>
              <button onClick={() => setShowReportModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Why are you reporting this {reportingContent?.contentType === 'thread' ? 'thread' : 'reply'}? Your report is confidential.
              </p>
              {FORUM_REPORT_CATEGORIES.map((cat) => (
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
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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

      {/* Block User Confirmation Modal */}
      {showBlockConfirm && blockTargetUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowBlockConfirm(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <Ban className="w-7 h-7 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Block {blockTargetUser.name}?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Their posts, threads, and replies will be hidden. They won&apos;t appear in your discover, events, or other listings. You can unblock them from your Profile page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium max-w-xs text-center">
            {toastMessage}
          </div>
        </div>
      )}
    </>
  );

  /* ─── TOPICS VIEW ─── */
  if (viewMode === 'topics') {
    return (
      <>{renderOverlays()}
      <div className="bg-[var(--aurora-bg)]">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white py-2.5">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold flex items-center gap-1.5">
                  <MessageSquare size={16} className="shrink-0" /> Community Forum
                </h1>
                <p className="text-white/70 text-[10px] sm:text-xs mt-0.5 truncate">Connect, share & discuss with your community</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="rounded-lg px-2.5 py-1 bg-white/20 backdrop-blur text-center">
                  <div className="text-[9px] text-orange-100">Topics</div>
                  <div className="text-base font-bold leading-tight">{topics.length}</div>
                </div>
                <div className="rounded-lg px-2.5 py-1 bg-white/20 backdrop-blur text-center">
                  <div className="text-[9px] text-orange-100">Discussions</div>
                  <div className="text-base font-bold leading-tight">{totalThreads}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Header */}
        <div className="relative bg-gradient-to-br from-orange-500/8 via-aurora-surface to-rose-500/8 border-b border-aurora-border">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-aurora-text-muted" />
              <input
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-aurora-surface border border-aurora-border rounded-full text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Topics grid */}
        <div className="max-w-4xl mx-auto px-4 py-5 pb-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--aurora-surface-variant)]" />
                    <div className="h-4 bg-[var(--aurora-surface-variant)] rounded w-32" />
                  </div>
                  <div className="h-3 bg-[var(--aurora-surface-variant)] rounded w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredTopics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => { setSelectedTopic(topic); setViewMode('threads'); }}
                  className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-4 text-left hover:shadow-lg hover:border-aurora-indigo/30 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[var(--aurora-surface-variant)] flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                      {topic.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-[var(--aurora-text)] text-sm group-hover:text-aurora-indigo transition-colors">{topic.name}</h3>
                        <ChevronRight size={16} className="text-[var(--aurora-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                      <p className="text-xs text-[var(--aurora-text-muted)] mt-0.5 line-clamp-2">{topic.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] font-semibold text-[var(--aurora-text-secondary)] flex items-center gap-1">
                          <MessageCircle size={11} /> {topic.threadCount} threads
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  /* ─── THREADS VIEW ─── */
  if (viewMode === 'threads' && selectedTopic) {
    return (
      <>{renderOverlays()}
      <div className="bg-[var(--aurora-bg)]">
        {/* Topic header */}
        <div className="bg-[var(--aurora-surface)] border-b border-[var(--aurora-border)] sticky top-0 z-30">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => { setViewMode('topics'); setSelectedTopic(null); setSearchQuery(''); }}
                className="w-9 h-9 rounded-full hover:bg-[var(--aurora-surface-variant)] flex items-center justify-center text-[var(--aurora-text-muted)] transition-colors"
              >
                <ChevronLeft size={22} />
              </button>
              <div className="w-9 h-9 rounded-lg bg-[var(--aurora-surface-variant)] flex items-center justify-center text-lg">
                {selectedTopic.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-[var(--aurora-text)] text-sm truncate">{selectedTopic.name}</h2>
                <p className="text-[10px] text-[var(--aurora-text-muted)] truncate">{selectedTopic.description}</p>
              </div>
              <button
                onClick={() => setShowCreateThread(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 text-white rounded-xl font-semibold text-xs hover:bg-orange-600 transition-colors shadow-sm"
              >
                <Plus size={14} /> Post
              </button>
            </div>

            {/* Sort bar */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-t border-[var(--aurora-border)] overflow-x-auto">
              {([
                { key: 'newest', label: 'New', icon: Clock },
                { key: 'topScore', label: 'Top', icon: Trophy },
                { key: 'hot', label: 'Hot', icon: Flame },
              ] as { key: SortBy; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    sortBy === key
                      ? 'bg-aurora-indigo text-white'
                      : 'text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-variant)]'
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}

              <span className="text-[var(--aurora-border)] mx-1">|</span>

              {/* Flair filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {['All', ...THREAD_FLAIRS.map((f) => f.id)].map((flairId) => {
                  const flairLabel = flairId === 'All' ? 'All' : THREAD_FLAIRS.find((f) => f.id === flairId)?.label || flairId;
                  return (
                    <button
                      key={flairId}
                      onClick={() => setSelectedFlair(flairId)}
                      className={`px-2.5 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                        selectedFlair === flairId
                          ? 'bg-orange-500 text-white'
                          : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-muted)] hover:text-[var(--aurora-text-secondary)]'
                      }`}
                    >
                      {flairLabel}
                    </button>
                  );
                })}
              </div>

              <span className="text-[var(--aurora-border)] mx-1">|</span>

              {/* Heritage filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {HERITAGE_OPTIONS.map((heritage: string) => (
                  <button
                    key={heritage}
                    onClick={() => setHeritageFilter((prev) => prev.includes(heritage) ? prev.filter((h) => h !== heritage) : [...prev, heritage])}
                    className={`px-2.5 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                      heritageFilter.includes(heritage)
                        ? 'bg-amber-500 text-white'
                        : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-muted)] hover:text-[var(--aurora-text-secondary)]'
                    }`}
                  >
                    {heritage}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Thread list */}
        <div className="max-w-4xl mx-auto px-4 py-4 pb-4 space-y-3">
          {loading ? (
            <>
              <SkeletonPost />
              <SkeletonPost />
              <SkeletonPost />
            </>
          ) : threads.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-[var(--aurora-surface-variant)] flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={28} className="text-[var(--aurora-text-muted)]" />
              </div>
              <h3 className="font-bold text-[var(--aurora-text)] text-lg">No threads yet</h3>
              <p className="text-sm text-[var(--aurora-text-muted)] mt-1 mb-4">Be the first to start a conversation!</p>
              <button
                onClick={() => setShowCreateThread(true)}
                className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors"
              >
                <Plus size={16} className="inline mr-1" /> Create Thread
              </button>
            </div>
          ) : (
            threads.map((thread) => {
              const userVote = getUserVoteThread(thread.id);
              const isSaved = savedThreads.has(thread.id);
              const threadScore = thread.voteScore ?? thread.likes ?? 0;
              const karma = karmaMap.get(thread.authorId) || 0;

              return (
                <div
                  key={thread.id}
                  className={`bg-[var(--aurora-surface)] rounded-xl border transition-all hover:shadow-md group ${
                    thread.acceptedReplyId ? 'border-green-500/20' : 'border-[var(--aurora-border)] hover:border-aurora-indigo/20'
                  }`}
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => { setSelectedThread(thread); setViewMode('detail'); }}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Avatar name={thread.authorName} avatar={thread.authorAvatar} size="sm" />
                      <span className="text-xs font-semibold text-[var(--aurora-text)]">{thread.authorName}</span>
                      {karma > 0 && <KarmaBadge karma={karma} />}
                      {thread.heritage && thread.heritage.length > 0 && (
                        <HeritageBadge heritage={thread.heritage[0]} />
                      )}
                      {thread.flair && <FlairBadge flairId={thread.flair} />}
                      <span className="text-[10px] text-[var(--aurora-text-muted)] flex items-center gap-0.5">
                        <Clock size={10} /> {timeAgo(thread.lastReplyAt || thread.createdAt)}
                      </span>
                      {thread.isPinned && (
                        <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                          <Pin size={9} /> Pinned
                        </span>
                      )}
                      {thread.acceptedReplyId && (
                        <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                          <CheckCircle2 size={9} /> Answered
                        </span>
                      )}
                    </div>

                    {/* Title + content */}
                    <h3 className="font-bold text-[var(--aurora-text)] text-sm leading-snug mb-1 group-hover:text-aurora-indigo transition-colors">
                      {thread.title}
                    </h3>
                    <p className="text-xs text-[var(--aurora-text-secondary)] line-clamp-2 leading-relaxed">
                      {thread.content}
                    </p>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center gap-1 px-3 pb-3 pt-1">
                    <VotingButtons
                      score={threadScore}
                      userVote={userVote}
                      onUpvote={() => handleVoteThread(thread.id, 'up')}
                      onDownvote={() => handleVoteThread(thread.id, 'down')}
                      disabled={likingInProgress === thread.id}
                      size="sm"
                    />

                    <button
                      onClick={() => { setSelectedThread(thread); setViewMode('detail'); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-variant)] text-xs transition-colors"
                    >
                      <MessageCircle size={15} />
                      <span className="font-medium">{thread.replyCount}</span>
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleShare(thread.title, thread.content); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-variant)] text-xs transition-colors"
                    >
                      <Share2 size={14} />
                    </button>

                    <button
                      onClick={(e) => toggleSaveThread(thread.id, e)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        isSaved ? 'text-aurora-indigo bg-aurora-indigo/5' : 'text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-variant)]'
                      }`}
                    >
                      <Bookmark size={14} className={isSaved ? 'fill-current' : ''} />
                    </button>

                    <div className="flex-1" />

                    {/* More menu */}
                    <div className="relative" ref={moreMenuRef}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMoreMenu(showMoreMenu === thread.id ? null : thread.id); }}
                        className="p-1.5 rounded-lg text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-variant)] transition-colors"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      <ClickOutsideOverlay isOpen={!!showMoreMenu} onClose={() => setShowMoreMenu(null)} />
                      {showMoreMenu === thread.id && (
                        <div className="absolute right-0 bottom-full mb-1 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl shadow-xl py-1 w-44 z-50">
                          <button
                            onClick={(e) => { e.stopPropagation(); openReportModal(thread.id, 'thread'); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-surface-variant)]"
                          >
                            <Flag size={13} /> Report Post
                          </button>
                          {user && thread.authorId !== user.uid && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openBlockConfirm(thread.authorId, thread.authorName); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                              <Ban size={13} /> Block User
                            </button>
                          )}
                          {(isAdmin || (user && thread.authorId === user.uid)) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteThread(thread.id, thread.authorId); setShowMoreMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FAB for create (mobile) */}
        <button
          onClick={() => setShowCreateThread(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-xl hover:bg-orange-600 transition-colors sm:hidden z-20"
        >
          <Plus size={24} />
        </button>

        {/* Create Thread Modal */}
        {showCreateThread && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowCreateThread(false)}>
            <div
              className="bg-[var(--aurora-surface)] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[var(--aurora-border)]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--aurora-surface-variant)] flex items-center justify-center text-sm">{selectedTopic.icon}</div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--aurora-text)]">New Thread</h3>
                    <p className="text-[10px] text-[var(--aurora-text-muted)]">in {selectedTopic.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateThread(false)} className="w-8 h-8 rounded-full hover:bg-[var(--aurora-surface-variant)] flex items-center justify-center text-[var(--aurora-text-muted)]">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--aurora-text-muted)] mb-1.5 uppercase tracking-wider">Title</label>
                  <input
                    type="text"
                    value={threadTitle}
                    onChange={(e) => setThreadTitle(e.target.value)}
                    maxLength={150}
                    placeholder="An interesting title..."
                    className="w-full px-3.5 py-2.5 border border-[var(--aurora-border)] rounded-xl bg-[var(--aurora-surface)] text-[var(--aurora-text)] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-[var(--aurora-text-muted)]"
                  />
                  <p className="text-[10px] text-[var(--aurora-text-muted)] mt-1 text-right">{threadTitle.length}/150</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--aurora-text-muted)] mb-1.5 uppercase tracking-wider">Content</label>
                  <textarea
                    value={threadContent}
                    onChange={(e) => setThreadContent(e.target.value)}
                    maxLength={2000}
                    placeholder="Share your thoughts, ask a question, start a discussion..."
                    rows={6}
                    className="w-full px-3.5 py-2.5 border border-[var(--aurora-border)] rounded-xl bg-[var(--aurora-surface)] text-[var(--aurora-text)] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-[var(--aurora-text-muted)] resize-none"
                  />
                  <p className="text-[10px] text-[var(--aurora-text-muted)] mt-1 text-right">{threadContent.length}/2000</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--aurora-text-muted)] mb-1.5 uppercase tracking-wider">Thread Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {THREAD_FLAIRS.map((flair) => (
                      <button
                        key={flair.id}
                        onClick={() => setThreadFlair(flair.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          threadFlair === flair.id
                            ? `${flair.color} ring-2 ring-offset-2 ring-offset-[var(--aurora-surface)] ring-gray-400`
                            : `${flair.color} opacity-50 hover:opacity-80`
                        }`}
                      >
                        {flair.emoji} {flair.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-[var(--aurora-border)] p-4">
                <button
                  onClick={handleCreateThread}
                  disabled={submitting || !threadTitle.trim() || !threadContent.trim()}
                  className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Posting...</> : <><Send size={16} /> Post Thread</>}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      </>
    );
  }

  /* ─── DETAIL VIEW ─── */
  if (viewMode === 'detail' && selectedThread) {
    const userVote = getUserVoteThread(selectedThread.id);
    const isSaved = savedThreads.has(selectedThread.id);
    const topicInfo = topics.find((t) => t.id === selectedThread.topicId);
    const threadScore = selectedThread.voteScore ?? selectedThread.likes ?? 0;
    const authorKarma = karmaMap.get(selectedThread.authorId) || 0;

    // Separate accepted reply and other replies
    const acceptedReply = replies.find((r) => r.id === selectedThread.acceptedReplyId);
    const otherReplies = replies.filter((r) => r.id !== selectedThread.acceptedReplyId);

    return (
      <>{renderOverlays()}
      <div className="bg-[var(--aurora-bg)]">
        {/* Header */}
        <div className="bg-[var(--aurora-surface)] border-b border-[var(--aurora-border)] sticky top-0 z-30">
          <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => { setViewMode(selectedTopic ? 'threads' : 'topics'); setSelectedThread(null); }}
              className="w-9 h-9 rounded-full hover:bg-[var(--aurora-surface-variant)] flex items-center justify-center text-[var(--aurora-text-muted)]"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--aurora-text-muted)] truncate flex items-center gap-1">
                {topicInfo && <><span>{topicInfo.icon}</span> {topicInfo.name}</>}
              </p>
              <p className="text-sm font-bold text-[var(--aurora-text)] truncate">{selectedThread.title}</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-4 pb-28 space-y-3">
          {/* Original Post Card */}
          <div className={`bg-[var(--aurora-surface)] rounded-xl border overflow-hidden ${
            selectedThread.acceptedReplyId ? 'border-green-500/20' : 'border-[var(--aurora-border)]'
          }`}>
            <div className="p-5">
              {/* Author */}
              <div className="flex items-center gap-2.5 mb-3">
                <Avatar name={selectedThread.authorName} avatar={selectedThread.authorAvatar} size="md" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[var(--aurora-text)]">{selectedThread.authorName}</span>
                    {authorKarma > 0 && <KarmaBadge karma={authorKarma} />}
                    {selectedThread.flair && <FlairBadge flairId={selectedThread.flair} />}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--aurora-text-muted)] mt-0.5">
                    <span className="flex items-center gap-0.5"><Clock size={10} /> {timeAgo(selectedThread.createdAt)}</span>
                    {selectedThread.isPinned && (
                      <span className="flex items-center gap-0.5 text-green-600"><Pin size={10} /> Pinned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Title + Content */}
              <h2 className="text-lg font-bold text-[var(--aurora-text)] mb-3 leading-snug">{selectedThread.title}</h2>
              <p className="text-sm text-[var(--aurora-text-secondary)] leading-relaxed whitespace-pre-wrap">
                {renderForumContent(selectedThread.content).map((el, idx) => (
                  <React.Fragment key={idx}>{el}</React.Fragment>
                ))}
              </p>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-1 px-4 py-3 border-t border-[var(--aurora-border)] bg-[var(--aurora-surface-variant)]/30">
              <VotingButtons
                score={threadScore}
                userVote={userVote}
                onUpvote={() => handleVoteThread(selectedThread.id, 'up')}
                onDownvote={() => handleVoteThread(selectedThread.id, 'down')}
                disabled={likingInProgress === selectedThread.id}
              />

              <div className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--aurora-text-muted)] text-sm">
                <MessageCircle size={17} />
                <span className="font-medium text-xs">{selectedThread.replyCount} replies</span>
              </div>

              <button
                onClick={() => handleShare(selectedThread.title, selectedThread.content)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-variant)] text-xs transition-colors"
              >
                <Share2 size={15} /> Share
              </button>

              <button
                onClick={(e) => toggleSaveThread(selectedThread.id, e)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  isSaved ? 'text-aurora-indigo bg-aurora-indigo/5' : 'text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-variant)]'
                }`}
              >
                <Bookmark size={15} className={isSaved ? 'fill-current' : ''} /> Save
              </button>

              <div className="flex-1" />

              {/* Admin / owner actions */}
              {(isAdmin || (user && selectedThread.authorId === user.uid)) && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleDeleteThread(selectedThread.id, selectedThread.authorId)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Delete thread"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}

              <button
                onClick={() => openReportModal(selectedThread.id, 'thread')}
                className="p-1.5 rounded-lg text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-variant)] transition-colors"
                title="Report"
              >
                <Flag size={14} />
              </button>
              {user && selectedThread.authorId !== user.uid && (
                <button
                  onClick={() => openBlockConfirm(selectedThread.authorId, selectedThread.authorName)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  title="Block User"
                >
                  <Ban size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Accepted Reply Section */}
          {acceptedReply && (
            <div className="border-l-4 border-green-500 bg-green-50/50 dark:bg-green-500/10 rounded-xl overflow-hidden">
              <div className="bg-[var(--aurora-surface)] rounded-r-xl">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={16} className="text-green-600" />
                    <span className="text-xs font-bold text-green-600">Best Answer</span>
                  </div>
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar name={acceptedReply.authorName} avatar={acceptedReply.authorAvatar} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[var(--aurora-text)]">{acceptedReply.authorName}</span>
                        {karmaMap.get(acceptedReply.authorId) ? <KarmaBadge karma={karmaMap.get(acceptedReply.authorId)!} /> : null}
                        {acceptedReply.heritage && acceptedReply.heritage.length > 0 && (
                          <HeritageBadge heritage={acceptedReply.heritage[0]} />
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--aurora-text-muted)]">{timeAgo(acceptedReply.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--aurora-text-secondary)] whitespace-pre-wrap leading-relaxed mb-3">
                    {renderForumContent(acceptedReply.content).map((el, idx) => (
                      <React.Fragment key={idx}>{el}</React.Fragment>
                    ))}
                  </p>
                  <div className="flex items-center gap-1">
                    <VotingButtons
                      score={acceptedReply.voteScore ?? acceptedReply.likes ?? 0}
                      userVote={getUserVoteReply(acceptedReply.id)}
                      onUpvote={() => handleVoteReply(acceptedReply.id, 'up')}
                      onDownvote={() => handleVoteReply(acceptedReply.id, 'down')}
                      disabled={likingInProgress === acceptedReply.id}
                      size="sm"
                    />

                    {selectedThread.flair === 'question' && (selectedThread.authorId === user?.uid || isAdmin) && (
                      <button
                        onClick={() => handleUnacceptReply(acceptedReply.id)}
                        className="ml-auto text-xs px-2 py-1 text-green-600 hover:bg-green-100/50 dark:hover:bg-green-500/20 rounded transition-colors"
                      >
                        Unmark as Best
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Replies section */}
          <div className="flex items-center gap-2 pt-2">
            <h3 className="text-sm font-bold text-[var(--aurora-text)] flex items-center gap-1.5">
              <MessageCircle size={16} /> {selectedThread.replyCount} {selectedThread.replyCount === 1 ? 'Reply' : 'Replies'}
            </h3>
          </div>

          {/* Reply cards */}
          <div className="space-y-2">
            {otherReplies.length === 0 && !acceptedReply ? (
              <div className="text-center py-10">
                <MessageCircle size={28} className="mx-auto text-[var(--aurora-text-muted)] mb-2" />
                <p className="text-sm text-[var(--aurora-text-muted)]">No replies yet. Be the first to comment!</p>
              </div>
            ) : (
              (() => {
                // Build a map of parentId -> child count for collapse toggles
                const childCountMap = new Map<string, number>();
                otherReplies.forEach((r) => {
                  if (r.parentReplyId) {
                    childCountMap.set(r.parentReplyId, (childCountMap.get(r.parentReplyId) || 0) + 1);
                  }
                });

                // Check if a reply is hidden because any of its ancestors is collapsed
                const isHiddenByCollapse = (reply: ForumReply): boolean => {
                  if (!reply.parentReplyId) return false;
                  if (collapsedReplies.has(reply.parentReplyId)) return true;
                  // Check grandparent etc
                  const parent = otherReplies.find((r) => r.id === reply.parentReplyId);
                  if (parent) return isHiddenByCollapse(parent);
                  return false;
                };

                return otherReplies.filter((r) => !isHiddenByCollapse(r)).map((reply) => {
                  const userVoteReply = getUserVoteReply(reply.id);
                  const replyScore = reply.voteScore ?? reply.likes ?? 0;
                  const replyAuthorKarma = karmaMap.get(reply.authorId) || 0;
                  const childCount = childCountMap.get(reply.id) || 0;
                  const isCollapsed = collapsedReplies.has(reply.id);

                  return (
                    <div
                      key={reply.id}
                      className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] overflow-hidden"
                      style={{ marginLeft: `${(reply.depth || 0) * 16}px` }}
                    >
                      <div className="p-4">
                        {/* Parent reply indicator */}
                        {reply.parentReplyId && (
                          <div className="text-[10px] text-[var(--aurora-text-muted)] mb-2 flex items-center gap-1 italic">
                            <CornerDownRight size={10} /> In reply to {reply.parentAuthorName}
                          </div>
                        )}

                        {/* Reply content */}
                        <div className="flex items-start gap-3 mb-2">
                          <Avatar name={reply.authorName} avatar={reply.authorAvatar} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[var(--aurora-text)]">{reply.authorName}</span>
                              {replyAuthorKarma > 0 && <KarmaBadge karma={replyAuthorKarma} />}
                              {reply.heritage && reply.heritage.length > 0 && (
                                <HeritageBadge heritage={reply.heritage[0]} />
                              )}
                            </div>
                            <span className="text-[10px] text-[var(--aurora-text-muted)]">{timeAgo(reply.createdAt)}</span>
                          </div>
                        </div>

                        <p className="text-sm text-[var(--aurora-text-secondary)] whitespace-pre-wrap leading-relaxed mb-3">
                          {renderForumContent(reply.content).map((el, elIdx) => (
                            <React.Fragment key={elIdx}>{el}</React.Fragment>
                          ))}
                        </p>

                        {/* Reply actions */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <VotingButtons
                            score={replyScore}
                            userVote={userVoteReply}
                            onUpvote={() => handleVoteReply(reply.id, 'up')}
                            onDownvote={() => handleVoteReply(reply.id, 'down')}
                            disabled={likingInProgress === reply.id}
                            size="sm"
                          />

                          {(reply.depth || 0) < 3 && (
                            <button
                              onClick={() => { setReplyingToId(reply.id); setReplyingToName(reply.authorName); setShowReplyBar(true); }}
                              className="text-[10px] px-2 py-1 text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-variant)] rounded transition-colors flex items-center gap-0.5"
                            >
                              <Reply size={11} /> Reply
                            </button>
                          )}

                          {/* Collapse/expand child replies */}
                          {childCount > 0 && (
                            <button
                              onClick={() => setCollapsedReplies((prev) => {
                                const n = new Set(prev);
                                if (n.has(reply.id)) n.delete(reply.id);
                                else n.add(reply.id);
                                return n;
                              })}
                              className="text-[10px] px-2 py-1 text-aurora-indigo hover:bg-aurora-indigo/5 rounded transition-colors flex items-center gap-0.5"
                            >
                              {isCollapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              {isCollapsed ? `Show ${childCount} ${childCount === 1 ? 'reply' : 'replies'}` : `Hide ${childCount} ${childCount === 1 ? 'reply' : 'replies'}`}
                            </button>
                          )}

                          <button
                            onClick={() => openReportModal(reply.id, 'reply')}
                            className="p-1.5 rounded-md text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-variant)] transition-colors"
                            title="Report"
                          >
                            <Flag size={12} />
                          </button>

                          {user && reply.authorId !== user.uid && (
                            <button
                              onClick={() => openBlockConfirm(reply.authorId, reply.authorName)}
                              className="p-1.5 rounded-md text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              title="Block User"
                            >
                              <Ban size={12} />
                            </button>
                          )}

                          {(isAdmin || (user && reply.authorId === user.uid)) && (
                            <button
                              onClick={() => handleDeleteReply(reply.id, reply.authorId, reply.threadId)}
                              className="p-1.5 rounded-md text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}

                          {selectedThread.flair === 'question' && (selectedThread.authorId === user?.uid || isAdmin) && !selectedThread.acceptedReplyId && (
                            <button
                              onClick={() => handleAcceptReply(reply.id)}
                              className="ml-auto text-[10px] px-2 py-1 text-orange-600 hover:bg-orange-100/50 dark:hover:bg-orange-500/20 rounded transition-colors"
                            >
                              Mark as Best
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>

        {/* Reply input bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--aurora-surface)] border-t border-[var(--aurora-border)] z-30">
          <div className="max-w-4xl mx-auto px-4 py-3">
            {showReplyBar ? (
              <>
                {replyingToId && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-[var(--aurora-surface-variant)] rounded-lg text-xs">
                    <CornerDownRight size={12} />
                    <span>Replying to {replyingToName}</span>
                    <button onClick={() => { setReplyingToId(null); setReplyingToName(null); }} className="ml-auto text-[var(--aurora-text-muted)] hover:text-[var(--aurora-text)]">
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <button
                    onClick={() => { setShowReplyBar(false); setReplyContent(''); setReplyingToId(null); setReplyingToName(null); }}
                    className="w-10 h-10 rounded-full bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-muted)] flex items-center justify-center hover:bg-[var(--aurora-border)] transition-colors flex-shrink-0"
                  >
                    <ChevronDown size={18} />
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      maxLength={500}
                      placeholder={replyingToId ? `Reply to ${replyingToName}...` : 'Write a reply...'}
                      rows={1}
                      autoFocus
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                      }}
                      className="w-full px-4 py-2.5 border border-[var(--aurora-border)] rounded-2xl bg-[var(--aurora-surface-variant)] text-sm text-[var(--aurora-text)] focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-[var(--aurora-text-muted)] resize-none"
                    />
                  </div>
                  <button
                    onClick={handleCreateReply}
                    disabled={submitting || !replyContent.trim()}
                    className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors disabled:opacity-40 flex-shrink-0 shadow-sm"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-[var(--aurora-text-muted)] mt-1 text-right">{replyContent.length}/500</p>
              </>
            ) : (
              <button
                onClick={() => setShowReplyBar(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[var(--aurora-surface-variant)] border border-[var(--aurora-border)] text-sm text-[var(--aurora-text-muted)] hover:border-orange-500/30 transition-colors"
              >
                <MessageCircle size={16} />
                <span>Write a reply...</span>
              </button>
            )}
          </div>
        </div>
      </div>
      </>
    );
  }

  return null;
}
