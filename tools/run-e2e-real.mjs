/**
 * CI-style runner for the production build + Playwright E2E.
 *
 * Local only: `node tools/run-e2e-real.mjs --local` (in-memory server + weltraum-dev).
 * Production Maincloud is refused so tests never mint ghost player rows.
 */
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

const PREVIEW_URL = 'http://localhost:4173';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '') || process.cwd();
const LOCAL = process.argv.includes('--local');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

function portOpen(port) {
  return new Promise(resolve => {
    const sock = createConnection({ port, host: '127.0.0.1' }, () => {
      sock.end();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
  });
}

async function waitForPort(port, label, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portOpen(port)) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label} on :${port}`);
}

async function waitForPortClosed(port, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await portOpen(port))) return;
    await sleep(250);
  }
}

async function main() {
  let stdbProc = null;
  let previewProc = null;

  const cleanup = () => {
    if (previewProc) previewProc.kill('SIGTERM');
    if (stdbProc) stdbProc.kill('SIGTERM');
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });

  if (!LOCAL && process.env.E2E_ALLOW_PRODUCTION !== '1') {
    throw new Error('Refusing to run E2E against Maincloud. Use `npm run test:e2e:local` (or --local).');
  }

  if (LOCAL) {
    if (!(await portOpen(3000))) {
      console.log('[e2e] starting spacetime start --in-memory');
      stdbProc = spawn('spacetime', ['start', '--in-memory'], { cwd: ROOT, stdio: 'inherit' });
      await waitForPort(3000, 'SpacetimeDB');
      await sleep(1000);
    } else {
      console.log('[e2e] SpacetimeDB already listening on :3000');
    }
    console.log('[e2e] publishing module to LOCAL server only (not Maincloud)');
    await run('npm', ['run', 'build'], { cwd: `${ROOT}/server/spacetimedb` });
    await run('spacetime', ['publish', '--server', 'http://localhost:3000', '--anonymous', '-y', 'weltraum-dev'], {
      cwd: `${ROOT}/server/spacetimedb`,
    });
  } else {
    console.log('[e2e] Maincloud target: https://maincloud.spacetimedb.com / weltraum-mission');
    console.log('[e2e] will NOT publish or modify the remote module');
  }

  console.log('[e2e] building production game');
  const buildEnv = { ...process.env };
  if (LOCAL) {
    buildEnv.E2E_LOCAL = '1';
    // Guest play is the default for local e2e; do not bake a leftover Firebase config.
    delete buildEnv.VITE_FIREBASE_API_KEY;
    delete buildEnv.VITE_FIREBASE_AUTH_DOMAIN;
    delete buildEnv.VITE_FIREBASE_PROJECT_ID;
    delete buildEnv.VITE_FIREBASE_APP_ID;
    delete buildEnv.VITE_FIREBASE_AUTH_EMULATOR;
  }
  await run('npm', ['run', 'build'], LOCAL ? { env: buildEnv } : undefined);

  if (await portOpen(4173)) {
    console.log('[e2e] stopping leftover preview on :4173');
    try { await run('fuser', ['-k', '4173/tcp']); } catch {
      await new Promise((resolve) => {
        const child = spawn('bash', ['-lc', 'lsof -ti tcp:4173 | xargs -r kill'], { stdio: 'ignore', cwd: ROOT });
        child.on('exit', () => resolve());
        child.on('error', () => resolve());
      });
    }
    await waitForPortClosed(4173);
  }
  console.log('[e2e] starting vite preview on :4173');
  previewProc = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  await waitForPort(4173, 'vite preview');

  const html = await fetch(PREVIEW_URL).then(r => r.text());
  if (!html.includes('__spaceGame') || !html.includes('/assets/')) {
    throw new Error('Built game is not being served (missing __spaceGame or bundled assets)');
  }
  if (!LOCAL && html.includes('http://localhost:*')) {
    throw new Error('Production HTML still allows localhost in CSP');
  }
  if (!html.includes('https://maincloud.spacetimedb.com') || !html.includes('wss://maincloud.spacetimedb.com')) {
    throw new Error('Production HTML missing Maincloud connect-src hosts');
  }
  if (!html.includes('identitytoolkit.googleapis.com') || !html.includes('securetoken.googleapis.com') || !html.includes('apis.google.com') || !html.includes('accounts.google.com') || !html.includes('www.gstatic.com') || !html.includes('www.googleapis.com') || !html.includes('*.peerjs.com')) {
    throw new Error('Production HTML missing Firebase / Google / PeerJS CSP hosts');
  }
  if (!/script-src[^;]*https:\/\/apis\.google\.com/.test(html) || !/script-src[^;]*https:\/\/www\.gstatic\.com/.test(html)) {
    throw new Error('Production HTML script-src missing Firebase gapi / gstatic hosts');
  }
  if (html.includes('auth.spacetimedb.com')) {
    throw new Error('Production HTML still allows SpacetimeAuth host');
  }
  console.log('[e2e] preview is serving the bundled game (' + html.length + ' bytes HTML)');

  const env = {
    ...process.env,
    E2E_BASE_URL: PREVIEW_URL,
  };
  if (LOCAL) {
    env.E2E_STDB_QS = 'stdb_host=localhost:3000&stdb_module=weltraum-dev&stdb_ssl=false';
    env.E2E_EXPECT_HOST = 'localhost:3000';
    env.E2E_EXPECT_MODULE = 'weltraum-dev';
  } else {
    delete env.E2E_STDB_QS;
    env.E2E_EXPECT_HOST = 'maincloud.spacetimedb.com';
    env.E2E_EXPECT_MODULE = 'weltraum-mission';
  }

  console.log('[e2e] running Playwright suite');
  await run('npx', ['vitest', 'run', 'tests/e2e-real.test.ts', 'tests/play-ipad.test.ts', 'tests/lazy-load.test.ts', 'tests/online-multiplayer.test.ts', 'tests/onboarding-e2e.test.ts', 'tests/ipad-webkit.test.ts'], { env });

  if (previewProc) previewProc.kill('SIGTERM');
  console.log('[e2e] real suite passed');
}

main().catch(err => {
  console.error('[e2e] FAILED:', err);
  process.exit(1);
});
