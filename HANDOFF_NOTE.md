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

**Date:** April 6, 2026 (Last updated: Session 28c)
**Repo:** https://github.com/sarathsatheesan/sangam-pwa-v2
**Latest Commit:** (Session 28b) — fix(catering): resolve 19 TypeScript errors and add RFP badge to active orders
**Uncommitted:** Session 28c changes — finalize bug fix, auto-finalize, vendor finalize indicator, ZIP validation
**Deployed to:** Firebase Hosting (site: `mithr-1e5f4`) + Cloud Functions (2nd Gen, Cloud Run)
**Live bundle:** Deployed and live at `https://mithr-1e5f4.web.app`
**Local project path on Mac:** `/Users/sarathsatheesan/ethniCity_03_19_2026/sangam-pwa-v2`
**Session history:** `docs/handoff/SESSION_01.md`, `docs/handoff/SESSION_02.md`, Session 3, Session 4, Session 5 (Batch 4), Session 6 (Pinned Messages + UI fixes), Session 7 (Batch 5 — Disappearing Messages), Session 8 (Voice-to-Text + Timer Picker fix + Undo removal + Group Calls), Session 9 (Duplicate call event fix + Share call link + Draggable PiP), Session 10 (Admin toggles for all 23 messaging features + live Chrome testing + cross-browser audit), Session 11 (Business Phase 2 Steps 1-6: useReducer migration + 4 custom hooks), Session 12 (Business Phase 2 Steps 7-8: extract 6 JSX components + memoize handlers), Session 13 (Business Phase 3: UX Polish & Accessibility — ARIA labels, keyboard nav, focus trapping, lazy loading, photo lightbox, empty states, share functionality), Sessions 14-16 (Business Phase 4: Map view with Leaflet/OpenStreetMap + Owner Analytics Dashboard + map marker UX redesign + Firestore analytics rules fix), Session 17 (Business Phase 4 continued: Admin verification toggle, Q&A system, Booking/Reservation, Open Now indicator, carousel/deals/Q&A fixes, details/summary refactor), Session 18 (Business Phase 4 completion: all 42 roadmap items done — filter chips, CSV import, distance sorting, onSnapshot, virtualization, parallel compression, autocomplete), Session 19 (Discover Page Phase 1: Critical Fixes & Quick Wins — 10 items, pending tab, mutual pre-compute, search ranking, accessibility, dead code removal, cross-browser fixes), Session 20 (Discover Phases 2-4: Performance & Data Layer + UX Polish + Architecture & Accessibility — pill gradients, cross-browser audit, useConnections/usePYMK/useFocusTrap hooks, PersonCard component, useReducer, keyboard nav, aria-live, focus trapping, cp sync elimination), Session 21 (Business Sign-Up Wizard — 5-step wizard with Google Places, Leaflet map, KYC verification, Firestore backend, admin review queue, 10 feature flags), Session 22 (Catering Module — Phase 1 Place Order + Phase 2 Request for Price RFP + cuisine picker + Firestore bug fixes + vendor UX improvements), Session 23 (Catering Phases 3-6: Vendor Dashboard, Order Tracking, Reviews, Favorites, Recurring Orders, Templates + Cloud Functions scheduler + Firestore rules + undefined field fixes), Session 24 (UX Audit + Critical Fixes: vendor switch confirmation dialog, checkout form validation, accessibility ARIA labels, regenerated audit report + this handoff note), Session 25 (Catering Medium+Large Effort: architecture refactor — split cateringService.ts into 7 domain modules, optimistic updates across 4 components, template marketplace/versioning/analytics, vendor analytics drill-down/best sellers/peak times/comparison/retention, payment info, messaging, batch ops, inventory manager, review enhancements), Session 26 (Round 2 Service Blueprint Audit: 30 findings SB-18 through SB-47 across 4 priority tiers — inline qty stepper, collapsible checkout, form persistence, undo cart removal, half-star reviews, search clear, accessibility radio groups, state-based tax, two-step payment, batch decline, ETA time picker, vendor pause, audio mute, quote edit window, vendor assignment badges, vendor modification alerts, rejection rollback, multi-vendor RFP summary, role-based Firestore rules, reduced motion, status badges with icons, deep linking, inline messaging, category-level reviews, review moderation panel, recurring order overrides), Session 27 (Catering UI Phases 1-3: 20-item UI overhaul across 3 phases + QA audit finding 21 bugs + all 21 bug fixes verified + cart scroll fix), Session 28 (RFP-to-Order conversion + in-order messaging + Firestore rules fix), Session 28b (Live testing of quote-to-order pipeline + 19 TypeScript error fixes + RFP badge on active/pending orders)

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

