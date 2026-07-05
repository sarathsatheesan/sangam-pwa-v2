# TURN Server Setup — fixing group calls (Metered.ca)

Group calls fail because the app currently falls back to a free public TURN
server (`openrelay.metered.ca`) that can't handle the mesh load. This wires in
a reliable provider. **Calls stay end-to-end encrypted** — TURN only relays
already-encrypted packets (WebRTC DTLS-SRTP); the relay never sees your
audio/video. We use `turns:` (TURN over TLS) for the relay control channel too.

The app code is already wired for this (`src/utils/iceConfig.ts`) — you only
need to add 3 values to `.env`, then rebuild.

---

## Step 1 — Create a free Metered.ca account
1. Go to **https://www.metered.ca/tools/openrelay/** → "Get started free" (or
   dashboard.metered.ca → sign up). Free tier ≈ 50 GB/month, no card required.
2. After sign-up you get an **app subdomain** (e.g. `yourapp.metered.live`) and
   **TURN credentials**.

## Step 2 — Copy your TURN credentials
In the Metered dashboard → **TURN Server** (or "Credentials"). You'll see:
- A **username** (long random string)
- A **credential / password** (long random string)
- A list of **server URLs** (stun/turn/turns on ports 80, 443, tcp)

Metered shows a ready-made `iceServers` array — you want the **turn:** and
**turns:** URLs and the username/credential from it.

## Step 3 — Put them in `.env` (on your Mac, project root)
Open `/Users/sarathsatheesan/ethniCity_03_19_2026/sangam-pwa-v2/.env` and fill
the three TURN lines. Use YOUR subdomain from Metered; keep the **turns: 443**
entry first for TLS-encrypted relay (best security + firewall-friendly):

```
VITE_TURN_URLS=turns:YOURSUBDOMAIN.metered.live:443?transport=tcp,turn:YOURSUBDOMAIN.metered.live:443,turn:YOURSUBDOMAIN.metered.live:80
VITE_TURN_USERNAME=your-metered-username
VITE_TURN_CREDENTIAL=your-metered-credential
```

Notes:
- `VITE_TURN_URLS` is **comma-separated, no spaces**. Include a `turns:` (TLS)
  entry — that's the encrypted relay channel.
- Replace `YOURSUBDOMAIN` with the exact host Metered gives you (it may be
  `global.relay.metered.ca` or `yourapp.metered.live` — copy it exactly).
- `.env` is gitignored — these never get committed. Keep them on your Mac.

## Step 4 — Rebuild & deploy (env vars are baked in at BUILD time)
```bash
cd /Users/sarathsatheesan/ethniCity_03_19_2026/sangam-pwa-v2
npm run ship        # test → build (reads new .env) → cap sync → deploy
# then Android Studio → Run ▶
```
⚠️ Vite inlines `import.meta.env.*` at build time, so you MUST rebuild after
editing `.env` — a plain redeploy of an old build won't pick it up.

## Step 5 — Verify it's active
Open the deployed app in Chrome → DevTools Console, start any call, and you
should NOT see `openrelay` anymore. To confirm the env vars loaded, in the
console: the ICE config now includes your `turns:` URL. Then test a real
2-person group call — audio/video should connect.

Optional deeper check: chrome://webrtc-internals during a call → the selected
ICE candidate pair should show a `relay` candidate from your Metered host when
a direct connection isn't possible.

---

## Security summary (why this stays fully encrypted)
- **Call media**: always DTLS-SRTP encrypted end-to-end between participants;
  keys are negotiated peer-to-peer and never shared with TURN. Metered relays
  ciphertext only.
- **Group calls (mesh)**: each participant pair has its own encrypted
  connection — no central server decrypts/re-mixes. More private than SFU.
- **`turns:` (TLS)**: encrypts the relay control channel too (belt & suspenders)
  and traverses strict/corporate firewalls that only allow 443.
- **Messages E2EE**: unaffected — a separate layer from call media.

## Later hardening (optional, not needed to fix group calls)
Static TURN credentials shipped in the client can be extracted and used to run
up your bandwidth bill (they still CANNOT decrypt calls). The hardened pattern
is short-lived credentials minted by a Cloud Function per call —
`src/utils/iceConfig.ts` `getIceServers()` is already stubbed for this upgrade.
Fine to defer until usage grows; set a budget alert on Metered in the meantime.
