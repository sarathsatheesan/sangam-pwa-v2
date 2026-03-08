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
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, X, Heart, MapPin, BedDouble, Bath, Ruler, Home,
  Building2, Users, Key, Plus, ChevronLeft, ChevronRight,
  Share2, Phone, Mail, Calendar, PawPrint, Car,
  Edit3, Trash2, Loader2, Video, ExternalLink,
  ChevronDown,
  Camera, Upload, Eye, Clock, Shield, Sparkles, DollarSign,
  Maximize2, Tag, CheckCircle2, Map,
  Wind, Snowflake,
  UtensilsCrossed, Dumbbell, Waves, Package, TreePine,
  DoorOpen, Flame, Zap, Droplets, Sun, MessageCircle, Star
} from 'lucide-react';
import { useFeatureSettings } from '../../contexts/FeatureSettingsContext';

/* ─── types ─── */
interface Listing {
  id: string;
  title: string;
  type: 'rent' | 'sale' | 'roommate' | 'sublet';
  price: string;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  locCity: string;
  locState: string;
  locZip: string;
  desc: string;
  tags: string[];
  featured: boolean;
  emoji: string;
  bgColor: string;
  posterName: string;
  posterAvatar: string;
  posterId: string;
  createdAt: any;
  heritage?: string | string[];
  contactPhone?: string;
  contactEmail?: string;
  availableDate?: string;
  petPolicy?: string;
  parking?: string;
  photos?: string[];
  coverPhotoIndex?: number;
  videoUrl?: string;
  yearBuilt?: string;
  lotSize?: string;
  propertyType?: string;
  heating?: string;
  cooling?: string;
  laundry?: string;
  hoa?: string;
  status?: 'active' | 'pending' | 'under_contract' | 'sold' | 'rented';
  walkScore?: number;
  transitScore?: number;
  neighborhoodHighlights?: string[];
  viewCount?: number;
  saveCount?: number;
}


interface Comment {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  likes: number;
  likedBy: string[];
  createdAt: any;
}

type FilterType = 'all' | 'rent' | 'sale' | 'roommate' | 'sublet';
type SortOption = 'newest' | 'price-low' | 'price-high' | 'largest' | 'popular';

/* ─── constants ─── */
const HERITAGE_OPTIONS = ['Indian', 'Pakistani', 'Bangladeshi', 'Sri Lankan', 'Nepali', 'Bhutanese', 'Maldivian', 'Afghan'];

const AVAILABLE_TAGS = [
  'Furnished', 'Pet-friendly', 'Parking', 'Laundry', 'Pool', 'Gym',
  'Utilities Included', 'AC', 'Heating', 'Dishwasher', 'Balcony', 'Storage',
  'Washer/Dryer', 'Hardwood Floors', 'Near Transit', 'Doorman',
];

const TAG_ICONS: Record<string, any> = {
  'Furnished': Package,
  'Pet-friendly': PawPrint,
  'Parking': Car,
  'Laundry': Droplets,
  'Pool': Waves,
  'Gym': Dumbbell,
  'Utilities Included': Zap,
  'AC': Snowflake,
  'Heating': Flame,
  'Dishwasher': UtensilsCrossed,
  'Balcony': Sun,
  'Storage': Package,
  'Washer/Dryer': Wind,
  'Hardwood Floors': TreePine,
  'Near Transit': MapPin,
  'Doorman': DoorOpen,
};
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  active: { color: '#10B981', bgColor: 'bg-emerald-100', label: 'Active' },
  pending: { color: '#F59E0B', bgColor: 'bg-amber-100', label: 'Pending' },
  under_contract: { color: '#8B5CF6', bgColor: 'bg-purple-100', label: 'Under Contract' },
  sold: { color: '#EF4444', bgColor: 'bg-red-100', label: 'Sold' },
  rented: { color: '#3B82F6', bgColor: 'bg-blue-100', label: 'Rented' },
};


const TYPE_CONFIG: Record<string, { color: string; gradient: string; icon: any; label: string }> = {
  rent: { color: '#6366F1', gradient: 'from-indigo-500 to-purple-600', icon: Home, label: 'For Rent' },
  sale: { color: '#EA580C', gradient: 'from-orange-500 to-red-600', icon: Building2, label: 'For Sale' },
  roommate: { color: '#7C3AED', gradient: 'from-violet-500 to-purple-600', icon: Users, label: 'Roommate' },
  sublet: { color: '#0D9488', gradient: 'from-teal-500 to-emerald-600', icon: Key, label: 'Sublet' },
};

const TYPE_LABELS: Record<string, string> = {
  all: 'All Listings',
  rent: 'For Rent',
  sale: 'For Sale',
  roommate: 'Roommate',
  sublet: 'Sublet',
};

const PROPERTY_TYPES = ['Apartment', 'House', 'Condo', 'Townhouse', 'Studio', 'Loft', 'Duplex', 'Other'];
const PET_OPTIONS = ['Cats OK', 'Dogs OK', 'Cats & Dogs OK', 'No Pets'];
const PARKING_OPTIONS = ['Street', 'Garage', 'Driveway', 'Covered', 'None'];

/* ─── helpers ─── */
const fuzzyMatch = (text: string, q: string): boolean => {
  const t = text.toLowerCase();
  const query = q.toLowerCase().trim();
  if (!query) return true;
  if (t.includes(query)) return true;
  const words = query.split(/\s+/);
  return words.every((w) => {
    if (t.includes(w)) return true;
    if (w.length <= 3) return false;
    for (let i = 0; i < w.length; i++) {
      if (t.includes(w.slice(0, i) + w.slice(i + 1))) return true;
    }
    return false;
  });
};

