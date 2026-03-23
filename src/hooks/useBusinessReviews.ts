// ═════════════════════════════════════════════════════════════════════════════════
// useBusinessReviews — Fetch reviews, submit with optimistic update
// Phase 2 Step 6: Extract from business.tsx
// ═════════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect } from 'react';
import {
  collection, getDocs, addDoc, doc, updateDoc,
  Timestamp, query, where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { BusinessState, BusinessAction, BusinessReview } from '@/reducers/businessReducer';

export function useBusinessReviews(
  state: BusinessState,
  dispatch: React.Dispatch<BusinessAction>,
  user: any,
  userProfile: any,
) {
  // ── Fetch reviews for selected business ──
  const fetchReviews = useCallback(async (businessId: string) => {
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
      dispatch({ type: 'SET_BUSINESS_REVIEWS', payload: data });
    } catch (error) {
      console.error('Error fetching reviews:', error);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to load reviews.' });
    }
  }, [dispatch]);

  // ── Auto-fetch reviews when selectedBusiness changes ──
  useEffect(() => {
    if (state.selectedBusiness) {
      fetchReviews(state.selectedBusiness.id);
    }
  }, [state.selectedBusiness?.id, fetchReviews]);

  // ── Submit review with optimistic update ──
  const handleAddReview = useCallback(async () => {
    if (!state.selectedBusiness || !user) return;
    if (!state.newReview.text.trim()) {
      dispatch({ type: 'SET_TOAST', payload: 'Please enter a review before submitting.' });
      return;
    }
    try {
      await addDoc(collection(db, 'businessReviews'), {
        businessId: state.selectedBusiness.id,
        userId: user.uid,
        userName: userProfile?.name || 'Anonymous',
        rating: state.newReview.rating,
        text: state.newReview.text,
        createdAt: Timestamp.now(),
      });
      // Optimistic update: add review to local state immediately
      const optimisticReview: BusinessReview = {
        id: 'temp-' + Date.now(),
        businessId: state.selectedBusiness.id,
        userId: user.uid,
        userName: userProfile?.name || 'Anonymous',
        rating: state.newReview.rating,
        text: state.newReview.text,
        createdAt: Timestamp.now(),
      };
      const updatedReviews = [optimisticReview, ...state.businessReviews];
      dispatch({ type: 'SET_BUSINESS_REVIEWS', payload: updatedReviews });

      // Recalculate average rating
      const avgRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length;
      const ref = doc(db, 'businesses', state.selectedBusiness.id);
      await updateDoc(ref, {
        rating: parseFloat(avgRating.toFixed(1)),
        reviews: state.selectedBusiness.reviews + 1,
      });

      // Update local business state (avoid full refetch)
      const updatedBusiness = { ...state.selectedBusiness, rating: parseFloat(avgRating.toFixed(1)), reviews: state.selectedBusiness.reviews + 1 };
      dispatch({ type: 'SELECT_BUSINESS', payload: updatedBusiness });
      dispatch({ type: 'UPDATE_BUSINESS', payload: updatedBusiness });

      dispatch({ type: 'SET_NEW_REVIEW', payload: { rating: 5, text: '' } });
      dispatch({ type: 'SET_SHOW_REVIEW_FORM', payload: false });
    } catch (error) {
      console.error('Error adding review:', error);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to add review. Please try again.' });
    }
  }, [state.selectedBusiness, state.newReview, state.businessReviews, user, userProfile, dispatch]);

  return {
    fetchReviews,
    handleAddReview,
  };
}
