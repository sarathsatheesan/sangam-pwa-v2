# eNoVo — Android (Capacitor) Setup & Release Guide

This wraps the **existing** eNoVo web build (`dist/`) in a native Android shell using
Capacitor. Your web app and its Firebase Hosting deploy are unchanged. The only web
file touched is `src/main.tsx` (one guarded line that is a no-op in browsers).

- **App ID (permanent):** `enovoapp.app`
- **App name:** eNoVo
- **Firebase project:** `mithr-1e5f4` (the real project — *not* `ethnicity-app`)
- **Push:** native FCM via `@capacitor/push-notifications`, tokens stored in `users/{uid}.fcmTokens`
- **Calling:** your existing web WebRTC runs in the Android System WebView

> Run everything below **on your Mac**. The Cowork sandbox can't run Vite/Gradle.

---

## 0. Prerequisites (one-time)
1. **Android Studio** (latest) + a JDK 17 (bundled with Android Studio).
2. Accept Android SDK licenses: `sdkmanager --licenses` (or via Android Studio first-run).
3. A device with USB debugging on, or an emulator (API 34+).
4. A **Google Play Console** account ($25 one-time) — needed only at submission, not for local runs.

---

## 1. Install the new dependencies
From the project root (`sangam-pwa-v2/`):
```bash
npm install
```
This pulls the Capacitor packages already added to `package.json` (`@capacitor/core`,
`/cli`, `/android`, `/app`, `/push-notifications`, `/splash-screen`, `/status-bar`,
`/assets`). Harmless to the web build — native code no-ops in browsers.

---

## 2. Add the Android platform
```bash
npm run build            # produces dist/ (the web bundle Capacitor wraps)
npx cap add android      # generates the android/ native project (one-time)
npx cap sync android     # copies dist/ + plugins into android/
```
`capacitor.config.ts` is already configured (`appId`, `appName`, `webDir: dist`,
`androidScheme: https`). After this, an `android/` folder exists.

---

