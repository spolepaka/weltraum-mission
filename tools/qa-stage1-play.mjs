#!/usr/bin/env node
/**
 * Stage 1 playthrough: map worlds, late levels, L100 vs L250 Kaiser, outer ships.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4178';
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots';
const DOCS = join(process.cwd(), 'docs/stage1');
const REPORT = join(DOCS, 'stage1-play.json');

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

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const context = await browser.newContext({
  viewport: { width: 1024, height: 768 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
page.on('pageerror', (err) => errors.push({ type: 'pageerror', message: String(err) }));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push({ type: 'console', message: msg.text() });
});
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__spaceGame, { timeout: 20000 });
await page.evaluate(() => {
  const g = window.__spaceGame;
  g.finishOnboard?.();
  g.skipTraining?.();
  g.skipMapTour?.();
  document.getElementById('welcomeScreen')?.classList.add('hidden');
  document.getElementById('namePickScreen')?.classList.add('hidden');
});

const max = await page.evaluate(() => {
  const g = window.__spaceGame;
  g.unlockTo?.(250);
  return g.progress?.();
});
log(`unlocked=${max?.unlocked}`);

const map0 = await page.evaluate(() => {
  const g = window.__spaceGame;
  g.goToMap?.() || (document.getElementById('mapScreen') && (document.getElementById('mapScreen').className = ''));
  return g.mapInfo?.();
});
log(`map world0 planets=${map0?.planets?.length} world=${map0?.world}`);
await page.waitForTimeout(400);
await shot(page, 'qa-stage1-map-world0');

const worlds = [];
for (const w of [0, 6, 12]) {
  const info = await page.evaluate((i) => window.__spaceGame.setMapWorld?.(i) ?? window.__spaceGame.mapInfo?.(), w);
  await page.waitForTimeout(300);
  const label = await page.evaluate(() => document.getElementById('worldLabel')?.textContent || '');
  worlds.push({ w, label, info: typeof info === 'number' ? info : info?.world });
  await shot(page, `qa-stage1-map-world${w}`);
}
log(`worlds=${JSON.stringify(worlds)}`);

const l100 = await page.evaluate(() => {
  const g = window.__spaceGame;
  g.unlockTo?.(250);
  g.startLevel?.(100);
  return { info: g.levelInfo?.(100), sim: g.simInfo?.() };
});
log(`L100 start ${JSON.stringify(l100.info)} sim=${JSON.stringify(l100.sim)}`);
// Boss waits ~8s
await page.waitForTimeout(9000);
const l100boss = await page.evaluate(() => window.__spaceGame.feat?.());
log(`L100 boss ${JSON.stringify(l100boss)}`);
await shot(page, 'qa-stage1-kaiser-100-play');
if (!l100boss?.bossType) errors.push({ type: 'bug', message: 'L100 Kaiser did not spawn after 9s' });

const l250 = await page.evaluate(() => {
  const g = window.__spaceGame;
  g.startLevel?.(250);
  return { info: g.levelInfo?.(250), sim: g.simInfo?.() };
});
log(`L250 start ${JSON.stringify(l250.info)}`);
await page.waitForTimeout(9000);
const l250boss = await page.evaluate(() => window.__spaceGame.feat?.());
log(`L250 boss ${JSON.stringify(l250boss)}`);
await shot(page, 'qa-stage1-kaiser-250-play');
if (!l250boss?.bossType) errors.push({ type: 'bug', message: 'L250 Kaiser did not spawn after 9s' });
if (l250boss?.bossSz && l100boss?.bossSz && l250boss.bossSz <= l100boss.bossSz) {
  errors.push({ type: 'bug', message: `L250 Kaiser not bigger (${l250boss.bossSz} <= ${l100boss.bossSz})` });
}

const late = await page.evaluate(() => {
  const g = window.__spaceGame;
  g.startLevel?.(174);
  return g.levelInfo?.(174);
});
log(`L174 ${JSON.stringify(late)}`);
await page.waitForTimeout(400);
await shot(page, 'qa-stage1-late-174');

await page.evaluate(() => {
  document.getElementById('mapScreen')?.classList.remove('hidden');
  document.getElementById('playHud')?.classList.add('hidden');
});
await page.click('#shopBtn').catch(() => {});
await page.evaluate(() => window.__spaceGame.openShopTab?.(6));
await page.waitForTimeout(500);
const shop = await page.evaluate(() => ({
  title: document.getElementById('shopTitle')?.textContent || '',
  cards: document.querySelectorAll('#shipGrid .scard').length,
  text: (document.getElementById('shipGrid')?.innerText || '').slice(0, 240),
}));
log(`shop ${JSON.stringify(shop)}`);
await shot(page, 'qa-stage1-shop-outer');

const alle = await page.evaluate(() => {
  const input = document.getElementById('codeIn') || document.getElementById('cheatIn');
  if (input) { input.value = 'ALLELEVEL'; }
  return window.__spaceGame.progress?.();
});
log(`after unlock progress unlocked=${alle?.unlocked}`);

await context.close();
await browser.close();

const report = { base: BASE, at: new Date().toISOString(), errors, notes, shots, errorCount: errors.length };
writeFileSync(REPORT, JSON.stringify(report, null, 2));
copyFileSync(REPORT, join(OUT, 'stage1-play.json'));
console.log(JSON.stringify({ errorCount: errors.length, shots: shots.length }, null, 2));
