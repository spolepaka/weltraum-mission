/**
 * Headless repro for listed-room-not-found and solo-host two-ships.
 * Excluded from the default suite (needs a preview server).
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
    hostSoloStart?: (L?: number) => { nPl: number; twoP: boolean; others: number; occupancy: number };
    seedGuest?: (peerId: string, name?: string) => { occupancy: number; guests: number; pid?: number };
    mp?: () => { twoP: boolean; p2: { x: number } | null; all: Array<{ x: number }> };
    net?: () => { role: string | null; nPl: number; occupancy?: number; peerReady?: boolean };
    roomListNow?: () => { peerReady?: boolean; listed?: boolean; code: string; rows: Array<{ code: string; joinable?: boolean; freshness?: string }> };
    injectPublicRooms?: (rows: Array<{ code: string; hostName: string; level: number; players: number; heartbeatMs?: number }>) => string;
    publicRoomsText?: () => string;
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

describe('room join / solo host (headless)', { timeout: 60000 }, () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it('solo host start yields exactly one ship, even with a duplicate guest identity', async () => {
    const host = await openGame();
    const alone = await host.page.evaluate(() => {
      const w = window as GameWin;
      return w.__spaceGame?.hostSoloStart?.(1);
    });
    expect(alone?.occupancy).toBe(1);
    expect(alone?.others).toBe(0);
    expect(alone?.twoP).toBe(false);
    const mp = await host.page.evaluate(() => (window as GameWin).__spaceGame?.mp?.());
    expect(mp?.twoP).toBe(false);
    expect(mp?.all || []).toHaveLength(0);

    const first = await host.page.evaluate(() => (window as GameWin).__spaceGame?.seedGuest?.('peer-ada', 'Ada'));
    const dup = await host.page.evaluate(() => (window as GameWin).__spaceGame?.seedGuest?.('peer-ada', 'Ada'));
    expect(first?.occupancy).toBe(2);
    expect(dup?.occupancy).toBe(2);
    const two = await host.page.evaluate(() => (window as GameWin).__spaceGame?.hostSoloStart?.(1));
    expect(two?.occupancy).toBe(2);
    expect(two?.others).toBe(1);
    await host.context.close();
  });

  it('greys a stale listed room and refuses a self-join of the host row', async () => {
    const host = await openGame();
    await host.page.click('#onlineBtn');
    const now = Date.now();
    const text = await host.page.evaluate((heartbeatMs) => {
      const w = window as GameWin;
      return w.__spaceGame?.injectPublicRooms?.([
        { code: 'V43NX', hostName: 'Ada', level: 1, players: 1, heartbeatMs },
        { code: 'TREK4', hostName: 'Bea', level: 2, players: 1, heartbeatMs: heartbeatMs - 9000 },
      ]);
    }, now);
    expect(text || '').toMatch(/Ada/);
    expect(text || '').toMatch(/Bea/);
    const staleCount = await host.page.locator('.roomRow.stale button').count();
    const staleDisabled = await host.page.locator('.roomRow.stale button[disabled]').count();
    const staleText = await host.page.locator('.roomRow.stale button').innerText();
    const liveJoin = await host.page.locator('[data-join="V43NX"]').count();
    expect(staleCount).toBe(1);
    expect(staleDisabled).toBe(1);
    expect(staleText).toMatch(/Host away|Host nicht da/);
    expect(liveJoin).toBe(1);
    await host.context.close();
  });

  it('waits for the host Peer to open before listing, then a second browser can join', async () => {
    const host = await openGame();
    const guest = await openGame();
    await host.page.click('#onlineBtn');
    await host.page.click('#onHost');
    const early = await host.page.evaluate(() => {
      const w = window as GameWin;
      return w.__spaceGame?.roomListNow?.();
    });
    expect(early?.listed).not.toBe(true);
    await host.page.waitForFunction(() => {
      const w = window as GameWin;
      const n = w.__spaceGame?.roomListNow?.();
      return !!(n && n.peerReady && n.code && n.code.length >= 5);
    }, { timeout: 25000 });
    const ready = await host.page.evaluate(() => (window as GameWin).__spaceGame?.roomListNow?.());
    expect(ready?.peerReady).toBe(true);
    expect(ready?.code.length).toBeGreaterThanOrEqual(5);

    await guest.page.click('#onlineBtn');
    await guest.page.fill('#onCode', ready!.code);
    await guest.page.click('#onGo');
    await guest.page.waitForFunction(() => {
      const w = window as GameWin;
      const n = w.__spaceGame?.net?.();
      return n?.role === 'guest' && (n as { connected?: boolean }).connected === true;
    }, { timeout: 25000 });
    const hn = await host.page.evaluate(() => (window as GameWin).__spaceGame?.net?.());
    expect((hn?.occupancy || 1)).toBeGreaterThanOrEqual(2);
    await host.context.close();
    await guest.context.close();
  });
});
