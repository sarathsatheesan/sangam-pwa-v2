import { useState, useCallback } from 'react';
import type { Message } from '@/types/messages';

/**
 * Forward + image-lightbox domain (Session 58 — messages.tsx decomposition
 * tranche 6, domain 6 of docs/messages-state-decomposition-plan.md).
 *
 * Two related sub-flows:
 *  A) Image lightbox — tap a photo to view it full-screen, then optionally
 *     forward THAT image to another conversation.
 *       lightboxImage · lightboxForwardOpen · forwardingImage (in-flight)
 *  B) Message forward — forward a whole message (text/photo) via the picker.
 *       forwardingMessage · showForwardPicker · forwardingMsg (in-flight)
 *
 * The two async send handlers stay in the page (Firestore + E2EE). This hook
 * owns only the UI state; the in-flight boolean setters are exposed raw so the
 * page keeps its exact try/finally sequencing.
 */
export function useForwarding() {
  // ── A) image lightbox ──
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxForwardOpen, setLightboxForwardOpen] = useState(false);
  const [forwardingImage, setForwardingImage] = useState(false);

  const openLightbox = useCallback((image: string) => setLightboxImage(image), []);
  const closeLightbox = useCallback(() => {
    setLightboxImage(null);
    setLightboxForwardOpen(false);
  }, []);
  const openLightboxForward = useCallback(() => setLightboxForwardOpen(true), []);
  const closeLightboxForward = useCallback(() => setLightboxForwardOpen(false), []);

  // ── B) message forward ──
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState(false);

  const openMessageForward = useCallback((msg: Message) => {
    setForwardingMessage(msg);
    setShowForwardPicker(true);
  }, []);
  const closeMessageForward = useCallback(() => {
    setShowForwardPicker(false);
    setForwardingMessage(null);
  }, []);

  return {
    // A
    lightboxImage, openLightbox, closeLightbox,
    lightboxForwardOpen, openLightboxForward, closeLightboxForward,
    forwardingImage, setForwardingImage,
    // B
    forwardingMessage, showForwardPicker, openMessageForward, closeMessageForward,
    forwardingMsg, setForwardingMsg,
  };
}
