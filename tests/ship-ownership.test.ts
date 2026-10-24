import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UNLOCK_SHIPS } from '../src/lib/economy';
import { UNLOCK_SHIPS as SERVER_UNLOCK } from '../server/spacetimedb/src/economy';
import {
  applyBuyThenReload,
  canEquip,
  earnedUnlockShipIds,
  grantEarnedOwned,
  ownedFromServer,
  replaceOwnedFromServer,
  sanitizeEquipped,
  shopShipKind,
  unlockEarned,
} from '../src/lib/ship-ownership';
import {
  earnedUnlockShipIds as serverEarned,
  grantEarnedOwned as serverGrant,
  unlockEarned as serverUnlockEarned,
} from '../server/spacetimedb/src/ship-ownership';
import { equipShipLocal, purchaseShipLocal } from '../src/lib/shop-ships';
import { SHIP_PRICES } from '../src/lib/economy';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const SERVER = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');
const CLIENT = readFileSync(new URL('../src/lib/spacetime-client.ts', import.meta.url), 'utf8');
const MAIN = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const EN = readFileSync(new URL('../src/i18n/en.ts', import.meta.url), 'utf8');
const DE = readFileSync(new URL('../src/i18n/de.ts', import.meta.url), 'utf8');
const VALID = new Set(Object.keys(SHIP_PRICES));

describe('unlock vs owned', () => {
  it('does not treat a starred unlock as owned', () => {
    expect(UNLOCK_SHIPS.rivet).toEqual({ level: 105 });
    expect(UNLOCK_SHIPS.stormcoil).toEqual({ level: 215 });
    expect(unlockEarned(UNLOCK_SHIPS.rivet, { stars: { 105: 3 } })).toBe(true);
    expect(unlockEarned(UNLOCK_SHIPS.stormcoil, { stars: { 105: 3 } })).toBe(false);
    expect(unlockEarned(UNLOCK_SHIPS.rivet, { unlockedLevel: 250 })).toBe(false);
    expect(unlockEarned(UNLOCK_SHIPS.rivet, { unlockedLevel: 250 }, { allowUnlockedLevel: true })).toBe(true);
    expect(unlockEarned(UNLOCK_SHIPS.regenbogen, { achievements: ['combo25'] })).toBe(true);
    expect(unlockEarned(UNLOCK_SHIPS.regenbogen, { stars: { 30: 3 } })).toBe(false);
    expect(shopShipKind({
      owned: false,
      equipped: false,
      unlockEarned: true,
      forSale: true,
    })).toBe('free_to_claim');
    expect(shopShipKind({
      owned: true,
      equipped: false,
      unlockEarned: true,
      forSale: true,
    })).toBe('owned');
  });

  it('keeps client and server unlock rules in lockstep', () => {
    expect(SERVER_UNLOCK).toEqual(UNLOCK_SHIPS);
    const progress = { stars: { 105: 2, 250: 1 }, achievements: ['combo25'] as string[] };
    expect(earnedUnlockShipIds(UNLOCK_SHIPS, progress).sort()).toEqual(
      serverEarned(SERVER_UNLOCK, progress).sort(),
    );
    expect(earnedUnlockShipIds(UNLOCK_SHIPS, progress)).toEqual(
      expect.arrayContaining(['rivet', 'starcrown', 'regenbogen']),
    );
    expect(earnedUnlockShipIds(UNLOCK_SHIPS, progress)).not.toContain('stormcoil');
    expect(serverUnlockEarned(SERVER_UNLOCK.rivet, progress)).toBe(true);
  });
});

