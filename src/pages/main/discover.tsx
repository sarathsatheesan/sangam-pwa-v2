import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, limit, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, where, writeBatch, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ClickOutsideOverlay } from '../../components/ClickOutsideOverlay';
import { ETHNICITY_HIERARCHY, ETHNICITY_CHILDREN, HERITAGE_OPTIONS, PRIORITY_ETHNICITIES } from '../../constants/config';
import {
  Search, MapPin, Users, UserPlus, UserCheck, UserMinus,
  X, ChevronDown, MessageCircle, Sparkles,
  Globe, Loader2,
  Clock, Check, Bookmark, Ban, MoreVertical,
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
}

// Constants
const HERITAGE_COLORS: Record<string, string> = {
  'Indian': 'from-orange-400/20 to-green-400/20',
  'Pakistani': 'from-green-500/20 to-white/10',
  'Bangladeshi': 'from-green-400/20 to-red-400/20',
  'Sri Lankan': 'from-yellow-400/20 to-red-500/20',
  'Nepali': 'from-blue-400/20 to-red-400/20',
  'Bhutanese': 'from-orange-400/20 to-yellow-400/20',
  'Maldivian': 'from-red-400/20 to-green-400/20',
  'Afghan': 'from-green-400/20 to-red-400/20',
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

const fuzzyMatch = (text: string, query: string): boolean => {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let idx = 0;
  for (const char of q) {
    idx = t.indexOf(char, idx);
    if (idx === -1) return false;
    idx++;
  }
  return true;
};

const renderAvatar = (avatar: string | undefined, name: string): string => {
  if (avatar && avatar.length === 1 && /\p{Emoji}/u.test(avatar)) {
    return avatar;
  }
  return name.charAt(0).toUpperCase() || '👤';
};

const MatchBadge: React.FC<{ score: number }> = ({ score }) => {
  if (score < 40) return null;
  const color = score >= 75 ? 'from-green-400 to-emerald-500' : 'from-blue-400 to-cyan-500';
  return (
    <div className={`absolute top-3 right-3 bg-gradient-to-r ${color} text-white text-xs font-bold px-2 py-1 rounded-full`}>
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

const SkeletonCard: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 animate-pulse">
    <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-3" />
    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded mb-3" />
    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded mb-4" />
    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded" />
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
  const [heritageDropdownOpen, setHeritageDropdownOpen] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [expandedSubregions, setExpandedSubregions] = useState<Set<string>>(new Set());
  const [expandedEthnicities, setExpandedEthnicities] = useState<Set<string>>(new Set());
  const heritageDisplayCount = useMemo(() => {
    const counted = new Set<string>();
    let count = 0;
    for (const item of selectedHeritage) {
      let isChild = false;
      for (const [parent, children] of Object.entries(ETHNICITY_CHILDREN)) {
        if (children.includes(item)) {
          if (!counted.has(parent)) { counted.add(parent); count++; }
          isChild = true;
          break;
        }
      }
      if (!isChild) {
        if (ETHNICITY_CHILDREN[item]) {
          if (!counted.has(item)) { counted.add(item); count++; }
        } else {
          count++;
        }
      }
    }
    return count;
  }, [selectedHeritage]);
  const heritageRef = useRef<HTMLDivElement>(null);

  // Pre-select user's heritage ethnicities on load
  useEffect(() => {
    if (!userProfile?.heritage) return;
    const raw = Array.isArray(userProfile.heritage)
      ? userProfile.heritage
      : [userProfile.heritage];
    const validSet = new Set(HERITAGE_OPTIONS);
    const unique = [...new Set(raw.filter((h: string) => validSet.has(h)))];
    if (unique.length > 0) setSelectedHeritage(unique);
  }, [userProfile?.heritage]);

  const [connections, setConnections] = useState<Map<string, 'pending' | 'connected'>>(new Map());
  const [connectionDetails, setConnectionDetails] = useState<Map<string, ConnectionDetail>>(new Map());
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'match' | 'name' | 'recent'>('match');
  const [hoveringDisconnect, setHoveringDisconnect] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'discover' | 'network'>('discover');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnectPersonId, setDisconnectPersonId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTile, setActiveTile] = useState<'connections' | 'pending' | 'members' | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockTargetUser, setBlockTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Load blocked users from Firestore
  useEffect(() => {
    if (!user) return;
    const loadBlocked = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setBlockedUsers(userDoc.data().blockedUsers || []);
        }
      } catch (err) {
        console.error('Failed to load blocked users:', err);
      }
    };
    loadBlocked();
  }, [user]);

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
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        setFetchError(null);
        const q = query(collection(db, 'users'), limit(100));
        const snapshot = await getDocs(q);

        const settingsPromises: Promise<{ uid: string; settings: any } | null>[] = [];
        const usersData: { docId: string; data: any }[] = [];

        snapshot.forEach((d) => {
          if (d.id !== user?.uid) {
            usersData.push({ docId: d.id, data: d.data() });
            settingsPromises.push(
              getDoc(doc(db, 'userSettings', d.id))
                .then((snap) => ({ uid: d.id, settings: snap.exists() ? snap.data() : null }))
                .catch(() => ({ uid: d.id, settings: null }))
            );
          }
        });

        const allSettings = await Promise.all(settingsPromises);
        const settingsMap = new Map(allSettings.filter(Boolean).map((s) => [s!.uid, s!.settings]));

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

        setPeople(peopleData);
      } catch (error) {
        console.error('Error fetching people:', error);
        setFetchError('Failed to load people. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPeople();
  }, [user?.uid]);

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

  // Load connections
  useEffect(() => {
    if (!user?.uid) return;
    const loadConnections = async () => {
      try {
        const q1 = query(collection(db, 'connections'), where('users', 'array-contains', user.uid));
        const connSnap = await getDocs(q1);
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
            });
          }
        });

        // Legacy migration
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

        setConnections(connMap);
        setConnectionDetails(detailsMap);
      } catch (err) {
        console.error('Error loading connections:', err);
      }
    };
    loadConnections();
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
      setToastMessage('Connection accepted!');
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

  // Get mutual connection count
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

  const getMutualConnectionCount = (personId: string): number => {
    let count = 0;
    const targetPerson = people.find((p) => p.id === personId);
    if (!targetPerson) return 0;

    connections.forEach((status, uid) => {
      if (status === 'connected' && uid !== personId) {
        const connectedPerson = people.find((p) => p.id === uid);
        if (connectedPerson) {
          const tHeritage = Array.isArray(targetPerson.heritage)
            ? targetPerson.heritage
            : [targetPerson.heritage];
          const cHeritage = Array.isArray(connectedPerson.heritage)
            ? connectedPerson.heritage
            : [connectedPerson.heritage];
          const sharedHeritage = tHeritage.some((h) => cHeritage.includes(h));
          const sharedCity = targetPerson.city === connectedPerson.city;
          if (sharedHeritage || sharedCity) count++;
        }
      }
    });
    return count;
  };

  // Filtered people
  const filteredPeople = useMemo(() => {
    let filtered = people;

    // Filter out blocked users
    if (blockedUsers.length > 0) {
      filtered = filtered.filter((p) => !blockedUsers.includes(p.id));
    }

    // Tab filtering
    if (activeTab === 'discover') {
      filtered = filtered.filter((p) => {
        const status = connections.get(p.id);
        if (!status) return true; // not connected
        if (status === 'pending' && connectionDetails.get(p.id)?.initiatedBy !== user?.uid)
          return false; // incoming request shows in network
        return status === 'pending' && connectionDetails.get(p.id)?.initiatedBy === user?.uid; // sent pending still shows
      });
    } else {
      // My Network: only connected people
      filtered = filtered.filter((p) => connections.get(p.id) === 'connected');
    }

    if (selectedHeritage.length > 0) {
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
    }

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
      const mutualA = getMutualConnectionCount(a.id);
      const mutualB = getMutualConnectionCount(b.id);
      return (
        computeMatchScore(b, userProfile, mutualB) - computeMatchScore(a, userProfile, mutualA)
      );
    });
  }, [people, selectedHeritage, searchQuery, userProfile, sortBy, connections, connectionDetails, activeTab, user?.uid, blockedUsers]);

  // PYMK Groups
  const pymkGroups = useMemo(() => {
    if (activeTab !== 'discover' || !userProfile)
      return { sameCity: [], sameHeritage: [], similarInterests: [] };

    // Include unconnected users AND pending requests sent by current user
    // (mirrors the Discover tab filter so sections don't disappear after sending requests)
    const discoverable = people.filter((p) => {
      const status = connections.get(p.id);
      if (!status) return true; // not connected at all
      if (status === 'pending') {
        return connectionDetails.get(p.id)?.initiatedBy === user?.uid; // sent by me
      }
      return false; // exclude fully connected
    });

    const userCity = userProfile.city || '';
    const userHeritage = (Array.isArray(userProfile.heritage)
      ? userProfile.heritage
      : [userProfile.heritage].filter(Boolean)
    ).map((h: string) => h.toLowerCase());
    const userInterests: string[] = userProfile.interests || [];

    const sameCity = discoverable
      .filter(
        (p) =>
          p.city && userCity && p.city.toLowerCase() === userCity.toLowerCase()
      )
      .slice(0, 10);
    const sameHeritage = discoverable
      .filter((p) => {
        const pH = (Array.isArray(p.heritage) ? p.heritage : [p.heritage]).filter(Boolean);
        return pH.some((h: string) => userHeritage.includes(h.toLowerCase()));
      })
      .slice(0, 10);
    const similarInterests = discoverable
      .filter((p) => {
        const shared = (p.interests || []).filter((i: string) => userInterests.includes(i));
        return shared.length >= 2;
      })
      .slice(0, 10);

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
      <div className="min-h-screen bg-aurora-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aurora-bg pb-20">
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
          {/* Search + Ethnicity + Tabs row */}
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

            {/* Ethnicity Dropdown - Multi-select with checkboxes */}
            <div className="relative shrink-0" ref={heritageRef}>
              <button
                onClick={() => setHeritageDropdownOpen(!heritageDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full text-sm font-medium transition-all border ${
                  heritageDisplayCount > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-gray-50 border-gray-200 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{heritageDisplayCount > 0 ? `ethniCity (${heritageDisplayCount})` : 'ethniCity'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${heritageDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <ClickOutsideOverlay isOpen={heritageDropdownOpen} onClose={() => setHeritageDropdownOpen(false)} />

              {heritageDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-72 bg-aurora-surface border border-aurora-border rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
                  {(() => {
                    const userHeritage = Array.isArray(userProfile?.heritage)
                      ? userProfile.heritage
                      : userProfile?.heritage ? [userProfile.heritage] : [];
                    return (
                      <>
                        {/* Priority Quick Select Section */}
                        <div className="px-4 py-1.5 bg-gradient-to-r from-amber-50/80 to-orange-50/30 border-b border-amber-200/60">
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">★ Quick Select</span>
                        </div>
                        {PRIORITY_ETHNICITIES.map((priorityItem) => {
                          // Case 1: Region-level priority
                          const pRegion = ETHNICITY_HIERARCHY.find(r => r.region === priorityItem);
                          if (pRegion) {
                            const isPRegExp = expandedRegions.has(pRegion.region);
                            const selPReg = pRegion.subregions.reduce((sum, sub) => sum + sub.ethnicities.filter((e) => { const ch = ETHNICITY_CHILDREN[e]; return ch ? ch.some((c) => selectedHeritage.includes(c)) : selectedHeritage.includes(e); }).length, 0);
                            const totPReg = pRegion.subregions.reduce((sum, sub) => sum + sub.ethnicities.length, 0);
                            return (
                              <div key={`pq-${priorityItem}`} className="border-b border-aurora-border/50">
                                <div className="w-full px-4 py-2 flex items-center gap-2 hover:bg-aurora-surface-variant transition-colors">
                                  <input type="checkbox" ref={(el) => { if (el) el.indeterminate = selPReg > 0 && selPReg < totPReg; }} checked={selPReg === totPReg && totPReg > 0} onChange={() => { const allItems = pRegion.subregions.flatMap((s) => s.ethnicities.flatMap((e) => ETHNICITY_CHILDREN[e] || [e])); if (selPReg === totPReg) { setSelectedHeritage((prev) => prev.filter((x) => !allItems.includes(x))); } else { setSelectedHeritage((prev) => [...prev, ...allItems.filter((e) => !prev.includes(e))]); } }} className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40 shrink-0" />
                                  <button onClick={() => setExpandedRegions((prev) => { const next = new Set(prev); if (next.has(pRegion.region)) next.delete(pRegion.region); else next.add(pRegion.region); return next; })} className="flex-1 flex items-center justify-between">
                                    <span className="text-xs font-bold text-aurora-text">{pRegion.region}</span>
                                    <div className="flex items-center gap-1.5">
                                      {selPReg > 0 && <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selPReg}</span>}
                                      <ChevronDown className={`w-3.5 h-3.5 text-aurora-text-muted transition-transform ${isPRegExp ? 'rotate-180' : ''}`} />
                                    </div>
                                  </button>
                                </div>
                                {isPRegExp && (
                                  <div className="bg-aurora-surface-variant/20">
                                    {pRegion.subregions.map((sub) => {
                                      const isSubExp = expandedSubregions.has(sub.name);
                                      const allSubItems = sub.ethnicities.flatMap((e) => ETHNICITY_CHILDREN[e] || [e]);
                                      const selSub = sub.ethnicities.filter((e) => { const ch = ETHNICITY_CHILDREN[e]; return ch ? ch.some((c) => selectedHeritage.includes(c)) : selectedHeritage.includes(e); }).length;
                                      const totSub = sub.ethnicities.length;
                                      return (
                                        <div key={sub.name}>
                                          <div className="w-full pl-8 pr-4 py-1.5 flex items-center gap-2 hover:bg-aurora-surface-variant transition-colors">
                                            <input type="checkbox" ref={(el) => { if (el) el.indeterminate = selSub > 0 && selSub < totSub; }} checked={selSub === totSub && totSub > 0} onChange={() => { if (selSub === totSub) { setSelectedHeritage((prev) => prev.filter((x) => !allSubItems.includes(x))); } else { setSelectedHeritage((prev) => [...prev, ...allSubItems.filter((e) => !prev.includes(e))]); } }} className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40 shrink-0" />
                                            <button onClick={() => setExpandedSubregions((prev) => { const next = new Set(prev); if (next.has(sub.name)) next.delete(sub.name); else next.add(sub.name); return next; })} className="flex-1 flex items-center justify-between">
                                              <span className="text-xs font-semibold text-aurora-text-secondary">{sub.name}</span>
                                              <div className="flex items-center gap-1.5">
                                                {selSub > 0 && <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selSub}</span>}
                                                <ChevronDown className={`w-3 h-3 text-aurora-text-muted transition-transform ${isSubExp ? 'rotate-180' : ''}`} />
                                              </div>
                                            </button>
                                          </div>
                                          {isSubExp && (
                                            <div className="bg-aurora-surface-variant/30">
                                              {sub.ethnicities.map((eth) => {
                                                const isPref = userHeritage.some((h: string) => eth.toLowerCase().includes(h.toLowerCase()));
                                                const ch = ETHNICITY_CHILDREN[eth];
                                                if (ch) {
                                                  const selCh = ch.filter((c) => selectedHeritage.includes(c));
                                                  const isEthExp = expandedEthnicities.has(eth);
                                                  return (
                                                    <div key={eth}>
                                                      <div className={`flex items-center gap-2 pl-12 pr-4 py-1.5 hover:bg-aurora-surface-variant transition-colors text-sm ${isPref ? 'bg-amber-50/50' : ''}`}>
                                                        <input type="checkbox" ref={(el) => { if (el) el.indeterminate = selCh.length > 0 && selCh.length < ch.length; }} checked={selCh.length === ch.length} onChange={() => { if (selCh.length === ch.length) { setSelectedHeritage((prev) => prev.filter((x) => !ch.includes(x))); } else { setSelectedHeritage((prev) => [...prev, ...ch.filter((c) => !prev.includes(c))]); } }} className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40 shrink-0" />
                                                        <button onClick={() => setExpandedEthnicities((prev) => { const next = new Set(prev); if (next.has(eth)) next.delete(eth); else next.add(eth); return next; })} className="flex-1 flex items-center justify-between">
                                                          <span className="text-aurora-text">{eth}</span>
                                                          <div className="flex items-center gap-1.5">
                                                            {isPref && <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">Preferred</span>}
                                                            {selCh.length > 0 && <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selCh.length}</span>}
                                                            <ChevronDown className={`w-3 h-3 text-aurora-text-muted transition-transform ${isEthExp ? 'rotate-180' : ''}`} />
                                                          </div>
                                                        </button>
                                                      </div>
                                                      {isEthExp && (
                                                        <div className="bg-aurora-surface-variant/40">
                                                          {ch.map((child) => (
                                                            <label key={child} className="flex items-center gap-3 pl-16 pr-4 py-1.5 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-sm">
                                                              <input type="checkbox" checked={selectedHeritage.includes(child)} onChange={() => setSelectedHeritage((prev) => prev.includes(child) ? prev.filter((x) => x !== child) : [...prev, child])} className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40" />
                                                              <span className="text-aurora-text flex-1">{child}</span>
                                                            </label>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                }
                                                return (
                                                  <label key={eth} className={`flex items-center gap-3 pl-12 pr-4 py-1.5 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-sm ${isPref ? 'bg-amber-50/50' : ''}`}>
                                                    <input type="checkbox" checked={selectedHeritage.includes(eth)} onChange={() => setSelectedHeritage((prev) => prev.includes(eth) ? prev.filter((x) => x !== eth) : [...prev, eth])} className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40" />
                                                    <span className="text-aurora-text flex-1">{eth}</span>
                                                    {isPref && <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">Preferred</span>}
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          // Case 2: Ethnicity with children (e.g., Indian)
                          const pChildren = ETHNICITY_CHILDREN[priorityItem];
                          if (pChildren) {
                            const selCh = pChildren.filter((c) => selectedHeritage.includes(c));
                            const isEthExp = expandedEthnicities.has(priorityItem);
                            const isPref = userHeritage.some((h: string) => priorityItem.toLowerCase().includes(h.toLowerCase()));
                            return (
                              <div key={`pq-${priorityItem}`} className="border-b border-aurora-border/50">
                                <div className={`flex items-center gap-2 px-4 py-2 hover:bg-aurora-surface-variant transition-colors text-sm ${isPref ? 'bg-amber-50/50' : ''}`}>
                                  <input type="checkbox" ref={(el) => { if (el) el.indeterminate = selCh.length > 0 && selCh.length < pChildren.length; }} checked={selCh.length === pChildren.length} onChange={() => { if (selCh.length === pChildren.length) { setSelectedHeritage((prev) => prev.filter((x) => !pChildren.includes(x))); } else { setSelectedHeritage((prev) => [...prev, ...pChildren.filter((c) => !prev.includes(c))]); } }} className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40 shrink-0" />
                                  <button onClick={() => setExpandedEthnicities((prev) => { const next = new Set(prev); if (next.has(priorityItem)) next.delete(priorityItem); else next.add(priorityItem); return next; })} className="flex-1 flex items-center justify-between">
                                    <span className="text-xs font-bold text-aurora-text">{priorityItem}</span>
                                    <div className="flex items-center gap-1.5">
                                      {isPref && <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">Preferred</span>}
                                      {selCh.length > 0 && <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selCh.length}</span>}
                                      <ChevronDown className={`w-3 h-3 text-aurora-text-muted transition-transform ${isEthExp ? 'rotate-180' : ''}`} />
                                    </div>
                                  </button>
                                </div>
                                {isEthExp && (
                                  <div className="bg-aurora-surface-variant/40">
                                    {pChildren.map((child) => (
                                      <label key={child} className="flex items-center gap-3 pl-8 pr-4 py-1.5 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-sm">
                                        <input type="checkbox" checked={selectedHeritage.includes(child)} onChange={() => setSelectedHeritage((prev) => prev.includes(child) ? prev.filter((x) => x !== child) : [...prev, child])} className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40" />
                                        <span className="text-aurora-text flex-1">{child}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          // Case 3: Simple ethnicity (e.g., Chinese, French)
                          const isPref = userHeritage.some((h: string) => priorityItem.toLowerCase().includes(h.toLowerCase()));
                          return (
                            <label key={`pq-${priorityItem}`} className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-sm border-b border-aurora-border/50 ${isPref ? 'bg-amber-50/50' : ''}`}>
                              <input type="checkbox" checked={selectedHeritage.includes(priorityItem)} onChange={() => setSelectedHeritage((prev) => prev.includes(priorityItem) ? prev.filter((x) => x !== priorityItem) : [...prev, priorityItem])} className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40" />
                              <span className="text-aurora-text flex-1">{priorityItem}</span>
                              {isPref && <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">Preferred</span>}
                            </label>
                          );
                        })}
                        {/* Visual Divider */}
                        <div className="flex items-center gap-2 px-4 py-1.5 border-y-2 border-dashed border-aurora-border/60 bg-gray-50/50 dark:bg-gray-800/50">
                          <span className="text-[10px] font-bold text-aurora-text-muted uppercase tracking-wider">All Ethnicities</span>
                        </div>
                        {/* Full Hierarchy */}
                        {ETHNICITY_HIERARCHY.map((group) => {
                      const isRegionExpanded = expandedRegions.has(group.region);
                      const selectedInRegion = group.subregions.reduce((sum, sub) => sum + sub.ethnicities.filter((e) => { const ch = ETHNICITY_CHILDREN[e]; return ch ? ch.some((c) => selectedHeritage.includes(c)) : selectedHeritage.includes(e); }).length, 0);
                      const totalInRegion = group.subregions.reduce((sum, sub) => sum + sub.ethnicities.length, 0);
                      return (
                        <div key={group.region} className="border-b border-aurora-border last:border-b-0">
                          {/* Level 1: Region */}
                          <div className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-aurora-surface-variant transition-colors">
                            <input
                              type="checkbox"
                              ref={(el) => { if (el) el.indeterminate = selectedInRegion > 0 && selectedInRegion < totalInRegion; }}
                              checked={selectedInRegion === totalInRegion && totalInRegion > 0}
                              onChange={() => {
                                const allItems = group.subregions.flatMap((s) => s.ethnicities.flatMap((e) => ETHNICITY_CHILDREN[e] || [e]));
                                if (selectedInRegion === totalInRegion) {
                                  setSelectedHeritage((prev) => prev.filter((x) => !allItems.includes(x)));
                                } else {
                                  setSelectedHeritage((prev) => [...prev, ...allItems.filter((e) => !prev.includes(e))]);
                                }
                              }}
                              className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40 shrink-0"
                            />
                            <button
                              onClick={() => setExpandedRegions((prev) => {
                                const next = new Set(prev);
                                if (next.has(group.region)) next.delete(group.region);
                                else next.add(group.region);
                                return next;
                              })}
                              className="flex-1 flex items-center justify-between"
                            >
                              <span className="text-xs font-bold text-aurora-text">{group.region}</span>
                              <div className="flex items-center gap-1.5">
                                {selectedInRegion > 0 && (
                                  <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selectedInRegion}</span>
                                )}
                                <ChevronDown className={`w-3.5 h-3.5 text-aurora-text-muted transition-transform ${isRegionExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </button>
                          </div>
                          {isRegionExpanded && (
                            <div className="bg-aurora-surface-variant/20">
                              {group.subregions.map((sub) => {
                                const isSubExpanded = expandedSubregions.has(sub.name);
                                const allSubItems = sub.ethnicities.flatMap((e) => ETHNICITY_CHILDREN[e] || [e]);
                                const selectedInSub = sub.ethnicities.filter((e) => { const ch = ETHNICITY_CHILDREN[e]; return ch ? ch.some((c) => selectedHeritage.includes(c)) : selectedHeritage.includes(e); }).length;
                                const totalInSub = sub.ethnicities.length;
                                return (
                                  <div key={sub.name}>
                                    {/* Level 2: Sub-region */}
                                    <div className="w-full pl-8 pr-4 py-2 flex items-center gap-2 hover:bg-aurora-surface-variant transition-colors">
                                      <input
                                        type="checkbox"
                                        ref={(el) => { if (el) el.indeterminate = selectedInSub > 0 && selectedInSub < totalInSub; }}
                                        checked={selectedInSub === totalInSub && totalInSub > 0}
                                        onChange={() => {
                                          if (selectedInSub === totalInSub) {
                                            setSelectedHeritage((prev) => prev.filter((x) => !allSubItems.includes(x)));
                                          } else {
                                            setSelectedHeritage((prev) => [...prev, ...allSubItems.filter((e) => !prev.includes(e))]);
                                          }
                                        }}
                                        className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40 shrink-0"
                                      />
                                      <button
                                        onClick={() => setExpandedSubregions((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(sub.name)) next.delete(sub.name);
                                          else next.add(sub.name);
                                          return next;
                                        })}
                                        className="flex-1 flex items-center justify-between"
                                      >
                                        <span className="text-xs font-semibold text-aurora-text-secondary">{sub.name}</span>
                                        <div className="flex items-center gap-1.5">
                                          {selectedInSub > 0 && (
                                            <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selectedInSub}</span>
                                          )}
                                          <ChevronDown className={`w-3 h-3 text-aurora-text-muted transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                      </button>
                                    </div>
                                    {isSubExpanded && (
                                      <div className="bg-aurora-surface-variant/30">
                                        {sub.ethnicities.map((eth) => {
                                          const isPreferred = userHeritage.some((h: string) => eth.toLowerCase().includes(h.toLowerCase()));
                                          const children = ETHNICITY_CHILDREN[eth];
                                          if (children) {
                                            const selectedChildren = children.filter((c) => selectedHeritage.includes(c));
                                            const isEthExpanded = expandedEthnicities.has(eth);
                                            return (
                                              <div key={eth}>
                                                <div className={`flex items-center gap-2 pl-12 pr-4 py-1.5 hover:bg-aurora-surface-variant transition-colors text-sm ${isPreferred ? 'bg-amber-50/50' : ''}`}>
                                                  <input
                                                    type="checkbox"
                                                    ref={(el) => { if (el) el.indeterminate = selectedChildren.length > 0 && selectedChildren.length < children.length; }}
                                                    checked={selectedChildren.length === children.length}
                                                    onChange={() => {
                                                      if (selectedChildren.length === children.length) {
                                                        setSelectedHeritage((prev) => prev.filter((x) => !children.includes(x)));
                                                      } else {
                                                        setSelectedHeritage((prev) => [...prev, ...children.filter((c) => !prev.includes(c))]);
                                                      }
                                                    }}
                                                    className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40 shrink-0"
                                                  />
                                                  <button
                                                    onClick={() => setExpandedEthnicities((prev) => {
                                                      const next = new Set(prev);
                                                      if (next.has(eth)) next.delete(eth);
                                                      else next.add(eth);
                                                      return next;
                                                    })}
                                                    className="flex-1 flex items-center justify-between"
                                                  >
                                                    <span className="text-aurora-text">{eth}</span>
                                                    <div className="flex items-center gap-1.5">
                                                      {isPreferred && (
                                                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">Preferred</span>
                                                      )}
                                                      {selectedChildren.length > 0 && (
                                                        <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selectedChildren.length}</span>
                                                      )}
                                                      <ChevronDown className={`w-3 h-3 text-aurora-text-muted transition-transform ${isEthExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                  </button>
                                                </div>
                                                {isEthExpanded && (
                                                  <div className="bg-aurora-surface-variant/40">
                                                    {children.map((child) => (
                                                      <label
                                                        key={child}
                                                        className="flex items-center gap-3 pl-16 pr-4 py-1.5 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-sm"
                                                      >
                                                        <input
                                                          type="checkbox"
                                                          checked={selectedHeritage.includes(child)}
                                                          onChange={() => {
                                                            setSelectedHeritage((prev) =>
                                                              prev.includes(child) ? prev.filter((x) => x !== child) : [...prev, child]
                                                            );
                                                          }}
                                                          className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40"
                                                        />
                                                        <span className="text-aurora-text flex-1">{child}</span>
                                                      </label>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }
                                          return (
                                            <label
                                              key={eth}
                                              className={`flex items-center gap-3 pl-12 pr-4 py-1.5 cursor-pointer hover:bg-aurora-surface-variant transition-colors text-sm ${
                                                isPreferred ? 'bg-amber-50/50' : ''
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={selectedHeritage.includes(eth)}
                                                onChange={() => {
                                                  setSelectedHeritage((prev) =>
                                                    prev.includes(eth) ? prev.filter((x) => x !== eth) : [...prev, eth]
                                                  );
                                                }}
                                                className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40"
                                              />
                                              <span className="text-aurora-text flex-1">{eth}</span>
                                              {isPreferred && (
                                                <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">Preferred</span>
                                              )}
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                      </>
                    );
                  })()}
                  {heritageDisplayCount > 0 && (
                    <div className="border-t border-aurora-border px-4 py-2 bg-aurora-surface sticky bottom-0">
                      <button
                        onClick={() => setSelectedHeritage([])}
                        className="text-xs text-aurora-indigo font-medium hover:text-aurora-indigo/80"
                      >
                        Clear all ({heritageDisplayCount})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {activeTab === 'discover' ? 'Discover' : 'Network'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            {loading
              ? 'Loading...'
              : activeTab === 'discover'
                ? `${filteredPeople.length} people match your filters`
                : selectedHeritage.length > 0
                  ? `${filteredPeople.length} of ${connectedCount} connections`
                  : `${connectedCount} connections`}
          </p>
        </div>

        {/* Incoming Requests Section */}
        {activeTab === 'network' && incomingRequests.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              Pending Requests ({incomingRequests.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {incomingRequests.map((person) => (
                <div key={person.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                  <div className="h-32 bg-gradient-to-r from-yellow-400 to-orange-400 relative">
                    <button
                      onClick={() => setSelectedPerson(person)}
                      className="absolute inset-0 w-full h-full hover:bg-black/10 transition-colors"
                    />
                  </div>
                  <div className="p-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold -mt-8 relative z-10">
                        {renderAvatar(person.avatar, person.name)}
                      </div>
                      {isRecentlyActive(person) && (
                        <div className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white top-0 right-0" />
                      )}
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white mt-2">{person.name}</h3>
                    {person.profession && <p className="text-sm text-gray-600 dark:text-gray-300">{person.profession}</p>}
                    {renderHeritage(person, 'sm')}
                    {person.showLocation && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {person.city}
                      </p>
                    )}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleAcceptConnection(person.id)}
                        disabled={connectingId === person.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Check className="w-4 h-4" /> Accept
                      </button>
                      <button
                        onClick={() => handleDeclineConnection(person.id)}
                        disabled={connectingId === person.id}
                        className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white dark:text-white py-2 rounded font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <X className="w-4 h-4" /> Decline
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
                <div key={person.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                  <div className="h-32 bg-gradient-to-r from-purple-400 to-blue-400 relative">
                    <button
                      onClick={() => setSelectedPerson(person)}
                      className="absolute inset-0 w-full h-full hover:bg-black/10 transition-colors"
                    />
                  </div>
                  <div className="p-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold -mt-8 relative z-10">
                        {renderAvatar(person.avatar, person.name)}
                      </div>
                      {isRecentlyActive(person) && (
                        <div className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white top-0 right-0" />
                      )}
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white mt-2">{person.name}</h3>
                    {person.profession && <p className="text-sm text-gray-600 dark:text-gray-300">{person.profession}</p>}
                    {renderHeritage(person, 'sm')}
                    {person.showLocation && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {person.city}
                      </p>
                    )}
                    <div className="mt-4">
                      <button
                        onClick={() => handleConnect(person.id)}
                        disabled={connectingId === person.id}
                        className="w-full bg-gray-400 hover:bg-gray-500 text-white py-2 rounded font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Clock className="w-4 h-4" /> Pending
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
            {pymkGroups.sameCity.length >= 1 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">From Your City</h3>
                </div>
                <div className="overflow-x-auto pb-4 scrollbar-hide">
                  <div className="flex gap-4 w-max">
                    {pymkGroups.sameCity.map((person) => (
                      <div
                        key={person.id}
                        className="w-60 sm:w-72 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex-shrink-0 flex flex-col"
                      >
                        <div
                          className={`h-32 bg-gradient-to-r ${
                            HERITAGE_COLORS[
                              Array.isArray(person.heritage)
                                ? person.heritage[0]
                                : person.heritage
                            ] || 'from-gray-300 to-gray-400'
                          } relative`}
                        >
                          <button
                            onClick={() => setSelectedPerson(person)}
                            className="absolute inset-0 w-full h-full hover:bg-black/10 transition-colors"
                          />
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold -mt-8 relative z-10">
                              {renderAvatar(person.avatar, person.name)}
                            </div>
                            {isRecentlyActive(person) && (
                              <div className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white top-0 right-0" />
                            )}
                          </div>
                          <h4 className="font-bold text-gray-800 dark:text-white mt-2">{person.name}</h4>
                          {person.profession && <p className="text-xs text-gray-600 dark:text-gray-300">{person.profession}</p>}
                          {renderHeritage(person)}
                          {person.showLocation && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" /> {person.city}
                            </p>
                          )}
                          {isNewMember(person) && (
                            <div className="mt-2 inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-bold px-2 py-1 rounded">
                              New
                            </div>
                          )}
                          <div className="mt-auto pt-3">
                            {connections.get(person.id) === 'pending' ? (
                              <button
                                disabled
                                className="w-full bg-amber-100 text-amber-700 border border-amber-300 py-2 rounded font-medium text-sm flex items-center justify-center gap-1.5"
                              >
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect(person.id)}
                                disabled={connectingId === person.id}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium text-sm disabled:opacity-50"
                              >
                                Connect
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
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-orange-600" />
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Same Heritage</h3>
                </div>
                <div className="overflow-x-auto pb-4 scrollbar-hide">
                  <div className="flex gap-4 w-max">
                    {pymkGroups.sameHeritage.map((person) => (
                      <div
                        key={person.id}
                        className="w-60 sm:w-72 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex-shrink-0 flex flex-col"
                      >
                        <div
                          className={`h-32 bg-gradient-to-r ${
                            HERITAGE_COLORS[
                              Array.isArray(person.heritage)
                                ? person.heritage[0]
                                : person.heritage
                            ] || 'from-gray-300 to-gray-400'
                          } relative`}
                        >
                          <button
                            onClick={() => setSelectedPerson(person)}
                            className="absolute inset-0 w-full h-full hover:bg-black/10 transition-colors"
                          />
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold -mt-8 relative z-10">
                              {renderAvatar(person.avatar, person.name)}
                            </div>
                            {isRecentlyActive(person) && (
                              <div className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white top-0 right-0" />
                            )}
                          </div>
                          <h4 className="font-bold text-gray-800 dark:text-white mt-2">{person.name}</h4>
                          {person.profession && <p className="text-xs text-gray-600 dark:text-gray-300">{person.profession}</p>}
                          {renderHeritage(person)}
                          {person.showLocation && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" /> {person.city}
                            </p>
                          )}
                          {isNewMember(person) && (
                            <div className="mt-2 inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-bold px-2 py-1 rounded">
                              New
                            </div>
                          )}
                          <div className="mt-auto pt-3">
                            {connections.get(person.id) === 'pending' ? (
                              <button
                                disabled
                                className="w-full bg-amber-100 text-amber-700 border border-amber-300 py-2 rounded font-medium text-sm flex items-center justify-center gap-1.5"
                              >
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect(person.id)}
                                disabled={connectingId === person.id}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium text-sm disabled:opacity-50"
                              >
                                Connect
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
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Similar Interests</h3>
                </div>
                <div className="overflow-x-auto pb-4 scrollbar-hide">
                  <div className="flex gap-4 w-max">
                    {pymkGroups.similarInterests.map((person) => (
                      <div
                        key={person.id}
                        className="w-60 sm:w-72 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex-shrink-0 flex flex-col"
                      >
                        <div
                          className={`h-32 bg-gradient-to-r ${
                            HERITAGE_COLORS[
                              Array.isArray(person.heritage)
                                ? person.heritage[0]
                                : person.heritage
                            ] || 'from-gray-300 to-gray-400'
                          } relative`}
                        >
                          <button
                            onClick={() => setSelectedPerson(person)}
                            className="absolute inset-0 w-full h-full hover:bg-black/10 transition-colors"
                          />
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold -mt-8 relative z-10">
                              {renderAvatar(person.avatar, person.name)}
                            </div>
                            {isRecentlyActive(person) && (
                              <div className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white top-0 right-0" />
                            )}
                          </div>
                          <h4 className="font-bold text-gray-800 dark:text-white mt-2">{person.name}</h4>
                          {person.profession && <p className="text-xs text-gray-600 dark:text-gray-300">{person.profession}</p>}
                          {renderHeritage(person)}
                          {person.showLocation && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" /> {person.city}
                            </p>
                          )}
                          {isNewMember(person) && (
                            <div className="mt-2 inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-bold px-2 py-1 rounded">
                              New
                            </div>
                          )}
                          <div className="mt-auto pt-3">
                            {connections.get(person.id) === 'pending' ? (
                              <button
                                disabled
                                className="w-full bg-amber-100 text-amber-700 border border-amber-300 py-2 rounded font-medium text-sm flex items-center justify-center gap-1.5"
                              >
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect(person.id)}
                                disabled={connectingId === person.id}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium text-sm disabled:opacity-50"
                              >
                                Connect
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
          </>
        )}

        {/* Main Grid/List View */}
        {!loading && filteredPeople.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-green-600" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">My Connects</h3>
          </div>
        )}
        {loading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
            {[...Array(9)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">
              {activeTab === 'discover' ? 'No people found' : 'No connections yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'discover'
                ? 'Try adjusting your filters or search terms'
                : 'Start connecting with people to build your network'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPeople.map((person) => {
              const score = computeMatchScore(person, userProfile, getMutualConnectionCount(person.id));
              const status = connections.get(person.id);
              const isHovering = hoveringDisconnect === person.id && status === 'connected';

              return (
                <div key={person.id} className="group bg-aurora-surface rounded-2xl border border-aurora-border overflow-hidden cursor-pointer hover:shadow-lg hover:border-aurora-border/80 transition-all duration-200">
                  <div
                    className={`h-24 bg-gradient-to-r ${
                      HERITAGE_COLORS[
                        Array.isArray(person.heritage) ? person.heritage[0] : person.heritage
                      ] || 'from-gray-300 to-gray-400'
                    } relative`}
                    onClick={() => setSelectedPerson(person)}
                  >
                    <MatchBadge score={score} />
                    {isNewMember(person) && (
                      <span className="absolute top-2.5 left-2.5 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="relative flex items-end gap-3 -mt-8">
                      <div className="w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg relative z-10 border-3 border-white shrink-0 shadow-sm">
                        {renderAvatar(person.avatar, person.name)}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <h3 className="font-bold text-[var(--aurora-text)] text-sm truncate leading-tight">{person.name}</h3>
                        {person.profession && <p className="text-xs text-[var(--aurora-text-secondary)] truncate">{person.profession}</p>}
                      </div>
                      {/* Three-dot menu */}
                      <div className="relative pb-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === person.id ? null : person.id); }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                          aria-label="More options"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        {openMenuId === person.id && (
                          <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[140px] z-20">
                            <button
                              onClick={(e) => { e.stopPropagation(); openBlockConfirm(person.id, person.name); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Ban className="w-4 h-4" /> Block User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-0.5">
                      {renderHeritage(person)}
                      {person.showLocation && (
                        <p className="text-xs text-[var(--aurora-text-muted)] flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{person.city}</span>
                        </p>
                      )}
                      {getMutualConnectionCount(person.id) > 0 && (
                        <p className="text-[11px] text-blue-600 font-medium">
                          {getMutualConnectionCount(person.id)} mutual connections
                        </p>
                      )}
                    </div>
                    <div className="mt-2.5 flex gap-1.5">
                      {status === 'connected' ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/messages?user=${person.id}`); }}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Message
                          </button>
                          <button
                            onMouseEnter={() => setHoveringDisconnect(person.id)}
                            onMouseLeave={() => setHoveringDisconnect(null)}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              if (isHovering) {
                                handleConnect(person.id);
                              } else {
                                setHoveringDisconnect(person.id);
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isHovering) handleConnect(person.id);
                            }}
                            disabled={connectingId === person.id}
                            className={`px-2.5 py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 transition-colors flex items-center justify-center gap-1 ${
                              isHovering
                                ? 'bg-red-100 hover:bg-red-200 text-red-600 border border-red-300'
                                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                            }`}
                            title={isHovering ? 'Tap to disconnect' : 'Tap to show disconnect'}
                          >
                            {isHovering ? (
                              <><UserMinus className="w-3.5 h-3.5" /></>
                            ) : (
                              <><UserCheck className="w-3.5 h-3.5" /></>
                            )}
                          </button>
                        </>
                      ) : status === 'pending' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConnect(person.id); }}
                          disabled={connectingId === person.id}
                          className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                          title="Tap to withdraw request"
                        >
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConnect(person.id); }}
                          disabled={connectingId === person.id}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Connect
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPeople.map((person) => {
              const score = computeMatchScore(person, userProfile, getMutualConnectionCount(person.id));
              const status = connections.get(person.id);
              const isHovering = hoveringDisconnect === person.id && status === 'connected';

              return (
                <div key={person.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-shrink-0 self-center sm:self-start">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold text-xl sm:text-2xl">
                      {renderAvatar(person.avatar, person.name)}
                    </div>
                    {isRecentlyActive(person) && (
                      <div className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white bottom-0 right-0" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-gray-800 dark:text-white">{person.name}</h3>
                        {isNewMember(person) && (
                          <span className="inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-bold px-2 py-0.5 rounded">
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {score >= 40 && (
                          <div className="text-right">
                            <div className={`text-lg font-bold ${score >= 75 ? 'text-green-600' : 'text-blue-600'}`}>
                              {score}%
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Match</div>
                          </div>
                        )}
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === person.id ? null : person.id); }}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            aria-label="More options"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                          {openMenuId === person.id && (
                            <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[140px] z-20">
                              <button
                                onClick={(e) => { e.stopPropagation(); openBlockConfirm(person.id, person.name); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Ban className="w-4 h-4" /> Block User
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {person.profession && <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{person.profession}</p>}
                    {renderHeritage(person, 'sm')}
                    {person.showLocation && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-2">
                        <MapPin className="w-3 h-3" /> {person.city}
                      </p>
                    )}

                    {getMutualConnectionCount(person.id) > 0 && (
                      <p className="text-xs text-blue-600 font-medium mb-2">
                        {getMutualConnectionCount(person.id)} mutual connections
                      </p>
                    )}

                    {person.interests && person.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {person.interests.slice(0, 3).map((interest) => (
                          <span key={interest} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 dark:text-gray-200 px-2 py-1 rounded">
                            {interest}
                          </span>
                        ))}
                        {person.interests.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">+{person.interests.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
                    {status === 'connected' ? (
                      <>
                        <button
                          onClick={() => navigate(`/messages?user=${person.id}`)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded font-medium text-sm flex items-center justify-center gap-1 whitespace-nowrap"
                        >
                          <MessageCircle className="w-4 h-4" /> Message
                        </button>
                        <button
                          onMouseEnter={() => setHoveringDisconnect(person.id)}
                          onMouseLeave={() => setHoveringDisconnect(null)}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            if (isHovering) {
                              // Second touch - execute disconnect
                              handleConnect(person.id);
                            } else {
                              // First touch - show button
                              setHoveringDisconnect(person.id);
                            }
                          }}
                          onClick={() => { if (isHovering) handleConnect(person.id); }}
                          disabled={connectingId === person.id}
                          className={`px-3 py-2 rounded font-medium text-sm disabled:opacity-50 transition-colors whitespace-nowrap flex items-center justify-center gap-1 ${
                            isHovering
                              ? 'bg-red-100 hover:bg-red-200 text-red-600 border border-red-300'
                              : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                          }`}
                          title={isHovering ? 'Tap to disconnect' : 'Tap to show disconnect'}
                        >
                          {isHovering ? (
                            <><UserMinus className="w-4 h-4" /> Disconnect</>
                          ) : (
                            <><UserCheck className="w-4 h-4" /> Connected</>
                          )}
                        </button>
                      </>
                    ) : status === 'pending' ? (
                      <button
                        onClick={() => handleConnect(person.id)}
                        disabled={connectingId === person.id}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 px-3 py-2 rounded font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1 whitespace-nowrap"
                        title="Click to withdraw request"
                      >
                        <Clock className="w-4 h-4" /> Pending
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(person.id)}
                        disabled={connectingId === person.id}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1 whitespace-nowrap"
                      >
                        <UserPlus className="w-4 h-4" /> Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
                <div className="w-24 h-24 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-4xl -mt-16 relative z-10 border-4 border-white mx-auto">
                  {renderAvatar(selectedPerson.avatar, selectedPerson.name)}
                </div>
                {isRecentlyActive(selectedPerson) && (
                  <div className="absolute w-5 h-5 bg-green-500 rounded-full border-2 border-white bottom-0 right-1/3" />
                )}
              </div>

              <h2 className="text-2xl font-bold text-gray-800 dark:text-white text-center mb-1">
                {selectedPerson.name}
              </h2>

              {isNewMember(selectedPerson) && (
                <div className="text-center mb-2">
                  <span className="inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-bold px-3 py-1 rounded">
                    New Member
                  </span>
                </div>
              )}

              {selectedPerson.profession && <p className="text-gray-600 dark:text-gray-300 text-center mb-1">{selectedPerson.profession}</p>}

              {selectedPerson.showLocation && (
                <p className="text-gray-500 dark:text-gray-400 text-center flex items-center justify-center gap-1 mb-4">
                  <MapPin className="w-4 h-4" /> {selectedPerson.city}
                </p>
              )}

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <p className="text-gray-700 dark:text-gray-200">{selectedPerson.bio || 'No bio provided'}</p>
              </div>

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

              {getMutualConnectionCount(selectedPerson.id) > 0 && (
                <div className="mb-4 pb-4 border-b">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-2 text-sm">
                    {getMutualConnectionCount(selectedPerson.id)} Mutual Connections
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300">You both know these people</p>
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

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg z-[70] text-sm font-medium animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
