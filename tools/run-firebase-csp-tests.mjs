/**
 * Production-CSP Playwright for Firebase Auth:
 *  1) Google sign-in against the real web config (no localhost in CSP)
 *  2) Email link against the Auth emulator
 *
 * Reads VITE_FIREBASE_* from the environment (do not commit apiKey).
 */
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '') || process.cwd();
const AUTH_PORT = 9099;
const GOOGLE_PORT = 4174;
const EMAIL_PORT = 4175;

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

function requiredFirebaseEnv() {
  const keys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
  ];
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Firebase CSP tests need ${missing.join(', ')} in the environment (public web config; do not commit the apiKey).`);
  }
  return {
    VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  };
}

async function killPort(port) {
  try {
    await run('fuser', ['-k', `${port}/tcp`]);
    return;
  } catch {
    // fuser is optional
  }
  await new Promise((resolve) => {
    const child = spawn('bash', ['-lc', `ss -lptn "sport = :${port}" | sed -n 's/.*pid=\\([0-9]*\\).*/\\1/p' | sort -u | xargs -r kill`], {
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
  await waitForPort(port, `vite preview (csp :${port})`);
  return preview;
}

async function main() {
  const firebaseEnv = requiredFirebaseEnv();
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
    console.log('[firebase-csp] starting Auth emulator on :9099');
    emu = spawn(
      'npx',
      ['firebase', 'emulators:start', '--only', 'auth', '--project', 'demo-weltraum'],
      { cwd: ROOT, stdio: 'inherit' },
    );
    await waitForPort(AUTH_PORT, 'Firebase Auth emulator');
  } else {
    console.log('[firebase-csp] Auth emulator already on :9099');
  }

  console.log('[firebase-csp] production build (no localhost CSP) for Google');
  await run('npm', ['run', 'build'], { env: { ...process.env, ...firebaseEnv } });
  preview = await startPreview(GOOGLE_PORT, { ...process.env });

  const html = await fetch(`http://127.0.0.1:${GOOGLE_PORT}/`).then((r) => r.text());
  if (!/script-src[^;]*https:\/\/apis\.google\.com/.test(html) || !/script-src[^;]*https:\/\/www\.gstatic\.com/.test(html)) {
    throw new Error('Production HTML script-src missing apis.google.com / www.gstatic.com');
  }
  if (html.includes('http://localhost:*')) {
    throw new Error('Production CSP Google build still allows localhost');
  }

  await run('npx', ['vitest', 'run', 'tests/firebase-csp.test.ts'], {
    env: {
      ...process.env,
      E2E_BASE_URL: `http://127.0.0.1:${GOOGLE_PORT}`,
      FIREBASE_CSP_MODE: 'google',
    },
  });

  if (preview) {
    preview.kill('SIGTERM');
    preview = null;
    await waitForPortClosed(GOOGLE_PORT);
  }

  console.log('[firebase-csp] emulator build for email link');
  await run('npm', ['run', 'build'], {
    env: {
      ...process.env,
      ...firebaseEnv,
      E2E_LOCAL: '1',
      VITE_FIREBASE_AUTH_EMULATOR: 'http://127.0.0.1:9099',
      VITE_FIREBASE_PROJECT_ID: 'demo-weltraum',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-weltraum.firebaseapp.com',
    },
  });
  preview = await startPreview(EMAIL_PORT, { ...process.env });

  await run('npx', ['vitest', 'run', 'tests/firebase-csp.test.ts'], {
    env: {
      ...process.env,
      E2E_BASE_URL: `http://127.0.0.1:${EMAIL_PORT}`,
      FIREBASE_CSP_MODE: 'email',
    },
  });

  cleanup();
  console.log('[firebase-csp] suite passed');
}

main().catch((err) => {
  console.error('[firebase-csp] FAILED:', err);
  process.exit(1);
});