const getGoogleMapsUrl = (addr: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

const getGoogleMapsEmbedUrl = (addr: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(addr)}&output=embed`;

const formatPrice = (price: string) => {
  const num = parseFloat(price.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return price;
  if (price.includes('/')) return price;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
};

const parseNumericPrice = (price: string) => parseFloat(price.replace(/[^0-9.]/g, '')) || 0;

const getTimeAgo = (timestamp: any): string => {
  if (!timestamp?.toMillis) return '';
  const diff = Date.now() - timestamp.toMillis();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
};

const fullAddress = (l: Listing) =>
  [l.address, l.locCity, l.locState, l.locZip].filter(Boolean).join(', ');

/* ─── sub-components ─── */

function SkeletonCard() {
  return (
    <div className="bg-[var(--aurora-surface)] rounded-2xl overflow-hidden border border-[var(--aurora-border)]">
      <div className="relative">
        <div className="aspect-[16/10] bg-[var(--aurora-surface-variant)] animate-pulse" />
      </div>
      <div className="p-4 space-y-3">
        <div className="h-6 bg-[var(--aurora-surface-variant)] rounded-lg w-1/3 animate-pulse" />
        <div className="h-4 bg-[var(--aurora-surface-variant)] rounded w-3/4 animate-pulse" />
        <div className="flex gap-4">
          <div className="h-4 bg-[var(--aurora-surface-variant)] rounded w-16 animate-pulse" />
          <div className="h-4 bg-[var(--aurora-surface-variant)] rounded w-16 animate-pulse" />
          <div className="h-4 bg-[var(--aurora-surface-variant)] rounded w-20 animate-pulse" />
        </div>
        <div className="h-4 bg-[var(--aurora-surface-variant)] rounded w-1/2 animate-pulse" />
      </div>
    </div>
  );
}

function PhotoCarousel({ photos, onExpand }: { photos: string[]; onExpand?: () => void }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const hasPhotos = photos && photos.length > 0;

  if (!hasPhotos) return null;

  return (
    <div className="relative w-full aspect-[16/10] bg-gray-900 group">
      <img
        src={photos[currentIdx]}
        alt=""
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display = 'none'; }}
      />

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIdx((p) => (p - 1 + photos.length) % photos.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md"
            aria-label="Previous photo"
          >
            <ChevronLeft size={18} className="text-gray-800" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIdx((p) => (p + 1) % photos.length); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md"
            aria-label="Next photo"
          >
            <ChevronRight size={18} className="text-gray-800" />
          </button>
        </>
      )}

      {/* Photo counter */}
      <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1">
        <Camera size={12} />
        {currentIdx + 1}/{photos.length}
      </div>

      {/* Dot indicators */}
      {photos.length > 1 && photos.length <= 8 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {photos.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === currentIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
            />
          ))}
        </div>
      )}

      {onExpand && (
        <button
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Maximize2 size={14} />
        </button>
      )}
    </div>
  );
}

const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
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

function PhotoUploader({
  photos,
  onPhotosChange,
  onCoverChange,
  coverIndex,
  videoUrl,
  onVideoUrlChange,
}: {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onCoverChange: (index: number) => void;
  coverIndex: number;
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const remaining = 10 - photos.length;
    const toProcess = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, remaining);
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
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePhoto = (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    onPhotosChange(updated);
    if (coverIndex >= updated.length) onCoverChange(Math.max(0, updated.length - 1));
    else if (idx < coverIndex) onCoverChange(coverIndex - 1);
    else if (idx === coverIndex) onCoverChange(0);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-[var(--aurora-text)]">
        Photos (max 10)
      </label>

      {/* Drop zone */}
      {photos.length < 10 && (
        <div
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-aurora-indigo bg-aurora-indigo/5'
              : 'border-[var(--aurora-border)] hover:border-aurora-indigo hover:bg-[var(--aurora-surface-variant)]'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={32} className="mx-auto text-[var(--aurora-text-muted)] mb-2" />
          <p className="text-sm font-medium text-[var(--aurora-text)]">Drag photos here or click to upload</p>
          <p className="text-xs text-[var(--aurora-text-muted)] mt-1">PNG, JPG up to 5MB each</p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Photo previews with cover selection */}
      {photos.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, idx) => (
              <div
                key={idx}
                className={`relative group aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${idx === coverIndex ? 'border-aurora-indigo shadow-lg' : 'border-transparent'}`}
                onClick={() => onCoverChange(idx)}
              >
                <img src={photo} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); removePhoto(idx); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 z-10"
                >
                  <X size={10} />
                </button>
                {idx === coverIndex && (
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-aurora-indigo text-white text-[10px] font-bold rounded pointer-events-none flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-white" /> Cover
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[var(--aurora-text-muted)]">Tap a photo to set it as cover image. {photos.length}/10 uploaded.</p>
        </>
      )}

      {/* Video URL */}
      <div>
        <label className="block text-xs font-medium text-[var(--aurora-text-muted)] mb-1 flex items-center gap-1">
          <Video size={12} /> Video Tour URL (optional)
        </label>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => onVideoUrlChange(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full px-3 py-2 border border-[var(--aurora-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-aurora-indigo bg-[var(--aurora-surface)]"
        />
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--aurora-text)] mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ─── main component ─── */
export default function HousingPage() {
  const { user, userRole, userProfile } = useAuth();
  const { isFeatureEnabled } = useFeatureSettings();
  const photosEnabled = isFeatureEnabled('housing_photos');
  const [searchParams, setSearchParams] = useSearchParams();

  /* state */
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const myProperties = false; // My Properties moved to Profile page
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [priceRange, setPriceRange] = useState<[string, string]>(['', '']);
  const [bedsFilter, setBedsFilter] = useState('any');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const priceDropRef = useRef<HTMLDivElement>(null);
  const bedsDropRef = useRef<HTMLDivElement>(null);
  const moreDropRef = useRef<HTMLDivElement>(null);
  const [activeListTab, setActiveListTab] = useState<'all' | 'saved' | 'recent'>('all');
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('recentHousing') || '[]'); }
    catch { return []; }
  });
  const [savedListings, setSavedListings] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('savedHousing') || '[]')); }
    catch { return new Set(); }
  });
  const [detailTab, setDetailTab] = useState<'overview' | 'details' | 'map' | 'calculator' | 'comments'>('overview');
  const [photoGalleryOpen, setPhotoGalleryOpen] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [calcDownPayment, setCalcDownPayment] = useState('20');
  const [calcInterestRate, setCalcInterestRate] = useState('6.5');
  const [calcLoanTerm, setCalcLoanTerm] = useState('30');
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteListingId, setDeleteListingId] = useState<string | null>(null);
  const [showDeleteCommentConfirm, setShowDeleteCommentConfirm] = useState(false);
  const [deleteCommentInfo, setDeleteCommentInfo] = useState<{ listingId: string; commentId: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /* form state */
  const [formData, setFormData] = useState({
    title: '',
    type: 'rent' as FilterType,
    price: '',
    beds: '1',
    baths: '1',
    sqft: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    desc: '',
    tags: [] as string[],
    contactPhone: '',
    contactEmail: '',
    availableDate: '',
    petPolicy: '',
    parking: '',
    photos: [] as string[],
    coverPhotoIndex: 0,
    videoUrl: '',
    propertyType: '',
    yearBuilt: '',
    lotSize: '',
    heating: '',
    cooling: '',
    laundry: '',
    hoa: '',
    status: 'active',
    walkScore: '',
    transitScore: '',
    neighborhoodHighlights: [],
  });

  const inputCls = "w-full px-3.5 py-2.5 border border-[var(--aurora-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-aurora-indigo bg-[var(--aurora-surface)] text-[var(--aurora-text)] placeholder-[var(--aurora-text-muted)]";
  const viewedListingsRef = useRef<Set<string>>(new Set());

  /* close dropdowns on click outside */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(target)) setTypeDropdownOpen(false);
      if (priceDropRef.current && !priceDropRef.current.contains(target) &&
          bedsDropRef.current && !bedsDropRef.current.contains(target) &&
          moreDropRef.current && !moreDropRef.current.contains(target)) {
        setActiveDropdown(null);
      } else if (activeDropdown === 'price' && priceDropRef.current && !priceDropRef.current.contains(target)) {
        setActiveDropdown(null);
      } else if (activeDropdown === 'beds' && bedsDropRef.current && !bedsDropRef.current.contains(target)) {
        setActiveDropdown(null);
      } else if (activeDropdown === 'more' && moreDropRef.current && !moreDropRef.current.contains(target)) {
        setActiveDropdown(null);
      }
    };
    if (typeDropdownOpen || activeDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [typeDropdownOpen, activeDropdown]);

  /* toast auto-dismiss */
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  /* saved listings persistence */
  useEffect(() => {
    localStorage.setItem('savedHousing', JSON.stringify([...savedListings]));
  }, [savedListings]);

  useEffect(() => {
    localStorage.setItem('recentHousing', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  /* Escape key handler for modals */
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedListing) setSelectedListing(null);
        if (showCreateModal) setShowCreateModal(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [selectedListing, showCreateModal]);

  /* Body scroll lock when modal is open */
  useEffect(() => {
    if (selectedListing || showCreateModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedListing, showCreateModal]);

  const toggleSave = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSavedListings((prev) => {
      const next = new Set(prev);
      const isSaving = !next.has(id);
      if (isSaving) {
        next.add(id);
        // Increment saveCount in Firestore
        try {
          updateDoc(doc(db, 'listings', id), {
            saveCount: increment(1),
          });
        } catch (error) {
          console.error('Error updating save count:', error);
        }
        // Update local state immediately
        setListings((prev) => prev.map((l) => l.id === id ? { ...l, saveCount: (l.saveCount || 0) + 1 } : l));
      } else {
        next.delete(id);
        // Decrement saveCount in Firestore
        try {
          updateDoc(doc(db, 'listings', id), {
            saveCount: increment(-1),
          });
        } catch (error) {
          console.error('Error updating save count:', error);
        }
        // Update local state immediately
        setListings((prev) => prev.map((l) => l.id === id ? { ...l, saveCount: Math.max(0, (l.saveCount || 0) - 1) } : l));
      }
      return next;
    });
  }, []);

  /* fetch */
  const fetchListings = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'listings'));
      const data: Listing[] = snapshot.docs.map((d) => ({
        id: d.id,
        title: d.data().title || '',
        type: d.data().type || 'rent',
        price: d.data().price || '',
        beds: d.data().beds || 0,
        baths: d.data().baths || 0,
        sqft: d.data().sqft || 0,
        address: d.data().address || '',
        locCity: d.data().locCity || d.data().city || '',
        locState: d.data().locState || d.data().state || '',
        locZip: d.data().locZip || d.data().zip || '',
        desc: d.data().desc || '',
        tags: d.data().tags || [],
        featured: d.data().featured || false,
        emoji: d.data().emoji || '🏠',
        bgColor: d.data().bgColor || '#F5F5F5',
        posterName: d.data().posterName || 'Anonymous',
        posterAvatar: d.data().posterAvatar || '',
        posterId: d.data().posterId || '',
        createdAt: d.data().createdAt,
        heritage: d.data().heritage,
        contactPhone: d.data().contactPhone || '',
        contactEmail: d.data().contactEmail || '',
        availableDate: d.data().availableDate || '',
        petPolicy: d.data().petPolicy || '',
        parking: d.data().parking || '',
        photos: d.data().photos || [],
        coverPhotoIndex: d.data().coverPhotoIndex || 0,
        videoUrl: d.data().videoUrl || '',
        yearBuilt: d.data().yearBuilt || '',
        lotSize: d.data().lotSize || '',
        propertyType: d.data().propertyType || '',
        heating: d.data().heating || '',
        cooling: d.data().cooling || '',
        laundry: d.data().laundry || '',
        hoa: d.data().hoa || '',
        status: d.data().status || 'active',
        walkScore: d.data().walkScore,
        transitScore: d.data().transitScore,
        neighborhoodHighlights: d.data().neighborhoodHighlights || [],
        viewCount: d.data().viewCount || 0,
        saveCount: d.data().saveCount || 0,
      }));
      setListings(data);
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchListings(); }, []);

  /* Load comments and track view count when detail modal opens */
  useEffect(() => {
    if (selectedListing) {
      // Load comments
      loadComments(selectedListing.id);
      
      // Increment view count if not already viewed this session
      if (!viewedListingsRef.current.has(selectedListing.id)) {
        viewedListingsRef.current.add(selectedListing.id);
        setRecentlyViewed((prev) => {
          const updated = [selectedListing.id, ...prev.filter((id) => id !== selectedListing.id)].slice(0, 20);
          return updated;
        });
        // Increment viewCount in Firestore
        try {
          updateDoc(doc(db, 'listings', selectedListing.id), {
            viewCount: increment(1),
          });
        } catch (error) {
          console.error('Error updating view count:', error);
        }
      }
    }
  }, [selectedListing?.id]);

  // Deep-link: open specific listing from profile activity
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && listings.length > 0) {
      const found = listings.find((l: any) => l.id === openId);
      if (found) {
        setSelectedListing(found);
        setIsEditing(false);
        setDetailTab('overview');
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, listings]);

  /* filter + sort */
  const filteredListings = useMemo(() => {
    let result = listings.filter((l) => {
      if (myProperties && user?.uid) {
        if (l.posterId !== user.uid) return false;
      }
      if (selectedTypes.length > 0 && !selectedTypes.includes(l.type)) return false;
      if (searchQuery.trim()) {
        const match = fuzzyMatch(l.title, searchQuery) ||
          fuzzyMatch(l.address, searchQuery) ||
          fuzzyMatch(l.locCity, searchQuery) ||
          fuzzyMatch(l.desc, searchQuery);
        if (!match) return false;
      }
      if (bedsFilter !== 'any') {
        if (l.beds < parseInt(bedsFilter)) return false;
      }
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      const priceNum = parseNumericPrice(l.price);
      if (priceRange[0] && priceNum < parseFloat(priceRange[0])) return false;
      if (priceRange[1] && priceNum > parseFloat(priceRange[1])) return false;
      return true;
    });

    // Sort
    result.sort((a, b) => {
      // Featured always first
      if (a.featured !== b.featured) return b.featured ? 1 : -1;
      switch (sortBy) {
        case 'price-low': return parseNumericPrice(a.price) - parseNumericPrice(b.price);
        case 'price-high': return parseNumericPrice(b.price) - parseNumericPrice(a.price);
        case 'largest': return (b.sqft || 0) - (a.sqft || 0);
        case 'popular': return ((b.viewCount || 0) + (b.saveCount || 0)) - ((a.viewCount || 0) + (a.saveCount || 0));
        default: return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }
    });

    return result;
  }, [listings, selectedTypes, searchQuery, bedsFilter, priceRange, sortBy, statusFilter, myProperties, user?.uid]);

  const similarListings = useMemo(() => {
    if (!selectedListing) return [];
    return filteredListings
      .filter((l) => l.id !== selectedListing.id && l.type === selectedListing.type)
      .slice(0, 4);
  }, [selectedListing, filteredListings]);

  /* counts */
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: listings.length };
    listings.forEach((l) => { counts[l.type] = (counts[l.type] || 0) + 1; });
    return counts;
  }, [listings]);

  /* Comment functions */
  const loadComments = async (listingId: string) => {
    try {
      const snapshot = await getDocs(collection(db, 'listings', listingId, 'comments'));
      const data: Comment[] = snapshot.docs.map((d) => ({
        id: d.id,
        listingId: d.data().listingId,
        userId: d.data().userId,
        userName: d.data().userName,
        userAvatar: d.data().userAvatar,
        text: d.data().text,
        likes: d.data().likes || 0,
        likedBy: d.data().likedBy || [],
        createdAt: d.data().createdAt,
      }));
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async (listingId: string) => {
    if (!user || !commentText.trim()) return;
    setCommentLoading(true);
    try {
      await addDoc(collection(db, 'listings', listingId, 'comments'), {
        listingId,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userAvatar: user.photoURL || '',
        text: commentText,
        likes: 0,
        likedBy: [],
        createdAt: Timestamp.now(),
      });
      setCommentText('');
      await loadComments(listingId);
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleToggleCommentLike = async (listingId: string, commentId: string) => {
    if (!user) return;
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    const alreadyLiked = comment.likedBy.includes(user.uid);
    // Optimistic UI update
    setComments((prev) => prev.map((c) => {
      if (c.id !== commentId) return c;
      if (alreadyLiked) {
        return { ...c, likes: Math.max(c.likes - 1, 0), likedBy: c.likedBy.filter((uid) => uid !== user.uid) };
      } else {
        return { ...c, likes: c.likes + 1, likedBy: [...c.likedBy, user.uid] };
      }
    }));
    try {
      const newLikedBy = alreadyLiked
        ? comment.likedBy.filter((id) => id !== user.uid)
        : [...comment.likedBy, user.uid];
      await updateDoc(doc(db, 'listings', listingId, 'comments', commentId), {
        likes: newLikedBy.length,
        likedBy: newLikedBy,
      });
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const handleDeleteComment = (listingId: string, commentId: string) => {
    setDeleteCommentInfo({ listingId, commentId });
    setShowDeleteCommentConfirm(true);
  };

  const confirmDeleteComment = async () => {
    if (!deleteCommentInfo) return;
    try {
      await deleteDoc(doc(db, 'listings', deleteCommentInfo.listingId, 'comments', deleteCommentInfo.commentId));
      await loadComments(deleteCommentInfo.listingId);
    } catch (error) {
      console.error('Error deleting comment:', error);
    } finally {
      setShowDeleteCommentConfirm(false);
      setDeleteCommentInfo(null);
    }
  };

  /* CRUD handlers */
  const handleCreateListing = async () => {
    if (!formData.title || !formData.price || !formData.address || !formData.city || !formData.state) {
      setToastMessage('Please fill in all required fields (Title, Price, Address, City, and State)');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'listings'), {
        title: formData.title,
        type: formData.type,
        price: formData.price,
        beds: parseInt(formData.beds) || 1,
        baths: parseInt(formData.baths) || 1,
        sqft: parseInt(formData.sqft) || 0,
        address: formData.address,
        locCity: formData.city,
        locState: formData.state,
        locZip: formData.zip,
        desc: formData.desc,
        tags: formData.tags,
        featured: false,
        emoji: '🏠',
        bgColor: '#F5F5F5',
        posterName: user?.displayName || 'Anonymous',
        posterAvatar: user?.photoURL || '',
        posterId: user?.uid || '',
        createdAt: Timestamp.now(),
        heritage: Array.isArray(userProfile?.heritage)
          ? userProfile.heritage
          : userProfile?.heritage ? [userProfile.heritage] : [],
        contactPhone: formData.contactPhone,
        contactEmail: formData.contactEmail,
        availableDate: formData.availableDate,
        petPolicy: formData.petPolicy,
        parking: formData.parking,
        photos: formData.photos,
        coverPhotoIndex: Math.min(formData.coverPhotoIndex, Math.max(formData.photos.length - 1, 0)),
        videoUrl: formData.videoUrl,
        propertyType: formData.propertyType,
        yearBuilt: formData.yearBuilt,
        lotSize: formData.lotSize,
        heating: formData.heating,
        cooling: formData.cooling,
        laundry: formData.laundry,
        hoa: formData.hoa,
        status: formData.status || 'active',
        viewCount: 0,
        saveCount: 0,
      });
      setFormData({ title: '', type: 'rent', price: '', beds: '1', baths: '1', sqft: '', address: '', city: '', state: '', zip: '', desc: '', tags: [], contactPhone: '', contactEmail: '', availableDate: '', petPolicy: '', parking: '', photos: [], coverPhotoIndex: 0, videoUrl: '', propertyType: '', yearBuilt: '', lotSize: '', heating: '', cooling: '', laundry: '', hoa: '', status: 'active' as const, walkScore: '', transitScore: '', neighborhoodHighlights: [] });
      setShowCreateModal(false);
      await fetchListings();
    } catch (error) {
      console.error('Error creating listing:', error);
      setToastMessage('Failed to create listing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteListing = (listingId: string) => {
    setDeleteListingId(listingId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteListing = async () => {
    if (!deleteListingId) return;
    try {
      await deleteDoc(doc(db, 'listings', deleteListingId));
      setListings(listings.filter((l) => l.id !== deleteListingId));
      setSelectedListing(null);
    } catch (error) {
      console.error('Error deleting listing:', error);
      setToastMessage('Failed to delete listing. Please try again.');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteListingId(null);
    }
  };

  const handleStartEdit = () => {
    if (!selectedListing) return;
    setEditData({
      title: selectedListing.title,
      type: selectedListing.type,
      price: selectedListing.price,
      beds: String(selectedListing.beds),
      baths: String(selectedListing.baths),
      sqft: String(selectedListing.sqft),
      address: selectedListing.address,
      city: selectedListing.locCity,
      state: selectedListing.locState,
      zip: selectedListing.locZip,
      desc: selectedListing.desc,
      tags: selectedListing.tags || [],
      contactPhone: selectedListing.contactPhone || '',
      contactEmail: selectedListing.contactEmail || '',
      availableDate: selectedListing.availableDate || '',
      petPolicy: selectedListing.petPolicy || '',
      parking: selectedListing.parking || '',
      photos: selectedListing.photos || [],
      coverPhotoIndex: selectedListing.coverPhotoIndex || 0,
      videoUrl: selectedListing.videoUrl || '',
      propertyType: selectedListing.propertyType || '',
      yearBuilt: selectedListing.yearBuilt || '',
      lotSize: selectedListing.lotSize || '',
      heating: selectedListing.heating || '',
      cooling: selectedListing.cooling || '',
      laundry: selectedListing.laundry || '',
      hoa: selectedListing.hoa || '',
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedListing) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'listings', selectedListing.id), {
        title: editData.title,
        type: editData.type,
        price: editData.price,
        beds: parseInt(editData.beds) || 1,
        baths: parseInt(editData.baths) || 1,
        sqft: parseInt(editData.sqft) || 0,
        address: editData.address,
        locCity: editData.city,
        locState: editData.state,
        locZip: editData.zip,
        desc: editData.desc,
        tags: editData.tags,
        contactPhone: editData.contactPhone,
        contactEmail: editData.contactEmail,
        availableDate: editData.availableDate,
        petPolicy: editData.petPolicy,
        parking: editData.parking,
        photos: editData.photos,
        coverPhotoIndex: Math.min(editData.coverPhotoIndex || 0, Math.max((editData.photos || []).length - 1, 0)),
        videoUrl: editData.videoUrl,
        propertyType: editData.propertyType,
        yearBuilt: editData.yearBuilt,
        lotSize: editData.lotSize,
        heating: editData.heating,
        cooling: editData.cooling,
        laundry: editData.laundry,
        hoa: editData.hoa,
      });
      const updated = {
        ...selectedListing,
        ...editData,
        beds: parseInt(editData.beds) || 1,
        baths: parseInt(editData.baths) || 1,
        sqft: parseInt(editData.sqft) || 0,
        locCity: editData.city,
        locState: editData.state,
        locZip: editData.zip,
      };
      setSelectedListing(updated);
      setListings(listings.map((l) => l.id === updated.id ? updated : l));
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating listing:', error);
      setToastMessage('Failed to update listing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTag = (tag: string, isCreate = true) => {
    if (isCreate) {
      setFormData((prev) => ({
        ...prev,
        tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      }));
    } else {
      setEditData((prev: any) => ({
        ...prev,
        tags: prev.tags.includes(tag) ? prev.tags.filter((t: string) => t !== tag) : [...prev.tags, tag],
      }));
    }
  };

  const handleShare = async (listing: Listing) => {
    const text = `${listing.title} — ${listing.price}\n${fullAddress(listing)}`;
    if (navigator.share) {
      try { await navigator.share({ title: listing.title, text }); }
      catch (error) {
        setToastMessage('Failed to share listing. Please try again.');
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setToastMessage('Listing link copied to clipboard!');
      } catch (error) {
        setToastMessage('Failed to copy listing link. Please try again.');
      }
    }
  };

  const isOwnerOrAdmin = (l: Listing) => l.posterId === user?.uid || userRole === 'admin';

  /* render helper for property card image */
  const renderCardImage = (listing: Listing) => {
    const config = TYPE_CONFIG[listing.type] || TYPE_CONFIG.rent;
    const hasPhotos = listing.photos && listing.photos.length > 0;

    if (hasPhotos) {
      return <PhotoCarousel photos={listing.photos!} />;
    }

    return (
      <div className={`aspect-[16/10] bg-gradient-to-br ${config.gradient} flex items-center justify-center relative`}>
        <config.icon size={48} className="text-white/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
    );
  };

  /* ─── render form fields (shared between create & edit) ─── */
  const renderFormFields = (data: any, setData: (d: any) => void, isCreate: boolean) => (
    <div className="space-y-5">
      {/* Photos */}
      {photosEnabled && (
        <PhotoUploader
          photos={data.photos || []}
          onPhotosChange={(photos) => setData({ ...data, photos })}
          onCoverChange={(coverPhotoIndex) => setData({ ...data, coverPhotoIndex })}
          coverIndex={data.coverPhotoIndex || 0}
          videoUrl={data.videoUrl || ''}
          onVideoUrlChange={(videoUrl) => setData({ ...data, videoUrl })}
        />
      )}

      <div className="border-t border-[var(--aurora-border)] pt-5" />

      {/* Basic Info */}
      <FormField label="Listing Title" required>
        <input type="text" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })}
          className={inputCls} placeholder="e.g., Sunny 2BR apartment with skyline views" />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Listing Type" required>
          <select value={data.type} onChange={(e) => setData({ ...data, type: e.target.value })} className={inputCls}>
            {(['rent', 'sale', 'roommate', 'sublet'] as const).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Property Type">
          <select value={data.propertyType || ''} onChange={(e) => setData({ ...data, propertyType: e.target.value })} className={inputCls}>
            <option value="">Select...</option>
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Status">
          <select value={data.status || 'active'} onChange={(e) => setData({ ...data, status: e.target.value })} className={inputCls}>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="under_contract">Under Contract</option>
            <option value="sold">Sold</option>
            <option value="rented">Rented</option>
          </select>
        </FormField>
      </div>

      <FormField label="Price" required>
        <div className="relative">
          <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-muted)]" />
          <input type="text" value={data.price} onChange={(e) => setData({ ...data, price: e.target.value })}
            className={`${inputCls} pl-9`} placeholder="1,200/month or 350,000" />
        </div>
      </FormField>

      {/* Specs row */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
        <FormField label="Beds">
          <input type="number" min="0" value={data.beds} onChange={(e) => setData({ ...data, beds: e.target.value })} className={inputCls} />
        </FormField>
        <FormField label="Baths">
          <input type="number" min="0" step="0.5" value={data.baths} onChange={(e) => setData({ ...data, baths: e.target.value })} className={inputCls} />
        </FormField>
        <FormField label="Sqft">
          <input type="number" min="0" value={data.sqft} onChange={(e) => setData({ ...data, sqft: e.target.value })} className={inputCls} />
        </FormField>
      </div>

      <div className="border-t border-[var(--aurora-border)] pt-5" />

      {/* Location */}
      <FormField label="Street Address" required>
        <div className="relative">
          <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-muted)]" />
          <input type="text" value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })}
            className={`${inputCls} pl-9`} placeholder="123 Main St, Apt 4B" />
        </div>
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="City">
          <input type="text" value={data.city || ''} onChange={(e) => setData({ ...data, city: e.target.value })} className={inputCls} />
        </FormField>
        <FormField label="State">
          <input type="text" value={data.state || ''} onChange={(e) => setData({ ...data, state: e.target.value.toUpperCase() })} maxLength={2} className={`${inputCls} uppercase`} />
        </FormField>
        <FormField label="ZIP">
          <input type="text" value={data.zip || ''} onChange={(e) => setData({ ...data, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })} maxLength={5} className={inputCls} />
        </FormField>
      </div>

      <div className="border-t border-[var(--aurora-border)] pt-5" />

      {/* Description */}
      <FormField label="Description">
        <textarea value={data.desc} onChange={(e) => setData({ ...data, desc: e.target.value })}
          className={`${inputCls} resize-none`} rows={4} placeholder="Describe the property, neighborhood, and what makes it special..." />
      </FormField>

      {/* Property details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Available Date">
          <input type="date" value={data.availableDate || ''} onChange={(e) => setData({ ...data, availableDate: e.target.value })} className={inputCls} />
        </FormField>
        <FormField label="Year Built">
          <input type="text" value={data.yearBuilt || ''} onChange={(e) => setData({ ...data, yearBuilt: e.target.value })} className={inputCls} placeholder="2020" />
        </FormField>
        <FormField label="Lot Size">
          <input type="text" value={data.lotSize || ''} onChange={(e) => setData({ ...data, lotSize: e.target.value })} className={inputCls} placeholder="0.25 acres" />
        </FormField>
        <FormField label="HOA Fee">
          <input type="text" value={data.hoa || ''} onChange={(e) => setData({ ...data, hoa: e.target.value })} className={inputCls} placeholder="$200/month" />
        </FormField>
        <FormField label="Pet Policy">
          <select value={data.petPolicy || ''} onChange={(e) => setData({ ...data, petPolicy: e.target.value })} className={inputCls}>
            <option value="">Select...</option>
            {PET_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </FormField>
        <FormField label="Parking">
          <select value={data.parking || ''} onChange={(e) => setData({ ...data, parking: e.target.value })} className={inputCls}>
            <option value="">Select...</option>
            {PARKING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </FormField>
        <FormField label="Heating">
          <input type="text" value={data.heating || ''} onChange={(e) => setData({ ...data, heating: e.target.value })} className={inputCls} placeholder="Central, Forced Air..." />
        </FormField>
        <FormField label="Cooling">
          <input type="text" value={data.cooling || ''} onChange={(e) => setData({ ...data, cooling: e.target.value })} className={inputCls} placeholder="Central AC, Window..." />
        </FormField>
      </div>

      <div className="border-t border-[var(--aurora-border)] pt-5" />

      {/* Contact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Contact Phone">
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-muted)]" />
            <input type="tel" value={data.contactPhone || ''} onChange={(e) => setData({ ...data, contactPhone: e.target.value })}
              className={`${inputCls} pl-9`} placeholder="(555) 123-4567" />
          </div>
        </FormField>
        <FormField label="Contact Email">
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-muted)]" />
            <input type="email" value={data.contactEmail || ''} onChange={(e) => setData({ ...data, contactEmail: e.target.value })}
              className={`${inputCls} pl-9`} placeholder="you@email.com" />
          </div>
        </FormField>
      </div>

      <div className="border-t border-[var(--aurora-border)] pt-5" />

      {/* Amenities */}
      <div>
        <label className="block text-sm font-semibold text-[var(--aurora-text)] mb-3">Amenities & Features</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AVAILABLE_TAGS.map((tag) => {
            const TagIcon = TAG_ICONS[tag] || CheckCircle2;
            const isSelected = isCreate ? data.tags.includes(tag) : data.tags?.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleToggleTag(tag, isCreate)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-aurora-indigo text-white shadow-sm'
                    : 'bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-border)]'
                }`}
              >
                <TagIcon size={14} />
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ─── MAIN RENDER ─── */
  return (
    <div className="bg-[var(--aurora-bg)]">

      {/* ===== Search Header ===== */}
      <div className="relative bg-gradient-to-br from-aurora-indigo/8 via-aurora-surface to-emerald-500/8 border-b border-aurora-border z-40">
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-3">
          {/* Search bar + Listing Type dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-muted" />
              <input
                type="text"
                placeholder="Search by address, city, neighborhood..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 bg-aurora-surface border border-aurora-border rounded-full text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Listing Type Dropdown - Multi-select with checkboxes */}
            <div className="relative shrink-0" ref={typeDropdownRef}>
              <button
                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full text-sm font-medium transition-all border ${
                  selectedTypes.length > 0
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-aurora-surface border-aurora-border text-aurora-text-secondary hover:border-aurora-text-muted'
                }`}
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">{selectedTypes.length > 0 ? `Type (${selectedTypes.length})` : 'Type'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {typeDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-2">
                  {(['rent', 'sale', 'roommate', 'sublet'] as const).map((type) => {
                    const config = TYPE_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <label
                        key={type}
                        className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes(type)}
                          onChange={() => {
                            setSelectedTypes((prev) =>
                              prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]
                            );
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                        />
                        <Icon className="w-4 h-4" style={{ color: config.color }} />
                        <span className="text-sm text-gray-700 flex-1">{config.label}</span>
                        <span className="text-xs text-gray-400">{typeCounts[type] || 0}</span>
                      </label>
                    );
                  })}
                  {selectedTypes.length > 0 && (
                    <div className="border-t border-gray-200 mt-1 pt-1 px-4 py-1.5">
                      <button
                        onClick={() => setSelectedTypes([])}
                        className="text-xs text-indigo-600 font-medium hover:text-indigo-500"
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

      {/* ===== Zillow-style Filter Bar ===== */}
      <div className="bg-aurora-surface border-b border-aurora-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">

            {/* Sort pill (leftmost) */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-1.5 border border-aurora-border rounded-full text-xs font-semibold bg-aurora-surface text-aurora-text focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40 shrink-0 appearance-none cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price ↑</option>
              <option value="price-high">Price ↓</option>
              <option value="largest">Largest</option>
              <option value="popular">Popular</option>
            </select>

            {/* Price pill dropdown */}
            <div className="relative shrink-0" ref={priceDropRef}>
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'price' ? null : 'price')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
                  priceRange[0] || priceRange[1]
                    ? 'bg-aurora-indigo text-white border-aurora-indigo'
                    : activeDropdown === 'price'
                    ? 'bg-aurora-surface border-aurora-indigo text-aurora-indigo'
                    : 'bg-aurora-surface border-aurora-border text-aurora-text hover:border-aurora-text-muted'
                }`}
              >
                {priceRange[0] || priceRange[1]
                  ? `$${priceRange[0] || '0'} – $${priceRange[1] || '∞'}`
                  : 'Price'}
                <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === 'price' ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === 'price' && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Price Range</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-400 font-medium">MIN</label>
                      <input type="number" placeholder="No min" value={priceRange[0]} onChange={(e) => setPriceRange([e.target.value, priceRange[1]])}
                        className="w-full mt-0.5 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40" />
                    </div>
                    <span className="text-gray-300 mt-4">–</span>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-400 font-medium">MAX</label>
                      <input type="number" placeholder="No max" value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], e.target.value])}
                        className="w-full mt-0.5 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40" />
                    </div>
                  </div>
                  {(priceRange[0] || priceRange[1]) && (
                    <button onClick={() => { setPriceRange(['', '']); }} className="text-xs text-aurora-indigo font-medium mt-3 hover:underline">Reset</button>
                  )}
                </div>
              )}
            </div>

            {/* Beds pill dropdown */}
            <div className="relative shrink-0" ref={bedsDropRef}>
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'beds' ? null : 'beds')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
                  bedsFilter !== 'any'
                    ? 'bg-aurora-indigo text-white border-aurora-indigo'
                    : activeDropdown === 'beds'
                    ? 'bg-aurora-surface border-aurora-indigo text-aurora-indigo'
                    : 'bg-aurora-surface border-aurora-border text-aurora-text hover:border-aurora-text-muted'
                }`}
              >
                <BedDouble className="w-3.5 h-3.5" />
                {bedsFilter !== 'any' ? `${bedsFilter}+ Beds` : 'Beds'}
                <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === 'beds' ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === 'beds' && (
                <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1.5">
                  {[{ val: 'any', label: 'Any' }, { val: '1', label: '1+' }, { val: '2', label: '2+' }, { val: '3', label: '3+' }, { val: '4', label: '4+' }, { val: '5', label: '5+' }].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => { setBedsFilter(opt.val); setActiveDropdown(null); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        bedsFilter === opt.val ? 'bg-aurora-indigo/10 text-aurora-indigo font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label} {opt.val !== 'any' ? 'Beds' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status pill dropdown */}
            <div className="relative shrink-0" ref={moreDropRef}>
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'more' ? null : 'more')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
                  statusFilter !== 'all'
                    ? 'bg-aurora-indigo text-white border-aurora-indigo'
                    : activeDropdown === 'more'
                    ? 'bg-aurora-surface border-aurora-indigo text-aurora-indigo'
                    : 'bg-aurora-surface border-aurora-border text-aurora-text hover:border-aurora-text-muted'
                }`}
              >
                {statusFilter !== 'all' ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1).replace('_', ' ') : 'Status'}
                <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === 'more' ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === 'more' && (
                <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1.5">
                  {[{ val: 'all', label: 'All Status' }, { val: 'active', label: 'Active' }, { val: 'pending', label: 'Pending' }, { val: 'under_contract', label: 'Under Contract' }, { val: 'sold', label: 'Sold' }, { val: 'rented', label: 'Rented' }].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => { setStatusFilter(opt.val); setActiveDropdown(null); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        statusFilter === opt.val ? 'bg-aurora-indigo/10 text-aurora-indigo font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="w-px h-5 bg-aurora-border shrink-0 mx-0.5" />

            {/* All / Saved / Recents tabs inline */}
            {(['all', 'saved', 'recent'] as const).map((tab) => {
              const isActive = activeListTab === tab;
              const label = tab === 'all' ? 'All' : tab === 'saved' ? 'Saved' : 'Recents';
              const count = tab === 'saved' ? savedListings.size : tab === 'recent' ? recentlyViewed.length : filteredListings.length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveListTab(tab)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-aurora-indigo text-white'
                      : 'text-aurora-text-muted hover:bg-aurora-surface-variant'
                  }`}
                >
                  {tab === 'saved' && <Heart size={12} className={isActive ? 'fill-white' : ''} />}
                  {tab === 'recent' && <Clock size={12} />}
                  {label}
                  <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-aurora-text-muted'}`}>{count}</span>
                </button>
              );
            })}

            {/* Results count */}
            <span className="text-[10px] text-aurora-text-muted whitespace-nowrap ml-auto shrink-0">{filteredListings.length} results</span>
          </div>
        </div>
      </div>

      {/* ===== Listings ===== */}
      <div className="max-w-6xl mx-auto px-4 py-5 pb-24">
        {myProperties && user && (
          <div className="max-w-7xl mx-auto px-4 pt-4 pb-2">
            <div className="bg-[var(--aurora-surface)] rounded-xl border border-[var(--aurora-border)] p-4 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[var(--aurora-text)] flex items-center gap-2">
                  My Properties ({filteredListings.length})
                </h2>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-aurora-indigo text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:opacity-90 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  List Property
                </button>
              </div>
            </div>
          </div>
        )}
        {loading ? (
          <div className={"grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}>
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (() => {
          const displayListings = activeListTab === 'saved'
            ? filteredListings.filter((l) => savedListings.has(l.id))
            : activeListTab === 'recent'
            ? filteredListings.filter((l) => recentlyViewed.includes(l.id))
            : filteredListings;
          return displayListings.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-[var(--aurora-surface-variant)] flex items-center justify-center mx-auto mb-4">
              <Home size={32} className="text-[var(--aurora-text-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--aurora-text)]">No Listings Found</h3>
            <p className="text-[var(--aurora-text-muted)] mt-2 max-w-sm mx-auto text-sm">
              {activeListTab === 'saved'
                ? 'You have not saved any listings yet. Browse properties and save your favorites!'
                : activeListTab === 'recent'
                ? 'No recently viewed listings. Start exploring properties!'
                : searchQuery
                ? `No results for "${searchQuery}". Try adjusting your search or filters.`
                : 'Be the first to list a property!'}
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedTypes([]); setBedsFilter('any'); setPriceRange(['', '']); setStatusFilter('all'); }}
              className="mt-3 text-sm text-aurora-indigo font-medium hover:underline"
            >
              Clear all filters
            </button>
          </div>
          ) : (
            <div className={"grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}>
              {displayListings.map((listing) => {
              const config = TYPE_CONFIG[listing.type] || TYPE_CONFIG.rent;
              const isSaved = savedListings.has(listing.id);
              const hasPhotos = listing.photos && listing.photos.length > 0;

              /* ─── Grid Card ─── */
              return (
                <div
                  key={listing.id}
                  onClick={() => { setSelectedListing(listing); setIsEditing(false); setDetailTab('overview'); }}
                  className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] overflow-hidden cursor-pointer hover:shadow-lg transition-all group"
                >
                  {/* Image area */}
                  <div className="relative">
                    {renderCardImage(listing)}
                    
                    {/* Sold/Rented overlay */}
                    {(listing.status === 'sold' || listing.status === 'rented') && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-t-2xl">
                        <span className={`text-2xl font-bold text-white px-6 py-3 rounded-xl ${listing.status === 'sold' ? 'bg-red-600/90' : 'bg-blue-600/90'}`}>
                          {listing.status === 'sold' ? 'SOLD' : 'RENTED'}
                        </span>
                      </div>
                    )}

                    {/* Save heart */}
                    <button
                      onClick={(e) => toggleSave(listing.id, e)}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-all shadow-sm z-10"
                    >
                      <Heart size={18} className={`transition-colors ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                    </button>

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                      <span
                        className="text-[10px] font-bold text-white px-2.5 py-1 rounded-full shadow-sm"
                        style={{ backgroundColor: config.color }}
                      >
                        {config.label}
                      </span>
                      {listing.featured && (
                        <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                          <Sparkles size={10} /> FEATURED
                        </span>
                      )}
                      {listing.status && listing.status !== 'active' && (
                        <span className={`text-[10px] font-bold text-white px-2.5 py-1 rounded-full shadow-sm ${STATUS_CONFIG[listing.status]?.bgColor || 'bg-gray-500'}`} style={{ backgroundColor: STATUS_CONFIG[listing.status]?.color || '#6B7280' }}>
                          {STATUS_CONFIG[listing.status]?.label || listing.status}
                        </span>
                      )}
                    </div>

                    {/* Time */}
                    {listing.createdAt && (
                      <span className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
                        <Clock size={10} /> {getTimeAgo(listing.createdAt)}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-xl font-bold text-aurora-indigo">{listing.price}</p>
                      {listing.sqft > 0 && (
                        <span className="text-[10px] text-[var(--aurora-text-muted)] mt-1">${Math.round(parseNumericPrice(listing.price) / listing.sqft)}/sqft</span>
                      )}
                    </div>

                    <h3 className="font-semibold text-[var(--aurora-text)] text-sm truncate">{listing.title}</h3>

                    {/* Specs */}
                    <div className="flex items-center gap-3 text-sm text-[var(--aurora-text-secondary)] mt-2">
                      <span className="flex items-center gap-1"><BedDouble size={14} /> {listing.beds} bd</span>
                      <span className="flex items-center gap-1"><Bath size={14} /> {listing.baths} ba</span>
                      {listing.sqft > 0 && <span className="flex items-center gap-1"><Ruler size={14} /> {listing.sqft.toLocaleString()}</span>}
                    </div>

                    <p className="text-xs text-[var(--aurora-text-muted)] mt-2 truncate flex items-center gap-1">
                      <MapPin size={11} /> {listing.locCity || listing.address}{listing.locState ? `, ${listing.locState}` : ''}
                    </p>

                    {/* Tags */}
                    {listing.tags && listing.tags.length > 0 && (
                      <div className="flex gap-1 mt-2.5 flex-wrap">
                        {listing.tags.slice(0, 3).map((tag) => {
                          const TagIcon = TAG_ICONS[tag] || Tag;
                          return (
                            <span key={tag} className="text-[10px] bg-aurora-indigo/8 text-aurora-indigo px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                              <TagIcon size={9} /> {tag}
                            </span>
                          );
                        })}
                        {listing.tags.length > 3 && (
                          <span className="text-[10px] text-[var(--aurora-text-muted)]">+{listing.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    
                    {/* View/Save counts */}
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--aurora-text-muted)] mt-2.5 pt-2.5 border-t border-[var(--aurora-border)]">
                      <button onClick={() => { setSelectedListing(listing); setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, viewCount: (l.viewCount || 0) + 1 } : l)); try { updateDoc(doc(db, 'listings', listing.id), { viewCount: increment(1) }); } catch {} }} className="flex items-center gap-1 hover:text-aurora-indigo transition-colors">
                        <Eye size={12} /> {listing.viewCount || 0}
                      </button>
                      <button onClick={(e) => toggleSave(listing.id, e)} className="flex items-center gap-1 hover:text-red-500 transition-colors">
                        <Heart size={12} className={isSaved ? 'fill-red-500 text-red-500' : ''} /> {listing.saveCount || 0}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          );
        })()}
      </div>

      {/* ===== Detail Modal ===== */}
      {selectedListing && !isEditing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={() => setSelectedListing(null)}>
          <div
            className="bg-[var(--aurora-surface)] w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[94vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Photo Gallery / Hero */}
            <div className="relative flex-shrink-0">
              {selectedListing.photos && selectedListing.photos.length > 0 ? (
                <div className="relative">
                  <PhotoCarousel
                    photos={selectedListing.photos}
                    onExpand={() => { setGalleryIdx(0); setPhotoGalleryOpen(true); }}
                  />
                  {selectedListing.videoUrl && (
                    <a
                      href={selectedListing.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-black/80 transition-colors z-10"
                    >
                      <Video size={14} /> Video Tour
                    </a>
                  )}
                </div>
              ) : (
                <div className={`h-44 sm:h-56 bg-gradient-to-br ${(TYPE_CONFIG[selectedListing.type] || TYPE_CONFIG.rent).gradient} flex items-center justify-center sm:rounded-t-2xl relative`}>
                  {React.createElement((TYPE_CONFIG[selectedListing.type] || TYPE_CONFIG.rent).icon, { size: 56, className: 'text-white/25' })}
                </div>
              )}

              {/* Close button */}
              <button
                onClick={() => setSelectedListing(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white z-20"
                aria-label="Close listing details"
              >
                <X size={18} />
              </button>

              {/* Save + Share */}
              <div className="absolute top-3 left-3 flex gap-2 z-20">
                <button
                  onClick={(e) => toggleSave(selectedListing.id, e)}
                  className="w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-sm"
                  aria-label={savedListings.has(selectedListing.id) ? 'Remove from saved' : 'Save listing'}
                >
                  <Heart size={18} className={savedListings.has(selectedListing.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'} />
                </button>
                <button
                  onClick={() => handleShare(selectedListing)}
                  className="w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-sm"
                  aria-label="Share listing"
                >
                  <Share2 size={16} className="text-gray-600" />
                </button>
              </div>

              {/* Type badge */}
              <span
                className="absolute bottom-3 right-3 text-xs font-bold text-white px-3 py-1 rounded-full shadow-sm z-10"
                style={{ backgroundColor: (TYPE_CONFIG[selectedListing.type] || TYPE_CONFIG.rent).color }}
              >
                {(TYPE_CONFIG[selectedListing.type] || TYPE_CONFIG.rent).label}
              </span>
            </div>

            {/* Scrollable Content - Single scroll layout */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Price + Title ── */}
              <div className="p-5 border-b border-[var(--aurora-border)]">
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-bold text-aurora-indigo">{selectedListing.price}</p>
                  {selectedListing.sqft > 0 && (
                    <span className="text-xs text-[var(--aurora-text-muted)]">${selectedListing.sqft > 0 ? Math.round(parseNumericPrice(selectedListing.price) / selectedListing.sqft) : '—'}/sqft</span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-[var(--aurora-text)] mt-1">{selectedListing.title}</h2>

                {/* Key specs */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 bg-[var(--aurora-surface-variant)] rounded-xl p-2 sm:p-3">
                  <div className="text-center">
                    <BedDouble size={20} className="mx-auto text-aurora-indigo mb-1" />
                    <p className="text-lg font-bold text-[var(--aurora-text)]">{selectedListing.beds}</p>
                    <p className="text-[10px] text-[var(--aurora-text-muted)]">Beds</p>
                  </div>
                  <div className="text-center border-x border-[var(--aurora-border)]">
                    <Bath size={20} className="mx-auto text-aurora-indigo mb-1" />
                    <p className="text-lg font-bold text-[var(--aurora-text)]">{selectedListing.baths}</p>
                    <p className="text-[10px] text-[var(--aurora-text-muted)]">Baths</p>
                  </div>
                  <div className="text-center">
                    <Ruler size={20} className="mx-auto text-aurora-indigo mb-1" />
                    <p className="text-lg font-bold text-[var(--aurora-text)]">{selectedListing.sqft > 0 ? selectedListing.sqft.toLocaleString() : '—'}</p>
                    <p className="text-[10px] text-[var(--aurora-text-muted)]">Sqft</p>
                  </div>
                </div>
              </div>

              {/* ── Location ── */}
              <a
                href={getGoogleMapsUrl(fullAddress(selectedListing))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-5 border-b border-[var(--aurora-border)] hover:bg-[var(--aurora-surface-variant)] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-aurora-indigo/10 flex items-center justify-center flex-shrink-0">
                  <MapPin size={20} className="text-aurora-indigo" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-[var(--aurora-text)] text-sm">{selectedListing.address}</p>
                  <p className="text-xs text-[var(--aurora-text-secondary)]">
                    {[selectedListing.locCity, selectedListing.locState, selectedListing.locZip].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-aurora-indigo text-xs mt-1 font-medium flex items-center gap-1">
                    <ExternalLink size={11} /> View on Google Maps
                  </p>
                </div>
              </a>

              {/* ── Description ── */}
              <div className="p-5 border-b border-[var(--aurora-border)]">
                <h3 className="text-sm font-bold text-[var(--aurora-text)] mb-2">About This Property</h3>
                <p className="text-sm text-[var(--aurora-text-secondary)] leading-relaxed whitespace-pre-line">
                  {selectedListing.desc || 'No description provided.'}
                </p>
              </div>

              {/* ── Property Facts (was Details tab) ── */}
              <div className="p-5 border-b border-[var(--aurora-border)]">
                <h3 className="text-sm font-bold text-[var(--aurora-text)] mb-3 flex items-center gap-2"><Home size={16} /> Property Facts</h3>
                <div className="bg-[var(--aurora-surface-variant)] rounded-xl divide-y divide-[var(--aurora-border)]">
                  {[
                    { label: 'Type', value: (TYPE_CONFIG[selectedListing.type] || TYPE_CONFIG.rent).label, icon: Building2 },
                    { label: 'Property', value: selectedListing.propertyType, icon: Home },
                    { label: 'Bedrooms', value: String(selectedListing.beds), icon: BedDouble },
                    { label: 'Bathrooms', value: String(selectedListing.baths), icon: Bath },
                    { label: 'Square Feet', value: selectedListing.sqft > 0 ? selectedListing.sqft.toLocaleString() : undefined, icon: Ruler },
                    { label: 'Year Built', value: selectedListing.yearBuilt, icon: Calendar },
                    { label: 'Lot Size', value: selectedListing.lotSize, icon: TreePine },
                    { label: 'HOA Fee', value: selectedListing.hoa, icon: DollarSign },
                  ].filter(r => r.value).map((row) => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-[var(--aurora-text-muted)]">
                        <row.icon size={14} /> {row.label}
                      </span>
                      <span className="text-sm font-medium text-[var(--aurora-text)]">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Additional Details ── */}
              {(selectedListing.availableDate || selectedListing.petPolicy || selectedListing.parking || selectedListing.heating || selectedListing.cooling) && (
                <div className="p-5 border-b border-[var(--aurora-border)]">
                  <h3 className="text-sm font-bold text-[var(--aurora-text)] mb-3 flex items-center gap-2"><Shield size={16} /> Additional Details</h3>
                  <div className="bg-[var(--aurora-surface-variant)] rounded-xl divide-y divide-[var(--aurora-border)]">
                    {[
                      { label: 'Available Date', value: selectedListing.availableDate, icon: Calendar },
                      { label: 'Pet Policy', value: selectedListing.petPolicy, icon: PawPrint },
                      { label: 'Parking', value: selectedListing.parking, icon: Car },
                      { label: 'Heating', value: selectedListing.heating, icon: Flame },
                      { label: 'Cooling', value: selectedListing.cooling, icon: Snowflake },
                      { label: 'Laundry', value: selectedListing.laundry, icon: Droplets },
                    ].filter(r => r.value).map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-4 py-3">
                        <span className="flex items-center gap-2 text-sm text-[var(--aurora-text-muted)]">
                          <row.icon size={14} /> {row.label}
                        </span>
                        <span className="text-sm font-medium text-[var(--aurora-text)]">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Amenities ── */}
              {selectedListing.tags && selectedListing.tags.length > 0 && (
                <div className="p-5 border-b border-[var(--aurora-border)]">
                  <h3 className="text-sm font-bold text-[var(--aurora-text)] mb-3">Amenities & Features</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedListing.tags.map((tag) => {
                      const TagIcon = TAG_ICONS[tag] || CheckCircle2;
                      return (
                        <div key={tag} className="flex items-center gap-2 text-sm text-[var(--aurora-text-secondary)]">
                          <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <TagIcon size={14} className="text-green-600" />
                          </div>
                          {tag}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Heritage ── */}
              {selectedListing.heritage && (
                <div className="p-5 border-b border-[var(--aurora-border)]">
                  <h3 className="text-sm font-bold text-[var(--aurora-text)] mb-2">Heritage Community</h3>
                  <div className="flex gap-2 flex-wrap">
                    {(Array.isArray(selectedListing.heritage) ? selectedListing.heritage : [selectedListing.heritage]).map((h) => (
                      <span key={h} className="text-xs bg-amber-500/10 text-amber-700 px-3 py-1.5 rounded-full font-medium">{h}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Map & Neighborhood (was Map tab) ── */}
              <div className="p-5 border-b border-[var(--aurora-border)] space-y-4">
                <h3 className="text-sm font-bold text-[var(--aurora-text)] flex items-center gap-2"><Map size={16} /> Location & Neighborhood</h3>

                {/* Neighborhood scores */}
                {(selectedListing.walkScore || selectedListing.transitScore) && (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedListing.walkScore && (
                      <div className="bg-[var(--aurora-surface-variant)] rounded-xl p-3 text-center">
                        <p className="text-xs text-[var(--aurora-text-muted)] mb-1">Walk Score</p>
                        <p className="text-2xl font-bold text-aurora-indigo">{selectedListing.walkScore}</p>
                      </div>
                    )}
                    {selectedListing.transitScore && (
                      <div className="bg-[var(--aurora-surface-variant)] rounded-xl p-3 text-center">
                        <p className="text-xs text-[var(--aurora-text-muted)] mb-1">Transit Score</p>
                        <p className="text-2xl font-bold text-aurora-indigo">{selectedListing.transitScore}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Neighborhood highlights */}
                {selectedListing.neighborhoodHighlights && selectedListing.neighborhoodHighlights.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--aurora-text-muted)] uppercase tracking-wider mb-2">Neighborhood Highlights</h4>
                    <ul className="space-y-1">
                      {selectedListing.neighborhoodHighlights.map((highlight, idx) => (
                        <li key={idx} className="text-sm text-[var(--aurora-text-secondary)] flex items-start gap-2">
                          <span className="text-aurora-indigo mt-1">•</span>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Embedded map */}
                <div className="w-full h-48 sm:h-64 rounded-xl overflow-hidden border border-[var(--aurora-border)]">
                  <iframe
                    src={getGoogleMapsEmbedUrl(fullAddress(selectedListing))}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Property Location"
                  />
                </div>
                <a
                  href={getGoogleMapsUrl(fullAddress(selectedListing))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-aurora-indigo font-medium hover:underline"
                >
                  <ExternalLink size={14} /> Open in Google Maps
                </a>
              </div>

              {/* ── Mortgage Calculator (was Calculator tab) ── */}
              <div className="p-5 border-b border-[var(--aurora-border)] space-y-4">
                <h3 className="text-sm font-bold text-[var(--aurora-text)] flex items-center gap-2"><DollarSign size={16} /> Mortgage Calculator</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--aurora-text)] mb-1 block">Down Payment (%)</label>
                    <input
                      type="number"
                      value={calcDownPayment}
                      onChange={(e) => setCalcDownPayment(e.target.value)}
                      min="0"
                      max="100"
                      className={inputCls}
                      placeholder="20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--aurora-text)] mb-1 block">Interest Rate (%)</label>
                    <input
                      type="number"
                      value={calcInterestRate}
                      onChange={(e) => setCalcInterestRate(e.target.value)}
                      step="0.1"
                      min="0"
                      max="100"
                      className={inputCls}
                      placeholder="6.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--aurora-text)] mb-1 block">Loan Term (years)</label>
                    <input
                      type="number"
                      value={calcLoanTerm}
                      onChange={(e) => setCalcLoanTerm(e.target.value)}
                      min="1"
                      max="60"
                      className={inputCls}
                      placeholder="30"
                    />
                  </div>
                </div>
                {(() => {
                  const price = parseNumericPrice(selectedListing.price);
                  const downPaymentPct = parseFloat(calcDownPayment) || 0;
                  const interestRatePct = parseFloat(calcInterestRate) || 0;
                  const loanTermYears = parseFloat(calcLoanTerm) || 1;
                  if (downPaymentPct < 0 || downPaymentPct > 100 || interestRatePct < 0 || interestRatePct > 100 || loanTermYears <= 0) {
                    return (
                      <div className="bg-[var(--aurora-surface-variant)] rounded-xl p-4">
                        <p className="text-sm text-[var(--aurora-text-muted)]">Please enter valid calculator values</p>
                      </div>
                    );
                  }
                  const downPayment = (price * downPaymentPct) / 100;
                  const principal = price - downPayment;
                  const monthlyRate = interestRatePct / 100 / 12;
                  const numberOfPayments = loanTermYears * 12;
                  const monthlyPayment =
                    monthlyRate === 0
                      ? principal / numberOfPayments
                      : (principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments))) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
                  return (
                    <div className="bg-[var(--aurora-surface-variant)] rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--aurora-text-muted)]">Home Price:</span>
                        <span className="font-medium text-[var(--aurora-text)]">${price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--aurora-text-muted)]">Down Payment:</span>
                        <span className="font-medium text-[var(--aurora-text)]">${downPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-[var(--aurora-border)] pt-2">
                        <span className="text-[var(--aurora-text-muted)]">Loan Amount:</span>
                        <span className="font-medium text-[var(--aurora-text)]">${principal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold text-aurora-indigo border-t border-[var(--aurora-border)] pt-2 mt-2">
                        <span>Monthly Payment:</span>
                        <span>${monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Similar Listings ── */}
              {similarListings.length > 0 && (
                <div className="p-5 border-b border-[var(--aurora-border)]">
                  <h3 className="text-sm font-bold text-[var(--aurora-text)] mb-3">Similar Listings</h3>
                  <div className="overflow-x-auto">
                    <div className="flex gap-3 pb-2">
                      {similarListings.map((similar) => {
                        const similConfig = TYPE_CONFIG[similar.type] || TYPE_CONFIG.rent;
                        return (
                          <div
                            key={similar.id}
                            onClick={() => { setSelectedListing(similar); }}
                            className="flex-shrink-0 w-32 sm:w-36 lg:w-40 bg-[var(--aurora-surface-variant)] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-all"
                          >
                            <div className="relative h-24 bg-gradient-to-br from-indigo-400 to-purple-500">
                              {similar.photos && similar.photos.length > 0 ? (
                                <img src={similar.photos[0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                React.createElement(similConfig.icon, { size: 32, className: 'absolute inset-0 m-auto text-white/30' })
                              )}
                            </div>
                            <div className="p-2">
                              <p className="font-bold text-aurora-indigo text-sm">{similar.price}</p>
                              <p className="text-xs text-[var(--aurora-text)] truncate font-medium">{similar.title}</p>
                              <p className="text-xs text-[var(--aurora-text-muted)]">{similar.beds} bd • {similar.baths} ba</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Contact card ── */}
              <div className="p-5 border-b border-[var(--aurora-border)]">
                <div className="bg-[var(--aurora-surface-variant)] rounded-2xl p-4">
                  <h3 className="text-sm font-bold text-[var(--aurora-text)] mb-3">Listed By</h3>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-aurora-indigo/10 flex items-center justify-center">
                      {selectedListing.posterAvatar ? (
                        <img src={selectedListing.posterAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-aurora-indigo">{selectedListing.posterName.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[var(--aurora-text)]">{selectedListing.posterName}</p>
                      {selectedListing.createdAt && (
                        <p className="text-[10px] text-[var(--aurora-text-muted)]">Posted {getTimeAgo(selectedListing.createdAt)}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selectedListing.contactPhone && (
                      <a href={`tel:${selectedListing.contactPhone}`} className="flex items-center gap-2 text-sm text-aurora-indigo font-medium">
                        <div className="w-8 h-8 rounded-lg bg-aurora-indigo/10 flex items-center justify-center"><Phone size={14} className="text-aurora-indigo" /></div>
                        {selectedListing.contactPhone}
                      </a>
                    )}
                    {selectedListing.contactEmail && (
                      <a href={`mailto:${selectedListing.contactEmail}`} className="flex items-center gap-2 text-sm text-aurora-indigo font-medium">
                        <div className="w-8 h-8 rounded-lg bg-aurora-indigo/10 flex items-center justify-center"><Mail size={14} className="text-aurora-indigo" /></div>
                        {selectedListing.contactEmail}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Comments (was Comments tab) ── */}
              <div className="p-5 space-y-4 pb-6">
                <h3 className="text-sm font-bold text-[var(--aurora-text)] flex items-center gap-2"><MessageCircle size={16} /> Comments ({comments.length})</h3>

                {/* Add comment */}
                {user && (
                  <div className="space-y-2">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Share your thoughts about this listing..."
                      className={`${inputCls} resize-none`}
                      rows={3}
                    />
                    <button
                      onClick={() => handleAddComment(selectedListing.id)}
                      disabled={commentLoading || !commentText.trim()}
                      className="w-full py-2 bg-aurora-indigo text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {commentLoading ? <Loader2 size={16} className="animate-spin" /> : 'Post Comment'}
                    </button>
                  </div>
                )}

                {/* Comments list */}
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-[var(--aurora-surface-variant)] rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <img
                            src={comment.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--aurora-text)]">{comment.userName}</p>
                            <p className="text-xs text-[var(--aurora-text-muted)]">{getTimeAgo(comment.createdAt)}</p>
                          </div>
                        </div>
                        {user?.uid === comment.userId && (
                          <button
                            onClick={() => handleDeleteComment(selectedListing.id, comment.id)}
                            className="text-[var(--aurora-text-muted)] hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-[var(--aurora-text-secondary)] mt-2">{comment.text}</p>
                      <button
                        onClick={() => handleToggleCommentLike(selectedListing.id, comment.id)}
                        className="mt-2 flex items-center gap-1 text-xs text-[var(--aurora-text-muted)] hover:text-aurora-indigo transition-colors"
                      >
                        <Heart size={12} className={user?.uid && comment.likedBy.includes(user.uid) ? 'fill-aurora-indigo text-aurora-indigo' : ''} />
                        {comment.likes}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Actions bar */}
            {isOwnerOrAdmin(selectedListing) && (
              <div className="border-t border-[var(--aurora-border)] p-4 flex gap-3 flex-shrink-0">
                <button
                  onClick={handleStartEdit}
                  className="flex-1 flex items-center justify-center gap-2 bg-aurora-indigo text-white py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  <Edit3 size={16} /> Edit Listing
                </button>
                <button
                  onClick={() => handleDeleteListing(selectedListing.id)}
                  className="px-4 py-2.5 bg-red-500/10 text-red-600 rounded-xl font-medium hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Fullscreen Photo Gallery ===== */}
      {photoGalleryOpen && selectedListing?.photos && selectedListing.photos.length > 0 && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col" onClick={() => setPhotoGalleryOpen(false)}>
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm font-medium">{galleryIdx + 1} / {selectedListing.photos.length}</span>
            <button onClick={() => setPhotoGalleryOpen(false)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label="Close photo gallery">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedListing.photos[galleryIdx]}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
            {selectedListing.photos.length > 1 && (
              <>
                <button
                  onClick={() => setGalleryIdx((p) => (p - 1 + selectedListing.photos!.length) % selectedListing.photos!.length)}
                  className="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                  aria-label="Previous photo in gallery"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={() => setGalleryIdx((p) => (p + 1) % selectedListing.photos!.length)}
                  className="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                  aria-label="Next photo in gallery"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
          {/* Thumbnails */}
          <div className="flex gap-2 overflow-x-auto p-4 justify-center">
            {selectedListing.photos.map((photo, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setGalleryIdx(i); }}
                className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                  i === galleryIdx ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== Edit Modal ===== */}
      {isEditing && selectedListing && (
        <div className="fixed inset-0 bg-[var(--aurora-surface)] z-50 flex flex-col">
          <div className="flex-shrink-0 bg-[var(--aurora-surface)] border-b border-[var(--aurora-border)] p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Edit3 size={18} className="text-aurora-indigo" />
              <h2 className="text-lg font-bold text-[var(--aurora-text)]">Edit Listing</h2>
            </div>
            <button onClick={() => setIsEditing(false)} className="w-9 h-9 rounded-full hover:bg-[var(--aurora-surface-variant)] flex items-center justify-center text-[var(--aurora-text-muted)]">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-24">
            {renderFormFields(editData, setEditData, false)}
          </div>
          <div className="flex-shrink-0 bg-[var(--aurora-surface)] border-t border-[var(--aurora-border)] p-4 flex gap-3">
            <button onClick={() => setIsEditing(false)} className="flex-1 bg-[var(--aurora-surface-variant)] text-[var(--aurora-text-secondary)] py-2.5 rounded-xl font-medium hover:opacity-80">
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex-1 bg-aurora-indigo text-white py-2.5 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Changes'}
            </button>
          </div>
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

      {/* ===== Create Modal ===== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[var(--aurora-surface)] z-50 flex flex-col">
          <div className="flex-shrink-0 bg-[var(--aurora-surface)] border-b border-[var(--aurora-border)] p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-aurora-indigo" />
              <h2 className="text-lg font-bold text-[var(--aurora-text)]">List a Property</h2>
            </div>
            <button onClick={() => setShowCreateModal(false)} className="w-9 h-9 rounded-full hover:bg-[var(--aurora-surface-variant)] flex items-center justify-center text-[var(--aurora-text-muted)]" aria-label="Close create modal">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-24">
            {renderFormFields(formData, (d: any) => setFormData(d), true)}
          </div>
          <div className="flex-shrink-0 bg-[var(--aurora-surface)] border-t border-[var(--aurora-border)] p-4">
            <button
              onClick={handleCreateListing}
              disabled={saving}
              className="w-full bg-aurora-indigo text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><Plus size={18} /> Create Listing</>}
            </button>
          </div>
        </div>
      )}

      {/* ===== Delete Listing Confirmation Modal ===== */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => { setShowDeleteConfirm(false); setDeleteListingId(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Listing</h3>
            </div>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this listing? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteListingId(null); }} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={confirmDeleteListing} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete Comment Confirmation Modal ===== */}
      {showDeleteCommentConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => { setShowDeleteCommentConfirm(false); setDeleteCommentInfo(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <MessageCircle size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Comment</h3>
            </div>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this comment?</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteCommentConfirm(false); setDeleteCommentInfo(null); }} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={confirmDeleteComment} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Toast Notification ===== */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg max-w-md text-center text-sm font-medium animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
