#!/usr/bin/env node
/** Online Co-op first-screen screenshots: empty + listed, EN and DE. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts';
const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const SAMPLE = [
  { code: 'HACK3', hostName: 'Mighty Comet', level: 12, players: 2 },
  { code: 'TREK4', hostName: 'Luna', level: 4, players: 1 },
];

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
await page.waitForTimeout(250);

async function openOnline(lang) {
  await page.evaluate((next) => {
    const g = window.__spaceGame;
    g.setLang?.(next);
    g.openOnline();
    document.getElementById('onlineScreen')?.classList.remove('hidden');
  }, lang);
  await page.waitForSelector('#onlineScreen:not(.hidden)');
  await page.waitForTimeout(200);
}

await openOnline('en');
await page.evaluate(() => window.__spaceGame.injectPublicRooms([]));
await page.waitForTimeout(150);
await page.screenshot({ path: join(OUT, 'online_coop_empty_en.png') });

await page.evaluate((rows) => window.__spaceGame.injectPublicRooms(rows), SAMPLE);
await page.waitForTimeout(150);
await page.screenshot({ path: join(OUT, 'online_coop_listed_en.png') });

await openOnline('de');
await page.evaluate(() => window.__spaceGame.injectPublicRooms([]));
await page.waitForTimeout(150);
await page.screenshot({ path: join(OUT, 'online_coop_empty_de.png') });

await page.evaluate((rows) => window.__spaceGame.injectPublicRooms(rows), SAMPLE);
await page.waitForTimeout(150);
await page.screenshot({ path: join(OUT, 'online_coop_listed_de.png') });

const text = await page.evaluate(() => window.__spaceGame.publicRoomsText());
console.log('publicRoomsText', text);
await browser.close();
