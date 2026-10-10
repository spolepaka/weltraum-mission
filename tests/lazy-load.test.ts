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
