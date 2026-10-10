# Weltraum-Mission

A single-player HTML5 canvas space shooter with German UI, designed for young players on iPad. Features 100 levels across 7 galactic sectors, boss battles, ship upgrades, achievements, local 2-player mode, online co-op (up to 5 players via PeerJS), and a ghost replay system.

## Live Demo

[https://space-game-deploy.vercel.app](https://space-game-deploy.vercel.app)

## Project Structure

```
weltraum-mission/
├── public/           # Static game files
│   └── index.html    # The complete game (v33, ~430KB)
├── server/           # SpacetimeDB backend module (Stage Zero)
├── src/              # Client source (after Vite restructure)
├── tools/            # Headless Chrome test scripts
│   ├── smoke.mjs     # Console error check at iPad sizes
│   ├── sim.mjs       # Balance bot for level tuning
│   └── ...           # Additional test utilities
├── docs/             # Documentation
│   ├── roadmap.md    # Path to AAA Quality (Stage Zero plan)
│   ├── progress-log.md
│   └── levels-log.md
└── tests/            # Unit and E2E tests
```

## Quick Start

### Play Locally

```bash
# Serve the static file
npx serve public

# Or with Python
cd public && python -m http.server 8080
```

### Run Tests

```bash
# Install dependencies
npm install

# Run smoke tests (requires Chrome)
node tools/smoke.mjs 9222 "$(pwd)/public/index.html" 1024 768
node tools/smoke.mjs 9223 "$(pwd)/public/index.html" 768 1024

# Run balance simulation
node tools/sim.mjs 9224 "$(pwd)/public/index.html" starter:1:1:0,0,0
```

## SpacetimeDB Backend (Stage Zero)

The backend provides:
- Anonymous player identity (connect without token, persist issued token)
- Progress sync (unlocked levels, stars, best scores, coins, ships, upgrades)
- Level gating validation (server validates before delivering level data)
- Secret code validation (applied server-side)
- Error tracking (client reports logged to a table)

### Local Development

```bash
# Install SpacetimeDB CLI
curl -fsSL https://spacetimedb.com/install.sh | bash

# Start local server
spacetime start

# Publish module (local)
cd server
spacetime publish --local weltraum-dev

# The client connects to ws://localhost:3000
```

### Publishing to Maincloud

```bash
# Login (creates account if needed)
spacetime login

# Publish to Maincloud Free tier
cd server
spacetime publish weltraum-mission

# Update client to use wss://maincloud.spacetimedb.com
```

## Features

### Gameplay
- 100 levels across 7 sectors (Heimat-Galaxie through Jenseits)
- Progressive difficulty with unique hazards per sector
- 15+ ships with different stats and abilities
- Shop with upgrades (fire rate, damage, shields, magnet, durability)
- Achievement system with unlockable color themes
- Daily missions for bonus coins
- Local 2-player mode
- Online co-op (2-5 players, PeerJS/WebRTC)
- Ghost replays of best runs

### Controls
- Touch: Drag to move, tap fire button
- Keyboard: Arrow keys + Space
- 2P mode: P1 left side, P2 right side

## Tech Stack

- **Client:** Pure HTML5 Canvas, vanilla JavaScript (single file origin)
- **Backend:** SpacetimeDB (Rust/TypeScript module)
- **Networking:** PeerJS for P2P co-op, SpacetimeDB for persistence
- **Hosting:** Vercel (static) + SpacetimeDB Maincloud

## Development

See [docs/roadmap.md](docs/roadmap.md) for the full development plan.

### Stage Zero Goals (Current)
- [x] Import existing game to repository
- [ ] English as default language + toggle
- [ ] SpacetimeDB anonymous identity + progress sync
- [ ] Progressive/gated content delivery
- [ ] Host approval for online co-op
- [ ] CSP / script hygiene
- [ ] Error tracking

## License

Private repository - all rights reserved.
