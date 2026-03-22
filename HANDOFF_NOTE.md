# Sangam PWA v2 (ethniCity) — Session Handoff Note

<!--
  HOW TO USE THIS FILE
  ====================
  This is the MASTER handoff note. Paste this entire file into a new session
  to get Claude up to speed on the project state.

  For detailed session-by-session history (including rationale, gotchas, and
  decisions), see the individual session notes in docs/handoff/:
    - docs/handoff/SESSION_01.md — Initial build (all 13 pages, infra, E2EE, WebRTC)
    - docs/handoff/SESSION_02.md — macOS build fix, nav pill auto-scroll, Discover badge
    - Session 3 — Messaging fixes: Firestore rules, cross-browser overlays, starred messages, dark mode header

  Each session note includes inline comments explaining WHY decisions were made,
  not just WHAT was done. Read them before changing architecture or revisiting
  previously-fixed bugs.
-->

**Date:** March 22, 2026 (Last updated: Session 9)
**Repo:** https://github.com/sarathsatheesan/sangam-pwa-v2
**Latest Commit:** *(pending — Session 8+9 changes need commit)*
**Deployed to:** Firebase Hosting (site: `mithr-1e5f4`) + Cloud Functions (2nd Gen, Cloud Run)
**Local project path on Mac:** `/Users/sarathsatheesan/ethniCity_03_19_2026/sangam-pwa-v2`
**Session history:** `docs/handoff/SESSION_01.md`, `docs/handoff/SESSION_02.md`, Session 3, Session 4, Session 5 (Batch 4), Session 6 (Pinned Messages + UI fixes), Session 7 (Batch 5 — Disappearing Messages), Session 8 (Voice-to-Text + Timer Picker fix + Undo removal + Group Calls), Session 9 (Duplicate call event fix + Share call link + Draggable PiP)

---

<!-- ================================================================
     SECTION 1: PROJECT OVERVIEW
     Read this first to understand what ethniCity is and the tech stack.
     ================================================================ -->
## 1. What We Were Building / Working On

**ethniCity** (internally "Sangam PWA") is a Progressive Web App for diaspora/ethnic communities to connect, network, and share resources. It's a multi-module platform with social feeds, people discovery, business directories, housing listings, events, travel companions, forums, messaging with end-to-end encryption, and real-time audio/video calling.

**Tech Stack:**
- React 19.2 + TypeScript (strict)
- Vite 7.3 with PWA plugin (vite-plugin-pwa)
- Tailwind CSS v4 (uses `@custom-variant dark (&:where(.dark, .dark *))` — `:where()` has **zero specificity**)
- Firebase (Firestore, Auth, Storage, Hosting)
- Framer Motion for animations
- Lucide React for icons
- CryptoJS + Web Crypto API for E2EE
- WebRTC for peer-to-peer calls
- Deployed to Firebase Hosting (site: `mithr-1e5f4`)

