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
  Sparkles,
  Filter,
  AlertOctagon,
  MessageCircle,
  BadgeCheck,
  FileText,
  ChefHat,
  Package,
  Clock,
} from 'lucide-react';
import {
  fetchPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  type PendingBusiness,
} from '@/services/businessRegistration';
import type { CateringOrder } from '@/services/cateringService';
import { formatPrice, updateOrderStatus } from '@/services/cateringService';
import AvatarImg, { isImageUrl } from '@/components/shared/AvatarImg';

// Extracted helper components
import { MiniBarChart, ToggleSwitch, StatCard, SkeletonCard, SkeletonRow } from '@/components/admin';

// Panel components
import {
  DashboardPanel,
  UserManagementPanel,
  ListingPanel,
  EventPanel,
  RegistrationPanel,
  AnnouncementPanel,
  AdminEmailPanel,
  ModerationPanel,
  CateringPanel,
} from '@/components/admin/panels';

// ─── Type Imports from @/types/admin ─────────────────────
// These types are re-exported here for backward compatibility,
// but are now defined in @/types/admin and used by the panels
import type { Listing, UserRecord, Announcement, ModerationReporter, ModerationItem, EventRecord } from '@/types/admin';

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

  // ─── Business Registrations state ──────────────
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingBusiness[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ─── Users state ───────────────────────────────
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [bannedUserIds, setBannedUserIds] = useState<string[]>([]);
  const [disabledUserIds, setDisabledUserIds] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'business' | 'disabled' | 'banned' | 'admin'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [deletingContent, setDeletingContent] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // ─── Listings state ────────────────────────────
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingSearch, setListingSearch] = useState('');
  const [listingFilter, setListingFilter] = useState<'all' | 'business' | 'housing' | 'travel' | 'disabled'>('all');

  // ─── Events state ─────────────────────────────
  const [adminEvents, setAdminEvents] = useState<EventRecord[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | 'promoted' | 'disabled' | 'past'>('all');

  // ─── Announcements state ───────────────────────
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');

  // ─── Admin emails state ────────────────────────
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // ─── Moderation state ──────────────────────────
  const [modQueue, setModQueue] = useState<ModerationItem[]>([]);

  // ─── Catering state ──────────────────────────
  const [cateringOrders, setCateringOrders] = useState<CateringOrder[]>([]);
  const [cateringBusinesses, setCateringBusinesses] = useState<any[]>([]);
  const [cateringLoading, setCateringLoading] = useState(false);
  const [cateringFilter, setCateringFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const [cateringActionLoading, setCateringActionLoading] = useState<string | null>(null);

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
    cateringOrderCount: 0,
    cateringPendingCount: 0,
    cateringBusinessCount: 0,
    cateringRfpCount: 0,
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

  // ─── Load pending registrations ─────────────────
  useEffect(() => {
    if (selectedSection === 'registrations' && isAdmin) {
      setRegistrationsLoading(true);
      fetchPendingRegistrations()
        .then(setPendingRegistrations)
        .catch((err) => console.error('Failed to load registrations:', err))
        .finally(() => setRegistrationsLoading(false));
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

  // ─── Load events ──────────────────────────────
  useEffect(() => {
    if (selectedSection === 'events' && isAdmin) {
      loadEvents();
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

  // ─── Load moderation queue & hidden posts ─────────────────────
  useEffect(() => {
    if (selectedSection === 'moderation' && isAdmin) {
      loadModerationQueue();
      loadHiddenPosts();
    }
  }, [selectedSection, isAdmin]);

  // ─── Load catering data ─────────────────────────
  useEffect(() => {
    if (selectedSection === 'catering' && isAdmin) {
      loadCateringData();
    }
  }, [selectedSection, isAdmin]);

  const loadCateringData = async () => {
    setCateringLoading(true);
    try {
      // Load all catering orders
      const ordersSnap = await getDocs(
        query(collection(db, 'cateringOrders'), orderBy('createdAt', 'desc'), limit(100))
      );
      const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as CateringOrder[];
      setCateringOrders(orders);

      // Load catering-enabled businesses
      const bizSnap = await getDocs(
        query(collection(db, 'businesses'), where('isCateringEnabled', '==', true))
      );
      const businesses = bizSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCateringBusinesses(businesses);
    } catch (err) {
      console.error('Failed to load catering data:', err);
    } finally {
      setCateringLoading(false);
    }
  };

  const handleCateringStatusChange = async (orderId: string, newStatus: CateringOrder['status']) => {
    setCateringActionLoading(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      setCateringOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      setToastMessage(`Order ${newStatus}`);
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to update order');
    } finally {
      setCateringActionLoading(null);
    }
  };

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
    else if (userFilter === 'business') filtered = filtered.filter((u) => u.accountType === 'business');
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

  const filteredAdminEvents = useMemo(() => {
    let filtered = adminEvents;
    const now = new Date();
    if (eventFilter === 'promoted') {
      filtered = filtered.filter((e) => e.promoted);
    } else if (eventFilter === 'disabled') {
      filtered = filtered.filter((e) => e.isDisabled);
    } else if (eventFilter === 'past') {
      filtered = filtered.filter((e) => {
        try {
          const d = new Date(e.fullDate);
          return d < now;
        } catch { return false; }
      });
    }
    if (eventSearch.trim()) {
      const s = eventSearch.toLowerCase();
      filtered = filtered.filter(
        (e) => e.title.toLowerCase().includes(s) || e.posterName.toLowerCase().includes(s) || e.type.toLowerCase().includes(s)
      );
    }
    return filtered;
  }, [adminEvents, eventFilter, eventSearch]);

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
      const [usersSnap, bizSnap, housingSnap, travelSnap, threadsSnap, repliesSnap, eventsSnap, postsSnap, modSnap, annSnap, bannedSnap, disabledSnap, cateringOrdersSnap, cateringBizSnap, cateringRfpSnap] =
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
          getDocs(collection(db, 'cateringOrders')),
          getDocs(query(collection(db, 'businesses'), where('isCateringEnabled', '==', true))),
          getDocs(collection(db, 'cateringQuoteRequests')),
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
        cateringOrderCount: cateringOrdersSnap.size,
        cateringPendingCount: cateringOrdersSnap.docs.filter((d) => d.data().status === 'pending').length,
        cateringBusinessCount: cateringBizSnap.size,
        cateringRfpCount: cateringRfpSnap.size,
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
      const usersData: UserRecord[] = querySnapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name || 'No Name',
          email: d.email,
          avatar: d.avatar,
          city: d.city,
          isAdmin: d.isAdmin || false,
          createdAt: d.createdAt,
          heritage: d.heritage,
          accountType: d.accountType,
          businessName: d.businessName,
          businessType: d.businessType,
          adminReviewRequired: d.adminReviewRequired,
          adminApproved: d.adminApproved,
          phone: d.phone,
          tinNumber: d.tinNumber,
          tinValidationStatus: d.tinValidationStatus,
          verificationDocUrls: d.verificationDocUrls,
          photoIdUrl: d.photoIdUrl,
        };
      });
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
          verified: data.verified || false,
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

  async function toggleVerifyListing(listing: Listing) {
    if (listing.source !== 'business') return;
    const newVerified = !listing.verified;
    try {
      if (newVerified) {
        await updateDoc(doc(db, 'businesses', listing.id), {
          verified: true,
          verifiedAt: serverTimestamp(),
          verificationMethod: 'admin',
        });
      } else {
        await updateDoc(doc(db, 'businesses', listing.id), {
          verified: false,
          verifiedAt: null,
          verificationMethod: null,
        });
      }
      setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, verified: newVerified } : l));
      setToastMessage(newVerified ? `${listing.title} has been verified!` : `Verification removed from ${listing.title}`);
    } catch (error) {
      console.error('Error toggling verification:', error);
      setToastMessage('Failed to update verification status');
    }
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

  // ─── Events ───────────────────────────────────
  async function loadEvents() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'events'));
      const evts: EventRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || 'Untitled Event',
          type: data.type || 'Other',
          fullDate: data.fullDate || '',
          posterName: data.posterName || 'Unknown',
          posterId: data.posterId || '',
          promoted: data.promoted || false,
          isDisabled: data.disabled || data.isDisabled || false,
          location: data.location || '',
          ticket: data.ticket || 'free',
          price: data.price || '',
          createdAt: data.createdAt,
        };
      });
      evts.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime;
      });
      setAdminEvents(evts);
    } catch (error) {
      console.error('Error loading events:', error);
      setToastMessage('Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  async function togglePromoteEvent(evt: EventRecord) {
    const newState = !evt.promoted;
    setConfirmModal({
      title: newState ? 'Promote Event?' : 'Remove Promotion?',
      message: `${newState ? 'Promote' : 'Demote'} "${evt.title}"?${newState ? ' It will appear in the Featured Events carousel.' : ''}`,
      confirmLabel: newState ? 'Promote' : 'Demote',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await updateDoc(doc(db, 'events', evt.id), { promoted: newState });
          setAdminEvents((prev) => prev.map((e) => e.id === evt.id ? { ...e, promoted: newState } : e));
          setToastMessage(`Event "${evt.title}" ${newState ? 'promoted' : 'demoted'}`);
        } catch (error) {
          console.error('Error updating event:', error);
          setToastMessage('Failed to update event');
        }
      }
    });
  }

  async function toggleDisableEvent(evt: EventRecord) {
    const newState = !evt.isDisabled;
    setConfirmModal({
      title: newState ? 'Disable Event?' : 'Re-enable Event?',
      message: `${newState ? 'Disable' : 'Re-enable'} "${evt.title}"?${newState ? ' It will be hidden from users.' : ''}`,
      confirmLabel: newState ? 'Disable' : 'Enable',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await updateDoc(doc(db, 'events', evt.id), { disabled: newState });
          setAdminEvents((prev) => prev.map((e) => e.id === evt.id ? { ...e, isDisabled: newState } : e));
        } catch (error) {
          console.error('Error updating event:', error);
          setToastMessage('Failed to update event');
        }
      }
    });
  }

  async function deleteEvent(evt: EventRecord) {
    setConfirmModal({
      title: 'Delete Event?',
      message: `Delete "${evt.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await deleteDoc(doc(db, 'events', evt.id));
          setAdminEvents((prev) => prev.filter((e) => e.id !== evt.id));
          setToastMessage(`Event "${evt.title}" deleted`);
        } catch (error) {
          console.error('Error deleting event:', error);
          setToastMessage('Failed to delete event');
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
  const [modFilterCategory, setModFilterCategory] = useState<string>('all');
  const [modSortBy, setModSortBy] = useState<'recent' | 'frequency'>('recent');

  async function loadModerationQueue() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'moderationQueue'));
      setModQueue(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            content: data.content || data.text || '',
            contentId: data.contentId || '',
            collection: data.collection || '',
            authorId: data.authorId || '',
            authorName: data.authorName || 'Unknown',
            authorAvatar: data.authorAvatar || '',
            images: data.images || [],
            type: data.type || 'post',
            category: data.category || '',
            categoryLabel: data.categoryLabel || '',
            reason: data.reason || data.flagReason || '',
            reportedBy: data.reportedBy || '',
            reporterName: data.reporterName || 'Unknown',
            reporterAvatar: data.reporterAvatar || '',
            reportCount: data.reportCount || 1,
            reporters: data.reporters || [],
            createdAt: data.createdAt,
          };
        })
      );
    } catch (error) {
      console.error('Error loading moderation queue:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredModQueue = useMemo(() => {
    let items = [...modQueue];
    if (modFilterCategory !== 'all') {
      items = items.filter((m) => m.category === modFilterCategory);
    }
    if (modSortBy === 'frequency') {
      items.sort((a, b) => (b.reportCount || 1) - (a.reportCount || 1));
    } else {
      items.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime?.() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      });
    }
    return items;
  }, [modQueue, modFilterCategory, modSortBy]);

  const modCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    modQueue.forEach((m) => {
      const cat = m.category || 'uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [modQueue]);

  async function dismissModItem(id: string) {
    try {
      await deleteDoc(doc(db, 'moderationQueue', id));
      setModQueue((prev) => prev.filter((m) => m.id !== id));
      setDashStats((prev) => ({ ...prev, modQueueCount: Math.max(0, prev.modQueueCount - 1) }));
    } catch (error) {
      console.error('Error dismissing mod item:', error);
    }
  }

  async function warnUser(item: ModerationItem) {
    if (!item.authorId) return;
    try {
      const userRef = doc(db, 'users', item.authorId);
      const userSnap = await getDoc(userRef);
      const currentWarnings = userSnap.exists() ? (userSnap.data().warnings || 0) : 0;
      await updateDoc(userRef, {
        warnings: currentWarnings + 1,
        lastWarningAt: new Date().toISOString(),
        lastWarningReason: item.categoryLabel || item.reason || 'Community guideline violation',
      });
      // Add to a warnings log collection
      await addDoc(collection(db, 'userWarnings'), {
        userId: item.authorId,
        userName: item.authorName,
        reason: item.categoryLabel || item.reason || 'Community guideline violation',
        moderationItemId: item.id,
        contentPreview: item.content?.slice(0, 200) || '',
        issuedAt: serverTimestamp(),
      });
      await dismissModItem(item.id);
      setToastMessage(`Warning issued to "${item.authorName}". Total warnings: ${currentWarnings + 1}`);
    } catch (error) {
      console.error('Error warning user:', error);
      setToastMessage('Failed to warn user');
    }
  }

  // ─── Hidden Posts ────────────────────────────────
  const [modTab, setModTab] = useState<'reports' | 'hidden'>('reports');
  const [hiddenPosts, setHiddenPosts] = useState<any[]>([]);
  const [hiddenBusinesses, setHiddenBusinesses] = useState<any[]>([]);
  const [loadingHidden, setLoadingHidden] = useState(false);

  async function loadHiddenPosts() {
    try {
      setLoadingHidden(true);
      // Load hidden posts
      const postsQ = query(collection(db, 'posts'), where('isHidden', '==', true));
      const postsSnap = await getDocs(postsQ);
      setHiddenPosts(
        postsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
      // Load hidden businesses
      const bizQ = query(collection(db, 'businesses'), where('isHidden', '==', true));
      const bizSnap = await getDocs(bizQ);
      setHiddenBusinesses(
        bizSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (error) {
      console.error('Error loading hidden content:', error);
    } finally {
      setLoadingHidden(false);
    }
  }

  async function unhidePost(postId: string) {
    try {
      await updateDoc(doc(db, 'posts', postId), { isHidden: false, hiddenAt: null, hiddenReason: null });
      setHiddenPosts((prev) => prev.filter((p) => p.id !== postId));
      setToastMessage('Post restored and visible to public.');
    } catch (error) {
      console.error('Error unhiding post:', error);
      setToastMessage('Failed to restore post.');
    }
  }

  async function unhideBusiness(businessId: string) {
    try {
      await updateDoc(doc(db, 'businesses', businessId), { isHidden: false, hiddenAt: null, hiddenReason: null });
      setHiddenBusinesses((prev) => prev.filter((b) => b.id !== businessId));
      setToastMessage('Business restored and visible to public.');
    } catch (error) {
      console.error('Error unhiding business:', error);
      setToastMessage('Failed to restore business.');
    }
  }

  async function permanentlyDeletePost(postId: string) {
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setHiddenPosts((prev) => prev.filter((p) => p.id !== postId));
      setToastMessage('Post permanently deleted.');
    } catch (error) {
      console.error('Error deleting post:', error);
      setToastMessage('Failed to delete post.');
    }
  }

  async function permanentlyDeleteBusiness(businessId: string) {
    try {
      await deleteDoc(doc(db, 'businesses', businessId));
      setHiddenBusinesses((prev) => prev.filter((b) => b.id !== businessId));
      setToastMessage('Business permanently deleted.');
    } catch (error) {
      console.error('Error deleting business:', error);
      setToastMessage('Failed to delete business.');
    }
  }

  // ══════════════════════════════════════════════════
  // NAVIGATION CONFIG
  // ══════════════════════════════════════════════════
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'listings', label: 'Listings', icon: ClipboardList },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'registrations', label: 'Registrations', icon: FileText },
    { id: 'catering', label: 'Catering', icon: ChefHat },
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
              <DashboardPanel loading={loading} dashStats={dashStats} onNavigate={setSelectedSection} />
            )}

            {/* ══════════ USERS ══════════ */}
            {selectedSection === 'users' && (
              <UserManagementPanel
                loading={loading}
                users={users}
                filteredUsers={filteredUsers}
                userSearch={userSearch}
                onUserSearchChange={setUserSearch}
                userFilter={userFilter}
                onUserFilterChange={setUserFilter}
                bannedUserIds={bannedUserIds}
                disabledUserIds={disabledUserIds}
                expandedUser={expandedUser}
                onExpandedUserChange={setExpandedUser}
                deletingContent={deletingContent}
                isUserAdmin={isUserAdmin}
                onDisableUser={disableUser}
                onEnableUser={enableUser}
                onBanUser={banUser}
                onUnbanUser={unbanUser}
                onDeleteContent={deleteAllUserContent}
                onRemoveUser={removeUser}
              />
            )}

            {/* ══════════ LISTINGS ══════════ */}
            {selectedSection === 'listings' && (
              <ListingPanel
                loading={loading}
                filteredListings={filteredListings}
                listingSearch={listingSearch}
                onListingSearchChange={setListingSearch}
                listingFilter={listingFilter}
                onListingFilterChange={setListingFilter}
                sourceIcon={sourceIcon}
                sourceLabel={sourceLabel}
                onToggleVerify={toggleVerifyListing}
                onToggleDisable={toggleDisableListing}
                onDeleteListing={deleteListing}
              />
            )}

            {/* ══════════ EVENTS ══════════ */}
            {selectedSection === 'events' && (
              <EventPanel
                loading={loading}
                filteredAdminEvents={filteredAdminEvents}
                eventSearch={eventSearch}
                onEventSearchChange={setEventSearch}
                eventFilter={eventFilter}
                onEventFilterChange={setEventFilter}
                onTogglePromote={togglePromoteEvent}
                onToggleDisable={toggleDisableEvent}
                onDeleteEvent={deleteEvent}
              />
            )}

            {/* ══════════ REGISTRATIONS ══════════ */}
            {selectedSection === 'registrations' && (
              <RegistrationPanel
                registrationsLoading={registrationsLoading}
                pendingRegistrations={pendingRegistrations}
                rejectModalId={rejectModalId}
                rejectReason={rejectReason}
                onRejectReasonChange={setRejectReason}
                onApprove={(id) => {
                  const biz = pendingRegistrations.find((b) => b.id === id);
                  if (biz) {
                    approveRegistration(id, (biz as any)._source)
                      .then(() => {
                        setPendingRegistrations((prev) => prev.filter((b) => b.id !== id));
                        setToastMessage(`${biz.name} approved!`);
                      })
                      .catch((err: any) => {
                        console.error('Approve failed:', err);
                        setToastMessage(`Failed to approve: ${err.message || 'Unknown error'}`);
                      });
                  }
                }}
                onReject={(id, reason) => {
                  const biz = pendingRegistrations.find((b) => b.id === id);
                  if (biz) {
                    rejectRegistration(id, reason, (biz as any)._source)
                      .then(() => {
                        setPendingRegistrations((prev) => prev.filter((b) => b.id !== id));
                        setRejectModalId(null);
                        setToastMessage(`${biz.name} rejected.`);
                      })
                      .catch((err: any) => {
                        console.error('Reject failed:', err);
                        setToastMessage(`Failed to reject: ${err.message || 'Unknown error'}`);
                      });
                  }
                }}
                onOpenRejectModal={(id) => {
                  setRejectModalId(id);
                  setRejectReason('');
                }}
                onCloseRejectModal={() => setRejectModalId(null)}
              />
            )}

            {/* ══════════ CATERING ══════════ */}
            {selectedSection === 'catering' && (
              <CateringPanel
                cateringLoading={cateringLoading}
                cateringOrders={cateringOrders}
                cateringBusinesses={cateringBusinesses}
                cateringFilter={cateringFilter}
                onCateringFilterChange={setCateringFilter}
                cateringActionLoading={cateringActionLoading}
                onStatusChange={handleCateringStatusChange}
                onRefresh={loadCateringData}
              />
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
              <AnnouncementPanel
                announcements={announcements}
                announcementTitle={announcementTitle}
                announcementMessage={announcementMessage}
                onTitleChange={setAnnouncementTitle}
                onMessageChange={setAnnouncementMessage}
                onAddAnnouncement={createAnnouncement}
                onDeleteAnnouncement={deleteAnnouncement}
                onToggleActive={toggleAnnouncementActive}
              />
            )}

            {/* ══════════ MODERATION ══════════ */}
            {selectedSection === 'moderation' && (
              <ModerationPanel
                modQueue={filteredModQueue}
                hiddenPosts={hiddenPosts}
                hiddenBusinesses={hiddenBusinesses}
                onApproveItem={dismissModItem}
                onRejectItem={(id) => {
                  const item = modQueue.find(i => i.id === id);
                  if (item) {
                    setConfirmModal({
                      title: 'Permanently Delete?',
                      message: `Permanently delete this ${item.type}? This cannot be undone.`,
                      confirmLabel: 'Delete',
                      onConfirm: async () => {
                        setConfirmModal(null);
                        try {
                          if (item.contentId && item.collection) {
                            await deleteDoc(doc(db, item.collection, item.contentId));
                          }
                          await dismissModItem(item.id);
                          setToastMessage('Content permanently deleted.');
                        } catch (error) {
                          console.error('Error deleting flagged content:', error);
                          setToastMessage('Failed to delete content.');
                          await dismissModItem(item.id);
                        }
                      }
                    });
                  }
                }}
                onUnhidePost={unhidePost}
                onDeletePost={permanentlyDeletePost}
                onUnhideBusiness={unhideBusiness}
                onDeleteBusiness={permanentlyDeleteBusiness}
              />
            )}

            {/* ══════════ ADMIN ACCESS ══════════ */}
            {selectedSection === 'admins' && (
              <AdminEmailPanel
                adminEmails={adminEmails}
                newAdminEmail={newAdminEmail}
                onNewAdminEmailChange={setNewAdminEmail}
                onAddAdmin={addAdminEmail}
                onRemoveAdmin={removeAdminEmail}
              />
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
