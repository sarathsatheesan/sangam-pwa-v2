import { useState, useEffect, useCallback } from 'react';
import { WALLPAPER_PRESETS } from '@/constants/messages';

/**
 * Chat appearance domain (Session 57 — messages.tsx decomposition tranche 5,
 * domain 5 of docs/messages-state-decomposition-plan.md).
 *
 * Owns wallpaper selection (localStorage-persisted, same 'selectedWallpaper'
 * key + WALLPAPER_PRESETS validation the page used), the picker's open state,
 * and compact/comfortable density.
 *
 * PARITY NOTE: compactMode is intentionally NOT persisted here — matching the
 * page's prior behavior exactly (it reset to false on every mount). Persisting
 * it is a reasonable future enhancement but would be a behavior change, so it's
 * left out of this mechanical extraction.
 */
export function useChatAppearance() {
  const [selectedWallpaper, setSelectedWallpaperState] = useState<string>('default');
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  // Load persisted wallpaper on mount (same guard the page used).
  useEffect(() => {
    const saved = localStorage.getItem('selectedWallpaper');
    if (saved && saved in WALLPAPER_PRESETS) {
      setSelectedWallpaperState(saved);
    }
  }, []);

  /** Select + persist in one call (page previously did both inline). */
  const selectWallpaper = useCallback((preset: string) => {
    setSelectedWallpaperState(preset);
    localStorage.setItem('selectedWallpaper', preset);
  }, []);

  const openWallpaperPicker = useCallback(() => setWallpaperPickerOpen(true), []);
  const closeWallpaperPicker = useCallback(() => setWallpaperPickerOpen(false), []);
  const toggleCompactMode = useCallback(() => setCompactMode((c) => !c), []);

  return {
    selectedWallpaper,
    selectWallpaper,
    wallpaperPickerOpen,
    openWallpaperPicker,
    closeWallpaperPicker,
    compactMode,
    toggleCompactMode,
  };
}
