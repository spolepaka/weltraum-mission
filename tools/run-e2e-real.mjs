/**
 * CI-style runner: local SpacetimeDB + published module + built game + Playwright E2E.
 * Does NOT publish to Maincloud.
 */
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

const STDB_URL = 'http://localhost:3000';
const PREVIEW_URL = 'http://localhost:4173';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '') || process.cwd();

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

async function main() {
  let stdbProc = null;
  let previewProc = null;

  const cleanup = () => {
    if (previewProc) previewProc.kill('SIGTERM');
    if (stdbProc) stdbProc.kill('SIGTERM');
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });

  if (!(await portOpen(3000))) {
    console.log('[e2e] starting spacetime start --in-memory');
    stdbProc = spawn('spacetime', ['start', '--in-memory'], { cwd: ROOT, stdio: 'inherit' });
    await waitForPort(3000, 'SpacetimeDB');
    await sleep(1000);
  } else {
    console.log('[e2e] SpacetimeDB already listening on :3000');
  }

  console.log('[e2e] building + publishing module to local server (not Maincloud)');
  await run('npm', ['run', 'build'], { cwd: `${ROOT}/server/spacetimedb` });
  await run('spacetime', ['publish', '--server', STDB_URL, 'weltraum-dev'], { cwd: `${ROOT}/server/spacetimedb` });

  console.log('[e2e] building game (Vercel output)');
  await run('npm', ['run', 'build']);

  if (await portOpen(4173)) {
    console.log('[e2e] stopping leftover preview on :4173');
    try { await run('fuser', ['-k', '4173/tcp']); } catch { /* ignore */ }
    await sleep(500);
  }
  console.log('[e2e] starting vite preview on :4173');
  previewProc = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  await waitForPort(4173, 'vite preview');

  // sanity: preview serves the game, not the stub
  const html = await fetch(PREVIEW_URL).then(r => r.text());
  if (!html.includes('__spaceGame') || !html.includes('/assets/')) {
    throw new Error('Built game is not being served (missing __spaceGame or bundled assets)');
  }
  console.log('[e2e] preview is serving the bundled game (' + html.length + ' bytes HTML)');

  console.log('[e2e] running Playwright suite');
  await run('npx', ['vitest', 'run', 'tests/e2e-real.test.ts'], {
    env: { ...process.env, E2E_BASE_URL: PREVIEW_URL },
  });

  if (previewProc) previewProc.kill('SIGTERM');
  console.log('[e2e] real suite passed');
}

main().catch(err => {
  console.error('[e2e] FAILED:', err);
  process.exit(1);
});
