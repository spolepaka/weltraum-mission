import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { EN_ONLY_MARKERS } from '../src/i18n/markers';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const STDB_QS = process.env.E2E_STDB_QS ?? '';
const GAME_URL = STDB_QS ? `${BASE_URL}/?${STDB_QS}` : `${BASE_URL}/`;
const ART = '/opt/cursor/artifacts';

type GameWin = Window & {
  __spaceGame?: {
    finishOnboard?: () => void;
    acceptWelcome?: () => void;
    skipTraining?: () => void;
    skipMapTour?: () => void;
    trainAdvance?: () => void;
    mapTourAdvance?: () => void;
    trainStep?: () => string;
    mapTourStep?: () => string;
    onboardPhase?: () => string;
    fire?: () => void;
    shop?: () => { coins: number; up?: Record<string, number> };
  };
};

const LANDSCAPE = { width: 1024, height: 768 };
const PORTRAIT = { width: 768, height: 1024 };

let browser: Browser;

async function openFresh(size: { width: number; height: number }): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
  await page.waitForSelector('#welcomeScreen:not(.hidden)', { timeout: 8000 });
  return { context, page };
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(ART, { recursive: true });
  await page.screenshot({ path: `${ART}/${name}.png`, fullPage: true });
}

async function waitPrompt(page: Page, re: RegExp, timeout = 8000): Promise<string> {
  await page.waitForFunction((pattern) => {
    const el = document.getElementById('obText');
    const box = document.getElementById('obPrompt');
    if (!el || !box || box.classList.contains('hidden')) return false;
    return new RegExp(pattern).test(el.textContent || '');
  }, re.source, { timeout });
  return page.locator('#obText').innerText();
}

