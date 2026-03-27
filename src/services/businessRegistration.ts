// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS REGISTRATION SERVICE
// Handles Firestore writes, Storage uploads, and draft management
// for the 5-step business sign-up wizard.
// ═════════════════════════════════════════════════════════════════════════════════

import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from './firebase';
import type { BusinessFormData } from '../reducers/businessReducer';

// ── Types ──

export interface RegistrationSubmission {
  formData: Partial<BusinessFormData>;
  photos: string[];          // base64 data URLs
  coverPhotoIndex: number;
  userId: string;
  userName: string;
  userEmail: string;
  adminReviewRequired: boolean;
}

export interface RegistrationResult {
  success: boolean;
  businessId?: string;
  error?: string;
}

// ── Photo upload helper ──

async function uploadPhoto(
  dataUrl: string,
  businessId: string,
  index: number,
): Promise<string> {
  if (!storage) throw new Error('Firebase Storage is not configured');

  // Convert base64 data URL to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  const path = `businesses/${businessId}/photos/${index}.${ext}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, blob, {
    contentType: blob.type,
    customMetadata: { uploadedAt: new Date().toISOString() },
  });

  return getDownloadURL(storageRef);
}

// ── Verification document upload helper ──

async function uploadVerificationDoc(
  file: File,
  businessId: string,
  index: number,
): Promise<{ url: string; name: string; type: string; uploadedAt: any }> {
  if (!storage) throw new Error('Firebase Storage is not configured');

  const path = `businesses/${businessId}/verification/${index}_${file.name}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: { originalName: file.name },
  });

  const url = await getDownloadURL(storageRef);
  return {
    url,
    name: file.name,
    type: file.type,
    uploadedAt: serverTimestamp(),
  };
}

// ── Main registration submit ──

export async function submitBusinessRegistration(
  submission: RegistrationSubmission,
): Promise<RegistrationResult> {
  const { formData, photos, coverPhotoIndex, userId, userName, userEmail, adminReviewRequired } = submission;

  try {
    // 1. Create the business document first (to get an ID for file paths)
    const businessData: Record<string, any> = {
      // Core fields (match existing Business interface)
      name: formData.name || '',
      category: formData.category || '',
      desc: formData.desc || '',
      location: formData.location || '',
      phone: formData.phone || '',
      website: formData.website || '',
      email: formData.email || '',
      hours: formData.hours || '',
      menu: formData.menu || '',
      services: formData.services || '',
      priceRange: formData.priceRange || '',
      yearEstablished: formData.yearEstablished || new Date().getFullYear(),
      paymentMethods: [],
      deliveryOptions: [],
      specialtyTags: [],
      emoji: '',
      rating: 0,
      reviews: 0,
      promoted: false,
      bgColor: '#f0f4ff',
      ownerId: userId,
      ownerName: userName,
      ownerEmail: userEmail,
      createdAt: serverTimestamp(),

      // Geolocation
      latitude: typeof formData.latitude === 'number' ? formData.latitude : null,
      longitude: typeof formData.longitude === 'number' ? formData.longitude : null,

      // Sign-up specific fields
      country: formData.country || 'US',
      placeId: formData.placeId || null,
      addressComponents: formData.addressComponents || null,
      stateOfIncorp: formData.stateOfIncorp || null,

      // TIN (stored but will be encrypted at rest by Firestore)
      tin: formData.tin || null,
      tinType: formData.tinType || null,
      tinVerified: false,

      // KYC / Registration status
      kycStatus: adminReviewRequired ? 'pending' : 'approved',
      registrationStatus: adminReviewRequired ? 'submitted' : 'approved',
      verified: !adminReviewRequired,
      verifiedAt: adminReviewRequired ? null : serverTimestamp(),
      verificationMethod: adminReviewRequired ? null : 'self',

      // Beneficial owners
      beneficialOwners: formData.beneficialOwners || [],

      // Photos placeholder (will be updated after upload)
      photos: [],
      coverPhotoIndex: 0,

      // Analytics init
      viewCount: 0,
      contactClicks: 0,
      shareCount: 0,
      followerCount: 0,
      followers: [],
    };

    const docRef = await addDoc(collection(db, 'businesses'), businessData);
    const businessId = docRef.id;

    // 2. Upload photos to Storage (parallel)
    let uploadedPhotoUrls: string[] = [];
    if (photos.length > 0 && storage) {
      const uploadPromises = photos.map((dataUrl, i) =>
        uploadPhoto(dataUrl, businessId, i).catch((err) => {
          console.warn(`Failed to upload photo ${i}:`, err);
          return null;
        }),
      );
      const results = await Promise.all(uploadPromises);
      uploadedPhotoUrls = results.filter((url): url is string => url !== null);
    }

    // 3. Upload verification documents (parallel)
    let uploadedDocs: any[] = [];
    const verificationFiles = (formData.verificationDocs as File[] | undefined) || [];
    if (verificationFiles.length > 0 && storage) {
      const docPromises = verificationFiles.map((file, i) =>
        uploadVerificationDoc(file, businessId, i).catch((err) => {
          console.warn(`Failed to upload doc ${i}:`, err);
          return null;
        }),
      );
      const results = await Promise.all(docPromises);
      uploadedDocs = results.filter((d) => d !== null);
    }

    // 4. Update business document with uploaded file URLs
    if (uploadedPhotoUrls.length > 0 || uploadedDocs.length > 0) {
      const updates: Record<string, any> = {};
      if (uploadedPhotoUrls.length > 0) {
        updates.photos = uploadedPhotoUrls;
        updates.coverPhotoIndex = Math.min(coverPhotoIndex, uploadedPhotoUrls.length - 1);
      }
      if (uploadedDocs.length > 0) {
        updates.verificationDocs = uploadedDocs;
      }
      await updateDoc(docRef, updates);
    }

    // 5. Clean up any draft for this user
    await deleteDraft(userId).catch(() => {});

    return { success: true, businessId };
  } catch (error: any) {
    console.error('Business registration failed:', error);
    return { success: false, error: error.message || 'Registration failed' };
  }
}

// ═════════════════════════════════════════════════════════════════════════════════
// DRAFT AUTO-SAVE
// Saves wizard progress to Firestore so users can resume later.
// One draft per user, stored in `businessSignupDrafts/{userId}`.
// ═════════════════════════════════════════════════════════════════════════════════

export async function saveDraft(
  userId: string,
  currentStep: number,
  completedSteps: number[],
  formData: Partial<BusinessFormData>,
): Promise<void> {
  // Strip File objects before saving (Firestore can't store them)
  const cleanedData = { ...formData };
  delete (cleanedData as any).verificationDocs;

  const draftRef = doc(db, 'businessSignupDrafts', userId);
  await setDoc(draftRef, {
    currentStep,
    completedSteps,
    formData: cleanedData,
    lastSavedAt: serverTimestamp(),
    userId,
  }, { merge: true });
}

export async function loadDraft(
  userId: string,
): Promise<{
  currentStep: number;
  completedSteps: number[];
  formData: Partial<BusinessFormData>;
} | null> {
  const draftRef = doc(db, 'businessSignupDrafts', userId);
  const snap = await getDoc(draftRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    currentStep: data.currentStep || 1,
    completedSteps: data.completedSteps || [],
    formData: data.formData || {},
  };
}

export async function deleteDraft(userId: string): Promise<void> {
  const draftRef = doc(db, 'businessSignupDrafts', userId);
  await deleteDoc(draftRef);
}

// ═════════════════════════════════════════════════════════════════════════════════
// ADMIN REVIEW QUEUE
// Fetches businesses pending admin review.
// ═════════════════════════════════════════════════════════════════════════════════

export interface PendingBusiness {
  id: string;
  name: string;
  category: string;
  email: string;
  phone: string;
  country: string;
  ownerName: string;
  kycStatus: string;
  registrationStatus: string;
  createdAt: any;
  tin?: string;
  verificationDocs?: any[];
}

export async function fetchPendingRegistrations(): Promise<PendingBusiness[]> {
  const q = query(
    collection(db, 'businesses'),
    where('registrationStatus', '==', 'submitted'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as PendingBusiness[];
}

export async function approveRegistration(businessId: string): Promise<void> {
  const bizRef = doc(db, 'businesses', businessId);
  await updateDoc(bizRef, {
    registrationStatus: 'approved',
    kycStatus: 'approved',
    verified: true,
    verifiedAt: serverTimestamp(),
    verificationMethod: 'admin',
  });
}

export async function rejectRegistration(businessId: string, reason: string): Promise<void> {
  const bizRef = doc(db, 'businesses', businessId);
  await updateDoc(bizRef, {
    registrationStatus: 'rejected',
    kycStatus: 'rejected',
    kycRejectionReason: reason,
  });
}
