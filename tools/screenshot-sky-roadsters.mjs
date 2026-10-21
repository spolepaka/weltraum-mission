#!/usr/bin/env node
/** Capture Tesla Roadster shop tab + in-flight shots + ref vs sprite. */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  window.__spaceGame.shopSel?.('beepbuggy');
});
await page.waitForTimeout(450);
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
  window.__spaceGame.shopSel?.('beepbuggy');
  window.__spaceGame.openShopTab(5);
});
await page.waitForTimeout(350);
const previewPng = await page.evaluate(() => {
  const cv = document.getElementById('shopPreview');
  return cv && cv.toDataURL ? cv.toDataURL('image/png') : '';
});
if (previewPng) {
  writeFileSync(join(OUT, 'tesla_roadsters_shop_base_preview.png'), Buffer.from(previewPng.split(',')[1], 'base64'));
}

await page.evaluate(() => {
  document.getElementById('shopScreen')?.classList.add('hidden');
});

for (const id of IDS) {
  await page.evaluate((shipId) => {
    const g = window.__spaceGame;
    g.setShip(shipId);
    g.protectP1?.();
    g.startLevel(1);
  }, id);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `tesla_roadsters_flight_${id}.png`), fullPage: false });
}

const sprites = {};
for (const id of IDS) {
  const dataUrl = await page.evaluate((shipId) => window.__spaceGame.drawShipPng(shipId, 360), id);
  sprites[id] = dataUrl.split(',')[1];
  writeFileSync(join(OUT, `tesla_roadsters_sprite_${id}.png`), Buffer.from(sprites[id], 'base64'));
}

const cmp = await context.newPage();
const refTop = readFileSync('/opt/cursor/artifacts/ref_roadster_top_view.png').toString('base64');
const refFront = readFileSync('/opt/cursor/artifacts/ref_roadster_front_34.png').toString('base64');
const previewB64 = sprites.beepbuggy || (previewPng ? previewPng.split(',')[1] : '');
await cmp.setContent(`<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#111;color:#f4f4f4;font:16px/1.35 Trebuchet MS,Arial,sans-serif}
  h1{font-size:22px;margin:16px 20px 8px}
  .row{display:flex;gap:16px;padding:12px 20px 24px}
  figure{flex:1;margin:0;background:#1b1b22;border-radius:12px;padding:12px;text-align:center}
  img{max-width:100%;height:320px;object-fit:contain;background:#222}
  figcaption{margin-top:10px;font-size:14px;color:#ccc}
</style></head><body>
  <h1>Official 2nd-gen Tesla Roadster vs Roadster Base sprite</h1>
  <div class="row">
    <figure>
      <img src="data:image/png;base64,${refTop}" alt="Official top view">
      <figcaption>Official aerial (2nd-gen Tesla Roadster)</figcaption>
    </figure>
    <figure>
      <img src="data:image/png;base64,${previewB64}" alt="Roadster Base shop sprite">
      <figcaption>Our Roadster Base (Multi-Coat Red) hangar sprite</figcaption>
    </figure>
    <figure>
      <img src="data:image/png;base64,${refFront}" alt="Official 3/4 front">
      <figcaption>Official 3/4 studio (blunt wedge, slim light bar, T)</figcaption>
    </figure>
  </div>
</body></html>`);
await cmp.setViewportSize({ width: 1400, height: 520 });
await cmp.waitForTimeout(200);
await cmp.screenshot({ path: join(OUT, 'tesla_roadsters_ref_vs_base.png'), fullPage: false });

await browser.close();
console.log('wrote screenshots to', OUT);
