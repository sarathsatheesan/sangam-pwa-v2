import { useEffect } from 'react';

/**
 * Prevents background scroll when a modal is open.
 * Simply toggles overflow:hidden on <body>.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = original;
    };
  }, [locked]);
}
