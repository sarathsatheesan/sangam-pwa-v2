import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  Timestamp,
  increment,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureSettings } from '@/contexts/FeatureSettingsContext';
import {
  Search,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Globe,
  Heart,
  Eye,
  Share2,
  MapPin,
  Clock,
  Check,
  AlertCircle,
  Upload,
  Star,
  Edit2,
  Trash2,
  Send,
  Tag,
  Truck,
  Package,
  Home,
  Car,
  Shirt,
  Zap,
  Music,
  Dumbbell,
  Gamepad2,
  Sofa,
  Hammer,
  Building2,
  Gauge,
  Briefcase,
  PawPrint,
  Leaf,
  Trophy,
  Shirt as ShirtIcon,
  Wrench,
  Layers,
  MessageCircle,
  Flag,
  Phone,
  Mail,
  MessageSquare,
} from 'lucide-react';

// TYPE DEFINITIONS
interface MarketplaceItem {
  id: string;
  title: string;
  price: string;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  description: string;
  photos: string[];
  location: string;
  locCity: string;
  locState: string;
  locZip: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  createdAt: any;
  status: 'available' | 'pending' | 'sold';
  featured: boolean;
  viewCount: number;
  saveCount: number;
  brand?: string;
  model?: string;
  color?: string;
  size?: string;
  material?: string;
  dimensions?: string;
  weight?: string;
  sku?: string;
  deliveryMethod: 'pickup' | 'shipping' | 'both';
  shippingPrice?: string;
  negotiable: boolean;
  tags: string[];
  videoUrl?: string;
  heritage?: string[];
}

interface Comment {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: any;
}

const HERITAGE_OPTIONS = [
  'Indian', 'Pakistani', 'Bangladeshi', 'Sri Lankan', 'Nepali',
  'Bhutanese', 'Maldivian', 'Afghan', 'Other Asian', 'Mixed Heritage', 'Other',
];

const CATEGORIES = [
  'Vehicles',
  'Apparel',
  'Electronics',
  'Entertainment',
  'Family',
  'Free Stuff',
  'Garden & Outdoor',
  'Hobbies',
  'Home Goods',
  'Home Improvement',
  'Musical Instruments',
  'Office Supplies',
  'Pet Supplies',
  'Sporting Goods',
  'Toys & Games',
  'Buy & Sell Groups',
  'Classifieds',
  'Miscellaneous',
];

const AVAILABLE_TAGS = [
  'Handmade',
  'Vintage',
  'Organic',
  'Local Pickup',
  'Free Delivery',
  'Bundle Deal',
  'Limited Edition',
  'Certified',
  'Warranty',
  'Returnable',
];

const CATEGORY_ICONS: { [key: string]: React.ReactNode } = {
  Vehicles: <Car className="w-5 h-5" />,
  Apparel: <Shirt className="w-5 h-5" />,
  Electronics: <Zap className="w-5 h-5" />,
  Entertainment: <Music className="w-5 h-5" />,
  Family: <Home className="w-5 h-5" />,
  'Free Stuff': <Gift className="w-5 h-5" />,
  'Garden & Outdoor': <Leaf className="w-5 h-5" />,
  Hobbies: <Gamepad2 className="w-5 h-5" />,
  'Home Goods': <Sofa className="w-5 h-5" />,
  'Home Improvement': <Hammer className="w-5 h-5" />,
  'Musical Instruments': <Music className="w-5 h-5" />,
  'Office Supplies': <Briefcase className="w-5 h-5" />,
  'Pet Supplies': <PawPrint className="w-5 h-5" />,
  'Sporting Goods': <Dumbbell className="w-5 h-5" />,
  'Toys & Games': <Gamepad2 className="w-5 h-5" />,
  'Buy & Sell Groups': <Users className="w-5 h-5" />,
  Classifieds: <Layers className="w-5 h-5" />,
  Miscellaneous: <Wrench className="w-5 h-5" />,
};

const CATEGORY_COLORS: { [key: string]: string } = {
  Vehicles: 'from-blue-500 to-blue-600',
  Apparel: 'from-pink-500 to-rose-600',
  Electronics: 'from-purple-500 to-indigo-600',
  Entertainment: 'from-red-500 to-rose-600',
  Family: 'from-green-500 to-emerald-600',
  'Free Stuff': 'from-cyan-500 to-blue-600',
  'Garden & Outdoor': 'from-lime-500 to-green-600',
  Hobbies: 'from-violet-500 to-purple-600',
  'Home Goods': 'from-orange-500 to-amber-600',
  'Home Improvement': 'from-yellow-600 to-orange-600',
  'Musical Instruments': 'from-fuchsia-500 to-pink-600',
  'Office Supplies': 'from-slate-500 to-gray-600',
  'Pet Supplies': 'from-orange-400 to-yellow-500',
  'Sporting Goods': 'from-indigo-500 to-blue-600',
  'Toys & Games': 'from-pink-400 to-rose-500',
  'Buy & Sell Groups': 'from-green-600 to-emerald-700',
  Classifieds: 'from-gray-500 to-slate-600',
  Miscellaneous: 'from-indigo-500 to-purple-600',
};

const CONDITION_LABELS: { [key: string]: string } = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'For Parts',
};

