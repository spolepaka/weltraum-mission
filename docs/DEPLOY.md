# Weltraum-Mission Deployment Guide

## SpacetimeDB Maincloud Deployment

### Prerequisites

1. **Install SpacetimeDB CLI**
   ```bash
   curl -fsSL https://install.spacetimedb.com | bash
   ```

2. **Login to Maincloud**
   ```bash
   spacetime login
   ```
   This will open a browser to authenticate with your SpacetimeDB account.

### Publishing to Maincloud

1. **Build the module**
   ```bash
   cd server/spacetimedb
   npm run build
   ```

2. **Publish to Maincloud**
   ```bash
   # First time (creates the database):
   spacetime publish weltraum-mission

   # Subsequent updates:
   spacetime publish weltraum-mission
   ```

   The module will be available at:
   - WebSocket: `wss://maincloud.spacetimedb.com`
   - Module name: `weltraum-mission`

### Firebase Auth (optional Parent: save progress)

Anonymous / guest SpacetimeDB play always works and stays the default. The map **Account** button shows guest / short player id / online-offline-saved. **Parent: save progress** / **Eltern: Fortschritt sichern** offers **Sign in with Google** and **Email link (passwordless)** via the Firebase JS modular SDK. After sign-in the official SpacetimeDB SDK connects with `.withToken(firebaseIdToken)`.

This is **off** until the Firebase env vars below are set. Until then the button explains that sign-in is not configured and guests keep playing.

Apple Sign-In is wired (`OAuthProvider('apple.com')`) but **off** unless `VITE_FIREBASE_APPLE_ENABLED=1`. Enable it later with config only (Firebase console + Apple developer + that flag).

**The SpacetimeDB module must be republished** after this change (issuer trust lives in `server/spacetimedb/src/auth-trust.ts`). The constant is already `weltraum-mission` to match the live Firebase project.

**This lazy-load / username / level-catalog batch also changes the module** (`levelData` is private and seeded with real payloads; `playerProfile` / `claimedName` / `setDisplayName`; ALLELEVEL still unlocks that identity only). Republish `weltraum-mission` before relying on gated `getLevelData` or server name checks in production. Do not publish from this agent.

Difficulty / weekly / analytics add `playerPrefs`, `weeklyScore`, `analyticsCounter`, `analyticsUnique`, plus `mode` on `completeLevelResult`. **Republish again** after that batch. Coin caps scale with Easy (0.75×) / Veteran (1.5×). Analytics are first-party counters only (no cookies, no PII); honor Account → Do not track.

Onboarding (welcome → Training flight → map tour) is stored in `spaceMissionOnboardV1` and copied onto local progress (`progress.onboard`) so a reload does not replay it. Account → Replay tutorial and the map **Training** button start the interactive flight again. Training never loses hearts. The secret code **ALLELEVEL** is unchanged (identity-only unlock to 100).

### Firebase project (already created)

- Project id: `weltraum-mission`
- Auth domain: `weltraum-mission.firebaseapp.com`
- Trusted issuer: `https://securetoken.google.com/weltraum-mission`
- Audience: `weltraum-mission`

`VITE_FIREBASE_*` is already set on Vercel (Production + Preview). Do not commit the web apiKey into the repo or tests.

### What to finish in the Firebase console

1. Confirm **Authentication → Sign-in method**:
   - **Google** enabled (support email + authorized domains: Vercel host and `localhost`)
   - **Email/Password** with **Email link (passwordless sign-in)** enabled
   - Apple: leave disabled until you are ready. Then enable Apple, add Services ID / key, and set `VITE_FIREBASE_APPLE_ENABLED=1`
2. **Authentication → Settings → Authorized domains**: production host (no scheme) plus `localhost`
3. `authDomain` `weltraum-mission.firebaseapp.com` is already allowed by CSP `frame-src` (`https://*.firebaseapp.com` / `https://*.web.app`)

### What to create in the SpacetimeDB dashboard

Firebase ID tokens are OIDC JWTs:

- Issuer: `https://securetoken.google.com/<projectId>`
- Audience: `<projectId>`

On the Maincloud database `weltraum-mission`, add that issuer as a trusted JWT / OpenID Connect identity provider (audience = `weltraum-mission`). Without this, `.withToken(firebaseIdToken)` is rejected at connect time.

Then **republish the module** so `assertTrustedCaller` (anonymous or our Firebase issuer only) is live.

### Wire it into Vercel

In the Vercel project → Settings → Environment Variables (Production + Preview):

| Name | Value |
|------|--------|
| `VITE_FIREBASE_API_KEY` | Firebase web `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase web `authDomain` (e.g. `weltraum-mission.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase `projectId` (must match the module constant) |
| `VITE_FIREBASE_APP_ID` | Firebase web `appId` |

