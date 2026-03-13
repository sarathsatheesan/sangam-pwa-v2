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
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ClickOutsideOverlay } from '../../components/ClickOutsideOverlay';
import { ETHNICITY_HIERARCHY, ETHNICITY_CHILDREN, HERITAGE_OPTIONS, PRIORITY_ETHNICITIES } from '../../constants/config';
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


const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or hate speech',
  'Violence or dangerous content',
  'Inappropriate or adult content',
  'False information',
  'Other',
];

export default function FeedPage() {
  const { user, userProfile, userRole } = useAuth();
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
  // animatingLike removed — reactions system handles animation

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
  const [reportedPosts, setReportedPosts] = useState<Set<string>>(new Set());
  const [reportSubmitting, setReportSubmitting] = useState(false);

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
        const post = { id: docSnapshot.id, ...docSnapshot.data() } as Post;
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
          const post = { id: docSnapshot.id, ...docSnapshot.data() } as Post;
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
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReason || !reportPostId || !user) return;
    try {
      setReportSubmitting(true);
      const reportedPost = posts.find((p) => p.id === reportPostId);

      // Write to reports collection for record-keeping
      await addDoc(collection(db, 'reports'), {
        postId: reportPostId,
        reportedBy: user.uid,
        reason: reportReason,
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      // Write to moderationQueue so it appears in Admin panel
      await addDoc(collection(db, 'moderationQueue'), {
        type: 'post',
        content: reportedPost?.content || '',
        contentId: reportPostId,
        collection: 'posts',
        authorId: reportedPost?.userId || '',
        authorName: reportedPost?.userName || 'Unknown',
        reason: reportReason,
        reportedBy: user.uid,
        createdAt: serverTimestamp(),
      });

      setReportedPosts((prev) => new Set(prev).add(reportPostId));
      setShowReportModal(false);
      alert('Report submitted. Thank you for helping keep the community safe.');
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  // ─── Filter & Sort ────────────────────────────────────────────────────────

  const filteredPosts = useMemo(() => {
    let result = posts.filter((post) => {
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
  }, [posts, selectedHeritage, sortMode, savedPosts, feedSearchQuery, showSavedOnly]);

  // ─── Helpers ──────────────────────────────────────────────────────

  const renderAvatar = (avatar: string, name: string, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-lg', lg: 'w-12 h-12 text-xl' };
    if (avatar && avatar.startsWith('http')) {
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
    <div className="bg-gradient-to-b from-indigo-100/50 via-indigo-50/30 to-emerald-100/40">

      {/* ─── Search & Ethnicity Filter ─── */}
      <div className="relative bg-gradient-to-br from-indigo-400/25 via-indigo-100/40 to-emerald-400/20 border-b border-aurora-border z-30">
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
                  ? 'bg-aurora-indigo text-white border-aurora-indigo'
                  : 'bg-aurora-surface border-aurora-border text-aurora-text-muted hover:border-aurora-text-muted/50'
              }`}
              title="Saved posts"
            >
              <Bookmark className="w-4 h-4" />
            </button>

            {/* Ethnicity Dropdown - Multi-select with checkboxes */}
            <div className="relative shrink-0" ref={heritageRef}>
              <button
                onClick={() => setHeritageDropdownOpen(!heritageDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full text-sm font-medium transition-all border ${
                  heritageDisplayCount > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-aurora-surface border-aurora-border text-aurora-text-secondary hover:border-aurora-text-muted/50'
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

      {/* ─── Sort Mode Tabs ─── */}
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
                      ? 'bg-gradient-to-r from-indigo-500 via-violet-400 to-emerald-500 text-white shadow-md'
                      : 'bg-aurora-surface border border-aurora-border text-aurora-text-secondary hover:text-aurora-text hover:border-aurora-text-muted/30'
                  }`}
                >
                  {icon} {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Create Post Composer Card ─── */}
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <div
          className="bg-aurora-surface rounded-2xl border border-aurora-border shadow-aurora-1 p-4 cursor-pointer hover:shadow-aurora-2 transition-all"
          onClick={() => setShowCreateModal(true)}
        >
          <div className="flex items-center gap-3">
            {renderAvatar(userProfile?.avatar || '👤', userProfile?.name || 'You', 'md')}
            <div className="flex-1 px-4 py-2.5 bg-aurora-surface-variant rounded-full text-aurora-text-muted text-sm">
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
              <div key={i} className="bg-aurora-surface rounded-2xl border border-aurora-border p-4 animate-pulse">
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
              className="mt-4 px-6 py-2.5 aurora-gradient text-white rounded-full text-sm font-semibold shadow-aurora-glow hover:shadow-aurora-glow-lg transition-all btn-press"
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
                className={`bg-aurora-surface rounded-2xl border border-aurora-border shadow-aurora-1 hover:shadow-aurora-2 transition-all duration-200 cursor-pointer ${menuPostId === post.id ? 'relative z-30' : 'relative z-0'}`}
                style={{ animationDelay: `${index * 50}ms` }}
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
                  <div className={`px-4 pb-3 ${
                    post.images.length === 1 ? '' :
                    'grid gap-1 ' + (post.images.length === 2 ? 'grid-cols-2' :
                    post.images.length === 3 ? 'grid-cols-2' : 'grid-cols-2')
                  }`}>
                    {post.images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl overflow-hidden bg-aurora-surface-variant ${
                          post.images!.length === 1 ? 'max-h-80' :
                          post.images!.length === 3 && idx === 0 ? 'row-span-2' : ''
                        }`}
                      >
                        <img
                          src={img}
                          alt=""
                          className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                          style={post.images!.length === 1 ? { maxHeight: '320px' } : { aspectRatio: post.images!.length === 3 && idx === 0 ? '1/2' : '1/1' }}
                          onClick={() => openPostDetail(post)}
                        />
                      </div>
                    ))}
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
                  <div className={`mt-3 ${
                    selectedPost.images.length === 1 ? '' :
                    'grid gap-1.5 ' + (selectedPost.images.length === 2 ? 'grid-cols-2' :
                    selectedPost.images.length === 3 ? 'grid-cols-2' : 'grid-cols-2')
                  }`}>
                    {selectedPost.images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl overflow-hidden bg-aurora-surface-variant ${
                          selectedPost.images!.length === 1 ? '' :
                          selectedPost.images!.length === 3 && idx === 0 ? 'row-span-2' : ''
                        }`}
                      >
                        <img
                          src={img}
                          alt=""
                          className="w-full h-full object-cover"
                          style={selectedPost.images!.length === 1 ? { maxHeight: '400px', width: '100%' } : { aspectRatio: selectedPost.images!.length === 3 && idx === 0 ? '1/2' : '1/1' }}
                        />
                      </div>
                    ))}
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
                    {comments.map((comment) => (
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
          <div className="bg-aurora-surface rounded-2xl shadow-aurora-4 w-full max-w-sm border border-aurora-border overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
            <div className="px-5 py-4 border-b border-aurora-border">
              <h3 id="report-modal-title" className="text-lg font-bold text-aurora-text">Report Post</h3>
              <p className="text-sm text-aurora-text-muted mt-1">Why are you reporting this post?</p>
            </div>
            <div className="px-5 py-3 space-y-2 max-h-[50vh] overflow-y-auto">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${
                    reportReason === reason
                      ? 'border-aurora-indigo bg-aurora-indigo/10 text-aurora-indigo font-medium'
                      : 'border-aurora-border text-aurora-text-secondary hover:border-aurora-border-glass hover:bg-aurora-surface-variant'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-aurora-border flex gap-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-aurora-border text-aurora-text-secondary font-medium hover:bg-aurora-surface-variant transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={!reportReason || reportSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-aurora-danger text-white font-medium hover:bg-red-500 disabled:opacity-50 transition-colors btn-press"
              >
                {reportSubmitting ? 'Submitting...' : 'Report'}
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
    </div>
  );
}
