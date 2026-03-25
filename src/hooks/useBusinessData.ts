// ═════════════════════════════════════════════════════════════════════════════════
// useBusinessData — Encapsulates Firestore CRUD, pagination, and favorites
// Phase 2 Step 3: Extract from business.tsx
// #39: Real-time onSnapshot listener for live business list updates
// ═════════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
  Timestamp, query, limit, orderBy, startAfter, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { toggleSavedItem, getLocalSavedIds } from '@/services/savedItems';
import { CATEGORY_EMOJI_MAP, CATEGORY_COLORS } from '@/components/business/businessConstants';
import { validateBusinessForm } from '@/components/business/businessValidation';
import type { BusinessState, BusinessAction, Business, BusinessFormData } from '@/reducers/businessReducer';
import { recordFavorite } from '@/services/businessAnalytics';

const PAGE_SIZE = 20;

/** Map a Firestore document snapshot to our Business interface */
function mapDocToBusiness(docSnap: { id: string; data: () => any }): Business | null {
  const d = docSnap.data();
  if (d.isHidden) return null;
  return {
    id: docSnap.id,
    name: d.name || '',
    emoji: d.emoji || CATEGORY_EMOJI_MAP[d.category] || '💼',
    category: d.category || '',
    desc: d.desc || '',
    location: d.location || '',
    phone: d.phone || '',
    website: d.website || '',
    email: d.email || '',
    hours: d.hours || '',
    rating: d.rating || 4.5,
    reviews: d.reviews || 0,
    promoted: d.promoted || false,
    bgColor: d.bgColor || CATEGORY_COLORS[d.category] || '#999',
    ownerId: d.ownerId,
    heritage: d.heritage,
    menu: d.menu || '',
    services: d.services || '',
    createdAt: d.createdAt,
    priceRange: d.priceRange,
    yearEstablished: d.yearEstablished,
    specialtyTags: d.specialtyTags || [],
    paymentMethods: d.paymentMethods || [],
    deliveryOptions: d.deliveryOptions || [],
    deals: d.deals || [],
    photos: d.photos || [],
    coverPhotoIndex: d.coverPhotoIndex || 0,
    isHidden: d.isHidden || false,
    hiddenAt: d.hiddenAt || '',
    hiddenReason: d.hiddenReason || '',
    verified: d.verified || false,
    verifiedAt: d.verifiedAt || null,
    verificationMethod: d.verificationMethod || null,
    followers: d.followers || [],
    followerCount: d.followerCount || 0,
    bookingUrl: d.bookingUrl || '',
    latitude: d.latitude,
    longitude: d.longitude,
    viewCount: d.viewCount,
    contactClicks: d.contactClicks,
    shareCount: d.shareCount,
  };
}

