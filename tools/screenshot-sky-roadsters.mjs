#!/usr/bin/env node
/** Capture Tesla Roadster shop tab, one in-flight shot, live draw check. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts';
const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const IDS = ['beepbuggy', 'cloudcoupe', 'shadowspeeder', 'chromewasp', 'apexflash'];

mkdirSync(OUT, { recursive: true });

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
page.setDefaultTimeout(30000);
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__spaceGame && typeof window.__spaceGame.finishOnboard === 'function');
await page.evaluate(() => Promise.all(['red', 'white', 'black', 'silver', 'chrome'].map((p) => new Promise((res) => {
  const im = new Image();
  im.onload = () => res(true);
  im.onerror = () => res(false);
  im.src = `/ships/roadster_${p}.png`;
}))));
await page.evaluate(() => {
  const g = window.__spaceGame;
  g.finishOnboard();
  g.skipTraining?.();
  g.skipMapTour?.();
  g.addCoins?.(250000);
  document.getElementById('welcomeScreen')?.classList.add('hidden');
  document.getElementById('onboardScreen')?.classList.add('hidden');
  document.getElementById('namePickScreen')?.classList.add('hidden');
  document.getElementById('coachMark')?.classList.add('hidden');
});
await page.waitForTimeout(300);

const renders = await page.evaluate((ids) => {
  const g = window.__spaceGame;
  return ids.map((id) => g.drawShipOk(id));
}, IDS);
const bad = renders.filter((r) => !r.ok);
if (bad.length) {
  console.error('drawShipOk failed', bad);
  process.exit(1);
}
console.log('drawShipOk', JSON.stringify(renders));

await page.evaluate(() => {
  window.__spaceGame.openShopTab(5);
  window.__spaceGame.shopSel?.('beepbuggy');
});
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, 'tesla_roadsters_shop_tab_en.png'), fullPage: false });

await page.evaluate(() => {
  window.__spaceGame.setLang?.('de');
  window.__spaceGame.openShopTab(5);
  window.__spaceGame.shopSel?.('beepbuggy');
});
await page.waitForTimeout(350);
await page.screenshot({ path: join(OUT, 'tesla_roadsters_shop_tab_de.png'), fullPage: false });

await page.evaluate(() => {
  window.__spaceGame.setLang?.('en');
  document.getElementById('shopScreen')?.classList.add('hidden');
  const g = window.__spaceGame;
  g.setShip('beepbuggy');
  g.protectP1?.();
  g.startLevel(1);
});
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, 'tesla_roadsters_flight_beepbuggy.png'), fullPage: false });

for (const id of IDS) {
  const dataUrl = await page.evaluate((shipId) => window.__spaceGame.drawShipPng(shipId, 400), id);
  writeFileSync(join(OUT, `tesla_roadsters_ingame_${id}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

const flipUrls = await page.evaluate(async () => {
  const api = window.__weltraum.roadsters;
  const paint = 'chrome';
  const img = await new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = `/ships/roadster_${paint}.png`;
  });
  const flame = ['230,250,255', '90,180,255', '30,70,200'];
  const frames = [];
  for (let i = 0; i < 8; i++) {
    const u = i / 7;
    const sx = api.boost.scaleX(2, u);
    const under = api.boost.underside(sx);
    const cv = document.createElement('canvas');
    cv.width = 280;
    cv.height = 420;
    const c = cv.getContext('2d');
    c.fillStyle = '#121018';
    c.fillRect(0, 0, 280, 420);
    c.save();
    c.translate(140, 200);
    c.scale((sx || 0.04) * 3.2, 3.2);
    api.draw(c, 'apexflash', 0.42, flame, true, 0.4, img, true, under);
    c.restore();
    frames.push(cv.toDataURL('image/png'));
  }
  return frames;
});
flipUrls.forEach((url, i) => {
  writeFileSync(join(OUT, `tesla_roadsters_flip_${i}.png`), Buffer.from(url.split(',')[1], 'base64'));
});

await page.evaluate(() => {
  const g = window.__spaceGame;
  g.setShip('apexflash');
  g.protectP1?.();
  g.startLevel(1);
});
await page.waitForTimeout(400);
await page.evaluate(() => window.__spaceGame.roadsterBoost(true));
await page.waitForTimeout(120);
await page.screenshot({ path: join(OUT, 'tesla_roadsters_flip_ingame.png'), fullPage: false });
await page.evaluate(() => {
  window.__spaceGame.setShip('beepbuggy');
  window.__spaceGame.protectP1?.();
});
await page.waitForTimeout(80);
await page.evaluate(() => window.__spaceGame.roadsterBoost(false));
await page.waitForTimeout(80);
await page.screenshot({ path: join(OUT, 'tesla_roadsters_boost_beepbuggy.png'), fullPage: false });

await browser.close();
console.log('wrote screenshots to', OUT);
