import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, Timestamp, query, where, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, MapPin, Phone, Mail, Globe, Clock, Star, ChevronRight,
  X, Plus, Heart, Sparkles, Store, ShoppingBag, Filter, ArrowLeft,
  ExternalLink, Trash2, Edit3, Loader2, Award, TrendingUp, Utensils,
  Scissors, BookOpen, Laptop, Scale, Stethoscope, Plane, Palette,
  DollarSign, Users, Briefcase, Home, ChevronDown, Building2, UtensilsCrossed,
  ChevronLeft, Upload, Image as ImageIcon, Camera, Gem, Shirt, Flower2
} from 'lucide-react';
import { useFeatureSettings } from '../../contexts/FeatureSettingsContext';
import { ETHNICITY_HIERARCHY, ETHNICITY_CHILDREN, HERITAGE_OPTIONS, PRIORITY_ETHNICITIES } from '../../constants/config';
import { ClickOutsideOverlay } from '../../components/ClickOutsideOverlay';

// ═════════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═════════════════════════════════════════════════════════════════════════════════

interface Business {
  id: string;
  name: string;
  emoji: string;
  category: string;
  desc: string;
  location: string;
  phone?: string;
  website?: string;
  email?: string;
  hours?: string;
  rating: number;
  reviews: number;
  promoted: boolean;
  bgColor: string;
  ownerId?: string;
  heritage?: string | string[];
  menu?: string;
  services?: string;
  createdAt?: any;
  // NEW enhancement fields (optional for backward compat):
  specialtyTags?: string[];
  paymentMethods?: string[];
  deliveryOptions?: string[];
  priceRange?: string;
  yearEstablished?: number;
  deals?: Deal[];
  photos?: string[];
  coverPhotoIndex?: number;
}

interface MenuItem {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  available: boolean;
  createdAt: any;
}

interface BusinessReview {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: any;
}

interface Deal {
  id: string;
  title: string;
  description?: string;
  discount?: number;
  code?: string;
  expiresAt?: any;
}

interface BusinessOrder {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  items: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: any;
}

const CATEGORIES = [
  'Arts & Entertainment',
  'Beauty & Wellness',
  'Boutique',
  'Education & Tutoring',
  'Financial Services',
  'Grocery & Market',
  'Healthcare',
  'Henna',
  'Hotels',
  'Jewelry',
  'Legal & Immigration',
  'Non-Profit',
  'Real Estate',
  'Restaurant & Food',
  'Technology',
  'Tiffin',
  'Travel & Tourism',
  'Other',
];

const CATEGORY_EMOJI_MAP: { [key: string]: string } = {
  'Arts & Entertainment': '🎭',
  'Beauty & Wellness': '💆',
  'Boutique': '👗',
  'Education & Tutoring': '📚',
  'Financial Services': '💰',
  'Grocery & Market': '🛒',
  'Healthcare': '🏥',
  'Henna': '🌿',
  'Hotels': '🏨',
  'Jewelry': '💎',
  'Legal & Immigration': '⚖️',
  'Non-Profit': '🤝',
  'Real Estate': '🏠',
  'Restaurant & Food': '🍛',
  'Technology': '💻',
  'Tiffin': '🍱',
  'Travel & Tourism': '✈️',
  'Other': '💼',
};

const CATEGORY_COLORS: { [key: string]: string } = {
  'Arts & Entertainment': '#D97706',
  'Beauty & Wellness': '#DB2777',
  'Boutique': '#E11D48',
  'Education & Tutoring': '#6366F1',
  'Financial Services': '#0369A1',
  'Grocery & Market': '#16A34A',
  'Healthcare': '#059669',
  'Henna': '#65A30D',
  'Hotels': '#8B5CF6',
  'Jewelry': '#CA8A04',
  'Legal & Immigration': '#B45309',
  'Non-Profit': '#DC2626',
  'Real Estate': '#1E40AF',
  'Restaurant & Food': '#EA580C',
  'Technology': '#7C3AED',
  'Tiffin': '#F97316',
  'Travel & Tourism': '#0D9488',
  'Other': '#6D28D9',
};

const CATEGORY_ICONS: { [key: string]: any } = {
  'Arts & Entertainment': Palette,
  'Beauty & Wellness': Scissors,
  'Boutique': Shirt,
  'Education & Tutoring': BookOpen,
  'Financial Services': DollarSign,
  'Grocery & Market': ShoppingBag,
  'Healthcare': Stethoscope,
  'Henna': Flower2,
  'Hotels': Building2,
  'Jewelry': Gem,
  'Legal & Immigration': Scale,
  'Non-Profit': Users,
  'Real Estate': Home,
  'Restaurant & Food': Utensils,
  'Technology': Laptop,
  'Tiffin': UtensilsCrossed,
  'Travel & Tourism': Plane,
  'Other': Briefcase,
};

// ═════════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════════

// Fuzzy search
const fuzzyMatch = (text: string, query: string): boolean => {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;
  if (t.includes(q)) return true;
  const queryWords = q.split(/\s+/);
  return queryWords.every((word) => {
    if (t.includes(word)) return true;
    if (word.length <= 3) return false;
    for (let i = 0; i < word.length; i++) {
      const shortened = word.slice(0, i) + word.slice(i + 1);
      if (t.includes(shortened)) return true;
    }
    return false;
  });
};