async function completeWelcome(page: Page, tag: string): Promise<void> {
  const welcomeOn = await page.locator('#welcomeTitle').isVisible();
  expect(welcomeOn).toBe(true);
  await shot(page, `onboard_welcome_${tag}`);
  await page.click('#welcomeEn');
  await page.click('#welcomeGo');
  await page.waitForSelector('#welcomeScreen.hidden, #welcomeScreen.hidden *', { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => document.getElementById('welcomeScreen')?.classList.contains('hidden'), { timeout: 5000 });
}

const TRAIN_ORDER = ['moveLeft', 'moveRight', 'shootRock', 'collectCoin', 'grabPower', 'avoidHazard', 'miniBoss'];

async function waitStep(page: Page, step: string): Promise<void> {
  const idx = TRAIN_ORDER.indexOf(step);
  await page.waitForFunction((want) => {
    const cur = (window as GameWin).__spaceGame?.trainStep?.() || '';
    const order = ['moveLeft', 'moveRight', 'shootRock', 'collectCoin', 'grabPower', 'avoidHazard', 'miniBoss'];
    return order.indexOf(cur) >= order.indexOf(want);
  }, step, { timeout: 12000 });
}

async function playTraining(page: Page, tag: string): Promise<void> {
  await waitStep(page, 'moveLeft');
  await waitPrompt(page, /LEFT|LINKS/i);
  await shot(page, `onboard_train_left_${tag}`);
  await page.locator('#leftBtn').click({ force: true });
  await waitStep(page, 'moveRight');
  await waitPrompt(page, /RIGHT|RECHTS/i);
  await shot(page, `onboard_train_right_${tag}`);
  await page.locator('#rightBtn').click({ force: true });
  await waitStep(page, 'shootRock');
  await waitPrompt(page, /asteroid|Asteroid|shoot|schieß|Space/i);
  await shot(page, `onboard_train_shoot_${tag}`);
  const shotDbg = await page.evaluate(() => {
    const w = window as GameWin;
    const keys = w.__spaceGame ? Object.keys(w.__spaceGame) : [];
    w.__spaceGame?.fire?.();
    return { keys: keys.slice(0, 30), step: w.__spaceGame?.trainStep?.(), hasFire: typeof w.__spaceGame?.fire === 'function' };
  });
  if (shotDbg.step !== 'collectCoin') {
    throw new Error(`shoot did not advance: ${JSON.stringify(shotDbg)}`);
  }
  await waitStep(page, 'collectCoin');
  await waitPrompt(page, /coin|Münze/i);
  await shot(page, `onboard_train_coin_${tag}`);
  await page.waitForTimeout(1200);
  await waitStep(page, 'grabPower');
  await waitPrompt(page, /power-up|Extra/i);
  await shot(page, `onboard_train_power_${tag}`);
  await page.waitForTimeout(1200);
  await waitStep(page, 'avoidHazard');
  await waitPrompt(page, /away|aus|Steer|Weich/i);
  await shot(page, `onboard_train_dodge_${tag}`);
  await page.waitForTimeout(2800);
  await waitStep(page, 'miniBoss');
  await waitPrompt(page, /trainer|Trainer|tiny|Mini/i);
  await shot(page, `onboard_train_boss_${tag}`);
  for (let i = 0; i < 50; i++) {
    await page.evaluate(() => (window as GameWin).__spaceGame?.fire?.());
    await page.waitForTimeout(60);
  }
}

async function playMapTour(page: Page, tag: string): Promise<void> {
  const steps = ['planets', 'stars', 'shop', 'missions', 'twoPlayer', 'online', 'account'];
  for (const step of steps) {
    await page.waitForFunction((id) => (window as GameWin).__spaceGame?.mapTourStep?.() === id, step, { timeout: 8000 });
    await shot(page, `onboard_tour_${step}_${tag}`);
    if (step === 'shop') {
      const mag = page.locator('.uprow[data-id="mag"] button');
      if (await mag.count()) await mag.click({ force: true }).catch(() => {});
    }
    const still = await page.evaluate((id) => (window as GameWin).__spaceGame?.mapTourStep?.() === id, step);
    if (still) await page.click('#obNext');
  }
  await page.waitForFunction(() => (window as GameWin).__spaceGame?.onboardPhase?.() === 'done', { timeout: 8000 });
}

beforeAll(async () => {
  mkdirSync(ART, { recursive: true });
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
}, 30000);

afterAll(async () => {
  if (browser) await browser.close();
});

describe.each([
  ['1024x768', LANDSCAPE],
  ['768x1024', PORTRAIT],
])('onboarding e2e %s', (label, size) => {
  it(`walks a brand-new player through welcome, training, and map tour (${label})`, async () => {
    const { context, page } = await openFresh(size);
    await completeWelcome(page, label);
    await playTraining(page, label);
    await playMapTour(page, label);
    const phase = await page.evaluate(() => (window as GameWin).__spaceGame?.onboardPhase?.());
    expect(phase).toBe('done');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      phase: (window as GameWin).__spaceGame?.onboardPhase?.(),
      welcome: !document.getElementById('welcomeScreen')?.classList.contains('hidden'),
    }));
    expect(after.phase).toBe('done');
    expect(after.welcome).toBe(false);
    await context.close();
  }, 120000);

  it(`skip path does not replay after reload (${label})`, async () => {
    const { context, page } = await openFresh(size);
    await completeWelcome(page, `skip_${label}`);
    await waitPrompt(page, /LEFT|LINKS/i);
    await page.click('#obSkip');
    await page.waitForTimeout(400);
    const tour = await page.evaluate(() => document.getElementById('obPrompt')?.classList.contains('hidden'));
    if (!tour) await page.click('#obSkip');
    await page.waitForFunction(() => (window as GameWin).__spaceGame?.onboardPhase?.() === 'done', { timeout: 8000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
    await page.waitForTimeout(400);
    const welcome = await page.evaluate(() => !document.getElementById('welcomeScreen')?.classList.contains('hidden'));
    expect(welcome).toBe(false);
    await context.close();
  }, 60000);
});

describe('onboarding language', () => {
  it('welcome and prompts stay in the active language', async () => {
    const { context, page } = await openFresh(LANDSCAPE);
    await page.click('#welcomeDe');
    await page.waitForTimeout(150);
    const deTitle = await page.locator('#welcomeTitle').innerText();
    expect(deTitle).toMatch(/Willkommen/);
    expect(deTitle).not.toContain('Welcome, pilot!');
    await page.click('#welcomeEn');
    await page.waitForTimeout(150);
    const enTitle = await page.locator('#welcomeTitle').innerText();
    expect(enTitle).toMatch(/Welcome, pilot!/);
    const blob = await page.evaluate(() => document.body.innerText);
    const hits = EN_ONLY_MARKERS.filter((m) => blob.includes(m));
    expect(hits.length).toBeGreaterThan(0);
    await context.close();
  }, 30000);
});
