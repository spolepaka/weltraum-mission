/**
 * iPad-sized Playwright play-tests: account button, language scan
 * (DOM + instrumented fillText), normal win, boss celebration + coin carryover.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { DE_ONLY_MARKERS, EN_ONLY_MARKERS } from '../src/i18n/markers';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const STDB_QS = process.env.E2E_STDB_QS ?? '';
const GAME_URL = STDB_QS ? `${BASE_URL}/?${STDB_QS}` : `${BASE_URL}/`;

const LANDSCAPE = { width: 1024, height: 768 };
const PORTRAIT = { width: 768, height: 1024 };

const SCREEN_IDS = [
  'shopScreen', 'missionScreen', 'achScreen', 'statsScreen',
  'onlineScreen', 'accountScreen', 'helpScreen', 'pauseScreen',
  'confirmScreen', 'winScreen', 'overScreen',
];

type GameWin = Window & {
  __spaceGame?: {
    tryStartLevel: (n: number) => boolean;
    startLevel: (n: number) => void;
    forceFinish: (opts?: { skipCelebrate?: boolean; level?: number }) => void;
    shop: () => { coins: number; coinsRun: number };
    progress: () => { unlocked: number };
    setLang?: (lang: string) => void;
    getLang?: () => string;
    addCoins?: (n: number) => void;
    killBoss?: () => void;
    setTime?: (t: number) => void;
    simInfo?: () => { state: string; level: number };
  };
  __fillTextLog?: string[];
  __clearFillTextLog?: () => void;
};

let browser: Browser;

async function openPage(size: { width: number; height: number }): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    const w = window as GameWin;
    return !!(w.__spaceGame && typeof w.__spaceGame.forceFinish === 'function');
  }, { timeout: 20000 });
  await page.waitForTimeout(200);
  return { context, page };
}

function collectVisibleText(): string {
  const parts: string[] = [];
  const walk = (el: Element) => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || (el as HTMLElement).offsetParent === null && el !== document.body) {
      if (el.id && ['game', 'msg', 'celebrateHud'].includes(el.id) === false && !el.closest('#mapHud')) {
        /* still skip hidden screens */
      }
    }
    if (el.classList?.contains('hidden') || el.classList?.contains('screen') && el.classList.contains('hidden')) return;
    if (el instanceof HTMLElement && el.offsetParent === null && el !== document.body && el.id !== 'mapHud' && el.id !== 'msg' && el.id !== 'celebrateHud') return;
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = (child.textContent || '').trim();
        if (t) parts.push(t);
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element);
    }
  };
  walk(document.body);
  const msg = document.getElementById('msg');
  if (msg && msg.className) parts.push(msg.innerText || '');
  const celeb = document.getElementById('celebrateHud');
  if (celeb && celeb.classList.contains('show')) parts.push(celeb.innerText || '');
  return parts.join('\n');
}

async function openAllHudScreens(page: Page): Promise<void> {
  const clicks = ['shopBtn', 'missionBtn', 'achBtn', 'statsBtn', 'onlineBtn', 'accountBtn', 'helpBtn'];
  for (const id of clicks) {
    await page.locator(`#${id}`).click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(80);
    await page.evaluate((screenIds) => {
      screenIds.forEach(sid => {
        const el = document.getElementById(sid);
        if (el) el.classList.remove('hidden');
      });
    }, SCREEN_IDS);
  }
  await page.locator('#pauseBtn').click({ force: true }).catch(() => undefined);
  await page.evaluate(() => {
    const p = document.getElementById('pauseScreen');
    if (p) p.classList.remove('hidden');
    const c = document.getElementById('confirmScreen');
    if (c) c.classList.remove('hidden');
  });
}

async function scanLanguage(page: Page, lang: 'en' | 'de'): Promise<{ hits: string[]; sample: string }> {
  await page.evaluate((next) => {
    const w = window as GameWin;
    w.__spaceGame?.setLang?.(next);
    w.__clearFillTextLog?.();
  }, lang);
  await page.waitForTimeout(120);
  await openAllHudScreens(page);
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    const w = window as GameWin;
    w.__clearFillTextLog?.();
  });
  await page.waitForTimeout(250);
  const result = await page.evaluate((otherMarkers: readonly string[]) => {
    const w = window as GameWin;
    const dom = (function collect() {
      const parts: string[] = [];
      document.querySelectorAll('body *').forEach(el => {
        if (!(el instanceof HTMLElement)) return;
        if (el.classList.contains('hidden')) return;
        if (el.closest('.hidden')) return;
        const t = el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE ? (el.textContent || '').trim() : '';
        if (t) parts.push(t);
      });
      ['mapHint', 'msg', 'celebrateHud', 'shopToast', 'missionToast', 'achToast', 'onStatus', 'winCoins', 'winInfo'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) parts.push(el.innerText || '');
      });
      return parts.join('\n');
    })();
    const canvas = (w.__fillTextLog || []).join('\n');
    const blob = `${dom}\n${canvas}`;
    const hits = otherMarkers.filter(m => blob.includes(m));
    return { hits, sample: blob.slice(0, 4000) };
  }, lang === 'en' ? DE_ONLY_MARKERS : EN_ONLY_MARKERS);
  return result;
}

