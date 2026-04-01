// ═════════════════════════════════════════════════════════════════════════════════
// CATERING REVIEWS
// Display component for catering reviews with aggregated ratings, review list,
// vendor responses, and vendor reply form. Used on both customer and vendor sides.
// Phase 5: Reviews & Ratings
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Star, ArrowLeft, MessageSquare, Send, Loader2, Users,
  ChevronDown, ChevronUp, Store, UtensilsCrossed,
  ArrowUpDown, Filter, Flag, AlertTriangle,
} from 'lucide-react';
import type { CateringReview } from '@/services/cateringService';
import { fetchCateringReviews, addVendorResponse, flagReview } from '@/services/cateringService';
import { useToast } from '@/contexts/ToastContext';

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';
type FilterOption = 'all' | '5' | '4' | '3' | '2' | '1';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest First',
  oldest: 'Oldest First',
  highest: 'Highest Rated',
  lowest: 'Lowest Rated',
};

const FLAG_REASONS = [
  'Inappropriate language',
  'Spam or fake review',
  'Irrelevant content',
  'Contains personal information',
  'Other',
];

interface CateringReviewsProps {
  businessId: string;
  businessName: string;
  /** If true, show vendor reply controls */
  isVendor?: boolean;
  onBack: () => void;
}

// ── Star display component ──
function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= Math.round(rating) ? '#F59E0B' : 'none'}
          stroke={star <= Math.round(rating) ? '#F59E0B' : 'var(--aurora-text-muted)'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

// ── Rating breakdown bar ──
function RatingBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-4 text-right" style={{ color: 'var(--aurora-text-secondary)' }}>{stars}</span>
      <Star size={10} fill="#F59E0B" stroke="#F59E0B" />
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--aurora-border)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: '#F59E0B' }}
        />
      </div>
      <span className="text-[10px] w-6 text-right" style={{ color: 'var(--aurora-text-secondary)' }}>{count}</span>
    </div>
  );
}

