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
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('L250 prime Kaiser — 10 phases', () => {
  it('pins ten HP-fraction thresholds, one every 10%', () => {
    expect(PRIME_KAISER_PHASES).toBe(10);
    expect(PRIME_KAISER_THRESHOLDS).toHaveLength(9);
    expect([...PRIME_KAISER_THRESHOLDS]).toEqual([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]);
    expect(HTML).toContain('PRIME_KAISER_PHASES = 10');
    expect(HTML).toMatch(/PRIME_KAISER_THRESHOLDS = \[0\.9, 0\.8, 0\.7, 0\.6, 0\.5, 0\.4, 0\.3, 0\.2, 0\.1\]/);
    expect(HTML).toContain('function primeKaiserPhase(fr)');
    expect(HTML).toContain('function primeKaiserFight(dt)');
  });

  it('maps every 10% HP band to phases 1 through 10', () => {
    expect(primeKaiserPhase(1)).toBe(1);
    expect(primeKaiserPhase(0.95)).toBe(1);
    expect(primeKaiserPhase(0.901)).toBe(1);
    expect(primeKaiserPhase(0.9)).toBe(2);
    expect(primeKaiserPhase(0.81)).toBe(2);
    expect(primeKaiserPhase(0.8)).toBe(3);
    expect(primeKaiserPhase(0.7)).toBe(4);
    expect(primeKaiserPhase(0.6)).toBe(5);
    expect(primeKaiserPhase(0.5)).toBe(6);
    expect(primeKaiserPhase(0.4)).toBe(7);
    expect(primeKaiserPhase(0.3)).toBe(8);
    expect(primeKaiserPhase(0.2)).toBe(9);
    expect(primeKaiserPhase(0.1)).toBe(10);
    expect(primeKaiserPhase(0.05)).toBe(10);
    expect(primeKaiserPhase(0)).toBe(10);
    const seen = new Set<number>();
    for (let i = 0; i <= 100; i++) seen.add(primeKaiserPhase(i / 100));
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('raises catalog HP and keeps L100 Kaiser at 9000 / 7 phases', () => {
    expect(PRIME_KAISER_HP).toBe(60000);
    expect(bossForLevel(250)?.hp).toBe(60000);
    expect(bossForLevel(250)?.prime).toBe(true);
    expect(bossForLevel(100)?.hp).toBe(9000);
    expect(bossForLevel(100)?.prime).toBeFalsy();
    expect(buildLevelPayload(250).boss?.hp).toBe(60000);
    expect(buildLevelPayload(100).boss?.hp).toBe(9000);
    expect(HTML).toMatch(/if \(L === 100\) return \{ type: "emperor", hp: 9000/);
    expect(HTML).toContain('if (b.prime) { primeKaiserFight(dt); }');
    expect(HTML).not.toContain('if (b.prime) {\n        b.fx4');
  });

  it('shows a short Phase n/10 banner in EN and DE', () => {
    expect(en.game.phase).toBe('Phase');
    expect(de.game.phase).toBe('Phase');
    for (let n = 1; n <= 10; n++) {
      expect(en.tips[`primePhase${n}`]).toMatch(new RegExp(`Phase ${n}/10`));
      expect(de.tips[`primePhase${n}`]).toMatch(new RegExp(`Phase ${n}/10`));
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
});
