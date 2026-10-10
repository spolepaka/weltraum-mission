import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const STDB_QS = process.env.E2E_STDB_QS ?? '';
const GAME_URL = STDB_QS ? `${BASE_URL}/?${STDB_QS}` : `${BASE_URL}/`;

type GameWin = Window & {
  __spaceGame?: {
    net?: () => { role: string | null; connected: boolean; inGame: boolean; code: string; nPl: number; guests: Array<{ ok: boolean }>; players: Array<{ x: number }> };
    startLevel?: (n: number) => void;
    displayName?: () => string | undefined;
    acceptName?: () => void;
    namePickVisible?: () => boolean;
    finishOnboard?: () => void;
  };
};

let browser: Browser;

async function openGame(): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const w = window as GameWin;
    if (w.__spaceGame?.namePickVisible?.()) w.__spaceGame.acceptName?.();
    w.__spaceGame?.finishOnboard?.();
  });
  return { context, page };
}

async function netOf(page: Page) {
  return page.evaluate(() => {
    const w = window as GameWin;
    return w.__spaceGame?.net?.() || null;
  });
}

describe('online multiplayer (2–3 browsers, production CSP)', { timeout: 90000 }, () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it('creates a room, auto-admits a joiner, both ships stay visible for 30s', async () => {
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
    expect(code.length).toBeGreaterThanOrEqual(4);

    await guest.page.click('#onlineBtn');
    await guest.page.click('#onJoin');
    await guest.page.fill('#onCode', code);
    await guest.page.click('#onGo');

    await guest.page.waitForFunction(() => {
      const w = window as GameWin;
      const n = w.__spaceGame?.net?.();
      return !!(n && n.connected && n.role === 'guest');
    }, { timeout: 20000 });
    await host.page.waitForFunction(() => {
      const w = window as GameWin;
      const n = w.__spaceGame?.net?.();
      return !!(n && n.connected && n.guests.some((g) => g.ok));
    }, { timeout: 20000 });

    const toast = await host.page.locator('#joinToast').getAttribute('class');
    expect(toast || '').toContain('show');

    await host.page.click('#onStart');
    await host.page.waitForTimeout(3500);
    await guest.page.waitForTimeout(500);

    const start = Date.now();
    while (Date.now() - start < 32000) {
      const hn = await netOf(host.page);
      const gn = await netOf(guest.page);
      expect(hn?.connected).toBe(true);
      expect(gn?.connected).toBe(true);
      await host.page.waitForTimeout(2000);
    }

    const hostShips = await host.page.evaluate(() => {
      const w = window as GameWin;
      return w.__spaceGame?.net?.();
    });
    expect((hostShips?.nPl || 0)).toBeGreaterThanOrEqual(2);

    await host.context.close();
    await guest.context.close();
  });

  it('keeps a third player connected in the same room', async () => {
    const host = await openGame();
    const a = await openGame();
    const b = await openGame();

    await host.page.click('#onlineBtn');
    await host.page.click('#onHost');
    await host.page.waitForFunction(() => {
      const el = document.getElementById('onCodeShow');
      const t = el?.textContent || '';
      return t.length >= 4 && !t.includes('·');
    }, { timeout: 20000 });
    const code = (await host.page.locator('#onCodeShow').innerText()).trim();

    for (const guest of [a, b]) {
      await guest.page.click('#onlineBtn');
      await guest.page.click('#onJoin');
      await guest.page.fill('#onCode', code);
      await guest.page.click('#onGo');
    }

    await host.page.waitForFunction(() => {
      const w = window as GameWin;
      const n = w.__spaceGame?.net?.();
      return !!(n && n.guests.filter((g) => g.ok).length >= 2);
    }, { timeout: 25000 });

    await host.page.click('#onStart');
    await host.page.waitForTimeout(4000);
    const n = await netOf(host.page);
    expect(n?.connected).toBe(true);
    expect((n?.nPl || 0)).toBeGreaterThanOrEqual(3);

    await host.context.close();
    await a.context.close();
    await b.context.close();
  });
});
