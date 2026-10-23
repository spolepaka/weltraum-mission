#!/usr/bin/env node
/** Stage 2 kid-fun 1 vs 1 screenshots: rank badge, stats card, sudden-death + pickups. */
import { chromium } from 'playwright';
import { mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots';
const DOCS = join(process.cwd(), 'docs/versus');
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

async function shot(kind, lang, name) {
  await page.evaluate((next) => window.__spaceGame.setLang?.(next), lang);
  const info = await page.evaluate((k) => window.__spaceGame.showVersusFunDemo(k), kind);
  await page.waitForTimeout(220);
  const file = `${name}.png`;
  const dest = join(OUT, file);
  await page.screenshot({ path: dest });
  copyFileSync(dest, join(DOCS, file));
  return info;
}

const rankEn = await shot('rank', 'en', 'versus_fun_rank_en');
const rankDe = await shot('rank', 'de', 'versus_fun_rank_de');
const statsEn = await shot('stats', 'en', 'versus_fun_stats_en');
const statsDe = await shot('stats', 'de', 'versus_fun_stats_de');
const suddenEn = await shot('sudden', 'en', 'versus_fun_sudden_en');

console.log(JSON.stringify({ rankEn, rankDe, statsEn, statsDe, suddenEn }, null, 2));
await browser.close();
