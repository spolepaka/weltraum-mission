/**
 * Real E2E against a running SpacetimeDB and the built game.
 * Default / CI: local `weltraum-dev` via `npm run test:e2e:local`.
 * Production Maincloud is blocked unless E2E_ALLOW_PRODUCTION=1.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const STDB_QS = process.env.E2E_STDB_QS ?? '';
const GAME_URL = STDB_QS ? `${BASE_URL}/?${STDB_QS}` : `${BASE_URL}/`;
const ALLOW_PROD = process.env.E2E_ALLOW_PRODUCTION === '1';
const EXPECT_HOST = process.env.E2E_EXPECT_HOST || (ALLOW_PROD ? 'maincloud.spacetimedb.com' : 'localhost:3000');
const EXPECT_MODULE = process.env.E2E_EXPECT_MODULE || (ALLOW_PROD ? 'weltraum-mission' : 'weltraum-dev');
if (EXPECT_HOST.includes('spacetimedb.com') && !ALLOW_PROD) {
  throw new Error('E2E refused to target production SpacetimeDB. Use test:e2e:local.');
}

let browser: Browser;

async function openFreshPage(): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE_ERR', msg.text());
  });
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    const w = window as unknown as {
      __spaceGame?: { forceFinish?: () => void; finishOnboard?: () => void };
      __weltraum?: { spacetime?: { isConnected: () => boolean } };
    };
    return !!(w.__spaceGame && w.__weltraum && w.__weltraum.spacetime && w.__weltraum.spacetime.isConnected());
  }, { timeout: 20000 });
  await page.evaluate(() => {
    const w = window as unknown as { __spaceGame?: { finishOnboard?: () => void } };
    w.__spaceGame?.finishOnboard?.();
  });
  return { context, page };
}

beforeAll(async () => {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}, 30000);

afterAll(async () => {
  if (browser) await browser.close();
});

describe('Real E2E: built game + SpacetimeDB', { timeout: 45000 }, () => {

  it('new anonymous player connects and stores an identity token', async () => {
    const { context, page } = await openFreshPage();
    const token = await page.evaluate(() => localStorage.getItem('spaceMissionIdentityToken'));
    const identity = await page.evaluate(() => {
      const w = window as unknown as { __weltraum?: { spacetime?: { getIdentityHex: () => string | null } } };
      return w.__weltraum?.spacetime?.getIdentityHex() ?? null;
    });
    const config = await page.evaluate(() => {
      const w = window as unknown as { __weltraum?: { spacetime?: { getConfig: () => { host: string; moduleName: string; ssl: boolean } } } };
      return w.__weltraum?.spacetime?.getConfig() ?? null;
    });
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token!.length).toBeGreaterThan(10);
    expect(identity).toBeTruthy();
    expect(identity!.length).toBeGreaterThan(8);
    expect(config?.host).toBe(EXPECT_HOST);
    expect(config?.moduleName).toBe(EXPECT_MODULE);
    await context.close();
  });

  it('completes level 1 via the real game flow and shows Progress saved', async () => {
    const { context, page } = await openFreshPage();
    await page.evaluate(() => {
      const w = window as unknown as { __spaceGame?: { forceFinish: () => void } };
      w.__spaceGame!.forceFinish();
    });
    await page.waitForFunction(() => {
      const el = document.getElementById('syncStatus');
      return !!(el && /Progress saved/i.test(el.textContent || ''));
    }, { timeout: 15000 });
    const progress = await page.evaluate(() => {
      const w = window as unknown as { __spaceGame?: { progress: () => { unlocked: number } } };
      return w.__spaceGame!.progress();
    });
    expect(progress.unlocked).toBeGreaterThanOrEqual(2);
    await context.close();
  });

  it('reload keeps the same identity and unlocked progress', async () => {
    const { context, page } = await openFreshPage();
    await page.evaluate(() => {
      const w = window as unknown as { __spaceGame?: { forceFinish: () => void } };
      w.__spaceGame!.forceFinish();
    });
    await page.waitForFunction(() => {
      const el = document.getElementById('syncStatus');
      return !!(el && /Progress saved/i.test(el.textContent || ''));
    }, { timeout: 15000 });

    const before = await page.evaluate(() => {
      const w = window as unknown as {
        __weltraum?: { spacetime?: { getIdentityHex: () => string | null } };
        __spaceGame?: { progress: () => { unlocked: number } };
      };
      return {
        token: localStorage.getItem('spaceMissionIdentityToken'),
        identity: w.__weltraum!.spacetime!.getIdentityHex(),
        unlocked: w.__spaceGame!.progress().unlocked,
      };
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const w = window as unknown as { __weltraum?: { spacetime?: { isConnected: () => boolean } } };
      return w.__weltraum?.spacetime?.isConnected() === true;
    }, { timeout: 20000 });

    const after = await page.evaluate(() => {
      const w = window as unknown as {
        __weltraum?: { spacetime?: { getIdentityHex: () => string | null } };
        __spaceGame?: { progress: () => { unlocked: number } };
      };
      return {
        token: localStorage.getItem('spaceMissionIdentityToken'),
        identity: w.__weltraum!.spacetime!.getIdentityHex(),
        unlocked: w.__spaceGame!.progress().unlocked,
      };
    });

    expect(after.token).toBe(before.token);
    expect(after.identity).toBe(before.identity);
    expect(after.unlocked).toBe(before.unlocked);
    expect(after.unlocked).toBeGreaterThanOrEqual(2);
    await context.close();
  });

  it('refuses to start a locked level', async () => {
    const { context, page } = await openFreshPage();
    const result = await page.evaluate(() => {
      const w = window as unknown as { __spaceGame?: { tryStartLevel: (n: number) => boolean; progress: () => { unlocked: number } } };
      return {
        started: w.__spaceGame!.tryStartLevel(10),
        unlocked: w.__spaceGame!.progress().unlocked,
      };
    });
    expect(result.unlocked).toBe(1);
    expect(result.started).toBe(false);
    await context.close();
  });

  it('rejects a forged level result (absurd score/coins/time)', async () => {
    const { context, page } = await openFreshPage();
    const result = await page.evaluate(async () => {
      const w = window as unknown as {
        __weltraum?: {
          spacetime?: {
            completeLevelResult: (r: {
              level: number; stars: number; score: bigint; coinsEarned: bigint; timeMs: bigint; heartsLeft: number;
            }) => Promise<{ ok: boolean; reason?: string }>;
            getLocalData: () => { unlockedLevel: number; coins: bigint };
            lastError: string | null;
          };
        };
      };
      const out = await w.__weltraum!.spacetime!.completeLevelResult({
        level: 99,
        stars: 3,
        score: BigInt(99999999),
        coinsEarned: BigInt(99999999),
        timeMs: BigInt(1000),
        heartsLeft: 3,
      });
      const data = w.__weltraum!.spacetime!.getLocalData();
      return {
        ok: out.ok,
        reason: out.reason || w.__weltraum!.spacetime!.lastError,
        unlocked: data.unlockedLevel,
        coins: data.coins.toString(),
      };
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(result.unlocked).toBe(1);
    expect(result.coins).toBe('0');
    await context.close();
  });

  it('getLevelData refuses locked levels and returns data for level 1', async () => {
    const { context, page } = await openFreshPage();
    const result = await page.evaluate(async () => {
      const w = window as unknown as {
        __weltraum?: {
          spacetime?: {
            fetchLevelData: (n: number) => Promise<{ level: number; dataJson: string } | null>;
            lastError: string | null;
          };
        };
      };
      const locked = await w.__weltraum!.spacetime!.fetchLevelData(10);
      const open = await w.__weltraum!.spacetime!.fetchLevelData(1);
      return {
        locked,
        open,
        lastError: w.__weltraum!.spacetime!.lastError,
      };
    });
    expect(result.locked).toBeNull();
    expect(result.open).toBeTruthy();
    expect(result.open!.level).toBe(1);
    await context.close();
  });

  it('level coins persist after map return and reload', async () => {
    const { context, page } = await openFreshPage();
    const before = await page.evaluate(() => {
      const w = window as unknown as { __spaceGame?: { shop: () => { coins: number } } };
      return w.__spaceGame!.shop().coins;
    });
    await page.evaluate(() => {
      const w = window as unknown as {
        __spaceGame?: {
          addCoins: (n: number) => void;
          forceFinish: (opts?: { skipCelebrate?: boolean }) => void;
        };
      };
      w.__spaceGame!.addCoins(25);
      w.__spaceGame!.forceFinish({ skipCelebrate: true });
    });
    await page.waitForFunction(() => !document.getElementById('winScreen')?.classList.contains('hidden'), { timeout: 8000 });
    const afterWin = await page.evaluate(() => {
      const w = window as unknown as { __spaceGame?: { shop: () => { coins: number } } };
      return w.__spaceGame!.shop().coins;
    });
    expect(afterWin).toBeGreaterThan(before);
    await page.locator('#winNext').click();
    await page.waitForTimeout(300);
    const onMap = await page.evaluate(() => {
      const w = window as unknown as { __spaceGame?: { shop: () => { coins: number } } };
      return w.__spaceGame!.shop().coins;
    });
    expect(onMap).toBe(afterWin);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const w = window as unknown as { __spaceGame?: { shop: () => { coins: number } } };
      return !!w.__spaceGame?.shop;
    }, { timeout: 20000 });
    const afterReload = await page.evaluate(() => {
      const w = window as unknown as { __spaceGame?: { shop: () => { coins: number } } };
      return w.__spaceGame!.shop().coins;
    });
    expect(afterReload).toBeGreaterThanOrEqual(afterWin);
    await context.close();
  });

  it('host approval stand-in: pending join, approve, kick', async () => {
    const { context, page } = await openFreshPage();
    const result = await page.evaluate(() => {
      const w = window as unknown as {
        __spaceGame?: {
          coop?: {
            reset: () => void;
            requestJoin: (id: string) => boolean;
            pending: () => Array<{ peerId: string; status: string }>;
            approve: (id: string) => boolean;
            kick: (id: string) => void;
            isApproved: (id: string) => boolean;
            isKicked: (id: string) => boolean;
          };
        };
        __weltraum?: { coop?: { resetCoopSecurity: () => void } };
      };
      if (w.__weltraum?.coop?.resetCoopSecurity) w.__weltraum.coop.resetCoopSecurity();
      const coop = w.__spaceGame!.coop!;
      const auto = coop.requestJoin('guest-auto');
      coop.reset();
      const wel = w.__weltraum!.coop as { setHostApprovalRequired?: (on: boolean) => void };
      if (wel.setHostApprovalRequired) wel.setHostApprovalRequired(true);
      const first = coop.requestJoin('guest-standin');
      const pending = coop.pending();
      const approved = coop.approve('guest-standin');
      const isApproved = coop.isApproved('guest-standin');
      coop.kick('guest-standin');
      return {
        autoAdmitted: auto,
        firstImmediate: first,
        pendingCount: pending.length,
        pendingId: pending[0] && pending[0].peerId,
        approved,
        isApproved,
        kicked: coop.isKicked('guest-standin'),
        rejoin: coop.requestJoin('guest-standin'),
      };
    });
    expect(result.autoAdmitted).toBe(true);
    expect(result.firstImmediate).toBe(false);
    expect(result.pendingCount).toBe(1);
    expect(result.pendingId).toBe('guest-standin');
    expect(result.approved).toBe(true);
    expect(result.isApproved).toBe(true);
    expect(result.kicked).toBe(true);
    expect(result.rejoin).toBe(false);
    await context.close();
  });
});

describe('Lazy levels: returning-player edges', { timeout: 45000 }, () => {
  it('(a) legacy localStorage unlock 20 with no server row can start', async () => {
    const { context, page } = await openFreshPage();
    const out = await page.evaluate(async () => {
      const w = window as unknown as {
        __spaceGame?: { unlockTo: (n: number) => void; tryStartLevel: (n: number) => boolean; simInfo: () => { state: string; level: number } };
        __weltraum?: { spacetime?: { getLocalData: () => { unlockedLevel: number }; syncProgress: (u: number, c: bigint, s: string) => void } };
      };
      w.__spaceGame!.unlockTo(20);
      w.__weltraum!.spacetime!.syncProgress(20, 0n, 'starter');
      const started = w.__spaceGame!.tryStartLevel(20);
      await new Promise((r) => setTimeout(r, 600));
      const info = w.__spaceGame!.simInfo();
      const msg = document.getElementById('msg')?.textContent || '';
      return { started, state: info.state, level: info.level, msg, unlocked: w.__weltraum!.spacetime!.getLocalData().unlockedLevel };
    });
    expect(out.started).toBe(true);
    expect(out.msg).not.toMatch(/not saved on this iPad|auf diesem iPad noch nicht/i);
    expect(out.unlocked).toBeGreaterThanOrEqual(20);
    await context.close();
  });

  it('(b) imported guest progress at 12 is playable on a new identity', async () => {
    const { context, page } = await openFreshPage();
    const out = await page.evaluate(async () => {
      const w = window as unknown as {
        __spaceGame?: { unlockTo: (n: number) => void; tryStartLevel: (n: number) => boolean };
        __weltraum?: { spacetime?: { importProgress: (s: { unlockedLevel: number; coins: number; equippedShip: string; ownedShips: string[]; upgrades: Record<string, number>; stars: Record<string, number>; best: Record<string, number>; language: string }) => void } };
      };
      w.__spaceGame!.unlockTo(12);
      w.__weltraum!.spacetime!.importProgress({
        unlockedLevel: 12, coins: 40, equippedShip: 'starter', ownedShips: ['starter'],
        upgrades: {}, stars: {}, best: {}, language: 'en',
      });
      const started = w.__spaceGame!.tryStartLevel(12);
      await new Promise((r) => setTimeout(r, 500));
      const msg = document.getElementById('msg')?.textContent || '';
      return { started, msg };
    });
    expect(out.started).toBe(true);
    expect(out.msg).not.toMatch(/not saved on this iPad|auf diesem iPad noch nicht/i);
    await context.close();
  });

  it('(d) ALLELEVEL unlocks distant levels for this identity', async () => {
    const { context, page } = await openFreshPage();
    const out = await page.evaluate(async () => {
      const w = window as unknown as {
        __spaceGame?: { tryStartLevel: (n: number) => boolean; unlockTo: (n: number) => void };
        __weltraum?: { onSecretCode: (c: string) => { success: boolean }; spacetime?: { getLocalData: () => { unlockedLevel: number } } };
      };
      w.__weltraum!.onSecretCode('ALLELEVEL');
      w.__spaceGame!.unlockTo(100);
      await new Promise((r) => setTimeout(r, 400));
      const started = w.__spaceGame!.tryStartLevel(40);
      await new Promise((r) => setTimeout(r, 500));
      const msg = document.getElementById('msg')?.textContent || '';
      return { started, msg };
    });
    expect(out.started).toBe(true);
    expect(out.msg).not.toMatch(/not saved on this iPad|auf diesem iPad noch nicht/i);
    await context.close();
  });

  it('(e) offline with cache starts the cached level', async () => {
    const { context, page } = await openFreshPage();
    const out = await page.evaluate(async () => {
      const w = window as unknown as {
        __spaceGame?: { unlockTo: (n: number) => void; tryStartLevel: (n: number) => boolean };
        __weltraum?: { levels?: { ensure: (l: number, u: number) => Promise<unknown> } };
      };
      w.__spaceGame!.unlockTo(8);
      await w.__weltraum!.levels!.ensure(8, 8);
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      const started = w.__spaceGame!.tryStartLevel(8);
      await new Promise((r) => setTimeout(r, 300));
      const msg = document.getElementById('msg')?.textContent || '';
      return { started, msg };
    });
    expect(out.started).toBe(true);
    expect(out.msg).not.toMatch(/not saved on this iPad|auf diesem iPad noch nicht/i);
    await context.close();
  });

  it('(f) offline without cache shows the friendly offline line', async () => {
    const { context, page } = await openFreshPage();
    const out = await page.evaluate(async () => {
      const w = window as unknown as {
        __spaceGame?: { unlockTo: (n: number) => void; tryStartLevel: (n: number) => boolean };
        __weltraum?: { levels?: { ensure: (l: number, u: number) => Promise<unknown>; cached: (l: number) => unknown } };
      };
      w.__spaceGame!.unlockTo(9);
      if (w.__weltraum?.levels) {
        w.__weltraum.levels.ensure = async () => null;
        w.__weltraum.levels.cached = () => null;
      }
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      w.__spaceGame!.tryStartLevel(9);
      await new Promise((r) => setTimeout(r, 400));
      return document.getElementById('msg')?.textContent || '';
    });
    expect(out).toMatch(/not saved on this iPad|auf diesem iPad noch nicht|Connect to the internet|online gehen/i);
    await context.close();
  });

  it('(h) slow fetch shows loading, not the offline error', async () => {
    const { context, page } = await openFreshPage();
    const out = await page.evaluate(async () => {
      const w = window as unknown as {
        __spaceGame?: { unlockTo: (n: number) => void; tryStartLevel: (n: number) => boolean };
        __weltraum?: { levels?: { ensure: (l: number, u: number) => Promise<unknown>; cached: (l: number) => unknown } };
      };
      w.__spaceGame!.unlockTo(7);
      if (w.__weltraum?.levels) {
        w.__weltraum.levels.cached = () => null;
        w.__weltraum.levels.ensure = () => new Promise((resolve) => {
          setTimeout(() => resolve({ level: 7, feats: {} }), 900);
        });
      }
      w.__spaceGame!.tryStartLevel(7);
      const during = document.getElementById('msg')?.textContent || '';
      await new Promise((r) => setTimeout(r, 200));
      const mid = document.getElementById('msg')?.textContent || '';
      return { during, mid };
    });
    expect(`${out.during} ${out.mid}`).toMatch(/Loading level|Lade Level/i);
    expect(`${out.during} ${out.mid}`).not.toMatch(/not saved on this iPad|auf diesem iPad noch nicht/i);
    await context.close();
  });

  it('(c) second context with the same identity can play the unlocked level', async () => {
    const { context, page } = await openFreshPage();
    const token = await page.evaluate(async () => {
      const w = window as unknown as {
        __spaceGame?: { unlockTo: (n: number) => void };
        __weltraum?: { spacetime?: { syncProgress: (u: number, c: bigint, s: string) => void; getIdentityToken: () => string | null } };
      };
      w.__spaceGame!.unlockTo(5);
      w.__weltraum!.spacetime!.syncProgress(5, 0n, 'starter');
      return w.__weltraum!.spacetime!.getIdentityToken();
    });
    expect(token).toBeTruthy();
    const savedToken = token as string;
    const ctx2 = await browser.newContext();
    await ctx2.addInitScript((tok) => {
      localStorage.setItem('spaceMissionIdentityToken', tok);
      localStorage.setItem('spaceMissionProgress', JSON.stringify({ unlocked: 5, stars: {}, best: {} }));
    }, savedToken);
    const page2 = await ctx2.newPage();
    await page2.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForFunction(() => {
      const w = window as unknown as { __weltraum?: { spacetime?: { isConnected: () => boolean } }; __spaceGame?: { finishOnboard?: () => void } };
      return !!(w.__spaceGame && w.__weltraum?.spacetime?.isConnected());
    }, { timeout: 20000 });
    await page2.evaluate(() => {
      const w = window as unknown as { __spaceGame?: { finishOnboard?: () => void } };
      w.__spaceGame?.finishOnboard?.();
    });
    const out = await page2.evaluate(async () => {
      const w = window as unknown as { __spaceGame?: { tryStartLevel: (n: number) => boolean; progress: () => { unlocked: number } } };
      const started = w.__spaceGame!.tryStartLevel(5);
      await new Promise((r) => setTimeout(r, 500));
      const msg = document.getElementById('msg')?.textContent || '';
      return { started, unlocked: w.__spaceGame!.progress().unlocked, msg };
    });
    expect(out.started).toBe(true);
    expect(out.msg).not.toMatch(/not saved on this iPad|auf diesem iPad noch nicht/i);
    await ctx2.close();
    await context.close();
  });

  it('refuses getLevelData for an inflated claim on a normal account', async () => {
    const { context, page } = await openFreshPage();
    const out = await page.evaluate(async () => {
      const w = window as unknown as {
        __weltraum?: {
          spacetime?: {
            fetchLevelData: (n: number) => Promise<{ level: number; dataJson: string } | null>;
            fetchMyProgress: () => Promise<{ unlockedLevel: number } | null>;
          };
        };
      };
      const locked = await w.__weltraum!.spacetime!.fetchLevelData(50);
      const remote = await w.__weltraum!.spacetime!.fetchMyProgress();
      return { locked, unlocked: remote?.unlockedLevel ?? 0 };
    });
    expect(out.locked).toBeNull();
    expect(out.unlocked).toBe(1);
    await context.close();
  });

  it('rejects a second legacy import for the same identity', async () => {
    const { context, page } = await openFreshPage();
    const out = await page.evaluate(async () => {
      const w = window as unknown as {
        __spaceGame?: { unlockTo: (n: number) => void };
        __weltraum?: {
          spacetime?: {
            legacyImport: (s: {
              unlockedLevel: number; coins: number; equippedShip: string; ownedShips: string[];
              upgrades: Record<string, number>; stars: Record<string, number>; best: Record<string, number>; language: string;
            }) => Promise<{ ok: boolean; reason?: string }>;
            fetchMyProgress: () => Promise<{ unlockedLevel: number } | null>;
          };
        };
      };
      const stars: Record<string, number> = { '1': 2, '2': 2, '3': 2, '4': 2 };
      w.__spaceGame!.unlockTo(5);
      const first = await w.__weltraum!.spacetime!.legacyImport({
        unlockedLevel: 5, coins: 40, equippedShip: 'starter', ownedShips: ['starter'],
        upgrades: {}, stars, best: {}, language: 'en',
      });
      const second = await w.__weltraum!.spacetime!.legacyImport({
        unlockedLevel: 40, coins: 40, equippedShip: 'starter', ownedShips: ['starter'],
        upgrades: {}, stars, best: {}, language: 'en',
      });
      const remote = await w.__weltraum!.spacetime!.fetchMyProgress();
      return { first, second, unlocked: remote?.unlockedLevel ?? 0 };
    });
    expect(out.first.ok).toBe(true);
    expect(out.second.ok).toBe(false);
    expect(out.second.reason).toBeTruthy();
    expect(out.unlocked).toBeLessThan(40);
    expect(out.unlocked).toBeGreaterThanOrEqual(5);
    await context.close();
  });

  it('owner-like signed-in local-ahead imports once and unlocks getLevelData', async () => {
    const { context, page } = await openFreshPage();
    const out = await page.evaluate(async () => {
      const w = window as unknown as {
        __spaceGame?: { unlockTo: (n: number) => void };
        __weltraum?: {
          spacetime?: {
            legacyImport: (s: {
              unlockedLevel: number; coins: number; equippedShip: string; ownedShips: string[];
              upgrades: Record<string, number>; stars: Record<string, number>; best: Record<string, number>; language: string;
            }) => Promise<{ ok: boolean; reason?: string }>;
            fetchLevelData: (n: number) => Promise<{ level: number; dataJson: string } | null>;
            fetchMyProgress: () => Promise<{ unlockedLevel: number; legacyImported?: boolean } | null>;
          };
        };
      };
      const stars: Record<string, number> = {};
      for (let i = 1; i <= 19; i++) stars[String(i)] = 2;
      w.__spaceGame!.unlockTo(20);
      const imported = await w.__weltraum!.spacetime!.legacyImport({
        unlockedLevel: 20, coins: 400, equippedShip: 'starter', ownedShips: ['starter'],
        upgrades: {}, stars, best: {}, language: 'en',
      });
      const row = await w.__weltraum!.spacetime!.fetchLevelData(20);
      const remote = await w.__weltraum!.spacetime!.fetchMyProgress();
      return {
        imported,
        level: row?.level ?? null,
        unlocked: remote?.unlockedLevel ?? 0,
        legacyImported: remote?.legacyImported,
      };
    });
    expect(out.imported.ok).toBe(true);
    expect(out.level).toBe(20);
    expect(out.unlocked).toBeGreaterThanOrEqual(20);
    expect(out.legacyImported).toBe(true);
    await context.close();
  });

  it('(g) token-refresh reconnect still starts an unlocked level', async () => {
    const { context, page } = await openFreshPage();
    const out = await page.evaluate(async () => {
      const w = window as unknown as {
        __spaceGame?: { unlockTo: (n: number) => void; tryStartLevel: (n: number) => boolean };
        __weltraum?: { spacetime?: { getIdentityToken: () => string | null; reconnectWithToken: (t: string) => Promise<boolean> } };
      };
      w.__spaceGame!.unlockTo(6);
      const token = w.__weltraum!.spacetime!.getIdentityToken();
      if (token) await w.__weltraum!.spacetime!.reconnectWithToken(token);
      const started = w.__spaceGame!.tryStartLevel(6);
      await new Promise((r) => setTimeout(r, 500));
      const msg = document.getElementById('msg')?.textContent || '';
      return { started, msg };
    });
    expect(out.started).toBe(true);
    expect(out.msg).not.toMatch(/not saved on this iPad|auf diesem iPad noch nicht/i);
    await context.close();
  });
});
