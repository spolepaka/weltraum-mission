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
  0.967, 0.933, 0.9, 0.867, 0.833, 0.8, 0.767, 0.733, 0.7, 0.667,
  0.633, 0.6, 0.567, 0.533, 0.5, 0.467, 0.433, 0.4, 0.367, 0.333,
  0.3, 0.267, 0.233, 0.2, 0.167, 0.133, 0.1, 0.067, 0.033,
];

describe('L250 prime Kaiser — 30 phases', () => {
  it('pins thirty HP-fraction thresholds, one every ~3.33%', () => {
    expect(PRIME_KAISER_PHASES).toBe(30);
    expect(PRIME_KAISER_THRESHOLDS).toHaveLength(29);
    expect([...PRIME_KAISER_THRESHOLDS]).toEqual(THRESHOLDS);
    expect(HTML).toContain('PRIME_KAISER_PHASES = 30');
    expect(HTML).toContain('PRIME_KAISER_HP = 180000');
    expect(HTML).toMatch(/PRIME_KAISER_THRESHOLDS = \[0\.967, 0\.933, 0\.9, 0\.867, 0\.833, 0\.8, 0\.767, 0\.733, 0\.7, 0\.667/);
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
    expect(HTML).toContain('function startPrimeDeath');
    expect(HTML).toContain('function drawStormDrone');
    expect(HTML).toContain('function updatePrimeKaiserFx');
    expect(HTML).toContain('function drawPrimeKaiserFx');
  });

  it('maps every ~3.33% HP band to phases 1 through 30', () => {
    expect(primeKaiserPhase(1)).toBe(1);
    expect(primeKaiserPhase(0.968)).toBe(1);
    expect(primeKaiserPhase(0.967)).toBe(2);
    expect(primeKaiserPhase(0.9)).toBe(4);
    expect(primeKaiserPhase(0.8)).toBe(7);
    expect(primeKaiserPhase(0.5)).toBe(16);
    expect(primeKaiserPhase(0.334)).toBe(20);
    expect(primeKaiserPhase(0.333)).toBe(21);
    expect(primeKaiserPhase(0.1)).toBe(28);
    expect(primeKaiserPhase(0.034)).toBe(29);
    expect(primeKaiserPhase(0.033)).toBe(30);
    expect(primeKaiserPhase(0)).toBe(30);
    const seen = new Set<number>();
    for (let i = 0; i <= 300; i++) seen.add(primeKaiserPhase(i / 300));
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, n) => n + 1));
  });

  it('raises catalog HP to 180k and keeps L100 Kaiser at 9000 / 7 phases', () => {
    expect(PRIME_KAISER_HP).toBe(180000);
    expect(bossForLevel(250)?.hp).toBe(180000);
    expect(bossForLevel(250)?.prime).toBe(true);
    expect(bossForLevel(100)?.hp).toBe(9000);
    expect(bossForLevel(100)?.prime).toBeFalsy();
    expect(buildLevelPayload(250).boss?.hp).toBe(180000);
    expect(buildLevelPayload(100).boss?.hp).toBe(9000);
    expect(HTML).toMatch(/if \(L === 100\) return \{ type: "emperor", hp: 9000/);
    expect(HTML).toContain('if (b.prime) { primeKaiserFight(dt); }');
    expect(HTML).toContain('if (!b.prime) {');
  });

  it('shows a short Phase n/30 banner in EN and DE', () => {
    expect(en.game.phase).toBe('Phase');
    expect(de.game.phase).toBe('Phase');
    for (let n = 1; n <= 30; n++) {
      expect(en.tips[`primePhase${n}`]).toMatch(new RegExp(`Phase ${n}/30`));
      expect(de.tips[`primePhase${n}`]).toMatch(new RegExp(`Phase ${n}/30`));
    }
    expect(HTML).toContain('tr("game.phase") + " " + b.phase + "/" + (b.prime ? PRIME_KAISER_PHASES');
    expect(HTML).toContain('"Phase " + rp + "/" + PRIME_KAISER_PHASES');
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
    expect(fightHp).toBeCloseTo(396000, 0);
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
    expect(fightHp / starDps).toBeGreaterThan(100);
    expect(fightHp / starDps).toBeLessThan(180);
    expect(fightHp / voidDps).toBeGreaterThan(35);
    expect(fightHp / voidDps).toBeLessThan(110);
  });
});
