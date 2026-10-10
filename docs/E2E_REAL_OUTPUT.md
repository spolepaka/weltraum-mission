# Real E2E output (`npm run test:e2e:real`)

Captured against local `spacetime start --in-memory` + published `weltraum-dev` + `vite preview` of the production build. **Not published to Maincloud.**

```
> weltraum-mission@1.0.0 test:e2e:real
> node tools/run-e2e-real.mjs

[e2e] SpacetimeDB already listening on :3000
[e2e] building + publishing module to local server (not Maincloud)
Build finished successfully.
Updated database with name: weltraum-dev
[e2e] building game (Vercel output)
dist/index.html                489.99 kB │ gzip: 136.72 kB
dist/assets/index-Dpxwz8rR.js  137.29 kB │ gzip:  37.67 kB
[e2e] preview is serving the bundled game (488290 bytes HTML)
[e2e] running Playwright suite

 RUN  v2.1.9 /workspace

 ✓ tests/e2e-real.test.ts (7 tests) 1800ms
   ✓ Real E2E: built game + local SpacetimeDB > new anonymous player connects and stores an identity token
   ✓ Real E2E: built game + local SpacetimeDB > completes level 1 via the real game flow and shows Progress saved
   ✓ Real E2E: built game + local SpacetimeDB > reload keeps the same identity and unlocked progress
   ✓ Real E2E: built game + local SpacetimeDB > refuses to start a locked level
   ✓ Real E2E: built game + local SpacetimeDB > rejects a forged level result (absurd score/coins/time)
   ✓ Real E2E: built game + local SpacetimeDB > getLevelData refuses locked levels and returns data for level 1
   ✓ Real E2E: built game + local SpacetimeDB > host approval stand-in: pending join, approve, kick

 Test Files  1 passed (1)
      Tests  7 passed (7)

[e2e] real suite passed
```

## Smoke (gameplay regression)

```
{"state0":"map","planets":100,"L1":"play boss:false","L19":"play boss:false","L21":"play boss:false","L50":"play boss:false","L60":"play boss:false","L100":"play boss:false","heat":[1.89,1.8,2.23,2.75,1.8]} ISSUES []
{"state0":"map","planets":100,"L1":"play boss:false","L19":"play boss:false","L21":"play boss:false","L50":"play boss:false","L60":"play boss:false","L100":"play boss:false","heat":[1.89,1.8,2.23,2.75,1.8]} ISSUES []
```

1024×768 and 768×1024. Zero console issues.

## Unit tests

`npm test` → 60 passed (reducers, coop-security, validation, mocked e2e helpers).

`npx tsc --noEmit` → clean.

`npm run build` → `dist/index.html` 489 KB game + bundled `/assets/index-*.js` (SpacetimeDB SDK).