// Star rating component
const StarRating = ({ rating, reviews, size = 'sm' }: { rating: number; reviews: number; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeConfig = {
    sm: { star: 'w-3.5 h-3.5', text: 'text-xs', gap: 'gap-0.5' },
    md: { star: 'w-4 h-4', text: 'text-sm', gap: 'gap-1' },
    lg: { star: 'w-5 h-5', text: 'text-base', gap: 'gap-1' },
  };
  const config = sizeConfig[size];

  return (
    <div className={`flex items-center ${config.gap}`}>
      <Star className={`${config.star} fill-amber-400 text-amber-400`} />
      <span className={`${config.text} font-semibold text-aurora-text`}>{rating.toFixed(1)}</span>
      <span className={`${config.text} text-aurora-text-muted`}>({reviews})</span>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════════
// FORM COMPONENTS (defined outside to prevent re-mount on every keystroke)
// ═════════════════════════════════════════════════════════════════════════════════

const FormInput = ({ label, required, ...props }: any) => (
  <div>
    <label className="block text-sm font-medium text-aurora-text mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      {...props}
      className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl
                 text-sm text-aurora-text placeholder:text-aurora-text-muted
                 focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition-all"
    />
  </div>
);

const FormTextarea = ({ label, ...props }: any) => (
  <div>
    <label className="block text-sm font-medium text-aurora-text mb-1.5">{label}</label>
    <textarea
      {...props}
      className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl
                 text-sm text-aurora-text placeholder:text-aurora-text-muted resize-none
                 focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition-all"
    />
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════════
// IMAGE UTILITIES & COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════════

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

const BusinessPhotoUploader: React.FC<{
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onCoverChange: (index: number) => void;
  coverIndex: number;
}> = ({ photos, onPhotosChange, onCoverChange, coverIndex }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 5 - photos.length;
    const toProcess = Array.from(files).slice(0, remaining);
    const newPhotos = [...photos];
    for (const file of toProcess) {
      try {
        const compressed = await compressImage(file);
        newPhotos.push(compressed);
      } catch (err) {
        console.error('Error compressing image:', err);
      }
    }
    onPhotosChange(newPhotos);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-aurora-text mb-2">Photos (max 5)</h3>
      {photos.length < 5 && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-aurora-border rounded-xl p-4 flex flex-col items-center gap-2 text-aurora-text-muted hover:border-aurora-indigo hover:text-aurora-indigo transition-colors"
        >
          <Upload className="w-6 h-6" />
          <span className="text-sm">Click to upload photos</span>
          <span className="text-xs text-aurora-text-muted">PNG, JPG up to 5MB each</span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoSelect}
        className="hidden"
      />
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative group">
              <img
                src={photo}
                alt={`Photo ${idx + 1}`}
                className={`w-full h-24 object-cover rounded-lg cursor-pointer ${
                  idx === coverIndex ? 'ring-2 ring-aurora-indigo' : ''
                }`}
                onClick={() => onCoverChange(idx)}
              />
              {idx === coverIndex && (
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-aurora-indigo text-white text-[10px] font-bold rounded pointer-events-none flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-white" /> Cover
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const updated = photos.filter((_, i) => i !== idx);
                  onPhotosChange(updated);
                  if (coverIndex >= updated.length) onCoverChange(Math.max(0, updated.length - 1));
                }}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length > 0 && (
        <p className="text-xs text-aurora-text-muted mt-2">Tap a photo to set it as cover image. {photos.length}/5 uploaded.</p>
      )}
    </div>
  );
};

const BusinessPhotoCarousel: React.FC<{
  photos: string[];
  title: string;
}> = ({ photos, title }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!photos.length) return null;

  return (
    <div className="relative w-full h-full">
      <img
        src={photos[currentIndex]}
        alt={`${title} - ${currentIndex + 1}`}
        className="w-full h-full object-cover"
      />
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((p) => (p - 1 + photos.length) % photos.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((p) => (p + 1) % photos.length); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-2.5 py-0.5 rounded-full text-xs">
            {currentIndex + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════════

export default function BusinessPage() {
  const { user, userRole, userProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [reviews, setReviews] = useState<BusinessReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTinVerificationModal, setShowTinVerificationModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'services' | 'reviews'>('about');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeCollection, setActiveCollection] = useState<'all' | 'topRated' | 'new' | 'mostReviewed' | 'favorites'>('all');
  const merchantView = false; // My Businesses moved to Profile page
  const [businessReviews, setBusinessReviews] = useState<BusinessReview[]>([]);
  const [newReview, setNewReview] = useState({ rating: 5, text: '' });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusinessId, setDeleteBusinessId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const { isFeatureEnabled } = useFeatureSettings();
  const photosEnabled = isFeatureEnabled('business_photos');

  // Photo upload state
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editCoverPhotoIndex, setEditCoverPhotoIndex] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    category: CATEGORIES[0],
    desc: '',
    location: '',
    phone: '',
    website: '',
    email: '',
    hours: '',
    menu: '',
    services: '',
    priceRange: '',
    yearEstablished: new Date().getFullYear(),
    paymentMethods: [] as string[],
    deliveryOptions: [] as string[],
    specialtyTags: [] as string[],
  });

  const fetchBusinesses = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'businesses'));
      const data: Business[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        data.push({
          id: docSnap.id,
          name: d.name || '',
          emoji: d.emoji || CATEGORY_EMOJI_MAP[d.category] || '💼',
          category: d.category || '',
          desc: d.desc || '',
          location: d.location || '',
          phone: d.phone || '',
          website: d.website || '',
          email: d.email || '',
          hours: d.hours || '',
          rating: d.rating || 4.5,
          reviews: d.reviews || 0,
          promoted: d.promoted || false,
          bgColor: d.bgColor || CATEGORY_COLORS[d.category] || '#999',
          ownerId: d.ownerId,
          heritage: d.heritage,
          menu: d.menu || '',
          services: d.services || '',
          createdAt: d.createdAt,
          priceRange: d.priceRange,
          yearEstablished: d.yearEstablished,
          specialtyTags: d.specialtyTags || [],
          paymentMethods: d.paymentMethods || [],
          deliveryOptions: d.deliveryOptions || [],
          deals: d.deals || [],
          photos: d.photos || [],
          coverPhotoIndex: d.coverPhotoIndex || 0,
        });
      });
      setBusinesses(data);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (businessId: string) => {
    try {
      const q = query(collection(db, 'businessReviews'), where('businessId', '==', businessId));
      const snapshot = await getDocs(q);
      const data: BusinessReview[] = [];
      snapshot.forEach((docSnap) => {
        data.push({
          id: docSnap.id,
          businessId: docSnap.data().businessId,
          userId: docSnap.data().userId,
          userName: docSnap.data().userName,
          rating: docSnap.data().rating,
          text: docSnap.data().text,
          createdAt: docSnap.data().createdAt,
        });
      });
      // Sort client-side (newest first) to avoid composite index requirement
      data.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime;
      });
      setBusinessReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      fetchReviews(selectedBusiness.id);
    }
  }, [selectedBusiness?.id]);

  // Close heritage dropdown on click outside - handled by ClickOutsideOverlay component

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('business_favorites');
      if (saved) setFavorites(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  // Deep-link: open specific business from profile activity
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && businesses.length > 0) {
      const found = businesses.find((b: any) => b.id === openId);
      if (found) {
        setSelectedBusiness(found);
        setActiveTab('about');
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, businesses, setSearchParams]);

  const toggleFavorite = (businessId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(businessId)) next.delete(businessId);
      else next.add(businessId);
      try { localStorage.setItem('business_favorites', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const filteredBusinesses = useMemo(() => {
    let filtered = businesses;
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((b) => b.category === selectedCategory);
    }
    if (selectedHeritage.length > 0) {
      filtered = filtered.filter((b) => {
        if (Array.isArray(b.heritage)) return b.heritage.some((h: string) => selectedHeritage.includes(h));
        return b.heritage ? selectedHeritage.includes(b.heritage) : false;
      });
    }
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (b) =>
          fuzzyMatch(b.name, searchQuery) ||
          fuzzyMatch(b.category, searchQuery) ||
          fuzzyMatch(b.location, searchQuery) ||
          fuzzyMatch(b.desc, searchQuery)
      );
    }

    // Smart discovery sorting
    if (activeCollection === 'topRated') {
      filtered = filtered.sort((a, b) => b.rating - a.rating);
    } else if (activeCollection === 'new') {
      filtered = filtered.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    } else if (activeCollection === 'mostReviewed') {
      filtered = filtered.sort((a, b) => b.reviews - a.reviews);
    } else if (activeCollection === 'favorites') {
      filtered = filtered.filter((b) => favorites.has(b.id));
    } else {
      filtered = filtered.sort((a, b) => {
        if (a.promoted && !b.promoted) return -1;
        if (!a.promoted && b.promoted) return 1;
        return b.rating - a.rating;
      });
    }
    return filtered;
  }, [businesses, selectedCategory, selectedHeritage, searchQuery, activeCollection, favorites]);

  const featuredBusinesses = useMemo(() => {
    let featured = businesses.filter((b) => b.promoted);
    if (selectedCategory !== 'All') {
      featured = featured.filter((b) => b.category === selectedCategory);
    }
    if (selectedHeritage.length > 0) {
      featured = featured.filter((b) => {
        if (Array.isArray(b.heritage)) return b.heritage.some((h: string) => selectedHeritage.includes(h));
        return b.heritage ? selectedHeritage.includes(b.heritage) : false;
      });
    }
    return featured;
  }, [businesses, selectedCategory, selectedHeritage]);

  const getGoogleMapsUrl = (location: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

  const handleOpenCreateModal = () => {
    if (userProfile?.accountType !== 'business' && userRole !== 'admin') {
      setToastMessage('Only business accounts can add listings. Please switch to a business account in your Profile settings.');
      return;
    }
    if (userProfile?.isRegistered === true && userProfile?.tinValidationStatus !== 'valid' && userRole !== 'admin') {
      setShowTinVerificationModal(true);
      return;
    }
    if (userProfile?.isRegistered === false && !userProfile?.adminApproved && userRole !== 'admin') {
      setToastMessage('Your unregistered business account is pending admin approval.');
      return;
    }
    setShowCreateModal(true);
  };

  const handleAddBusiness = async () => {
    if (!formData.name.trim() || !formData.category || !formData.location.trim() || !formData.phone.trim() || !formData.email.trim()) {
      setToastMessage('Please fill in all required fields: Business Name, Category, Location, Phone, and Email');
      return;
    }
    try {
      await addDoc(collection(db, 'businesses'), {
        name: formData.name,
        category: formData.category,
        desc: formData.desc,
        location: formData.location,
        phone: formData.phone,
        website: formData.website,
        email: formData.email,
        hours: formData.hours,
        menu: formData.menu,
        services: formData.services,
        priceRange: formData.priceRange,
        yearEstablished: formData.yearEstablished,
        paymentMethods: formData.paymentMethods,
        deliveryOptions: formData.deliveryOptions,
        specialtyTags: formData.specialtyTags,
        emoji: CATEGORY_EMOJI_MAP[formData.category] || '💼',
        bgColor: CATEGORY_COLORS[formData.category] || '#999',
        rating: 4.5,
        reviews: 0,
        promoted: false,
        createdAt: Timestamp.now(),
        ownerId: user?.uid || '',
        ownerName: userProfile?.name || user?.displayName || 'Unknown',
        heritage: Array.isArray(userProfile?.heritage)
          ? userProfile.heritage
          : userProfile?.heritage
          ? [userProfile.heritage]
          : [],
        ...(formPhotos.length > 0 ? { photos: formPhotos, coverPhotoIndex: Math.min(coverPhotoIndex, formPhotos.length - 1) } : {}),
      });
      setFormPhotos([]);
      setCoverPhotoIndex(0);
      setFormData({
        name: '',
        category: CATEGORIES[0],
        desc: '',
        location: '',
        phone: '',
        website: '',
        email: '',
        hours: '',
        menu: '',
        services: '',
        priceRange: '',
        yearEstablished: new Date().getFullYear(),
        paymentMethods: [],
        deliveryOptions: [],
        specialtyTags: [],
      });
      setShowCreateModal(false);
      await fetchBusinesses();
    } catch (error) {
      console.error('Error adding business:', error);
      setToastMessage('Failed to add business. Please try again.');
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    setDeleteBusinessId(businessId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteBusiness = async () => {
    if (!deleteBusinessId) return;
    try {
      await deleteDoc(doc(db, 'businesses', deleteBusinessId));
      setBusinesses(businesses.filter((b) => b.id !== deleteBusinessId));
      setSelectedBusiness(null);
    } catch (error) {
      console.error('Error deleting business:', error);
      setToastMessage('Failed to delete business. Please try again.');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteBusinessId(null);
    }
  };

  const handleStartEdit = () => {
    if (!selectedBusiness) return;
    setEditData({
      name: selectedBusiness.name,
      desc: selectedBusiness.desc,
      location: selectedBusiness.location,
      phone: selectedBusiness.phone || '',
      website: selectedBusiness.website || '',
      email: selectedBusiness.email || '',
      hours: selectedBusiness.hours || '',
      category: selectedBusiness.category,
      menu: selectedBusiness.menu || '',
      services: selectedBusiness.services || '',
      priceRange: selectedBusiness.priceRange || '',
      yearEstablished: selectedBusiness.yearEstablished || new Date().getFullYear(),
      paymentMethods: selectedBusiness.paymentMethods || [],
      deliveryOptions: selectedBusiness.deliveryOptions || [],
      specialtyTags: selectedBusiness.specialtyTags || [],
    });
    setEditPhotos(selectedBusiness.photos || []);
    setEditCoverPhotoIndex(selectedBusiness.coverPhotoIndex || 0);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedBusiness) return;
    setSaving(true);
    try {
      const ref = doc(db, 'businesses', selectedBusiness.id);
      await updateDoc(ref, {
        name: editData.name,
        desc: editData.desc,
        location: editData.location,
        phone: editData.phone,
        website: editData.website,
        email: editData.email,
        hours: editData.hours,
        category: editData.category,
        menu: editData.menu,
        services: editData.services,
        priceRange: editData.priceRange,
        yearEstablished: editData.yearEstablished,
        paymentMethods: editData.paymentMethods,
        deliveryOptions: editData.deliveryOptions,
        specialtyTags: editData.specialtyTags,
        emoji: CATEGORY_EMOJI_MAP[editData.category] || selectedBusiness.emoji,
        bgColor: CATEGORY_COLORS[editData.category] || selectedBusiness.bgColor,
        photos: editPhotos,
        coverPhotoIndex: Math.min(editCoverPhotoIndex, Math.max(editPhotos.length - 1, 0)),
      });
      const updated = {
        ...selectedBusiness,
        ...editData,
        emoji: CATEGORY_EMOJI_MAP[editData.category] || selectedBusiness.emoji,
        bgColor: CATEGORY_COLORS[editData.category] || selectedBusiness.bgColor,
        photos: editPhotos,
        coverPhotoIndex: Math.min(editCoverPhotoIndex, Math.max(editPhotos.length - 1, 0)),
      };
      setSelectedBusiness(updated);
      setBusinesses(businesses.map((b) => (b.id === updated.id ? updated : b)));
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating business:', error);
      setToastMessage('Failed to update business. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddReview = async () => {
    if (!selectedBusiness || !user) return;
    if (!newReview.text.trim()) {
      setToastMessage('Please enter a review before submitting.');
      return;
    }
    try {
      await addDoc(collection(db, 'businessReviews'), {
        businessId: selectedBusiness.id,
        userId: user.uid,
        userName: userProfile?.name || 'Anonymous',
        rating: newReview.rating,
        text: newReview.text,
        createdAt: Timestamp.now(),
      });
      // Recalculate average rating
      const allReviews = [...businessReviews, { ...newReview, id: 'temp' }];
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      const ref = doc(db, 'businesses', selectedBusiness.id);
      await updateDoc(ref, {
        rating: avgRating,
        reviews: selectedBusiness.reviews + 1,
      });
      setNewReview({ rating: 5, text: '' });
      setShowReviewForm(false);
      await fetchReviews(selectedBusiness.id);
      await fetchBusinesses();
    } catch (error) {
      console.error('Error adding review:', error);
      setToastMessage('Failed to add review. Please try again.');
    }
  };

  const canAddBusiness = userRole === 'admin' || userRole === 'business_owner' || userProfile?.accountType === 'business';
  const isOwnerOrAdmin = (b: Business) => b.ownerId === user?.uid || userRole === 'admin';
  const ownedBusinesses = businesses.filter((b) => b.ownerId === user?.uid || userRole === 'admin');

  // Category count
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    businesses.forEach((b) => {
      counts[b.category] = (counts[b.category] || 0) + 1;
    });
    return counts;
  }, [businesses]);

  // Skeleton card
  const SkeletonCard = () => (
    <div className="bg-aurora-surface rounded-2xl border border-aurora-border overflow-hidden animate-pulse">
      <div className="h-36 bg-aurora-surface-variant shimmer" />
      <div className="p-4">
        <div className="h-4 w-3/4 bg-aurora-surface-variant shimmer rounded mb-2" />
        <div className="h-3 w-1/2 bg-aurora-surface-variant shimmer rounded mb-3" />
        <div className="flex gap-2">
          <div className="h-3 w-16 bg-aurora-surface-variant shimmer rounded" />
          <div className="h-3 w-20 bg-aurora-surface-variant shimmer rounded" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-aurora-bg">
      {/* ─── Sticky Header: Search + Category ─── */}
      <div className="sticky top-0 z-20">
      {/* ── Search & Filter Bar ── */}
      <div className="relative bg-gradient-to-br from-aurora-indigo/8 via-aurora-surface to-emerald-500/8 border-b border-aurora-border z-30">
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-3">
          {!merchantView && (
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-muted" />
                <input
                  type="text"
                  placeholder="Search restaurants, services, markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className={`w-full pl-11 pr-10 py-2.5 bg-aurora-surface border rounded-full
                             text-sm text-aurora-text placeholder:text-aurora-text-muted
                             focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all
                             ${searchFocused ? 'border-aurora-indigo shadow-md' : 'border-aurora-border'}`}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text"
                  >
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
                      : 'bg-aurora-surface border-aurora-border text-aurora-text-secondary hover:border-aurora-text-muted'
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
          )}
        </div>
      </div>

      {!merchantView && (
          <div className="bg-aurora-surface/95 backdrop-blur-md border-b border-aurora-border">
            <div className="max-w-6xl mx-auto px-4">
              <div
                ref={categoryScrollRef}
                className="flex gap-1 py-3 overflow-x-auto scrollbar-hide"
              >
                {/* All */}
                <button
                  onClick={() => setSelectedCategory('All')}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[64px] flex-shrink-0 transition-all ${
                    selectedCategory === 'All'
                      ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 text-white shadow-md'
                      : 'text-aurora-text-secondary hover:bg-aurora-surface-variant'
                  }`}
                >
                  <Store className="w-5 h-5" />
                  <span className="text-[11px] font-medium whitespace-nowrap">All</span>
                </button>
                {CATEGORIES.map((cat) => {
                  const IconComp = CATEGORY_ICONS[cat] || Store;
                  const count = categoryCounts[cat] || 0;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[64px] flex-shrink-0 transition-all ${
                        selectedCategory === cat
                          ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 text-white shadow-md'
                          : 'text-aurora-text-secondary hover:bg-aurora-surface-variant'
                      }`}
                    >
                      <IconComp className="w-5 h-5" />
                      <span className="text-[11px] font-medium whitespace-nowrap">{cat.split(' & ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Smart Discovery Collections */}
            <div className="border-t border-aurora-border bg-aurora-surface">
              <div className="max-w-6xl mx-auto px-4 py-3">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  {(['all', 'topRated', 'new', 'mostReviewed', 'favorites'] as const).map((collection) => {
                    const labels = {
                      all: 'All',
                      topRated: 'Top Rated',
                      new: 'New',
                      mostReviewed: 'Most Reviewed',
                      favorites: 'Favorites',
                    };
                    return (
                      <button
                        key={collection}
                        onClick={() => setActiveCollection(collection)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all flex items-center gap-1 ${
                          activeCollection === collection
                            ? 'bg-aurora-indigo text-white'
                            : 'bg-aurora-surface-variant text-aurora-text-secondary hover:text-aurora-text'
                        }`}
                      >
                        {collection === 'topRated' && <TrendingUp className="w-3 h-3" />}
                        {collection === 'favorites' && <Heart className="w-3 h-3" />}
                        {labels[collection]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
      )}
      </div>{/* end sticky header wrapper */}

      {!merchantView && (
        <>
          {/* ── Content ── */}
          <div className="max-w-6xl mx-auto px-4 py-5 pb-24">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-aurora-text-secondary">
                {loading ? 'Loading...' : (
                  <>
                    <span className="font-semibold text-aurora-text">{filteredBusinesses.length}</span>
                    {' '}business{filteredBusinesses.length !== 1 ? 'es' : ''}
                    {selectedCategory !== 'All' && <> in <span className="font-medium text-aurora-text">{selectedCategory}</span></>}
                    {selectedHeritage.length > 0 && <> · {selectedHeritage.join(', ')}</>}
                  </>
                )}
              </p>
              {(selectedCategory !== 'All' || selectedHeritage.length > 0 || searchQuery || activeCollection !== 'all') && (
                <button
                  onClick={() => { setSelectedCategory('All'); setSelectedHeritage([]); setSearchQuery(''); setActiveCollection('all'); }}
                  className="text-xs text-aurora-indigo font-medium flex items-center gap-1 hover:text-aurora-indigo/80"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>

            {/* Featured Carousel */}
            {featuredBusinesses.length > 0 && !searchQuery && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-aurora-text flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    Featured
                  </h2>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                  {featuredBusinesses.map((business) => (
                    <div
                      key={business.id}
                      className="flex-shrink-0 w-80 rounded-2xl overflow-hidden cursor-pointer group
                                 shadow-sm hover:shadow-lg transition-all duration-200 border border-aurora-border"
                      onClick={() => { setSelectedBusiness(business); setActiveTab('about'); }}
                    >
                      {/* Color banner */}
                      <div
                        className="relative h-28 flex items-end p-4 overflow-hidden"
                        style={{
                          background: business.photos?.length ? '#000' : `linear-gradient(135deg, ${business.bgColor}, ${business.bgColor}dd)`,
                        }}
                      >
                        {business.photos && business.photos.length > 0 ? (
                          <img
                            src={business.photos[business.coverPhotoIndex || 0]}
                            alt={business.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute top-3 left-3">
                          <span className="px-2.5 py-1 bg-amber-400 text-amber-900 text-[11px] font-bold rounded-lg flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> FEATURED
                          </span>
                        </div>
                        <button
                          onClick={(e) => toggleFavorite(business.id, e)}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center
                                     hover:bg-white transition-colors shadow-sm"
                        >
                          <Heart className={`w-4 h-4 ${favorites.has(business.id) ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                        </button>
                        <div className="relative flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">
                            {business.emoji}
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-base leading-tight">{business.name}</h3>
                            <p className="text-white/80 text-xs">{business.category}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-aurora-surface p-3">
                        <p className="text-xs text-aurora-text-secondary line-clamp-1 mb-2">{business.desc}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-semibold text-aurora-text">{business.rating.toFixed(1)}</span>
                            <span className="text-xs text-aurora-text-muted">({business.reviews})</span>
                          </div>
                          <span className="text-xs text-aurora-text-muted flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {business.location || 'No location'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-aurora-surface-variant flex items-center justify-center mb-4">
                  <Store className="w-7 h-7 text-aurora-text-muted" />
                </div>
                <h3 className="text-lg font-semibold text-aurora-text mb-1">No businesses found</h3>
                <p className="text-sm text-aurora-text-secondary max-w-xs">
                  {searchQuery
                    ? `No results for "${searchQuery}". Try a different search.`
                    : selectedHeritage.length > 0
                    ? `No businesses under "${selectedHeritage.join(', ')}" heritage yet.`
                    : selectedCategory !== 'All'
                    ? `No businesses in "${selectedCategory}" yet.`
                    : 'No businesses listed yet. Be the first!'}
                </p>
                {canAddBusiness && (
                  <button
                    onClick={handleOpenCreateModal}
                    className="mt-4 px-5 py-2 bg-aurora-indigo text-white rounded-xl font-medium text-sm
                               hover:bg-aurora-indigo/90 shadow-sm flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Business
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBusinesses.map((business) => {
                  const CategoryIcon = CATEGORY_ICONS[business.category] || Store;
                  const heritageArr = business.heritage
                    ? (Array.isArray(business.heritage) ? business.heritage : [business.heritage])
                    : [];

                  return (
                    <div
                      key={business.id}
                      className="group bg-aurora-surface rounded-2xl border border-aurora-border overflow-hidden
                                 cursor-pointer hover:shadow-lg hover:border-aurora-border/80 transition-all duration-200"
                      onClick={() => { setSelectedBusiness(business); setActiveTab('about'); }}
                    >
                      {/* Card Image Area */}
                      <div
                        className="relative h-36 flex items-center justify-center overflow-hidden"
                        style={{
                          background: business.photos?.length ? undefined : `linear-gradient(135deg, ${business.bgColor}22, ${business.bgColor}44)`,
                        }}
                      >
                        {business.photos && business.photos.length > 0 ? (
                          <img
                            src={business.photos[business.coverPhotoIndex || 0]}
                            alt={business.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <span className="text-6xl opacity-80 group-hover:scale-110 transition-transform duration-200">
                            {business.emoji}
                          </span>
                        )}

                        <button
                          onClick={(e) => toggleFavorite(business.id, e)}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 dark:bg-aurora-surface/90
                                     flex items-center justify-center hover:bg-white dark:hover:bg-aurora-surface
                                     transition-colors shadow-sm"
                        >
                          <Heart className={`w-4 h-4 transition-colors ${
                            favorites.has(business.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'
                          }`} />
                        </button>

                        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                          {business.promoted && (
                            <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-md flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> FEATURED
                            </span>
                          )}
                          {business.rating >= 4.5 && business.reviews > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-md">
                              TOP RATED
                            </span>
                          )}
                          {business.deals && business.deals.length > 0 && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-md flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> DEAL
                            </span>
                          )}
                        </div>

                        <div
                          className="absolute bottom-3 left-3 w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md"
                          style={{ backgroundColor: business.bgColor }}
                        >
                          <CategoryIcon className="w-4.5 h-4.5" />
                        </div>
                      </div>

                      {/* Card Info */}
                      <div className="p-4">
                        <h3 className="font-semibold text-aurora-text text-[15px] leading-tight mb-0.5 line-clamp-1 group-hover:text-aurora-indigo transition-colors">
                          {business.name}
                        </h3>
                        <p className="text-xs text-aurora-text-muted mb-2">{business.category}</p>

                        <div className="flex items-center justify-between mb-2.5">
                          <StarRating rating={business.rating} reviews={business.reviews} size="sm" />
                          {business.location && (
                            <span className="text-xs text-aurora-text-muted flex items-center gap-0.5 truncate max-w-[140px]">
                              <MapPin className="w-3 h-3 flex-shrink-0" /> {business.location}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-aurora-text-secondary line-clamp-2 mb-2.5">
                          {business.desc || 'No description provided.'}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex gap-1 flex-wrap">
                            {heritageArr.slice(0, 2).map((h) => (
                              <span key={h} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20">
                                {h}
                              </span>
                            ))}
                          </div>
                          {business.phone && (
                            <span className="text-[11px] text-aurora-text-muted flex items-center gap-0.5">
                              <Phone className="w-3 h-3" /> {business.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Merchant Dashboard View */}
      {merchantView && canAddBusiness && (
        <div className="max-w-6xl mx-auto px-4 py-5 pb-24">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-aurora-text">Your Businesses</h2>
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-aurora-indigo text-white rounded-xl
                           font-medium text-sm hover:bg-aurora-indigo/90 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add New
              </button>
            </div>

            {ownedBusinesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-aurora-surface rounded-2xl border border-aurora-border">
                <Store className="w-12 h-12 text-aurora-text-muted mb-3" />
                <p className="text-aurora-text font-medium mb-1">No businesses yet</p>
                <p className="text-sm text-aurora-text-secondary mb-4">Create your first business listing</p>
                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 bg-aurora-indigo text-white rounded-xl font-medium text-sm hover:bg-aurora-indigo/90"
                >
                  <Plus className="w-4 h-4 inline mr-1.5" /> Add Business
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ownedBusinesses.map((business) => (
                  <div key={business.id} className="bg-aurora-surface rounded-2xl border border-aurora-border p-4 hover:shadow-lg transition-all">
                    {business.photos && business.photos.length > 0 && (
                      <div className="relative h-28 -mx-4 -mt-4 mb-3 rounded-t-2xl overflow-hidden">
                        <img
                          src={business.photos[business.coverPhotoIndex || 0]}
                          alt={business.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{business.emoji}</div>
                        <div>
                          <h3 className="font-bold text-aurora-text">{business.name}</h3>
                          <p className="text-xs text-aurora-text-muted">{business.category}</p>
                        </div>
                      </div>
                      {business.promoted && (
                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded">
                          FEATURED
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 mb-4 text-sm">
                      {business.location && (
                        <p className="text-aurora-text-secondary flex items-center gap-2">
                          <MapPin className="w-4 h-4 flex-shrink-0" /> {business.location}
                        </p>
                      )}
                      {business.phone && (
                        <p className="text-aurora-text-secondary flex items-center gap-2">
                          <Phone className="w-4 h-4 flex-shrink-0" /> {business.phone}
                        </p>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-aurora-text font-semibold">{business.rating.toFixed(1)}</span>
                          <span className="text-aurora-text-muted text-xs">({business.reviews})</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelectedBusiness(business); setActiveTab('about'); }}
                        className="flex-1 px-3 py-2 bg-aurora-surface-variant text-aurora-text rounded-lg text-sm font-medium hover:bg-aurora-border/30 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => { setSelectedBusiness(business); handleStartEdit(); }}
                        className="flex-1 px-3 py-2 bg-aurora-indigo text-white rounded-lg text-sm font-medium hover:bg-aurora-indigo/90 transition-colors flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-4 h-4" /> Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Business Detail Modal ===== */}
      {selectedBusiness && !isEditing && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedBusiness(null)}
        >
          <div
            className="bg-aurora-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl
                       max-h-[92vh] flex flex-col border border-aurora-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero Banner */}
            <div
              className="relative h-40 sm:rounded-t-2xl flex items-end p-5 overflow-hidden"
              style={{
                background: selectedBusiness.photos?.length ? '#000' : `linear-gradient(135deg, ${selectedBusiness.bgColor}, ${selectedBusiness.bgColor}cc)`,
              }}
            >
              {selectedBusiness.photos && selectedBusiness.photos.length > 0 && (
                <div className="absolute inset-0">
                  <BusinessPhotoCarousel photos={selectedBusiness.photos} title={selectedBusiness.name} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent sm:rounded-t-2xl" />
              <button
                onClick={() => setSelectedBusiness(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => toggleFavorite(selectedBusiness.id, e)}
                className="absolute top-3 right-14 w-8 h-8 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <Heart className={`w-4 h-4 ${favorites.has(selectedBusiness.id) ? 'fill-red-400 text-red-400' : 'text-white'}`} />
              </button>
              {selectedBusiness.promoted && (
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 bg-amber-400 text-amber-900 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> FEATURED
                  </span>
                </div>
              )}
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl">
                  {selectedBusiness.emoji}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white leading-tight">{selectedBusiness.name}</h2>
                  <p className="text-white/80 text-sm">{selectedBusiness.category}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                    <span className="text-white font-semibold text-sm">{selectedBusiness.rating.toFixed(1)}</span>
                    <span className="text-white/70 text-xs">({selectedBusiness.reviews} reviews)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Content - Single scroll layout */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-6">

                {/* ── About Section ── */}
                {selectedBusiness.desc && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">About</h4>
                    <p className="text-sm text-aurora-text-secondary leading-relaxed">{selectedBusiness.desc}</p>
                  </div>
                )}

                {/* Quick Info Row */}
                {(selectedBusiness.yearEstablished || selectedBusiness.priceRange) && (
                  <div className="flex gap-3 flex-wrap">
                    {selectedBusiness.yearEstablished && (
                      <div className="flex-1 min-w-[120px] bg-aurora-surface-variant rounded-xl p-3 text-center">
                        <p className="text-[10px] font-semibold text-aurora-text-muted uppercase tracking-wider">Established</p>
                        <p className="text-sm font-bold text-aurora-text mt-1">{selectedBusiness.yearEstablished}</p>
                      </div>
                    )}
                    {selectedBusiness.priceRange && (
                      <div className="flex-1 min-w-[120px] bg-aurora-surface-variant rounded-xl p-3 text-center">
                        <p className="text-[10px] font-semibold text-aurora-text-muted uppercase tracking-wider">Price Range</p>
                        <p className="text-sm font-bold text-aurora-text mt-1">{selectedBusiness.priceRange}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedBusiness.heritage && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Heritage</h4>
                    <div className="flex gap-2 flex-wrap">
                      {(Array.isArray(selectedBusiness.heritage) ? selectedBusiness.heritage : [selectedBusiness.heritage]).map((h) => (
                        <span key={h} className="text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-200/50 dark:border-amber-500/20">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedBusiness.specialtyTags && selectedBusiness.specialtyTags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Specialties</h4>
                    <div className="flex gap-2 flex-wrap">
                      {selectedBusiness.specialtyTags.map((tag) => (
                        <span key={tag} className="text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedBusiness.paymentMethods && selectedBusiness.paymentMethods.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Payment Methods</h4>
                    <div className="flex gap-2 flex-wrap">
                      {selectedBusiness.paymentMethods.map((method) => (
                        <span key={method} className="text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-3 py-1 rounded-full">
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Contact Section ── */}
                <div>
                  <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Contact</h4>
                  <div className="space-y-2">
                    {selectedBusiness.location && (
                      <a
                        href={getGoogleMapsUrl(selectedBusiness.location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-aurora-indigo/10 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-aurora-indigo" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aurora-text truncate">{selectedBusiness.location}</p>
                          <p className="text-xs text-aurora-indigo mt-0.5">Open in Google Maps</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-aurora-text-muted flex-shrink-0" />
                      </a>
                    )}
                    {selectedBusiness.phone && (
                      <a
                        href={`tel:${selectedBusiness.phone}`}
                        className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                          <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aurora-text">{selectedBusiness.phone}</p>
                          <p className="text-xs text-aurora-text-muted mt-0.5">Tap to call</p>
                        </div>
                      </a>
                    )}
                    {selectedBusiness.email && (
                      <a
                        href={`mailto:${selectedBusiness.email}`}
                        className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aurora-text truncate">{selectedBusiness.email}</p>
                          <p className="text-xs text-aurora-text-muted mt-0.5">Send email</p>
                        </div>
                      </a>
                    )}
                    {selectedBusiness.website && (
                      <a
                        href={selectedBusiness.website.startsWith('http') ? selectedBusiness.website : `https://${selectedBusiness.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                          <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-aurora-indigo truncate">{selectedBusiness.website}</p>
                          <p className="text-xs text-aurora-text-muted mt-0.5">Visit website</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-aurora-text-muted flex-shrink-0" />
                      </a>
                    )}
                  </div>
                </div>

                {selectedBusiness.hours && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Hours</h4>
                    <div className="flex items-start gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3">
                      <Clock className="w-4 h-4 text-aurora-text-muted mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-aurora-text-secondary whitespace-pre-line">{selectedBusiness.hours}</p>
                    </div>
                  </div>
                )}

                {selectedBusiness.deals && selectedBusiness.deals.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Current Deals</h4>
                    <div className="space-y-2">
                      {selectedBusiness.deals.map((deal, idx) => (
                        <div key={idx} className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 border border-red-200/50 dark:border-red-500/20">
                          <h5 className="font-semibold text-red-700 dark:text-red-400 text-sm">{deal.title}</h5>
                          {deal.description && <p className="text-sm text-red-600 dark:text-red-300/80 mt-1">{deal.description}</p>}
                          {deal.discount && <p className="text-sm text-red-700 dark:text-red-400 font-bold mt-1">{deal.discount}% Off</p>}
                          {deal.code && <p className="text-xs text-red-600 dark:text-red-300/60 mt-1">Code: <span className="font-mono font-bold">{deal.code}</span></p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Divider ── */}
                <div className="border-t border-aurora-border" />

                {/* ── Services Section ── */}
                {selectedBusiness.services && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">Services Offered</h4>
                    <div className="bg-aurora-surface-variant rounded-xl p-4">
                      <p className="text-sm text-aurora-text-secondary whitespace-pre-line leading-relaxed">{selectedBusiness.services}</p>
                    </div>
                  </div>
                )}

                {selectedBusiness.menu && (
                  <div>
                    <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">
                      {selectedBusiness.category === 'Restaurant & Food' ? 'Menu' : 'Products'}
                    </h4>
                    <div className="bg-aurora-surface-variant rounded-xl p-4">
                      <p className="text-sm text-aurora-text-secondary whitespace-pre-line leading-relaxed">{selectedBusiness.menu}</p>
                    </div>
                  </div>
                )}

                {!selectedBusiness.services && !selectedBusiness.menu && isOwnerOrAdmin(selectedBusiness) && (
                  <div className="text-center py-6 bg-aurora-surface-variant rounded-xl">
                    <ShoppingBag className="w-6 h-6 text-aurora-text-muted mx-auto mb-2" />
                    <p className="text-sm text-aurora-text-muted mb-1">No services or menu listed yet</p>
                    <button
                      onClick={handleStartEdit}
                      className="mt-1 text-sm text-aurora-indigo font-medium hover:underline"
                    >
                      Add services info
                    </button>
                  </div>
                )}

                {/* ── Divider ── */}
                <div className="border-t border-aurora-border" />

                {/* ── Reviews Section ── */}
                <div className="space-y-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Reviews</h4>
                      {businessReviews.length > 0 && (
                        <p className="text-sm text-aurora-text mt-1">{businessReviews.length} review{businessReviews.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                    {!showReviewForm && user && businessReviews.length > 0 && (
                      <button
                        onClick={() => setShowReviewForm(true)}
                        className="px-3 py-1.5 bg-aurora-indigo text-white rounded-lg text-xs font-medium hover:bg-aurora-indigo/90 transition-colors flex items-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5" />
                        Write a Review
                      </button>
                    )}
                  </div>

                  {showReviewForm && (
                    <div className="space-y-4 bg-aurora-surface-variant rounded-xl p-4 border border-aurora-indigo/20">
                      <h4 className="text-sm font-semibold text-aurora-text">Write a Review</h4>
                      <div>
                        <label className="text-xs font-medium text-aurora-text block mb-2">Rating</label>
                        <div className="flex gap-1 mb-3">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              onClick={() => setNewReview({ ...newReview, rating })}
                              className="transition-transform hover:scale-110"
                            >
                              <Star
                                className={`w-6 h-6 ${rating <= newReview.rating ? 'fill-amber-400 text-amber-400' : 'text-aurora-border'}`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <textarea
                          placeholder="Share your experience..."
                          value={newReview.text}
                          onChange={(e) => setNewReview({ ...newReview, text: e.target.value })}
                          className="w-full px-3 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text placeholder:text-aurora-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowReviewForm(false); setNewReview({ rating: 5, text: '' }); }}
                          className="flex-1 px-3 py-2.5 bg-aurora-surface text-aurora-text rounded-xl text-sm font-medium hover:bg-aurora-border/30 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddReview}
                          className="flex-1 px-3 py-2.5 bg-aurora-indigo text-white rounded-xl text-sm font-medium hover:bg-aurora-indigo/90 transition-colors"
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  )}

                  {businessReviews.length > 0 ? (
                    <div className="space-y-3">
                      {businessReviews.map((review) => (
                        <div key={review.id} className="bg-aurora-surface-variant rounded-xl p-3.5">
                          <div className="flex items-start justify-between mb-1.5">
                            <div>
                              <p className="text-sm font-semibold text-aurora-text">{review.userName}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-aurora-border'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-aurora-text-secondary leading-relaxed">{review.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : !showReviewForm ? (
                    <div className="text-center py-8">
                      <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                        <Star className="w-6 h-6 text-amber-500" />
                      </div>
                      <p className="text-sm font-medium text-aurora-text mb-1">No reviews yet</p>
                      <p className="text-xs text-aurora-text-muted mb-4">Be the first to share your experience</p>
                      {user && (
                        <button
                          onClick={() => setShowReviewForm(true)}
                          className="px-4 py-2 bg-aurora-indigo text-white rounded-xl text-sm font-medium hover:bg-aurora-indigo/90 transition-colors"
                        >
                          Write a Review
                        </button>
                      )}
                      {!user && (
                        <p className="text-xs text-aurora-text-secondary">Sign in to leave a review</p>
                      )}
                    </div>
                  ) : null}

                  {businessReviews.length > 0 && !showReviewForm && user && (
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="w-full px-4 py-2.5 bg-aurora-indigo/10 text-aurora-indigo rounded-xl text-sm font-medium hover:bg-aurora-indigo/20 transition-colors border border-aurora-indigo/30"
                    >
                      Add Your Review
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* Action Buttons */}
            {isOwnerOrAdmin(selectedBusiness) && (
              <div className="border-t border-aurora-border p-4 flex gap-3 bg-aurora-surface sm:rounded-b-2xl">
                <button
                  onClick={handleStartEdit}
                  className="flex-1 flex items-center justify-center gap-2 bg-aurora-indigo text-white py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 transition-colors"
                >
                  <Edit3 className="w-4 h-4" /> Edit Business
                </button>
                <button
                  onClick={() => handleDeleteBusiness(selectedBusiness.id)}
                  className="px-4 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl font-medium text-sm hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Edit Modal ===== */}
      {isEditing && selectedBusiness && (
        <div className="fixed inset-0 bg-aurora-bg z-50 flex flex-col">
          <div className="flex-shrink-0 bg-aurora-surface border-b border-aurora-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-aurora-surface-variant rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-aurora-text-secondary" />
              </button>
              <h2 className="text-lg font-bold text-aurora-text">Edit Business</h2>
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="text-aurora-text-muted hover:text-aurora-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 max-w-lg mx-auto w-full">
            <FormInput label="Business Name" required type="text" value={editData.name} onChange={(e: any) => setEditData({ ...editData, name: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-aurora-text mb-1.5">Category</label>
              <select
                value={editData.category}
                onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
              >
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <FormTextarea label="Description" value={editData.desc} onChange={(e: any) => setEditData({ ...editData, desc: e.target.value })} rows={3} />
            {photosEnabled && (
              <BusinessPhotoUploader
                photos={editPhotos}
                onPhotosChange={setEditPhotos}
                onCoverChange={setEditCoverPhotoIndex}
                coverIndex={editCoverPhotoIndex}
              />
            )}
            <FormInput label="Location / Address" type="text" value={editData.location} onChange={(e: any) => setEditData({ ...editData, location: e.target.value })} />
            <FormInput label="Phone" type="tel" value={editData.phone} onChange={(e: any) => setEditData({ ...editData, phone: e.target.value })} />
            <FormInput label="Email" type="email" value={editData.email} onChange={(e: any) => setEditData({ ...editData, email: e.target.value })} />
            <FormInput label="Website" type="url" value={editData.website} onChange={(e: any) => setEditData({ ...editData, website: e.target.value })} />
            <FormTextarea label="Business Hours" value={editData.hours} onChange={(e: any) => setEditData({ ...editData, hours: e.target.value })} rows={3} placeholder="Mon-Fri: 9am-5pm&#10;Sat: 10am-2pm&#10;Sun: Closed" />
            <FormInput label="Year Established" type="number" value={editData.yearEstablished} onChange={(e: any) => setEditData({ ...editData, yearEstablished: parseInt(e.target.value) })} />
            <FormInput label="Price Range" type="text" value={editData.priceRange} placeholder="$$-$$$" onChange={(e: any) => setEditData({ ...editData, priceRange: e.target.value })} />
            <FormTextarea label="Services" value={editData.services} onChange={(e: any) => setEditData({ ...editData, services: e.target.value })} rows={3} placeholder="List your services..." />
            <FormTextarea label={editData.category === 'Restaurant & Food' ? 'Menu' : 'Products / Merchandise'} value={editData.menu} onChange={(e: any) => setEditData({ ...editData, menu: e.target.value })} rows={4} placeholder="List your menu items or products..." />
          </div>
          <div className="sticky bottom-0 bg-aurora-surface border-t border-aurora-border p-4">
            <div className="flex gap-3 max-w-lg mx-auto">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-aurora-surface-variant text-aurora-text-secondary py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-border/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 bg-aurora-indigo text-white py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Floating Action Button ─── */}
      {canAddBusiness && (
        <button
          onClick={handleOpenCreateModal}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 aurora-gradient text-white rounded-full shadow-aurora-glow-lg flex items-center justify-center hover:shadow-aurora-4 transition-all z-10 btn-press"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {/* ===== Create Modal ===== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-aurora-bg z-50 flex flex-col">
          <div className="flex-shrink-0 bg-aurora-surface border-b border-aurora-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowCreateModal(false); setFormPhotos([]); setCoverPhotoIndex(0); }} className="p-1 hover:bg-aurora-surface-variant rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-aurora-text-secondary" />
              </button>
              <h2 className="text-lg font-bold text-aurora-text">Add Business</h2>
            </div>
            <button
              onClick={() => { setShowCreateModal(false); setFormPhotos([]); setCoverPhotoIndex(0); }}
              className="text-aurora-text-muted hover:text-aurora-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 max-w-lg mx-auto w-full">
            <FormInput label="Business Name" required type="text" value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter business name" />
            <div>
              <label className="block text-sm font-medium text-aurora-text mb-1.5">Category <span className="text-red-500">*</span></label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
              >
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{CATEGORY_EMOJI_MAP[cat]} {cat}</option>)}
              </select>
            </div>
            <FormTextarea label="Description" value={formData.desc} onChange={(e: any) => setFormData({ ...formData, desc: e.target.value })} rows={3} placeholder="Tell customers about your business..." />
            {photosEnabled && (
              <BusinessPhotoUploader
                photos={formPhotos}
                onPhotosChange={setFormPhotos}
                onCoverChange={setCoverPhotoIndex}
                coverIndex={coverPhotoIndex}
              />
            )}
            <FormInput label="Location / Address" required type="text" value={formData.location} onChange={(e: any) => setFormData({ ...formData, location: e.target.value })} placeholder="123 Main St, City, State" />
            <FormInput label="Phone" required type="tel" value={formData.phone} onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })} placeholder="(555) 123-4567" />
            <FormInput label="Email" required type="email" value={formData.email} onChange={(e: any) => setFormData({ ...formData, email: e.target.value })} placeholder="contact@business.com" />
            <FormInput label="Website" type="url" value={formData.website} onChange={(e: any) => setFormData({ ...formData, website: e.target.value })} placeholder="https://www.mybusiness.com" />
            <FormTextarea label="Business Hours" value={formData.hours} onChange={(e: any) => setFormData({ ...formData, hours: e.target.value })} rows={3} placeholder="Mon-Fri: 9am-5pm&#10;Sat: 10am-2pm&#10;Sun: Closed" />
            <FormInput label="Year Established" type="number" value={formData.yearEstablished} onChange={(e: any) => setFormData({ ...formData, yearEstablished: parseInt(e.target.value) })} />
            <FormInput label="Price Range" type="text" value={formData.priceRange} placeholder="$$-$$$" onChange={(e: any) => setFormData({ ...formData, priceRange: e.target.value })} />
            <FormTextarea label="Services" value={formData.services} onChange={(e: any) => setFormData({ ...formData, services: e.target.value })} rows={3} placeholder="List your services..." />
            <FormTextarea label={formData.category === 'Restaurant & Food' ? 'Menu' : 'Products / Merchandise'} value={formData.menu} onChange={(e: any) => setFormData({ ...formData, menu: e.target.value })} rows={4} placeholder="List your menu items or products..." />
          </div>
          <div className="sticky bottom-0 bg-aurora-surface border-t border-aurora-border p-4">
            <div className="max-w-lg mx-auto">
              <button
                onClick={handleAddBusiness}
                className="w-full bg-aurora-indigo text-white py-3 rounded-xl font-semibold text-sm hover:bg-aurora-indigo/90 shadow-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Business
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TIN Verification Modal */}
      {showTinVerificationModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowTinVerificationModal(false)}
        >
          <div
            className="bg-aurora-surface rounded-2xl shadow-2xl max-w-md w-full p-6 border border-aurora-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                <Scale className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-aurora-text">TIN Verification Required</h2>
              <p className="text-sm text-aurora-text-secondary mt-2">
                Your registered business TIN/EIN must be verified before you can create listings.
              </p>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={() => { setShowTinVerificationModal(false); window.location.href = '/profile'; }}
                className="w-full bg-aurora-indigo text-white py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 transition-colors"
              >
                Go to Profile
              </button>
              <button
                onClick={() => setShowTinVerificationModal(false)}
                className="w-full bg-aurora-surface-variant text-aurora-text-secondary py-2.5 rounded-xl font-medium text-sm hover:bg-aurora-border/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Business Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={() => { setShowDeleteConfirm(false); setDeleteBusinessId(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Business?</h3>
              <p className="text-sm text-gray-500 mb-5">
                Are you sure you want to delete this business listing? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteBusinessId(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteBusiness}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg z-[80] text-sm font-medium max-w-md text-center">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
