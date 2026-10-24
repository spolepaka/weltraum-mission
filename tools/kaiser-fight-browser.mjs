import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || '4177';
const url = `http://127.0.0.1:${PORT}/`;
const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', PORT, '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
const ready = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview timeout')), 20000);
  const on = (buf) => {
    if (String(buf).includes('Local:') || String(buf).includes(PORT)) {
      clearTimeout(t);
      resolve(true);
    }
  };
  preview.stdout.on('data', on);
  preview.stderr.on('data', on);
});
if (!ready) throw new Error('preview not ready');

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
const consoleLines = [];
page.on('console', (msg) => consoleLines.push(`${msg.type()}: ${msg.text()}`));
page.on('pageerror', (err) => consoleLines.push(`pageerror: ${err.message}`));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__spaceGame && window.__spaceGame.runKaiserSafetySim, { timeout: 20000 });
await page.evaluate(() => {
  try { window.__spaceGame.finishOnboard?.(); } catch (e) {}
});
const report = await page.evaluate(() => window.__spaceGame.runKaiserSafetySim({ seconds: 20, noDraw: false }));
await browser.close();
preview.kill();
const bad = consoleLines.filter((l) => /^error:|^pageerror:/.test(l) && !/ResizeObserver/.test(l));
console.log(JSON.stringify({ report, console: consoleLines.slice(0, 40), bad }, null, 2));
if (report.errors.length || report.nan || bad.length || report.depth > 2) process.exit(1);
