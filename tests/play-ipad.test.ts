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
  'welcomeScreen',
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
    openOwnName?: () => void;
    fitWelcome?: () => void;
    displayName?: () => string | undefined;
    showHostRoster?: () => string;
    skipTraining?: () => void;
    startLevel?: (n: number) => void;
    mapBossOverPlanet?: (L?: number) => { toBoss: number; toPlanet: number; closerToBoss: boolean; icon: boolean };
    unlockTo?: (n: number) => void;
    centerMap?: (i: number) => void;
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
  await page.evaluate(() => {
    const w = window as GameWin;
    w.__spaceGame?.finishOnboard?.();
  });
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

  it(`keeps boss portraits visible on top of their map planets (${label})`, async () => {
    const { context, page } = await openPage(size);
    await page.evaluate(() => {
      const w = window as GameWin;
      w.__spaceGame?.unlockTo?.(12);
      w.__spaceGame?.centerMap?.(2);
    });
    await page.waitForTimeout(80);
    const check = await page.evaluate(() => {
      const w = window as GameWin;
      return [3, 6, 9, 12].map((L) => ({ L, ...(w.__spaceGame?.mapBossOverPlanet?.(L) || { toBoss: 0, toPlanet: 0, closerToBoss: false, icon: false }) }));
    });
    for (const row of check) {
      expect(row.icon, `boss icon missing for L${row.L}`).toBe(true);
      expect(row.closerToBoss, `L${row.L} draw is closer to a covering planet (${row.toBoss} vs ${row.toPlanet})`).toBe(true);
    }
    await page.screenshot({ path: `/tmp/map-boss-${label}.png`, fullPage: true });
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

const IPHONE_LANDSCAPE = { width: 844, height: 390 };

function boxesOverlap(
  a: { id: string; left: number; right: number; top: number; bottom: number },
  b: { id: string; left: number; right: number; top: number; bottom: number },
  slop = 1,
): boolean {
  return a.right > b.left + slop && b.right > a.left + slop && a.bottom > b.top + slop && b.bottom > a.top + slop;
}

async function visibleMapButtons(page: Page): Promise<Array<{ id: string; left: number; right: number; top: number; bottom: number }>> {
  return page.evaluate(() => {
    const ids = [
      'helpBtn', 'modeBar', 'weeklyBtn', 'missionBtn', 'onlineBtn', 'achBtn', 'langBtn',
      'twoPBtn', 'ghostBtn', 'statsBtn', 'accountBtn',
      'resetBtn', 'trainBtn', 'shopBtn', 'muteBtn', 'fsBtn',
    ];
    return ids.map((id) => {
      const el = document.getElementById(id);
      if (!el || el.classList.contains('hidden') || el.closest('.hidden')) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
      return { id, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }).filter((b): b is { id: string; left: number; right: number; top: number; bottom: number } => !!b);
  });
}

describe.each([
  ['1024x768', LANDSCAPE],
  ['768x1024', PORTRAIT],
  ['844x390', IPHONE_LANDSCAPE],
] as const)('map button overlap %s', { timeout: 30000 }, (label, size) => {
  it(`keeps visible map buttons from intersecting on first launch (${label})`, async () => {
    const context = await browser.newContext({
      viewport: size,
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
    await page.waitForSelector('#mapHud:not(.hidden)', { timeout: 8000 });
    await page.waitForTimeout(250);
    const boxes = await visibleMapButtons(page);
    expect(boxes.length).toBeGreaterThan(8);
    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (boxesOverlap(boxes[i], boxes[j])) hits.push(`${boxes[i].id} ∩ ${boxes[j].id}`);
      }
    }
    expect(hits, `overlaps at ${label}: ${hits.join(', ')}`).toEqual([]);
    await context.close();
  });

  it(`keeps visible map buttons from intersecting after onboarding (${label})`, async () => {
    const { context, page } = await openPage(size);
    await page.waitForSelector('#mapHud:not(.hidden)', { timeout: 8000 });
    await page.waitForTimeout(200);
    const boxes = await visibleMapButtons(page);
    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (boxesOverlap(boxes[i], boxes[j])) hits.push(`${boxes[i].id} ∩ ${boxes[j].id}`);
      }
    }
    expect(hits, `overlaps at ${label}: ${hits.join(', ')}`).toEqual([]);
    await context.close();
  });
});

describe('German umlaut rendering', { timeout: 45000 }, () => {
  it('draws äöüß on canvas and shows them in the DOM name picker', async () => {
    const { context, page } = await openPage(LANDSCAPE);
    const info = await page.evaluate(() => {
      const canvas = document.getElementById('game') as HTMLCanvasElement | null;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return { ink: 0, width: 0, family: '', dom: '' };
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 200, 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Trebuchet MS, Segoe UI, Arial, Noto Sans, DejaVu Sans, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('Bär Käse Süß', 8, 8);
      const width = ctx.measureText('Bär Käse Süß').width;
      const data = ctx.getImageData(0, 0, 200, 60).data;
      let ink = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 20) ink += 1;
      ctx.restore();
      const show = document.getElementById('welcomeNameShow');
      if (show) {
        show.classList.remove('hidden');
        show.textContent = 'Kühnes Kätzchen';
      }
      return {
        ink,
        width,
        family: getComputedStyle(document.body).fontFamily,
        dom: show?.textContent || '',
      };
    });
    expect(info.width).toBeGreaterThan(40);
    expect(info.ink).toBeGreaterThan(80);
    expect(info.family).toMatch(/Arial|Trebuchet|Segoe|Noto|DejaVu/i);
    expect(info.dom).toBe('Kühnes Kätzchen');
    await context.close();
  });
});

