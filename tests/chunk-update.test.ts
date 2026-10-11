import { afterEach, describe, expect, it } from 'vitest';
import {
  SOFT_RELOAD_KEY,
  alreadySoftReloaded,
  checkBuildVersion,
  clearSoftReloadGuard,
  currentBuildId,
  importFresh,
  isLevelInProgress,
  isStaleChunkError,
  markSoftReloaded,
  requestSoftReload,
} from '../src/lib/chunk-update';

const sess: Record<string, string> = {};

function stubSession(): void {
  (globalThis as { sessionStorage?: Storage }).sessionStorage = {
    getItem: (k) => sess[k] ?? null,
    setItem: (k, v) => { sess[k] = v; },
    removeItem: (k) => { delete sess[k]; },
    clear: () => { for (const key of Object.keys(sess)) delete sess[key]; },
    key: (i) => Object.keys(sess)[i] ?? null,
    get length() { return Object.keys(sess).length; },
  } as Storage;
}

afterEach(() => {
  for (const k of Object.keys(sess)) delete sess[k];
  clearSoftReloadGuard();
});

describe('stale chunk + version reload', () => {
  it('detects Vite dynamic-import and preload failures', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/firebase-auth-impl-old.js'))).toBe(true);
    expect(isStaleChunkError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true);
    expect(isStaleChunkError(new Error('network down'))).toBe(false);
  });

  it('does not treat map/welcome as a level in progress', () => {
    expect(isLevelInProgress('map')).toBe(false);
    expect(isLevelInProgress('play')).toBe(true);
    expect(isLevelInProgress('dying')).toBe(true);
    expect(isLevelInProgress('sucked')).toBe(true);
  });

  it('reloads once and then guards with sessionStorage', () => {
    stubSession();
    let n = 0;
    expect(requestSoftReload('chunk', () => { n += 1; })).toBe(true);
    expect(n).toBe(1);
    expect(alreadySoftReloaded()).toBe(true);
    expect(sess[SOFT_RELOAD_KEY]).toBe('1');
    expect(requestSoftReload('chunk', () => { n += 1; })).toBe(false);
    expect(n).toBe(1);
    markSoftReloaded();
    expect(requestSoftReload('version', () => { n += 1; })).toBe(false);
  });

  it('importFresh triggers a chunk reload on stale module errors', async () => {
    stubSession();
    let n = 0;
    const orig = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { reload: () => { n += 1; } },
    });
    await expect(importFresh(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))).rejects.toThrow(/dynamically imported/);
    expect(n).toBe(1);
    Object.defineProperty(globalThis, 'location', { configurable: true, value: orig });
  });

  it('version check reloads only when the build id changed', async () => {
    stubSession();
    let n = 0;
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({ id: `${currentBuildId()}-next` }),
    })) as unknown as typeof fetch;
    expect(await checkBuildVersion(fetchImpl)).toBe(true);
    expect(alreadySoftReloaded()).toBe(true);
    const same = (async () => ({
      ok: true,
      json: async () => ({ id: currentBuildId() }),
    })) as unknown as typeof fetch;
    clearSoftReloadGuard();
    expect(await checkBuildVersion(same)).toBe(false);
    expect(n).toBe(0);
  });
});
