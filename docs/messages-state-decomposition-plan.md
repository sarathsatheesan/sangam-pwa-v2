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
| ✅6 | Forward/lightbox | 6 (lightboxImage, lightboxForwardOpen, forwardingImage, forwardingMessage, showForwardPicker, forwardingMsg) | `hooks/useForwarding.ts` — DONE Session 58 (two sub-flows: image-lightbox + message-forward; grouped useState w/ semantic transitions, in-flight flag setters exposed raw for the page's try/finally; async send handlers stay in page) | Med |
| ✅7 | Pinned/starred/disappearing | 7 (...) | `hooks/usePinnedAndDisappearing.ts` — DONE Session 59 (grouped useState + semantic helpers; pinnedMessages setter kept raw — it's derived from the message onSnapshot; disappearingPerMessage clear kept raw for send handlers; selectPerMsgTimer collapses value+close). NOTE: no OWN Firestore subscription — pinnedMessages is filtered from the messages array in the page's existing onSnapshot | Med |
| ✅8 | Group management UI | 11 (...) | `hooks/useGroupManagement.ts` — DONE Session 60 (grouped useState + semantic helpers across 3 sub-flows: pen-menu / group-creator / group-settings; raw setters for the 4 controlled inputs + selectedGroupMembers functional update; openGroupCreator/closeGroupCreator bundle the 3-field draft reset; openGroupSettings(name)/closeGroupSettings bundle their resets). selectedConvId was interleaved in the decl block — left as its own useState | Med |
| ✅9 | Composer | 11 (messageText, showFormatting, editingMessage, replyingTo, recentEmojis, showEmojiPicker, showGifPicker, isRecording, pendingImage, imageCompressing, pendingFile) | `hooks/useComposer.ts` — DONE Session 61 (RAW setters, identical names → ~34 call sites byte-unchanged, lowest-risk for the Med-High domain; textareaRef + auto-resize effect + handleFormat kept in page — ref-entangled with send pipeline; also removed 2 dead undo-feature comment lines) | Med-High |
| 🟡10a | Core data STATE | 10 (viewState, conversations, selectedUser, messages, loading, messagesLoading, users, searchTerm, activeFilter, selectedConvId) | `hooks/useChatData.ts` — DONE Session 62 (STATE ONLY, raw setters/identical names, zero call-site churn). ⚠️ **10b DEFERRED**: the 6 onSnapshot subscriptions + msgSnapshotSeqRef guard + effects STAY in page → `services/messages.ts` extraction is a separate focused session (highest-risk surgery; run E2EE tests as guard) | High |
| ✅11 | E2EE + calls | 5 (e2eReady, e2eKeyVersion, callState, groupCallState, activeGroupCallId) | `hooks/useCallAndE2EEState.ts` — DONE Session 64 (FINALE; STATE only, raw setters/identical names; callState/groupCallState seed from getCallManager()/getGroupCallManager().getState() for exact parity; singleton REFS + subscribe() effects + key-init/derivation effects + all call handlers STAY in page). | High |

**✅ STATE DECOMPOSITION COMPLETE (Session 64).** messages.tsx: 76 → **1** active useState (`showChatMenu`, a trivial UI toggle — not worth its own hook). All 11 domains extracted into 11 hooks. ONLY companion work remains: **10b** — move the 6 onSnapshot subscriptions + msgSnapshotSeqRef guard + E2EE key effects into `services/messages.ts` (architectural I/O extraction, separate focused session; the state layer is done).

## Companion work (separate tranches)

- `services/messages.ts` — messages I/O is still inline in the page (the only
  module left without a service). Extract alongside domain 10, not before.
- E2EE utils now have regression tests (`src/utils/__tests__/encryption.test.ts`,
  Session 50) — run them on every tranche that goes near domain 11.