// ── Single review card ──
function ReviewCard({
  review,
  isVendor,
  onReply,
  onFlag,
  replyLoading,
  flagLoading,
  businessName,
}: {
  review: CateringReview;
  isVendor: boolean;
  onReply: (reviewId: string, text: string) => void;
  onFlag: (reviewId: string, reason: string) => void;
  replyLoading: string | null;
  flagLoading: string | null;
  businessName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  const createdDate = review.createdAt?.toDate
    ? review.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const respondedDate = review.vendorRespondedAt?.toDate
    ? review.vendorRespondedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(review.id, replyText.trim());
      setReplyText('');
      setShowReplyForm(false);
    }
  };

  return (
    <div
      className="p-4 rounded-2xl border"
      style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
    >
      {/* Header: name, rating, date */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
              {review.userName}
            </p>
            <StarRating rating={review.rating} size={12} />
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
            {createdDate}
          </p>
        </div>
        {review.eventType && (
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
            style={{ backgroundColor: 'rgba(99,102,241,0.08)', color: '#6366F1' }}
          >
            {review.eventType.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Review text */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--aurora-text)' }}>
        {review.text}
      </p>

      {/* Order context (collapsible) */}
      {(review.itemsOrdered?.length || review.headcount) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-2 text-[10px] font-medium"
          style={{ color: 'var(--aurora-text-secondary)' }}
        >
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          Order details
        </button>
      )}
      {expanded && (
        <div
          className="mt-2 p-2 rounded-lg text-xs space-y-1"
          style={{ backgroundColor: 'var(--aurora-bg)' }}
        >
          {review.headcount && (
            <div className="flex items-center gap-1" style={{ color: 'var(--aurora-text-secondary)' }}>
              <Users size={10} />
              <span>{review.headcount} guests</span>
            </div>
          )}
          {review.itemsOrdered && review.itemsOrdered.length > 0 && (
            <div className="flex items-start gap-1" style={{ color: 'var(--aurora-text-secondary)' }}>
              <UtensilsCrossed size={10} className="mt-0.5 flex-shrink-0" />
              <span>{review.itemsOrdered.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Vendor response */}
      {review.vendorResponse && (
        <div
          className="mt-3 p-3 rounded-xl border-l-2"
          style={{ backgroundColor: 'rgba(99,102,241,0.04)', borderColor: '#6366F1' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Store size={12} style={{ color: '#6366F1' }} />
            <span className="text-[10px] font-semibold" style={{ color: '#6366F1' }}>
              {businessName ? `${businessName} (Owner)` : 'Owner Response'}
            </span>
            {respondedDate && (
              <span className="text-[10px]" style={{ color: 'var(--aurora-text-secondary)' }}>
                · {respondedDate}
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: 'var(--aurora-text)' }}>
            {review.vendorResponse}
          </p>
        </div>
      )}

      {/* Vendor reply form */}
      {isVendor && !review.vendorResponse && (
        <>
          {!showReplyForm ? (
            <button
              onClick={() => setShowReplyForm(true)}
              className="flex items-center gap-1.5 mt-3 text-xs font-medium transition-colors"
              style={{ color: '#6366F1' }}
            >
              <MessageSquare size={12} />
              Reply to review
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a professional response to this review..."
                rows={3}
                maxLength={500}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500/30"
                style={{
                  backgroundColor: 'var(--aurora-bg)',
                  borderColor: 'var(--aurora-border)',
                  color: 'var(--aurora-text)',
                }}
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setShowReplyForm(false); setReplyText(''); }}
                  className="text-xs"
                  style={{ color: 'var(--aurora-text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim() || replyLoading === review.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#6366F1' }}
                >
                  {replyLoading === review.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Send size={12} />
                  )}
                  Send Reply
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Vendor flag review (#22) */}
      {isVendor && !review.flagged && (
        <>
          {!showFlagForm ? (
            <button
              onClick={() => setShowFlagForm(true)}
              className="flex items-center gap-1.5 mt-2 text-[10px] font-medium transition-colors"
              style={{ color: '#9CA3AF' }}
            >
              <Flag size={10} />
              Report review
            </button>
          ) : (
            <div className="mt-2 p-3 rounded-xl border space-y-2" style={{ borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}>
              <p className="text-xs font-medium" style={{ color: '#991B1B' }}>Why are you reporting this review?</p>
              <div className="space-y-1">
                {FLAG_REASONS.map((reason) => (
                  <label key={reason} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name={`flag-${review.id}`}
                      value={reason}
                      checked={flagReason === reason}
                      onChange={() => setFlagReason(reason)}
                      className="accent-red-500"
                    />
                    <span style={{ color: 'var(--aurora-text)' }}>{reason}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => { setShowFlagForm(false); setFlagReason(''); }}
                  className="text-[10px]"
                  style={{ color: 'var(--aurora-text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { if (flagReason) { onFlag(review.id, flagReason); setShowFlagForm(false); } }}
                  disabled={!flagReason || flagLoading === review.id}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: '#EF4444' }}
                >
                  {flagLoading === review.id ? <Loader2 size={10} className="animate-spin" /> : <Flag size={10} />}
                  Submit Report
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Flagged badge */}
      {review.flagged && isVendor && (
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg text-[10px] font-medium" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
          <AlertTriangle size={10} />
          Reported — under review
        </div>
      )}
    </div>
  );
}

// ── Main component ──
export default function CateringReviews({
  businessId,
  businessName,
  isVendor = false,
  onBack,
}: CateringReviewsProps) {
  const { addToast } = useToast();
  const [reviews, setReviews] = useState<CateringReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyLoading, setReplyLoading] = useState<string | null>(null);
  const [flagLoading, setFlagLoading] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterRating, setFilterRating] = useState<FilterOption>('all');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCateringReviews(businessId);
      setReviews(data);
    } catch {
      addToast('Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  }, [businessId, addToast]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleReply = useCallback(async (reviewId: string, text: string) => {
    setReplyLoading(reviewId);
    try {
      await addVendorResponse(reviewId, text);
      // Optimistic update
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, vendorResponse: text, vendorRespondedAt: { toDate: () => new Date() } } : r,
      ));
      addToast('Reply posted', 'success');
    } catch {
      addToast('Failed to post reply', 'error');
    } finally {
      setReplyLoading(null);
    }
  }, [addToast]);

  const handleFlag = useCallback(async (reviewId: string, reason: string) => {
    setFlagLoading(reviewId);
    try {
      await flagReview(reviewId, businessId, reason);
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, flagged: true, flagReason: reason } as CateringReview : r,
      ));
      addToast('Review reported — our team will review it', 'success');
    } catch {
      addToast('Failed to report review', 'error');
    } finally {
      setFlagLoading(null);
    }
  }, [businessId, addToast]);

  // Aggregated stats
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / totalReviews
    : 0;
  const ratingCounts = [0, 0, 0, 0, 0]; // index 0 = 1 star
  reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) ratingCounts[r.rating - 1]++; });

  // Sort & filter (#20)
  const sortedFilteredReviews = useMemo(() => {
    let result = [...reviews];
    // Filter by rating
    if (filterRating !== 'all') {
      const target = parseInt(filterRating, 10);
      result = result.filter(r => Math.round(r.rating) === target);
    }
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return aTime - bTime;
        }
        case 'highest':
          return b.rating - a.rating;
        case 'lowest':
          return a.rating - b.rating;
        case 'newest':
        default: {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bTime - aTime;
        }
      }
    });
    return result;
  }, [reviews, sortBy, filterRating]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>Loading reviews...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5 transition-colors">
          <ArrowLeft size={18} style={{ color: 'var(--aurora-text)' }} />
        </button>
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--aurora-text)' }}>
            Catering Reviews
          </h2>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            {businessName}
          </p>
        </div>
      </div>

      {/* Aggregated rating card */}
      <div
        className="p-4 rounded-2xl border"
        style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
      >
        <div className="flex items-start gap-6">
          {/* Big number */}
          <div className="text-center">
            <p className="text-4xl font-bold" style={{ color: 'var(--aurora-text)' }}>
              {avgRating > 0 ? avgRating.toFixed(1) : '--'}
            </p>
            <StarRating rating={avgRating} size={16} />
            <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-secondary)' }}>
              {totalReviews} review{totalReviews !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Breakdown bars */}
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((stars) => (
              <RatingBar
                key={stars}
                stars={stars}
                count={ratingCounts[stars - 1]}
                total={totalReviews}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sort & Filter controls (#20) */}
      {reviews.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
              style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text)' }}
            >
              <ArrowUpDown size={12} />
              {SORT_LABELS[sortBy]}
              <ChevronDown size={10} />
            </button>
            {showSortMenu && (
              <div
                className="absolute top-full left-0 mt-1 z-20 rounded-xl border shadow-lg overflow-hidden min-w-[150px]"
                style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setSortBy(opt); setShowSortMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 transition-colors"
                    style={{
                      color: sortBy === opt ? '#6366F1' : 'var(--aurora-text)',
                      fontWeight: sortBy === opt ? 600 : 400,
                    }}
                  >
                    {SORT_LABELS[opt]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter by rating pills */}
          <div className="flex items-center gap-1">
            <Filter size={12} style={{ color: 'var(--aurora-text-muted)' }} />
            {(['all', '5', '4', '3', '2', '1'] as FilterOption[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterRating(opt)}
                className="px-2 py-1 rounded-full text-[10px] font-medium transition-colors"
                style={{
                  backgroundColor: filterRating === opt ? '#6366F1' : 'transparent',
                  color: filterRating === opt ? '#fff' : 'var(--aurora-text-secondary)',
                  border: filterRating === opt ? 'none' : '1px solid var(--aurora-border)',
                }}
              >
                {opt === 'all' ? 'All' : `${opt}★`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <Star size={32} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
            No catering reviews yet
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-secondary)' }}>
            Reviews appear here after catering orders are delivered
          </p>
        </div>
      ) : sortedFilteredReviews.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
            No reviews match this filter
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFilteredReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isVendor={isVendor}
              businessName={businessName}
              onReply={handleReply}
              onFlag={handleFlag}
              replyLoading={replyLoading}
              flagLoading={flagLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
