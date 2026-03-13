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
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ETHNICITY_HIERARCHY, ETHNICITY_CHILDREN, HERITAGE_OPTIONS, PRIORITY_ETHNICITIES } from '@/constants/config';
import { ClickOutsideOverlay } from '@/components/ClickOutsideOverlay';

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

  // Click outside handling is now managed by ClickOutsideOverlay component

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
