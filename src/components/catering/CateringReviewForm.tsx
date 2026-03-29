// ═════════════════════════════════════════════════════════════════════════════════
// CATERING REVIEW FORM
// Post-delivery review submission with star rating, text, and order context.
// Triggered from CateringOrderStatus when order status is 'delivered'.
// Phase 5: Reviews & Ratings
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { Star, Send, Loader2, X, UtensilsCrossed, Users } from 'lucide-react';
import type { CateringOrder } from '@/services/cateringService';
import { submitCateringReview, hasReviewedOrder } from '@/services/cateringService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface CateringReviewFormProps {
  order: CateringOrder;
  onClose: () => void;
  onSubmitted: () => void;
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

export default function CateringReviewForm({ order, onClose, onSubmitted }: CateringReviewFormProps) {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeRating = hoverRating || rating;

  const handleSubmit = useCallback(async () => {
    if (!user) {
      addToast('Please log in to leave a review', 'error');
      return;
    }
    if (rating === 0) {
      addToast('Please select a star rating', 'error');
      return;
    }
    if (!text.trim()) {
      addToast('Please write a brief review', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Check for duplicate review
      const alreadyReviewed = await hasReviewedOrder(user.uid, order.id);
      if (alreadyReviewed) {
        addToast('You have already reviewed this order', 'info');
        onClose();
        return;
      }

      await submitCateringReview({
        businessId: order.businessId,
        userId: user.uid,
        userName: userProfile?.name || 'Anonymous',
        rating,
        text: text.trim(),
        orderId: order.id,
        eventType: order.eventType,
        itemsOrdered: order.items.map(i => i.name),
        headcount: order.headcount,
      });

      addToast('Review submitted! Thank you for your feedback.', 'success');
      onSubmitted();
    } catch (err: any) {
      console.error('Failed to submit review:', err);
      addToast(err.message || 'Failed to submit review', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, userProfile, rating, text, order, addToast, onClose, onSubmitted]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--aurora-surface)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--aurora-border)' }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--aurora-text)' }}>
              Rate Your Experience
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-secondary)' }}>
              {order.businessName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
          >
            <X size={18} style={{ color: 'var(--aurora-text-secondary)' }} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Order context */}
          <div
            className="flex items-center gap-3 text-xs p-3 rounded-xl"
            style={{ backgroundColor: 'var(--aurora-bg)' }}
          >
            <div className="flex items-center gap-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
              <UtensilsCrossed size={12} />
              <span>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--aurora-text-secondary)' }}>
              <Users size={12} />
              <span>{order.headcount} guests</span>
            </div>
            {order.eventType && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: 'rgba(99,102,241,0.08)', color: '#6366F1' }}
              >
                {order.eventType.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Star rating */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    size={32}
                    fill={star <= activeRating ? '#F59E0B' : 'none'}
                    stroke={star <= activeRating ? '#F59E0B' : 'var(--aurora-text-secondary)'}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
            {activeRating > 0 && (
              <p
                className="text-sm font-medium mt-1 transition-opacity"
                style={{ color: '#F59E0B' }}
              >
                {RATING_LABELS[activeRating]}
              </p>
            )}
          </div>

          {/* Review text */}
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="How was the food quality, presentation, and service? Would you order from this caterer again?"
              rows={4}
              maxLength={1000}
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500/30"
              style={{
                backgroundColor: 'var(--aurora-bg)',
                borderColor: 'var(--aurora-border)',
                color: 'var(--aurora-text)',
              }}
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px]" style={{ color: 'var(--aurora-text-secondary)' }}>
                {text.length}/1000
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0 || !text.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#6366F1' }}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );
}
