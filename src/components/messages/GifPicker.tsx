import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

/**
 * GifPicker Component
 * Giphy-powered GIF search and trending grid for chat.
 * Cross-browser: uses onClick + onTouchStart, proper cursor styling.
 */
const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'; // Public beta key

export function GifPicker({ onSelect, onClose }: { onSelect: (gifUrl: string) => void; onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string; width: number; height: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const endpoint = query.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Giphy API error');
      const data = await res.json();
      setGifs(data.data.map((g: { id: string; images: { fixed_width: { url: string; width: string; height: string }; fixed_width_still: { url: string } } }) => ({
        id: g.id,
        url: g.images.fixed_width.url,
        preview: g.images.fixed_width_still.url,
        width: parseInt(g.images.fixed_width.width),
        height: parseInt(g.images.fixed_width.height),
      })));
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGifs(''); }, [fetchGifs]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => fetchGifs(searchQuery), 400);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, fetchGifs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div style={{ backgroundColor: 'var(--aurora-surface)', borderTop: '1px solid var(--aurora-border)' }}>
      <div className="px-3 pt-2 pb-1.5 flex items-center gap-2">
        <Search size={14} style={{ color: 'var(--msg-icon)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search GIFs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm placeholder-gray-400"
          style={{ color: 'var(--msg-text)' }}
          autoFocus
        />
        <button onClick={onClose} onTouchStart={onClose} className="p-1 rounded-full hover:bg-gray-200/60" style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} aria-label="Close GIF picker">
          <X size={16} style={{ color: 'var(--msg-icon)' }} />
        </button>
      </div>
      <div className="overflow-y-auto px-1.5 pb-1.5" style={{ maxHeight: '280px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--aurora-accent)' }} />
          </div>
        ) : gifs.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--msg-secondary)' }}>
            {searchQuery ? 'No GIFs found' : 'Unable to load GIFs'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => (
              <div
                key={gif.id}
                className="rounded-lg overflow-hidden"
                style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', aspectRatio: `${gif.width}/${gif.height}` }}
                onClick={() => { onSelect(gif.url); onClose(); }}
                onTouchStart={() => { onSelect(gif.url); onClose(); }}
                role="button"
                tabIndex={0}
              >
                <img
                  src={gif.url}
                  alt="GIF"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 py-1 text-center" style={{ borderTop: '1px solid var(--aurora-border)' }}>
        <span className="text-[10px]" style={{ color: 'var(--msg-secondary)' }}>Powered by GIPHY</span>
      </div>
    </div>
  );
}