Optional (only if the SDK / console shows them):

- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_APPLE_ENABLED` = `1` when Apple should appear
- `VITE_FIREBASE_AUTH_EMULATOR` = `http://127.0.0.1:9099` for local emulator tests only (never set in Vercel)

Redeploy after adding the variables (`npm run build` reads Vite `VITE_*` at build time).

On first sign-in the client snapshots anonymous progress, reconnects with the Firebase ID token (new identity: issuer+sub), and calls `importProgress` so coins / unlocks / ships merge (max, never wipe). Hourly token refresh uses `onIdTokenChanged` and a silent SpacetimeDB reconnect (no page reload, no second import, no double rewards). Sign-out restores the stored guest identity. Guests who never sign in keep the anonymous identity already stored in `localStorage`.

### Mobile / Capacitor (next steps, not in this change)

The web app uses `signInWithPopup` with a `signInWithRedirect` fallback for iPad Safari and an installed home-screen web app (`navigator.standalone` / `display-mode: standalone`).

For a later native Capacitor shell:

1. Add `@capacitor-firebase/authentication` and `@capacitor-firebase/app`.
2. Configure Google (iOS URL scheme / reversed client id, Android SHA-1) in the native projects. Apple later via the same plugin.
3. Keep this Firebase project. After native sign-in, still call SpacetimeDB `.withToken(firebaseIdToken)` and keep the module issuer rule unchanged.
4. Do not put Capacitor-only secrets in Vite `VITE_*` vars.

## Configuring the Client

The production build always defaults to Maincloud:

- Host: `maincloud.spacetimedb.com` (`wss://` + `https://`)
- Module: `weltraum-mission`
- Anonymous clients need no login token (the SDK stores the issued identity in `localStorage`)

Override for local / CI only:

**URL parameters**
- `?server=ws://localhost:3000` — host + scheme (module stays `weltraum-mission` unless also set)
- `?stdb_host=localhost:3000`
- `?stdb_module=weltraum-dev`
- `?stdb_ssl=false`

**Env (Vite)**
- `VITE_STDB_HOST` / `VITE_STDB_MODULE` / `VITE_STDB_SSL`
- or `STDB_HOST` / `STDB_MODULE` / `STDB_SSL`

**Example local development (Vite dev server, localhost allowed in CSP):**
```
http://localhost:5173/?server=ws://localhost:3000&stdb_module=weltraum-dev
```

## Local Development

### Running Local SpacetimeDB Server

1. **Start the server (in-memory mode)**
   ```bash
   spacetime start --in-memory
   ```
   The server runs on `http://localhost:3000`.

2. **Publish module to local server**
   ```bash
   cd server/spacetimedb
   npm run build
   spacetime publish --server http://localhost:3000 weltraum-dev
   ```

3. **Generate client bindings**
   ```bash
   cd /workspace
   spacetime generate --lang typescript --module-path ./server/spacetimedb --out-dir ./src/lib/module_bindings
   ```

### Running Tests

```bash
# Unit and mock E2E tests
npm test

# Smoke tests (headless Chrome)
node tools/smoke.mjs 9222 "$(pwd)/public/index.html" 1024 768
node tools/smoke.mjs 9223 "$(pwd)/public/index.html" 768 1024

# Real E2E against Maincloud + production build
npm run test:e2e:real

# Real E2E against a local in-memory server
npm run test:e2e:local
```

## Module Overview

### Reducers (Client-callable functions)

| Reducer | Description |
|---------|-------------|
| `setLanguage` | Set player's language preference |
| `syncProgress` | Sync unlocked level and equipped ship. **Does not SET coins** (avoids clobbering a just-earned bonus). |
| `syncLevelStars` | Sync level completion stars and best score |
| `completeLevelResult` | Submit level completion; **ADDs** `coinsEarned` after validation |
| `addCoins` | ADD coins (missions, offline catch-up). Never decreases. |
| `importProgress` | Merge anonymous → signed-in progress (max coins/unlocks, union ships) |
| `requestLevelData` | Validate player can access a level |
| `purchaseShip` | Purchase a ship with coins |
| `equipShip` | Equip an owned ship |
| `purchaseUpgrade` | Purchase an upgrade level |
| `setUpgradeLevel` | Set upgrade level (for sync) |
| `addOwnedShip` | Add a ship to owned list (for sync/codes) |
| `applySecretCode` | Apply a secret code for rewards |
| `unlockAchievement` | Record an achievement unlock |
| `updateSettings` | Update player settings |
| `reportError` | Report client-side errors |
| `resetProgress` | Reset all player progress |

### Procedures (Client-callable with return values)

