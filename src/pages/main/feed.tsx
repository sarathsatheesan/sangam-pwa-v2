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
  onSnapshot,
  Timestamp,
  arrayUnion,
  arrayRemove,
  limit,
  startAfter,
  where,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useCulturalTheme } from '@/contexts/CulturalThemeContext';
import { CulturalPatternOverlay } from '@/components/CulturalPatterns';
import { ClickOutsideOverlay } from '@/components/ClickOutsideOverlay';
import EthnicityFilterDropdown from '../../components/EthnicityFilterDropdown';
import {
  MessageCircle,
  Share2,
  MoreHorizontal,
  Send,
  X,
  Flag,
  Trash2,
  Smile,
  Globe,
  Users,
  Calendar,
  ThumbsUp,
  Bookmark,
  Edit3,
  Camera,
  Image as ImageIcon,
  Search,
  ChevronDown,
  AlertTriangle,
  Ban,
  Download,
} from 'lucide-react';

interface Post {
  id: string;
  content: string;
  type: 'community' | 'professional' | 'event';
  userId: string;
  userName: string;
  userAvatar: string;
  likes: number;
  comments: number;
  createdAt: any;
  heritage?: string | string[];
  reported?: boolean;
  reactions?: { [emoji: string]: string[] };
  reactionCount?: number;
  feeling?: { emoji: string; label: string };
  images?: string[];
}

interface Comment {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
  createdAt: any;
  likes?: number;
  likedBy?: string[];
  image?: string;
}

const PAGE_SIZE = 15;

const REACTIONS = [
  { emoji: '👍', label: 'Like', color: '#6366F1' },
  { emoji: '❤️', label: 'Love', color: '#EF4444' },
  { emoji: '😂', label: 'Haha', color: '#F59E0B' },
  { emoji: '😮', label: 'Wow', color: '#F59E0B' },
  { emoji: '😢', label: 'Sad', color: '#3B82F6' },
  { emoji: '🙏', label: 'Pray', color: '#8B5CF6' },
];

const FEELINGS = [
  { emoji: '😊', label: 'happy' },
  { emoji: '🎉', label: 'celebrating' },
  { emoji: '🙏', label: 'grateful' },
  { emoji: '💭', label: 'thoughtful' },
  { emoji: '😢', label: 'sad' },
  { emoji: '💪', label: 'motivated' },
  { emoji: '🤔', label: 'curious' },
  { emoji: '❤️', label: 'loved' },
];

// Native-language "Hello" greetings mapped by ethnicity
const NATIVE_HELLO: Record<string, string> = {
  // South Asian
  'Indian': 'Namaste', 'Pakistani': 'Assalam o Alaikum', 'Bangladeshi': 'Assalamu Alaikum',
  'Sri Lankan': 'Ayubowan', 'Nepali': 'Namaste', 'Bhutanese': 'Kuzu Zangpo',
  'Maldivian': 'Assalaam Alaikum', 'Afghan': 'Salaam',
  // East Asian
  'Chinese': '你好', 'Japanese': 'こんにちは', 'Korean': '안녕하세요',
  'Taiwanese': '你好', 'Mongolian': 'Сайн байна уу', 'Tibetan': 'Tashi Delek',
  'Hong Konger': '你好',
  // Southeast Asian
  'Filipino': 'Kumusta', 'Vietnamese': 'Xin chào', 'Indonesian': 'Halo',
  'Thai': 'สวัสดี', 'Malaysian': 'Selamat', 'Burmese': 'Mingalarbar',
  'Cambodian': 'សួស្តី', 'Laotian': 'ສະບາຍດີ', 'Singaporean': 'Hello',
  'Hmong': 'Nyob zoo',
  // Central Asian
  'Kazakh': 'Сәлем', 'Uzbek': 'Salom', 'Tajik': 'Салом', 'Kyrgyz': 'Салам', 'Turkmen': 'Salam',
  // Hispanic / Latino
  'Mexican': 'Hola', 'Mexican American': 'Hola', 'Chicano': 'Hola',
  'Puerto Rican': 'Hola', 'Cuban': 'Hola', 'Dominican': 'Hola',
  'Jamaican': 'Wah Gwaan', 'Haitian': 'Bonjou', 'Trinidadian': 'Hello',
  'Barbadian': 'Hello', 'Bahamian': 'Hello',
  'Brazilian': 'Olá', 'Colombian': 'Hola', 'Argentine': 'Hola',
  'Peruvian': 'Hola', 'Venezuelan': 'Hola', 'Chilean': 'Hola',
  'Ecuadorian': 'Hola', 'Bolivian': 'Hola', 'Paraguayan': 'Hola',
  'Uruguayan': 'Hola', 'Guyanese': 'Hello', 'Surinamese': 'Hallo',
  'Salvadoran': 'Hola', 'Guatemalan': 'Hola', 'Honduran': 'Hola',
  'Nicaraguan': 'Hola', 'Costa Rican': 'Hola', 'Panamanian': 'Hola',
  'Belizean': 'Hello', 'Spanish (from Spain)': 'Hola',
  // European
  'English': 'Hello', 'German': 'Hallo', 'French': 'Bonjour', 'Irish': 'Dia duit',
  'Dutch': 'Hallo', 'Belgian': 'Hallo', 'Swiss': 'Grüezi', 'Austrian': 'Servus',
  'Scottish': 'Hello', 'Welsh': 'Shwmae', 'Luxembourgish': 'Moien',
  'Italian': 'Ciao', 'Spanish': 'Hola', 'Greek': 'Γεια σου', 'Portuguese': 'Olá',
  'Croatian': 'Bok', 'Serbian': 'Здраво', 'Albanian': 'Përshëndetje',
  'Maltese': 'Bonġu', 'Bosnian': 'Zdravo', 'Montenegrin': 'Zdravo',
  'Slovenian': 'Živjo', 'Macedonian': 'Здраво', 'Cypriot': 'Γεια σου',
  'Russian': 'Привет', 'Polish': 'Cześć', 'Ukrainian': 'Привіт',
  'Romanian': 'Salut', 'Czech': 'Ahoj', 'Hungarian': 'Szia',
  'Bulgarian': 'Здравей', 'Slovak': 'Ahoj', 'Belarusian': 'Прывітанне',
  'Moldovan': 'Salut', 'Georgian': 'გამარჯობა', 'Armenian': 'Բարև',
  'Swedish': 'Hej', 'Norwegian': 'Hei', 'Danish': 'Hej', 'Finnish': 'Hei',
  'Icelandic': 'Halló', 'Estonian': 'Tere', 'Latvian': 'Sveiki', 'Lithuanian': 'Labas',
  // African
  'African American': 'Hello', 'Black British': 'Hello', 'Afro-Caribbean': 'Hello',
  'Afro-Latino': 'Hola',
  'Nigerian': 'Bawo ni', 'Ghanaian': 'Akwaaba', 'Senegalese': 'Nanga def',
  'Ivorian': 'Bonjour', 'Malian': 'I ni ce',
  'Ethiopian': 'ሰላም', 'Kenyan': 'Habari', 'Somali': 'Salaan',
  'Tanzanian': 'Habari', 'Ugandan': 'Habari',
  'Egyptian': 'مرحبا', 'Moroccan': 'مرحبا', 'Algerian': 'مرحبا',
  'Tunisian': 'مرحبا', 'Sudanese': 'مرحبا',
  'South African': 'Sawubona', 'Zimbabwean': 'Mhoro',
  'Congolese': 'Mbote', 'Cameroonian': 'Bonjour',
  // Middle Eastern
  'Lebanese': 'Marhaba', 'Syrian': 'Marhaba', 'Palestinian': 'Marhaba',
  'Jordanian': 'Marhaba', 'Iraqi': 'Marhaba',
  'Saudi': 'مرحبا', 'Emirati': 'مرحبا', 'Kuwaiti': 'مرحبا',
  'Qatari': 'مرحبا', 'Bahraini': 'مرحبا', 'Omani': 'مرحبا', 'Yemeni': 'مرحبا',
  'Persian': 'سلام', 'Iranian': 'سلام', 'Kurdish': 'Silav',
  'Turkish': 'Merhaba',
  'Israeli': 'שלום', 'Ashkenazi Jewish': 'Shalom', 'Sephardic Jewish': 'Shalom', 'Mizrahi Jewish': 'Shalom',
  // Oceanian / Pacific Islander
  'Native Hawaiian': 'Aloha', 'Samoan': 'Talofa', 'Tongan': 'Mālō e lelei',
  'Maori': 'Kia ora', 'Tahitian': 'Ia orana', 'Cook Islander': 'Kia orana',
  'Fijian': 'Bula', 'Papua New Guinean': 'Hello',
  'Chamorro': 'Håfa Adai', 'Guamanian': 'Håfa Adai',
  'Australian': "G'day", 'New Zealander': 'Kia ora', 'Pakeha': 'Hello',
  // Indigenous
  'Native American': 'Yá\'át\'ééh', 'Alaska Native': 'Hello',
  'Cherokee': 'Osiyo', 'Navajo': 'Yá\'át\'ééh', 'Sioux': 'Háu',
  'Ojibwe': 'Boozhoo', 'Apache': 'Dagotʼee',
  'First Nations': 'Tansi', 'Inuit': 'Ai', 'Métis': 'Tansi',
  'Aboriginal Australian': 'Hello', 'Torres Strait Islander': 'Hello',
  'Sámi': 'Bures', 'Ainu': 'Irankarapte',
};

