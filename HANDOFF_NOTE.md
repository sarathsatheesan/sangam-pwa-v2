# Sangam PWA v2 (ethniCity) — Session Handoff Note

**Date:** March 19, 2026
**Repo:** https://github.com/sarathsatheesan/sangam-pwa-v2
**Latest Commit:** `3e65526` — Add post-login landing page with module tiles

---

## 1. What We Were Building

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

---

## 2. Key Decisions Made and Why

### Architecture
- **Single-file pages** — Each module (feed, discover, business, etc.) is a single large TSX file containing all its components, state, and Firestore logic. This was chosen for simplicity and rapid iteration, not for long-term scalability. Refactoring into smaller components is a future task.
- **Lazy loading everything** — All routes use `React.lazy()` + `Suspense` in `App.tsx` for code splitting. Firebase and vendor libs are also split into separate chunks via `manualChunks` in Vite config.
- **Feature flags via Firestore** — `FeatureSettingsContext` reads `appConfig/settings` from Firestore to toggle modules on/off. The ModuleSelector and Home page both respect these flags.

### Encryption
- **E2EE with ECDH P-256 + AES-256-GCM (v2)** — Full Web Crypto API implementation. Key pairs are synced across devices via Firestore (Firestore is the source of truth, IndexedDB is offline cache).
- **Deterministic shared key fallback** — `getDeterministicSharedKey()` uses PBKDF2 to derive keys from user IDs + salt. Added because ECDH key exchange was failing across devices/browsers (Safari issues). This is the primary decryption method now.
- **Legacy v1 still supported** — Old messages used CryptoJS AES-CBC. The `decryptMessage()` function detects v1 vs v2 payloads and handles both.
- **Group chat encryption** — Infrastructure is built (generateGroupKey, wrapGroupKeyForMember, etc.) but group chats themselves are not fully implemented yet.

### Calling System (WebRTC)
- **Pure P2P with STUN + TURN** — Uses Google STUN servers and openrelay.metered.ca TURN servers. Firestore documents handle signaling (SDP offer/answer + ICE candidates).
- **Global call overlay** — `GlobalCallOverlay.tsx` renders the call UI at the app level so it persists across module navigation (PiP mode).
- **Caller-only writes call events** — To prevent duplicate "call ended" messages in chat, only the caller writes the call event message. This was a major bug that took several iterations to fix.

### Profile Images
- **Base64 in Firestore** — Profile photos are compressed and stored as base64 data URLs directly in Firestore user documents (not Firebase Storage). Chosen to avoid Storage timeout issues and simplify rendering. Works but has Firestore document size implications at scale.

### Ethnicity/Heritage System
- **2-tier Country > Ethnicity selector** — 175+ countries with scoped ethnicity keys. `CountryEthnicitySelector.tsx` and `EthnicityFilterDropdown.tsx` are reusable across all modules.

### Post-login Flow
- **Home page with module tiles** — After login, users land on `/home` which shows a responsive grid of module tiles (not directly into feed). Each tile respects feature flags.

---

## 3. What Was Completed

### Core Pages (all functional with Firestore CRUD)
| Page | File | Lines | Status |
|------|------|-------|--------|
| Home (landing) | `src/pages/main/home.tsx` | 127 | Done |
| Feed | `src/pages/feed.tsx` | — | Done |
| Discover | `src/pages/discover.tsx` | 1,735 | Done |
| Business | `src/pages/business.tsx` | — | Done |
| Housing | `src/pages/housing.tsx` | ~1,776 | Done + 7 enhancements |
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

---

## 4. What's In Progress / Half-Done

### Call System (mostly working, but fragile)
- Audio and video calls work between Chrome-Chrome and Chrome-Safari, but there are edge cases:
  - Camera flip on Chrome uses `deviceId` cycling (works but not elegant)
  - Safari video rendering required special handling (multiple commits fixing this)
  - The last 10+ commits were iterating on call bugs: duplicate messages, z-index overlays, audio not audible, video not visible, etc.
  - **Most recent fix** (commit `17f2a6c`): Raised call overlay z-index above video, added semi-transparent bg for video calls
- The TURN servers used (`openrelay.metered.ca`) are free/public and may be unreliable in production

### Housing Page Enhancements (state ready, UI partially done)
7 enhancements were added to housing.tsx at the state/data level:
1. Listing status management (Active/Pending/Under Contract/Sold/Rented)
2. Monthly payment estimator (calculator states exist)
3. Neighborhood info & scores (walkScore, transitScore)
4. Public comments (interface + states defined)
5. View counter & popularity sorting
6. Similar listings carousel (useMemo logic done)
7. Saved listings tab & recent views (localStorage sync works)

