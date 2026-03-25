// ═════════════════════════════════════════════════════════════════════════════════
// VirtualizedBusinessGrid — Virtual scrolling for large business lists
// Phase 4 #40: Only renders visible rows for smooth performance at scale
// Uses IntersectionObserver + content-visibility for zero-dependency virtualization
// that works seamlessly with CSS Grid responsive layouts.
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useRef, useState, useEffect, useCallback } from 'react';
import BusinessCard from '@/components/business/BusinessCard';
import type { Business } from '@/reducers/businessReducer';

// ── Configuration ──────────────────────────────────────────────────────────────
const CHUNK_SIZE = 12;          // Render in chunks of 12 (4 rows × 3 cols)
const OBSERVER_MARGIN = '400px'; // Start rendering 400px before visible

export interface VirtualizedBusinessGridProps {
  businesses: Business[];
  favorites: Set<string>;
  toggleFavorite: (id: string, e: React.MouseEvent) => void;
  openMenu: (id: string, e: React.MouseEvent) => void;
  onSelect: (business: Business) => void;
  user: any;
  getDistanceMiles?: (business: Business) => number | null;
}

/**
 * A lightweight virtualized grid that:
 * 1. Chunks the business list into groups of CHUNK_SIZE
 * 2. Uses IntersectionObserver to detect when chunks enter/leave the viewport
 * 3. Uses CSS `content-visibility: auto` with `contain-intrinsic-size` for
 *    off-screen chunks — the browser skips layout/paint for hidden chunks
 * 4. Falls back to a plain grid when the list is small (<= CHUNK_SIZE)
 *
 * This approach is simpler than react-window and works natively with CSS Grid.
 */
const VirtualizedBusinessGrid: React.FC<VirtualizedBusinessGridProps> = React.memo(({
  businesses,
  favorites,
  toggleFavorite,
  openMenu,
  onSelect,
  user,
  getDistanceMiles,
}) => {
  // Split businesses into chunks
  const chunks: Business[][] = [];
  for (let i = 0; i < businesses.length; i += CHUNK_SIZE) {
    chunks.push(businesses.slice(i, i + CHUNK_SIZE));
  }

  // Track which chunks are near the viewport
  const [visibleChunks, setVisibleChunks] = useState<Set<number>>(() => new Set([0, 1]));
  const chunkRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Resize the refs array when chunk count changes
  useEffect(() => {
    chunkRefs.current = chunkRefs.current.slice(0, chunks.length);
  }, [chunks.length]);

  // Set up IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleChunks((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const idx = Number((entry.target as HTMLElement).dataset.chunkIndex);
            if (entry.isIntersecting) {
              next.add(idx);
            } else {
              next.delete(idx);
            }
          });
          return next;
        });
      },
      { rootMargin: OBSERVER_MARGIN },
    );

    chunkRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [chunks.length]);

  const setChunkRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    chunkRefs.current[index] = el;
  }, []);

  // ── Small list: render normally ──
  if (businesses.length <= CHUNK_SIZE) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {businesses.map((business) => (
          <BusinessCard
            key={business.id}
            business={business}
            isFavorite={favorites.has(business.id)}
            toggleFavorite={toggleFavorite}
            openMenu={openMenu}
            onSelect={onSelect}
            user={user}
            distanceMiles={getDistanceMiles?.(business) ?? null}
          />
        ))}
      </div>
    );
  }

  // ── Large list: chunked with content-visibility ──
  return (
    <div className="space-y-4">
      {chunks.map((chunk, chunkIdx) => {
        const isVisible = visibleChunks.has(chunkIdx);

        return (
          <div
            key={chunkIdx}
            ref={setChunkRef(chunkIdx)}
            data-chunk-index={chunkIdx}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            style={
              !isVisible
                ? {
                    contentVisibility: 'auto',
                    containIntrinsicSize: `auto ${Math.ceil(chunk.length / 3) * 356}px`,
                  }
                : undefined
            }
          >
            {isVisible
              ? chunk.map((business) => (
                  <BusinessCard
                    key={business.id}
                    business={business}
                    isFavorite={favorites.has(business.id)}
                    toggleFavorite={toggleFavorite}
                    openMenu={openMenu}
                    onSelect={onSelect}
                    user={user}
                    distanceMiles={getDistanceMiles?.(business) ?? null}
                  />
                ))
              : /* Placeholder to maintain scroll height */
                <div
                  style={{ height: Math.ceil(chunk.length / 3) * 356, gridColumn: '1 / -1' }}
                  aria-hidden="true"
                />
            }
          </div>
        );
      })}
    </div>
  );
});

VirtualizedBusinessGrid.displayName = 'VirtualizedBusinessGrid';
export default VirtualizedBusinessGrid;
