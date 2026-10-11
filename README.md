# Weltraum-Mission

A kid-friendly HTML5 space shooter for iPad and the web. English is the default; a map toggle switches to German. 100 levels across 7 sectors, 34 boss fights, a shop with 29 ships, local 2-player and online co-op (up to 5 via PeerJS), onboarding, optional parent Google / email-link sign-in, and a private `/admin` console.

Built for Joshi (9) and Amelia.

**Live:** [https://space-game-deploy.vercel.app](https://space-game-deploy.vercel.app)

## Docs

| Doc | What it is |
|---|---|
| **[docs/HANDOVER.md](docs/HANDOVER.md)** | Full handover: architecture, data model, auth, ops, PR history, known issues |
| **[docs/DEPLOY.md](docs/DEPLOY.md)** | Publish the SpacetimeDB module, Vercel env, Firebase, `/api/geo` |
| [docs/roadmap.md](docs/roadmap.md) | Longer-term “Path to AAA” plan |
| [docs/progress-log.md](docs/progress-log.md) | Single-file-era change log |
| [docs/levels-log.md](docs/levels-log.md) | Balance / bot results |
| [docs/onboarding/](docs/onboarding/) | Screenshots of the welcome / training / map tour |

## Quick start

```bash
git clone https://github.com/spolepaka/weltraum-mission && cd weltraum-mission
npm install
npm run dev                      # http://localhost:5173
npm test                         # unit + mock E2E (vitest)
npm run build && npm run preview # production Vite build
```

Local SpacetimeDB (optional):

```bash
npm run spacetime:start          # in-memory on :3000
npm run spacetime:publish:local  # publishes weltraum-dev
# then open
# http://localhost:5173/?server=ws://localhost:3000&stdb_module=weltraum-dev
```

Sign-in locally needs `VITE_FIREBASE_*` in a gitignored `.env.local`. See [docs/DEPLOY.md](docs/DEPLOY.md).

## How it is built

- **Client:** vanilla-JS game in `public/index.html`, Vite + TypeScript in `src/` (i18n, sync, names, auth, onboarding). Hosted on **Vercel** (`space-game-deploy`).
- **Game data:** SpacetimeDB TypeScript module `weltraum-mission` on **Maincloud**. Anonymous identity by default; Firebase ID token for parent accounts.
- **Online co-op:** PeerJS / WebRTC, room code, 2–5 players. No game server, no TURN.
- **Admin:** `/admin` (unlinked, own Vite entry). Access is a **server-side** Firebase email check (`sumankpolepaka@gmail.com`), never a client flag.
- **Geo:** `GET /api/geo` is a self-contained Vercel function. Truncated IP, 30-day retention. Best-effort and spoofable — see [docs/DEPLOY.md](docs/DEPLOY.md#apigeo-vercel-node-function).

## Tests

```bash
npm test                  # unit + mock E2E
npm run test:e2e:local    # Playwright against local SpacetimeDB (never Maincloud)
npm run test:firebase     # Auth emulator + CSP + WebKit
npm run spacetime:typecheck
```

`npm run test:e2e:real` refuses production Maincloud unless `E2E_ALLOW_PRODUCTION=1`.

## Stage Zero (done)

- [x] Import the game into the repo
- [x] English default + EN/DE toggle
- [x] SpacetimeDB anonymous identity + progress sync
- [x] Progressive / gated level delivery
- [x] Host approval, kick, auto-admit for online co-op
- [x] CSP / script hygiene
- [x] Error tracking
- [x] Firebase parent sign-in (first-party `/__/auth` proxy)
- [x] Difficulty modes, weekly challenge, first-party analytics
- [x] Admin panel + coin caps + co-op scaling

## License

Private repository — all rights reserved.
