import { useState, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { WALLPAPER_PRESETS } from '@/constants/messages';

/**
 * Chat appearance domain (Session 57 — messages.tsx decomposition tranche 5,
 * domain 5 of docs/messages-state-decomposition-plan.md; wallpaper feature
 * expanded the same session).
 *
 * Wallpaper now supports three kinds — a built-in preset, a solid color, or a
 * custom photo (base64). Stored as JSON under `chatWallpaper`, with a fallback
 * read of the legacy `selectedWallpaper` string key so existing users keep
 * their preset. Global (one wallpaper for all chats), matching prior behavior.
 *
 * PARITY NOTE: compactMode is intentionally NOT persisted (resets each mount,
 * exactly as before). Persisting it is a reasonable future enhancement.
 */

export type Wallpaper =
  | { type: 'preset'; value: string }
  | { type: 'color'; value: string }
  | { type: 'image'; value: string };

const STORAGE_KEY = 'chatWallpaper';
const LEGACY_KEY = 'selectedWallpaper';
const DEFAULT_WALLPAPER: Wallpaper = { type: 'preset', value: 'default' };

function loadWallpaper(): Wallpaper {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Wallpaper;
      if (parsed && (parsed.type === 'preset' || parsed.type === 'color' || parsed.type === 'image') && typeof parsed.value === 'string') {
        // A preset key that no longer exists falls back to default.
        if (parsed.type === 'preset' && !(parsed.value in WALLPAPER_PRESETS)) return DEFAULT_WALLPAPER;
        return parsed;
      }
    }
    // Legacy: a bare preset key string.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy && legacy in WALLPAPER_PRESETS) return { type: 'preset', value: legacy };
  } catch {
    /* corrupt storage — fall through to default */
  }
  return DEFAULT_WALLPAPER;
}

/** Compute the ready-to-spread background style for a wallpaper. */
export function wallpaperToStyle(wp: Wallpaper): CSSProperties {
  if (wp.type === 'color') return { backgroundColor: wp.value };
  if (wp.type === 'image') {
    return {
      // Scrim layer over the photo keeps message bubbles readable.
      backgroundImage: `linear-gradient(var(--msg-scrim), var(--msg-scrim)), url("${wp.value}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  return (WALLPAPER_PRESETS[wp.value as keyof typeof WALLPAPER_PRESETS]?.style as CSSProperties) || {};
}

export function useChatAppearance() {
  const [wallpaper, setWallpaper] = useState<Wallpaper>(DEFAULT_WALLPAPER);
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    setWallpaper(loadWallpaper());
  }, []);

  const persist = useCallback((wp: Wallpaper): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wp));
      // Keep the legacy key roughly in sync for any old readers.
      if (wp.type === 'preset') localStorage.setItem(LEGACY_KEY, wp.value);
      setWallpaper(wp);
      return true;
    } catch {
      // Quota exceeded (custom images are the usual culprit).
      return false;
    }
  }, []);

  const selectPreset = useCallback((key: string) => persist({ type: 'preset', value: key }), [persist]);
  const selectColor = useCallback((hex: string) => persist({ type: 'color', value: hex }), [persist]);
  /** Returns false if the image couldn't be saved (storage quota). */
  const selectImage = useCallback((dataUrl: string) => persist({ type: 'image', value: dataUrl }), [persist]);
  const resetWallpaper = useCallback(() => persist(DEFAULT_WALLPAPER), [persist]);

  const wallpaperStyle = useMemo(() => wallpaperToStyle(wallpaper), [wallpaper]);

  const openWallpaperPicker = useCallback(() => setWallpaperPickerOpen(true), []);
  const closeWallpaperPicker = useCallback(() => setWallpaperPickerOpen(false), []);
  const toggleCompactMode = useCallback(() => setCompactMode((c) => !c), []);

  return {
    wallpaper,
    wallpaperStyle,
    selectPreset,
    selectColor,
    selectImage,
    resetWallpaper,
    wallpaperPickerOpen,
    openWallpaperPicker,
    closeWallpaperPicker,
    compactMode,
    toggleCompactMode,
  };
}
