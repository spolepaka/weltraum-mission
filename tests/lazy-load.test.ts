import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const STDB_QS = process.env.E2E_STDB_QS ?? '';
const GAME_URL = STDB_QS ? `${BASE_URL}/?${STDB_QS}` : `${BASE_URL}/`;

let browser: Browser;

async function openGuest(): Promise<{ context: BrowserContext; page: Page; urls: string[]; html: string }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const urls: string[] = [];
  page.on('request', (req) => urls.push(req.url()));
  const html = await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).then((r) => r?.text() || '');
  await page.waitForFunction(() => !!(window as { __spaceGame?: unknown }).__spaceGame, { timeout: 20000 });
  await page.waitForTimeout(800);
  return { context, page, urls, html };
}

describe('lazy load network + HTML', { timeout: 45000 }, () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it('fresh guest does not download Firebase or PeerJS chunks', async () => {
    const { context, urls, html } = await openGuest();
    const blob = urls.join('\n');
    expect(blob).not.toMatch(/firebase-auth-impl/i);
    expect(blob).not.toMatch(/peerjs/i);
    expect(html).not.toContain('FINALE: Robo-Kaiser');
    expect(html).not.toContain('7 Phasen mit allen Tricks');
    await context.close();
  });

  it('loads Firebase at startup only when a stored session exists', async () => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem('spaceMissionFirebaseAuth', JSON.stringify({
        idToken: 'session-token',
        expiresAt: Date.now() + 60_000,
        uid: 'parent-1',
        email: 'ada@example.com',
      }));
    });
    const page = await context.newPage();
    const urls: string[] = [];
    page.on('request', (req) => urls.push(req.url()));
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!(window as { __spaceGame?: unknown }).__spaceGame, { timeout: 20000 });
    await page.waitForTimeout(800);
    expect(urls.join('\n')).toMatch(/firebase-auth-impl/i);
    await context.close();
  });

  it('loads Firebase at startup when a pending-redirect flag is set', async () => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      sessionStorage.setItem('spaceMissionAuthRedirect', '1');
    });
    const page = await context.newPage();
    const urls: string[] = [];
    page.on('request', (req) => urls.push(req.url()));
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!(window as { __spaceGame?: unknown }).__spaceGame, { timeout: 20000 });
    await page.waitForTimeout(800);
    expect(urls.join('\n')).toMatch(/firebase-auth-impl/i);
    await context.close();
  });

  it('downloads the Firebase chunk when Account opens, still not PeerJS', async () => {
    const { context, page, urls } = await openGuest();
    expect(urls.join('\n')).not.toMatch(/firebase-auth-impl/i);
    await page.evaluate(() => {
      const w = window as { __spaceGame?: { finishOnboard?: () => void; skipTraining?: () => void } };
      w.__spaceGame?.skipTraining?.();
      w.__spaceGame?.finishOnboard?.();
    });
    await page.waitForSelector('#accountBtn', { state: 'visible', timeout: 8000 });
    await page.click('#accountBtn');
    await page.waitForTimeout(900);
    expect(urls.join('\n')).toMatch(/firebase-auth-impl/i);
    expect(urls.join('\n')).not.toMatch(/peerjs/i);
    await context.close();
  });

  it('serves version.json with a build id', async () => {
    const { context, page } = await openGuest();
    const payload = await page.evaluate(async () => {
      const res = await fetch('/version.json', { cache: 'no-store' });
      return { ok: res.ok, body: await res.json() as { id?: string } };
    });
    expect(payload.ok).toBe(true);
    expect(payload.body.id).toMatch(/\S/);
    await context.close();
  });

  it('prefetches the next unlocked remote level on the map', async () => {
    const { context, page } = await openGuest();
    const targets = await page.evaluate(() => {
      const w = window as unknown as {
        __spaceGame?: { progress: () => { unlocked: number }; prefetch?: () => number[] };
        __weltraum?: { levels?: { prefetch: (n: number) => number[] } };
      };
      const unlocked = Math.max(4, w.__spaceGame?.progress().unlocked || 1);
      return w.__weltraum?.levels?.prefetch(unlocked) || w.__spaceGame?.prefetch?.() || [];
    });
    expect(targets.some((n) => n >= 4)).toBe(true);
    await context.close();
  });
});
