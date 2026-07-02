import { useEffect } from 'react';

/**
 * Locks body scroll while `locked` is true; restores the previous
 * overflow value on unlock/unmount. For full-screen takeovers and
 * bespoke modals that don't use the shared <Modal> shell (which has
 * this built in). (Session 45)
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}
