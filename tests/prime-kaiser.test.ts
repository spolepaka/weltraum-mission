import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PRIME_KAISER_HP,
  PRIME_KAISER_PHASES,
  PRIME_KAISER_THRESHOLDS,
  bossForLevel,
  primeKaiserPhase,
} from '../src/lib/boss-catalog';
import { buildLevelPayload } from '../src/lib/level-catalog';
import { OUTER_SHIPS } from '../src/lib/outer-ships';
import { SPECIAL_SHIPS } from '../src/lib/special-ships';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

const THRESHOLDS = [
  0.98, 0.96, 0.94, 0.92, 0.9, 0.88, 0.86, 0.84, 0.82, 0.8,
  0.78, 0.76, 0.74, 0.72, 0.7, 0.68, 0.66, 0.64, 0.62, 0.6,
  0.58, 0.56, 0.54, 0.52, 0.5, 0.48, 0.46, 0.44, 0.42, 0.4,
  0.38, 0.36, 0.34, 0.32, 0.3, 0.28, 0.26, 0.24, 0.22, 0.2,
  0.18, 0.16, 0.14, 0.12, 0.1, 0.08, 0.06, 0.04, 0.02,
];

describe('L250 prime Kaiser — 50 phases', () => {
  it('pins fifty HP-fraction thresholds, one every ~2%', () => {
    expect(PRIME_KAISER_PHASES).toBe(50);
    expect(PRIME_KAISER_THRESHOLDS).toHaveLength(49);
    expect([...PRIME_KAISER_THRESHOLDS]).toEqual(THRESHOLDS);
    expect(HTML).toContain('PRIME_KAISER_PHASES = 50');
    expect(HTML).toContain('PRIME_KAISER_HP = 810000');
    expect(HTML).toMatch(/PRIME_KAISER_THRESHOLDS = \[0\.98, 0\.96, 0\.94, 0\.92, 0\.9, 0\.88/);
    expect(HTML).toContain('function primeKaiserPhase(fr)');
    expect(HTML).toContain('function primeKaiserFight(dt)');
    expect(HTML).toContain('function dropPrimeBomb');
    expect(HTML).toContain('function spawnSpiralGalaxy');
    expect(HTML).toContain('function startShockwave');
    expect(HTML).toContain('function startLaserCage');
    expect(HTML).toContain('function spawnShieldDrones');
    expect(HTML).toContain('function spawnMirrorClones');
    expect(HTML).toContain('function seedMineField');
    expect(HTML).toContain('function spawnDroneStorm');
    expect(HTML).toContain('function startTwinWells');
    expect(HTML).toContain('function spawnHeavySwarm');
    expect(HTML).toContain('function seedOrbitMines');
    expect(HTML).toContain('function startPrimeDeath');
    expect(HTML).toContain('function drawStormDrone');
    expect(HTML).toContain('function updatePrimeKaiserFx');
    expect(HTML).toContain('function drawPrimeKaiserFx');
  });

  it('maps every ~2% HP band to phases 1 through 50', () => {
    expect(primeKaiserPhase(1)).toBe(1);
    expect(primeKaiserPhase(0.981)).toBe(1);
    expect(primeKaiserPhase(0.98)).toBe(2);
    expect(primeKaiserPhase(0.9)).toBe(6);
    expect(primeKaiserPhase(0.8)).toBe(11);
    expect(primeKaiserPhase(0.5)).toBe(26);
    expect(primeKaiserPhase(0.4)).toBe(31);
    expect(primeKaiserPhase(0.021)).toBe(49);
    expect(primeKaiserPhase(0.02)).toBe(50);
    expect(primeKaiserPhase(0)).toBe(50);
    const seen = new Set<number>();
    for (let i = 0; i <= 500; i++) seen.add(primeKaiserPhase(i / 500));
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, n) => n + 1));
  });

  it('raises catalog HP to 810k and keeps L100 Kaiser at 9000 / 7 phases', () => {
    expect(PRIME_KAISER_HP).toBe(810000);
    expect(bossForLevel(250)?.hp).toBe(810000);
    expect(bossForLevel(250)?.prime).toBe(true);
    expect(bossForLevel(100)?.hp).toBe(9000);
    expect(bossForLevel(100)?.prime).toBeFalsy();
    expect(buildLevelPayload(250).boss?.hp).toBe(810000);
    expect(buildLevelPayload(100).boss?.hp).toBe(9000);
    expect(HTML).toMatch(/if \(L === 100\) return \{ type: "emperor", hp: 9000/);
    expect(HTML).toContain('if (b.prime) { primeKaiserFight(dt); }');
    expect(HTML).toContain('if (!b.prime) {');
  });

  it('shows a short Phase n/50 banner in EN and DE', () => {
    expect(en.game.phase).toBe('Phase');
    expect(de.game.phase).toBe('Phase');
    for (let n = 1; n <= 50; n++) {
      expect(en.tips[`primePhase${n}`]).toMatch(new RegExp(`Phase ${n}/50`));
      expect(de.tips[`primePhase${n}`]).toMatch(new RegExp(`Phase ${n}/50`));
    }
    expect(HTML).toContain('tr("game.phase") + " " + b.phase + "/" + PRIME_KAISER_PHASES');
    expect(HTML).toContain('"Phase " + rp + "/" + PRIME_KAISER_PHASES');
    expect(HTML).toContain('function drawPrimeBossBar');
    expect(HTML).toContain('function primePhaseBand');
    expect(HTML).toMatch(/labelW \? labelW \+ 10/);
    expect(HTML).toContain('i === 8 || i === 18 || i === 28 || i === 38');
    expect(HTML).toContain('rgba(255,255,220,.48)');
    expect(HTML).toContain('finiteN(b.hp, 0)');
    expect(HTML).toContain('if (b.prime) { drawPrimeBossBar(b); return; }');
    expect(HTML).toContain('var bw = Math.min(big ? 480 : 320, W * (big ? 0.6 : 0.7))');
    expect(HTML).not.toMatch(/PRIME_PHASE_MIN|phaseBreak|clampPrimeBossHp/);
  });

  it('does not rewrite L250 or L100 Kaiser art', () => {
    const start = HTML.indexOf('  function drawEmperor(b) {');
    const prime = HTML.indexOf('    if (b.prime) {', start);
    expect(start).toBeGreaterThan(0);
    expect(prime).toBeGreaterThan(start);
    expect(HTML.slice(prime, prime + 400)).toContain('pulse = 0.5 + 0.5 * Math.sin(t * 5)');
  });

  it('stays beatable vs a fully upgraded Star Crown or Void Crown', () => {
    const heat250 = 1.72 + 0.48;
    const fightHp = PRIME_KAISER_HP * heat250;
    expect(heat250).toBeCloseTo(2.2, 5);
    expect(fightHp).toBeCloseTo(1782000, 0);
    const star = OUTER_SHIPS.find((s) => s.id === 'starcrown');
    const voidc = SPECIAL_SHIPS.find((s) => s.id === 'voidcrown');
    expect(star).toBeTruthy();
    expect(voidc).toBeTruthy();
    function gunDps(dmg: number, rate: number, shots: number, extra = 1) {
      const upDmg = dmg * (1 + 0.25 * 5);
      const upRate = rate * (1 - 0.12 * 3 - 0.06 * 2);
      return (shots * upDmg / upRate) * extra;
    }
    const starDps = gunDps(star!.dmg, star!.rate, star!.shots) + 4 * 1.5 * ((star!.dmg * 2.25) / 2.9) / 0.55;
    const voidDps = gunDps(voidc!.dmg, voidc!.rate, voidc!.shots, 1.6) * 1.7;
    expect(fightHp / starDps).toBeGreaterThan(420);
    expect(fightHp / starDps).toBeLessThan(810);
    expect(fightHp / voidDps).toBeGreaterThan(150);
    expect(fightHp / voidDps).toBeLessThan(480);
  });
});
