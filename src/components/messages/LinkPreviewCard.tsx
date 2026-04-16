import React from 'react';
import type { LinkPreviewData } from '@/types/messages';
import { fetchLinkPreview } from '@/utils/messageHelpers';

/**
 * LinkPreviewCard component — renders an OG preview card below message text.
 * Cross-browser: uses onClick + onTouchStart for iOS Safari, proper cursor styling.
 */
export function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = React.useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLinkPreview(url).then((data) => {
      if (!cancelled) { setPreview(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return (
    <div className="mt-1.5 px-2 py-1.5 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(99,102,241,0.06)', minHeight: '40px' }}>
      <div className="h-3 w-24 rounded" style={{ backgroundColor: 'rgba(99,102,241,0.12)' }} />
    </div>
  );
  if (!preview || (!preview.title && !preview.description)) return null;

  const openLink = () => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <div
      className="mt-1.5 rounded-lg overflow-hidden"
      style={{ backgroundColor: 'rgba(99,102,241,0.06)', borderLeft: '3px solid var(--aurora-accent)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      onClick={openLink}
      onTouchStart={openLink}
      role="link"
      tabIndex={0}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          className="w-full object-cover"
          style={{ maxHeight: '140px' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="px-2.5 py-1.5">
        {preview.siteName && (
          <div className="text-[10.5px] uppercase font-semibold tracking-wide mb-0.5" style={{ color: '#6366F1' }}>
            {preview.siteName}
          </div>
        )}
        {preview.title && (
          <div className="text-[13px] font-medium leading-tight line-clamp-2" style={{ color: 'var(--msg-text)' }}>
            {preview.title}
          </div>
        )}
        {preview.description && (
          <div className="text-[11.5px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'var(--msg-secondary)' }}>
            {preview.description}
          </div>
        )}
      </div>
    </div>
  );
}
