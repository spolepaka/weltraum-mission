/**
 * Production-CSP Playwright: Google popup/redirect must not hit auth/internal-error,
 * and email-link against the Auth emulator must reach "check your email".
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4174';
const GAME_URL = process.env.E2E_STDB_QS ? `${BASE_URL}/?${process.env.E2E_STDB_QS}` : `${BASE_URL}/`;
const MODE = process.env.FIREBASE_CSP_MODE || 'google';

type CspHit = { blockedURI: string; violatedDirective: string; effectiveDirective: string };

async function openInstrumented(): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const w = window as Window & { __cspViolations?: CspHit[]; __consoleErrors?: string[] };
    w.__cspViolations = [];
    w.__consoleErrors = [];
    try {
      localStorage.setItem('spaceMissionOnboardV1', JSON.stringify({
        welcomeDone: true, trainingDone: true, mapTourDone: true, skipped: true, jitShown: {},
      }));
      localStorage.setItem('spaceMissionDisplayName', JSON.stringify({ name: 'Cosmic Fox 42', kind: 'generated' }));
    } catch {
      // ignore
    }
    document.addEventListener('securitypolicyviolation', (ev) => {
      w.__cspViolations!.push({
        blockedURI: ev.blockedURI,
        violatedDirective: ev.violatedDirective,
        effectiveDirective: ev.effectiveDirective,
      });
    });
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(String(err));
  });
  (page as Page & { __consoleErrors?: string[] }).__consoleErrors = consoleErrors;
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!(window as Window & { __weltraum?: unknown }).__weltraum, { timeout: 20000 });
  await page.waitForFunction(() => {
    const w = window as Window & { __spaceGame?: { finishOnboard?: () => void } };
    return !!w.__spaceGame;
  }, { timeout: 20000 });
  await page.evaluate(() => {
    const w = window as Window & {
      __spaceGame?: { finishOnboard?: () => void; acceptName?: () => void; namePickVisible?: () => boolean };
    };
    if (w.__spaceGame?.namePickVisible?.()) w.__spaceGame.acceptName?.();
    w.__spaceGame?.finishOnboard?.();
    document.getElementById('welcomeScreen')?.classList.add('hidden');
    document.getElementById('namePickScreen')?.classList.add('hidden');
  });
  await page.waitForTimeout(200);
  return { context, page };
}

async function collectCsp(page: Page): Promise<{ csp: CspHit[]; consoleErrors: string[] }> {
  const csp = await page.evaluate(() => {
    return (window as Window & { __cspViolations?: CspHit[] }).__cspViolations || [];
  });
  const consoleErrors = (page as Page & { __consoleErrors?: string[] }).__consoleErrors || [];
  return { csp, consoleErrors };
}

function assertCleanAuth(csp: CspHit[], consoleErrors: string[]): void {
  const firebaseCsp = csp.filter((v) =>
    /apis\.google\.com|gstatic\.com|googleapis\.com|accounts\.google\.com|firebaseapp\.com|identitytoolkit|securetoken/i.test(
      `${v.blockedURI} ${v.violatedDirective}`,
    ),
  );
  expect(firebaseCsp, `CSP violations: ${JSON.stringify(csp)}`).toEqual([]);
  const internal = consoleErrors.filter((t) => /auth\/internal-error/i.test(t));
  expect(internal, `console auth/internal-error: ${consoleErrors.join('\n')}`).toEqual([]);
}

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}, 30000);

afterAll(async () => {
  if (browser) await browser.close();
});

describe('Firebase Auth production CSP', { timeout: 45000 }, () => {
  it.skipIf(MODE !== 'google')('Sign in with Google opens accounts.google.com or firebaseapp.com without CSP / internal-error', async () => {
    const { context, page } = await openInstrumented();
    const html = await page.content();
    expect(html).toMatch(/script-src[^;]*https:\/\/apis\.google\.com/);
    expect(html).toMatch(/script-src[^;]*https:\/\/www\.gstatic\.com/);
    expect(html).not.toContain('http://localhost:*');

    const configured = await page.evaluate(() => {
      const w = window as Window & { __weltraum?: { account?: { isConfigured: () => boolean } } };
      return w.__weltraum?.account?.isConfigured() === true;
    });
    expect(configured).toBe(true);

    await page.locator('#accountBtn').click();
    await page.waitForSelector('#accountScreen:not(.hidden)');
    await page.locator('#accountSignIn').click();
    await page.waitForSelector('#accountProviderList.open', { timeout: 2000 }).catch(() => {});

    const popupPromise = page.waitForEvent('popup', { timeout: 20000 }).then((p) => p).catch(() => null);
    const navPromise = page.waitForURL(/accounts\.google\.com|firebaseapp\.com|identitytoolkit/, { timeout: 20000 }).then(() => page.url()).catch(() => null);

    await page.locator('#accountGoogle').click({ force: true });

    const popup = await popupPromise;
    let target = '';
    if (popup) {
      await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
      target = popup.url();
    } else {
      target = (await navPromise) || page.url();
    }

    expect(target).toMatch(/accounts\.google\.com|firebaseapp\.com|identitytoolkit/);
    const { csp, consoleErrors } = await collectCsp(page);
    assertCleanAuth(csp, consoleErrors);
    await context.close();
  });

  it.skipIf(MODE !== 'email')('email link reaches check-your-email against the Auth emulator without CSP violations', async () => {
    const { context, page } = await openInstrumented();
    const configured = await page.evaluate(() => {
      const w = window as Window & { __weltraum?: { account?: { isConfigured: () => boolean } } };
      return w.__weltraum?.account?.isConfigured() === true;
    });
    expect(configured).toBe(true);

    await page.locator('#accountBtn').click();
    await page.waitForSelector('#accountScreen:not(.hidden)');
    await page.locator('#accountSignIn').click();
    await page.waitForSelector('#accountProviderList.open', { timeout: 2000 }).catch(() => {});
    await page.locator('#accountEmail').fill(`parent+csp@example.com`);
    await page.locator('#accountEmailLink').click();
    await page.waitForFunction(() => {
      const note = document.getElementById('accountNote')?.textContent || '';
      return /check your email|E-Mail-Postfach|Anmelde-Link/i.test(note);
    }, { timeout: 15000 });

    const { csp, consoleErrors } = await collectCsp(page);
    assertCleanAuth(csp, consoleErrors);
    const note = await page.locator('#accountNote').innerText();
    expect(note).toMatch(/check your email|E-Mail-Postfach|Anmelde-Link/i);
    expect(consoleErrors.filter((t) => /auth\/internal-error/i.test(t))).toEqual([]);
    await context.close();
  });
});
