# eNoVo — Google Play Submission Guide

Everything you need to get eNoVo onto the Play Store. You create the account and click the
final buttons; this doc gives you the exact inputs.

- **App:** eNoVo · **Package:** `enovoapp.app` · **Firebase project:** `mithr-1e5f4`
- **Privacy policy URL:** `https://enovoapp.com/privacy.html` (deploys from `public/privacy.html` — run `npm run build && firebase deploy --only hosting` first, then confirm the URL loads)
- **Signed artifact:** `android/app/build/outputs/bundle/release/app-release.aab`

> The privacy policy is a solid starting template based on how eNoVo actually handles data. I'm not a
> lawyer — review it (ideally with counsel) and adjust before you rely on it.

---

## 0. The timeline reality (read first)
Google requires **new personal developer accounts** to run a **Closed test with ≥12 testers, opted in
for 14 continuous days**, before you can apply for **Production** (public download). Testers must actually
use the app during those two weeks. So:

- **Internal testing** → up to 100 testers, live in minutes. Does **NOT** count toward the 14-day rule, but
  it's the fastest way to put the signed app in real hands today.
- **Closed testing** → start a 12+ tester track now; the 14-day clock starts when they're opted in.
- **Production** → apply only after the closed-test requirement is met.
- **Shortcut:** an **Organization** account (needs a registered business + free D-U-N-S number) is exempt
  from the 12-tester rule but requires business verification.

**Recommended order:** create account → Internal testing (today) → Closed testing 12+ testers (14-day clock)
→ Production.

---

## 1. Create the Play Console account (you do this)
1. Go to <https://play.google.com/console>, sign in with your Google account.
2. Choose account type: **Personal** (fastest) or **Organization** (skips 12-tester rule, needs business + D-U-N-S).
3. Pay the **$25 one-time** fee.
4. Complete **identity verification** (Google may ask for ID; can take a few hours to a couple of days).

I can't create the account or pay — that's yours. Everything below I've prepared for you.

---

## 2. Create the app
Play Console → **Create app**:
- App name: **eNoVo**
- Default language: **English (United States)**
- App or game: **App**
- Free or paid: **Free**
- Accept the declarations.

---

## 3. Store listing (copy you can paste)
**App name:** `eNoVo`

**Short description (≤80 chars):**
`Your city's diaspora community — connect, discover, and belong nearby.`

**Full description (≤4000 chars):**
```
eNoVo brings your diaspora community together in one place, scoped to your city.

Discover the people, businesses, events, and culture around you — and stay connected with the
community that feels like home.

• Community feed — share updates and see what's happening near you
• Messaging & calls — private chats plus voice and video calling
• Business directory — find and support community-owned businesses
• Housing — browse and post local housing listings
• Marketplace — buy and sell within your community
• Events — discover gatherings, festivals, and meetups nearby
• Forums — join conversations that matter to your community

Whether you've just moved to a new city or have lived there for years, eNoVo helps you find your
people, your culture, and your place — nearby.
```

**Graphics you must provide (Play requirements):**
- App icon: 512×512 PNG (use your eNoVo icon — already generated at `resources/icon.png`, export 512).
- Feature graphic: 1024×500 PNG/JPG (you can build one from `public/enovo-banner.jpg`).
- Phone screenshots: 2–8, min 320px, 16:9 or 9:16 (capture from the running app on your tablet/phone).

**Category:** Social (or Lifestyle). **Contact email:** sarath.s1884@gmail.com.

---

## 4. Data Safety form (answers mapped to eNoVo's actual behavior)
Verify each against your final build before submitting — you certify it's accurate.

**Does your app collect or share user data?** Yes.
**Is data encrypted in transit?** Yes.
**Do you provide a way to request data deletion?** Yes (email request, per the privacy policy).

Data types to declare as **Collected** (processed via Firebase; not sold/shared for third-party use):

