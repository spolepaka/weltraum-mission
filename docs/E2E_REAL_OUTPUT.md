# Real E2E output (`npm run test:e2e:real`)

Production build against **Maincloud** `weltraum-mission` (`https://maincloud.spacetimedb.com`). Module was **not** republished.

```
> weltraum-mission@1.0.0 test:e2e:real
> node tools/run-e2e-real.mjs

[e2e] Maincloud target: https://maincloud.spacetimedb.com / weltraum-mission
[e2e] will NOT publish or modify the remote module
[e2e] building production game
dist/index.html                489.93 kB │ gzip: 136.70 kB
dist/assets/index-D9nowVXs.js  138.34 kB │ gzip:  37.96 kB
[e2e] preview is serving the bundled game (488234 bytes HTML)
[e2e] running Playwright suite

 RUN  v2.1.9 /workspace

 ✓ tests/e2e-real.test.ts (7 tests) 1669ms
   ✓ Real E2E: built game + SpacetimeDB > new anonymous player connects and stores an identity token 378ms
   ✓ Real E2E: built game + SpacetimeDB > completes level 1 via the real game flow and shows Progress saved
   ✓ Real E2E: built game + SpacetimeDB > reload keeps the same identity and unlocked progress 310ms
   ✓ Real E2E: built game + SpacetimeDB > refuses to start a locked level
   ✓ Real E2E: built game + SpacetimeDB > rejects a forged level result (absurd score/coins/time)
   ✓ Real E2E: built game + SpacetimeDB > getLevelData refuses locked levels and returns data for level 1
   ✓ Real E2E: built game + SpacetimeDB > host approval stand-in: pending join, approve, kick

 Test Files  1 passed (1)
      Tests  7 passed (7)

[e2e] real suite passed
```

Production CSP in `dist/index.html`:

```
connect-src 'self' https://maincloud.spacetimedb.com wss://maincloud.spacetimedb.com https://0.peerjs.com wss://0.peerjs.com
```

No `localhost` in the production policy.
