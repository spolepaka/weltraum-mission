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

### Configuring the Client

The client automatically connects to Maincloud by default. To override:

**URL Parameters:**
- `?stdb_host=localhost:3000` - Use local server
- `?stdb_module=weltraum-dev` - Use different module name
- `?stdb_ssl=false` - Disable SSL (for local dev)

**Example local development:**
```
http://localhost:5173/?stdb_host=localhost:3000&stdb_module=weltraum-dev&stdb_ssl=false
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

# Real E2E tests (requires running SpacetimeDB and dev server)
npm run dev &
npx vitest run tests/e2e-real.test.ts
```

## Module Overview

### Reducers (Client-callable functions)

| Reducer | Description |
|---------|-------------|
| `setLanguage` | Set player's language preference |
| `syncProgress` | Sync unlocked level, coins, equipped ship |
| `syncLevelStars` | Sync level completion stars and best score |
| `completeLevelResult` | Submit level completion with anti-cheat validation |
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
- **Time bounds**: 10 seconds to 10 minutes
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

The CSP header restricts script execution. `'unsafe-eval'` is required because the official SpacetimeDB TypeScript SDK builds deserializers with `new Function()`:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net;
connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://*.spacetimedb.com wss://*.spacetimedb.com https://0.peerjs.com wss://0.peerjs.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
media-src 'self' data: blob:;
frame-ancestors 'none';
```
