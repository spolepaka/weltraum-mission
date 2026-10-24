import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BOSSES, MAX_LEVEL, bossForLevel, isBossLevel, isSectorBoss,
  lateBossArtRecipe, lateBossLevels,
} from '../src/lib/boss-catalog';
import { MAX_LEVEL as ECON_MAX, SHIP_PRICES, UNLOCK_SHIPS, outerSalePrice } from '../src/lib/economy';
import { OUTER_IDS, OUTER_SHIPS, outerCombat } from '../src/lib/outer-ships';
import { OUTER_IDS as SERVER_OUTER_IDS, OUTER_SHIPS as SERVER_OUTER, outerCombat as serverCombat } from '../server/spacetimedb/src/outer-ships';
import { shipCombat, shipCombatPower } from '../src/lib/versus';
import { shipCombatPower as serverPower } from '../server/spacetimedb/src/versus';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

const EARLY_SHIP_IDS = [
  'starter', 'blitz', 'komet', 'doppel', 'eis', 'falke', 'feuer', 'stern', 'titan', 'lanze',
  'koenig', 'nova', 'quanten', 'uni', 'rochen', 'phoenix', 'hammer', 'zwilling', 'gravitron',
  'spektral', 'segler', 'schatten', 'drache', 'omega', 'frostwal', 'lindwurm', 'hydra',
  'regenbogen', 'kaiserbrecher', 'beepbuggy', 'cloudcoupe', 'shadowspeeder', 'chromewasp', 'apexflash',
];

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
      expect(SHIP_PRICES[id]).toBe(outerSalePrice(OUTER_IDS.indexOf(id)));
      expect(UNLOCK_SHIPS[id]).toEqual({ level: OUTER_SHIPS.find((s) => s.id === id)!.unlockL });
      expect(shipCombat(id).dmg).toBe(client[id].dmg);
      expect(HTML).toContain(`id: "${id}"`);
      expect(HTML).toContain(`"${id}":`);
      expect(HTML).toContain(`hearts: ${client[id].hearts}`);
      expect(HTML).toContain(`price: ${SHIP_PRICES[id]}`);
    }
  });

  it('makes every Outer Fleet ship clearly stronger than every L1–100 ship', () => {
    const earlyPower = EARLY_SHIP_IDS.map((id) => shipCombatPower(id));
    const maxEarly = Math.max(...earlyPower);
    const maxEarlyHearts = Math.max(...EARLY_SHIP_IDS.map((id) => shipCombat(id).hearts));
    const maxEarlySpeed = Math.max(...EARLY_SHIP_IDS.map((id) => shipCombat(id).speed));
    const bestGeneralDmg = shipCombat('omega').dmg;
    expect(maxEarly).toBe(shipCombatPower('omega'));
    for (const s of OUTER_SHIPS) {
      const power = shipCombatPower(s.id);
      expect(s.hearts).toBeGreaterThan(maxEarlyHearts);
      expect(s.speed).toBeGreaterThan(maxEarlySpeed);
      expect(s.rate).toBeLessThan(0.2);
      expect(s.dmg).toBeGreaterThan(bestGeneralDmg);
      expect(s.shots).toBeGreaterThanOrEqual(3);
      expect(power).toBeGreaterThan(Math.round(maxEarly * 1.12));
      expect(serverPower(s.id)).toBe(power);
      const dps = (s.dmg * s.shots) / s.rate;
      expect(dps).toBeGreaterThan((14 * 1) / 0.45);
    }
    expect(OUTER_SHIPS[29].hearts).toBeGreaterThan(OUTER_SHIPS[0].hearts);
    expect(OUTER_SHIPS[29].dmg).toBeGreaterThan(OUTER_SHIPS[0].dmg);
    expect(outerSalePrice(0)).toBeGreaterThanOrEqual(360000);
    expect(outerSalePrice(29)).toBeGreaterThanOrEqual(outerSalePrice(0) * 6);
    expect(outerSalePrice(28)).toBeGreaterThan(outerSalePrice(0) * 5);
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
    expect(l250.hp).toBe(60000);
    expect(l250.prime).toBe(true);
    expect(HTML).toMatch(/if \(L === 100\) return \{ type: "emperor", hp: 9000/);
    expect(HTML).toMatch(/if \(L === 250\) return \{ type: "emperor", hp: PRIME_KAISER_HP/);
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

  it('pins the L250 Star Crown Kaiser overlay and leaves L1–99 boss draws alone', () => {
    const start = HTML.indexOf('  function drawEmperor(b) {');
    const prime = HTML.indexOf('    if (b.prime) {', start);
    const cracks = HTML.indexOf('    // Risse bei Schaden', prime);
    expect(prime).toBeGreaterThan(start);
    expect(cracks).toBeGreaterThan(prime);
    const overlay = HTML.slice(prime, cracks);
    expect(overlay).toContain('pulse = 0.5 + 0.5 * Math.sin(t * 5)');
    expect(overlay).toContain('for (var pr = 0; pr < 12; pr++)');
    expect(overlay).toContain('blade.addColorStop(1, "rgba(255,40,60,0)")');
    expect(overlay).toContain('ctx.translate(0, -148); ctx.rotate(t * 0.55)');
    expect(overlay).toContain('for (var or = 0; or < 5; or++)');
    expect(HTML).toContain('function drawRobo(b) {');
    expect(HTML).toContain('// Triebwerke (hinten = oben)');
    expect(HTML).toContain('function drawGolem');
    expect(HTML).toContain('function drawKraken');
    expect(HTML).toContain('function drawSun');
    expect(HTML).toContain('function drawGuardian');
    expect(HTML).toContain('late-boss-art-v2');
    expect(HTML).toContain('drawLateBossSheet: function');
    expect(HTML).toContain('RIVET DRONE');
    expect(HTML).toContain('VOID HERALD');
    expect(HTML).not.toMatch(/LATE_BOSS_NAMES = \{[^}]*250:/);
  });

  it('gives every 101–249 boss a unique silhouette recipe and redesigned art', () => {
    const levels = lateBossLevels();
    expect(levels[0]).toBe(102);
    expect(levels[levels.length - 1]).toBe(249);
    expect(levels).not.toContain(100);
    expect(levels).not.toContain(250);
    const keys = levels.map((L) => {
      const r = lateBossArtRecipe(L);
      return [r.hull, r.limbs, r.crown, r.guns, r.body, r.limbN, r.hue].join(':');
    });
    expect(new Set(keys).size).toBe(keys.length);
    expect(HTML).toContain('hull: a % 20');
    expect(HTML).toContain('limbN: 3 + (a % 4)');
    expect(HTML).toMatch(/function drawForgeBoss\(b\) \{[\s\S]*ctx\.rotate\(t \* 2\)/);
    expect(HTML).toMatch(/function drawFoundryBoss\(b\) \{[\s\S]*ctx\.rotate\(t \* 0\.35\)/);
    expect(HTML).toMatch(/function drawVaultBoss\(b\) \{[\s\S]*bezierCurveTo/);
    expect(HTML).toMatch(/function drawRingfleetBoss\(b\) \{[\s\S]*for \(var i = 0; i < 10; i\+\+\)/);
    expect(HTML).toMatch(/function drawStormcoreBoss\(b\) \{[\s\S]*for \(var i = 0; i < 8; i\+\+\)/);
    expect(bossForLevel(100)?.type).toBe('emperor');
    expect(bossForLevel(250)?.type).toBe('emperor');
    expect(bossForLevel(100)?.hp).toBe(9000);
    expect(bossForLevel(250)?.hp).toBe(60000);
  });

  it('gives every Outer Fleet ship a unique silhouette baked into HTML kits', () => {
    const shapes = OUTER_SHIPS.map((s) => s.kit.shape);
    expect(new Set(shapes).size).toBe(30);
    for (const s of OUTER_SHIPS) {
      expect(HTML).toContain(`"${s.id}":{"shape":"${s.kit.shape}"`);
    }
  });
});
