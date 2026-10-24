#!/usr/bin/env node
/** L250 Kaiser wide HP bar screenshot (docs/stage1/kaiser-hpbar.png). */
import { chromium } from 'playwright';
import { mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4186';
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots';
const DOCS = join(process.cwd(), 'docs/stage1');
mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

async function capture(page, name, clip) {
  const dest = join(OUT, name);
  await page.screenshot({ path: dest, clip });
  copyFileSync(dest, join(DOCS, name));
  console.log('wrote', join(DOCS, name));
}

async function boot(page) {
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
  const info = await page.evaluate(() => {
    const out = window.__spaceGame.forcePrimePhase(24);
    const msg = document.getElementById('msg');
    if (msg) { msg.innerHTML = ''; msg.className = ''; }
    return out;
  });
  await page.waitForTimeout(250);
  return info;
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const shots = [
  { name: 'kaiser-hpbar.png', viewport: { width: 768, height: 1024 }, clip: { x: 0, y: 0, width: 768, height: 240 } },
  { name: 'kaiser-hpbar-landscape.png', viewport: { width: 1024, height: 768 }, clip: { x: 0, y: 0, width: 1024, height: 220 } },
  { name: 'kaiser-hpbar-phone.png', viewport: { width: 390, height: 844 }, clip: { x: 0, y: 0, width: 390, height: 260 } },
];

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: shot.viewport.width < 700,
  });
  const page = await context.newPage();
  const info = await boot(page);
  console.log(shot.name, info);
  await capture(page, shot.name, shot.clip);
  await context.close();
}

await browser.close();