const timeAgo = (timestamp: any): string => {
  if (!timestamp) return 'Just now';
  const now = new Date();
  const postDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getFullDateTime = (timestamp: any): string => {
  if (!timestamp) return '';
  const postDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return postDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getTypeConfig = (type: string) => {
  switch (type) {
    case 'community':
      return { color: '#10B981', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', icon: <Globe size={12} />, label: 'Connect' };
    case 'professional':
      return { color: '#6366F1', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-400', icon: <Users size={12} />, label: 'Professional' };
    case 'event':
      return { color: '#F59E0B', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', icon: <Calendar size={12} />, label: 'Event' };
    default:
      return { color: '#6366F1', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-400', icon: <Globe size={12} />, label: type };
  }
};

// ─── Image Compression Utility ──────────────────────────────────────────────
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
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


const REPORT_CATEGORIES = [
  { id: 'spam', label: 'Spam or Misleading', icon: '🚫', description: 'Unwanted promotional, repetitive, or misleading content' },
  { id: 'hate_speech', label: 'Hate Speech or Bullying', icon: '🛑', description: 'Content targeting race, ethnicity, religion, gender, or personal attacks' },
  { id: 'inappropriate', label: 'Inappropriate Content', icon: '⚠️', description: 'Sexual, violent, or graphic content not suitable for the community' },
  { id: 'ip_violation', label: 'Intellectual Property Violation', icon: '©️', description: 'Unauthorized use of copyrighted material or trademarks' },
  { id: 'misinformation', label: 'Misinformation', icon: '❌', description: 'False or misleading information that could cause harm' },
  { id: 'scam', label: 'Scam or Fraud', icon: '🎣', description: 'Phishing, financial fraud, or deceptive schemes' },
  { id: 'other', label: 'Other', icon: '📋', description: 'Something else that violates community guidelines' },
];

export default function FeedPage() {
  const { user, userProfile, userRole } = useAuth();
  const { theme, isNeutral } = useCulturalTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedType, setSelectedType] = useState<'community' | 'professional' | 'event'>('community');
  const [postContent, setPostContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Legacy likedPosts removed — reactions system handles all engagement
  const [selectedHeritage, setSelectedHeritage] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  // animatingLike removed — reactions system handles animation

  // Pre-select user's heritage ethnicities on load
  useEffect(() => {
    if (!userProfile?.heritage) return;
    const raw = Array.isArray(userProfile.heritage)
      ? userProfile.heritage
      : [userProfile.heritage];
    const unique = [...new Set(raw)];
    if (unique.length > 0) setSelectedHeritage(unique);
  }, [userProfile?.heritage]);

  // Post detail & comments
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // 3-dot menu
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Report
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportedPosts, setReportedPosts] = useState<Set<string>>(new Set());
  const [mutedPosts, setMutedPosts] = useState<Set<string>>(new Set());
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockTargetUser, setBlockTargetUser] = useState<{ uid: string; name: string } | null>(null);

  // Load user's muted posts and blocked users on mount
  useEffect(() => {
    if (!user) return;
    const loadUserSafetyData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.mutedPosts) {
            setMutedPosts(new Set(data.mutedPosts));
          }
          if (data.blockedUsers) {
            setBlockedUsers(new Set(data.blockedUsers));
          }
        }
      } catch (e) {
        console.error('Error loading user safety data:', e);
      }
    };
    loadUserSafetyData();
  }, [user]);

  // Moderation notifications
  const [moderationNotifs, setModerationNotifs] = useState<Array<{ id: string; message: string; reason: string; postId: string; createdAt: any; read: boolean }>>([]);
  const [showNotifBanner, setShowNotifBanner] = useState(true);

  // Load moderation notifications for the current user
  useEffect(() => {
    if (!user) return;
    const loadNotifs = async () => {
      try {
        const q = query(
          collection(db, 'notifications'),
          where('recipientId', '==', user.uid),
          where('type', '==', 'content_hidden'),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const snap = await getDocs(q);
        setModerationNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any)));
      } catch (e) {
        console.error('Error loading notifications:', e);
      }
    };
    loadNotifs();
  }, [user]);

  const dismissNotification = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
      setModerationNotifs((prev) => prev.filter((n) => n.id !== notifId));
    } catch (e) {
      console.error('Error dismissing notification:', e);
    }
  };

  // Edit post
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // Delete confirmation modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  // Enhancement 1: Emoji Reactions
  const [showReactionBar, setShowReactionBar] = useState<string | null>(null);
  const [showDetailReactionBar, setShowDetailReactionBar] = useState(false);
  const [userReactions, setUserReactions] = useState<Map<string, string>>(new Map());
  const reactionBarRef = useRef<HTMLDivElement>(null);
  const detailReactionBarRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enhancement 2: Expand/Collapse
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  // Enhancement 3: Feeling Selector
  const [selectedFeeling, setSelectedFeeling] = useState<{ emoji: string; label: string } | null>(null);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);

  // Image upload for posts and comments
  const [postImages, setPostImages] = useState<string[]>([]);
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const postImageInputRef = useRef<HTMLInputElement>(null);
  const commentImageInputRef = useRef<HTMLInputElement>(null);

  // Enhancement 4: Bookmarks
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Enhancement 5: Infinite Scroll
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Enhancement 6: Sorting
  const [sortMode, setSortMode] = useState<'recent' | 'popular' | 'trending'>('recent');

  // Lightbox image viewer
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Native-language greeting based on user's ethnicity
  const nativeGreeting = useMemo(() => {
    if (!userProfile?.heritage) return 'Hello';
    const heritages = Array.isArray(userProfile.heritage) ? userProfile.heritage : [userProfile.heritage];
    for (const h of heritages) {
      if (NATIVE_HELLO[h]) return NATIVE_HELLO[h];
    }
    return 'Hello';
  }, [userProfile?.heritage]);

  // One-time migration: rename 'social' → 'community' in Firestore posts
  useEffect(() => {
    const migrateKey = 'sangam_social_to_community_migrated';
    if (localStorage.getItem(migrateKey)) return;
    const migrate = async () => {
      try {
        const allPosts = await getDocs(collection(db, 'posts'));
        const batch: Promise<void>[] = [];
        allPosts.forEach((d) => {
          if (d.data().type === 'social') {
            batch.push(updateDoc(doc(db, 'posts', d.id), { type: 'community' }));
          }
        });
        if (batch.length > 0) await Promise.all(batch);
        localStorage.setItem(migrateKey, 'true');
      } catch (err) {
        console.error('[Migration] Failed:', err);
      }
    };
    migrate();
  }, []);

  // Close heritage dropdown on outside click
  // ClickOutsideOverlay rendered in JSX instead of useClickOutside hook

  // Load saved posts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sangam_saved_posts');
    if (saved) {
      try {
        const postIds = JSON.parse(saved);
        setSavedPosts(new Set(postIds));
      } catch (err) {
        console.error('Failed to load saved posts:', err);
      }
    }
  }, []);

  // Listen for posts with pagination
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData: Post[] = [];
      const reactionsMap = new Map<string, string>();
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (data.isHidden) return; // Skip hidden posts
        const post = { id: docSnapshot.id, ...data } as Post;
        postsData.push(post);
        // Scan reactions to find current user's reaction
        if (user && post.reactions) {
          for (const [emoji, users] of Object.entries(post.reactions)) {
            if (Array.isArray(users) && users.includes(user.uid)) {
              reactionsMap.set(post.id, emoji);
              break;
            }
          }
        }
      });
      setPosts(postsData);
      if (reactionsMap.size > 0) {
        setUserReactions((prev) => {
          const merged = new Map(prev);
          reactionsMap.forEach((emoji, postId) => merged.set(postId, emoji));
          return merged;
        });
      }
      setLoading(false);
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      }
    });
    return unsubscribe;
  }, []);

  // Deep-link: open specific post from profile activity
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && posts.length > 0) {
      const found = posts.find((p: any) => p.id === openId);
      if (found) {
        setSelectedPost(found);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, posts]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore && hasMore) {
        loadMorePosts();
      }
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, lastDoc]);

  // Close menu on outside click
  // menu overlay rendered in JSX

  // Close reaction bar on outside click
  // reaction bar overlay rendered in JSX

  // Close detail reaction bar on outside click
  // detail reaction bar overlay rendered in JSX

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Cleanup long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []);

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreateModal) {
          setShowCreateModal(false);
        } else if (selectedPost) {
          setSelectedPost(null);
          setComments([]);
        } else if (showReportModal) {
          setShowReportModal(false);
        }
      }
    };
    if (showCreateModal || selectedPost || showReportModal) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showCreateModal, selectedPost, showReportModal]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const loadMorePosts = async () => {
    if (!user || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      const snapshot = await getDocs(q);
      if (snapshot.docs.length > 0) {
        const newPosts: Post[] = [];
        const reactionsMap = new Map<string, string>();
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          if (data.isHidden) return; // Skip hidden posts
          const post = { id: docSnapshot.id, ...data } as Post;
          newPosts.push(post);
          if (user && post.reactions) {
            for (const [emoji, users] of Object.entries(post.reactions)) {
              if (Array.isArray(users) && users.includes(user.uid)) {
                reactionsMap.set(post.id, emoji);
                break;
              }
            }
          }
        });
        setPosts((prev) => [...prev, ...newPosts]);
        if (reactionsMap.size > 0) {
          setUserReactions((prev) => {
            const merged = new Map(prev);
            reactionsMap.forEach((emoji, postId) => merged.set(postId, emoji));
            return merged;
          });
        }
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more posts:', err);
      setToastMessage('Failed to load more posts. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePostImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 4 - postImages.length;
    const toProcess = Array.from(files).slice(0, remaining);
    for (const file of toProcess) {
      try {
        const compressed = await compressImage(file);
        setPostImages((prev) => prev.length < 4 ? [...prev, compressed] : prev);
      } catch (err) {
        console.error('Error compressing image:', err);
      }
    }
    if (postImageInputRef.current) postImageInputRef.current.value = '';
  };

  const handleCommentImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setCommentImage(compressed);
    } catch (err) {
      console.error('Error compressing comment image:', err);
    }
    if (commentImageInputRef.current) commentImageInputRef.current.value = '';
  };

  const handleCreatePost = async () => {
    if ((!postContent.trim() && postImages.length === 0) || !user) {
      alert('Please enter some content or add an image for your post');
      return;
    }
    try {
      setSubmitting(true);
      await addDoc(collection(db, 'posts'), {
        content: postContent.trim(),
        type: selectedType,
        userId: user.uid,
        userName: userProfile?.name || user.displayName || 'Anonymous',
        userAvatar: userProfile?.avatar || user.photoURL || '👤',
        heritage: Array.isArray(userProfile?.heritage)
          ? userProfile.heritage
          : userProfile?.heritage ? [userProfile.heritage] : [],
        likes: 0,
        comments: 0,
        createdAt: serverTimestamp(),
        feeling: selectedFeeling,
        reactions: {},
        reactionCount: 0,
        ...(postImages.length > 0 ? { images: postImages } : {}),
      });
      setPostContent('');
      setSelectedType('community');
      setSelectedFeeling(null);
      setPostImages([]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Legacy handleToggleLike removed — reactions system handles all engagement

  const handleReaction = async (postId: string, emoji: string) => {
    if (!user) return;
    const currentReaction = userReactions.get(postId);

    // Optimistic UI: update local state immediately
    const optimisticPostUpdate = (updater: (post: Post) => Post) => {
      setPosts((prev) => prev.map((p) => p.id === postId ? updater(p) : p));
      if (selectedPost?.id === postId) {
        setSelectedPost((prev) => prev ? updater(prev) : prev);
      }
    };

    if (currentReaction === emoji) {
      // Remove reaction (toggle off)
      setUserReactions((prev) => { const m = new Map(prev); m.delete(postId); return m; });
      optimisticPostUpdate((p) => {
        const reactions = { ...p.reactions };
        if (reactions[emoji]) {
          reactions[emoji] = reactions[emoji].filter((uid: string) => uid !== user.uid);
        }
        return { ...p, reactions };
      });
    } else if (currentReaction) {
      // Switch reaction
      setUserReactions((prev) => { const m = new Map(prev); m.set(postId, emoji); return m; });
      optimisticPostUpdate((p) => {
        const reactions = { ...p.reactions };
        if (reactions[currentReaction]) {
          reactions[currentReaction] = reactions[currentReaction].filter((uid: string) => uid !== user.uid);
        }
        reactions[emoji] = [...(reactions[emoji] || []), user.uid];
        return { ...p, reactions };
      });
    } else {
      // Add new reaction
      setUserReactions((prev) => { const m = new Map(prev); m.set(postId, emoji); return m; });
      optimisticPostUpdate((p) => {
        const reactions = { ...p.reactions };
        reactions[emoji] = [...(reactions[emoji] || []), user.uid];
        return { ...p, reactions };
      });
    }
    setShowReactionBar(null);
    setShowDetailReactionBar(false);

    // Write to Firestore in background
    try {
      const postRef = doc(db, 'posts', postId);
      if (currentReaction === emoji) {
        await updateDoc(postRef, { [`reactions.${emoji}`]: arrayRemove(user.uid) });
      } else if (currentReaction) {
        await updateDoc(postRef, {
          [`reactions.${currentReaction}`]: arrayRemove(user.uid),
          [`reactions.${emoji}`]: arrayUnion(user.uid),
        });
      } else {
        await updateDoc(postRef, { [`reactions.${emoji}`]: arrayUnion(user.uid) });
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    setMenuPostId(null);
    setDeletePostId(postId);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePost = async () => {
    if (!deletePostId) return;
    try {
      await deleteDoc(doc(db, 'posts', deletePostId));
      if (selectedPost?.id === deletePostId) setSelectedPost(null);
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post.');
    } finally {
      setShowDeleteConfirm(false);
      setDeletePostId(null);
    }
  };

  const handleEditPost = (post: Post) => {
    setMenuPostId(null);
    setEditingPost(post);
    setPostContent(post.content);
    setSelectedType(post.type as 'community' | 'professional' | 'event');
    setSelectedFeeling(post.feeling || null);
    setPostImages(post.images || []);
    setShowCreateModal(true);
  };

  const handleUpdatePost = async () => {
    if ((!postContent.trim() && postImages.length === 0) || !user || !editingPost) return;
    try {
      setSubmitting(true);
      await updateDoc(doc(db, 'posts', editingPost.id), {
        content: postContent.trim(),
        type: selectedType,
        feeling: selectedFeeling,
        images: postImages,
      });
      setPostContent('');
      setSelectedType('community');
      setSelectedFeeling(null);
      setPostImages([]);
      setEditingPost(null);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.userName}`,
          text: post.content.substring(0, 100),
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Copy failed:', err);
      }
    }
  };

  const handleToggleBookmark = (postId: string) => {
    const newSavedPosts = new Set(savedPosts);
    if (newSavedPosts.has(postId)) {
      newSavedPosts.delete(postId);
      setToastMessage('Removed from saved');
    } else {
      newSavedPosts.add(postId);
      setToastMessage('Post saved');
    }
    setSavedPosts(newSavedPosts);
    localStorage.setItem('sangam_saved_posts', JSON.stringify(Array.from(newSavedPosts)));
  };

  // ─── Comments ──────────────────────────────────────────────────────

  const openPostDetail = async (post: Post) => {
    setSelectedPost(post);
    setLoadingComments(true);
    try {
      const q = query(
        collection(db, 'posts', post.id, 'comments'),
        orderBy('createdAt', 'asc')
      );
      const snapshot = await getDocs(q);
      const commentsData: Comment[] = [];
      snapshot.forEach((d) => commentsData.push({ id: d.id, ...d.data() } as Comment));
      setComments(commentsData);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if ((!newComment.trim() && !commentImage) || !user || !selectedPost) return;
    try {
      setSubmittingComment(true);
      await addDoc(collection(db, 'posts', selectedPost.id, 'comments'), {
        text: newComment.trim(),
        userId: user.uid,
        userName: userProfile?.name || user.displayName || 'Anonymous',
        userAvatar: userProfile?.avatar || user.photoURL || '👤',
        createdAt: serverTimestamp(),
        ...(commentImage ? { image: commentImage } : {}),
      });
      await updateDoc(doc(db, 'posts', selectedPost.id), { comments: increment(1) });
      // Update local comment count so detail header reflects new count immediately
      setSelectedPost((prev) => prev ? { ...prev, comments: prev.comments + 1 } : prev);
      setPosts((prev) => prev.map((p) => p.id === selectedPost.id ? { ...p, comments: p.comments + 1 } : p));
      setNewComment('');
      setCommentImage(null);
      const q = query(
        collection(db, 'posts', selectedPost.id, 'comments'),
        orderBy('createdAt', 'asc')
      );
      const snapshot = await getDocs(q);
      const commentsData: Comment[] = [];
      snapshot.forEach((d) => commentsData.push({ id: d.id, ...d.data() } as Comment));
      setComments(commentsData);
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // ─── Comment Like ────────────────────────────────────────────────────────

  const handleCommentLike = async (commentId: string) => {
    if (!user || !selectedPost) return;
    const commentRef = doc(db, 'posts', selectedPost.id, 'comments', commentId);
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;

    const alreadyLiked = comment.likedBy?.includes(user.uid);

    // Optimistic UI update
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const likedBy = c.likedBy || [];
        if (alreadyLiked) {
          return { ...c, likes: Math.max((c.likes || 0) - 1, 0), likedBy: likedBy.filter((uid) => uid !== user.uid) };
        } else {
          return { ...c, likes: (c.likes || 0) + 1, likedBy: [...likedBy, user.uid] };
        }
      })
    );

    // Persist to Firestore
    try {
      if (alreadyLiked) {
        await updateDoc(commentRef, { likes: increment(-1), likedBy: arrayRemove(user.uid) });
      } else {
        await updateDoc(commentRef, { likes: increment(1), likedBy: arrayUnion(user.uid) });
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  // ─── Remove Comment Image ──────────────────────────────────────────

  const handleRemoveCommentImage = async (commentId: string) => {
    if (!user || !selectedPost) return;
    try {
      const commentRef = doc(db, 'posts', selectedPost.id, 'comments', commentId);
      await updateDoc(commentRef, { image: '' });
      // Optimistic UI update
      setComments((prev) =>
        prev.map((c) => c.id === commentId ? { ...c, image: undefined } : c)
      );
    } catch (error) {
      console.error('Error removing comment image:', error);
    }
  };

  // ─── Delete Comment ──────────────────────────────────────────────────

  const handleDeleteComment = async (commentId: string) => {
    if (!user || !selectedPost) return;
    try {
      await deleteDoc(doc(db, 'posts', selectedPost.id, 'comments', commentId));
      await updateDoc(doc(db, 'posts', selectedPost.id), { comments: increment(-1) });
      setSelectedPost((prev) => prev ? { ...prev, comments: Math.max(prev.comments - 1, 0) } : prev);
      setPosts((prev) => prev.map((p) => p.id === selectedPost.id ? { ...p, comments: Math.max(p.comments - 1, 0) } : p));
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // ─── Edit Comment ──────────────────────────────────────────────────

  const startEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text || '');
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleUpdateComment = async () => {
    if (!user || !selectedPost || !editingCommentId || !editCommentText.trim()) return;
    try {
      const commentRef = doc(db, 'posts', selectedPost.id, 'comments', editingCommentId);
      await updateDoc(commentRef, { text: editCommentText.trim() });
      setComments((prev) =>
        prev.map((c) => c.id === editingCommentId ? { ...c, text: editCommentText.trim() } : c)
      );
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  // ─── Report ────────────────────────────────────────────────────────

  const openReportModal = (postId: string) => {
    setMenuPostId(null);
    setReportPostId(postId);
    setReportReason('');
    setReportDetails('');
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReason || !reportPostId || !user) return;
    try {
      setReportSubmitting(true);
      const reportedPost = posts.find((p) => p.id === reportPostId);
      const categoryObj = REPORT_CATEGORIES.find((c) => c.id === reportReason);

      // Write to reports collection for record-keeping (stealth: no author notification)
      await addDoc(collection(db, 'reports'), {
        postId: reportPostId,
        reportedBy: user.uid,
        reporterName: userProfile?.name || user.displayName || 'Anonymous',
        reporterAvatar: userProfile?.avatar || '',
        category: reportReason,
        categoryLabel: categoryObj?.label || reportReason,
        details: reportDetails.trim() || '',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      // Check if moderationQueue entry already exists for this post (crowdsourced aggregation)
      const modQueueQuery = query(
        collection(db, 'moderationQueue'),
        where('contentId', '==', reportPostId)
      );
      const existingMods = await getDocs(modQueueQuery);

      let totalReportCount = 1;

      if (existingMods.docs.length > 0) {
        // Aggregate into existing moderation queue item
        const existingDoc = existingMods.docs[0];
        const existingData = existingDoc.data();
        totalReportCount = (existingData.reportCount || 1) + 1;
        await updateDoc(doc(db, 'moderationQueue', existingDoc.id), {
          reportCount: totalReportCount,
          reporters: arrayUnion({
            uid: user.uid,
            name: userProfile?.name || user.displayName || 'Anonymous',
            avatar: userProfile?.avatar || '',
            category: reportReason,
            details: reportDetails.trim() || '',
            createdAt: new Date().toISOString(),
          }),
        });
      } else {
        // Create new moderationQueue entry
        await addDoc(collection(db, 'moderationQueue'), {
          type: 'post',
          content: reportedPost?.content || '',
          contentId: reportPostId,
          collection: 'posts',
          authorId: reportedPost?.userId || '',
          authorName: reportedPost?.userName || 'Unknown',
          authorAvatar: reportedPost?.userAvatar || '',
          images: reportedPost?.images || [],
          category: reportReason,
          categoryLabel: categoryObj?.label || reportReason,
          reason: `${categoryObj?.label || reportReason}${reportDetails.trim() ? ': ' + reportDetails.trim() : ''}`,
          reportedBy: user.uid,
          reporterName: userProfile?.name || user.displayName || 'Anonymous',
          reporterAvatar: userProfile?.avatar || '',
          reportCount: 1,
          reporters: [{
            uid: user.uid,
            name: userProfile?.name || user.displayName || 'Anonymous',
            avatar: userProfile?.avatar || '',
            category: reportReason,
            details: reportDetails.trim() || '',
            createdAt: new Date().toISOString(),
          }],
          createdAt: serverTimestamp(),
        });
      }

      // 3-strike auto-hide: if 3+ reports, auto-hide the post globally
      if (totalReportCount >= 3) {
        await updateDoc(doc(db, 'posts', reportPostId), {
          isHidden: true,
          hiddenAt: new Date().toISOString(),
          hiddenReason: 'Auto-hidden: reached 3 community reports',
        });
        // Notify post author about auto-hide with appeal instructions
        if (reportedPost?.userId) {
          await addDoc(collection(db, 'notifications'), {
            type: 'content_hidden',
            recipientId: reportedPost.userId,
            recipientName: reportedPost.userName || '',
            postId: reportPostId,
            reason: 'Your post received multiple community reports and has been temporarily hidden for review.',
            message: 'Your post has been temporarily hidden after multiple community reports. A moderator will review it shortly. If you believe this was a mistake, you can submit an appeal by contacting support.',
            actionUrl: '/feed',
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      }

      // Mute-on-report: hide this post from the reporter's feed permanently
      await updateDoc(doc(db, 'users', user.uid), {
        mutedPosts: arrayUnion(reportPostId),
      });
      setMutedPosts((prev) => new Set(prev).add(reportPostId));

      setReportedPosts((prev) => new Set(prev).add(reportPostId));
      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
      alert('Report submitted. The post has been hidden from your feed. Thank you for helping keep the community safe.');
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  // ─── Block User ────────────────────────────────────────────────────────

  const handleBlockUser = async () => {
    if (!user || !blockTargetUser) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: arrayUnion(blockTargetUser.uid),
      });
      setBlockedUsers((prev) => new Set(prev).add(blockTargetUser.uid));
      setShowBlockConfirm(false);
      setBlockTargetUser(null);
      setToastMessage(`${blockTargetUser.name} has been blocked. Their content will no longer appear in your feed.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (error) {
      console.error('Error blocking user:', error);
      alert('Failed to block user. Please try again.');
    }
  };

  const openBlockConfirm = (userId: string, userName: string) => {
    setMenuPostId(null);
    setBlockTargetUser({ uid: userId, name: userName });
    setShowBlockConfirm(true);
  };

  // ─── Lightbox Handlers ────────────────────────────────────────────────────
  const downloadLightboxImage = () => {
    if (!lightboxImage) return;
    const link = document.createElement('a');
    link.href = lightboxImage;
    link.download = `image_${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareLightboxImage = async () => {
    if (!lightboxImage) return;
    if (navigator.share) {
      try {
        await navigator.share({ url: lightboxImage });
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(lightboxImage);
        setToastMessage('Image link copied to clipboard');
        setTimeout(() => setToastMessage(null), 3000);
      } catch {
        setToastMessage('Could not share image');
        setTimeout(() => setToastMessage(null), 3000);
      }
    }
  };

  // ─── Filter & Sort ────────────────────────────────────────────────────────

  const filteredPosts = useMemo(() => {
    let result = posts.filter((post) => {
      // Mute-on-report: hide posts the user has reported
      if (mutedPosts.has(post.id)) return false;
      // Block filter: hide posts from blocked users
      if (blockedUsers.has(post.userId)) return false;
      // Search filter
      if (feedSearchQuery.trim()) {
        const q = feedSearchQuery.toLowerCase();
        const matchesSearch = post.content?.toLowerCase().includes(q) ||
          post.userName?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      // Saved filter
      if (showSavedOnly && !savedPosts.has(post.id)) return false;
      // Heritage filter (multi-select)
      if (selectedHeritage.length > 0) {
        if (Array.isArray(post.heritage)) {
          if (!post.heritage.some((h: string) => selectedHeritage.includes(h))) return false;
        } else if (post.heritage) {
          if (!selectedHeritage.includes(post.heritage)) return false;
        } else {
          return false;
        }
      }
      return true;
    });

    // Apply sorting
    if (sortMode === 'popular') {
      result = [...result].sort((a, b) => {
        const reactionsA = a.reactions ? Object.values(a.reactions).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0) : 0;
        const reactionsB = b.reactions ? Object.values(b.reactions).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0) : 0;
        const scoreA = (reactionsA || a.likes || 0) + (a.comments * 2);
        const scoreB = (reactionsB || b.likes || 0) + (b.comments * 2);
        return scoreB - scoreA;
      });
    } else if (sortMode === 'trending') {
      const now = new Date().getTime();
      result = [...result].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        const hoursA = (now - dateA.getTime()) / (1000 * 60 * 60) + 1;
        const hoursB = (now - dateB.getTime()) / (1000 * 60 * 60) + 1;
        const reactionsA = a.reactions ? Object.values(a.reactions).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0) : 0;
        const reactionsB = b.reactions ? Object.values(b.reactions).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0) : 0;
        const engagementA = (reactionsA || a.likes || 0) + (a.comments * 2);
        const engagementB = (reactionsB || b.likes || 0) + (b.comments * 2);
        const scoreA = engagementA / Math.pow(hoursA, 0.8);
        const scoreB = engagementB / Math.pow(hoursB, 0.8);
        return scoreB - scoreA;
      });
    }

    return result;
  }, [posts, selectedHeritage, sortMode, savedPosts, feedSearchQuery, showSavedOnly, mutedPosts, blockedUsers]);

  // ─── Helpers ──────────────────────────────────────────────────────

  const renderAvatar = (avatar: string, name: string, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-lg', lg: 'w-12 h-12 text-xl' };
    if (avatar && (avatar.startsWith('http') || avatar.startsWith('data:'))) {
      return <img src={avatar} alt={name} className={`${sizeClasses[size]} rounded-full object-cover`} />;
    }
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-aurora-surface-variant flex items-center justify-center flex-shrink-0`}>
        {avatar || name?.charAt(0) || '👤'}
      </div>
    );
  };

  const renderContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hashtagRegex = /#(\w+)/g;
    let lastIndex = 0;
    const elements: (string | React.ReactElement)[] = [];

    // Validate URL protocol (only allow http/https)
    const isValidUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    // Handle URLs
    let match;
    const urlMatches: Array<{ start: number; end: number; url: string }> = [];
    while ((match = urlRegex.exec(text)) !== null) {
      if (isValidUrl(match[0])) {
        urlMatches.push({ start: match.index, end: match.index + match[0].length, url: match[0] });
      }
    }

    // Handle hashtags
    const hashtagMatches: Array<{ start: number; end: number; tag: string }> = [];
    while ((match = hashtagRegex.exec(text)) !== null) {
      hashtagMatches.push({ start: match.index, end: match.index + match[0].length, tag: match[1] });
    }

    // Merge and sort all matches
    const allMatches = [...urlMatches, ...hashtagMatches].sort((a, b) => a.start - b.start);

    allMatches.forEach((m, idx) => {
      if (m.start > lastIndex) {
        elements.push(text.substring(lastIndex, m.start));
      }
      if ('url' in m) {
        elements.push(
          <a
            key={`url-${idx}`}
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-aurora-indigo hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {m.url}
          </a>
        );
      } else {
        elements.push(
          <span key={`tag-${idx}`} className="text-aurora-indigo font-medium cursor-pointer">
            #{m.tag}
          </span>
        );
      }
      lastIndex = m.end;
    });

    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex));
    }

    return elements;
  };

  const getReactionSummary = (post: Post) => {
    if (!post.reactions) return null;

    // Filter out emoji keys with empty arrays
    const activeReactions = Object.entries(post.reactions)
      .filter(([, users]) => Array.isArray(users) && users.length > 0);

    if (activeReactions.length === 0) return null;

    const reactionEmojis = activeReactions
      .slice(0, 3)
      .map(([emoji]) => emoji)
      .join('');

    // Count actual users across all reaction arrays
    const totalReactions = activeReactions.reduce((sum, [, users]) => sum + users.length, 0);

    return {
      emojis: reactionEmojis,
      count: totalReactions,
    };
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div
      className="relative"
      style={{
        background: isNeutral
          ? 'linear-gradient(to bottom, rgba(199,210,254,0.5), rgba(224,231,255,0.3), rgba(167,243,208,0.4))'
          : `linear-gradient(to bottom, ${theme.colors.gradientFrom}12, ${theme.colors.gradientVia}08, ${theme.colors.gradientTo}10)`,
      }}
    >
      {/* Cultural Pattern Overlay */}
      {!isNeutral && <CulturalPatternOverlay theme={theme} />}

      {/* ─── Sticky Search + Sort Header ─── */}
      <div className="sticky top-0 z-20 bg-aurora-surface shadow-sm">

      {/* ─── Search & Ethnicity Filter ─── */}
      <div
        className="relative border-b border-aurora-border z-30"
        style={{
          background: isNeutral
            ? 'linear-gradient(to bottom right, rgba(129,140,248,0.25), rgba(199,210,254,0.4), rgba(110,231,183,0.2))'
            : `linear-gradient(to bottom right, ${theme.colors.primary}20, ${theme.colors.secondary}15, ${theme.colors.accent}12)`,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-muted" />
              <input
                type="text"
                placeholder="Search posts..."
                value={feedSearchQuery}
                onChange={(e) => setFeedSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-aurora-surface border border-aurora-border rounded-full text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all"
              />
              {feedSearchQuery && (
                <button onClick={() => setFeedSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Saved filter */}
            <button
              onClick={() => setShowSavedOnly(!showSavedOnly)}
              className={`p-2.5 rounded-full border transition-all shrink-0 ${
                showSavedOnly
                  ? `text-white ${isNeutral ? 'bg-aurora-indigo border-aurora-indigo' : ''}`
                  : 'bg-aurora-surface border-aurora-border text-aurora-text-muted hover:border-aurora-text-muted/50'
              }`}
              style={showSavedOnly && !isNeutral ? {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              } : undefined}
              title="Saved posts"
            >
              <Bookmark className="w-4 h-4" />
            </button>

            <EthnicityFilterDropdown
              selected={selectedHeritage}
              onChange={setSelectedHeritage}
            />
          </div>
        </div>
      </div>

      </div>{/* end sticky header wrapper */}

      {/* ─── Sort Mode Tabs (scrolls with content) ─── */}
      <div className="bg-aurora-surface/95 backdrop-blur-md border-b border-aurora-border">
        <div className="max-w-6xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            {(['recent', 'popular', 'trending'] as const).map((mode) => {
              const icon = mode === 'recent' ? '🕐' : mode === 'popular' ? '🔥' : '⭐';
              const label = mode.charAt(0).toUpperCase() + mode.slice(1);
              return (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap shrink-0 ${
                    sortMode === mode
                      ? `text-white shadow-md ${isNeutral ? 'bg-gradient-to-r from-indigo-500 via-violet-400 to-emerald-500' : ''}`
                      : 'bg-aurora-surface border border-aurora-border text-aurora-text-secondary hover:text-aurora-text hover:border-aurora-text-muted/30'
                  }`}
                  style={sortMode === mode && !isNeutral ? {
                    background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary}, ${theme.colors.accent})`,
                  } : undefined}
                >
                  {icon} {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Moderation Notification Banners ─── */}
      {showNotifBanner && moderationNotifs.filter((n) => !n.read).length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-3 space-y-2">
          {moderationNotifs.filter((n) => !n.read).map((notif) => (
            <div key={notif.id} className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Moderation Notice</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">{notif.message}</p>
                  {notif.reason && (
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1"><span className="font-medium">Reason:</span> {notif.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => dismissNotification(notif.id)}
                  className="p-1 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors shrink-0"
                  aria-label="Dismiss notification"
                >
                  <X size={14} className="text-amber-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Create Post Composer Card ─── */}
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <div
          className={`rounded-2xl border shadow-aurora-1 p-4 cursor-pointer hover:shadow-aurora-2 transition-all ${isNeutral ? 'bg-aurora-surface border-aurora-border' : 'backdrop-blur-md'}`}
          style={!isNeutral ? {
            backgroundColor: theme.colors.cardBg,
            borderColor: `${theme.colors.cardBorder}30`,
          } : undefined}
          onClick={() => setShowCreateModal(true)}
        >
          <div className="flex items-center gap-3">
            {renderAvatar(userProfile?.avatar || '👤', userProfile?.name || 'You', 'md')}
            <div
              className={`flex-1 px-4 py-2.5 rounded-full text-sm ${isNeutral ? 'bg-aurora-surface-variant text-aurora-text-muted' : ''}`}
              style={!isNeutral ? {
                backgroundColor: `${theme.colors.primary}10`,
                color: theme.colors.textSecondary,
              } : undefined}
            >
              {nativeGreeting} World
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-aurora-border">
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedType('community'); setShowCreateModal(true); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-aurora-text-secondary hover:bg-aurora-surface-variant transition-colors"
            >
              <Globe size={18} className="text-emerald-500" />
              <span className="hidden sm:inline">Connect</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); setTimeout(() => postImageInputRef.current?.click(), 300); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-aurora-text-secondary hover:bg-aurora-surface-variant transition-colors"
            >
              <ImageIcon size={18} className="text-rose-500" />
              <span className="hidden sm:inline">Image</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedType('event'); setShowCreateModal(true); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-aurora-text-secondary hover:bg-aurora-surface-variant transition-colors"
            >
              <Calendar size={18} className="text-amber-500" />
              <span className="hidden sm:inline">Event</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Posts Feed ─── */}
      <div className="max-w-2xl mx-auto px-4 py-3 space-y-3 pb-24">
        {loading ? (
          // Skeleton loaders
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`rounded-2xl border p-4 animate-pulse ${isNeutral ? 'bg-aurora-surface border-aurora-border' : 'backdrop-blur-md'}`}
                style={!isNeutral ? { backgroundColor: theme.colors.cardBg, borderColor: `${theme.colors.cardBorder}30` } : undefined}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full shimmer ring-2 ring-aurora-border/30" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 shimmer rounded w-32" />
                    <div className="h-3 shimmer rounded w-20" />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-3.5 shimmer rounded w-full" />
                  <div className="h-3.5 shimmer rounded w-5/6" />
                  <div className="h-3.5 shimmer rounded w-3/4" />
                </div>
                <div className="h-10 shimmer rounded-xl mb-3" />
                <div className="h-12 shimmer rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-aurora-surface-variant rounded-full flex items-center justify-center">
              <MessageCircle size={28} className="text-aurora-text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-aurora-text mb-1">
              {selectedHeritage.length > 0 || sortMode !== 'recent' || showSavedOnly ? 'No Posts Found' : 'No Posts Yet'}
            </h3>
            <p className="text-sm text-aurora-text-secondary max-w-xs mx-auto">
              {selectedHeritage.length > 0 ? `No posts matching selected ethnicity. ` : ''}
              {sortMode !== 'recent' ? `Try changing the sort mode. ` : ''}
              {selectedHeritage.length === 0 && sortMode === 'recent' && !showSavedOnly ? 'Be the first to share something with the community!' : ''}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className={`mt-4 px-6 py-2.5 text-white rounded-full text-sm font-semibold shadow-aurora-glow hover:shadow-aurora-glow-lg transition-all btn-press ${isNeutral ? 'aurora-gradient' : ''}`}
              style={!isNeutral ? {
                background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})`,
              } : undefined}
            >
              Create a Post
            </button>
          </div>
        ) : (
          filteredPosts.map((post, index) => {
            const typeConfig = getTypeConfig(post.type);
            const userReaction = userReactions.get(post.id);
            const reactionSummary = getReactionSummary(post);
            const isExpanded = expandedPosts.has(post.id);
            const shouldTruncate = post.content.length > 150 && !isExpanded;
            const displayContent = shouldTruncate ? post.content.substring(0, 150) : post.content;
            const isSaved = savedPosts.has(post.id);

            return (
              <div
                key={post.id}
                className={`rounded-2xl border shadow-aurora-1 hover:shadow-aurora-2 transition-all duration-200 cursor-pointer ${menuPostId === post.id ? 'relative z-30' : 'relative z-0'} ${isNeutral ? 'bg-aurora-surface border-aurora-border' : 'backdrop-blur-md'}`}
                style={{
                  animationDelay: `${index * 50}ms`,
                  ...(!isNeutral ? {
                    backgroundColor: `${theme.colors.cardBg}`,
                    borderColor: `${theme.colors.cardBorder}30`,
                  } : {}),
                }}
                onClick={() => openPostDetail(post)}
              >
                {/* ── Post Header ── */}
                <div className="flex items-start justify-between px-4 pt-4 pb-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {renderAvatar(post.userAvatar, post.userName)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <p className="font-semibold text-[15px] text-aurora-text truncate max-w-[120px] sm:max-w-none">{post.userName}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${typeConfig.bg} ${typeConfig.text}`}>
                          {typeConfig.icon}
                          {typeConfig.label}
                        </span>
                      </div>
                      {post.feeling && (
                        <p className="text-aurora-text-muted text-[13px] sm:text-[14px] mt-0.5">
                          feeling {post.feeling.emoji} {post.feeling.label}
                        </p>
                      )}
                      <p className="text-xs text-aurora-text-muted mt-0.5" title={getFullDateTime(post.createdAt)}>
                        {timeAgo(post.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* 3-dot menu */}
                  <div className="relative flex-shrink-0 ml-2" ref={menuPostId === post.id ? menuRef : undefined}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuPostId(menuPostId === post.id ? null : post.id);
                      }}
                      className="p-2 rounded-full hover:bg-aurora-surface-variant text-aurora-text-muted hover:text-aurora-text-secondary transition-colors"
                      aria-label="More options for post"
                    >
                      <MoreHorizontal size={20} />
                    </button>
                    <ClickOutsideOverlay isOpen={menuPostId === post.id} onClose={() => setMenuPostId(null)} />
                    {menuPostId === post.id && (
                      <div className="absolute right-0 top-10 bg-aurora-surface rounded-xl shadow-aurora-3 border border-aurora-border py-1.5 z-50 min-w-[180px]">
                        {(post.userId === user?.uid || userRole === 'admin') && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditPost(post); }}
                              className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-text-secondary hover:bg-aurora-surface-variant transition-colors"
                            >
                              <Edit3 size={16} />
                              Edit Post
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }}
                              className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-danger hover:bg-aurora-danger/10 transition-colors"
                            >
                              <Trash2 size={16} />
                              Delete Post
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openReportModal(post.id); }}
                          className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-text-secondary hover:bg-aurora-surface-variant transition-colors"
                          disabled={reportedPosts.has(post.id)}
                        >
                          <Flag size={16} />
                          {reportedPosts.has(post.id) ? 'Reported' : 'Report Post'}
                        </button>
                        {post.userId !== user?.uid && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openBlockConfirm(post.userId, post.userName); }}
                            className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-aurora-danger hover:bg-aurora-danger/10 transition-colors"
                          >
                            <Ban size={16} />
                            {blockedUsers.has(post.userId) ? 'Blocked' : 'Block User'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Post Content ── */}
                <div className="px-4 pb-3 overflow-hidden">
                  <div className="text-[15px] text-aurora-text leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                    {renderContent(displayContent)}
                    {shouldTruncate && '...'}
                  </div>
                  {post.content.length > 150 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPosts((prev) => {
                          const next = new Set(prev);
                          if (next.has(post.id)) {
                            next.delete(post.id);
                          } else {
                            next.add(post.id);
                          }
                          return next;
                        });
                      }}
                      className="text-aurora-indigo text-[14px] font-semibold mt-1 hover:underline transition-all duration-300"
                    >
                      {isExpanded ? 'See less' : 'See more'}
                    </button>
                  )}
                </div>

                {/* ── Post Images ── */}
                {post.images && post.images.length > 0 && (
                  <div className="px-4 pb-3">
                    {post.images.length === 1 ? (
                      /* Single image — show full image without cropping */
                      <div
                        className="rounded-xl overflow-hidden flex items-center justify-center"
                        style={{
                          maxHeight: '520px',
                          backgroundColor: !isNeutral ? `${theme.colors.primary}15` : 'var(--color-aurora-surface-variant)'
                        }}
                      >
                        <img
                          src={post.images[0]}
                          alt=""
                          className="w-full h-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
                          style={{ maxHeight: '520px' }}
                          onClick={(e) => { e.stopPropagation(); setLightboxImage(post.images![0]); }}
                        />
                      </div>
                    ) : post.images.length === 2 ? (
                      /* Two images — side by side with 4:5 aspect ratio (portrait-friendly) */
                      <div className="grid grid-cols-2 gap-1.5">
                        {post.images.map((img, idx) => (
                          <div key={idx} className="rounded-xl overflow-hidden bg-aurora-surface-variant">
                            <img
                              src={img}
                              alt=""
                              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                              style={{ aspectRatio: '4/5', minHeight: '180px' }}
                              onClick={(e) => { e.stopPropagation(); setLightboxImage(img); }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : post.images.length === 3 ? (
                      /* Three images — first large on left, two stacked on right */
                      <div className="grid grid-cols-2 gap-1.5" style={{ height: '360px' }}>
                        <div className="rounded-xl overflow-hidden bg-aurora-surface-variant row-span-2">
                          <img
                            src={post.images[0]}
                            alt=""
                            className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setLightboxImage(post.images![0]); }}
                          />
                        </div>
                        {post.images.slice(1).map((img, idx) => (
                          <div key={idx} className="rounded-xl overflow-hidden bg-aurora-surface-variant">
                            <img
                              src={img}
                              alt=""
                              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); setLightboxImage(img); }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Four images — 2x2 grid with 4:3 aspect ratio */
                      <div className="grid grid-cols-2 gap-1.5">
                        {post.images.map((img, idx) => (
                          <div key={idx} className="rounded-xl overflow-hidden bg-aurora-surface-variant">
                            <img
                              src={img}
                              alt=""
                              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                              style={{ aspectRatio: '4/3' }}
                              onClick={(e) => { e.stopPropagation(); setLightboxImage(img); }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Reaction Summary ── */}
                {reactionSummary && (
                  <div className="px-4 pb-2 flex items-center justify-between text-xs text-aurora-text-muted">
                    <div className="flex items-center gap-1.5">
                      <span>{reactionSummary.emojis}</span>
                      <span>{reactionSummary.count}</span>
                    </div>
                    {post.comments > 0 && (
                      <span className="hover:underline cursor-pointer">
                        {post.comments} {post.comments === 1 ? 'comment' : 'comments'}
                      </span>
                    )}
                  </div>
                )}

                {/* ── Legacy Engagement Summary (for backward compat) ── */}
                {!reactionSummary && (post.likes > 0 || post.comments > 0) && (
                  <div className="px-4 pb-2 flex items-center justify-between text-xs text-aurora-text-muted">
                    {post.likes > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-aurora-indigo text-white text-[10px]">
                          <ThumbsUp size={10} />
                        </span>
                        <span>{post.likes}</span>
                      </div>
                    )}
                    {post.comments > 0 && (
                      <span className="hover:underline cursor-pointer">
                        {post.comments} {post.comments === 1 ? 'comment' : 'comments'}
                      </span>
                    )}
                  </div>
                )}

                {/* ── Engagement Action Bar ── */}
                <div className="mx-4 border-t border-aurora-border">
                  <div className="flex items-center relative">
                    {/* Reaction Bar (Floating) */}
                    <ClickOutsideOverlay isOpen={showReactionBar === post.id} onClose={() => setShowReactionBar(null)} />
                    {showReactionBar === post.id && (
                      <div
                        ref={reactionBarRef}
                        className="absolute bottom-14 left-0 right-0 sm:right-auto bg-aurora-surface border border-aurora-border rounded-full shadow-aurora-3 px-2 sm:px-3 py-2 flex justify-center sm:justify-start gap-1 sm:gap-2 z-50 animate-reactionPop"
                        onMouseLeave={() => setShowReactionBar(null)}
                      >
                        {REACTIONS.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReaction(post.id, r.emoji);
                            }}
                            className="text-2xl hover:scale-[1.4] active:scale-[1.4] transition-transform duration-150 p-1"
                            title={r.label}
                            aria-label={`React with ${r.label}`}
                          >
                            {r.emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Like/Reaction Button */}
                    <button
                      onMouseEnter={() => setShowReactionBar(post.id)}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        longPressTimerRef.current = setTimeout(() => {
                          setShowReactionBar(post.id);
                        }, 400);
                      }}
                      onTouchEnd={() => {
                        if (longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                      }}
                      onTouchMove={() => {
                        if (longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (showReactionBar === post.id) return;
                        // Always use reactions system — default to 👍
                        handleReaction(post.id, userReaction || '👍');
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all duration-200 hover:bg-aurora-surface-variant rounded-xl my-0.5 ${
                        userReaction ? 'text-aurora-indigo' : 'text-aurora-text-secondary'
                      }`}
                    >
                      {userReaction ? (
                        <>
                          <span className="text-xl">{userReaction}</span>
                          <span className="hidden sm:inline">Like</span>
                        </>
                      ) : (
                        <>
                          <ThumbsUp size={20} />
                          <span className="hidden sm:inline">Like</span>
                        </>
                      )}
                    </button>

                    {/* Comment Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openPostDetail(post); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-aurora-text-secondary hover:bg-aurora-surface-variant rounded-xl my-0.5 transition-colors"
                      aria-label="View comments"
                    >
                      <MessageCircle size={20} />
                      <span className="hidden sm:inline">Comment</span>
                    </button>

                    {/* Bookmark Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBookmark(post.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-aurora-text-secondary hover:bg-aurora-surface-variant rounded-xl my-0.5 transition-colors"
                      aria-label={isSaved ? 'Remove from saved' : 'Save post'}
                    >
                      <Bookmark
                        size={20}
                        fill={isSaved ? 'currentColor' : 'none'}
                        className={isSaved ? 'text-aurora-indigo' : ''}
                      />
                      <span className="hidden sm:inline">Save</span>
                    </button>

                    {/* Share Button */}
                    <button
                      onClick={(e) => handleShare(e, post)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-aurora-text-secondary hover:bg-aurora-surface-variant rounded-xl my-0.5 transition-colors"
                      aria-label="Share post"
                    >
                      <Share2 size={20} />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Infinite scroll sentinel */}
        {!loading && filteredPosts.length > 0 && (
          <div ref={sentinelRef} className="h-4">
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-aurora-indigo border-t-transparent"></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Toast Notification ─── */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-aurora-surface border border-aurora-border rounded-full px-6 py-3 shadow-aurora-3 text-sm font-medium text-aurora-text z-20 animate-fade-in-out">
          {toastMessage}
        </div>
      )}

      {/* ─── Floating Action Button ─── */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 aurora-gradient text-white rounded-full shadow-aurora-glow-lg flex items-center justify-center hover:shadow-aurora-4 transition-all z-10 btn-press"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* ═══════════════════════════════════════════════════════════════════
          CREATE POST MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-aurora-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-aurora-4 max-h-[90vh] overflow-y-auto border border-aurora-border" role="dialog" aria-modal="true" aria-labelledby="create-post-title">
            {/* Header */}
            <div className="sticky top-0 bg-aurora-surface border-b border-aurora-border px-5 py-4 flex items-center justify-between z-10 sm:rounded-t-2xl">
              <h2 id="create-post-title" className="text-lg font-bold text-aurora-text">{editingPost ? 'Edit Post' : 'Create Post'}</h2>
              <button
                onClick={() => { setShowCreateModal(false); setEditingPost(null); setPostContent(''); setSelectedFeeling(null); setPostImages([]); }}
                className="p-2 rounded-full hover:bg-aurora-surface-variant transition-colors"
                disabled={submitting}
                aria-label="Close create post modal"
              >
                <X size={20} className="text-aurora-text-muted" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Author row */}
              <div className="flex items-center gap-3">
                {renderAvatar(userProfile?.avatar || '👤', userProfile?.name || 'You', 'lg')}
                <div>
                  <p className="font-semibold text-aurora-text">{userProfile?.name || 'You'}</p>
                  {selectedFeeling && (
                    <p className="text-sm text-aurora-text-muted mt-1">
                      — feeling {selectedFeeling.emoji} {selectedFeeling.label}
                      <button
                        onClick={() => setSelectedFeeling(null)}
                        className="ml-2 text-aurora-text-muted hover:text-aurora-text transition-colors"
                      >
                        ✕
                      </button>
                    </p>
                  )}
                  {!selectedFeeling && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Globe size={12} className="text-aurora-text-muted" />
                      <span className="text-xs text-aurora-text-muted">Public</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Post type selector */}
              <div>
                <label className="block text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Post Type</label>
                <div className="flex gap-2">
                  {(['community', 'event'] as const).map((type) => {
                    const cfg = getTypeConfig(type);
                    const isActive = selectedType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        disabled={submitting}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border ${
                          isActive
                            ? `border-transparent text-white shadow-aurora-1`
                            : 'border-aurora-border text-aurora-text-secondary hover:bg-aurora-surface-variant'
                        }`}
                        style={isActive ? { backgroundColor: cfg.color } : undefined}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content textarea */}
              <div>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder={`${nativeGreeting} World`}
                  maxLength={500}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-transparent text-aurora-text placeholder:text-aurora-text-muted text-[15px] leading-relaxed resize-none focus:outline-none min-h-[120px]"
                  rows={4}
                  autoFocus
                />
                <div className="flex items-center justify-between px-1">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowFeelingPicker(!showFeelingPicker)}
                      className="p-2 rounded-full hover:bg-aurora-surface-variant transition-colors"
                      title="Add a feeling"
                      aria-label="Add a feeling"
                    >
                      <Smile size={20} className="text-amber-500" />
                    </button>
                    <button
                      onClick={() => postImageInputRef.current?.click()}
                      className="p-2 rounded-full hover:bg-aurora-surface-variant transition-colors"
                      title="Add photos (max 4)"
                      aria-label="Add photos"
                      disabled={postImages.length >= 4 || submitting}
                    >
                      <Camera size={20} className={postImages.length >= 4 ? 'text-aurora-text-muted opacity-40' : 'text-aurora-indigo'} />
                    </button>
                    <input
                      ref={postImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePostImageSelect}
                    />
                  </div>
                  <span className={`text-xs font-medium ${postContent.length > 450 ? 'text-aurora-danger' : 'text-aurora-text-muted'}`}>
                    {postContent.length}/500
                  </span>
                </div>
              </div>

              {/* Photo previews */}
              {postImages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Photos</span>
                    <span className="text-xs text-aurora-text-muted">{postImages.length}/4</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {postImages.map((img, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square bg-aurora-surface-variant">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setPostImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                          aria-label="Remove photo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {postImages.length < 4 && (
                      <button
                        onClick={() => postImageInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-aurora-border flex flex-col items-center justify-center gap-1 hover:border-aurora-indigo hover:bg-aurora-surface-variant/50 transition-colors"
                      >
                        <Camera size={20} className="text-aurora-text-muted" />
                        <span className="text-[11px] text-aurora-text-muted">Add More</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Feeling picker */}
              {showFeelingPicker && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3 bg-aurora-surface-variant rounded-xl">
                  {FEELINGS.map((feeling) => (
                    <button
                      key={feeling.emoji}
                      onClick={() => {
                        setSelectedFeeling(feeling);
                        setShowFeelingPicker(false);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all ${
                        selectedFeeling?.emoji === feeling.emoji
                          ? 'bg-aurora-indigo/20 border border-aurora-indigo'
                          : 'hover:bg-aurora-surface-variant/50 border border-transparent'
                      }`}
                      title={feeling.label}
                    >
                      <span className="text-2xl">{feeling.emoji}</span>
                      <span className="text-[11px] text-aurora-text-muted mt-1">{feeling.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Post button */}
              <button
                onClick={editingPost ? handleUpdatePost : handleCreatePost}
                disabled={(!postContent.trim() && postImages.length === 0) || submitting}
                className="w-full py-3 aurora-gradient text-white rounded-xl font-semibold text-base shadow-aurora-glow hover:shadow-aurora-glow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all btn-press"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {editingPost ? 'Updating...' : 'Posting...'}
                  </span>
                ) : editingPost ? 'Save Changes' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          POST DETAIL / COMMENTS MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-aurora-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-aurora-4 max-h-[90vh] flex flex-col border border-aurora-border" role="dialog" aria-modal="true" aria-labelledby="post-detail-title">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-aurora-border flex-shrink-0">
              <h2 id="post-detail-title" className="text-lg font-bold text-aurora-text">{selectedPost.userName}'s Post</h2>
              <button
                onClick={() => { setSelectedPost(null); setComments([]); }}
                className="p-2 rounded-full hover:bg-aurora-surface-variant transition-colors"
                aria-label="Close post detail modal"
              >
                <X size={20} className="text-aurora-text-muted" />
              </button>
            </div>

            {/* Post content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  {renderAvatar(selectedPost.userAvatar, selectedPost.userName)}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[15px] text-aurora-text">{selectedPost.userName}</p>
                      {selectedPost.feeling && (
                        <span className="text-aurora-text-muted text-[14px]">
                          — feeling {selectedPost.feeling.emoji} {selectedPost.feeling.label}
                        </span>
                      )}
                      {(() => {
                        const cfg = getTypeConfig(selectedPost.type);
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-aurora-text-muted mt-0.5" title={getFullDateTime(selectedPost.createdAt)}>
                      {timeAgo(selectedPost.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="text-[15px] text-aurora-text leading-relaxed whitespace-pre-wrap">
                  {renderContent(selectedPost.content)}
                </div>

                {/* Post images in detail */}
                {selectedPost.images && selectedPost.images.length > 0 && (
                  <div className="mt-3">
                    {selectedPost.images.length === 1 ? (
                      <div
                        className="rounded-xl overflow-hidden flex items-center justify-center"
                        style={{
                          maxHeight: '520px',
                          backgroundColor: !isNeutral ? `${theme.colors.primary}15` : 'var(--color-aurora-surface-variant)'
                        }}
                      >
                        <img
                          src={selectedPost.images[0]}
                          alt=""
                          className="w-full h-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
                          style={{ maxHeight: '520px' }}
                          onClick={() => setLightboxImage(selectedPost.images![0])}
                        />
                      </div>
                    ) : selectedPost.images.length === 2 ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        {selectedPost.images.map((img, idx) => (
                          <div key={idx} className="rounded-xl overflow-hidden bg-aurora-surface-variant">
                            <img src={img} alt="" className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity" style={{ aspectRatio: '4/5', minHeight: '180px' }} onClick={() => setLightboxImage(img)} />
                          </div>
                        ))}
                      </div>
                    ) : selectedPost.images.length === 3 ? (
                      <div className="grid grid-cols-2 gap-1.5" style={{ height: '380px' }}>
                        <div className="rounded-xl overflow-hidden bg-aurora-surface-variant row-span-2">
                          <img src={selectedPost.images[0]} alt="" className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity" onClick={() => setLightboxImage(selectedPost.images![0])} />
                        </div>
                        {selectedPost.images.slice(1).map((img, idx) => (
                          <div key={idx} className="rounded-xl overflow-hidden bg-aurora-surface-variant">
                            <img src={img} alt="" className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity" onClick={() => setLightboxImage(img)} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {selectedPost.images.map((img, idx) => (
                          <div key={idx} className="rounded-xl overflow-hidden bg-aurora-surface-variant">
                            <img src={img} alt="" className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity" style={{ aspectRatio: '4/3' }} onClick={() => setLightboxImage(img)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Reaction summary in detail */}
                {(() => {
                  const summary = getReactionSummary(selectedPost);
                  return summary ? (
                    <div className="flex items-center gap-1.5 pt-3 mt-3 text-xs text-aurora-text-muted">
                      <span>{summary.emojis}</span>
                      <span>{summary.count}</span>
                    </div>
                  ) : null;
                })()}

                {/* Action bar in detail */}
                <div className="flex items-center relative pt-2 mt-2 border-t border-aurora-border">
                  {/* Floating Reaction Bar */}
                  <ClickOutsideOverlay isOpen={showDetailReactionBar} onClose={() => setShowDetailReactionBar(false)} />
                  {showDetailReactionBar && (
                    <div
                      ref={detailReactionBarRef}
                      className="absolute bottom-14 left-0 right-0 sm:right-auto bg-aurora-surface border border-aurora-border rounded-full shadow-aurora-3 px-2 sm:px-3 py-2 flex justify-center sm:justify-start gap-1 sm:gap-2 z-50 animate-reactionPop"
                      onMouseLeave={() => setShowDetailReactionBar(false)}
                    >
                      {REACTIONS.map((r) => (
                        <button
                          key={r.emoji}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReaction(selectedPost.id, r.emoji);
                            setShowDetailReactionBar(false);
                          }}
                          className="text-2xl hover:scale-[1.4] active:scale-[1.4] transition-transform duration-150 p-1"
                          title={r.label}
                          aria-label={`React with ${r.label}`}
                        >
                          {r.emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Like/Reaction Button */}
                  <button
                    onMouseEnter={() => setShowDetailReactionBar(true)}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      longPressTimerRef.current = setTimeout(() => {
                        setShowDetailReactionBar(true);
                      }, 400);
                    }}
                    onTouchEnd={() => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    }}
                    onTouchMove={() => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (showDetailReactionBar) return;
                      handleReaction(selectedPost.id, userReactions.get(selectedPost.id) || '👍');
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-aurora-surface-variant rounded-xl ${
                      userReactions.has(selectedPost.id) ? 'text-aurora-indigo' : 'text-aurora-text-secondary'
                    }`}
                  >
                    {userReactions.get(selectedPost.id) ? (
                      <span className="text-xl">{userReactions.get(selectedPost.id)}</span>
                    ) : (
                      <ThumbsUp size={18} />
                    )}
                    <span className="hidden sm:inline">Like</span>
                  </button>

                  {/* Save Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBookmark(selectedPost.id);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-aurora-surface-variant rounded-xl ${
                      savedPosts.has(selectedPost.id) ? 'text-aurora-indigo' : 'text-aurora-text-secondary'
                    }`}
                    aria-label={savedPosts.has(selectedPost.id) ? 'Remove from saved' : 'Save post'}
                  >
                    <Bookmark size={18} fill={savedPosts.has(selectedPost.id) ? 'currentColor' : 'none'} />
                    <span className="hidden sm:inline">Save</span>
                  </button>

                  {/* Share Button */}
                  <button
                    onClick={(e) => handleShare(e, selectedPost)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-aurora-text-secondary hover:bg-aurora-surface-variant rounded-xl transition-colors"
                    aria-label="Share post"
                  >
                    <Share2 size={18} />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                </div>
              </div>

              {/* Comments section */}
              <div className="border-t border-aurora-border px-5 py-4">
                <h3 className="text-sm font-bold text-aurora-text mb-4">
                  Comments ({comments.length})
                </h3>
                {loadingComments ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-aurora-indigo border-t-transparent"></div>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-6">
                    <MessageCircle size={24} className="mx-auto text-aurora-text-muted mb-2" />
                    <p className="text-sm text-aurora-text-muted">No comments yet. Be the first!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.filter((comment) => !blockedUsers.has(comment.userId)).map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        {renderAvatar(comment.userAvatar, comment.userName, 'sm')}
                        <div className="flex-1">
                          <div className="bg-aurora-surface-variant rounded-2xl rounded-tl-md px-4 py-2.5">
                            <p className="text-[13px] font-semibold text-aurora-text">{comment.userName}</p>
                            {editingCommentId === comment.id ? (
                              <div className="mt-1">
                                <textarea
                                  value={editCommentText}
                                  onChange={(e) => setEditCommentText(e.target.value)}
                                  className="w-full text-[14px] text-aurora-text-secondary bg-white border border-aurora-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-aurora-indigo"
                                  rows={2}
                                  autoFocus
                                />
                                <div className="flex gap-2 mt-1.5">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleUpdateComment(); }}
                                    disabled={!editCommentText.trim()}
                                    className="text-[11px] font-semibold text-white bg-aurora-indigo rounded-full px-3 py-1 hover:opacity-90 transition-opacity disabled:opacity-40"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); cancelEditComment(); }}
                                    className="text-[11px] font-semibold text-aurora-text-muted hover:text-aurora-text transition-colors px-2 py-1"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : comment.text ? (
                              <p className="text-[14px] text-aurora-text-secondary mt-0.5 leading-relaxed">{comment.text}</p>
                            ) : null}
                            {comment.image && (
                              <div className="mt-2 rounded-lg overflow-hidden max-w-[200px] relative group/img">
                                <img src={comment.image} alt="" className="w-full h-auto object-cover rounded-lg" />
                                {(comment.userId === user?.uid || userRole === 'admin') && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemoveCommentImage(comment.id); }}
                                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors opacity-0 group-hover/img:opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100"
                                    style={{ opacity: 1 }}
                                    aria-label="Remove image"
                                    title="Remove image"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 ml-3">
                            <span className="text-[11px] text-aurora-text-muted" title={getFullDateTime(comment.createdAt)}>
                              {timeAgo(comment.createdAt)}
                            </span>
                            <button
                              onClick={() => handleCommentLike(comment.id)}
                              className={`text-[11px] font-semibold transition-colors ${
                                comment.likedBy?.includes(user?.uid || '') ? 'text-aurora-indigo' : 'text-aurora-text-muted hover:text-aurora-indigo'
                              }`}
                            >
                              {comment.likedBy?.includes(user?.uid || '') ? '♥ ' : ''}Like{comment.likes ? ` · ${comment.likes}` : ''}
                            </button>
                            {(comment.userId === user?.uid || userRole === 'admin') && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); startEditComment(comment); }}
                                  className="text-[11px] font-semibold text-aurora-text-muted hover:text-aurora-indigo transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteComment(comment.id); }}
                                  className="text-[11px] font-semibold text-aurora-text-muted hover:text-aurora-danger transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add comment input — pinned at bottom */}
            <div className="border-t border-aurora-border flex-shrink-0 bg-aurora-surface sm:rounded-b-2xl">
              {/* Comment image preview */}
              {commentImage && (
                <div className="px-4 pt-3 pb-1">
                  <div className="relative inline-block">
                    <img src={commentImage} alt="" className="h-16 w-16 object-cover rounded-lg border border-aurora-border" />
                    <button
                      onClick={() => setCommentImage(null)}
                      className="absolute -top-1.5 -right-1.5 p-0.5 bg-aurora-danger rounded-full text-white"
                      aria-label="Remove image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
              <div className="px-4 py-3 flex items-center gap-3">
                {renderAvatar(userProfile?.avatar || '👤', userProfile?.name || 'You', 'sm')}
                <div className="flex-1 flex items-center gap-2 bg-aurora-surface-variant rounded-full px-4 py-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    placeholder="Write a comment..."
                    className="flex-1 bg-transparent text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none"
                    disabled={submittingComment}
                  />
                  <button
                    onClick={() => commentImageInputRef.current?.click()}
                    className="p-1 text-aurora-text-muted hover:text-aurora-indigo transition-colors"
                    title="Add image"
                    aria-label="Add image to comment"
                  >
                    <Camera size={16} />
                  </button>
                  <input
                    ref={commentImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCommentImageSelect}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={(!newComment.trim() && !commentImage) || submittingComment}
                    className="p-1.5 text-aurora-indigo disabled:text-aurora-text-muted disabled:opacity-50 transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          REPORT MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-aurora-surface rounded-2xl shadow-aurora-4 w-full max-w-md border border-aurora-border overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
            {/* Header */}
            <div className="px-5 py-4 border-b border-aurora-border bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 id="report-modal-title" className="text-lg font-bold text-aurora-text flex items-center gap-2">
                    <Flag size={18} className="text-red-500" />
                    Report Post
                  </h3>
                  <p className="text-sm text-aurora-text-muted mt-0.5">Select a category that best describes the issue</p>
                </div>
                <button onClick={() => setShowReportModal(false)} className="p-1.5 rounded-full hover:bg-aurora-surface-variant transition-colors">
                  <X size={18} className="text-aurora-text-muted" />
                </button>
              </div>
            </div>

            {/* Categories */}
            <div className="px-5 py-3 space-y-2 max-h-[40vh] overflow-y-auto">
              {REPORT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setReportReason(cat.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                    reportReason === cat.id
                      ? 'border-red-400 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-300'
                      : 'border-aurora-border hover:border-aurora-border-glass hover:bg-aurora-surface-variant'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg shrink-0">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${reportReason === cat.id ? 'text-red-700 dark:text-red-400' : 'text-aurora-text'}`}>
                        {cat.label}
                      </p>
                      <p className="text-xs text-aurora-text-muted mt-0.5 leading-relaxed">{cat.description}</p>
                    </div>
                    {reportReason === cat.id && (
                      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Optional Details */}
            {reportReason && (
              <div className="px-5 py-3 border-t border-aurora-border/50">
                <label className="text-xs font-semibold text-aurora-text-secondary uppercase tracking-wider">Additional Details (Optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide more context about why you're reporting this post..."
                  maxLength={500}
                  rows={3}
                  className="mt-1.5 w-full px-3 py-2.5 bg-aurora-surface-variant border border-aurora-border rounded-xl text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-red-300/50 resize-none"
                />
                <p className="text-[10px] text-aurora-text-muted text-right mt-1">{reportDetails.length}/500</p>
              </div>
            )}

            {/* Actions */}
            <div className="px-5 py-4 border-t border-aurora-border flex gap-3">
              <button
                onClick={() => { setShowReportModal(false); setReportReason(''); setReportDetails(''); }}
                className="flex-1 py-2.5 rounded-xl border border-aurora-border text-aurora-text-secondary font-medium hover:bg-aurora-surface-variant transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={!reportReason || reportSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition-colors btn-press flex items-center justify-center gap-2"
              >
                {reportSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                ) : (
                  <><Flag size={14} /> Submit Report</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-aurora-surface rounded-2xl shadow-aurora-4 border border-aurora-border max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-aurora-text mb-2">Delete Post?</h3>
            <p className="text-sm text-aurora-text-muted mb-6">This action cannot be undone. The post and all its comments will be permanently removed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePostId(null); }}
                className="flex-1 py-2.5 rounded-xl border border-aurora-border text-aurora-text-secondary font-medium hover:bg-aurora-surface-variant transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePost}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          BLOCK USER CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {showBlockConfirm && blockTargetUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-aurora-surface rounded-2xl shadow-aurora-4 border border-aurora-border max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <Ban size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-aurora-text mb-2">Block {blockTargetUser.name}?</h3>
            <p className="text-sm text-aurora-text-muted mb-6">
              They won't be notified. Their posts and comments will be hidden from your feed. You can unblock them anytime from Settings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowBlockConfirm(false); setBlockTargetUser(null); }}
                className="flex-1 py-2.5 rounded-xl border border-aurora-border text-aurora-text-secondary font-medium hover:bg-aurora-surface-variant transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockUser}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          LIGHTBOX IMAGE VIEWER
          ═══════════════════════════════════════════════════════════════════ */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col"
          style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}
          onClick={() => setLightboxImage(null)}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4">
              <button
                onClick={downloadLightboxImage}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Download image"
              >
                <Download size={22} className="text-white" />
              </button>
              <button
                onClick={shareLightboxImage}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Share image"
              >
                <Share2 size={22} className="text-white" />
              </button>
            </div>
            <button
              onClick={() => setLightboxImage(null)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close lightbox"
            >
              <X size={24} className="text-white" />
            </button>
          </div>

          {/* Centered image */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0" onClick={() => setLightboxImage(null)}>
            <img
              src={lightboxImage}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
