import { describe, expect, it } from 'vitest';
import { isEmptyGuest, matchesPlayerFilter, sortPlayers } from '../src/lib/empty-guest';
import { readFileSync } from 'node:fs';

const moduleSrc = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');
const mainSrc = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const runner = readFileSync(new URL('../tools/run-e2e-real.mjs', import.meta.url), 'utf8');
const e2e = readFileSync(new URL('../tests/e2e-real.test.ts', import.meta.url), 'utf8');

describe('empty guests', () => {
  it('treats a no-progress anonymous row as empty', () => {
    expect(isEmptyGuest({ coins: 0, unlocked: 1, ships: 'starter' })).toBe(true);
    expect(isEmptyGuest({ email: 'ada@example.com' })).toBe(false);
    expect(isEmptyGuest({ username: 'Joshi' })).toBe(false);
    expect(isEmptyGuest({ coins: 1666, unlocked: 1 })).toBe(false);
    expect(isEmptyGuest({ unlocked: 18 })).toBe(false);
    expect(isEmptyGuest({ ships: 'starter,blitz' })).toBe(false);
    expect(isEmptyGuest({ testBot: true })).toBe(false);
    expect(isEmptyGuest({ banned: true })).toBe(false);
    expect(isEmptyGuest({ starCount: 2 })).toBe(false);
  });

  it('filters hide empty guests, signed-in, guest, banned, today, test', () => {
    const empty = { id: 'aaa', username: '', email: '', coins: '0', unlocked: 1, ships: 'starter' };
    const joshi = { id: 'c200d9b5a2', username: '', email: 'joshiepolepaka@gmail.com', coins: '1666', unlocked: 18, ships: 'starter,blitz', signedIn: true };
    const bot = { id: 'bot', username: '', email: '', coins: '0', unlocked: 1, ships: 'starter', testBot: true };
    expect(matchesPlayerFilter(empty, { hideEmptyGuests: true })).toBe(false);
    expect(matchesPlayerFilter(joshi, { hideEmptyGuests: true })).toBe(true);
    expect(matchesPlayerFilter(joshi, { signedIn: true })).toBe(true);
    expect(matchesPlayerFilter(empty, { signedIn: true })).toBe(false);
    expect(matchesPlayerFilter(empty, { guest: true })).toBe(true);
    expect(matchesPlayerFilter(joshi, { guest: true })).toBe(false);
    expect(matchesPlayerFilter(bot, { testBot: true })).toBe(true);
    expect(matchesPlayerFilter(joshi, { query: 'joshie' })).toBe(true);
    expect(sortPlayers([joshi, empty], 'coins', 'desc')[0].id).toBe('c200d9b5a2');
  });

  it('does not mint a player row on connect for guests', () => {
    expect(moduleSrc).toContain('Guests wait for');
    expect(moduleSrc).toContain('export const ensurePlayerRow');
    expect(moduleSrc).toMatch(/syncProgress[\s\S]*if \(!ctx\.db\.player\.identity\.find\(identity\)\) return/);
    expect(mainSrc).toContain('function shouldAutoconnect');
    expect(mainSrc).toContain('if (welcomeIsDone()) return true');
    expect(mainSrc).not.toContain("localStorage.getItem('spaceMissionIdentityToken')");
    expect(mainSrc).toContain('ensureCloud: () => ensureCloudAndReady(client)');
  });

  it('refuses production E2E unless explicitly allowed', () => {
    expect(runner).toContain('Refusing to run E2E against Maincloud');
    expect(e2e).toContain('E2E refused to target production SpacetimeDB');
    expect(e2e).toContain("E2E_ALLOW_PRODUCTION === '1'");
  });
});
