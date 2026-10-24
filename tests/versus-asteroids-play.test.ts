/**
 * Two-browser 1v1 asteroid-side proof. Excluded from the default suite
 * (needs a preview server, same as versus-play).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const GAME_URL = BASE_URL + '/';

type GameWin = Window & {
  __spaceGame?: {
    finishOnboard?: () => void;
    acceptName?: () => void;
    namePickVisible?: () => boolean;
    startVersus?: (kind?: string) => { versus: boolean };
    spawnVersusRock?: (side: number) => { side: number; hue: number };
    versusRocks?: () => Array<{ side: number; hue: number; dead: boolean; y: number }>;
    versusHitCheck?: (pid: number, side: number) => { hurts: boolean; ignores: boolean };
    flipVersusView?: () => void;
    net?: () => {
      role: string | null;
      connected: boolean;
      inGame: boolean;
      code: string;
      versus?: boolean;
      peerReady?: boolean;
      rocks?: number;
    };
  };
};

let browser: Browser;

async function openGame(): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
  await page.evaluate(() => {
    const w = window as GameWin;
    if (w.__spaceGame?.namePickVisible?.()) w.__spaceGame.acceptName?.();
    w.__spaceGame?.finishOnboard?.();
  });
  return { context, page };
}

describe('versus asteroid sides (headless two browsers)', { timeout: 90000 }, () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it('host simulation tags sides; guest sees the flipped tints', async () => {
    const host = await openGame();
    const guest = await openGame();
    await host.page.click('#onlineBtn');
    await host.page.click('#onChallenge');
    await host.page.waitForFunction(() => {
      const n = (window as GameWin).__spaceGame?.net?.();
      return !!(n && n.versus && n.peerReady && n.code && n.code.length >= 5);
    }, { timeout: 25000 });
    const code = await host.page.evaluate(() => (window as GameWin).__spaceGame?.net?.()?.code);
    expect(code?.length).toBeGreaterThanOrEqual(5);

    await guest.page.click('#onlineBtn');
    await guest.page.fill('#onCode', code!);
    await guest.page.click('#onGo');
    await guest.page.waitForFunction(() => {
      const n = (window as GameWin).__spaceGame?.net?.();
      return n?.role === 'guest' && n.connected === true;
    }, { timeout: 25000 });
    await host.page.waitForFunction(() => !!(window as GameWin).__spaceGame?.net?.()?.inGame, { timeout: 20000 });
    await guest.page.waitForFunction(() => !!(window as GameWin).__spaceGame?.net?.()?.inGame, { timeout: 20000 });

    const hostRules = await host.page.evaluate(() => {
      const g = (window as GameWin).__spaceGame;
      return {
        hostOwn: g?.versusHitCheck?.(1, 2),
        hostIncoming: g?.versusHitCheck?.(1, 1),
        guestOwn: g?.versusHitCheck?.(2, 1),
        guestIncoming: g?.versusHitCheck?.(2, 2),
        spawned: [g?.spawnVersusRock?.(1), g?.spawnVersusRock?.(2)],
      };
    });
    expect(hostRules.hostOwn?.hurts).toBe(false);
    expect(hostRules.hostOwn?.ignores).toBe(true);
    expect(hostRules.hostIncoming?.hurts).toBe(true);
    expect(hostRules.hostIncoming?.ignores).toBe(false);
    expect(hostRules.guestOwn?.hurts).toBe(false);
    expect(hostRules.guestIncoming?.hurts).toBe(true);
    expect(hostRules.spawned[0]?.side).toBe(1);
    expect(hostRules.spawned[1]?.side).toBe(2);
    expect(hostRules.spawned[0]?.hue).not.toBe(hostRules.spawned[1]?.hue);

    await host.page.waitForTimeout(400);
    const guestRocks = await guest.page.evaluate(() => (window as GameWin).__spaceGame?.versusRocks?.() || []);
    const sided = guestRocks.filter((r) => r.side === 1 || r.side === 2);
    expect(sided.length).toBeGreaterThan(0);
    const hues = new Set(sided.map((r) => r.hue));
    expect(hues.size).toBeGreaterThan(0);

    await host.context.close();
    await guest.context.close();
  });
});
