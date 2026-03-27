import { useEffect, useRef } from 'react';

/**
 * useFocusTrap - Traps focus within a modal element
 * - Saves the previously focused element on mount
 * - Focuses the first focusable element in the modal
 * - Traps Tab/Shift+Tab within modal boundaries
 * - Restores focus to the previously focused element on unmount
 */
export function useFocusTrap(enabled: boolean = true) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !modalRef.current) return;

    // Save the currently focused element
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Get all focusable elements within the modal
    const focusableElements = modalRef.current.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the first element
    if (firstElement) {
      firstElement.focus();
    }

    // Handle Tab/Shift+Tab
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab: move backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: move forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modalRef.current.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      modalRef.current?.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the previously focused element
      if (previouslyFocusedRef.current && typeof previouslyFocusedRef.current.focus === 'function') {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [enabled]);

  return modalRef;
}
