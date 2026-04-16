import React, { useState, useEffect, useMemo } from 'react';
import { EMOJI_CATEGORIES } from '@/constants/messages';

/**
 * EmojiPicker Component
 * Modal emoji picker with search, category tabs, and grid view
 */
export function EmojiPicker({ onSelect, onClose, recentEmojis }: { onSelect: (emoji: string) => void; onClose: () => void; recentEmojis: string[] }) {
  const [activeCategory, setActiveCategory] = useState<string>(recentEmojis.length > 0 ? 'Recent' : 'Smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const categories = Object.keys(EMOJI_CATEGORIES);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const allEmojis = useMemo(() => {
    return Object.values(EMOJI_CATEGORIES).flat();
  }, []);

  const displayEmojis = searchQuery
    ? allEmojis.filter(() => true)
    : activeCategory === 'Recent'
    ? recentEmojis
    : EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES] || [];

  const categoryIcons: Record<string, string> = {
    'Recent': '🕒', 'Smileys': '😀', 'Gestures': '👋', 'People': '👤', 'Hearts': '❤️',
    'Animals': '🐶', 'Food': '🍕', 'Activities': '⚽', 'Travel': '✈️', 'Objects': '💡', 'Symbols': '💠', 'Flags': '🏳️',
  };

  return (
    <>
    {/* Invisible backdrop — onClick for desktop, onTouchStart for iOS Safari/mobile */}
    <div className="fixed inset-0 z-30" onClick={onClose} onTouchStart={onClose} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} />
    <div className="absolute bottom-16 left-0 w-[calc(100vw-2rem)] sm:w-80 max-h-[360px] bg-white dark:bg-[var(--aurora-surface)] rounded-lg shadow-lg border border-[var(--aurora-border)] z-40 flex flex-col overflow-hidden">
      {/* Search */}
      <div className="px-2 pt-2">
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--aurora-border)] bg-[var(--aurora-input)] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-muted)] focus:outline-none focus:ring-1 focus:ring-aurora-indigo/40"
        />
      </div>
      {/* Category tabs */}
      {!searchQuery && (
        <div className="flex items-center gap-1 px-2 pt-2 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-8 gap-0.5">
        {displayEmojis.length > 0 ? displayEmojis.map((emoji, idx) => (
          <button
            key={idx}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-9 h-9 flex items-center justify-center text-xl hover:scale-110 hover:bg-[var(--aurora-input)] rounded transition"
          >
            {emoji}
          </button>
        )) : (
          <div className="col-span-8 py-4 text-center text-sm text-[var(--aurora-text-muted)]">
            {activeCategory === 'Recent' ? 'No recent emojis yet' : 'No emojis found'}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
