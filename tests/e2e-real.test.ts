/**
 * Real E2E against a running SpacetimeDB and the built game.
 * Default: production build → Maincloud `weltraum-mission` (no query override).
 * Local: `E2E_STDB_QS=stdb_host=localhost:3000&stdb_module=weltraum-dev&stdb_ssl=false`
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const STDB_QS = process.env.E2E_STDB_QS ?? '';
const GAME_URL = STDB_QS ? `${BASE_URL}/?${STDB_QS}` : `${BASE_URL}/`;
const EXPECT_HOST = process.env.E2E_EXPECT_HOST || 'maincloud.spacetimedb.com';
const EXPECT_MODULE = process.env.E2E_EXPECT_MODULE || 'weltraum-mission';

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
      __spaceGame?: { forceFinish?: () => void };
      __weltraum?: { spacetime?: { isConnected: () => boolean } };
    };
    return !!(w.__spaceGame && w.__weltraum && w.__weltraum.spacetime && w.__weltraum.spacetime.isConnected());
  }, { timeout: 20000 });
  return { context, page };
}

describe('Real E2E: built game + SpacetimeDB', { timeout: 45000 }, () => {
  beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

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
      const first = coop.requestJoin('guest-standin');
      const pending = coop.pending();
      const approved = coop.approve('guest-standin');
      const isApproved = coop.isApproved('guest-standin');
      coop.kick('guest-standin');
      return {
        firstImmediate: first,
        pendingCount: pending.length,
        pendingId: pending[0] && pending[0].peerId,
        approved,
        isApproved,
        kicked: coop.isKicked('guest-standin'),
        rejoin: coop.requestJoin('guest-standin'),
      };
    });
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
