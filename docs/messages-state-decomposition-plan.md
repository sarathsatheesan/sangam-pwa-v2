# messages.tsx State Decomposition Plan (Review Phase D1)

*Session 50, July 3 2026. Complements docs/god-component-decomposition-plan.md
(Session 33), which extracted JSX components; this plan tackles the remaining
STATE monolith: 76 useState hooks (73 after tranche 1).*

## Rules of engagement

1. One domain per tranche. tsc + full manual chat test (send/receive, E2EE,
   calls, disappearing, presence) BEFORE the next tranche. Never two domains
   in one deploy.
2. Extractions preserve setter semantics exactly — same signatures where call
   sites are numerous (see `showNotif`).
3. Domains that touch refs/effects (calls, E2EE, presence) go LAST.

## Domain map (state → target)

| # | Domain | States | Target | Risk |
|---|---|---|---|---|
| ✅1 | Notification toast | 3 (showNotification, notificationMessage, notificationType) | `hooks/useChatNotification.ts` — DONE Session 50 | Low |
| ✅2 | Report/block moderation | 10 (showReportModal, reportMessageId/Text/SenderId, reportReason/Details/Submitting, showBlockConfirm, blockTargetUser, blockedUsers) | `hooks/useChatModeration.ts` — DONE Session 50 (reducer for the 9 modal states + useState for blockedUsers to keep functional-setter shape); Firestore I/O still in page, move with `services/messages.ts` | Low-Med |
| ✅3 | Context menu + delete confirm | 3 (contextMenuMsg, showDeleteMsgConfirm, deleteMsgId) | `hooks/useMessageActions.ts` — DONE Session 52 (setContextMenuMsg exposed as-is → 10 call sites untouched; delete pair collapsed to nullable deleteMsgId; deleteDoc stays in page) | Low |
| ✅4 | Chat search | 3 (chatSearch, chatSearchQuery, chatSearchIndex) | `hooks/useChatSearch.ts` — DONE Session 56. BONUS: found chatSearchQuery/Index were DEAD since S33 (MessageSearchBar kept query internal) which had silently killed the bubble match-highlight; restored via new onQueryChange prop; chatSearchIndex deleted outright | Low |
| ✅5 | Wallpaper/appearance | 3 (selectedWallpaper, showWallpaperPicker, compactMode) | `hooks/useChatAppearance.ts` — DONE Session 57 (wallpaper localStorage load/save moved in; compactMode kept NON-persisted for parity — flagged as optional future enhancement) | Low |
| 6 | Forward/lightbox | 6 (lightboxImage, lightboxForwardOpen, forwardingImage, forwardingMessage, showForwardPicker, forwardingMsg) | `useForwarding` reducer | Med |
| 7 | Pinned/starred/disappearing | 7 (pinnedMessages, showPinnedBanner, showStarredView, showPinnedView, showDisappearingMenu, disappearingPerMessage, showPerMsgTimerPicker) | `usePinnedAndDisappearing` — has Firestore subscriptions; move I/O to a `services/messages.ts` when created | Med |
| 8 | Group management UI | 11 (showPenMenu, showNewMsgPicker, showGroupCreator, groupName, selectedGroupMembers, groupSearchTerm, showGroupSettings, editingGroupName, editGroupNameValue, showAddMemberPicker, addMemberSearchTerm) | `useGroupManagement` reducer | Med |
| 9 | Composer | 10 (messageText, showFormatting, editingMessage, replyingTo, recentEmojis, showEmojiPicker, showGifPicker, isRecording, pendingImage+imageCompressing, pendingFile) | `useComposer` reducer — many textarea ref interactions, careful | Med-High |
| 10 | Core data (conversations/messages/users/selection) | ~10 (viewState, conversations, selectedUser, messages, loading, messagesLoading, users, searchTerm, activeFilter, selectedConvId) | reducer + eventual `services/messages.ts` (subscriptions incl. the snapshot-race guard `msgSnapshotSeqRef` — Session 42) | High |
| 11 | E2EE + calls | 5 (e2eReady, e2eKeyVersion, callState, groupCallState, activeGroupCallId) | LAST — interlocks with CallManager singletons and key lifecycle; only after 1–10 are stable | High |

Remaining after tranche 5: 54 useState. Suggested order: 6 → 7 → 8 → 9 → 10 → 11.

## Companion work (separate tranches)

- `services/messages.ts` — messages I/O is still inline in the page (the only
  module left without a service). Extract alongside domain 10, not before.
- E2EE utils now have regression tests (`src/utils/__tests__/encryption.test.ts`,
  Session 50) — run them on every tranche that goes near domain 11.
