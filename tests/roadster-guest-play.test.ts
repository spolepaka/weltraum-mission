/**
 * Headless repro: guest Roadster flip/boost must run on the host sim
 * and show on both screens. Excluded from the default suite.
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
    setShip?: (id: string) => void;
    startLevel?: (n: number) => void;
    roadsterBoost?: (flip?: boolean) => boolean;
    roadsterBoostState?: () => { roll: number; left: number; cd: number; invuln: number; tapBoost?: boolean };
    mp?: () => { twoP: boolean; p1: { roll?: number; boost?: number; cd?: number } | null; p2: { roll?: number; boost?: number; cd?: number; invuln?: number } | null; all: Array<{ roll?: number; boost?: number; cd?: number }> };
    net?: () => {
      role: string | null;
      connected: boolean;
      inGame: boolean;
      code: string;
      looks?: Record<number, string>;
      p1roll?: number;
      p2?: { roll?: number; boost?: number; cd?: number };
      players?: Array<{ roll?: number; boost?: number; cd?: number }>;
      tapBoost?: boolean;
    };
    placeOther?: (pid: number, x: number, y: number, lives?: number, shipId?: string) => unknown;
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
    w.__spaceGame?.setShip?.('shadowspeeder');
  });
  return { context, page };
}

describe('guest roadster flip (headless)', { timeout: 90000 }, () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it('local co-op P2 flip does not steal P1 cooldown', async () => {
    const a = await openGame();
    await a.page.evaluate(() => {
      const w = window as GameWin;
      w.__spaceGame?.setShip?.('beepbuggy');
      w.__spaceGame?.startLevel?.(1);
      w.__spaceGame?.placeOther?.(2, 700, 800, 3, 'apexflash');
    });
    await a.page.waitForTimeout(80);
    const before = await a.page.evaluate(() => (window as GameWin).__spaceGame?.mp?.());
    await a.page.keyboard.press('e');
    await a.page.waitForTimeout(80);
    const after = await a.page.evaluate(() => (window as GameWin).__spaceGame?.mp?.());
    expect(after?.p2?.roll || 0).toBeGreaterThan(0);
    expect(after?.p2?.cd || 0).toBeGreaterThan(0);
    expect(after?.p2?.cd || 0).toBeLessThan(2);
    expect(after?.p1?.roll || 0).toBe(before?.p1?.roll || 0);
    expect(after?.p1?.cd || 0).toBe(0);
    await a.page.keyboard.press('Shift');
    await a.page.waitForTimeout(80);
    const both = await a.page.evaluate(() => (window as GameWin).__spaceGame?.mp?.());
    expect(both?.p1?.cd || 0).toBeGreaterThan(3);
    expect(both?.p2?.cd || 0).toBeGreaterThan(0);
    expect(both?.p2?.cd || 0).toBeLessThan(2);
    await a.context.close();
  });

  it('guest swipe/X boost is simulated on the host and drawn on both screens', async () => {
    const host = await openGame();
    const guest = await openGame();
    await host.page.click('#onlineBtn');
    await host.page.click('#onHost');
    await host.page.waitForFunction(() => {
      const el = document.getElementById('onCodeShow');
      const t = el?.textContent || '';
      return t.length >= 4 && !t.includes('·');
    }, { timeout: 20000 });
    const code = (await host.page.locator('#onCodeShow').innerText()).trim();

    await guest.page.click('#onlineBtn');
    await guest.page.fill('#onCode', code);
    await guest.page.click('#onGo');
    await guest.page.waitForFunction(() => {
      const n = (window as GameWin).__spaceGame?.net?.();
      return !!(n && n.connected && n.role === 'guest');
    }, { timeout: 20000 });
    await host.page.click('#onStart');
    await host.page.waitForFunction(() => (window as GameWin).__spaceGame?.net?.()?.inGame === true, { timeout: 8000 });
    await guest.page.waitForFunction(() => (window as GameWin).__spaceGame?.net?.()?.inGame === true, { timeout: 8000 });
    await host.page.waitForFunction(() => {
      const n = (window as GameWin).__spaceGame?.net?.();
      return !!(n && n.p2 && (n.looks?.[2] || n.lookP2));
    }, { timeout: 4000 });
    await guest.page.waitForFunction(() => ((window as GameWin).__spaceGame?.net?.()?.snaps || 0) > 0, { timeout: 4000 });

    await guest.page.evaluate(() => (window as GameWin).__spaceGame?.roadsterBoost?.(true));
    await host.page.waitForFunction(() => {
      const n = (window as GameWin).__spaceGame?.net?.();
      const p = n?.p2 || n?.players?.[0];
      return !!(p && ((p.roll || 0) > 0 || (p.boost || 0) > 0));
    }, { timeout: 4000 });
    await guest.page.waitForFunction(() => {
      const s = (window as GameWin).__spaceGame?.roadsterBoostState?.();
      const m = (window as GameWin).__spaceGame?.mp?.();
      const o = m?.all?.[0] || m?.p2;
      return !!((s && ((s.roll || 0) > 0 || (s.left || 0) > 0)) || (o && ((o.roll || 0) > 0 || (o.boost || 0) > 0)));
    }, { timeout: 4000 });
    const hn = await host.page.evaluate(() => (window as GameWin).__spaceGame?.net?.());
    const gs = await guest.page.evaluate(() => (window as GameWin).__spaceGame?.roadsterBoostState?.());
    const gmp = await guest.page.evaluate(() => (window as GameWin).__spaceGame?.mp?.());
    expect((hn?.p2?.roll || 0) > 0 || (hn?.p2?.boost || 0) > 0).toBe(true);
    expect((hn?.p2?.cd || 0)).toBeGreaterThan(0);
    expect((gs?.roll || 0) > 0 || (gs?.left || 0) > 0 || (gmp?.all?.[0]?.roll || 0) > 0).toBe(true);
    await host.context.close();
    await guest.context.close();
  });
});
