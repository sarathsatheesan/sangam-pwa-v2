'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { db, auth } from '@/services/firebase';
import { doc, updateDoc, getDoc, arrayRemove, collection, query, where, getDocs, limit, documentId } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { downloadMyData, deleteMyData } from '@/services/dataPrivacy';
import { pullSavedItems } from '@/services/savedItems';
import { AVATAR_OPTIONS, BUSINESS_TYPES } from '@/constants/config';
import { compressProfileImage } from '@/utils/profileImage';
import CountryEthnicitySelector from '@/components/CountryEthnicitySelector';
import { validateMerchantTIN } from '@/services/merchantValidation';
import {
  Edit3, Settings, Grid3X3, Bookmark, Heart, MessageSquare,
  MapPin, Briefcase, Calendar, Users, ChevronRight, Shield,
  Download, Trash2, LogOut, Lock, Eye, EyeOff, Phone,
  Mail, X, Check, Loader2, MoreHorizontal, Share2,
  Star, TrendingUp, Award, Globe, Hash, Building2,
  Camera, Link2, ChevronDown, UserPlus, Send, Sparkles, Plus,
  Tag, Home, Store, ShoppingBag, CalendarDays, Package, Ban, UserX
} from 'lucide-react';

/* ─── constants ─── */
const INTEREST_OPTIONS = ['Cooking', 'Technology', 'Travel', 'Sports', 'Music', 'Art', 'Reading', 'Fitness', 'Photography', 'Gaming', 'Fashion', 'Business', 'Education', 'Spirituality', 'Movies', 'Volunteering'];
const PRIVACY_OPTIONS = ['Everyone', 'Connections Only', 'Nobody'];

const INTEREST_ICONS: Record<string, string> = {
  Cooking: '🍳', Technology: '💻', Travel: '✈️', Sports: '⚽', Music: '🎵',
  Art: '🎨', Reading: '📚', Fitness: '💪', Photography: '📷', Gaming: '🎮',
  Fashion: '👗', Business: '💼', Education: '🎓', Spirituality: '🕉️',
  Movies: '🎬', Volunteering: '🤝',
};

const GRADIENT_SETS = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-fuchsia-600',
];

/* ─── types ─── */
interface UserPost {
  id: string;
  content: string;
  type: string;
  likes: number;
  comments: number;
  createdAt: any;
  userName?: string;
  userAvatar?: string;
  heritage?: string | string[];
  feeling?: string;
  images?: string[];
  reactions?: Record<string, string[]>;
  reactionCount?: number;
}

interface UserThread {
  id: string;
  title: string;
  content: string;
  replies: number;
  score: number;
  createdAt: any;
  authorName?: string;
  authorAvatar?: string;
  heritage?: string | string[];
  flair?: string;
  topicId?: string;
  isPinned?: boolean;
  upvotes?: number;
  downvotes?: number;
}

interface UserActivity {
  id: string;
  type: 'post' | 'forum' | 'event' | 'business' | 'housing' | 'marketplace';
  title: string;
  preview: string;
  likes: number;
  comments: number;
  createdAt: any;
  gradient: string;
  icon: string;
}

const ACTIVITY_CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  post: { label: 'Posts', icon: '📝' },
  forum: { label: 'Forum', icon: '🧵' },
  business: { label: 'Business', icon: '🏪' },
  housing: { label: 'Housing', icon: '🏠' },
  marketplace: { label: 'Market', icon: '🛒' },
  event: { label: 'Events', icon: '📅' },
};

interface SavedItem {
  id: string;
  category: 'post' | 'business' | 'housing' | 'forum' | 'event';
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string;
}

const SAVED_CATEGORY_CONFIG: Record<string, { label: string; icon: string; gradient: string }> = {
  post: { label: 'Feed Posts', icon: '📝', gradient: 'from-indigo-500 to-purple-600' },
  business: { label: 'Businesses', icon: '🏪', gradient: 'from-emerald-500 to-teal-600' },
  housing: { label: 'Housing', icon: '🏠', gradient: 'from-amber-500 to-orange-600' },
  forum: { label: 'Forum Threads', icon: '💬', gradient: 'from-cyan-500 to-blue-600' },
  event: { label: 'Events', icon: '📅', gradient: 'from-rose-500 to-pink-600' },
};

/* ─── Listing detail types for modal overlays ─── */
interface BusinessDetail {
  id: string; name: string; desc: string; category?: string; emoji?: string;
  location?: string; phone?: string; website?: string; email?: string;
  hours?: string; rating?: number; reviews?: number; heritage?: string | string[];
  specialtyTags?: string[]; paymentMethods?: string[]; priceRange?: string;
  yearEstablished?: number; photos?: string[]; coverPhotoIndex?: number; createdAt: any;
}

interface HousingDetail {
  id: string; title: string; desc: string; price: number; type?: string;
  beds?: number; baths?: number; sqft?: number; address?: string;
  locCity?: string; locState?: string; locZip?: string; tags?: string[];
  posterName?: string; heritage?: string | string[]; contactPhone?: string;
  contactEmail?: string; availableDate?: string; petPolicy?: string;
  parking?: string; photos?: string[]; coverPhotoIndex?: number;
  propertyType?: string; createdAt: any;
}

interface MarketplaceDetail {
  id: string; title: string; description: string; price: number;
  category?: string; condition?: string; photos?: string[];
  location?: string; locCity?: string; locState?: string;
  sellerName?: string; brand?: string; model?: string;
  deliveryMethod?: string; shippingPrice?: number; negotiable?: boolean;
  tags?: string[]; heritage?: string | string[]; createdAt: any;
}

interface EventDetail {
  id: string; title: string; desc: string; emoji?: string; type?: string;
  fullDate?: string; time?: string; endTime?: string; location?: string;
  locCity?: string; locState?: string; ticket?: string; price?: number;
  organizer?: string; count?: number; capacity?: number;
  contactEmail?: string; contactPhone?: string; heritage?: string | string[];
  photos?: string[]; coverPhotoIndex?: number; status?: string; createdAt: any;
}

type ListingDetailItem =
  | { kind: 'post'; data: UserPost }
  | { kind: 'forum'; data: UserThread }
  | { kind: 'business'; data: BusinessDetail }
  | { kind: 'housing'; data: HousingDetail }
  | { kind: 'marketplace'; data: MarketplaceDetail }
  | { kind: 'event'; data: EventDetail };

/* ─── sub-components ─── */

function ProfileStat({ value, label }: { value: string | number; label: string }) {
  return (
    <button className="flex-1 py-2 text-center hover:bg-[var(--aurora-surface-variant)] transition-colors rounded-lg">
      <div className="text-lg font-bold text-[var(--aurora-text)]">{value}</div>
      <div className="text-[11px] text-[var(--aurora-text-muted)] font-medium">{label}</div>
    </button>
  );
}