// UTILITY FUNCTIONS
const formatPrice = (price: string) => {
  const num = parseFloat(price);
  if (isNaN(num) || num === 0) return 'FREE';
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toLocaleString()}`;
};

const timeAgo = (timestamp: any) => {
  if (!timestamp) return 'Recently';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

// SUB-COMPONENTS (defined outside main component)

const FormField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}> = ({ label, value, onChange, type = 'text', placeholder, required, error }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-[var(--aurora-text)] mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-2 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-lg text-[var(--aurora-text)] placeholder-[var(--aurora-text-muted)] focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

const FormTextarea: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}> = ({ label, value, onChange, placeholder, required, rows = 4 }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-[var(--aurora-text)] mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-2 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-lg text-[var(--aurora-text)] placeholder-[var(--aurora-text-muted)] focus:outline-none focus:ring-2 focus:ring-aurora-indigo resize-none"
    />
  </div>
);

const SkeletonCard: React.FC = () => (
  <div className="bg-[var(--aurora-surface)] rounded-lg overflow-hidden border border-[var(--aurora-border)] animate-pulse">
    <div className="w-full h-48 bg-[var(--aurora-surface-variant)]" />
    <div className="p-4 space-y-2">
      <div className="h-4 bg-[var(--aurora-surface-variant)] rounded w-3/4" />
      <div className="h-5 bg-[var(--aurora-surface-variant)] rounded w-1/2" />
      <div className="h-3 bg-[var(--aurora-surface-variant)] rounded w-2/3" />
    </div>
  </div>
);

const PhotoCarousel: React.FC<{
  photos: string[];
  title: string;
  onClose: () => void;
}> = ({ photos, title, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!photos.length) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center rounded-lg">
        <Image className="w-12 h-12 text-gray-600" />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <img
        src={photos[currentIndex]}
        alt={`${title} - ${currentIndex + 1}`}
        className="w-full h-auto rounded-lg object-cover"
      />
      {photos.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex((p) => (p - 1 + photos.length) % photos.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentIndex((p) => (p + 1) % photos.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
            {currentIndex + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
};

const PhotoUploader: React.FC<{
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onCoverChange: (index: number) => void;
  coverIndex: number;
}> = ({ photos, onPhotosChange, onCoverChange, coverIndex }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file);
        newPhotos.push(compressed);
      } catch (err) {
        console.error('Error compressing image:', err);
      }
    }
    if (newPhotos.length > 0) {
      onPhotosChange([...photos, ...newPhotos]);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[var(--aurora-text)] mb-2">
        Photos <span className="text-red-500">*</span>
      </label>
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-[var(--aurora-border)] rounded-lg p-6 text-center cursor-pointer hover:border-aurora-indigo hover:bg-aurora-indigo/5 transition-colors"
      >
        <Upload className="w-8 h-8 text-[var(--aurora-text-muted)] mx-auto mb-2" />
        <p className="text-sm text-[var(--aurora-text)]">Click or drag photos here</p>
        <p className="text-xs text-[var(--aurora-text-muted)]">PNG, JPG, GIF up to 5MB</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative group">
              <img
                src={photo}
                alt={`Photo ${idx + 1}`}
                className={`w-full h-24 object-cover rounded cursor-pointer ${
                  idx === coverIndex ? 'ring-2 ring-aurora-indigo' : ''
                }`}
                onClick={() => onCoverChange(idx)}
              />
              {idx === coverIndex && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                </div>
              )}
              <button
                onClick={() => onPhotosChange(photos.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MarketplaceCard: React.FC<{
  item: MarketplaceItem;
  onViewDetails: (item: MarketplaceItem) => void;
  isSaved: boolean;
  onSaveToggle: (itemId: string) => void;
  isListView?: boolean;
}> = ({ item, onViewDetails, isSaved, onSaveToggle, isListView }) => {
  const coverPhoto = item.photos[0];
  const categoryGradient = CATEGORY_COLORS[item.category] || 'from-indigo-500 to-purple-600';

  const cardContent = (
    <>
      <div className="relative h-36 overflow-hidden">
        {coverPhoto ? (
          <img src={coverPhoto} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${categoryGradient} flex items-center justify-center`}>
            {CATEGORY_ICONS[item.category] && (
              <div className="text-white/60">{CATEGORY_ICONS[item.category]}</div>
            )}
          </div>
        )}
        {item.status === 'sold' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-lg">SOLD</span>
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          <span className="bg-black/70 text-white px-2 py-0.5 rounded-md text-[10px] font-semibold w-fit">
            {CONDITION_LABELS[item.condition] || item.condition}
          </span>
          {item.featured && (
            <span className="bg-amber-400 text-amber-900 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 w-fit">
              <Star className="w-2.5 h-2.5 fill-current" /> FEATURED
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSaveToggle(item.id);
          }}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
        >
          <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
        </button>
        {item.createdAt && (
          <span className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> {timeAgo(item.createdAt)}
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="flex justify-between items-start mb-1">
          <div className="text-base font-bold text-aurora-indigo">{formatPrice(item.price)}</div>
          {item.negotiable && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">OBO</span>}
        </div>

        <h3 className="font-semibold text-[var(--aurora-text)] text-sm line-clamp-1">{item.title}</h3>

        {item.brand && <p className="text-[11px] text-[var(--aurora-text-muted)]">{item.brand}</p>}

        <p className="text-xs text-[var(--aurora-text-muted)] flex items-center gap-1 mt-1.5 truncate">
          <MapPin className="w-3 h-3 shrink-0" /> {item.locCity}, {item.locState}
        </p>

        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--aurora-border)]">
          <div className="flex gap-2.5 text-xs">
            <span className="flex items-center gap-1 text-[var(--aurora-text-muted)]">
              <Eye className="w-3.5 h-3.5" /> {item.viewCount || 0}
            </span>
            <span className="flex items-center gap-1 text-[var(--aurora-text-muted)]">
              <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} /> {item.saveCount || 0}
            </span>
          </div>
          <button onClick={(e) => e.stopPropagation()} className="text-[var(--aurora-text-muted)] hover:text-aurora-indigo transition-colors">
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      onClick={() => onViewDetails(item)}
      className="group bg-aurora-surface rounded-2xl overflow-hidden border border-aurora-border hover:shadow-lg hover:border-aurora-border/80 transition-all duration-200 cursor-pointer"
    >
      {cardContent}
    </div>
  );
};