| Procedure | Description |
|-----------|-------------|
| `getLevelData` | Get level data JSON (validates unlock status) |
| `getMyProgress` | Private snapshot of this identity (unlock, coins, ships) for reconcile |

### Tables

| Table | Public | Description |
|-------|--------|-------------|
| `player` | No | Player identity and language |
| `playerProgress` | No | Unlocked level and total score |
| `levelStars` | No | Per-level stars and best scores |
| `playerShop` | No | Coins and equipped ship |
| `ownedShip` | No | List of owned ships |
| `playerUpgrades` | No | Upgrade levels |
| `usedSecretCode` | No | Used secret codes |
| `playerSettings` | No | Game settings |
| `playerAchievements` | No | Unlocked achievements |
| `levelData` | No | Gated level payloads for levels 4–100 (`getLevelData`) |
| `playerProfile` | No | Kid-safe display name |
| `claimedName` | No | Unique-ish name claims |
| `errorReport` | No | Client error reports |
| `serverConfig` | Yes | Server configuration values |

## Anti-Cheat Validation

The server validates all submitted results:

- **Level bounds**: Must be 1-100
- **Score per level**: Max = level × 100,000
- **Coins per level**: Max = level × 5,000
- **Time bounds**: 3 seconds to 10 minutes (short wins and tests must not be rejected)
- **Level gating**: Can only complete unlocked levels
- **Ship validation**: Must be from valid ship list
- **Upgrade validation**: Max level 5 (1 for heart)

## Security Features

- **Anonymous identity**: Connect without account, server issues persistent identity
- **Progressive content**: Level data only delivered after unlock validation
- **Rate limiting**: Join attempts limited to 3 per minute
- **Host approval**: Off by default (the room code is the secret). Host can toggle “Ask before letting people in”, kick, or block anytime. Join attempts stay rate-limited (3 / minute).
- **Kick system**: Kicked players cannot rejoin
- **Display names**: Generated space names for guests. Custom 3–16 names only for signed-in parents; server rejects PII / profanity.
- **ALLELEVEL / ALLELEVELS**: Test unlock. Raises **that identity’s** `unlockedLevel` to 100 so `getLevelData` may return every payload for them. Other players stay gated. Same anti-cheat as normal play — do not treat it as a global unlock.

## Lazy loading

Levels **1–3** stay in the game HTML for instant / offline start. Levels **4–100** are fetched with the `getLevelData` procedure (unlocked only), then cached in `localStorage` (`spaceMissionLevelCacheV1`) for offline replay. The next unlocked remote level is prefetched on the map and after a win. Uncached locked / offline levels show a friendly message.

Firebase Auth and PeerJS load with `import()` only when Account opens (or a stored session exists) and when the Online menu opens.

## Online multiplayer / NAT

PeerJS uses the public broker (`0.peerjs.com` / `*.peerjs.com`) and Google STUN. There is **no TURN server** in this project. Strict school / hotel NATs can still fail after the handshake; a hosted TURN (e.g. coturn or a Twilio Network Traversal key) is the fallback if kids cannot connect across two networks.

**Handshake fix:** the guest used to send `hello` on channel `open` while the host still held the connection in `pendingConns` with no data handler. After Approve, `attachGuest` missed that hello, sent no `welcome`, and the guest hit the 6s `connection lost` watchdog. The host now sends `{ t: "ready" }` when the guest is attached; the guest re-sends `hello`. Auto-admit is the default so Approve is no longer on the happy path.

## Content Security Policy

Production (`vercel.json` + built `index.html`) does **not** allow localhost. Vite's dev server injects localhost into `connect-src` only while `npm run dev` is running.

`'unsafe-eval'` stays because the official SpacetimeDB TypeScript SDK builds BSATN deserializers with `new Function()` (`makeDeserializer`). Without it, `DbConnection.builder().build()` throws `EvalError` and the client never connects.

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://apis.google.com https://www.gstatic.com;
connect-src 'self' https://maincloud.spacetimedb.com wss://maincloud.spacetimedb.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com https://0.peerjs.com wss://0.peerjs.com https://*.peerjs.com wss://*.peerjs.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
media-src 'self' data: blob:;
frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://*.web.app;
frame-ancestors 'none';
```

Firebase Auth popup/redirect loads gapi from `https://apis.google.com/js/api.js` and helpers from `https://www.gstatic.com` — those must be in **script-src** (connect-src alone is not enough; missing them yields `auth/internal-error`). `connect-src` also allows Identity Toolkit, Secure Token, `www.googleapis.com`, and `apis.google.com`. `frame-src` covers the Google accounts popup/redirect iframe and the Firebase `authDomain` (`*.firebaseapp.com` / `*.web.app`, including `weltraum-mission.firebaseapp.com`).

