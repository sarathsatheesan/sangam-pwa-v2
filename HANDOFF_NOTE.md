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

  Each session note includes inline comments explaining WHY decisions were made,
  not just WHAT was done. Read them before changing architecture or revisiting
  previously-fixed bugs.
-->

**Date:** March 19, 2026 (Last updated: Session 2)
**Repo:** https://github.com/sarathsatheesan/sangam-pwa-v2
**Latest Commit:** `1fcfea4` — Add incoming request count badge to Discover tile on home page
**Deployed to:** Firebase Hosting (site: `mithr-1e5f4`)
**Local project path on Mac:** `/Users/sarathsatheesan/ethniCity_03_19_2026/sangam-pwa-v2`
**Session history:** `docs/handoff/SESSION_01.md`, `docs/handoff/SESSION_02.md`

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
- Tailwind CSS v4
- Firebase (Firestore, Auth, Storage, Hosting)
- Framer Motion for animations
- Lucide React for icons
- CryptoJS + Web Crypto API for E2EE
- WebRTC for peer-to-peer calls
- Deployed to Firebase Hosting (site: `mithr-1e5f4`)

**Design System:** "Aurora" theme using CSS variables (`var(--aurora-*)`), with primary colors Delta Navy (#0032A0) and Delta Red (#C8102E) on a #F5F7FA background.

**This session focused on:** Environment setup, dependency fixes, and two UX improvements to the navigation/landing page.

---

<!-- ================================================================
     SECTION 2: KEY DECISIONS
     These decisions are foundational. Read before making architectural
     changes. Each decision includes the reasoning so you don't
     accidentally revert something that was done intentionally.
     For session-specific decision details, see docs/handoff/SESSION_*.md
     ================================================================ -->
## 2. Decisions Made and Why

### Environment / Build Fixes (this session)
- **Removed `@rollup/rollup-linux-arm64-gnu` from package.json** — This Linux-only dependency was preventing `npm install` on macOS (Darwin). It was likely added when the project was previously edited in a Linux VM. Removed with `npm remove` and fresh `npm install` succeeded. Commit: `d5bea05`.
- **`gh` CLI not available in Cowork VM** — GitHub CLI couldn't be installed due to network restrictions in the sandbox. Workaround: use `git` commands directly for push/pull, and Chrome browser for GitHub web UI if needed. Not a blocker.
- **npm vulnerabilities left as-is (30 total: 7 low, 19 moderate, 4 high)** — All are in transitive dependencies (firebase-tools, jimp/file-type, vite-plugin-pwa/workbox chain). None affect the production app or end users. `npm audit fix` found no non-breaking fixes. `npm audit fix --force` would require major version bumps to vite-plugin-pwa, firebase-tools, and jimp — deferred to a dedicated maintenance session to avoid breakage.

### UX Improvements (this session)
- **Auto-scroll active pill in ModuleSelector** — When navigating to a module (e.g., clicking a tile on Home), the corresponding pill in the sticky nav bar now smoothly scrolls into view, centered horizontally. Uses `scrollIntoView({ behavior: 'smooth', inline: 'center' })` with `requestAnimationFrame` for DOM settlement. A `pillRefs` Map stores refs to each pill element. Also fixed a **React hooks rule violation**: the original code had an early return (`if (pathname === '/home') return null`) before `useEffect` calls. Moved the guard after all hooks using an `isHome` flag. Commit: `185f038`.
- **Incoming request badge on Discover tile (Home page)** — The `useIncomingRequestCount()` hook (real-time Firestore listener on the `connections` collection) was already used in ModuleSelector. Now also imported into `home.tsx` to show a red pulsing badge on the Discover tile when pending connection requests exist. Same visual style as the nav pill badge (red circle, 9+ cap, pulse animation). Commit: `1fcfea4`.

### Architecture Decisions (carried from prior sessions)
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

### This Session
| Task | File(s) Changed | Commit |
|------|-----------------|--------|
| Fixed macOS build (removed Linux rollup dep) | `package.json` | `d5bea05` |
| Auto-scroll active pill into view on module entry | `src/components/layout/ModuleSelector.tsx` | `185f038` |
| Fixed React hooks ordering violation in ModuleSelector | `src/components/layout/ModuleSelector.tsx` | `185f038` |
| Added incoming request count badge to Discover tile on Home page | `src/pages/main/home.tsx` | `1fcfea4` |

### Previously Completed (all functional with Firestore CRUD)
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
| Messages | `src/pages/messages.tsx` | 3,884 | Done (E2EE, voice, formatting) |
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

### Infrastructure
- Firebase Auth (email/password + Google sign-in)
- Firestore security rules (comprehensive, role-based)
- PWA manifest and service worker (offline-capable)
- Vite build with code splitting
- Dark mode support via CSS variables
- Content moderation utility (`src/utils/contentModeration.ts`)
- Data privacy service (`src/services/dataPrivacy.ts`)
- Feature flags system (`src/services/featureFlags.ts`)

### Contexts (6 providers)
- `AuthContext` — Firebase auth state + user profile + admin detection
- `FeatureSettingsContext` — Feature flag management
- `LocationContext` — User location/city selection
- `ToastContext` — Toast notification system
- `UserSettingsContext` — User preferences
- `CulturalThemeContext` — Cultural theme customization

### Hooks
- `useIncomingRequestCount` — Real-time Firestore listener for pending connection requests where current user is the recipient. Used in ModuleSelector nav pills AND Home page Discover tile.

---

<!-- ================================================================
     SECTION 4: IN PROGRESS / HALF-DONE
     These items have partial work done. Don't start from scratch —
     check the existing code first. The housing enhancements in
     particular have all state management done, just need JSX.
     ================================================================ -->
## 4. What's In Progress / Half-Done

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

**The state management and Firestore mapping is done, but the JSX/UI rendering for these features still needs wiring up.** This is the most concrete "pick up and build" task.

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
     Prioritized list. High priority items are the most impactful
     and/or have the most groundwork already done.
     ================================================================ -->
## 5. Exact Next Steps

### High Priority
1. **Wire up Housing UI for the 7 enhancements** — The state is ready; add JSX for status badges, calculator tab, neighborhood scores, comments section, similar listings carousel, and saved/recent tabs.
2. **Stabilize the call system** — Test audio/video calls across Safari iOS, Chrome Android, Chrome Desktop. The TURN servers may need to be replaced with a paid provider (like Twilio or daily.co) for reliability.
3. **Test E2EE thoroughly** — Especially the deterministic key fallback vs. ECDH. Make sure messages decrypt correctly across all browser/device combinations.

### Medium Priority
4. **Refactor large page files** — Messages (3,884 lines), Admin (2,759 lines), Marketplace (2,436 lines), Forum (2,354 lines) should be broken into smaller components.
5. **Add image upload to all modules** — Currently only profile photos and feed support images.
6. **Implement group chats** — The encryption layer is ready. Need UI for group creation, member management, and key distribution.
7. **Add pagination** — Most pages use `limit()` on Firestore queries. Implement infinite scroll or cursor-based pagination.

### Lower Priority
8. **Push notifications** — Firebase Cloud Messaging integration
9. **Map integration** — For housing listings and event locations
10. **Content moderation** — Utility exists but isn't wired into all submission flows
11. **Testing** — No tests exist. Add unit tests for encryption utils and integration tests.
12. **npm vulnerability maintenance** — Upgrade vite-plugin-pwa, firebase-tools, jimp to latest majors (test for breakage)

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

# Git push
git add <files> && git commit -m "message" && git push origin main

# All-in-one
./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build && npx firebase deploy --only hosting && git add -A && git commit -m "message" && git push origin main
```

**Important:** Do NOT use `npx tsc` — it tries to install the wrong package (`tsc@2.0.4` instead of TypeScript). Always use `./node_modules/.bin/tsc`.

### Critical Files to Know
| File | Why It Matters |
|------|---------------|
| `src/App.tsx` | All routing, context providers, lazy loading |
| `src/components/layout/ModuleSelector.tsx` | Nav pill bar — now includes auto-scroll to active pill + request badge |
| `src/pages/main/home.tsx` | Landing page with module tiles — now includes Discover request badge |
| `src/hooks/useIncomingRequests.ts` | Real-time pending request count (Firestore listener) |
| `src/utils/encryption.ts` | Full E2EE implementation (v1 + v2 + group) |
| `src/utils/webrtc.ts` | CallManager class, WebRTC signaling |
| `src/components/GlobalCallOverlay.tsx` | Call UI (global, persists across nav) |
| `src/contexts/AuthContext.tsx` | Auth state, user profile, admin detection |
| `src/constants/config.ts` | App config including ENCRYPTION_SALT |
| `firestore.rules` | Security rules (comprehensive, 13K+ chars) |
| `firebase.json` | Hosting config, cache headers |
| `vite.config.ts` | Build config, PWA manifest, code splitting |

### Constraints
- **No Firebase Storage for profile images** — Using base64 in Firestore (1MB doc limit)
- **Free TURN servers** — openrelay.metered.ca may be unreliable. Budget for a paid provider.
- **Single-file page architecture** — Works but painful as features grow
- **No backend/Cloud Functions** — Everything client-side. Security rules are critical.
- **PWA-first** — Test on mobile Safari (Add to Home Screen) and Chrome (install prompt)
- **`gh` CLI unavailable in Cowork VM** — Use `git` commands directly or Chrome browser for GitHub
- **`npx tsc` is broken** — Always use `./node_modules/.bin/tsc` to avoid installing wrong package

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
1fcfea4 Add incoming request count badge to Discover tile on home page
185f038 Auto-scroll active pill into view in ModuleSelector nav bar
d5bea05 Remove Linux-specific rollup dependency, rebuild for macOS
3e65526 Add post-login landing page with module tiles
17f2a6c Fix call UI: raise overlay z-index above video
5e52d03 Revert call system to last working state, fix only duplicate messages
363fddd Fix video calls: render video inside containers, Chrome camera flip
76194be Fix duplicate call event messages: track lastEndedCallId
bcff52f Fix calls: replace dead TURN server with pure P2P STUN
62a1727 Fix calls: audio not audible, video not visible, caller disconnect stuck
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

*Generated March 19, 2026 (Session 2) — for continuing development in a new session.*
