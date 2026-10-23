import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOSSES, MAX_LEVEL, bossForLevel, isBossLevel, isSectorBoss } from '../src/lib/boss-catalog';
import { MAX_LEVEL as ECON_MAX, SHIP_PRICES, UNLOCK_SHIPS } from '../src/lib/economy';
import { OUTER_IDS, OUTER_SHIPS, outerCombat } from '../src/lib/outer-ships';
import { OUTER_IDS as SERVER_OUTER_IDS, OUTER_SHIPS as SERVER_OUTER, outerCombat as serverCombat } from '../server/spacetimedb/src/outer-ships';
import { shipCombat } from '../src/lib/versus';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('outer fleet ships', () => {
  it('adds 30 distinct unlockable ships every 5 levels from 105 to 250', () => {
    expect(OUTER_SHIPS).toHaveLength(30);
    expect(new Set(OUTER_IDS).size).toBe(30);
    expect(OUTER_SHIPS.map((s) => s.unlockL)).toEqual(
      Array.from({ length: 30 }, (_, i) => 105 + i * 5),
    );
    expect(OUTER_SHIPS[0].id).toBe('rivet');
    expect(OUTER_SHIPS[29].id).toBe('starcrown');
    expect(OUTER_SHIPS[29].hearts).toBeGreaterThanOrEqual(OUTER_SHIPS[0].hearts);
    expect(OUTER_SHIPS[29].dmg).toBeGreaterThan(OUTER_SHIPS[0].dmg);
  });

  it('keeps client, server, versus and HTML catalogs in lockstep', () => {
    expect(ECON_MAX).toBe(250);
    expect(SERVER_OUTER_IDS).toEqual(OUTER_IDS);
    expect(SERVER_OUTER.map((s) => s.id)).toEqual(OUTER_IDS);
    const client = outerCombat();
    const server = serverCombat();
    for (const id of OUTER_IDS) {
      expect(server[id]).toEqual(client[id]);
      expect(SHIP_PRICES[id]).toBe(0);
      expect(UNLOCK_SHIPS[id]).toEqual({ level: OUTER_SHIPS.find((s) => s.id === id)!.unlockL });
      expect(shipCombat(id).dmg).toBe(client[id].dmg);
      expect(HTML).toContain(`id: "${id}"`);
      expect(HTML).toContain(`"${id}":`);
    }
  });
});

describe('250-level bosses and Kaiser split', () => {
  it('keeps a unique named boss on every boss level including 100 and 250', () => {
    expect(MAX_LEVEL).toBe(250);
    expect(isBossLevel(100)).toBe(true);
    expect(isBossLevel(250)).toBe(true);
    expect(isBossLevel(249)).toBe(true);
    expect(isSectorBoss(250)).toBe(true);
    expect(BOSSES).toHaveLength(85);
    const names = BOSSES.map((b) => b.nameEn);
    expect(new Set(names).size).toBe(names.length);
    expect(HTML).toContain('function drawArtBoss');
    expect(HTML).toContain('function drawForgeBoss');
    expect(HTML).toContain('function drawStormcoreBoss');
    expect(HTML).toContain('MAX_LEVEL_C = 250');
    expect(HTML).toContain('id="worldPager"');
  });

  it('leaves the level 100 Kaiser untouched and adds a stronger prime Kaiser at 250', () => {
    const l100 = bossForLevel(100)!;
    const l250 = bossForLevel(250)!;
    expect(l100.type).toBe('emperor');
    expect(l100.hp).toBe(9000);
    expect(l100.prime).toBeFalsy();
    expect(l250.type).toBe('emperor');
    expect(l250.hp).toBe(20000);
    expect(l250.prime).toBe(true);
    expect(HTML).toMatch(/if \(L === 100\) return \{ type: "emperor", hp: 9000/);
    expect(HTML).toMatch(/if \(L === 250\) return \{ type: "emperor", hp: 20000/);
    expect(HTML).toContain('spec.prime');
    expect(HTML).toContain('if (b.prime)');
  });
});