beforeAll(async () => {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}, 30000);

afterAll(async () => {
  if (browser) await browser.close();
});

describe.each([
  ['landscape 1024x768', LANDSCAPE],
  ['portrait 768x1024', PORTRAIT],
] as const)('iPad %s', (label, size) => {
  it(`shows a visible account button with guest + sync status (${label})`, async () => {
    const { context, page } = await openPage(size);
    const acc = page.locator('#accountBtn');
    await expect(acc).toBeVisible();
    const text = await acc.innerText();
    expect(text.toLowerCase()).toMatch(/account|konto|guest|gast/);
    await acc.click();
    await expect(page.locator('#accountScreen')).toBeVisible();
    await expect(page.locator('#accountKind')).toContainText(/guest|gast/i);
    await expect(page.locator('#accountSignIn')).toBeVisible();
    await context.close();
  });

  it(`language switch keeps every scanned string in the active language (${label})`, async () => {
    const { context, page } = await openPage(size);
    const enScan = await scanLanguage(page, 'en');
    expect(enScan.hits, `EN scan found DE markers: ${enScan.hits.join(', ')}\n${enScan.sample}`).toEqual([]);

    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    });
    const deScan = await scanLanguage(page, 'de');
    expect(deScan.hits, `DE scan found EN markers: ${deScan.hits.join(', ')}\n${deScan.sample}`).toEqual([]);

    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    });
    const enAgain = await scanLanguage(page, 'en');
    expect(enAgain.hits, `EN rescan found DE markers: ${enAgain.hits.join(', ')}`).toEqual([]);
    await context.close();
  });

  it(`normal level win shows a results screen and keeps coins (${label})`, async () => {
    const { context, page } = await openPage(size);
    const before = await page.evaluate(() => {
      const w = window as GameWin;
      return w.__spaceGame!.shop().coins;
    });
    await page.evaluate(() => {
      const w = window as GameWin;
      w.__spaceGame!.startLevel(1);
      w.__spaceGame!.addCoins?.(40);
    });
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      const w = window as GameWin;
      w.__spaceGame!.forceFinish({ skipCelebrate: true });
    });
    await expect(page.locator('#winScreen')).toBeVisible({ timeout: 5000 });
    const winText = await page.locator('#winScreen').innerText();
    expect(winText).toMatch(/Level Complete|Level geschafft|Continue|Weiter|Coins|Münzen|Collected|Gesammelt/i);
    const after = await page.evaluate(() => {
      const w = window as GameWin;
      return w.__spaceGame!.shop().coins;
    });
    expect(after).toBeGreaterThan(before);
    await page.locator('#winNext').click();
    await page.waitForTimeout(200);
    const onMap = await page.evaluate(() => {
      const w = window as GameWin;
      return {
        coins: w.__spaceGame!.shop().coins,
        unlocked: w.__spaceGame!.progress().unlocked,
        mapHidden: document.getElementById('mapHud')?.classList.contains('hidden'),
      };
    });
    expect(onMap.coins).toBe(after);
    expect(onMap.unlocked).toBeGreaterThanOrEqual(2);
    expect(onMap.mapHidden).toBe(false);
    await context.close();
  });

  it(`boss win celebrates then carries coins to the map (${label})`, async () => {
    const { context, page } = await openPage(size);
    await page.evaluate(() => {
      const w = window as GameWin & { unlockTo?: (n: number) => void };
      const shop = w.__spaceGame!.shop();
      (window as GameWin & { __coinsBefore?: number }).__coinsBefore = shop.coins;
      (w.__spaceGame as GameWin['__spaceGame'] & { unlockTo?: (n: number) => void })?.unlockTo?.(3);
      w.__spaceGame!.startLevel(3);
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      const w = window as GameWin;
      w.__spaceGame!.setTime?.(9);
      w.__spaceGame!.killBoss?.();
    });
    await page.waitForFunction(() => {
      const el = document.getElementById('celebrateHud');
      const msg = document.getElementById('msg');
      return !!(el && el.classList.contains('show')) || /BOSS (DEFEATED|BESIEGT)/i.test(msg?.innerText || '');
    }, { timeout: 8000 });
    const banner = await page.evaluate(() => {
      const el = document.getElementById('celebrateHud');
      const msg = document.getElementById('msg');
      return `${el?.innerText || ''}\n${msg?.innerText || ''}`;
    });
    expect(banner).toMatch(/BOSS DEFEATED|BOSS BESIEGT/);
    await expect(page.locator('#winScreen')).toBeVisible({ timeout: 8000 });
    const win = await page.locator('#winScreen').innerText();
    expect(win).toMatch(/Continue|Weiter|Collected|Gesammelt|Level Complete|Level geschafft/i);
    const after = await page.evaluate(() => {
      const w = window as GameWin;
      return w.__spaceGame!.shop().coins;
    });
    const before = await page.evaluate(() => (window as GameWin & { __coinsBefore?: number }).__coinsBefore || 0);
    expect(after).toBeGreaterThan(before);
    await page.locator('#winNext').click();
    await page.waitForTimeout(200);
    const mapCoins = await page.evaluate(() => (window as GameWin).__spaceGame!.shop().coins);
    expect(mapCoins).toBe(after);
    await context.close();
  });
});
