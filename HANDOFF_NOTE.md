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

**Date:** March 25, 2026 (Last updated: Session 18)
**Repo:** https://github.com/sarathsatheesan/sangam-pwa-v2
**Latest Commit:** (pending) — feat: Phase 4 high-impact UX features + carousel/deals/Q&A fixes
**Deployed to:** Firebase Hosting (site: `mithr-1e5f4`) + Cloud Functions (2nd Gen, Cloud Run)
**Local project path on Mac:** `/Users/sarathsatheesan/ethniCity_03_19_2026/sangam-pwa-v2`
**Session history:** `docs/handoff/SESSION_01.md`, `docs/handoff/SESSION_02.md`, Session 3, Session 4, Session 5 (Batch 4), Session 6 (Pinned Messages + UI fixes), Session 7 (Batch 5 — Disappearing Messages), Session 8 (Voice-to-Text + Timer Picker fix + Undo removal + Group Calls), Session 9 (Duplicate call event fix + Share call link + Draggable PiP), Session 10 (Admin toggles for all 23 messaging features + live Chrome testing + cross-browser audit), Session 11 (Business Phase 2 Steps 1-6: useReducer migration + 4 custom hooks), Session 12 (Business Phase 2 Steps 7-8: extract 6 JSX components + memoize handlers), Session 13 (Business Phase 3: UX Polish & Accessibility — ARIA labels, keyboard nav, focus trapping, lazy loading, photo lightbox, empty states, share functionality), Sessions 14-16 (Business Phase 4: Map view with Leaflet/OpenStreetMap + Owner Analytics Dashboard + map marker UX redesign + Firestore analytics rules fix), Session 17 (Business Phase 4 continued: Admin verification toggle, Q&A system, Booking/Reservation, Open Now indicator, carousel/deals/Q&A fixes, details/summary refactor)

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

**Session 10 focused on:** Admin toggles for ALL 23 messaging features — added 13 new feature flags to `FeatureSettingsContext.tsx` (`DEFAULT_FEATURES` + `FEATURE_GROUPS`), wired 19 `isFeatureEnabled()` conditionals throughout `messages.tsx` UI, gated screen sharing in `GroupCallOverlay.tsx`. Completed `setDoc` dedup fix in GroupCallOverlay (carried from Session 9). Fixed iOS Safari PiP tap issue in `GlobalCallOverlay.tsx`. Ran cross-browser compatibility audit (Chrome, Safari, Firefox desktop + iOS Safari + Android Chrome). Live-tested the deployed app in Chrome: verified all 23 admin toggles, verified toggle-off hides UI (GIF & Stickers toggle test confirmed), verified chat header, icon bar, context menu, 3-dots menu, voice transcription, read receipts, pinned messages, online status all respond to feature flags. Also conducted a full codebase line count audit and duplicate page architecture analysis — identified ~29,162 lines of dead code in `src/pages/main/` that the router never uses. User decided NOT to clean up now (too risky to touch), deferred to a future session.

**Session 11 focused on:** Business module Phase 2 Architecture Refactor — Steps 1-6. Started from a detailed Phase 2 roadmap (`Phase2_Architecture_Refactor_Details.docx`). Steps 1-2 (constants extraction + useReducer migration) were completed in a prior session but had 42 TypeScript errors remaining. Fixed all 42 errors: 15 bare variable references missing `state.` prefix, 3 incorrect `photoUploading.loading` accesses, 4 null safety fixes, 1 missing `Scale` icon import. Then completed Steps 3-6: extracted 4 custom hooks from `business.tsx` — `useBusinessData.ts` (~250 lines, Firestore CRUD/pagination/favorites/infinite scroll), `useBusinessFilters.ts` (~95 lines, search debounce/filtering/sorting), `useBusinessModeration.ts` (~170 lines, report/block/mute with 3-strike auto-hide), `useBusinessReviews.ts` (~110 lines, review fetch/submit with optimistic update). Reduced `business.tsx` from ~2188 to ~1604 lines. All hooks follow the pattern: `export function useBusinessX(state: BusinessState, dispatch: React.Dispatch<BusinessAction>, ...)`. Deployed and tested live — all features working, zero console errors. Also discovered Firebase Storage was not needed (all images use base64 data URLs in Firestore, same pattern as messages/feed). Deploy command updated to `firebase deploy --only hosting,functions,firestore` (skip storage target).

**Session 12 focused on:** Business module Phase 2 Steps 7-8 — JSX component extraction + handler memoization. Extracted 6 components from `business.tsx` into `src/components/business/`: `BusinessCard.tsx` (153 lines, React.memo grid card), `FeaturedCarousel.tsx` (99 lines, React.memo featured scroll), `BusinessDetailModal.tsx` (496 lines, full detail modal with reviews/contact/deals), `BusinessEditModal.tsx` (243 lines, edit form with photo uploader), `BusinessCreateModal.tsx` (245 lines, create form with photo uploader), `BusinessModals.tsx` (315 lines, TIN/Delete/ContextMenu/Report/Block modals as named exports). Memoized all remaining handlers in `business.tsx` with `useCallback`: `openMenu`, `closeMenu`, `handleSelectBusiness`, `isOwnerOrAdmin`. Final `business.tsx` is 552 lines — down from ~2500 lines at start of Phase 2 (78% reduction). Fixed one TypeScript error: `blockTargetUser` prop type had `userId` but reducer stores `uid`. Phase 2 is now COMPLETE. The `cp` sync pattern for `business.tsx` ↔ `main/business.tsx` is maintained.