export function useBusinessData(
  state: BusinessState,
  dispatch: React.Dispatch<BusinessAction>,
  user: any,
  userRole: string | undefined,
  userProfile: any,
) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // ── Real-time onSnapshot listener (replaces initial getDocs) ──
  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: true });

    const q = query(
      collection(db, 'businesses'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );

    unsubRef.current = onSnapshot(
      q,
      (snapshot) => {
        const data: Business[] = [];
        snapshot.forEach((docSnap) => {
          const biz = mapDocToBusiness(docSnap);
          if (biz) data.push(biz);
        });

        if (snapshot.docs.length < PAGE_SIZE) {
          dispatch({ type: 'SET_HAS_MORE', payload: false });
        } else {
          dispatch({ type: 'SET_HAS_MORE', payload: true });
        }
        if (snapshot.docs.length > 0) {
          dispatch({ type: 'SET_LAST_DOC', payload: snapshot.docs[snapshot.docs.length - 1] });
        }

        dispatch({ type: 'SET_BUSINESSES', payload: data });
        dispatch({ type: 'SET_LOADING', payload: false });
      },
      (error) => {
        console.error('Business onSnapshot error:', error);
        dispatch({ type: 'SET_TOAST', payload: 'Failed to load businesses. Please try again.' });
        dispatch({ type: 'SET_LOADING', payload: false });
      },
    );

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [dispatch]);

  // ── Load more (paginated, one-time getDocs — extends beyond live window) ──
  const fetchMoreBusinesses = useCallback(async () => {
    if (!state.lastDoc || state.loadingMore || !state.hasMore) return;
    dispatch({ type: 'SET_LOADING_MORE', payload: true });
    try {
      const q = query(
        collection(db, 'businesses'),
        orderBy('createdAt', 'desc'),
        startAfter(state.lastDoc),
        limit(PAGE_SIZE),
      );
      const snapshot = await getDocs(q);
      const data: Business[] = [];
      snapshot.forEach((docSnap) => {
        const biz = mapDocToBusiness(docSnap);
        if (biz) data.push(biz);
      });

      if (snapshot.docs.length < PAGE_SIZE) {
        dispatch({ type: 'SET_HAS_MORE', payload: false });
      }
      if (snapshot.docs.length > 0) {
        dispatch({ type: 'SET_LAST_DOC', payload: snapshot.docs[snapshot.docs.length - 1] });
      }
      dispatch({ type: 'APPEND_BUSINESSES', payload: data });
    } catch (error) {
      console.error('Error loading more businesses:', error);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to load more businesses.' });
    } finally {
      dispatch({ type: 'SET_LOADING_MORE', payload: false });
    }
  }, [state.lastDoc, state.loadingMore, state.hasMore, dispatch]);

  // Keep a stable reference to fetchBusinesses for backward compat (used after add)
  const fetchBusinesses = useCallback(async () => {
    // With onSnapshot the list auto-updates; this is now a no-op.
    // Kept for API compatibility with handleAddBusiness / CSV import.
  }, []);

  // ── Infinite scroll observer ──
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && state.hasMore && !state.loadingMore && !state.loading) {
          fetchMoreBusinesses();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [state.hasMore, state.loadingMore, state.loading, fetchMoreBusinesses]);

  // ── Load favorites from localStorage cache ──
  useEffect(() => {
    dispatch({ type: 'SET_FAVORITES', payload: new Set(getLocalSavedIds('businesses')) });
  }, [dispatch]);

  // ── Toggle favorite ──
  const toggleFavorite = useCallback((businessId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid) return;
    toggleSavedItem(user.uid, 'businesses', businessId).then(({ ids }) => {
      dispatch({ type: 'SET_FAVORITES', payload: ids });
      // Track analytics if it was added (not removed)
      if (ids.has(businessId)) recordFavorite(businessId);
    });
  }, [user?.uid, dispatch]);

  // ── Open create modal (with business account / TIN checks) ──
  const handleOpenCreateModal = useCallback(() => {
    if (userProfile?.accountType !== 'business' && userRole !== 'admin') {
      dispatch({ type: 'SET_TOAST', payload: 'Only business accounts can add listings. Please switch to a business account in your Profile settings.' });
      return;
    }
    if (userProfile?.isRegistered === true && userProfile?.tinValidationStatus !== 'valid' && userRole !== 'admin') {
      dispatch({ type: 'SET_SHOW_TIN_MODAL', payload: true });
      return;
    }
    if (userProfile?.isRegistered === false && !userProfile?.adminApproved && userRole !== 'admin') {
      dispatch({ type: 'SET_TOAST', payload: 'Your unregistered business account is pending admin approval.' });
      return;
    }
    dispatch({ type: 'OPEN_CREATE_MODAL' });
  }, [userProfile, userRole, dispatch]);

  // ── Add business ──
  const handleAddBusiness = useCallback(async () => {
    const errors = validateBusinessForm(state.formData as BusinessFormData);
    dispatch({ type: 'SET_FORM_ERRORS', payload: errors });
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'SET_TOAST', payload: 'Please fix the errors in the form' });
      return;
    }
    dispatch({ type: 'SET_SAVING', payload: true });
    try {
      await addDoc(collection(db, 'businesses'), {
        name: state.formData.name,
        category: state.formData.category,
        desc: state.formData.desc,
        location: state.formData.location,
        phone: state.formData.phone,
        website: state.formData.website,
        bookingUrl: state.formData.bookingUrl || '',
        email: state.formData.email,
        hours: state.formData.hours,
        menu: state.formData.menu,
        services: state.formData.services,
        priceRange: state.formData.priceRange,
        yearEstablished: state.formData.yearEstablished,
        paymentMethods: state.formData.paymentMethods,
        deliveryOptions: state.formData.deliveryOptions,
        specialtyTags: state.formData.specialtyTags,
        emoji: CATEGORY_EMOJI_MAP[state.formData.category] || '💼',
        bgColor: CATEGORY_COLORS[state.formData.category] || '#999',
        rating: 4.5,
        reviews: 0,
        promoted: false,
        createdAt: Timestamp.now(),
        ownerId: user?.uid || '',
        ownerName: userProfile?.name || user?.displayName || 'Unknown',
        heritage: Array.isArray(userProfile?.heritage)
          ? userProfile.heritage
          : userProfile?.heritage
          ? [userProfile.heritage]
          : [],
        ...(state.formPhotos.length > 0 ? { photos: state.formPhotos, coverPhotoIndex: Math.min(state.coverPhotoIndex, state.formPhotos.length - 1) } : {}),
        // Geolocation (for map view)
        ...(state.formData.latitude !== '' && state.formData.longitude !== '' ? {
          latitude: Number(state.formData.latitude),
          longitude: Number(state.formData.longitude),
        } : {}),
        // Analytics counters
        viewCount: 0,
        contactClicks: 0,
        shareCount: 0,
        // Verification — auto-verify if TIN is validated or user is admin
        ...(userProfile?.tinValidationStatus === 'valid' || userRole === 'admin' ? {
          verified: true,
          verifiedAt: Timestamp.now(),
          verificationMethod: userProfile?.tinValidationStatus === 'valid' ? 'tin' : 'admin',
        } : {
          verified: false,
        }),
        // Followers
        followers: [],
        followerCount: 0,
      });
      dispatch({ type: 'RESET_CREATE_FORM' });
      // onSnapshot will automatically pick up the new business — no manual refetch needed
    } catch (error) {
      console.error('Error adding business:', error);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to add business. Please try again.' });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, [state.formData, state.formPhotos, state.coverPhotoIndex, user, userProfile, userRole, dispatch]);

  // ── Delete business ──
  const handleDeleteBusiness = useCallback((businessId: string) => {
    dispatch({ type: 'OPEN_DELETE_CONFIRM', payload: businessId });
  }, [dispatch]);

  const confirmDeleteBusiness = useCallback(async () => {
    if (!state.deleteBusinessId) return;
    dispatch({ type: 'SET_SAVING', payload: true });
    try {
      await deleteDoc(doc(db, 'businesses', state.deleteBusinessId));
      dispatch({ type: 'REMOVE_BUSINESS', payload: state.deleteBusinessId });
      dispatch({ type: 'SELECT_BUSINESS', payload: null });
      dispatch({ type: 'SET_TOAST', payload: 'Business deleted successfully.' });
    } catch (error) {
      console.error('Error deleting business:', error);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to delete business. Please try again.' });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
      dispatch({ type: 'CLOSE_DELETE_CONFIRM' });
    }
  }, [state.deleteBusinessId, dispatch]);

  // ── Start editing ──
  const handleStartEdit = useCallback(() => {
    if (!state.selectedBusiness) return;
    dispatch({ type: 'SET_EDIT_DATA', payload: {
      name: state.selectedBusiness.name,
      desc: state.selectedBusiness.desc,
      location: state.selectedBusiness.location,
      phone: state.selectedBusiness.phone || '',
      website: state.selectedBusiness.website || '',
      email: state.selectedBusiness.email || '',
      hours: state.selectedBusiness.hours || '',
      category: state.selectedBusiness.category,
      menu: state.selectedBusiness.menu || '',
      services: state.selectedBusiness.services || '',
      priceRange: state.selectedBusiness.priceRange || '',
      yearEstablished: state.selectedBusiness.yearEstablished || new Date().getFullYear(),
      paymentMethods: state.selectedBusiness.paymentMethods || [],
      deliveryOptions: state.selectedBusiness.deliveryOptions || [],
      specialtyTags: state.selectedBusiness.specialtyTags || [],
    } });
    dispatch({ type: 'SET_EDIT_PHOTOS', payload: state.selectedBusiness.photos || [] });
    dispatch({ type: 'SET_EDIT_COVER_INDEX', payload: state.selectedBusiness.coverPhotoIndex || 0 });
    dispatch({ type: 'SET_IS_EDITING', payload: true });
  }, [state.selectedBusiness, dispatch]);

  // ── Save edit ──
  const handleSaveEdit = useCallback(async () => {
    if (!state.selectedBusiness) return;
    dispatch({ type: 'SET_SAVING', payload: true });
    try {
      const ref = doc(db, 'businesses', state.selectedBusiness.id);
      await updateDoc(ref, {
        name: state.editData.name,
        desc: state.editData.desc,
        location: state.editData.location,
        phone: state.editData.phone,
        website: state.editData.website,
        bookingUrl: state.editData.bookingUrl || '',
        email: state.editData.email,
        hours: state.editData.hours,
        category: state.editData.category,
        menu: state.editData.menu,
        services: state.editData.services,
        priceRange: state.editData.priceRange,
        yearEstablished: state.editData.yearEstablished,
        paymentMethods: state.editData.paymentMethods,
        deliveryOptions: state.editData.deliveryOptions,
        specialtyTags: state.editData.specialtyTags,
        emoji: CATEGORY_EMOJI_MAP[state.editData.category] || state.selectedBusiness.emoji,
        bgColor: CATEGORY_COLORS[state.editData.category] || state.selectedBusiness.bgColor,
        photos: state.editPhotos,
        coverPhotoIndex: Math.min(state.editCoverPhotoIndex, Math.max(state.editPhotos.length - 1, 0)),
      });
      const updated = {
        ...state.selectedBusiness,
        ...state.editData,
        emoji: CATEGORY_EMOJI_MAP[state.editData.category] || state.selectedBusiness.emoji,
        bgColor: CATEGORY_COLORS[state.editData.category] || state.selectedBusiness.bgColor,
        photos: state.editPhotos,
        coverPhotoIndex: Math.min(state.editCoverPhotoIndex, Math.max(state.editPhotos.length - 1, 0)),
      };
      dispatch({ type: 'SELECT_BUSINESS', payload: updated });
      dispatch({ type: 'UPDATE_BUSINESS', payload: updated });
      dispatch({ type: 'SET_IS_EDITING', payload: false });
    } catch (error) {
      console.error('Error updating business:', error);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to update business. Please try again.' });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, [state.selectedBusiness, state.editData, state.editPhotos, state.editCoverPhotoIndex, dispatch]);

  return {
    loadMoreRef,
    fetchBusinesses,
    toggleFavorite,
    handleOpenCreateModal,
    handleAddBusiness,
    handleDeleteBusiness,
    confirmDeleteBusiness,
    handleStartEdit,
    handleSaveEdit,
    PAGE_SIZE,
  };
}
