import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, limit, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, where, writeBatch, arrayUnion, onSnapshot, orderBy, startAfter, type DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import EthnicityFilterDropdown from '@/components/EthnicityFilterDropdown';
import { HERITAGE_OPTIONS } from '@/constants/config';
import {
  Search, MapPin, Users, UserPlus, UserMinus,
  X, ChevronDown, MessageCircle, Sparkles,
  Globe, Loader2, RefreshCw, ArrowUpDown,
  Clock, Check, Ban, MoreVertical, PartyPopper,
} from 'lucide-react';

// Interfaces
interface User {
  id: string;
  name: string;
  avatar: string;
  heritage: string | string[];
  city: string;
  profession: string;
  bio: string;
  interests: string[];
  email?: string;
  phone?: string;
  showLocation?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  updatedAt?: any;
  createdAt?: any;
}

interface ConnectionDetail {
  status: 'pending' | 'connected';
  initiatedBy: string;
  connectedAt?: any;
  createdAt?: any; // #3.4: When the request was sent
}

// Constants
// #3.10: Expanded heritage color map — covers all major heritage groups
const HERITAGE_COLORS: Record<string, string> = {
  // South Asia
  'Indian': 'from-orange-400/20 to-green-400/20',
  'Malayali': 'from-orange-400/20 to-green-400/20',
  'Tamil': 'from-orange-400/20 to-green-400/20',
  'Telugu': 'from-orange-400/20 to-green-400/20',
  'Kannada': 'from-orange-400/20 to-green-400/20',
  'Bengali': 'from-orange-400/20 to-green-400/20',
  'Gujarati': 'from-orange-400/20 to-green-400/20',
  'Punjabi': 'from-orange-400/20 to-green-400/20',
  'Marathi': 'from-orange-400/20 to-green-400/20',
  'Pakistani': 'from-green-500/20 to-white/10',
  'Bangladeshi': 'from-green-400/20 to-red-400/20',
  'Sri Lankan': 'from-yellow-400/20 to-red-500/20',
  'Nepali': 'from-blue-400/20 to-red-400/20',
  'Bhutanese': 'from-orange-400/20 to-yellow-400/20',
  'Maldivian': 'from-red-400/20 to-green-400/20',
  'Afghan': 'from-green-400/20 to-red-400/20',
  // East Asia
  'Han Chinese': 'from-red-500/20 to-yellow-400/20',
  'Chinese': 'from-red-500/20 to-yellow-400/20',
  'Japanese': 'from-red-400/20 to-white/10',
  'Korean': 'from-blue-400/20 to-red-400/20',
  'Taiwanese': 'from-red-500/20 to-blue-400/20',
  'Mongolian': 'from-blue-500/20 to-red-400/20',
  // Southeast Asia
  'Filipino': 'from-blue-500/20 to-red-400/20',
  'Vietnamese': 'from-red-500/20 to-yellow-400/20',
  'Thai': 'from-blue-400/20 to-red-400/20',
  'Indonesian': 'from-red-400/20 to-white/10',
  'Malaysian': 'from-blue-400/20 to-yellow-400/20',
  'Cambodian': 'from-blue-500/20 to-red-400/20',
  'Burmese': 'from-yellow-400/20 to-green-400/20',
  // Middle East
  'Lebanese': 'from-red-400/20 to-green-400/20',
  'Syrian': 'from-red-400/20 to-green-400/20',
  'Iraqi': 'from-red-400/20 to-green-400/20',
  'Iranian': 'from-green-400/20 to-red-400/20',
  'Turkish': 'from-red-500/20 to-white/10',
  'Palestinian': 'from-green-400/20 to-red-400/20',
  'Saudi': 'from-green-500/20 to-white/10',
  'Emirati': 'from-green-400/20 to-red-400/20',
  // Africa
  'Nigerian': 'from-green-500/20 to-white/10',
  'Ghanaian': 'from-red-400/20 to-yellow-400/20',
  'Ethiopian': 'from-green-400/20 to-yellow-400/20',
  'Kenyan': 'from-green-400/20 to-red-400/20',
  'South African': 'from-green-400/20 to-yellow-400/20',
  'Egyptian': 'from-red-400/20 to-yellow-400/20',
  'Moroccan': 'from-red-400/20 to-green-400/20',
  'Somali': 'from-blue-400/20 to-white/10',
  'Sub-Saharan African': 'from-green-400/20 to-yellow-400/20',
  'North African Arab': 'from-red-400/20 to-green-400/20',
  // Europe
  'French': 'from-blue-500/20 to-red-400/20',
  'German': 'from-yellow-400/20 to-red-400/20',
  'Italian': 'from-green-400/20 to-red-400/20',
  'Spanish': 'from-red-400/20 to-yellow-400/20',
  'Portuguese': 'from-green-400/20 to-red-400/20',
  'Greek': 'from-blue-400/20 to-white/10',
  'Irish': 'from-green-400/20 to-orange-400/20',
  'English': 'from-red-400/20 to-blue-400/20',
  'Scottish': 'from-blue-400/20 to-white/10',
  'Polish': 'from-red-400/20 to-white/10',
  'Ukrainian': 'from-blue-400/20 to-yellow-400/20',
  'Russian': 'from-blue-400/20 to-red-400/20',
  // Americas
  'Mexican': 'from-green-500/20 to-red-400/20',
  'Brazilian': 'from-green-400/20 to-yellow-400/20',
  'Colombian': 'from-yellow-400/20 to-blue-400/20',
  'Puerto Rican': 'from-red-400/20 to-blue-400/20',
  'Cuban': 'from-blue-400/20 to-red-400/20',
  'Jamaican': 'from-green-400/20 to-yellow-400/20',
  'Hispanic or Latino': 'from-red-400/20 to-yellow-400/20',
  // Oceania
  'Australian': 'from-blue-400/20 to-yellow-400/20',
  'Maori': 'from-red-400/20 to-black/10',
  'Aboriginal Australian': 'from-red-500/20 to-yellow-400/20',
  'Samoan': 'from-blue-400/20 to-red-400/20',
  'Fijian': 'from-blue-400/20 to-white/10',
  // Indigenous
  'Native American': 'from-red-500/20 to-yellow-400/20',
  'First Nations': 'from-red-400/20 to-white/10',
};

// Helper Functions
const computeMatchScore = (person: User, currentUserProfile: any, mutualCount: number = 0): number => {
  let score = 0;

  if (!currentUserProfile) return score;

  // Shared interests
  const sharedInterests = (person.interests || []).filter(
    (interest) => (currentUserProfile.interests || []).includes(interest)
  );
  score += sharedInterests.length * 20;

  // Shared heritage
  const userHeritage = Array.isArray(currentUserProfile.heritage)
    ? currentUserProfile.heritage
    : [currentUserProfile.heritage].filter(Boolean);
  const personHeritage = Array.isArray(person.heritage)
    ? person.heritage
    : [person.heritage].filter(Boolean);
  const sharedHeritage = personHeritage.filter((h) => userHeritage.includes(h));
  if (sharedHeritage.length > 0) score += 25;

  // Same city
  if (
    currentUserProfile.city &&
    person.city &&
    currentUserProfile.city.toLowerCase() === person.city.toLowerCase()
  ) {
    score += 20;
  }

  // Same profession
  if (currentUserProfile.profession && person.profession === currentUserProfile.profession) {
    score += 15;
  }

  // Mutual connections bonus (capped at 30)
  score += Math.min(mutualCount * 15, 30);

  return Math.min(score, 100);
};

/** #1.9: Ranked search — returns priority (1 = prefix, 2 = substring, 3 = fuzzy, 0 = no match) */
const searchRank = (text: string, query: string): number => {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 0;
  // Prefix match (highest priority)
  if (t.startsWith(q)) return 1;
  // Word-start match (e.g., "dev" matches "Software Developer")
  if (t.includes(' ' + q)) return 1;
  // Substring match
  if (t.includes(q)) return 2;
  // Fuzzy match (character-by-character subsequence)
  let idx = 0;
  for (const char of q) {
    idx = t.indexOf(char, idx);
    if (idx === -1) return 0;
    idx++;
  }
  return 3;
};

