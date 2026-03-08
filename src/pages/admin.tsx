'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureSettings, FEATURE_GROUPS } from '@/contexts/FeatureSettingsContext';
import { db } from '@/services/firebase';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
  Megaphone,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  UserCheck,
  UserX,
  Store,
  Home,
  Plane,
  MessageSquare,
  Calendar,
  Search,
  MoreVertical,
  Trash2,
  Ban,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  Activity,
  Eye,
  EyeOff,
  Plus,
  Send,
  Shield,
  Lock,
  Flag,
  Bell,
  BellOff,
  X,
  Power,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────
interface Listing {
  id: string;
  title: string;
  type: string;
  source: 'business' | 'housing' | 'travel';
  price?: number | string;
  posterName: string;
  posterId: string;
  isDisabled?: boolean;
  createdAt?: any;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  city?: string;
  isAdmin?: boolean;
  createdAt?: any;
  heritage?: string | string[];
  accountType?: string;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  active: boolean;
  createdAt?: any;
}

interface ModerationItem {
  id: string;
  content: string;
  authorId: string;
  authorName?: string;
  type: string;
  reason?: string;
  createdAt?: any;
}

// ─── Helper: Mini bar chart SVG ──────────────────────────
function MiniBarChart({ data, color = '#FF3008', height = 48 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const barW = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {data.map((v, i) => {
        const h = (v / max) * height * 0.9;
        return (
          <rect
            key={i}
            x={i * barW + barW * 0.15}
            y={height - h}
            width={barW * 0.7}
            height={h}
            rx={2}
            fill={color}
            opacity={0.15 + (i / data.length) * 0.85}
          />
        );
      })}
    </svg>
  );
}

