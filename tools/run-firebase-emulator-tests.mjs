/**
 * Start the Firebase Auth emulator and run the emulator-backed suite.
 */
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '') || process.cwd();
const AUTH_PORT = 9099;

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

async function main() {
  let emu = null;
  const startedHere = !(await portOpen(AUTH_PORT));

  const cleanup = () => {
    if (emu) emu.kill('SIGTERM');
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });

  if (startedHere) {
    console.log('[firebase] starting Auth emulator on :9099');
    emu = spawn(
      'npx',
      ['firebase', 'emulators:start', '--only', 'auth', '--project', 'demo-weltraum'],
      { cwd: ROOT, stdio: 'inherit' },
    );
    await waitForPort(AUTH_PORT, 'Firebase Auth emulator');
    await sleep(500);
  } else {
    console.log('[firebase] Auth emulator already on :9099');
  }

  await run('npx', ['vitest', 'run', 'tests/firebase-auth-emulator.test.ts'], {
    env: {
      ...process.env,
      VITE_FIREBASE_API_KEY: 'fake-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-weltraum.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-weltraum',
      VITE_FIREBASE_APP_ID: '1:1:web:demo',
      VITE_FIREBASE_AUTH_EMULATOR: 'http://127.0.0.1:9099',
    },
  });

  if (emu) emu.kill('SIGTERM');
  console.log('[firebase] emulator suite passed');
}

main().catch((err) => {
  console.error('[firebase] FAILED:', err);
  process.exit(1);
});