const fuzzyMatch = (text: string, query: string): boolean => {
  return searchRank(text, query) > 0;
};

// #3.1: Enhanced avatar rendering with photo support
const renderAvatar = (avatar: string | undefined, name: string, size: 'sm' | 'md' | 'lg' = 'sm'): React.ReactNode => {
  const isPhoto = avatar && (avatar.startsWith('http') || avatar.startsWith('data:'));
  if (isPhoto) {
    return <img src={avatar} alt={name} className="w-full h-full rounded-full object-cover" loading="lazy" />;
  }
  if (avatar && /\p{Emoji}/u.test(avatar)) {
    const emojiSize = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base';
    return <span className={emojiSize}>{avatar}</span>;
  }
  const textSize = size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm';
  return <span className={`${textSize} font-bold`}>{name.charAt(0).toUpperCase() || '👤'}</span>;
};

/** Check if avatar is an actual photo (URL) vs emoji/initial */
const hasPhotoAvatar = (avatar: string | undefined): boolean => {
  return !!(avatar && (avatar.startsWith('http') || avatar.startsWith('data:')));
};

const MatchBadge: React.FC<{ score: number; inline?: boolean }> = ({ score, inline = false }) => {
  if (score < 40) return null;
  const color = score >= 75 ? 'from-green-400 to-emerald-500' : 'from-blue-400 to-cyan-500';
  return (
    <div className={`${inline ? '' : 'absolute top-3 right-3'} bg-gradient-to-r ${color} text-white text-xs font-bold px-2 py-1 rounded-full`}>
      {score}%
    </div>
  );
};

const isNewMember = (person: User): boolean => {
  if (!person.createdAt) return false;
  const created = person.createdAt?.toDate ? person.createdAt.toDate() : new Date(person.createdAt);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  return created > fourteenDaysAgo;
};

const isRecentlyActive = (person: User): boolean => {
  if (!person.updatedAt) return false;
  const updated = person.updatedAt?.toDate ? person.updatedAt.toDate() : new Date(person.updatedAt);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return updated > sevenDaysAgo;
};

/** #3.6: Highlight matching text in search results */
const HighlightText: React.FC<{ text: string; query: string; className?: string }> = ({ text, query, className = '' }) => {
  if (!query.trim() || !text) return <span className={className}>{text}</span>;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </span>
  );
};

