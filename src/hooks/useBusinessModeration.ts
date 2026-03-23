// ═════════════════════════════════════════════════════════════════════════════════
// useBusinessModeration — Report, block, mute logic
// Phase 2 Step 5: Extract from business.tsx
// ═════════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect } from 'react';
import {
  collection, getDocs, addDoc, doc, updateDoc,
  query, where, getDoc, serverTimestamp, arrayUnion,
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

      // Check if moderationQueue entry already exists for this business
      const modQueueQuery = query(
        collection(db, 'moderationQueue'),
        where('contentId', '==', state.reportBusinessId)
      );
      const existingMods = await getDocs(modQueueQuery);

      let totalReportCount = 1;

      if (existingMods.docs.length > 0) {
        const existingDoc = existingMods.docs[0];
        const existingData = existingDoc.data();
        totalReportCount = (existingData.reportCount || 1) + 1;
        await updateDoc(doc(db, 'moderationQueue', existingDoc.id), {
          reportCount: totalReportCount,
          reporters: arrayUnion({
            uid: user.uid,
            name: userProfile?.name || user.displayName || 'Anonymous',
            avatar: userProfile?.avatar || '',
            category: state.reportReason,
            details: state.reportDetails.trim() || '',
            createdAt: new Date().toISOString(),
          }),
        });
      } else {
        await addDoc(collection(db, 'moderationQueue'), {
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
          reportCount: 1,
          reporters: [{
            uid: user.uid,
            name: userProfile?.name || user.displayName || 'Anonymous',
            avatar: userProfile?.avatar || '',
            category: state.reportReason,
            details: state.reportDetails.trim() || '',
            createdAt: new Date().toISOString(),
          }],
          createdAt: serverTimestamp(),
        });
      }

      // 3-strike auto-hide
      if (totalReportCount >= 3) {
        await updateDoc(doc(db, 'businesses', state.reportBusinessId), {
          isHidden: true,
          hiddenAt: new Date().toISOString(),
          hiddenReason: 'Auto-hidden: reached 3 community reports',
        });
        if (reportedBusiness?.ownerId) {
          await addDoc(collection(db, 'notifications'), {
            type: 'content_hidden',
            recipientId: reportedBusiness.ownerId,
            recipientName: reportedBusiness.name || '',
            postId: state.reportBusinessId,
            reason: 'Your business listing received multiple community reports and has been temporarily hidden for review.',
            message: 'Your business listing has been temporarily hidden after multiple community reports. A moderator will review it shortly. If you believe this was a mistake, you can submit an appeal by contacting support.',
            actionUrl: '/business',
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      }

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
