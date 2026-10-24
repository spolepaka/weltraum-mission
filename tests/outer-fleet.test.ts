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

  it('keeps the L100 Kaiser draw path, art, and size formula exactly as they are now', () => {
    const start = HTML.indexOf('  function drawEmperor(b) {');
    const prime = HTML.indexOf('    if (b.prime) {', start);
    expect(start).toBeGreaterThan(0);
    expect(prime).toBeGreaterThan(start);
    const body = HTML.slice(start, prime);
    expect(body).toContain('// Triebwerk-Glühen hinter dem Rücken');
    expect(body).toContain('// Mechanische Arme');
    expect(body).toContain('// Torso (Panzer)');
    expect(body).toContain('// Schulter-Kanonen');
    expect(body).toContain('// Energie-Kern in der Brust (pulsiert)');
    expect(body).toContain('// Hals + Kopf');
    expect(body).toContain('// Visier mit roten Augen');
    expect(body).toContain('// Leuchtende Krone');
    expect(body).toContain('ctx.fillRect(-28 + lx, -100, 20, 9)');
    expect(body).toContain('ctx.moveTo(-44, 10); ctx.lineTo(-44, -16); ctx.lineTo(-22, 0); ctx.lineTo(0, -26)');
    expect(body).not.toContain('Star Crown');
    expect(body).not.toContain('pulse = 0.5 + 0.5 * Math.sin(t * 5)');
    expect(HTML).toContain(
      'spec.prime ? Math.min(W * 0.72, H * 0.82, 760) : Math.min(W * 0.5, H * 0.62, 500)',
    );
    const W = 1024, H = 720;
    expect(Math.round(Math.min(W * 0.5, H * 0.62, 500))).toBe(446);
    expect(Math.round(Math.min(W * 0.72, H * 0.82, 760))).toBe(590);
  });

  it('gives every Outer Fleet ship a unique silhouette baked into HTML kits', () => {
    const shapes = OUTER_SHIPS.map((s) => s.kit.shape);
    expect(new Set(shapes).size).toBe(30);
    for (const s of OUTER_SHIPS) {
      expect(HTML).toContain(`"${s.id}":{"shape":"${s.kit.shape}"`);
    }
  });
});
