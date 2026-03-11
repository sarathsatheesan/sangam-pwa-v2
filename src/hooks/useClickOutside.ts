import { useEffect, useRef, useCallback } from 'react';

/**
 * useClickOutside — Global click-outside-to-close for dropdowns & menus.
 *
 * When `isOpen` is true, injects a transparent full-screen overlay behind
 * the menu (z-index 40). Clicking the overlay closes the menu AND physically
 * blocks the click from reaching anything beneath it. This approach is
 * 100% reliable across web and mobile because the overlay is a real DOM
 * element that intercepts pointer events — no race conditions with React's
 * event delegation or browser-level event capture.
 *
 * Usage:
 *   const menuRef = useRef<HTMLDivElement>(null);
 *   useClickOutside([menuRef], showMenu, () => setShowMenu(false));
 */
export function useClickOutside(
  refs: React.RefObject<HTMLElement | null>[],
  isOpen: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Clean up any stale overlay
      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }
      return;
    }

    // Create a transparent overlay that covers the entire screen
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:40;background:transparent;cursor:default;';

    // On click/touch, close the menu (overlay swallows the event)
    const handleClose = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    };

    overlay.addEventListener('mousedown', handleClose, true);
    overlay.addEventListener('touchstart', handleClose, true);
    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);
    overlay.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);

    document.body.appendChild(overlay);
    overlayRef.current = overlay;

    // Elevate the menu ref elements above the overlay
    refs.forEach((ref) => {
      if (ref.current) {
        const el = ref.current;
        // Store original z-index to restore later
        const origZ = el.style.zIndex;
        el.dataset.origZindex = origZ;
        el.style.zIndex = '50';
        el.style.position = el.style.position || 'relative';
      }
    });

    return () => {
      // Restore original z-index
      refs.forEach((ref) => {
        if (ref.current) {
          const el = ref.current;
          el.style.zIndex = el.dataset.origZindex || '';
          delete el.dataset.origZindex;
        }
      });

      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }
    };
  }, [isOpen, refs]);
}

export default useClickOutside;
