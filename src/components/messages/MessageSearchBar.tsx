import React, { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    if (matches.length > 0) {
      const idx = messages.findIndex((m) => m.id === matches[currentMatch]?.id);
      onNavigate(idx);
    }
  }, [currentMatch, matches, messages, onNavigate]);

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
            onClick={() => setCurrentMatch((i) => (i > 0 ? i - 1 : matches.length - 1))}
            className="p-2 hover:bg-[var(--aurora-input)] rounded"
            aria-label="Previous search result"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => setCurrentMatch((i) => (i < matches.length - 1 ? i + 1 : 0))}
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
