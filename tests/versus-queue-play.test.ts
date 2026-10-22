/**
 * Two-browser proof that a public 1 vs 1 is visible on the other device.
 * Excluded from the default suite (needs a preview server).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const GAME_URL = process.env.E2E_GAME_URL || `${BASE_URL}/?stdb_host=127.0.0.1:3000&stdb_module=weltraum-dev&stdb_ssl=false`;
const SHOT_DIR = process.env.VERSUS_SHOT_DIR || join(process.cwd(), 'docs/versus');

type GameWin = Window & {
  __weltraum?: {
    ensureCloud?: () => Promise<boolean>;
    spacetime?: { isConnected?: () => boolean; hasLiveVersusQueue?: () => boolean };
    names?: { current?: () => { name?: string } | null };
  };
  __spaceGame?: {
    finishOnboard?: () => void;
    acceptName?: () => void;
    namePickVisible?: () => boolean;
    startVersus?: (kind?: string) => { versus: boolean; kind: string };
    net?: () => { role: string | null; code: string; versus?: boolean; peerReady?: boolean; listed?: boolean };
    versusListNow?: () => Array<{ code: string; hostName?: string; kind?: string }>;
    roomListNow?: () => { public?: boolean; code?: string; peerReady?: boolean; listed?: boolean; duels?: Array<{ code: string }> };
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
  await page.evaluate(() => {
    const w = window as GameWin;
    return w.__weltraum?.ensureCloud?.();
  });
  await page.waitForFunction(() => {
    const st = (window as GameWin).__weltraum?.spacetime;
    return !!(st && st.isConnected && st.isConnected());
  }, { timeout: 25000 });
  return { context, page };
}

describe('public 1 vs 1 listing (two browsers)', { timeout: 90000 }, () => {
  beforeAll(async () => {
    mkdirSync(SHOT_DIR, { recursive: true });
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it('shows device A\'s public 1v1 on device B\'s Online screen', async () => {
    const host = await openGame();
    const guest = await openGame();

    await host.page.click('#onlineBtn');
    await host.page.waitForSelector('#onVersus', { timeout: 10000 });
    const publicOn = await host.page.locator('#onMenuVisPublic').isChecked();
    expect(publicOn).toBe(true);
    await host.page.click('#onVersus');
    await host.page.waitForFunction(() => {
      const n = (window as GameWin).__spaceGame?.net?.();
      return !!(n && n.versus && n.peerReady && n.code && n.code.length >= 5);
    }, { timeout: 25000 });

    const code = await host.page.evaluate(() => (window as GameWin).__spaceGame?.net?.()?.code);
    expect(code?.length).toBeGreaterThanOrEqual(5);

    await guest.page.click('#onlineBtn');
    await guest.page.waitForSelector('#onDuelRows', { timeout: 10000 });
    await guest.page.waitForFunction((want) => {
      const rows = (window as GameWin).__spaceGame?.versusListNow?.() || [];
      const text = document.getElementById('onDuelRows')?.innerText || '';
      return rows.some((r) => r.code === want) || text.includes(want || '');
    }, code, { timeout: 25000 });

    const seen = await guest.page.evaluate(() => ({
      rows: (window as GameWin).__spaceGame?.versusListNow?.() || [],
      text: document.getElementById('onDuelRows')?.innerText || '',
    }));
    expect(seen.rows.some((r) => r.code === code) || seen.text.includes(code!)).toBe(true);

    await guest.page.screenshot({ path: join(SHOT_DIR, 'versus_public_guest_sees_host_1024x768.png') });
    await host.page.screenshot({ path: join(SHOT_DIR, 'versus_public_host_waiting_1024x768.png') });

    await host.context.close();
    await guest.context.close();
  });
});