**Design System:** "Aurora" theme using CSS variables (`var(--aurora-*)` and `var(--msg-*)`), with primary colors Delta Navy (#0032A0) and Delta Red (#C8102E) on a #F5F7FA background. Dark mode activated by `.dark` class on `<html>`, toggled in `UserSettingsContext.tsx`. Dark mode vars defined in `index.css` under `:root.dark { ... }` (lines 104–142).

**Color Palette / Design Choices:**
- Light mode surface: `--aurora-surface: #FFFFFF`, background: `--aurora-bg: #F5F7FA`
- Dark mode surface: `--aurora-surface: #232438`, background: `--aurora-bg: #1A1B2E`
- Messages header: purple gradient (`#7e22ce → #7c3aed → #4f46e5`) on mobile all modes + desktop dark; light purple (`#faf5ff → #f5f3ff → #eef2ff`) on desktop light
- Starred Messages overlay header: hardcoded purple gradient (`from-purple-700 via-violet-600 to-indigo-600`, white text)
- Message bubbles: own = `--msg-own-bubble: #E0E7FF` (light) / `#2D2F5E` (dark)
- Aurora glass effects used for modals/overlays with backdrop blur

**Session 3 focused on:** Messaging bug fixes — Firestore persistence for Star/Pin/Forward, cross-browser compatibility for all overlays (12 total), Starred Messages header visibility, and dark mode purple gradient on desktop Messages header.

**Session 4 focused on:** Batch 3 — Rich Media & Content: File/Document Sharing (base64 in Firestore, 700KB limit), Link Previews (microlink.io API), GIF/Sticker Support (Giphy integration), plus file attachment bug fix (MIME type + extension validation) and clear error messages.

**Session 5 focused on:** Batch 4 — Push Notifications (FCM with VAPID, cross-browser), Online/Last Seen (Firestore presence with `pagehide` for mobile), Delivery Status (Sent/Read indicators with `visibilitychange`).

**Session 6 focused on:** UI fixes (mobile icon bar overflow, placeholder alignment), Pinned Messages UX (3-dots menu entry with unpin capability, full-screen overlay).

**Session 7 focused on:** Batch 5 — Disappearing Messages (conversation default timer + per-message override, pure `getDisappearingFields()` helper, cleanup effect with `useRef` pattern, settings overlay in 3-dots menu, per-message timer toggle in icon bar, Timer icon on disappearing message bubbles). Fixed critical send regression caused by setState inside async send flow.

**Session 8 focused on:** Batch 5 continued — Voice-to-Text Transcription (Google Cloud Speech-to-Text via Firebase Cloud Functions v2), per-message timer picker popup fix (absolute→fixed positioning with `getBoundingClientRect()`), conversation list preview fix (update `lastMessage` when disappearing messages expire), Undo toast feature commented out (duplicate of delete), Firebase tools updated 15.9→15.11, Cloud Functions deployment troubleshooting (Blaze plan, Node 22, Cloud Run auth, revision conflicts), **Group Video/Audio Calls** (mesh WebRTC up to 8 participants with screen sharing, Firestore signaling, responsive grid UI, GroupCallOverlay component).

**Session 9 focused on:** Fixing duplicate call event messages (both 1:1 and group calls) — multi-layered fix using deterministic document IDs (`setDoc` instead of `addDoc`) plus in-memory dedup guards. Also completed in Session 8 but tested/confirmed in Session 9: **Share call link** (deep link URL with `navigator.share` on mobile / clipboard on desktop), **Draggable PiP** (pointer events with 5px drag threshold to distinguish taps from drags).

---

<!-- ================================================================
     SECTION 2: KEY DECISIONS
     These decisions are foundational. Read before making architectural
     changes. Each decision includes the reasoning so you don't
     accidentally revert something that was done intentionally.
     ================================================================ -->
## 2. Decisions Made and Why

### Session 8: Voice-to-Text, Timer Picker, Undo Removal

- **On-demand Transcribe button (not auto-transcribe)** — User chose explicit button tap over automatic transcription. Saves API costs and gives user control. Transcribe button appears below every voice message bubble; once transcribed, shows inline transcript.

- **Client sends decrypted audio to Cloud Function (not function reading Firestore)** — Voice messages are E2E encrypted in Firestore. The Cloud Function cannot decrypt them. Solution: client already has decrypted audio in memory, so it sends the raw base64 audio data to the function via `httpsCallable`. The function never touches Firestore for audio — it only writes the transcription result back.

- **Google Cloud Speech-to-Text (not Whisper/third-party)** — Stays within Google ecosystem alongside Firebase. Supports multilingual (en-US, ml-IN, hi-IN, ta-IN, te-IN). Uses `latest_long` model with automatic punctuation.

- **Firebase Cloud Functions v2 (2nd Gen) on Cloud Run** — 2nd Gen functions run on Cloud Run, which blocks unauthenticated HTTP by default. Added `invoker: "public"` to `onCall` options so HTTP layer allows requests, while the function validates Firebase Auth internally via `request.auth`. When revision conflicts occur, the only reliable fix is delete + redeploy.

- **Node.js 22 for Cloud Functions** — Node 18 was decommissioned by Google. Updated `functions/package.json` engines to `"node": "22"`.

- **Fixed positioning for timer picker popup** — The per-message timer picker was using `absolute` positioning inside a container with `overflow: hidden`, causing it to render behind messages. Changed to `fixed` positioning with an IIFE that uses `getBoundingClientRect()` to calculate exact viewport position. z-index 9999 with a backdrop overlay at z-index 9998.

- **Conversation lastMessage updated on disappearing message expiry** — When disappearing messages are deleted from the subcollection, the cleanup effect now also updates the conversation document's `lastMessage`, `lastMessageTime`, and `lastMessageSenderId` to reflect the latest remaining message (or clears them if all messages expired).

- **Undo toast commented out (not deleted)** — User felt the "Message Sent — Undo" toast was a duplicate of the existing delete functionality. Code was commented out (not removed) so it can be restored if needed. Affected: `undoSend` function, `UndoToast` component, related state variables, trigger points in `sendMessage` and `sendVoiceMessage`.

- **Firebase tools updated 15.9→15.11** — User chose to update when prompted by npm deprecation notice.

### Session 8: Group Video/Audio Calls

- **Mesh WebRTC (not SFU/Daily.co)** — User chose to extend existing WebRTC P2P architecture rather than using a third-party service. Mesh topology has each participant connect to every other participant directly. Practical limit: ~8 participants (after that, bandwidth and CPU become bottlenecks). For 16+ participants in the future, an SFU (mediasoup/LiveKit) on a dedicated server would be needed.

- **Max 8 participants** — User agreed to limit group calls to 8 for mesh reliability. Each participant has up to 7 peer connections, totaling max 28 connections across all participants.

- **Separate GroupCallManager (not extending CallManager)** — 1:1 calls and group calls have fundamentally different signaling patterns. Keeping them separate avoids breaking the working 1:1 system. `src/utils/groupWebrtc.ts` is a standalone module with its own singleton.

- **Firestore signaling for group calls** — Uses `groupCalls/{roomId}` documents with `signals/{senderUid}_{receiverUid}` subcollections for per-pair SDP exchange, plus `candidates/` subcollections for ICE candidates. Same pattern as 1:1 calls but extended for N participants.

- **"Join call" banner in chat** — When a group call is active, a purple banner appears below the chat header showing "Group call in progress — Tap to join". Uses a real-time Firestore listener to detect active calls.

- **Screen sharing via getDisplayMedia()** — Track replacement on all peer connections simultaneously. Automatically reverts to camera when user clicks browser's "Stop sharing" button. Only shown on desktop (not available on mobile browsers).

- **Audio + Video + Screen Share** — Full-featured group calls with mute, video toggle, screen share, camera flip. Adaptive grid layout: 1 tile = full screen, 2 = side by side, 3-4 = 2x2, 5-6 = 3x2, 7-8 = 3x3.

### Session 9: Duplicate Call Event Fix + Share Link + Draggable PiP

- **Deterministic document IDs for call events (`setDoc` instead of `addDoc`)** — The root cause of duplicate call event messages was that `addDoc` creates a new Firestore document with a random ID each time. Even with in-memory dedup guards (`Set<string>`), race conditions across async boundaries allowed two writes. The fix uses `setDoc` with a deterministic document ID based on callId/roomId, making duplicate writes idempotent — they overwrite the same document rather than creating two. Applied to both `GlobalCallOverlay.tsx` (`call_${event.callId}`) and `GroupCallOverlay.tsx` (`groupcall_${event.roomId}`).

- **Three-layer dedup defense for call events** — (1) `firedEndedCallIds` Set in `webrtc.ts` CallManager prevents `endCall()` listener from firing twice for the same callId, with 60-second auto-cleanup. (2) `writtenCallIdsRef` Set in `GlobalCallOverlay.tsx` prevents writing the same call event twice within a component lifecycle. (3) `setDoc` with deterministic document ID as the ultimate idempotency guarantee. All three layers are in place for maximum reliability.

- **Share call link in call UI controls bar** — Share button added to group call controls. Uses `navigator.share` API on mobile (native share sheet) with fallback to `navigator.clipboard.writeText` on desktop. Deep link format: `${window.location.origin}?joinCall={roomId}&conv={conversationId}`. App handles deep links via `useEffect` that reads URL search params on mount.

- **Draggable PiP (Picture-in-Picture) overlay** — The minimized call overlay was covering the send button. Made it draggable using pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`) with a 5px movement threshold to distinguish taps from drags. Cross-platform (works on touch and mouse). Uses `pointerCapture` for reliable tracking.

- **Push Notifications status confirmed** — Full FCM pipeline is implemented and deployed (firebase.ts init, firebase-messaging-sw.js, client token registration, Cloud Function sender). Only blocker is the `PENDING_VAPID_KEY` placeholder that needs replacement with the real key from Firebase Console.

### Session 4: Batch 3 — Rich Media & Content

- **Base64 in Firestore for file sharing (not Firebase Storage)** — User chose simplicity over scalability. Files are stored as base64 data URLs in the `file.data` field of message documents. Firestore's 1MB document limit means ~700KB max raw file size. Error message guides users to share larger files via cloud links.

- **File extension fallback validation** — Browser MIME type detection is unreliable (macOS Safari often assigns empty or `application/octet-stream`). Validation now checks BOTH `file.type` against allowed MIME types AND file extension against `['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.zip']`. Either match passes validation.

- **Clear error messages with filename and size** — Error notifications now include: the filename in quotes, the actual file size (e.g. "8.1 MB"), the 700KB limit, and a helpful suggestion ("Please share large files via a cloud link instead"). Success notification confirms attachment.

- **microlink.io for link previews (not jsonlink.io)** — jsonlink.io was CORS-blocked from the deployed Firebase Hosting site. Switched to `https://api.microlink.io/?url=...` which has proper CORS headers. Response shape: `{status, data: {title, description, image: {url}, publisher}}`. Client-side cache (`Map`) prevents re-fetching.

- **Giphy with public beta API key** — Key: `GlVGYHkr3WSBnllca54iNt0yFbjz7L65`. GIF picker has trending + search (400ms debounce), 2-column masonry grid, "Powered by GIPHY" attribution. GIFs sent as `image` field (CDN URL, not base64) — no encryption needed.

- **iOS Safari file download fallback** — `<a download="...">` is not respected by iOS Safari. `downloadFile()` detects iOS via `navigator.userAgent` and falls back to `window.open(fileData, '_blank')`.

- **fileInputRef.current.value = '' runs immediately** — Moved from `finally` block to run right after reading the file from the input. This allows the user to re-select the same file (change event won't fire if value is unchanged).

### Session 3: Messaging & Cross-Browser Fixes

- **Firestore `allow update` rule was missing for messages subcollection** — This was the root cause of Star, Pin, and Forward not persisting. The `catch {}` blocks (without a variable) silently swallowed the permission error. Fixed by adding the rule to `firestore.rules` and adding `console.error` to all catch blocks. The rule now allows read/create/update/delete for authenticated users on `/conversations/{convId}/messages/{msgId}`.

- **iOS Safari requires `onTouchStart` on non-interactive divs** — `click` events don't fire on `<div>` elements in iOS Safari. Every overlay backdrop and dismiss handler now has BOTH `onClick` and `onTouchStart`, plus `cursor: 'pointer'` and `WebkitTapHighlightColor: 'transparent'` for proper touch feedback. This was applied to all 12 overlay/modal patterns in `messages.tsx`.

- **Safari needs `-webkit-backdrop-filter` alongside `backdropFilter`** — Tailwind's `backdrop-blur-sm` class doesn't produce the `-webkit-` prefixed version needed for Safari. Report modal and Block confirmation modal converted to inline styles with both `backdropFilter: 'blur(4px)'` and `WebkitBackdropFilter: 'blur(4px)'`.

- **Starred Messages used `absolute inset-0` (rendered above visible area)** — Changed to `fixed inset-0 z-50` so it covers the full viewport. Also the gradient used `var(--aurora-primary)` which doesn't exist in the app (was transparent). Replaced with hardcoded `from-purple-700 via-violet-600 to-indigo-600`.

- **Tailwind v4 `dark:sm:` stacked variants are unreliable** — Tailwind v4's dark mode uses `@custom-variant dark (&:where(.dark, .dark *))` which has **zero specificity** via `:where()`. This means `dark:sm:bg-gradient-...` may not reliably override `sm:bg-gradient-...`. **Decision:** Use CSS custom properties with `@media` queries instead. The Messages header now uses `var(--msg-header-bg, fallback)` with the desktop-light values defined via `@media (min-width: 640px) { :root:not(.dark) { ... } }` in `index.css`. When the vars are undefined (mobile + desktop dark), the inline fallback gives the purple gradient.

- **Duplicate page architecture** — Files exist in BOTH `src/pages/` AND `src/pages/main/`. Every change to `messages.tsx` MUST be copied: `cp src/pages/messages.tsx src/pages/main/messages.tsx`. This was done for every edit in Session 3.

- **Vite build fails in the Cowork Linux VM** — Native Rollup module mismatch. All builds MUST be run from the user's macOS terminal. TypeScript type-checking (`tsc -b --noEmit`) works in the VM and should be run before handing off to the user.

- **User's strict constraint: "Please donot touch any other line of code"** — Session 3 edits were surgically scoped to only the affected lines/files.

### Session 2: Environment / Build Fixes
- **Removed `@rollup/rollup-linux-arm64-gnu` from package.json** — Linux-only dep preventing macOS install. Commit: `d5bea05`.
- **`gh` CLI not available in Cowork VM** — Use `git` commands directly.
- **npm vulnerabilities left as-is (30 total)** — All in transitive deps. Deferred.

### Session 2: UX Improvements
- **Auto-scroll active pill in ModuleSelector** — `scrollIntoView({ behavior: 'smooth', inline: 'center' })` with `requestAnimationFrame`. Fixed React hooks rule violation (early return before hooks). Commit: `185f038`.
- **Incoming request badge on Discover tile** — `useIncomingRequestCount()` hook reused from ModuleSelector. Commit: `1fcfea4`.

### Architecture Decisions (carried from Session 1)
- **Single-file pages** — Each module is a single large TSX file. Chosen for rapid iteration, not long-term scalability.
- **Lazy loading all routes** via `React.lazy()` + `Suspense` in `App.tsx`.
- **Feature flags via Firestore** — `FeatureSettingsContext` reads `appConfig/settings` to toggle modules.
- **E2EE with ECDH P-256 + AES-256-GCM (v2)** with deterministic shared key fallback (PBKDF2). Legacy v1 (CryptoJS AES-CBC) still supported.
- **WebRTC P2P calls** with STUN + free TURN servers (openrelay.metered.ca). Caller-only writes call events to prevent duplicates.
- **Profile images as base64 in Firestore** (not Firebase Storage).
- **2-tier Country > Ethnicity selector** (175+ countries).

---

<!-- ================================================================
     SECTION 3: COMPLETED WORK
     Cumulative across all sessions. Check session notes for details
     on what was done in each specific session.
     ================================================================ -->
## 3. What Was Completed

### Session 9 (March 22, 2026) — Duplicate Call Event Fix + Share Link + Draggable PiP
| Task | File(s) Changed | Commit |
|------|-----------------|--------|
| Fix duplicate 1:1 call events — `setDoc` with deterministic ID `call_${callId}` | `src/components/GlobalCallOverlay.tsx` | *(pending commit)* |
| Fix duplicate 1:1 call events — `firedEndedCallIds` Set dedup guard | `src/utils/webrtc.ts` | *(pending commit)* |
| Fix duplicate group call events — `setDoc` with deterministic ID `groupcall_${roomId}` | `src/components/GroupCallOverlay.tsx` | *(pending commit)* |
| Removed unused `addDoc` import from GroupCallOverlay | `src/components/GroupCallOverlay.tsx` | *(pending commit)* |
| Share call link — `navigator.share` (mobile) / clipboard (desktop) | `src/components/GroupCallOverlay.tsx` | *(pending commit)* |
| Deep link handler for `?joinCall={roomId}&conv={convId}` | `src/pages/messages.tsx` | *(pending commit)* |
| Draggable PiP — pointer events with 5px drag threshold | `src/components/GroupCallOverlay.tsx` | *(pending commit)* |
| Synced messages.tsx to main/messages.tsx | `src/pages/main/messages.tsx` | *(pending commit)* |
| TypeScript type check — passes clean | N/A | N/A |

**Key patterns introduced:**
- `setDoc(doc(db, 'conversations', convId, 'messages', callEventDocId), {...})` — deterministic document ID pattern for idempotent writes. Replaces `addDoc` which creates random IDs.
- `firedEndedCallIds: Set<string>` — instance-level dedup guard in CallManager, auto-expires entries after 60 seconds.
- `writtenCallIdsRef: React.MutableRefObject<Set<string>>` — component-level dedup guard in GlobalCallOverlay.
- Pointer events drag pattern: `onPointerDown` captures start position, `onPointerMove` checks 5px threshold before enabling drag mode, `onPointerUp` releases. Uses `setPointerCapture` for reliable tracking.

### Session 8 (March 22, 2026) — Voice-to-Text + Timer Picker Fix + Undo Removal + Group Calls
| Task | File(s) Changed | Commit |
|------|-----------------|--------|
| Voice-to-Text Transcription — Cloud Function (Speech-to-Text API) | `functions/src/index.ts`, `functions/package.json` | *(deployed to Cloud Functions)* |
| Voice-to-Text Transcription — client UI (Transcribe button + inline transcript) | `src/pages/messages.tsx` | *(pending commit)* |
| Firebase Functions client SDK integration | `src/services/firebase.ts` | *(pending commit)* |
| Per-message timer picker — fixed positioning (absolute→fixed with getBoundingClientRect) | `src/pages/messages.tsx` | *(pending commit)* |
| Conversation lastMessage update on disappearing message expiry | `src/pages/messages.tsx` | *(pending commit)* |
| Undo toast feature — commented out (undoSend, UndoToast, state vars, triggers) | `src/pages/messages.tsx` | *(pending commit)* |
| Node.js engine updated 18→22 for Cloud Functions | `functions/package.json` | *(pending commit)* |
| Firebase tools updated 15.9→15.11 (global) | N/A (global npm) | N/A |
| All above synced to `src/pages/main/messages.tsx` | `src/pages/main/messages.tsx` | *(pending commit)* |
| Group Calls — GroupCallManager (mesh WebRTC, up to 8 participants) | `src/utils/groupWebrtc.ts` (NEW) | *(pending commit)* |
| Group Calls — GroupCallOverlay (multi-party grid UI, controls) | `src/components/GroupCallOverlay.tsx` (NEW) | *(pending commit)* |
| Group Calls — integration in messages (start/join buttons, active call banner) | `src/pages/messages.tsx` | *(pending commit)* |
| Group Calls — mounted in MainLayout | `src/layouts/MainLayout.tsx` | *(pending commit)* |
| Group Calls — Firestore rules for groupCalls collection | `firestore.rules` | *(pending commit)* |
| Screen sharing support | `src/utils/groupWebrtc.ts` | *(pending commit)* |

**Key new components/patterns:**
- `VoiceMessageBubble` updated with `handleTranscribe` — calls `httpsCallable(functions, 'transcribeVoiceMessage')` with `{conversationId, messageId, audioData}`. `audioData` is the decrypted base64 audio from the client.
- `localTranscription` state in VoiceMessageBubble — shows inline transcript once transcribed, with "Transcript" label and FileText icon.
- `transcribeVoiceMessage` Cloud Function — `onCall` with `invoker: "public"`, validates auth, extracts base64 + MIME type, maps to Speech-to-Text encoding (WEBM_OPUS=9, OGG_OPUS=6, MP4=0), saves transcription to `voiceMessage.transcription` in Firestore.
- Timer picker popup uses IIFE with `document.querySelector('[aria-label="Set disappearing message timer"]')` + `getBoundingClientRect()` for fixed viewport positioning.

**New state:** `showPerMsgTimerPicker`
**Commented out state:** `undoMessageId`, `showUndoToast`
**New Message field:** `voiceMessage.transcription?: string`
**New Cloud Function:** `transcribeVoiceMessage` (functions/src/index.ts)
**New dependency:** `@google-cloud/speech` v6 (functions/package.json)

**Group Calls architecture:**
- `GroupCallManager` (singleton) — mesh WebRTC with Firestore signaling. Each participant maintains up to 7 peer connections. Supports audio/video/screen share. Max 8 participants.
- `GroupCallOverlay` — full-screen multi-party UI with responsive grid (1→full, 2→side-by-side, 3-4→2x2, 5-6→3x2, 7-8→3x3). PiP minimized mode. Controls: mute, video, screen share, camera flip, leave.
- `ParticipantTile` — individual video tile with name, mute badge, screen share badge, avatar fallback. Separate `<audio>` element for Safari compatibility.
- Firestore schema: `groupCalls/{roomId}` with `signals/{senderUid}_{receiverUid}` subcollections and `candidates/` per signal pair.
- Active call detection via real-time Firestore listener on `groupCalls` where `conversationId == X` and `status == 'active'`.
- "Join call" purple banner in chat header when a group call is active.
- System messages written when group call starts/ends.

**New state:** `groupCallState`, `activeGroupCallId`
**New files:** `src/utils/groupWebrtc.ts`, `src/components/GroupCallOverlay.tsx`
**New Firestore collection:** `groupCalls` (with `signals` and `candidates` subcollections)

### Session 7 (March 21, 2026) — Batch 5: Disappearing Messages
| Task | File(s) Changed | Commit |
|------|-----------------|--------|
| Disappearing Messages — conversation default timer (Off + 5 options) | `src/pages/messages.tsx` | *(pending)* |
| Disappearing Messages — per-message override toggle in icon bar | `src/pages/messages.tsx` | *(pending)* |
| Disappearing Messages — settings overlay in 3-dots menu | `src/pages/messages.tsx` | *(pending)* |
| Disappearing Messages — cleanup effect (15s interval, useRef pattern) | `src/pages/messages.tsx` | *(pending)* |
| Disappearing Messages — Timer icon on message bubbles | `src/pages/messages.tsx` | *(pending)* |
| Disappearing Messages — banner below chat header | `src/pages/messages.tsx` | *(pending)* |
| Fixed send regression (setState in async flow) | `src/pages/messages.tsx` | *(pending)* |
| All above synced to `src/pages/main/messages.tsx` | `src/pages/main/messages.tsx` | *(pending)* |

**Key patterns:**
- `getDisappearingFields()` — pure function returning `{disappearing, disappearingDuration, expiresAt}` object. NO setState inside.
- Spread into addDoc: `{ ...msgData, ...getDisappearingFields(convId) }`
- `setDisappearingPerMessage(null)` reset happens AFTER successful `addDoc`
- Cleanup effect uses `useRef` for messages array, only `selectedConvId` and `user?.uid` in deps
- 5 send paths updated: main send, GIF, forward photo, voice message, forward message

**New state:** `showDisappearingMenu`, `disappearingPerMessage`
**New Message fields:** `disappearing?: boolean`, `disappearingDuration?: number`, `expiresAt?: Timestamp`
**New Conversation field:** `disappearingTimer?: number | null`

### Session 5–6 (March 20–21, 2026) — Batch 4 + Pinned Messages + UI
| Task | File(s) Changed | Commit |
|------|-----------------|--------|
| Push Notifications — FCM with cross-browser support | `src/pages/messages.tsx`, `public/firebase-messaging-sw.js`, `src/services/firebase.ts` | `9385bad` |
| Online/Last Seen — presence with pagehide for mobile | `src/pages/messages.tsx` | `9385bad` |
| Delivery Status — Sent/Read indicators | `src/pages/messages.tsx` | `9385bad` |
| Pinned Messages — 3-dots menu entry + overlay with unpin | `src/pages/messages.tsx` | `830dd61` |
| Mobile UI — icon bar overflow fix, placeholder alignment | `src/pages/messages.tsx` | `830dd61` |
| Firefox service worker — postMessage fallback for client.navigate() | `public/firebase-messaging-sw.js` | `9385bad` |
| Cloud Function for push notifications | `functions/src/index.ts` | *(needs deploy)* |

### Session 4 (March 20, 2026) — Batch 3: Rich Media & Content
| Task | File(s) Changed | Commit |
|------|-----------------|--------|
| File/Document Sharing (base64 in Firestore, 700KB limit) | `src/pages/messages.tsx` | *(pending)* |
| Link Previews via microlink.io (LinkPreviewCard component) | `src/pages/messages.tsx` | *(pending)* |
| GIF/Sticker Support via Giphy API (GifPicker component) | `src/pages/messages.tsx` | *(pending)* |
| File extension fallback validation (MIME unreliable) | `src/pages/messages.tsx` | *(pending)* |
| Clear error messages (filename, size, guidance) | `src/pages/messages.tsx` | *(pending)* |
| iOS Safari file download fallback (`window.open`) | `src/pages/messages.tsx` | *(pending)* |
| URL linkification in message text (truncated to 50 chars) | `src/pages/messages.tsx` | *(pending)* |
| All above synced to `src/pages/main/messages.tsx` | `src/pages/main/messages.tsx` | *(pending)* |

**New components added to messages.tsx:**
- `LinkPreviewCard` — Fetches OG data from microlink.io, renders card with image/title/description/site name. Cross-browser touch handlers.
- `GifPicker` — Giphy trending + search, 2-column grid, "Powered by GIPHY" attribution. Cross-browser touch handlers.

**New state/refs:**
- `pendingFile` — `{name, size, type, data}` or null
- `fileInputRef` — Hidden `<input type="file">` ref
- `showGifPicker` — Boolean toggle

**New Message type fields:**
- `file?: { name: string; size: number; type: string; data: string }` — base64 encoded file attachment

**New utility types:**
- `LinkPreviewData` — `{url, title?, description?, image?, siteName?}`
- `linkPreviewCache` — `Map<string, LinkPreviewData | null>` (in-memory)
- `fetchLinkPreview()` — async fetch with cache
- `URL_REGEX` — matches http/https URLs in message text
- `downloadFile()` — with iOS Safari `window.open` fallback
- `formatFileSize()` — human-readable file size (KB/MB)

### Session 3 (March 20, 2026) — Messaging Fixes & Dark Mode
| Task | File(s) Changed | Commit |
|------|-----------------|--------|
| Added `allow update` rule for messages subcollection | `firestore.rules` | `86e6238` |
| Added `console.error` to Star/Pin catch blocks | `src/pages/messages.tsx` | `86e6238` |
| Cross-browser touch handlers on all 12 overlays | `src/pages/messages.tsx` | `c65c7e9` |
| Safari `-webkit-backdrop-filter` on Report & Block modals | `src/pages/messages.tsx` | `c65c7e9` |
| Starred Messages: `fixed inset-0 z-50` + hardcoded gradient | `src/pages/messages.tsx` | `2ec9b54` |
| Messages header: dark mode purple gradient via CSS vars | `src/index.css`, `src/pages/messages.tsx` | `1c40587` |
| All above synced to `src/pages/main/messages.tsx` | `src/pages/main/messages.tsx` | all above |

**12 overlay patterns fixed for cross-browser (Chrome, Safari, Firefox, iOS Safari, Android Chrome):**
1. Quick Reactions overlay — `onTouchStart={onClose}` + stopPropagation on inner
2. Voice Recorder overlay — `onTouchStart={handleCancel}` + stopPropagation on inner
3. Wallpaper Picker overlay — `onTouchStart={onClose}` + stopPropagation on inner
4. Pen Menu backdrop — `onTouchStart` dismiss handler
5. Pinned Messages banner — `onTouchStart` scroll handler
6. Delete Confirmation modal — `onTouchStart` + stopPropagation on inner
7. Report Modal backdrop — `onTouchStart` + inline `WebkitBackdropFilter: 'blur(4px)'`
8. Block Confirm backdrop — `onTouchStart` + inline `WebkitBackdropFilter: 'blur(4px)'`
9. Lightbox modal — `onTouchStart` with conditional check
10. Lightbox Forward picker — `onTouchStart` + stopPropagation
11. Starred Messages overlay — `fixed inset-0 z-50`, hardcoded purple gradient
12. Emoji picker — invisible backdrop div with `onTouchStart`

### Session 2 (March 19, 2026)
| Task | File(s) Changed | Commit |
|------|-----------------|--------|
| Fixed macOS build (removed Linux rollup dep) | `package.json` | `d5bea05` |
| Auto-scroll active pill into view on module entry | `src/components/layout/ModuleSelector.tsx` | `185f038` |
| Fixed React hooks ordering violation in ModuleSelector | `src/components/layout/ModuleSelector.tsx` | `185f038` |
| Added incoming request count badge to Discover tile | `src/pages/main/home.tsx` | `1fcfea4` |

### All Pages (functional with Firestore CRUD)
| Page | File | Lines | Status |
|------|------|-------|--------|
| Home (landing) | `src/pages/main/home.tsx` | ~127 | Done |
| Feed | `src/pages/feed.tsx` | — | Done |
| Discover | `src/pages/discover.tsx` | 1,735 | Done |
| Business | `src/pages/business.tsx` | — | Done |
| Housing | `src/pages/housing.tsx` | ~1,776 | Done + 7 enhancements (state only) |
| Events | `src/pages/events.tsx` | — | Done |
| Travel | `src/pages/travel.tsx` | — | Done |
| Forum | `src/pages/forum.tsx` | 2,354 | Done |
| Messages | `src/pages/messages.tsx` | ~5,300+ | Done (E2EE, voice, formatting, cross-browser, push notifs, presence, disappearing msgs, voice-to-text) |
| Marketplace | `src/pages/marketplace.tsx` | 2,436 | Done |
| Profile | `src/pages/profile.tsx` | 1,871 | Done (photo upload, base64) |
| Admin | `src/pages/admin.tsx` | 2,759 | Done |
| Settings | `src/pages/main/settings.tsx` | 1,001 | Done |

### Component Library (13 reusable components)
- `Button`, `Card`, `Modal`, `Toast`, `SkeletonLoader`, `EmptyState` (shared)
- `SearchInput` (forms)
- `AppHeader`, `ModuleSelector`, `AppFooter` (layout)
- `MainLayout` (root layout with sticky header/footer/module selector)
- `GlobalCallOverlay` (call UI)
- `EthnicityFilterDropdown`, `CountryEthnicitySelector`
- `ClickOutsideOverlay` — Already had full cross-browser support (mousedown, click, touchstart, touchend)

### Infrastructure
- Firebase Auth (email/password + Google sign-in)
- Firestore security rules (comprehensive, role-based, **now includes `allow update` for messages subcollection**)
- PWA manifest and service worker (offline-capable)
- Vite build with code splitting
- Dark mode support via CSS variables (`:root.dark { ... }` in `index.css`)
- Content moderation utility (`src/utils/contentModeration.ts`)
- Data privacy service (`src/services/dataPrivacy.ts`)
- Feature flags system (`src/services/featureFlags.ts`)

### Contexts (6 providers)
- `AuthContext` — Firebase auth state + user profile + admin detection
- `FeatureSettingsContext` — Feature flag management
- `LocationContext` — User location/city selection
- `ToastContext` — Toast notification system
- `UserSettingsContext` — User preferences (including dark mode toggle via `.dark` class on `<html>`)
- `CulturalThemeContext` — Cultural theme customization

### Hooks
- `useIncomingRequestCount` — Real-time Firestore listener for pending connection requests. Used in ModuleSelector nav pills AND Home page Discover tile.

---

<!-- ================================================================
     SECTION 4: IN PROGRESS / HALF-DONE
     These items have partial work done. Don't start from scratch —
     check the existing code first.
     ================================================================ -->
## 4. What's In Progress / Half-Done

### Planned Feature Batches (user-approved roadmap)
- **Batch 3:** ~~File/Document Sharing, Link Previews, GIF/Sticker Support~~ ✅ COMPLETED (Session 4)
- **Batch 4:** ~~Push Notifications, Online/Last Seen, Delivery Status~~ ✅ COMPLETED (Session 5)
- **Batch 5:** ~~Disappearing Messages~~ ✅ COMPLETED (Session 7), ~~Voice-to-Text Transcription~~ ✅ COMPLETED (Session 8), ~~Group Video/Audio Calls~~ ✅ COMPLETED (Session 8, mesh WebRTC, max 8 participants) — **BATCH 5 COMPLETE**

### Call System (mostly working, but fragile)
- Audio and video calls work Chrome-Chrome and Chrome-Safari, but edge cases remain
- Camera flip on Chrome uses `deviceId` cycling (works but not elegant)
- Safari video rendering required special handling
- The TURN servers used (`openrelay.metered.ca`) are free/public and may be unreliable in production

### Housing Page Enhancements (state ready, UI NOT wired up)
7 enhancements were added to `housing.tsx` at the state/data level:
1. Listing status management (Active/Pending/Under Contract/Sold/Rented)
2. Monthly payment estimator (calculator states exist)
3. Neighborhood info & scores (walkScore, transitScore)
4. Public comments (interface + states defined)
5. View counter & popularity sorting
6. Similar listings carousel (useMemo logic done)
7. Saved listings tab & recent views (localStorage sync works)

**The state management and Firestore mapping is done, but the JSX/UI rendering for these features still needs wiring up.**

### Group Chat Encryption
- Encryption infrastructure exists in `src/utils/encryption.ts`
- Actual group chat UI and key distribution flow are not implemented

### npm Vulnerabilities (30 — deferred)
- `serialize-javascript` (HIGH) in vite-plugin-pwa chain — build-time only
- `file-type` (MODERATE) in jimp — server-side image parsing, not applicable
- `@tootallnate/once` (LOW) in firebase-tools — CLI only
- All require `npm audit fix --force` (breaking major version bumps). Safe to defer.

---

<!-- ================================================================
     SECTION 5: NEXT STEPS
     Prioritized list. Batch 3 is next per user-approved roadmap.
     ================================================================ -->
## 5. Exact Next Steps

### Immediate (Batch 5 remaining — Messaging Advanced Features)
*Batch 3 completed in Session 4. Batch 4 completed in Session 5. Disappearing Messages completed in Session 7.*

### Batch 5 — COMPLETED
All items complete: Disappearing Messages, Voice-to-Text, Group Video/Audio Calls.

### Future Enhancement: SFU for 16+ Participants
Current group calls use mesh topology (max 8). For 16+ participants, deploy an SFU server (mediasoup or LiveKit) on a VPS with public IP + UDP support. Cloud Run won't work for WebRTC media.

### Pending Deploys & Commits
- **Git commit Session 8+9 changes** — Voice-to-Text, timer picker fix, undo toast removal, group calls, duplicate call event fix, share link, draggable PiP. Run from Mac terminal:
  ```bash
  cd /Users/sarathsatheesan/ethniCity_03_19_2026/sangam-pwa-v2
  git add src/pages/messages.tsx src/pages/main/messages.tsx src/services/firebase.ts functions/src/index.ts functions/package.json src/utils/groupWebrtc.ts src/components/GroupCallOverlay.tsx src/components/GlobalCallOverlay.tsx src/utils/webrtc.ts src/layouts/MainLayout.tsx firestore.rules HANDOFF_NOTE.md
  git commit -m "feat: group video/audio calls, share call link, draggable PiP, fix duplicate call events"
  git push origin main
  ```
- **Build & deploy latest frontend:** `./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build && npx firebase deploy --only hosting,firestore:rules`
- **Replace `PENDING_VAPID_KEY`** in push notification useEffect (`src/pages/main/messages.tsx` line ~2580) with real VAPID key from Firebase Console > Project Settings > Cloud Messaging
- **Cloud Functions already deployed** — `transcribeVoiceMessage` and `sendNewMessageNotification` are live on Cloud Run

### Other High Priority
10. **Wire up Housing UI for the 7 enhancements** — State is ready, just needs JSX.
11. **Stabilize the call system** — Replace free TURN servers with paid provider.
12. **Test E2EE thoroughly** — Cross-browser decryption verification.

### Medium Priority
13. **Refactor large page files** — Messages (~3,900+ lines), Admin (2,759), Marketplace (2,436), Forum (2,354).
14. **Add image upload to all modules** — Currently only profile photos and feed.
15. **Add pagination** — Implement infinite scroll or cursor-based pagination.

### Lower Priority
16. **Map integration** — For housing listings and event locations
17. **Content moderation** — Wire utility into all submission flows
18. **Testing** — No tests exist. Add unit tests for encryption utils.
19. **npm vulnerability maintenance** — Upgrade transitive deps (test for breakage)

---

<!-- ================================================================
     SECTION 6: CONTEXT, CONSTRAINTS & KEY FILES
     Read this before writing any code. Contains build commands,
     critical file locations, known gotchas, and constraints that
     will save you hours of debugging.
     ================================================================ -->
## 6. Important Context, Constraints & Files

### Build & Deploy Commands (from project root on Mac)
<!-- GOTCHA: Do NOT use `npx tsc` — it installs the wrong package (tsc@2.0.4).
     Always use the local binary path. See SESSION_02.md for full details. -->
```bash
# Build
./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build

# Deploy to Firebase Hosting
npx firebase deploy --only hosting

# All-in-one build + deploy
./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build && npx firebase deploy --only hosting

# Deploy Firestore rules only
npx firebase deploy --only firestore:rules

# Git push
git add <files> && git commit -m "message" && git push origin main
```

**Important:** Do NOT use `npx tsc` — it tries to install the wrong package (`tsc@2.0.4` instead of TypeScript). Always use `./node_modules/.bin/tsc`.

**Important:** Vite build FAILS in the Cowork Linux VM (native Rollup mismatch). Always build from macOS terminal. TypeScript type-checking works in the VM.

### Critical Files to Know
| File | Why It Matters |
|------|---------------|
| `src/App.tsx` | All routing, context providers, lazy loading |
| `src/pages/messages.tsx` | Main messages page (~5,300+ lines). ALL overlays have cross-browser touch handlers. Includes LinkPreviewCard, GifPicker, file sharing, URL linkification, push notifications, presence, disappearing messages, voice-to-text transcription. Undo toast code commented out. |
| `src/pages/main/messages.tsx` | **DUPLICATE** of above — MUST be kept in sync via `cp` |
| `src/index.css` | CSS variables for Aurora theme + dark mode. Lines 90–98 = light mode msg vars. Lines 104–142 = `:root.dark`. Lines 143–151 = `@media` for `--msg-header-bg`/`--msg-header-text`. |
| `firestore.rules` | Security rules — lines 238–243 = messages subcollection (read/create/update/delete) |
| `src/components/layout/ModuleSelector.tsx` | Nav pill bar — auto-scroll to active pill + request badge |
| `src/pages/main/home.tsx` | Landing page with module tiles + Discover request badge |
| `src/hooks/useIncomingRequests.ts` | Real-time pending request count (Firestore listener) |
| `src/utils/encryption.ts` | Full E2EE implementation (v1 + v2 + group) |
| `src/utils/webrtc.ts` | CallManager class, WebRTC signaling |
| `src/components/GlobalCallOverlay.tsx` | Call UI (global, persists across nav) |
| `src/components/ClickOutsideOverlay.tsx` | Already had full cross-browser support |
| `src/contexts/AuthContext.tsx` | Auth state, user profile, admin detection |
| `src/contexts/UserSettingsContext.tsx` | Dark mode toggle (`.dark` class on `<html>`) |
| `src/constants/config.ts` | App config including ENCRYPTION_SALT |
| `public/firebase-messaging-sw.js` | FCM service worker — background push + notification click with Firefox postMessage fallback |
| `functions/src/index.ts` | Cloud Functions: `sendNewMessageNotification` (push) + `transcribeVoiceMessage` (Speech-to-Text). Both deployed. |
| `functions/package.json` | Node 22 engine, deps: firebase-admin, firebase-functions, @google-cloud/speech v6 |
| `src/services/firebase.ts` | Firebase init: Auth, Firestore, Storage, Messaging, Functions. Exports `httpsCallable` for Cloud Function calls. |
| `src/utils/groupWebrtc.ts` | GroupCallManager — mesh WebRTC for multi-party calls (up to 8). Firestore signaling, screen sharing, camera flip. Singleton via `getGroupCallManager()`. |
| `src/components/GroupCallOverlay.tsx` | Multi-party call UI — responsive grid, PiP mode, all controls. Mounted in MainLayout. |
| `firebase.json` | Hosting config, cache headers |
| `vite.config.ts` | Build config, PWA manifest, code splitting |

### Critical Gotchas & Patterns
- **DUPLICATE PAGES:** `src/pages/messages.tsx` and `src/pages/main/messages.tsx` must ALWAYS be kept in sync. After editing one, run: `cp src/pages/messages.tsx src/pages/main/messages.tsx`
- **iOS Safari touch events:** Every clickable non-button `<div>` needs `onClick` + `onTouchStart` + `cursor: 'pointer'` + `WebkitTapHighlightColor: 'transparent'`
- **Safari backdrop blur:** Always use inline styles with BOTH `backdropFilter` and `WebkitBackdropFilter` (Tailwind's `backdrop-blur-*` doesn't produce the `-webkit-` prefix)
- **Tailwind v4 `dark:sm:` is unreliable:** Use CSS custom properties with `@media` queries instead of stacking `dark:` and `sm:` variants
- **`--aurora-primary` and `--aurora-primary-dark` DO NOT EXIST** in the app — never reference them. Use hardcoded values or defined `--aurora-*` / `--msg-*` vars.
- **Firestore catch blocks:** Always use `catch (err)` with `console.error`, never bare `catch {}` — it silently swallows permission errors.
- **Browser MIME types are unreliable** — Always validate by BOTH MIME type AND file extension. macOS Safari often assigns empty or generic MIME types.
- **jsonlink.io is CORS-blocked from Firebase Hosting** — Use `api.microlink.io` instead for link previews.
- **iOS Safari ignores `<a download="...">`** — Use `window.open(dataUrl, '_blank')` as fallback for file downloads.
- **Giphy public beta key** — `GlVGYHkr3WSBnllca54iNt0yFbjz7L65`. Rate-limited but free. Replace with production key before launch.
- **Firestore 1MB doc limit** — Base64-encoded files max ~700KB raw. Error message guides users to cloud links for larger files.
- **fileInputRef.current.value must be cleared immediately** — Not in finally/cleanup. Otherwise re-selecting the same file won't trigger `onChange`.
- **NEVER call setState inside a helper used during async send flow** — Causes React re-render mid-send that breaks execution context. Use pure functions that return objects, then setState AFTER the `await addDoc` succeeds.
- **NEVER put `messages` array in useEffect dependency** — Causes effect to re-run on every message change, creating render thrashing. Use `useRef` to hold latest messages and only put stable IDs (`selectedConvId`, `user?.uid`) in deps.
- **`pagehide` event needed for mobile presence** — `beforeunload` doesn't reliably fire on iOS Safari/Android Chrome. Add both listeners.
- **Safari callback-based `Notification.requestPermission()`** — Older Safari uses callback pattern, not Promise. Wrap in try/catch with fallback.
- **Firefox `client.navigate()` not supported in service workers** — Use `postMessage` fallback pattern with listener in app.
- **Cloud Functions v2 (2nd Gen) run on Cloud Run** — Unauthenticated HTTP is blocked by default. Use `invoker: "public"` in `onCall` options. If deployment gets stuck with "Revision conflict" errors, delete the function first (`firebase functions:delete <name> --force`) and redeploy fresh.
- **Voice messages are E2E encrypted** — Cloud Functions cannot read audio from Firestore. Client must send decrypted audio data directly via `httpsCallable`.
- **Firebase Blaze plan required** — Cloud Functions require pay-as-you-go Blaze plan. Already upgraded for project `mithr-1e5f4`.
- **Speech-to-Text API must be enabled** — Enable at `https://console.cloud.google.com/apis/library/speech.googleapis.com?project=mithr-1e5f4`. Already enabled.
- **Timer picker popup needs `fixed` positioning** — Popups inside containers with `overflow: hidden` must use `fixed` positioning with `getBoundingClientRect()` to avoid being clipped. Never use `absolute` positioning for popups in the message area.
- **Use `setDoc` with deterministic IDs for system-generated messages (call events, etc.)** — `addDoc` creates a random document ID each time, so even with in-memory dedup guards, race conditions can cause duplicates. `setDoc` with a deterministic ID (e.g. `call_${callId}`, `groupcall_${roomId}`) makes writes idempotent. Pattern: `await setDoc(doc(db, 'conversations', convId, 'messages', deterministicId), {...})`.
- **Pointer events for cross-platform drag** — Use `onPointerDown/Move/Up` (not `onMouseDown/onTouchStart`) for drag interactions. Works on both mouse and touch. Use `setPointerCapture` for reliable tracking outside the element. A 5px movement threshold distinguishes intentional drags from taps.

### Constraints
- **No Firebase Storage for profile images or file attachments** — Using base64 in Firestore (1MB doc limit, ~700KB raw file max)
- **Free TURN servers** — openrelay.metered.ca may be unreliable. Budget for a paid provider.
- **Single-file page architecture** — Works but painful as features grow
- **Cloud Functions deployed** — `functions/src/index.ts` has push notification + voice transcription functions. Both deployed to Cloud Run. Redeploy with: `cd functions && npm install && npm run build && firebase deploy --only functions`.
- **PWA-first** — Test on mobile Safari (Add to Home Screen) and Chrome (install prompt)
- **`gh` CLI unavailable in Cowork VM** — Use `git` commands directly or Chrome browser for GitHub
- **`npx tsc` is broken** — Always use `./node_modules/.bin/tsc` to avoid installing wrong package
- **Git operations may fail in VM** — `.git/index.lock` permission errors. Provide commands for user to run on macOS terminal.

### Auth Flow
1. `/auth/login` → Email/password or Google sign-in
2. `/auth/signup` → New account creation
3. `/auth/verify` → Email verification
4. `/auth/select-ethnicity` → Onboarding heritage selection
5. → Redirected to `/home` (module tiles landing page)

### Firestore Collections
`users`, `posts` (+ subcollection `comments`), `businesses`, `listings`, `events`, `travelPosts`, `conversations` (+ subcollection `messages`), `connections`, `appConfig`, `bannedUsers`, `disabledUsers`, `userSettings`

### Recent Commit History
```
(pending) feat: group video/audio calls, share call link, draggable PiP, fix duplicate call events
(pending) fix: improve file attachment validation with extension fallback and clear error messages
1c40587 fix: Messages header shows purple gradient in desktop dark mode
2ec9b54 fix: starred messages header invisible due to undefined CSS variables
c65c7e9 fix: Firestore update rule, cross-browser touch handling, starred view positioning
86e6238 fix: add Firestore update rule for messages + cross-browser touch handling for all overlays
c5afa45 feat: Batch 2 message enhancements + cross-browser touch fixes
010c1ee fix: emoji picker - aligned category pills and dismiss on outside tap
1fcfea4 Add incoming request count badge to Discover tile on home page
185f038 Auto-scroll active pill into view in ModuleSelector nav bar
d5bea05 Remove Linux-specific rollup dependency, rebuild for macOS
3e65526 Add post-login landing page with module tiles
```

### CSS Variable Reference (key vars)
```css
/* Light mode */
--aurora-bg: #F5F7FA;           --aurora-surface: #FFFFFF;
--aurora-text: #1B2033;         --aurora-text-secondary: #6B6E82;
--aurora-border: #E8E9F0;       --msg-own-bubble: #E0E7FF;
--msg-text: #111B21;            --msg-icon: #54656F;

/* Dark mode (:root.dark) */
--aurora-bg: #1A1B2E;           --aurora-surface: #232438;
--aurora-text: #F0F1F5;         --aurora-text-secondary: #A0A3B5;
--aurora-border: rgba(255,255,255,0.1);  --msg-own-bubble: #2D2F5E;
--msg-text: #F0F1F5;            --msg-icon: #8B8FA3;

/* Desktop light only (@media min-width: 640px, :root:not(.dark)) */
--msg-header-bg: linear-gradient(to right, #faf5ff, #f5f3ff, #eef2ff);
--msg-header-text: #7e22ce;
/* Mobile + desktop dark: uses inline fallback purple gradient + white text */
```

---

<!--
  MAINTENANCE NOTE
  ================
  When starting a new session:
  1. Paste this entire HANDOFF_NOTE.md into the new session
  2. At the end of the session, update this file AND create a new docs/handoff/SESSION_XX.md
  3. The session file should include inline comments explaining WHY, not just WHAT
  4. Update the session list in the header comment and the "Session history" field
-->

*Generated March 22, 2026 (Session 9) — for continuing development in a new session.*
