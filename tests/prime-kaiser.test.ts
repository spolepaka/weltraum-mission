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
  0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5,
  0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05,
];

describe('L250 prime Kaiser — 20 phases', () => {
  it('pins twenty HP-fraction thresholds, one every 5%', () => {
    expect(PRIME_KAISER_PHASES).toBe(20);
    expect(PRIME_KAISER_THRESHOLDS).toHaveLength(19);
    expect([...PRIME_KAISER_THRESHOLDS]).toEqual(THRESHOLDS);
    expect(HTML).toContain('PRIME_KAISER_PHASES = 20');
    expect(HTML).toContain('PRIME_KAISER_HP = 120000');
    expect(HTML).toMatch(/PRIME_KAISER_THRESHOLDS = \[0\.95, 0\.9, 0\.85, 0\.8, 0\.75, 0\.7, 0\.65, 0\.6, 0\.55, 0\.5, 0\.45, 0\.4, 0\.35, 0\.3, 0\.25, 0\.2, 0\.15, 0\.1, 0\.05\]/);
    expect(HTML).toContain('function primeKaiserPhase(fr)');
    expect(HTML).toContain('function primeKaiserFight(dt)');
    expect(HTML).toContain('function dropPrimeBomb');
    expect(HTML).toContain('function spawnSpiralGalaxy');
    expect(HTML).toContain('function startShockwave');
    expect(HTML).toContain('function startLaserCage');
    expect(HTML).toContain('function spawnShieldDrones');
    expect(HTML).toContain('function spawnMirrorClones');
    expect(HTML).toContain('function seedMineField');
    expect(HTML).toContain('function updatePrimeKaiserFx');
    expect(HTML).toContain('function drawPrimeKaiserFx');
  });

  it('maps every 5% HP band to phases 1 through 20', () => {
    expect(primeKaiserPhase(1)).toBe(1);
    expect(primeKaiserPhase(0.951)).toBe(1);
    expect(primeKaiserPhase(0.95)).toBe(2);
    expect(primeKaiserPhase(0.901)).toBe(2);
    expect(primeKaiserPhase(0.9)).toBe(3);
    expect(primeKaiserPhase(0.8)).toBe(5);
    expect(primeKaiserPhase(0.75)).toBe(6);
    expect(primeKaiserPhase(0.5)).toBe(11);
    expect(primeKaiserPhase(0.25)).toBe(16);
    expect(primeKaiserPhase(0.1)).toBe(19);
    expect(primeKaiserPhase(0.05)).toBe(20);
    expect(primeKaiserPhase(0)).toBe(20);
    const seen = new Set<number>();
    for (let i = 0; i <= 100; i++) seen.add(primeKaiserPhase(i / 100));
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, n) => n + 1));
  });

  it('doubles catalog HP and keeps L100 Kaiser at 9000 / 7 phases', () => {
    expect(PRIME_KAISER_HP).toBe(120000);
    expect(bossForLevel(250)?.hp).toBe(120000);
    expect(bossForLevel(250)?.prime).toBe(true);
    expect(bossForLevel(100)?.hp).toBe(9000);
    expect(bossForLevel(100)?.prime).toBeFalsy();
    expect(buildLevelPayload(250).boss?.hp).toBe(120000);
    expect(buildLevelPayload(100).boss?.hp).toBe(9000);
    expect(HTML).toMatch(/if \(L === 100\) return \{ type: "emperor", hp: 9000/);
    expect(HTML).toContain('if (b.prime) { primeKaiserFight(dt); }');
    expect(HTML).toContain('if (!b.prime) {');
  });

  it('shows a short Phase n/20 banner in EN and DE', () => {
    expect(en.game.phase).toBe('Phase');
    expect(de.game.phase).toBe('Phase');
    for (let n = 1; n <= 20; n++) {
      expect(en.tips[`primePhase${n}`]).toMatch(new RegExp(`Phase ${n}/20`));
      expect(de.tips[`primePhase${n}`]).toMatch(new RegExp(`Phase ${n}/20`));
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
    expect(fightHp).toBeCloseTo(264000, 0);
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
    expect(fightHp / starDps).toBeGreaterThan(70);
    expect(fightHp / starDps).toBeLessThan(120);
    expect(fightHp / voidDps).toBeGreaterThan(25);
    expect(fightHp / voidDps).toBeLessThan(70);
  });
});