**Session 18 focused on:** Business module Phase 4 — Completing ALL remaining roadmap items (#25, #28, #37-#42), bringing the total to 42/42 items complete:

- **#25 Filter Chips UI**: Active filter chips bar between results header and business grid. Shows active search (violet), category (emerald), heritage (amber, one per selection), and collection (indigo) as dismissible chips. "Clear all" button appears when 2+ filters active. Icons for each collection type (Heart for favorites, UserPlus for following, TrendingUp for top rated, Navigation for nearest).
- **#37 CSV Bulk Import**: New `BusinessCSVImport.tsx` (~480 lines, lazy-loaded). 4-step wizard: drag-and-drop upload → table preview with row validation → Firestore batch writes (20 per batch with progress bar) → success summary. Smart column mapping via fuzzy header matching (e.g., "business name", "tel", "address" → canonical fields). Downloadable CSV template with example row. Multi-value fields split by semicolons.
- **#38 Distance-Based Sorting**: Haversine formula in `businessUtils.ts` (`getDistanceMiles`). New "Nearest" sort pill in collection tabs that auto-triggers browser geolocation. Distance caching via `Map<string, number>` keyed by `${businessId}_${lat}_${lng}`. Distance badges (indigo pill with Navigation icon) on BusinessCard and FeaturedCarousel. Added `'nearest'` to `activeCollection` union type in reducer.
- **#39 Real-Time onSnapshot**: Replaced one-time `getDocs` initial fetch with Firestore `onSnapshot` listener in `useBusinessData.ts`. Business list now auto-updates when businesses are added, edited, or deleted from any client. "Load more" pagination still uses `getDocs` with `startAfter` cursor. Removed `window.location.reload()` from CSV import completion handler.
- **#40 List Virtualization**: New `VirtualizedBusinessGrid.tsx` using IntersectionObserver + CSS `content-visibility: auto` for zero-dependency virtual scrolling. Chunks business list into groups of 12, only renders chunks near the viewport (400px margin). Falls back to plain CSS grid for ≤12 items. Works seamlessly with responsive grid layouts (1/2/3 columns).
- **#41 Parallel Image Compression**: New `compressImagesParallel()` in `imageUtils.ts` using `Promise.allSettled()` for concurrent processing. Updated `BusinessCreateModal.tsx` and `BusinessEditModal.tsx` with combined progress bar showing "Compressing 2/5..." with animated fill. Replaces sequential `for...of` loop.
- **#42 Advanced Search with Autocomplete**: Typeahead dropdown below search input showing 3 sections: recent searches (persisted in localStorage, max 5, "Clear all" button), category suggestions (with business counts), and business name/location matches (top 5 with emoji, category, verified badge). Keyboard support: Escape closes, Enter saves to recent. `onMouseDown` prevents blur race condition. ARIA `listbox`/`option` roles for accessibility.
- **#28 Advanced Search/Filters**: Covered by combination of #42 autocomplete (quick category selection from typeahead) and #25 filter chips (visual active filter management with dismiss).
- **Cross-browser geolocation fix**: Rewrote `handleRequestGeolocation` for iOS Safari, Firefox, Android Chrome. Two-phase approach: high-accuracy (8s) → low-accuracy fallback (10s) for iOS GPS cold start. iOS-specific error messages pointing to Settings → Privacy & Security. Firefox 20s safety timeout for dismissed prompts. HTTPS secure-context check.

**Session 19 focused on:** Discover Page Enhancement Roadmap Phase 1 — Critical Fixes & Quick Wins (items 1.1–1.10). This is the first phase of a 38-item Discover page improvement roadmap (`Discover_Page_Enhancement_Roadmap.docx`). All changes to `src/pages/discover.tsx` (reduced from 1,846 → 1,716 lines), synced to `src/pages/main/discover.tsx` via `cp`:

- **#1.1 Pending Tab Fix**: The Pending tab was incorrectly showing the same content as the Network tab because `handleTileClick('pending')` set `activeTab` to `'network'`. Added `'pending'` as a third value in the `activeTab` union type (`'discover' | 'network' | 'pending'`), created a dedicated filter branch in the `filteredPeople` useMemo that filters for incoming requests only (`status === 'pending' && detail.initiatedBy !== user?.uid`), and added Accept/Decline action buttons to pending grid cards.
- **#1.2 Mutual Connection Pre-Computation**: Replaced the O(n²) `getMutualConnectionCount()` function (called 2-3x per card per render) with a pre-computed `useMemo` map (`Map<string, User[]>`). Single pass builds mutual connections based on shared heritage or city. `getMutualConnectionCount` and `getMutualConnections` are now `useCallback` wrappers for O(1) lookups.
- **#1.3 MatchBadge Inline Prop**: Added `inline?: boolean` prop to the MatchBadge component. When `true`, renders flow-positioned in the flex row instead of `absolute top-3 right-3`, preventing overlap with the 3-dot menu button on cards.
- **#1.4 Dead Code Removal**: Removed `viewMode` state (no toggle button existed — list view was unreachable), `hoveringDisconnect` state, entire list-view rendering branch (~150 lines), and unused imports (`UserCheck`, `Bookmark`). Net reduction: ~130 lines.
- **#1.5 SkeletonCard Aurora Theme**: Updated skeleton loading cards to use Aurora design system variables (`bg-aurora-surface`, `border-[var(--aurora-border)]`, `bg-[var(--aurora-border)]`) instead of hardcoded gray values, ensuring correct appearance in both light and dark modes.
- **#1.6 Refresh Button**: Extracted the people-fetching logic into a `useCallback`-wrapped `fetchPeople` function. Added a `RefreshCw` icon button next to the search bar with `refreshing` state that triggers a manual re-fetch with spin animation.
- **#1.7 Toast Safe-Area Positioning**: Fixed toast notifications being obscured by the bottom nav bar on notched devices (iPhone X+). Uses Tailwind `bottom-24` as CSS fallback with inline `style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}` for devices that support `env()`.
- **#1.8 Duplicate Connection Requests Removal**: Removed the Connection Requests section from the Discover tab's PYMK area (~80 lines). With the new dedicated Pending tab (#1.1), showing incoming requests in both places was redundant.
- **#1.9 Search Ranking**: Added `searchRank()` function returning priority levels: prefix match (1) > word-start match (1) > substring (2) > fuzzy subsequence (3) > no match (0). Results are pre-sorted by rank before secondary sorting, so "Sa" correctly matches "Sarath" before "Sports" (which fuzzy matched s...a).
- **#1.10 Accessibility**: Added `role="button"`, `tabIndex={0}`, `aria-label` (with name, profession, city), `focus-visible:ring-2 focus-visible:ring-blue-500`, and `onKeyDown` (Enter/Space) handlers to all 6 card interaction points: main grid cards, 3 PYMK carousel card types, incoming request cards, and sent request cards.
- **Cross-browser compatibility audit**: Added `@supports not selector(:focus-visible)` CSS fallback in `index.css` for iOS Safari < 15.4 (applies `:focus` outline on `[role="button"]` elements). Verified `env(safe-area-inset-bottom)` has Tailwind class fallback for older Android WebViews. All other APIs (CSS custom properties, `String.startsWith/includes`, `Map`, `useMemo`, `onKeyDown`) verified safe across Chrome 49+, Safari 9.1+, Firefox 31+.

**Session 20 focused on:** Discover Page Enhancement Roadmap Phases 2-4 — completing all remaining phases in a single session. This session covered Phase 2 (Performance & Data Layer, 9 items), Phase 3 (UX Polish & Feature Gaps, 10 items), and Phase 4 (Architecture & Accessibility, 9 items). All 28 items across 3 phases were implemented, built, deployed, and tested in Chrome.

Phase 2 highlights: N+1 Firestore read fix (batch getDocs), cursor-based pagination, onSnapshot for connections, PYMK single-pass optimization, match score memoization, Map reference stability.

Phase 3 highlights: Pill gradient colors (green for Discover, blue for Network, orange for Pending — purple when unselected), emoji detection fix (`\p{Emoji_Presentation}|\p{Extended_Pictographic}`), heritage text rendering fix (explicit Tailwind classes instead of dynamic `text-${size}`), sticky header fix (`-webkit-sticky`), PYMK scrollbar fix (`hide-scrollbar` CSS class + alias), modal iOS fix (`min(90vh, 90dvh)` + `WebkitOverflowScrolling`), toast animation fix (`animate-fade-in` keyframes), comprehensive cross-browser compatibility audit and patches for Chrome/Safari/Firefox/iOS Safari/Android Chrome.

Phase 4 highlights: Extracted `PersonCard` component (464 lines, 6 variants: grid, pymk-city, pymk-heritage, pymk-interests, incoming, sent), extracted `useConnections` hook (362 lines — all connection state, handlers, real-time listener, legacy migration), extracted `usePYMK` hook (126 lines — PYMK groups computation), consolidated `useState` into `useReducer` for modal and filter state, full keyboard navigation in PYMK carousels (ArrowLeft/ArrowRight), `aria-live` regions for dynamic content, focus trapping in modals via new `useFocusTrap` hook (65 lines), color contrast audit (WCAG 2.1 AA), eliminated `cp` sync pattern by deleting `src/pages/main/discover.tsx` (confirmed only `src/pages/discover` is imported in `App.tsx`).

**Session 21 focused on:** Business Sign-Up Wizard — Complete 5-phase implementation of a new business registration flow, separate from the existing business directory. All 5 phases completed in a single session:

- **Phase 1 — Foundation**: Added 10 new KYC feature flags to `FeatureSettingsContext.tsx` (all default `false`), extended `businessReducer.ts` with optional sign-up fields (country, placeId, addressComponents, TIN, verification docs, beneficial owners, KYC status), extended `businessValidation.ts` with step-aware validation (EIN/BN format validation, postal code validation, address component validation), added `/business/register` route in `App.tsx`, created feature-flag-gated register page.
- **Phase 2 — Wizard UI + Google Places**: Built `BusinessRegistrationWizard.tsx` (main shell with 5-step progress bar, validation gating, auto-save draft), `StepIdentity.tsx` (name, category, country toggle US/CA, email, phone, description), `StepLocation.tsx` (Google Places Autocomplete with debounced search + session tokens for billing, structured address parsing, manual fallback fields, Leaflet map preview via CDN). Created `useGooglePlaces.ts` hook (singleton script loader, session token management).
- **Phase 3 — Steps 4-5**: Built `StepVerification.tsx` (fully feature-flag-aware — TIN/EIN/BN entry, document upload with drag UI, photo ID upload, beneficial ownership disclosure, SOS lookup banner), `StepDetails.tsx` (photo upload grid up to 10 with cover selection, business hours day-by-day editor, price range, menu/services), `StepReview.tsx` (cover photo preview, 4 review sections with Edit buttons, masked TIN, terms notice).
- **Phase 4/5 — Firestore Backend + Admin Review**: Built `businessRegistration.ts` service (Firestore write, parallel photo upload to Storage, parallel verification doc upload, draft auto-save/load/delete, admin review queue with approve/reject). Updated both `admin.tsx` files with registrations tab (pending list, approve/reject with reason modal).
- **TypeScript fixes**: Fixed `useRef()` requiring initial value in React 19 types (pass `undefined`), fixed `UserData.displayName` → `UserData.name`, added Google Maps namespace declarations to avoid `@types/google.maps` dependency.
- **ZERO IMPACT on individual sign-up flow** — Verified: all new fields optional, all flags default false, original `validateBusinessForm()` untouched, auth files clean.
- **Google Places API key**: `AIzaSyDrbJItCq629ccJ6DGgtTEO1XXjKgGXCWY` stored in `.env` as `VITE_GOOGLE_MAPS_API_KEY` (already in `.gitignore`).

**Session 22 focused on:** Catering Module — Complete implementation spanning Phase 1 (Place Order flow) and Phase 2 (Request for Price / RFP flow), plus extensive Firestore bug fixes, vendor UX improvements, and cross-browser compatibility:

- **Phase 1 — Place Order (Direct)**: Built full catering ordering flow: `CateringCategoryGrid.tsx` (cuisine category cards), `CateringItemList.tsx` (menu items grouped by business), `CateringCart.tsx` (slide-out cart panel), `CateringCheckout.tsx` (multi-section checkout form), `OrderForSelector.tsx` (radio card selector). State managed via `cateringReducer.ts` with `useReducer`. Service layer in `cateringService.ts` with Firestore CRUD for `cateringMenuItems`, `cateringOrders`. Vendor dashboard in `VendorCateringDashboard.tsx` for managing incoming direct orders. Feature flag `modules_catering` added to `DEFAULT_FEATURES` and `FEATURE_GROUPS` in `FeatureSettingsContext.tsx`. Catering tile added to home page grid and ModuleSelector nav.

- **Phase 2 — Request for Price (Privacy-First RFP)**: Built `RequestForPriceForm.tsx` with cuisine-type dropdown + multi-select checkbox food item picker (17 cuisine categories, 200+ food items from `cateringFoodItems.ts`). Users submit RFPs sharing only delivery city — caterer names hidden until quotes received. `QuoteComparison.tsx` for customers to view/compare received quotes. `VendorQuoteResponse.tsx` for vendors to view open RFPs and submit quotes. Firestore collections: `cateringQuoteRequests`, `cateringQuoteResponses`. Firestore rules and composite indexes added.

- **Cuisine Food Item Catalog**: New `src/constants/cateringFoodItems.ts` — comprehensive catalog with 17 cuisine categories (American, Asian BBQ, Beverages, Breakfast & Brunch, Caribbean, Chinese, Desserts & Sweets, Healthy, Indian, Italian, Japanese, Mediterranean, Mexican, Pizza & Flatbreads, Sandwiches & Wraps, Soul Food & Southern, Thai). Each item has `name`, `pricingType` (per_person/per_tray/flat_rate), and optional `dietaryTags`. Categories sourced from ezCater for industry-standard coverage.

- **Firestore Bug Fixes (4 critical issues)**:
  1. `addDoc()` with `undefined` fields — Firestore rejects undefined values. Fixed `specialInstructions: rfpForm.specialInstructions || undefined` → `|| ''` and `targetBusinessIds` using spread syntax.
  2. `stripUndefined` corrupting `serverTimestamp()` — The recursive utility treated Firebase's `FieldValue` sentinel as a regular object, producing `{}` instead of the proper sentinel. `createdAt` was stored as `{}`, breaking all `orderBy('createdAt')` queries. **Removed `stripUndefined` entirely**, replaced with explicit payload builders.
  3. `businessHeritage: undefined` in quote responses — `createQuoteResponse` spread `...response` which included undefined optional fields. Fixed with explicit payload builder.
  4. Missing composite indexes — Queries combining `where()` + `orderBy()` silently failed. **Removed `orderBy()` from ALL queries** across `cateringService.ts`, sorting client-side instead.

- **Vendor UX Improvements**: Moved Vendor pill to top-level header next to My Quotes for one-click access (was buried in two-step process). Made Vendor pill visible for ALL approved business owners (not just catering-enabled), since RFP system will expand to grocery, events, restaurants, etc. Added `userOwnedBusiness` state with broader Firestore query checking all approved businesses by `ownerId`.

- **Cross-Browser Compatibility**: Clipboard API fallbacks for quote sharing, CSS mobile Safari fixes, explicit Vite build targets `['es2020', 'chrome87', 'firefox78', 'safari14', 'edge88']`.

- **Admin Catering Section**: Added Catering tab to admin panel with catering orders list, stats, caterer businesses view, and order management.

**Session 27 focused on:** Catering UI Overhaul — 3 phases of visual enhancements (20 items total), comprehensive QA audit, 21 bug fixes, and a live cart scroll fix:

- **Phase 1 — Quick Wins (5 items)**: Styled sort dropdown with border + ChevronDown icon, category-specific "No caterers yet" empty states, mobile short title mapping for truncation prevention, footer hidden on catering module for content maximization, styled search input with aurora theme variables.

- **Phase 2 — High-Impact UX (6 items)**: Two-column desktop checkout layout (`lg:grid lg:grid-cols-5 lg:gap-8` — form in col-span-3, order summary in col-span-2 with sticky positioning), card-style vendor headers with avatar initials and business metadata, category-specific gradient placeholders with matching icons for items without photos, minimum order progress bar with amber/green states and remaining amount display, sticky mobile search bar, vendor header with category/rating/item count badges.

- **Phase 3 — Polish & Delight (8 items)**: Hero banner with gradient background and featured caterer pills on categories view, glass-morphism category cards with gradient backgrounds and decorative circles, dark mode compatibility audit (replaced hardcoded `hover:bg-gray-100` and `border-gray-300` with opacity-based and aurora variable alternatives), green step badges with checkmark animation on checkout sections, quick info pills (prep time, serves, popularity) on menu item cards, enhanced vendor dashboard onboarding empty state with gradient icon and contextual filter-aware empty states, metadata enrichment (`prepTimeMinutes`, `popularityScore` added to `CateringMenuItem` type).

- **QA Audit**: Acted as QA engineer — created comprehensive test plan across all 20 UI items, executed tests via code review + live site verification, found 21 bugs across 4 severity tiers (2 CRITICAL, 5 HIGH, 8 MEDIUM, 6 LOW). Generated `Catering_UI_QA_Report.docx` with detailed findings.

- **Bug Fix Pass (21 bugs)**: Fixed all bugs in priority order:
  - **CRITICAL**: BUG-001 (missing `--aurora-bg-rgb` and `--aurora-success` CSS variables in both light/dark mode), BUG-002 (hero caterer pills all calling same handler — now dispatch `SET_SEARCH_QUERY` with vendor name), BUG-003 (validation summary in wrong column — moved from right order summary column to left form column)
  - **HIGH**: BUG-004 (nested sticky conflict — footer uses `lg:static` on desktop), BUG-005 (inline `<style>` tag moved to global `index.css` `@keyframes checkPop`), BUG-006 (aria-label trailing separator — ternary logic fix), BUG-007 (`prefers-reduced-motion` global rule added), BUG-008 (hardcoded `#10B981` replaced with `var(--aurora-success)` with fallbacks), BUG-009 (route check `startsWith('/catering')` → exact match + trailing slash)
  - **MEDIUM**: BUG-010 (animation `forwards` fill-mode), BUG-011 (null/0 guards for `prepTimeMinutes`/`popularityScore`), BUG-012 (double-counting in category grid), BUG-013 (mobile sticky `safe-area-inset-top`), BUG-014 (`Math.floor` instead of `Math.round` for progress bar), BUG-015 (`focus-visible` ring on glass-morphism cards), BUG-016 (sort dropdown hover with opacity instead of hardcoded color)
  - **LOW**: BUG-018 (complete `shortNames` mapping), BUG-019 (dev-mode console.warn for missing business data), BUG-020 ("+N more" pill for >5 caterers), BUG-021 (contextual empty states accepted as correct UX)
  - **N/A**: BUG-017 (scroll buttons don't exist in codebase)

- **QA Verification**: Re-tested all 21 bugs — 20 PASS, 1 N/A. Generated `Catering_QA_Verification_Report.docx` with detailed evidence per bug.

- **Live Bug Fix — Cart Scroll**: User reported cart items not scrollable on mobile. Root cause: content wrapper had `h-full` without accounting for header/progress bar height. Fixed by restructuring panel to flex column layout with `shrink-0` header, `flex-1 min-h-0` content area, and `overflow-y-auto` on items list.

- **Session 27 Commits** (5 total):
  - `da9ef3f` — style(catering): Phase 2 UI enhancements — 6 high-impact UX changes
  - `102e9cf` — style(catering): Phase 3 UI polish & delight — 8 enhancements
  - `64c53e0` — fix(catering): resolve 20 QA bugs across all severity tiers
  - `222be4a` — fix(catering): cart drawer items not scrollable on mobile

- **Design Decisions (Session 27)**:
  - **Glass-morphism pattern**: `backdrop-filter: blur(8px)` with `rgba(255,255,255,0.2)` overlays for category cards and hero pills — gives premium frosted glass appearance on gradient backgrounds
  - **Aurora design tokens**: All new colors use CSS variables with fallbacks (`var(--aurora-success, #10B981)`) — never hardcoded values alone
  - **`--aurora-bg-rgb` variable**: Added `245, 246, 250` (light) / `26, 27, 46` (dark) for use in `rgba()` expressions where CSS variables can't be used directly
  - **`--aurora-success` variable**: `#10B981` (light) / `#34D399` (dark) for consistent green across themes
  - **Two-column checkout**: 5-column grid with 3:2 split — form sections in left col, order summary sticky in right col. On mobile, stacks vertically.
  - **Category card gradients**: Each cuisine type has a distinct gradient (orange for Restaurant & Food, green for Tiffin, blue for Grocery & Market, purple for Other) to create visual diversity
  - **Step badge animation**: `checkPop` keyframe with cubic-bezier bounce for section completion feedback
  - **Flex layout for cart panel**: Replaced `h-full` + `sticky` approach with proper flex column layout (`shrink-0` for fixed areas, `flex-1 min-h-0` for scrollable area) — more robust across all screen sizes

**Key architectural change in Session 20:** The `cp` sync pattern for `discover.tsx` was ELIMINATED. Unlike `messages.tsx` and `business.tsx` which still require `cp` sync, `discover.tsx` was verified to only be imported from `src/pages/discover.tsx` (not `main/`). The duplicate `src/pages/main/discover.tsx` was deleted. This is the first page to break free of the duplicate architecture.

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

### Session 26: Round 2 Service Blueprint Audit — 30 Findings Across 4 Priority Tiers

- **sessionStorage over localStorage for checkout form persistence** — Checkout form data is saved to `sessionStorage` (not `localStorage`) so it auto-clears when the browser tab is closed. Catering orders are time-sensitive — stale delivery dates or addresses from previous sessions would cause more harm than the convenience of persistence across sessions. `sessionStorage` gives intra-session persistence (navigating between checkout steps) without cross-session data leakage.

- **State-based tax lookup table over API-based tax calculation** — A static `STATE_TAX_RATES: Record<string, number>` with all 50 states + DC replaces the hardcoded 8.25% tax rate. While a tax API (Avalara, TaxJar) would be more accurate for jurisdictional nuances, a static lookup is sufficient for estimates and avoids API costs and latency. The `getEstimatedTaxRate(state?)` function falls back to `DEFAULT_TAX_RATE` (8.25%) when no state is provided. Can be upgraded to API-based calculation when payment integration is added.

- **Two-step payment confirmation over direct Firestore payment write** — The payment flow sends users to an external payment link (vendor's payment URL), then requires them to click "I've Completed Payment" to update `paymentStatus: 'paid'` in Firestore. This two-step flow acknowledges that the app doesn't yet have integrated payment processing — the vendor's external payment system is the source of truth, and the confirmation button is a user-attested status update. When Stripe/Square integration is added, this can be replaced with webhook-driven status updates.

- **Clip-width technique for half-star ratings over SVG gradient fills** — Half-star rendering uses a `<div>` with `overflow: hidden` and dynamic `width` based on `Math.min(1, Math.max(0, rating - (star - 1)))`. This is simpler and more cross-browser compatible than SVG `linearGradient` or `clipPath` approaches, and works with any star icon.

- **5-second undo window for cart removal over confirmation dialog** — An undo toast bar is less disruptive than a confirmation dialog for cart item removal. The item is visually removed immediately (filtered from `visibleItems`) but retained in state behind `removedItem` + `undoTimerRef`. This follows the Gmail/Google pattern of optimistic removal with undo.

- **24-hour edit window for vendor quote responses** — `isQuoteResponseEditable()` checks both `status === 'submitted'` AND `createdAt` within 24 hours. This prevents vendors from changing quotes after customers have started making decisions, while allowing reasonable corrections shortly after submission. The window is enforced both client-side (UI gating) and in the service function.

- **Parallel agent implementation strategy** — The 30 findings were implemented using parallel subagents grouped by file affinity to minimize merge conflicts. Each agent received specific line ranges and non-overlapping edit targets. This allowed completing all 30 items in a single session with 4 clean commits (one per priority tier).

- **Role-based status transitions in Firestore rules (not just client-side)** — Added `isValidStatusTransition()` helper and role-based `allow update` rules to `firestore.rules` for catering orders. Client-side checks in `updateOrderStatus()` with optional `callerRole` param provide a first line of defense, but the Firestore rules enforce authorization server-side. Customers can only cancel their own orders; vendors can only update orders for their business.

- **`prefers-reduced-motion` media query for animation accessibility** — The pulsing amber dot on modified orders uses `animate-ping` which can trigger motion sensitivity. A `prefersReducedMotion` state via `window.matchMedia('(prefers-reduced-motion: reduce)')` conditionally disables the animation. This follows WCAG 2.3.3 (Animation from Interactions).

- **URL hash for order deep linking (not query params)** — Order expansion state is synced to `window.location.hash` (`#order-{id}`) via `replaceState`. Hash changes don't trigger page reloads and don't appear in server logs (unlike query params). On mount, `expandedOrder` is initialized from the hash, enabling shareable order links.

### Session 22: Catering Module — Phase 1 + Phase 2 RFP + Firestore Fixes

- **Explicit payload builders over object spread for Firestore writes** — The `...response` spread pattern includes all object properties, including `undefined` optional fields that Firestore rejects. Explicit payload builders (`const payload: Record<string, any> = { field1: value1, ... }; if (optionalField) payload.optionalField = optionalField;`) are safer because they only include fields with actual values. This also avoids corrupting Firebase sentinel values like `serverTimestamp()` which look like regular objects to generic utilities but must be passed through unmodified. Applied to both `createQuoteRequest` and `createQuoteResponse` in `cateringService.ts`.

- **Client-side sorting over composite indexes** — Firestore composite indexes are required for queries combining `where()` + `orderBy()` on different fields. Without them, queries silently fail (return empty results, not errors). Building indexes takes time and requires deployment. Decision: remove `orderBy()` from ALL Firestore queries in `cateringService.ts` and sort results client-side with `Array.sort()`. This works immediately with zero infrastructure changes. Composite indexes still defined in `firestore.indexes.json` for long-term optimization but are no longer a runtime dependency.

- **`stripUndefined` removed entirely (not fixed)** — The recursive `stripUndefined(obj)` utility used `Object.entries()` to traverse and filter an object. Firebase's `serverTimestamp()` returns a `FieldValue` sentinel that has internal properties. When `Object.entries()` processes it, it produces `{}` instead of the proper sentinel, corrupting the timestamp. Rather than adding a special case for FieldValue, the function was removed and replaced with explicit payload builders — a more robust pattern that makes each field's inclusion deliberate.

- **Vendor pill visible for ALL business owners (not just catering)** — The RFP/quote system is designed to expand beyond catering to grocery, restaurants, event management, etc. Making the Vendor pill visible for any approved business owner (not just `isCateringEnabled` businesses) future-proofs the UX. Detection uses a two-step approach: first checks already-loaded catering businesses (fast), then falls back to a broader Firestore query for any approved business with matching `ownerId`.

- **Privacy-first RFP architecture (no caterer names until quotes received)** — Users submit RFPs sharing only delivery city and food requirements. Caterer names, contact details, and business information are hidden from the customer until the caterer submits a quote. This protects vendor privacy and encourages quote competition. The "Target Caterers" section was built but commented out (preserved for future repurposing when the platform matures).

- **Cuisine food item picker over free-text entry** — Users repeatedly entering the same food items creates friction and inconsistency. Pre-populated cuisine categories with 200+ food items (sourced from ezCater's industry-standard categories) let users select items via checkboxes. Manual "Add a custom item" form preserved as a collapsible toggle for items not in the catalog.

- **Price stored in cents (not dollars)** — All price values (e.g., `pricePerUnit`, `totalPrice`) stored as integers representing cents (1299 = $12.99). This avoids floating-point precision issues in calculations and is the standard pattern for financial data.

- **`useReducer` for catering state management** — Single reducer (`cateringReducer.ts`) manages all catering state including view navigation, cart, orders, RFP form, quote requests/responses. View union type: `'categories' | 'items' | 'checkout' | 'orders' | 'vendor' | 'rfp' | 'quotes'`. Consistent with the business module pattern.

- **Catering module feature flag: `modules_catering`** — Added to both `DEFAULT_FEATURES` (default `true`) and `FEATURE_GROUPS` in `FeatureSettingsContext.tsx`. Module visibility in navigation gated by `isFeatureEnabled('modules_catering')`. Admin can toggle it off to hide the entire catering module.

### Sessions 23-24: Catering Phases 3-6 + UX Audit + Critical Fixes

**Session 23 focused on (March 29, 2026):** Catering Module Phases 3-6 — completing the entire catering feature set. This was a long session that ran out of context and was continued via compaction summary.

- **Phase 3 — Vendor Dashboard**: `VendorCateringDashboard.tsx` with status management workflow (pending → confirmed → preparing → ready → out_for_delivery → delivered), filter tabs (all/pending/active/completed), ETA input before dispatch.
- **Phase 4 — Order Tracking**: `CateringOrderStatus.tsx` with visual 6-step timeline, real-time subscriptions via `subscribeToCustomerOrders`, collapsible order cards, ETA badges.
- **Phase 5 — Reviews**: `CateringReviewForm.tsx` (modal with star rating + text), `CateringReviews.tsx` (aggregated ratings + individual reviews with vendor reply capability). Firestore collection `businessReviews` with security rules.
- **Phase 6 — Favorites, Recurring Orders, Templates**:
  - `FavoriteOrders.tsx`: Auto-save on order placement, inline rename, quick reorder with date picker, "Set Recurring" and "Save as Template" action buttons
  - `RecurringOrderManager.tsx`: Two-tier scheduling (simple intervals: daily/weekly/biweekly/monthly + calendar-based: specific days of week), skip dates, pause/resume, contact info pre-fill
  - `OrderTemplates.tsx`: Create from favorites, 8-char share codes, public/private visibility, org name, "Use Code" lookup mode
  - Cloud Function `processRecurringCateringOrders` (daily 6 AM PT scheduler) in `functions/src/index.ts`
  - 3 new Firestore collections: `cateringFavorites`, `cateringRecurring`, `cateringTemplates` with security rules
  - 18+ new service functions in `cateringService.ts`

- **Bug Fixes (Session 23)**:
  1. `FirebaseError: Unsupported field value: undefined` in `createOrder()`, `saveFavoriteOrder()`, `submitCateringReview()` — Added `Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))` pattern
  2. Firestore permission-denied on new collections — Added security rules for `cateringFavorites`, `cateringRecurring`, `cateringTemplates`
  3. Cloud Function race condition — Replaced `Promise.all` + shared batch with sequential `for...of` + individual `recDoc.ref.update()`
  4. `specialInstructions: undefined` in checkout form — Changed to conditional spread `...(val ? { key: val } : {})`

- **Testing (Session 23)**: Placed test orders through deployed app, verified auto-save to favorites, tested quick reorder flow, tested Set Recurring and Save as Template buttons. All Phase 6 features verified working end-to-end except recurring order creation (had remaining undefined field error fixed in Session 24).

**Session 24 focused on (March 29, 2026):** Comprehensive UX Audit + Critical Fixes.

- **UX Audit**: Acted as both user and vendor, clicked through every flow on the deployed app. Produced an 8-page .docx report (`ethniCity_Catering_UX_Audit.docx`) covering: executive summary, 15-area scorecard, detailed user/vendor flow analysis, Phase 6 feature review, prioritized 22-issue tracker, and recommended Phase 7 roadmap.

- **Critical Fix 1 — Vendor Switch Confirmation Dialog**: Cart previously cleared silently when adding items from a different vendor. Added `pendingVendorSwitch` state to reducer, `CONFIRM_VENDOR_SWITCH` / `CANCEL_VENDOR_SWITCH` actions, and a modal dialog in `catering.tsx` asking "Your cart has N items from [Vendor A]. Adding from [Vendor B] will replace your current cart."

- **Critical Fix 2 — Remaining Firestore Undefined Errors**: Extended the `Object.fromEntries` filter pattern to `createRecurringOrder()`, `createOrderTemplate()`, and `createMenuItem()`. Fixed component-level sources: `RecurringOrderManager.tsx` (headcount, specialInstructions, orderForContext) and `OrderTemplates.tsx` (description, headcount, specialInstructions) now use conditional spreads.

- **Critical Fix 3 — Checkout Form Validation**: Complete rewrite of `CateringCheckout.tsx` with: inline real-time validation (red borders + error messages on blur), `min` date constraint (tomorrow), phone number format validation, ZIP code format validation, character count on special instructions (500 max), validation summary alert on submit attempt, `aria-required`, `aria-invalid`, `aria-describedby` on all fields.

- **Critical Fix 4 — Accessibility**: Added ARIA labels across 5 components:
  - `CateringCart.tsx`: `role="dialog"`, `aria-modal`, `aria-label="Shopping cart"`
  - `CateringItemCard.tsx`: `role="article"`, `aria-label` with item name/price on card and Add button
  - `CateringCategoryGrid.tsx`: `aria-label` with category name and caterer count on each button
  - `CateringItemList.tsx`: `role="checkbox"`, `aria-checked` on dietary filter pills, `aria-label` on search input
  - `CateringCheckout.tsx`: `aria-labelledby` on sections, `htmlFor` on all labels, `aria-required`/`aria-invalid`/`aria-describedby` on all inputs, `role="alert"` on error messages, `role="list"` on order summary

**Session 26 focused on (April 1, 2026):** Round 2 Service Blueprint Audit — implementing all 30 findings (SB-18 through SB-47) from the comprehensive service blueprint audit, organized across 4 priority tiers (P0 Critical, P1 High, P2 Medium, P3 Low). This session completed all 30 items (29 implemented, 1 confirmed already done) with 4 git commits, zero build errors.

- **P0 Critical (5 items — SB-18, SB-19, SB-20, SB-24, SB-27)**:
  - **SB-18 Inline Quantity Stepper**: Replaced simple "Add" button in `CateringItemCard.tsx` with qty=0 → Add button, qty>0 → [-/qty/+] stepper respecting `minOrderQty`/`maxOrderQty` constraints
  - **SB-19 Collapsible Checkout Sections**: 3 numbered collapsible sections (Delivery, Order For, Payment) with green checkmarks on valid sections in `CateringCheckout.tsx`
  - **SB-20 Session Storage Persistence**: Checkout form data auto-saved to `sessionStorage` (key: `ethnicity_checkout_form`) and restored on mount, cleared on tab close
  - **SB-24 Low Stock Badge Enhancement**: `CateringItemCard.tsx` now shows "N left" when `stockCount` is available, falls back to "Low Stock" generic badge
  - **SB-27 Two-Step Payment Flow**: External payment link → "I've Completed Payment" confirmation button → Firestore `paymentStatus: 'paid'` update in `CateringOrderStatus.tsx`

- **P1 High (8 items — SB-21, SB-25, SB-26, SB-28, SB-29, SB-30, SB-31, SB-32)**:
  - **SB-21 Undo Cart Removal**: 5-second undo window with amber toast bar when removing items from `CateringCart.tsx`
  - **SB-25 Accessible Radio Inputs**: Replaced styled `<div>` buttons with `<label>` + `<input type="radio" className="sr-only">` + `role="radiogroup"` in `OrderForSelector.tsx`
  - **SB-26 OrderForContext Validation**: Added `recipientName`/`recipientContact`/`organizationName` validation with error props and onBlur integration
  - **SB-28 State-Based Tax**: 50-state + DC tax rate lookup table (`STATE_TAX_RATES: Record<string, number>`) replacing hardcoded 8.25% in `CateringCheckout.tsx`
  - **SB-29 Batch Decline All**: Confirmation dialog for declining all pending quote requests in `VendorCateringDashboard.tsx`
  - **SB-30 Quote Edit Window**: New `isQuoteResponseEditable()` (24hr window + status check) and `updateQuoteResponse()` in `cateringQuotes.ts`, with edit UI in `VendorQuoteResponse.tsx`
  - **SB-31 ETA Time Picker**: Native `type="time"` picker + duration mode toggle with `formatEtaValue()` helper in `VendorCateringDashboard.tsx`
  - **SB-32 Vendor Pause/Resume**: `isPaused`/`cateringPaused` Firestore field, pause/resume banner in `VendorCateringDashboard.tsx`

- **P2 Medium (9 items — SB-22, SB-23, SB-33, SB-34, SB-35, SB-36, SB-37, SB-38, SB-39)**:
  - **SB-22 Half-Star Reviews**: Clip-width technique for fractional star rendering in `CateringReviews.tsx`
  - **SB-23 Search Clear Button**: X icon clear button with `pr-10` input padding in `CateringItemList.tsx`
  - **SB-33 Audio Mute Toggle**: `audioMuted` state persisted to localStorage, `Volume2/VolumeX` toggle in vendor dashboard
  - **SB-34 Vendor Assignment Badges**: Per-item "Assigned to [name]" badge replacing price input for items assigned to other vendors in `VendorQuoteResponse.tsx`
  - **SB-35 Modification Alert**: Pulsing amber dot on orders with `vendorModified && !accepted && !rejected` in `CateringOrderStatus.tsx`
  - **SB-36 Rejection Rollback**: Rejects vendor modifications by reverting to `order.originalItems` and recalculating total
  - **SB-37 Delivery Address Modal**: Pre-finalization delivery address capture in `QuoteComparison.tsx`
  - **SB-38 Quote Expiry Check**: Expiry validation in `handleAcceptItems` with "Accept Anyway" warning modal
  - **SB-39 Multi-Vendor RFP Summary**: `vendorSummary` useMemo grouping items by vendor with per-vendor subtotals + grand total

- **P3 Low (8 items — SB-40, SB-41, SB-42, SB-43, SB-44, SB-45, SB-46, SB-47)**:
  - **SB-40 Role-Based Firestore Rules**: `callerRole` param on `updateOrderStatus()`, `callerUid` on `cancelOrder()`, enhanced `firestore.rules` with `isValidStatusTransition()` helper
  - **SB-41 Reduced Motion**: `prefers-reduced-motion` media query conditionally disabling `animate-ping` animations
  - **SB-42 Status Badge Icons**: Expanded StatusBadge config with emoji icons (⏳, ✓, 🍳, ✔, 🚗, ✅, ✗) for each order status
  - **SB-43 Deep Linking**: `expandedOrder` initialized from `window.location.hash`, synced via `replaceState` for URL bookmarking
  - **SB-44 Inline Messaging**: InlineMessagingModal rewritten with actual Firestore message writes + message history loading
  - **SB-45 Category Ratings**: Optional per-category (foodQuality, presentation, delivery, value, service) 5-star breakdown in `CateringReviewForm.tsx`
  - **SB-46 Review Moderation Panel**: NEW `ReviewModerationPanel.tsx` component with flagged review queue, dismiss/hide actions, integrated into vendor dashboard
  - **SB-47 Recurring Order Overrides**: Confirmed already implemented in `RecurringOrderManager.tsx` — skipped

**Session 25 focused on (March 30, 2026):** Catering Module — Medium Effort Features (#13-14, #17-22) + Large Effort Architecture (#27-28) + Large Effort Features (#29-36) + Bug Fix (Templates nav). This session completed 19 items total.

- **Medium Effort Batch (#13-14, #17-22)**:
  - **#13 Payment Info Section**: New `PaymentInfoSection` component in `CateringOrderStatus.tsx` — fetches vendor payment method/URL via `getBusinessPaymentInfo()`, displays payment method and external pay button. New functions: `updateBusinessPaymentInfo(businessId, {paymentUrl?, paymentMethod?, paymentNote?})` and `getBusinessPaymentInfo(businessId)` in `cateringOrders.ts`.
  - **#14 Message Vendor Button**: New `MessageVendorButton` component in `CateringOrderStatus.tsx` — creates or reuses Firestore conversations via `findOrCreateConversation(customerId, vendorOwnerId, context?)`. Returns conversationId for navigation to messaging view.
  - **#17 Batch Status Updates**: New `batchUpdateOrderStatus(orderIds[], newStatus, extra?)` in `cateringOrders.ts` — processes multiple orders, returns `{success: number, failed: number}`. Optimistic UI in VendorCateringDashboard.
  - **#18 Vendor Order Modification**: New `vendorModifyOrder(orderId, {items, total, subtotal, tax?, note})` in `cateringOrders.ts` — snapshots `originalItems` before applying vendor changes. Tracks `vendorModified` flag, `vendorModifiedAt`, and `vendorModificationNote` on the order document.
  - **#19 Inventory Manager**: New `VendorInventoryManager.tsx` component — stock status management with 3 states (in_stock/low_stock/out_of_stock), color-coded badges with quick-toggle on click, detailed edit form with stock count and availability date windows (availableFrom/availableUntil), filter tabs (All/In Stock/Low Stock/Out of Stock with counts), summary bar with alert badges. Uses `updateMenuItemStock(itemId, {stockStatus?, stockCount?, available?, availableFrom?, availableUntil?})`. Added to `catering.tsx` as lazy-loaded component with Package icon and 'inventory' tab.
  - **#20 Review Sorting & Filters**: Added sorting (newest/oldest/highest/lowest rating) and rating filter pills (1-5 stars) in `CateringReviews.tsx`.
  - **#21 Review Flagging**: New `flagReview(reviewId, flaggedBy, reason)` in `cateringReviews.ts`. Flag button with reason selection UI (inappropriate/spam/fake/other). Flagged badge display on reviewed items. `notifyReviewFlagged(vendorOwnerId, reviewId, reason, businessName)` sends notification.
  - **#22 Vendor Review Notification**: `notifyVendorNewReview(vendorOwnerId, businessName, reviewerName, rating, reviewText)` called after `submitCateringReview()` in `CateringReviewForm.tsx`. Looks up business `ownerId` for routing. New notification types `vendor_new_review` and `review_flagged` added to `notificationService.ts` and Cloud Functions `NOTIFICATION_TEMPLATES`.

- **Architecture Refactor (#27-28)**:
  - **#27 Domain Module Split**: Split `cateringService.ts` (1800+ lines) into 7 domain sub-modules under `src/services/catering/`:
    - `cateringTypes.ts` — All shared TypeScript interfaces (CateringMenuItem, OrderItem, DeliveryAddress, CateringOrder, CateringQuoteRequest, CateringQuoteResponse, CateringReview, FavoriteOrder, RecurringOrder, OrderTemplate, etc.)
    - `cateringMenu.ts` — Menu CRUD: `fetchMenuItemsByBusiness()`, `fetchMenuItemsByCategory()`, `createMenuItem()`, `updateMenuItem()`, `deleteMenuItem()`, `updateMenuItemStock()`
    - `cateringOrders.ts` — Orders & payments: `createOrder()`, `fetchOrdersByCustomer()`, `fetchOrdersByBusiness()`, `subscribeToCustomerOrders()`, `subscribeToBusinessOrders()`, `updateOrderStatus()`, `cancelOrder()`, `batchUpdateOrderStatus()`, `vendorModifyOrder()`, `formatPrice()`, `calculateOrderTotal()`, `fetchCateringBusinesses()`, `fetchCateringBusinessesByCategory()`, `updateBusinessPaymentInfo()`, `getBusinessPaymentInfo()`, `findOrCreateConversation()`
    - `cateringQuotes.ts` — 18 quote functions: `createQuoteRequest()`, `isQuoteRequestEditable()`, `quoteEditTimeRemaining()`, `updateQuoteRequest()`, `fetchQuoteRequestsByCustomer()`, `fetchOpenQuoteRequests()`, `fetchQuoteRequestsForBusiness()`, `subscribeToCustomerQuoteRequests()`, `subscribeToBusinessQuoteRequests()`, `updateQuoteRequestStatus()`, `createQuoteResponse()`, `fetchQuoteResponsesByRequest()`, `fetchQuoteResponsesByBusiness()`, `subscribeToQuoteResponses()`, `acceptQuoteResponse()`, `declineQuoteResponse()`, `acceptQuoteResponseItems()`, `finalizeQuoteRequest()`
    - `cateringReviews.ts` — Reviews: `fetchCateringReviews()`, `submitCateringReview()`, `hasReviewedOrder()`, `addVendorResponse()`, `flagReview()`
    - `cateringRecurring.ts` — Favorites & recurring: `saveFavoriteOrder()`, `fetchFavoriteOrders()`, `subscribeToFavorites()`, `updateFavoriteOrder()`, `deleteFavoriteOrder()`, `reorderFromFavorite()`, `computeNextRunDate()`, `estimateMonthlyRecurringCost()`, `createRecurringOrder()`, `fetchRecurringOrders()`, `subscribeToRecurringOrders()`, `updateRecurringOrder()`, `deleteRecurringOrder()`, `toggleRecurringOrder()`, `setOccurrenceOverride()`, `clearOccurrenceOverride()`
    - `cateringTemplates.ts` — Templates: `createOrderTemplate()`, `fetchMyTemplates()`, `fetchOrgTemplates()`, `fetchTemplateByShareCode()`, `updateOrderTemplate()`, `deleteOrderTemplate()`, `recordTemplateUsage()`, `fetchPublicTemplates()`, `fetchTemplateUsageStats()`, `subscribeToTemplates()`
    - `index.ts` — Barrel re-export of all modules
    - Original `cateringService.ts` converted to a single-line re-export: `export * from './catering'` — zero import breakage across the app.

  - **#28 Optimistic Updates**: Applied consistent capture-prev-state → update-UI-immediately → revert-on-error pattern across 4 components (12 write operations):
    - `VendorCateringDashboard.tsx`: handleStatusChange, handleBatchAction, handleCancelOrder, handleSaveModification
    - `RecurringOrderManager.tsx`: handleToggle, handleDelete, saveOccurrenceOverride, skipNextOccurrence, revertOverride
    - `FavoriteOrders.tsx`: handleDelete, handleRename, handleSaveAddress
    - `CateringOrderStatus.tsx`: optimistic cancel order
    - Pattern: capture `prevOrders = [...orders]` → immediately `setOrders(orders.map(...))` → try service call → catch: `setOrders(prevOrders)` + toast error. Firestore real-time subscriptions auto-reconcile optimistic state once server confirms.

- **Large Effort Features (#29-36)**:
  - **#29 Template Marketplace**: Added "My Templates" / "Discover" tab navigation in `OrderTemplates.tsx`. New `fetchPublicTemplates(options?: {cuisineCategory?, sortBy?: 'popular'|'newest', limit?})` queries `isPublic: true` templates, sorted by `useCount` (popular) or `createdAt` (newest). Discover tab shows grid of public templates with creator, business, item count, total price, and "Used Nx times" stat.
  - **#30 Template Versioning**: `updateOrderTemplate()` modified to detect content changes (items, headcount, specialInstructions), fetch current doc, compare, and create `versionHistory` entry via `arrayUnion`. Each version entry stores: `{version, items[], headcount?, specialInstructions?, updatedAt, updatedBy}`. `version` field auto-increments. Collapsible version history UI in OrderTemplates with "Restore" button to revert to earlier version.
  - **#31 Usage Analytics**: `recordTemplateUsage(tmplId, userId?)` writes to `cateringTemplates/{id}/usageLog` subcollection with optional userId and timestamp. New `fetchTemplateUsageStats(tmplId)` reads usageLog subcollection, computes `{totalUses, last7Days, last30Days, recentUsers[]}`. Lazy-loaded usage stats panel in template detail view.
  - **#32 Analytics Drill-Down**: `VendorAnalytics.tsx` — clickable revenue bar chart (Recharts `onClick` on `<Bar>`) shows orders for selected day in a detail panel. Clickable pie chart slices (onClick on `<Cell>`) filter all metrics by order status. Dismiss filter button to reset.
  - **#33 Popular Items / Best Sellers**: Top-10 items ranking in VendorAnalytics extracted from delivered order data. Shows item name, quantity sold, and revenue bars.
  - **#34 Peak Times Analysis**: Bar chart showing order volume by hour of day (0-23h) in VendorAnalytics. Helps vendors plan staffing and preparation.
  - **#35 Period Comparison**: Compare toggle in VendorAnalytics shows previous-period metrics side-by-side with current period. New `MetricCardWithComparison` component displays delta arrows (↑/↓) and percentage change indicators with color coding (green for positive, red for negative).
  - **#36 Customer Retention**: Unique customer count, repeat customer count, repeat rate percentage, and top 5 customers by order volume and total spend in VendorAnalytics.

- **Bug Fix — Missing Templates Navigation**: Discovered that the Templates view was only reachable through Favorites → "Save as Template" button on a specific favorite order. No direct nav button existed. Added standalone "Templates" pill button with `ClipboardList` icon in the top navigation bar of `catering.tsx`, next to the "Saved" button. Templates and Saved now have separate highlight states.

- **Git Commits (Session 25)**:
  - `2a09477` — feat: medium effort batch 2 — payment, messaging, batch ops, inventory, reviews (#13-14, #17-22)
  - `0b74293` — refactor: split cateringService into domain modules + add optimistic updates (#27-28)
  - `25bde2f` — feat: large effort batch — template marketplace, versioning, analytics drill-down (#29-36)
  - PENDING — fix: add direct Templates nav button to catering page

- **New/Modified Files (Session 25)**:
  - NEW: `src/services/catering/cateringTypes.ts`, `cateringMenu.ts`, `cateringOrders.ts`, `cateringQuotes.ts`, `cateringReviews.ts`, `cateringRecurring.ts`, `cateringTemplates.ts`, `index.ts` (7 domain modules + barrel)
  - NEW: `src/components/catering/VendorInventoryManager.tsx` (inventory management component)
  - MODIFIED: `src/services/cateringService.ts` → single re-export shim
  - MODIFIED: `src/components/catering/CateringOrderStatus.tsx` (PaymentInfoSection, MessageVendorButton, optimistic cancel)
  - MODIFIED: `src/components/catering/VendorCateringDashboard.tsx` (optimistic updates on 4 handlers)
  - MODIFIED: `src/components/catering/VendorAnalytics.tsx` (drill-down, best sellers, peak times, comparison, retention)
  - MODIFIED: `src/components/catering/CateringReviews.tsx` (sorting, rating filters, flagging)
  - MODIFIED: `src/components/catering/CateringReviewForm.tsx` (vendor notification on submit)
  - MODIFIED: `src/components/catering/OrderTemplates.tsx` (Discover tab, version history, usage stats)
  - MODIFIED: `src/components/catering/RecurringOrderManager.tsx` (optimistic updates)
  - MODIFIED: `src/components/catering/FavoriteOrders.tsx` (optimistic updates)
  - MODIFIED: `src/pages/catering.tsx` (VendorInventoryManager import, inventory tab, Templates nav button)
  - MODIFIED: `src/services/notificationService.ts` (vendor_new_review, review_flagged types + functions)
  - MODIFIED: `functions/src/index.ts` (vendor_new_review, review_flagged email templates)

- **New Firestore Collections/Subcollections (Session 25)**:
  - `cateringTemplates/{id}/usageLog` — per-use tracking subcollection with userId and timestamp (for #31 usage analytics)

- **Decisions (Session 24)**:
  - **Confirmation dialog over silent clear** — Users losing cart items without warning was the #1 UX issue. The dialog gives users an explicit choice: "Keep Current Cart" or "Switch Vendor". The `pendingVendorSwitch` state in the reducer holds the pending item until the user decides.
  - **Touched + submitAttempted validation pattern** — Errors show on blur (per field) OR on submit attempt (all fields). This avoids overwhelming users with errors before they interact, while catching everything on submit.
  - **500-char limit on special instructions** — Prevents abuse while being generous enough for real catering needs. Enforced both in UI (`maxLength`) and character counter display.
  - **Conditional spreads at component level AND filter at service level** — Defense in depth: components avoid passing undefined, and service functions filter it out as a safety net.

### Session 25: Catering Architecture Refactor + Medium & Large Effort Features

- **Domain-driven module split by function grouping (not by feature flag)** — Organized by what the functions operate on: menu items, orders, quotes, reviews, recurring orders, templates. Each module is self-contained with its own Firestore collection access. The barrel re-export in `index.ts` and the shim in `cateringService.ts` ensure zero import breakage — any existing `import { X } from '@/services/cateringService'` continues to work unchanged.

- **Optimistic updates with Firestore subscription reconciliation (not manual refresh)** — The optimistic pattern captures previous state, updates UI immediately, then calls the service. On error, it reverts to the captured state and shows a toast. On success, no manual reconciliation is needed because the existing Firestore `onSnapshot` subscription automatically fires with the server-confirmed data, naturally replacing the optimistic state. This means we never have stale data — the subscription is always the ultimate source of truth.

- **Template versioning via arrayUnion (not separate collection)** — Version history is stored as an array field on the template document itself using `arrayUnion` to append entries. This keeps the template and its history co-located (single read), avoids a subcollection that would need separate queries, and is safe for concurrent writes since `arrayUnion` is atomic. Trade-off: the document size grows with each version, but templates are small (items array + metadata) so this won't hit Firestore's 1MB document limit in practice.

- **Usage analytics via subcollection (not array field)** — Unlike version history, usage logs grow unboundedly (every use creates an entry). A subcollection `cateringTemplates/{id}/usageLog` was chosen over an array field to avoid document size limits. The subcollection also enables efficient date-range queries for computing 7-day/30-day stats without reading the entire history.

- **Standalone Templates nav button (not dropdown under Saved)** — Templates and Favorites serve different user intents: Favorites are for quick reordering, Templates are for sharing standardized orders. Merging them under a single "Saved" button with a dropdown would hide Templates behind an extra click. Separate pill buttons make both features equally discoverable. The "Saved" button highlights for favorites/recurring views; the "Templates" button highlights independently.

- **VendorAnalytics using Recharts onClick handlers (not separate filter UI)** — Drill-down is triggered by clicking directly on chart elements (bar segments, pie slices) rather than a separate filter dropdown. This is more intuitive — users click what they want to explore. The clicked state is stored in component state and cleared with a dismiss button.

- **MetricCardWithComparison component (not inline delta calculation)** — Extracted a reusable component for side-by-side current/previous period metrics with delta arrows. This keeps VendorAnalytics clean and makes the comparison pattern reusable if we add analytics to other modules (business, events).

- **Customer retention computed client-side (not Firestore aggregation)** — Unique/repeat customer counts and top-5 customers are computed from the already-fetched orders array using `Map<string, {count, total}>`. This avoids additional Firestore reads or Cloud Functions. Works well for typical vendor volumes (hundreds to low thousands of orders). If vendors scale to 10K+ orders, consider server-side aggregation.

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

### Session 20: Discover Phases 2-4 — Performance, UX, Architecture & Accessibility

- **Per-pill gradient colors (not uniform active color)** — User requested distinct color gradients for each pill when selected: green (`from-green-400 to-emerald-600`) for Discover, blue (`from-blue-400 to-indigo-600`) for Network, orange (`from-orange-400 to-amber-600`) for Pending. Unselected pills keep the original purple gradient (`bg-white/20`). This uses inline styles with `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` and `transform: scale(1.03)` for subtle press feedback. Cross-browser: includes `-webkit-backdrop-filter`, `-webkit-tap-highlight-color: transparent`.

- **Emoji regex `\p{Emoji_Presentation}|\p{Extended_Pictographic}` (not `\p{Emoji}`)** — The `\p{Emoji}` regex class matches basic ASCII characters like `#`, `*`, `0-9` which are technically in the Unicode Emoji range. Using `\p{Emoji_Presentation}|\p{Extended_Pictographic}` with the `u` flag correctly detects only visual emoji characters like 👩‍💻 and 🧑‍💻 without false positives.

- **Explicit Tailwind classes for heritage text (not dynamic interpolation)** — `text-${size}` gets stripped by Tailwind's purge because the compiler can't detect dynamic class names at build time. Changed to `const textSizeClass = size === 'sm' ? 'text-sm' : 'text-xs'` with full static class names that survive purging.

- **`cp` sync ELIMINATED for discover.tsx (not extended)** — After verifying in `App.tsx` that only `src/pages/discover` is imported (the router never uses `main/discover`), the duplicate `src/pages/main/discover.tsx` was deleted outright. This is a deliberate departure from the `cp` sync pattern used for `messages.tsx` and `business.tsx`. The decision was safe because: (1) `App.tsx` grep confirmed no import of `main/discover`, (2) the build succeeded without it, (3) the deployed site works correctly. This sets a precedent for eventually eliminating other `cp` sync duplicates.

- **PersonCard as variant-based component (not separate components per context)** — Rather than creating separate `PYMKCard`, `GridCard`, `IncomingCard`, `SentCard` components, a single `PersonCard` component uses a `variant` prop (`'grid' | 'pymk-city' | 'pymk-heritage' | 'pymk-interests' | 'incoming' | 'sent'`) to control layout and rendering. This keeps the card logic centralized and avoids duplication of shared rendering code (avatar, heritage, HighlightText, MatchBadge).

- **`useReducer` for modal + filter state (not all state)** — Only the closely-related modal state (selectedProfile, showMutual, showBlock) and filter state (activeTile, activeTab, sortBy) were consolidated into `useReducer`. Independent state like `searchQuery`, `refreshing`, `toastMessage` remained as individual `useState` hooks. This follows the principle of grouping state that changes together, not forcing everything into a single reducer.

- **`useFocusTrap` as standalone hook (not shared with Business)** — The Business module has its own `useModalA11y` hook in `BusinessModals.tsx`. Rather than trying to unify them (which would require refactoring Business), a separate `useFocusTrap` hook was created for Discover modals. Both achieve the same goal but are tailored to their respective component structures.

- **Arrow key navigation on PYMK carousels (not Tab cycling)** — Tab key naturally moves between focusable cards. Arrow keys (Left/Right) provide additional carousel-specific navigation that scrolls the container and moves focus to the adjacent card. This follows the WAI-ARIA carousel pattern where Arrow keys navigate within the widget.

- **`aria-live="polite"` with `sr-only` class (not visible text)** — The dynamic results count ("Found 7 people matching your filters") is announced to screen readers via an `aria-live="polite"` region with `aria-atomic="true"`, but hidden visually with `sr-only`. The visible text in the UI has its own formatting and doesn't need to be duplicated.

- **Color contrast: secondary text left as-is (not forced to 4.5:1)** — The heritage text (green, 3.65:1) and city text (gray, 2.97:1) are pre-existing design choices that serve as secondary/decorative information. Forcing them to 4.5:1 would require significantly darkening the green and gray, changing the visual design. The primary interactive elements (headings, buttons, badges) all pass WCAG AA. This was documented as a known limitation.

### Session 19: Discover Page Phase 1 — Critical Fixes & Quick Wins

- **Dedicated `'pending'` tab state (not reusing `'network'`)** — The pending tab was broken because clicking it set `activeTab` to `'network'`, showing the same connected users. Adding `'pending'` as a third union type value with its own filter branch was the cleanest fix. The filter checks both `status === 'pending'` AND `detail.initiatedBy !== user?.uid` to show only incoming requests (not requests you sent).

- **Pre-computed mutual connections via `useMemo` Map (not per-render function calls)** — The original `getMutualConnectionCount()` iterated all connections for every card on every render, called 2-3 times per card (grid + PYMK + badge). With 100+ users, this was O(n²) per render cycle. The fix pre-computes all mutual connections in a single `useMemo` pass, producing a `Map<string, User[]>`. The `getMutualConnectionCount` and `getMutualConnections` functions are now `useCallback` wrappers returning O(1) lookups from the map. The map recomputes only when `people` or `connections` change.

- **`searchRank()` with priority levels (not just fuzzy match)** — The original `fuzzyMatch` function did character-by-character subsequence matching, which meant "sa" matched "Sports" (s...a in "Sports"). The new `searchRank()` returns priority levels: prefix (1), word-start (1), substring (2), fuzzy (3), no match (0). Results are sorted by rank first, then by secondary criteria. This ensures "Sarath" appears before "Sports" when searching "sa".

- **MatchBadge `inline` prop (not repositioning absolute)** — Rather than trying to find a non-overlapping absolute position for the match badge (which varies by card size and screen width), an `inline` boolean prop renders it as a flow element in the flex row. Simpler, more reliable, and works across all screen sizes.

- **Dead `viewMode` code removed (not kept for future use)** — The list view toggle was removed entirely because no UI button to switch to list view exists. Keeping dead code adds maintenance burden and confusion. If a list view is needed in the future, it should be designed fresh as a separate component.

- **`env(safe-area-inset-bottom)` with Tailwind fallback (not just one or the other)** — Toast positioning uses both: Tailwind `bottom-24` class as the base, plus inline `style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}`. If `env()` is unsupported (older Android WebViews), the Tailwind class applies. If supported, the inline style overrides with proper safe-area offset.

- **`@supports not selector(:focus-visible)` CSS fallback (not JavaScript polyfill)** — iOS Safari < 15.4 doesn't support `:focus-visible`. Rather than adding a JavaScript polyfill, a pure CSS `@supports` rule applies `:focus` styles on `[role="button"]` elements only when `:focus-visible` is unsupported. This is simpler, has zero runtime cost, and degrades gracefully.

- **`cp` sync pattern extended to discover.tsx** — `src/pages/discover.tsx` must stay identical to `src/pages/main/discover.tsx`, same as business.tsx and messages.tsx. After every edit: `cp src/pages/discover.tsx src/pages/main/discover.tsx`.

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

### Session 22 (March 28, 2026) — Catering Module: Phase 1 Place Order + Phase 2 RFP + Firestore Fixes

**Phase 1 — Place Order (Direct Ordering):**
| Task | File(s) Changed/Created | Status |
|------|------------------------|--------|
| Catering feature flag (`modules_catering`) in FeatureSettings | `src/contexts/FeatureSettingsContext.tsx` | ✅ |
| Catering reducer (state, actions, types) | `src/reducers/cateringReducer.ts` (NEW) | ✅ |
| Catering service (Firestore CRUD for menus, orders, quotes) | `src/services/cateringService.ts` (NEW) | ✅ |
| Category grid component | `src/components/catering/CateringCategoryGrid.tsx` (NEW) | ✅ |
| Item list component (grouped by business) | `src/components/catering/CateringItemList.tsx` (NEW) | ✅ |
| Cart panel component (slide-out) | `src/components/catering/CateringCart.tsx` (NEW) | ✅ |
| Checkout form component (multi-section) | `src/components/catering/CateringCheckout.tsx` (NEW) | ✅ |
| Order-for selector component (radio cards) | `src/components/catering/OrderForSelector.tsx` (NEW) | ✅ |
| Vendor catering dashboard | `src/components/catering/VendorCateringDashboard.tsx` (NEW) | ✅ |
| Catering main page (orchestrator) | `src/pages/catering.tsx` (NEW) | ✅ |
| Home page catering tile | `src/pages/main/home.tsx` | ✅ |
| ModuleSelector nav catering entry | `src/components/layout/ModuleSelector.tsx` | ✅ |
| Admin catering tab (orders, stats, caterers) | `src/pages/admin.tsx` | ✅ |

**Phase 2 — Request for Price (Privacy-First RFP):**
| Task | File(s) Changed/Created | Status |
|------|------------------------|--------|
| Cuisine food item catalog (17 categories, 200+ items) | `src/constants/cateringFoodItems.ts` (NEW) | ✅ |
| RFP form with cuisine picker + multi-select checkboxes | `src/components/catering/RequestForPriceForm.tsx` (NEW, MAJOR REWRITE) | ✅ |
| Quote comparison view (customer side) | `src/components/catering/QuoteComparison.tsx` (NEW) | ✅ |
| Vendor quote response form | `src/components/catering/VendorQuoteResponse.tsx` (NEW) | ✅ |
| Firestore rules for catering collections | `firestore.rules` | ✅ |
| Firestore composite indexes | `firestore.indexes.json` (NEW) | ✅ |
| Target Caterers section commented out (privacy-first) | `src/components/catering/RequestForPriceForm.tsx` | ✅ |

**Firestore Bug Fixes:**
| Task | File(s) Changed | Status |
|------|-----------------|--------|
| Fix `addDoc()` with undefined `specialInstructions` | `src/pages/catering.tsx` | ✅ |
| Fix `addDoc()` with undefined `targetBusinessIds` | `src/pages/catering.tsx` | ✅ |
| Remove `stripUndefined` (corrupted `serverTimestamp()`) | `src/services/cateringService.ts` | ✅ |
| Explicit payload builder for `createQuoteRequest` | `src/services/cateringService.ts` | ✅ |
| Explicit payload builder for `createQuoteResponse` | `src/services/cateringService.ts` | ✅ |
| Fix `businessHeritage: undefined` in quote submission | `src/services/cateringService.ts` | ✅ |
| Remove `orderBy()` from ALL queries (client-side sort) | `src/services/cateringService.ts` | ✅ |
| Add error callbacks to all `onSnapshot` subscriptions | `src/services/cateringService.ts` | ✅ |

**Vendor UX Improvements:**
| Task | File(s) Changed | Status |
|------|-----------------|--------|
| Vendor pill moved to top-level header (next to My Quotes) | `src/pages/catering.tsx` | ✅ |
| Vendor pill visible for ALL approved business owners | `src/pages/catering.tsx` | ✅ |
| Broader business detection (not just catering-enabled) | `src/pages/catering.tsx` | ✅ |

**Cross-Browser Compatibility:**
| Task | File(s) Changed | Status |
|------|-----------------|--------|
| Clipboard API fallbacks for quote sharing | `src/utils/copyToClipboard.ts` | ✅ |
| CSS mobile Safari fixes | Various | ✅ |
| Explicit Vite build targets | `vite.config.ts` | ✅ |

**New files created in Session 22:**
- `src/constants/cateringFoodItems.ts` — Cuisine food item catalog (17 categories, 200+ items)
- `src/reducers/cateringReducer.ts` — Catering state management (views, cart, orders, RFP, quotes)
- `src/services/cateringService.ts` — Firestore CRUD for catering menus, orders, quote requests/responses
- `src/pages/catering.tsx` — Catering module orchestrator page
- `src/components/catering/CateringCategoryGrid.tsx` — Cuisine category cards grid
- `src/components/catering/CateringItemList.tsx` — Menu items grouped by business
- `src/components/catering/CateringCart.tsx` — Slide-out cart panel
- `src/components/catering/CateringCheckout.tsx` — Multi-section checkout form
- `src/components/catering/OrderForSelector.tsx` — Radio card selector for order type
- `src/components/catering/VendorCateringDashboard.tsx` — Vendor dashboard for direct orders
- `src/components/catering/RequestForPriceForm.tsx` — RFP form with cuisine picker
- `src/components/catering/QuoteComparison.tsx` — Customer quote comparison view
- `src/components/catering/VendorQuoteResponse.tsx` — Vendor RFP response form
- `firestore.indexes.json` — Composite indexes for catering collections

**Catering module file structure:**
```
src/
  constants/
    cateringFoodItems.ts          (cuisine catalog — 17 categories, 200+ items)
  reducers/
    cateringReducer.ts            (state, actions, types — views/cart/orders/RFP/quotes)
  services/
    cateringService.ts            (Firestore CRUD — menus, orders, quotes)
  components/catering/
    CateringCategoryGrid.tsx      (cuisine category cards)
    CateringItemList.tsx          (menu items by business)
    CateringCart.tsx               (slide-out cart)
    CateringCheckout.tsx           (checkout form)
    OrderForSelector.tsx           (radio card selector)
    VendorCateringDashboard.tsx    (vendor direct orders)
    RequestForPriceForm.tsx        (RFP form + cuisine picker)
    QuoteComparison.tsx            (customer quote comparison)
    VendorQuoteResponse.tsx        (vendor quote response)
  pages/
    catering.tsx                   (orchestrator — nav pills, view routing, vendor detection)
```

**Firestore collections added:**
- `cateringMenuItems` — Menu items with `businessId`, `category`, `name`, `priceInCents`, `pricingType`
- `cateringOrders` — Direct orders with `customerId`, `businessId`, `items`, `status`, `totalInCents`
- `cateringQuoteRequests` — RFPs with `customerId`, `deliveryCity`, `cuisineCategory`, `items`, `headcount`, `eventDate`, `status`
- `cateringQuoteResponses` — Vendor quotes with `requestId`, `businessId`, `pricePerPerson`, `totalPrice`, `message`

**Key patterns introduced in Session 22:**
- Explicit Firestore payload builders — build each field individually, only add optional fields when present
- Client-side sorting — fetch without `orderBy()`, sort with `Array.sort()` post-fetch
- Broader business detection — two-step: check loaded catering businesses first, fallback to general approved business query
- Cuisine picker UX — dropdown → multi-select checkboxes with search, dietary tags, pricing type badges
- RFP privacy architecture — customer identity hidden from vendors, only delivery city shared

### Session 20 (March 26, 2026) — Discover Phases 2-4: Performance + UX Polish + Architecture & Accessibility

**Phase 2 — Performance & Data Layer (items 2.1–2.9):**
| Task | File(s) Changed | Status |
|------|-----------------|--------|
| #2.1: Fix N+1 Firestore reads — batch `getDocs` for connections | `src/pages/discover.tsx` | ✅ |
| #2.2: Cursor-based pagination for people list | `src/pages/discover.tsx` | ✅ |
| #2.3: Mutual connection pre-compute refinement | `src/pages/discover.tsx` | ✅ |
| #2.4: Migration flag for connection data schema | `src/pages/discover.tsx` | ✅ |
| #2.5: Match score memoization | `src/pages/discover.tsx` | ✅ |
| #2.6: Map reference stability | `src/pages/discover.tsx` | ✅ |
| #2.7: `onSnapshot` for connections (real-time updates) | `src/pages/discover.tsx` | ✅ |
| #2.8: Redundant blocked users read elimination | `src/pages/discover.tsx` | ✅ |
| #2.9: PYMK single-pass optimization | `src/pages/discover.tsx` | ✅ |

**Phase 3 — UX Polish & Feature Gaps (items 3.1–3.10):**
| Task | File(s) Changed | Status |
|------|-----------------|--------|
| #3.1: Pill gradient colors (green/blue/orange per pill) | `src/pages/discover.tsx` | ✅ |
| #3.2: Emoji detection fix (`\p{Emoji_Presentation}`) | `src/pages/discover.tsx` | ✅ |
| #3.3: Heritage text rendering fix (explicit Tailwind classes) | `src/pages/discover.tsx` | ✅ |
| #3.4: Sticky header fix (`-webkit-sticky`) | `src/pages/discover.tsx` | ✅ |
| #3.5: PYMK scrollbar fix (`hide-scrollbar` CSS class) | `src/pages/discover.tsx`, `src/index.css` | ✅ |
| #3.6: Modal iOS fix (`min(90vh, 90dvh)` + WebkitOverflowScrolling) | `src/pages/discover.tsx` | ✅ |
| #3.7: Toast animation fix (`animate-fade-in` keyframes) | `src/index.css` | ✅ |
| #3.8-3.10: Cross-browser compatibility audit & patches | `src/pages/discover.tsx`, `src/index.css` | ✅ |

**Phase 4 — Architecture & Accessibility (items 4.1–4.9):**
| Task | File(s) Changed/Created | Status |
|------|------------------------|--------|
| #4.1: Extract PersonCard component (6 variants) | `src/components/discover/PersonCard.tsx` (NEW, 464 lines) | ✅ |
| #4.2: Extract useConnections hook (state + handlers + listener) | `src/hooks/useConnections.ts` (NEW, 362 lines) | ✅ |
| #4.3: Extract usePYMK hook (groups computation) | `src/hooks/usePYMK.ts` (NEW, 126 lines) | ✅ |
| #4.4: Consolidate useState into useReducer (modal + filter state) | `src/pages/discover.tsx` | ✅ |
| #4.5: Full keyboard navigation (ArrowLeft/Right in PYMK carousels) | `src/pages/discover.tsx` | ✅ |
| #4.6: `aria-live` regions for dynamic content (results count, toast) | `src/pages/discover.tsx` | ✅ |
| #4.7: Focus trapping in modals | `src/hooks/useFocusTrap.ts` (NEW, 65 lines) | ✅ |
| #4.8: Color contrast audit (WCAG 2.1 AA — primary elements pass 4.5:1) | `src/pages/discover.tsx` | ✅ |
| #4.9: Eliminate cp sync pattern — deleted `src/pages/main/discover.tsx` | `src/pages/main/discover.tsx` (DELETED) | ✅ |

**Git commits (Session 20):**
- `f149d59` — feat: Discover Page Phase 2 — Performance & Data Layer (items 2.1–2.9)
- `074f201` — feat: Discover Page Phase 3 — UX Polish & Feature Gaps (items 3.1–3.10)
- *(uncommitted)* — Phase 4: Architecture & Accessibility (items 4.1–4.9) — needs commit

**Line count changes:**
- `discover.tsx`: 1,716 → 1,999 lines (+283, gained Phase 2-3 features, then shed code to hooks/components in Phase 4)
- **New: `src/hooks/useConnections.ts`**: 362 lines (connection state, handlers, real-time Firestore listener, legacy migration)
- **New: `src/hooks/usePYMK.ts`**: 126 lines (PYMK groups computation, expandedPymk state)
- **New: `src/hooks/useFocusTrap.ts`**: 65 lines (modal focus trapping, Tab/Shift+Tab, save/restore focus)
- **New: `src/components/discover/PersonCard.tsx`**: 464 lines (variant-based card: grid/pymk-city/pymk-heritage/pymk-interests/incoming/sent)
- `src/index.css`: 508 lines (+8, `scrollbar-hide` alias + `animate-fade-in` keyframes with `-webkit-animation` prefix)
- **Deleted: `src/pages/main/discover.tsx`** (cp sync eliminated — verified not imported by App.tsx)

**Discover module file structure (Phase 4 complete):**
```
src/
  hooks/
    useConnections.ts          (362 lines — connection state, handlers, real-time listener, legacy migration)
    usePYMK.ts                 (126 lines — PYMK groups computation, expandedPymk state)
    useFocusTrap.ts            (65 lines — modal focus trapping, Tab/Shift+Tab cycle)
  components/discover/
    PersonCard.tsx             (464 lines — variant-based card component, 6 variants)
  pages/
    discover.tsx               (1,999 lines — orchestrator with useReducer, keyboard nav, aria-live, cross-browser)
    main/discover.tsx          DELETED (cp sync eliminated)
```
**Total discover module: ~3,016 lines across 5 files (was 1,716 in single file)**

**Key patterns introduced:**
- `PersonCard` variant prop: `'grid' | 'pymk-city' | 'pymk-heritage' | 'pymk-interests' | 'incoming' | 'sent'`
- `useConnections(userId, onToastMessage)` → returns connections map, handlers, computed counts
- `usePYMK(people, connections, PYMK_PREVIEW)` → returns pymkGroups, expandedPymk, setExpandedPymk
- `useFocusTrap(ref, isOpen)` → traps Tab/Shift+Tab, saves/restores previous focus
- `dispatchModal({ type: "OPEN_PROFILE", payload: person })` — useReducer for modal state
- `dispatchFilter({ type: "SET_ACTIVE_TILE", payload: 'members' })` — useReducer for filter state
- Pill gradient: inline styles with `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`, `transform: scale(1.03)`
- Emoji regex: `const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u`
- `handleCarouselKeyDown(e, carouselRef)` — Arrow key navigation for PYMK carousel scrolling + focus movement

**Chrome testing results (all 9 Phase 4 items verified on `mithr-1e5f4.web.app`):**
- 4.1 PersonCard: All card variants render (PYMK badges, grid match %, Connect/Pending buttons, heritage, New badges) ✅
- 4.2 useConnections: Connect button changes to Pending, pill counts update ✅
- 4.3 usePYMK: "Similar Interests" section with carousel, "View All (7)" button ✅
- 4.4 useReducer: Modal opens with `role="dialog"`, Escape closes, pill switching updates heading + aria-live ✅
- 4.5 Keyboard nav: ArrowRight moves focus from card to adjacent card in PYMK carousel ✅
- 4.6 aria-live: `aria-live="polite"` region updates on tab switch ("Found 7 people" → "7 connected people") ✅
- 4.7 Focus trap: Modal has 4 focusable elements, Tab stays inside modal, Escape closes ✅
- 4.8 Color contrast: H2 13.58:1, H4 15.92:1, Connect 5.25:1, Pending 4.52:1 (all pass AA) ✅
- 4.9 cp sync: Only `src/pages/discover.tsx` exists, `main/discover.tsx` deleted ✅

### Session 19 (March 25, 2026) — Discover Page Phase 1: Critical Fixes & Quick Wins (items 1.1–1.10)
| Task | File(s) Changed | Status |
|------|-----------------|--------|
| #1.1: Pending tab fix — added `'pending'` to activeTab union, new filter branch, Accept/Decline buttons | `src/pages/discover.tsx` | ✅ |
| #1.2: Mutual connection pre-computation — `useMemo` Map replacing O(n²) per-render calls | `src/pages/discover.tsx` | ✅ |
| #1.3: MatchBadge inline prop — prevents overlap with 3-dot menu | `src/pages/discover.tsx` | ✅ |
| #1.4: Dead code removal — `viewMode`, `hoveringDisconnect`, list view branch (~150 lines), unused imports | `src/pages/discover.tsx` | ✅ |
| #1.5: SkeletonCard aurora theme — uses `var(--aurora-*)` CSS variables | `src/pages/discover.tsx` | ✅ |
| #1.6: Refresh button — extracted `fetchPeople` useCallback, RefreshCw icon with spin animation | `src/pages/discover.tsx` | ✅ |
| #1.7: Toast safe-area positioning — `env(safe-area-inset-bottom)` + Tailwind fallback | `src/pages/discover.tsx` | ✅ |
| #1.8: Duplicate connection requests removal — removed from Discover tab PYMK area (~80 lines) | `src/pages/discover.tsx` | ✅ |
| #1.9: Search ranking — `searchRank()` with prefix/word-start/substring/fuzzy priority levels | `src/pages/discover.tsx` | ✅ |
| #1.10: Accessibility — `role="button"`, `tabIndex={0}`, `aria-label`, `focus-visible:ring-2`, `onKeyDown` on all 6 card types | `src/pages/discover.tsx` | ✅ |
| Cross-browser: `@supports not selector(:focus-visible)` fallback for iOS Safari < 15.4 | `src/index.css` | ✅ |
| Sync to main/discover.tsx | `src/pages/main/discover.tsx` | ✅ |
| TypeScript check — zero errors | `tsc --noEmit` passes clean | ✅ |
| Vite build — passes clean | `npm run build` passes clean | ✅ |

**Git commits (Session 19):**
- `bd6c412` — feat: Discover Page Phase 1 — Critical Fixes & Quick Wins (items 1.1–1.10)
- `c3fb1d3` — fix: cross-browser compatibility for Discover Phase 1 changes

**Line count change:** `discover.tsx` reduced from 1,846 → 1,716 lines (−130 lines, net after dead code removal and new features)

**Key patterns introduced:**
- `searchRank(text, query): number` — ranked search with priority levels (1=prefix/word-start, 2=substring, 3=fuzzy, 0=no match)
- `mutualConnectionsMap: Map<string, User[]>` via `useMemo` — pre-computed mutual connections for O(1) lookups
- `env(safe-area-inset-bottom)` + Tailwind class fallback pattern for notched device compatibility
- `@supports not selector(:focus-visible)` CSS pattern for graceful degradation on older browsers

### Session 18 (March 25, 2026) — Business Phase 4 Completion: ALL 42 Roadmap Items Done
| Task | File(s) Changed/Created | Status |
|------|------------------------|--------|
| #25: Filter Chips UI — active filter chips bar with dismiss and clear-all | `src/pages/business.tsx` | ✅ |
| #37: CSV Bulk Import — 4-step wizard with smart column mapping | `src/components/business/BusinessCSVImport.tsx` (NEW, ~480 lines) | ✅ |
| #38: Distance-Based Sorting — Haversine formula, "Nearest" sort pill, distance badges | `src/components/business/businessUtils.ts`, `BusinessCard.tsx`, `FeaturedCarousel.tsx` | ✅ |
| #39: Real-Time onSnapshot — replaced one-time getDocs with live listener | `src/hooks/useBusinessData.ts` | ✅ |
| #40: List Virtualization — IntersectionObserver + content-visibility chunked grid | `src/components/business/VirtualizedBusinessGrid.tsx` (NEW, ~160 lines) | ✅ |
| #41: Parallel Image Compression — `Promise.allSettled` with progress callback | `src/components/business/imageUtils.ts`, `BusinessCreateModal.tsx`, `BusinessEditModal.tsx` | ✅ |
| #42: Advanced Search with Autocomplete — typeahead with recent searches, category suggestions, name matches | `src/pages/business.tsx` | ✅ |
| #28: Advanced Search/Filters — covered by #42 autocomplete + #25 filter chips | Combined | ✅ |
| Cross-browser geolocation fix — two-phase approach for iOS/Firefox/Android | `src/pages/business.tsx` | ✅ |
| Sync to main/business.tsx | `src/pages/main/business.tsx` | ✅ |
| TypeScript check — zero errors | `tsc --noEmit` passes clean | ✅ |

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
| Discover | `src/pages/discover.tsx` | 1,999 (+ 1,017 in hooks/components) | Done — ALL 38 roadmap items complete across Phases 1-4. Architecture refactored: useConnections, usePYMK, useFocusTrap hooks + PersonCard component. cp sync eliminated. |
| Business | `src/pages/business.tsx` | ~680 (was 2,500) | Done — ALL 42 roadmap items complete across Phases 1-4 |
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

### Business Sign-Up Wizard (Session 21)
- 5-step registration wizard: Identity → Location → Verification → Details → Review
- 10 admin-granular KYC feature flags (all default `false`)
- Google Places Autocomplete with session tokens for billing optimization
- Leaflet map preview (CDN, same pattern as BusinessMapView)
- Firestore backend: business doc creation, parallel photo/doc uploads to Storage, draft auto-save
- Admin review queue with approve/reject workflow
- Zero impact on existing individual sign-up flow

### Session 26 (April 1, 2026) — Round 2 Service Blueprint Audit: 30 Findings (SB-18 through SB-47)

**All 30 findings implemented across 4 priority tiers, 4 git commits, zero build errors.**

| Finding | Description | File(s) | Commit | Status |
|---------|-------------|---------|--------|--------|
| SB-18 | Inline quantity stepper | `CateringItemCard.tsx` | `2e20c84` (P0) | ✅ |
| SB-19 | Collapsible checkout sections | `CateringCheckout.tsx` | `2e20c84` (P0) | ✅ |
| SB-20 | Session storage persistence | `CateringCheckout.tsx` | `2e20c84` (P0) | ✅ |
| SB-21 | Undo cart removal | `CateringCart.tsx` | `aa06530` (P1) | ✅ |
| SB-22 | Half-star reviews | `CateringReviews.tsx` | `dcfef06` (P2) | ✅ |
| SB-23 | Search clear button | `CateringItemList.tsx` | `dcfef06` (P2) | ✅ |
| SB-24 | Low stock badge "N left" | `CateringItemCard.tsx` | `2e20c84` (P0) | ✅ |
| SB-25 | Accessible radio inputs | `OrderForSelector.tsx` | `aa06530` (P1) | ✅ |
| SB-26 | OrderForContext validation | `OrderForSelector.tsx`, `CateringCheckout.tsx` | `aa06530` (P1) | ✅ |
| SB-27 | Two-step payment flow | `CateringOrderStatus.tsx` | `2e20c84` (P0) | ✅ |
| SB-28 | State-based tax rates | `CateringCheckout.tsx` | `aa06530` (P1) | ✅ |
| SB-29 | Batch decline all | `VendorCateringDashboard.tsx` | `aa06530` (P1) | ✅ |
| SB-30 | Quote edit window | `cateringQuotes.ts`, `VendorQuoteResponse.tsx`, `index.ts` | `aa06530` (P1) | ✅ |
| SB-31 | ETA time picker | `VendorCateringDashboard.tsx` | `aa06530` (P1) | ✅ |
| SB-32 | Vendor pause/resume | `VendorCateringDashboard.tsx` | `aa06530` (P1) | ✅ |
| SB-33 | Audio mute toggle | `VendorCateringDashboard.tsx` | `dcfef06` (P2) | ✅ |
| SB-34 | Vendor assignment badges | `VendorQuoteResponse.tsx` | `dcfef06` (P2) | ✅ |
| SB-35 | Modification alert dot | `CateringOrderStatus.tsx` | `dcfef06` (P2) | ✅ |
| SB-36 | Rejection rollback | `CateringOrderStatus.tsx` | `dcfef06` (P2) | ✅ |
| SB-37 | Delivery address modal | `QuoteComparison.tsx` | `dcfef06` (P2) | ✅ |
| SB-38 | Quote expiry check | `QuoteComparison.tsx` | `dcfef06` (P2) | ✅ |
| SB-39 | Multi-vendor RFP summary | `QuoteComparison.tsx` | `dcfef06` (P2) | ✅ |
| SB-40 | Role-based Firestore rules | `cateringOrders.ts`, `firestore.rules` | `e571003` (P3) | ✅ |
| SB-41 | Reduced motion support | `CateringOrderStatus.tsx` | `e571003` (P3) | ✅ |
| SB-42 | Status badge icons | `CateringOrderStatus.tsx` | `e571003` (P3) | ✅ |
| SB-43 | Order deep linking | `CateringOrderStatus.tsx` | `e571003` (P3) | ✅ |
| SB-44 | Inline messaging modal | `CateringOrderStatus.tsx` | `e571003` (P3) | ✅ |
| SB-45 | Category-level ratings | `CateringReviewForm.tsx` | `e571003` (P3) | ✅ |
| SB-46 | Review moderation panel | `ReviewModerationPanel.tsx` (NEW), `VendorCateringDashboard.tsx` | `e571003` (P3) | ✅ |
| SB-47 | Recurring order overrides | Already implemented in `RecurringOrderManager.tsx` | — | ✅ (skipped) |

**Git Commits (Session 26):**
- `2e20c84` — feat(catering): implement 5 P0 critical UX fixes from service blueprint audit
- `aa06530` — feat(catering): implement 8 P1 high-priority UX fixes from service blueprint audit
- `dcfef06` — feat(catering): implement 9 P2 medium-priority UX fixes from service blueprint audit
- `e571003` — feat(catering): implement 7 P3 low-priority polish & accessibility fixes

**New files (Session 26):**
- `src/components/catering/ReviewModerationPanel.tsx` — Flagged review queue with dismiss/hide actions for vendor moderation

**New service functions (Session 26):**
- `updateQuoteResponse(responseId, updates)` in `cateringQuotes.ts` — validates status + 24hr edit window, strips undefined, adds updatedAt
- `isQuoteResponseEditable(response)` in `cateringQuotes.ts` — checks status='submitted' AND within 24hrs of creation

**Modified files (Session 26) — 21 files:**
- `src/components/catering/CateringItemCard.tsx` — inline qty stepper, low stock "N left" badge
- `src/components/catering/CateringCheckout.tsx` — collapsible sections, sessionStorage, state-based tax, OrderForContext validation
- `src/components/catering/CateringOrderStatus.tsx` — two-step payment, modification alerts, rejection rollback, reduced motion, status icons, deep linking, inline messaging
- `src/components/catering/OrderForSelector.tsx` — accessible radio inputs, error props
- `src/components/catering/CateringCart.tsx` — undo removal with 5s window
- `src/components/catering/CateringReviews.tsx` — half-star rendering
- `src/components/catering/CateringReviewForm.tsx` — category-level ratings
- `src/components/catering/CateringItemList.tsx` — search clear button
- `src/components/catering/VendorCateringDashboard.tsx` — batch decline, ETA time picker, vendor pause, audio mute, review moderation integration
- `src/components/catering/VendorQuoteResponse.tsx` — quote edit window, vendor assignment badges
- `src/components/catering/QuoteComparison.tsx` — delivery address modal, quote expiry check, multi-vendor summary
- `src/services/catering/cateringQuotes.ts` — updateQuoteResponse, isQuoteResponseEditable
- `src/services/catering/cateringOrders.ts` — callerRole param, callerUid on cancel
- `src/services/catering/index.ts` — barrel re-exports for new functions
- `firestore.rules` — role-based catering order rules with isValidStatusTransition()

### Session 27 (April 3, 2026) — Catering UI Phases 1-3 + QA Audit + 21 Bug Fixes + Cart Scroll Fix

**Phase 1 — Quick Wins (5 items):** Sort dropdown styling, "No caterers yet" empty states, mobile short title mapping, footer hidden on catering, styled search input.

**Phase 2 — High-Impact UX (6 items):** Two-column desktop checkout (5-col grid, 3:2 split), card-style vendor headers with avatars, category-specific gradient placeholders with icons, minimum order progress bar (amber/green), sticky mobile search, vendor header badges.

**Phase 3 — Polish & Delight (8 items):** Hero banner with featured caterer pills, glass-morphism category cards, dark mode audit, green step badges with checkPop animation, quick info pills (prepTime/serves/popularity), enhanced vendor onboarding empty state, metadata enrichment (prepTimeMinutes, popularityScore on CateringMenuItem).

**QA Audit:** Created comprehensive test plan, executed all tests, found 21 bugs. Generated `Catering_UI_QA_Report.docx`.

**Bug Fix Pass:** Fixed 20 of 21 bugs (1 N/A — component doesn't exist). All verified via code review + grep assertions + production build. Generated `Catering_QA_Verification_Report.docx`.

**Live Bug Fix:** Cart drawer not scrollable on mobile — restructured from `h-full` to flex column layout with `shrink-0`/`flex-1 min-h-0` pattern.

**Commits (4):**
| Hash | Description |
|------|------------|
| `da9ef3f` | Phase 2 UI enhancements — 6 high-impact UX changes |
| `102e9cf` | Phase 3 UI polish & delight — 8 enhancements |
| `64c53e0` | 20 QA bug fixes across all severity tiers |
| `222be4a` | Cart drawer scroll fix for mobile |

**Files modified in Session 27:**
- `src/index.css` — Added `--aurora-bg-rgb`, `--aurora-success` (light+dark), `@keyframes checkPop`, `@media (prefers-reduced-motion: reduce)`
- `src/pages/catering.tsx` — Hero banner, featured caterer pills with vendor-specific navigation, "+N more" overflow pill, complete shortNames mapping
- `src/components/catering/CateringCheckout.tsx` — Two-column layout, validation summary moved to left column, green step badges, aurora-success variables, animation forwards fill-mode, nested sticky fix
- `src/components/catering/CateringItemCard.tsx` — Category gradients, quick info pills, aria-label fix, null guards for prepTime/popularity
- `src/components/catering/CateringItemList.tsx` — Styled sort dropdown, sticky search with safe-area-inset, vendor card headers, dark mode hover fix, dev-mode missing business warning
- `src/components/catering/CateringCategoryGrid.tsx` — Glass-morphism cards, gradient backgrounds, decorative circles, focus-visible rings, double-count fix
- `src/components/catering/CateringCart.tsx` — Progress bar Math.floor, flex column layout for scroll fix
- `src/components/catering/VendorCateringDashboard.tsx` — Enhanced onboarding empty state, filter-aware contextual empty states
- `src/layouts/MainLayout.tsx` — Route check exact match for `/catering`
- `src/services/catering/cateringTypes.ts` — Added `prepTimeMinutes?` and `popularityScore?` to CateringMenuItem

**Reports generated:**
- `Catering_UI_QA_Report.docx` — 21 bugs with severity, reproduction steps, expected vs actual
- `Catering_QA_Verification_Report.docx` — Pass/fail evidence for all 21 bugs post-fix

### Session 28 (April 6, 2026) — RFP-to-Order Conversion Flow + In-Order Messaging

**Problem identified:** When a customer accepts a vendor's RFP quote and finalizes, NO `CateringOrder` records were being created. The quote statuses updated and customer details were revealed to vendors, but there were no trackable orders. The "Track Your Orders" button navigated to an empty orders view.

**User decisions:** (1) Auto-create order on acceptance, (2) Identical flow to direct orders, (3) In-order messaging between customer and vendor.

**What was built:**

1. **CateringOrder type extended** — Added `quoteRequestId?`, `quoteResponseId?`, `rfpOrigin?` fields for RFP backreference
2. **OrderNote type** — New interface for in-order messaging (`id`, `orderId`, `senderId`, `senderName`, `senderRole`, `text`, `createdAt`)
3. **`createOrdersFromQuote()` service function** — Groups `itemAssignments` by vendor, creates one `CateringOrder` per vendor with status `confirmed` (auto-confirmed since quote was already accepted), backreferences to quote request/response
4. **`addOrderNote()` + `subscribeToOrderNotes()`** — Firestore subcollection CRUD for `cateringOrders/{id}/notes`
5. **OrderMessages component** — Collapsible real-time chat widget with own/other message bubbles, auto-scroll, Enter-to-send
6. **QuoteComparison wired** — Both finalization paths (address form modal + legacy handler) now call `createOrdersFromQuote()` after `finalizeQuoteRequest()`
7. **CateringOrderStatus wired** — OrderMessages component added for customer view, RFP badge in order header
8. **VendorCateringDashboard wired** — OrderMessages component added for vendor view, RFP badge in order header
9. **Firestore rules** — `cateringOrders/{orderId}/notes/{noteId}` subcollection rules added

**Key architecture notes:**
- Orders from RFP start at `confirmed` status (not `pending`) since vendor already accepted the quote
- Multi-vendor RFPs create SEPARATE orders — one per vendor in `itemAssignments`
- `menuItemId` for RFP items uses synthetic format: `rfp_{responseId}_{itemName}` (not real menu item IDs)
- Tax estimated at 8.25% (same as direct orders)
- Customer details pulled from any accepted `CateringQuoteResponse`

**Files modified in Session 28:**
- `src/services/catering/cateringTypes.ts` — Added `quoteRequestId?`, `quoteResponseId?`, `rfpOrigin?` to CateringOrder; new `OrderNote` interface
- `src/services/catering/cateringOrders.ts` — New `createOrdersFromQuote()`, `addOrderNote()`, `subscribeToOrderNotes()` functions
- `src/services/catering/index.ts` — Barrel re-exports for new types and functions
- `src/components/catering/QuoteComparison.tsx` — Both finalization handlers now auto-create orders
- `src/components/catering/CateringOrderStatus.tsx` — OrderMessages widget + RFP badge for customer
- `src/components/catering/VendorCateringDashboard.tsx` — OrderMessages widget + RFP badge for vendor
- `src/components/catering/OrderMessages.tsx` — **NEW FILE** — Collapsible in-order messaging widget
- `firestore.rules` — Added `notes` subcollection rules under `cateringOrders`

### Session 28b (April 6, 2026) — Live Testing Quote-to-Order Pipeline + TypeScript Fixes + RFP Badge

**Context:** Continuation of Session 28. User reported that direct orders worked fine but the quote-to-order flow wasn't working on the live site. This session focused on live testing the entire RFP pipeline end-to-end and fixing build-blocking TypeScript errors.

**Bugs found and fixed in Session 28 (earlier part — 4 commits):**

1. **Bug 1 — Finalize Order button hidden when all items assigned:** The condition `isPartiallyAccepted && !allAssigned && assignedCount > 0` failed when `acceptQuoteResponseItems()` set request status to `'accepted'` (not `'partially_accepted'`). Fixed by broadening to `(isPartiallyAccepted || isFullyAccepted) && assignedCount > 0 && !ordersCreated`.
2. **Bug 2 — No auto-prompt for address form:** When `allItemsAssigned` returned true, no `setShowAddressForm(true)` was called. Fixed by adding auto-open when all items assigned.
3. **Bug 3 — Firestore rules checked wrong field:** Rules checked `vendorIds` (doesn't exist on business docs) instead of `ownerId`. Fixed to `== .data.ownerId`.
4. **Bug 4 — quoteRequest.status not updated but items show as assigned:** `assignedItemsMap` is built from BOTH `quoteRequest.itemAssignments` AND `response.acceptedItemNames`, so items appear assigned even when status is still `'open'`. Fixed by using `assignedCount > 0` directly instead of checking request status.

**Key insight:** The `assignedItemsMap` in QuoteComparison is built from two sources — this is a critical detail for anyone touching that component.

**Live testing (Session 28b):**
- Tested complete RFP-originated order status progression on deployed site (`mithr-1e5f4.web.app`)
- Order: Sarath Satheesan, Event 2026-04-07, $128.79 (Mango Lassi + Tandoori Chicken Platter + Samosa Platter)
- All transitions verified: **Confirmed** (auto-set) → **Preparing** → **Ready** → **Out for Delivery** → **Delivered**
- Order correctly moved from Active Orders (count 1→0) to Completed Orders (count 1→2)
- Full pipeline confirmed working for `rfpOrigin: true` orders

**19 pre-existing TypeScript errors fixed (Session 28b):**

1. `CateringItemList.tsx:281` — Replaced `process.env.NODE_ENV === 'development'` with `import.meta.env.DEV` (Vite project, not Node)
2. `CateringOrderStatus.tsx` (5 errors) — Added `modificationAccepted?: boolean`, `modificationRejected?: boolean`, `modificationRespondedAt?: any` to CateringOrder type in cateringTypes.ts
3. `ReviewModerationPanel.tsx:103` — Changed `review.customerName` to `review.userName` (correct field on CateringReview type)
4. `ReviewModerationPanel.tsx:118` — Removed non-existent `review.comment` fallback, kept only `review.text`
5. `VendorAnalytics.tsx:308` — Imported `useToast` from `@/contexts/ToastContext` and wired `addToast` hook
6. `VendorInventoryManager.tsx:352-353` — Fixed `stockStatus` type from loose `string` to proper `StockStatus` union type (`'in_stock' | 'low_stock' | 'out_of_stock'`)
7. `VendorQuoteResponse.tsx` (4 errors) — Added `customerName?: string` to CateringQuoteRequest type in cateringTypes.ts

**RFP badge added to active/pending orders:**
- Purple "RFP" badge (`rgba(139,92,246,0.1)` bg, `#7C3AED` text) was already present in Completed Orders section and Customer Order view
- Added same badge to Pending/Active Orders section in VendorCateringDashboard.tsx (was missing)
- Vendors now see "RFP" tag on all quote-originated orders regardless of status

**Files modified in Session 28b:**
- `src/components/catering/CateringItemList.tsx` — `process.env` → `import.meta.env.DEV`
- `src/components/catering/ReviewModerationPanel.tsx` — Fixed `customerName` → `userName`, removed `comment`
- `src/components/catering/VendorAnalytics.tsx` — Added `useToast` import and hook
- `src/components/catering/VendorCateringDashboard.tsx` — Added RFP badge to active/pending orders
- `src/components/catering/VendorInventoryManager.tsx` — Fixed `stockStatus` typing
- `src/services/catering/cateringTypes.ts` — Added `modificationAccepted`, `modificationRejected`, `modificationRespondedAt` to CateringOrder; added `customerName` to CateringQuoteRequest

**Commits (Session 28 + 28b):**
```
bcc9259 fix(catering): quote-to-order conversion and Firestore vendor rules
1feda2a fix(catering): Finalize button now uses assignedCount instead of request status
(hash) fix(catering): resolve 19 TypeScript errors and add RFP badge to active orders
```

### Session 28c (April 6, 2026) — Fix Finalize Bug + Auto-Finalize + Vendor Finalize Pending Indicator

**Context:** Continuation of Session 28b. The "Finalize & Create Orders" button was silently failing — no orders were being created when the customer submitted the address form. Three approved feature requests were implemented.

**Root cause of finalize bug:**
The address form submit handler in `QuoteComparison.tsx` captured the `quoteRequest` prop via closure at render time. When `finalizeQuoteRequest()` was called first (changing the quote status to 'accepted'), the Firestore real-time subscription fired and the parent re-rendered the component with new props. However, the `createOrdersFromQuote()` call used the OLD closure's `quoteRequest` — which may have had stale or incomplete `itemAssignments` data depending on timing. The function was either silently returning empty results or throwing without visible error feedback.

**Fix implemented:**
1. **Re-fetch fresh data from Firestore** — Before calling `createOrdersFromQuote()`, the handler now does `getDoc(doc(db, 'cateringQuoteRequests', quoteRequest.id))` to get the latest `itemAssignments` directly from the server, bypassing the stale closure issue.
2. **Console logging added** — `console.log` for itemAssignments count, responses count, and created order IDs; `console.error` for any failures. This makes future debugging much easier.
3. **ZIP code validation expanded** — Now accepts both US ZIP codes (`12345` or `12345-6789`) and Canadian postal codes (`A1A 1A1`). Previously rejected Canadian postal codes with "Invalid ZIP".

**Auto-finalize feature:**
When a customer accepts items and all items in the quote request become assigned (i.e., `allItemsAssigned` returns true from `acceptQuoteResponseItems`), the system now automatically:
1. Calls `finalizeQuoteRequest()` to mark the quote as 'accepted'
2. Opens the delivery address form immediately
3. Customer fills address → orders are created in one step (no intermediate yellow "Finalize & Create Orders" banner)

This eliminates the confusing two-step finalization gap where vendors saw "Accepted" quotes but no corresponding orders.

**"Finalize Pending" / "Order Created" indicator on vendor's accepted quotes:**
Added two conditional badges to the vendor's Accepted Quotes section in `VendorQuoteResponse.tsx`:
- **"Awaiting Finalization"** (amber badge with Timer icon) — Shows when the quote request has NO `deliveryAddress` set (customer hasn't completed the address step yet)
- **"Order Created"** (purple badge with Package icon) — Shows when the quote request HAS a `deliveryAddress` set (orders should exist)

This gives vendors clear visibility into whether an accepted quote has been converted to an order.

**Files modified in Session 28c:**
- `src/components/catering/QuoteComparison.tsx` — Re-fetch fresh quoteRequest before creating orders; added console logging; fixed ZIP validation for Canadian postal codes; auto-finalize on all-items-assigned; imported `doc`, `getDoc` from firebase/firestore and `db` from services
- `src/components/catering/VendorQuoteResponse.tsx` — Added "Awaiting Finalization" (amber) and "Order Created" (purple) badges to accepted quotes based on `deliveryAddress` presence
- `src/services/catering/cateringTypes.ts` — Added `deliveryAddress?: DeliveryAddress` to `CateringQuoteRequest` interface

**Decisions & rationale:**
- **Why re-fetch from Firestore?** The closure-captured `quoteRequest` prop can be stale by the time `createOrdersFromQuote` runs (race between async handler and real-time subscription). Direct `getDoc` guarantees fresh data.
- **Why auto-finalize?** The two-step flow (accept items → manually finalize) was confusing. Vendors saw "Accepted" quotes with no orders. Auto-finalization closes the gap when all items are assigned.
- **Why `deliveryAddress` as the indicator?** It's the most reliable signal that the customer completed finalization. The `deliveryAddress` is written by `finalizeQuoteRequest()` only during the finalization step.
- **Canadian postal codes:** The app targets diaspora communities including Canadian users. The previous US-only ZIP validation was a friction point during testing.

---

### Session 29 (April 7, 2026) — Fix Duplicate Orders + Messaging Fix + Read Receipts + 48hr Window + Cross-Browser Audit

**Context:** Continuation from Session 28c. Multiple bugs reported by user during live testing, plus new feature requests for messaging UX. Then a full cross-browser compatibility audit and patch.

**Bug 1 — Duplicate order creation:**
`ordersCreated` was React local state only — reset on page refresh, allowing the customer to click "Finalize & Create Orders" multiple times and generate duplicate orders for the vendor.

**Fix:** Added a server-side guard in `createOrdersFromQuote()` (cateringOrders.ts) — queries Firestore for existing orders with the same `quoteRequestId` BEFORE creating new ones. If found, returns existing order IDs instead. Also added a `useEffect` on mount in `QuoteComparison.tsx` that checks for existing orders and sets `ordersCreated = true` to disable the button at the UI layer too.

**Bug 2 — Customer messages not seen by vendor:**
The old `MessageVendorButton` component called `findOrCreateConversation(user.uid, businessId)`, creating a conversation with participants `[customer_uid, businessId]`. But `businessId` is NOT a user UID — it's a Firestore document ID from the `businesses` collection. The vendor's UID is different. Result: vendor could never find this conversation.

**Bug 3 — Vendor "could not start a conversation" error:**
The vendor's "Message Customer" button called `findOrCreateConversation(order.customerId, user.uid)`, creating a DIFFERENT conversation than what the customer created. They were messaging into parallel, non-overlapping conversations.

**Fix for Bugs 2 & 3:** Removed ALL `findOrCreateConversation`-based messaging from both `CateringOrderStatus.tsx` and `VendorCateringDashboard.tsx`. The inline `OrderMessages` component (which uses the `cateringOrders/{orderId}/notes` subcollection) was already present and working correctly — it just needed the broken alternative buttons removed. Both customer and vendor now use the same OrderMessages panel, reading/writing the same Firestore subcollection.

**Files modified:**
- `src/components/catering/CateringOrderStatus.tsx` — Removed broken `MessageVendorButton`, `InlineMessagingModal`, `findOrCreateConversation` import, `messagingOrderId` state. Updated `formatTimestamp()` for cross-browser safety (handles Firestore Timestamps, `{seconds}` objects, numbers, strings, with `Number.isNaN` guard). Added `orderStatus` and `deliveredAt` props to OrderMessages.
- `src/components/catering/VendorCateringDashboard.tsx` — Removed BOTH "Message Customer" buttons (active ~line 1278, completed ~line 1598), removed inline messaging modal, removed `findOrCreateConversation` import, removed `messagingOrderId`/`messageText`/`sendingMessage` state variables. Added `orderStatus` and `deliveredAt` props to OrderMessages in pending and active sections. **Added OrderMessages to Completed Orders section** (was entirely missing — delivered orders had no messaging at all).
- `src/components/catering/OrderMessages.tsx` — Full rewrite with: read receipts (single gray ✓ = sent, double blue ✓✓ = read), red unread count badge, auto-mark-as-read on panel expand, 48hr post-delivery messaging window with countdown banner and locked state. Full cross-browser overhaul (see below).
- `src/services/catering/cateringOrders.ts` — Added `markOrderNotesRead()` function, duplicate order prevention query in `createOrdersFromQuote()`, fixed all 5 sort comparisons that mixed milliseconds/seconds.
- `src/services/catering/cateringTypes.ts` — Added `readBy?: string[]` and `readAt?: any` to `OrderNote` interface.
- `src/services/catering/index.ts` — Added `markOrderNotesRead` to exports.
- `firestore.rules` — Changed notes subcollection `allow update` from `false` to allow authenticated users (non-sender) to update notes (needed for read receipts `readBy` array).

**Feature: Read receipts:**
- Single gray check (✓) = message sent
- Double blue check (✓✓) = message read by the other party
- Implemented via `readBy` array field on each OrderNote document in Firestore
- Auto-mark-as-read when the panel is expanded via `useEffect` calling `markOrderNotesRead()`
- Red unread count badge on collapsed Messages header

**Feature: 48hr post-delivery messaging window:**
- Calculated from `statusHistory` entry where `status === 'delivered'`
- Shows countdown banner: "Messaging available for Xh Ym after delivery"
- After 48 hours: input replaced with lock icon + "Messaging closed — 48-hour window after delivery has passed"
- Existing messages remain visible (read-only) after expiry

**Cross-browser compatibility audit (11 fixes):**
1. **Safari 14 flexbox `gap`** — Replaced Tailwind `gap-*` and `space-y-*` classes with inline `style={{ gap }}` and `marginTop`. CSS `gap` in flex containers requires Safari 14.1+; build target is Safari 14.
2. **iOS Safari scroll inertia** — Added `WebkitOverflowScrolling: 'touch'` on message scroll container for smooth momentum scrolling on older iOS.
3. **Overscroll containment** — Added `overscrollBehavior: 'contain'` to prevent parent page scrolling when scrolling within the messages area.
4. **iOS Safari input styling** — Added `WebkitAppearance: 'none'` and `appearance: 'none'` on text input to remove default rounded corners and inner shadow.
5. **Touch targets** — Increased send button from 40×40px to 44×44px to meet Apple Human Interface Guidelines minimum.
6. **iOS tap flash** — Added `WebkitTapHighlightColor: 'transparent'` on send button.
7. **Long-word overflow** — Added `wordBreak: 'break-word'` and `overflowWrap: 'break-word'` on message bubbles to prevent horizontal overflow.
8. **Timestamp parsing** — Extracted `toEpochMs()` helper that safely handles Firestore Timestamps (`toMillis()`), `{seconds}` objects, epoch numbers, `Date` instances, and ISO-8601 strings (Android WebView edge case).
9. **Date comparison** — Replaced `toDateString()` (locale-dependent) with `isSameDay()` that compares year/month/day numerically.
10. **Auto-scroll consistency** — Wrapped `scrollTop = scrollHeight` in `requestAnimationFrame()` to ensure DOM has painted before scrolling (fixes Firefox/Safari race).
11. **Timestamp sort bug** — Fixed all 5 sort comparisons in `cateringOrders.ts` that mixed `toMillis()` (milliseconds) with `.seconds` (raw seconds). Now consistently normalizes to milliseconds with `seconds * 1000`.

**Live testing confirmed:**
- Vendor sent "Hi, this is a test message from the vendor" via inline Messages panel on live site → message appeared in Sai Kumar's customer account ✅
- Read receipt (single check) visible on vendor side ✅
- New code deployed and verified (inline Messages accordion present, old "Message Customer" button gone) ✅

**Decisions & rationale:**
- **Why remove findOrCreateConversation entirely?** It was fundamentally broken — it used `businessId` (a document ID) as a participant, not the vendor's user UID. Even if fixed, having two separate messaging systems (conversations collection vs order notes subcollection) would create confusion. OrderMessages using the `notes` subcollection is the correct approach: messages are scoped to a specific order, both parties share the same data path.
- **Why 48 hours?** Balances customer need to give post-delivery feedback/reviews with vendor desire to not receive messages indefinitely. Standard in food delivery apps.
- **Why inline styles instead of Tailwind for gap?** Tailwind compiles `gap-*` to the `gap` CSS property, which Safari 14.0 doesn't support in flex containers. Inline `style={{ gap }}` with margin fallbacks ensures graceful degradation.
- **Why `requestAnimationFrame` for scroll?** Direct `scrollTop = scrollHeight` assignment can fire before the browser has painted new DOM nodes, causing the scroll to stop one message short. `rAF` guarantees the paint has completed.

**Commits:**
- `74a8d4d` — fix(catering): cross-browser compat for messaging + add Messages to delivered orders
- `73d9b1f` — feat(catering): read receipts, 48hr post-delivery messaging, dedup orders, fix messaging
- `566cfa0` — fix(catering): prevent duplicate orders, fix messaging with read receipts, finalize bug fix
- `c64dde5` — fix(catering): prevent duplicate orders, fix messaging to use OrderNotes, finalize bug fix
- `a2acae3` — fix(catering): finalize bug fix — fallback assignments, auto-finalize, vendor indicator, Canadian ZIP

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

### Business Module Phase 4 — COMPLETE ✅
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
- **#41 Parallel Image Compression:** ✅ COMPLETED (Session 18) — `compressImagesParallel()` with `Promise.allSettled`, progress callback, combined progress bar in Create/Edit modals
- **#42 Advanced Search with Autocomplete:** ✅ COMPLETED (Session 18) — Typeahead dropdown with recent searches (localStorage), category suggestions with counts, business name/location matches, keyboard support (Escape/Enter)
- **#28 Advanced Search/Filters:** ✅ COMPLETED (Session 18) — Covered by #42 autocomplete (category filtering from suggestions) + #25 filter chips (active filter management)
- **Cross-browser geolocation fix:** ✅ COMPLETED (Session 18) — Two-phase geolocation (high-accuracy → low-accuracy fallback), iOS Safari guidance, Firefox prompt dismissal safety timeout, HTTPS check
- **ALL 42 ROADMAP ITEMS NOW COMPLETE** — Business module Phase 4 is finished.

### Discover Page Enhancement Roadmap (38 items across 4 phases) — ALL COMPLETE ✅

**Source document:** `Discover_Page_Enhancement_Roadmap.docx` in workspace folder

**Phase 1 — Critical Fixes & Quick Wins (items 1.1–1.10):** ✅ COMPLETE (Session 19)
- #1.1 Pending tab fix, #1.2 Mutual pre-compute, #1.3 MatchBadge inline, #1.4 Dead code removal, #1.5 SkeletonCard aurora, #1.6 Refresh button, #1.7 Toast safe-area, #1.8 Duplicate requests removal, #1.9 Search ranking, #1.10 Accessibility

**Phase 2 — Performance & Data Layer (items 2.1–2.9):** ✅ COMPLETE (Session 20)
- #2.1 N+1 Firestore reads fix, #2.2 Cursor-based pagination, #2.3 Mutual pre-compute refinement, #2.4 Migration flag, #2.5 Match score memoization, #2.6 Map reference stability, #2.7 onSnapshot for connections, #2.8 Redundant blocked users elimination, #2.9 PYMK single-pass optimization

**Phase 3 — UX Polish & Feature Gaps (items 3.1–3.10):** ✅ COMPLETE (Session 20)
- #3.1 Pill gradient colors, #3.2 Emoji detection fix, #3.3 Heritage text rendering, #3.4 Sticky header, #3.5 PYMK scrollbar, #3.6 Modal iOS fix, #3.7 Toast animation, #3.8-3.10 Cross-browser compatibility audit & patches

**Phase 4 — Architecture & Accessibility (items 4.1–4.9):** ✅ COMPLETE (Session 20)
- #4.1 PersonCard component extraction, #4.2 useConnections hook, #4.3 usePYMK hook, #4.4 useReducer consolidation, #4.5 Keyboard navigation, #4.6 aria-live regions, #4.7 Focus trapping, #4.8 Color contrast audit, #4.9 cp sync elimination

**ALL 38 DISCOVER ROADMAP ITEMS NOW COMPLETE** — Discover page is fully enhanced across all 4 phases.

### Business Sign-Up Wizard — ALL 5 PHASES COMPLETE ✅ (Session 21)
- **Phase 1 — Foundation**: 10 KYC feature flags, reducer extensions, step-aware validation, route + page
- **Phase 2 — Wizard UI + Google Places**: Wizard shell, StepIdentity, StepLocation with autocomplete + Leaflet map, useGooglePlaces hook
- **Phase 3 — Steps 4-5**: StepVerification (fully flag-aware), StepDetails (photos + hours + pricing), StepReview (summary + edit navigation)
- **Phase 4/5 — Backend + Admin**: businessRegistration.ts service (Firestore + Storage), admin review queue in both admin.tsx files
- **TypeScript fixes**: React 19 useRef, UserData.name, Google Maps type declarations
- **New files (10)**: `.env`, `src/pages/business/register.tsx`, `src/hooks/useGooglePlaces.ts`, `src/components/business/registration/BusinessRegistrationWizard.tsx`, `StepIdentity.tsx`, `StepLocation.tsx`, `StepVerification.tsx`, `StepDetails.tsx`, `StepReview.tsx`, `src/services/businessRegistration.ts`
- **Modified files (6)**: `FeatureSettingsContext.tsx`, `businessReducer.ts`, `businessValidation.ts`, `App.tsx`, `src/pages/admin.tsx`, `src/pages/main/admin.tsx`

### Duplicate Page Architecture (partially cleaned — `discover.tsx` eliminated, others remain)
- `src/pages/main/` contains near-identical copies of 11 pages from `src/pages/` (was 12 — `discover.tsx` removed in Session 20)
- `App.tsx` only imports from `src/pages/` — the `main/` copies are dead code (~27,000+ lines)
- Only 3 files are unique to `main/`: `home.tsx`, `select-ethnicity.tsx`, `signup.tsx`
- `messages.tsx` and `business.tsx` are still kept in sync via `cp` command; the other 9 have drifted
- **Session 20 precedent:** `discover.tsx` cp sync was safely eliminated after verifying `App.tsx` imports. This same approach can be applied to other pages one-by-one.
- **User decision (Session 10): full refactor too risky, doing incrementally instead**
- When ready for each page: verify `App.tsx` only imports from `src/pages/`, then delete the `main/` duplicate

### Call System (mostly working, but fragile)
- Audio and video calls work Chrome-Chrome and Chrome-Safari, but edge cases remain
- Camera flip on Chrome uses `deviceId` cycling (works but not elegant)
- Safari video rendering required special handling
- The TURN servers used (`openrelay.metered.ca`) are free/public and may be unreliable in production

### Catering Module Phases 1-6 — ALL COMPLETE ✅
- **Phase 1 (Place Order):** ✅ COMPLETE (Session 22)
- **Phase 2 (RFP/Quotes):** ✅ COMPLETE (Session 22)
- **Phase 3 (Vendor Dashboard):** ✅ COMPLETE (Session 23)
- **Phase 4 (Order Tracking):** ✅ COMPLETE (Session 23)
- **Phase 5 (Reviews):** ✅ COMPLETE (Session 23)
- **Phase 6 (Favorites, Recurring, Templates):** ✅ COMPLETE (Session 23)
- **UX Audit + 4 Critical Fixes:** ✅ COMPLETE (Session 24) — vendor switch dialog, checkout validation, accessibility, Firestore undefined cleanup
- **Round 2 Service Blueprint Audit (30 findings SB-18 through SB-47):** ✅ COMPLETE (Session 26) — all 30 findings implemented across 4 priority tiers, 4 commits, zero build errors
- **UI Overhaul Phases 1-3 (20 items):** ✅ COMPLETE (Session 27) — quick wins, high-impact UX, polish & delight
- **QA Audit + 21 Bug Fixes:** ✅ COMPLETE (Session 27) — all bugs found, fixed, and verified; QA reports generated
- **Cart Scroll Fix:** ✅ COMPLETE (Session 27) — flex column layout for proper mobile scrolling
- **RFP-to-Order Conversion + In-Order Messaging:** ✅ COMPLETE (Session 28) — auto-create orders on quote finalization, in-order messaging, RFP badge
- **Live Testing Quote-to-Order Pipeline:** ✅ COMPLETE (Session 28b) — full end-to-end test on deployed site: Confirmed→Preparing→Ready→Out for Delivery→Delivered all working for rfpOrigin orders
- **19 Pre-existing TypeScript Errors Fixed:** ✅ COMPLETE (Session 28b) — Vite env var, missing type fields, wrong field names, missing imports, loose string types
- **RFP Badge on Active/Pending Orders:** ✅ COMPLETE (Session 28b) — purple RFP tag now shows on all vendor order sections (was missing from active/pending)
- **Finalize Bug Fix:** ✅ COMPLETE (Session 28c) — re-fetch fresh quoteRequest from Firestore before order creation, added console logging, expanded ZIP validation for Canadian postal codes
- **Auto-Finalize on All Items Assigned:** ✅ COMPLETE (Session 28c) — when customer accepts all items, quote is auto-finalized and address form opens immediately (no intermediate yellow banner)
- **Vendor Finalize Pending Indicator:** ✅ COMPLETE (Session 28c) — "Awaiting Finalization" amber badge + "Order Created" purple badge on vendor's accepted quotes
- **Session 28c changes uncommitted** — need to commit, push, and deploy

**New files created in Sessions 23-24:**
- `src/components/catering/CateringOrderStatus.tsx` — Customer order tracking with visual timeline
- `src/components/catering/CateringReviewForm.tsx` — Star rating + text review modal
- `src/components/catering/CateringReviews.tsx` — Aggregated ratings + vendor replies
- `src/components/catering/FavoriteOrders.tsx` — Saved favorites with quick reorder
- `src/components/catering/RecurringOrderManager.tsx` — Two-tier recurring order scheduling
- `src/components/catering/OrderTemplates.tsx` — Shareable order templates with codes
- `ethniCity_Catering_UX_Audit.docx` — Comprehensive 8-page UX audit report (workspace root)

**Modified files in Sessions 23-24:**
- `src/services/cateringService.ts` — +300 lines: 18+ new service functions, 3 new interfaces (FavoriteOrder, RecurringOrder, OrderTemplate), undefined filtering on all addDoc calls
- `src/reducers/cateringReducer.ts` — 3 new views (favorites/recurring/templates), 3 state fields, 5 new actions (SET_FAVORITES, SET_RECURRING_ORDERS, SET_TEMPLATES, CONFIRM_VENDOR_SWITCH, CANCEL_VENDOR_SWITCH), pendingVendorSwitch state
- `src/pages/catering.tsx` — Phase 6 view rendering, auto-save favorites on order, vendor switch confirmation dialog
- `src/components/catering/CateringCheckout.tsx` — Complete rewrite with real-time validation + ARIA
- `src/components/catering/CateringCart.tsx` — role="dialog", aria-modal
- `src/components/catering/CateringItemCard.tsx` — role="article", aria-label on card and button
- `src/components/catering/CateringCategoryGrid.tsx` — aria-label on category buttons
- `src/components/catering/CateringItemList.tsx` — aria-checked on filter pills, aria-label on search
- `src/components/catering/RecurringOrderManager.tsx` — Conditional spreads for undefined fields
- `src/components/catering/OrderTemplates.tsx` — Conditional spreads for undefined fields
- `firestore.rules` — Rules for cateringFavorites, cateringRecurring, cateringTemplates
- `functions/src/index.ts` — processRecurringCateringOrders Cloud Function + cleanup

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

### Immediate — Push and Deploy Session 29
- **Session 29 committed locally** (`74a8d4d`) — needs `git push && npx firebase deploy --only hosting` to go live.
- **All Session 28/28b/28c changes are committed and pushed** — site is deployed and live at `https://mithr-1e5f4.web.app`.
- **Messaging end-to-end verified on live site** — vendor sent message → customer saw it ✅. Read receipts working ✅.
- **Replace `PENDING_VAPID_KEY`** in push notification useEffect (`src/pages/main/messages.tsx` line ~2580) with real VAPID key from Firebase Console > Project Settings > Cloud Messaging — this is the ONLY remaining blocker for push notifications.
- **Cloud Functions deployed** — `transcribeVoiceMessage`, `sendNewMessageNotification`, and `processRecurringCateringOrders` (daily 6 AM PT) are on Cloud Run.

### Phase 7 — Catering UX Improvements (from UX Audit)
Prioritized improvement list from the comprehensive UX audit (`ethniCity_Catering_UX_Audit.docx`):

**Quick Wins (1-2 days each):**
1. Add skeleton loaders for category grid and item list
2. Persist cart to localStorage with vendor context
3. Add character count display on review textareas

**Short-Term (3-5 days each):**
4. Order cancellation flow with reason capture (customer + vendor)
5. ~~In-app messaging between customers and vendors~~ ✅ DONE (Session 28 — OrderMessages component with real-time Firestore subcollection)
6. Sort and filter controls on item list (by price, rating, popularity)
7. RFQ expiration dates with vendor notification
8. Multi-date picker for recurring order skip dates
9. Push/email notifications for order status changes

**Long-Term (1-2 weeks each):**
10. Payment integration (Stripe/Square) with escrow for RFQ orders
11. Multi-vendor cart support with split checkout
12. Driver tracking for out-for-delivery orders
13. Public template marketplace with search and ratings

### Discover Page Roadmap — ALL COMPLETE ✅
- **All 38 items across 4 phases are done** (Sessions 19-20). No more Discover roadmap items pending.
- Phase 1 (10 items): Critical Fixes & Quick Wins — Session 19
- Phase 2 (9 items): Performance & Data Layer — Session 20
- Phase 3 (10 items): UX Polish & Feature Gaps — Session 20
- Phase 4 (9 items): Architecture & Accessibility — Session 20

### Future Enhancement: SFU for 16+ Participants
Current group calls use mesh topology (max 8). For 16+ participants, deploy an SFU server (mediasoup or LiveKit) on a VPS with public IP + UDP support. Cloud Run won't work for WebRTC media.

### High Priority
1. ~~Continue Discover Page Enhancement Roadmap~~ ✅ ALL 38 ITEMS COMPLETE (Sessions 19-20)
2. **Wire up Housing UI for the 7 enhancements** — State is ready, just needs JSX.
3. **Stabilize the call system** — Replace free TURN servers with paid provider.
4. **Test E2EE thoroughly** — Cross-browser decryption verification.
5. **Apply Discover architecture pattern to other pages** — The Discover refactor (useReducer + custom hooks + extracted components + accessibility) can serve as a template for Housing, Events, Feed, and other large pages.

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

# Deploy to Firebase (hosting + functions + firestore rules + storage rules)
firebase deploy --only hosting,functions,firestore,storage

# All-in-one build + deploy
./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build && firebase deploy --only hosting,functions,firestore,storage

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
| `src/contexts/FeatureSettingsContext.tsx` | Feature flags system — `DEFAULT_FEATURES` (23 messaging flags + module flags + 10 KYC flags), `FEATURE_GROUPS` (admin UI groups including "Business Sign-Up & KYC" group), `isFeatureEnabled()` hook, real-time Firestore `onSnapshot` on `appConfig/featureSettings`, optimistic toggle updates |
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
| `src/components/business/businessValidation.ts` | validateBusinessForm (original, untouched), validateSignupStep (5-step wizard), validateEIN, validateBN, validateTIN, validatePostalCode, validateAddressComponents, fuzzyMatch, getGoogleMapsUrl |
| `src/components/business/imageUtils.ts` | compressImage, compressImagesParallel, MAX_FILE_SIZE (~40 lines) |
| `src/pages/discover.tsx` | Discover page (~1,999 lines). useReducer for modal + filter state, keyboard nav, aria-live regions. Imports useConnections, usePYMK, useFocusTrap hooks + PersonCard component. Pill gradient colors (green/blue/orange). Phase 2 perf: onSnapshot, cursor pagination, match score memoization. Phase 3 UX: emoji regex, heritage rendering, cross-browser fixes. **cp sync ELIMINATED** — `main/discover.tsx` was deleted. |
| `src/hooks/useConnections.ts` | Connection state management (362 lines) — all connection state, accept/reject/withdraw handlers, real-time Firestore onSnapshot listener, legacy migration. Accepts `userId` + `onToastMessage` callback. NEW in Session 20. |
| `src/hooks/usePYMK.ts` | PYMK groups computation (126 lines) — single-pass grouping by city/heritage/interests. Exports `PYMKGroups` type, `PYMK_PREVIEW` constant. NEW in Session 20. |
| `src/hooks/useFocusTrap.ts` | Modal focus trapping (65 lines) — traps Tab/Shift+Tab within modal, saves/restores previously focused element. NEW in Session 20. |
| `src/components/discover/PersonCard.tsx` | Variant-based card component (464 lines) — 6 variants: grid, pymk-city, pymk-heritage, pymk-interests, incoming, sent. Built-in renderAvatar, renderHeritage, HighlightText, MatchBadge. NEW in Session 20. |
| `src/components/business/registration/BusinessRegistrationWizard.tsx` | Main wizard shell — 5-step progress bar, validation gating, auto-save draft (5s debounce), draft load on mount, submit to Firestore. Fixed-bottom navigation bar. NEW in Session 21. |
| `src/components/business/registration/StepIdentity.tsx` | Step 1 — business name, category, country toggle (US/CA), email, phone, description. Exports `FormField` wrapper and `StepProps` type used by all steps. NEW in Session 21. |
| `src/components/business/registration/StepLocation.tsx` | Step 2 — Google Places autocomplete (debounced 300ms), structured address parsing, manual fallback fields, US states/CA provinces dropdowns, state of incorporation, Leaflet map preview (CDN). NEW in Session 21. |
| `src/components/business/registration/StepVerification.tsx` | Step 3 — fully feature-flag-aware. TIN/EIN/BN entry, document upload (drag UI, PDF/JPG/PNG, max 10MB), photo ID, beneficial ownership, SOS lookup banner, admin review notice. Shows "No Verification Required" when no checks enabled. NEW in Session 21. |
| `src/components/business/registration/StepDetails.tsx` | Step 4 — photo upload grid (up to 10, cover selection), business hours editor (day-by-day), price range, website, menu/services, year established. NEW in Session 21. |
| `src/components/business/registration/StepReview.tsx` | Step 5 — cover photo preview, 4 review sections with Edit buttons, masked TIN display, doc count, beneficial owner count, admin review notice, terms disclaimer. NEW in Session 21. |
| `src/services/businessRegistration.ts` | Business registration Firestore service — submitBusinessRegistration (doc creation + parallel photo/doc upload to Storage), saveDraft/loadDraft/deleteDraft, fetchPendingRegistrations, approveRegistration, rejectRegistration. NEW in Session 21. |
| `src/hooks/useGooglePlaces.ts` | Google Places Autocomplete hook — singleton script loader, session tokens for billing optimization, getPlacePredictions, getPlaceDetails with structured address parsing. NEW in Session 21. |
| `src/pages/business/register.tsx` | Business registration page — gates on `business_signup_enabled` feature flag, renders BusinessRegistrationWizard. NEW in Session 21. |
| `.env` | Google Places API key (`VITE_GOOGLE_MAPS_API_KEY`). Already in `.gitignore`. NEW in Session 21. |
| `src/components/catering/ReviewModerationPanel.tsx` | Flagged review queue for vendors. Fetches via `fetchFlaggedReviews(businessId)`, dismiss flag / hide review actions. NEW in Session 26. |
| `src/services/catering/cateringQuotes.ts` | Quote functions including `isQuoteResponseEditable()` (24hr window) and `updateQuoteResponse()`. NEW functions added in Session 26. |
| `src/pages/catering.tsx` | Catering module orchestrator. Nav pills (categories, My Quotes, Vendor), view routing via cateringReducer, vendor detection for all approved business owners, RFP submission, quote handling. Session 22. |
| `src/reducers/cateringReducer.ts` | Catering state: views (`categories`/`items`/`checkout`/`orders`/`vendor`/`rfp`/`quotes`), cart, orders, RFP form with `items: QuoteRequestItem[]`, quote requests/responses. Session 22. |
| `src/services/cateringService.ts` | All Firestore CRUD for catering. Explicit payload builders (no spread). Client-side sorting (no `orderBy()`). Collections: `cateringMenuItems`, `cateringOrders`, `cateringQuoteRequests`, `cateringQuoteResponses`. Session 22. |
| `src/constants/cateringFoodItems.ts` | 17 cuisine categories, 200+ food items. Each with `name`, `pricingType`, optional `dietaryTags`. Exports `CUISINE_CATEGORIES` and `CUISINE_CATEGORY_KEYS`. Session 22. |
| `src/components/catering/RequestForPriceForm.tsx` | RFP form with cuisine dropdown, multi-select checkbox item picker, search filter, quantity controls, manual custom item toggle. Target Caterers section commented out. Session 22. |
| `src/components/catering/QuoteComparison.tsx` | Customer view for comparing received vendor quotes. Session 22. |
| `src/components/catering/VendorQuoteResponse.tsx` | Vendor view for open RFPs and quote submission. Session 22. |
| `firestore.indexes.json` | 6 composite indexes for catering collections. Not a runtime dependency (all sorting is client-side) but needed for Firestore console and future optimization. Session 22. |
| `Discover_Page_Enhancement_Roadmap.docx` | 38-item roadmap across 4 phases. All complete. Reference for architecture patterns. |
| `public/firebase-messaging-sw.js` | FCM service worker — background push + notification click with Firefox postMessage fallback |
| `functions/src/index.ts` | Cloud Functions: `sendNewMessageNotification` (push) + `transcribeVoiceMessage` (Speech-to-Text). Both deployed. |
| `functions/package.json` | Node 22 engine, deps: firebase-admin, firebase-functions, @google-cloud/speech v6 |
| `src/services/firebase.ts` | Firebase init: Auth, Firestore, Storage, Messaging, Functions. Exports `httpsCallable` for Cloud Function calls. |
| `src/utils/groupWebrtc.ts` | GroupCallManager — mesh WebRTC for multi-party calls (up to 8). Firestore signaling, screen sharing, camera flip. Singleton via `getGroupCallManager()`. |
| `src/components/GroupCallOverlay.tsx` | Multi-party call UI — responsive grid, PiP mode, all controls. Mounted in MainLayout. |
| `firebase.json` | Hosting config, cache headers |
| `vite.config.ts` | Build config, PWA manifest, code splitting |

### Critical Gotchas & Patterns
- **DUPLICATE PAGES (legacy — deferred cleanup):** `src/pages/main/` has near-identical copies of 12 pages from `src/pages/`. Only `src/pages/` is used by the router — the `main/` copies are dead code (~29,162 lines). Three files are kept in sync via `cp`: `messages.tsx`, `business.tsx`, and `discover.tsx`. The other 9 have drifted (2–181 lines different). 3 files are unique to `main/`: `home.tsx`, `select-ethnicity.tsx`, `signup.tsx`. **DO NOT delete the duplicates yet** — user deferred this cleanup to a future session (Session 10 decision). After every edit to discover.tsx: `cp src/pages/discover.tsx src/pages/main/discover.tsx`.
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
- **`cp` sync pattern for 2 files** — These files must be kept identical between `src/pages/` and `src/pages/main/`: `messages.tsx` and `business.tsx`. After every edit: `cp src/pages/<file>.tsx src/pages/main/<file>.tsx`. (`discover.tsx` cp sync was eliminated in Session 20.) **Also sync admin.tsx** — `src/pages/admin.tsx` ↔ `src/pages/main/admin.tsx` (Session 21 added registrations tab to both).
- **Business hooks pattern** — All 4 business hooks take `(state: BusinessState, dispatch: React.Dispatch<BusinessAction>, ...)` as params. They read state directly and dispatch actions — no internal useState for shared state. Only `BusinessPhotoUploader` (inside Edit/Create modals) uses local useState for upload-specific state.
- **Firebase Storage used ONLY by Business Sign-Up Wizard** — The rest of the app stores all images as base64 data URLs in Firestore. The business sign-up wizard (Session 21) uploads photos and verification documents to Firebase Storage. Deploy with `firebase deploy --only hosting,functions,firestore,storage`.
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
- **`searchRank()` pattern for ranked search** — Returns priority levels (1=prefix/word-start, 2=substring, 3=fuzzy, 0=no match). Pre-sort by rank before secondary sorting. This pattern can be reused in other modules that need ranked search (events, housing, forum, etc.).
- **Business sign-up is feature-flag gated** — `business_signup_enabled` must be toggled ON in admin panel before `/business/register` renders the wizard. All 10 KYC flags default `false`. The admin panel auto-renders the "Business Sign-Up & KYC" group from `FEATURE_GROUPS` — no manual admin UI changes needed for new flags.
- **Google Places API key in `.env`** — `VITE_GOOGLE_MAPS_API_KEY=AIzaSyDrbJItCq629ccJ6DGgtTEO1XXjKgGXCWY`. Already in `.gitignore`. The key is read via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` in StepLocation.tsx. If the key is missing, the autocomplete degrades to manual address entry.
- **Google Places session tokens for billing** — `useGooglePlaces.ts` uses `AutocompleteSessionToken` to bundle prediction + detail requests into a single billing session per Google best practices. Token is refreshed after each `getDetails()` call.
- **Business sign-up uses Firebase Storage (unlike the rest of the app)** — The business sign-up wizard uploads photos and verification documents to Firebase Storage (not base64 in Firestore). This is the ONLY feature using Storage. Deploy command should now include storage: `firebase deploy --only hosting,functions,firestore,storage`.
- **Draft auto-save strips File objects** — Firestore can't store `File` objects. `saveDraft()` in `businessRegistration.ts` deletes `verificationDocs` from the data before saving. Users will need to re-attach files if they resume from a draft.
- **React 19 `useRef()` requires initial value** — In React 19 types, `useRef<T>()` with no argument causes TS2554. Always pass an initial value: `useRef<T>(undefined)` or `useRef<T>(null)`.
- **`UserData` has `name` not `displayName`** — The `UserData` interface in `AuthContext.tsx` uses `name` field. Firebase `User` object has `displayName`. Don't confuse them — use `userProfile?.name` for profile data and `user.displayName` for Firebase auth data.
- **`env(safe-area-inset-bottom)` needs Tailwind fallback** — Not all browsers support `env()`. Always provide a Tailwind class as the base positioning (e.g., `bottom-24`) and use inline `style={{ bottom: 'calc(Xrem + env(safe-area-inset-bottom, 0px))' }}` as an enhancement. The inline style overrides the Tailwind class when supported.
- **Barrel re-export gap when adding new functions** — When adding new functions to domain sub-modules under `src/services/catering/`, you MUST also add them to the barrel re-export in `src/services/catering/index.ts`. Otherwise, Vite build fails with "is not exported" errors. This caught us with `updateQuoteResponse` and `isQuoteResponseEditable` in Session 26.
- **`sessionStorage` for checkout form persistence (not `localStorage`)** — Catering checkout form data uses `sessionStorage` (key: `ethnicity_checkout_form`) so it clears on tab close. This prevents stale delivery dates/addresses from persisting across sessions. `sessionStorage` is the correct choice for time-sensitive form data.
- **State-based tax rates are estimates** — The `STATE_TAX_RATES` lookup in `CateringCheckout.tsx` provides state-level estimates only. For actual tax calculation with jurisdictional accuracy, integrate a tax API (Avalara, TaxJar) when payment processing is added.
- **`prefers-reduced-motion` for all pulsing/ping animations** — Any use of `animate-ping`, `animate-pulse`, or similar motion effects should be gated behind `window.matchMedia('(prefers-reduced-motion: reduce)')`. The pattern: `const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)` + `useEffect` with `matchMedia` listener.
- **Quote edit window is 24 hours from creation** — `isQuoteResponseEditable()` in `cateringQuotes.ts` allows edits only when status is 'submitted' AND `createdAt` is within 24 hours. This is enforced both in the service function and in the UI. After 24 hours, the edit button disappears.
- **`verbatimModuleSyntax` requires `import type` for type-only imports** — The tsconfig has `verbatimModuleSyntax: true`, meaning all type-only imports MUST use `import type { ... }` syntax. Failing to do so causes TypeScript errors. This affected several files during Session 26 implementation.
- **`@supports not selector(:focus-visible)` for older browsers** — Added to `src/index.css`. Applies `:focus` outline on `[role="button"]` elements when `:focus-visible` is not supported (iOS Safari < 15.4). Zero runtime cost CSS-only fallback.
- **Firebase `serverTimestamp()` is a FieldValue sentinel, not a plain object** — NEVER pass it through generic object utilities like `stripUndefined`, `Object.entries()`, `JSON.parse(JSON.stringify())`, or any recursive traversal. These will destroy the sentinel, producing `{}` instead of a server timestamp. Always handle `serverTimestamp()` as a top-level field in explicit payload builders, never as part of a spread or generic object transformation.
- **Firestore queries with `where()` + `orderBy()` on different fields require composite indexes** — Without them, queries silently return empty results (not errors). Two solutions: (1) create composite indexes in `firestore.indexes.json` and deploy, or (2) remove `orderBy()` and sort client-side. Session 22 chose option 2 for all catering queries as the pragmatic immediate solution.
- **Catering price values are in cents (integers)** — 1299 = $12.99. Format for display with `(priceInCents / 100).toFixed(2)`. Never use floating-point for price calculations.
- **RFP Target Caterers section is commented out, not deleted** — Preserved in `RequestForPriceForm.tsx` with JSX comment block `{/* ... */}` for future repurposing when the platform matures and vendor directory is established.
- **Vendor pill visibility uses two-step detection** — First checks `allCateringBusinesses` (already loaded, O(1)), then falls back to a Firestore query for any approved business with matching `ownerId`. This ensures the pill appears even if the user's business isn't catering-enabled.
- **`isCateringEnabled` field on businesses collection** — Boolean field to mark businesses that participate in the catering module. Used by catering category grid to show relevant vendors. Not required for vendor pill visibility (which checks any approved business).
- **`Math.min()` with empty array spread is safe when other args exist** — `Math.min(...emptyArray, 1, 2, 3)` returns `1`, not `Infinity`. Verified safe in `searchRank` usage where name/city/profession always provide fallback values.
- **`onKeyDown` on mobile only fires with external keyboards** — Adding `onKeyDown` handlers (Enter/Space) to cards is correct behavior — it won't interfere with touch interaction. Keyboard events only fire when a hardware keyboard is connected (Bluetooth keyboards, etc.).
- **Discover page `activeTab` union type** — Must be `'discover' | 'network' | 'pending'`. The pending tab has its own filter that checks `detail.initiatedBy !== user?.uid` to show only incoming requests. Don't confuse with the Network tab which shows connected users.
- **Discover Page Enhancement Roadmap** — `Discover_Page_Enhancement_Roadmap.docx` in workspace folder contains all 38 items across 4 phases. Phase 1 (10 items) is complete. Phase 2 (9 items) focuses on performance and data layer optimization.
- **Aurora design token pattern for new colors** — Always use `var(--aurora-X, fallback)` pattern. Never use hardcoded hex alone. `--aurora-bg-rgb` (comma-separated RGB) exists for `rgba()` usage: `rgba(var(--aurora-bg-rgb, 255, 255, 255), 0.6)`. `--aurora-success` is `#10B981` (light) / `#34D399` (dark) for green states.
- **Glass-morphism pattern** — `backdrop-filter: blur(8px)` + `rgba(255,255,255,0.2)` background + `-webkit-backdrop-filter` for Safari. Used on category cards, hero pills, and frosted labels. Always include WebKit prefix.
- **Flex layout for fixed-header scrollable panels** — Use `flex flex-col` on outer container, `shrink-0` on fixed header/footer areas, `flex-1 min-h-0` on scrollable content with `overflow-y-auto`. Never use `h-full` on inner content when header/footer consume space above/below (causes overflow beyond viewport). This pattern was validated in the CateringCart scroll fix.
- **`prefers-reduced-motion` is globally handled** — `index.css` has a `@media (prefers-reduced-motion: reduce)` rule that sets `animation-duration: 0.01ms !important` on all elements. Individual components don't need their own reduced-motion handling.

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
`users`, `posts` (+ subcollection `comments`), `businesses` (+ subcollections `analytics`, `questions`), `businessSignupDrafts` (keyed by userId — wizard auto-save drafts), `listings`, `events`, `travelPosts`, `conversations` (+ subcollection `messages`), `connections`, `appConfig`, `bannedUsers`, `disabledUsers`, `userSettings`, `groupCalls` (+ subcollections `signals`, `candidates`), `businessMenuItems`, `businessReviews`, `businessOrders`, `cateringMenuItems` (Session 22 — added stockStatus/stockCount/availableFrom/availableUntil in Session 25), `cateringOrders` (Session 22 — added paymentStatus/paymentUrl/vendorModified/originalItems/statusHistory in Session 25), `cateringQuoteRequests` (Session 22 — RFP), `cateringQuoteResponses` (Session 22 — vendor quotes), `cateringFavorites` (Session 23), `cateringRecurring` (Session 23), `cateringTemplates` (Session 23 — added version/versionHistory in Session 25, + subcollection `usageLog` for analytics in Session 25), `forumThreads`, `forumReplies`, `forumLikes`, `marketplaceListings`, `marketplaceComments`, `announcements`, `moderationQueue`, `reports`, `notifications` (added vendor_new_review/review_flagged types in Session 25), `userWarnings`

### Recent Commit History
```
74a8d4d fix(catering): cross-browser compat for messaging + add Messages to delivered orders (Session 29)
73d9b1f feat(catering): read receipts, 48hr post-delivery messaging, dedup orders, fix messaging (Session 29)
566cfa0 fix(catering): prevent duplicate orders, fix messaging with read receipts, finalize bug fix (Session 29)
c64dde5 fix(catering): prevent duplicate orders, fix messaging to use OrderNotes, finalize bug fix (Session 29)
a2acae3 fix(catering): finalize bug fix — fallback assignments, auto-finalize, vendor indicator, Canadian ZIP (Session 28c)
5e50754 fix(catering): finalize bug fix, auto-finalize, vendor pending indicator, Canadian ZIP support (Session 28c)
(prior) fix(catering): resolve 19 TypeScript errors and add RFP badge to active orders (Session 28b)
1feda2a fix(catering): Finalize button now uses assignedCount instead of request status (Session 28)
bcc9259 fix(catering): quote-to-order conversion and Firestore vendor rules (Session 28)
222be4a fix(catering): cart drawer items not scrollable on mobile (Session 27)
64c53e0 fix(catering): resolve 20 QA bugs across all severity tiers (Session 27)
102e9cf style(catering): Phase 3 UI polish & delight — 8 enhancements (Session 27)
da9ef3f style(catering): Phase 2 UI enhancements — 6 high-impact UX changes (Session 27)
3724a6f style(catering): Phase 1 UI quick wins — 5 enhancements (Session 27)
(pending) fix: add direct Templates nav button to catering page (Session 25)
25bde2f feat: large effort batch — template marketplace, versioning, analytics drill-down (#29-36) (Session 25)
0b74293 refactor: split cateringService into domain modules + add optimistic updates (#27-28) (Session 25)
2a09477 feat: medium effort batch 2 — payment, messaging, batch ops, inventory, reviews (#13-14, #17-22) (Session 25)
(pending) feat: Catering Module Phase 1 + Phase 2 RFP + cuisine picker + Firestore bug fixes + vendor UX (Session 22)
(pending) feat: Business Sign-Up Wizard — 5-step registration with Google Places, KYC verification, Firestore backend, admin review (Session 21)
(pending) feat: Discover Page Phase 4 — Architecture & Accessibility (items 4.1–4.9) (Session 20)
c3fb1d3 fix: cross-browser compatibility for Discover Phase 1 changes (Session 19)
bd6c412 feat: Discover Page Phase 1 — Critical Fixes & Quick Wins (items 1.1–1.10) (Session 19)
bef85b1 fix: autocomplete search dropdown not working on iOS Safari (Session 18)
af92b3f feat: Complete Business Phase 4 — all 42 roadmap items done (Session 18)
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
--aurora-bg: #F5F6FA;           --aurora-surface: #FFFFFF;
--aurora-bg-rgb: 245, 246, 250; --aurora-success: #10B981;
--aurora-text: #1E2132;         --aurora-text-secondary: #5B5E72;
--aurora-border: #E2E5EF;       --msg-own-bubble: #E0E7FF;
--msg-text: #111B21;            --msg-icon: #54656F;

/* Dark mode (:root.dark) */
--aurora-bg: #1A1B2E;           --aurora-surface: #232438;
--aurora-bg-rgb: 26, 27, 46;    --aurora-success: #34D399;
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

*Updated April 7, 2026 (Session 29) — for continuing development in a new session. Business Module ALL 42 roadmap items COMPLETE (Sessions 11-18). Discover Page ALL 38 items COMPLETE (Sessions 19-20). Business Sign-Up Wizard ALL 5 phases COMPLETE (Session 21). Catering Module Phase 1 (Place Order) + Phase 2 (RFP) COMPLETE (Session 22). Catering Phase 3 (Vendor Dashboard) + Phase 4 (Order Tracking) + Phase 5 (Reviews) + Phase 6 (Favorites, Recurring, Templates) COMPLETE (Session 23). UX Audit + 4 Critical Fixes COMPLETE (Session 24). Catering Medium Effort (#13-14, #17-22) + Architecture Refactor (#27-28: domain module split + optimistic updates) + Large Effort Features (#29-36: template marketplace/versioning/analytics, vendor analytics drill-down/best sellers/peak times/comparison/retention) + Templates nav fix ALL COMPLETE (Session 25). Round 2 Service Blueprint Audit: ALL 30 findings (SB-18 through SB-47) implemented across 4 priority tiers with 4 commits ALL COMPLETE (Session 26). Catering UI Phases 1-3 (20 items) + QA Audit (21 bugs found) + All Bug Fixes Verified + Cart Scroll Fix ALL COMPLETE (Session 27). RFP-to-Order Conversion + In-Order Messaging + Firestore rules fix ALL COMPLETE (Session 28). Live testing of quote-to-order pipeline VERIFIED end-to-end + 19 TypeScript errors fixed + RFP badge added ALL COMPLETE (Session 28b). Finalize bug fix + auto-finalize + vendor indicators + Canadian ZIP ALL COMPLETE (Session 28c). Duplicate order prevention + messaging fix (removed broken findOrCreateConversation) + read receipts + 48hr post-delivery messaging window + full cross-browser compatibility audit (11 fixes for Safari 14, iOS Safari, Android Chrome, Firefox) + Messages added to delivered orders on vendor side ALL COMPLETE (Session 29). Session 29 committed locally (74a8d4d) — needs git push + firebase deploy. Messaging verified end-to-end on live site. Site live at https://mithr-1e5f4.web.app. Next: (1) push + deploy Session 29, (2) Phase 7 improvements from UX audit (loading skeletons, cart persistence, order cancellation), (3) sort/filter controls on item list, (4) RFQ expiration dates. Long-term roadmap: payment integration (Stripe/Square), multi-vendor cart, driver tracking, recommendation engine, expand RFP/quote system to other business types, server-side analytics aggregation for high-volume vendors.*