/** #3.4: Format connection request timestamp */
const formatRequestTime = (timestamp: any): string => {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const SkeletonCard: React.FC = () => (
  <div className="bg-aurora-surface rounded-2xl border border-[var(--aurora-border)] p-4 animate-pulse">
    <div className="w-12 h-12 bg-[var(--aurora-border)] rounded-full mx-auto mb-3" />
    <div className="h-3.5 bg-[var(--aurora-border)] rounded mb-2.5" />
    <div className="h-3 bg-[var(--aurora-border)] rounded mb-2.5 w-3/4" />
    <div className="h-3 bg-[var(--aurora-border)] rounded mb-3 w-1/2" />
    <div className="h-8 bg-[var(--aurora-border)] rounded-lg" />
  </div>
);

// Main Component
export default function DiscoverPage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  // State
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHeritage, setSelectedHeritage] = useState<string[]>([]);
  const heritageDisplayCount = selectedHeritage.length;

  // #3.8: Default heritage filter to "All" — no pre-selection so users discover cross-heritage connections

  const [connections, setConnections] = useState<Map<string, 'pending' | 'connected'>>(new Map());
  const [connectionDetails, setConnectionDetails] = useState<Map<string, ConnectionDetail>>(new Map());
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<User | null>(null);
  const [sortBy, setSortBy] = useState<'match' | 'name' | 'recent'>('match');
  const [activeTab, setActiveTab] = useState<'discover' | 'network' | 'pending'>('discover');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnectPersonId, setDisconnectPersonId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTile, setActiveTile] = useState<'connections' | 'pending' | 'members' | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockTargetUser, setBlockTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [mutualListFor, setMutualListFor] = useState<string | null>(null);
  // #2.2: Cursor-based pagination state
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 30;
  // #3.5: PYMK "View All" expansion state
  const [expandedPymk, setExpandedPymk] = useState<Record<string, boolean>>({});
  const PYMK_PREVIEW = 6; // Show first 6 in carousel, expand for more
  // #3.9: Accept animation state
  const [acceptAnimatingId, setAcceptAnimatingId] = useState<string | null>(null);

  // #2.8: Load blocked users from userProfile (already fetched by AuthContext — eliminates extra Firestore read)
  useEffect(() => {
    if (!userProfile) return;
    setBlockedUsers((userProfile as any).blockedUsers || []);
  }, [userProfile]);

  // Block user handler
  const handleBlockUser = async () => {
    if (!user || !blockTargetUser) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: arrayUnion(blockTargetUser.id),
      });
      setBlockedUsers((prev) => [...prev, blockTargetUser.id]);
      setToastMessage(`${blockTargetUser.name} has been blocked`);
      setSelectedPerson(null);
    } catch (err) {
      console.error('Failed to block user:', err);
      setToastMessage('Failed to block user');
    } finally {
      setShowBlockConfirm(false);
      setBlockTargetUser(null);
    }
  };

  const openBlockConfirm = (personId: string, personName: string) => {
    setBlockTargetUser({ id: personId, name: personName });
    setShowBlockConfirm(true);
    setOpenMenuId(null);
  };

  // Handle tile click — switch tab and highlight tile
  const handleTileClick = useCallback((tile: 'connections' | 'pending' | 'members') => {
    setActiveTile(tile);
    if (tile === 'members') {
      setActiveTab('discover');
    } else if (tile === 'pending') {
      setActiveTab('pending');
    } else {
      setActiveTab('network');
    }
  }, []);

  // Close heritage dropdown on click outside - replaced with ClickOutsideOverlay component

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handleClick = () => setOpenMenuId(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [openMenuId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Helper function
  const getConnectionId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  };

  // Fetch people data
  const [refreshing, setRefreshing] = useState(false);

  // #2.2: Helper to process raw Firestore user docs into User[] with batched settings
  const processUsersWithSettings = useCallback(async (usersData: { docId: string; data: any }[]): Promise<User[]> => {
    // #2.1: Batch fetch userSettings instead of N+1 individual getDoc calls
    const settingsMap = new Map<string, any>();
    const userIds = usersData.map((u) => u.docId);
    const BATCH_SIZE = 30;
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      try {
        const settingsSnap = await getDocs(
          query(collection(db, 'userSettings'), where('__name__', 'in', batch))
        );
        settingsSnap.forEach((d) => settingsMap.set(d.id, d.data()));
      } catch {
        // Fallback: if batch fails, settings stay empty (privacy defaults apply)
      }
    }

    const peopleData: User[] = [];
    for (const { docId, data } of usersData) {
      const privacy = settingsMap.get(docId)?.privacy;
      if (privacy?.searchable === false) continue;
      if (privacy?.profileVisibility === 'private') continue;

      peopleData.push({
        id: docId,
        name: data.name || '',
        avatar: data.avatar || '👤',
        heritage: data.heritage || 'Other',
        city: data.city || 'Earth',
        profession: (data.profession && data.profession !== 'N/A' && data.profession !== 'n/a') ? data.profession : '',
        bio: data.bio || '',
        interests: Array.isArray(data.interests) ? data.interests : [],
        email: data.email || '',
        phone: data.phone || '',
        showLocation: privacy?.showLocation !== false,
        showEmail: privacy?.showEmail === true,
        showPhone: privacy?.showPhone === true,
        updatedAt: data.updatedAt || null,
        createdAt: data.createdAt || null,
      });
    }
    return peopleData;
  }, []);

  // #2.2: Cursor-based pagination — initial fetch
  const fetchPeople = useCallback(async () => {
    try {
      setFetchError(null);
      const q = query(collection(db, 'users'), orderBy('name'), limit(PAGE_SIZE));
      const snapshot = await getDocs(q);

      const usersData: { docId: string; data: any }[] = [];
      snapshot.forEach((d) => {
        if (d.id !== user?.uid) {
          usersData.push({ docId: d.id, data: d.data() });
        }
      });

      const peopleData = await processUsersWithSettings(usersData);
      setPeople(peopleData);

      // Track last doc for cursor pagination
      if (snapshot.docs.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(true);
      }
    } catch (error) {
      console.error('Error fetching people:', error);
      setFetchError('Failed to load people. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, processUsersWithSettings]);

  // #2.2: Load more people (next page)
  const loadMorePeople = useCallback(async () => {
    if (!lastDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('name'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);

      const usersData: { docId: string; data: any }[] = [];
      snapshot.forEach((d) => {
        if (d.id !== user?.uid) {
          usersData.push({ docId: d.id, data: d.data() });
        }
      });

      const morePeople = await processUsersWithSettings(usersData);
      setPeople((prev) => {
        // Deduplicate by ID
        const existingIds = new Set(prev.map((p) => p.id));
        const newPeople = morePeople.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newPeople];
      });

      if (snapshot.docs.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (error) {
      console.error('Error loading more people:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [lastDoc, loadingMore, hasMore, user?.uid, processUsersWithSettings]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  // Manual refresh handler — resets pagination
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setLastDoc(null);
    setHasMore(true);
    setPeople([]);
    await fetchPeople();
    setRefreshing(false);
  }, [fetchPeople]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPerson) {
        setSelectedPerson(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedPerson]);

  // #2.7: Real-time connections via onSnapshot (replaces one-time getDocs)
  // #2.4: Legacy migration runs once per mount, gated by localStorage + ref
  const migrationAttemptedRef = useRef(false);
  useEffect(() => {
    if (!user?.uid) return;
    migrationAttemptedRef.current = false;
    const q1 = query(collection(db, 'connections'), where('users', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(q1, async (connSnap) => {
      const connMap = new Map<string, 'pending' | 'connected'>();
      const detailsMap = new Map<string, ConnectionDetail>();

      connSnap.forEach((d) => {
        const data = d.data();
        const otherUid = (data.users as string[]).find((uid: string) => uid !== user.uid);
        if (otherUid) {
          const status = data.status || 'connected';
          connMap.set(otherUid, status);
          detailsMap.set(otherUid, {
            status,
            initiatedBy: data.initiatedBy || '',
            connectedAt: data.connectedAt || null,
            createdAt: data.createdAt || null, // #3.4: track request timestamp
          });
        }
      });

      // Legacy migration: only attempt once per mount + localStorage gate
      if (!migrationAttemptedRef.current) {
        migrationAttemptedRef.current = true;
        const migrationKey = `discover_migrated_${user.uid}`;
        if (localStorage.getItem(migrationKey) !== 'true') {
          try {
            const legacySnap = await getDocs(collection(db, 'users', user.uid, 'connections'));
            for (const d of legacySnap.docs) {
              if (!connMap.has(d.id)) {
                const connId = getConnectionId(user.uid, d.id);
                try {
                  await setDoc(doc(db, 'connections', connId), {
                    users: [user.uid, d.id].sort(),
                    status: 'connected',
                    connectedAt: d.data().connectedAt || serverTimestamp(),
                    migratedAt: serverTimestamp(),
                  });
                  connMap.set(d.id, 'connected');
                  detailsMap.set(d.id, { status: 'connected', initiatedBy: '', connectedAt: d.data().connectedAt });
                } catch {
                  connMap.set(d.id, d.data().status || 'connected');
                  detailsMap.set(d.id, { status: d.data().status || 'connected', initiatedBy: '' });
                }
              }
            }
          } catch {
            // Legacy subcollection may not exist
          }
          localStorage.setItem(migrationKey, 'true');
        }
      }

      setConnections(connMap);
      setConnectionDetails(detailsMap);
    }, (err) => {
      console.error('Error listening to connections:', err);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Handle connect
  const handleConnect = async (personId: string) => {
    if (!user?.uid || connectingId) return;

    const currentStatus = connections.get(personId);
    if (currentStatus === 'connected') {
      // Show disconnect confirmation modal instead of window.confirm
      setDisconnectPersonId(personId);
      setShowDisconnectConfirm(true);
      return;
    }

    setConnectingId(personId);
    const connId = getConnectionId(user.uid, personId);

    try {
      if (currentStatus === 'pending') {
        // Withdraw pending request
        await deleteDoc(doc(db, 'connections', connId));
        setConnections((prev) => {
          const m = new Map(prev);
          m.delete(personId);
          return m;
        });
        setConnectionDetails((prev) => {
          const m = new Map(prev);
          m.delete(personId);
          return m;
        });
      } else {
        // Send connection request
        await setDoc(doc(db, 'connections', connId), {
          users: [user.uid, personId].sort(),
          status: 'pending',
          initiatedBy: user.uid,
          connectedAt: null,
          createdAt: serverTimestamp(),
        });
        setConnections((prev) => new Map(prev).set(personId, 'pending'));
        setConnectionDetails((prev) =>
          new Map(prev).set(personId, { status: 'pending', initiatedBy: user.uid })
        );
      }
    } catch (err) {
      console.error('Error toggling connection:', err);
      setToastMessage('Connection failed. Please try again.');
    } finally {
      setConnectingId(null);
    }
  };

  // Confirm disconnect (replaces window.confirm)
  const confirmDisconnect = async () => {
    if (!disconnectPersonId || !user?.uid) return;
    setConnectingId(disconnectPersonId);
    const connId = getConnectionId(user.uid, disconnectPersonId);
    try {
      await deleteDoc(doc(db, 'connections', connId));
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'connections', disconnectPersonId));
      } catch {}
      try {
        await deleteDoc(doc(db, 'users', disconnectPersonId, 'connections', user.uid));
      } catch {}
      setConnections((prev) => {
        const m = new Map(prev);
        m.delete(disconnectPersonId);
        return m;
      });
      setConnectionDetails((prev) => {
        const m = new Map(prev);
        m.delete(disconnectPersonId);
        return m;
      });
    } catch (err) {
      console.error('Error disconnecting:', err);
      setToastMessage('Failed to disconnect. Please try again.');
    } finally {
      setConnectingId(null);
      setShowDisconnectConfirm(false);
      setDisconnectPersonId(null);
    }
  };

  // Handle accept connection
  const handleAcceptConnection = async (personId: string) => {
    if (!user?.uid || connectingId) return;
    setConnectingId(personId);
    const connId = getConnectionId(user.uid, personId);
    try {
      const connRef = doc(db, 'connections', connId);
      const connSnap = await getDoc(connRef);
      if (connSnap.exists()) {
        // Existing pending request — update status to connected
        await updateDoc(connRef, {
          status: 'connected',
          connectedAt: serverTimestamp(),
        });
      } else {
        // No existing doc (edge case) — create fresh
        await setDoc(connRef, {
          users: [user.uid, personId].sort(),
          status: 'connected',
          initiatedBy: personId,
          createdAt: serverTimestamp(),
          connectedAt: serverTimestamp(),
        });
      }
      setConnections((prev) => new Map(prev).set(personId, 'connected'));
      setConnectionDetails((prev) =>
        new Map(prev).set(personId, {
          status: 'connected',
          initiatedBy: connectionDetails.get(personId)?.initiatedBy || personId,
          connectedAt: new Date(),
        })
      );
      // #3.9: Trigger accept animation
      setAcceptAnimatingId(personId);
      setTimeout(() => setAcceptAnimatingId(null), 2000);
      setToastMessage('Connection accepted! 🎉');
    } catch (err) {
      console.error('Error accepting connection:', err);
      setToastMessage('Failed to accept connection. Please try again.');
    } finally {
      setConnectingId(null);
    }
  };

  // Handle decline connection
  const handleDeclineConnection = async (personId: string) => {
    if (!user?.uid || connectingId) return;
    setConnectingId(personId);
    const connId = getConnectionId(user.uid, personId);
    try {
      await deleteDoc(doc(db, 'connections', connId));
      setConnections((prev) => {
        const m = new Map(prev);
        m.delete(personId);
        return m;
      });
      setConnectionDetails((prev) => {
        const m = new Map(prev);
        m.delete(personId);
        return m;
      });
    } catch (err) {
      console.error('Error declining connection:', err);
      setToastMessage('Failed to decline connection. Please try again.');
    } finally {
      setConnectingId(null);
    }
  };

  // Computed values
  const connectedCount = Array.from(connections.values()).filter((s) => s === 'connected').length;
  const pendingCount = Array.from(connections.entries()).filter(
    ([pid, s]) => s === 'pending' && connectionDetails.get(pid)?.initiatedBy !== user?.uid
  ).length;
  const discoverCount = people.filter((p) => {
    const status = connections.get(p.id);
    if (!status) return true;
    if (status === 'pending' && connectionDetails.get(p.id)?.initiatedBy === user?.uid) return true;
    return false;
  }).length;

  // Helper: render heritage badge(s) for a person, hidden if "Prefer Not to Say"
  const renderHeritage = (person: User, size: 'xs' | 'sm' = 'xs') => {
    const raw = Array.isArray(person.heritage) ? person.heritage : [person.heritage];
    const display = raw.filter((h) => h && h !== 'Prefer Not to Say' && h !== 'Other');
    if (display.length === 0) return null;
    return (
      <p className={`text-${size} text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5`}>
        <Globe className="w-3 h-3 shrink-0" /> <span className="truncate">{display.join(', ')}</span>
      </p>
    );
  };

  // ── #1.2: Pre-computed mutual connections (single pass, O(n) instead of O(n²)) ──
  // Build a Map<personId, User[]> of mutual connections in one pass.
  // "Mutual" = a person you're connected to who shares heritage or city with the target.
  const mutualConnectionsMap = useMemo(() => {
    const map = new Map<string, User[]>();
    if (!people.length) return map;

    // Build a people lookup for O(1) access
    const peopleLookup = new Map<string, User>();
    for (const p of people) peopleLookup.set(p.id, p);

    // Collect connected user IDs
    const connectedUsers: User[] = [];
    connections.forEach((status, uid) => {
      if (status === 'connected') {
        const p = peopleLookup.get(uid);
        if (p) connectedUsers.push(p);
      }
    });

    // For each person in the people list, check which of your connected users
    // share heritage or city with them
    for (const target of people) {
      const tHeritage = Array.isArray(target.heritage) ? target.heritage : [target.heritage];
      const mutuals: User[] = [];

      for (const conn of connectedUsers) {
        if (conn.id === target.id) continue;
        const cHeritage = Array.isArray(conn.heritage) ? conn.heritage : [conn.heritage];
        const sharedHeritage = tHeritage.some((h) => cHeritage.includes(h));
        const sharedCity = target.city && conn.city && target.city.toLowerCase() === conn.city.toLowerCase();
        if (sharedHeritage || sharedCity) mutuals.push(conn);
      }

      if (mutuals.length > 0) map.set(target.id, mutuals);
    }

    return map;
  }, [people, connections]);

  /** Get pre-computed mutual connection count for a person */
  const getMutualConnectionCount = useCallback((personId: string): number => {
    return mutualConnectionsMap.get(personId)?.length || 0;
  }, [mutualConnectionsMap]);

  /** Get actual mutual connection User objects */
  const getMutualConnections = useCallback((personId: string): User[] => {
    return mutualConnectionsMap.get(personId) || [];
  }, [mutualConnectionsMap]);

  // #2.5: Pre-computed match scores — cached in a Map to avoid recomputing during sort/render
  const matchScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!userProfile) return map;
    for (const p of people) {
      map.set(p.id, computeMatchScore(p, userProfile, getMutualConnectionCount(p.id)));
    }
    return map;
  }, [people, userProfile, getMutualConnectionCount]);

  // Filtered people
  const filteredPeople = useMemo(() => {
    let filtered = people;

    // Filter out blocked users (#2.6: use Set for O(1) lookups instead of Array.includes)
    if (blockedUsers.length > 0) {
      const blockedSet = new Set(blockedUsers);
      filtered = filtered.filter((p) => !blockedSet.has(p.id));
    }

    // Tab filtering
    if (activeTab === 'discover') {
      filtered = filtered.filter((p) => {
        const status = connections.get(p.id);
        if (!status) return true; // not connected
        if (status === 'pending' && connectionDetails.get(p.id)?.initiatedBy !== user?.uid)
          return false; // incoming request shows in pending tab
        return status === 'pending' && connectionDetails.get(p.id)?.initiatedBy === user?.uid; // sent pending still shows
      });
    } else if (activeTab === 'pending') {
      // Pending tab: only incoming requests (initiated by the other person)
      // Bonus: Skip heritage filter for pending tab — incoming requests should always be visible
      filtered = filtered.filter((p) => {
        const status = connections.get(p.id);
        const detail = connectionDetails.get(p.id);
        return status === 'pending' && detail?.initiatedBy && detail.initiatedBy !== user?.uid;
      });
    } else {
      // My Network: only connected people
      filtered = filtered.filter((p) => connections.get(p.id) === 'connected');
    }

    // Heritage filter — skip for pending tab (incoming requests should always show)
    if (selectedHeritage.length > 0 && activeTab !== 'pending') {
      filtered = filtered.filter((person) => {
        if (Array.isArray(person.heritage)) return person.heritage.some((h: string) => selectedHeritage.includes(h));
        return person.heritage ? selectedHeritage.includes(person.heritage) : false;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      filtered = filtered.filter(
        (person) =>
          fuzzyMatch(person.name, q) ||
          fuzzyMatch(person.city, q) ||
          fuzzyMatch(person.profession, q) ||
          person.interests.some((i) => fuzzyMatch(i, q))
      );
      // #1.9: Sort by best search match (prefix > substring > fuzzy) before other sorting
      filtered = filtered.sort((a, b) => {
        const rankA = Math.min(
          searchRank(a.name, q) || 99,
          searchRank(a.city, q) || 99,
          searchRank(a.profession, q) || 99,
          ...a.interests.map((i) => searchRank(i, q) || 99),
        );
        const rankB = Math.min(
          searchRank(b.name, q) || 99,
          searchRank(b.city, q) || 99,
          searchRank(b.profession, q) || 99,
          ...b.interests.map((i) => searchRank(i, q) || 99),
        );
        return rankA - rankB;
      });
    }

    // Apply sort — uses cached match scores (#2.5) for O(1) lookups
    return filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'recent') {
        const aTime = a.updatedAt?.toDate
          ? a.updatedAt.toDate().getTime()
          : a.updatedAt
            ? new Date(a.updatedAt).getTime()
            : 0;
        const bTime = b.updatedAt?.toDate
          ? b.updatedAt.toDate().getTime()
          : b.updatedAt
            ? new Date(b.updatedAt).getTime()
            : 0;
        return bTime - aTime;
      }
      // Default: match score sort (skipped when search query active — already sorted by relevance)
      if (searchQuery.trim()) return 0;
      return (matchScoreMap.get(b.id) || 0) - (matchScoreMap.get(a.id) || 0);
    });
  }, [people, selectedHeritage, searchQuery, matchScoreMap, sortBy, connections, connectionDetails, activeTab, user?.uid, blockedUsers]);

  // #2.9: PYMK Groups — single-pass optimization (was 3 separate filter passes)
  const pymkGroups = useMemo(() => {
    if (activeTab !== 'discover' || !userProfile)
      return { sameCity: [], sameHeritage: [], similarInterests: [] };

    const userCity = (userProfile.city || '').toLowerCase();
    const userHeritage = (Array.isArray(userProfile.heritage)
      ? userProfile.heritage
      : [userProfile.heritage].filter(Boolean)
    ).map((h: string) => h.toLowerCase());
    const userInterestsSet = new Set<string>(userProfile.interests || []);

    const sameCity: User[] = [];
    const sameHeritage: User[] = [];
    const similarInterests: User[] = [];

    // Single pass: classify each discoverable person into PYMK groups
    for (const p of people) {
      const status = connections.get(p.id);
      // Discoverable: not connected, or pending sent by me
      if (status === 'connected') continue;
      if (status === 'pending' && connectionDetails.get(p.id)?.initiatedBy !== user?.uid) continue;

      // City match (#3.5: raised cap from 10 to 30 for View All)
      if (sameCity.length < 30 && p.city && userCity && p.city.toLowerCase() === userCity) {
        sameCity.push(p);
      }
      // Heritage match
      if (sameHeritage.length < 30) {
        const pH = (Array.isArray(p.heritage) ? p.heritage : [p.heritage]).filter(Boolean);
        if (pH.some((h: string) => userHeritage.includes(h.toLowerCase()))) {
          sameHeritage.push(p);
        }
      }
      // Shared interests (>= 2)
      if (similarInterests.length < 30) {
        let shared = 0;
        for (const i of (p.interests || [])) {
          if (userInterestsSet.has(i)) shared++;
          if (shared >= 2) { similarInterests.push(p); break; }
        }
      }
    }

    return { sameCity, sameHeritage, similarInterests };
  }, [people, connections, connectionDetails, userProfile, activeTab, user?.uid]);

  // Pending/Sent requests
  const incomingRequests = useMemo(() => {
    return people.filter((p) => {
      const status = connections.get(p.id);
      const detail = connectionDetails.get(p.id);
      return status === 'pending' && detail?.initiatedBy && detail.initiatedBy !== user?.uid;
    });
  }, [people, connections, connectionDetails, user?.uid]);

  const sentRequests = useMemo(() => {
    return people.filter((p) => {
      const status = connections.get(p.id);
      const detail = connectionDetails.get(p.id);
      return status === 'pending' && detail?.initiatedBy === user?.uid;
    });
  }, [people, connections, connectionDetails, user?.uid]);

  if (!user) {
    return (
      <div className="min-h-full bg-aurora-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-aurora-bg pb-4">
      {/* Stats Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <button
              onClick={() => handleTileClick('members')}
              className={`rounded-lg p-2 sm:p-3 backdrop-blur cursor-pointer hover:bg-white/30 transition-all text-left ${
                activeTile === 'members' ? 'bg-white/40 ring-2 ring-white/70 shadow-lg' : 'bg-white/20'
              }`}
            >
              <div className="text-xs text-blue-100">Discover</div>
              <div className="text-xl sm:text-2xl font-bold">{discoverCount}</div>
            </button>
            <button
              onClick={() => handleTileClick('connections')}
              className={`rounded-lg p-2 sm:p-3 backdrop-blur cursor-pointer hover:bg-white/30 transition-all text-left ${
                activeTile === 'connections' ? 'bg-white/40 ring-2 ring-white/70 shadow-lg' : 'bg-white/20'
              }`}
            >
              <div className="text-xs text-blue-100">Network</div>
              <div className="text-xl sm:text-2xl font-bold">{connectedCount}</div>
            </button>
            <button
              onClick={() => handleTileClick('pending')}
              className={`rounded-lg p-2 sm:p-3 backdrop-blur cursor-pointer hover:bg-white/30 transition-all text-left relative ${
                activeTile === 'pending' ? 'bg-white/40 ring-2 ring-white/70 shadow-lg' : 'bg-white/20'
              } ${pendingCount > 0 ? 'ring-2 ring-yellow-400/60' : ''}`}
            >
              <div className="text-xs text-blue-100">Pending</div>
              <div className="text-xl sm:text-2xl font-bold">{pendingCount}</div>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Tab Navigation + Search */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          {/* Search + EthniZity + Tabs row */}
          <div className="flex items-center gap-2 py-3 border-b border-aurora-border">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, city, profession..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* EthniZity Filter Dropdown */}
            <EthnicityFilterDropdown
              selected={selectedHeritage}
              onChange={setSelectedHeritage}
            />

          </div>

        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 md:py-8">
        {/* Error Message */}
        {fetchError && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {fetchError}
          </div>
        )}

        {/* Results Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {activeTab === 'discover' ? 'Discover' : activeTab === 'pending' ? 'Pending Requests' : 'Network'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            {loading
              ? 'Loading...'
              : activeTab === 'discover'
                ? `${filteredPeople.length} people match your filters`
                : activeTab === 'pending'
                  ? `${filteredPeople.length} incoming request${filteredPeople.length !== 1 ? 's' : ''}`
                  : selectedHeritage.length > 0
                    ? `${filteredPeople.length} of ${connectedCount} connections`
                    : `${connectedCount} connections`}
          </p>
          </div>
          <div className="flex items-center gap-2">
            {/* #3.7: Sort selector — visible UI for existing sort state */}
            {activeTab === 'discover' && (
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setSortBy('match')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    sortBy === 'match'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Sort by match score"
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1" />Match
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    sortBy === 'name'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Sort alphabetically"
                >
                  A–Z
                </button>
                <button
                  onClick={() => setSortBy('recent')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    sortBy === 'recent'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title="Sort by recently active"
                >
                  <Clock className="w-3.5 h-3.5 inline mr-1" />Recent
                </button>
              </div>
            )}
            {/* Refresh button (#1.6) */}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              aria-label="Refresh people"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-gray-500 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Incoming Requests Section — shows in Network tab only (not pending tab, which has its own grid) */}
        {activeTab === 'network' && incomingRequests.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              Pending Requests ({incomingRequests.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {incomingRequests.map((person) => (
                <div key={person.id} role="button" tabIndex={0} aria-label={`View profile of ${person.name} — incoming request`}
                  className={`bg-aurora-surface rounded-2xl border-2 overflow-hidden hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all duration-200 flex flex-col cursor-pointer relative ${
                    acceptAnimatingId === person.id
                      ? 'border-green-400 dark:border-green-500/60 scale-[1.02]'
                      : 'border-orange-300 dark:border-orange-500/40'
                  }`}
                  onClick={() => setSelectedPerson(person)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPerson(person); } }}
                >
                  {/* #3.9: Accept animation overlay */}
                  {acceptAnimatingId === person.id && (
                    <div className="absolute inset-0 bg-green-500/10 z-10 flex items-center justify-center rounded-2xl animate-pulse">
                      <div className="bg-green-500 text-white rounded-full p-3 shadow-lg animate-bounce">
                        <Check className="w-6 h-6" />
                      </div>
                    </div>
                  )}
                  <div className="bg-gradient-to-r from-orange-400 to-amber-400 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <UserPlus className="w-3 h-3" /> Wants to connect
                      </div>
                    </div>
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    {/* Avatar + Name side by side */}
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 shrink-0 shadow-sm ${
                        hasPhotoAvatar(person.avatar) ? 'border-white/50' : 'bg-orange-500 text-white border-orange-300'
                      }`}>
                        {renderAvatar(person.avatar, person.name, 'md')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-[var(--aurora-text)] text-sm leading-tight truncate">{person.name}</h4>
                        {person.profession && <p className="text-xs text-[var(--aurora-text-secondary)] truncate">{person.profession}</p>}
                      </div>
                    </div>
                    <div className="mt-2 space-y-0.5">
                      {renderHeritage(person)}
                      {person.showLocation && (
                        <p className="text-xs text-[var(--aurora-text-muted)] flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{person.city}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-auto pt-2.5 flex gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAcceptConnection(person.id); }}
                        disabled={connectingId === person.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeclineConnection(person.id); }}
                        disabled={connectingId === person.id}
                        className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sent Requests Section */}
        {activeTab === 'network' && sentRequests.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              Sent Requests ({sentRequests.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {sentRequests.map((person) => (
                <div key={person.id} role="button" tabIndex={0} aria-label={`View profile of ${person.name} — sent request`}
                  className="bg-aurora-surface rounded-2xl border border-purple-200 dark:border-purple-500/30 overflow-hidden hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all duration-200 flex flex-col cursor-pointer"
                  onClick={() => setSelectedPerson(person)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPerson(person); } }}
                >
                  <div className="bg-gradient-to-r from-purple-500 to-blue-400 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="bg-purple-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Sent request
                      </div>
                    </div>
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    {/* Avatar + Name side by side */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-lg border-2 border-purple-300 shrink-0 shadow-sm">
                        {renderAvatar(person.avatar, person.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-[var(--aurora-text)] text-sm leading-tight truncate">{person.name}</h4>
                        {person.profession && <p className="text-xs text-[var(--aurora-text-secondary)] truncate">{person.profession}</p>}
                      </div>
                    </div>
                    <div className="mt-2 space-y-0.5">
                      {renderHeritage(person)}
                      {person.showLocation && (
                        <p className="text-xs text-[var(--aurora-text-muted)] flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{person.city}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-auto pt-2.5 flex gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleConnect(person.id); }}
                        disabled={connectingId === person.id}
                        className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Clock className="w-3.5 h-3.5" /> Pending
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PYMK Carousels */}
        {activeTab === 'discover' && !loading && (
          <>
            {/* #1.8: Connection Requests removed from Discover tab — now in dedicated Pending tab */}
            {pymkGroups.sameCity.length >= 1 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">From Your City</h3>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{pymkGroups.sameCity.length}</span>
                  </div>
                  {/* #3.5: View All toggle */}
                  {pymkGroups.sameCity.length > PYMK_PREVIEW && (
                    <button
                      onClick={() => setExpandedPymk((prev) => ({ ...prev, city: !prev.city }))}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      {expandedPymk.city ? 'Show Less' : `View All (${pymkGroups.sameCity.length})`}
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto pb-4 scrollbar-hide">
                  <div className={expandedPymk.city ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'flex gap-4 w-max'}>
                    {(expandedPymk.city ? pymkGroups.sameCity : pymkGroups.sameCity.slice(0, PYMK_PREVIEW)).map((person) => (
                      <div
                        key={person.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`View profile of ${person.name}`}
                        className="w-44 sm:w-52 bg-aurora-surface rounded-2xl border border-blue-200 dark:border-blue-500/30 overflow-hidden hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all duration-200 flex flex-col cursor-pointer flex-shrink-0"
                        onClick={() => setSelectedPerson(person)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPerson(person); } }}
                      >
                        <div className="bg-gradient-to-r from-blue-500 to-blue-400 px-3 py-2">
                          <div className="bg-blue-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <MapPin className="w-2.5 h-2.5" /> Your City
                          </div>
                        </div>
                        <div className="p-3 flex-1 flex flex-col">
                          {/* Avatar + Name side by side */}
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg border-2 border-blue-300 shrink-0 shadow-sm">
                              {renderAvatar(person.avatar, person.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-[var(--aurora-text)] text-sm leading-tight truncate">{person.name}</h4>
                              {person.profession && <p className="text-xs text-[var(--aurora-text-secondary)] truncate">{person.profession}</p>}
                            </div>
                          </div>
                          <div className="mt-2 space-y-0.5">
                            {renderHeritage(person)}
                            {person.showLocation && (
                              <p className="text-xs text-[var(--aurora-text-muted)] flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{person.city}</span>
                              </p>
                            )}
                            {isNewMember(person) && (
                              <div className="mt-2 inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-bold px-2 py-0.5 rounded">
                                New
                              </div>
                            )}
                          </div>
                          <div className="mt-auto pt-2.5">
                            {connections.get(person.id) === 'pending' ? (
                              <button
                                disabled
                                className="w-full bg-amber-100 text-amber-700 border border-amber-300 py-1.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5"
                              >
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleConnect(person.id); }}
                                disabled={connectingId === person.id}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <UserPlus className="w-3.5 h-3.5" /> Connect
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {pymkGroups.sameHeritage.length >= 1 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-orange-600" />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Same Heritage</h3>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{pymkGroups.sameHeritage.length}</span>
                  </div>
                  {pymkGroups.sameHeritage.length > PYMK_PREVIEW && (
                    <button
                      onClick={() => setExpandedPymk((prev) => ({ ...prev, heritage: !prev.heritage }))}
                      className="text-xs font-medium text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
                    >
                      {expandedPymk.heritage ? 'Show Less' : `View All (${pymkGroups.sameHeritage.length})`}
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto pb-4 scrollbar-hide">
                  <div className={expandedPymk.heritage ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'flex gap-4 w-max'}>
                    {(expandedPymk.heritage ? pymkGroups.sameHeritage : pymkGroups.sameHeritage.slice(0, PYMK_PREVIEW)).map((person) => (
                      <div
                        key={person.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`View profile of ${person.name}`}
                        className="w-44 sm:w-52 bg-aurora-surface rounded-2xl border border-orange-200 dark:border-orange-500/30 overflow-hidden hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all duration-200 flex flex-col cursor-pointer flex-shrink-0"
                        onClick={() => setSelectedPerson(person)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPerson(person); } }}
                      >
                        <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-3 py-2">
                          <div className="bg-orange-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <Globe className="w-2.5 h-2.5" /> Heritage
                          </div>
                        </div>
                        <div className="p-3 flex-1 flex flex-col">
                          {/* Avatar + Name side by side */}
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg border-2 border-orange-300 shrink-0 shadow-sm">
                              {renderAvatar(person.avatar, person.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-[var(--aurora-text)] text-sm leading-tight truncate">{person.name}</h4>
                              {person.profession && <p className="text-xs text-[var(--aurora-text-secondary)] truncate">{person.profession}</p>}
                            </div>
                          </div>
                          <div className="mt-2 space-y-0.5">
                            {renderHeritage(person)}
                            {person.showLocation && (
                              <p className="text-xs text-[var(--aurora-text-muted)] flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{person.city}</span>
                              </p>
                            )}
                            {isNewMember(person) && (
                              <div className="mt-2 inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-bold px-2 py-0.5 rounded">
                                New
                              </div>
                            )}
                          </div>
                          <div className="mt-auto pt-2.5">
                            {connections.get(person.id) === 'pending' ? (
                              <button
                                disabled
                                className="w-full bg-amber-100 text-amber-700 border border-amber-300 py-1.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5"
                              >
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleConnect(person.id); }}
                                disabled={connectingId === person.id}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <UserPlus className="w-3.5 h-3.5" /> Connect
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {pymkGroups.similarInterests.length >= 1 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Similar Interests</h3>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{pymkGroups.similarInterests.length}</span>
                  </div>
                  {pymkGroups.similarInterests.length > PYMK_PREVIEW && (
                    <button
                      onClick={() => setExpandedPymk((prev) => ({ ...prev, interests: !prev.interests }))}
                      className="text-xs font-medium text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                    >
                      {expandedPymk.interests ? 'Show Less' : `View All (${pymkGroups.similarInterests.length})`}
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto pb-4 scrollbar-hide">
                  <div className={expandedPymk.interests ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'flex gap-4 w-max'}>
                    {(expandedPymk.interests ? pymkGroups.similarInterests : pymkGroups.similarInterests.slice(0, PYMK_PREVIEW)).map((person) => (
                      <div
                        key={person.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`View profile of ${person.name}`}
                        className="w-44 sm:w-52 bg-aurora-surface rounded-2xl border border-purple-200 dark:border-purple-500/30 overflow-hidden hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all duration-200 flex flex-col cursor-pointer flex-shrink-0"
                        onClick={() => setSelectedPerson(person)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPerson(person); } }}
                      >
                        <div className="bg-gradient-to-r from-purple-500 to-violet-400 px-3 py-2">
                          <div className="bg-purple-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <Sparkles className="w-2.5 h-2.5" /> Interests
                          </div>
                        </div>
                        <div className="p-3 flex-1 flex flex-col">
                          {/* Avatar + Name side by side */}
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-lg border-2 border-purple-300 shrink-0 shadow-sm">
                              {renderAvatar(person.avatar, person.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-[var(--aurora-text)] text-sm leading-tight truncate">{person.name}</h4>
                              {person.profession && <p className="text-xs text-[var(--aurora-text-secondary)] truncate">{person.profession}</p>}
                            </div>
                          </div>
                          <div className="mt-2 space-y-0.5">
                            {renderHeritage(person)}
                            {person.showLocation && (
                              <p className="text-xs text-[var(--aurora-text-muted)] flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{person.city}</span>
                              </p>
                            )}
                            {isNewMember(person) && (
                              <div className="mt-2 inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-bold px-2 py-0.5 rounded">
                                New
                              </div>
                            )}
                          </div>
                          <div className="mt-auto pt-2.5">
                            {connections.get(person.id) === 'pending' ? (
                              <button
                                disabled
                                className="w-full bg-amber-100 text-amber-700 border border-amber-300 py-1.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5"
                              >
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleConnect(person.id); }}
                                disabled={connectingId === person.id}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <UserPlus className="w-3.5 h-3.5" /> Connect
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* #3.3: Empty state when all PYMK carousels are empty */}
            {pymkGroups.sameCity.length === 0 && pymkGroups.sameHeritage.length === 0 && pymkGroups.similarInterests.length === 0 && (
              <div className="text-center py-10 mb-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 rounded-2xl border border-dashed border-purple-200 dark:border-purple-800">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-purple-400" />
                </div>
                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-1">Suggestions coming soon</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  As more people join and you update your profile, we'll suggest people who share your city, heritage, and interests.
                </p>
              </div>
            )}
          </>
        )}

        {/* Main Grid/List View */}
        {!loading && filteredPeople.length > 0 && activeTab !== 'pending' && (
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-green-600" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">My Connects</h3>
          </div>
        )}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(9)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="text-center py-16">
            {activeTab === 'discover' ? (
              <>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
                  <Search className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">No people found</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">Try adjusting your filters or search terms</p>
                {selectedHeritage.length > 0 && (
                  <button
                    onClick={() => setSelectedHeritage([])}
                    className="text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 font-medium"
                  >
                    Clear heritage filter
                  </button>
                )}
              </>
            ) : activeTab === 'pending' ? (
              <>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                  <Check className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">All caught up!</h3>
                <p className="text-gray-500 dark:text-gray-400">No incoming connection requests right now.</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
                  <Users className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">No connections yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">Start connecting with people to build your network</p>
                <button
                  onClick={() => setActiveTab('discover')}
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Discover People
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredPeople.map((person) => {
              const score = matchScoreMap.get(person.id) || 0; // #2.5: use cached score
              const status = connections.get(person.id);

              return (
                <div
                  key={person.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View profile of ${person.name}${person.profession ? `, ${person.profession}` : ''}${person.city ? `, ${person.city}` : ''}`}
                  className="group bg-aurora-surface rounded-2xl border border-green-200 dark:border-green-500/30 overflow-hidden cursor-pointer hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all duration-200 flex flex-col"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  onClick={() => setSelectedPerson(person)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPerson(person); } }}
                  onTouchStart={() => {}}
                >
                  {/* Short gradient header */}
                  <div className={`bg-gradient-to-r ${activeTab === 'pending' ? 'from-orange-400 to-amber-400' : 'from-green-500 to-emerald-400'} px-2 py-1.5 flex items-center justify-between`}>
                    {isNewMember(person) && (
                      <span className="bg-green-700 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full leading-none">NEW</span>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <MatchBadge score={score} inline />
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === person.id ? null : person.id); }}
                          className="p-0.5 hover:bg-white/20 rounded-full transition-colors"
                        >
                          <MoreVertical className="w-3.5 h-3.5 text-white/80" />
                        </button>
                        {openMenuId === person.id && (
                          <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[120px] z-20">
                            <button
                              onClick={(e) => { e.stopPropagation(); openBlockConfirm(person.id, person.name); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Ban className="w-3 h-3" /> Block
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Content wrapper — flex-1 to stretch, flex-col to pin button at bottom */}
                  <div className="p-3 flex flex-col flex-1" style={{ minHeight: 0 }}>
                    {/* Avatar + Name/Title side by side (#3.1: enhanced photo avatars) */}
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm shrink-0 ${
                        hasPhotoAvatar(person.avatar)
                          ? 'ring-2 ring-green-400/50 ring-offset-1'
                          : 'bg-blue-500 text-white font-bold text-sm'
                      }`}>
                        {renderAvatar(person.avatar, person.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-[var(--aurora-text)] text-xs truncate leading-tight">
                          <HighlightText text={person.name} query={searchQuery} />
                        </h4>
                        {person.profession && (
                          <p className="text-[10px] text-[var(--aurora-text-secondary)] truncate">
                            <HighlightText text={person.profession} query={searchQuery} />
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Heritage + location + mutual */}
                    <div className="space-y-0.5">
                      {renderHeritage(person)}
                      {person.showLocation && (
                        <p className="text-[10px] text-[var(--aurora-text-muted)] flex items-center gap-0.5 truncate">
                          <MapPin className="w-2.5 h-2.5 shrink-0" /> <HighlightText text={person.city} query={searchQuery} />
                        </p>
                      )}
                      {getMutualConnectionCount(person.id) > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setMutualListFor(person.id); }}
                          className="text-[10px] text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer transition-colors text-left"
                        >
                          {getMutualConnectionCount(person.id)} mutual
                        </button>
                      )}
                      {/* #3.4: Show request timestamp for pending connections */}
                      {activeTab === 'pending' && connectionDetails.get(person.id)?.createdAt && (
                        <p className="text-[9px] text-[var(--aurora-text-muted)] flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 shrink-0" /> {formatRequestTime(connectionDetails.get(person.id)?.createdAt)}
                        </p>
                      )}
                    </div>
                    {/* Action button — pinned to bottom via mt-auto */}
                    <div className="mt-auto pt-2.5">
                      {activeTab === 'pending' ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAcceptConnection(person.id); }}
                            disabled={connectingId === person.id}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg font-medium text-[10px] disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Accept
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeclineConnection(person.id); }}
                            disabled={connectingId === person.id}
                            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-1.5 rounded-lg font-medium text-[10px] disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <X className="w-3 h-3" /> Decline
                          </button>
                        </div>
                      ) : status === 'connected' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/messages?user=${person.id}`); }}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg font-medium text-[10px] flex items-center justify-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" /> Message
                        </button>
                      ) : status === 'pending' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConnect(person.id); }}
                          disabled={connectingId === person.id}
                          className="w-full bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 py-1.5 rounded-lg font-medium text-[10px] disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <Clock className="w-3 h-3" /> Pending
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConnect(person.id); }}
                          disabled={connectingId === person.id}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg font-medium text-[10px] disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" /> Connect
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* #2.2: Load More button for pagination */}
        {!loading && hasMore && activeTab === 'discover' && filteredPeople.length > 0 && (
          <div className="text-center mt-6">
            <button
              onClick={loadMorePeople}
              disabled={loadingMore}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 transition-colors inline-flex items-center gap-2"
            >
              {loadingMore ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
              ) : (
                'Load More People'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Profile Detail Modal */}
      {selectedPerson && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center"
          onClick={() => setSelectedPerson(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Profile details for ${selectedPerson.name}`}
        >
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-lg rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`h-40 bg-gradient-to-r ${
              HERITAGE_COLORS[
                Array.isArray(selectedPerson.heritage)
                  ? selectedPerson.heritage[0]
                  : selectedPerson.heritage
              ] || 'from-gray-300 to-gray-400'
            } relative`}>
              <button
                onClick={() => setSelectedPerson(null)}
                className="absolute top-3 right-3 p-1.5 bg-black/30 hover:bg-black/50 rounded-full transition-colors"
                aria-label="Close profile"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6">

              <div className="relative mb-4">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center -mt-16 relative z-10 border-4 border-white mx-auto ${
                  hasPhotoAvatar(selectedPerson.avatar) ? '' : 'bg-blue-500 text-white font-bold text-4xl'
                }`}>
                  {renderAvatar(selectedPerson.avatar, selectedPerson.name, 'lg')}
                </div>
                {isRecentlyActive(selectedPerson) && (
                  <div className="absolute w-5 h-5 bg-green-500 rounded-full border-2 border-white bottom-0 right-1/3" />
                )}
              </div>

              <h2 className="text-2xl font-bold text-gray-800 dark:text-white text-center mb-1">
                {selectedPerson.name}
              </h2>

              {/* Badges row: New Member + Match Score */}
              <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                {isNewMember(selectedPerson) && (
                  <span className="inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-bold px-3 py-1 rounded">
                    New Member
                  </span>
                )}
                {(() => {
                  const matchScore = matchScoreMap.get(selectedPerson.id) || 0; // #2.5: use cached score
                  return matchScore > 0 ? (
                    <span className="inline-block bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-bold px-3 py-1 rounded">
                      {matchScore}% Match
                    </span>
                  ) : null;
                })()}
              </div>

              {selectedPerson.profession && <p className="text-gray-600 dark:text-gray-300 text-center mb-1">{selectedPerson.profession}</p>}

              {/* Heritage / EthniZity */}
              <div className="flex items-center justify-center mb-1">
                {renderHeritage(selectedPerson)}
              </div>

              {selectedPerson.showLocation && (
                <p className="text-gray-500 dark:text-gray-400 text-center flex items-center justify-center gap-1 mb-1">
                  <MapPin className="w-4 h-4" /> {selectedPerson.city}
                </p>
              )}

              {getMutualConnectionCount(selectedPerson.id) > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setMutualListFor(selectedPerson.id); }}
                  className="block mx-auto text-xs text-blue-600 dark:text-blue-400 font-medium mb-1 hover:text-blue-800 hover:underline cursor-pointer transition-colors">
                  {getMutualConnectionCount(selectedPerson.id)} mutual connections
                </button>
              )}

              {/* #3.2: Activity stats — social proof indicators */}
              <div className="flex items-center justify-center gap-6 py-3 mb-4 border-y border-gray-100 dark:border-gray-700">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800 dark:text-white">
                    {(() => {
                      // Count connections this person has
                      let count = 0;
                      connections.forEach((status, uid) => {
                        if (status === 'connected' && uid === selectedPerson.id) count++;
                      });
                      // They're connected to us? That's at least 1. Use mutual count as proxy for their connections.
                      return getMutualConnectionCount(selectedPerson.id) || '—';
                    })()}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Connections</p>
                </div>
                <div className="w-px h-8 bg-gray-200 dark:bg-gray-600" />
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800 dark:text-white">
                    {selectedPerson.interests?.length || 0}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Interests</p>
                </div>
                <div className="w-px h-8 bg-gray-200 dark:bg-gray-600" />
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800 dark:text-white">
                    {(() => {
                      if (!selectedPerson.createdAt) return '—';
                      const d = selectedPerson.createdAt?.toDate ? selectedPerson.createdAt.toDate() : new Date(selectedPerson.createdAt);
                      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    })()}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</p>
                </div>
              </div>

              {/* Bio */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-gray-800 dark:text-white mb-1 text-sm">About</h3>
                <p className="text-gray-700 dark:text-gray-200 text-sm">{selectedPerson.bio || 'No bio provided'}</p>
              </div>

              {/* Interests */}
              {selectedPerson.interests && selectedPerson.interests.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-2 text-sm">Interests</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedPerson.interests.map((interest) => (
                      <span
                        key={interest}
                        className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {connections.get(selectedPerson.id) === 'connected' ? (
                  <>
                    <button
                      onClick={() => {
                        navigate(`/messages?user=${selectedPerson.id}`);
                        setSelectedPerson(null);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-4 h-4" /> Message
                    </button>
                    <button
                      onClick={() => handleConnect(selectedPerson.id)}
                      disabled={connectingId === selectedPerson.id}
                      className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 border border-red-300 py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <UserMinus className="w-4 h-4" /> Disconnect
                    </button>
                  </>
                ) : connections.get(selectedPerson.id) === 'pending' ? (
                  <button
                    onClick={() => handleConnect(selectedPerson.id)}
                    disabled={connectingId === selectedPerson.id}
                    className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <Clock className="w-4 h-4" /> Withdraw Request
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(selectedPerson.id)}
                    disabled={connectingId === selectedPerson.id}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <UserPlus className="w-4 h-4" /> Connect
                  </button>
                )}
              </div>

              {/* Block User button in modal */}
              <button
                onClick={() => openBlockConfirm(selectedPerson.id, selectedPerson.name)}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Ban className="w-4 h-4" /> Block User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mutual Connections List Modal */}
      {mutualListFor && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60]"
          onClick={() => setMutualListFor(null)}
          onTouchStart={() => setMutualListFor(null)}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-white font-bold text-sm">Mutual Connections</h3>
                <p className="text-blue-100 text-[11px]">
                  with {people.find((p) => p.id === mutualListFor)?.name || 'this person'}
                </p>
              </div>
              <button
                onClick={() => setMutualListFor(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            {/* List */}
            <div className="overflow-y-auto flex-1 p-3 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {getMutualConnections(mutualListFor).length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-6 text-sm">No mutual connections found</p>
              ) : (
                getMutualConnections(mutualListFor).map((mutual) => (
                  <div
                    key={mutual.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => { setMutualListFor(null); setSelectedPerson(mutual); }}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                      {renderAvatar(mutual.avatar, mutual.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-[var(--aurora-text)] text-sm truncate">{mutual.name}</h4>
                      {mutual.profession && (
                        <p className="text-xs text-[var(--aurora-text-secondary)] truncate">{mutual.profession}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {mutual.city && (
                          <span className="text-[10px] text-[var(--aurora-text-muted)] flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" /> {mutual.city}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMutualListFor(null); navigate(`/messages?user=${mutual.id}`); }}
                      className="shrink-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-2 rounded-full hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Block User Confirmation Modal */}
      {showBlockConfirm && blockTargetUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => { setShowBlockConfirm(false); setBlockTargetUser(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Ban size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Block {blockTargetUser.name}?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                They won't be able to see your profile and you won't see them in discover, events, or other listings. You can unblock them from your Profile page.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowBlockConfirm(false); setBlockTargetUser(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBlockUser}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  Block
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => { setShowDisconnectConfirm(false); setDisconnectPersonId(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserMinus size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Disconnect?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                Are you sure you want to disconnect from <strong>{people.find(p => p.id === disconnectPersonId)?.name || 'this person'}</strong>? You'll need to send a new connection request to reconnect.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDisconnectConfirm(false); setDisconnectPersonId(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDisconnect}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification (#1.7: safe-area-aware positioning, cross-browser) */}
      {toastMessage && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg z-[70] text-sm font-medium animate-fade-in max-w-[90vw]"
          style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
