#!/usr/bin/env node
/** Quick L250 Kaiser 21–30 + drone-storm + death-blast screenshots. */
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
await page.evaluate(() => window.__spaceGame.forcePrimePhase(21));
await page.waitForTimeout(200);

for (let ph = 21; ph <= 30; ph++) {
  const info = await page.evaluate((n) => {
    const out = window.__spaceGame.forcePrimePhase(n);
    const msg = document.getElementById('msg');
    if (msg) { msg.innerHTML = ''; msg.className = ''; }
    return out;
  }, ph);
  await page.waitForTimeout(ph === 28 ? 800 : 650);
  const file = `kaiser-p${ph}.png`;
  const dest = join(OUT, file);
  await page.screenshot({ path: dest });
  save(dest, file);
  console.log('phase', ph, info);
}

await page.evaluate(() => {
  window.__spaceGame.forcePrimePhase(28);
  const msg = document.getElementById('msg');
  if (msg) { msg.innerHTML = ''; msg.className = ''; }
});
await page.waitForTimeout(700);
const drones = await page.evaluate(() => window.__spaceGame.stormDrones?.() || []);
const side = drones.filter((d) => d.y > 80 && d.y < 700).sort((a, b) => a.x - b.x)[0] || drones[0];
const sx = Math.max(0, Math.round((side?.x || 200) - 130));
const sy = Math.max(0, Math.round((side?.y || 280) - 130));
const stormPath = join(OUT, 'kaiser-drone-storm.png');
await page.screenshot({
  path: stormPath,
  clip: { x: sx, y: sy, width: 300, height: 280 },
});
save(stormPath, 'kaiser-drone-storm.png');

await page.evaluate(() => window.__spaceGame.startPrimeDeath());
await page.evaluate(() => window.__spaceGame.stepPrimeDeath(1.24));
const boomPath = join(OUT, 'kaiser-explosion.png');
await page.screenshot({ path: boomPath });
save(boomPath, 'kaiser-explosion.png');
const death = await page.evaluate(() => window.__spaceGame.stepPrimeDeath(0));
console.log('death', death, 'stormClip', { sx, sy, side, n: drones.length });

await browser.close();