describe.each([
  ['1024x768', LANDSCAPE],
  ['768x1024', PORTRAIT],
  ['844x390', IPHONE_LANDSCAPE],
] as const)('welcome modal fit %s', { timeout: 45000 }, (label, size) => {
  for (const lang of ['en', 'de'] as const) {
    it(`fits without scroll and keeps Let's fly in view (${label}, ${lang})`, async () => {
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
      await page.click(lang === 'de' ? '#welcomeDe' : '#welcomeEn');
      await page.waitForTimeout(80);
      const info = await page.evaluate(() => {
        const screen = document.getElementById('welcomeScreen');
        const panel = document.querySelector('#welcomeScreen .welcomePanel') as HTMLElement | null;
        const go = document.getElementById('welcomeGo');
        if (!screen || !panel || !go) return { ok: false };
        const pr = panel.getBoundingClientRect();
        const gr = go.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pad = 1;
        return {
          ok: true,
          overflow: panel.scrollHeight > panel.clientHeight + pad || panel.scrollWidth > panel.clientWidth + pad,
          screenOverflow: screen.scrollHeight > screen.clientHeight + pad,
          goInView: gr.top >= -pad && gr.left >= -pad && gr.bottom <= vh + pad && gr.right <= vw + pad,
          panelInView: pr.top >= -pad && pr.bottom <= vh + pad && pr.left >= -pad && pr.right <= vw + pad,
          goText: (go.textContent || '').trim(),
          scrollH: panel.scrollHeight,
          clientH: panel.clientHeight,
        };
      });
      expect(info.ok).toBe(true);
      expect(info.overflow, `${label} ${lang} panel scroll ${info.scrollH}>${info.clientH}`).toBe(false);
      expect(info.screenOverflow).toBe(false);
      expect(info.goInView).toBe(true);
      expect(info.panelInView).toBe(true);
      expect(info.goText).toMatch(lang === 'de' ? /Losfliegen/ : /fly/i);
      await context.close();
    });
  }
});

type WelcomeFit = {
  ok: boolean;
  overflow?: boolean;
  screenOverflow?: boolean;
  goInView?: boolean;
  inputInView?: boolean;
  panelInView?: boolean;
  goText?: string;
  scrollH?: number;
  clientH?: number;
  ownOpen?: boolean;
};

async function welcomeFit(page: Page): Promise<WelcomeFit> {
  return page.evaluate(() => {
    const screen = document.getElementById('welcomeScreen');
    const panel = document.querySelector('#welcomeScreen .welcomePanel') as HTMLElement | null;
    const go = document.getElementById('welcomeGo');
    const input = document.getElementById('welcomeNameIn');
    if (!screen || !panel || !go) return { ok: false };
    const pr = panel.getBoundingClientRect();
    const gr = go.getBoundingClientRect();
    const ir = input?.getBoundingClientRect();
    const vv = window.visualViewport;
    const vw = vv?.width || window.innerWidth;
    const vh = vv?.height || window.innerHeight;
    const pad = 2;
    const inView = (r: DOMRect) => r.top >= -pad && r.left >= -pad && r.bottom <= vh + pad && r.right <= vw + pad;
    return {
      ok: true,
      overflow: panel.scrollHeight > panel.clientHeight + pad || panel.scrollWidth > panel.clientWidth + pad,
      screenOverflow: screen.scrollHeight > screen.clientHeight + pad,
      goInView: inView(gr),
      inputInView: ir ? inView(ir) : false,
      panelInView: inView(pr),
      goText: (go.textContent || '').trim(),
      scrollH: panel.scrollHeight,
      clientH: panel.clientHeight,
      ownOpen: screen.classList.contains('ownOpen'),
    };
  });
}

