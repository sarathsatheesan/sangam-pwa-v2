# ethniCity (Sangam PWA v2) — Phased Implementation Plan

> **Generated:** April 17, 2026  
> **Based on:** Architecture Review v1.0 (April 16, 2026)  
> **Scope:** P0 → P3 (Security Hardening through Long-Term Evolution)  
> **Granularity:** Epic-level with effort estimates, dependencies, acceptance criteria, ownership areas  
> **Guiding Principle:** Zero feature regression — every upgrade must preserve all 500+ existing features across 11 modules

---

## Table of Contents

1. [Cross-Browser Compatibility Baseline](#1-cross-browser-compatibility-baseline)
2. [Feature Preservation Protocol](#2-feature-preservation-protocol)
3. [Phase 0 — Security Hardening (Weeks 1–3)](#3-phase-0--security-hardening-weeks-13)
4. [Phase 1 — Observability & Reliability (Weeks 3–6)](#4-phase-1--observability--reliability-weeks-36)
5. [Phase 2 — Architecture Modernization (Months 2–4)](#5-phase-2--architecture-modernization-months-24)
6. [Phase 3 — Long-Term Evolution (Months 6–12)](#6-phase-3--long-term-evolution-months-612)
7. [Cross-Browser Patch Backlog](#7-cross-browser-patch-backlog)
8. [Risk Register](#8-risk-register)
9. [Milestone Summary](#9-milestone-summary)

---

## 1. Cross-Browser Compatibility Baseline

### Target Browser Matrix

| Browser | Platform | Min Version | Status |
|---------|----------|-------------|--------|
| Chrome | Desktop (Win/Mac/Linux) | 100+ | Primary target |
| Safari | macOS | 15.4+ | Supported |
| Firefox | Desktop (Win/Mac/Linux) | 100+ | Supported |
| Safari | iOS (iPhone/iPad) | 15.4+ | Supported |
| Chrome | Android | 100+ | Supported |

### Known Issues Identified in Audit

| ID | Category | File(s) | Issue | Severity | Browsers Affected |
|----|----------|---------|-------|----------|-------------------|
| CB-01 | WebRTC | `webrtc.ts:392-393` | Deprecated `RTCSessionDescription` constructor | Low | All (future deprecation) |
| CB-02 | E2EE | `encryption.ts:28-59` | No IndexedDB 7-day expiry check | Medium | Safari (non-home-screen PWA) |
| CB-03 | E2EE | `encryption.ts:42-59` | No private browsing fallback for IDB | Medium | Safari Private Mode |
| CB-04 | CSS | `CateringCategoryGrid.tsx`, `OnboardingPills.tsx`, `discover.tsx` | `backdropFilter` without Firefox fallback | Low | Firefox |
| CB-05 | Media | `VoiceRecorder.tsx:26-28` | Missing `audio/wav` in MediaRecorder codec chain | Low | Safari |
| CB-06 | CSS | `index.css:181` | `scroll-behavior: smooth` no fallback | Low | Safari < 15.4 |
| CB-07 | WebRTC | `groupWebrtc.ts` | `getDisplayMedia()` unavailable on mobile | Info | iOS Safari, Firefox Mobile |
| CB-08 | Security | `firebase.json` | Missing security headers (CSP, HSTS, X-Frame-Options) | High | All |

---

## 2. Feature Preservation Protocol

Every epic in this plan follows these non-negotiable rules:

### 2.1 Pre-Change Checklist

1. **Snapshot current behavior**: Record screenshots/recordings of the affected module's UI flows before any code change
2. **Feature freeze scope**: Identify exactly which features from the catalog (Section 2.3) are touched by the change
3. **Validate-Before-Advance**: After every code change run `tsc --noEmit && vite build` — no merge without green builds
4. **Cross-browser smoke test**: Every PR must be manually tested on Chrome Desktop + Safari Desktop + iOS Safari (minimum)

### 2.2 Regression Guard Strategy

Since there are zero automated tests today, the plan introduces testing incrementally alongside each phase:

- **Phase 0**: Manual cross-browser checklist per epic (documented in PR template)
- **Phase 1**: Add Sentry error tracking to catch regressions in production
- **Phase 2**: Introduce unit tests for new service layer code (target 60% coverage on new code)
- **Phase 3**: E2E tests with Playwright covering all 11 modules (target 80% critical path coverage)

### 2.3 Module Feature Counts (Regression Baseline)

| Module | Features | Critical Paths |
|--------|----------|----------------|
| Admin | 65+ | User management, moderation queue (5 actions), registrations (approve/reject), feature flags |
| Messages | 80+ | E2EE send/receive, voice messages, reactions, read receipts, WebRTC calls, group chat |
| Catering | 55+ | Order lifecycle, RFP/quote system, vendor dashboard, menu management, recurring orders |
| Feed | 35+ | Post CRUD, reactions, comments, image upload, heritage filter |
| Events | 40+ | Event CRUD, RSVP, ticket tiers, calendar filter, heritage filter |
| Housing | 35+ | Listing CRUD, search/filter/sort, amenity tags, walk score |
| Marketplace | 35+ | Product CRUD, category filter, condition tags, seller profiles |
| Forum | 35+ | Thread CRUD, upvote/downvote, flair, nested replies, acceptance |
| Discover | 15+ | People cards, PYMK, carousel navigation, connection actions |
| Profile | 40+ | Activity grid, saved items, privacy settings, data export, business management |
| Business | 45+ | Business CRUD, search/autocomplete, map view, reviews, TIN verification |

**Total: 500+ user-facing features across 11 modules**

---

## 3. Phase 0 — Security Hardening (Weeks 1–3)

**Goal:** Close all CRITICAL and HIGH severity security gaps identified in the architecture review. No feature changes — security fixes only.

### Epic P0-1: Firestore Rules Lockdown

| Field | Detail |
|-------|--------|
| **Effort** | 5–7 days |
| **Ownership** | Backend / Firebase |
| **Dependencies** | None (can start immediately) |
| **Risk** | HIGH — overly strict rules could break existing features |
| **Cross-Browser** | N/A (server-side rules) |

**Scope:**

Fix 6 overly permissive Firestore rule patterns identified in the review:

1. **`businesses` collection** — Add `resource.data.ownerId == request.auth.uid` check on update/delete. Currently any authenticated user can modify any business.
2. **`conversations/{convId}/messages`** — Add participant membership check. Validate `request.auth.uid` is in the parent conversation's `participants` array before allowing read/write.
3. **`bannedUsers` / `disabledUsers`** — Restrict writes to `isAdminUser()`. Currently any authenticated user can ban/disable others.
4. **`appConfig`** — Restrict writes to `isAdminUser()`. Currently any authenticated user can modify admin email list and feature flags.
5. **`moderationQueue`** — Add `isAdminUser()` check for write operations (approve, reject, dismiss).
6. **`posts`** — Add `request.auth.uid == resource.data.authorId` check on updates to prevent vote manipulation.

**Acceptance Criteria:**

- [ ] All 6 rule changes deployed via `firebase deploy --only firestore:rules`
- [ ] Existing admin panel operations (approve registration, ban user, toggle features) still work
- [ ] Non-admin users cannot modify other users' businesses, posts, or conversations
- [ ] Run through all 11 modules to verify no legitimate operations are blocked
- [ ] Test on Chrome + Safari to confirm Firestore client SDK handles permission denials gracefully (error toast, not crash)

**Feature Preservation Notes:**

- The admin panel's moderation queue (dismiss, hide, delete, warn, ban) calls write operations on `moderationQueue`, `bannedUsers`, and target collections. The admin must be allowed through `isAdminUser()`.
- Business registration approval writes to `businesses` and `users` — admin check needed.
- Feed reactions/comments write to `posts` subcollections — ensure subcollection rules inherit correctly.

---

### Epic P0-2: E2EE Private Key Encryption

| Field | Detail |
|-------|--------|
| **Effort** | 8–10 days |
| **Ownership** | Frontend / Crypto |
| **Dependencies** | None |
| **Risk** | HIGH — broken key migration = users lose message history |
| **Cross-Browser** | Safari Web Crypto quirks, IndexedDB expiry |

**Scope:**

Currently, E2EE private keys are stored as plaintext JWK in Firestore (`users/{uid}.e2ePrivateKey`). Any Firebase admin can read them.

1. **Implement password-based key encryption**: Use `scrypt` (or PBKDF2 as fallback) to derive a wrapping key from a user-chosen passphrase, then AES-256-GCM encrypt the private key JWK before storing in Firestore.
2. **Add key migration flow**: On first login after upgrade, prompt user to set an encryption passphrase. Encrypt existing plaintext key and overwrite. Mark migration complete with `e2eKeyVersion: 2` field.
3. **Safari IndexedDB resilience (CB-02, CB-03)**: Add `createdAt` timestamp to stored keys. On retrieval, check if key is older than 6 days — if so, re-fetch from Firestore and re-cache. Wrap all IDB operations in try-catch with fallback to in-memory storage for Safari private browsing.
4. **Key recovery flow**: Allow users to re-enter their passphrase on new devices to decrypt the Firestore-stored key.

**Acceptance Criteria:**

- [ ] New users get prompted to set E2EE passphrase during onboarding
- [ ] Existing users prompted on first login post-upgrade
- [ ] Private keys no longer stored in plaintext in Firestore (verify via Firebase Console)
- [ ] Message send/receive works identically before and after migration on Chrome, Safari, Firefox, iOS Safari, Android Chrome
- [ ] Safari private browsing mode: E2EE works in-session (memory fallback), warns user that keys won't persist
- [ ] Key rotation on passphrase change re-encrypts and re-stores

---

### Epic P0-3: API Key Remediation

| Field | Detail |
|-------|--------|
| **Effort** | 1–2 days |
| **Ownership** | Backend / Cloud Functions |
| **Dependencies** | None |
| **Risk** | Low |
| **Cross-Browser** | N/A |

**Scope:**

1. **Move Giphy API key to Cloud Function proxy**: Create a new `searchGifs` callable Cloud Function. Frontend calls the function instead of hitting Giphy directly. Remove API key from `GifPicker.tsx`.
2. **Add domain restriction to Firebase project**: In Firebase Console → Project Settings → General, restrict API key to `*.mithr-1e5f4.web.app` and any custom domains.

**Acceptance Criteria:**

- [ ] Giphy API key removed from frontend source code (verify with `grep -r "GIPHY\|giphy.*api" src/`)
- [ ] GIF search works identically in messages on all 5 target browsers
- [ ] Cloud Function deployed and responding < 500ms for GIF searches
- [ ] Firebase API key restricted to authorized domains

---

### Epic P0-4: Security Headers

| Field | Detail |
|-------|--------|
| **Effort** | 1 day |
| **Ownership** | DevOps / Firebase Hosting |
| **Dependencies** | None |
| **Risk** | Low — CSP too strict could break external resources |
| **Cross-Browser** | All browsers benefit |

**Scope:**

Add security headers to `firebase.json` hosting config:

1. `Content-Security-Policy` — Allow `self`, Firebase domains, Giphy CDN, Google Places, Microlink, STUN/TURN servers. Block `unsafe-inline` for scripts (may require nonce-based approach for Vite).
2. `Strict-Transport-Security` (HSTS) — `max-age=31536000; includeSubDomains`
3. `X-Frame-Options` — `DENY`
4. `X-Content-Type-Options` — `nosniff`
5. `Referrer-Policy` — `strict-origin-when-cross-origin`
6. `Permissions-Policy` — Restrict camera, microphone to self (for WebRTC)

**Acceptance Criteria:**

- [ ] All 6 headers present in response (verify with `curl -I`)
- [ ] All 11 modules load and function correctly with CSP active
- [ ] External resources (Giphy GIFs, Google Places autocomplete, Microlink previews, STUN/TURN) not blocked by CSP
- [ ] WebRTC calls still work (camera/microphone permissions not blocked)
- [ ] Test on Chrome, Safari, Firefox — CSP error reporting differs per browser

---

### Epic P0-5: WebRTC Signaling Security

| Field | Detail |
|-------|--------|
| **Effort** | 2 days |
| **Ownership** | Backend / Firebase |
| **Dependencies** | P0-1 (Firestore rules) |
| **Risk** | Medium — incorrect rules break calls |
| **Cross-Browser** | N/A (server-side) |

**Scope:**

1. Add Firestore rules for `calls/{callId}` — only participants can read SDP offers/answers (prevents IP address leakage via SDP inspection).
2. Add rules for `groupCalls/{callId}` — gate read/write to members array.
3. Add rules for ICE candidate subcollections.

**Acceptance Criteria:**

- [ ] 1:1 voice/video calls work between two participants on Chrome, Safari, iOS Safari
- [ ] Group calls work with 3+ participants
- [ ] Non-participants cannot read call documents (verify with Firestore rules simulator)
- [ ] Call rejection/ending still functions correctly

---

## 4. Phase 1 — Observability & Reliability (Weeks 3–6)

**Goal:** Add production monitoring, fix performance bottlenecks, and resolve cross-browser issues. Still no structural changes to the architecture.

### Epic P1-1: Error Tracking with Sentry

| Field | Detail |
|-------|--------|
| **Effort** | 3–4 days |
| **Ownership** | Frontend |
| **Dependencies** | None |
| **Risk** | Low |
| **Cross-Browser** | Sentry SDK supports all target browsers |

**Scope:**

1. Install `@sentry/react` and initialize in `main.tsx` with environment/release tags.
2. Wrap existing `AppErrorBoundary` with Sentry's error boundary for automatic capture.
3. Add breadcrumbs for route changes, Firestore operations, and WebRTC state transitions.
4. Configure source map upload in Vite build for readable stack traces.
5. Add specific capture for: E2EE decryption failures (silent fallback currently invisible), WebRTC connection failures, Firestore permission denied errors.
6. Set up Sentry alerts for error spike detection.

**Acceptance Criteria:**

- [ ] Sentry dashboard showing errors from production
- [ ] Source maps uploaded — stack traces show original TypeScript
- [ ] E2EE, WebRTC, and Firestore errors tagged with custom context
- [ ] Bundle size increase < 30KB gzipped
- [ ] No performance degradation (Sentry sampling at 10% for transactions)

---

### Epic P1-2: Cross-Browser CSS Patches (CB-04, CB-06)

| Field | Detail |
|-------|--------|
| **Effort** | 1–2 days |
| **Ownership** | Frontend / CSS |
| **Dependencies** | None |
| **Risk** | Low |
| **Cross-Browser** | Firefox, Safari < 15.4 |

**Scope:**

1. **Firefox `backdropFilter` fix (CB-04)**: Add `@supports` fallback for `CateringCategoryGrid.tsx`, `OnboardingPills.tsx`, and `discover.tsx`. When `backdrop-filter` is unsupported, use a solid semi-transparent background instead.
2. **Smooth scroll polyfill (CB-06)**: Add `smoothscroll-polyfill` (1KB) for Safari < 15.4 graceful degradation. Import in `main.tsx`.
3. **Audit all `dvh`/`svh` usage**: Confirm the existing `@supports` fallback in `index.css` covers all viewport height usages.

**Acceptance Criteria:**

- [ ] Catering category grid, onboarding pills, and discover page render correctly on Firefox
- [ ] Smooth scrolling works on Safari 15.0+ (polyfill handles older versions)
- [ ] No visual regressions on Chrome or iOS Safari
- [ ] All `dvh` usages have `vh` fallback

---

### Epic P1-3: Distributed Counters for High-Write Fields

| Field | Detail |
|-------|--------|
| **Effort** | 4–5 days |
| **Ownership** | Backend + Frontend |
| **Dependencies** | P0-1 (Firestore rules must be deployed first) |
| **Risk** | Medium — counter reads become eventually consistent |
| **Cross-Browser** | N/A (data layer) |

**Scope:**

Replace direct `increment()` on `viewCount` and `likeCount` fields with Firestore distributed counter pattern:

1. Create `counters/{documentId}/shards/{shardId}` subcollection with 10 shards per counter.
2. Write: randomly select a shard and increment.
3. Read: sum all shards (cache result for 30 seconds client-side).
4. Apply to: `posts.viewCount`, `posts.likeCount`, `businesses.viewCount`, `events.viewCount`, `housing.viewCount`, `marketplace.viewCount`.

**Feature Preservation:**

- Like counts still display correctly on Feed, Business, Events, Housing, Marketplace cards
- View counts still increment on detail view open
- Sorting by "popular" / "trending" still works (may be slightly delayed due to eventual consistency)

**Acceptance Criteria:**

- [ ] Counter writes no longer contend under concurrent load
- [ ] Counts display within 30 seconds of actual value
- [ ] Feed "trending" sort still orders correctly
- [ ] No UI changes visible to end users
- [ ] Works identically on all target browsers

---

### Epic P1-4: Cursor-Based Pagination

| Field | Detail |
|-------|--------|
| **Effort** | 7–10 days |
| **Ownership** | Frontend |
| **Dependencies** | None |
| **Risk** | Medium — pagination changes touch 8+ page modules |
| **Cross-Browser** | Must test infinite scroll on iOS Safari (scroll momentum) |

**Scope:**

Replace `getDocs()` full-collection loads with `limit(20) + startAfter(lastDoc)` cursor pagination in:

1. Feed posts (feed.tsx)
2. Forum threads (forum.tsx)
3. Marketplace listings (marketplace.tsx)
4. Housing listings (housing.tsx)
5. Events (events.tsx)
6. Business directory (business.tsx)
7. Admin user list (admin.tsx)
8. Moderation queue (admin.tsx)

Each module gets:
- `limit(20)` on initial load
- "Load More" trigger via IntersectionObserver (already used in `VirtualizedBusinessGrid.tsx` — reuse pattern)
- Loading skeleton during fetch
- "No more results" indicator

**Feature Preservation:**

- All existing filter/sort combinations must still work with paginated queries
- Heritage/ethnicity filtering must compose with pagination cursors
- Search must still return complete results (search queries are already bounded)
- Sorting must be applied server-side (Firestore `orderBy` + `limit` + `startAfter`)

**Acceptance Criteria:**

- [ ] Initial page load < 2 seconds on 3G throttle (Lighthouse)
- [ ] Scroll to load more works on Chrome, Safari, Firefox, iOS Safari (rubber-band scroll), Android Chrome
- [ ] All filter/sort combinations produce correct paginated results
- [ ] No "flash of empty content" between page loads
- [ ] Back-navigation preserves scroll position (critical for mobile)
- [ ] Feed, Forum, Marketplace, Housing, Events, Business all paginated

---

### Epic P1-5: Cloud Functions Structured Logging

| Field | Detail |
|-------|--------|
| **Effort** | 2 days |
| **Ownership** | Backend |
| **Dependencies** | None |
| **Risk** | Low |
| **Cross-Browser** | N/A |

**Scope:**

1. Replace `console.log` in all 5 Cloud Functions with `firebase-functions/logger` structured JSON logging.
2. Add correlation IDs to notification sends (link FCM message → Firestore trigger → user).
3. Add error logging for failed FCM token sends, expired tokens, and transcription failures.
4. Set up Cloud Logging alerts for function error rate > 5%.

**Acceptance Criteria:**

- [ ] All Cloud Function logs are structured JSON in Cloud Logging
- [ ] FCM notification failures are logged with user ID and error code
- [ ] Alerts configured for error rate spikes

---

## 5. Phase 2 — Architecture Modernization (Months 2–4)

**Goal:** Introduce proper abstractions (service layer, state management) to reduce coupling and enable future scaling. This is the highest-risk phase for feature regression.

### Epic P2-1: Typed Repository Layer

| Field | Detail |
|-------|--------|
| **Effort** | 15–20 days |
| **Ownership** | Frontend / Architecture |
| **Dependencies** | P1-4 (pagination patterns established first) |
| **Risk** | HIGH — touches every module's data access |
| **Cross-Browser** | N/A (data abstraction layer) |

**Scope:**

Create a centralized `src/data/` layer that abstracts all Firestore operations:

```
src/data/
  repositories/
    UserRepository.ts        // users collection CRUD
    BusinessRepository.ts    // businesses collection CRUD
    PostRepository.ts        // posts + comments CRUD
    EventRepository.ts       // events collection CRUD
    HousingRepository.ts     // housing collection CRUD
    MarketplaceRepository.ts // marketplace CRUD
    ForumRepository.ts       // forum threads + replies CRUD
    OrderRepository.ts       // cateringOrders + quotes CRUD
    MessageRepository.ts     // conversations + messages CRUD
    ModerationRepository.ts  // moderationQueue CRUD
    NotificationRepository.ts // notifications CRUD
  queries/
    useUserQuery.ts          // TanStack Query wrapper for users
    useBusinessQuery.ts      // TanStack Query wrapper for businesses
    usePostQuery.ts          // etc.
    ...
  types/
    index.ts                 // Shared Firestore document types
```

**Migration Strategy (Module-by-Module):**

Roll out one module at a time. Each module migration follows:

1. Create the repository with typed methods matching existing Firestore calls
2. Create TanStack Query hooks wrapping the repository
3. Replace direct Firestore calls in the page file with repository/hook calls
4. Run `tsc --noEmit && vite build`
5. Cross-browser smoke test the module
6. Deploy and monitor Sentry for errors

**Migration Order (lowest risk first):**

1. Business directory → uses `useBusinessData` hook already (cleanest migration)
2. Forum → moderate complexity, well-scoped
3. Events → similar to forum
4. Housing → similar to events
5. Marketplace → similar to housing
6. Feed → more complex (reactions, comments, nested data)
7. Profile → reads from multiple collections
8. Admin → most complex, touches everything
9. Catering → complex order lifecycle
10. Messages → most critical, E2EE adds complexity
11. Discover → PYMK algorithm depends on multiple collections

**Feature Preservation:**

- Every repository method must have a 1:1 mapping to an existing Firestore call
- TanStack Query provides automatic caching — real-time listeners must be preserved via `onSnapshot` subscriptions alongside query cache invalidation
- All existing filter/sort/pagination behavior must be maintained
- No UI changes in any module

**Acceptance Criteria:**

- [ ] All 35 Firestore collections accessed exclusively through repository layer
- [ ] Zero direct Firestore imports in page files (`grep -r "from 'firebase/firestore'" src/pages/` returns nothing)
- [ ] TanStack Query devtools showing cache hits
- [ ] Real-time updates still work (messages, notifications, moderation queue)
- [ ] All 500+ features pass manual regression check
- [ ] Bundle size delta < 15KB gzipped (TanStack Query adds ~12KB)

---

### Epic P2-2: State Management Migration (Contexts → Zustand)

| Field | Detail |
|-------|--------|
| **Effort** | 10–14 days |
| **Ownership** | Frontend / Architecture |
| **Dependencies** | P2-1 (repository layer reduces context responsibilities) |
| **Risk** | HIGH — touches every component that uses contexts |
| **Cross-Browser** | N/A (state management) |

**Scope:**

Replace 8 React Context providers + 2 reducers with Zustand slices:

```
src/store/
  index.ts              // Combined store
  slices/
    authSlice.ts        // User, profile, admin status (replaces AuthContext)
    featureSlice.ts     // 167 feature flags (replaces FeatureSettingsContext)
    businessSlice.ts    // Multi-business selection (replaces BusinessSwitcherContext)
    settingsSlice.ts    // Dark mode, prefs (replaces UserSettingsContext)
    locationSlice.ts    // Geolocation, zip (replaces LocationContext)
    toastSlice.ts       // Notifications (replaces ToastContext)
    themeSlice.ts       // Heritage theming (replaces CulturalThemeContext)
    notificationSlice.ts // FCM + catering notifs (replaces NotificationContext)
```

**Migration Strategy:**

Migrate one context at a time, keeping both the old context and new Zustand slice alive during transition:

1. Create Zustand slice with same state shape and actions
2. Bridge: have the old context provider read from Zustand (so downstream consumers don't break)
3. Gradually replace `useContext(XContext)` with `useStore(selector)` across components
4. Remove old context provider once all consumers migrated
5. Repeat for next context

**Benefits:**

- Eliminates 11-level provider nesting in `App.tsx`
- Selective re-rendering (only components using changed state re-render)
- Zustand devtools for debugging
- Simpler testing (no provider wrapper needed)

**Feature Preservation:**

- Every state value and action from every context must exist in the corresponding Zustand slice
- Real-time Firestore listeners that feed into contexts must be preserved (initialize in store middleware)
- Dark mode toggle, heritage theming, feature flags — all must continue working
- Admin status (`isAdmin`) must propagate correctly for admin panel access

**Acceptance Criteria:**

- [ ] All 8 contexts replaced with Zustand slices
- [ ] `App.tsx` provider nesting reduced from 11 levels to 3 (BrowserRouter → Suspense → Routes)
- [ ] No `useContext` calls for removed contexts remain (`grep -r "useContext" src/`)
- [ ] All 11 modules render and function correctly
- [ ] Dark mode, heritage theme, feature flags all toggle correctly
- [ ] Performance: Lighthouse score improves (fewer unnecessary re-renders)

---

### Epic P2-3: WebRTC Modernization & Cross-Browser Hardening

| Field | Detail |
|-------|--------|
| **Effort** | 5–7 days |
| **Ownership** | Frontend / WebRTC |
| **Dependencies** | P1-1 (Sentry — need error tracking for call failures) |
| **Risk** | Medium — WebRTC is browser-sensitive |
| **Cross-Browser** | Primary focus of this epic |

**Scope:**

1. **Replace deprecated APIs (CB-01)**: Change `new RTCSessionDescription(obj)` to plain SDP objects in `webrtc.ts` (lines 392-393, 497-498).
2. **Add adapter.js**: Install `webrtc-adapter` package to normalize WebRTC API differences across browsers. Import in `webrtc.ts` and `groupWebrtc.ts`.
3. **Improve Safari track handling**: Add `track.onended` event handler for Safari track termination recovery.
4. **Add call quality monitoring**: Use `RTCPeerConnection.getStats()` to report packet loss, jitter, and round-trip time to Sentry as custom metrics.
5. **Screen sharing guard (CB-07)**: Disable screen share button on iOS Safari and Firefox Mobile where `getDisplayMedia()` is unavailable. Show tooltip explaining limitation.
6. **AudioContext Safari fix**: Ensure `webkitAudioContext` fallback and user-gesture-gated `resume()` in ringtone playback.

**Feature Preservation:**

- 1:1 voice calls: must work on all 5 browsers
- 1:1 video calls: must work on all 5 browsers
- Group voice calls: must work on Chrome + Safari + Firefox (desktop)
- Group video calls: must work on Chrome + Safari + Firefox (desktop)
- Screen sharing: must work on Chrome + Safari + Firefox (desktop only — disable on mobile)
- Call accept/reject/end: unchanged
- Ringtone playback: must work on all 5 browsers

**Acceptance Criteria:**

- [ ] `webrtc-adapter` imported and functioning
- [ ] No deprecated API warnings in Chrome DevTools
- [ ] 1:1 calls tested on Chrome ↔ Safari, Chrome ↔ Firefox, Safari ↔ Firefox
- [ ] Group calls tested with 3+ participants on mixed browsers
- [ ] Screen share button hidden on iOS Safari and Firefox Mobile
- [ ] Sentry receiving call quality metrics
- [ ] Ringtone plays on Safari without user gesture error

---

### Epic P2-4: MediaRecorder Cross-Browser Fix (CB-05)

| Field | Detail |
|-------|--------|
| **Effort** | 1–2 days |
| **Ownership** | Frontend / Messages |
| **Dependencies** | None |
| **Risk** | Low |
| **Cross-Browser** | Safari |

**Scope:**

Update `VoiceRecorder.tsx` MediaRecorder codec fallback chain:

```
Current:  audio/webm;codecs=opus → audio/webm → audio/mp4
Proposed: audio/webm;codecs=opus → audio/webm → audio/mp4 → audio/wav → "" (browser default)
```

Also add MIME type detection on playback: when receiving a voice message, check the stored MIME type and use appropriate `<audio>` source type.

**Acceptance Criteria:**

- [ ] Voice recording works on Chrome, Safari, Firefox, iOS Safari, Android Chrome
- [ ] Voice playback works cross-browser (message recorded on Chrome plays on Safari and vice versa)
- [ ] No audio quality degradation
- [ ] Recording indicator UI unchanged

---

### Epic P2-5: List Virtualization

| Field | Detail |
|-------|--------|
| **Effort** | 5–7 days |
| **Ownership** | Frontend / Performance |
| **Dependencies** | P1-4 (pagination — virtualization complements pagination) |
| **Risk** | Medium — virtualized lists affect scroll position, search highlighting |
| **Cross-Browser** | iOS Safari scroll momentum, Firefox smooth scroll |

**Scope:**

Add `react-window` (or `@tanstack/virtual`) virtualization to long lists:

1. **Feed posts** — virtualize post list
2. **Forum threads** — virtualize thread list
3. **Messages conversation list** — virtualize sidebar
4. **Messages message list** — virtualize chat scroll (most complex — reverse scroll, anchoring)
5. **Business directory** — already has `VirtualizedBusinessGrid.tsx` (extend pattern)
6. **Admin user list** — virtualize for large user counts

**Feature Preservation:**

- Scroll to new message (messages) must still work
- Search result highlighting must work within virtualized lists
- "Scroll to top" FAB must work
- Infinite scroll "load more" must integrate with virtualization
- iOS Safari rubber-band scroll must not break virtual list

**Acceptance Criteria:**

- [ ] Feed, Forum, Messages, Business render 1000+ items without jank
- [ ] Memory usage < 100MB for 1000-item lists (measure with Chrome DevTools)
- [ ] iOS Safari scroll momentum works naturally
- [ ] Search within messages scrolls to correct position
- [ ] All interactive elements (like, react, reply) still function within virtualized items

---

## 6. Phase 3 — Long-Term Evolution (Months 6–12)

**Goal:** Scale the architecture for growth — microservices prep, SFU for calls, CI/CD, payments.

### Epic P3-1: E2E Testing with Playwright

| Field | Detail |
|-------|--------|
| **Effort** | 15–20 days |
| **Ownership** | QA / Frontend |
| **Dependencies** | P2-1, P2-2 (stable architecture) |
| **Risk** | Low (additive, no production changes) |
| **Cross-Browser** | Playwright runs on Chromium, WebKit, Firefox |

**Scope:**

Set up Playwright test suite covering critical paths across all 11 modules:

1. **Auth flows**: Sign up, sign in, password reset, phone auth
2. **Feed**: Create post, add reaction, comment, delete
3. **Messages**: Send message (E2EE), receive message, send voice note, start call
4. **Admin**: Approve registration, moderate content (all 5 actions), toggle feature flag
5. **Catering**: Browse menu, place order, track status
6. **Events**: Create event, RSVP, view attendees
7. **Housing**: Create listing, search/filter, contact
8. **Marketplace**: Create listing, search, contact seller
9. **Forum**: Create thread, reply, upvote, accept answer
10. **Business**: Search, view profile, write review
11. **Profile**: Edit profile, view saved items, privacy settings

Run on: Chromium, WebKit (Safari proxy), Firefox.

**Acceptance Criteria:**

- [ ] 50+ E2E tests covering all 11 modules
- [ ] Tests pass on Chromium, WebKit, Firefox
- [ ] < 5 minute total run time
- [ ] CI integration (runs on every PR)
- [ ] 80% critical path coverage

---

### Epic P3-2: SFU for Group Calls (4+ Participants)

| Field | Detail |
|-------|--------|
| **Effort** | 20–25 days |
| **Ownership** | Backend / Infrastructure |
| **Dependencies** | P2-3 (WebRTC modernization) |
| **Risk** | HIGH — new infrastructure component |
| **Cross-Browser** | SFU server handles media relay — browser compatibility via adapter.js |

**Scope:**

1. Deploy LiveKit (or Pion) SFU on Google Cloud Run.
2. Implement hybrid strategy: mesh for 2–3 participants, SFU for 4–8 participants.
3. Auto-detect degraded mesh quality (packet loss > 5%) and offer SFU upgrade.
4. Firestore signaling remains for call initiation; SFU handles media routing.
5. Add server-side recording capability (optional, for compliance).

**Feature Preservation:**

- 1:1 calls unchanged (still mesh/P2P)
- Group calls with 2–3 people unchanged (still mesh)
- Group calls with 4–8 people: transparently routed through SFU
- All call UI (mute, camera toggle, screen share, end call) unchanged
- Call quality should improve for 4+ participant calls

**Acceptance Criteria:**

- [ ] Group call with 6 participants works smoothly (< 200ms latency)
- [ ] Auto-fallback from mesh to SFU at 4 participants
- [ ] SFU handles mixed browser participants (Chrome + Safari + Firefox)
- [ ] Call quality metrics visible in Sentry
- [ ] SFU server auto-scales on Cloud Run

---

### Epic P3-3: CI/CD Pipeline

| Field | Detail |
|-------|--------|
| **Effort** | 7–10 days |
| **Ownership** | DevOps |
| **Dependencies** | P3-1 (E2E tests) |
| **Risk** | Low (additive) |
| **Cross-Browser** | CI runs cross-browser tests automatically |

**Scope:**

Set up GitHub Actions pipeline:

1. **On PR**: TypeScript check (`tsc --noEmit`), Vite build, Playwright E2E tests (Chromium + WebKit + Firefox), Lighthouse CI (performance budget), bundle size gate (< 2MB gzipped total)
2. **On merge to main**: Deploy to staging Firebase project, run E2E tests against staging
3. **On release tag**: Deploy to production, upload source maps to Sentry, notify team
4. **Firestore rules testing**: `firebase emulators:exec` with rule unit tests on every PR that touches `firestore.rules`

**Acceptance Criteria:**

- [ ] PR builds complete in < 10 minutes
- [ ] Broken builds block merge
- [ ] Lighthouse performance score > 80 enforced
- [ ] Bundle size regression detected automatically
- [ ] Firestore rules changes tested before deploy
- [ ] Staging environment mirrors production

---

### Epic P3-4: Message Archival & Cold Storage

| Field | Detail |
|-------|--------|
| **Effort** | 8–10 days |
| **Ownership** | Backend |
| **Dependencies** | P2-1 (repository layer — single point for message reads) |
| **Risk** | Medium — data migration |
| **Cross-Browser** | N/A |

**Scope:**

1. Create a scheduled Cloud Function that runs nightly.
2. For conversations with messages older than 90 days: export old messages to Cloud Storage as JSON.
3. Delete archived messages from Firestore.
4. Keep a `messageArchive` pointer document in the conversation with Cloud Storage path.
5. On client: when user scrolls to top of message history, detect archive pointer and lazy-load from Cloud Storage.

**Feature Preservation:**

- Recent messages (< 90 days) load identically
- Old messages loadable on demand (may have slight delay)
- E2EE decryption must work on archived messages (keys preserved)
- Search across messages must include archived content (or clearly indicate "search recent only")

**Acceptance Criteria:**

- [ ] Messages older than 90 days archived to Cloud Storage
- [ ] Firestore read costs reduced by ~40% for messaging
- [ ] Archived messages loadable on scroll-to-top
- [ ] E2EE decryption works on archived messages
- [ ] Works on all target browsers

---

### Epic P3-5: Micro-Frontends Preparation

| Field | Detail |
|-------|--------|
| **Effort** | 15–20 days |
| **Ownership** | Frontend / Architecture |
| **Dependencies** | P2-1, P2-2, P3-1 (stable architecture + tests) |
| **Risk** | HIGH — fundamental architecture change |
| **Cross-Browser** | Module Federation supported in all modern browsers |

**Scope:**

1. Split the monolithic Vite build into independently deployable modules using Vite's Module Federation (or micro-app pattern):
   - `@ethnicity/shell` — App shell, routing, auth, shared state
   - `@ethnicity/messages` — Messages + E2EE + WebRTC
   - `@ethnicity/catering` — Catering vendor + customer
   - `@ethnicity/admin` — Admin dashboard
   - `@ethnicity/community` — Feed + Forum + Events
   - `@ethnicity/marketplace` — Marketplace + Housing + Business
2. Shared dependencies (React, Firebase, Zustand store) loaded once in shell.
3. Each module independently deployable — update catering without redeploying messages.

**Feature Preservation:**

- All 500+ features must work identically
- Cross-module navigation (e.g., message a business owner from business page) must work seamlessly
- Shared state (auth, theme, settings) must propagate to all micro-apps
- Deep links must resolve to correct micro-app

**Acceptance Criteria:**

- [ ] Each micro-app independently buildable and deployable
- [ ] Shared dependencies not duplicated (verify with bundle analyzer)
- [ ] Cross-module navigation works without full page reload
- [ ] E2E tests pass across micro-app boundaries
- [ ] Deploy one module without touching others

---

### Epic P3-6: Payment Integration (Stripe Connect)

| Field | Detail |
|-------|--------|
| **Effort** | 20–25 days |
| **Ownership** | Backend + Frontend |
| **Dependencies** | P2-1 (repository layer for orders) |
| **Risk** | HIGH — financial transactions |
| **Cross-Browser** | Stripe.js supports all target browsers |

**Scope:**

1. Integrate Stripe Connect for multi-vendor catering payments.
2. Vendor onboarding: Stripe Express accounts with identity verification.
3. Order payment flow: customer pays → Stripe holds in escrow → vendor fulfills → funds released.
4. Refund handling: full and partial refunds via Cloud Function.
5. Payout dashboard for vendors.
6. Platform fee collection (configurable percentage).

**Feature Preservation:**

- Existing order placement flow unchanged (payment step added after cart review)
- Order status tracking unchanged (payment status added as new field)
- Vendor dashboard gets new "Payments" tab — existing tabs unchanged
- Non-payment catering flows (RFP, quotes, templates) unchanged

**Acceptance Criteria:**

- [ ] End-to-end payment: customer pays → vendor receives
- [ ] Stripe checkout works on Chrome, Safari, Firefox, iOS Safari, Android Chrome
- [ ] Refund flow works for full and partial amounts
- [ ] Vendor payout dashboard shows transaction history
- [ ] PCI compliance maintained (Stripe handles card data)

---

## 7. Cross-Browser Patch Backlog

These patches should be applied as encountered or during the relevant epic:

| ID | Patch | Apply During | Effort |
|----|-------|-------------|--------|
| CB-01 | Replace `new RTCSessionDescription()` with plain objects | P2-3 | 30 min |
| CB-02 | Add IndexedDB key expiry check (7-day Safari) | P0-2 | 2 hours |
| CB-03 | Add IDB private browsing fallback (try-catch + memory) | P0-2 | 2 hours |
| CB-04 | Add `backdrop-filter` Firefox fallback | P1-2 | 1 hour |
| CB-05 | Add `audio/wav` to MediaRecorder codec chain | P2-4 | 1 hour |
| CB-06 | Add smoothscroll polyfill | P1-2 | 30 min |
| CB-07 | Hide screen share on mobile browsers | P2-3 | 1 hour |
| CB-08 | Add security headers to firebase.json | P0-4 | 2 hours |

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Firestore rules too restrictive → breaks legitimate operations | High | High | Deploy to staging first, test all 11 modules before production |
| E2EE key migration fails → users lose message history | Medium | Critical | Keep plaintext keys for 30-day rollback window, migrate in background |
| Repository layer migration introduces data bugs | Medium | High | Migrate one module at a time with Sentry monitoring between each |
| Zustand migration breaks context-dependent components | Medium | High | Bridge pattern: old context reads from Zustand during transition |
| List virtualization breaks scroll position / search | Medium | Medium | Ship behind feature flag, A/B test before full rollout |
| SFU infrastructure adds cost and ops complexity | Low | Medium | Start with LiveKit Cloud (managed) before self-hosting |
| Micro-frontend split increases bundle size | Medium | Medium | Shared dependency deduplication, measure before/after |
| Safari IndexedDB eviction loses E2EE keys | High | High | Add key re-fetch from Firestore with expiry check (P0-2) |

---

## 9. Milestone Summary

| Milestone | Target Date | Epic(s) | Success Metric |
|-----------|-------------|---------|----------------|
| **M0: Security Baseline** | Week 3 | P0-1 through P0-5 | Zero CRITICAL/HIGH security findings |
| **M1: Observable Production** | Week 6 | P1-1 through P1-5 | Sentry capturing errors, pagination deployed, counters distributed |
| **M2: Modern Architecture** | Month 4 | P2-1 through P2-5 | Repository layer complete, Zustand migrated, WebRTC hardened |
| **M3: Production Ready** | Month 6 | P3-1, P3-3 | E2E tests + CI/CD pipeline operational |
| **M4: Scale Ready** | Month 9 | P3-2, P3-4 | SFU deployed, message archival running |
| **M5: Platform** | Month 12 | P3-5, P3-6 | Micro-frontends deployed, Stripe payments live |

### Phase Dependencies (Execution Order)

```
P0-1 (Rules) ──────────────┐
P0-2 (E2EE Keys) ──────────┤
P0-3 (API Keys) ───────────┼──→ M0 Security Baseline
P0-4 (Headers) ────────────┤
P0-5 (WebRTC Rules) ───────┘
         │
         ▼
P1-1 (Sentry) ─────────────┐
P1-2 (CSS Patches) ────────┤
P1-3 (Counters) ───────────┼──→ M1 Observable Production
P1-4 (Pagination) ─────────┤
P1-5 (Logging) ────────────┘
         │
         ▼
P2-1 (Repository) ─────────┐
P2-2 (Zustand) ────────────┤
P2-3 (WebRTC Modern) ──────┼──→ M2 Modern Architecture
P2-4 (MediaRecorder) ──────┤
P2-5 (Virtualization) ─────┘
         │
         ▼
P3-1 (Playwright) ─────────┬──→ M3 Production Ready
P3-3 (CI/CD) ──────────────┘
         │
         ▼
P3-2 (SFU) ────────────────┬──→ M4 Scale Ready
P3-4 (Archival) ───────────┘
         │
         ▼
P3-5 (Micro-FE) ───────────┬──→ M5 Platform
P3-6 (Payments) ───────────┘
```

---

*This plan is a living document. Update after each milestone review. All effort estimates assume a single developer — scale linearly for team size.*
