#!/usr/bin/env node
/**
 * Stage 3 iPad EN/DE walkthrough. Collects console errors, visits every
 * major screen, plays a short solo burst, and writes a JSON report.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4177';
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots';
const DOCS = join(process.cwd(), 'docs/qa');
const REPORT = join(process.cwd(), 'docs/qa/stage3-report.json');

mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

const errors = [];
const notes = [];
const shots = [];

function log(msg) {
  notes.push(msg);
  console.log(msg);
}

async function shot(page, name) {
  const dest = join(OUT, `${name}.png`);
  await page.screenshot({ path: dest });
  copyFileSync(dest, join(DOCS, `${name}.png`));
  shots.push(name);
}

async function openGame(browser, size, lang) {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    locale: lang === 'de' ? 'de-DE' : 'en-US',
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push({ type: 'pageerror', message: String(err), lang, size: `${size.width}x${size.height}` }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ type: 'console', message: msg.text(), lang, size: `${size.width}x${size.height}` });
  });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__spaceGame, { timeout: 20000 });
  return { context, page };
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

// --- Fresh guest welcome + training (do not finishOnboard) ---
{
  const { context, page } = await openGame(browser, { width: 1024, height: 768 }, 'en');
  await page.waitForTimeout(400);
  const welcome = await page.evaluate(() => ({
    welcome: !document.getElementById('welcomeScreen')?.classList.contains('hidden'),
    title: document.getElementById('welcomeTitle')?.textContent || '',
    go: document.getElementById('welcomeGo')?.textContent || '',
  }));
  log(`welcome visible=${welcome.welcome} title=${welcome.title}`);
  await shot(page, 'qa-welcome-en-1024x768');
  await page.click('#welcomeGo');
  await page.waitForTimeout(1200);
  const afterGo = await page.evaluate(() => ({
    welcomeHidden: document.getElementById('welcomeScreen')?.classList.contains('hidden'),
    namePick: !document.getElementById('namePickScreen')?.classList.contains('hidden'),
    train: !!window.__spaceGame?.trainStep?.() || document.getElementById('obPrompt')?.classList.contains('hidden') === false,
    trainStep: window.__spaceGame?.trainStep?.() || '',
    prompt: document.getElementById('obText')?.textContent || '',
  }));
  log(`after Let's fly: welcomeHidden=${afterGo.welcomeHidden} namePick=${afterGo.namePick} trainStep=${afterGo.trainStep} prompt=${afterGo.prompt}`);
  if (afterGo.namePick) errors.push({ type: 'bug', message: 'namePickScreen overlayed training after welcome' });
  await shot(page, 'qa-train-after-welcome-1024x768');
  await page.evaluate(() => window.__spaceGame?.skipTraining?.());
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__spaceGame?.skipMapTour?.());
  await page.waitForTimeout(250);
  await shot(page, 'qa-map-en-1024x768');
  await context.close();
}

// --- Main HUD tour EN + DE, landscape + portrait ---
for (const lang of ['en', 'de']) {
  for (const size of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
    const tag = `${lang}-${size.width}x${size.height}`;
    const { context, page } = await openGame(browser, size, lang);
    await page.evaluate((next) => {
      const g = window.__spaceGame;
      g.finishOnboard?.();
      g.skipTraining?.();
      g.skipMapTour?.();
      g.setLang?.(next);
      document.getElementById('welcomeScreen')?.classList.add('hidden');
      document.getElementById('onboardScreen')?.classList.add('hidden');
      document.getElementById('namePickScreen')?.classList.add('hidden');
    }, lang);
    await page.waitForTimeout(200);

    async function open(id, shotName) {
      await page.evaluate((sid) => {
        ['shopScreen', 'missionScreen', 'achScreen', 'statsScreen', 'onlineScreen', 'accountScreen', 'helpScreen', 'adminScreen', 'weeklyScreen']
          .forEach((x) => document.getElementById(x)?.classList.add('hidden'));
        document.getElementById(sid)?.classList.remove('hidden');
      }, id);
      await page.waitForTimeout(120);
      await shot(page, shotName);
      const clip = await page.evaluate((sid) => {
        const el = document.getElementById(sid);
        if (!el) return { missing: sid };
        const r = el.getBoundingClientRect();
        const panel = el.querySelector('.panel');
        const pr = panel ? panel.getBoundingClientRect() : r;
        return {
          id: sid,
          offscreen: pr.bottom > window.innerHeight + 8 || pr.right > window.innerWidth + 8 || pr.top < -8,
          h: Math.round(pr.height),
          w: Math.round(pr.width),
          text: (el.innerText || '').slice(0, 240),
        };
      }, id);
      if (clip.offscreen) errors.push({ type: 'layout', message: `${sid} clipped on ${tag}`, extra: clip });
      return clip;
    }

    await shot(page, `qa-map-${tag}`);
    const shop = await open('shopScreen', `qa-shop-${tag}`);
    log(`shop ${tag}: ${shop.text?.split('\n')[0]}`);
    await page.evaluate(() => window.__spaceGame?.addCoins?.(400));
    await page.waitForTimeout(80);
    const bought = await page.evaluate(() => {
      const g = window.__spaceGame;
      const before = g.shop?.();
      const btn = document.querySelector('#shipGrid button, .sgrid button');
      if (btn) btn.click();
      return { before: before?.coins, after: g.shop?.()?.coins, equipped: g.shop?.()?.equipped };
    });
    log(`shop buy ${tag}: coins ${bought.before} -> ${bought.after} equipped=${bought.equipped}`);

    await open('achScreen', `qa-ach-${tag}`);
    await open('accountScreen', `qa-account-${tag}`);
    const acc = await page.evaluate(() => ({
      kind: document.getElementById('accountKind')?.textContent || '',
      signIn: document.getElementById('accountSignIn')?.textContent || '',
    }));
    log(`account ${tag}: ${acc.kind} / ${acc.signIn}`);

    await open('onlineScreen', `qa-online-${tag}`);
    const online = await page.evaluate(() => ({
      versus: document.getElementById('onVersus')?.textContent || '',
      host: document.getElementById('onHost')?.textContent || '',
      fair: document.getElementById('versusFair')?.textContent || '',
    }));
    log(`online ${tag}: ${online.versus} | ${online.host}`);

    await page.evaluate(() => {
      document.getElementById('onlineScreen')?.classList.add('hidden');
      document.getElementById('accountScreen')?.classList.add('hidden');
    });
    const twoP = await page.evaluate(() => {
      const btn = document.getElementById('twoPBtn');
      if (btn) btn.click();
      return btn ? btn.textContent : 'missing';
    });
    log(`local 2P toggle ${tag}: ${twoP}`);

    const play = await page.evaluate(() => {
      const g = window.__spaceGame;
      g.tryStartLevel?.(1) || g.startLevel?.(1);
      return g.simInfo?.() || { state: '?', level: 1 };
    });
    await page.waitForTimeout(400);
    await shot(page, `qa-solo1-${tag}`);
    log(`solo L1 ${tag}: ${JSON.stringify(play)}`);

    const boss = await page.evaluate(() => {
      const g = window.__spaceGame;
      g.unlockTo?.(3);
      g.startLevel?.(3);
      return g.simInfo?.();
    });
    await page.waitForTimeout(500);
    await shot(page, `qa-boss3-${tag}`);
    log(`boss L3 ${tag}: ${JSON.stringify(boss)}`);

    const late = await page.evaluate(() => {
      const g = window.__spaceGame;
      g.unlockTo?.(18);
      g.startLevel?.(18);
      return g.simInfo?.();
    });
    await page.waitForTimeout(400);
    await shot(page, `qa-late18-${tag}`);
    log(`late L18 ${tag}: ${JSON.stringify(late)}`);

    await context.close();
  }
}

// --- Two-browser public room (best effort) ---
{
  const host = await openGame(browser, { width: 1024, height: 768 }, 'en');
  const guest = await openGame(browser, { width: 1024, height: 768 }, 'en');
  await host.page.evaluate(() => {
    const g = window.__spaceGame;
    g.finishOnboard?.(); g.skipTraining?.(); g.skipMapTour?.();
    document.getElementById('welcomeScreen')?.classList.add('hidden');
  });
  await guest.page.evaluate(() => {
    const g = window.__spaceGame;
    g.finishOnboard?.(); g.skipTraining?.(); g.skipMapTour?.();
    document.getElementById('welcomeScreen')?.classList.add('hidden');
  });
  await host.page.evaluate(() => window.__spaceGame.openOnline());
  await host.page.waitForTimeout(200);
  await host.page.click('#onHost');
  await host.page.waitForTimeout(2500);
  const hostCode = await host.page.evaluate(() => document.getElementById('onCodeShow')?.textContent || '');
  log(`coop host code=${hostCode}`);
  await shot(host.page, 'qa-coop-host-1024x768');
  await guest.page.evaluate(() => window.__spaceGame.openOnline());
  await guest.page.waitForTimeout(400);
  await shot(guest.page, 'qa-coop-guest-list-1024x768');
  const guestList = await guest.page.evaluate(() => document.getElementById('onRoomRows')?.innerText || '');
  log(`coop guest list=${guestList.slice(0, 180)}`);
  await host.context.close();
  await guest.context.close();
}

// --- Versus buttons ---
{
  const { context, page } = await openGame(browser, { width: 1024, height: 768 }, 'en');
  await page.evaluate(() => {
    const g = window.__spaceGame;
    g.finishOnboard?.(); g.skipTraining?.(); g.skipMapTour?.();
    document.getElementById('welcomeScreen')?.classList.add('hidden');
    g.openOnline();
  });
  await page.waitForTimeout(200);
  await shot(page, 'qa-versus-online-1024x768');
  await page.click('#onVersus');
  await page.waitForTimeout(1800);
  const vs = await page.evaluate(() => ({
    title: document.getElementById('onlineTitle')?.textContent || '',
    code: document.getElementById('onCodeShow')?.textContent || '',
    status: document.getElementById('onStatus')?.textContent || '',
  }));
  log(`versus host: ${JSON.stringify(vs)}`);
  await shot(page, 'qa-versus-waiting-1024x768');
  await context.close();
}

await browser.close();

const report = {
  base: BASE,
  at: new Date().toISOString(),
  errors,
  notes,
  shots,
  errorCount: errors.length,
};
writeFileSync(REPORT, JSON.stringify(report, null, 2));
copyFileSync(REPORT, join(OUT, 'stage3-report.json'));
console.log(JSON.stringify({ errorCount: errors.length, shots: shots.length, notes: notes.length }, null, 2));
