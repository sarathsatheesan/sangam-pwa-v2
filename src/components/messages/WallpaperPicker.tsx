import React, { useEffect } from 'react';
import { WALLPAPER_PRESETS } from '@/constants/messages';

/**
 * WallpaperPicker Component
 * Modal for selecting chat wallpaper from presets
 */
export function WallpaperPicker({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (preset: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose} onTouchStart={onClose} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div
        className="bg-white dark:bg-[var(--aurora-surface)] rounded-lg p-4 sm:p-6 max-w-[90vw] sm:max-w-md"
        onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">Chat Wallpaper</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(WALLPAPER_PRESETS).map(([key, { label, description, style }]) => (
            <button
              key={key}
              onClick={() => {
                onSelect(key);
                onClose();
              }}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center ${
                current === key ? 'border-aurora-indigo' : 'border-[var(--aurora-border)]'
              }`}
              style={style}
              title={description}
            >
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
