import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';
import {
  AUTH_STORAGE_KEY,
  ANON_SNAPSHOT_KEY,
  GUEST_TOKEN_KEY,
} from '../src/lib/firebase-auth';
import { DISPLAY_NAME_KEY, GUEST_DISPLAY_NAME_KEY } from '../src/lib/display-names';
import { ONBOARD_KEY } from '../src/lib/onboarding';
import { TIPS_KEY } from '../src/lib/tips';
import {
  ACCOUNT_GATE_KEY,
  IDENTITY_STORAGE_KEY,
  LOCAL_CACHE_KEY,
  PLAYER_STATE_KEYS,
  SESSION_CHANNEL,
  SESSION_TICK_KEY,
  SHOP_KEY,
  PROGRESS_KEY,
  ACH_KEY,
  accountHasProgress,
  clearLocalPlayerState,
  freshGuestState,
  guestSnapshotHasProgress,
  isSessionTickKey,
  parseSessionEvent,
  rememberGuestDisplayName,
  restoreGuestDisplayName,
  shouldImportGuestProgress,
  shouldPushLocalName,
  snapshotToGameState,
} from '../src/lib/player-session';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const store: Record<string, string> = {};

function stubStorage(): void {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const key of Object.keys(store)) delete store[key]; },
    key: () => null,
    length: 0,
  } as Storage;
}

afterEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

function fatherDevice(): void {
  stubStorage();
  store[DISPLAY_NAME_KEY] = JSON.stringify({ name: 'Papa Pilot', kind: 'custom' });
  store[SHOP_KEY] = JSON.stringify({ coins: 9000, owned: ['starter', 'blitz'], equipped: 'blitz', up: { heart: 1, rate: 2, dmg: 0, dur: 0, mag: 0 } });
  store[PROGRESS_KEY] = JSON.stringify({ unlocked: 18, stars: { 1: 3, 2: 2 }, best: { 1: 800 } });
  store[ACH_KEY] = JSON.stringify({ firstWin: 1, coins1k: 1 });
  store[LOCAL_CACHE_KEY] = JSON.stringify({ coins: '9000n', unlockedLevel: 18, ownedShips: ['starter', 'blitz'] });
  store[IDENTITY_STORAGE_KEY] = 'dad-identity-token';
  store[AUTH_STORAGE_KEY] = JSON.stringify({ idToken: 'dad-jwt', uid: 'dad', email: 'dad@example.com' });
  store[ANON_SNAPSHOT_KEY] = JSON.stringify({ unlockedLevel: 4, coins: 200, ownedShips: ['starter'] });
  store[GUEST_TOKEN_KEY] = 'old-guest-token';
  store[ONBOARD_KEY] = JSON.stringify({ welcomeDone: true, trainingDone: true, mapTourDone: true });
  store[TIPS_KEY] = JSON.stringify({ onboardDone: true });
  store[GUEST_DISPLAY_NAME_KEY] = JSON.stringify({ name: 'Kid Fox', kind: 'generated' });
  store.spaceMissionLanguage = 'de';
}