## 3. Wire Firebase (native FCM)
1. In the [Firebase console](https://console.firebase.google.com/) open project **`mithr-1e5f4`**.
2. **Add app → Android.** Package name: **`enovoapp.app`**. Register.
3. Download **`google-services.json`** → place it at **`android/app/google-services.json`**.
4. Add the Google Services Gradle plugin:
   - In `android/build.gradle` (project), inside `dependencies` of `buildscript`:
     `classpath 'com.google.gms:google-services:4.4.2'`
   - At the **bottom** of `android/app/build.gradle`:
     `apply plugin: 'com.google.gms.google-services'`
5. `npx cap sync android` again.

That's all the backend needs — your Cloud Functions already send to `fcmTokens`, and
the native device token is appended to the same array by `src/native/push.ts`.

> **Heads-up (web push is currently broken, unrelated to Android):** `src/pages/messages.tsx`
> uses `vapidKey: 'PENDING_VAPID_KEY'`, so browser push doesn't work yet. Native FCM does
> **not** use the VAPID key, so Android push is fine. But fix the web VAPID key separately
> (Firebase console → Project settings → Cloud Messaging → Web Push certificates).

---

## 4. Permissions + App Links (native edits)
Apply the snippets in `android-setup/` to the generated native project:

- **`android-setup/AndroidManifest.additions.xml`** → merge into
  `android/app/src/main/AndroidManifest.xml` (camera, mic, notifications, foreground
  service, and the `https://enovoapp.com` App Links intent-filter).
- **`android-setup/MainActivity.webrtc.snippet.java`** → make `MainActivity` grant
  `getUserMedia` for your own origin so calling works reliably.
- **App Links verification:** `public/.well-known/assetlinks.json` already exists and will
  deploy with your web hosting to `https://enovoapp.com/.well-known/assetlinks.json`.
  Replace `REPLACE_WITH_SHA256...` with your **Play App Signing SHA-256** (from §8) once
  you've uploaded the first build, then redeploy hosting.

---

## 5. Run locally
```bash
npm run cap:sync     # = npm run build && npx cap sync android
npm run cap:open     # opens android/ in Android Studio
```
In Android Studio: pick your device/emulator → **Run ▶**. The app boots to the eNoVo
splash (`#F5F6FA`), then your web app. Grant camera/mic when you start a call; grant
notifications on first launch (Android 13+).

Fast iteration: after web changes, `npm run cap:sync` then re-run. For live reload against
the Vite dev server, you can temporarily set `server.url` in `capacitor.config.ts` to your
Mac's LAN IP:5173 — but **revert it before building a release** (release must use bundled assets).

---

## 6. Verify calling + push before release
- **Calling:** place a 1:1 and a group call between two devices. Confirm camera/mic prompts
  appear once, video flows, and audio routes. If calls connect on Wi‑Fi but fail on cellular,
  that's the **free `openrelay.metered.ca` TURN** (`src/utils/webrtc.ts` / `groupWebrtc.ts`)
  — provision a paid TURN (Twilio NTS, metered.ca paid, or Cloudflare) before launch.
- **Push:** send a test from Firebase console → Cloud Messaging to the device token; confirm
  background delivery and that tapping routes to `/messages` or `/catering`.

---

## 7. App icon + splash
```bash
# Put a 1024x1024 icon at  resources/icon.png  and a 2732x2732 splash at resources/splash.png
npm run android:assets   # generates adaptive icons + splash into android/
```
Source art: `public/enovo-logo.svg` (export to PNG at the sizes above).

---

## 8. Signing + Play App Signing
1. Generate your **upload** key:
   ```bash
   bash scripts/generate-keystore.sh
   ```
   Save the password in your password manager. The keystore lands in `android-keys/`.
2. Copy `android-setup/keystore.properties.example` → `android/keystore.properties` and
   fill in your password/alias.
3. Paste `android-setup/signing-config.gradle.snippet` into `android/app/build.gradle`.
4. **Gitignore secrets** (append to `.gitignore`):
   ```
   android-keys/
   android/keystore.properties
   android/app/google-services.json
   ```
5. **Enroll in Play App Signing** (default for new apps): you upload an AAB signed with the
   *upload* key; Google holds the real distribution key. After your first upload, Play Console
   → Setup → App signing shows the **app-signing SHA-256** — use that value in
   `assetlinks.json` (§4) and redeploy hosting.

---

## 9. Build a signed release (AAB)
```bash
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab` — upload this to Play.
(For a local installable test build: `./gradlew assembleRelease` → `app-release.apk`.)

---

## 10. Play Store submission checklist
- [ ] **Privacy policy URL** (required — you handle messages, location, photos, audio). Host it at e.g. `https://enovoapp.com/privacy`.
- [ ] **Data Safety form**: declare collection of account info, messages/user content, photos, **precise location**, **audio (calls)**, and device identifiers; mark data **encrypted in transit**; describe sharing (none/limited).
- [ ] **Content rating** questionnaire (social/communication app → expect Teen given user-generated content + chat).
- [ ] **Target audience & content** (not directed at children if you want to avoid Families policy).
- [ ] **Permissions rationale**: in-app explanations for camera, mic, notifications, location.
- [ ] **Store listing**: app icon (512), feature graphic (1024×500), 2–8 phone screenshots, short + full description.
- [ ] **App access**: provide test credentials (email/password login) so reviewers can sign in.
- [ ] **Calling disclosure**: note WebRTC audio/video + that recording (if any) is consented.
- [ ] Upload the **AAB**, set up a **Closed testing** track first, then promote to Production.

---

## Known issues to clean up (found during inspection)
1. **`vite.config.ts` VitePWA manifest still says "ethniCity"** while `public/manifest.json` says "eNoVo". Two manifests disagree — reconcile so PWA/branding is consistent.
2. **Web push VAPID key is a placeholder** (`PENDING_VAPID_KEY`) — web notifications are non-functional until set. Native (Android) push is unaffected.
3. **Free public TURN** — replace before launch for reliable calls off Wi‑Fi.
4. **FCM SW click handler** hardcodes `mithr-1e5f4.web.app`/`localhost` — won't match `enovoapp.com` for web notification taps in production.

None of these block the Android scaffold; items 1, 3, 4 affect launch quality and item 2 affects web push.