| Category | Data type | Collected | Purpose |
|---|---|---|---|
| Personal info | Name | Yes | Account, app functionality |
| Personal info | Email address | Yes | Account management |
| Personal info | Phone number | Yes (if phone sign-in used) | Account management |
| Personal info | User IDs | Yes | Account, app functionality |
| Location | Approximate location | Yes | App functionality (nearby discovery) |
| Location | Precise location | Yes, if you use device GPS | App functionality (nearby discovery) |
| Messages | Other in-app messages | Yes | App functionality (chat) |
| Photos and videos | Photos | Yes | App functionality (profile/listings) |
| App activity | App interactions | Yes | Analytics / app functionality |
| Device or other IDs | Device or other IDs | Yes | Push notifications (FCM token) |

Notes:
- **Calls:** WebRTC audio/video is peer-to-peer and **not recorded or stored** — so you are not "collecting"
  audio. (Mic/camera are used in real time only.) Don't declare audio collection unless you add recording.
- **Sharing:** Firebase/Google Maps are processors acting on your behalf, which Google treats as "collected,"
  not "shared." Only mark "shared" if you send data to a third party for their own purposes (you don't).

---

## 5. Content rating
Complete the questionnaire (Play Console → Content rating). For eNoVo:
- Category: **Social Networking / Communication**.
- Violence, sexual content, profanity, controlled substances, gambling: **No**.
- **Users can interact / communicate:** **Yes** (chat, calls, forums).
- **Users can share content:** **Yes** (posts, listings).
- **Shares user location:** **Yes**.

Expect a **Teen**-ish rating due to user-generated content + communication. Answer truthfully.

---

## 6. App content declarations (Play Console → App content)
- **Privacy policy:** `https://enovoapp.com/privacy.html`
- **Ads:** declare whether the app contains ads (eNoVo currently does **not**).
- **App access:** provide a **test login** (email + password) so reviewers can sign in and see all features.
- **Target audience:** 13+ (not directed at children).
- **Permissions:** be ready to justify camera, microphone, and location in the form / listing.
- **Government apps / financial / health:** No.

---

## 7. Build & upload
```
# from sangam-pwa-v2/, with keystore.properties already set up (see ANDROID_SETUP / signing)
npm run build
npx cap sync android
cd android && ./gradlew bundleRelease
# -> android/app/build/outputs/bundle/release/app-release.aab
```
Play Console → **Testing → Internal testing → Create new release** → upload the `.aab` → fill release notes → **Review & roll out**.

---

## 8. Internal testing (today)
1. Testing → **Internal testing** → **Testers** → create an email list (add your own + early users).
2. Roll out the release.
3. Share the **opt-in URL** with testers; they tap it, accept, and install from Play within minutes.

## 9. Closed testing (start the 14-day clock)
1. Testing → **Closed testing** → create a track → add **≥12 tester emails** (a Google Group is easiest).
2. Upload the same AAB (or promote from Internal).
3. Send testers the opt-in link; confirm **all 12+ opt in** and **use the app** over **14 continuous days**.
4. After 14 days with engagement, Play Console will let you **apply for Production access**.

## 10. Production
Once closed-testing requirements are met: **Production → Create release** → upload/promote AAB → submit for
review → roll out (staged rollout recommended). Public download goes live after Google approves.

---

## Pre-submit checklist
- [ ] Privacy policy live at `https://enovoapp.com/privacy.html`
- [ ] App icon (512), feature graphic (1024×500), 2–8 screenshots
- [ ] Data Safety form completed & accurate
- [ ] Content rating questionnaire completed
- [ ] Test login provided under App access
- [ ] `assetlinks.json` SHA-256 updated from Play App Signing (for App Links) and hosting redeployed
- [ ] TURN server upgraded from the free tier (call reliability)
- [ ] Signed AAB uploaded to Internal testing
- [ ] 12+ testers opted into Closed testing (14-day clock started)
