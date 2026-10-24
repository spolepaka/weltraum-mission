import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const outDir = new URL('../docs/stage1/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  localStorage.setItem('spaceMissionOnboard', JSON.stringify({
    welcomeDone: true, trainDone: true, mapTourDone: true, nameDone: true,
  }));
});
await page.goto(new URL('../public/index.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__spaceGame && window.__spaceGame.drawOuterSheet, { timeout: 15000 });

async function savePng(name, dataUrl) {
  const b64 = String(dataUrl).split(',')[1];
  const dest = new URL(name, outDir);
  writeFileSync(dest, Buffer.from(b64, 'base64'));
  console.log('wrote', dest.pathname, Buffer.from(b64, 'base64').length);
}

const sheet = await page.evaluate(() => window.__spaceGame.drawOuterSheet());
const kaiser = await page.evaluate(() => window.__spaceGame.drawKaiserCompare());
const bosses = await page.evaluate(() => window.__spaceGame.drawLateBossSheet());
const stats = await page.evaluate(() => window.__spaceGame.drawOuterStatsTable());
const specials = await page.evaluate(() => window.__spaceGame.drawSpecialSheet());
const phases = await page.evaluate(() => window.__spaceGame.drawPrimePhaseStrip());
await savePng('outer-fleet-contact-sheet.png', sheet);
await savePng('kaiser-100-vs-250.png', kaiser);
await savePng('bosses-101-249-contact-sheet.png', bosses);
await savePng('outer-fleet-stats-prices.png', stats);
await savePng('special-ships-contact-sheet.png', specials);
await savePng('kaiser-250-phase-strip.png', phases);

const l100 = await page.evaluate(() => {
  const spec = window.__spaceGame.bossIconOk ? window.__spaceGame.bossIconOk() : [];
  return { spec, state: window.__spaceGame.state().state };
});
console.log(JSON.stringify(l100));
await browser.close();
