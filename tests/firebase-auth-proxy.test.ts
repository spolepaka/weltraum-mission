import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FIREBASE_AUTH_PROXY_HOST,
  PRODUCTION_APP_HOST,
  getFirebaseConfig,
  resetFirebaseForTests,
  resolveAuthDomain,
  setFirebaseEnvForTests,
} from '../src/lib/firebase-auth';

const VERCEL = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  rewrites: Array<{ source: string; destination: string }>;
};
const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const VITE = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const CONFIG = readFileSync(new URL('../src/lib/firebase-config.ts', import.meta.url), 'utf8');
const FACADE = readFileSync(new URL('../src/lib/firebase-auth.ts', import.meta.url), 'utf8');
const IMPL = readFileSync(new URL('../src/lib/firebase-auth-impl.ts', import.meta.url), 'utf8');

afterEach(async () => {
  await resetFirebaseForTests();
});

describe('first-party Firebase auth proxy', () => {
  it('vercel.json rewrites /__/auth and /__/firebase to the Firebase Hosting helper', () => {
    expect(VERCEL.rewrites.length).toBeGreaterThanOrEqual(2);
    const auth = VERCEL.rewrites.find((r) => r.source === '/__/auth/:path*');
    const firebase = VERCEL.rewrites.find((r) => r.source === '/__/firebase/:path*');
    expect(auth?.destination).toBe(`https://${FIREBASE_AUTH_PROXY_HOST}/__/auth/:path*`);
    expect(firebase?.destination).toBe(`https://${FIREBASE_AUTH_PROXY_HOST}/__/firebase/:path*`);
    const catchAllAt = VERCEL.rewrites.findIndex((r) => r.source === '/(.*)' && /index\.html/.test(r.destination));
    const authAt = VERCEL.rewrites.findIndex((r) => r.source === '/__/auth/:path*');
    expect(authAt).toBeGreaterThanOrEqual(0);
    if (catchAllAt >= 0) expect(authAt).toBeLessThan(catchAllAt);
  });

  it('does not send X-Frame-Options DENY / frame-ancestors none on the auth handler', () => {
    const authHeaders = VERCEL.headers.find((h) => h.source === '/__/auth/:path*');
    expect(authHeaders).toBeTruthy();
    const xfo = authHeaders!.headers.find((h) => h.key === 'X-Frame-Options')?.value;
    const csp = authHeaders!.headers.find((h) => h.key === 'Content-Security-Policy')?.value || '';
    expect(xfo).toBe('SAMEORIGIN');
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("frame-ancestors 'none'");
  });

  it('HTML + site CSP keep frame-src self so the first-party handler iframe is allowed', () => {
    expect(HTML).toMatch(/frame-src 'self'/);
    const siteCsp = VERCEL.headers.find((h) => h.source === '/(.*)')?.headers.find((h) => h.key === 'Content-Security-Policy')?.value || '';
    expect(siteCsp).toMatch(/frame-src 'self'/);
  });

  it('Vite proxies the same first-party auth paths for local preview', () => {
    expect(VITE).toContain("'/__/auth'");
    expect(VITE).toContain("'/__/firebase'");
    expect(VITE).toContain(FIREBASE_AUTH_PROXY_HOST);
  });

  it('built config uses first-party authDomain on the production host', () => {
    expect(CONFIG).toContain('location.host');
    expect(CONFIG).toContain(PRODUCTION_APP_HOST);
    expect(CONFIG).toMatch(/resolveAuthDomain/);
    setFirebaseEnvForTests({
      VITE_FIREBASE_API_KEY: 'k',
      VITE_FIREBASE_AUTH_DOMAIN: FIREBASE_AUTH_PROXY_HOST,
      VITE_FIREBASE_PROJECT_ID: 'weltraum-mission',
      VITE_FIREBASE_APP_ID: '1:1:web:prod',
    });
    const cfg = getFirebaseConfig(PRODUCTION_APP_HOST);
    expect(cfg?.authDomain).toBe(PRODUCTION_APP_HOST);
    expect(resolveAuthDomain(FIREBASE_AUTH_PROXY_HOST, PRODUCTION_APP_HOST)).toBe(PRODUCTION_APP_HOST);
  });

  it('preloads the auth chunk and calls signInWithPopup with no await before it', () => {
    expect(FACADE).toContain('peekFirebase');
    expect(FACADE).toMatch(/if \(impl\) return impl\.signInWithGoogle/);
    expect(IMPL).toMatch(/const popupPromise = signInWithPopup\(a, provider\)/);
    expect(IMPL).toContain('onAuthStateChanged');
    expect(IMPL).not.toMatch(/preferRedirect/);
  });
});
