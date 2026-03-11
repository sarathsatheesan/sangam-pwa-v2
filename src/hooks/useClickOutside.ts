import { useEffect, useRef, useCallback } from 'react';

/**
 * useClickOutside — Global click-outside-to-close for dropdowns & menus.
 *
 * When `isOpen` is true the hook listens (capture phase) for mousedown /
 * touchstart outside every ref in `refs`.  On the first outside interaction
 * it:
 *   1. Calls `onClose()` to dismiss the menu.
 *   2. Calls `stopPropagation()` + `preventDefault()` so the tap does NOT
 *      also trigger the underlying element (e.g. a tile link).
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
  // Keep onClose stable to avoid re-subscribing on every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handler = useCallback(
    (e: MouseEvent | TouchEvent) => {
      // Check whether the event target is inside any of the provided refs
      const isInsideAnyRef = refs.some((ref) => {
        return ref.current && ref.current.contains(e.target as Node);
      });

      if (!isInsideAnyRef) {
        // Swallow the event so it doesn't reach the underlying element
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refs],
  );

  useEffect(() => {
    if (!isOpen) return;

    // Use capture phase so we intercept before any bubbling handler fires
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('touchstart', handler, true);

    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('touchstart', handler, true);
    };
  }, [isOpen, handler]);
}

export default useClickOutside;
