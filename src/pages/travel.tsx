import React, { useState, useEffect, useMemo } from 'react';
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

const HERITAGE_OPTIONS = [
  'Indian',
  'Pakistani',
  'Bangladeshi',
  'Sri Lankan',
  'Nepali',
  'Bhutanese',
  'Maldivian',
  'Afghan',
];

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
  const [selectedHeritage, setSelectedHeritage] = useState<string>('All');
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

  const filteredPosts = useMemo(() => {
    let filtered = travelPosts;

    if (filterMode !== 'all') {
      filtered = filtered.filter((post) => post.mode === filterMode);
    }

    if (selectedHeritage !== 'All') {
      filtered = filtered.filter((p: any) => {
        if (Array.isArray(p.heritage)) {
          return p.heritage.includes(selectedHeritage);
        }
        return p.heritage === selectedHeritage;
      });
    }

    return filtered;
  }, [travelPosts, filterMode, selectedHeritage]);

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
    <div className="bg-[#F8FAFC]">
      {/* Stats Bar */}
      <div className="bg-aurora-surface border-b border-aurora-border">
        <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-aurora-indigo">{stats.total}</p>
            <p className="text-xs text-aurora-text-secondary">Active Trips</p>
          </div>
          <div className="border-l border-r border-aurora-border text-center">
            <p className="text-2xl font-bold text-aurora-indigo">{stats.assistance}</p>
            <p className="text-xs text-aurora-text-secondary">Need Help</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-aurora-indigo">{stats.offering}</p>
            <p className="text-xs text-aurora-text-secondary">Offering</p>
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="bg-aurora-surface border-b border-aurora-border p-4">
        <div className="max-w-6xl mx-auto flex gap-3">
          {(['all', 'assistance', 'offer'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-4 py-2 rounded-full font-medium text-sm transition-colors ${
                filterMode === mode
                  ? 'bg-aurora-indigo text-white'
                  : 'bg-aurora-surface-variant text-aurora-text-secondary hover:bg-gray-100'
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

      {/* Heritage Filter */}
      <div className="bg-aurora-surface border-b border-aurora-border overflow-x-auto">
        <div className="max-w-6xl mx-auto flex gap-2 px-4 py-3 min-w-max">
          {['All', ...HERITAGE_OPTIONS].map((heritage) => (
            <button
              key={heritage}
              onClick={() => setSelectedHeritage(heritage)}
              className={`px-3 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                selectedHeritage === heritage
                  ? 'bg-aurora-warning text-white'
                  : 'bg-aurora-surface border border-aurora-border text-aurora-text-secondary'
              }`}
            >
              {heritage}
            </button>
          ))}
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