**Session 13 focused on:** Business module Phase 3 — UX Polish & Accessibility (roadmap items #18-#23). All 6 items completed in a single session:
- **#18 ARIA labels**: Added `aria-label`, `aria-pressed`, `aria-selected`, `aria-haspopup`, `aria-live`, `aria-atomic`, `aria-hidden`, `role="article"`, `role="dialog"`, `role="alertdialog"`, `role="menu"`, `role="menuitem"`, `role="radiogroup"`, `role="radio"`, `role="alert"`, `role="tablist"`, `role="tab"`, `role="region"`, `role="status"`, `role="img"`, and `aria-roledescription="carousel"` across all 8 business component files.
- **#19 Keyboard navigation**: ESC-to-close on ALL modals (Detail, Create, Edit, TIN, Delete, Report, Block). Focus trapping on Detail modal and all modals in BusinessModals.tsx via shared `useModalA11y` hook. Arrow key navigation in ContextMenu. `focus-visible:ring-2` on all interactive elements. `tabIndex={0}` + Enter/Space handlers on clickable card divs. Return-focus-to-previous-element on modal close.
- **#20 Image lazy loading**: `loading="lazy"` + `decoding="async"` on all card images, carousel images, merchant dashboard images, and photo uploader thumbnails. Detail modal carousel uses `decoding="async"` only (active image shouldn't be lazy).
- **#21 Photo lightbox**: New `PhotoLightbox.tsx` (209 lines) — full-screen overlay with zoom (double-click toggle + keyboard +/-), swipe gestures (touch swipe left/right), arrow key navigation, pan while zoomed (mouse drag), thumbnail strip with `aria-current`, proper focus management and body scroll lock. Integrated into BusinessDetailModal photo carousel — click any photo to open lightbox.
- **#22 Empty states**: Replaced generic "no businesses found" with contextual SVG illustrations: search icon (no results), heart (no favorites), store with plus (no listings). Enhanced CTAs: "Clear Search" button added alongside "Add Business". Review empty state improved with star character illustration and "Write the First Review" CTA.
- **#23 Share functionality**: Web Share API integration in BusinessDetailModal with clipboard fallback. Share button added to hero banner action buttons. Generates deep link URL (`/business?open={id}`). Shows toast "Link copied to clipboard!" when Web Share API not available. Graceful error handling for cancelled shares.

New file: `src/components/business/PhotoLightbox.tsx` (209 lines). Updated line counts: `business.tsx` 598 lines (from 552), `BusinessDetailModal.tsx` 615 lines (from 496), `BusinessModals.tsx` 445 lines (from 315), `BusinessCard.tsx` 164 lines (from 153), `FeaturedCarousel.tsx` 108 lines (from 99), `BusinessCreateModal.tsx` 257 lines (from 245), `BusinessEditModal.tsx` 257 lines (from 243). Total business module: 2653 lines across 8 component files + orchestrator. Phase 3 is now COMPLETE. TypeScript compiles with zero errors. Files synced: `business.tsx` ↔ `main/business.tsx`.

**Sessions 14-16 focused on:** Business module Phase 4 — Advanced Features (roadmap items #29 Map Integration and #30 Analytics Dashboard). This was a multi-session effort spanning map integration, live testing, bug fixing, and UX redesign:

- **#29 Map View with Leaflet + OpenStreetMap**: Added a Map/List view toggle to the business page. The map component (`BusinessMapView.tsx`) dynamically loads Leaflet 1.9.4 from CDN (no npm dependency) using OpenStreetMap tiles. Custom colored markers based on business category. Near Me button for geolocation with distance badges. User location shown with a pulsing blue dot. React.lazy() + Suspense for code-splitting the map component.

- **#30 Owner Analytics Dashboard**: New analytics service (`businessAnalytics.ts`) using Firestore subcollection pattern `businesses/{id}/analytics/{YYYY-MM-DD}` with daily event counters for views, contact clicks, shares, and favorites. Session-level debounce for views via `Set<string>`. New dashboard component (`BusinessAnalyticsTab.tsx`) with 4 stat cards and CSS-only bar charts. Gated by `isOwnerOrAdmin(business)` — only visible to the business owner or admin users.

**Session 17 focused on:** Business module Phase 4 continued — High-impact UX features (#24 Open Now, #35 Customer Q&A, #36 Booking/Reservation) plus admin verification toggle, cross-browser testing, and multiple bug fixes:

- **Admin Verification Toggle**: Added a badge/toggle button in the admin Listings section next to disable/delete buttons. Writes `verified`, `verifiedAt` (serverTimestamp), `verificationMethod` fields to Firestore. Fixed verification not appearing on business page (missing field mapping in `useBusinessData.ts`).
- **#35 Customer Q&A System**: New `BusinessQASection.tsx` component (~384 lines) with Firestore subcollection (`businesses/{id}/questions`), optimistic UI, debounced search (250ms), owner badge ("Owner" pill), reply form. Refactored to use native HTML `<details>`/`<summary>` for collapsible questions with animated chevron icon. Firestore security rules added for Q&A subcollection.
- **#36 Booking/Reservation**: Added `bookingUrl` field to Business interface, form data, create/edit modals, and detail modal contact section. Shows "Book a Reservation / Schedule online" link with CalendarClock icon.
- **#24 Open Now Indicator**: Shared `parseOpenNow()` utility in `businessUtils.ts` (~85 lines) — parses business hours strings including day ranges ("Mon-Fri"), 12h/24h formats, with try/catch safety. Shows Open/Closed status pill on BusinessCard tiles, FeaturedCarousel cards, and BusinessDetailModal next to Hours heading.
- **Photo Carousel Refactor**: Removed prev/next arrows from hero banner entirely — was causing persistent overlap with action buttons (X, share, heart, menu) on both mobile and desktop due to compact 224px hero height. Navigation now via swipe (touch) + "1/2" counter + lightbox (click image to open full-screen with arrows). Carousel state lifted from `BusinessPhotoCarousel` to `BusinessDetailModal` for proper z-index management.
- **Featured Carousel Background Fix**: Removed `bg-aurora-surface` from bottom info section, added subtle `bgColor` gradient tint to entire card wrapper for cohesive appearance in both light and dark modes.
- **Deals Save Fix**: Fixed "Failed to save deals" error when adding second deal — Firestore rejects `undefined` values. Deal objects now built without undefined fields, plus sanitization in the save handler.
- **Q&A Search**: Appears when 3+ questions exist, debounced 250ms, filters across question text, answer text, and usernames. Clear button and "X of Y" count display.

**Session 18 focused on:** Business module Phase 4 — Completing remaining high-impact features (#25, #37-#40):

- **#25 Filter Chips UI**: Active filter chips bar between results header and business grid. Shows active search (violet), category (emerald), heritage (amber, one per selection), and collection (indigo) as dismissible chips. "Clear all" button appears when 2+ filters active. Icons for each collection type (Heart for favorites, UserPlus for following, TrendingUp for top rated, Navigation for nearest).
- **#37 CSV Bulk Import**: New `BusinessCSVImport.tsx` (~480 lines, lazy-loaded). 4-step wizard: drag-and-drop upload → table preview with row validation → Firestore batch writes (20 per batch with progress bar) → success summary. Smart column mapping via fuzzy header matching (e.g., "business name", "tel", "address" → canonical fields). Downloadable CSV template with example row. Multi-value fields split by semicolons.
- **#38 Distance-Based Sorting**: Haversine formula in `businessUtils.ts` (`getDistanceMiles`). New "Nearest" sort pill in collection tabs that auto-triggers browser geolocation. Distance caching via `Map<string, number>` keyed by `${businessId}_${lat}_${lng}`. Distance badges (indigo pill with Navigation icon) on BusinessCard and FeaturedCarousel. Added `'nearest'` to `activeCollection` union type in reducer.
- **#39 Real-Time onSnapshot**: Replaced one-time `getDocs` initial fetch with Firestore `onSnapshot` listener in `useBusinessData.ts`. Business list now auto-updates when businesses are added, edited, or deleted from any client. "Load more" pagination still uses `getDocs` with `startAfter` cursor. Removed `window.location.reload()` from CSV import completion handler.
- **#40 List Virtualization**: New `VirtualizedBusinessGrid.tsx` using IntersectionObserver + CSS `content-visibility: auto` for zero-dependency virtual scrolling. Chunks business list into groups of 12, only renders chunks near the viewport (400px margin). Falls back to plain CSS grid for ≤12 items. Works seamlessly with responsive grid layouts (1/2/3 columns).

- **Bug fixes across Sessions 14-16**:
  1. **Map markers race condition (zero markers on map)**: The markers `useEffect` ran before async Leaflet CDN load completed. Fixed by adding `mapReady` state flag set after map initialization, added to dependency arrays.
  2. **Firestore analytics permissions error**: `firestore.rules` had no subcollection rules for `businesses/{id}/analytics/{dateKey}`. Fixed by adding nested match rule with read/write for authenticated users.
  3. **Map marker click does nothing**: Custom `divIcon` click events didn't propagate to React state handler. Complete UX redesign: replaced React-based popup card with Leaflet native `bindPopup()` (rich HTML with photo, name, category, rating, description, action links) + `bindTooltip()` for hover. Added delegated click handler on map container for "View Details" buttons inside popups.

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

### Session 11-12: Business Module Phase 2 Architecture Refactor (Steps 1-8)

- **useReducer replacing 48 useState hooks** — The business page had 48 individual `useState` hooks making state management unwieldy. Migrated to a single `useReducer` with typed discriminated union actions (`BusinessAction`) and a central `BusinessState` interface. All state in `src/reducers/businessReducer.ts` (~514 lines). The reducer contains all type interfaces (`Business`, `BusinessReview`, `Deal`, `BusinessOrder`, `MenuItem`, `BusinessFormData`).

- **Custom hooks receive shared state + dispatch (not internal state)** — Each extracted hook takes `(state: BusinessState, dispatch: React.Dispatch<BusinessAction>, ...)` as params rather than managing its own internal state. This keeps the reducer as the single source of truth and allows hooks to read from and write to the same state tree. Return values are destructured by the parent component.

- **`cp` sync pattern extended to business.tsx** — `src/pages/business.tsx` must stay identical to `src/pages/main/business.tsx`, same as messages.tsx. Every edit requires a `cp` sync. This is part of the legacy duplicate page architecture (deferred cleanup from Session 10).

- **Firebase Storage NOT used for business images** — User confirmed all business images use base64 data URLs stored directly in Firestore, same pattern as messages/feed/profile. Firebase Storage was never configured. Deploy command is `firebase deploy --only hosting,functions,firestore` (not `--only hosting`).

- **Photo uploader components duplicated in Edit and Create modals** — `BusinessPhotoUploader`, `FormInput`, `FormTextarea` are defined locally within `BusinessEditModal.tsx` and `BusinessCreateModal.tsx`. This avoids prop-drilling and import complexity. The components use their own `useState` for photo upload state (not the reducer), preventing keystroke re-renders of the entire form.

- **BusinessCard wrapped in React.memo** — Grid cards are expensive to render with many businesses. `React.memo` prevents re-renders when the parent re-renders (e.g., during search typing). The `isFavorite` boolean prop is derived from `state.favorites.has(id)` by the parent rather than passing the entire Set.

- **FeaturedCarousel also React.memo** — Same reasoning. Receives the favorites Set directly (needed for multiple items).

- **BusinessModals uses named exports (not default)** — `TinVerificationModal`, `DeleteConfirmModal`, `ContextMenu`, `ReportModal`, `BlockConfirmModal` are exported as named exports from a single file rather than 5 separate files. This keeps the import count manageable while still separating concerns.

- **`handleSelectBusiness` memoized as new callback** — Previously, business selection was an inline arrow function `() => { dispatch(SELECT_BUSINESS); dispatch(SET_ACTIVE_TAB); }` repeated in grid cards, featured carousel, and merchant view. Extracted into a single `useCallback` for consistent behavior and to satisfy React.memo's prop comparison in BusinessCard.

- **Phase 2 roadmap document** — `Phase2_Architecture_Refactor_Details.docx` in workspace folder defines all 9 items with recommended implementation order. Steps 1-8 are now complete. The document specified target file structure and line counts which closely matched the actual result.

### Sessions 14-16: Business Phase 4 — Map Integration + Analytics Dashboard

- **Leaflet + OpenStreetMap (not Google Maps)** — Leaflet is free, open-source, and has no API key requirement. Loaded dynamically from CDN (`unpkg.com/leaflet@1.9.4`) — no npm dependency, avoiding version mismatch issues in the build. OpenStreetMap tiles are free and community-maintained. Google Maps would require an API key and billing setup.

- **CDN-loaded Leaflet (not npm installed)** — Leaflet is loaded at runtime via `<link>` and `<script>` tags injected into `<head>`. This avoids native module issues with Vite/Rollup (which already cause problems with Rollup in the Cowork VM). The `window.L` global is used after load confirmation via `script.onload`.

- **`mapReady` state pattern for async initialization** — The map initialization is async (CDN load + map creation). A `mapReady` boolean state is set to `true` after the map instance is created. All dependent effects (marker rendering, user location) include `mapReady` in their dependency arrays. Without this, effects run before the map exists and silently exit, never re-running because their other deps don't change.

- **Leaflet native `bindPopup()` over React state-based popups** — The initial implementation used a React state `selectedPin` to render a popup card as JSX at the bottom of the map. This didn't work because Leaflet's custom `divIcon` click events don't reliably propagate to React event handlers. The redesign uses Leaflet's native `bindPopup()` with raw HTML content. This is more reliable because Leaflet manages its own DOM and event lifecycle. A delegated event listener on the map container handles "View Details" button clicks inside popups.

- **`bindTooltip()` for hover preview** — Each marker has a Leaflet tooltip showing the business name on hover. Uses `direction: 'top'` with offset to appear above the marker. This gives instant feedback before clicking.

- **Delegated click handler for popup buttons** — Leaflet popups contain raw HTML, so React event handlers don't work inside them. A single `click` event listener is added to the map container div. It checks if the click target is (or is inside) a `.biz-popup-btn` element, reads `data-biz-index` attribute, and looks up the business from `bizIndexMapRef`. This pattern avoids memory leaks from per-popup listeners.

- **CSS injection for popup styling** — `injectPopupStyles()` adds a `<style>` tag to `<head>` with custom CSS for `.biz-popup` and `.biz-tooltip` classes. Runs once (checked by `id="biz-popup-styles"`). This is necessary because Leaflet popups exist outside React's render tree, so Tailwind classes don't apply.

- **Analytics subcollection pattern: `businesses/{id}/analytics/{YYYY-MM-DD}`** — Daily event counters stored as separate Firestore documents keyed by date. Each document has fields: `views`, `contactClicks`, `shares`, `favorites` (all numeric). Uses `increment()` for atomic counter updates. Separate documents per day allow efficient date-range queries without reading the entire analytics history.

- **Session-level debounce for analytics view tracking** — `const viewedThisSession = new Set<string>()` in `businessAnalytics.ts` prevents the same user from inflating view counts by navigating back and forth. Each business is counted once per session. The Set is module-scoped (persists across component re-mounts but resets on page refresh).

- **Analytics visibility: owner/admin only** — The analytics dashboard tab in `BusinessDetailModal.tsx` is gated by `isOwnerOrAdmin(business)`. Regular users cannot see view counts, click data, or engagement metrics. This prevents competitors from seeing each other's traffic.

- **ESC handler on sub-modals uses capture phase** — `document.addEventListener('keydown', handler, true)` — capture phase with `stopImmediatePropagation()` ensures that when ESC is pressed on a sub-modal (e.g., Report modal inside Detail modal), only the sub-modal closes, not the parent.

### Session 17: Business Phase 4 continued — High-Impact UX + Fixes

- **Native `<details>`/`<summary>` for Q&A (not custom useState toggle)** — User requested collapsible questions using native HTML elements. This removes the need for `expandedQ` state management and provides built-in accessibility (keyboard support, screen reader announce). CSS hides default browser disclosure triangle (`summary::-webkit-details-marker`, `summary::marker`). Chevron icon animates via CSS `details[open] .qa-chevron { transform: rotate(0deg) }`. Inner `<div>` inside `<summary>` handles flex layout because iOS Safari doesn't properly support `display: flex` directly on `<summary>` elements.

- **Carousel arrows removed entirely (not repositioned)** — After multiple attempts to reposition the `<`/`>` arrows (bottom-8, top-1/2, hidden on mobile), they always visually clashed with the 4 action buttons (share, heart, menu, close) in the compact 224px hero banner. The definitive fix: remove arrows completely. Photo navigation uses swipe (mobile), "1/2" counter (visual cue), and tap-to-open lightbox (which has its own full-screen arrows). This matches Google Maps, Yelp, and Airbnb patterns for compact hero carousels.

- **Carousel state lifted to modal level (not inside carousel component)** — The `BusinessPhotoCarousel` component previously managed its own `currentIndex`, `showLightbox`, and touch handlers internally. This was refactored so all state lives in `BusinessDetailModal` and is passed as props. This ensures the photo counter, lightbox, and any future features all share the same state without prop tunneling.

- **Firestore rejects `undefined` values — always omit instead** — When building objects for Firestore `updateDoc`/`setDoc`, never use `field: value || undefined`. Instead, conditionally add fields: `if (value) obj.field = value`. This applies to deals, Q&A, and any future features. The deals save handler also sanitizes existing deals before writing to handle legacy data with undefined fields.

- **`serverTimestamp()` for admin verification (not `new Date()`)** — Admin verification writes `verifiedAt: serverTimestamp()` for consistency across time zones. Cross-browser testing caught a `new Date()` usage that was corrected.

- **Share API fallback chain: `navigator.share` → `clipboard.writeText` → `execCommand('copy')`** — Firefox desktop doesn't support `navigator.clipboard.writeText` without HTTPS or user gesture. Added hidden textarea + `document.execCommand('copy')` as ultimate fallback.

- **`parseOpenNow()` extracted to shared utility** — Initially inline in BusinessDetailModal, extracted to `businessUtils.ts` because it's used by BusinessCard, FeaturedCarousel, and BusinessDetailModal. Supports day ranges ("Mon-Fri"), 12h/24h time formats, bare numbers, and graceful failure via try/catch.

### Session 13: Business Phase 3 — UX Polish & Accessibility

- **Shared `useModalA11y` hook for focus trap + ESC** — Rather than duplicating focus-trap and ESC-to-close logic in every modal, a single `useModalA11y(ref, onClose)` function is defined in `BusinessModals.tsx` and used by TIN, Delete, Report, and Block modals. The detail modal has its own inline version (needs to manage more complex state). Create and Edit modals use simpler ESC-only listeners since they're full-screen overlays (not popup dialogs).

- **`focus-visible` over `focus` for ring styles** — Using `focus-visible:ring-2` instead of `focus:ring-2` ensures keyboard focus rings appear only during keyboard navigation, not on mouse clicks. This keeps the UI clean for mouse users while fully accessible for keyboard users.

- **`role="tablist"` + `aria-selected` on category buttons (not `aria-pressed`)** — Category filter buttons behave as a tab-like selection (one active at a time), so `role="tab"` with `aria-selected` is semantically more accurate than toggle buttons with `aria-pressed`. Collection filter buttons use `aria-pressed` since they're independent toggles.

- **Photo lightbox as separate component (not inline)** — The lightbox is complex enough (209 lines: zoom, swipe, pan, thumbnail strip, keyboard nav) to warrant its own file rather than being embedded in BusinessDetailModal. It receives `photos`, `initialIndex`, `title`, `onClose` — clean interface with no dependency on business state.

- **Web Share API with multi-level fallback** — First tries `navigator.share()` (native on mobile), then falls back to `navigator.clipboard.writeText()`, then shows an error toast. The share cancelled case (`AbortError`) is explicitly caught and silently ignored.

- **Deep link URL format: `/business?open={id}`** — Existing deep-link handling in `business.tsx` already reads `?open=` from search params and opens the matching business. The share function generates URLs in this format for consistency.

- **SVG illustrations over icon-in-circle for empty states** — Custom inline SVGs provide more visual interest than a simple lucide icon in a colored circle. Three variants: magnifying glass with X for no search results, heart outline for no favorites, store with plus sign for no listings.

### Session 10: Admin Toggles for All 23 Messaging Features + Cross-Browser Audit + Live Testing

- **Feature flags for ALL messaging features (not just a subset)** — User explicitly requested "For all features in message module, can i have a toggle function in admin module" and confirmed "All messaging features." Added 13 new flags to bring total to 23 toggleable messaging features. Every UI element in the messages page is now gated by its corresponding feature flag.

- **19 `isFeatureEnabled()` variables wired at top of Messages component** — All feature flag checks are centralized at the top of the component (after hooks), stored in descriptive boolean variables (e.g. `gifStickersEnabled`, `oneToOneCallsEnabled`). This makes it easy to find and audit which features are gated.

- **`onDelete` changed from required to optional prop in MessageContextMenu** — When `deleteMessagesEnabled` is false, `onDelete` is passed as `undefined`. The TypeScript type was changed from `onDelete: () => void` to `onDelete?: () => void`, and the delete button render condition changed from `{isMine && (` to `{isMine && onDelete && (`.

- **VoiceMessageBubble accepts `voiceToTextEnabled` prop** — Rather than reading the feature flag inside the sub-component, the parent passes it down. This keeps the sub-component pure and testable.

- **Presence system and push notifications gated by feature flags** — The `useEffect` hooks for online/last-seen presence and FCM token registration check their respective feature flags before running. When disabled, the effects return early without setting up listeners or registering tokens.

- **iOS Safari PiP tap fix in GlobalCallOverlay** — Added `onTouchStart` handler alongside `onClick` on the PiP container div, plus `WebkitTapHighlightColor: 'transparent'`. Same pattern used across all 12 overlays in Session 3.

- **Cross-browser audit passed** — Thorough code audit of recent changes confirmed compatibility across Chrome, Safari, Firefox (desktop), iOS Safari, and Android Chrome. One critical issue found and fixed (iOS Safari PiP tap). All other patterns (pointer events for drag, backdrop filters, touch handlers) verified correct.

- **Live Chrome testing confirmed feature toggle system works end-to-end** — Toggled GIF & Stickers OFF in admin, navigated to Messages, confirmed GIF button disappeared from icon bar (5 icons → 4). Toggled back ON, confirmed it reappeared. Real-time Firestore `onSnapshot` sync between admin and messages UI works correctly with optimistic updates.

- **Duplicate page architecture analyzed — decision: DO NOT clean up now** — Full codebase audit revealed `src/pages/main/` contains near-identical copies of all 12 page files from `src/pages/`. `App.tsx` routing only imports from `src/pages/` (except `home.tsx`, `select-ethnicity.tsx`, and `signup.tsx` which are unique to `main/`). This means ~29,162 lines in `src/pages/main/` are dead code the router never loads. Of the 12 duplicated files, only `messages.tsx` is kept perfectly identical via the `cp` sync pattern; the other 11 have drifted apart (2–181 differing lines each). User decided this is too risky to touch right now — it's a major refactor that could break things. **Deferred to a future session.** When ready, the cleanup is: delete the 12 duplicate files from `src/pages/main/` (keep only `home.tsx`, `select-ethnicity.tsx`, `signup.tsx`), and eliminate the `cp` sync pattern entirely. This would cut the codebase from ~76k to ~47k lines.

- **Codebase size audit (Session 10)** — Total: **76,521 lines** (68,207 TSX + 6,929 TS + 500 CSS + 258 Cloud Functions + 627 config). Unique source (excluding `main/` duplicates): **~44,574 lines**. 85 source files (61 TSX, 22 TS, 2 CSS). Top 5 largest: `messages.tsx` (5,744), `housing.tsx` (2,825), `events.tsx` (2,788), `admin.tsx` (2,759), `feed.tsx` (2,703).

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

### Session 17 (March 24, 2026) — Business Phase 4 continued: High-Impact UX + Fixes
| Task | File(s) Changed/Created | Status |
|------|------------------------|--------|
| Admin verification toggle in Listings section | `src/pages/admin.tsx` | ✅ |
| Fix verification not showing on business page (missing field mapping) | `src/hooks/useBusinessData.ts` | ✅ |
| #35: Customer Q&A — Firestore subcollection, optimistic UI, search | `src/components/business/BusinessQASection.tsx` (NEW, ~384 lines) | ✅ |
| #35: Q&A Firestore security rules | `firestore.rules` | ✅ |
| #35: Q&A refactored to native `<details>`/`<summary>` with chevron | `src/components/business/BusinessQASection.tsx` | ✅ |
| #35: Q&A search bar (debounced 250ms, appears at 3+ questions) | `src/components/business/BusinessQASection.tsx` | ✅ |
| #36: Booking/Reservation URL field + display in detail modal | `src/reducers/businessReducer.ts`, `src/hooks/useBusinessData.ts`, `BusinessCreateModal`, `BusinessEditModal`, `BusinessDetailModal` | ✅ |
| #24: Open Now indicator — shared `parseOpenNow()` utility | `src/components/business/businessUtils.ts` (NEW, ~85 lines) | ✅ |
| #24: Open/Closed status pill on BusinessCard tiles | `src/components/business/BusinessCard.tsx` | ✅ |
| #24: Open/Closed status in FeaturedCarousel cards | `src/components/business/FeaturedCarousel.tsx` | ✅ |
| #24: Open Now indicator in BusinessDetailModal next to Hours heading | `src/components/business/BusinessDetailModal.tsx` | ✅ |
| Fix: Photo carousel arrows removed — was overlapping action buttons | `src/components/business/BusinessDetailModal.tsx` | ✅ |
| Fix: Carousel state lifted to modal level for z-index management | `src/components/business/BusinessDetailModal.tsx` | ✅ |
| Fix: Featured carousel background color gap (light/dark mode) | `src/components/business/FeaturedCarousel.tsx` | ✅ |
| Fix: "Failed to save deals" — Firestore undefined value rejection | `src/components/business/BusinessDetailModal.tsx`, `src/pages/business.tsx` | ✅ |
| Fix: Share API `execCommand('copy')` fallback for Firefox desktop | `src/components/business/BusinessDetailModal.tsx` | ✅ |
| Fix: iOS Safari modal scroll bleed-through (position:fixed body) | `src/components/business/BusinessDetailModal.tsx` | ✅ |
| Fix: Touch event safety checks (`touches.length` guard) | `src/components/business/BusinessDetailModal.tsx` | ✅ |
| Fix: `verifiedAt: new Date()` → `serverTimestamp()` in admin.tsx | `src/pages/admin.tsx` | ✅ |
| Cross-browser testing (Chrome, Safari, Firefox, iOS Safari, Android Chrome) | All business files | ✅ |
| Sync to main/business.tsx | `src/pages/main/business.tsx` | ✅ |
| TypeScript check — zero errors | `tsc --noEmit` passes clean | ✅ |

**New files created in Session 17:**
- `src/components/business/BusinessQASection.tsx` (~384 lines — Q&A with Firestore, search, details/summary)
- `src/components/business/businessUtils.ts` (~85 lines — shared parseOpenNow utility)

**Updated file line counts:**
- `BusinessDetailModal.tsx`: ~680 → ~920 lines (+240, Q&A integration, booking link, carousel refactor, iOS fixes)
- `BusinessCard.tsx`: 164 → ~170 lines (+6, Open/Closed status pill)
- `FeaturedCarousel.tsx`: 108 → ~120 lines (+12, Open/Closed status, background fix)
- `businessReducer.ts`: ~580 → ~600 lines (+20, bookingUrl field)
- `useBusinessData.ts`: ~250 → ~340 lines (+90, missing field mapping fix, bookingUrl)
- `admin.tsx`: ~2780 → ~2820 lines (+40, verification toggle)
- `firestore.rules`: added Q&A subcollection rules

### Session 12 (March 23, 2026) — Business Phase 2 Steps 7-8: Component Extraction + Memoization
| Task | File(s) Changed/Created | Status |
|------|------------------------|--------|
| Extract BusinessCard.tsx (153 lines, React.memo grid card) | `src/components/business/BusinessCard.tsx` (NEW) | ✅ |
| Extract FeaturedCarousel.tsx (99 lines, React.memo featured scroll) | `src/components/business/FeaturedCarousel.tsx` (NEW) | ✅ |
| Extract BusinessDetailModal.tsx (496 lines, full detail modal) | `src/components/business/BusinessDetailModal.tsx` (NEW) | ✅ |
| Extract BusinessEditModal.tsx (243 lines, edit form + photo uploader) | `src/components/business/BusinessEditModal.tsx` (NEW) | ✅ |
| Extract BusinessCreateModal.tsx (245 lines, create form + photo uploader) | `src/components/business/BusinessCreateModal.tsx` (NEW) | ✅ |
| Extract BusinessModals.tsx (315 lines, TIN/Delete/ContextMenu/Report/Block) | `src/components/business/BusinessModals.tsx` (NEW) | ✅ |
| Memoize openMenu, closeMenu, handleSelectBusiness, isOwnerOrAdmin | `src/pages/business.tsx` | ✅ |
| Update business.tsx to import and use all 6 extracted components | `src/pages/business.tsx` (1604→552 lines) | ✅ |
| Fix blockTargetUser prop type (`userId`→`uid` to match reducer) | `src/components/business/BusinessModals.tsx` | ✅ |
| Sync to main/business.tsx | `src/pages/main/business.tsx` | ✅ |
| TypeScript check — zero errors | `tsc --noEmit` passes clean | ✅ |

**Phase 2 line count progression:**
- Start of Phase 2: ~2500 lines (business.tsx monolith)
- After Steps 1-2 (useReducer): ~2188 lines + ~514 lines reducer
- After Steps 3-6 (hooks): ~1604 lines + ~625 lines hooks
- After Steps 7-8 (components): **552 lines** + ~1551 lines components
- **Total Phase 2 reduction: 78% of main file** (2500→552)

**Business module file structure (Phase 3 complete):**
```
src/
  reducers/
    businessReducer.ts        (514 lines — state, actions, types)
  hooks/
    useBusinessData.ts        (250 lines — CRUD, pagination, favorites)
    useBusinessFilters.ts     (95 lines — search, filter, sort)
    useBusinessModeration.ts  (170 lines — report, block, mute)
    useBusinessReviews.ts     (110 lines — fetch, submit reviews)
  components/business/
    businessConstants.ts      (100 lines — categories, emojis, colors)
    businessValidation.ts     (75 lines — form validation, helpers)
    imageUtils.ts             (40 lines — compression, size limit)
    BusinessCard.tsx           (164 lines — grid card, React.memo, ARIA)
    FeaturedCarousel.tsx       (108 lines — featured scroll, React.memo, ARIA)
    BusinessDetailModal.tsx    (615 lines — detail + reviews + lightbox + share)
    BusinessEditModal.tsx      (257 lines — edit form + photos + ESC)
    BusinessCreateModal.tsx    (257 lines — create form + photos + ESC)
    BusinessModals.tsx         (445 lines — TIN/Delete/Menu/Report/Block + focus trap)
    PhotoLightbox.tsx          (209 lines — fullscreen gallery, zoom, swipe, keyboard)
  pages/
    business.tsx              (598 lines — orchestrator + layout + ARIA)
    main/business.tsx         (598 lines — exact copy)
```

### Sessions 14-16 (March 23, 2026) — Business Phase 4: Map View + Analytics Dashboard + Bug Fixes
| Task | File(s) Changed/Created | Status |
|------|------------------------|--------|
| #29: Map/List view toggle with `role="radiogroup"` | `src/pages/business.tsx` | ✅ |
| #29: BusinessMapView.tsx — Leaflet CDN load, OpenStreetMap tiles, custom markers | `src/components/business/BusinessMapView.tsx` (NEW, ~380 lines) | ✅ |
| #29: React.lazy() + Suspense code-splitting for map component | `src/pages/business.tsx` | ✅ |
| #29: Near Me geolocation button with distance badges | `src/components/business/BusinessMapView.tsx` | ✅ |
| #29: User location pulsing blue dot on map | `src/components/business/BusinessMapView.tsx` | ✅ |
| #29: Category-colored markers with CSS hover animation | `src/components/business/BusinessMapView.tsx` | ✅ |
| #30: businessAnalytics.ts — analytics service with Firestore subcollection | `src/services/businessAnalytics.ts` (NEW, ~175 lines) | ✅ |
| #30: BusinessAnalyticsTab.tsx — 4 stat cards + CSS bar charts | `src/components/business/BusinessAnalyticsTab.tsx` (NEW, ~195 lines) | ✅ |
| #30: Analytics dashboard in BusinessDetailModal (owner/admin only) | `src/components/business/BusinessDetailModal.tsx` (~680 lines) | ✅ |
| #30: Analytics tracking calls (recordView, recordShare, recordContactClick) | `src/components/business/BusinessDetailModal.tsx` | ✅ |
| Fix: Map markers race condition — added `mapReady` state flag | `src/components/business/BusinessMapView.tsx` | ✅ |
| Fix: Firestore analytics permissions — added `analytics/{dateKey}` subcollection rule | `firestore.rules` | ✅ |
| Fix: Map marker click UX — replaced React popup with Leaflet native `bindPopup()` | `src/components/business/BusinessMapView.tsx` (REWRITTEN) | ✅ |
| Fix: Added `bindTooltip()` for hover showing business name | `src/components/business/BusinessMapView.tsx` | ✅ |
| Fix: Delegated click handler for popup "View Details" buttons | `src/components/business/BusinessMapView.tsx` | ✅ |
| Fix: CSS injection for Leaflet popup styling | `src/components/business/BusinessMapView.tsx` | ✅ |
| Added `viewMode`, `userLocation`, `geolocating`, `analyticsData`, `analyticsLoading` to reducer | `src/reducers/businessReducer.ts` (~580 lines) | ✅ |
| Sync to main/business.tsx | `src/pages/main/business.tsx` | ✅ |

**New files created in Sessions 14-16:**
- `src/components/business/BusinessMapView.tsx` (~380 lines — complete rewrite from scratch)
- `src/services/businessAnalytics.ts` (~175 lines)
- `src/components/business/BusinessAnalyticsTab.tsx` (~195 lines)

**Updated file line counts:**
- `business.tsx`: 598 → ~630 lines (+32, map toggle + lazy import + geolocation handlers)
- `BusinessDetailModal.tsx`: 615 → ~680 lines (+65, analytics tab + tracking calls)
- `businessReducer.ts`: 514 → ~580 lines (+66, viewMode/userLocation/geolocating/analytics state + actions)
- `firestore.rules`: added analytics subcollection rules (lines 94-98)

**Business module file structure (Phase 4 in progress — Session 17):**
```
src/
  reducers/
    businessReducer.ts        (~600 lines — state, actions, types + map/analytics/booking state)
  hooks/
    useBusinessData.ts        (~390 lines — CRUD, onSnapshot listener, pagination, favorites) ← UPDATED Session 18
    useBusinessFilters.ts     (~130 lines — search, filter, sort, distance caching) ← UPDATED Session 18
    useBusinessModeration.ts  (170 lines — report, block, mute)
    useBusinessReviews.ts     (110 lines — fetch, submit reviews)
  services/
    businessAnalytics.ts      (~175 lines — recordView, recordContactClick, recordShare, recordFavorite, fetchBusinessAnalytics)
  components/business/
    businessConstants.ts      (100 lines — categories, emojis, colors)
    businessValidation.ts     (75 lines — form validation, helpers)
    businessUtils.ts          (~120 lines — parseOpenNow, getDistanceMiles, formatDistance) ← UPDATED Session 18
    imageUtils.ts             (40 lines — compression, size limit)
    BusinessCard.tsx           (~190 lines — grid card + Open/Closed + distance badge, React.memo) ← UPDATED Session 18
    FeaturedCarousel.tsx       (~135 lines — featured scroll + Open/Closed + distance badge, React.memo) ← UPDATED Session 18
    BusinessCSVImport.tsx      (~480 lines — 4-step CSV import wizard, lazy-loaded) ← NEW Session 18
    VirtualizedBusinessGrid.tsx (~160 lines — IntersectionObserver + content-visibility grid) ← NEW Session 18
    BusinessDetailModal.tsx    (~920 lines — detail + reviews + Q&A + booking + lightbox + share + analytics + carousel refactor)
    BusinessEditModal.tsx      (257 lines — edit form + photos + booking URL + ESC)
    BusinessCreateModal.tsx    (257 lines — create form + photos + booking URL + ESC)
    BusinessModals.tsx         (445 lines — TIN/Delete/Menu/Report/Block + focus trap)
    PhotoLightbox.tsx          (209 lines — fullscreen gallery, zoom, swipe, keyboard)
    BusinessQASection.tsx      (~384 lines — Q&A with Firestore, search, details/summary) ← NEW Session 17
    BusinessMapView.tsx        (~380 lines — Leaflet map, custom markers, native popups, geolocation)
    BusinessAnalyticsTab.tsx   (~195 lines — owner analytics dashboard, 4 stat cards, bar charts)
  pages/
    business.tsx              (~680 lines — orchestrator + layout + map toggle + filter chips + CSV import) ← UPDATED Session 18
    main/business.tsx         (~680 lines — exact copy)
```
**Total business module: ~4500+ lines across 16 component files + orchestrator + service + reducer + 4 hooks**

### Session 13 (March 23, 2026) — Business Phase 3: UX Polish & Accessibility
| Task | File(s) Changed/Created | Status |
|------|------------------------|--------|
| #18: ARIA labels on all interactive elements (buttons, cards, inputs, modals) | All 8 business component files | ✅ |
| #19: ESC-to-close on all 7 modals (Detail, Create, Edit, TIN, Delete, Report, Block) | `BusinessDetailModal`, `BusinessCreateModal`, `BusinessEditModal`, `BusinessModals` | ✅ |
| #19: Focus trapping (shared `useModalA11y` hook) + return-focus-on-close | `BusinessModals.tsx`, `BusinessDetailModal.tsx` | ✅ |
| #19: Arrow key navigation in ContextMenu | `BusinessModals.tsx` | ✅ |
| #19: `focus-visible:ring-2` on all interactive elements | All business component files | ✅ |
| #19: Keyboard-accessible cards (tabIndex, Enter/Space handlers) | `BusinessCard.tsx`, `FeaturedCarousel.tsx` | ✅ |
| #20: `loading="lazy"` + `decoding="async"` on all images | `BusinessCard`, `FeaturedCarousel`, `BusinessCreateModal`, `BusinessEditModal`, `business.tsx` | ✅ |
| #21: PhotoLightbox.tsx — full-screen gallery with zoom, swipe, keyboard nav | `src/components/business/PhotoLightbox.tsx` (NEW, 209 lines) | ✅ |
| #21: Integrate lightbox into BusinessDetailModal photo carousel | `BusinessDetailModal.tsx` | ✅ |
| #22: Contextual SVG empty state illustrations (search, favorites, no listings) | `src/pages/business.tsx` | ✅ |
| #22: Enhanced empty state CTAs (Clear Search button, Write the First Review) | `business.tsx`, `BusinessDetailModal.tsx` | ✅ |
| #23: Web Share API with clipboard fallback in BusinessDetailModal | `BusinessDetailModal.tsx` | ✅ |
| #23: Share button in hero banner, deep link URL generation | `BusinessDetailModal.tsx` | ✅ |
| Sync to main/business.tsx | `src/pages/main/business.tsx` | ✅ |
| TypeScript check — zero errors | `tsc --noEmit` passes clean | ✅ |

**Phase 3 line count changes:**
- `business.tsx`: 552 → 598 (+46, ARIA attributes + enhanced empty states)
- `BusinessDetailModal.tsx`: 496 → 615 (+119, lightbox integration + share + focus trap + ARIA)
- `BusinessModals.tsx`: 315 → 445 (+130, useModalA11y hook + ESC/focus trap + ARIA on all modals)
- `BusinessCard.tsx`: 153 → 164 (+11, ARIA + keyboard handlers)
- `FeaturedCarousel.tsx`: 99 → 108 (+9, section/role/ARIA + keyboard scroll)
- `BusinessCreateModal.tsx`: 245 → 257 (+12, ESC handler + dialog role + ARIA)
- `BusinessEditModal.tsx`: 243 → 257 (+14, ESC handler + dialog role + ARIA)
- **New: `PhotoLightbox.tsx`**: 209 lines
- **Total business module**: 2653 lines across 9 files (was 2148 across 8 files)

### Session 11 (March 23, 2026) — Business Phase 2 Steps 1-6: useReducer + Custom Hooks
| Task | File(s) Changed/Created | Status |
|------|------------------------|--------|
| Fix 42 TypeScript errors from useReducer migration | `src/pages/business.tsx` | ✅ |
| 15 bare variable refs missing `state.` prefix | `src/pages/business.tsx` | ✅ |
| 3 `photoUploading.loading` → `photoUploading` fixes | `src/pages/business.tsx` | ✅ |
| 4 null safety fixes (`selectedBusiness!.id` in guarded blocks) | `src/pages/business.tsx` | ✅ |
| 1 missing `Scale` icon import | `src/pages/business.tsx` | ✅ |
| Extract useBusinessData hook (CRUD, pagination, favorites, infinite scroll) | `src/hooks/useBusinessData.ts` (NEW, ~250 lines) | ✅ |
| Extract useBusinessFilters hook (search debounce, filtering, sorting) | `src/hooks/useBusinessFilters.ts` (NEW, ~95 lines) | ✅ |
| Extract useBusinessModeration hook (report, block, mute, 3-strike) | `src/hooks/useBusinessModeration.ts` (NEW, ~170 lines) | ✅ |
| Extract useBusinessReviews hook (fetch, submit, optimistic update) | `src/hooks/useBusinessReviews.ts` (NEW, ~110 lines) | ✅ |
| Rewire business.tsx to use all 4 hooks | `src/pages/business.tsx` (2188→1604 lines) | ✅ |
| Sync to main/business.tsx | `src/pages/main/business.tsx` | ✅ |
| Deploy and live test (grid, carousel, detail, search, context menu) | Firebase Hosting | ✅ |
| TypeScript check — zero errors | `tsc --noEmit` passes clean | ✅ |

### Session 10 (March 22, 2026) — Admin Toggles for All 23 Messaging Features + Cross-Browser Audit + Live Testing
| Task | File(s) Changed | Commit |
|------|-----------------|--------|
| Added 13 new feature flags to DEFAULT_FEATURES | `src/contexts/FeatureSettingsContext.tsx` | `a01a5b3` |
| Added 14 new entries to FEATURE_GROUPS (messages section) | `src/contexts/FeatureSettingsContext.tsx` | `a01a5b3` |
| Wired 19 `isFeatureEnabled()` conditionals in messages UI | `src/pages/messages.tsx` | `a01a5b3` |
| Gated 1:1 call buttons with `oneToOneCallsEnabled` | `src/pages/messages.tsx` | `a01a5b3` |
| Gated group call buttons with `groupCallsEnabled` | `src/pages/messages.tsx` | `a01a5b3` |
| Gated emoji picker, file sharing, GIF, disappearing timer in icon bar | `src/pages/messages.tsx` | `a01a5b3` |
| Gated voice recorder with `voiceMessagesEnabled` | `src/pages/messages.tsx` | `a01a5b3` |
| Gated link previews, read receipts, pinned messages, search, wallpaper | `src/pages/messages.tsx` | `a01a5b3` |
| Gated context menu items (forward, pin, star, delete) — pass `undefined` when disabled | `src/pages/messages.tsx` | `a01a5b3` |
| Gated online/last seen (ChatAvatar prop + presence text + useEffect guard) | `src/pages/messages.tsx` | `a01a5b3` |
| Gated push notifications useEffect with `pushNotificationsEnabled` | `src/pages/messages.tsx` | `a01a5b3` |
| Changed `onDelete` from required to optional in MessageContextMenu | `src/pages/messages.tsx` | `a01a5b3` |
| Added `voiceToTextEnabled` prop to VoiceMessageBubble | `src/pages/messages.tsx` | `a01a5b3` |
| Gated 3-dots menu items (wallpaper, starred, pinned, disappearing) | `src/pages/messages.tsx` | `a01a5b3` |
| Gated screen sharing in GroupCallOverlay with `screenSharingEnabled` | `src/components/GroupCallOverlay.tsx` | `a01a5b3` |
| Completed `setDoc` dedup fix in GroupCallOverlay (from Session 9) | `src/components/GroupCallOverlay.tsx` | `a01a5b3` |
| Fixed iOS Safari PiP tap — added `onTouchStart` + `WebkitTapHighlightColor` | `src/components/GlobalCallOverlay.tsx` | `a01a5b3` |
| Synced messages.tsx to main/messages.tsx | `src/pages/main/messages.tsx` | `a01a5b3` |
| Cross-browser compatibility audit (Chrome, Safari, Firefox, iOS Safari, Android Chrome) | N/A (code review) | N/A |
| Live Chrome testing — verified all 23 admin toggles + toggle-off verification | N/A (manual test) | N/A |

**All 23 messaging feature flags:**
`messages_voiceMessages`, `messages_voiceToText`, `messages_emojiPicker`, `messages_textFormatting`, `messages_typingIndicators`, `messages_readReceipts`, `messages_wallpaper`, `messages_search`, `messages_groupMessaging`, `messages_reactions`, `messages_fileSharing`, `messages_linkPreviews`, `messages_gifStickers`, `messages_disappearingMessages`, `messages_groupCalls`, `messages_oneToOneCalls`, `messages_screenSharing`, `messages_pushNotifications`, `messages_onlineLastSeen`, `messages_pinnedMessages`, `messages_starredMessages`, `messages_forwardMessages`, `messages_deleteMessages`

### Session 9 (March 22, 2026) — Duplicate Call Event Fix + Share Link + Draggable PiP
| Task | File(s) Changed | Commit |
|------|-----------------|--------|
| Fix duplicate 1:1 call events — `setDoc` with deterministic ID `call_${callId}` | `src/components/GlobalCallOverlay.tsx` | `a01a5b3` |
| Fix duplicate 1:1 call events — `firedEndedCallIds` Set dedup guard | `src/utils/webrtc.ts` | `a01a5b3` |
| Fix duplicate group call events — `setDoc` with deterministic ID `groupcall_${roomId}` | `src/components/GroupCallOverlay.tsx` | `a01a5b3` |
| Removed unused `addDoc` import from GroupCallOverlay | `src/components/GroupCallOverlay.tsx` | `a01a5b3` |
| Share call link — `navigator.share` (mobile) / clipboard (desktop) | `src/components/GroupCallOverlay.tsx` | `a01a5b3` |
| Deep link handler for `?joinCall={roomId}&conv={convId}` | `src/pages/messages.tsx` | `a01a5b3` |
| Draggable PiP — pointer events with 5px drag threshold | `src/components/GroupCallOverlay.tsx` | `a01a5b3` |
| Synced messages.tsx to main/messages.tsx | `src/pages/main/messages.tsx` | `a01a5b3` |
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
| Voice-to-Text Transcription — client UI (Transcribe button + inline transcript) | `src/pages/messages.tsx` | `a01a5b3` |
| Firebase Functions client SDK integration | `src/services/firebase.ts` | `a01a5b3` |
| Per-message timer picker — fixed positioning (absolute→fixed with getBoundingClientRect) | `src/pages/messages.tsx` | `a01a5b3` |
| Conversation lastMessage update on disappearing message expiry | `src/pages/messages.tsx` | `a01a5b3` |
| Undo toast feature — commented out (undoSend, UndoToast, state vars, triggers) | `src/pages/messages.tsx` | `a01a5b3` |
| Node.js engine updated 18→22 for Cloud Functions | `functions/package.json` | `a01a5b3` |
| Firebase tools updated 15.9→15.11 (global) | N/A (global npm) | N/A |
| All above synced to `src/pages/main/messages.tsx` | `src/pages/main/messages.tsx` | `a01a5b3` |
| Group Calls — GroupCallManager (mesh WebRTC, up to 8 participants) | `src/utils/groupWebrtc.ts` (NEW) | `a01a5b3` |
| Group Calls — GroupCallOverlay (multi-party grid UI, controls) | `src/components/GroupCallOverlay.tsx` (NEW) | `a01a5b3` |
| Group Calls — integration in messages (start/join buttons, active call banner) | `src/pages/messages.tsx` | `a01a5b3` |
| Group Calls — mounted in MainLayout | `src/layouts/MainLayout.tsx` | `a01a5b3` |
| Group Calls — Firestore rules for groupCalls collection | `firestore.rules` | `a01a5b3` |
| Screen sharing support | `src/utils/groupWebrtc.ts` | `a01a5b3` |

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
| Disappearing Messages — conversation default timer (Off + 5 options) | `src/pages/messages.tsx` | `e2ab6e3` |
| Disappearing Messages — per-message override toggle in icon bar | `src/pages/messages.tsx` | `e2ab6e3` |
| Disappearing Messages — settings overlay in 3-dots menu | `src/pages/messages.tsx` | `e2ab6e3` |
| Disappearing Messages — cleanup effect (15s interval, useRef pattern) | `src/pages/messages.tsx` | `e2ab6e3` |
| Disappearing Messages — Timer icon on message bubbles | `src/pages/messages.tsx` | `e2ab6e3` |
| Disappearing Messages — banner below chat header | `src/pages/messages.tsx` | `e2ab6e3` |
| Fixed send regression (setState in async flow) | `src/pages/messages.tsx` | `e2ab6e3` |
| All above synced to `src/pages/main/messages.tsx` | `src/pages/main/messages.tsx` | `e2ab6e3` |

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
| File/Document Sharing (base64 in Firestore, 700KB limit) | `src/pages/messages.tsx` | `e2ab6e3` |
| Link Previews via microlink.io (LinkPreviewCard component) | `src/pages/messages.tsx` | `e2ab6e3` |
| GIF/Sticker Support via Giphy API (GifPicker component) | `src/pages/messages.tsx` | `e2ab6e3` |
| File extension fallback validation (MIME unreliable) | `src/pages/messages.tsx` | `e2ab6e3` |
| Clear error messages (filename, size, guidance) | `src/pages/messages.tsx` | `e2ab6e3` |
| iOS Safari file download fallback (`window.open`) | `src/pages/messages.tsx` | `e2ab6e3` |
| URL linkification in message text (truncated to 50 chars) | `src/pages/messages.tsx` | `e2ab6e3` |
| All above synced to `src/pages/main/messages.tsx` | `src/pages/main/messages.tsx` | `e2ab6e3` |

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

### Codebase Size (as of Session 10)
- **Total: 76,521 lines** (68,207 TSX + 6,929 TS + 500 CSS + 258 Cloud Functions + 627 config)
- **Unique source (excluding `main/` duplicates): ~44,574 lines**
- **85 source files** (61 TSX, 22 TS, 2 CSS)

### All Pages (functional with Firestore CRUD)
| Page | File | Lines | Status |
|------|------|-------|--------|
| Home (landing) | `src/pages/main/home.tsx` | ~127 | Done |
| Feed | `src/pages/feed.tsx` | 2,703 | Done |
| Discover | `src/pages/discover.tsx` | 1,735 | Done |
| Business | `src/pages/business.tsx` | ~630 (was 2,500) | Done — Phases 1-3 complete + Phase 4 in progress (map view, analytics, Q&A, booking, Open Now, admin verify done; remaining items #25, #28, #37-42 pending) |
| Housing | `src/pages/housing.tsx` | 2,825 | Done + 7 enhancements (state only) |
| Events | `src/pages/events.tsx` | 2,788 | Done |
| Travel | `src/pages/travel.tsx` | — | Done |
| Forum | `src/pages/forum.tsx` | 2,354 | Done |
| Messages | `src/pages/messages.tsx` | 5,744 | Done (E2EE, voice, formatting, cross-browser, push notifs, presence, disappearing msgs, voice-to-text, 23 feature flags) |
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
- **Admin Feature Toggles:** ✅ COMPLETED (Session 10) — All 23 messaging features toggleable from admin panel

### Business Module Phases 1-3 — COMPLETED
- **Phase 1:** Critical fixes (pagination, debounce, validation, touch targets, error handling)
- **Phase 2 Steps 1-8:** Architecture refactor — useReducer, 4 custom hooks, 6 JSX components, memoization. `business.tsx` reduced from ~2,500 → 552 lines (78% reduction).
- **Phase 3 (#18-#23):** UX Polish & Accessibility — ARIA labels, keyboard nav, focus trapping, lazy loading, photo lightbox, empty states, share functionality.

### Business Module Phase 4 — IN PROGRESS
- **#29 Map View:** ✅ COMPLETED — Leaflet + OpenStreetMap with custom markers, native popups, geolocation
- **#30 Analytics Dashboard:** ✅ COMPLETED — Firestore subcollection analytics, owner-only dashboard, 4 stat cards
- **#24 Open Now Indicator:** ✅ COMPLETED — parseOpenNow utility, status pills on cards/carousel/detail
- **#35 Customer Q&A:** ✅ COMPLETED — Firestore subcollection, optimistic UI, search, details/summary
- **#36 Booking/Reservation:** ✅ COMPLETED — bookingUrl field, create/edit/detail integration
- **Admin Verification Toggle:** ✅ COMPLETED — toggle in admin listings, verified badge on business page
- **#25 Filter Chips UI:** ✅ COMPLETED (Session 18) — Active filter chips bar with search/category/heritage/collection chips, clear-all button
- **#31 Direct Messaging to Business:** ✅ COMPLETED (verified Session 18) — Message button wired to messaging system
- **#33 Deals/Promotions Creation UI:** ✅ COMPLETED (verified Session 18) — Full deal creation in create/edit modals
- **#34 Follow/Subscribe to Business:** ✅ COMPLETED (verified Session 18) — Follow button with Firestore arrayUnion/arrayRemove
- **#37 CSV Bulk Import:** ✅ COMPLETED (Session 18) — 4-step import wizard (upload → preview/validate → batch write → done), smart column mapping, lazy-loaded
- **#38 Distance-Based Sorting:** ✅ COMPLETED (Session 18) — Haversine formula, "Nearest" sort pill with auto-geolocation, distance badges on cards/carousel, distance caching
- **#39 Real-Time onSnapshot:** ✅ COMPLETED (Session 18) — Switched from one-time getDocs to live onSnapshot listener for auto-updating business list, kept getDocs for "load more" pagination
- **#40 List Virtualization:** ✅ COMPLETED (Session 18) — IntersectionObserver + content-visibility chunked grid, zero-dependency, seamless with CSS Grid responsive layouts
- **Remaining Phase 4 items (#28, #41-#42):** NOT STARTED — includes advanced search/filters (#28) and additional advanced features. See `Business_Module_Enhancement_Roadmap.docx` for full list.

### Duplicate Page Architecture (deferred cleanup — DO NOT TOUCH NOW)
- `src/pages/main/` contains near-identical copies of 12 pages from `src/pages/`
- `App.tsx` only imports from `src/pages/` — the `main/` copies are dead code (~29,162 lines)
- Only 3 files are unique to `main/`: `home.tsx`, `select-ethnicity.tsx`, `signup.tsx`
- Only `messages.tsx` is kept in sync via `cp` command; the other 11 have drifted
- **User decision (Session 10): too risky to refactor now, deferred to a future session**
- When ready: delete 12 duplicate files from `main/`, keep the 3 unique ones, eliminate `cp` sync pattern

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

### Immediate — Pending Deploys & Commits
- **Session 18 changes need commit + push + build + deploy** — Run from macOS terminal:
  ```bash
  cd /Users/sarathsatheesan/ethniCity_03_19_2026/sangam-pwa-v2
  git add src/components/business/BusinessCSVImport.tsx src/components/business/VirtualizedBusinessGrid.tsx src/components/business/businessUtils.ts src/components/business/BusinessCard.tsx src/components/business/FeaturedCarousel.tsx src/hooks/useBusinessData.ts src/hooks/useBusinessFilters.ts src/reducers/businessReducer.ts src/pages/business.tsx src/pages/main/business.tsx
  git commit -m "feat: Phase 4 filter chips, CSV import, distance sorting, real-time onSnapshot, list virtualization (#25,#37-#40)"
  git push origin main
  npm run build && firebase deploy --only hosting
  ```
- **Session 17 changes also need commit** (if not already committed):
  ```bash
  git add src/components/business/BusinessQASection.tsx src/components/business/BusinessDetailModal.tsx src/components/business/BusinessCreateModal.tsx src/components/business/BusinessEditModal.tsx src/pages/admin.tsx firestore.rules
  git commit -m "feat: Phase 4 Q&A system, Open Now indicator, booking URL, admin verification, carousel/deals fixes"
  git push origin main
  npm run build && firebase deploy --only hosting,firestore:rules
  ```
  **Important:** Session 17 deploy includes `firestore:rules` for Q&A subcollection permissions.
- **App is deployed and live** at `https://mithr-1e5f4.web.app`.
- **Replace `PENDING_VAPID_KEY`** in push notification useEffect (`src/pages/main/messages.tsx` line ~2580) with real VAPID key from Firebase Console > Project Settings > Cloud Messaging — this is the ONLY remaining blocker for push notifications.
- **Cloud Functions already deployed** — `transcribeVoiceMessage` and `sendNewMessageNotification` are live on Cloud Run.

### Next Up — Continue Business Phase 4 (remaining items #28, #41-#42)
- **Most Phase 4 items are now COMPLETE** — only #28 (Advanced search/filters) and #41-#42 (additional advanced features) remain
- Remaining items from `Business_Module_Enhancement_Roadmap.docx`:
  - #28: Advanced search/filters
  - #41-#42: Additional advanced features
- The architecture is solid for adding these features — reducer + hooks + components pattern is in place

### Discover Page Improvements (38-item roadmap)
- User has a 38-item Discover page improvement roadmap ready to begin
- This is the next major feature work after Business Phase 4

### Future Enhancement: SFU for 16+ Participants
Current group calls use mesh topology (max 8). For 16+ participants, deploy an SFU server (mediasoup or LiveKit) on a VPS with public IP + UDP support. Cloud Run won't work for WebRTC media.

### High Priority
1. **Continue Business Phase 4** — Remaining roadmap items #25, #28, #37-#42.
2. **Wire up Housing UI for the 7 enhancements** — State is ready, just needs JSX.
3. **Stabilize the call system** — Replace free TURN servers with paid provider.
4. **Test E2EE thoroughly** — Cross-browser decryption verification.

### Medium Priority
5. **Clean up duplicate page architecture** — Delete 12 duplicate files from `src/pages/main/` (keep only `home.tsx`, `select-ethnicity.tsx`, `signup.tsx`). Eliminates ~29,162 lines of dead code and the `cp` sync pattern. Cuts codebase from ~76k to ~47k lines. **User deferred in Session 10** — do this when the app is in a stable state.
6. **Refactor large page files** — Messages (~5,744 lines), Admin (2,759), Housing (2,825), Events (2,788), Feed (2,703). Business is now the model to follow (useReducer + hooks + components pattern).
7. **Map integration for other modules** — Housing listings and event locations can reuse the Leaflet CDN pattern from BusinessMapView.
8. **Add pagination** — Implement infinite scroll or cursor-based pagination in remaining modules.

### Lower Priority
9. **Content moderation** — Wire utility into all submission flows
10. **Testing** — No tests exist. Add unit tests for encryption utils.
11. **npm vulnerability maintenance** — Upgrade transitive deps (test for breakage)

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

# Deploy to Firebase (hosting + functions + firestore rules — skip storage)
firebase deploy --only hosting,functions,firestore

# All-in-one build + deploy
./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build && firebase deploy --only hosting,functions,firestore

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
| `src/pages/messages.tsx` | Main messages page (~5,500+ lines). ALL overlays have cross-browser touch handlers. Includes LinkPreviewCard, GifPicker, file sharing, URL linkification, push notifications, presence, disappearing messages, voice-to-text transcription. Undo toast code commented out. ALL 23 messaging features gated by `isFeatureEnabled()` flags. |
| `src/pages/main/messages.tsx` | **DUPLICATE** of above — MUST be kept in sync via `cp` |
| `src/index.css` | CSS variables for Aurora theme + dark mode. Lines 90–98 = light mode msg vars. Lines 104–142 = `:root.dark`. Lines 143–151 = `@media` for `--msg-header-bg`/`--msg-header-text`. |
| `firestore.rules` | Security rules — messages subcollection (read/create/update/delete), businesses/analytics subcollection (lines 94-98), all collections for the app |
| `src/components/layout/ModuleSelector.tsx` | Nav pill bar — auto-scroll to active pill + request badge |
| `src/pages/main/home.tsx` | Landing page with module tiles + Discover request badge |
| `src/hooks/useIncomingRequests.ts` | Real-time pending request count (Firestore listener) |
| `src/utils/encryption.ts` | Full E2EE implementation (v1 + v2 + group) |
| `src/utils/webrtc.ts` | CallManager class, WebRTC signaling |
| `src/components/GlobalCallOverlay.tsx` | Call UI (global, persists across nav) |
| `src/components/ClickOutsideOverlay.tsx` | Already had full cross-browser support |
| `src/contexts/FeatureSettingsContext.tsx` | Feature flags system — `DEFAULT_FEATURES` (23 messaging flags + module flags), `FEATURE_GROUPS` (admin UI groups), `isFeatureEnabled()` hook, real-time Firestore `onSnapshot` on `appConfig/featureSettings`, optimistic toggle updates |
| `src/contexts/AuthContext.tsx` | Auth state, user profile, admin detection |
| `src/contexts/UserSettingsContext.tsx` | Dark mode toggle (`.dark` class on `<html>`) |
| `src/constants/config.ts` | App config including ENCRYPTION_SALT |
| `src/reducers/businessReducer.ts` | Business state types (BusinessState, BusinessAction, Business, BusinessReview, Deal, BusinessFormData), createInitialState(), businessReducer() — ~514 lines |
| `src/hooks/useBusinessData.ts` | Business CRUD, pagination, favorites, infinite scroll (~250 lines) |
| `src/hooks/useBusinessFilters.ts` | Search debounce, filtering, sorting, categoryCounts (~95 lines) |
| `src/hooks/useBusinessModeration.ts` | Report, block, mute with 3-strike auto-hide (~170 lines) |
| `src/hooks/useBusinessReviews.ts` | Review fetch and submit with optimistic update (~110 lines) |
| `src/components/business/BusinessCard.tsx` | Grid card with React.memo, receives isFavorite boolean (~153 lines) |
| `src/components/business/FeaturedCarousel.tsx` | Featured businesses horizontal scroll with React.memo (~99 lines) |
| `src/components/business/BusinessDetailModal.tsx` | Full detail modal with photo carousel, reviews, contact, deals (~496 lines) |
| `src/components/business/BusinessEditModal.tsx` | Edit form with local FormInput/FormTextarea/PhotoUploader (~243 lines) |
| `src/components/business/BusinessCreateModal.tsx` | Create form with local FormInput/FormTextarea/PhotoUploader (~245 lines) |
| `src/components/business/BusinessModals.tsx` | Named exports: TinVerificationModal, DeleteConfirmModal, ContextMenu, ReportModal, BlockConfirmModal + useModalA11y hook (~445 lines) |
| `src/components/business/PhotoLightbox.tsx` | Full-screen photo gallery with zoom, swipe, keyboard nav, thumbnail strip (~209 lines) — NEW in Session 13 |
| `src/components/business/BusinessMapView.tsx` | Leaflet map with custom markers, native popups, geolocation, delegated click handlers (~380 lines) — NEW in Sessions 14-16, REWRITTEN for popup UX |
| `src/components/business/BusinessAnalyticsTab.tsx` | Owner-only analytics dashboard with 4 stat cards and CSS bar charts (~195 lines) — NEW in Sessions 14-16 |
| `src/services/businessAnalytics.ts` | Analytics service: recordView, recordContactClick, recordShare, recordFavorite, fetchBusinessAnalytics. Uses Firestore subcollection `businesses/{id}/analytics/{YYYY-MM-DD}` with session-level view debounce (~175 lines) — NEW in Sessions 14-16 |
| `src/components/business/BusinessQASection.tsx` | Q&A component with Firestore subcollection, optimistic UI, debounced search, native `<details>`/`<summary>` with chevron animation (~384 lines) — NEW in Session 17 |
| `src/components/business/businessUtils.ts` | Shared `parseOpenNow()` utility for business hours parsing, used by BusinessCard, FeaturedCarousel, BusinessDetailModal (~85 lines) — NEW in Session 17 |
| `src/components/business/businessConstants.ts` | CATEGORIES, CATEGORY_EMOJI_MAP, CATEGORY_COLORS, CATEGORY_ICONS, REPORT_CATEGORIES (~100 lines) |
| `src/components/business/businessValidation.ts` | validateBusinessForm, fuzzyMatch, getGoogleMapsUrl (~75 lines) |
| `src/components/business/imageUtils.ts` | compressImage, MAX_FILE_SIZE (~40 lines) |
| `public/firebase-messaging-sw.js` | FCM service worker — background push + notification click with Firefox postMessage fallback |
| `functions/src/index.ts` | Cloud Functions: `sendNewMessageNotification` (push) + `transcribeVoiceMessage` (Speech-to-Text). Both deployed. |
| `functions/package.json` | Node 22 engine, deps: firebase-admin, firebase-functions, @google-cloud/speech v6 |
| `src/services/firebase.ts` | Firebase init: Auth, Firestore, Storage, Messaging, Functions. Exports `httpsCallable` for Cloud Function calls. |
| `src/utils/groupWebrtc.ts` | GroupCallManager — mesh WebRTC for multi-party calls (up to 8). Firestore signaling, screen sharing, camera flip. Singleton via `getGroupCallManager()`. |
| `src/components/GroupCallOverlay.tsx` | Multi-party call UI — responsive grid, PiP mode, all controls. Mounted in MainLayout. |
| `firebase.json` | Hosting config, cache headers |
| `vite.config.ts` | Build config, PWA manifest, code splitting |

### Critical Gotchas & Patterns
- **DUPLICATE PAGES (legacy — deferred cleanup):** `src/pages/main/` has near-identical copies of 12 pages from `src/pages/`. Only `src/pages/` is used by the router — the `main/` copies are dead code (~29,162 lines). Only `messages.tsx` is kept in sync via `cp src/pages/messages.tsx src/pages/main/messages.tsx`. The other 11 have drifted (2–181 lines different). 3 files are unique to `main/`: `home.tsx`, `select-ethnicity.tsx`, `signup.tsx`. **DO NOT delete the duplicates yet** — user deferred this cleanup to a future session (Session 10 decision).
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
- **Business module `cp` sync** — `src/pages/business.tsx` must be identical to `src/pages/main/business.tsx`. After every edit: `cp src/pages/business.tsx src/pages/main/business.tsx`. Same pattern as messages.tsx.
- **Business hooks pattern** — All 4 business hooks take `(state: BusinessState, dispatch: React.Dispatch<BusinessAction>, ...)` as params. They read state directly and dispatch actions — no internal useState for shared state. Only `BusinessPhotoUploader` (inside Edit/Create modals) uses local useState for upload-specific state.
- **Firebase Storage NOT used** — The project doesn't use Firebase Storage at all. All images (profile photos, business photos, feed images, message attachments) are base64 data URLs stored in Firestore. Deploy with `firebase deploy --only hosting,functions,firestore` — including `storage` target will fail.
- **`@/` path alias** — Configured in both `vite.config.ts` and `tsconfig.app.json`. Maps to `src/`. All new component/hook imports use this alias (e.g. `import { useBusinessData } from '@/hooks/useBusinessData'`).
- **`useModalA11y` hook in BusinessModals.tsx** — Shared focus-trap + ESC-to-close hook used by TIN, Delete, Report, Block modals. Takes `(ref, onClose)`. Manages keyboard listener lifecycle and return-focus. Detail modal has its own inline version (more complex state).
- **`focus-visible` not `focus` for keyboard rings** — All business module interactive elements use `focus-visible:ring-2` to show focus rings only during keyboard navigation (not mouse clicks). Consistent pattern across all 9 component files.
- **Leaflet CDN loading pattern** — Leaflet is loaded dynamically in `BusinessMapView.tsx` by injecting `<link>` (CSS) and `<script>` (JS) tags into `<head>`. The `window.L` global is used after `script.onload` fires. Check if already loaded via `document.querySelector('link[href*="leaflet"]')` to avoid duplicate loads. This pattern can be reused for other modules needing maps.
- **`mapReady` state for async map init** — CRITICAL pattern. The Leaflet map is created asynchronously (CDN load → `L.map()` → `L.tileLayer()`). Any `useEffect` that depends on the map instance MUST include `mapReady` in its dependency array, or it will run before the map exists and never re-run. This caused the zero-markers bug.
- **Leaflet popups are raw HTML, not React** — `bindPopup()` accepts an HTML string. React event handlers (`onClick`, etc.) do NOT work inside popup content. Use delegated event listeners on the map container div. Pattern: `container.addEventListener('click', handler)` that checks `(e.target as HTMLElement).closest('.biz-popup-btn')`.
- **`bizIndexMapRef` for popup-to-business lookup** — A `useRef<Map<number, Business>>()` maps integer indices to business objects. Each marker's popup "View Details" button has `data-biz-index={i}`. The delegated click handler reads this attribute and looks up the business. The ref is updated whenever businesses change.
- **Firestore analytics subcollection rules** — `businesses/{businessId}/analytics/{dateKey}` requires its own nested match rule in `firestore.rules`. Without it, all analytics operations fail with `Missing or insufficient permissions`. The rule allows read/write for any authenticated user (analytics writes come from the client).
- **Analytics session-level view debounce** — `viewedThisSession` Set in `businessAnalytics.ts` is module-scoped. It persists across component re-mounts (e.g., navigating away and back) but resets on full page refresh. This prevents inflated view counts from navigation without requiring server-side dedup.
- **Firestore does NOT accept `undefined` values** — When building objects for `updateDoc`/`setDoc`, never use `field: value || undefined`. Instead, conditionally add fields: `if (value) obj.field = value`. This caused the "Failed to save deals" bug where the second deal failed because the deals array contained objects with undefined optional fields.
- **iOS Safari doesn't support `display: flex` on `<summary>` elements** — Safari injects an internal marker pseudo-element that disrupts flex layout. Fix: put the flex container as a `<div>` inside `<summary>`, not on `<summary>` itself.
- **`<details>`/`<summary>` marker removal requires 3 CSS rules** — `summary { list-style: none }`, `summary::-webkit-details-marker { display: none }` (Chrome/Safari), `summary::marker { display: none; content: '' }` (Firefox). All three are needed for cross-browser support.
- **Compact hero banners should NOT have carousel arrows** — The 224px hero with 4 action buttons leaves no safe position for prev/next arrows on any screen size. Use swipe + counter + lightbox instead. This was the resolution after multiple attempts to reposition arrows.
- **Q&A subcollection in Firestore needs explicit security rules** — `businesses/{id}/questions/{questionId}` requires its own nested match rule in `firestore.rules`. Without it, all Q&A operations fail with permission denied.
- **`serverTimestamp()` not `new Date()` for Firestore timestamps** — Always use `serverTimestamp()` from Firebase for consistency across time zones. `new Date()` uses the client's local clock which can differ.
- **Business `bookingUrl` field** — Added to Business interface, BusinessFormData, create/edit save paths, and detail modal contact section. Only shows when `business.bookingUrl` is set.
- **PhotoLightbox is standalone** — `PhotoLightbox.tsx` has no dependency on business state — just receives `photos[]`, `initialIndex`, `title`, `onClose`. Can be reused by other modules (housing, events, feed) if needed.

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
`users`, `posts` (+ subcollection `comments`), `businesses` (+ subcollections `analytics`, `questions`), `listings`, `events`, `travelPosts`, `conversations` (+ subcollection `messages`), `connections`, `appConfig`, `bannedUsers`, `disabledUsers`, `userSettings`, `groupCalls` (+ subcollections `signals`, `candidates`), `businessMenuItems`, `businessReviews`, `businessOrders`, `forumThreads`, `forumReplies`, `forumLikes`, `marketplaceListings`, `marketplaceComments`, `announcements`, `moderationQueue`, `reports`, `notifications`, `userWarnings`

### Recent Commit History
```
(pending) feat: Phase 4 Q&A system, Open Now indicator, booking URL, admin verification, carousel/deals fixes (Session 17)
(pending) feat: Phase 4 map view + analytics dashboard + map UX redesign + Firestore analytics rules (Sessions 14-16)
(pending) refactor: extract 6 JSX components from business.tsx (Phase 2 Steps 7-8)
e715244 refactor: extract 4 custom hooks from business.tsx (Phase 2 Steps 3-6)
efcba22 fix: resolve 42 TypeScript build errors from useReducer migration
df5c76f refactor(business): Phase 2 Steps 1-2 — extract constants/utils + migrate to useReducer
d25160b feat(business): Phase 1 critical fixes — pagination, debounce, validation, touch targets, error handling
a01a5b3 feat: admin toggles for all 23 messaging features, fix duplicate call events, iOS Safari PiP fix
2bb652d feat: admin toggles for all 23 messaging features + fix duplicate call events
e2ab6e3 feat: group video/audio calls, share call link, draggable PiP, fix duplicate call events
04b7813 feat: Batch 5 — Voice-to-Text transcription + disappearing messages UI fixes
66d72af feat: Batch 5 — Disappearing Messages with conversation timer + per-message override
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

*Generated March 23, 2026 (Session 16) — for continuing development in a new session. Business Phases 1-3 COMPLETE. Phase 4 IN PROGRESS — Map View (#29) and Analytics Dashboard (#30) done, remaining items #24-#28 and #31-#42 pending.*
