import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Globe, ChevronDown, X } from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ETHNICITY_HIERARCHY, HERITAGE_OPTIONS } from '../../constants/config';

interface TravelPost {
  id: string;
  mode: 'assistance' | 'offer';
  from: string;
  to: string;
  travelDate: string;
  timePreference: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Flexible';
  seats?: number;
  budget?: string;
  desc: string;
  genderPref: 'Any' | 'Male' | 'Female' | 'Non-binary';
  purposes: string[];
  heritage?: string | string[];
  posterName: string;
  posterAvatar: string;
  posterId: string;
  createdAt: any;
}

type FilterMode = 'all' | 'assistance' | 'offer';

const getTimeAgo = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function TravelPage() {
  const { user, userProfile } = useAuth();
  const [travelPosts, setTravelPosts] = useState<TravelPost[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedHeritage, setSelectedHeritage] = useState<string[]>([]);
  const [travelSearchQuery, setTravelSearchQuery] = useState('');
  const [heritageDropdownOpen, setHeritageDropdownOpen] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [expandedSubregions, setExpandedSubregions] = useState<Set<string>>(new Set());
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

  const [showCreateModal, setShowCreateModal] = useState(false);


  const [formData, setFormData] = useState({
    mode: 'assistance' as 'assistance' | 'offer',
    from: '',
    to: '',
    travelDate: '',
    timePreference: 'Morning' as 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Flexible',
    seats: '',
    budget: '',
    genderPref: 'Any' as 'Any' | 'Male' | 'Female' | 'Non-binary',
    purposes: [] as string[],
    desc: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'travelPosts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts: TravelPost[] = [];
      snapshot.forEach((docSnapshot) => {
        posts.push({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        } as TravelPost);
      });
      setTravelPosts(posts);
    });

    return unsubscribe;
  }, []);

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

  const filteredPosts = useMemo(() => {
    let filtered = travelPosts;

    // Search filter
    if (travelSearchQuery.trim()) {
      const q = travelSearchQuery.toLowerCase();
      filtered = filtered.filter((p) =>
        p.from?.toLowerCase().includes(q) || p.to?.toLowerCase().includes(q) ||
        p.desc?.toLowerCase().includes(q) || p.posterName?.toLowerCase().includes(q)
      );
    }

    if (filterMode !== 'all') {
      filtered = filtered.filter((post) => post.mode === filterMode);
    }

    if (selectedHeritage.length > 0) {
      filtered = filtered.filter((p: any) => {
        if (Array.isArray(p.heritage)) {
          return p.heritage.some((h: string) => selectedHeritage.includes(h));
        }
        return p.heritage ? selectedHeritage.includes(p.heritage) : false;
      });
    }

    return filtered;
  }, [travelPosts, filterMode, selectedHeritage, travelSearchQuery]);

  const stats = {
    total: travelPosts.length,
    assistance: travelPosts.filter((p) => p.mode === 'assistance').length,
    offering: travelPosts.filter((p) => p.mode === 'offer').length,
  };

  const handleCreatePost = async () => {
    if (
      !formData.from.trim() ||
      !formData.to.trim() ||
      !formData.travelDate.trim() ||
      !formData.desc.trim()
    ) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await addDoc(collection(db, 'travelPosts'), {
        mode: formData.mode,
        from: formData.from,
        to: formData.to,
        travelDate: formData.travelDate,
        timePreference: formData.timePreference,
        seats: formData.seats ? parseInt(formData.seats) : null,
        budget: formData.budget || null,
        desc: formData.desc,
        genderPref: formData.genderPref,
        purposes: formData.purposes,
        heritage: Array.isArray(userProfile?.heritage)
          ? userProfile.heritage
          : userProfile?.heritage
          ? [userProfile.heritage]
          : [],
        posterName: user?.displayName || 'Anonymous',
        posterAvatar: user?.photoURL || '',
        posterId: user?.uid || '',
        createdAt: Timestamp.now(),
      });

      setFormData({
        mode: 'assistance',
        from: '',
        to: '',
        travelDate: '',
        timePreference: 'Morning',
        seats: '',
        budget: '',
        genderPref: 'Any',
        purposes: [],
        desc: '',
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating travel post:', error);
      alert('Failed to create post');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'travelPosts', postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    }
  };

  const togglePurpose = (purpose: string) => {
    setFormData((prev) => ({
      ...prev,
      purposes: prev.purposes.includes(purpose)
        ? prev.purposes.filter((p) => p !== purpose)
        : [...prev.purposes, purpose],
    }));
  };

  return (
    <div className="bg-aurora-bg">
      {/* Stats Tiles — Discover-style */}
      <div className="bg-gradient-to-r from-emerald-600 via-green-500 to-teal-500 text-white py-3">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-lg p-2 sm:p-3 bg-white/20 backdrop-blur text-left">
              <div className="text-xs text-emerald-100">Active Trips</div>
              <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="rounded-lg p-2 sm:p-3 bg-white/20 backdrop-blur text-left">
              <div className="text-xs text-emerald-100">Need Help</div>
              <div className="text-xl sm:text-2xl font-bold">{stats.assistance}</div>
            </div>
            <div className="rounded-lg p-2 sm:p-3 bg-white/20 backdrop-blur text-left">
              <div className="text-xs text-emerald-100">Offering</div>
              <div className="text-xl sm:text-2xl font-bold">{stats.offering}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Ethnicity Header */}
      <div className="relative bg-gradient-to-br from-teal-500/8 via-aurora-surface to-emerald-500/8 border-b border-aurora-border">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-muted" />
              <input
                type="text"
                placeholder="Search trips by route, destination..."
                value={travelSearchQuery}
                onChange={(e) => setTravelSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-aurora-surface border border-aurora-border rounded-full text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 focus:ring-aurora-indigo/40 transition-all"
              />
              {travelSearchQuery && (
                <button onClick={() => setTravelSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-text-muted hover:text-aurora-text">
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
                    : 'bg-aurora-surface border-aurora-border text-aurora-text-secondary hover:border-aurora-text-muted/50'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{selectedHeritage.length > 0 ? `ethniCity (${selectedHeritage.length})` : 'ethniCity'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${heritageDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {heritageDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-72 bg-aurora-surface border border-aurora-border rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
                  {/* Select All / Deselect All */}
                  <div className="sticky top-0 z-10 bg-aurora-surface border-b border-aurora-border px-4 py-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedHeritage.length === HERITAGE_OPTIONS.length}
                        onChange={() => {
                          if (selectedHeritage.length === HERITAGE_OPTIONS.length) {
                            setSelectedHeritage([]);
                          } else {
                            setSelectedHeritage([...HERITAGE_OPTIONS]);
                          }
                        }}
                        className="w-4 h-4 rounded border-aurora-border text-aurora-indigo focus:ring-aurora-indigo/40"
                      />
                      <span className="text-xs font-bold text-aurora-text">
                        {selectedHeritage.length === HERITAGE_OPTIONS.length ? 'Deselect All' : 'Select All'}
                      </span>
                    </label>
                  </div>
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

      {/* Filter Pills — Sticky bar */}
      <div className="sticky top-0 z-20 bg-aurora-surface/95 backdrop-blur-md border-b border-aurora-border">
        <div className="max-w-6xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            {(['all', 'assistance', 'offer'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  filterMode === mode
                    ? 'bg-aurora-indigo text-white'
                    : 'bg-aurora-surface border border-aurora-border text-aurora-text-muted hover:text-aurora-text-secondary hover:border-aurora-text-muted/30'
                }`}
              >
                {mode === 'all'
                  ? 'All'
                  : mode === 'assistance'
                  ? '🙋 Need Assistance'
                  : '🚗 Offering Ride'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">✈️</div>
            <h3 className="text-lg font-semibold text-aurora-text">No travel posts yet</h3>
            <p className="text-aurora-text-secondary mt-2">
              {filterMode === 'all' ? 'Be the first to create a travel post!' : 'No posts match your filter'}
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="bg-aurora-surface rounded-xl shadow-aurora-1 p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span
                    className={`text-xs font-semibold text-white px-2 py-1 rounded inline-block ${
                      post.mode === 'assistance' ? 'bg-aurora-indigo/20' : 'bg-aurora-success/15'
                    }`}
                  >
                    {post.mode === 'assistance' ? '🙋 Need Assistance' : '🚗 Offering Ride'}
                  </span>
                  <span className="text-xs text-aurora-text-secondary ml-2">{formatDate(post.travelDate)}</span>
                </div>
              </div>

              {/* Route */}
              <div className="flex items-center gap-3 mb-4 py-3 px-3 bg-aurora-surface-variant rounded-xl">
                <div className="text-left">
                  <p className="font-semibold text-aurora-text">{post.from}</p>
                </div>
                <span className="text-aurora-text-muted flex-shrink-0">→</span>
                <div className="text-right flex-1">
                  <p className="font-semibold text-aurora-text">{post.to}</p>
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs font-semibold bg-aurora-surface-variant text-aurora-text-secondary px-2 py-1 rounded">
                  🕐 {post.timePreference}
                </span>
                {post.seats && (
                  <span className="text-xs font-semibold bg-aurora-surface-variant text-aurora-text-secondary px-2 py-1 rounded">
                    👥 {post.seats} seats
                  </span>
                )}
                {post.budget && (
                  <span className="text-xs font-semibold bg-aurora-surface-variant text-aurora-text-secondary px-2 py-1 rounded">
                    💰 {post.budget}
                  </span>
                )}
                <span className="text-xs font-semibold bg-aurora-surface-variant text-aurora-text-secondary px-2 py-1 rounded">
                  👤 {post.genderPref}
                </span>
              </div>

              {/* Purposes */}
              {post.purposes && post.purposes.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.purposes.map((purpose) => (
                    <span key={purpose} className="text-xs font-semibold bg-aurora-indigo/20 text-aurora-indigo px-2 py-1 rounded">
                      {purpose}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              <p className="text-aurora-text mb-4 text-sm">{post.desc}</p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-aurora-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
                    {post.posterAvatar ? post.posterAvatar[0] : '👤'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-aurora-text">{post.posterName}</p>
                    <p className="text-xs text-aurora-text-secondary">{getTimeAgo(post.createdAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {post.posterId === user?.uid && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="text-lg hover:opacity-70"
                    >
                      🗑️
                    </button>
                  )}
                  <button className="text-lg hover:opacity-70">💬</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-aurora-indigo text-white rounded-full shadow-aurora-3 flex items-center justify-center text-2xl font-bold hover:bg-blue-800 transition-colors"
      >
        +
      </button>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-aurora-surface w-full rounded-t-lg shadow-aurora-3 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-aurora-surface border-b border-aurora-border p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-aurora-indigo">Create Travel Post</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-2xl text-aurora-text-muted hover:text-aurora-text-secondary"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-aurora-text mb-2">Travel Mode</label>
                <div className="flex gap-2">
                  {(['assistance', 'offer'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFormData({ ...formData, mode })}
                      className={`flex-1 px-3 py-3 rounded-xl font-medium text-sm transition-colors ${
                        formData.mode === mode
                          ? 'bg-aurora-indigo text-white'
                          : 'bg-aurora-surface-variant text-aurora-text-secondary hover:bg-gray-100'
                      }`}
                    >
                      {mode === 'assistance' ? '🙋 Need Assistance' : '🚗 Offering Ride'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-semibold text-aurora-text mb-2">From *</label>
                  <input
                    type="text"
                    value={formData.from}
                    onChange={(e) => setFormData({ ...formData, from: e.target.value })}
                    className="w-full px-3 py-2 border border-aurora-border rounded-xl focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-aurora-text mb-2">To *</label>
                  <input
                    type="text"
                    value={formData.to}
                    onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                    className="w-full px-3 py-2 border border-aurora-border rounded-xl focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-aurora-text mb-2">Travel Date (YYYY-MM-DD) *</label>
                <input
                  type="text"
                  value={formData.travelDate}
                  onChange={(e) => setFormData({ ...formData, travelDate: e.target.value })}
                  className="w-full px-3 py-2 border border-aurora-border rounded-xl focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-aurora-text mb-2">Time Preference</label>
                <select
                  value={formData.timePreference}
                  onChange={(e) => setFormData({ ...formData, timePreference: e.target.value as any })}
                  className="w-full px-3 py-2 border border-aurora-border rounded-xl focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                >
                  {['Morning', 'Afternoon', 'Evening', 'Night', 'Flexible'].map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={formData.seats}
                  onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                  placeholder="Seats (optional)"
                  className="px-3 py-2 border border-aurora-border rounded-xl focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                />
                <input
                  type="text"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  placeholder="Budget (optional)"
                  className="px-3 py-2 border border-aurora-border rounded-xl focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-aurora-text mb-2">Gender Preference</label>
                <select
                  value={formData.genderPref}
                  onChange={(e) => setFormData({ ...formData, genderPref: e.target.value as any })}
                  className="w-full px-3 py-2 border border-aurora-border rounded-xl focus:outline-none focus:ring-2 focus:ring-aurora-indigo"
                >
                  {['Any', 'Male', 'Female', 'Non-binary'].map((gender) => (
                    <option key={gender} value={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-aurora-text mb-2">Purposes</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Business', 'Leisure', 'Moving', 'Airport Transfer', 'Road Trip', 'Other'].map((purpose) => (
                    <button
                      key={purpose}
                      onClick={() => togglePurpose(purpose)}
                      className={`px-3 py-2 rounded text-sm font-medium text-center transition-colors ${
                        formData.purposes.includes(purpose)
                          ? 'bg-aurora-indigo text-white'
                          : 'bg-aurora-surface-variant text-aurora-text-secondary hover:bg-gray-100'
                      }`}
                    >
                      {formData.purposes.includes(purpose) ? '✓ ' : ''}{purpose}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-aurora-text mb-2">Description *</label>
                <textarea
                  value={formData.desc}
                  onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                  placeholder="Tell us more about your trip..."
                  className="w-full px-3 py-2 border border-aurora-border rounded-xl focus:outline-none focus:ring-2 focus:ring-aurora-indigo resize-none"
                  rows={4}
                />
              </div>

              <button
                onClick={handleCreatePost}
                className="w-full bg-aurora-indigo text-white py-2 rounded-xl font-semibold hover:bg-blue-800"
              >
                Create Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
