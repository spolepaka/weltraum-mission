# Space Game: Path to AAA Quality, Performance, Security, and Growth
## Including Stage Zero Pre-Launch Readiness (SpacetimeDB from Day One)

**Document Version:** 3.4  
**Date:** October 10, 2026  
**Target Game:** [Weltraum-Mission](https://space-game-deploy.vercel.app/)  
**Purpose:** Unified roadmap from immediate public launch (Stage Zero on SpacetimeDB) through AAA-capable quality, performance, security, and growth. Stage Zero uses SpacetimeDB directly for architectural consistency.

---

## Executive Summary

**North-star goal:** AAA-capable web/iPad/mobile space shooter.

**Immediate objective:** Announce on X soon with reliable progress, English default, progressive content, and basic safety.

**Path:**
1. **Stage Zero** — SpacetimeDB (Maincloud Free) for anonymous identity, progress sync, and gated content.  
2. Short extraction/safety refinements if needed.  
3. Direct expansion to full authoritative rooms + client-side prediction + PIXI.js.  
4. AAA polish, growth, PWA + Capacitor (backend unchanged).

---

## SpacetimeDB in Stage Zero

### Auth
- **Anonymous first:** Client connects without token → SpacetimeDB issues identity + token. Persist token locally. No signup wall.
- **Upgrade path:** SpacetimeAuth (magic link, Google, etc.) or external OIDC (Clerk/Auth0). Token is passed to the SpacetimeDB connection; identity can be linked or progress migrated.
- Authorization logic lives in reducers via auth claims.

### Pricing & Hosting
- **Maincloud Free:** $0, ~2,500 TeV/month (~3M reducer calls). Sufficient for Stage Zero and early users. Auto-scales to zero; pauses after inactivity.
- **Pro:** $25/mo for higher limits, backups, no auto-pause.
- **Self-hosted:** Available via Docker/CLI if desired later.
- **Recommendation:** Start on Maincloud Free. Publish with `spacetime publish`.

### Stage Zero Scope on SpacetimeDB
- Tables/reducers for player progress, unlocks, and level gating.
- Client fetches next level only after progress validation.
- Host approval / room controls as needed.
- English default + simple toggle.
- Visible save indicator + error tracking.

Progress schema and identities are native to SpacetimeDB, so later multiplayer rooms and prediction require no migration.

---

## Stage Zero Priorities (P0)
- English default + language toggle
- Anonymous SpacetimeDB identity + progress sync
- Progressive/gated content delivery
- Host approval or public-room lockdown
- Basic CSP / script hygiene
- Auto-save + visible “Progress saved” indicator
- Error tracking

P1: SpacetimeAuth/Google upgrade, background preload, analytics, PWA.

---

## Long-Term (Post-Stage Zero)
Same SpacetimeDB instance expands to full rooms, authoritative simulation, client-side prediction, PIXI.js renderer, seeded RNG, shareable ghosts, leaderboards, and Capacitor mobile builds. No backend fork.

---

## Sequence
1. Stage Zero on SpacetimeDB Maincloud Free (anonymous + progress + gating).  
2. Announce.  
3. Expand to prediction + PIXI + full multiplayer polish.  
4. Growth systems and mobile packaging.

---

## Risks & Mitigations
- Free-tier pause on inactivity → Acceptable for early stage; upgrade to Pro if needed.
- Auth complexity → Anonymous first; SpacetimeAuth as fast follow.
- Scope creep → Strict Stage Zero limit (no full rooms/prediction before announcement).

---

## Conclusion
Stage Zero now runs directly on SpacetimeDB for consistency with the AAA architecture. Anonymous identity + Maincloud Free enables a fast, low-cost launch. The same backend grows into full authoritative multiplayer, prediction, and mobile without migration.

**Next step:** Implement Stage Zero P0 on SpacetimeDB Maincloud Free.

---

*Version 3.4: Stage Zero uses SpacetimeDB directly (Maincloud Free, anonymous-first auth).*
