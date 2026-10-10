import { describe, expect, it } from 'vitest';
import { coinCapForLevel, DIFFICULTY_TUNING, parseDifficulty, survivalIndex } from '../src/lib/difficulty';
import { typicalLoadoutByL6 } from '../src/lib/typical-loadout';
import { isoWeekKey, weeklyChallenge } from '../src/lib/weekly';
import { funnelKey } from '../src/lib/analytics';
import { validateLevelResult } from '../src/lib/validation';

describe('difficulty modes', () => {
  it('defaults unknown values to normal', () => {
    expect(parseDifficulty('nope')).toBe('normal');
    expect(parseDifficulty('easy')).toBe('easy');
  });

  it('makes Easy clearly easier and Veteran clearly harder', () => {
    const easy = survivalIndex('easy');
    const normal = survivalIndex('normal');
    const veteran = survivalIndex('veteran');
    expect(easy).toBeGreaterThan(normal * 1.3);
    expect(normal).toBeGreaterThan(veteran * 1.3);
    expect(DIFFICULTY_TUNING.veteran.coinMult).toBeGreaterThan(DIFFICULTY_TUNING.easy.coinMult);
    expect(DIFFICULTY_TUNING.easy.extraHearts).toBeGreaterThan(DIFFICULTY_TUNING.veteran.extraHearts);
  });

  it('gives a typical L1–L5 shopper a paid ship and combat upgrades by L6', () => {
    const load = typicalLoadoutByL6('normal');
    expect(load.coins).toBeGreaterThan(2000);
    expect(load.ship).not.toBe('starter');
    expect(load.up.heart + load.up.dmg + load.up.rate).toBeGreaterThan(0);
  });

  it('raises the coin cap for Veteran and lowers it for Easy', () => {
    expect(coinCapForLevel(4, 'veteran')).toBeGreaterThan(coinCapForLevel(4, 'normal'));
    expect(coinCapForLevel(4, 'easy')).toBeLessThan(coinCapForLevel(4, 'normal'));
    const vet = validateLevelResult({
      level: 4, stars: 3, score: 100n, coinsEarned: 28000n, timeMs: 4000n, heartsLeft: 1, mode: 'veteran',
    });
    expect(vet.ok).toBe(true);
    const easyTooMuch = validateLevelResult({
      level: 4, stars: 3, score: 100n, coinsEarned: 28000n, timeMs: 4000n, heartsLeft: 2, mode: 'easy',
    });
    expect(easyTooMuch.ok).toBe(false);
  });
});

describe('weekly challenge', () => {
  it('is deterministic per ISO week', () => {
    const a = weeklyChallenge('2026-W41');
    const b = weeklyChallenge('2026-W41');
    const c = weeklyChallenge('2026-W42');
    expect(a.level).toBe(b.level);
    expect(a.seed).toBe(b.seed);
    expect(c.level !== a.level || c.seed !== a.seed).toBe(true);
    expect(isoWeekKey(new Date('2026-10-08T12:00:00Z'))).toMatch(/^2026-W/);
  });
});

describe('analytics funnel keys', () => {
  it('maps events without storing free text', () => {
    expect(funnelKey('session_start')).toBe('session_start');
    expect(funnelKey('level_win', 3)).toBe('level3_win');
    expect(funnelKey('level_win', 2)).toBeNull();
    expect(funnelKey('room_joined')).toBe('multiplayer');
  });
});
