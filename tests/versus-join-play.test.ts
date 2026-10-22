/**
 * Two-browser 1 vs 1 join → approve → match start.
 * Excluded from the default suite (needs a local preview + PeerJS).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const GAME_URL = process.env.E2E_GAME_URL || `${BASE_URL}/?stdb_host=127.0.0.1:3000&stdb_module=weltraum-dev&stdb_ssl=false`;
const SHOT_DIR = process.env.VERSUS_SHOT_DIR || join(process.cwd(), 'docs/versus');

type GameWin = Window & {
  __weltraum?: {
    ensureCloud?: () => Promise<boolean>;
    spacetime?: { isConnected?: () => boolean };
  };
  __spaceGame?: {
    finishOnboard?: () => void;
    acceptName?: () => void;
    namePickVisible?: () => boolean;
    net?: () => {
      role: string | null;
      connected: boolean;
      inGame: boolean;
      code: string;
      versus?: boolean;
      peerReady?: boolean;
      occupancy?: number;
    };
    versusListNow?: () => Array<{ code: string }>;
    coop?: {
      pending?: () => Array<{ peerId: string }>;
      approve?: (id: string) => boolean;
      reject?: (id: string) => void;
      setAsk?: (on: boolean) => void;
    };
  };
};

let browser: Browser;

async function openGame(askFirst = false): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
  await page.evaluate((ask) => {
    const w = window as GameWin;
    try { localStorage.setItem('spaceMissionAskToJoin', ask ? '1' : '0'); } catch { /* ignore */ }
    if (w.__spaceGame?.namePickVisible?.()) w.__spaceGame.acceptName?.();
    w.__spaceGame?.finishOnboard?.();
    w.__spaceGame?.coop?.setAsk?.(ask);
  }, askFirst);
  await page.evaluate(() => {
    const w = window as GameWin;
    return w.__weltraum?.ensureCloud?.();
  });
  await page.waitForFunction(() => {
    const st = (window as GameWin).__weltraum?.spacetime;
    return !!(st && st.isConnected && st.isConnected());
  }, { timeout: 25000 }).catch(() => undefined);
  return { context, page };
}

async function hostPublicDuel(page: Page): Promise<string> {
  await page.click('#onlineBtn');
  await page.waitForSelector('#onVersus', { timeout: 10000 });
  for (let i = 0; i < 3; i++) {
    await page.click('#onVersus');
    const ready = await page.waitForFunction(() => {
      const n = (window as GameWin).__spaceGame?.net?.();
      return !!(n && n.versus && n.peerReady && n.code && n.code.length >= 5);
    }, { timeout: 20000 }).then(() => true).catch(() => false);
    if (ready) break;
    await page.waitForTimeout(1500);
  }
  const code = await page.evaluate(() => (window as GameWin).__spaceGame?.net?.()?.code);
  expect(code?.length).toBeGreaterThanOrEqual(5);
  return code!;
}

