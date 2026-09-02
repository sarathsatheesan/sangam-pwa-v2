import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { UserProfile } from '../services/auth';
import { ADMIN_EMAILS } from '../constants/config';

export interface UserData extends UserProfile {
  uid: string;
  email: string;
  name: string;
  preferredName?: string;
  avatar: string;
  heritage: string;
  city: string;
  profession: string;
  interests: string[];
  createdAt: Date;
  updatedAt: Date;
  role?: 'business_owner' | 'user';
  phone?: string;
  accountType?: string;
  businessName?: string;
  businessType?: string;
  customBusinessType?: string;
  isRegistered?: boolean;
  tinNumber?: string;
  tinValidationStatus?: 'valid' | 'invalid' | 'not_checked';
  tinValidationDetails?: {
    checkedAt: string;
    message: string;
    confidence: number;
  };
  profitStatus?: 'profit' | 'non-profit';
  adminReviewRequired?: boolean;
  adminApproved?: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserData | null;
  loading: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  isDisabled: boolean;
  userRole: 'admin' | 'business_owner' | 'user';
  setUserProfile: (profile: UserData | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      try {
        setUser(currentUser);

        if (currentUser) {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const bannedDocRef = doc(db, 'bannedUsers', currentUser.uid);
          const disabledDocRef = doc(db, 'disabledUsers', currentUser.uid);
          const appConfigRef = doc(db, 'appConfig', 'settings');

          // ── Load each resource independently so one failure doesn't block others ──

          // 1. Load user profile
          try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const rawProfile = userDocSnap.data() as UserData;

              // SECURITY (C-01, 2026-09-02): email/phone live in the
              // owner/admin-only subdoc users/{uid}/private/profile. Load it and
              // merge in memory so existing consumers keep working unchanged.
              const privRef = doc(db, 'users', currentUser.uid, 'private', 'profile');
              let privData: Record<string, any> = {};
              try {
                const privSnap = await getDoc(privRef);
                if (privSnap.exists()) privData = privSnap.data();
              } catch (_e) { /* non-fatal */ }

              // One-time lazy migration: move email/phone off the
              // world-readable profile doc for accounts created before C-01.
              const toMove: Record<string, any> = {};
              if (rawProfile.email) toMove.email = rawProfile.email;
              if ((rawProfile as any).phone) toMove.phone = (rawProfile as any).phone;
              if (Object.keys(toMove).length > 0) {
                try {
                  await setDoc(privRef, { uid: currentUser.uid, ...toMove, updatedAt: new Date() }, { merge: true });
                  await updateDoc(userDocRef, { email: deleteField(), phone: deleteField() });
                  privData = { ...toMove, ...privData };
                } catch (_e) { /* non-fatal — retried on next sign-in */ }
              }

              const profileData: UserData = {
                ...rawProfile,
                email: (privData.email as string) || rawProfile.email || currentUser.email || '',
                ...(privData.phone ? { phone: privData.phone } : {}),
              } as UserData;
              setUserProfile(profileData);

              // Auto-backfill missing fields (email intentionally excluded —
              // it must not return to the world-readable doc).
              const backfill: Record<string, any> = {};
              if (!profileData.createdAt && currentUser.metadata.creationTime) {
                backfill.createdAt = new Date(currentUser.metadata.creationTime);
              }
              if (!profileData.name && currentUser.displayName) {
                backfill.name = currentUser.displayName;
              }
              if (Object.keys(backfill).length > 0) {
                await setDoc(userDocRef, backfill, { merge: true });
                setUserProfile({ ...profileData, ...backfill });
              }
            } else {
              // Create profile doc if it doesn't exist
              const newProfile: UserData = {
                email: currentUser.email || '',
                uid: currentUser.uid,
                name: currentUser.displayName || '',
                avatar: currentUser.photoURL || '',
                heritage: '',
                city: '',
                profession: '',
                interests: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              // SECURITY (C-01): the public doc gets no email; it goes to the
              // owner/admin-only private subdoc instead.
              await setDoc(userDocRef, { ...newProfile, email: '' });
              try {
                await setDoc(doc(db, 'users', currentUser.uid, 'private', 'profile'), {
                  uid: currentUser.uid,
                  email: currentUser.email || '',
                  updatedAt: new Date(),
                }, { merge: true });
              } catch (_e) { /* non-fatal */ }
              setUserProfile(newProfile);
            }
          } catch (error) {
            console.error('Error loading user profile:', error);
          }

          // 2. Check ban status (independent)
          try {
            const bannedDocSnap = await getDoc(bannedDocRef);
            setIsBanned(bannedDocSnap.exists());
          } catch (error) {
            console.error('Error checking ban status:', error);
            setIsBanned(false);
          }

          // 3. Check disabled status (independent)
          try {
            const disabledDocSnap = await getDoc(disabledDocRef);
            setIsDisabled(disabledDocSnap.exists());
          } catch (error) {
            console.error('Error checking disabled status:', error);
            setIsDisabled(false);
          }

          // 4. Check admin status — ALWAYS falls through to hardcoded check
          let isUserAdmin = false;

          // 4a. Try dynamic admin list from Firestore
          try {
            const appConfigSnap = await getDoc(appConfigRef);
            if (appConfigSnap.exists()) {
              const appConfig = appConfigSnap.data();
              if (
                appConfig.adminEmails &&
                Array.isArray(appConfig.adminEmails) &&
                appConfig.adminEmails.some(
                  (e: string) => e.toLowerCase() === (currentUser.email || '').toLowerCase()
                )
              ) {
                isUserAdmin = true;
              }
            }
          } catch (error) {
            console.error('Error loading appConfig (non-fatal, using hardcoded fallback):', error);
          }

          // 4b. ALWAYS fall back to hardcoded ADMIN_EMAILS
          if (!isUserAdmin) {
            isUserAdmin = ADMIN_EMAILS.some(
              (e) => e.toLowerCase() === (currentUser.email || '').toLowerCase()
            );
          }

          setIsAdmin(isUserAdmin);

          // Admin accounts are always protected — override ban/disable status
          if (isUserAdmin) {
            setIsBanned(false);
            setIsDisabled(false);
          }
        } else {
          setUserProfile(null);
          setIsAdmin(false);
          setIsBanned(false);
          setIsDisabled(false);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        // Even on catastrophic failure, check hardcoded admin
        if (currentUser) {
          const fallbackAdmin = ADMIN_EMAILS.some(
            (e) => e.toLowerCase() === (currentUser.email || '').toLowerCase()
          );
          setIsAdmin(fallbackAdmin);
        } else {
          setIsAdmin(false);
        }
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const userRole: 'admin' | 'business_owner' | 'user' = isAdmin
    ? 'admin'
    : (userProfile?.role === 'business_owner' || userProfile?.accountType === 'business')
    ? 'business_owner'
    : 'user';

  const value = useMemo<AuthContextType>(() => ({
    user,
    userProfile,
    loading,
    isAdmin,
    isBanned,
    isDisabled,
    userRole,
    setUserProfile,
  }), [user, userProfile, loading, isAdmin, isBanned, isDisabled, userRole, setUserProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use auth context
 * Must be used within AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
