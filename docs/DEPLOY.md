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

### SpacetimeAuth (optional Sign in / Save my progress)

Anonymous play always works. The map **Account** button shows guest / short player id / online-offline-saved. **Sign in / Save my progress** uses SpacetimeAuth (OIDC) + PKCE in the browser. The official SDK only accepts `.withToken(idToken)` — there is no extra official SPA login widget.

This is **off** until you create a client in the dashboard and set the env var. Until then the button explains that sign-in is not configured and guests keep playing.

### What to create in the SpacetimeDB dashboard

1. Open [https://spacetimedb.com](https://spacetimedb.com) and sign in.
2. Go to **SpacetimeAuth** (sometimes labeled Auth / OIDC).
3. **Create a project** (any name, e.g. `weltraum-mission`).
4. **Create a public client** (SPA / public client, **no client secret**):
   - Application type: Single-page app / public
   - Redirect URI: your live origin, e.g. `https://space-game-deploy.vercel.app/`
     (trailing slash must match; also add `http://localhost:5173/` for local Vite)
   - Post-logout redirect: same origins
   - Grant: Authorization Code + PKCE
   - Scopes: `openid profile email`
5. Copy the **Client ID**.

### Wire it into Vercel

In the Vercel project → Settings → Environment Variables (Production + Preview):

| Name | Value |
|------|--------|
| `VITE_SPACETIME_AUTH_CLIENT_ID` | the public client id from the dashboard |

Optional overrides (defaults are already correct):

- `VITE_SPACETIME_AUTH_ISSUER` = `https://auth.spacetimedb.com/oidc`
- `VITE_SPACETIME_AUTH_REDIRECT` = full redirect URL if it is not the site origin

Redeploy after adding the variable (`npm run build` reads Vite `VITE_*` at build time).

On first sign-in the client snapshots anonymous progress, reconnects with the OIDC token (new identity), and calls `importProgress` so coins / unlocks / ships merge (max, never wipe). Guests who never sign in keep the anonymous identity already stored in `localStorage`.

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
connect-src 'self' https://maincloud.spacetimedb.com wss://maincloud.spacetimedb.com https://auth.spacetimedb.com https://0.peerjs.com wss://0.peerjs.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
media-src 'self' data: blob:;
frame-ancestors 'none';
```