describe('account-bound pilot names and session wipe', () => {
  it('does not push a local/guest name onto a signed-in account', () => {
    expect(shouldPushLocalName(true)).toBe(false);
    expect(shouldPushLocalName(false)).toBe(true);
  });

  it('clears player state on logout and restores only the guest name', () => {
    fatherDevice();
    clearLocalPlayerState();
    const guestName = restoreGuestDisplayName();
    expect(guestName).toBe('Kid Fox');
    expect(store[DISPLAY_NAME_KEY]).toContain('Kid Fox');
    expect(store[GUEST_DISPLAY_NAME_KEY]).toContain('Kid Fox');
    expect(store.spaceMissionLanguage).toBe('de');
    expect(store[SHOP_KEY]).toBeUndefined();
    expect(store[PROGRESS_KEY]).toBeUndefined();
    expect(store[ACH_KEY]).toBeUndefined();
    expect(store[LOCAL_CACHE_KEY]).toBeUndefined();
    expect(store[IDENTITY_STORAGE_KEY]).toBeUndefined();
    expect(store[AUTH_STORAGE_KEY]).toBeUndefined();
    expect(store[ANON_SNAPSHOT_KEY]).toBeUndefined();
    expect(store[GUEST_TOKEN_KEY]).toBeUndefined();
    expect(store[ONBOARD_KEY]).toBeUndefined();
    expect(store[TIPS_KEY]).toBeUndefined();
    for (const key of PLAYER_STATE_KEYS) {
      if (key === DISPLAY_NAME_KEY) continue;
      expect(store[key], key).toBeUndefined();
    }
  });

  it('logout then guest is a brand-new player: 0 coins, level 1, starter, no onboard', () => {
    fatherDevice();
    clearLocalPlayerState();
    const guestName = restoreGuestDisplayName();
    const fresh = freshGuestState(guestName);
    expect(fresh.coins).toBe(0);
    expect(fresh.unlocked).toBe(1);
    expect(fresh.ships).toEqual(['starter']);
    expect(fresh.equipped).toBe('starter');
    expect(fresh.upgrades.heart).toBe(0);
    expect(fresh.achievements).toEqual([]);
    expect(fresh.onboardDone).toBe(false);
    expect(fresh.name).toBe('Kid Fox');
    expect(fresh.name).not.toBe('Papa Pilot');
  });

  it('A logout then B login keeps only B\'s account data', () => {
    fatherDevice();
    clearLocalPlayerState();
    restoreGuestDisplayName();
    const son = snapshotToGameState({
      coins: 120,
      unlockedLevel: 5,
      ownedShips: ['starter', 'komet'],
      equippedShip: 'komet',
      upgrades: { heart: 0, rate: 1, dmg: 0, dur: 0, mag: 0 },
      stars: { 1: 3 },
      achievements: ['firstWin'],
      displayName: 'Son Pilot',
      nameKind: 'custom',
      onboardDone: true,
    });
    expect(son.name).toBe('Son Pilot');
    expect(son.name).not.toBe('Papa Pilot');
    expect(son.name).not.toBe('Kid Fox');
    expect(son.coins).toBe(120);
    expect(son.coins).not.toBe(9000);
    expect(son.unlocked).toBe(5);
    expect(son.ships).toEqual(['starter', 'komet']);
    expect(son.equipped).toBe('komet');
    expect(son.achievements).toEqual(['firstWin']);
    expect(son.onboardDone).toBe(true);
  });

  it('never merges leftover local coins/ships/levels into an existing account', () => {
    const replaced = snapshotToGameState({
      coins: 40,
      unlockedLevel: 2,
      ownedShips: ['starter'],
      equippedShip: 'starter',
      displayName: 'Son Pilot',
    });
    expect(replaced.coins).toBe(40);
    expect(replaced.unlocked).toBe(2);
    expect(replaced.ships).toEqual(['starter']);
  });

  it('imports guest progress only for a brand-new account after an explicit yes', () => {
    expect(shouldImportGuestProgress(true, true)).toBe(false);
    expect(shouldImportGuestProgress(false, false)).toBe(false);
    expect(shouldImportGuestProgress(false, true)).toBe(true);
    expect(guestSnapshotHasProgress({ unlockedLevel: 1, coins: 0, ownedShips: ['starter'] })).toBe(false);
    expect(guestSnapshotHasProgress({ unlockedLevel: 4, coins: 80, ownedShips: ['starter'] })).toBe(true);
    expect(accountHasProgress({ displayName: 'Papa Pilot' })).toBe(true);
    expect(accountHasProgress({ unlockedLevel: 1, coins: 0, ownedShips: ['starter'] })).toBe(false);
  });

  it('remembers a guest name without writing it onto the next login', () => {
    stubStorage();
    store[DISPLAY_NAME_KEY] = JSON.stringify({ name: 'Kid Fox', kind: 'generated' });
    rememberGuestDisplayName();
    expect(store[GUEST_DISPLAY_NAME_KEY]).toContain('Kid Fox');
    store[DISPLAY_NAME_KEY] = JSON.stringify({ name: 'Papa Pilot', kind: 'custom' });
    clearLocalPlayerState();
    expect(restoreGuestDisplayName()).toBe('Kid Fox');
  });

  it('uses storage events and BroadcastChannel so other tabs switch too', () => {
    expect(isSessionTickKey(SESSION_TICK_KEY)).toBe(true);
    expect(isSessionTickKey(AUTH_STORAGE_KEY)).toBe(true);
    expect(isSessionTickKey(SHOP_KEY)).toBe(false);
    expect(SESSION_CHANNEL).toBe('weltraum-session');
    expect(parseSessionEvent(JSON.stringify({ type: 'logout', at: 1 }))).toEqual({ type: 'logout', at: 1 });
    expect(parseSessionEvent(JSON.stringify({ type: 'login', at: 2 }))?.type).toBe('login');
    expect(ACCOUNT_GATE_KEY).toBe('spaceMissionAccountGate');
  });

  it('shows a friendly name-taken message in English and German', () => {
    expect(en.tips.nameTaken.toLowerCase()).toContain('taken');
    expect(en.tips.nameTaken.toLowerCase()).not.toContain('added a number');
    expect(de.tips.nameTaken.toLowerCase()).toContain('vergeben');
    expect(de.tips.nameTaken).not.toContain('Zahl');
  });

  it('keys account names by firebase user and rejects taken names server-side', () => {
    const src = readFileSync(join(root, 'server/spacetimedb/src/index.ts'), 'utf8');
    expect(src).toContain('accountName');
    expect(src).toContain('firebaseSub');
    expect(src).toContain('bindAccountName');
    expect(src).toContain("reason: 'taken'");
    expect(src).not.toContain('copyNameIfMissing(ctx');
    expect(src).toContain('Guest names stay local-only');
    const main = readFileSync(join(root, 'src/main.ts'), 'utf8');
    expect(main).toContain('shouldPushLocalName');
    expect(main).toContain('clearLocalPlayerState');
    expect(main).toContain("postSessionEvent('logout')");
    expect(main).toContain('claimDisplayName');
    expect(main).toContain('location.reload');
    const html = readFileSync(join(root, 'public/index.html'), 'utf8');
    expect(html).toContain('replace: true');
    expect(html).toContain('resetToFreshPlayer');
    expect(html).toContain('spaceMissionSessionTick');
    expect(html).toContain('BroadcastChannel("weltraum-session")');
    expect(html).toContain('sessionGate');
  });
});
