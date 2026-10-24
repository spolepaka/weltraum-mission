import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHIP_PRICES, UNLOCK_SALE_PRICES, UNLOCK_SHIPS } from '../src/lib/economy';
import { SHIP_PRICES as SERVER_PRICES, UNLOCK_SALE_PRICES as SERVER_UNLOCK } from '../server/spacetimedb/src/economy';
import { EARLY_SPECIAL_IDS, SPECIAL_IDS, SPECIAL_SHIPS, SPECIAL_TAB, specialCombat, specialSalePrice } from '../src/lib/special-ships';
import { SPECIAL_IDS as SERVER_IDS, SPECIAL_SHIPS as SERVER_SHIPS, specialCombat as serverCombat } from '../server/spacetimedb/src/special-ships';
import { shipCombat, shipCombatPower } from '../src/lib/versus';
import { shipCombatPower as serverPower } from '../server/spacetimedb/src/versus';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const SERVER = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');

describe('late Special tab ships (L100–250)', () => {
  it('treats Special as shop tab 4 — the five classic unlock-reward hulls plus 12 late ones', () => {
    expect(SPECIAL_TAB).toBe(4);
    expect(EARLY_SPECIAL_IDS).toEqual(['frostwal', 'lindwurm', 'hydra', 'regenbogen', 'kaiserbrecher']);
    expect(SPECIAL_SHIPS).toHaveLength(12);
    expect(SPECIAL_IDS).toHaveLength(12);
    expect(HTML).toContain('["🎁", "tabSpecial"]');
    for (const id of EARLY_SPECIAL_IDS) {
      expect(HTML).toMatch(new RegExp(`id: "${id}"[\\s\\S]*?tier: 4`));
    }
  });

  it('appends the 12 new specials at the end of the HTML catalog with new ids', () => {
    const lastClassic = HTML.lastIndexOf('{ id: "starcrown"');
    const firstNew = HTML.indexOf('{ id: "phobosclaw"');
    const lastNew = HTML.lastIndexOf('{ id: "voidcrown"');
    expect(lastClassic).toBeGreaterThan(0);
    expect(firstNew).toBeGreaterThan(lastClassic);
    expect(lastNew).toBeGreaterThan(firstNew);
    const after = HTML.slice(lastNew);
    expect(after).toMatch(/id: "voidcrown"[\s\S]*?\n  \];/);
    expect(HTML).not.toMatch(/id: "voidcrown"[\s\S]*id: "starcrown"/);
  });

  it('spreads unique unlocks across L100–L250 with EN/DE names and a unique silhouette', () => {
    const levels = SPECIAL_SHIPS.map((s) => s.unlockL);
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(100);
    expect(Math.max(...levels)).toBeLessThanOrEqual(250);
    expect(new Set(levels).size).toBe(12);
    expect(new Set(SPECIAL_SHIPS.map((s) => s.kit.shape)).size).toBe(12);
    expect(new Set(SPECIAL_IDS).size).toBe(12);
    for (const s of SPECIAL_SHIPS) {
      expect(s.nameEn.length).toBeGreaterThan(3);
      expect(s.nameDe.length).toBeGreaterThan(3);
      expect(s.perk || s.perk2 || s.drones).toBeTruthy();
      expect(en.ships[s.id]?.name).toBe(s.nameEn);
      expect(de.ships[s.id]?.name).toBe(s.nameDe);
      expect(HTML).toContain(`"${s.id}":{"shape":"${s.kit.shape}"`);
      expect(HTML).toContain(`id: "${s.id}"`);
      expect(HTML).toContain(`tier: 4, price: ${specialSalePrice(SPECIAL_IDS.indexOf(s.id))}`);
      expect(UNLOCK_SHIPS[s.id]).toEqual({ level: s.unlockL });
    }
  });

  it('keeps client, server, versus and HTML catalogs in lockstep', () => {
    expect(SERVER_IDS).toEqual(SPECIAL_IDS);
    expect(SERVER_SHIPS.map((s) => s.id)).toEqual(SPECIAL_IDS);
    const client = specialCombat();
    const server = serverCombat();
    for (const id of SPECIAL_IDS) {
      expect(server[id]).toEqual(client[id]);
      expect(shipCombat(id).hearts).toBe(client[id].hearts);
      expect(shipCombatPower(id)).toBe(serverPower(id));
      expect(SHIP_PRICES[id]).toBe(specialSalePrice(SPECIAL_IDS.indexOf(id)));
      expect(SERVER_PRICES[id]).toBe(SHIP_PRICES[id]);
      expect(UNLOCK_SALE_PRICES[id]).toBe(SHIP_PRICES[id]);
      expect(SERVER).toContain(`'${id}'`);
    }
    expect(SERVER_UNLOCK).toEqual(UNLOCK_SALE_PRICES);
  });

  it('gives late specials strong stats and high prices above the classic five', () => {
    const omegaPower = shipCombatPower('omega');
    for (const s of SPECIAL_SHIPS) {
      expect(s.hearts).toBeGreaterThanOrEqual(12);
      expect(s.dmg).toBeGreaterThan(8);
      expect(s.speed).toBeGreaterThan(1.8);
      expect(SHIP_PRICES[s.id]).toBeGreaterThan(UNLOCK_SALE_PRICES.kaiserbrecher);
      expect(shipCombatPower(s.id)).toBeGreaterThan(omegaPower);
    }
    expect(SHIP_PRICES.voidcrown).toBeGreaterThan(SHIP_PRICES.phobosclaw);
    expect(HTML).toContain('drawSpecialSheet: function');
    expect(HTML).toContain('SPECIAL_KITS');
  });
});