describe('versus join → approve → match (two browsers)', { timeout: 240000 }, () => {
  beforeAll(async () => {
    mkdirSync(SHOT_DIR, { recursive: true });
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 1500));
  });

  it('public join, host approve, both players in the arena', async () => {
    const host = await openGame(true);
    const guest = await openGame(false);
    const code = await hostPublicDuel(host.page);

    await guest.page.click('#onlineBtn');
    await guest.page.waitForSelector('#onDuelRows', { timeout: 10000 });
    await guest.page.waitForFunction((want) => {
      const rows = (window as GameWin).__spaceGame?.versusListNow?.() || [];
      const text = document.getElementById('onDuelRows')?.innerText || '';
      return rows.some((r) => r.code === want) || text.includes(want || '') || !!document.querySelector(`[data-vsjoin="${want}"]`);
    }, code, { timeout: 25000 });
    const joinBtn = guest.page.locator(`[data-vsjoin="${code}"]`);
    if (await joinBtn.count()) await joinBtn.click();
    else {
      await guest.page.fill('#onCode', code);
      await guest.page.click('#onGo');
    }

    await host.page.waitForSelector('#onJoinRequests .onApprove', { timeout: 20000 });
    await host.page.click('#onJoinRequests .onApprove');

    await host.page.waitForFunction(() => !!(window as GameWin).__spaceGame?.net?.()?.inGame, { timeout: 25000 });
    await guest.page.waitForFunction(() => !!(window as GameWin).__spaceGame?.net?.()?.inGame, { timeout: 25000 });
    const hostNet = await host.page.evaluate(() => (window as GameWin).__spaceGame?.net?.());
    const guestNet = await guest.page.evaluate(() => (window as GameWin).__spaceGame?.net?.());
    expect(hostNet?.versus).toBe(true);
    expect(guestNet?.versus).toBe(true);
    expect(hostNet?.inGame).toBe(true);
    expect(guestNet?.inGame).toBe(true);

    await host.page.waitForTimeout(2500);
    await host.page.screenshot({ path: join(SHOT_DIR, 'versus_approve_host_ingame_1024x768.png') });
    await guest.page.screenshot({ path: join(SHOT_DIR, 'versus_approve_guest_ingame_1024x768.png') });

    await host.context.close();
    await guest.context.close();
  });

  it('reject tells the guest the host declined', async () => {
    const host = await openGame(true);
    const guest = await openGame(false);
    const code = await hostPublicDuel(host.page);
    await guest.page.click('#onlineBtn');
    await guest.page.fill('#onCode', code);
    await guest.page.click('#onGo');
    await host.page.waitForFunction(() => {
      const pending = (window as GameWin).__spaceGame?.coop?.pending?.() || [];
      const box = document.getElementById('onJoinRequests');
      return pending.length > 0 || !!(box && !box.classList.contains('hidden') && box.querySelector('.onReject'));
    }, { timeout: 25000 });
    const btn = host.page.locator('#onJoinRequests .onReject');
    if (await btn.count()) await btn.click({ force: true });
    else {
      const id = await host.page.evaluate(() => (window as GameWin).__spaceGame?.coop?.pending?.()?.[0]?.peerId);
      expect(id).toBeTruthy();
      await host.page.evaluate((peerId) => (window as GameWin).__spaceGame?.coop?.reject?.(peerId!), id);
    }
    await guest.page.waitForFunction(() => {
      const t = document.getElementById('onStatus')?.innerText || '';
      return /rejected|abgelehnt|declined/i.test(t);
    }, { timeout: 15000 });
    await host.context.close();
    await guest.context.close();
  });

  it('host leave drops the listing and tells the guest', async () => {
    const host = await openGame(true);
    const guest = await openGame(false);
    const code = await hostPublicDuel(host.page);
    await guest.page.click('#onlineBtn');
    await guest.page.waitForFunction((want) => {
      const rows = (window as GameWin).__spaceGame?.versusListNow?.() || [];
      return rows.some((r) => r.code === want) || !!document.querySelector(`[data-vsjoin="${want}"]`);
    }, code, { timeout: 20000 });
    await guest.page.fill('#onCode', code);
    await guest.page.click('#onGo');
    await host.page.waitForTimeout(1500);
    await host.page.click('#onBack');
    const left = await guest.page.waitForFunction((want) => {
      const t = document.getElementById('onStatus')?.innerText || '';
      const rows = (window as GameWin).__spaceGame?.versusListNow?.() || [];
      const text = document.getElementById('onDuelRows')?.innerText || '';
      const gone = !rows.some((r) => r.code === want) && !text.includes(want || '');
      const msg = /left|gone|verlassen|lost|verloren|rejected|abgelehnt|not found|nicht gefunden|timeout|fehl/i.test(t);
      return gone || msg ? { gone, msg } : false;
    }, code, { timeout: 25000 });
    expect(left).toBeTruthy();
    await host.context.close();
    await guest.context.close();
  });

  it('private code join with approve starts the match', async () => {
    const host = await openGame(true);
    const guest = await openGame(false);
    await host.page.click('#onlineBtn');
    await host.page.click('#onChallenge');
    await host.page.waitForFunction(() => {
      const n = (window as GameWin).__spaceGame?.net?.();
      return !!(n && n.versus && n.peerReady && n.code);
    }, { timeout: 25000 });
    const code = await host.page.evaluate(() => (window as GameWin).__spaceGame?.net?.()?.code);
    await guest.page.click('#onlineBtn');
    await guest.page.fill('#onCode', code!);
    await guest.page.click('#onGo');
    await host.page.waitForSelector('#onJoinRequests .onApprove', { timeout: 20000 });
    await host.page.click('#onJoinRequests .onApprove');
    await guest.page.waitForFunction(() => !!(window as GameWin).__spaceGame?.net?.()?.connected, { timeout: 25000 });
    await host.page.waitForFunction(() => !!(window as GameWin).__spaceGame?.net?.()?.inGame, { timeout: 25000 });
    await host.context.close();
    await guest.context.close();
  });

});
