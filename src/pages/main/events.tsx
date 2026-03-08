import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, where, orderBy, getDocs, addDoc, deleteDoc,
  doc, updateDoc, Timestamp, limit, arrayUnion, arrayRemove, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, MapPin, Clock, Calendar, CalendarDays, Users, UserCheck,
  X, Plus, Heart, Sparkles, Ticket, ChevronRight, ArrowLeft,
  ExternalLink, Trash2, Loader2, Star, Music, BookOpen, Utensils,
  Trophy, Handshake, Baby, Church, Tag, Share2,
  ChevronLeft, AlertCircle, Download, Send, MessageCircle,
  Check, ChevronDown, MoreVertical, Upload, Camera, Image as ImageIcon, Edit2,
  SlidersHorizontal, Globe
} from 'lucide-react';
import { useFeatureSettings } from '../../contexts/FeatureSettingsContext';
import { ETHNICITY_HIERARCHY } from '../../constants/config';

interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  description?: string;
}

interface EventComment {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: any;
}

interface Event {
  id: string;
  title: string;
  emoji: string;
  type: string;
  fullDate: string;
  time: string;
  endTime?: string;
  location: string;
  locCity: string;
  locState: string;
  locZip: string;
  desc: string;
  ticket: 'free' | 'ticketed';
  price?: string;
  organizer: string;
  promoted: boolean;
  count: number;
  posterId: string;
  posterName: string;
  createdAt: any;
  disabled: boolean;
  rsvpUsers?: string[];
  status?: 'coming_soon' | 'active' | 'sold_out' | 'canceled' | 'postponed';
  capacity?: number;
  contactEmail?: string;
  contactPhone?: string;
  ticketTiers?: TicketTier[];
  waitlistUsers?: string[];
  waitlistEnabled?: boolean;
  photos?: string[];
  coverPhotoIndex?: number;
  heritage?: string[];
}

const EVENT_TYPES: { [key: string]: string } = {
  Cultural: '🎭', Community: '🎉', Religious: '🙏', Sports: '⚽',
  Educational: '📚', Networking: '🤝', Family: '👨‍👩‍👧‍👦',
  Music: '🎵', Food: '🍽️', Other: '📌',
};

const EVENT_TYPE_COLORS: { [key: string]: string } = {
  Cultural: '#7C3AED', Community: '#EA580C', Religious: '#B45309',
  Sports: '#059669', Educational: '#6366F1', Networking: '#475569',
  Family: '#6D28D9', Music: '#DC2626', Food: '#EA580C', Other: '#6B7280',
};

const EVENT_TYPE_ICONS: { [key: string]: any } = {
  Cultural: Star, Community: Users, Religious: Church, Sports: Trophy,
  Educational: BookOpen, Networking: Handshake, Family: Baby,
  Music: Music, Food: Utensils, Other: Tag,
};

const STATUS_COLORS: { [key: string]: { bg: string; text: string; badge: string } } = {
  active: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', badge: 'bg-emerald-500 text-white' },
  coming_soon: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-500 text-white' },
  sold_out: { bg: 'bg-gray-50 dark:bg-gray-500/10', text: 'text-gray-700 dark:text-gray-400', badge: 'bg-gray-500 text-white' },
  canceled: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-500 text-white' },
  postponed: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', badge: 'bg-purple-500 text-white' },
};

// Date helpers
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

const getTodayISO = () => new Date().toISOString().split('T')[0];

const isoToDisplay = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};

const isoToReadable = (iso: string) => {
  if (!iso) return '';
  const date = new Date(iso + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const time24to12 = (time: string) => {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr);
  const m = mStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
};

// Parse event date — handles MM/DD/YYYY or YYYY-MM-DD
const parseEventDate = (fullDate: string): Date => {
  if (fullDate.includes('/')) {
    const [m, d, y] = fullDate.split('/');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }
  return new Date(fullDate + 'T12:00:00');
};

const isEventPast = (fullDate: string) => {
  const date = parseEventDate(fullDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

// Format event date to readable parts
const getDateParts = (fullDate: string) => {
  const date = parseEventDate(fullDate);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    month: months[date.getMonth()],
    day: date.getDate().toString(),
    weekday: days[date.getDay()],
    full: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  };
};

// Date range helpers for carousel
const getDateRange = (preset: string): { start: Date; end: Date } | null => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const today = new Date(now);

  switch (preset) {
    case 'Today':
      return { start: today, end: today };
    case 'Tomorrow': {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { start: tomorrow, end: tomorrow };
    }
    case 'This Weekend': {
      const dayOfWeek = today.getDay();
      const sat = new Date(today);
      sat.setDate(today.getDate() + (6 - dayOfWeek));
      const sun = new Date(sat);
      sun.setDate(sat.getDate() + 1);
      return { start: sat, end: sun };
    }
    case 'This Week': {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
      return { start: today, end: endOfWeek };
    }
    case 'This Month': {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: today, end: endOfMonth };
    }
    default:
      return null;
  }
};

const isDateInRange = (fullDate: string, range: { start: Date; end: Date }) => {
  const date = parseEventDate(fullDate);
  date.setHours(0, 0, 0, 0);
  return date >= range.start && date <= range.end;
};

const getGoogleMapsUrl = (location: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

const getGoogleCalendarUrl = (event: Event) => {
  const startDate = event.fullDate.split('/').reverse().join('');
  const endDate = event.fullDate.split('/').reverse().join('');
  const startTime = event.time.replace(':', '');
  const endTime = event.endTime ? event.endTime.replace(':', '') : '235959';
  const location = `${event.location}${event.locCity ? ', ' + event.locCity : ''}${event.locState ? ', ' + event.locState : ''}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}T${startTime}00Z/${endDate}T${endTime}00Z&location=${encodeURIComponent(location)}&details=${encodeURIComponent(event.desc)}`;
};

// Escape special ICS characters
const escapeICS = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
};

