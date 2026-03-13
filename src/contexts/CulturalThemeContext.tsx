import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { resolveThemeForUser } from '../constants/culturalThemes';
import type { CulturalTheme } from '../constants/culturalThemes';

interface CulturalThemeContextType {
  theme: CulturalTheme;
  isNeutral: boolean;
}

const CulturalThemeContext = createContext<CulturalThemeContextType | undefined>(undefined);

export const CulturalThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();

  const value = useMemo(() => {
    const theme = resolveThemeForUser(userProfile?.heritage);
    return {
      theme,
      isNeutral: theme.id === 'neutral',
    };
  }, [userProfile?.heritage]);

  return (
    <CulturalThemeContext.Provider value={value}>
      {children}
    </CulturalThemeContext.Provider>
  );
};

/**
 * Hook to access the current cultural theme.
 * Can be used outside the provider (returns neutral defaults).
 */
export const useCulturalTheme = (): CulturalThemeContextType => {
  const context = useContext(CulturalThemeContext);
  if (!context) {
    // Graceful fallback — return neutral theme if used outside provider
    const neutralTheme = resolveThemeForUser(null);
    return { theme: neutralTheme, isNeutral: true };
  }
  return context;
};
