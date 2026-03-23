import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

export interface PhotoLightboxProps {
  photos: string[];
  initialIndex: number;
  title: string;
  onClose: () => void;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  initialIndex,
  title,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const goTo = useCallback((index: number) => {
    setCurrentIndex((index + photos.length) % photos.length);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [photos.length]);

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  const toggleZoom = useCallback(() => {
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(2);
    }
  }, [zoom]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': goPrev(); break;
        case 'ArrowRight': goNext(); break;
        case '+': case '=': setZoom((z) => Math.min(z + 0.5, 4)); break;
        case '-': setZoom((z) => { const nz = Math.max(z - 0.5, 1); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; }); break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    containerRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goPrev, goNext]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1) return; // Don't swipe while zoomed
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || zoom > 1) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dt = Date.now() - touchStartRef.current.time;
    const threshold = 50;
    const maxTime = 300;

    if (Math.abs(dx) > threshold && dt < maxTime) {
      if (dx > 0) goPrev();
      else goNext();
    }
    touchStartRef.current = null;
  };

  // Pan while zoomed (mouse drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo viewer: ${title}`}
      tabIndex={-1}
      className="fixed inset-0 z-[100] bg-black flex flex-col focus:outline-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="text-white text-sm font-medium" aria-live="polite">
          {currentIndex + 1} / {photos.length}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleZoom}
            aria-label={zoom > 1 ? 'Zoom out' : 'Zoom in'}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            {zoom > 1 ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            aria-label="Close photo viewer"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image */}
      <div className="flex-1 flex items-center justify-center overflow-hidden select-none">
        <img
          src={photos[currentIndex]}
          alt={`${title} — photo ${currentIndex + 1} of ${photos.length}`}
          draggable={false}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            cursor: zoom > 1 ? 'grab' : 'default',
          }}
          onDoubleClick={toggleZoom}
        />
      </div>

      {/* Navigation arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goNext}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
          <div className="flex gap-2 justify-center overflow-x-auto scrollbar-hide">
            {photos.map((photo, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                aria-label={`View photo ${idx + 1}`}
                aria-current={idx === currentIndex ? 'true' : undefined}
                className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none ${
                  idx === currentIndex ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-75'
                }`}
              >
                <img
                  src={photo}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoLightbox;
