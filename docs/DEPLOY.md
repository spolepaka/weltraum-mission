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

**The SpacetimeDB module must be republished** after this change (issuer trust lives in `server/spacetimedb/src/auth-trust.ts`). Change `FIREBASE_PROJECT_ID` there if the Firebase project id is not `weltraum-mission`, then republish again.

### What to create in the Firebase console

1. Open [https://console.firebase.google.com](https://console.firebase.google.com) and create a project. Preferred project id: `weltraum-mission` (must match `FIREBASE_PROJECT_ID` in `server/spacetimedb/src/auth-trust.ts`).
2. Add a **Web** app. Copy the config values (`apiKey`, `authDomain`, `projectId`, `appId`; optional `messagingSenderId`, `storageBucket`).
3. **Authentication → Sign-in method**:
   - Enable **Google**. Set a support email. Add the production authorized domain (Vercel host) and `localhost`.
   - Enable **Email/Password** and turn on **Email link (passwordless sign-in)**.
   - Apple: leave disabled until you are ready. Then enable Apple, add Services ID / key, and set `VITE_FIREBASE_APPLE_ENABLED=1`.
4. **Authentication → Settings → Authorized domains**: your Vercel origin (no scheme), plus `localhost`.
5. Authorized auth domain (`authDomain`) is typically `<projectId>.firebaseapp.com`. That host must stay in CSP `frame-src` (this repo already allows `https://*.firebaseapp.com` and `https://*.web.app`).

### What to create in the SpacetimeDB dashboard

Firebase ID tokens are OIDC JWTs:

- Issuer: `https://securetoken.google.com/<projectId>`
- Audience: `<projectId>`

On the Maincloud database `weltraum-mission`, add that issuer as a trusted JWT / OpenID Connect identity provider (audience = the Firebase project id). Without this, `.withToken(firebaseIdToken)` is rejected at connect time.

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
| `levelData` | Yes | Level definitions (progressive delivery) |
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
- **Host approval**: Room host must approve each guest
- **Kick system**: Kicked players cannot rejoin

## Content Security Policy

Production (`vercel.json` + built `index.html`) does **not** allow localhost. Vite's dev server injects localhost into `connect-src` only while `npm run dev` is running.

`'unsafe-eval'` stays because the official SpacetimeDB TypeScript SDK builds BSATN deserializers with `new Function()` (`makeDeserializer`). Without it, `DbConnection.builder().build()` throws `EvalError` and the client never connects.

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net;
connect-src 'self' https://maincloud.spacetimedb.com wss://maincloud.spacetimedb.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com https://0.peerjs.com wss://0.peerjs.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
media-src 'self' data: blob:;
frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://*.web.app;
frame-ancestors 'none';
```

`connect-src` includes Identity Toolkit (sign-in), Secure Token (hourly refresh), and `apis.google.com`. `frame-src` covers the Google popup/redirect iframe and the Firebase `authDomain` (`*.firebaseapp.com` / `*.web.app`).