function ActivityGridCard({ activity, onNavigate }: { activity: UserActivity; onNavigate: (activity: UserActivity) => void }) {
  const iconMap: Record<string, React.ReactNode> = {
    post: <MessageSquare size={14} />,
    forum: <Hash size={14} />,
    event: <Calendar size={14} />,
    business: <Building2 size={14} />,
    housing: <Building2 size={14} />,
    marketplace: <Star size={14} />,
  };

  return (
    <div className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer" onClick={() => onNavigate(activity)}>
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${activity.gradient}`} />

      {/* Content */}
      <div className="absolute inset-0 p-3 flex flex-col justify-between text-white">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-white/70">{iconMap[activity.type]}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
              {ACTIVITY_CATEGORY_CONFIG[activity.type]?.label || activity.type}
            </span>
          </div>
          {activity.title && activity.type !== 'post' && (
            <p className="text-[13px] font-bold leading-snug line-clamp-2 mb-0.5">{activity.title}</p>
          )}
          <p className="text-[12px] leading-snug line-clamp-2 text-white/90">{activity.preview}</p>
        </div>
        <div className="flex items-center gap-3 text-white/70 text-[11px]">
          {activity.likes > 0 && (
            <span className="flex items-center gap-0.5">
              <Heart size={10} fill="currentColor" /> {activity.likes}
            </span>
          )}
          {activity.comments > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare size={10} /> {activity.comments}
            </span>
          )}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
        <span className="flex items-center gap-1 text-white text-sm font-semibold">
          <Heart size={16} fill="white" /> {activity.likes}
        </span>
        <span className="flex items-center gap-1 text-white text-sm font-semibold">
          <MessageSquare size={16} fill="white" /> {activity.comments}
        </span>
      </div>
    </div>
  );
}

function EmptyGridState() {
  return (
    <div className="col-span-3 py-16 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-500/10 dark:to-purple-500/10 flex items-center justify-center mx-auto mb-4">
        <Camera size={32} className="text-[var(--aurora-text-muted)]" />
      </div>
      <p className="text-lg font-bold text-[var(--aurora-text)] mb-1">No activity yet</p>
      <p className="text-sm text-[var(--aurora-text-muted)]">
        Posts, forum threads, and events will show up here
      </p>
    </div>
  );
}

function SectionHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <div className="flex items-center gap-2">
        <span className="text-[var(--aurora-text-muted)]">{icon}</span>
        <h3 className="text-sm font-bold text-[var(--aurora-text)] uppercase tracking-wider">{title}</h3>
      </div>
      {action}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function ProfilePage() {
  const { user, userProfile, setUserProfile, isAdmin } = useAuth();
  const { settings, updateSetting } = useUserSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'listings' ? 'listings' : searchParams.get('tab') === 'saved' ? 'saved' : 'grid';
  const [isLoading, setIsLoading] = useState(false);
  const [postsCount, setPostsCount] = useState(0);
  const [forumCount, setForumCount] = useState(0);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [userThreads, setUserThreads] = useState<UserThread[]>([]);
  const [userBusinesses, setUserBusinesses] = useState<BusinessDetail[]>([]);
  const [userHousing, setUserHousing] = useState<HousingDetail[]>([]);
  const [userMarketplace, setUserMarketplace] = useState<MarketplaceDetail[]>([]);
  const [userEvents, setUserEvents] = useState<EventDetail[]>([]);
  const [listingDetail, setListingDetail] = useState<ListingDetailItem | null>(null);
  const [activityFilter, setActivityFilter] = useState<'all' | 'post' | 'forum'>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [messagingPrivacy, setMessagingPrivacy] = useState('Everyone');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'saved' | 'listings'>(initialTab as any);

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<Array<{ uid: string; name: string; avatar: string }>>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingUid, setUnblockingUid] = useState<string | null>(null);
  const [showBlockedSection, setShowBlockedSection] = useState(false);
  const [listingsFilter, setListingsFilter] = useState<'all' | 'business' | 'housing' | 'marketplace' | 'event'>('all');
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedFilter, setSavedFilter] = useState<'all' | 'post' | 'business' | 'housing' | 'forum' | 'event'>('all');

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete data confirmation modal state (two-step)
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [deleteDataStep, setDeleteDataStep] = useState<1 | 2>(1);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    preferredName: '',
    avatar: '🧑',
    heritage: [] as string[],
    city: '',
    profession: '',
    bio: '',
    interests: [] as string[],
    messagingPrivacy: 'Everyone',
    phone: '',
    accountType: 'individual' as 'individual' | 'business',
    businessName: '',
    businessType: '',
    isRegistered: null as boolean | null,
    tinNumber: '',
    tinValidationStatus: 'not_checked' as 'pending' | 'valid' | 'invalid' | 'not_checked',
    tinValidationMessage: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (user?.uid) {
      fetchUserContent();
    }
  }, [user?.uid]);

  useEffect(() => {
    if (userProfile) {
      setMessagingPrivacy(userProfile.messagingPrivacy || 'Everyone');
      setEditForm({
        name: userProfile.name || '',
        preferredName: (userProfile as any)?.preferredName || '',
        avatar: userProfile.avatar || '🧑',
        heritage: Array.isArray(userProfile.heritage)
          ? userProfile.heritage
          : (userProfile.heritage ? [userProfile.heritage] : []),
        city: userProfile.city || '',
        profession: userProfile.profession || '',
        bio: userProfile.bio || '',
        interests: userProfile.interests || [],
        messagingPrivacy: userProfile.messagingPrivacy || 'Everyone',
        phone: userProfile.phone || '',
        accountType: (userProfile.accountType as 'individual' | 'business') || 'individual',
        businessName: (userProfile as any)?.businessName || '',
        businessType: (userProfile as any)?.businessType || '',
        isRegistered: (userProfile as any)?.isRegistered ?? null,
        tinNumber: (userProfile as any)?.tinNumber || '',
        tinValidationStatus: ((userProfile as any)?.tinValidationStatus as 'pending' | 'valid' | 'invalid' | 'not_checked') || 'not_checked',
        tinValidationMessage: (userProfile as any)?.tinValidationMessage || '',
      });
    }
  }, [userProfile]);

  const fetchUserContent = async () => {
    if (!user?.uid) return;

    // Fetch posts (no orderBy to avoid composite index requirement; sorted client-side)
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', user.uid),
        limit(50)
      );
      const postsSnap = await getDocs(postsQuery);
      const posts: UserPost[] = [];
      postsSnap.forEach((d) => {
        const data = d.data();
        posts.push({
          id: d.id,
          content: data.content || '',
          type: data.type || 'community',
          likes: data.likes || 0,
          comments: data.comments || 0,
          createdAt: data.createdAt,
          userName: data.userName,
          userAvatar: data.userAvatar,
          heritage: data.heritage,
          feeling: data.feeling,
          images: data.images,
          reactions: data.reactions,
          reactionCount: data.reactionCount,
        });
      });
      setUserPosts(posts);
      setPostsCount(postsSnap.size);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }

    // Fetch forum threads (separate try so posts failure doesn't block this)
    try {
      const forumQuery = query(
        collection(db, 'forumThreads'),
        where('authorId', '==', user.uid),
        limit(50)
      );
      const forumSnap = await getDocs(forumQuery);
      const threads: UserThread[] = [];
      forumSnap.forEach((d) => {
        const data = d.data();
        if (!data.isRemoved) {
          threads.push({
            id: d.id,
            title: data.title || '',
            content: data.content || '',
            replies: data.replies || data.replyCount || 0,
            score: data.score || data.voteScore || 0,
            createdAt: data.createdAt,
            authorName: data.authorName,
            authorAvatar: data.authorAvatar,
            heritage: data.heritage,
            flair: data.flair,
            topicId: data.topicId,
            isPinned: data.isPinned,
            upvotes: data.upvotes,
            downvotes: data.downvotes,
          });
        }
      });
      setUserThreads(threads);
      setForumCount(threads.length);
    } catch (error) {
      console.error('Error fetching user threads:', error);
      setUserThreads([]);
      setForumCount(0);
    }

    // Fetch user businesses (expanded fields for detail modal)
    try {
      const bizQuery = query(collection(db, 'businesses'), where('ownerId', '==', user.uid), limit(50));
      const bizSnap = await getDocs(bizQuery);
      const biz: BusinessDetail[] = [];
      bizSnap.forEach((d) => {
        const data = d.data();
        biz.push({
          id: d.id, name: data.name || '', desc: data.desc || '', category: data.category,
          emoji: data.emoji, location: data.location, phone: data.phone, website: data.website,
          email: data.email, hours: data.hours, rating: data.rating, reviews: data.reviews,
          heritage: data.heritage, specialtyTags: data.specialtyTags, paymentMethods: data.paymentMethods,
          priceRange: data.priceRange, yearEstablished: data.yearEstablished,
          photos: data.photos, coverPhotoIndex: data.coverPhotoIndex, createdAt: data.createdAt,
        });
      });
      setUserBusinesses(biz);
    } catch (error) {
      console.error('Error fetching user businesses:', error);
    }

    // Fetch user housing listings (expanded fields for detail modal)
    try {
      const housingQuery = query(collection(db, 'listings'), where('posterId', '==', user.uid), limit(50));
      const housingSnap = await getDocs(housingQuery);
      const housing: HousingDetail[] = [];
      housingSnap.forEach((d) => {
        const data = d.data();
        housing.push({
          id: d.id, title: data.title || '', desc: data.desc || '', price: data.price || 0,
          type: data.type, beds: data.beds, baths: data.baths, sqft: data.sqft,
          address: data.address, locCity: data.locCity, locState: data.locState, locZip: data.locZip,
          tags: data.tags, posterName: data.posterName, heritage: data.heritage,
          contactPhone: data.contactPhone, contactEmail: data.contactEmail,
          availableDate: data.availableDate, petPolicy: data.petPolicy, parking: data.parking,
          photos: data.photos, coverPhotoIndex: data.coverPhotoIndex,
          propertyType: data.propertyType, createdAt: data.createdAt,
        });
      });
      setUserHousing(housing);
    } catch (error) {
      console.error('Error fetching user housing:', error);
    }

    // Fetch user marketplace items (expanded fields for detail modal)
    try {
      const mktQuery = query(collection(db, 'marketplaceListings'), where('sellerId', '==', user.uid), limit(50));
      const mktSnap = await getDocs(mktQuery);
      const mkt: MarketplaceDetail[] = [];
      mktSnap.forEach((d) => {
        const data = d.data();
        mkt.push({
          id: d.id, title: data.title || '', description: data.description || '', price: data.price || 0,
          category: data.category, condition: data.condition, photos: data.photos,
          location: data.location, locCity: data.locCity, locState: data.locState,
          sellerName: data.sellerName, brand: data.brand, model: data.model,
          deliveryMethod: data.deliveryMethod, shippingPrice: data.shippingPrice,
          negotiable: data.negotiable, tags: data.tags, heritage: data.heritage, createdAt: data.createdAt,
        });
      });
      setUserMarketplace(mkt);
    } catch (error) {
      console.error('Error fetching user marketplace:', error);
    }

    // Fetch user events (expanded fields for detail modal)
    try {
      const evtQuery = query(collection(db, 'events'), where('posterId', '==', user.uid), limit(50));
      const evtSnap = await getDocs(evtQuery);
      const evts: EventDetail[] = [];
      evtSnap.forEach((d) => {
        const data = d.data();
        evts.push({
          id: d.id, title: data.title || '', desc: data.desc || '', emoji: data.emoji,
          type: data.type, fullDate: data.fullDate, time: data.time, endTime: data.endTime,
          location: data.location, locCity: data.locCity, locState: data.locState,
          ticket: data.ticket, price: data.price, organizer: data.organizer,
          count: data.count, capacity: data.capacity, contactEmail: data.contactEmail,
          contactPhone: data.contactPhone, heritage: data.heritage,
          photos: data.photos, coverPhotoIndex: data.coverPhotoIndex,
          status: data.status, createdAt: data.createdAt,
        });
      });
      setUserEvents(evts);
    } catch (error) {
      console.error('Error fetching user events:', error);
    }
  };

  // Load saved content when Saved tab is activated
  useEffect(() => {
    if (activeTab === 'saved' && savedItems.length === 0) {
      fetchSavedContent();
    }
  }, [activeTab, savedItems.length]);

  const fetchSavedContent = async () => {
    if (!user?.uid) return;
    setSavedLoading(true);
    const items: SavedItem[] = [];

    try {
      // Pull saved IDs from Firestore (source of truth) and hydrate localStorage
      const saved = await pullSavedItems(user.uid);

      // Helper to batch-fetch docs by IDs (Firestore 'in' supports max 30)
      const fetchByIds = async (collectionName: string, ids: string[]) => {
        if (ids.length === 0) return [] as any[];
        const batches = [];
        for (let i = 0; i < ids.length; i += 30) {
          batches.push(ids.slice(i, i + 30));
        }
        const results: any[] = [];
        for (const batch of batches) {
          try {
            const q = query(collection(db, collectionName), where(documentId(), 'in', batch));
            const snap = await getDocs(q);
            snap.forEach((d) => results.push({ id: d.id, ...d.data() }));
          } catch (err) {
            console.error(`Error fetching ${collectionName}:`, err);
          }
        }
        return results;
      };

      // 1. Saved Feed Posts
      if (saved.posts.length > 0) {
        const posts = await fetchByIds('posts', saved.posts);
        posts.forEach((p) => {
          items.push({
            id: p.id, category: 'post',
            title: p.userName || 'Post',
            subtitle: (p.content || '').substring(0, 80) + ((p.content || '').length > 80 ? '...' : ''),
            emoji: p.type === 'professional' ? '💼' : p.type === 'event' ? '📅' : '💬',
            gradient: SAVED_CATEGORY_CONFIG.post.gradient,
          });
        });
      }

      // 2. Favorited Businesses
      if (saved.businesses.length > 0) {
        const businesses = await fetchByIds('businesses', saved.businesses);
        businesses.forEach((b) => {
          items.push({
            id: b.id, category: 'business',
            title: b.name || 'Business',
            subtitle: b.category ? `${b.category} · ${b.location || ''}` : (b.location || ''),
            emoji: b.emoji || '🏪',
            gradient: SAVED_CATEGORY_CONFIG.business.gradient,
          });
        });
      }

      // 3. Saved Housing Listings
      if (saved.housing.length > 0) {
        const listings = await fetchByIds('listings', saved.housing);
        listings.forEach((l) => {
          items.push({
            id: l.id, category: 'housing',
            title: l.title || 'Listing',
            subtitle: l.price ? `$${l.price} · ${l.locCity || ''}` : (l.locCity || ''),
            emoji: l.emoji || '🏠',
            gradient: SAVED_CATEGORY_CONFIG.housing.gradient,
          });
        });
      }

      // 4. Saved Forum Threads
      if (saved.forumThreads.length > 0) {
        const threads = await fetchByIds('forumThreads', saved.forumThreads);
        threads.forEach((t) => {
          items.push({
            id: t.id, category: 'forum',
            title: t.title || 'Thread',
            subtitle: t.category ? `${t.category} · by ${t.authorName || 'Anonymous'}` : (t.authorName || ''),
            emoji: '💬',
            gradient: SAVED_CATEGORY_CONFIG.forum.gradient,
          });
        });
      }

      // 5. Saved Events
      if (saved.events.length > 0) {
        const events = await fetchByIds('events', saved.events);
        events.forEach((ev) => {
          items.push({
            id: ev.id, category: 'event',
            title: ev.title || 'Event',
            subtitle: ev.fullDate ? `${ev.fullDate} · ${ev.location || ''}` : (ev.location || ''),
            emoji: ev.emoji || '📅',
            gradient: SAVED_CATEGORY_CONFIG.event.gradient,
          });
        });
      }

      setSavedItems(items);
    } catch (err) {
      console.error('Error fetching saved content:', err);
    } finally {
      setSavedLoading(false);
    }
  };

  // Transform all user content into activity grid items
  const activityGrid: UserActivity[] = useMemo(() => {
    let idx = 0;
    const nextGradient = () => GRADIENT_SETS[idx++ % GRADIENT_SETS.length];

    const postItems: UserActivity[] = userPosts.map((post) => ({
      id: post.id, type: 'post' as const, title: post.type,
      preview: (post.content || '').substring(0, 120), likes: post.likes, comments: post.comments,
      createdAt: post.createdAt, gradient: nextGradient(),
      icon: post.type === 'event' ? '📅' : post.type === 'professional' ? '💼' : '💬',
    }));
    const threadItems: UserActivity[] = userThreads.map((t) => ({
      id: t.id, type: 'forum' as const, title: t.title,
      preview: (t.content || '').substring(0, 120), likes: t.score, comments: t.replies,
      createdAt: t.createdAt, gradient: nextGradient(), icon: '🧵',
    }));
    const bizItems: UserActivity[] = userBusinesses.map((b) => ({
      id: b.id, type: 'business' as const, title: b.name,
      preview: (b.desc || '').substring(0, 120), likes: 0, comments: 0,
      createdAt: b.createdAt, gradient: nextGradient(), icon: '🏪',
    }));
    const housingItems: UserActivity[] = userHousing.map((h) => ({
      id: h.id, type: 'housing' as const, title: h.title,
      preview: h.price ? `$${h.price.toLocaleString()} · ${(h.desc || '').substring(0, 80)}` : (h.desc || '').substring(0, 120),
      likes: 0, comments: 0, createdAt: h.createdAt, gradient: nextGradient(), icon: '🏠',
    }));
    const mktItems: UserActivity[] = userMarketplace.map((m) => ({
      id: m.id, type: 'marketplace' as const, title: m.title,
      preview: m.price ? `$${m.price.toLocaleString()} · ${(m.description || '').substring(0, 80)}` : (m.description || '').substring(0, 120),
      likes: 0, comments: 0, createdAt: m.createdAt, gradient: nextGradient(), icon: '🛒',
    }));
    const evtItems: UserActivity[] = userEvents.map((e) => ({
      id: e.id, type: 'event' as const, title: e.title,
      preview: (e.desc || '').substring(0, 120), likes: 0, comments: 0,
      createdAt: e.createdAt, gradient: nextGradient(), icon: '📅',
    }));

    // Tab 1 (Grid) only shows posts + forums
    return [...postItems, ...threadItems].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return bTime - aTime;
    });
  }, [userPosts, userThreads, userBusinesses, userHousing, userMarketplace, userEvents]);

  const handleActivityNavigate = useCallback((activity: UserActivity) => {
    // Posts: open modal overlay, "View Full Details" goes to feed page
    if (activity.type === 'post') {
      const post = userPosts.find((p) => p.id === activity.id);
      if (post) setListingDetail({ kind: 'post', data: post });
      return;
    }
    // Forums: open modal overlay, "View Full Details" goes to forum page
    if (activity.type === 'forum') {
      const thread = userThreads.find((t) => t.id === activity.id);
      if (thread) setListingDetail({ kind: 'forum', data: thread });
      return;
    }

    // Business, housing, marketplace, events: open modal overlay on profile page
    if (activity.type === 'business') {
      const biz = userBusinesses.find((b) => b.id === activity.id);
      if (biz) setListingDetail({ kind: 'business', data: biz });
      return;
    }
    if (activity.type === 'housing') {
      const h = userHousing.find((item) => item.id === activity.id);
      if (h) setListingDetail({ kind: 'housing', data: h });
      return;
    }
    if (activity.type === 'marketplace') {
      const m = userMarketplace.find((item) => item.id === activity.id);
      if (m) setListingDetail({ kind: 'marketplace', data: m });
      return;
    }
    if (activity.type === 'event') {
      const e = userEvents.find((item) => item.id === activity.id);
      if (e) setListingDetail({ kind: 'event', data: e });
      return;
    }
  }, [navigate, userPosts, userThreads, userBusinesses, userHousing, userMarketplace, userEvents]);

  // Saved items click handler — fetches full doc from Firestore then opens modal
  const handleSavedItemClick = useCallback(async (item: SavedItem) => {
    // Posts: fetch and open modal
    if (item.category === 'post') {
      try {
        const snap = await getDoc(doc(db, 'posts', item.id));
        if (snap.exists()) {
          const data = snap.data();
          setListingDetail({ kind: 'post', data: { id: snap.id, content: data.content || '', type: data.type || 'community', likes: data.likes || 0, comments: data.comments || 0, createdAt: data.createdAt, userName: data.userName, userAvatar: data.userAvatar, heritage: data.heritage, feeling: data.feeling, images: data.images, reactions: data.reactions, reactionCount: data.reactionCount } });
        }
      } catch (err) { console.error('Error fetching saved post:', err); }
      return;
    }
    // Forums: fetch and open modal
    if (item.category === 'forum') {
      try {
        const snap = await getDoc(doc(db, 'forumThreads', item.id));
        if (snap.exists()) {
          const data = snap.data();
          setListingDetail({ kind: 'forum', data: { id: snap.id, title: data.title || '', content: data.content || '', replies: data.replies || data.replyCount || 0, score: data.score || data.voteScore || 0, createdAt: data.createdAt, authorName: data.authorName, authorAvatar: data.authorAvatar, heritage: data.heritage, flair: data.flair, topicId: data.topicId, isPinned: data.isPinned, upvotes: data.upvotes, downvotes: data.downvotes } });
        }
      } catch (err) { console.error('Error fetching saved thread:', err); }
      return;
    }

    // For business/housing/event — fetch full doc then open modal
    const collectionMap: Record<string, string> = {
      business: 'businesses',
      housing: 'listings',
      event: 'events',
    };
    const colName = collectionMap[item.category];
    if (colName) {
      try {
        const snap = await getDoc(doc(db, colName, item.id));
        if (snap.exists()) {
          const data = snap.data();
          if (item.category === 'business') {
            setListingDetail({ kind: 'business', data: { id: snap.id, name: data.name || '', desc: data.desc || '', category: data.category, emoji: data.emoji, location: data.location, phone: data.phone, website: data.website, email: data.email, hours: data.hours, rating: data.rating, reviews: data.reviews, heritage: data.heritage, specialtyTags: data.specialtyTags, paymentMethods: data.paymentMethods, priceRange: data.priceRange, yearEstablished: data.yearEstablished, photos: data.photos, coverPhotoIndex: data.coverPhotoIndex, createdAt: data.createdAt } });
          } else if (item.category === 'housing') {
            setListingDetail({ kind: 'housing', data: { id: snap.id, title: data.title || '', desc: data.desc || '', price: data.price || 0, type: data.type, beds: data.beds, baths: data.baths, sqft: data.sqft, address: data.address, locCity: data.locCity, locState: data.locState, locZip: data.locZip, tags: data.tags, posterName: data.posterName, heritage: data.heritage, contactPhone: data.contactPhone, contactEmail: data.contactEmail, availableDate: data.availableDate, petPolicy: data.petPolicy, parking: data.parking, photos: data.photos, coverPhotoIndex: data.coverPhotoIndex, propertyType: data.propertyType, createdAt: data.createdAt } });
          } else if (item.category === 'event') {
            setListingDetail({ kind: 'event', data: { id: snap.id, title: data.title || '', desc: data.desc || '', emoji: data.emoji, type: data.type, fullDate: data.fullDate, time: data.time, endTime: data.endTime, location: data.location, locCity: data.locCity, locState: data.locState, ticket: data.ticket, price: data.price, organizer: data.organizer, count: data.count, capacity: data.capacity, contactEmail: data.contactEmail, contactPhone: data.contactPhone, heritage: data.heritage, photos: data.photos, coverPhotoIndex: data.coverPhotoIndex, status: data.status, createdAt: data.createdAt } });
          }
        }
      } catch (err) {
        console.error('Error fetching saved item detail:', err);
      }
    }
  }, [navigate]);

  /* ─── handlers (all preserved from original) ─── */

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut(auth);
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
      setToastMessage('Failed to sign out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Blocked Users ────────────────────────────────────────────
  const loadBlockedUsers = async () => {
    if (!user) return;
    setLoadingBlocked(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().blockedUsers) {
        const blockedUids: string[] = userDoc.data().blockedUsers;
        const userDetails = await Promise.all(
          blockedUids.map(async (uid) => {
            try {
              const blockedDoc = await getDoc(doc(db, 'users', uid));
              if (blockedDoc.exists()) {
                const data = blockedDoc.data();
                return { uid, name: data.name || 'Unknown User', avatar: data.avatar || '' };
              }
            } catch (e) {
              console.error('Error loading blocked user:', e);
            }
            return { uid, name: 'Unknown User', avatar: '' };
          })
        );
        setBlockedUsers(userDetails);
      } else {
        setBlockedUsers([]);
      }
    } catch (e) {
      console.error('Error loading blocked users:', e);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblockUser = async (uid: string, name: string) => {
    if (!user) return;
    try {
      setUnblockingUid(uid);
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: arrayRemove(uid),
      });
      setBlockedUsers((prev) => prev.filter((u) => u.uid !== uid));
      setToastMessage(`${name} has been unblocked.`);
    } catch (e) {
      console.error('Error unblocking user:', e);
      setToastMessage('Failed to unblock user.');
    } finally {
      setUnblockingUid(null);
    }
  };

  const handleEditPress = () => {
    setEditForm({
      name: userProfile?.name || '',
      preferredName: (userProfile as any)?.preferredName || '',
      avatar: userProfile?.avatar || '🧑',
      heritage: Array.isArray(userProfile?.heritage)
        ? userProfile.heritage
        : (userProfile?.heritage ? [userProfile.heritage] : []),
      city: userProfile?.city || '',
      profession: userProfile?.profession || '',
      bio: userProfile?.bio || '',
      interests: userProfile?.interests || [],
      messagingPrivacy: userProfile?.messagingPrivacy || 'Everyone',
      phone: userProfile?.phone || '',
      accountType: (userProfile?.accountType as 'individual' | 'business') || 'individual',
      businessName: (userProfile as any)?.businessName || '',
      businessType: (userProfile as any)?.businessType || '',
      isRegistered: (userProfile as any)?.isRegistered ?? null,
      tinNumber: (userProfile as any)?.tinNumber || '',
      tinValidationStatus: ((userProfile as any)?.tinValidationStatus as 'pending' | 'valid' | 'invalid' | 'not_checked') || 'not_checked',
      tinValidationMessage: (userProfile as any)?.tinValidationMessage || '',
    });
    setEditModalOpen(true);
  };

  const toggleInterest = (interest: string) => {
    setEditForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };



  const formatTINNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const limited = digits.slice(0, 9);
    if (limited.length <= 2) return limited;
    return `${limited.slice(0, 2)}-${limited.slice(2)}`;
  };

  const handleTINChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTINNumber(e.target.value);
    setEditForm((prev) => ({ ...prev, tinNumber: formatted }));
  };

  const handleValidateTIN = async () => {
    if (!editForm.tinNumber || editForm.tinNumber.length < 10) {
      setToastMessage('Please enter a valid TIN/EIN in format XX-XXXXXXX');
      return;
    }
    try {
      setEditForm((prev) => ({ ...prev, tinValidationStatus: 'pending', tinValidationMessage: 'Validating...' }));
      const result = await validateMerchantTIN(editForm.tinNumber, editForm.businessName);
      setEditForm((prev) => ({
        ...prev,
        tinValidationStatus: result.isValid ? 'valid' : 'invalid',
        tinValidationMessage: result.message || (result.isValid ? 'TIN is valid' : 'TIN validation failed'),
      }));
    } catch (error) {
      console.error('TIN validation error:', error);
      setEditForm((prev) => ({ ...prev, tinValidationStatus: 'invalid', tinValidationMessage: 'Error validating TIN. Please try again.' }));
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.uid) return;
    if (editForm.accountType === 'business') {
      if (!editForm.phone || editForm.phone.trim() === '') { setToastMessage('Mobile number is mandatory for business accounts.'); return; }
      if (!editForm.businessName || editForm.businessName.trim() === '') { setToastMessage('Business name is required for business accounts'); return; }
      if (editForm.isRegistered === null) { setToastMessage('Please indicate if your business is registered'); return; }
      if (editForm.isRegistered === true && (!editForm.tinNumber || editForm.tinNumber.length < 10)) { setToastMessage('Valid TIN/EIN is required for registered business accounts'); return; }
    }
    const isUnregisteredBusiness = editForm.accountType === 'business' && editForm.isRegistered === false;
    try {
      setIsSaving(true);
      const userDocRef = doc(db, 'users', user.uid);
      const updateData: any = {
        name: editForm.name, preferredName: editForm.preferredName, avatar: editForm.avatar, heritage: editForm.heritage,
        city: editForm.city, profession: editForm.profession, bio: editForm.bio,
        interests: editForm.interests, messagingPrivacy: editForm.messagingPrivacy,
        phone: editForm.phone, accountType: editForm.accountType,
      };
      if (editForm.accountType === 'business') {
        updateData.businessName = editForm.businessName;
        updateData.businessType = editForm.businessType;
        updateData.isRegistered = editForm.isRegistered;
        updateData.tinNumber = editForm.tinNumber || '';
        updateData.tinValidationStatus = isUnregisteredBusiness ? 'not_checked' : editForm.tinValidationStatus;
        updateData.tinValidationMessage = editForm.tinValidationMessage;
        if (isUnregisteredBusiness || editForm.tinValidationStatus === 'invalid') {
          updateData.adminReviewRequired = true;
          updateData.adminApproved = false;
        }
      }
      await updateDoc(userDocRef, updateData);
      setUserProfile({
        ...userProfile, ...updateData,
        ...(editForm.accountType === 'business' && {
          adminReviewRequired: isUnregisteredBusiness || editForm.tinValidationStatus === 'invalid',
          adminApproved: isUnregisteredBusiness ? false : undefined,
        }),
      } as any);
      setEditModalOpen(false);
      if (isUnregisteredBusiness) {
        setToastMessage('Profile updated! Your unregistered business account is pending admin approval.');
      } else {
        setToastMessage('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setToastMessage('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePrivacy = async (value: string) => {
    if (!user?.uid) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { messagingPrivacy: value });
      setMessagingPrivacy(value);
      if (userProfile) setUserProfile({ ...userProfile, messagingPrivacy: value } as any);
    } catch (error) {
      console.error('Error updating privacy:', error);
      setToastMessage('Failed to update privacy setting');
    }
  };

  const handleDownloadData = async () => {
    if (!user?.uid) return;
    try {
      setIsDownloading(true);
      const data = await downloadMyData(user.uid);
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ethnizity-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setToastMessage('Your data has been downloaded successfully!');
    } catch (error) {
      console.error('Error downloading data:', error);
      setToastMessage('Failed to download your data. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteData = () => {
    setDeleteDataStep(1);
    setShowDeleteDataConfirm(true);
  };

  const confirmDeleteData = async () => {
    if (deleteDataStep === 1) {
      setDeleteDataStep(2);
      return;
    }
    // Step 2 confirmed — proceed with deletion
    if (!user?.uid) return;
    try {
      setShowDeleteDataConfirm(false);
      setIsDeleting(true);
      await deleteMyData(user.uid);
      setToastMessage('Your data has been deleted. You will be signed out now.');
      setTimeout(async () => {
        await signOut(auth);
        window.location.href = '/login';
      }, 2000);
    } catch (error) {
      console.error('Error deleting data:', error);
      setToastMessage('Failed to delete your data. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'New Member';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      if (isNaN(date.getTime())) return 'New Member';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch {
      return 'New Member';
    }
  };

  const heritageText = useMemo(() => {
    if (!userProfile?.heritage) return '';
    return Array.isArray(userProfile.heritage) ? userProfile.heritage.join(' · ') : userProfile.heritage;
  }, [userProfile?.heritage]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--aurora-bg)]">
        <Loader2 size={32} className="animate-spin text-aurora-indigo" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     MAIN PROFILE VIEW — Instagram-style
     ═══════════════════════════════════════════ */
  return (
    <div className="bg-[var(--aurora-bg)]">
      {/* ─── Header bar ─── */}
      <div className="flex-shrink-0 bg-[var(--aurora-surface)] border-b border-[var(--aurora-border)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--aurora-text)]">
          {userProfile?.name || 'Profile'}
        </h1>
        <button className="w-9 h-9 rounded-full hover:bg-[var(--aurora-surface-variant)] flex items-center justify-center transition-colors">
          <MoreHorizontal size={20} className="text-[var(--aurora-text)]" />
        </button>
      </div>

      <div className="max-w-xl mx-auto">
        {/* ─── Profile header section ─── */}
        <div className="px-5 pt-5 pb-4">
          {/* Avatar + Stats row */}
          <div className="flex items-center gap-5 mb-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5">
                {userProfile?.avatar && (userProfile.avatar.startsWith('http') || userProfile.avatar.startsWith('data:')) ? (
                  <img src={userProfile.avatar} alt={userProfile.name || 'Profile'} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[var(--aurora-surface)] flex items-center justify-center text-4xl">
                    {userProfile?.avatar || '🧑'}
                  </div>
                )}
              </div>
              {userProfile?.accountType === 'business' && (
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-aurora-indigo rounded-full flex items-center justify-center border-2 border-[var(--aurora-surface)]">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex-1 flex items-center justify-around">
              <ProfileStat value={postsCount} label="Posts" />
              <ProfileStat value={forumCount} label="Threads" />
              <ProfileStat value={formatDate(userProfile?.createdAt)} label="Joined" />
            </div>
          </div>

          {/* Name + Action buttons row */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[var(--aurora-text)] truncate">{(userProfile as any)?.preferredName || userProfile?.name || 'User'}</h2>
                  {userProfile?.accountType === 'business' && (
                    <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/15 text-aurora-indigo text-[10px] font-bold rounded-md uppercase flex-shrink-0">Business</span>
                  )}
                </div>
                {(userProfile as any)?.preferredName && userProfile?.name && (userProfile as any).preferredName !== userProfile.name && (
                  <p className="text-[13px] text-[var(--aurora-text-muted)]">{userProfile.name}</p>
                )}
              </div>
              {/* Edit / Share / Settings inline */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={handleEditPress}
                  className="px-3 py-1.5 bg-[var(--aurora-surface-variant)] rounded-lg font-semibold text-xs text-[var(--aurora-text)] hover:bg-[var(--aurora-border)] transition-colors flex items-center gap-1.5"
                >
                  <Edit3 size={13} /> <span className="hidden sm:inline">Edit</span><span className="sm:hidden">Edit</span>
                </button>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: `${userProfile?.name} on EthniZity`, url: window.location.href });
                    }
                  }}
                  className="px-3 py-1.5 bg-[var(--aurora-surface-variant)] rounded-lg font-semibold text-xs text-[var(--aurora-text)] hover:bg-[var(--aurora-border)] transition-colors flex items-center gap-1.5"
                >
                  <Share2 size={13} /> <span className="hidden sm:inline">Share</span><span className="sm:hidden">Share</span>
                </button>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="w-8 h-8 bg-[var(--aurora-surface-variant)] rounded-lg hover:bg-[var(--aurora-border)] transition-colors flex items-center justify-center flex-shrink-0"
                >
                  <Settings size={14} className="text-[var(--aurora-text)]" />
                </button>
              </div>
            </div>
            {userProfile?.profession && (
              <p className="text-sm text-aurora-indigo font-medium">{userProfile.profession}</p>
            )}
            {(userProfile?.city || heritageText) && (
              <p className="text-[13px] text-[var(--aurora-text-muted)] flex items-center gap-1 mt-0.5">
                <MapPin size={12} />
                {[userProfile?.city, heritageText].filter(Boolean).join(' · ')}
              </p>
            )}
            {userProfile?.bio && (
              <p className="text-[13px] text-[var(--aurora-text-secondary)] mt-2 leading-relaxed">{userProfile.bio}</p>
            )}
          </div>

          {/* Interests pills */}
          {userProfile?.interests && userProfile.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {userProfile.interests.slice(0, 8).map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--aurora-surface-variant)] rounded-full text-[11px] font-semibold text-[var(--aurora-text-secondary)]"
                >
                  {INTEREST_ICONS[interest] || '⭐'} {interest}
                </span>
              ))}
              {userProfile.interests.length > 8 && (
                <span className="px-2.5 py-1 text-[11px] text-[var(--aurora-text-muted)] font-medium">
                  +{userProfile.interests.length - 8} more
                </span>
              )}
            </div>
          )}

          {/* Privacy & Blocked Users — surfaced on profile */}
          <div className="space-y-3">
            {/* Privacy */}
            <div className="bg-[var(--aurora-surface-variant)] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-[var(--aurora-text-muted)]" />
                  <span className="text-sm font-semibold text-[var(--aurora-text)]">Who can message you?</span>
                </div>
                <select
                  value={messagingPrivacy}
                  onChange={(e) => handleUpdatePrivacy(e.target.value)}
                  className="px-2.5 py-1.5 border border-[var(--aurora-border)] rounded-lg text-xs font-medium text-[var(--aurora-text)] bg-[var(--aurora-surface)] focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                >
                  {PRIVACY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Blocked Users */}
            <div className="bg-[var(--aurora-surface-variant)] rounded-xl overflow-hidden">
              {/* Always-visible header — acts as toggle */}
              <button
                onClick={() => {
                  if (!showBlockedSection) {
                    setShowBlockedSection(true);
                    loadBlockedUsers();
                  } else {
                    setShowBlockedSection(false);
                  }
                }}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--aurora-border)]/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Ban size={14} className="text-[var(--aurora-text-muted)]" />
                  <span className="text-sm font-semibold text-[var(--aurora-text)]">Blocked Users</span>
                  {showBlockedSection && !loadingBlocked && blockedUsers.length > 0 && (
                    <span className="text-xs text-[var(--aurora-text-muted)]">({blockedUsers.length})</span>
                  )}
                </div>
                <ChevronDown size={16} className={`text-[var(--aurora-text-muted)] transition-transform ${showBlockedSection ? 'rotate-180' : ''}`} />
              </button>

              {/* Expandable content */}
              {showBlockedSection && (
                loadingBlocked ? (
                  <div className="flex items-center justify-center py-5 border-t border-[var(--aurora-border)]/50">
                    <Loader2 size={18} className="animate-spin text-aurora-indigo" />
                  </div>
                ) : blockedUsers.length === 0 ? (
                  <div className="px-4 py-4 text-center border-t border-[var(--aurora-border)]/50">
                    <UserX size={22} className="mx-auto mb-1.5 text-[var(--aurora-text-muted)]" />
                    <p className="text-sm font-medium text-[var(--aurora-text)]">No blocked users</p>
                    <p className="text-xs text-[var(--aurora-text-muted)] mt-0.5">Block users from the ⋯ menu on posts, messages, discover, or forum</p>
                  </div>
                ) : (
                  <div className="border-t border-[var(--aurora-border)]/50">
                    {blockedUsers.map((blockedUser, idx) => (
                      <div
                        key={blockedUser.uid}
                        className={`px-4 py-2.5 flex items-center gap-3 ${idx < blockedUsers.length - 1 ? 'border-b border-[var(--aurora-border)]/50' : ''}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-[var(--aurora-surface)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {blockedUser.avatar && (blockedUser.avatar.startsWith('http') || blockedUser.avatar.startsWith('data:')) ? (
                            <img src={blockedUser.avatar} alt={blockedUser.name} className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <span className="text-xs">{blockedUser.avatar || blockedUser.name?.charAt(0) || '👤'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--aurora-text)] truncate">{blockedUser.name}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnblockUser(blockedUser.uid, blockedUser.name); }}
                          disabled={unblockingUid === blockedUser.uid}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--aurora-border)] text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-surface)] transition-colors disabled:opacity-50"
                        >
                          {unblockingUid === blockedUser.uid ? 'Unblocking...' : 'Unblock'}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* ─── Tab bar ─── */}
        <div className="flex border-b border-[var(--aurora-border)] bg-[var(--aurora-surface)]">
          <button
            onClick={() => setActiveTab('grid')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors border-b-2 ${
              activeTab === 'grid'
                ? 'border-[var(--aurora-text)] text-[var(--aurora-text)]'
                : 'border-transparent text-[var(--aurora-text-muted)]'
            }`}
          >
            <Grid3X3 size={22} />
          </button>
          <button
            onClick={() => setActiveTab('listings')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors border-b-2 ${
              activeTab === 'listings'
                ? 'border-[var(--aurora-text)] text-[var(--aurora-text)]'
                : 'border-transparent text-[var(--aurora-text-muted)]'
            }`}
          >
            <Tag size={22} />
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-3 flex items-center justify-center transition-colors border-b-2 ${
              activeTab === 'saved'
                ? 'border-[var(--aurora-text)] text-[var(--aurora-text)]'
                : 'border-transparent text-[var(--aurora-text-muted)]'
            }`}
          >
            <Bookmark size={22} />
          </button>
        </div>

        {/* ─── Content grid ─── */}
        <div className="p-2">
          {activeTab === 'listings' ? (
            /* ─── My Listings Tab ─── */
            <div>
              <div className="flex gap-2 px-2 py-3 overflow-x-auto hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                {(['all', 'business', 'housing', 'marketplace', 'event'] as const).map((cat) => {
                  const config: Record<string, { label: string; icon: React.ReactNode }> = {
                    all: { label: 'All', icon: <Tag size={14} /> },
                    business: { label: 'Businesses', icon: <Store size={14} /> },
                    housing: { label: 'Housing', icon: <Home size={14} /> },
                    marketplace: { label: 'Marketplace', icon: <ShoppingBag size={14} /> },
                    event: { label: 'Events', icon: <CalendarDays size={14} /> },
                  };
                  const counts: Record<string, number> = {
                    all: userBusinesses.length + userHousing.length + userMarketplace.length + userEvents.length,
                    business: userBusinesses.length,
                    housing: userHousing.length,
                    marketplace: userMarketplace.length,
                    event: userEvents.length,
                  };
                  if (cat !== 'all' && counts[cat] === 0) return null;
                  return (
                    <button
                      key={cat}
                      onClick={() => setListingsFilter(cat)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
                        listingsFilter === cat
                          ? 'bg-aurora-indigo text-white shadow-sm'
                          : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] border border-[var(--aurora-border)]'
                      }`}
                    >
                      {config[cat].icon} {config[cat].label} ({counts[cat]})
                    </button>
                  );
                })}
              </div>

              {/* Listings content */}
              <div className="space-y-2 px-1">
                {(listingsFilter === 'all' || listingsFilter === 'business') && userBusinesses.length > 0 && (
                  <>
                    {listingsFilter === 'all' && (
                      <h3 className="text-xs font-bold text-[var(--aurora-text-muted)] uppercase tracking-wider mt-3 mb-2 flex items-center gap-1.5">
                        <Store size={12} /> Businesses ({userBusinesses.length})
                      </h3>
                    )}
                    {userBusinesses.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => setListingDetail({ kind: 'business', data: b })}
                        onTouchStart={() => {}}
                        className="flex items-center gap-3 p-3 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl cursor-pointer hover:bg-[var(--aurora-surface-variant)] transition-colors"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                          <Store size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--aurora-text)] truncate">{b.name}</p>
                          <p className="text-xs text-[var(--aurora-text-muted)] truncate">{b.desc || 'Business listing'}</p>
                        </div>
                        <ChevronRight size={16} className="text-[var(--aurora-text-muted)] shrink-0" />
                      </div>
                    ))}
                  </>
                )}

                {(listingsFilter === 'all' || listingsFilter === 'housing') && userHousing.length > 0 && (
                  <>
                    {listingsFilter === 'all' && (
                      <h3 className="text-xs font-bold text-[var(--aurora-text-muted)] uppercase tracking-wider mt-3 mb-2 flex items-center gap-1.5">
                        <Home size={12} /> Housing ({userHousing.length})
                      </h3>
                    )}
                    {userHousing.map((h) => (
                      <div
                        key={h.id}
                        onClick={() => setListingDetail({ kind: 'housing', data: h })}
                        onTouchStart={() => {}}
                        className="flex items-center gap-3 p-3 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl cursor-pointer hover:bg-[var(--aurora-surface-variant)] transition-colors"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
                          <Home size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--aurora-text)] truncate">{h.title}</p>
                          <p className="text-xs text-[var(--aurora-text-muted)] truncate">{h.price ? `$${h.price.toLocaleString()}` : 'Housing listing'}</p>
                        </div>
                        <ChevronRight size={16} className="text-[var(--aurora-text-muted)] shrink-0" />
                      </div>
                    ))}
                  </>
                )}

                {(listingsFilter === 'all' || listingsFilter === 'marketplace') && userMarketplace.length > 0 && (
                  <>
                    {listingsFilter === 'all' && (
                      <h3 className="text-xs font-bold text-[var(--aurora-text-muted)] uppercase tracking-wider mt-3 mb-2 flex items-center gap-1.5">
                        <ShoppingBag size={12} /> Marketplace ({userMarketplace.length})
                      </h3>
                    )}
                    {userMarketplace.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => setListingDetail({ kind: 'marketplace', data: m })}
                        onTouchStart={() => {}}
                        className="flex items-center gap-3 p-3 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl cursor-pointer hover:bg-[var(--aurora-surface-variant)] transition-colors"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shrink-0">
                          <ShoppingBag size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--aurora-text)] truncate">{m.title}</p>
                          <p className="text-xs text-[var(--aurora-text-muted)] truncate">{m.price ? `$${m.price.toLocaleString()}` : 'Marketplace listing'}</p>
                        </div>
                        <ChevronRight size={16} className="text-[var(--aurora-text-muted)] shrink-0" />
                      </div>
                    ))}
                  </>
                )}

                {(listingsFilter === 'all' || listingsFilter === 'event') && userEvents.length > 0 && (
                  <>
                    {listingsFilter === 'all' && (
                      <h3 className="text-xs font-bold text-[var(--aurora-text-muted)] uppercase tracking-wider mt-3 mb-2 flex items-center gap-1.5">
                        <CalendarDays size={12} /> Events ({userEvents.length})
                      </h3>
                    )}
                    {userEvents.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => setListingDetail({ kind: 'event', data: e })}
                        onTouchStart={() => {}}
                        className="flex items-center gap-3 p-3 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl cursor-pointer hover:bg-[var(--aurora-surface-variant)] transition-colors"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shrink-0">
                          <CalendarDays size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--aurora-text)] truncate">{e.title}</p>
                          <p className="text-xs text-[var(--aurora-text-muted)] truncate">{e.desc || 'Event listing'}</p>
                        </div>
                        <ChevronRight size={16} className="text-[var(--aurora-text-muted)] shrink-0" />
                      </div>
                    ))}
                  </>
                )}

                {/* Contextual Add CTA — changes label & route based on active filter */}
                {(userProfile?.accountType === 'business' || isAdmin) && (() => {
                  const ctaConfig: Record<string, { label: string; route: string } | null> = {
                    all: { label: 'Add New Listing', route: '/business?action=add' },
                    business: { label: 'Add Another Business', route: '/business?action=add' },
                    housing: null,
                    marketplace: { label: 'Add Marketplace Listing', route: '/marketplace?action=add' },
                    event: { label: 'Add Event', route: '/events?action=add' },
                  };
                  const cta = ctaConfig[listingsFilter];
                  if (!cta) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => navigate(cta.route)}
                      className="w-full flex items-center justify-center gap-2 py-3 mt-3 text-sm font-medium rounded-xl transition-colors"
                      style={{
                        border: '1.5px dashed var(--aurora-accent, #6366F1)',
                        color: 'var(--aurora-accent, #6366F1)',
                        backgroundColor: 'rgba(99, 102, 241, 0.04)',
                        minHeight: '44px',
                        WebkitTapHighlightColor: 'transparent',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none' as any,
                        appearance: 'none',
                      }}
                    >
                      <Plus size={16} />
                      {cta.label}
                    </button>
                  );
                })()}

                {/* Empty state */}
                {userBusinesses.length + userHousing.length + userMarketplace.length + userEvents.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package size={40} className="text-[var(--aurora-text-muted)] mb-3" />
                    <h3 className="text-base font-semibold text-[var(--aurora-text)] mb-1">No listings yet</h3>
                    <p className="text-sm text-[var(--aurora-text-muted)] mb-4">Your business, housing, marketplace, and event listings will appear here.</p>
                    {(userProfile?.accountType === 'business' || isAdmin) && (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {([
                          { label: 'Add Business', route: '/business?action=add' },
                          { label: 'Add Marketplace Listing', route: '/marketplace?action=add' },
                          { label: 'Add Event', route: '/events?action=add' },
                        ] as const).map((cta) => (
                          <button
                            key={cta.route}
                            type="button"
                            onClick={() => navigate(cta.route)}
                            onTouchStart={() => {}}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                            style={{
                              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                              minHeight: '44px',
                              WebkitTapHighlightColor: 'transparent',
                              WebkitAppearance: 'none',
                              MozAppearance: 'none' as any,
                              appearance: 'none',
                            }}
                          >
                            <Plus size={14} />
                            {cta.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'grid' ? (
            <div>
              {/* Activity category filter chips */}
              <div className="flex gap-2 px-2 py-3 overflow-x-auto hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                {(['all', 'post', 'forum'] as const).map((cat) => {
                  const config = cat === 'all' ? { label: 'All', icon: '📋' } : ACTIVITY_CATEGORY_CONFIG[cat];
                  const count = cat === 'all' ? activityGrid.length : activityGrid.filter((i) => i.type === cat).length;
                  if (cat !== 'all' && count === 0) return null;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActivityFilter(cat)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
                        activityFilter === cat
                          ? 'bg-aurora-indigo text-white shadow-sm'
                          : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] border border-[var(--aurora-border)]'
                      }`}
                    >
                      {config.icon} {config.label} ({count})
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {activityGrid.filter((a) => activityFilter === 'all' || a.type === activityFilter).length === 0 ? (
                  <EmptyGridState />
                ) : (
                  activityGrid
                    .filter((a) => activityFilter === 'all' || a.type === activityFilter)
                    .map((activity) => (
                      <ActivityGridCard key={`${activity.type}-${activity.id}`} activity={activity} onNavigate={handleActivityNavigate} />
                    ))
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Category filter chips */}
              <div className="flex gap-2 px-2 py-3 overflow-x-auto hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                {(['all', 'post', 'business', 'housing', 'forum', 'event'] as const).map((cat) => {
                  const config = cat === 'all' ? { label: 'All', icon: '📋' } : SAVED_CATEGORY_CONFIG[cat];
                  const count = cat === 'all' ? savedItems.length : savedItems.filter((i) => i.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSavedFilter(cat)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
                        savedFilter === cat
                          ? 'bg-aurora-indigo text-white shadow-sm'
                          : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] border border-[var(--aurora-border)]'
                      }`}
                    >
                      {config.icon} {config.label} {count > 0 ? `(${count})` : ''}
                    </button>
                  );
                })}
              </div>

              {savedLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 size={24} className="animate-spin text-aurora-indigo" />
                </div>
              ) : savedItems.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-[var(--aurora-text)] flex items-center justify-center mx-auto mb-3">
                    <Bookmark size={28} className="text-[var(--aurora-text)]" />
                  </div>
                  <p className="text-lg font-bold text-[var(--aurora-text)] mb-1">Nothing saved yet</p>
                  <p className="text-sm text-[var(--aurora-text-muted)]">
                    Save posts, businesses, listings, threads, and events to see them here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {savedItems
                    .filter((item) => savedFilter === 'all' || item.category === savedFilter)
                    .map((item, idx) => (
                      <div
                        key={`${item.category}-${item.id}`}
                        className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
                        onClick={() => handleSavedItemClick(item)}
                        onTouchStart={() => {}}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
                        <div className="absolute inset-0 p-3 flex flex-col justify-between text-white">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-sm">{item.emoji}</span>
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                                {SAVED_CATEGORY_CONFIG[item.category]?.label || item.category}
                              </span>
                            </div>
                            <p className="text-[13px] font-semibold leading-snug line-clamp-2">{item.title}</p>
                          </div>
                          <p className="text-[11px] text-white/70 line-clamp-2">{item.subtitle}</p>
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Bookmark size={20} fill="white" className="text-white" />
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
         SETTINGS DRAWER
         ═══════════════════════════════════════════ */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Settings">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setSettingsOpen(false)} />

          {/* Drawer */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-[var(--aurora-surface)] shadow-2xl overflow-y-auto animate-slideInRight">
            {/* Drawer header */}
            <div className="sticky top-0 bg-[var(--aurora-surface)] border-b border-[var(--aurora-border)] px-5 py-4 flex items-center justify-between z-10">
              <h2 id="settings-modal-title" className="text-lg font-bold text-[var(--aurora-text)]">Settings</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-[var(--aurora-surface-variant)] flex items-center justify-center"
              >
                <X size={20} className="text-[var(--aurora-text)]" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Account info */}
              <div>
                <SectionHeader icon={<Shield size={14} />} title="Account" />
                <div className="bg-[var(--aurora-surface-variant)] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--aurora-border)]/50">
                    <div className="flex items-center gap-2.5">
                      <Mail size={16} className="text-[var(--aurora-text-muted)]" />
                      <span className="text-sm text-[var(--aurora-text)]">Email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--aurora-text)] truncate max-w-[150px]">{userProfile?.email || user?.email}</span>
                      <button
                        onClick={() => updateSetting('privacy', 'showEmail', !settings.privacy.showEmail)}
                        className="p-1 rounded-md hover:bg-[var(--aurora-border)]/30 transition-colors"
                        title={settings.privacy.showEmail ? 'Hide email from others' : 'Show email to others'}
                      >
                        {settings.privacy.showEmail
                          ? <Eye size={14} className="text-aurora-indigo" />
                          : <EyeOff size={14} className="text-[var(--aurora-text-muted)]" />}
                      </button>
                      <button onClick={() => { setSettingsOpen(false); setEditModalOpen(true); }} className="p-1 rounded-md hover:bg-[var(--aurora-border)]/30 transition-colors">
                        <Edit3 size={14} className="text-[var(--aurora-text-muted)]" />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--aurora-border)]/50">
                    <div className="flex items-center gap-2.5">
                      <Phone size={16} className="text-[var(--aurora-text-muted)]" />
                      <span className="text-sm text-[var(--aurora-text)]">Phone</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--aurora-text)]">{userProfile?.phone || 'Not set'}</span>
                      <button
                        onClick={() => updateSetting('privacy', 'showPhone', !settings.privacy.showPhone)}
                        className="p-1 rounded-md hover:bg-[var(--aurora-border)]/30 transition-colors"
                        title={settings.privacy.showPhone ? 'Hide phone from others' : 'Show phone to others'}
                      >
                        {settings.privacy.showPhone
                          ? <Eye size={14} className="text-aurora-indigo" />
                          : <EyeOff size={14} className="text-[var(--aurora-text-muted)]" />}
                      </button>
                      <button onClick={() => { setSettingsOpen(false); setEditModalOpen(true); }} className="p-1 rounded-md hover:bg-[var(--aurora-border)]/30 transition-colors">
                        <Edit3 size={14} className="text-[var(--aurora-text-muted)]" />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Building2 size={16} className="text-[var(--aurora-text-muted)]" />
                      <span className="text-sm text-[var(--aurora-text)]">Account Type</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--aurora-text)] capitalize">{userProfile?.accountType || 'Individual'}</span>
                      <button onClick={() => { setSettingsOpen(false); setEditModalOpen(true); }} className="p-1 rounded-md hover:bg-[var(--aurora-border)]/30 transition-colors">
                        <Edit3 size={14} className="text-[var(--aurora-text-muted)]" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--aurora-text-muted)] mt-2 px-1">
                  Visibility: <span className="font-semibold capitalize">{settings.privacy.profileVisibility}</span>
                  {' · '}
                  {settings.privacy.searchable ? 'Visible in Discover' : 'Hidden from Discover'}
                </p>
              </div>

              {/* Data & Privacy */}
              <div>
                <SectionHeader icon={<Download size={14} />} title="Data & Privacy" />
                <p className="text-[12px] text-[var(--aurora-text-muted)] mb-3 px-1">
                  Download your data or permanently delete your account (GDPR/CCPA).
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadData}
                    disabled={isDownloading}
                    className="flex-1 px-3 py-2.5 bg-aurora-indigo text-white rounded-xl font-semibold text-sm hover:bg-aurora-indigo-dark transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Download size={14} />
                    {isDownloading ? 'Exporting...' : 'Export Data'}
                  </button>
                  <button
                    onClick={handleDeleteData}
                    disabled={isDeleting}
                    className="flex-1 px-3 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    {isDeleting ? 'Deleting...' : 'Delete Data'}
                  </button>
                </div>
              </div>

              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full py-3 border border-red-200 dark:border-red-500/30 text-red-500 rounded-xl font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                {isLoading ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
         EDIT PROFILE MODAL — Full-screen
         ═══════════════════════════════════════════ */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--aurora-surface)] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="edit-profile-modal-title">
          {/* Modal Header */}
          <div className="flex-shrink-0 flex justify-between items-center px-5 py-3.5 border-b border-[var(--aurora-border)] bg-[var(--aurora-surface)]">
            <button
              onClick={() => setEditModalOpen(false)}
              className="text-[var(--aurora-text-secondary)] font-semibold hover:text-[var(--aurora-text)] transition-colors"
            >
              Cancel
            </button>
            <h3 id="edit-profile-modal-title" className="text-base font-bold text-[var(--aurora-text)]">Edit Profile</h3>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="text-aurora-indigo font-bold hover:text-aurora-indigo-dark disabled:opacity-50 transition-colors"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Done'}
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Profile Photo OR Avatar Picker */}
            <div className="text-center">
              {/* Current avatar/photo preview */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 mx-auto mb-3">
                {editForm.avatar && (editForm.avatar.startsWith('http') || editForm.avatar.startsWith('data:') || editForm.avatar.startsWith('data:')) ? (
                  <img src={editForm.avatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[var(--aurora-surface)] flex items-center justify-center text-4xl">
                    {editForm.avatar || '🧑'}
                  </div>
                )}
              </div>

              {/* Hidden file input for photo upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    alert('Image too large. Please select an image under 10MB.');
                    return;
                  }
                  setUploadingImage(true);
                  try {
                    const dataUrl = await compressProfileImage(file);
                    setEditForm((prev) => ({ ...prev, avatar: dataUrl }));
                  } catch (err) {
                    console.error('[Profile] Failed to process image:', err);
                    alert('Failed to process image. Please try a different photo.');
                  } finally {
                    setUploadingImage(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }
                }}
              />

              {/* Toggle: Photo or Avatar */}
              {(() => {
                const isImageAvatar = !!(editForm.avatar && (editForm.avatar.startsWith('http') || editForm.avatar.startsWith('data:')));
                return (
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        isImageAvatar
                          ? 'bg-aurora-indigo text-white shadow-sm'
                          : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] hover:bg-aurora-indigo/10'
                      }`}
                    >
                      {uploadingImage ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                      ) : (
                        <><Camera className="w-4 h-4" /> Use Photo</>
                      )}
                    </button>
                    <span className="text-xs text-[var(--aurora-text-muted)]">or</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isImageAvatar) setEditForm((prev) => ({ ...prev, avatar: '🧑' }));
                      }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        !isImageAvatar
                          ? 'bg-aurora-indigo text-white shadow-sm'
                          : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] hover:bg-aurora-indigo/10'
                      }`}
                    >
                      🧑 Use Avatar
                    </button>
                  </div>
                );
              })()}

              {/* Show photo actions if using photo */}
              {editForm.avatar && (editForm.avatar.startsWith('http') || editForm.avatar.startsWith('data:')) && (
                <div className="flex items-center justify-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="text-xs text-aurora-indigo hover:underline"
                  >
                    Change photo
                  </button>
                  <span className="text-xs text-[var(--aurora-text-muted)]">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditForm((prev) => ({ ...prev, avatar: '🧑' }));
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove photo
                  </button>
                </div>
              )}

              {/* Emoji avatar grid — only show when not using photo */}
              {(!editForm.avatar || !(editForm.avatar.startsWith('http') || editForm.avatar.startsWith('data:'))) && (
                <div className="grid grid-cols-8 gap-2 max-w-xs mx-auto">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, avatar }))}
                      className={`p-2 rounded-xl text-xl transition ${
                        editForm.avatar === avatar
                          ? 'bg-aurora-indigo/10 ring-2 ring-aurora-indigo'
                          : 'hover:bg-[var(--aurora-surface-variant)]'
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Text fields */}
            {[
              { label: 'Name', key: 'name', placeholder: 'Your name', type: 'text' },
              { label: 'Preferred Name', key: 'preferredName', placeholder: 'What should we call you?', type: 'text' },
              { label: 'Profession', key: 'profession', placeholder: 'Your profession', type: 'text' },
              { label: 'City', key: 'city', placeholder: 'Your city', type: 'text' },
              { label: `Phone${editForm.accountType === 'business' ? ' *' : ''}`, key: 'phone', placeholder: '+1 (555) 123-4567', type: 'tel' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-bold text-[var(--aurora-text-muted)] mb-1.5 uppercase tracking-wider">{field.label}</label>
                <input
                  type={field.type}
                  value={(editForm as any)[field.key]}
                  onChange={(e) => setEditForm({ ...editForm, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2.5 border border-[var(--aurora-border)] rounded-xl text-[var(--aurora-text)] bg-[var(--aurora-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition"
                />
              </div>
            ))}

            {/* Bio */}
            <div>
              <label className="block text-xs font-bold text-[var(--aurora-text-muted)] mb-1.5 uppercase tracking-wider">Bio</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                placeholder="Tell us about yourself"
                rows={3}
                className="w-full px-4 py-2.5 border border-[var(--aurora-border)] rounded-xl text-[var(--aurora-text)] bg-[var(--aurora-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition resize-none"
              />
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-xs font-bold text-[var(--aurora-text-muted)] mb-2 uppercase tracking-wider">Account Type</label>
              <div className="flex gap-2">
                {(['individual', 'business'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setEditForm({ ...editForm, accountType: type })}
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold border-2 transition text-center text-sm ${
                      editForm.accountType === type
                        ? 'border-aurora-indigo bg-aurora-indigo text-white'
                        : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)] hover:border-[var(--aurora-border-glass)]'
                    }`}
                  >
                    <div className="text-xl mb-0.5">{type === 'individual' ? '👤' : '🏢'}</div>
                    <span className="capitalize">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Business Details */}
            {editForm.accountType === 'business' && (
              <div className="border border-[var(--aurora-border)] rounded-xl p-4 space-y-4 bg-[var(--aurora-surface-variant)]/50">
                <p className="text-xs font-bold text-aurora-indigo uppercase tracking-wider">Business Details</p>

                <div>
                  <label className="block text-xs font-bold text-[var(--aurora-text-muted)] mb-1.5 uppercase tracking-wider">Business Name *</label>
                  <input
                    type="text"
                    value={editForm.businessName}
                    onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                    placeholder="Your business name"
                    className="w-full px-4 py-2.5 border border-[var(--aurora-border)] rounded-xl text-[var(--aurora-text)] bg-[var(--aurora-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--aurora-text-muted)] mb-1.5 uppercase tracking-wider">Business Type</label>
                  <select
                    value={editForm.businessType}
                    onChange={(e) => setEditForm({ ...editForm, businessType: e.target.value })}
                    className="w-full px-4 py-2.5 border border-[var(--aurora-border)] rounded-xl text-[var(--aurora-text)] bg-[var(--aurora-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                  >
                    <option value="">Select type</option>
                    {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--aurora-text-muted)] mb-2 uppercase tracking-wider">Registered? *</label>
                  <div className="flex gap-2">
                    {([true, false] as const).map((val) => (
                      <button
                        key={String(val)}
                        onClick={() => setEditForm({ ...editForm, isRegistered: val })}
                        className={`flex-1 py-2 rounded-xl font-semibold text-sm border-2 transition ${
                          editForm.isRegistered === val
                            ? 'border-aurora-indigo bg-aurora-indigo text-white'
                            : 'border-[var(--aurora-border)] text-[var(--aurora-text-secondary)]'
                        }`}
                      >
                        {val ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>

                {editForm.isRegistered === true && (
                  <div className="space-y-3">
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">TIN verification required for registered businesses</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--aurora-text-muted)] mb-1.5 uppercase tracking-wider">TIN/EIN *</label>
                      <input
                        type="text"
                        value={editForm.tinNumber}
                        onChange={handleTINChange}
                        placeholder="XX-XXXXXXX"
                        maxLength={10}
                        className="w-full px-4 py-2.5 border border-[var(--aurora-border)] rounded-xl text-[var(--aurora-text)] bg-[var(--aurora-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                      />
                    </div>
                    <button
                      onClick={handleValidateTIN}
                      disabled={!editForm.tinNumber || editForm.tinNumber.length < 10 || editForm.tinValidationStatus === 'pending'}
                      className="w-full py-2.5 bg-aurora-indigo text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition"
                    >
                      {editForm.tinValidationStatus === 'pending' ? 'Validating...' : 'Validate TIN'}
                    </button>
                    {editForm.tinValidationStatus !== 'not_checked' && (
                      <div className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                        editForm.tinValidationStatus === 'valid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : editForm.tinValidationStatus === 'invalid' ? 'bg-red-50 text-red-600 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {editForm.tinValidationStatus === 'valid' && '✓ '}{editForm.tinValidationStatus === 'invalid' && '✗ '}{editForm.tinValidationMessage}
                      </div>
                    )}
                  </div>
                )}

                {editForm.isRegistered === false && (
                  <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1">Admin Approval Required</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">Unregistered businesses require admin approval before posting listings. Allow 2-3 business days.</p>
                    <input
                      type="text"
                      value={editForm.tinNumber}
                      onChange={handleTINChange}
                      placeholder="TIN (optional)"
                      maxLength={10}
                      className="mt-2 w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-[var(--aurora-surface)] focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Heritage */}
            <div>
              <label className="block text-xs font-bold text-[var(--aurora-text-muted)] mb-2 uppercase tracking-wider">Heritage / EthniZity</label>
              <CountryEthnicitySelector
                selected={editForm.heritage}
                onChange={(val) => setEditForm((prev) => ({ ...prev, heritage: val }))}
                maxHeight="320px"
              />
            </div>

            {/* Interests */}
            <div>
              <label className="block text-xs font-bold text-[var(--aurora-text-muted)] mb-2 uppercase tracking-wider">Interests</label>
              <div className="grid grid-cols-2 gap-2">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-2.5 rounded-xl border-2 font-medium text-sm transition flex items-center gap-2 ${
                      editForm.interests.includes(interest)
                        ? 'border-aurora-indigo bg-aurora-indigo text-white'
                        : 'border-[var(--aurora-border)] text-[var(--aurora-text)] hover:border-[var(--aurora-border-glass)]'
                    }`}
                  >
                    <span>{INTEREST_ICONS[interest] || '⭐'}</span>
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            {/* Messaging Privacy */}
            <div>
              <label className="block text-xs font-bold text-[var(--aurora-text-muted)] mb-1.5 uppercase tracking-wider">Who can message you?</label>
              <select
                value={editForm.messagingPrivacy}
                onChange={(e) => setEditForm({ ...editForm, messagingPrivacy: e.target.value })}
                className="w-full px-4 py-2.5 border border-[var(--aurora-border)] rounded-xl text-[var(--aurora-text)] bg-[var(--aurora-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
              >
                {PRIVACY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Bottom spacing */}
            <div className="h-8" />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
         LISTING DETAIL MODAL OVERLAY
         ═══════════════════════════════════════════ */}
      {listingDetail && (
        <div
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center"
          onClick={() => setListingDetail(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Listing details"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />
          {/* Modal */}
          <div
            className="relative w-full sm:max-w-lg max-h-[90vh] bg-[var(--aurora-surface)] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-fadeSlideUp"
            onClick={(e) => e.stopPropagation()}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* ─── Header ─── */}
            {(() => {
              const gradientMap: Record<string, string> = { post: 'from-indigo-500 to-purple-600', forum: 'from-cyan-500 to-blue-600', business: 'from-indigo-500 to-purple-600', housing: 'from-emerald-500 to-teal-600', marketplace: 'from-amber-500 to-orange-600', event: 'from-rose-500 to-pink-600' };
              const iconMap: Record<string, React.ReactNode> = { post: <Edit3 size={18} className="text-white" />, forum: <MessageSquare size={18} className="text-white" />, business: <Store size={22} className="text-white" />, housing: <Home size={22} className="text-white" />, marketplace: <ShoppingBag size={22} className="text-white" />, event: <CalendarDays size={22} className="text-white" /> };
              const labelMap: Record<string, string> = { post: 'Post', forum: 'Forum Thread', business: 'Business', housing: 'Housing', marketplace: 'Marketplace', event: 'Event' };
              const photos = (listingDetail.data as any).photos as string[] | undefined;
              const images = (listingDetail.data as any).images as string[] | undefined;
              const allPhotos = photos || images;
              const coverIdx = (listingDetail.data as any).coverPhotoIndex ?? 0;
              const coverPhoto = allPhotos && allPhotos.length > 0 ? allPhotos[coverIdx] || allPhotos[0] : null;

              // Determine title
              let headerTitle = '';
              if (listingDetail.kind === 'business') headerTitle = (listingDetail.data as BusinessDetail).name;
              else if (listingDetail.kind === 'post') headerTitle = (listingDetail.data as UserPost).content.slice(0, 80) + ((listingDetail.data as UserPost).content.length > 80 ? '...' : '');
              else if (listingDetail.kind === 'forum') headerTitle = (listingDetail.data as UserThread).title;
              else headerTitle = (listingDetail.data as any).title || '';

              return (
                <div className={`relative ${coverPhoto ? 'h-48 sm:h-56' : 'h-28'} shrink-0`}>
                  {coverPhoto ? (
                    <img src={coverPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientMap[listingDetail.kind]}`} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button
                      onClick={() => setListingDetail(null)}
                      className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                      style={{ WebkitBackdropFilter: 'blur(4px)' }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-2" style={{ WebkitBackdropFilter: 'blur(4px)' }}>
                      {iconMap[listingDetail.kind]} {labelMap[listingDetail.kind]}
                    </span>
                    <h2 className="text-lg font-bold text-white leading-tight line-clamp-2 drop-shadow-lg">
                      {headerTitle}
                    </h2>
                  </div>
                </div>
              );
            })()}

            {/* ─── Scrollable content ─── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>

              {/* Post detail */}
              {listingDetail.kind === 'post' && (() => {
                const p = listingDetail.data as UserPost;
                const timeStr = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                return (
                  <>
                    {/* Author row */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {p.userAvatar ? <img src={p.userAvatar} alt="" className="w-full h-full object-cover" /> : (p.userName || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--aurora-text)] truncate">{p.userName || userProfile?.name || 'You'}</p>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--aurora-text-muted)]">
                          {timeStr && <span>{timeStr}</span>}
                          {p.feeling && <span>Feeling {p.feeling}</span>}
                        </div>
                      </div>
                    </div>
                    {/* Post type badge */}
                    {p.type && p.type !== 'community' && (
                      <span className="inline-block bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full capitalize">{p.type}</span>
                    )}
                    {/* Content */}
                    <p className="text-sm text-[var(--aurora-text)] leading-relaxed whitespace-pre-wrap">{p.content}</p>
                    {/* Images */}
                    {p.images && p.images.length > 0 && (
                      <div className={`grid gap-1.5 ${p.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {p.images.slice(0, 4).map((img, i) => (
                          <img key={i} src={img} alt="" className="w-full rounded-lg object-cover max-h-48" />
                        ))}
                      </div>
                    )}
                    {/* Stats */}
                    <div className="flex items-center gap-4 pt-2 border-t border-[var(--aurora-border)]">
                      <div className="flex items-center gap-1.5 text-sm text-[var(--aurora-text-muted)]">
                        <Heart size={14} /> <span>{p.likes || 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-[var(--aurora-text-muted)]">
                        <MessageSquare size={14} /> <span>{p.comments || 0}</span>
                      </div>
                      {p.reactionCount != null && p.reactionCount > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-[var(--aurora-text-muted)]">
                          <Sparkles size={14} /> <span>{p.reactionCount} reactions</span>
                        </div>
                      )}
                    </div>
                    {/* Heritage */}
                    {p.heritage && (
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(p.heritage) ? p.heritage : [p.heritage]).map((h) => (
                          <span key={h} className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-[11px] font-medium px-2 py-0.5 rounded-full">{h}</span>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Forum thread detail */}
              {listingDetail.kind === 'forum' && (() => {
                const t = listingDetail.data as UserThread;
                const timeStr = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                return (
                  <>
                    {/* Author row */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {t.authorAvatar ? <img src={t.authorAvatar} alt="" className="w-full h-full object-cover" /> : (t.authorName || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--aurora-text)] truncate">{t.authorName || userProfile?.name || 'You'}</p>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--aurora-text-muted)]">
                          {timeStr && <span>{timeStr}</span>}
                          {t.isPinned && <span className="text-amber-500 font-semibold">Pinned</span>}
                        </div>
                      </div>
                    </div>
                    {/* Flair badge */}
                    {t.flair && (
                      <span className="inline-block bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-300 text-xs font-semibold px-2.5 py-1 rounded-full">{t.flair}</span>
                    )}
                    {/* Content */}
                    <p className="text-sm text-[var(--aurora-text)] leading-relaxed whitespace-pre-wrap">{t.content}</p>
                    {/* Stats */}
                    <div className="flex items-center gap-4 pt-2 border-t border-[var(--aurora-border)]">
                      <div className="flex items-center gap-1.5 text-sm text-[var(--aurora-text-muted)]">
                        <MessageSquare size={14} /> <span>{t.replies} {t.replies === 1 ? 'reply' : 'replies'}</span>
                      </div>
                      {(t.upvotes != null || t.score != null) && (
                        <div className="flex items-center gap-1.5 text-sm text-[var(--aurora-text-muted)]">
                          <TrendingUp size={14} /> <span>{t.upvotes ?? t.score} upvotes</span>
                        </div>
                      )}
                      {t.downvotes != null && t.downvotes > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-[var(--aurora-text-muted)]">
                          <ChevronDown size={14} /> <span>{t.downvotes}</span>
                        </div>
                      )}
                    </div>
                    {/* Heritage */}
                    {t.heritage && (
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(t.heritage) ? t.heritage : [t.heritage]).map((h) => (
                          <span key={h} className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-[11px] font-medium px-2 py-0.5 rounded-full">{h}</span>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Business detail */}
              {listingDetail.kind === 'business' && (() => {
                const b = listingDetail.data as BusinessDetail;
                return (
                  <>
                    {/* Category + price range */}
                    {(b.category || b.priceRange) && (
                      <div className="flex flex-wrap gap-2">
                        {b.category && <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full">{b.emoji} {b.category}</span>}
                        {b.priceRange && <span className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 text-xs font-semibold px-2.5 py-1 rounded-full">{b.priceRange}</span>}
                        {b.yearEstablished && <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full">Est. {b.yearEstablished}</span>}
                      </div>
                    )}
                    {/* Rating */}
                    {b.rating != null && b.rating > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Star size={14} className="text-amber-400" fill="currentColor" />
                        <span className="text-sm font-semibold text-[var(--aurora-text)]">{b.rating.toFixed(1)}</span>
                        {b.reviews != null && <span className="text-xs text-[var(--aurora-text-muted)]">({b.reviews} reviews)</span>}
                      </div>
                    )}
                    {/* Description */}
                    {b.desc && <p className="text-sm text-[var(--aurora-text-secondary)] leading-relaxed">{b.desc}</p>}
                    {/* Specialty tags */}
                    {b.specialtyTags && b.specialtyTags.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-[var(--aurora-text-muted)] uppercase tracking-wider mb-2">Specialties</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {b.specialtyTags.map((t) => <span key={t} className="bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] text-[11px] px-2 py-0.5 rounded-full">{t}</span>)}
                        </div>
                      </div>
                    )}
                    {/* Contact info */}
                    <div className="space-y-2">
                      {b.location && (
                        <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]">
                          <MapPin size={14} className="text-[var(--aurora-text-muted)] shrink-0" />
                          <span className="truncate">{b.location}</span>
                        </div>
                      )}
                      {b.phone && (
                        <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]">
                          <Phone size={14} className="text-[var(--aurora-text-muted)] shrink-0" />
                          <span>{b.phone}</span>
                        </div>
                      )}
                      {b.email && (
                        <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]">
                          <Mail size={14} className="text-[var(--aurora-text-muted)] shrink-0" />
                          <span className="truncate">{b.email}</span>
                        </div>
                      )}
                      {b.website && (
                        <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]">
                          <Globe size={14} className="text-[var(--aurora-text-muted)] shrink-0" />
                          <span className="truncate">{b.website}</span>
                        </div>
                      )}
                      {b.hours && (
                        <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]">
                          <Calendar size={14} className="text-[var(--aurora-text-muted)] shrink-0" />
                          <span>{b.hours}</span>
                        </div>
                      )}
                    </div>
                    {/* Heritage */}
                    {b.heritage && (
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(b.heritage) ? b.heritage : [b.heritage]).map((h) => (
                          <span key={h} className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-[11px] font-medium px-2 py-0.5 rounded-full">{h}</span>
                        ))}
                      </div>
                    )}
                    {/* Payment methods */}
                    {b.paymentMethods && b.paymentMethods.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-[var(--aurora-text-muted)] uppercase tracking-wider mb-2">Payment</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {b.paymentMethods.map((p) => <span key={p} className="bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] text-[11px] px-2 py-0.5 rounded-full">{p}</span>)}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Housing detail */}
              {listingDetail.kind === 'housing' && (() => {
                const h = listingDetail.data as HousingDetail;
                return (
                  <>
                    {/* Price */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-[var(--aurora-text)]">${h.price.toLocaleString()}</span>
                      {h.type && <span className="text-xs text-[var(--aurora-text-muted)] font-medium">{h.type === 'rent' ? '/month' : ''}</span>}
                    </div>
                    {/* Key specs */}
                    {(h.beds || h.baths || h.sqft) && (
                      <div className="flex gap-4">
                        {h.beds != null && <div className="text-center"><span className="text-sm font-bold text-[var(--aurora-text)]">{h.beds}</span><span className="text-[11px] text-[var(--aurora-text-muted)] ml-1">beds</span></div>}
                        {h.baths != null && <div className="text-center"><span className="text-sm font-bold text-[var(--aurora-text)]">{h.baths}</span><span className="text-[11px] text-[var(--aurora-text-muted)] ml-1">baths</span></div>}
                        {h.sqft != null && <div className="text-center"><span className="text-sm font-bold text-[var(--aurora-text)]">{h.sqft.toLocaleString()}</span><span className="text-[11px] text-[var(--aurora-text-muted)] ml-1">sqft</span></div>}
                      </div>
                    )}
                    {/* Description */}
                    {h.desc && <p className="text-sm text-[var(--aurora-text-secondary)] leading-relaxed">{h.desc}</p>}
                    {/* Location */}
                    {(h.address || h.locCity) && (
                      <div className="flex items-start gap-2 text-sm text-[var(--aurora-text-secondary)]">
                        <MapPin size={14} className="text-[var(--aurora-text-muted)] shrink-0 mt-0.5" />
                        <span>{[h.address, h.locCity, h.locState, h.locZip].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    {/* Details grid */}
                    {(h.propertyType || h.availableDate || h.petPolicy || h.parking) && (
                      <div className="grid grid-cols-2 gap-2">
                        {h.propertyType && <div className="bg-[var(--aurora-surface-variant)] rounded-lg p-2.5"><p className="text-[10px] text-[var(--aurora-text-muted)] uppercase">Type</p><p className="text-xs font-semibold text-[var(--aurora-text)]">{h.propertyType}</p></div>}
                        {h.availableDate && <div className="bg-[var(--aurora-surface-variant)] rounded-lg p-2.5"><p className="text-[10px] text-[var(--aurora-text-muted)] uppercase">Available</p><p className="text-xs font-semibold text-[var(--aurora-text)]">{h.availableDate}</p></div>}
                        {h.petPolicy && <div className="bg-[var(--aurora-surface-variant)] rounded-lg p-2.5"><p className="text-[10px] text-[var(--aurora-text-muted)] uppercase">Pets</p><p className="text-xs font-semibold text-[var(--aurora-text)]">{h.petPolicy}</p></div>}
                        {h.parking && <div className="bg-[var(--aurora-surface-variant)] rounded-lg p-2.5"><p className="text-[10px] text-[var(--aurora-text-muted)] uppercase">Parking</p><p className="text-xs font-semibold text-[var(--aurora-text)]">{h.parking}</p></div>}
                      </div>
                    )}
                    {/* Tags */}
                    {h.tags && h.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {h.tags.map((t) => <span key={t} className="bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] text-[11px] px-2 py-0.5 rounded-full">{t}</span>)}
                      </div>
                    )}
                    {/* Contact */}
                    {(h.contactPhone || h.contactEmail) && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-[var(--aurora-text-muted)] uppercase tracking-wider">Contact</h4>
                        {h.contactPhone && <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]"><Phone size={14} className="text-[var(--aurora-text-muted)]" />{h.contactPhone}</div>}
                        {h.contactEmail && <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]"><Mail size={14} className="text-[var(--aurora-text-muted)]" />{h.contactEmail}</div>}
                      </div>
                    )}
                    {/* Heritage */}
                    {h.heritage && (
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(h.heritage) ? h.heritage : [h.heritage]).map((tag) => (
                          <span key={tag} className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-[11px] font-medium px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Marketplace detail */}
              {listingDetail.kind === 'marketplace' && (() => {
                const m = listingDetail.data as MarketplaceDetail;
                return (
                  <>
                    {/* Price + condition */}
                    <div className="flex items-baseline gap-3">
                      <span className="text-xl font-bold text-[var(--aurora-text)]">${m.price.toLocaleString()}</span>
                      {m.negotiable && <span className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 text-[11px] font-semibold px-2 py-0.5 rounded-full">Negotiable</span>}
                    </div>
                    {(m.condition || m.category) && (
                      <div className="flex flex-wrap gap-2">
                        {m.condition && <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full">{m.condition}</span>}
                        {m.category && <span className="bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] text-xs font-medium px-2.5 py-1 rounded-full">{m.category}</span>}
                      </div>
                    )}
                    {/* Description */}
                    {m.description && <p className="text-sm text-[var(--aurora-text-secondary)] leading-relaxed">{m.description}</p>}
                    {/* Item details */}
                    {(m.brand || m.model) && (
                      <div className="grid grid-cols-2 gap-2">
                        {m.brand && <div className="bg-[var(--aurora-surface-variant)] rounded-lg p-2.5"><p className="text-[10px] text-[var(--aurora-text-muted)] uppercase">Brand</p><p className="text-xs font-semibold text-[var(--aurora-text)]">{m.brand}</p></div>}
                        {m.model && <div className="bg-[var(--aurora-surface-variant)] rounded-lg p-2.5"><p className="text-[10px] text-[var(--aurora-text-muted)] uppercase">Model</p><p className="text-xs font-semibold text-[var(--aurora-text)]">{m.model}</p></div>}
                      </div>
                    )}
                    {/* Location */}
                    {(m.location || m.locCity) && (
                      <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]">
                        <MapPin size={14} className="text-[var(--aurora-text-muted)] shrink-0" />
                        <span>{[m.location, m.locCity, m.locState].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    {/* Delivery */}
                    {m.deliveryMethod && (
                      <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]">
                        <Package size={14} className="text-[var(--aurora-text-muted)]" />
                        <span>{m.deliveryMethod}{m.shippingPrice ? ` · $${m.shippingPrice} shipping` : ''}</span>
                      </div>
                    )}
                    {/* Tags */}
                    {m.tags && m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.tags.map((t) => <span key={t} className="bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] text-[11px] px-2 py-0.5 rounded-full">{t}</span>)}
                      </div>
                    )}
                    {/* Heritage */}
                    {m.heritage && (
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(m.heritage) ? m.heritage : [m.heritage]).map((tag) => (
                          <span key={tag} className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-[11px] font-medium px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Event detail */}
              {listingDetail.kind === 'event' && (() => {
                const ev = listingDetail.data as EventDetail;
                return (
                  <>
                    {/* Type + status badges */}
                    <div className="flex flex-wrap gap-2">
                      {ev.type && <span className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 text-xs font-semibold px-2.5 py-1 rounded-full">{ev.emoji} {ev.type}</span>}
                      {ev.status && ev.status !== 'active' && <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full capitalize">{ev.status.replace(/_/g, ' ')}</span>}
                      {ev.ticket && <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full">{ev.ticket === 'free' ? 'Free' : ev.price ? `$${ev.price}` : 'Paid'}</span>}
                    </div>
                    {/* Date & time */}
                    {(ev.fullDate || ev.time) && (
                      <div className="bg-[var(--aurora-surface-variant)] rounded-xl p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                          <CalendarDays size={18} className="text-rose-500" />
                        </div>
                        <div>
                          {ev.fullDate && <p className="text-sm font-semibold text-[var(--aurora-text)]">{ev.fullDate}</p>}
                          {ev.time && <p className="text-xs text-[var(--aurora-text-muted)]">{ev.time}{ev.endTime ? ` — ${ev.endTime}` : ''}</p>}
                        </div>
                      </div>
                    )}
                    {/* Location */}
                    {(ev.location || ev.locCity) && (
                      <div className="bg-[var(--aurora-surface-variant)] rounded-xl p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                          <MapPin size={18} className="text-blue-500" />
                        </div>
                        <div>
                          {ev.location && <p className="text-sm font-semibold text-[var(--aurora-text)]">{ev.location}</p>}
                          {(ev.locCity || ev.locState) && <p className="text-xs text-[var(--aurora-text-muted)]">{[ev.locCity, ev.locState].filter(Boolean).join(', ')}</p>}
                        </div>
                      </div>
                    )}
                    {/* Description */}
                    {ev.desc && <p className="text-sm text-[var(--aurora-text-secondary)] leading-relaxed">{ev.desc}</p>}
                    {/* Organizer & attendance */}
                    {(ev.organizer || ev.count != null || ev.capacity != null) && (
                      <div className="grid grid-cols-2 gap-2">
                        {ev.organizer && <div className="bg-[var(--aurora-surface-variant)] rounded-lg p-2.5"><p className="text-[10px] text-[var(--aurora-text-muted)] uppercase">Organizer</p><p className="text-xs font-semibold text-[var(--aurora-text)]">{ev.organizer}</p></div>}
                        {ev.count != null && <div className="bg-[var(--aurora-surface-variant)] rounded-lg p-2.5"><p className="text-[10px] text-[var(--aurora-text-muted)] uppercase">Attending</p><p className="text-xs font-semibold text-[var(--aurora-text)]">{ev.count}{ev.capacity ? ` / ${ev.capacity}` : ''}</p></div>}
                      </div>
                    )}
                    {/* Contact */}
                    {(ev.contactEmail || ev.contactPhone) && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-[var(--aurora-text-muted)] uppercase tracking-wider">Contact</h4>
                        {ev.contactPhone && <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]"><Phone size={14} className="text-[var(--aurora-text-muted)]" />{ev.contactPhone}</div>}
                        {ev.contactEmail && <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]"><Mail size={14} className="text-[var(--aurora-text-muted)]" />{ev.contactEmail}</div>}
                      </div>
                    )}
                    {/* Heritage */}
                    {ev.heritage && (
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(ev.heritage) ? ev.heritage : [ev.heritage]).map((tag) => (
                          <span key={tag} className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-[11px] font-medium px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* ─── Footer action ─── */}
            <div className="shrink-0 border-t border-[var(--aurora-border)] px-4 py-3 flex gap-2">
              <button
                onClick={() => {
                  const routeMap: Record<string, string> = { post: '/feed', forum: '/forum', business: '/business', housing: '/housing', marketplace: '/marketplace', event: '/events' };
                  navigate(`${routeMap[listingDetail.kind]}?open=${listingDetail.data.id}`);
                }}
                className="flex-1 bg-aurora-indigo text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
              >
                View Full Details
              </button>
              <button
                onClick={() => setListingDetail(null)}
                className="px-4 py-2.5 bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] text-sm font-medium rounded-xl hover:bg-[var(--aurora-border)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm max-w-sm text-center animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Delete Data Confirmation Modal (two-step) */}
      {showDeleteDataConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={() => { setShowDeleteDataConfirm(false); setDeleteDataStep(1); }} role="dialog" aria-modal="true" aria-labelledby="delete-data-modal-title">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mx-4 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-data-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {deleteDataStep === 1 ? 'Delete All Data?' : 'Final Warning'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {deleteDataStep === 1
                ? 'Are you sure you want to permanently delete all your data? This cannot be undone.'
                : 'This is your final warning. All your data will be permanently deleted. Continue?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowDeleteDataConfirm(false); setDeleteDataStep(1); }} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
              <button onClick={confirmDeleteData} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
                {deleteDataStep === 1 ? 'Continue' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
