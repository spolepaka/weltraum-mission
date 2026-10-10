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

const HUD_SCREENS = [
  'shopScreen', 'missionScreen', 'achScreen', 'statsScreen',
  'onlineScreen', 'accountScreen', 'helpScreen', 'pauseScreen',
  'confirmScreen', 'onboardScreen', 'namePickScreen', 'weeklyScreen',
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
    boss?: () => void;
    setTime?: (t: number) => void;
    unlockTo?: (n: number) => void;
    simInfo?: () => { state: string; level: number };
    showCoach?: (id: string, text: string) => void;
    hideCoach?: () => void;
    coachVisible?: () => boolean;
    shopBadgeOn?: () => boolean;
    finishOnboard?: () => void;
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

async function openAllHudScreens(page: Page): Promise<void> {
  await page.evaluate((screenIds) => {
    screenIds.forEach(sid => {
      const el = document.getElementById(sid);
      if (el) el.classList.remove('hidden');
    });
  }, HUD_SCREENS);
}

async function scanLanguage(page: Page, lang: 'en' | 'de'): Promise<{ hits: string[]; sample: string }> {
  await openAllHudScreens(page);
  await page.evaluate((next) => {
    const w = window as GameWin;
    w.__spaceGame?.setLang?.(next);
    w.__clearFillTextLog?.();
  }, lang);
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    const w = window as GameWin;
    w.__spaceGame!.startLevel(1);
  });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const w = window as GameWin;
    w.__spaceGame!.unlockTo?.(3);
    w.__spaceGame!.startLevel(3);
  });
  await page.waitForTimeout(450);
  await page.evaluate(() => {
    const w = window as GameWin;
    w.__clearFillTextLog?.();
  });
  await page.waitForTimeout(280);
  const result = await page.evaluate((otherMarkers: readonly string[]) => {
    const w = window as GameWin;
    const dom = (function collect() {
      const parts: string[] = [];
      document.querySelectorAll('body *').forEach(el => {
        if (!(el instanceof HTMLElement)) return;
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') return;
        if (el.closest('script, style, noscript')) return;
        if (el.classList.contains('hidden')) return;
        if (el.closest('.hidden')) return;
        const t = el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE ? (el.textContent || '').trim() : '';
        if (t) parts.push(t);
      });
      ['mapHint', 'msg', 'celebrateHud', 'shopToast', 'missionToast', 'achToast', 'onStatus', 'winCoins', 'winInfo'].forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.classList.contains('hidden')) return;
        if (id === 'celebrateHud' && !el.classList.contains('show')) return;
        parts.push(el.innerText || '');
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
] as const)('iPad %s', { timeout: 45000 }, (label, size) => {
  it(`shows a visible account button with guest + sync status (${label})`, async () => {
    const { context, page } = await openPage(size);
    const info = await page.evaluate(() => {
      const btn = document.getElementById('accountBtn');
      const screen = document.getElementById('accountScreen');
      btn?.click();
      return {
        btnText: btn?.innerText || '',
        btnHidden: btn?.classList.contains('hidden') ?? true,
        kind: document.getElementById('accountKind')?.textContent || '',
        signIn: document.getElementById('accountSignIn')?.textContent || '',
        screenHidden: screen?.classList.contains('hidden') ?? true,
      };
    });
    expect(info.btnHidden).toBe(false);
    expect(info.btnText.toLowerCase()).toMatch(/account|konto|guest|gast/);
    expect(info.screenHidden).toBe(false);
    expect(info.kind).toMatch(/guest|gast/i);
    expect(info.signIn).toMatch(/Parent: save progress|Eltern: Fortschritt sichern/);
    const providers = await page.evaluate(() => ({
      google: document.getElementById('accountGoogle')?.textContent || '',
      email: document.getElementById('accountEmailLink')?.textContent || '',
      appleHidden: document.getElementById('accountApple')?.classList.contains('hidden') ?? true,
    }));
    expect(providers.google).toMatch(/Google/);
    expect(providers.email).toMatch(/Email|E-Mail/);
    expect(providers.appleHidden).toBe(true);
    const note = await page.evaluate(() => {
      (document.getElementById('accountGoogle') as HTMLButtonElement | null)?.click();
      return document.getElementById('accountNote')?.textContent || '';
    });
    expect(note).toMatch(/VITE_FIREBASE_|Firebase|Gast|guest|Saving your progress|Fortschritt wird/i);
    await page.evaluate(() => {
      const w = window as GameWin;
      w.__spaceGame?.setLang?.('de');
    });
    await page.waitForTimeout(80);
    const deParent = await page.evaluate(() => document.getElementById('accountSignIn')?.textContent || '');
    expect(deParent).toBe('Eltern: Fortschritt sichern');
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
    await page.waitForFunction(() => !document.getElementById('winScreen')?.classList.contains('hidden'), { timeout: 5000 });
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
      w.__spaceGame!.boss?.();
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
    await page.waitForFunction(() => !document.getElementById('winScreen')?.classList.contains('hidden'), { timeout: 8000 });
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

  it(`shows a shop coach tip once and not again after Got it (${label})`, async () => {
    const { context, page } = await openPage(size);
    await page.evaluate(() => {
      const w = window as GameWin;
      w.__spaceGame?.finishOnboard?.();
      w.__spaceGame?.addCoins?.(400);
      w.__spaceGame?.showCoach?.('shopCoins', 'You have 400 coins! Visit the Shop to get a new ship.');
    });
    await page.waitForFunction(() => (window as GameWin).__spaceGame?.coachVisible?.() === true, { timeout: 4000 });
    const text = await page.locator('#coachText').innerText();
    expect(text).toMatch(/Shop|Münzen|coins/i);
    await page.click('#coachGotIt');
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => (window as GameWin).__spaceGame?.coachVisible?.());
    expect(after).toBe(false);
    await context.close();
  });
});
