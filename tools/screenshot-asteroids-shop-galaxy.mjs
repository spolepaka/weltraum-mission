#!/usr/bin/env node
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots';
const DOCS = join(process.cwd(), 'docs/stage-asteroids-shop-galaxy');
const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';

mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1024, height: 768 },
  deviceScaleFactor: 2,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__spaceGame && typeof window.__spaceGame.finishOnboard === 'function');
await page.evaluate(() => {
  const g = window.__spaceGame;
  g.finishOnboard();
  g.skipTraining?.();
  g.skipMapTour?.();
  document.getElementById('welcomeScreen')?.classList.add('hidden');
  document.getElementById('onboardScreen')?.classList.add('hidden');
  document.getElementById('namePickScreen')?.classList.add('hidden');
  document.getElementById('coachMark')?.classList.add('hidden');
});
await page.waitForTimeout(200);

await page.evaluate(() => {
  const g = window.__spaceGame;
  g.applyRemoteProgress?.({ coins: 500, unlocked: 250, replace: false });
  document.getElementById('shopBtn')?.click();
  g.shopBuyInfo?.('rivet');
});
await page.waitForTimeout(250);
const shopBuy = join(OUT, 'shop_buy_button.png');
await page.screenshot({ path: shopBuy });
copyFileSync(shopBuy, join(DOCS, 'shop_buy_button.png'));

await page.evaluate(() => {
  document.getElementById('shopClose')?.click();
  const g = window.__spaceGame;
  g.applyRemoteProgress?.({ unlocked: 250, replace: false });
  g.goToMap?.();
  g.setMapWorld?.(0);
});
await page.waitForTimeout(200);
const galaxy1 = join(OUT, 'galaxy_home.png');
await page.screenshot({ path: galaxy1 });
copyFileSync(galaxy1, join(DOCS, 'galaxy_home.png'));

await page.evaluate(() => {
  const g = window.__spaceGame;
  g.setMapWorld?.(3);
});
await page.waitForTimeout(280);
const galaxySwipe = join(OUT, 'galaxy_swipe.png');
await page.screenshot({ path: galaxySwipe });
copyFileSync(galaxySwipe, join(DOCS, 'galaxy_swipe.png'));

await page.evaluate(() => {
  const g = window.__spaceGame;
  document.getElementById('shopScreen')?.classList.add('hidden');
  g.startLevel?.(1);
  g.spawnVersusRock?.(1);
  g.spawnVersusRock?.(2);
});
await page.waitForTimeout(350);
const rocks = join(OUT, 'versus_asteroid_sides.png');
await page.screenshot({ path: rocks });
copyFileSync(rocks, join(DOCS, 'versus_asteroid_sides.png'));

const info = await page.evaluate(() => {
  const g = window.__spaceGame;
  return {
    shop: g.shopBuyInfo?.('rivet'),
    map: g.mapInfo?.(),
    rocks: g.versusRocks?.(),
    hit: { p1own: g.versusHitCheck?.(1, 2), p1in: g.versusHitCheck?.(1, 1) },
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