// ─── Helper: Toggle switch ───────────────────────────────
function ToggleSwitch({
  enabled,
  onChange,
  size = 'md',
}: {
  enabled: boolean;
  onChange: () => void;
  size?: 'sm' | 'md';
}) {
  const dims = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const dot = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const translate = size === 'sm' ? (enabled ? 'translate-x-4' : 'translate-x-0.5') : (enabled ? 'translate-x-5.5' : 'translate-x-0.5');
  return (
    <button
      onClick={onChange}
      className={`${dims} rounded-full transition-colors duration-200 relative flex items-center ${
        enabled ? 'bg-[#FF3008]' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`${dot} rounded-full bg-white shadow-md transform transition-transform duration-200 ${translate}`}
      />
    </button>
  );
}

// ─── Helper: Stat Card ───────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
  color,
  chartData,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  color: string;
  chartData?: number[];
}) {
  return (
    <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
              trend === 'up'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                : trend === 'down'
                ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : null}
            {trendLabel}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-[var(--aurora-text)] mb-0.5">{value}</p>
      <p className="text-xs text-[var(--aurora-text-secondary)]">{label}</p>
      {chartData && (
        <div className="mt-3 -mx-1">
          <MiniBarChart data={chartData} color={color} />
        </div>
      )}
    </div>
  );
}

// ─── Helper: Skeleton ────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="w-16 h-6 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function AdminPage() {
  const { isAdmin, userProfile, user } = useAuth();
  const {
    features: featureFlags,
    isFeatureEnabled,
    toggleFeature: toggleFeatureFlag,
    toggleGroupAll,
  } = useFeatureSettings();

  // ─── Tab state ─────────────────────────────────
  const [selectedSection, setSelectedSection] = useState<string>('dashboard');
  const [loading, setLoading] = useState(false);

  // ─── Users state ───────────────────────────────
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [bannedUserIds, setBannedUserIds] = useState<string[]>([]);
  const [disabledUserIds, setDisabledUserIds] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'disabled' | 'banned' | 'admin'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [deletingContent, setDeletingContent] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // ─── Listings state ────────────────────────────
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingSearch, setListingSearch] = useState('');
  const [listingFilter, setListingFilter] = useState<'all' | 'business' | 'housing' | 'travel' | 'disabled'>('all');

  // ─── Announcements state ───────────────────────
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');

  // ─── Admin emails state ────────────────────────
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // ─── Moderation state ──────────────────────────
  const [modQueue, setModQueue] = useState<ModerationItem[]>([]);

  // ─── Dashboard stats ───────────────────────────
  const [dashStats, setDashStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    bannedUsers: 0,
    disabledUsers: 0,
    totalListings: 0,
    businessCount: 0,
    housingCount: 0,
    travelCount: 0,
    forumThreads: 0,
    forumReplies: 0,
    totalEvents: 0,
    totalPosts: 0,
    modQueueCount: 0,
    announcementCount: 0,
    recentSignups: [] as number[],
  });

  // ─── Toast notification state ──────────────────
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ─── Generic confirmation modal state ──────────
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // ══════════════════════════════════════════════════
  // ALL HOOKS MUST BE ABOVE ANY CONDITIONAL RETURNS
  // ══════════════════════════════════════════════════

  // ─── Toast auto-dismiss ────────────────────────
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // ─── Load dashboard data ───────────────────────
  useEffect(() => {
    if (selectedSection === 'dashboard' && isAdmin) {
      loadDashboardData();
    }
  }, [selectedSection, isAdmin]);

  // ─── Load users ────────────────────────────────
  useEffect(() => {
    if (selectedSection === 'users' && isAdmin) {
      loadUsers();
      loadAdminEmails();
    }
  }, [selectedSection, isAdmin]);

  // ─── Load listings ─────────────────────────────
  useEffect(() => {
    if (selectedSection === 'listings' && isAdmin) {
      loadListings();
    }
  }, [selectedSection, isAdmin]);

  // ─── Load announcements ────────────────────────
  useEffect(() => {
    if (selectedSection === 'announcements' && isAdmin) {
      loadAnnouncements();
    }
  }, [selectedSection, isAdmin]);

  // ─── Load admin emails ─────────────────────────
  useEffect(() => {
    if (selectedSection === 'admins' && isAdmin) {
      loadAdminEmails();
    }
  }, [selectedSection, isAdmin]);

  // ─── Load moderation queue ─────────────────────
  useEffect(() => {
    if (selectedSection === 'moderation' && isAdmin) {
      loadModerationQueue();
    }
  }, [selectedSection, isAdmin]);

  // Memos
  const filteredUsers = useMemo(() => {
    let filtered = users;
    if (userSearch) {
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(userSearch.toLowerCase())
      );
    }
    if (userFilter === 'banned') filtered = filtered.filter((u) => bannedUserIds.includes(u.id));
    else if (userFilter === 'disabled') filtered = filtered.filter((u) => disabledUserIds.includes(u.id));
    else if (userFilter === 'active') filtered = filtered.filter((u) => !bannedUserIds.includes(u.id) && !disabledUserIds.includes(u.id));
    else if (userFilter === 'admin') filtered = filtered.filter((u) => isUserAdmin(u));
    return filtered;
  }, [users, userSearch, userFilter, bannedUserIds, disabledUserIds, adminEmails]);

  const filteredListings = useMemo(() => {
    let filtered = listings;
    if (listingFilter === 'disabled') {
      filtered = filtered.filter((l) => l.isDisabled);
    } else if (listingFilter !== 'all') {
      filtered = filtered.filter((l) => l.source === listingFilter);
    }
    if (listingSearch.trim()) {
      const s = listingSearch.toLowerCase();
      filtered = filtered.filter(
        (l) => l.title.toLowerCase().includes(s) || l.posterName.toLowerCase().includes(s)
      );
    }
    return filtered;
  }, [listings, listingFilter, listingSearch]);

  // ══════════════════════════════════════════════════
  // ACCESS DENIED — after all hooks
  // ══════════════════════════════════════════════════
  if (!isAdmin) {
    return (
      <div className="bg-[var(--aurora-bg)] flex items-center justify-center h-full p-4">
        <div className="text-center bg-[var(--aurora-surface)] rounded-3xl p-12 shadow-xl max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--aurora-text)] mb-2">Access Denied</h1>
          <p className="text-[var(--aurora-text-secondary)]">You do not have admin privileges.</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // DATA LOADERS
  // ══════════════════════════════════════════════════

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [usersSnap, bizSnap, housingSnap, travelSnap, threadsSnap, repliesSnap, eventsSnap, postsSnap, modSnap, annSnap, bannedSnap, disabledSnap] =
        await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'businesses')),
          getDocs(collection(db, 'listings')),
          getDocs(collection(db, 'travelPosts')),
          getDocs(collection(db, 'forumThreads')),
          getDocs(collection(db, 'forumReplies')),
          getDocs(collection(db, 'events')),
          getDocs(collection(db, 'posts')),
          getDocs(collection(db, 'moderationQueue')),
          getDocs(collection(db, 'announcements')),
          getDocs(collection(db, 'bannedUsers')),
          getDocs(collection(db, 'disabledUsers')),
        ]);

      const bannedIds = bannedSnap.docs.map((d) => d.id);
      const disabledIds = disabledSnap.docs.map((d) => d.id);

      // Build weekly signup approximation (last 7 data points)
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const signupBuckets = [0, 0, 0, 0, 0, 0, 0];
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        const ts = data.createdAt?.toMillis?.() || data.createdAt?.seconds * 1000 || 0;
        if (ts > 0) {
          const daysAgo = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
          if (daysAgo >= 0 && daysAgo < 7) {
            signupBuckets[6 - daysAgo]++;
          }
        }
      });

      setDashStats({
        totalUsers: usersSnap.size,
        activeUsers: usersSnap.size - bannedIds.length - disabledIds.length,
        bannedUsers: bannedIds.length,
        disabledUsers: disabledIds.length,
        totalListings: bizSnap.size + housingSnap.size + travelSnap.size,
        businessCount: bizSnap.size,
        housingCount: housingSnap.size,
        travelCount: travelSnap.size,
        forumThreads: threadsSnap.size,
        forumReplies: repliesSnap.size,
        totalEvents: eventsSnap.size,
        totalPosts: postsSnap.size,
        modQueueCount: modSnap.size,
        announcementCount: annSnap.size,
        recentSignups: signupBuckets,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserRecord[] = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        name: docSnap.data().name || 'No Name',
        email: docSnap.data().email,
        avatar: docSnap.data().avatar,
        city: docSnap.data().city,
        isAdmin: docSnap.data().isAdmin || false,
        createdAt: docSnap.data().createdAt,
        heritage: docSnap.data().heritage,
        accountType: docSnap.data().accountType,
      }));
      setUsers(usersData);

      const bannedSnapshot = await getDocs(collection(db, 'bannedUsers'));
      setBannedUserIds(bannedSnapshot.docs.map((d) => d.id));

      const disabledSnapshot = await getDocs(collection(db, 'disabledUsers'));
      setDisabledUserIds(disabledSnapshot.docs.map((d) => d.id));
    } catch (error) {
      console.error('Error loading users:', error);
      setToastMessage('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  function isUserAdmin(u: UserRecord): boolean {
    return adminEmails.some((ae) => ae.toLowerCase() === u.email?.toLowerCase());
  }

  async function disableUser(userId: string) {
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser && isUserAdmin(targetUser)) {
      setToastMessage('Cannot disable an admin account. Remove admin access first.');
      return;
    }
    try {
      await setDoc(doc(db, 'disabledUsers', userId), {
        userId,
        disabledAt: serverTimestamp(),
        reason: 'Disabled by admin',
      });
      setDisabledUserIds([...disabledUserIds, userId]);
    } catch (error) {
      console.error('Error disabling user:', error);
      setToastMessage('Failed to disable user');
    }
  }

  async function enableUser(userId: string) {
    try {
      await deleteDoc(doc(db, 'disabledUsers', userId));
      setDisabledUserIds(disabledUserIds.filter((id) => id !== userId));
    } catch (error) {
      console.error('Error enabling user:', error);
      setToastMessage('Failed to enable user');
    }
  }

  async function banUser(userId: string) {
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser && isUserAdmin(targetUser)) {
      setToastMessage('Cannot ban an admin account. Remove admin access first.');
      return;
    }
    try {
      await setDoc(doc(db, 'bannedUsers', userId), { userId });
      setBannedUserIds([...bannedUserIds, userId]);
    } catch (error) {
      console.error('Error banning user:', error);
      setToastMessage('Failed to ban user');
    }
  }

  async function unbanUser(userId: string) {
    try {
      await deleteDoc(doc(db, 'bannedUsers', userId));
      setBannedUserIds(bannedUserIds.filter((id) => id !== userId));
    } catch (error) {
      console.error('Error unbanning user:', error);
      setToastMessage('Failed to unban user');
    }
  }

  async function deleteAllUserContent(userId: string, userName: string) {
    const displayName = userName || 'this user';
    setConfirmModal({
      title: 'Delete All User Content?',
      message: `This will permanently delete ALL content by "${displayName}":\n\n• Feed posts\n• Forum threads & replies\n• Messages & conversations\n• Business listings\n• Housing listings\n• Travel posts\n• Events\n\nThis cannot be undone!`,
      confirmLabel: 'Delete All',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          setDeletingContent(userId);
          let totalDeleted = 0;

          const collections = [
            { col: 'posts', field: 'userId' },
            { col: 'forumThreads', field: 'authorId' },
            { col: 'forumReplies', field: 'authorId' },
            { col: 'businesses', field: 'ownerId' },
            { col: 'listings', field: 'posterId' },
            { col: 'travelPosts', field: 'posterId' },
            { col: 'events', field: 'userId' },
          ];

          for (const { col, field } of collections) {
            const q = query(collection(db, col), where(field, '==', userId));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
              await deleteDoc(doc(db, col, d.id));
              totalDeleted++;
            }
          }

          // Delete conversations and messages
          const convsQuery = query(collection(db, 'conversations'), where('participants', 'array-contains', userId));
          const convsSnap = await getDocs(convsQuery);
          for (const convDoc of convsSnap.docs) {
            const msgsSnap = await getDocs(collection(db, 'conversations', convDoc.id, 'messages'));
            for (const msgDoc of msgsSnap.docs) {
              await deleteDoc(doc(db, 'conversations', convDoc.id, 'messages', msgDoc.id));
              totalDeleted++;
            }
            await deleteDoc(doc(db, 'conversations', convDoc.id));
            totalDeleted++;
          }

          // Clean up moderation queue
          const modQ = query(collection(db, 'moderationQueue'), where('authorId', '==', userId));
          const modSnap = await getDocs(modQ);
          for (const d of modSnap.docs) {
            await deleteDoc(doc(db, 'moderationQueue', d.id));
          }

          setListings((prev) => prev.filter((l) => l.posterId !== userId));
          setToastMessage(`Deleted ${totalDeleted} items for ${displayName}`);
        } catch (error) {
          console.error('Error deleting user content:', error);
          setToastMessage('Failed to delete some content');
        } finally {
          setDeletingContent(null);
        }
      }
    });
  }

  async function removeUser(userId: string, userName: string) {
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser && isUserAdmin(targetUser)) {
      setToastMessage('Cannot remove an admin account. Remove admin access first.');
      return;
    }
    const displayName = userName || 'this user';
    setConfirmModal({
      title: 'Remove User?',
      message: `Remove "${displayName}" completely?\n\n• Delete their profile\n• Disable their account\n• They will no longer appear in the app\n\nUse "Delete Content" first if you also want to remove their posts.`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await deleteDoc(doc(db, 'users', userId));
          await setDoc(doc(db, 'disabledUsers', userId), {
            userId,
            disabledAt: serverTimestamp(),
            reason: 'Removed by admin',
          });
          await setDoc(doc(db, 'bannedUsers', userId), { userId });
          setUsers((prev) => prev.filter((u) => u.id !== userId));
          setDisabledUserIds((prev) => [...prev, userId]);
          setBannedUserIds((prev) => [...prev, userId]);
        } catch (error) {
          console.error('Error removing user:', error);
          setToastMessage('Failed to remove user');
        }
      }
    });
  }

  // ─── Listings ──────────────────────────────────
  async function loadListings() {
    try {
      setLoading(true);
      const allListings: Listing[] = [];

      const bizSnapshot = await getDocs(collection(db, 'businesses'));
      bizSnapshot.docs.forEach((d) => {
        const data = d.data();
        allListings.push({
          id: d.id,
          title: data.name || 'Untitled Business',
          type: data.category || 'General',
          source: 'business',
          posterName: data.ownerName || data.posterName || 'Unknown',
          posterId: data.ownerId || data.posterId || '',
          isDisabled: data.isDisabled || false,
          createdAt: data.createdAt,
        });
      });

      const housingSnapshot = await getDocs(collection(db, 'listings'));
      housingSnapshot.docs.forEach((d) => {
        const data = d.data();
        allListings.push({
          id: d.id,
          title: data.title || 'Untitled Listing',
          type: data.type || 'rent',
          source: 'housing',
          price: data.price,
          posterName: data.posterName || 'Unknown',
          posterId: data.posterId || '',
          isDisabled: data.isDisabled || false,
          createdAt: data.createdAt,
        });
      });

      const travelSnapshot = await getDocs(collection(db, 'travelPosts'));
      travelSnapshot.docs.forEach((d) => {
        const data = d.data();
        allListings.push({
          id: d.id,
          title: `${data.from || '?'} → ${data.to || '?'}`,
          type: data.mode || 'assistance',
          source: 'travel',
          posterName: data.posterName || 'Unknown',
          posterId: data.posterId || '',
          isDisabled: data.isDisabled || false,
          createdAt: data.createdAt,
        });
      });

      allListings.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime;
      });

      setListings(allListings);
    } catch (error) {
      console.error('Error loading listings:', error);
      setToastMessage('Failed to load listings');
    } finally {
      setLoading(false);
    }
  }

  function getCollectionForSource(source: string): string {
    switch (source) {
      case 'business': return 'businesses';
      case 'housing': return 'listings';
      case 'travel': return 'travelPosts';
      default: return 'listings';
    }
  }

  async function deleteListing(listing: Listing) {
    const collectionName = getCollectionForSource(listing.source);
    setConfirmModal({
      title: 'Delete Listing?',
      message: `Delete "${listing.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await deleteDoc(doc(db, collectionName, listing.id));
          setListings((prev) => prev.filter((l) => l.id !== listing.id));
        } catch (error) {
          console.error('Error deleting listing:', error);
          setToastMessage('Failed to delete listing');
        }
      }
    });
  }

  async function toggleDisableListing(listing: Listing) {
    const collectionName = getCollectionForSource(listing.source);
    const newState = !listing.isDisabled;
    const action = newState ? 'disable' : 'enable';
    setConfirmModal({
      title: newState ? 'Disable Listing?' : 'Re-enable Listing?',
      message: `${newState ? 'Disable' : 'Re-enable'} "${listing.title}"?${newState ? ' It will be hidden from users.' : ''}`,
      confirmLabel: newState ? 'Disable' : 'Enable',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await updateDoc(doc(db, collectionName, listing.id), { isDisabled: newState });
          setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, isDisabled: newState } : l));
        } catch (error) {
          console.error(`Error ${action} listing:`, error);
          setToastMessage(`Failed to ${action} listing`);
        }
      }
    });
  }

  async function deleteAllListingsByUser(userId: string, userName: string) {
    const displayName = userName || 'this user';
    setConfirmModal({
      title: 'Delete All Listings?',
      message: `Delete ALL listings by "${displayName}"? This cannot be undone.`,
      confirmLabel: 'Delete All',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          setDeletingContent(userId);
          let totalDeleted = 0;
          for (const [col, field] of [['businesses', 'ownerId'], ['listings', 'posterId'], ['travelPosts', 'posterId']] as const) {
            const q = query(collection(db, col), where(field, '==', userId));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
              await deleteDoc(doc(db, col, d.id));
              totalDeleted++;
            }
          }
          setListings((prev) => prev.filter((l) => l.posterId !== userId));
          setToastMessage(`Deleted ${totalDeleted} listings by ${displayName}`);
        } catch (error) {
          console.error('Error deleting listings:', error);
          setToastMessage('Failed to delete some listings');
        } finally {
          setDeletingContent(null);
        }
      }
    });
  }

  // ─── Announcements ─────────────────────────────
  async function loadAnnouncements() {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'announcements'));
      setAnnouncements(
        querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          title: docSnap.data().title,
          message: docSnap.data().message,
          active: docSnap.data().active,
          createdAt: docSnap.data().createdAt,
        }))
      );
    } catch (error) {
      console.error('Error loading announcements:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createAnnouncement() {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setToastMessage('Please fill in all fields');
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'announcements'), {
        title: announcementTitle,
        message: announcementMessage,
        active: true,
        createdAt: serverTimestamp(),
      });
      setAnnouncements([
        ...announcements,
        { id: docRef.id, title: announcementTitle, message: announcementMessage, active: true, createdAt: new Date() },
      ]);
      setAnnouncementTitle('');
      setAnnouncementMessage('');
    } catch (error) {
      console.error('Error creating announcement:', error);
      setToastMessage('Failed to create announcement');
    }
  }

  async function toggleAnnouncementActive(id: string, currentActive: boolean) {
    try {
      await updateDoc(doc(db, 'announcements', id), { active: !currentActive });
      setAnnouncements(announcements.map((a) => (a.id === id ? { ...a, active: !currentActive } : a)));
    } catch (error) {
      console.error('Error updating announcement:', error);
    }
  }

  async function deleteAnnouncement(id: string) {
    setConfirmModal({
      title: 'Delete Announcement?',
      message: 'Delete this announcement?',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await deleteDoc(doc(db, 'announcements', id));
          setAnnouncements(announcements.filter((a) => a.id !== id));
        } catch (error) {
          console.error('Error deleting announcement:', error);
        }
      }
    });
  }

  // ─── Admin Emails ──────────────────────────────
  async function loadAdminEmails() {
    try {
      const docSnap = await getDoc(doc(db, 'appConfig', 'settings'));
      if (docSnap.exists()) {
        setAdminEmails(docSnap.data().adminEmails || []);
      }
    } catch (error) {
      console.error('Error loading admin emails:', error);
    }
  }

  async function addAdminEmail() {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setToastMessage('Please enter a valid email address');
      return;
    }
    if (adminEmails.includes(email)) {
      setToastMessage('This email is already an admin');
      return;
    }
    try {
      const updatedEmails = [...adminEmails, email];
      await updateDoc(doc(db, 'appConfig', 'settings'), { adminEmails: updatedEmails });
      setAdminEmails(updatedEmails);
      setNewAdminEmail('');
    } catch (error) {
      try {
        const updatedEmails = [...adminEmails, email];
        await setDoc(doc(db, 'appConfig', 'settings'), { adminEmails: updatedEmails }, { merge: true });
        setAdminEmails(updatedEmails);
        setNewAdminEmail('');
      } catch (e) {
        console.error('Error adding admin:', e);
        setToastMessage('Failed to add admin');
      }
    }
  }

  async function removeAdminEmail(email: string) {
    if (adminEmails.length <= 1) {
      setToastMessage('Cannot remove the last admin.');
      return;
    }
    setConfirmModal({
      title: 'Remove Admin Access?',
      message: `Remove admin access for ${email}?`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const updatedEmails = adminEmails.filter((e) => e !== email);
          await updateDoc(doc(db, 'appConfig', 'settings'), { adminEmails: updatedEmails });
          setAdminEmails(updatedEmails);
        } catch (error) {
          console.error('Error removing admin:', error);
          setToastMessage('Failed to remove admin');
        }
      }
    });
  }

  // ─── Moderation ────────────────────────────────
  async function loadModerationQueue() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'moderationQueue'));
      setModQueue(
        snap.docs.map((d) => ({
          id: d.id,
          content: d.data().content || d.data().text || '',
          authorId: d.data().authorId || '',
          authorName: d.data().authorName || 'Unknown',
          type: d.data().type || 'post',
          reason: d.data().reason || d.data().flagReason || '',
          createdAt: d.data().createdAt,
        }))
      );
    } catch (error) {
      console.error('Error loading moderation queue:', error);
    } finally {
      setLoading(false);
    }
  }

  async function dismissModItem(id: string) {
    try {
      await deleteDoc(doc(db, 'moderationQueue', id));
      setModQueue((prev) => prev.filter((m) => m.id !== id));
      setDashStats((prev) => ({ ...prev, modQueueCount: Math.max(0, prev.modQueueCount - 1) }));
    } catch (error) {
      console.error('Error dismissing mod item:', error);
    }
  }

  // ══════════════════════════════════════════════════
  // NAVIGATION CONFIG
  // ══════════════════════════════════════════════════
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'listings', label: 'Listings', icon: ClipboardList },
    { id: 'features', label: 'Features', icon: Settings },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'moderation', label: 'Moderation', icon: Flag },
    { id: 'admins', label: 'Admin Access', icon: ShieldCheck },
  ];

  // Source icons
  const sourceIcon = (source: string) => {
    switch (source) {
      case 'business': return <Store size={16} className="text-blue-500" />;
      case 'housing': return <Home size={16} className="text-emerald-500" />;
      case 'travel': return <Plane size={16} className="text-purple-500" />;
      default: return <ClipboardList size={16} />;
    }
  };

  const sourceLabel = (source: string) => {
    switch (source) {
      case 'business': return 'Business';
      case 'housing': return 'Housing';
      case 'travel': return 'Travel';
      default: return source;
    }
  };

  // ══════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════

  return (
    <div className="bg-[var(--aurora-bg)]">
      {/* ─── Top Header Bar ─────────────────────── */}
      <div className="bg-[var(--aurora-surface)] border-b border-[var(--aurora-border)]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF3008] to-[#FF6034] flex items-center justify-center shadow-md">
                <BarChart3 size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--aurora-text)] leading-tight">Sangam Admin</h1>
                <p className="text-[10px] text-[var(--aurora-text-secondary)] leading-tight">Management Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {dashStats.modQueueCount > 0 && (
                <button
                  onClick={() => setSelectedSection('moderation')}
                  className="relative p-2 rounded-xl hover:bg-[var(--aurora-surface-variant)] transition"
                >
                  <Flag size={18} className="text-[var(--aurora-text-secondary)]" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#FF3008] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {dashStats.modQueueCount}
                  </span>
                </button>
              )}
              <div className="flex items-center gap-2 pl-3 border-l border-[var(--aurora-border)]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF3008] to-[#FF6034] flex items-center justify-center text-white text-sm font-bold">
                  {(userProfile?.name || user?.email || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-[var(--aurora-text)] leading-tight">
                    {userProfile?.name || user?.displayName || 'Admin'}
                  </p>
                  <p className="text-[10px] text-[var(--aurora-text-secondary)] leading-tight">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* ─── Sidebar Nav (desktop) ─────────────── */}
          <nav className="hidden lg:flex flex-col w-56 flex-shrink-0">
            <div className="sticky top-24 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = selectedSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#FF3008]/10 text-[#FF3008]'
                        : 'text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-surface-variant)] hover:text-[var(--aurora-text)]'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                    {item.id === 'moderation' && dashStats.modQueueCount > 0 && (
                      <span className="ml-auto w-5 h-5 bg-[#FF3008] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {dashStats.modQueueCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* ─── Main Content ──────────────────────── */}
          <main className="flex-1 min-w-0">
            {/* Mobile nav */}
            <div className="lg:hidden mb-6 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = selectedSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedSection(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                      isActive
                        ? 'bg-[#FF3008] text-white shadow-md'
                        : 'bg-[var(--aurora-surface)] text-[var(--aurora-text-secondary)] border border-[var(--aurora-border)]'
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* ══════════ DASHBOARD ══════════ */}
            {selectedSection === 'dashboard' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Dashboard</h2>
                  <p className="text-sm text-[var(--aurora-text-secondary)]">Overview of your community platform</p>
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                ) : (
                  <>
                    {/* Top stats row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatCard
                        icon={Users}
                        label="Total Users"
                        value={dashStats.totalUsers}
                        trend="up"
                        trendLabel={`${dashStats.activeUsers} active`}
                        color="#FF3008"
                        chartData={dashStats.recentSignups}
                      />
                      <StatCard
                        icon={ClipboardList}
                        label="Total Listings"
                        value={dashStats.totalListings}
                        trend="neutral"
                        trendLabel={`${dashStats.businessCount}B / ${dashStats.housingCount}H / ${dashStats.travelCount}T`}
                        color="#6366F1"
                      />
                      <StatCard
                        icon={MessageSquare}
                        label="Forum Activity"
                        value={dashStats.forumThreads + dashStats.forumReplies}
                        trend="up"
                        trendLabel={`${dashStats.forumThreads} threads`}
                        color="#10B981"
                        chartData={[3, 5, 2, 8, 6, 4, 7]}
                      />
                      <StatCard
                        icon={Activity}
                        label="Feed Posts"
                        value={dashStats.totalPosts}
                        color="#F59E0B"
                      />
                    </div>

                    {/* Second row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatCard icon={Calendar} label="Events" value={dashStats.totalEvents} color="#8B5CF6" />
                      <StatCard
                        icon={Flag}
                        label="Moderation Queue"
                        value={dashStats.modQueueCount}
                        trend={dashStats.modQueueCount > 0 ? 'down' : 'neutral'}
                        trendLabel={dashStats.modQueueCount > 0 ? 'Needs review' : 'Clear'}
                        color="#EF4444"
                      />
                      <StatCard icon={Megaphone} label="Announcements" value={dashStats.announcementCount} color="#06B6D4" />
                      <StatCard
                        icon={Ban}
                        label="Banned / Disabled"
                        value={`${dashStats.bannedUsers} / ${dashStats.disabledUsers}`}
                        color="#F97316"
                      />
                    </div>

                    {/* Quick actions */}
                    <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-6">
                      <h3 className="text-lg font-bold text-[var(--aurora-text)] mb-4">Quick Actions</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Manage Users', icon: Users, section: 'users', color: '#FF3008' },
                          { label: 'Feature Toggles', icon: Settings, section: 'features', color: '#6366F1' },
                          { label: 'New Announcement', icon: Megaphone, section: 'announcements', color: '#06B6D4' },
                          { label: 'Review Flagged', icon: Flag, section: 'moderation', color: '#EF4444' },
                        ].map((action) => (
                          <button
                            key={action.section}
                            onClick={() => setSelectedSection(action.section)}
                            className="flex items-center gap-3 p-4 rounded-xl border border-[var(--aurora-border)] hover:border-[var(--aurora-text-secondary)]/30 hover:shadow-md transition-all text-left"
                          >
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${action.color}15` }}
                            >
                              <action.icon size={18} style={{ color: action.color }} />
                            </div>
                            <span className="text-sm font-medium text-[var(--aurora-text)]">{action.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══════════ USERS ══════════ */}
            {selectedSection === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Users</h2>
                    <p className="text-sm text-[var(--aurora-text-secondary)]">{users.length} registered users</p>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-secondary)]" />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30 focus:border-[#FF3008]"
                    />
                  </div>
                  <div className="flex gap-2">
                    {(['all', 'active', 'admin', 'disabled', 'banned'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setUserFilter(f)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition ${
                          userFilter === f
                            ? 'bg-[#FF3008] text-white shadow-md'
                            : 'bg-[var(--aurora-surface)] text-[var(--aurora-text-secondary)] border border-[var(--aurora-border)] hover:bg-[var(--aurora-surface-variant)]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* User list */}
                {loading ? (
                  <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] divide-y divide-[var(--aurora-border)]">
                    {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
                  </div>
                ) : (
                  <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] overflow-hidden">
                    {filteredUsers.length === 0 ? (
                      <div className="text-center py-16 text-[var(--aurora-text-secondary)]">
                        <Users size={40} className="mx-auto mb-3 opacity-30" />
                        <p>No users found</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--aurora-border)]">
                        {filteredUsers.map((u) => {
                          const userIsAdmin = isUserAdmin(u);
                          const isBanned = bannedUserIds.includes(u.id);
                          const isDisabled = disabledUserIds.includes(u.id);
                          const isExpanded = expandedUser === u.id;

                          return (
                            <div key={u.id}>
                              <button
                                onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                                className={`w-full flex items-center gap-4 p-4 hover:bg-[var(--aurora-surface-variant)]/50 transition text-left ${
                                  userIsAdmin ? 'bg-[#FF3008]/[0.03]' : ''
                                }`}
                              >
                                {/* Avatar */}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                                  userIsAdmin
                                    ? 'bg-gradient-to-br from-[#FF3008] to-[#FF6034] text-white'
                                    : 'bg-[var(--aurora-surface-variant)]'
                                }`}>
                                  {u.avatar || '🧑'}
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-[var(--aurora-text)] truncate">{u.name}</p>
                                    {userIsAdmin && (
                                      <span className="text-[9px] bg-[#FF3008] text-white px-1.5 py-0.5 rounded font-bold tracking-wider flex-shrink-0">
                                        ADMIN
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-[var(--aurora-text-secondary)] truncate">{u.email}</p>
                                </div>
                                {/* Heritage */}
                                <div className="hidden md:block text-xs text-[var(--aurora-text-secondary)] w-24 truncate">
                                  {u.heritage
                                    ? Array.isArray(u.heritage) ? u.heritage.join(', ') : u.heritage
                                    : '-'}
                                </div>
                                {/* City */}
                                <div className="hidden md:block text-xs text-[var(--aurora-text-secondary)] w-20 truncate">
                                  {u.city || '-'}
                                </div>
                                {/* Status */}
                                <div className="flex-shrink-0">
                                  {userIsAdmin ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FF3008]/10 text-[#FF3008]">
                                      <Shield size={10} /> Protected
                                    </span>
                                  ) : isBanned ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                      <XCircle size={10} /> Banned
                                    </span>
                                  ) : isDisabled ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                      <AlertTriangle size={10} /> Disabled
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                      <CheckCircle2 size={10} /> Active
                                    </span>
                                  )}
                                </div>
                                <ChevronRight
                                  size={16}
                                  className={`text-[var(--aurora-text-secondary)] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                                />
                              </button>

                              {/* Expanded actions */}
                              {isExpanded && (
                                <div className="px-4 pb-4 pt-1 bg-[var(--aurora-surface-variant)]/30">
                                  <div className="flex flex-wrap gap-2 ml-14">
                                    {userIsAdmin ? (
                                      <p className="text-xs text-[var(--aurora-text-secondary)] italic py-2">
                                        Admin accounts are protected from moderation actions
                                      </p>
                                    ) : (
                                      <>
                                        {isDisabled ? (
                                          <button
                                            onClick={() => enableUser(u.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition"
                                          >
                                            <CheckCircle2 size={12} /> Enable
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => disableUser(u.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 transition"
                                          >
                                            <EyeOff size={12} /> Disable
                                          </button>
                                        )}
                                        {isBanned ? (
                                          <button
                                            onClick={() => unbanUser(u.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/40 transition"
                                          >
                                            <UserCheck size={12} /> Unban
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => banUser(u.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/40 transition"
                                          >
                                            <Ban size={12} /> Ban
                                          </button>
                                        )}
                                        <button
                                          onClick={() => deleteAllUserContent(u.id, u.name)}
                                          disabled={deletingContent === u.id}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition disabled:opacity-50"
                                        >
                                          <Trash2 size={12} /> {deletingContent === u.id ? 'Deleting...' : 'Delete Content'}
                                        </button>
                                        <button
                                          onClick={() => removeUser(u.id, u.name)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                                        >
                                          <UserX size={12} /> Remove User
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ══════════ LISTINGS ══════════ */}
            {selectedSection === 'listings' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Listings</h2>
                  <p className="text-sm text-[var(--aurora-text-secondary)]">Manage businesses, housing, and travel posts</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-secondary)]" />
                    <input
                      type="text"
                      placeholder="Search listings..."
                      value={listingSearch}
                      onChange={(e) => setListingSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30 focus:border-[#FF3008]"
                    />
                  </div>
                  <div className="flex gap-2">
                    {(['all', 'business', 'housing', 'travel', 'disabled'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setListingFilter(f)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition ${
                          listingFilter === f
                            ? 'bg-[#FF3008] text-white shadow-md'
                            : 'bg-[var(--aurora-surface)] text-[var(--aurora-text-secondary)] border border-[var(--aurora-border)] hover:bg-[var(--aurora-surface-variant)]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] divide-y divide-[var(--aurora-border)]">
                    {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
                  </div>
                ) : filteredListings.length === 0 ? (
                  <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] text-center py-16 text-[var(--aurora-text-secondary)]">
                    <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No listings found</p>
                  </div>
                ) : (
                  <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] divide-y divide-[var(--aurora-border)] overflow-hidden">
                    {filteredListings.map((listing) => (
                      <div key={listing.id} className={`flex items-center gap-4 p-4 hover:bg-[var(--aurora-surface-variant)]/50 transition ${listing.isDisabled ? 'opacity-60' : ''}`}>
                        <div className="w-10 h-10 rounded-xl bg-[var(--aurora-surface-variant)] flex items-center justify-center flex-shrink-0 relative">
                          {sourceIcon(listing.source)}
                          {listing.isDisabled && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                              <EyeOff size={10} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-semibold text-sm truncate ${listing.isDisabled ? 'text-[var(--aurora-text-secondary)] line-through' : 'text-[var(--aurora-text)]'}`}>{listing.title}</p>
                            {listing.isDisabled && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                                Disabled
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--aurora-text-secondary)]">
                            By {listing.posterName} · {listing.type}
                          </p>
                        </div>
                        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)]">
                          {sourceIcon(listing.source)}
                          {sourceLabel(listing.source)}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleDisableListing(listing)}
                            className={`p-2 rounded-lg transition ${listing.isDisabled ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                            title={listing.isDisabled ? 'Enable listing' : 'Disable listing'}
                          >
                            {listing.isDisabled ? <Eye size={16} /> : <EyeOff size={16} />}
                          </button>
                          <button
                            onClick={() => deleteListing(listing)}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                            title="Delete listing"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════ FEATURES ══════════ */}
            {selectedSection === 'features' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Feature Controls</h2>
                  <p className="text-sm text-[var(--aurora-text-secondary)]">Toggle modules and individual features on/off</p>
                </div>

                <div className="space-y-4">
                  {FEATURE_GROUPS.map((group) => {
                    const allEnabled = group.features.every((f) => isFeatureEnabled(f.key));
                    const someEnabled = group.features.some((f) => isFeatureEnabled(f.key));
                    return (
                      <div key={group.id} className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] overflow-hidden">
                        {/* Group header */}
                        <div className="flex items-center justify-between p-5 border-b border-[var(--aurora-border)]">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{group.icon}</span>
                            <div>
                              <h3 className="font-bold text-[var(--aurora-text)]">{group.title}</h3>
                              <p className="text-xs text-[var(--aurora-text-secondary)]">
                                {group.features.filter((f) => isFeatureEnabled(f.key)).length} / {group.features.length} enabled
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-[var(--aurora-text-secondary)]">
                              {allEnabled ? 'All On' : someEnabled ? 'Partial' : 'All Off'}
                            </span>
                            <ToggleSwitch
                              enabled={allEnabled}
                              onChange={() => toggleGroupAll(group.id, !allEnabled)}
                            />
                          </div>
                        </div>
                        {/* Individual features */}
                        <div className="divide-y divide-[var(--aurora-border)]">
                          {group.features.map((feature) => (
                            <div
                              key={feature.key}
                              className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--aurora-surface-variant)]/30 transition"
                            >
                              <div className="pr-4">
                                <p className="text-sm font-medium text-[var(--aurora-text)]">{feature.name}</p>
                                <p className="text-xs text-[var(--aurora-text-secondary)]">{feature.description}</p>
                              </div>
                              <ToggleSwitch
                                enabled={isFeatureEnabled(feature.key)}
                                onChange={() => toggleFeatureFlag(feature.key)}
                                size="sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══════════ ANNOUNCEMENTS ══════════ */}
            {selectedSection === 'announcements' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Announcements</h2>
                  <p className="text-sm text-[var(--aurora-text-secondary)]">Broadcast messages to all users</p>
                </div>

                {/* Create form */}
                <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-6">
                  <h3 className="font-bold text-[var(--aurora-text)] mb-4 flex items-center gap-2">
                    <Plus size={18} className="text-[#FF3008]" /> New Announcement
                  </h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Title"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--aurora-bg)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30 focus:border-[#FF3008]"
                    />
                    <textarea
                      placeholder="Message..."
                      value={announcementMessage}
                      onChange={(e) => setAnnouncementMessage(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-[var(--aurora-bg)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30 focus:border-[#FF3008] resize-none"
                    />
                    <button
                      onClick={createAnnouncement}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#FF3008] text-white rounded-xl text-sm font-semibold hover:bg-[#E02A06] transition shadow-md"
                    >
                      <Send size={14} /> Publish
                    </button>
                  </div>
                </div>

                {/* List */}
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] text-center py-16 text-[var(--aurora-text-secondary)]">
                    <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No announcements yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className={`bg-[var(--aurora-surface)] rounded-2xl border p-5 transition ${
                          ann.active
                            ? 'border-emerald-200 dark:border-emerald-800/50'
                            : 'border-[var(--aurora-border)] opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-[var(--aurora-text)]">{ann.title}</h4>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  ann.active
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                }`}
                              >
                                {ann.active ? 'LIVE' : 'OFF'}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--aurora-text-secondary)]">{ann.message}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <ToggleSwitch
                              enabled={ann.active}
                              onChange={() => toggleAnnouncementActive(ann.id, ann.active)}
                              size="sm"
                            />
                            <button
                              onClick={() => deleteAnnouncement(ann.id)}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════ MODERATION ══════════ */}
            {selectedSection === 'moderation' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Moderation Queue</h2>
                  <p className="text-sm text-[var(--aurora-text-secondary)]">Review flagged content</p>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
                  </div>
                ) : modQueue.length === 0 ? (
                  <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] text-center py-16">
                    <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-400" />
                    <p className="font-semibold text-[var(--aurora-text)]">All clear!</p>
                    <p className="text-sm text-[var(--aurora-text-secondary)]">No flagged content to review</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {modQueue.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[var(--aurora-surface)] rounded-2xl border border-red-200 dark:border-red-800/30 p-5"
                      >
                        <div className="flex-1 mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 uppercase">
                              {item.type}
                            </span>
                            {item.reason && (
                              <span className="text-[10px] text-[var(--aurora-text-secondary)]">
                                Reason: {item.reason}
                              </span>
                            )}
                            <span className="text-[10px] text-[var(--aurora-text-secondary)] ml-auto">
                              {item.createdAt?.toDate?.()?.toLocaleDateString?.() || ''}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--aurora-text)] mb-1 whitespace-pre-wrap">
                            &ldquo;{item.content.length > 300 ? item.content.slice(0, 300) + '...' : item.content}&rdquo;
                          </p>
                          <p className="text-xs text-[var(--aurora-text-secondary)]">
                            By <span className="font-semibold">{item.authorName || 'Unknown'}</span>
                            {item.authorId && <span className="opacity-50"> ({item.authorId.slice(0, 8)}...)</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => dismissModItem(item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition"
                          >
                            <CheckCircle2 size={12} /> Dismiss
                          </button>
                          <button
                            onClick={() => {
                              setConfirmModal({
                                title: 'Delete Content?',
                                message: `Delete this ${item.type} and remove from queue?`,
                                confirmLabel: 'Delete',
                                onConfirm: async () => {
                                  setConfirmModal(null);
                                  try {
                                    // Delete the source content if contentId exists
                                    if ((item as any).contentId && (item as any).collection) {
                                      await deleteDoc(doc(db, (item as any).collection, (item as any).contentId));
                                    }
                                    await dismissModItem(item.id);
                                  } catch (error) {
                                    console.error('Error deleting flagged content:', error);
                                    setToastMessage('Failed to delete content. Item dismissed from queue.');
                                    await dismissModItem(item.id);
                                  }
                                }
                              });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition"
                          >
                            <Trash2 size={12} /> Delete Content
                          </button>
                          {item.authorId && (
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  title: 'Ban User?',
                                  message: `Ban user "${item.authorName}" and delete this flagged content?`,
                                  confirmLabel: 'Ban User',
                                  onConfirm: async () => {
                                    setConfirmModal(null);
                                    try {
                                      await updateDoc(doc(db, 'users', item.authorId), { isBanned: true, bannedAt: new Date().toISOString() });
                                      await dismissModItem(item.id);
                                      setToastMessage(`User "${item.authorName}" has been banned.`);
                                    } catch (error) {
                                      console.error('Error banning user:', error);
                                      setToastMessage('Failed to ban user');
                                    }
                                  }
                                });
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition"
                            >
                              <Ban size={12} /> Ban User
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════ ADMIN ACCESS ══════════ */}
            {selectedSection === 'admins' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Admin Access</h2>
                  <p className="text-sm text-[var(--aurora-text-secondary)]">Manage who has admin privileges</p>
                </div>

                {/* Add admin */}
                <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-6">
                  <h3 className="font-bold text-[var(--aurora-text)] mb-4 flex items-center gap-2">
                    <Plus size={18} className="text-[#FF3008]" /> Add Admin
                  </h3>
                  <div className="flex gap-3">
                    <input
                      type="email"
                      placeholder="Email address"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-[var(--aurora-bg)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30 focus:border-[#FF3008]"
                    />
                    <button
                      onClick={addAdminEmail}
                      className="px-6 py-2.5 bg-[#FF3008] text-white rounded-xl text-sm font-semibold hover:bg-[#E02A06] transition shadow-md"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Admin list */}
                {adminEmails.length === 1 && (
                  <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4">
                    <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Only one admin remains. You cannot remove the last admin.
                    </p>
                  </div>
                )}

                <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--aurora-border)]">
                    <p className="text-sm font-semibold text-[var(--aurora-text)]">
                      Current Admins ({adminEmails.length})
                    </p>
                  </div>
                  {adminEmails.length === 0 ? (
                    <div className="text-center py-12 text-[var(--aurora-text-secondary)]">No admins configured</div>
                  ) : (
                    <div className="divide-y divide-[var(--aurora-border)]">
                      {adminEmails.map((email) => (
                        <div key={email} className="flex items-center justify-between px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF3008] to-[#FF6034] flex items-center justify-center text-white text-sm font-bold">
                              {email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[var(--aurora-text)]">{email}</p>
                              {adminEmails.length === 1 && (
                                <span className="text-[10px] font-bold text-amber-500">LAST ADMIN</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeAdminEmail(email)}
                            disabled={adminEmails.length <= 1}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              adminEmails.length <= 1
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                                : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                            }`}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm max-w-sm text-center animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={() => setConfirmModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mx-4 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4 whitespace-pre-wrap">{confirmModal.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmModal(null)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
              <button onClick={confirmModal.onConfirm} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">{confirmModal.confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