describe.each([
  ['1024x768', LANDSCAPE],
  ['768x1024', PORTRAIT],
  ['844x390', IPHONE_LANDSCAPE],
] as const)('welcome own-name fit %s', { timeout: 45000 }, (label, size) => {
  it(`fits with the custom input open (${label})`, async () => {
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
    await page.click('#welcomeOwnChip');
    await page.waitForSelector('#welcomeOwnBox.open', { timeout: 4000 });
    const info = await welcomeFit(page);
    expect(info.ok).toBe(true);
    expect(info.ownOpen).toBe(true);
    expect(info.overflow, `${label} panel scroll ${info.scrollH}>${info.clientH}`).toBe(false);
    expect(info.screenOverflow).toBe(false);
    expect(info.goInView).toBe(true);
    expect(info.inputInView).toBe(true);
    expect(info.panelInView).toBe(true);
    await context.close();
  });

  it(`keeps input and Let's fly visible with a keyboard-sized visualViewport (${label})`, async () => {
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
    await page.click('#welcomeOwnChip');
    await page.waitForSelector('#welcomeOwnBox.open', { timeout: 4000 });
    await page.evaluate(() => {
      const shrink = Math.min(280, Math.floor(window.innerHeight * 0.45));
      const fake = {
        height: window.innerHeight - shrink,
        width: window.innerWidth,
        offsetTop: 0,
        offsetLeft: 0,
        scale: 1,
        addEventListener() {},
        removeEventListener() {},
      };
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake });
      (window as GameWin).__spaceGame?.fitWelcome?.();
    });
    const info = await welcomeFit(page);
    expect(info.ok).toBe(true);
    expect(info.overflow, `${label} kb panel scroll ${info.scrollH}>${info.clientH}`).toBe(false);
    expect(info.goInView).toBe(true);
    expect(info.inputInView).toBe(true);
    await context.close();
  });
});

describe('custom welcome name', { timeout: 60000 }, () => {
  it('types a custom name and shows it in Account and above the ship in a room', async () => {
    const context = await browser.newContext({
      viewport: LANDSCAPE,
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!(window as GameWin).__spaceGame, { timeout: 20000 });
    await page.waitForSelector('#welcomeScreen:not(.hidden)', { timeout: 8000 });
    await page.click('#welcomeOwnChip');
    await page.waitForSelector('#welcomeNameIn', { timeout: 4000 });
    await page.fill('#welcomeNameIn', 'Leo Pilot');
    await page.click('#welcomeGo');
    await page.waitForFunction(() => document.getElementById('welcomeScreen')?.classList.contains('hidden'), { timeout: 8000 });
    await page.evaluate(() => {
      const g = (window as GameWin).__spaceGame;
      g?.skipTraining?.();
      g?.finishOnboard?.();
    });
    expect(await page.evaluate(() => (window as GameWin).__spaceGame?.displayName?.())).toBe('Leo Pilot');

    await page.waitForSelector('#accountBtn', { state: 'visible', timeout: 8000 });
    await page.click('#accountBtn');
    await page.waitForSelector('#accountScreen:not(.hidden)', { timeout: 4000 });
    const account = await page.evaluate(() => ({
      label: document.getElementById('accountName')?.textContent || '',
      boxHidden: document.getElementById('accountNameBox')?.classList.contains('hidden') ?? true,
    }));
    expect(account.boxHidden).toBe(false);
    expect(account.label).toBe('Leo Pilot');
    await page.click('#accountClose');

    const roster = await page.evaluate(() => (window as GameWin).__spaceGame?.showHostRoster?.() || '');
    expect(roster).toMatch(/Leo Pilot/);
    await page.evaluate(() => document.getElementById('onlineScreen')?.classList.add('hidden'));

    await page.click('#twoPBtn');
    await page.evaluate(() => {
      const w = window as GameWin;
      w.__clearFillTextLog?.();
      w.__spaceGame?.startLevel?.(1);
    });
    await page.waitForTimeout(400);
    const painted = await page.evaluate(() => (window as GameWin).__fillTextLog || []);
    expect(painted.some((t) => t.includes('Leo Pilot'))).toBe(true);
    await context.close();
  });
});
