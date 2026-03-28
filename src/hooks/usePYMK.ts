import { useState, useMemo } from 'react';

// Interfaces
export interface User {
  id: string;
  name: string;
  avatar: string;
  heritage: string | string[];
  city: string;
  profession: string;
  bio: string;
  interests: string[];
  email?: string;
  phone?: string;
  showLocation?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  updatedAt?: any;
  createdAt?: any;
}

export interface ConnectionDetail {
  status: 'pending' | 'connected';
  initiatedBy: string;
  connectedAt?: any;
  createdAt?: any;
}

export interface PYMKGroups {
  sameCity: User[];
  sameHeritage: User[];
  similarInterests: User[];
}

export const PYMK_PREVIEW = 6; // Show first 6 in carousel, expand for more

interface UsePYMKOptions {
  people: User[];
  connections: Map<string, 'pending' | 'connected'>;
  connectionDetails: Map<string, ConnectionDetail>;
  userProfile: any;
  activeTab: string;
  userId: string | undefined;
}

interface UsePYMKReturn {
  pymkGroups: PYMKGroups;
  expandedPymk: Record<string, boolean>;
  setExpandedPymk: (state: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  PYMK_PREVIEW: number;
}

/**
 * usePYMK Hook
 *
 * Extracts and manages "People You May Know" (PYMK) groups based on:
 * - Same city
 * - Same heritage
 * - Similar interests (>= 2 shared)
 *
 * Includes state management for expanded/collapsed PYMK carousels.
 */
export function usePYMK({
  people,
  connections,
  connectionDetails,
  userProfile,
  activeTab,
  userId,
}: UsePYMKOptions): UsePYMKReturn {
  const [expandedPymk, setExpandedPymk] = useState<Record<string, boolean>>({});

  // #2.9: PYMK Groups — single-pass optimization (was 3 separate filter passes)
  const pymkGroups = useMemo(() => {
    if (activeTab !== 'discover' || !userProfile)
      return { sameCity: [], sameHeritage: [], similarInterests: [] };

    const userCity = (userProfile.city || '').toLowerCase();
    const userHeritage = (Array.isArray(userProfile.heritage)
      ? userProfile.heritage
      : [userProfile.heritage].filter(Boolean)
    ).map((h: string) => h.toLowerCase());
    const userInterestsSet = new Set<string>(userProfile.interests || []);

    const sameCity: User[] = [];
    const sameHeritage: User[] = [];
    const similarInterests: User[] = [];

    // Single pass: classify each discoverable person into PYMK groups
    for (const p of people) {
      const status = connections.get(p.id);
      // Discoverable: not connected, or pending sent by me
      if (status === 'connected') continue;
      if (status === 'pending' && connectionDetails.get(p.id)?.initiatedBy !== userId) continue;

      // City match (#3.5: raised cap from 10 to 30 for View All)
      if (sameCity.length < 30 && p.city && userCity && p.city.toLowerCase() === userCity) {
        sameCity.push(p);
      }
      // Heritage match
      if (sameHeritage.length < 30) {
        const pH = (Array.isArray(p.heritage) ? p.heritage : [p.heritage]).filter(Boolean);
        if (pH.some((h: string) => userHeritage.includes(h.toLowerCase()))) {
          sameHeritage.push(p);
        }
      }
      // Shared interests (>= 2)
      if (similarInterests.length < 30) {
        let shared = 0;
        for (const i of (p.interests || [])) {
          if (userInterestsSet.has(i)) shared++;
          if (shared >= 2) { similarInterests.push(p); break; }
        }
      }
    }

    return { sameCity, sameHeritage, similarInterests };
  }, [people, connections, connectionDetails, userProfile, activeTab, userId]);

  return {
    pymkGroups,
    expandedPymk,
    setExpandedPymk,
    PYMK_PREVIEW,
  };
}