describe('shop Owned / Free to claim / Buy', () => {
  it('labels the three hangar states and never equips an unowned hull', () => {
    expect(shopShipKind({ owned: true, equipped: true, unlockEarned: true, forSale: true })).toBe('equipped');
    expect(shopShipKind({ owned: true, equipped: false, unlockEarned: false, forSale: true })).toBe('owned');
    expect(shopShipKind({ owned: false, equipped: false, unlockEarned: true, forSale: true })).toBe('free_to_claim');
    expect(shopShipKind({ owned: false, equipped: false, unlockEarned: false, forSale: true })).toBe('buy');
    expect(shopShipKind({ owned: false, equipped: false, unlockEarned: false, forSale: false })).toBe('locked');
    expect(canEquip(['starter'], 'stormcoil')).toBe(false);
    expect(canEquip(['starter', 'stormcoil'], 'stormcoil')).toBe(true);
    expect(equipShipLocal({ owned: ['starter'], equipped: 'starter' }, 'starcrown', VALID).ok).toBe(false);
    expect(sanitizeEquipped(['starter'], 'starcrown')).toBe('starter');
  });

  it('bakes Owned / Free to claim / Buy into EN, DE and the hangar', () => {
    expect(EN).toContain("freeToClaim: 'Free to claim'");
    expect(DE).toContain("freeToClaim: 'Gratis holen'");
    expect(HTML).toContain('function shipKind(sd)');
    expect(HTML).toContain('tips.freeToClaim');
    expect(HTML).toContain('tips.claiming');
    expect(HTML).toContain('onClaimShip(shopSel)');
    expect(HTML).not.toMatch(/if \(!owned && d\.unlock && shipUnlocked\(d\)\) \{\s*shop\.owned\.push\(shopSel\)/);
  });
});

describe('reload, second device, buy then reload', () => {
  it('drops local-only phantoms after reload', () => {
    const staleLocal = ['starter', 'stormcoil', 'starcrown', 'charongate', 'welder'];
    const serverOwned = ['starter', 'blitz'];
    expect(replaceOwnedFromServer(staleLocal, serverOwned)).toEqual(['starter', 'blitz']);
    expect(ownedFromServer([])).toEqual(['starter']);
  });

  it('login on a second device uses only ownedShip', () => {
    const deviceBCache = ['starter', 'dockn', 'boltfin', 'aurorafin'];
    const accountOwned = ['starter', 'rivet'];
    const next = replaceOwnedFromServer(deviceBCache, accountOwned);
    expect(next).toEqual(['starter', 'rivet']);
    expect(canEquip(next, 'dockn')).toBe(false);
    expect(canEquip(next, 'rivet')).toBe(true);
    expect(sanitizeEquipped(next, 'dockn')).toBe('starter');
  });

  it('keeps a purchased ship after buy then reload', () => {
    const before = ['starter'];
    const bought = purchaseShipLocal(
      { coins: 50_000_000, owned: [...before], equipped: 'starter' },
      'starcrown',
      SHIP_PRICES,
      VALID,
    );
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const serverAfterBuy = ['starter', 'starcrown'];
    expect(applyBuyThenReload(before, 'starcrown', serverAfterBuy)).toEqual(['starter', 'starcrown']);
    expect(replaceOwnedFromServer(bought.shop.owned, serverAfterBuy)).toContain('starcrown');
    expect(canEquip(serverAfterBuy, 'starcrown')).toBe(true);
  });
});

describe('auto-claim earned unlocks', () => {
  it('is idempotent on login and level-up', () => {
    const first = grantEarnedOwned(['starter'], ['stormcoil', 'frostwal']);
    const again = grantEarnedOwned(first, ['stormcoil', 'frostwal']);
    expect(first).toEqual(['starter', 'stormcoil', 'frostwal']);
    expect(again).toEqual(first);
    expect(serverGrant(['starter', 'stormcoil'], ['stormcoil'])).toEqual(['starter', 'stormcoil']);
  });

  it('claims starred unlocks automatically and ignores ALLELEVEL without stars', () => {
    const afterLevel105 = earnedUnlockShipIds(UNLOCK_SHIPS, { stars: { 105: 1 }, unlockedLevel: 106 });
    expect(afterLevel105).toContain('rivet');
    expect(afterLevel105).not.toContain('starcrown');
    expect(afterLevel105).not.toContain('stormcoil');
    const allelevel = earnedUnlockShipIds(UNLOCK_SHIPS, { unlockedLevel: 250 });
    expect(allelevel).toEqual([]);
  });

  it('wires an idempotent server claim on login and level-up', () => {
    expect(SERVER).toContain('export const claimEarnedUnlocks');
    expect(SERVER).toContain('function grantEarnedUnlockShips');
    expect(SERVER).toContain('grantEarnedUnlockShips(ctx)');
    expect(CLIENT).toContain('claimEarnedUnlocks');
    expect(CLIENT).toContain('refreshOwnedFromServer');
    expect(CLIENT).toContain('ownedFromServer(remote.ownedShips)');
    expect(CLIENT).not.toContain('[...(local.ownedShips || []), ...remote.ownedShips]');
    expect(MAIN).toContain('claimUnlockAndRefresh');
    expect(MAIN).toContain('purchaseAndRefresh');
    expect(MAIN).toContain('applyHangarFromCache');
    expect(HTML).toContain('shop.owned = nextOwned');
    expect(HTML).not.toContain('shop.owned.push(p.equipped)');
  });
});
