#!/usr/bin/env node
/** L250 Kaiser 31–50 + death-v2 screenshots. */
import { chromium } from 'playwright';
import { mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4186';
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots';
const DOCS = join(process.cwd(), 'docs/stage1');
mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

function save(src, name) {
  const dest = join(DOCS, name);
  copyFileSync(src, dest);
  console.log('wrote', dest);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__spaceGame, { timeout: 20000 });
await page.evaluate(() => {
  const g = window.__spaceGame;
  g.finishOnboard?.();
  g.skipTraining?.();
  g.skipMapTour?.();
  document.getElementById('welcomeScreen')?.classList.add('hidden');
  document.getElementById('namePickScreen')?.classList.add('hidden');
  g.unlockTo?.(250);
  g.startLevel?.(250);
});
await page.waitForTimeout(400);
await page.evaluate(() => window.__spaceGame.forcePrimePhase(31));
await page.waitForTimeout(200);

for (let ph = 31; ph <= 50; ph++) {
  const info = await page.evaluate((n) => {
    const out = window.__spaceGame.forcePrimePhase(n);
    const msg = document.getElementById('msg');
    if (msg) { msg.innerHTML = ''; msg.className = ''; }
    return out;
  }, ph);
  await page.waitForTimeout(ph === 38 || ph === 50 ? 850 : 650);
  const file = `kaiser-p${ph}.png`;
  const dest = join(OUT, file);
  await page.screenshot({ path: dest });
  save(dest, file);
  console.log('phase', ph, info);
}

await page.evaluate(() => window.__spaceGame.startPrimeDeath());
await page.evaluate(() => window.__spaceGame.stepPrimeDeath(3.2));
const boomPath = join(OUT, 'kaiser-explosion-v2.png');
await page.screenshot({ path: boomPath });
save(boomPath, 'kaiser-explosion-v2.png');
const death = await page.evaluate(() => window.__spaceGame.stepPrimeDeath(0));
console.log('death', death);

await browser.close();
