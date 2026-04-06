import { useState, useEffect, useCallback } from 'react';
import { Flag, Eye, EyeOff, Loader2, AlertTriangle, Star, CheckCircle2 } from 'lucide-react';
import type { CateringReview } from '@/services/cateringService';
import { fetchFlaggedReviews } from '@/services/cateringService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useToast } from '@/contexts/ToastContext';

interface ReviewModerationPanelProps {
  businessId: string;
}

export default function ReviewModerationPanel({ businessId }: ReviewModerationPanelProps) {
  const { addToast } = useToast();
  const [reviews, setReviews] = useState<CateringReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      const flagged = await fetchFlaggedReviews(businessId);
      setReviews(flagged);
    } catch {
      addToast('Failed to load flagged reviews', 'error');
    } finally {
      setLoading(false);
    }
  }, [businessId, addToast]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const handleDismissFlag = async (reviewId: string) => {
    setActionLoading(reviewId);
    try {
      await updateDoc(doc(db, 'businessReviews', reviewId), {
        flagged: false,
        flagDismissedAt: serverTimestamp(),
      });
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      addToast('Flag dismissed', 'success');
    } catch {
      addToast('Failed to dismiss flag', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleHideReview = async (reviewId: string) => {
    setActionLoading(reviewId);
    try {
      await updateDoc(doc(db, 'businessReviews', reviewId), {
        hidden: true,
        hiddenAt: serverTimestamp(),
        flagResolved: true,
      });
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      addToast('Review hidden from public view', 'success');
    } catch {
      addToast('Failed to hide review', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin" style={{ color: '#6366F1' }} />
        <span className="ml-2 text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>Loading flagged reviews...</span>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: '#059669' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>No flagged reviews</p>
        <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-muted)' }}>All reviews are clear — nothing needs your attention.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Flag size={14} style={{ color: '#EF4444' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
          Flagged Reviews ({reviews.length})
        </h3>
      </div>

      {reviews.map(review => (
        <div
          key={review.id}
          className="rounded-xl border p-4 space-y-2"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: '#FECACA' }}
        >
          {/* Header: reviewer + rating */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--aurora-text)' }}>
                {review.userName || 'Anonymous'}
              </span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} size={10} fill={s <= review.rating ? '#F59E0B' : 'none'} stroke={s <= review.rating ? '#F59E0B' : 'var(--aurora-text-muted)'} strokeWidth={1.5} />
                ))}
              </div>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
              Flagged
            </span>
          </div>

          {/* Review text */}
          <p className="text-sm" style={{ color: 'var(--aurora-text-secondary)' }}>
            {review.text || 'No text provided'}
          </p>

          {/* Flag reason */}
          {review.flagReason && (
            <div className="flex items-start gap-1.5 p-2 rounded-lg" style={{ backgroundColor: '#FEF2F2' }}>
              <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
              <span className="text-xs" style={{ color: '#991B1B' }}>
                Flag reason: {review.flagReason}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleDismissFlag(review.id)}
              disabled={actionLoading === review.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--aurora-border)', color: 'var(--aurora-text-secondary)' }}
            >
              <Eye size={12} />
              Dismiss Flag
            </button>
            <button
              onClick={() => handleHideReview(review.id)}
              disabled={actionLoading === review.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#EF4444' }}
            >
              {actionLoading === review.id ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />}
              Hide Review
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
