import React from 'react';

/**
 * ClickOutsideOverlay — Renders a transparent full-screen overlay when `isOpen` is true.
 * Clicking the overlay calls `onClose` and blocks the click from reaching anything beneath.
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
      style={{ background: 'transparent', cursor: 'default' }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
}

export default ClickOutsideOverlay;
