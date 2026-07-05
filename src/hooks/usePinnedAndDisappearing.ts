import { useState, useCallback } from 'react';
import type { Message } from '@/types/messages';

/**
 * Pinned / starred / disappearing domain (Session 59 — messages.tsx
 * decomposition tranche 7, domain 7 of docs/messages-state-decomposition-plan.md).
 *
 * Groups three related surfaces:
 *  - Pinned: the pinned-message banner + full-screen pinned view.
 *    `pinnedMessages` is DERIVED from the live message subscription (the page
 *    calls `setPinnedMessages(msgs.filter(m => m.pinned))` inside its onSnapshot),
 *    so the raw setter is exposed. Moving that filter into a service/useMemo
 *    waits for the domain-10 core-data extraction.
 *  - Starred: the full-screen starred-messages view.
 *  - Disappearing: the conversation timer menu, plus a per-message timer
 *    override (`disappearingPerMessage`, ms) read by the send handlers — its
 *    raw clear is exposed so those handlers keep exact behavior.
 */
export function usePinnedAndDisappearing() {
  // ── pinned ──
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinnedBanner, setShowPinnedBanner] = useState(true);
  const [showPinnedView, setShowPinnedView] = useState(false);

  const dismissPinnedBanner = useCallback(() => setShowPinnedBanner(false), []);
  const openPinnedView = useCallback(() => setShowPinnedView(true), []);
  const closePinnedView = useCallback(() => setShowPinnedView(false), []);

  // ── starred ──
  const [showStarredView, setShowStarredView] = useState(false);
  const openStarredView = useCallback(() => setShowStarredView(true), []);
  const closeStarredView = useCallback(() => setShowStarredView(false), []);

  // ── disappearing ──
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);
  const [disappearingPerMessage, setDisappearingPerMessage] = useState<number | null>(null);
  const [showPerMsgTimerPicker, setShowPerMsgTimerPicker] = useState(false);

  const openDisappearingMenu = useCallback(() => setShowDisappearingMenu(true), []);
  const closeDisappearingMenu = useCallback(() => setShowDisappearingMenu(false), []);
  /** Send handlers clear the per-message override after sending. */
  const clearDisappearingPerMessage = useCallback(() => setDisappearingPerMessage(null), []);
  const togglePerMsgTimerPicker = useCallback(() => setShowPerMsgTimerPicker((o) => !o), []);
  const closePerMsgTimerPicker = useCallback(() => setShowPerMsgTimerPicker(false), []);
  /** Picker selection: set the override (or null) AND close the picker. */
  const selectPerMsgTimer = useCallback((value: number | null) => {
    setDisappearingPerMessage(value);
    setShowPerMsgTimerPicker(false);
  }, []);

  return {
    // pinned
    pinnedMessages, setPinnedMessages,
    showPinnedBanner, dismissPinnedBanner,
    showPinnedView, openPinnedView, closePinnedView,
    // starred
    showStarredView, openStarredView, closeStarredView,
    // disappearing
    showDisappearingMenu, openDisappearingMenu, closeDisappearingMenu,
    disappearingPerMessage, clearDisappearingPerMessage,
    showPerMsgTimerPicker, togglePerMsgTimerPicker, closePerMsgTimerPicker, selectPerMsgTimer,
  };
}
