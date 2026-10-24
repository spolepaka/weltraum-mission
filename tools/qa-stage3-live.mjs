#!/usr/bin/env node
/**
 * Stage 3 leftover live flows: two-browser rooms, approve/reject,
 * account/sign-in UI, admin funnel, online count. Writes docs/qa/stage3-live.json.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4177';
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots';
const DOCS = join(process.cwd(), 'docs/qa');
const REPORT = join(DOCS, 'stage3-live.json');

mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

const errors = [];
const notes = [];
const shots = [];

function log(msg) {
  notes.push(msg);
  console.log(msg);
}

async function shot(page, name) {
  const dest = join(OUT, `${name}.png`);
  await page.screenshot({ path: dest });
  copyFileSync(dest, join(DOCS, `${name}.png`));
  shots.push(name);
}

async function boot(browser, size = { width: 1024, height: 768 }, path = '/') {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push({ type: 'pageerror', message: String(err) }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ type: 'console', message: msg.text() });
  });
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__spaceGame, { timeout: 20000 });
  await page.evaluate(() => {
    const g = window.__spaceGame;
    g.finishOnboard?.();
    g.skipTraining?.();
    g.skipMapTour?.();
    document.getElementById('welcomeScreen')?.classList.add('hidden');
    document.getElementById('namePickScreen')?.classList.add('hidden');
  });
  await page.evaluate(() => window.__weltraum?.ensureCloud?.());
  await page.waitForFunction(() => window.__weltraum?.spacetime?.isConnected?.(), { timeout: 15000 }).catch(() => null);
  return { context, page };
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

// --- Favicon ---
{
  const res = await fetch(`${BASE}/favicon.ico`).catch((e) => ({ ok: false, status: 0, err: String(e) }));
  const svg = await fetch(`${BASE}/favicon.svg`).catch((e) => ({ ok: false, status: 0, err: String(e) }));
  log(`favicon.ico status=${res.status} svg=${svg.status}`);
  if (!res.ok) errors.push({ type: 'bug', message: `favicon.ico ${res.status}` });
}

// --- Account / sign-in UI (Google popup cannot complete headless) ---
{
  const { context, page } = await boot(browser);
  await page.click('#accountBtn');
  await page.waitForTimeout(400);
  const acc = await page.evaluate(() => ({
    google: document.getElementById('accountGoogle')?.textContent || '',
    email: !!document.getElementById('accountEmail'),
    emailLink: document.getElementById('accountEmailLink')?.textContent || '',
    signOutHidden: document.getElementById('accountSignOut')?.classList.contains('hidden'),
    guest: document.getElementById('accountWho')?.textContent || document.body.innerText.slice(0, 200),
  }));
  log(`account ui: google=${acc.google} email=${acc.email} signOutHidden=${acc.signOutHidden}`);
  await shot(page, 'qa-account-signin-ui');
  if (!acc.google) errors.push({ type: 'bug', message: 'Google sign-in button missing' });
  if (!acc.email) errors.push({ type: 'bug', message: 'Parent email field missing' });
  await context.close();
}

// --- Admin funnel via ?admin=1 ---
{
  const { context, page } = await boot(browser, { width: 1024, height: 768 }, '/?admin=1');
  await page.waitForTimeout(1400);
  const admin = await page.evaluate(() => ({
    visible: !document.getElementById('adminScreen')?.classList.contains('hidden'),
    title: document.getElementById('adminTitle')?.textContent || '',
    body: (document.getElementById('adminFunnel')?.textContent || '').slice(0, 240),
    onlineHud: document.getElementById('onlineNowHud')?.textContent || '',
    onlineMap: document.getElementById('onlineNowMap')?.textContent || '',
  }));
  log(`admin visible=${admin.visible} title=${admin.title} onlineHud=${admin.onlineHud} onlineMap=${admin.onlineMap} body=${admin.body.slice(0, 120)}`);
  await shot(page, 'qa-admin-funnel');
  await context.close();
}

// --- Two-browser public room + join + approve ---
{
  const host = await boot(browser);
  const guest = await boot(browser);
  await host.page.evaluate(() => {
    try { localStorage.setItem('spaceMissionAskToJoin', '1'); } catch (e) {}
    window.__spaceGame?.coop?.setAsk?.(true);
    window.__spaceGame.openOnline();
  });
  await host.page.waitForTimeout(200);
  await host.page.click('#onHost');
  await host.page.waitForFunction(() => {
    const t = document.getElementById('onCodeShow')?.textContent || '';
    return t.length >= 4 && !t.includes('·');
  }, { timeout: 25000 }).catch(() => null);
  await host.page.waitForFunction(() => {
    const g = window.__spaceGame;
    const n = g?.net?.() || {};
    const listed = g?.roomListNow?.();
    return !!(n.peerReady || listed?.peerReady || listed?.listed);
  }, { timeout: 20000 }).catch(() => null);
  const hostInfo = await host.page.evaluate(() => {
    const g = window.__spaceGame;
    const n = g.net?.() || {};
    return {
      code: document.getElementById('onCodeShow')?.textContent || '',
      listed: g.roomListNow?.(),
      net: { role: n.role, peerReady: n.peerReady, connected: n.connected, versus: n.versus },
    };
  });
  log(`coop host: ${JSON.stringify(hostInfo)}`);
  await shot(host.page, 'qa-coop-host-live');

  await guest.page.evaluate(() => window.__spaceGame.openOnline());
  let guestList = '';
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    guestList = await guest.page.evaluate(() => window.__spaceGame?.publicRoomsText?.() || document.getElementById('onRoomRows')?.innerText || '');
    if (hostInfo.code && guestList.includes(hostInfo.code)) break;
    await guest.page.waitForTimeout(400);
  }
  log(`coop guest list after wait: ${guestList.slice(0, 220)}`);
  await shot(guest.page, 'qa-coop-guest-list-live');
  if (hostInfo.code && !guestList.includes(hostInfo.code)) {
    errors.push({ type: 'gap', message: `guest list missed host ${hostInfo.code} after 12s: ${guestList.slice(0, 80)}` });
  }

  if (hostInfo.code) {
    await guest.page.evaluate((code) => {
      const input = document.getElementById('onCode');
      if (input) input.value = code;
    }, hostInfo.code);
    const joinBtn = guest.page.locator('#onGo, #onJoin');
    if (await guest.page.locator('#onJoin').count()) {
      await guest.page.click('#onJoin').catch(() => {});
    }
    await guest.page.fill('#onCode', hostInfo.code).catch(() => {});
    if (await guest.page.locator('#onGo').count()) {
      await guest.page.click('#onGo').catch(() => {});
    }
    await guest.page.waitForTimeout(2500);
    const pending = await host.page.evaluate(() => {
      const g = window.__spaceGame;
      return {
        pending: g.coop?.pending?.() || [],
        net: g.net?.(),
      };
    });
    log(`after join: pending=${JSON.stringify(pending.pending)} hostNet=${JSON.stringify(pending.net && { role: pending.net.role, guests: pending.net.guests, connected: pending.net.connected })}`);
    await shot(host.page, 'qa-coop-approve-prompt');
    const peer = pending.pending?.[0]?.peerId;
    if (peer) {
      await host.page.evaluate((id) => window.__spaceGame?.coop?.approve?.(id), peer);
      await host.page.waitForTimeout(800);
      await shot(host.page, 'qa-coop-approved');
      log('approved pending guest');
    } else if (pending.net?.guests?.some?.((g) => g.ok)) {
      log('guest auto-admitted (ask-to-join off or already ok)');
    } else {
      errors.push({ type: 'gap', message: 'join did not produce pending or connected guest' });
    }
  }

  await host.context.close();
  await guest.context.close();
}

// --- Versus two-browser host + guest list ---
{
  const host = await boot(browser);
  const guest = await boot(browser);
  await host.page.evaluate(() => window.__spaceGame.openOnline());
  await host.page.waitForTimeout(200);
  await host.page.click('#onVersus');
  await host.page.waitForFunction(() => {
    const t = document.getElementById('onCodeShow')?.textContent || '';
    return t.length >= 4 && !t.includes('·');
  }, { timeout: 25000 }).catch(() => null);
  const vsHost = await host.page.evaluate(() => ({
    code: document.getElementById('onCodeShow')?.textContent || '',
    title: document.getElementById('onlineTitle')?.textContent || '',
    status: document.getElementById('onStatus')?.textContent || '',
  }));
  log(`versus host: ${JSON.stringify(vsHost)}`);
  await shot(host.page, 'qa-versus-host-live');
  await guest.page.evaluate(() => window.__spaceGame.openOnline());
  let duels = '';
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    duels = await guest.page.evaluate(() => document.getElementById('onDuelRows')?.innerText || '');
    if (vsHost.code && duels.includes(vsHost.code)) break;
    await guest.page.waitForTimeout(400);
  }
  log(`versus guest duels: ${duels.slice(0, 220)}`);
  await shot(guest.page, 'qa-versus-guest-list-live');
  await host.context.close();
  await guest.context.close();
}

await browser.close();

const report = {
  base: BASE,
  at: new Date().toISOString(),
  errors,
  notes,
  shots,
  errorCount: errors.length,
};
writeFileSync(REPORT, JSON.stringify(report, null, 2));
copyFileSync(REPORT, join(OUT, 'stage3-live.json'));
console.log(JSON.stringify({ errorCount: errors.length, shots: shots.length, notes: notes.length }, null, 2));
