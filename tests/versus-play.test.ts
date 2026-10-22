/**
 * Two-browser 1 vs 1 mid-match proof. Excluded from the default suite
 * (needs a preview server, same as room-join-play).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const GAME_URL = BASE_URL + '/';
const SHOT_DIR = process.env.VERSUS_SHOT_DIR || join(process.cwd(), 'docs/versus');

type GameWin = Window & {
  __spaceGame?: {
    finishOnboard?: () => void;
    acceptName?: () => void;
    namePickVisible?: () => boolean;
    startVersus?: (kind?: string) => { versus: boolean; kind: string };
    versusInfo?: () => { versus: boolean; p1y?: number; p2y?: number; hearts?: Array<number | undefined>; fair?: { hearts: number; perk: string } };
    net?: () => {
      role: string | null;
      connected: boolean;
      inGame: boolean;
      code: string;
      versus?: boolean;
      peerReady?: boolean;
      occupancy?: number;
      p1y?: number;
      p2?: { y?: number; lives?: number } | null;
      rocks?: number;
      bullets?: number;
    };
    roomListNow?: () => { peerReady?: boolean; code: string };
    setFire?: (v: boolean) => void;
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

describe('versus 1 vs 1 (headless two browsers)', { timeout: 90000 }, () => {
  beforeAll(async () => {
    mkdirSync(SHOT_DIR, { recursive: true });
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it('starts a private challenge and shows both players mid-match', async () => {
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

    await host.page.waitForTimeout(1800);
    const hostNet = await host.page.evaluate(() => (window as GameWin).__spaceGame?.net?.());
    const guestNet = await guest.page.evaluate(() => (window as GameWin).__spaceGame?.net?.());
    const hostInfo = await host.page.evaluate(() => (window as GameWin).__spaceGame?.versusInfo?.());
    expect(hostNet?.versus).toBe(true);
    expect(guestNet?.versus).toBe(true);
    expect(hostNet?.inGame).toBe(true);
    expect((hostNet?.p1y || 0)).toBeGreaterThan((hostNet?.p2?.y || 0));
    expect(hostInfo?.fair?.hearts).toBe(4);
    expect(hostInfo?.fair?.perk).toBe('');

    await host.page.screenshot({ path: join(SHOT_DIR, 'versus_host_midmatch_1024x768.png') });
    await guest.page.screenshot({ path: join(SHOT_DIR, 'versus_guest_midmatch_1024x768.png') });

    await host.context.close();
    await guest.context.close();
  });
});
