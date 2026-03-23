// ═════════════════════════════════════════════════════════════════════════════════
// useBusinessData — Encapsulates Firestore CRUD, pagination, and favorites
// Phase 2 Step 3: Extract from business.tsx
// ═════════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
  Timestamp, query, limit, orderBy, startAfter,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { toggleSavedItem, getLocalSavedIds } from '@/services/savedItems';
import { CATEGORY_EMOJI_MAP, CATEGORY_COLORS } from '@/components/business/businessConstants';
import { validateBusinessForm } from '@/components/business/businessValidation';
import type { BusinessState, BusinessAction, Business, BusinessFormData } from '@/reducers/businessReducer';

const PAGE_SIZE = 20;

export function useBusinessData(
  state: BusinessState,
  dispatch: React.Dispatch<BusinessAction>,
  user: any,
  userRole: string | undefined,
  userProfile: any,
) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // ── Fetch businesses (paginated) ──
  const fetchBusinesses = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) dispatch({ type: 'SET_LOADING_MORE', payload: true }); else dispatch({ type: 'SET_LOADING', payload: true });

      let q = query(
        collection(db, 'businesses'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      );
      if (isLoadMore && state.lastDoc) {
        q = query(
          collection(db, 'businesses'),
          orderBy('createdAt', 'desc'),
          startAfter(state.lastDoc),
          limit(PAGE_SIZE),
        );
      }

      const snapshot = await getDocs(q);
      const data: Business[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.isHidden) return;
        data.push({
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
        });
      });

      if (snapshot.docs.length < PAGE_SIZE) {
        dispatch({ type: 'SET_HAS_MORE', payload: false });
      }
      if (snapshot.docs.length > 0) {
        dispatch({ type: 'SET_LAST_DOC', payload: snapshot.docs[snapshot.docs.length - 1] });
      }

      if (isLoadMore) {
        dispatch({ type: 'APPEND_BUSINESSES', payload: data });
      } else {
        dispatch({ type: 'SET_BUSINESSES', payload: data });
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to load businesses. Please try again.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_LOADING_MORE', payload: false });
    }
  }, [state.lastDoc, dispatch]);

  // ── Initial fetch ──
  useEffect(() => {
    fetchBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Infinite scroll observer ──
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && state.hasMore && !state.loadingMore && !state.loading) {
          fetchBusinesses(true);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [state.hasMore, state.loadingMore, state.loading, state.lastDoc, fetchBusinesses]);

  // ── Load favorites from localStorage cache ──
  useEffect(() => {
    dispatch({ type: 'SET_FAVORITES', payload: new Set(getLocalSavedIds('businesses')) });
  }, [dispatch]);

  // ── Toggle favorite ──
  const toggleFavorite = useCallback((businessId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid) return;
    toggleSavedItem(user.uid, 'businesses', businessId).then(({ ids }) => dispatch({ type: 'SET_FAVORITES', payload: ids }));
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
      });
      dispatch({ type: 'RESET_CREATE_FORM' });
      dispatch({ type: 'SET_LAST_DOC', payload: null });
      dispatch({ type: 'SET_HAS_MORE', payload: true });
      await fetchBusinesses();
    } catch (error) {
      console.error('Error adding business:', error);
      dispatch({ type: 'SET_TOAST', payload: 'Failed to add business. Please try again.' });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, [state.formData, state.formPhotos, state.coverPhotoIndex, user, userProfile, dispatch, fetchBusinesses]);

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
