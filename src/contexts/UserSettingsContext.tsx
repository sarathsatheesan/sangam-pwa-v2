import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────
export interface UserSettings {
  notifications: {
    pushEnabled: boolean;
    emailDigest: boolean;
    newMessages: boolean;
    newFollowers: boolean;
    eventReminders: boolean;
    communityUpdates: boolean;
    marketingEmails: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'community' | 'private';
    showEmail: boolean;
    showPhone: boolean;
    showLocation: boolean;
    messagingAllowed: 'everyone' | 'community' | 'nobody';
    activityStatus: boolean;
    searchable: boolean;
  };
  language: {
    appLanguage: string;
    contentLanguages: string[];
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    compactMode: boolean;
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  notifications: {
    pushEnabled: true,
    emailDigest: true,
    newMessages: true,
    newFollowers: true,
    eventReminders: true,
    communityUpdates: true,
    marketingEmails: false,
  },
  privacy: {
    profileVisibility: 'community',
    showEmail: false,
    showPhone: false,
    showLocation: true,
    messagingAllowed: 'community',
    activityStatus: true,
    searchable: true,
  },
  language: {
    appLanguage: 'en',
    contentLanguages: ['en'],
  },
  appearance: {
    theme: 'light',
    fontSize: 'medium',
    compactMode: false,
  },
};

interface UserSettingsContextType {
  settings: UserSettings;
  loading: boolean;
  updateSetting: <K extends keyof UserSettings>(
    category: K,
    key: keyof UserSettings[K],
    value: UserSettings[K][keyof UserSettings[K]]
  ) => void;
  saveSettings: (newSettings: UserSettings) => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  updateSetting: () => {},
  saveSettings: async () => {},
});

export const useUserSettings = () => useContext(UserSettingsContext);

// ─── Provider ──────────────────────────────────────────────────────────────
export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Load settings from Firestore on auth change & listen for real-time updates
  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'userSettings', user.uid);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<UserSettings>;
        setSettings((prev) => ({
          notifications: { ...prev.notifications, ...data.notifications },
          privacy: { ...prev.privacy, ...data.privacy },
          language: { ...prev.language, ...data.language },
          appearance: { ...prev.appearance, ...data.appearance },
        }));
      }
      setLoading(false);
    }, () => {
      // Error — fallback to defaults
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Apply appearance settings globally
  useEffect(() => {
    const root = document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#1A1B2E');
      } else {
        root.classList.remove('dark');
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#F5F6FA');
      }
    };

    // Theme
    if (settings.appearance.theme === 'dark') {
      applyTheme(true);
    } else if (settings.appearance.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      // Listen for system preference changes in real-time
      const handleSystemChange = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    } else {
      applyTheme(false);
    }

    // Font size
    const sizeMap = { small: '14px', medium: '16px', large: '18px' };
    root.style.fontSize = sizeMap[settings.appearance.fontSize];
  }, [settings.appearance.theme, settings.appearance.fontSize]);

  // Save to Firestore
  const saveSettings = useCallback(async (newSettings: UserSettings) => {
    if (!user) return;
    try {
      const ref = doc(db, 'userSettings', user.uid);
      await setDoc(ref, newSettings, { merge: true });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, [user]);

  // Update a single nested setting and auto-save
  const updateSetting = useCallback(<K extends keyof UserSettings>(
    category: K,
    key: keyof UserSettings[K],
    value: UserSettings[K][keyof UserSettings[K]]
  ) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        [category]: { ...prev[category], [key]: value },
      };
      saveSettings(updated);
      return updated;
    });
  }, [saveSettings]);

  const value = useMemo(() => ({ settings, loading, updateSetting, saveSettings }), [settings, loading, updateSetting, saveSettings]);

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
};
