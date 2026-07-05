import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, X, Search as SearchIcon } from 'lucide-react';
import type { Message } from '@/types/messages';

/**
 * MessageSearchBar Component
 * Search input with navigation through results
 */
export function MessageSearchBar({
  messages,
  onNavigate,
  onClose,
  onQueryChange,
}: {
  messages: Message[];
  onNavigate: (index: number) => void;
  onClose: () => void;
  /**
   * Session 56: reports the live query upward so the page can highlight
   * matching bubbles (the highlight had been dead since Session 33 — the
   * page's query state was never wired to this component's internal one).
   */
  onQueryChange?: (query: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return messages.filter((m) => m.text.toLowerCase().includes(query.toLowerCase()));
  }, [messages, query]);

  // Session 56: navigation is now EXPLICIT (▲▼ buttons / Enter key) instead
  // of an effect that fired on every keystroke — the old auto-scroll made the
  // screen jump up/down while typing (user-reported on iPad).
  const navigateToMatch = (matchIdx: number) => {
    const target = matches[matchIdx];
    if (!target) return;
    const idx = messages.findIndex((m) => m.id === target.id);
    onNavigate(idx);
  };

  return (
    <div className="flex items-center gap-2 p-3 border-b border-[var(--aurora-border)] bg-[var(--aurora-surface)]">
      <SearchIcon size={18} className="text-aurora-text" />
      <input
        autoFocus
        type="text"
        placeholder="Search messages..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setCurrentMatch(0);
          onQueryChange?.(e.target.value);
        }}
        onKeyDown={(e) => {
          // Enter (mobile keyboard "Go") = deliberate single jump to the
          // current match — typing itself never scrolls.
          if (e.key === 'Enter' && matches.length > 0) {
            e.preventDefault();
            navigateToMatch(currentMatch);
          }
        }}
        className="flex-1 bg-transparent text-base outline-none"
      />
      {matches.length > 0 && (
        <span className="text-xs text-aurora-text/70">
          {currentMatch + 1} / {matches.length}
        </span>
      )}
      {matches.length > 1 && (
        <>
          <button
            onClick={() => {
              const next = currentMatch > 0 ? currentMatch - 1 : matches.length - 1;
              setCurrentMatch(next);
              navigateToMatch(next);
            }}
            className="p-2 hover:bg-[var(--aurora-input)] rounded"
            aria-label="Previous search result"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => {
              const next = currentMatch < matches.length - 1 ? currentMatch + 1 : 0;
              setCurrentMatch(next);
              navigateToMatch(next);
            }}
            className="p-2 hover:bg-[var(--aurora-input)] rounded"
            aria-label="Next search result"
          >
            <ChevronDown size={16} />
          </button>
        </>
      )}
      <button onClick={onClose} className="p-2 hover:bg-[var(--aurora-input)] rounded" aria-label="Close search">
        <X size={16} />
      </button>
    </div>
  );
}