const generateICS = (event: Event): string => {
  const startDate = event.fullDate.split('/').reverse().join('');
  const startTime = event.time.replace(':', '');
  const endDate = event.fullDate.split('/').reverse().join('');
  const endTime = event.endTime ? event.endTime.replace(':', '') : '235959';
  const location = `${event.location}${event.locCity ? ', ' + event.locCity : ''}${event.locState ? ', ' + event.locState : ''}`;

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ethniCity//Events//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${event.id}@ethnicity.local
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startDate}T${startTime}00Z
DTEND:${endDate}T${endTime}00Z
SUMMARY:${escapeICS(event.title)}
DESCRIPTION:${escapeICS(event.desc)}
LOCATION:${escapeICS(location)}
END:VEVENT
END:VCALENDAR`;

  return ics;
};

// Form input (defined outside component to prevent re-mount on keystroke)
const FormInput = ({ label, required, ...props }: any) => (
  <div>
    <label className="block text-sm font-medium text-aurora-text mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input {...props} className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo transition-all" />
  </div>
);

/* ─── Image compression utility ─── */
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

/* ─── Event Photo Uploader Component ─── */
function EventPhotoUploader({
  photos,
  onPhotosChange,
  onCoverChange,
  coverIndex,
}: {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onCoverChange: (index: number) => void;
  coverIndex: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const remaining = 5 - photos.length;
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
      <label className="block text-sm font-medium text-aurora-text">
        Event Photos (max 5)
      </label>
      {photos.length < 5 && (
        <div
          className="border-2 border-dashed border-aurora-border rounded-xl p-5 text-center cursor-pointer hover:border-aurora-indigo hover:bg-aurora-surface-variant transition-all"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-6 h-6 mx-auto text-aurora-text-muted mb-1" />
          <p className="text-sm font-medium text-aurora-text">Click to upload photos</p>
          <p className="text-xs text-aurora-text-muted mt-0.5">PNG, JPG up to 5MB each</p>
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
          <p className="text-[11px] text-aurora-text-muted">Tap a photo to set it as cover image. {photos.length}/5 uploaded.</p>
        </>
      )}
    </div>
  );
}

export default function EventsPage() {
  const { user, userProfile, userRole } = useAuth();
  const { isFeatureEnabled } = useFeatureSettings();
  const photosEnabled = isFeatureEnabled('events_photos');
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const myEvents = false; // My Events moved to Profile page
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [detailPhotoIdx, setDetailPhotoIdx] = useState(0);
  const [userRSVPs, setUserRSVPs] = useState<Set<string>>(new Set());
  const [userWaitlists, setUserWaitlists] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedDateFilter, setSelectedDateFilter] = useState('All');
  const [showPast, setShowPast] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dateError, setDateError] = useState('');
  const [savedEvents, setSavedEvents] = useState<Set<string>>(new Set());
  const [rsvpAnimating, setRsvpAnimating] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedHeritage, setSelectedHeritage] = useState<string[]>([]);
  const [heritageDropdownOpen, setHeritageDropdownOpen] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [expandedSubregions, setExpandedSubregions] = useState<Set<string>>(new Set());
  const heritageRef = useRef<HTMLDivElement>(null);
  const [createStep, setCreateStep] = useState(1);
  const [comments, setComments] = useState<EventComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [attendeeLoading, setAttendeeLoading] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    title: '', type: 'Community', description: '',
    fullDate: '', time: '', endTime: '',
    location: '', city: '', state: '', zip: '',
    ticketType: 'simple' as 'simple' | 'tiered',
    price: '', capacity: '',
    contactEmail: '', contactPhone: '',
    ticketTiers: [] as TicketTier[],
    waitlistEnabled: false,
    photos: [] as string[],
    coverPhotoIndex: 0,
    ticket: 'free' as 'free' | 'ticketed',
  });
  const commentUnsubscribeRef = useRef<(() => void) | undefined>(undefined);

  const [formData, setFormData] = useState({
    title: '', type: 'Community', date: '', endDate: '', time: '', endTime: '',
    location: '', state: '', city: '', zip: '', description: '',
    ticketType: 'simple' as 'simple' | 'tiered', price: '', capacity: '',
    contactEmail: '', contactPhone: '', ticketTiers: [] as TicketTier[],
    waitlistEnabled: false,
    photos: [] as string[],
    coverPhotoIndex: 0,
  });

  const isOwnerOrAdmin = (e: Event) => e.posterId === user?.uid || userRole === 'admin';

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

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

  // Load saved events from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('saved_events');
      if (saved) setSavedEvents(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  const toggleSaved = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      try { localStorage.setItem('saved_events', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const fetchEvents = async () => {
    try {
      let snapshot;
      try {
        const q = query(collection(db, 'events'), where('disabled', '==', false), orderBy('createdAt', 'desc'), limit(100));
        snapshot = await getDocs(q);
      } catch {
        try {
          const q = query(collection(db, 'events'), where('disabled', '==', false));
          snapshot = await getDocs(q);
        } catch {
          snapshot = await getDocs(collection(db, 'events'));
        }
      }

      const eventsList: Event[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.disabled) return;
        eventsList.push({
          id: d.id, title: data.title || '', emoji: data.emoji || EVENT_TYPES[data.type] || '📌',
          type: data.type || 'Other', fullDate: data.fullDate || '', time: data.time || '',
          endTime: data.endTime, location: data.location || '', locCity: data.locCity || data.city || '',
          locState: data.locState || data.state || '', locZip: data.locZip || data.zip || '',
          desc: data.desc || data.description || '', ticket: data.ticket || 'free',
          price: data.price || '', organizer: data.organizer || data.posterName || 'Anonymous',
          promoted: data.promoted || false, count: data.count || (data.rsvpUsers?.length || 0),
          posterId: data.posterId || '', posterName: data.posterName || 'Anonymous',
          createdAt: data.createdAt, disabled: data.disabled || false, rsvpUsers: data.rsvpUsers || [],
          status: data.status || 'active',
          capacity: data.capacity,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          ticketTiers: data.ticketTiers,
          waitlistUsers: data.waitlistUsers || [],
          waitlistEnabled: data.waitlistEnabled || false,
          photos: data.photos || [],
          coverPhotoIndex: data.coverPhotoIndex || 0,
        });
      });

      eventsList.sort((a, b) => {
        if (a.promoted && !b.promoted) return -1;
        if (!a.promoted && b.promoted) return 1;
        return 0;
      });

      setEvents(eventsList);

      if (user?.uid) {
        const rsvpIds = new Set<string>();
        const waitlistIds = new Set<string>();
        eventsList.forEach((e) => {
          if (e.rsvpUsers?.includes(user.uid)) rsvpIds.add(e.id);
          if (e.waitlistUsers?.includes(user.uid)) waitlistIds.add(e.id);
        });
        setUserRSVPs(rsvpIds);
        setUserWaitlists(waitlistIds);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [user?.uid]);

  useEffect(() => {
    return () => {
      if (commentUnsubscribeRef.current) {
        commentUnsubscribeRef.current();
        commentUnsubscribeRef.current = undefined;
      }
    };
  }, []);

  // Deep-link: open specific event from profile activity
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && events.length > 0) {
      const found = events.find((e: any) => e.id === openId);
      if (found) {
        setSelectedEvent(found);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, events]);

  const loadComments = (eventId: string) => {
    try {
      // Clean up previous subscription
      if (commentUnsubscribeRef.current) {
        commentUnsubscribeRef.current();
      }

      const unsubscribe = onSnapshot(
        collection(db, 'events', eventId, 'comments'),
        (snapshot) => {
          const commentsList: EventComment[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            commentsList.push({
              id: doc.id,
              text: data.text || '',
              userId: data.userId || '',
              userName: data.userName || 'Anonymous',
              userAvatar: data.userAvatar,
              createdAt: data.createdAt,
            });
          });
          commentsList.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime();
            const timeB = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime();
            return timeA - timeB;
          });
          setComments(commentsList);
        }
      );
      commentUnsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const loadAttendees = async (eventId: string, rsvpUserIds?: string[]) => {
    if (!rsvpUserIds || rsvpUserIds.length === 0) {
      setAttendees([]);
      return;
    }
    setAttendeeLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const userIds = rsvpUserIds.slice(0, 6);
      const snapshot = await getDocs(query(usersRef, where('__name__', 'in', userIds)));
      const attendeesList: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        attendeesList.push({
          uid: doc.id,
          name: data.displayName || 'User',
          avatar: data.photoURL || '',
        });
      });
      setAttendees(attendeesList);
    } catch (error) {
      console.error('Error loading attendees:', error);
    } finally {
      setAttendeeLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    let result = events;

    if (myEvents && user?.uid) {
      result = result.filter((event) => event.posterId === user.uid);
    }

    return result.filter((event) => {
      if (!showPast && isEventPast(event.fullDate)) return false;
      const matchesSearch = fuzzyMatch(event.title, searchQuery) || fuzzyMatch(event.type, searchQuery) || fuzzyMatch(event.location, searchQuery) || fuzzyMatch(event.desc, searchQuery);
      const matchesFilter = selectedFilter === 'All' || event.type === selectedFilter;

      // Date filter
      let matchesDate = true;
      if (selectedDateFilter !== 'All') {
        const range = getDateRange(selectedDateFilter);
        if (range) matchesDate = isDateInRange(event.fullDate, range);
      }

      // Heritage/Ethnicity filter
      const matchesHeritage = selectedHeritage.length === 0 || (event.heritage && event.heritage.some((h) => selectedHeritage.includes(h)));

      return matchesSearch && matchesFilter && matchesDate && matchesHeritage;
    });
  }, [events, searchQuery, selectedFilter, selectedDateFilter, showPast, myEvents, user, selectedHeritage]);

  const featuredEvents = events.filter((e) => e.promoted && !isEventPast(e.fullDate));

  const handleDateChange = (val: string) => {
    setFormData({ ...formData, date: val });
    if (val) {
      const selected = new Date(val + 'T12:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setDateError(selected < today ? 'Cannot select a past date' : '');
    } else {
      setDateError('');
    }
  };

  const isSoldOut = (event: Event): boolean => {
    if (event.ticketTiers) {
      return event.ticketTiers.every((tier) => tier.sold >= tier.quantity);
    }
    if (event.capacity) {
      return (event.rsvpUsers?.length || 0) >= event.capacity;
    }
    return false;
  };

  const addTicketTier = () => {
    setFormData({
      ...formData,
      ticketTiers: [...formData.ticketTiers, { id: Date.now().toString(), name: '', price: 0, quantity: 0, sold: 0 }],
    });
  };

  const removeTicketTier = (id: string) => {
    setFormData({
      ...formData,
      ticketTiers: formData.ticketTiers.filter((t) => t.id !== id),
    });
  };

  const updateTicketTier = (id: string, updates: Partial<TicketTier>) => {
    setFormData({
      ...formData,
      ticketTiers: formData.ticketTiers.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    });
  };

  const handleCreateEvent = async () => {
    if (!formData.title || !formData.type || !formData.date || !formData.time || !formData.location || !formData.description) {
      setToastMessage('Please fill in all required fields');
      return;
    }

    if (formData.ticketType === 'tiered' && formData.ticketTiers.length === 0) {
      setToastMessage('Please add at least one ticket tier');
      return;
    }

    // Validate end time is after start time
    if (formData.endTime && formData.endTime <= formData.time) {
      setToastMessage('End time must be after start time');
      return;
    }

    const selectedDate = new Date(formData.date + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) { setToastMessage('Event date cannot be in the past'); return; }

    setCreating(true);
    try {
      const displayDate = isoToDisplay(formData.date);
      const displayTime = time24to12(formData.time);
      const [y, m, d] = formData.date.split('-');
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

      const eventData: any = {
        title: formData.title, emoji: EVENT_TYPES[formData.type] || '📌',
        type: formData.type, month: monthNames[parseInt(m) - 1], day: d,
        fullDate: displayDate, time: displayTime, location: formData.location,
        locState: formData.state, locCity: formData.city, locZip: formData.zip,
        desc: formData.description, ticket: (formData.ticketType === 'simple' && !formData.price) ? 'free' : 'ticketed',
        organizer: user?.displayName || 'Anonymous', promoted: false, count: 0,
        posterId: user?.uid || '', posterName: user?.displayName || 'Anonymous',
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(), disabled: false, rsvpUsers: [],
        status: 'active',
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        waitlistEnabled: formData.waitlistEnabled,
        waitlistUsers: [],
        ...(formData.photos.length > 0 ? { photos: formData.photos, coverPhotoIndex: Math.min(formData.coverPhotoIndex, formData.photos.length - 1) } : {}),
      };

      if (formData.endTime) {
        eventData.endTime = time24to12(formData.endTime);
      }

      if (formData.ticketType === 'simple') {
        eventData.price = '';
      } else {
        eventData.price = formData.price;
      }

      if (formData.capacity) {
        eventData.capacity = parseInt(formData.capacity);
      }

      if (formData.ticketType === 'tiered') {
        eventData.ticketTiers = formData.ticketTiers;
      }

      await addDoc(collection(db, 'events'), eventData);

      setFormData({
        title: '', type: 'Community', date: '', endDate: '', time: '', endTime: '',
        location: '', state: '', city: '', zip: '', description: '',
        ticketType: 'simple', price: '', capacity: '',
        contactEmail: '', contactPhone: '', ticketTiers: [],
        waitlistEnabled: false,
        photos: [], coverPhotoIndex: 0,
      });
      setCreateStep(1);
      setShowCreateModal(false);
      setDateError('');
      await fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      setToastMessage('Failed to create event. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleRSVP = async (eventId: string) => {
    if (!user?.uid) { setToastMessage('Please log in to RSVP'); return; }

    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const isSoldOutStatus = isSoldOut(event);

    setRsvpAnimating(eventId);

    try {
      const eventRef = doc(db, 'events', eventId);
      const isRSVPed = userRSVPs.has(eventId);
      const isWaitlisted = userWaitlists.has(eventId);

      if (isRSVPed) {
        // Remove from RSVP
        await updateDoc(eventRef, { rsvpUsers: arrayRemove(user.uid), count: Math.max(0, event.count - 1) });
        setUserRSVPs((prev) => { const n = new Set(prev); n.delete(eventId); return n; });
        setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, count: Math.max(0, e.count - 1), rsvpUsers: (e.rsvpUsers || []).filter((u) => u !== user.uid) } : e));
      } else if (isWaitlisted) {
        // Remove from waitlist
        await updateDoc(eventRef, { waitlistUsers: arrayRemove(user.uid) });
        setUserWaitlists((prev) => { const n = new Set(prev); n.delete(eventId); return n; });
        setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, waitlistUsers: (e.waitlistUsers || []).filter((u) => u !== user.uid) } : e));
      } else if (isSoldOutStatus || (event.capacity && (event.rsvpUsers?.length || 0) >= event.capacity)) {
        // Add to waitlist
        if (event.waitlistEnabled) {
          await updateDoc(eventRef, { waitlistUsers: arrayUnion(user.uid) });
          setUserWaitlists((prev) => new Set([...prev, eventId]));
          setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, waitlistUsers: [...(e.waitlistUsers || []), user.uid] } : e));
        }
      } else {
        // Add to RSVP
        await updateDoc(eventRef, { rsvpUsers: arrayUnion(user.uid), count: event.count + 1 });
        setUserRSVPs((prev) => new Set([...prev, eventId]));
        setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, count: e.count + 1, rsvpUsers: [...(e.rsvpUsers || []), user.uid] } : e));
      }

      if (selectedEvent?.id === eventId) {
        if (isRSVPed) {
          setSelectedEvent((prev) => prev ? { ...prev, count: Math.max(0, prev.count - 1) } : prev);
        } else if (!isWaitlisted && !isSoldOutStatus && !(event.capacity && (event.rsvpUsers?.length || 0) >= event.capacity)) {
          setSelectedEvent((prev) => prev ? { ...prev, count: prev.count + 1 } : prev);
        }
      }
    } catch (error) {
      console.error('Error updating RSVP:', error);
      setToastMessage('Failed to update RSVP. Please try again.');
    } finally {
      setTimeout(() => setRsvpAnimating(null), 300);
    }
  };

  const handleAddComment = async (eventId: string) => {
    if (!user?.uid || !newComment.trim()) return;

    setCommentLoading(true);
    try {
      await addDoc(collection(db, 'events', eventId, 'comments'), {
        text: newComment,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userAvatar: userProfile?.avatar || '',
        createdAt: Timestamp.now(),
      });
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    setDeleteEventId(eventId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteEvent = async () => {
    if (!deleteEventId) return;
    try {
      await deleteDoc(doc(db, 'events', deleteEventId));
      setEvents(events.filter((e) => e.id !== deleteEventId));
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      setToastMessage('Failed to delete event. Please try again.');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteEventId(null);
    }
  };

  const handleStartEdit = () => {
    if (!selectedEvent) return;
    // Parse the display date back to ISO for the date input
    // fullDate is in format "MM/DD/YYYY"
    const parts = selectedEvent.fullDate.split('/');
    const isoDate = parts.length === 3 ? `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : '';
    // Parse 12h time back to 24h
    const parse12to24 = (t: string) => {
      const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!match) return '';
      let h = parseInt(match[1]);
      const m = match[2];
      const ap = match[3].toUpperCase();
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${m}`;
    };
    setEditData({
      title: selectedEvent.title,
      type: selectedEvent.type,
      description: selectedEvent.desc,
      fullDate: isoDate,
      time: parse12to24(selectedEvent.time),
      endTime: selectedEvent.endTime ? parse12to24(selectedEvent.endTime) : '',
      location: selectedEvent.location,
      city: selectedEvent.locCity || '',
      state: selectedEvent.locState || '',
      zip: selectedEvent.locZip || '',
      ticketType: selectedEvent.ticketTiers && selectedEvent.ticketTiers.length > 0 ? 'tiered' : 'simple',
      price: selectedEvent.price || '',
      capacity: selectedEvent.capacity ? String(selectedEvent.capacity) : '',
      contactEmail: selectedEvent.contactEmail || '',
      contactPhone: selectedEvent.contactPhone || '',
      ticketTiers: selectedEvent.ticketTiers || [],
      waitlistEnabled: selectedEvent.waitlistEnabled || false,
      photos: selectedEvent.photos || [],
      coverPhotoIndex: selectedEvent.coverPhotoIndex || 0,
      ticket: selectedEvent.ticket,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEvent) return;
    if (!editData.title || !editData.type || !editData.fullDate || !editData.time || !editData.location || !editData.description) {
      setToastMessage('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      const displayDate = isoToDisplay(editData.fullDate);
      const displayTime = time24to12(editData.time);
      const [y, m, d] = editData.fullDate.split('-');
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

      const updateData: any = {
        title: editData.title,
        emoji: EVENT_TYPES[editData.type] || '📌',
        type: editData.type,
        month: monthNames[parseInt(m) - 1],
        day: d,
        fullDate: displayDate,
        time: displayTime,
        location: editData.location,
        locCity: editData.city,
        locState: editData.state,
        locZip: editData.zip,
        desc: editData.description,
        ticket: (editData.ticketType === 'simple' && !editData.price) ? 'free' : 'ticketed',
        contactEmail: editData.contactEmail,
        contactPhone: editData.contactPhone,
        waitlistEnabled: editData.waitlistEnabled,
        updatedAt: Timestamp.now(),
      };

      if (editData.endTime) {
        updateData.endTime = time24to12(editData.endTime);
      }

      if (editData.ticketType === 'simple') {
        updateData.price = editData.price || '';
      } else {
        updateData.price = editData.price;
        updateData.ticketTiers = editData.ticketTiers;
      }

      if (editData.capacity) {
        updateData.capacity = parseInt(editData.capacity);
      }

      if (editData.photos.length > 0) {
        updateData.photos = editData.photos;
        updateData.coverPhotoIndex = Math.min(editData.coverPhotoIndex, editData.photos.length - 1);
      } else {
        updateData.photos = [];
        updateData.coverPhotoIndex = 0;
      }

      await updateDoc(doc(db, 'events', selectedEvent.id), updateData);

      const updated = {
        ...selectedEvent,
        ...updateData,
      };
      setSelectedEvent(updated);
      setEvents(events.map((e) => e.id === updated.id ? updated : e));
      setIsEditing(false);
      setToastMessage('Event updated successfully!');
    } catch (error) {
      console.error('Error updating event:', error);
      setToastMessage('Failed to update event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (eventId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'events', eventId), { status: newStatus });
      setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, status: newStatus as any } : e));
      if (selectedEvent?.id === eventId) {
        setSelectedEvent((prev) => prev ? { ...prev, status: newStatus as any } : prev);
      }
      setStatusDropdown(null);
    } catch (error) {
      console.error('Error updating status:', error);
      setToastMessage('Failed to update event status. Please try again.');
    }
  };

  const handleShare = async (event: Event) => {
    const text = `${event.title} — ${event.fullDate} at ${event.time}\n${event.location}`;
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text }); } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setToastMessage('Event details copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        setToastMessage('Failed to copy event details. Please try again.');
      }
    }
  };

  const downloadICS = (event: Event) => {
    const ics = generateICS(event);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Date badge component
  const DateBadge = ({ fullDate, size = 'sm' }: { fullDate: string; size?: 'sm' | 'lg' }) => {
    const parts = getDateParts(fullDate);
    const past = isEventPast(fullDate);
    return (
      <div className={`flex flex-col items-center justify-center rounded-xl font-bold
        ${size === 'lg' ? 'w-16 h-16' : 'w-12 h-12'}
        ${past ? 'bg-gray-100 dark:bg-gray-800 text-aurora-text-muted' : 'bg-aurora-indigo/10 text-aurora-indigo'}`}>
        <span className={`uppercase leading-none ${size === 'lg' ? 'text-[10px]' : 'text-[9px]'}`}>{parts.month}</span>
        <span className={`leading-none ${size === 'lg' ? 'text-xl' : 'text-lg'}`}>{parts.day}</span>
      </div>
    );
  };

  // Skeleton
  const SkeletonCard = () => (
    <div className="bg-aurora-surface rounded-2xl border border-aurora-border overflow-hidden animate-pulse">
      <div className="p-4 flex gap-3">
        <div className="w-12 h-12 rounded-xl bg-aurora-surface-variant shimmer flex-shrink-0" />
        <div className="flex-1">
          <div className="h-4 w-3/4 bg-aurora-surface-variant shimmer rounded mb-2" />
          <div className="h-3 w-1/2 bg-aurora-surface-variant shimmer rounded mb-1" />
          <div className="h-3 w-2/3 bg-aurora-surface-variant shimmer rounded" />
        </div>
      </div>
    </div>
  );

  const getStatusBadgeColor = (status: string = 'active') => {
    return STATUS_COLORS[status] || STATUS_COLORS.active;
  };

  return (
    <div className="bg-aurora-bg">
      {/* ── Search & Filter Bar ── */}
      <div className="relative bg-gradient-to-br from-aurora-indigo/8 via-aurora-surface to-orange-500/8 border-b border-aurora-border">
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-3">
          {/* Search + Ethnicity Filter on same row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-muted" />
              <input
                type="text"
                placeholder="Search events by name, type, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className={`w-full pl-10 pr-10 py-2.5 bg-aurora-surface border rounded-full
                           text-sm text-aurora-text placeholder:text-aurora-text-muted
                           focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all
                           ${searchFocused ? 'border-aurora-indigo shadow-md' : 'border-aurora-border'}`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Ethnicity Filter Dropdown */}
            <div className="relative shrink-0" ref={heritageRef}>
              <button
                onClick={() => setHeritageDropdownOpen(!heritageDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full text-sm font-medium transition-all border ${
                  selectedHeritage.length > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-aurora-surface border-aurora-border text-aurora-text-secondary hover:border-aurora-text-muted/50'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{selectedHeritage.length > 0 ? `ethniCity (${selectedHeritage.length})` : 'ethniCity'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${heritageDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {heritageDropdownOpen && (
  <div className="absolute top-full right-0 mt-1.5 w-72 bg-aurora-surface border border-aurora-border rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
    {(() => {
      const userHeritage = Array.isArray(userProfile?.heritage)
        ? userProfile.heritage
        : userProfile?.heritage ? [userProfile.heritage] : [];
      return ETHNICITY_HIERARCHY.map((group) => {
        const isRegionExpanded = expandedRegions.has(group.region);
        const selectedInRegion = group.subregions.reduce((sum, sub) => sum + sub.ethnicities.filter((e) => selectedHeritage.includes(e)).length, 0);
        return (
          <div key={group.region} className="border-b border-aurora-border last:border-b-0">
            <button
              onClick={() => setExpandedRegions((prev) => {
                const next = new Set(prev);
                if (next.has(group.region)) next.delete(group.region);
                else next.add(group.region);
                return next;
              })}
              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-aurora-surface-variant transition-colors"
            >
              <span className="text-xs font-bold text-aurora-text">{group.region}</span>
              <div className="flex items-center gap-1.5">
                {selectedInRegion > 0 && (
                  <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selectedInRegion}</span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-aurora-text-muted transition-transform ${isRegionExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {isRegionExpanded && (
              <div className="bg-aurora-surface-variant/20">
                {group.subregions.map((sub) => {
                  const isSubExpanded = expandedSubregions.has(sub.name);
                  const selectedInSub = sub.ethnicities.filter((e) => selectedHeritage.includes(e)).length;
                  return (
                    <div key={sub.name}>
                      <button
                        onClick={() => setExpandedSubregions((prev) => {
                          const next = new Set(prev);
                          if (next.has(sub.name)) next.delete(sub.name);
                          else next.add(sub.name);
                          return next;
                        })}
                        className="w-full pl-8 pr-4 py-2 flex items-center justify-between hover:bg-aurora-surface-variant transition-colors"
                      >
                        <span className="text-xs font-semibold text-aurora-text-secondary">{sub.name}</span>
                        <div className="flex items-center gap-1.5">
                          {selectedInSub > 0 && (
                            <span className="text-[10px] font-semibold text-aurora-indigo bg-aurora-indigo/10 px-1.5 py-0.5 rounded-full">{selectedInSub}</span>
                          )}
                          <ChevronDown className={`w-3 h-3 text-aurora-text-muted transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isSubExpanded && (
                        <div className="bg-aurora-surface-variant/30">
                          {sub.ethnicities.map((eth) => {
                            const isPreferred = userHeritage.some((h: string) => eth.toLowerCase().includes(h.toLowerCase()));
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
      });
    })()}
    {selectedHeritage.length > 0 && (
      <div className="border-t border-aurora-border px-4 py-2 bg-aurora-surface sticky bottom-0">
        <button
          onClick={() => setSelectedHeritage([])}
          className="text-xs text-aurora-indigo font-medium hover:text-aurora-indigo/80"
        >
          Clear all ({selectedHeritage.length})
        </button>
      </div>
    )}
  </div>
)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Bar — Time dropdown | Type pills ── */}
      <div className="sticky top-0 z-20 bg-aurora-surface/95 backdrop-blur-md border-b border-aurora-border">
        <div className="max-w-6xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-1.5">

            {/* Time dropdown */}
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className={`px-3 py-1.5 border rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40 shrink-0 appearance-none cursor-pointer ${
                selectedDateFilter !== 'All'
                  ? 'bg-aurora-indigo text-white border-aurora-indigo'
                  : 'bg-aurora-surface border-aurora-border text-aurora-text'
              }`}
            >
              <option value="All">All Dates</option>
              <option value="Today">Today</option>
              <option value="Tomorrow">Tomorrow</option>
              <option value="This Weekend">This Weekend</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
            </select>

            {/* Show past toggle */}
            <button
              onClick={() => setShowPast(!showPast)}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold transition-all shrink-0 border ${
                showPast
                  ? 'bg-aurora-indigo text-white border-aurora-indigo'
                  : 'bg-aurora-surface border-aurora-border text-aurora-text hover:border-aurora-text-muted'
              }`}
            >
              {showPast ? 'Past shown' : 'Show past'}
            </button>

            {/* Separator */}
            <div className="w-px h-5 bg-aurora-border shrink-0 mx-0.5" />

            {/* Event Type pills — scrollable */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {['All', ...Object.keys(EVENT_TYPES)].map((type) => {
                const TypeIcon = EVENT_TYPE_ICONS[type];
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedFilter(type)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold shrink-0 transition-all ${
                      selectedFilter === type
                        ? 'bg-aurora-indigo text-white'
                        : 'bg-aurora-surface border border-aurora-border text-aurora-text-muted hover:text-aurora-text-secondary hover:border-aurora-text-muted/30'
                    }`}
                  >
                    {type !== 'All' && TypeIcon && <TypeIcon className="w-3 h-3" />}
                    {type !== 'All' ? type : 'All Types'}
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-4 py-5 pb-24">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-aurora-text-secondary">
            {loading ? 'Loading...' : (
              <>
                <span className="font-semibold text-aurora-text">{filteredEvents.length}</span>
                {' '}event{filteredEvents.length !== 1 ? 's' : ''}
                {selectedFilter !== 'All' && <> in <span className="font-medium">{selectedFilter}</span></>}
                {selectedDateFilter !== 'All' && <> · {selectedDateFilter}</>}
              </>
            )}
          </p>
          {(selectedFilter !== 'All' || selectedDateFilter !== 'All' || searchQuery || selectedHeritage.length > 0) && (
            <button
              onClick={() => { setSelectedFilter('All'); setSelectedDateFilter('All'); setSearchQuery(''); setSelectedHeritage([]); }}
              className="text-xs text-aurora-indigo font-medium flex items-center gap-1 hover:text-aurora-indigo/80"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>

        {/* Featured Events Carousel */}
        {featuredEvents.length > 0 && selectedFilter === 'All' && selectedDateFilter === 'All' && !searchQuery && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-aurora-text flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Featured Events
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
              {featuredEvents.map((event) => {
                const dateParts = getDateParts(event.fullDate);
                const typeColor = EVENT_TYPE_COLORS[event.type] || '#6B7280';
                return (
                  <div
                    key={event.id}
                    className="flex-shrink-0 w-72 sm:w-80 rounded-2xl overflow-hidden cursor-pointer group
                               shadow-sm hover:shadow-lg transition-all duration-200 border border-aurora-border"
                    onClick={() => { setSelectedEvent(event); setDetailPhotoIdx(event.coverPhotoIndex || 0); }}
                  >
                    <div
                      className="relative h-32 flex items-end p-4"
                      style={event.photos && event.photos.length > 0
                        ? undefined
                        : { background: `linear-gradient(135deg, ${typeColor}, ${typeColor}dd)` }}
                    >
                      {event.photos && event.photos.length > 0 && (
                        <img
                          src={event.photos[event.coverPhotoIndex || 0] || event.photos[0]}
                          alt={event.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10" />
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 bg-amber-400 text-amber-900 text-[11px] font-bold rounded-lg flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> FEATURED
                        </span>
                      </div>
                      <button onClick={(e) => toggleSaved(event.id, e)} className="absolute top-3 right-3 w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm">
                        <Heart className={`w-4 h-4 ${savedEvents.has(event.id) ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                      </button>
                      {event.photos && event.photos.length > 1 && (
                        <span className="absolute top-3 left-[120px] px-1.5 py-0.5 bg-black/50 backdrop-blur text-white text-[10px] font-medium rounded-md flex items-center gap-0.5">
                          <Camera className="w-2.5 h-2.5" /> {event.photos.length}
                        </span>
                      )}
                      <div className="relative flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">
                          {event.emoji}
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-base leading-tight line-clamp-1">{event.title}</h3>
                          <p className="text-white/80 text-xs">{dateParts.full}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-aurora-surface p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-aurora-text-muted" />
                        <span className="text-xs text-aurora-text-secondary truncate max-w-[140px]">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-aurora-text-muted flex items-center gap-1">
                          <Users className="w-3 h-3" /> {event.count}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          event.ticket === 'free' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-aurora-indigo/10 text-aurora-indigo'
                        }`}>
                          {event.ticket === 'free' ? 'Free' : `$${event.price}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-aurora-surface-variant flex items-center justify-center mb-4">
              <CalendarDays className="w-7 h-7 text-aurora-text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-aurora-text mb-1">No events found</h3>
            <p className="text-sm text-aurora-text-secondary max-w-xs">
              {searchQuery ? `No results for "${searchQuery}".` : 'No upcoming events match your filters.'}
            </p>
            <button
              onClick={() => { setCreateStep(1); setShowCreateModal(true); }}
              className="mt-4 px-5 py-2 bg-aurora-indigo text-white rounded-xl font-medium text-sm hover:bg-aurora-indigo/90 shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Event
            </button>
          </div>
        ) : (
          <>
            {/* ── Event Cards Grid — Eventbrite-style ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => {
              const past = isEventPast(event.fullDate);
              const dateParts = getDateParts(event.fullDate);
              const typeColor = EVENT_TYPE_COLORS[event.type] || '#6B7280';
              const TypeIcon = EVENT_TYPE_ICONS[event.type] || Tag;
              const isGoing = userRSVPs.has(event.id);
              const isWaitlisted = userWaitlists.has(event.id);
              const isSoldOutStatus = isSoldOut(event);
              const statusColors = getStatusBadgeColor(event.status);

              return (
                <div
                  key={event.id}
                  className={`group bg-aurora-surface rounded-2xl border border-aurora-border overflow-hidden
                             cursor-pointer hover:shadow-lg hover:border-aurora-border/80 transition-all duration-200
                             ${past ? 'opacity-60' : ''}`}
                  onClick={() => {
                    setSelectedEvent(event);
                    setDetailPhotoIdx(event.coverPhotoIndex || 0);
                    loadComments(event.id);
                    loadAttendees(event.id, event.rsvpUsers);
                  }}
                >
                  {/* Photo Hero or Top accent line */}
                  {event.photos && event.photos.length > 0 ? (
                    <div className="relative h-36 overflow-hidden">
                      <img
                        src={event.photos[event.coverPhotoIndex || 0] || event.photos[0]}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      {event.photos.length > 1 && (
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 backdrop-blur text-white text-[10px] font-medium rounded-md flex items-center gap-0.5">
                          <Camera className="w-2.5 h-2.5" /> {event.photos.length}
                        </span>
                      )}
                      <div className="absolute top-2 left-2">
                        <span
                          className="text-[10px] font-bold text-white px-2 py-0.5 rounded-md flex items-center gap-0.5"
                          style={{ backgroundColor: typeColor }}
                        >
                          {event.emoji} {event.type}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-1" style={{ backgroundColor: typeColor }} />
                  )}

                  {/* Status Banner */}
                  {event.status && event.status !== 'active' && (
                    <div className={`px-3 py-1.5 ${statusColors.bg} border-b ${statusColors.text} text-[11px] font-bold`}>
                      {event.status === 'coming_soon' && '📅 Coming Soon'}
                      {event.status === 'sold_out' && '🔒 Sold Out'}
                      {event.status === 'canceled' && '❌ Canceled'}
                      {event.status === 'postponed' && '⏸️ Postponed'}
                    </div>
                  )}

                  <div className="p-3">
                    <div className="flex gap-3">
                      {/* Date Badge */}
                      <DateBadge fullDate={event.fullDate} />

                      {/* Event Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-aurora-text text-sm leading-tight line-clamp-2 mb-1 group-hover:text-aurora-indigo transition-colors">
                          {event.title}
                        </h3>
                        <p className="text-xs text-aurora-text-secondary mb-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          {dateParts.weekday}, {event.fullDate} · {event.time}
                        </p>
                        <p className="text-xs text-aurora-text-muted truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          {event.location}
                        </p>
                      </div>

                      {/* Save/Bookmark */}
                      <button
                        onClick={(e) => toggleSaved(event.id, e)}
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                                   hover:bg-aurora-surface-variant transition-colors self-start"
                      >
                        <Heart className={`w-4 h-4 transition-colors ${
                          savedEvents.has(event.id) ? 'fill-red-500 text-red-500' : 'text-aurora-text-muted'
                        }`} />
                      </button>
                    </div>

                    {/* Footer: type badge, attendance, price, RSVP status */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-aurora-border/50">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold text-white px-2 py-0.5 rounded-md flex items-center gap-0.5"
                          style={{ backgroundColor: typeColor }}
                        >
                          <TypeIcon className="w-2.5 h-2.5" /> {event.type}
                        </span>
                        {event.promoted && (
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> Featured
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs text-aurora-text-muted flex items-center gap-0.5">
                          <Users className="w-3 h-3" /> {event.count}
                        </span>
                        {isWaitlisted && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> Waitlist
                          </span>
                        )}
                        {isGoing && !isWaitlisted && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <UserCheck className="w-2.5 h-2.5" /> Going
                          </span>
                        )}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          event.ticket === 'free'
                            ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-aurora-indigo/10 text-aurora-indigo'
                        }`}>
                          {event.ticketTiers && event.ticketTiers.length > 0 ? `From $${Math.min(...event.ticketTiers.map(t => t.price))}` : (event.ticket === 'free' ? 'Free' : `$${event.price}`)}
                        </span>
                      </div>
                    </div>

                    {past && (
                      <div className="mt-2 text-[10px] font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> Past event
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>

      {/* ===== Event Detail Modal — Enhanced with new features ===== */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedEvent(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSelectedEvent(null);
          }}
          tabIndex={-1}
        >
          <div
            className="bg-aurora-surface w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl
                       max-h-[92vh] flex flex-col border border-aurora-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero Banner */}
            <div
              className="relative h-40 sm:rounded-t-2xl flex items-end p-5"
              style={selectedEvent.photos && selectedEvent.photos.length > 0
                ? undefined
                : { background: `linear-gradient(135deg, ${EVENT_TYPE_COLORS[selectedEvent.type] || '#6B7280'}, ${EVENT_TYPE_COLORS[selectedEvent.type] || '#6B7280'}cc)` }}
            >
              {selectedEvent.photos && selectedEvent.photos.length > 0 ? (
                <>
                  <img
                    src={selectedEvent.photos[detailPhotoIdx] || selectedEvent.photos[0]}
                    alt={selectedEvent.title}
                    className="absolute inset-0 w-full h-full object-cover sm:rounded-t-2xl"
                  />
                  {selectedEvent.photos.length > 1 && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailPhotoIdx((detailPhotoIdx - 1 + selectedEvent.photos!.length) % selectedEvent.photos!.length); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur hover:bg-black/60 flex items-center justify-center text-white z-10"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailPhotoIdx((detailPhotoIdx + 1) % selectedEvent.photos!.length); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur hover:bg-black/60 flex items-center justify-center text-white z-10"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <span className="absolute top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/50 backdrop-blur text-white text-[10px] font-medium rounded-full z-10">
                        {detailPhotoIdx + 1} / {selectedEvent.photos.length}
                      </span>
                    </>
                  )}
                </>
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/10 sm:rounded-t-2xl" />
              <button onClick={() => setSelectedEvent(null)} className="absolute top-3 right-3 w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
              <div className="absolute top-3 right-14 flex gap-2 z-10">
                <button onClick={(e) => { e.stopPropagation(); handleShare(selectedEvent); }} className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center text-white transition-colors" aria-label="Share">
                  <Share2 className="w-4 h-4" />
                </button>
                <button onClick={(e) => toggleSaved(selectedEvent.id, e)} className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 flex items-center justify-center transition-colors" aria-label="Save event">
                  <Heart className={`w-4 h-4 ${savedEvents.has(selectedEvent.id) ? 'fill-red-400 text-red-400' : 'text-white'}`} />
                </button>
              </div>
              {selectedEvent.promoted && (
                <div className="absolute top-3 left-3 z-10">
                  <span className="px-2.5 py-1 bg-amber-400 text-amber-900 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> FEATURED
                  </span>
                </div>
              )}
              <div className="relative flex items-center gap-4 w-full">
                <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl">
                  {selectedEvent.emoji}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white leading-tight">{selectedEvent.title}</h2>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="inline-block text-xs bg-white/20 backdrop-blur px-2 py-0.5 rounded-md text-white/90">
                      {selectedEvent.type}
                    </span>
                    {selectedEvent.status && selectedEvent.status !== 'active' && (
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-md font-bold ${getStatusBadgeColor(selectedEvent.status).badge}`}>
                        {selectedEvent.status === 'coming_soon' && '📅 Coming Soon'}
                        {selectedEvent.status === 'sold_out' && '🔒 Sold Out'}
                        {selectedEvent.status === 'canceled' && '❌ Canceled'}
                        {selectedEvent.status === 'postponed' && '⏸️ Postponed'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Canceled Banner */}
              {selectedEvent.status === 'canceled' && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400">Event Canceled</p>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">This event has been canceled. RSVP is disabled.</p>
                  </div>
                </div>
              )}

              {/* Date & Time Card */}
              <div className="flex items-center gap-4 bg-aurora-indigo/5 rounded-xl p-4 border border-aurora-indigo/10">
                <DateBadge fullDate={selectedEvent.fullDate} size="lg" />
                <div>
                  <p className="font-semibold text-aurora-text">{getDateParts(selectedEvent.fullDate).full}</p>
                  <p className="text-sm text-aurora-text-secondary flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5" /> {selectedEvent.time}
                    {selectedEvent.endTime && ` - ${selectedEvent.endTime}`}
                  </p>
                </div>
                {isEventPast(selectedEvent.fullDate) && (
                  <span className="ml-auto text-xs bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full font-medium">
                    Past
                  </span>
                )}
              </div>

              {/* Location Card */}
              <a
                href={getGoogleMapsUrl(
                  `${selectedEvent.location}${selectedEvent.locCity ? ', ' + selectedEvent.locCity : ''}${selectedEvent.locState ? ', ' + selectedEvent.locState : ''} ${selectedEvent.locZip || ''}`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3 hover:bg-aurora-border/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-aurora-indigo/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-aurora-indigo" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-aurora-text truncate">{selectedEvent.location}</p>
                  {(selectedEvent.locCity || selectedEvent.locState || selectedEvent.locZip) && (
                    <p className="text-xs text-aurora-text-secondary">{[selectedEvent.locCity, selectedEvent.locState, selectedEvent.locZip].filter(Boolean).join(', ')}</p>
                  )}
                  <p className="text-xs text-aurora-indigo mt-0.5">Open in Google Maps</p>
                </div>
                <ExternalLink className="w-4 h-4 text-aurora-text-muted flex-shrink-0" />
              </a>

              {/* Organizer & Attendance Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-aurora-surface-variant rounded-xl px-4 py-3">
                  <p className="text-[10px] text-aurora-text-muted uppercase tracking-wider mb-1">Organizer</p>
                  <p className="text-sm font-medium text-aurora-text">{selectedEvent.organizer}</p>
                  {selectedEvent.contactEmail && (
                    <p className="text-xs text-aurora-text-secondary mt-1">{selectedEvent.contactEmail}</p>
                  )}
                </div>
                <div className="bg-aurora-surface-variant rounded-xl px-4 py-3">
                  <p className="text-[10px] text-aurora-text-muted uppercase tracking-wider mb-1">Attending</p>
                  <p className="text-sm font-medium text-aurora-text flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-aurora-indigo" /> {selectedEvent.count} people
                  </p>
                  {selectedEvent.waitlistUsers && selectedEvent.waitlistUsers.length > 0 && (
                    <p className="text-xs text-aurora-text-secondary mt-1">{selectedEvent.waitlistUsers.length} waitlisted</p>
                  )}
                </div>
              </div>

              {/* Attendees Avatars */}
              {attendees.length > 0 && (
                <div>
                  <p className="text-[10px] text-aurora-text-muted uppercase tracking-wider mb-2">Who's Going</p>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {attendees.map((attendee) => (
                        <div
                          key={attendee.uid}
                          className="w-8 h-8 rounded-full border-2 border-aurora-surface bg-aurora-indigo/20 flex items-center justify-center text-xs font-semibold text-aurora-text"
                          title={attendee.name}
                        >
                          {attendee.avatar ? (
                            <img src={attendee.avatar} alt={attendee.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            attendee.name[0]
                          )}
                        </div>
                      ))}
                    </div>
                    {selectedEvent.rsvpUsers && selectedEvent.rsvpUsers.length > 6 && (
                      <span className="text-xs text-aurora-text-secondary ml-2">
                        +{selectedEvent.rsvpUsers.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Ticket Tiers */}
              {selectedEvent.ticketTiers && selectedEvent.ticketTiers.length > 0 && (
                <div>
                  <p className="text-[10px] text-aurora-text-muted uppercase tracking-wider mb-2">Ticket Options</p>
                  <div className="space-y-2">
                    {selectedEvent.ticketTiers.map((tier) => {
                      const available = tier.quantity - tier.sold;
                      const progress = (tier.sold / tier.quantity) * 100;
                      return (
                        <div key={tier.id} className="bg-aurora-surface-variant rounded-xl p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-aurora-text">{tier.name}</p>
                              {tier.description && <p className="text-xs text-aurora-text-secondary">{tier.description}</p>}
                            </div>
                            <span className="text-sm font-bold text-aurora-indigo">${tier.price}</span>
                          </div>
                          <div className="w-full h-1.5 bg-aurora-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-aurora-indigo to-aurora-indigo/70 transition-all"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-aurora-text-muted mt-1">{available} of {tier.quantity} available</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ticket Info */}
              <div className="flex items-center gap-3 bg-aurora-surface-variant rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Ticket className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-aurora-text-muted uppercase tracking-wider">Admission</p>
                  <p className="text-sm font-semibold text-aurora-text">
                    {selectedEvent.ticket === 'free' ? 'Free Event' : selectedEvent.ticketTiers && selectedEvent.ticketTiers.length > 0 ? `From $${Math.min(...selectedEvent.ticketTiers.map(t => t.price))}` : `$${selectedEvent.price}`}
                  </p>
                </div>
                <span className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full ${
                  selectedEvent.ticket === 'free'
                    ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-aurora-indigo/10 text-aurora-indigo'
                }`}>
                  {selectedEvent.ticket === 'free' ? 'FREE' : 'PAID'}
                </span>
              </div>

              {/* Description */}
              {selectedEvent.desc && (
                <div>
                  <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2">About this event</h4>
                  <p className="text-sm text-aurora-text-secondary leading-relaxed whitespace-pre-line">{selectedEvent.desc}</p>
                </div>
              )}

              {/* Discussion Section */}
              <div>
                <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" /> Discussion ({comments.length})
                </h4>
                <div className="bg-aurora-surface-variant rounded-xl overflow-hidden">
                  <div className="max-h-64 overflow-y-auto space-y-2 p-3">
                    {comments.length === 0 ? (
                      <p className="text-xs text-aurora-text-muted text-center py-4">No comments yet. Be the first!</p>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="flex gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-aurora-indigo/10 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {comment.userAvatar ? (
                              <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              comment.userName[0]
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-aurora-text">{comment.userName}</p>
                            <p className="text-xs text-aurora-text-secondary mt-0.5">{comment.text}</p>
                            <p className="text-[10px] text-aurora-text-muted mt-1">
                              {comment.createdAt?.toDate?.() ? new Date(comment.createdAt.toDate()).toLocaleDateString() : 'just now'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-aurora-border p-3 flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddComment(selectedEvent.id);
                      }}
                      placeholder="Add comment..."
                      className="flex-1 px-3 py-1.5 bg-aurora-surface border border-aurora-border rounded-lg text-xs text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                    />
                    <button
                      onClick={() => handleAddComment(selectedEvent.id)}
                      disabled={commentLoading || !newComment.trim()}
                      className="flex items-center justify-center w-10 h-10 sm:w-7 sm:h-7 rounded-lg bg-aurora-indigo text-white hover:bg-aurora-indigo/90 disabled:opacity-50 transition-colors"
                      aria-label="Send comment"
                    >
                      {commentLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-aurora-border p-4 space-y-2 bg-aurora-surface sm:rounded-b-2xl">
              {/* Add to Calendar */}
              {!isEventPast(selectedEvent.fullDate) && (
                <div className="relative group">
                  <button
                    onClick={() => setStatusDropdown(statusDropdown === 'calendar' ? null : 'calendar')}
                    className="w-full py-2 rounded-lg font-medium text-sm border border-aurora-border text-aurora-text hover:bg-aurora-surface-variant transition-colors flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" /> Add to Calendar <ChevronDown className="w-3 h-3" />
                  </button>
                  {statusDropdown === 'calendar' && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-aurora-surface border border-aurora-border rounded-lg shadow-lg overflow-hidden z-10">
                      <button
                        onClick={() => window.open(getGoogleCalendarUrl(selectedEvent), '_blank')}
                        className="w-full px-4 py-2 text-sm text-aurora-text hover:bg-aurora-surface-variant flex items-center gap-2"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Google Calendar
                      </button>
                      <button
                        onClick={() => downloadICS(selectedEvent)}
                        className="w-full px-4 py-2 text-sm text-aurora-text hover:bg-aurora-surface-variant border-t border-aurora-border flex items-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" /> Download .ics
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* RSVP / Waitlist Button */}
              {!isEventPast(selectedEvent.fullDate) && selectedEvent.status !== 'canceled' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRSVP(selectedEvent.id); }}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2
                    ${rsvpAnimating === selectedEvent.id ? 'scale-95' : ''}
                    ${userRSVPs.has(selectedEvent.id)
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : userWaitlists.has(selectedEvent.id)
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-aurora-indigo text-white hover:bg-aurora-indigo/90 shadow-sm'
                    }`}
                >
                  {rsvpAnimating === selectedEvent.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : userRSVPs.has(selectedEvent.id) ? (
                    <><UserCheck className="w-4 h-4" /> Going — Tap to Cancel</>
                  ) : userWaitlists.has(selectedEvent.id) ? (
                    <><Clock className="w-4 h-4" /> On Waitlist — Tap to Cancel</>
                  ) : isSoldOut(selectedEvent) || (selectedEvent.capacity && (selectedEvent.rsvpUsers?.length || 0) >= selectedEvent.capacity) ? (
                    selectedEvent.waitlistEnabled ? (
                      <><Clock className="w-4 h-4" /> Join Waitlist</>
                    ) : (
                      <><AlertCircle className="w-4 h-4" /> Event Full</>
                    )
                  ) : (
                    <><Ticket className="w-4 h-4" /> {selectedEvent.ticket === 'free' ? 'Register — Free' : `Get Tickets — $${selectedEvent.price}`}</>
                  )}
                </button>
              )}

              {/* Status Dropdown (for organizer or admin) */}
              {isOwnerOrAdmin(selectedEvent) && !isEventPast(selectedEvent.fullDate) && (
                <div className="relative">
                  <button
                    onClick={() => setStatusDropdown(statusDropdown === 'status' ? null : 'status')}
                    className="w-full py-2 rounded-lg font-medium text-sm border border-aurora-border text-aurora-text hover:bg-aurora-surface-variant transition-colors flex items-center justify-center gap-2"
                  >
                    <MoreVertical className="w-4 h-4" /> Event Status <ChevronDown className="w-3 h-3" />
                  </button>
                  {statusDropdown === 'status' && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-aurora-surface border border-aurora-border rounded-lg shadow-lg overflow-hidden z-10">
                      {['active', 'coming_soon', 'sold_out', 'postponed', 'canceled'].map((status) => (
                        <button
                          key={status}
                          onClick={() => handleChangeStatus(selectedEvent.id, status)}
                          className={`w-full px-4 py-2 text-sm text-left hover:bg-aurora-surface-variant border-b border-aurora-border last:border-b-0 flex items-center gap-2 ${
                            selectedEvent.status === status ? 'bg-aurora-indigo/10 text-aurora-indigo font-semibold' : 'text-aurora-text'
                          }`}
                        >
                          {status === 'active' && '✓ Active'}
                          {status === 'coming_soon' && '📅 Coming Soon'}
                          {status === 'sold_out' && '🔒 Sold Out'}
                          {status === 'postponed' && '⏸️ Postponed'}
                          {status === 'canceled' && '❌ Canceled'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Edit & Delete — only poster or admin */}
              {isOwnerOrAdmin(selectedEvent) && (
                <>
                  <button
                    onClick={handleStartEdit}
                    className="w-full py-2.5 rounded-xl font-medium text-sm border border-aurora-border
                               text-aurora-text hover:bg-aurora-surface-variant transition-colors
                               flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" /> Edit Event
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                    className="w-full py-2.5 rounded-xl font-medium text-sm border border-red-200 dark:border-red-500/20
                               text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors
                               flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Event
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Floating Action Button ─── */}
      <button
        onClick={() => { setCreateStep(1); setShowCreateModal(true); }}
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 aurora-gradient text-white rounded-full shadow-aurora-glow-lg flex items-center justify-center hover:shadow-aurora-4 transition-all z-10 btn-press"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* ===== Create Event Modal — 3-Step Wizard ===== */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-aurora-bg z-50 flex flex-col"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setShowCreateModal(false); setDateError(''); setCreateStep(1); }
          }}
          tabIndex={-1}
        >
          <div className="flex-shrink-0 bg-aurora-surface border-b border-aurora-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowCreateModal(false); setDateError(''); setCreateStep(1); }} className="p-2 sm:p-1 hover:bg-aurora-surface-variant rounded-lg transition-colors" aria-label="Go back">
                <ArrowLeft className="w-5 h-5 text-aurora-text-secondary" />
              </button>
              <h2 className="text-lg font-bold text-aurora-text">Create Event</h2>
            </div>
            <button onClick={() => { setShowCreateModal(false); setDateError(''); setCreateStep(1); }} className="p-2 sm:p-1 text-aurora-text-muted hover:text-aurora-text-secondary" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="bg-aurora-surface border-b border-aurora-border px-4 py-4">
            <div className="max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-2">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        step <= createStep
                          ? 'bg-aurora-indigo text-white'
                          : 'bg-aurora-surface-variant text-aurora-text-muted'
                      }`}
                    >
                      {step < createStep ? <Check className="w-4 h-4" /> : step}
                    </div>
                    {step < 3 && (
                      <div
                        className={`flex-1 h-1 mx-2 ${
                          step < createStep
                            ? 'bg-aurora-indigo'
                            : 'bg-aurora-surface-variant'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-aurora-text-muted">
                <span>Basics</span>
                <span>When & Where</span>
                <span>Tickets & Details</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-24 max-w-lg mx-auto w-full">
            {/* Step 1: Basics */}
            {createStep === 1 && (
              <div className="space-y-4">
                <FormInput label="Event Title" required type="text" value={formData.title} onChange={(e: any) => setFormData({ ...formData, title: e.target.value })} placeholder="What's happening?" />

                <div>
                  <label className="block text-sm font-medium text-aurora-text mb-1.5">Event Type <span className="text-red-500">*</span></label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
                  >
                    {Object.entries(EVENT_TYPES).map(([type, emoji]) => (
                      <option key={type} value={type}>{emoji} {type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-aurora-text mb-1.5">Description <span className="text-red-500">*</span></label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text placeholder:text-aurora-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
                    rows={4}
                    placeholder="Tell people about the event..."
                  />
                </div>

                {/* Photo Uploader */}
                {photosEnabled && (
                  <EventPhotoUploader
                    photos={formData.photos}
                    onPhotosChange={(photos) => setFormData({ ...formData, photos })}
                    onCoverChange={(coverPhotoIndex) => setFormData({ ...formData, coverPhotoIndex })}
                    coverIndex={formData.coverPhotoIndex}
                  />
                )}
              </div>
            )}

            {/* Step 2: When & Where */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-aurora-text mb-1.5">Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={formData.date}
                    min={getTodayISO()}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={`w-full px-4 py-2.5 bg-aurora-surface border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all ${
                      dateError ? 'border-red-400 bg-red-50 dark:bg-red-500/5' : 'border-aurora-border'
                    }`}
                  />
                  {dateError && <p className="text-red-500 text-xs mt-1">{dateError}</p>}
                  {formData.date && !dateError && <p className="text-aurora-text-muted text-xs mt-1">{isoToReadable(formData.date)}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-aurora-text mb-1.5">Start Time <span className="text-red-500">*</span></label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                    />
                    {formData.time && <p className="text-aurora-text-muted text-xs mt-1">{time24to12(formData.time)}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-aurora-text mb-1.5">End Time</label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                    />
                    {formData.endTime && <p className="text-aurora-text-muted text-xs mt-1">{time24to12(formData.endTime)}</p>}
                  </div>
                </div>

                <FormInput label="Venue / Address" required type="text" value={formData.location} onChange={(e: any) => setFormData({ ...formData, location: e.target.value })} placeholder="Event venue or address" />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-aurora-text-muted mb-1">City</label>
                    <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-aurora-text-muted mb-1">State</label>
                    <input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })} maxLength={2}
                      className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 uppercase" />
                  </div>
                  <div>
                    <label className="block text-xs text-aurora-text-muted mb-1">ZIP</label>
                    <input type="text" value={formData.zip} onChange={(e) => setFormData({ ...formData, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })} maxLength={5}
                      className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Tickets & Details */}
            {createStep === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-aurora-text mb-1.5">Ticket Type <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ticketType: 'simple' })}
                      className={`px-3 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                        formData.ticketType === 'simple'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'bg-aurora-surface-variant text-aurora-text-secondary hover:bg-aurora-border/30'
                      }`}
                    >
                      <Ticket className="w-4 h-4" /> Simple
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ticketType: 'tiered' })}
                      className={`px-3 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                        formData.ticketType === 'tiered'
                          ? 'bg-aurora-indigo text-white shadow-sm'
                          : 'bg-aurora-surface-variant text-aurora-text-secondary hover:bg-aurora-border/30'
                      }`}
                    >
                      <Tag className="w-4 h-4" /> Tiered
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ticketType: 'simple' })}
                      className={`px-3 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                        formData.ticketType === 'simple'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'bg-aurora-surface-variant text-aurora-text-secondary hover:bg-aurora-border/30'
                      }`}
                    >
                      <Heart className="w-4 h-4" /> Free
                    </button>
                  </div>
                </div>

                {formData.ticketType === 'simple' && (
                  <FormInput label="Price ($)" type="number" min="0" step="0.01" value={formData.price} onChange={(e: any) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" />
                )}

                {formData.ticketType === 'tiered' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-aurora-text">Ticket Tiers</label>
                      <button
                        type="button"
                        onClick={addTicketTier}
                        className="text-xs text-aurora-indigo hover:text-aurora-indigo/80 font-medium flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Tier
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.ticketTiers.map((tier) => (
                        <div key={tier.id} className="bg-aurora-surface-variant rounded-xl p-3 space-y-2">
                          <input
                            type="text"
                            value={tier.name}
                            onChange={(e) => updateTicketTier(tier.id, { name: e.target.value })}
                            placeholder="Tier name (e.g., Early Bird)"
                            className="w-full px-3 py-1.5 bg-aurora-surface border border-aurora-border rounded-lg text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="number"
                              value={tier.price}
                              onChange={(e) => updateTicketTier(tier.id, { price: parseFloat(e.target.value) || 0 })}
                              placeholder="Price"
                              min="0"
                              step="0.01"
                              className="px-2 py-1.5 bg-aurora-surface border border-aurora-border rounded-lg text-sm text-aurora-text focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40"
                            />
                            <input
                              type="number"
                              value={tier.quantity}
                              onChange={(e) => updateTicketTier(tier.id, { quantity: parseInt(e.target.value) || 0 })}
                              placeholder="Quantity"
                              min="0"
                              className="px-2 py-1.5 bg-aurora-surface border border-aurora-border rounded-lg text-sm text-aurora-text focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40"
                            />
                            <button
                              type="button"
                              onClick={() => removeTicketTier(tier.id)}
                              className="px-2 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg font-medium text-xs hover:bg-red-100 dark:hover:bg-red-500/20"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <FormInput label="Capacity (Optional)" type="number" min="0" value={formData.capacity} onChange={(e: any) => setFormData({ ...formData, capacity: e.target.value })} placeholder="Max attendees" />

                <FormInput label="Contact Email" type="email" value={formData.contactEmail} onChange={(e: any) => setFormData({ ...formData, contactEmail: e.target.value })} placeholder="organizer@example.com" />

                <FormInput label="Contact Phone" type="tel" value={formData.contactPhone} onChange={(e: any) => setFormData({ ...formData, contactPhone: e.target.value })} placeholder="+1 (555) 000-0000" />

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.waitlistEnabled}
                      onChange={(e) => setFormData({ ...formData, waitlistEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-aurora-border bg-aurora-surface checked:bg-aurora-indigo"
                    />
                    <span className="text-sm text-aurora-text">Enable waitlist when event is full</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-aurora-surface border-t border-aurora-border p-4">
            <div className="max-w-lg mx-auto flex gap-2">
              <button
                onClick={() => createStep > 1 && setCreateStep(createStep - 1)}
                disabled={createStep === 1}
                className="flex-1 px-4 py-3 rounded-xl font-semibold text-sm border border-aurora-border text-aurora-text hover:bg-aurora-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              {createStep < 3 ? (
                <button
                  onClick={() => setCreateStep(createStep + 1)}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-sm bg-aurora-indigo text-white hover:bg-aurora-indigo/90 shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleCreateEvent}
                  disabled={creating || !!dateError}
                  className="flex-1 bg-aurora-indigo text-white py-3 rounded-xl font-semibold text-sm hover:bg-aurora-indigo/90 disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4" /> Create Event</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete Event Confirmation Modal ===== */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => { setShowDeleteConfirm(false); setDeleteEventId(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Event</h3>
            </div>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this event? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteEventId(null); }} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={confirmDeleteEvent} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Edit Event Modal ===== */}
      {isEditing && selectedEvent && (
        <div
          className="fixed inset-0 bg-aurora-bg z-[60] flex flex-col"
          onKeyDown={(e) => { if (e.key === 'Escape') setIsEditing(false); }}
          tabIndex={-1}
        >
          <div className="flex-shrink-0 bg-aurora-surface border-b border-aurora-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsEditing(false)} className="p-2 sm:p-1 hover:bg-aurora-surface-variant rounded-lg transition-colors" aria-label="Go back">
                <ArrowLeft className="w-5 h-5 text-aurora-text-secondary" />
              </button>
              <h2 className="text-lg font-bold text-aurora-text">Edit Event</h2>
            </div>
            <button onClick={() => setIsEditing(false)} className="p-2 sm:p-1 text-aurora-text-muted hover:text-aurora-text-secondary" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-24 max-w-lg mx-auto w-full">
            <div className="space-y-4">
              <FormInput label="Event Title" required type="text" value={editData.title} onChange={(e: any) => setEditData({ ...editData, title: e.target.value })} placeholder="What's happening?" />

              <div>
                <label className="block text-sm font-medium text-aurora-text mb-1.5">Event Type <span className="text-red-500">*</span></label>
                <select
                  value={editData.type}
                  onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                  className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
                >
                  {Object.entries(EVENT_TYPES).map(([type, emoji]) => (
                    <option key={type} value={type}>{emoji} {type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-aurora-text mb-1.5">Description <span className="text-red-500">*</span></label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text placeholder:text-aurora-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 focus:border-aurora-indigo"
                  rows={4}
                  placeholder="Tell people about the event..."
                />
              </div>

              {/* Photo Uploader */}
              {photosEnabled && (
                <EventPhotoUploader
                  photos={editData.photos}
                  onPhotosChange={(photos) => setEditData({ ...editData, photos })}
                  onCoverChange={(coverPhotoIndex) => setEditData({ ...editData, coverPhotoIndex })}
                  coverIndex={editData.coverPhotoIndex}
                />
              )}

              <div>
                <label className="block text-sm font-medium text-aurora-text mb-1.5">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={editData.fullDate}
                  onChange={(e) => setEditData({ ...editData, fullDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                />
                {editData.fullDate && <p className="text-aurora-text-muted text-xs mt-1">{isoToReadable(editData.fullDate)}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-aurora-text mb-1.5">Start Time <span className="text-red-500">*</span></label>
                  <input
                    type="time"
                    value={editData.time}
                    onChange={(e) => setEditData({ ...editData, time: e.target.value })}
                    className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                  />
                  {editData.time && <p className="text-aurora-text-muted text-xs mt-1">{time24to12(editData.time)}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-aurora-text mb-1.5">End Time</label>
                  <input
                    type="time"
                    value={editData.endTime}
                    onChange={(e) => setEditData({ ...editData, endTime: e.target.value })}
                    className="w-full px-4 py-2.5 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40"
                  />
                  {editData.endTime && <p className="text-aurora-text-muted text-xs mt-1">{time24to12(editData.endTime)}</p>}
                </div>
              </div>

              <FormInput label="Venue / Address" required type="text" value={editData.location} onChange={(e: any) => setEditData({ ...editData, location: e.target.value })} placeholder="Event venue or address" />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-aurora-text-muted mb-1">City</label>
                  <input type="text" value={editData.city} onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40" />
                </div>
                <div>
                  <label className="block text-xs text-aurora-text-muted mb-1">State</label>
                  <input type="text" value={editData.state} onChange={(e) => setEditData({ ...editData, state: e.target.value.toUpperCase() })} maxLength={2}
                    className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 uppercase" />
                </div>
                <div>
                  <label className="block text-xs text-aurora-text-muted mb-1">ZIP</label>
                  <input type="text" value={editData.zip} onChange={(e) => setEditData({ ...editData, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })} maxLength={5}
                    className="w-full px-3 py-2 bg-aurora-surface border border-aurora-border rounded-xl text-sm text-aurora-text focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-aurora-text mb-1.5">Ticket Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditData({ ...editData, ticketType: 'simple', price: '' })}
                    className={`px-3 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                      editData.ticketType === 'simple'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-aurora-surface-variant text-aurora-text-secondary hover:bg-aurora-border/30'
                    }`}
                  >
                    <Ticket className="w-4 h-4" /> Free / Simple
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditData({ ...editData, ticketType: 'tiered' })}
                    className={`px-3 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                      editData.ticketType === 'tiered'
                        ? 'bg-aurora-indigo text-white shadow-sm'
                        : 'bg-aurora-surface-variant text-aurora-text-secondary hover:bg-aurora-border/30'
                    }`}
                  >
                    <Tag className="w-4 h-4" /> Tiered
                  </button>
                </div>
              </div>

              {editData.ticketType === 'simple' && (
                <FormInput label="Price ($)" type="number" value={editData.price} onChange={(e: any) => setEditData({ ...editData, price: e.target.value })} placeholder="Leave empty for free" />
              )}

              <FormInput label="Capacity (Optional)" type="number" value={editData.capacity} onChange={(e: any) => setEditData({ ...editData, capacity: e.target.value })} placeholder="Max attendees" />

              <FormInput label="Contact Email" type="email" value={editData.contactEmail} onChange={(e: any) => setEditData({ ...editData, contactEmail: e.target.value })} placeholder="organizer@example.com" />

              <FormInput label="Contact Phone" type="tel" value={editData.contactPhone} onChange={(e: any) => setEditData({ ...editData, contactPhone: e.target.value })} placeholder="+1 (555) 000-0000" />
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 bg-aurora-surface border-t border-aurora-border p-4">
            <div className="max-w-lg mx-auto flex gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm border border-aurora-border text-aurora-text hover:bg-aurora-surface-variant transition-colors"
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

      {/* ===== Toast Notification ===== */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg max-w-md text-center text-sm font-medium animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
