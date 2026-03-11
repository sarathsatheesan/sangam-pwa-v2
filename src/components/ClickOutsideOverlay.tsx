import React from 'react';

/**
 * ClickOutsideOverlay — Renders a transparent full-screen overlay when `isOpen` is true.
 * Clicking the overlay calls `onClose` and blocks the click from reaching anything beneath.
 *
 * IMPORTANT: Event timing across browsers:
 *   Mouse sequence: mousedown → mouseup → click
 *   Touch sequence: touchstart → touchend → (synthetic click, if not prevented)
 *
 * We call onClose() only on the LAST event in each chain so the overlay stays
 * in the DOM long enough to absorb all events. Calling onClose on mousedown/touchstart
 * would remove the overlay before click fires, letting the click through on
 * Android Chrome, Edge, and other Chromium browsers.
 *
 * Usage:
 *   <ClickOutsideOverlay isOpen={showMenu} onClose={() => setShowMenu(false)} />
 *   <div className="relative z-50">...menu content...</div>
 *
 * The overlay is z-40. Place your menu/dropdown wrapper at z-50 so it appears above.
 */
export function ClickOutsideOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40"
      style={{ background: 'transparent', cursor: 'default', touchAction: 'none' }}
      // Mouse events: block mousedown, close on click (last in chain)
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      // Touch events: preventDefault on touchstart prevents synthetic click,
      // then close on touchend (last real touch event)
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    />
  );
}

export default ClickOutsideOverlay;