**The state management and Firestore mapping is done, but some JSX/UI rendering for these features may still need wiring up.**

### Group Chat Encryption
- Encryption infrastructure exists in `src/utils/encryption.ts` (generateGroupKey, wrapGroupKeyForMember, etc.)
- Actual group chat UI and key distribution flow are not implemented

### Image Handling in Messages
- Image messages with E2EE work but had decryption issues that were fixed (commits `7014b61`, `808e045`)
- Image lightbox viewer exists in feed (`4975278`) and messages (`2a015db`)

---

## 5. Exact Next Steps

### High Priority
1. **Stabilize the call system** — Test audio/video calls across Safari iOS, Chrome Android, Chrome Desktop. The TURN servers may need to be replaced with a paid provider (like Twilio or daily.co) for reliability.
2. **Wire up Housing UI for the 7 enhancements** — The state is ready; add JSX for status badges, calculator tab, neighborhood scores, comments section, similar listings carousel, and saved/recent tabs.
3. **Test E2EE thoroughly** — Especially the deterministic key fallback vs. ECDH. Make sure messages decrypt correctly across all browser/device combinations.

### Medium Priority
4. **Refactor large page files** — Messages (3,884 lines), Admin (2,759 lines), Marketplace (2,436 lines), Forum (2,354 lines) should be broken into smaller components.
5. **Add image upload to all modules** — Currently only profile photos and feed support images. Housing, Business, Marketplace, Events would benefit from photo uploads.
6. **Implement group chats** — The encryption layer is ready. Need UI for group creation, member management, and key distribution.
7. **Add pagination** — Most pages currently use `limit()` on Firestore queries. Implement infinite scroll or cursor-based pagination.

### Lower Priority
8. **Push notifications** — Firebase Cloud Messaging integration for real-time notifications (new messages, connection requests, event RSVPs)
9. **Map integration** — For housing listings and event locations
10. **Content moderation** — The utility exists but isn't wired into all submission flows
11. **Testing** — No tests exist currently. Add unit tests for encryption utils and integration tests for key flows.

---

## 6. Important Context, Constraints & Files

### Critical Files to Know
| File | Why It Matters |
|------|---------------|
| `src/App.tsx` | All routing, context providers, lazy loading |
| `src/utils/encryption.ts` | Full E2EE implementation (v1 + v2 + group) |
| `src/utils/webrtc.ts` | CallManager class, WebRTC signaling |
| `src/components/GlobalCallOverlay.tsx` | Call UI (global, persists across nav) |
| `src/contexts/AuthContext.tsx` | Auth state, user profile, admin detection |
| `src/constants/config.ts` | App config including ENCRYPTION_SALT |
| `firestore.rules` | Security rules (comprehensive, 13K+ chars) |
| `firebase.json` | Hosting config, cache headers |
| `vite.config.ts` | Build config, PWA manifest, code splitting |

### Constraints
- **No Firebase Storage for profile images** — Using base64 in Firestore. This works but watch document size limits (1MB max per Firestore doc).
- **Free TURN servers** — The openrelay.metered.ca servers are public and could go down. Budget for a paid TURN provider.
- **Single-file page architecture** — Works for now but will become painful as features grow. Plan for component extraction.
- **No backend/Cloud Functions** — Everything runs client-side. This means security rules are critical and some operations (like content moderation webhooks, push notifications) will eventually need Cloud Functions.
- **PWA-first** — App is designed as installable PWA. Test on mobile Safari (Add to Home Screen) and Chrome (install prompt).

### Auth Flow
1. `/auth/login` → Email/password or Google sign-in
2. `/auth/signup` → New account creation
3. `/auth/verify` → Email verification
4. `/auth/select-ethnicity` → Onboarding heritage selection
5. → Redirected to `/home` (module tiles landing page)

### Firestore Collections
`users`, `posts` (+ subcollection `comments`), `businesses`, `listings`, `events`, `travelPosts`, `conversations` (+ subcollection `messages`), `connections`, `appConfig`, `bannedUsers`, `disabledUsers`, `userSettings`

### Migration Scripts in Repo Root
- `migrate-social-to-community.cjs` — Renames social references to community
- `enhance_housing.py`, `add_popular_sort.py`, `add_status_filter.py`, `fix_similar_listings.py` — Python scripts used to patch housing.tsx

---

*Generated March 19, 2026 — for continuing development in a new session.*
