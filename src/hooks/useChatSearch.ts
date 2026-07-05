import { useState, useCallback } from 'react';

/**
 * Chat search domain (Session 56 — messages.tsx decomposition tranche 4,
 * domain 4 of docs/messages-state-decomposition-plan.md).
 *
 * History: the page declared chatSearch/chatSearchQuery/chatSearchIndex, but
 * when MessageSearchBar was extracted (Session 33) it grew its own internal
 * query state and the page-level query/index were never set again — which
 * silently KILLED the amber match-highlight on message bubbles (it read the
 * always-empty page query). This tranche deletes the dead chatSearchIndex,
 * and restores the highlight by wiring MessageSearchBar's query up through
 * its new onQueryChange prop into this hook's searchQuery.
 */
export function useChatSearch() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      // Closing via toggle clears the query so bubble highlights disappear.
      if (open) setSearchQuery('');
      return !open;
    });
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

  return { searchOpen, toggleSearch, closeSearch, searchQuery, setSearchQuery };
}
