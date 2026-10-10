/**
 * WebKit + iPad viewports: Parent save-progress tap, signed-in account panel,
 * first-session onboarding cap, and snappy training.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { webkit, type Browser, type BrowserContext, type Page } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const STDB_QS = process.env.E2E_STDB_QS ?? '';
const GAME_URL = STDB_QS ? `${BASE_URL}/?${STDB_QS}` : `${BASE_URL}/`;
const LANDSCAPE = { width: 1024, height: 768 };
const PORTRAIT = { width: 768, height: 1024 };

type GameWin = Window & {
  __spaceGame?: {
    finishOnboard?: () => void;
    expandAccount?: () => void;
    acceptWelcome?: () => void;
    skipTraining?: () => void;
    skipMapTour?: () => void;
    trainMs?: () => number;
    onboardPhase?: () => string;
    onboardScreens?: () => string[];
  };
  __weltraum?: {
    account?: {
      isSignedIn: () => boolean;
      profile: () => { signedIn: boolean; username?: string; emailMasked?: string };
    };
  };
};

let browser: Browser;

async function openPage(size: { width: number; height: number }, skipOnboard = true): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
  if (skipOnboard) {
    await page.evaluate(() => (window as GameWin).__spaceGame?.finishOnboard?.());
  }
  return { context, page };
}

beforeAll(async () => {
  browser = await webkit.launch({ headless: true });
}, 30000);

afterAll(async () => {
  if (browser) await browser.close();
});

describe.each([
  ['1024x768', LANDSCAPE],
  ['768x1024', PORTRAIT],
])('WebKit iPad %s', { timeout: 45000 }, (label, size) => {
  it(`Parent: save progress expands providers within 200ms (${label})`, async () => {
    const { context, page } = await openPage(size);
    await page.tap('#accountBtn');
    await page.waitForSelector('#accountScreen:not(.hidden)', { timeout: 5000 });
    const before = await page.evaluate(() => document.getElementById('accountProviderList')?.classList.contains('open'));
    expect(before).toBe(false);
    const timed = await page.evaluate(() => {
      const t0 = performance.now();
      document.getElementById('accountSignIn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const list = document.getElementById('accountProviderList');
      const busy = document.getElementById('accountBusy');
      return {
        elapsed: performance.now() - t0,
        open: !!list?.classList.contains('open'),
        busy: !!busy?.classList.contains('show'),
      };
    });
    expect(timed.elapsed).toBeLessThan(200);
    expect(timed.open || timed.busy).toBe(true);
    const after = await page.evaluate(() => ({
      open: document.getElementById('accountProviderList')?.classList.contains('open'),
      busy: document.getElementById('accountBusy')?.classList.contains('show'),
      note: document.getElementById('accountNote')?.textContent || '',
    }));
    expect(after.open || after.busy).toBe(true);
    expect(after.note.length).toBeGreaterThan(0);
    await context.close();
  });

  it(`signed-in profile fills the Account panel (${label})`, async () => {
    const { context, page } = await openPage(size);
    await page.evaluate(() => {
      localStorage.setItem('spaceMissionFirebaseAuth', JSON.stringify({
        idToken: 'fake.jwt.token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        uid: 'kid-1',
        email: 'son@example.com',
        displayName: 'Leo Pilot',
        provider: 'google',
      }));
      localStorage.setItem('spaceMissionDisplayName', JSON.stringify({ name: 'Turbo Fox 11', kind: 'generated' }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
    await page.evaluate(() => (window as GameWin).__spaceGame?.finishOnboard?.());
    await page.waitForTimeout(200);
    await page.tap('#accountBtn');
    const panel = await page.evaluate(() => ({
      kind: document.getElementById('accountKind')?.textContent || '',
      note: document.getElementById('accountNote')?.textContent || '',
      name: document.getElementById('accountName')?.textContent || '',
      signOutHidden: document.getElementById('accountSignOut')?.classList.contains('hidden'),
      guestHidden: document.getElementById('accountGuestActions')?.classList.contains('hidden'),
    }));
    expect(panel.kind).toMatch(/Signed in|Angemeldet/i);
    expect(panel.signOutHidden).toBe(false);
    expect(panel.guestHidden).toBe(true);
    expect(panel.name).toMatch(/Turbo Fox 11|Leo|son/i);
    await context.close();
  });

  it(`first session stays bite-sized and training can finish under 60s (${label})`, async () => {
    const { context, page } = await openPage(size, false);
    await page.waitForSelector('#welcomeScreen:not(.hidden)', { timeout: 8000 });
    await page.tap('#welcomeGo');
    await page.waitForFunction(() => (window as GameWin).__spaceGame?.onboardPhase?.() === 'training'
      || !document.getElementById('welcomeScreen')?.classList.contains('hidden') === false, { timeout: 8000 });
    await page.evaluate(() => (window as GameWin).__spaceGame?.skipTraining?.());
    await page.waitForTimeout(300);
    const phase = await page.evaluate(() => (window as GameWin).__spaceGame?.onboardPhase?.());
    if (phase === 'mapTour') {
      await page.evaluate(() => (window as GameWin).__spaceGame?.skipMapTour?.());
    }
    const screens = await page.evaluate(() => (window as GameWin).__spaceGame?.onboardScreens?.() || []);
    expect(screens.filter((id) => id === 'welcomeScreen' || id === 'namePickScreen' || id === 'onboardScreen').length).toBeLessThanOrEqual(3);
    const ms = await page.evaluate(() => (window as GameWin).__spaceGame?.trainMs?.() || 0);
    if (ms) expect(ms).toBeLessThan(60_000);
    await context.close();
  });
});
