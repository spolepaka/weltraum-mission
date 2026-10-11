import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { needsFirebaseNow } from '../src/lib/firebase-auth';

const facade = readFileSync(new URL('../src/lib/firebase-auth.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

describe('lazy Firebase / PeerJS wiring', () => {
  it('facade has no static firebase SDK import', () => {
    expect(facade).not.toMatch(/from ['"]firebase\//);
    expect(facade).toContain("import('./firebase-auth-impl')");
  });

  it('main entry does not import firebase-auth-impl or peerjs statically', () => {
    expect(main).not.toContain("from './lib/firebase-auth-impl'");
    expect(main).not.toContain("from 'peerjs'");
    expect(main).toContain("from './lib/online-peer'");
    expect(main).not.toMatch(/isAuthConfigured\(\)\s*\|\|\s*needsFirebaseNow/);
    expect(main).toMatch(/if \(needsFirebaseNow\(\)\) \{\s*await ensureFirebase/);
    expect(main).toMatch(/if \(needsFirebaseNow\(\)\) \{\s*bindAuthWatch/);
    expect(vite).toContain('version.json');
    expect(vite).toContain('__BUILD_ID__');
  });

  it('needsFirebaseNow is false for a fresh guest', () => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
      clear: () => { for (const key of Object.keys(store)) delete store[key]; },
      key: () => null,
      length: 0,
    } as Storage;
    (globalThis as { sessionStorage?: Storage }).sessionStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
    expect(needsFirebaseNow()).toBe(false);
  });
});
