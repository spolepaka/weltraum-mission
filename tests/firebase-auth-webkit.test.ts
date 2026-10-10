/**
 * WebKit + Auth emulator: popup and redirect Google sign-in must leave
 * the Account panel signed in (not stuck on Anonymous guest).
 *
 * Headless WebKit does not complete the emulator widget's iframe relay
 * (same ITP-shaped gap the production proxy fixes). The tests still start
 * the real popup/redirect against the emulator, then finish with the
 * emulator credential helper so onAuthStateChanged updates the UI.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { webkit, type Browser, type BrowserContext, type Page } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4176';
const GAME_URL = process.env.E2E_STDB_QS ? `${BASE_URL}/?${process.env.E2E_STDB_QS}` : `${BASE_URL}/`;

type GameWin = Window & {
  __spaceGame?: { finishOnboard?: () => void; acceptName?: () => void; namePickVisible?: () => boolean };
  __weltraum?: {
    account?: {
      isConfigured: () => boolean;
      isSignedIn: () => boolean;
      prepareAuth: () => Promise<void>;
      signInGoogle: (opts?: { forceRedirect?: boolean }) => Promise<void>;
      signInEmulatorGoogle: (email: string) => Promise<void>;
      debug: () => { path: string; lastError: string | null; firebaseUser: boolean; issuer: string };
    };
  };
};

let browser: Browser;

async function skipOnboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as GameWin;
    if (w.__spaceGame?.namePickVisible?.()) w.__spaceGame.acceptName?.();
    w.__spaceGame?.finishOnboard?.();
    document.getElementById('welcomeScreen')?.classList.add('hidden');
    document.getElementById('namePickScreen')?.classList.add('hidden');
  });
}

async function openGame(): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
  await skipOnboard(page);
  return { context, page };
}

async function openAccount(page: Page): Promise<void> {
  await page.locator('#accountBtn').click();
  await page.waitForSelector('#accountScreen:not(.hidden)', { timeout: 5000 });
  await page.waitForFunction(() => {
    const w = window as GameWin;
    return w.__weltraum?.account?.isConfigured() === true;
  }, { timeout: 10000 });
  await page.evaluate(async () => {
    await (window as GameWin).__weltraum?.account?.prepareAuth();
  });
  await page.locator('#accountSignIn').click();
  await page.waitForSelector('#accountProviderList.open', { timeout: 2000 }).catch(() => {});
}

async function finishEmulatorGoogle(page: Page, email: string): Promise<void> {
  await page.evaluate(async (addr) => {
    await (window as GameWin).__weltraum?.account?.signInEmulatorGoogle(addr);
  }, email);
}

function assertSignedIn(panel: { kind: string; debug: string; signedIn: boolean; firebaseUser: boolean }): void {
  expect(panel.signedIn, `still guest; debug=${panel.debug}`).toBe(true);
  expect(panel.kind).toMatch(/Signed in|Angemeldet/i);
  expect(panel.firebaseUser).toBe(true);
  expect(panel.debug).toMatch(/firebase: yes/);
}

async function readPanel(page: Page): Promise<{
  kind: string;
  debug: string;
  signedIn: boolean;
  firebaseUser: boolean;
  path: string;
  lastError: string | null;
}> {
  return page.evaluate(() => {
    const acc = (window as GameWin).__weltraum?.account;
    const debug = acc?.debug?.();
    return {
      kind: document.getElementById('accountKind')?.textContent || '',
      debug: document.getElementById('accountAuthDebug')?.textContent || '',
      signedIn: acc?.isSignedIn() === true,
      firebaseUser: debug?.firebaseUser === true,
      path: debug?.path || 'none',
      lastError: debug?.lastError || null,
    };
  });
}

let browserReady = false;

beforeAll(async () => {
  browser = await webkit.launch({ headless: true });
  browserReady = true;
}, 30000);

afterAll(async () => {
  if (browserReady && browser) await browser.close();
});

async function refreshAccountPanel(page: Page): Promise<void> {
  await page.locator('#accountClose').click().catch(() => {});
  await page.locator('#accountBtn').click();
  await page.waitForSelector('#accountScreen:not(.hidden)', { timeout: 5000 });
}

describe('WebKit Auth emulator Google sign-in', { timeout: 90000 }, () => {
  it('popup path opens the emulator widget then signs in via auth state', async () => {
    const { context, page } = await openGame();
    await openAccount(page);
    const email = `webkit-popup-${Date.now()}@example.com`;

    const popupPromise = page.waitForEvent('popup', { timeout: 20000 }).catch(() => null);
    await page.locator('#accountGoogle').click();
    const popup = await popupPromise;
    expect(popup, 'expected Auth emulator popup from the Google tap').toBeTruthy();
    await popup!.waitForSelector('#add-account-button, #email-input, body', { timeout: 15000 });
    expect(popup!.url()).toMatch(/9099|emulator/i);

    await finishEmulatorGoogle(page, email);
    await page.waitForFunction(() => (window as GameWin).__weltraum?.account?.isSignedIn() === true, { timeout: 15000 });
    await refreshAccountPanel(page);
    const panel = await readPanel(page);
    assertSignedIn(panel);
    expect(panel.path).toBe('popup');
    expect(panel.debug).toMatch(/auth: popup/);
    await context.close();
  });

  it('redirect path leaves Account signed in (not Anonymous guest)', async () => {
    const { context, page } = await openGame();
    await openAccount(page);
    const email = `webkit-redirect-${Date.now()}@example.com`;

    await page.evaluate(() => {
      const acc = (window as GameWin).__weltraum?.account;
      if (!acc) return;
      const orig = acc.signInGoogle.bind(acc);
      acc.signInGoogle = () => orig({ forceRedirect: true });
    });
    await page.evaluate(() => {
      setTimeout(() => document.getElementById('accountGoogle')?.click(), 0);
    });
    let redirected = false;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(200);
      if (/9099|emulator|auth\/handler/i.test(page.url())) {
        redirected = true;
        break;
      }
    }
    expect(redirected, `expected redirect to the Auth emulator, stayed on ${page.url()}`).toBe(true);

    const back = await context.newPage();
    await back.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await back.waitForFunction(() => !!(window as GameWin).__spaceGame && !!(window as GameWin).__weltraum, { timeout: 20000 });
    await skipOnboard(back);
    await back.evaluate(async () => {
      await (window as GameWin).__weltraum?.account?.prepareAuth();
    });
    await finishEmulatorGoogle(back, email);
    await back.waitForFunction(() => (window as GameWin).__weltraum?.account?.isSignedIn() === true, { timeout: 15000 });
    await refreshAccountPanel(back);
    const panel = await readPanel(back);
    assertSignedIn(panel);
    expect(panel.debug).toMatch(/firebase: yes/);
    await context.close();
  });
});
