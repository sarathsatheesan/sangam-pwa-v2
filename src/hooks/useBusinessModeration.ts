// ═════════════════════════════════════════════════════════════════════════════════
// useBusinessModeration — Report, block, mute logic
// Phase 2 Step 5: Extract from business.tsx
// ═════════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDoc,
  serverTimestamp,
  arrayUnion,
  increment,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { REPORT_CATEGORIES } from '@/components/business/businessConstants';
import type { BusinessState, BusinessAction } from '@/reducers/businessReducer';

export function useBusinessModeration(
  state: BusinessState,
  dispatch: React.Dispatch<BusinessAction>,
  user: any,
  userProfile: any,
) {
  // ── Load user safety data (muted businesses, blocked users) ──
  useEffect(() => {
    if (!user) return;
    const loadUserSafetyData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.mutedBusinesses) {
            dispatch({ type: 'SET_MUTED_BUSINESSES', payload: new Set(data.mutedBusinesses) });
          }
          if (data.blockedUsers) {
            dispatch({ type: 'SET_BLOCKED_USERS', payload: new Set(data.blockedUsers) });
          }
        }
      } catch (e) {
        console.error('Error loading user safety data:', e);
      }
    };
    loadUserSafetyData();
  }, [user, dispatch]);

  // ── Open report modal ──
  const openReportModal = useCallback((businessId: string) => {
    dispatch({ type: 'OPEN_REPORT', payload: businessId });
  }, [dispatch]);

  // ── Submit report ──
  const handleSubmitReport = useCallback(async () => {
    if (!state.reportReason || !state.reportBusinessId || !user) return;
    try {
      dispatch({ type: 'SET_REPORT_SUBMITTING', payload: true });
      const reportedBusiness = state.businesses.find((b) => b.id === state.reportBusinessId);
      const categoryObj = REPORT_CATEGORIES.find((c) => c.id === state.reportReason);

      // Write to reports collection (stealth: no owner notification)
      await addDoc(collection(db, 'reports'), {
        businessId: state.reportBusinessId,
        reportedBy: user.uid,
        reporterName: userProfile?.name || user.displayName || 'Anonymous',
        reporterAvatar: userProfile?.avatar || '',
        category: state.reportReason,
        categoryLabel: categoryObj?.label || state.reportReason,
        details: state.reportDetails.trim() || '',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      // SECURITY (H-05, 2026-09-02): the moderation queue is write-only for
      // members (reads are admin-only). Blind upsert keyed by contentId —
      // reportCount increments server-side, and the 3-strike escalation now
      // runs in the onModerationQueueWritten Cloud Function.
      await setDoc(doc(db, 'moderationQueue', state.reportBusinessId), {
        type: 'business',
        content: reportedBusiness?.name || '',
        contentId: state.reportBusinessId,
        collection: 'businesses',
        authorId: reportedBusiness?.ownerId || '',
        authorName: reportedBusiness?.name || 'Unknown Business',
        authorAvatar: '',
        images: reportedBusiness?.photos || [],
        category: state.reportReason,
        categoryLabel: categoryObj?.label || state.reportReason,
        reason: `${categoryObj?.label || state.reportReason}${state.reportDetails.trim() ? ': ' + state.reportDetails.trim() : ''}`,
        reportedBy: user.uid,
        reporterName: userProfile?.name || user.displayName || 'Anonymous',
        reporterAvatar: userProfile?.avatar || '',
        reportCount: increment(1),
        reporters: arrayUnion({
          uid: user.uid,
          name: userProfile?.name || user.displayName || 'Anonymous',
          avatar: userProfile?.avatar || '',
          category: state.reportReason,
          details: state.reportDetails.trim() || '',
          createdAt: new Date().toISOString(),
        }),
        createdAt: serverTimestamp(),
      }, { merge: true });

      // Mute-on-report: hide this business from the reporter's view
      await updateDoc(doc(db, 'users', user.uid), {
        mutedBusinesses: arrayUnion(state.reportBusinessId),
      });
      dispatch({ type: 'ADD_MUTED_BUSINESS', payload: state.reportBusinessId });
      dispatch({ type: 'ADD_REPORTED_BUSINESS', payload: state.reportBusinessId });
      dispatch({ type: 'CLOSE_REPORT' });
      dispatch({ type: 'SET_TOAST', payload: 'Report submitted. The business has been hidden from your view. Thank you for helping keep the community safe.' });
    } catch (error) {
      console.error('Error submitting report:', error);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to submit report. Please try again.' });
    } finally {
      dispatch({ type: 'SET_REPORT_SUBMITTING', payload: false });
    }
  }, [state.reportReason, state.reportBusinessId, state.reportDetails, state.businesses, user, userProfile, dispatch]);

  // ── Block user ──
  const handleBlockUser = useCallback(async () => {
    if (!user || !state.blockTargetUser) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: arrayUnion(state.blockTargetUser!.uid),
      });
      dispatch({ type: 'ADD_BLOCKED_USER', payload: state.blockTargetUser!.uid });
      dispatch({ type: 'CLOSE_BLOCK_CONFIRM' });
      dispatch({ type: 'SET_TOAST', payload: `${state.blockTargetUser!.name} has been blocked. Their businesses will no longer appear in your listings.` });
      setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 4000);
    } catch (error) {
      console.error('Error blocking user:', error);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to block user. Please try again.' });
    }
  }, [user, state.blockTargetUser, dispatch]);

  // ── Open block confirmation ──
  const openBlockConfirm = useCallback((ownerId: string, businessName: string) => {
    dispatch({ type: 'OPEN_BLOCK_CONFIRM', payload: { uid: ownerId, name: businessName } });
  }, [dispatch]);

  return {
    openReportModal,
    handleSubmitReport,
    handleBlockUser,
    openBlockConfirm,
  };
}
