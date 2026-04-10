// ═════════════════════════════════════════════════════════════════════════════════
// BUSINESS SWITCHER CONTEXT
// Manages multi-business ownership — fetches all businesses owned by the current
// user, tracks the selected business, and persists the last-selected business ID
// in localStorage for cross-session continuity.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';

// Minimal business shape needed by the switcher — full Business type lives in businessReducer
export interface OwnedBusiness {
  id: string;
  name: string;
  emoji: string;
  category: string;
  heritage?: string | string[];
  rating: number;
  registrationStatus?: string;
  coverPhotoIndex?: number;
  photos?: string[];
}

interface BusinessSwitcherContextType {
  /** All approved businesses owned by the current user */
  businesses: OwnedBusiness[];
  /** Currently selected business (null while loading or if user owns none) */
  selectedBusiness: OwnedBusiness | null;
  /** Switch to a different business by ID */
  selectBusiness: (businessId: string) => void;
  /** True while the initial Firestore query is in-flight */
  loading: boolean;
  /** Whether the user owns more than one business */
  isMultiBusiness: boolean;
}

const BusinessSwitcherContext = createContext<BusinessSwitcherContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'ethniCity_selected_business_';

export const BusinessSwitcherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<OwnedBusiness[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Real-time listener for user's approved businesses ──
  useEffect(() => {
    if (!user?.uid) {
      setBusinesses([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Fetch ALL businesses owned by the user (not just approved) so legacy
    // businesses without registrationStatus still appear in the switcher.
    // The UI can badge non-approved ones if needed.
    const q = query(
      collection(db, 'businesses'),
      where('ownerId', '==', user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const owned: OwnedBusiness[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: d.name || '',
            emoji: d.emoji || '',
            category: d.category || '',
            heritage: d.heritage,
            rating: d.rating || 0,
            registrationStatus: d.registrationStatus,
            coverPhotoIndex: d.coverPhotoIndex,
            photos: d.photos,
          };
        });
        // Sort alphabetically for consistent ordering
        owned.sort((a, b) => a.name.localeCompare(b.name, 'en-US'));
        setBusinesses(owned);

        // Auto-select: restore from localStorage, or default to first
        const storageKey = STORAGE_KEY_PREFIX + user.uid;
        const savedId = localStorage.getItem(storageKey);
        if (savedId && owned.some((b) => b.id === savedId)) {
          setSelectedId(savedId);
        } else if (owned.length > 0) {
          setSelectedId(owned[0].id);
          try { localStorage.setItem(storageKey, owned[0].id); } catch {}
        } else {
          setSelectedId(null);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('BusinessSwitcher: failed to load businesses', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // ── Select a business by ID ──
  const selectBusiness = useCallback(
    (businessId: string) => {
      if (!businesses.some((b) => b.id === businessId)) return;
      setSelectedId(businessId);
      if (user?.uid) {
        try { localStorage.setItem(STORAGE_KEY_PREFIX + user.uid, businessId); } catch {}
      }
    },
    [businesses, user?.uid],
  );

  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.id === selectedId) || null,
    [businesses, selectedId],
  );

  const isMultiBusiness = businesses.length > 1;

  const value = useMemo<BusinessSwitcherContextType>(
    () => ({ businesses, selectedBusiness, selectBusiness, loading, isMultiBusiness }),
    [businesses, selectedBusiness, selectBusiness, loading, isMultiBusiness],
  );

  return (
    <BusinessSwitcherContext.Provider value={value}>
      {children}
    </BusinessSwitcherContext.Provider>
  );
};

export function useBusinessSwitcher(): BusinessSwitcherContextType {
  const ctx = useContext(BusinessSwitcherContext);
  if (!ctx) throw new Error('useBusinessSwitcher must be used within BusinessSwitcherProvider');
  return ctx;
}
