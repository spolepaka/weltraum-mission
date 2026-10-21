#!/usr/bin/env node
/** Capture Sky Roadsters shop tab + in-flight shots for the PR. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
await page.waitForTimeout(250);
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
await page.waitForTimeout(200);

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
});
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, 'sky_roadsters_shop_tab_en.png'), fullPage: false });

await page.evaluate(() => {
  window.__spaceGame.setLang?.('de');
  window.__spaceGame.openShopTab(5);
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'sky_roadsters_shop_tab_de.png'), fullPage: false });

await page.evaluate(() => {
  window.__spaceGame.setLang?.('en');
  document.getElementById('shopScreen')?.classList.add('hidden');
});

for (const id of IDS) {
  await page.evaluate((shipId) => {
    const g = window.__spaceGame;
    g.setShip(shipId);
    g.protectP1?.();
    g.startLevel(1);
  }, id);
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(OUT, `sky_roadsters_flight_${id}.png`), fullPage: false });
}

await browser.close();
console.log('wrote screenshots to', OUT);
