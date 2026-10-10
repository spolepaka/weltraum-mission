/**
 * WebKit + Auth emulator: popup and redirect Google sign-in.
 */
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '') || process.cwd();
const AUTH_PORT = 9099;
const PREVIEW_PORT = 4176;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function portOpen(port) {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: '127.0.0.1' }, () => {
      sock.end();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
  });
}

async function waitForPort(port, label, timeoutMs = 60000) {
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

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

async function killPort(port) {
  try {
    await run('fuser', ['-k', `${port}/tcp`]);
    return;
  } catch {
    // fuser is optional
  }
  await new Promise((resolve) => {
    const child = spawn('bash', ['-lc', `lsof -ti tcp:${port} | xargs -r kill`], {
      stdio: 'ignore',
      cwd: ROOT,
    });
    child.on('exit', () => resolve());
    child.on('error', () => resolve());
  });
}

async function startPreview(port, env) {
  if (await portOpen(port)) {
    await killPort(port);
    await waitForPortClosed(port);
  }
  const preview = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: 'inherit', env },
  );
  await waitForPort(port, `vite preview (webkit-auth :${port})`);
  return preview;
}

async function main() {
  let emu = null;
  let preview = null;
  const startedEmu = !(await portOpen(AUTH_PORT));

  const cleanup = () => {
    if (preview) preview.kill('SIGTERM');
    if (emu) emu.kill('SIGTERM');
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });

  if (startedEmu) {
    console.log('[firebase-webkit] starting Auth emulator on :9099');
    emu = spawn(
      'npx',
      ['firebase', 'emulators:start', '--only', 'auth', '--project', 'demo-weltraum'],
      { cwd: ROOT, stdio: 'inherit' },
    );
    await waitForPort(AUTH_PORT, 'Firebase Auth emulator');
    await sleep(500);
  } else {
    console.log('[firebase-webkit] Auth emulator already on :9099');
  }

  const firebaseEnv = {
    VITE_FIREBASE_API_KEY: 'fake-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: `127.0.0.1:${PREVIEW_PORT}`,
    VITE_FIREBASE_PROJECT_ID: 'demo-weltraum',
    VITE_FIREBASE_APP_ID: '1:1:web:demo',
    VITE_FIREBASE_AUTH_EMULATOR: 'http://127.0.0.1:9099',
    E2E_LOCAL: '1',
  };

  console.log('[firebase-webkit] emulator build for WebKit popup/redirect');
  await run('npm', ['run', 'build'], { env: { ...process.env, ...firebaseEnv } });
  preview = await startPreview(PREVIEW_PORT, { ...process.env });

  const iframe = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/__/auth/iframe`);
  console.log(`[firebase-webkit] GET /__/auth/iframe → ${iframe.status}`);
  if (iframe.status >= 400) {
    throw new Error(`first-party auth iframe proxy failed: ${iframe.status}`);
  }

  await run('npx', ['vitest', 'run', 'tests/firebase-auth-webkit.test.ts'], {
    env: {
      ...process.env,
      E2E_BASE_URL: `http://127.0.0.1:${PREVIEW_PORT}`,
      VITE_FIREBASE_AUTH_EMULATOR: 'http://127.0.0.1:9099',
    },
  });

  cleanup();
  console.log('[firebase-webkit] suite passed');
}

main().catch((err) => {
  console.error('[firebase-webkit] FAILED:', err);
  process.exit(1);
});