// MAIN COMPONENT
export default function MarketplacePage() {
  const { user, userProfile, userRole } = useAuth();
  const { isFeatureEnabled } = useFeatureSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [listings, setListings] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [savedItems, setSavedItems] = useState<string[]>([]);
  const myListings = false; // My Listings moved to Profile page
  const [selectedHeritage, setSelectedHeritage] = useState<string[]>([]);
  const [heritageDropdownOpen, setHeritageDropdownOpen] = useState(false);
  const heritageRef = useRef<HTMLDivElement>(null);
  const [comments, setComments] = useState<{ [key: string]: Comment[] }>({});
  const [newComment, setNewComment] = useState('');
  const [editingItem, setEditingItem] = useState<MarketplaceItem | null>(null);

  // Delete confirmation modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: CATEGORIES[0],
    condition: 'new' as 'new' | 'like_new' | 'good' | 'fair' | 'poor',
    description: '',
    location: '',
    locCity: '',
    locState: '',
    locZip: '',
    brand: '',
    model: '',
    color: '',
    size: '',
    material: '',
    dimensions: '',
    weight: '',
    sku: '',
    deliveryMethod: 'pickup' as 'pickup' | 'shipping' | 'both',
    shippingPrice: '',
    negotiable: false,
    videoUrl: '',
  });
  const [formHeritage, setFormHeritage] = useState<string[]>(() => {
    if (Array.isArray(userProfile?.heritage)) return userProfile.heritage;
    if (userProfile?.heritage) return [userProfile.heritage];
    return [];
  });
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Close heritage dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (heritageRef.current && !heritageRef.current.contains(event.target as Node)) {
        setHeritageDropdownOpen(false);
      }
    };
    if (heritageDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [heritageDropdownOpen]);

  // Auto-populate formHeritage from user profile when profile loads
  useEffect(() => {
    if (userProfile?.heritage && formHeritage.length === 0 && !editingItem) {
      const profileHeritage = Array.isArray(userProfile.heritage)
        ? userProfile.heritage
        : [userProfile.heritage];
      if (profileHeritage.length > 0) {
        setFormHeritage(profileHeritage);
      }
    }
  }, [userProfile?.heritage]);

  // ZIP code auto-populate city and state
  const handleZipChange = useCallback((zip: string) => {
    setFormData((prev) => ({ ...prev, locZip: zip }));
  }, []);

  // Watch locZip and auto-populate city/state when it becomes a valid 5-digit ZIP
  const lastFetchedZip = useRef('');
  useEffect(() => {
    const zip = formData.locZip;
    if (zip.length === 5 && /^\d{5}$/.test(zip) && zip !== lastFetchedZip.current) {
      lastFetchedZip.current = zip;
      const fetchZipData = async () => {
        try {
          const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
          if (res.ok) {
            const data = await res.json();
            if (data.places && data.places.length > 0) {
              setFormData((prev) => ({
                ...prev,
                locCity: data.places[0]['place name'] || prev.locCity,
                locState: data.places[0]['state abbreviation'] || prev.locState,
              }));
            }
          }
        } catch {
          // Silently fail — user can still type manually
        }
      };
      fetchZipData();
    }
  }, [formData.locZip]);

  // Fetch listings
  useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, 'marketplaceListings'));
        const items = querySnapshot.docs.map((doc) => ({
          ...(doc.data() as Omit<MarketplaceItem, 'id'>),
          id: doc.id,
        }));
        setListings(items);
      } catch (error) {
        console.error('Error fetching listings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  // Auto-backfill heritage on user's existing listings that are missing it
  useEffect(() => {
    if (!user?.uid || !userProfile?.heritage || listings.length === 0) return;
    const profileHeritage = Array.isArray(userProfile.heritage)
      ? userProfile.heritage
      : userProfile.heritage ? [userProfile.heritage] : [];
    if (profileHeritage.length === 0) return;

    const profileAvatar = userProfile.avatar || '🧑';
    const myListingsToBackfill = listings.filter(
      (item) => item.sellerId === user.uid && (
        (!item.heritage || item.heritage.length === 0) ||
        (!item.sellerAvatar || item.sellerAvatar === '?' || item.sellerAvatar === '')
      )
    );
    if (myListingsToBackfill.length === 0) return;

    // Update Firestore and local state
    myListingsToBackfill.forEach(async (item) => {
      try {
        const updates: any = {};
        if (!item.heritage || item.heritage.length === 0) updates.heritage = profileHeritage;
        if (!item.sellerAvatar || item.sellerAvatar === '?' || item.sellerAvatar === '') updates.sellerAvatar = profileAvatar;
        if (Object.keys(updates).length > 0) {
          const listingRef = doc(db, 'marketplaceListings', item.id);
          await updateDoc(listingRef, updates);
        }
      } catch (err) {
        console.error('Error backfilling listing', item.id, err);
      }
    });
    // Update local state immediately so filter works right away
    setListings((prev) =>
      prev.map((item) => {
        if (item.sellerId !== user.uid) return item;
        const needsHeritage = !item.heritage || item.heritage.length === 0;
        const needsAvatar = !item.sellerAvatar || item.sellerAvatar === '?' || item.sellerAvatar === '';
        if (!needsHeritage && !needsAvatar) return item;
        return {
          ...item,
          ...(needsHeritage ? { heritage: profileHeritage } : {}),
          ...(needsAvatar ? { sellerAvatar: profileAvatar } : {}),
        };
      })
    );
  }, [user?.uid, userProfile?.heritage, listings.length]);

  // Deep-link: open specific item from profile activity
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && listings.length > 0) {
      const found = listings.find((item: any) => item.id === openId);
      if (found) {
        setSelectedItem(found);
        setShowDetailModal(true);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, listings]);

  // Fetch comments for selected item
  useEffect(() => {
    const fetchComments = async () => {
      if (!selectedItem || !isFeatureEnabled('marketplace_comments')) return;

      try {
        const querySnapshot = await getDocs(
          query(collection(db, 'marketplaceComments'), where('listingId', '==', selectedItem.id))
        );
        const itemComments = querySnapshot.docs.map((doc) => ({
          ...(doc.data() as Omit<Comment, 'id'>),
          id: doc.id,
        }));
        setComments((prev) => ({ ...prev, [selectedItem.id]: itemComments }));
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    };

    fetchComments();
  }, [selectedItem, isFeatureEnabled]);

  // Filtered and sorted listings
  const filteredListings = useMemo(() => {
    let result = [...listings];

    // Filter by "My Listings"
    if (myListings && user?.uid) {
      result = result.filter((item) => item.sellerId === user.uid);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter((item) => item.category === selectedCategory);
    }

    // Filter by heritage
    if (selectedHeritage.length > 0) {
      result = result.filter((item) => {
        if (Array.isArray(item.heritage)) return item.heritage.some((h: string) => selectedHeritage.includes(h));
        return false;
      });
    }

    // Search across title, description, brand, category, location
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.brand?.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.locCity.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return parseFloat(a.price) - parseFloat(b.price);
        case 'price-high':
          return parseFloat(b.price) - parseFloat(a.price);
        case 'popular':
          return (b.saveCount || 0) - (a.saveCount || 0);
        case 'newest':
        default:
          const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
          const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
          return dateB - dateA;
      }
    });

    return result;
  }, [listings, selectedCategory, selectedHeritage, searchQuery, sortBy, myListings, user?.uid]);

  // Featured listings
  const featuredListings = useMemo(() => {
    return filteredListings.filter((item) => item.featured).slice(0, 5);
  }, [filteredListings]);

  // Handle create listing
  const handleCreateListing = async () => {
    if (!user) {
      alert('Please sign in to create a listing');
      return;
    }
    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }
    if (formData.price.trim() === '' || (parseFloat(formData.price) < 0)) {
      alert('Please enter a valid price (0 for free items)');
      return;
    }
    if (!formData.description.trim()) {
      alert('Please enter a description');
      return;
    }
    if (!formData.locCity.trim() || !formData.locState.trim()) {
      alert('Please enter your location (city and state)');
      return;
    }

    try {
      const newListing: Omit<MarketplaceItem, 'id'> = {
        title: formData.title.trim(),
        price: formData.price.trim(),
        category: formData.category,
        condition: formData.condition,
        description: formData.description.trim(),
        photos: formPhotos,
        location: `${formData.locCity}, ${formData.locState}`,
        locCity: formData.locCity.trim(),
        locState: formData.locState.trim(),
        locZip: formData.locZip.trim(),
        sellerId: user.uid,
        sellerName: userProfile?.name || user.displayName || user.email?.split('@')[0] || 'Anonymous',
        sellerAvatar: userProfile?.avatar || '🧑',
        createdAt: Timestamp.now(),
        status: 'available',
        featured: false,
        viewCount: 0,
        saveCount: 0,
        deliveryMethod: formData.deliveryMethod,
        negotiable: formData.negotiable,
        tags: selectedTags,
        heritage: formHeritage,
        ...(formData.brand.trim() && { brand: formData.brand.trim() }),
        ...(formData.model.trim() && { model: formData.model.trim() }),
        ...(formData.color.trim() && { color: formData.color.trim() }),
        ...(formData.size.trim() && { size: formData.size.trim() }),
        ...(formData.material.trim() && { material: formData.material.trim() }),
        ...(formData.dimensions.trim() && { dimensions: formData.dimensions.trim() }),
        ...(formData.weight.trim() && { weight: formData.weight.trim() }),
        ...(formData.shippingPrice.trim() && { shippingPrice: formData.shippingPrice.trim() }),
        ...(formData.videoUrl.trim() && { videoUrl: formData.videoUrl.trim() }),
      };

      const docRef = await addDoc(collection(db, 'marketplaceListings'), newListing);
      setListings((prev) => [...prev, { ...newListing, id: docRef.id }]);
      resetForm();
      setShowCreateModal(false);
    } catch (error: any) {
      console.error('Error creating listing:', error);
      if (error?.code === 'permission-denied') {
        alert('Permission denied. Please make sure Firestore rules are deployed for marketplaceListings.');
      } else if (error?.message?.includes('exceeds the maximum')) {
        alert('Photos are too large. Please use fewer or smaller images.');
      } else {
        alert('Failed to create listing: ' + (error?.message || 'Unknown error'));
      }
    }
  };

  // Handle save/favorite toggle
  const handleSaveToggle = async (itemId: string) => {
    const isSaved = savedItems.includes(itemId);
    const newSavedItems = isSaved ? savedItems.filter((id) => id !== itemId) : [...savedItems, itemId];

    setSavedItems(newSavedItems);

    // Update Firestore
    try {
      const listingRef = doc(db, 'marketplaceListings', itemId);
      await updateDoc(listingRef, {
        saveCount: increment(isSaved ? -1 : 1),
      });
      setListings((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, saveCount: Math.max(0, (item.saveCount || 0) + (isSaved ? -1 : 1)) }
            : item
        )
      );
    } catch (error) {
      console.error('Error updating save count:', error);
    }
  };

  // Handle view item details
  const handleViewDetails = async (item: MarketplaceItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);

    // Increment view count
    try {
      const listingRef = doc(db, 'marketplaceListings', item.id);
      await updateDoc(listingRef, {
        viewCount: increment(1),
      });
      setListings((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, viewCount: (i.viewCount || 0) + 1 } : i))
      );
    } catch (error) {
      console.error('Error updating view count:', error);
    }
  };

  // Handle add comment
  const handleAddComment = async () => {
    if (!user || !selectedItem || !newComment.trim() || !isFeatureEnabled('marketplace_comments')) return;

    try {
      const comment: Omit<Comment, 'id'> = {
        listingId: selectedItem.id,
        userId: user.uid,
        userName: userProfile?.name || 'Anonymous',
        userAvatar: userProfile?.avatar || '',
        text: newComment,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'marketplaceComments'), comment);
      setComments((prev) => ({
        ...prev,
        [selectedItem.id]: [...(prev[selectedItem.id] || []), { ...comment, id: docRef.id }],
      }));
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  // Handle delete listing - show confirmation modal
  const handleDeleteListing = async (itemId: string) => {
    setDeleteItemId(itemId);
    setShowDeleteConfirm(true);
  };

  // Confirm delete listing
  const confirmDeleteListing = async () => {
    if (!deleteItemId) return;
    try {
      await deleteDoc(doc(db, 'marketplaceListings', deleteItemId));
      setListings((prev) => prev.filter((item) => item.id !== deleteItemId));
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error deleting listing:', error);
    } finally {
      setShowDeleteConfirm(false);
      setDeleteItemId(null);
    }
  };

  // Handle edit listing - populate form and open modal in edit mode
  const handleEditListing = (item: MarketplaceItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      price: item.price,
      category: item.category,
      condition: item.condition,
      description: item.description,
      location: item.location || '',
      locCity: item.locCity,
      locState: item.locState,
      locZip: item.locZip,
      brand: item.brand || '',
      model: item.model || '',
      color: item.color || '',
      size: item.size || '',
      material: item.material || '',
      dimensions: item.dimensions || '',
      weight: item.weight || '',
      sku: item.sku || '',
      deliveryMethod: item.deliveryMethod || 'pickup' as 'pickup' | 'shipping' | 'both',
      shippingPrice: item.shippingPrice || '',
      negotiable: item.negotiable || false,
      videoUrl: item.videoUrl || '',
    });
    setFormPhotos(item.photos || []);
    setSelectedTags(item.tags || []);
    setFormHeritage(item.heritage || []);
    setShowDetailModal(false);
    setShowCreateModal(true);
  };

  // Handle update listing (save edits)
  const handleUpdateListing = async () => {
    if (!user || !editingItem) return;

    try {
      const updatedData = {
        ...formData,
        photos: formPhotos,
        tags: selectedTags,
        heritage: formHeritage,
      };

      const listingRef = doc(db, 'marketplaceListings', editingItem.id);
      await updateDoc(listingRef, updatedData);

      setListings((prev) =>
        prev.map((item) =>
          item.id === editingItem.id ? { ...item, ...updatedData } : item
        )
      );

      setEditingItem(null);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error updating listing:', error);
      alert('Failed to update listing');
    }
  };

  // Handle mark as sold/available/pending
  const handleChangeStatus = async (itemId: string, newStatus: 'available' | 'pending' | 'sold') => {
    try {
      const listingRef = doc(db, 'marketplaceListings', itemId);
      await updateDoc(listingRef, { status: newStatus });
      setListings((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status: newStatus } : item))
      );
      if (selectedItem?.id === itemId) {
        setSelectedItem((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Reset form helper
  const resetForm = () => {
    setFormData({
      title: '',
      price: '',
      category: CATEGORIES[0],
      condition: 'new',
      description: '',
      location: '',
      locCity: '',
      locState: '',
      locZip: '',
      brand: '',
      model: '',
      color: '',
      size: '',
      material: '',
      dimensions: '',
      weight: '',
      sku: '',
      deliveryMethod: 'pickup' as 'pickup' | 'shipping' | 'both',
      shippingPrice: '',
      negotiable: false,
      videoUrl: '',
    });
    setFormPhotos([]);
    setCoverPhotoIndex(0);
    setSelectedTags([]);
    setFormHeritage(
      Array.isArray(userProfile?.heritage) ? userProfile.heritage
        : userProfile?.heritage ? [userProfile.heritage] : []
    );
    setEditingItem(null);
  };

  // Handle report listing
  const handleReportListing = async (itemId: string) => {
    if (!user) {
      alert('Please sign in to report');
      return;
    }

    try {
      // Add to reports collection
      await addDoc(collection(db, 'reports'), {
        reportedItemId: itemId,
        reportedItemType: 'marketplace_listing',
        reporterId: user.uid,
        reporterName: userProfile?.name || 'Anonymous',
        reason: 'Inappropriate content',
        description: 'User reported this marketplace listing',
        status: 'pending',
        createdAt: Timestamp.now(),
      });

      // Add to moderation queue
      await addDoc(collection(db, 'moderationQueue'), {
        itemId: itemId,
        itemType: 'marketplace_listing',
        action: 'review',
        priority: 'normal',
        createdAt: Timestamp.now(),
      });

      alert('Listing reported successfully');
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error reporting listing:', error);
    }
  };

  if (!isFeatureEnabled('marketplace_addListing') && !isFeatureEnabled('marketplace_categoryFilter')) {
    return (
      <div className="min-h-screen bg-[var(--aurora-bg)] flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-[var(--aurora-text-muted)] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--aurora-text)] mb-2">Marketplace Coming Soon</h1>
          <p className="text-[var(--aurora-text-muted)]">This feature is not yet available in your region.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--aurora-bg)]">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-aurora-indigo/8 via-aurora-surface to-emerald-500/8 border-b border-aurora-border">
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-3">
          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-muted" />
              <input
                type="text"
                placeholder="Search listings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 bg-aurora-surface border border-aurora-border rounded-full text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all"
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
                  selectedHeritage.length > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-aurora-surface border-aurora-border text-aurora-text-secondary hover:border-aurora-text-muted'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{selectedHeritage.length > 0 ? `Ethnicity (${selectedHeritage.length})` : 'Ethnicity'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${heritageDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {heritageDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-60 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-2 max-h-72 overflow-y-auto">
                  {(() => {
                    const userHeritage = Array.isArray(userProfile?.heritage)
                      ? userProfile.heritage
                      : userProfile?.heritage ? [userProfile.heritage] : [];
                    const preferred = HERITAGE_OPTIONS.filter((h: string) => userHeritage.includes(h));
                    const rest = HERITAGE_OPTIONS.filter((h: string) => !userHeritage.includes(h));
                    const sorted = [...preferred, ...rest];
                    return sorted.map((h: string) => {
                      const isPreferred = userHeritage.includes(h);
                      return (
                        <label
                          key={h}
                          className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                            isPreferred ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedHeritage.includes(h)}
                            onChange={() => {
                              setSelectedHeritage((prev) =>
                                prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]
                              );
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                          />
                          <span className="text-sm text-gray-700">{h}</span>
                          {isPreferred && (
                            <span className="ml-auto text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">Preferred</span>
                          )}
                        </label>
                      );
                    });
                  })()}
                  {selectedHeritage.length > 0 && (
                    <div className="border-t border-gray-200 mt-1 pt-1 px-4 py-1.5">
                      <button
                        onClick={() => setSelectedHeritage([])}
                        className="text-xs text-blue-600 font-medium hover:text-blue-500"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Filter Bar — Sort dropdown | Category pills ── */}
      <div className="sticky top-0 z-20 bg-aurora-surface/95 backdrop-blur-md border-b border-aurora-border">
        <div className="max-w-6xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-1.5">

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 border border-aurora-border rounded-full text-xs font-semibold bg-aurora-surface text-aurora-text focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40 shrink-0 appearance-none cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price ↑</option>
              <option value="price-high">Price ↓</option>
              <option value="popular">Popular</option>
            </select>

            {/* Separator */}
            <div className="w-px h-5 bg-aurora-border shrink-0 mx-0.5" />

            {/* Category pills — scrollable */}
            {isFeatureEnabled('marketplace_categoryFilter') && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold shrink-0 transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-aurora-indigo text-white'
                      : 'bg-aurora-surface border border-aurora-border text-aurora-text-muted hover:text-aurora-text-secondary hover:border-aurora-text-muted/30'
                  }`}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold shrink-0 transition-all ${
                      selectedCategory === cat
                        ? 'bg-aurora-indigo text-white'
                        : 'bg-aurora-surface border border-aurora-border text-aurora-text-muted hover:text-aurora-text-secondary hover:border-aurora-text-muted/30'
                    }`}
                  >
                    {CATEGORY_ICONS[cat]}
                    <span>{cat}</span>
                  </button>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Featured Carousel */}
      {isFeatureEnabled('marketplace_featured') && featuredListings.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h2 className="text-xl font-bold text-[var(--aurora-text)] mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            Featured Listings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredListings.map((item) => (
              <MarketplaceCard
                key={item.id}
                item={item}
                onViewDetails={handleViewDetails}
                isSaved={savedItems.includes(item.id)}
                onSaveToggle={handleSaveToggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* My Listings Dashboard */}
      {myListings && user && (
        <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
          <div className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--aurora-text)] flex items-center gap-2">
                <Tag className="w-5 h-5 text-aurora-indigo" />
                My Listings ({listings.filter((i) => i.sellerId === user.uid).length})
              </h2>
              {isFeatureEnabled('marketplace_addListing') && (
                <button
                  onClick={() => { resetForm(); setShowCreateModal(true); }}
                  className="bg-aurora-indigo text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:opacity-90 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add My Listing
                </button>
              )}
            </div>
            <div className="flex gap-2 text-sm">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                {listings.filter((i) => i.sellerId === user.uid && i.status === 'available').length} Active
              </span>
              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                {listings.filter((i) => i.sellerId === user.uid && i.status === 'pending').length} Pending
              </span>
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                {listings.filter((i) => i.sellerId === user.uid && i.status === 'sold').length} Sold
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(8)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-[var(--aurora-text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--aurora-text)] mb-2">No listings found</h3>
            <p className="text-[var(--aurora-text-muted)] mb-6">
              {myListings ? 'You haven\'t listed anything yet. Start selling!' : 'Try adjusting your filters or search.'}
            </p>
            {isFeatureEnabled('marketplace_addListing') && (
              <button
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                className="bg-aurora-indigo text-white px-6 py-3 rounded-xl inline-flex items-center gap-2 hover:opacity-90 font-medium shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Add My Listing
              </button>
            )}
          </div>
        ) : myListings ? (
          /* My Listings - Management View */
          <div className="space-y-3">
            {filteredListings.map((item) => (
              <div
                key={item.id}
                className={`bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-4 ${
                  item.status === 'sold' ? 'opacity-60' : ''
                }`}
              >
                {/* Top Row: Thumbnail + Info */}
                <div className="flex gap-3 items-start">
                  {/* Thumbnail */}
                  <div
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                    onClick={() => handleViewDetails(item)}
                  >
                    {item.photos?.[0] ? (
                      <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${CATEGORY_COLORS[item.category] || 'from-gray-400 to-gray-600'} flex items-center justify-center text-white`}>
                        {CATEGORY_ICONS[item.category] || <Package className="w-6 h-6" />}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3
                        className="font-semibold text-sm text-[var(--aurora-text)] truncate cursor-pointer hover:text-aurora-indigo"
                        onClick={() => handleViewDetails(item)}
                      >
                        {item.title}
                      </h3>
                      <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium flex-shrink-0 ${
                        item.status === 'available' ? 'bg-emerald-100 text-emerald-700'
                          : item.status === 'pending' ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {item.status === 'available' ? 'Active' : item.status === 'pending' ? 'Pending' : 'Sold'}
                      </span>
                    </div>
                    <p className="text-base font-bold text-aurora-indigo">{formatPrice(item.price)}</p>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--aurora-text-muted)] mt-0.5">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {item.viewCount || 0}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {item.saveCount || 0}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--aurora-border)]">
                  {item.status !== 'sold' && (
                    <>
                      <button
                        onClick={() => handleEditListing(item)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-[var(--aurora-border)] text-[var(--aurora-text)] hover:bg-[var(--aurora-bg)] flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      {item.status === 'available' && (
                        <button
                          onClick={() => handleChangeStatus(item.id, 'pending')}
                          className="px-3 py-1.5 text-xs rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center gap-1 whitespace-nowrap"
                        >
                          <Clock className="w-3 h-3" /> Mark Pending
                        </button>
                      )}
                      {item.status === 'pending' && (
                        <button
                          onClick={() => handleChangeStatus(item.id, 'available')}
                          className="px-3 py-1.5 text-xs rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center gap-1 whitespace-nowrap"
                        >
                          <Check className="w-3 h-3" /> Mark Available
                        </button>
                      )}
                      <button
                        onClick={() => handleChangeStatus(item.id, 'sold')}
                        className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-1 whitespace-nowrap"
                      >
                        <Check className="w-3 h-3" /> Mark Sold
                      </button>
                    </>
                  )}
                  {item.status === 'sold' && (
                    <button
                      onClick={() => handleChangeStatus(item.id, 'available')}
                      className="px-3 py-1.5 text-xs rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Relist
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteListing(item.id)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((item) => (
              <MarketplaceCard
                key={item.id}
                item={item}
                onViewDetails={handleViewDetails}
                isSaved={savedItems.includes(item.id)}
                onSaveToggle={handleSaveToggle}
                isListView={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Floating Action Button ─── */}
      {isFeatureEnabled('marketplace_addListing') && (
        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 aurora-gradient text-white rounded-full shadow-aurora-glow-lg flex items-center justify-center hover:shadow-aurora-4 transition-all z-10 btn-press"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {/* Create Listing Modal */}
      {showCreateModal && isFeatureEnabled('marketplace_addListing') && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-0 sm:p-4">
          <div className="bg-[var(--aurora-surface)] sm:rounded-lg max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-[var(--aurora-border)] flex-shrink-0">
              <h2 className="text-lg sm:text-2xl font-bold text-[var(--aurora-text)]">
                {editingItem ? 'Edit Listing' : 'Add My Listing'}
              </h2>
              <button onClick={() => { setShowCreateModal(false); setEditingItem(null); }} className="text-[var(--aurora-text-muted)] hover:text-[var(--aurora-text)]">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1 overscroll-contain">
              {/* Section 1: Basic Info */}
              <div>
                <h3 className="font-semibold text-[var(--aurora-text)] mb-4">Basic Information</h3>
                <FormField
                  label="Title"
                  value={formData.title}
                  onChange={(value) => setFormData({ ...formData, title: value })}
                  placeholder="What are you selling?"
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Price ($0 for FREE)"
                    value={formData.price}
                    onChange={(value) => setFormData({ ...formData, price: value })}
                    type="number"
                    placeholder="0 for free"
                    required
                  />
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[var(--aurora-text)] mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 bg-[var(--aurora-bg)] border border-[var(--aurora-border)] rounded-lg text-[var(--aurora-text)] focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Heritage Tags */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--aurora-text)] mb-2">Heritage</label>
                  <div className="flex flex-wrap gap-2">
                    {HERITAGE_OPTIONS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setFormHeritage((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h])}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          formHeritage.includes(h)
                            ? 'bg-amber-500 text-white'
                            : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[var(--aurora-text)] mb-2">
                      Condition <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.condition}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
                      className="w-full px-4 py-2 bg-[var(--aurora-bg)] border border-[var(--aurora-border)] rounded-lg text-[var(--aurora-text)] focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                    >
                      <option value="new">New</option>
                      <option value="like_new">Like New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">For Parts</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={formData.negotiable}
                        onChange={(e) => setFormData({ ...formData, negotiable: e.target.checked })}
                        className="w-4 h-4 rounded border-[var(--aurora-border)]"
                      />
                      <span className="text-sm font-medium text-[var(--aurora-text)]">Price is negotiable</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 2: Item Details */}
              <div>
                <h3 className="font-semibold text-[var(--aurora-text)] mb-4">Item Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Brand"
                    value={formData.brand}
                    onChange={(value) => setFormData({ ...formData, brand: value })}
                    placeholder="e.g., Apple, Samsung"
                  />
                  <FormField
                    label="Model"
                    value={formData.model}
                    onChange={(value) => setFormData({ ...formData, model: value })}
                    placeholder="e.g., iPhone 14"
                  />
                  <FormField
                    label="Color"
                    value={formData.color}
                    onChange={(value) => setFormData({ ...formData, color: value })}
                    placeholder="e.g., Black, Blue"
                  />
                  <FormField
                    label="Size"
                    value={formData.size}
                    onChange={(value) => setFormData({ ...formData, size: value })}
                    placeholder="e.g., M, Large"
                  />
                  <FormField
                    label="Material"
                    value={formData.material}
                    onChange={(value) => setFormData({ ...formData, material: value })}
                    placeholder="e.g., Cotton, Wood"
                  />
                  <FormField
                    label="Weight"
                    value={formData.weight}
                    onChange={(value) => setFormData({ ...formData, weight: value })}
                    placeholder="e.g., 500g"
                  />
                </div>
                <FormField
                  label="Dimensions"
                  value={formData.dimensions}
                  onChange={(value) => setFormData({ ...formData, dimensions: value })}
                  placeholder="e.g., 10x20x30 cm"
                />
              </div>

              {/* Section 3: Description */}
              <div>
                <h3 className="font-semibold text-[var(--aurora-text)] mb-4">Description</h3>
                <FormTextarea
                  label="Description"
                  value={formData.description}
                  onChange={(value) => setFormData({ ...formData, description: value })}
                  placeholder="Tell buyers about your item, condition, features, and any defects"
                  rows={5}
                  required
                />
              </div>

              {/* Section 4: Photos */}
              <div>
                <h3 className="font-semibold text-[var(--aurora-text)] mb-4">Photos & Media</h3>
                <PhotoUploader
                  photos={formPhotos}
                  onPhotosChange={setFormPhotos}
                  onCoverChange={setCoverPhotoIndex}
                  coverIndex={coverPhotoIndex}
                />
                <FormField
                  label="Video URL (optional)"
                  value={formData.videoUrl}
                  onChange={(value) => setFormData({ ...formData, videoUrl: value })}
                  placeholder="e.g., https://youtube.com/..."
                />
              </div>

              {/* Section 5: Location & Delivery */}
              <div>
                <h3 className="font-semibold text-[var(--aurora-text)] mb-4">Location & Delivery</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <FormField
                    label="ZIP Code"
                    value={formData.locZip}
                    onChange={handleZipChange}
                    placeholder="10001"
                    required
                  />
                  <FormField
                    label="City"
                    value={formData.locCity}
                    onChange={(value) => setFormData({ ...formData, locCity: value })}
                    placeholder="Auto-fills from ZIP"
                    required
                  />
                  <FormField
                    label="State"
                    value={formData.locState}
                    onChange={(value) => setFormData({ ...formData, locState: value })}
                    placeholder="Auto-fills"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--aurora-text)] mb-2">
                    Delivery Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.deliveryMethod}
                    onChange={(e) => setFormData({ ...formData, deliveryMethod: e.target.value as any })}
                    className="w-full px-4 py-2 bg-[var(--aurora-bg)] border border-[var(--aurora-border)] rounded-lg text-[var(--aurora-text)] focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                  >
                    <option value="pickup">Local Pickup Only</option>
                    <option value="shipping">Shipping Only</option>
                    <option value="both">Both Local & Shipping</option>
                  </select>
                </div>

                {(formData.deliveryMethod === 'shipping' || formData.deliveryMethod === 'both') && (
                  <FormField
                    label="Shipping Price"
                    value={formData.shippingPrice}
                    onChange={(value) => setFormData({ ...formData, shippingPrice: value })}
                    type="number"
                    placeholder="0"
                  />
                )}
              </div>

              {/* Section 6: Tags */}
              <div>
                <h3 className="font-semibold text-[var(--aurora-text)] mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        setSelectedTags((prev) =>
                          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                        )
                      }
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-aurora-indigo text-white'
                          : 'bg-[var(--aurora-bg)] text-[var(--aurora-text)] border border-[var(--aurora-border)] hover:border-aurora-indigo hover:bg-aurora-indigo/5'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--aurora-border)] p-4 sm:p-6 flex gap-3 justify-end flex-shrink-0">
              <button
                onClick={() => { setShowCreateModal(false); setEditingItem(null); }}
                className="px-6 py-2 rounded-lg border border-[var(--aurora-border)] text-[var(--aurora-text)] hover:bg-[var(--aurora-bg)]"
              >
                Cancel
              </button>
              <button
                onClick={editingItem ? handleUpdateListing : handleCreateListing}
                className="px-6 py-2 rounded-lg bg-aurora-indigo text-white hover:opacity-90 flex items-center gap-2 font-medium"
              >
                {editingItem ? (
                  <>
                    <Check className="w-4 h-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add My Listing
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-0 sm:p-4">
          <div className="bg-[var(--aurora-surface)] sm:rounded-lg max-w-3xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-[var(--aurora-border)] flex-shrink-0">
              <h2 className="text-lg sm:text-2xl font-bold text-[var(--aurora-text)] truncate pr-2">{selectedItem.title}</h2>
              <button onClick={() => setShowDetailModal(false)} className="text-[var(--aurora-text-muted)] hover:text-[var(--aurora-text)] flex-shrink-0">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1 overscroll-contain">
              {/* Photo Carousel */}
              <PhotoCarousel photos={selectedItem.photos} title={selectedItem.title} onClose={() => setShowDetailModal(false)} />

              {/* Price & Basic Info */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="text-3xl font-bold text-aurora-indigo mb-2">{formatPrice(selectedItem.price)}</div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {CONDITION_LABELS[selectedItem.condition]}
                    </span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                      {selectedItem.category}
                    </span>
                    {selectedItem.negotiable && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        Negotiable
                      </span>
                    )}
                    {selectedItem.status === 'sold' && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                        SOLD
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {(selectedItem.sellerId === user?.uid || userRole === 'admin') && (
                    <>
                      <button
                        onClick={() => handleEditListing(selectedItem)}
                        className="p-2 rounded-lg border border-[var(--aurora-border)] text-[var(--aurora-text)] hover:bg-[var(--aurora-bg)]"
                        title="Edit listing"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      {selectedItem.status !== 'sold' ? (
                        <>
                          {selectedItem.status === 'available' && (
                            <button
                              onClick={() => handleChangeStatus(selectedItem.id, 'pending')}
                              className="p-2 rounded-lg border border-amber-400 text-amber-600 hover:bg-amber-50"
                              title="Mark as Pending"
                            >
                              <Clock className="w-5 h-5" />
                            </button>
                          )}
                          {selectedItem.status === 'pending' && (
                            <button
                              onClick={() => handleChangeStatus(selectedItem.id, 'available')}
                              className="p-2 rounded-lg border border-emerald-400 text-emerald-600 hover:bg-emerald-50"
                              title="Mark as Available"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleChangeStatus(selectedItem.id, 'sold')}
                            className="p-2 rounded-lg border border-red-400 text-red-600 hover:bg-red-50"
                            title="Mark as Sold"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleChangeStatus(selectedItem.id, 'available')}
                          className="p-2 rounded-lg border border-emerald-400 text-emerald-600 hover:bg-emerald-50"
                          title="Relist item"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteListing(selectedItem.id)}
                        className="p-2 rounded-lg border border-red-500 text-red-500 hover:bg-red-50"
                        title="Delete listing"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  {selectedItem.sellerId !== user?.uid && userRole !== 'admin' && (
                    <button
                      onClick={() => handleReportListing(selectedItem.id)}
                      className="p-2 rounded-lg border border-[var(--aurora-border)] text-[var(--aurora-text)] hover:bg-[var(--aurora-bg)]"
                    >
                      <Flag className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="font-semibold text-[var(--aurora-text)] mb-2">Description</h3>
                <p className="text-[var(--aurora-text)]">{selectedItem.description}</p>
              </div>

              {/* Item Details */}
              {(selectedItem.brand || selectedItem.model || selectedItem.color || selectedItem.size || selectedItem.material || selectedItem.dimensions || selectedItem.weight) && (
                <div>
                  <h3 className="font-semibold text-[var(--aurora-text)] mb-3">Item Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedItem.brand && (
                      <div>
                        <p className="text-sm text-[var(--aurora-text-muted)]">Brand</p>
                        <p className="text-[var(--aurora-text)]">{selectedItem.brand}</p>
                      </div>
                    )}
                    {selectedItem.model && (
                      <div>
                        <p className="text-sm text-[var(--aurora-text-muted)]">Model</p>
                        <p className="text-[var(--aurora-text)]">{selectedItem.model}</p>
                      </div>
                    )}
                    {selectedItem.color && (
                      <div>
                        <p className="text-sm text-[var(--aurora-text-muted)]">Color</p>
                        <p className="text-[var(--aurora-text)]">{selectedItem.color}</p>
                      </div>
                    )}
                    {selectedItem.size && (
                      <div>
                        <p className="text-sm text-[var(--aurora-text-muted)]">Size</p>
                        <p className="text-[var(--aurora-text)]">{selectedItem.size}</p>
                      </div>
                    )}
                    {selectedItem.material && (
                      <div>
                        <p className="text-sm text-[var(--aurora-text-muted)]">Material</p>
                        <p className="text-[var(--aurora-text)]">{selectedItem.material}</p>
                      </div>
                    )}
                    {selectedItem.dimensions && (
                      <div>
                        <p className="text-sm text-[var(--aurora-text-muted)]">Dimensions</p>
                        <p className="text-[var(--aurora-text)]">{selectedItem.dimensions}</p>
                      </div>
                    )}
                    {selectedItem.weight && (
                      <div>
                        <p className="text-sm text-[var(--aurora-text-muted)]">Weight</p>
                        <p className="text-[var(--aurora-text)]">{selectedItem.weight}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location & Delivery */}
              <div>
                <h3 className="font-semibold text-[var(--aurora-text)] mb-3">Location & Delivery</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[var(--aurora-text)]">
                    <MapPin className="w-5 h-5 text-aurora-indigo" />
                    <span>{selectedItem.locCity}, {selectedItem.locState} {selectedItem.locZip}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--aurora-text)]">
                    <Package className="w-5 h-5 text-aurora-indigo" />
                    <span>{selectedItem.deliveryMethod === 'pickup' && 'Local Pickup'}{selectedItem.deliveryMethod === 'shipping' && 'Shipping'}{selectedItem.deliveryMethod === 'both' && 'Local Pickup & Shipping'}</span>
                  </div>
                  {selectedItem.shippingPrice && (
                    <p className="text-sm text-[var(--aurora-text-muted)]">Shipping: {formatPrice(selectedItem.shippingPrice)}</p>
                  )}
                </div>
              </div>

              {/* Tags */}
              {selectedItem.tags.length > 0 && (
                <div>
                  <h3 className="font-semibold text-[var(--aurora-text)] mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-[var(--aurora-bg)] text-[var(--aurora-text)] rounded-full text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Seller Info */}
              <div className="border-t border-[var(--aurora-border)] pt-6">
                <h3 className="font-semibold text-[var(--aurora-text)] mb-4">Seller</h3>
                <div className="flex items-center gap-4">
                  {selectedItem.sellerAvatar && selectedItem.sellerAvatar.startsWith('http') ? (
                    <img src={selectedItem.sellerAvatar} alt={selectedItem.sellerName} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-aurora-indigo flex items-center justify-center text-2xl flex-shrink-0">
                      {selectedItem.sellerAvatar && selectedItem.sellerAvatar !== '?' && !selectedItem.sellerAvatar.startsWith('http')
                        ? selectedItem.sellerAvatar
                        : (selectedItem.sellerId === user?.uid && userProfile?.avatar
                          ? userProfile.avatar
                          : '🧑')}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-[var(--aurora-text)]">
                      {(selectedItem.sellerName && selectedItem.sellerName !== '?' && selectedItem.sellerName !== 'Anonymous')
                        ? selectedItem.sellerName
                        : (selectedItem.sellerId === user?.uid
                          ? (userProfile?.name || user?.email?.split('@')[0] || 'You')
                          : selectedItem.sellerName || 'Seller')}
                    </p>
                    <p className="text-sm text-[var(--aurora-text-muted)]">Seller on Marketplace</p>
                  </div>
                  {selectedItem.sellerId !== user?.uid && (
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-aurora-indigo text-white rounded-lg flex items-center gap-2 hover:opacity-90">
                        <MessageSquare className="w-4 h-4" />
                        Message
                      </button>
                      <button className="px-4 py-2 border border-[var(--aurora-border)] text-[var(--aurora-text)] rounded-lg hover:bg-[var(--aurora-bg)]">
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              {isFeatureEnabled('marketplace_comments') && (
                <div className="border-t border-[var(--aurora-border)] pt-6">
                  <h3 className="font-semibold text-[var(--aurora-text)] mb-4 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Comments ({comments[selectedItem.id]?.length || 0})
                  </h3>

                  {user && (
                    <div className="mb-6 flex gap-3">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 px-4 py-2 bg-[var(--aurora-bg)] border border-[var(--aurora-border)] rounded-lg text-[var(--aurora-text)] placeholder-[var(--aurora-text-muted)] focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                      />
                      <button
                        onClick={handleAddComment}
                        className="px-4 py-2 bg-aurora-indigo text-white rounded-lg hover:opacity-90"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    {(comments[selectedItem.id] || []).map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        {comment.userAvatar && (
                          <img src={comment.userAvatar} alt={comment.userName} className="w-8 h-8 rounded-full flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="bg-[var(--aurora-bg)] rounded-lg p-3">
                            <p className="font-medium text-sm text-[var(--aurora-text)]">{comment.userName}</p>
                            <p className="text-[var(--aurora-text)]">{comment.text}</p>
                          </div>
                          <p className="text-xs text-[var(--aurora-text-muted)] mt-1">{timeAgo(comment.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="border-t border-[var(--aurora-border)] pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-aurora-indigo">{selectedItem.viewCount || 0}</p>
                    <p className="text-sm text-[var(--aurora-text-muted)]">Views</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-aurora-indigo">{selectedItem.saveCount || 0}</p>
                    <p className="text-sm text-[var(--aurora-text-muted)]">Saves</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-aurora-indigo">{timeAgo(selectedItem.createdAt)}</p>
                    <p className="text-sm text-[var(--aurora-text-muted)]">Posted</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--aurora-border)] p-4 sm:p-6 flex gap-3 justify-between flex-shrink-0">
              <button
                onClick={() => handleSaveToggle(selectedItem.id)}
                className={`px-4 sm:px-6 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  savedItems.includes(selectedItem.id)
                    ? 'bg-red-100 text-red-600'
                    : 'border border-[var(--aurora-border)] text-[var(--aurora-text)] hover:bg-[var(--aurora-bg)]'
                }`}
              >
                <Heart className={`w-4 h-4 ${savedItems.includes(selectedItem.id) ? 'fill-current' : ''}`} />
                {savedItems.includes(selectedItem.id) ? 'Saved' : 'Save'}
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 sm:px-6 py-2 rounded-lg bg-aurora-indigo text-white hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[var(--aurora-surface)] rounded-2xl shadow-xl border border-[var(--aurora-border)] max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-[var(--aurora-text)] mb-2">Delete Listing?</h3>
            <p className="text-sm text-[var(--aurora-text-muted)] mb-6">This action cannot be undone. The listing will be permanently removed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteItemId(null); }}
                className="flex-1 py-2.5 rounded-xl border border-[var(--aurora-border)] text-[var(--aurora-text-secondary)] font-medium hover:bg-[var(--aurora-surface-variant)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteListing}
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

// Import missing icon
import { Image, Gift, Users } from 'lucide-react';
