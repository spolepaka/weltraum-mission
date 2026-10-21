import { describe, expect, it } from 'vitest';
import {
  SHIP_PRICES,
  clampLevelCoins,
  coopBossKillAward,
  expectedCoinsForLevel,
  isMillionScaleGrant,
  levelClearBonus,
  maxCoinsForLevel,
  typicalCollectedCoins,
} from '../src/lib/economy';
import { maxCoinsForLevel as serverCap } from '../server/spacetimedb/src/economy';
import { validateLevelResult } from '../src/lib/validation';

const LEVELS = [1, 10, 30, 50, 75, 99, 100] as const;

describe('coin economy', () => {
  it('matches the live 10× bonus formula (Joshi request, late bosses pay a lot)', () => {
    expect(levelClearBonus(1, 3)).toBe(370);
    expect(levelClearBonus(99, 3)).toBe(11630);
    expect(levelClearBonus(99, 1)).toBeGreaterThan(11000);
    expect(levelClearBonus(99, 3)).toBeGreaterThan(7000);
  });

  it('pays the same per player in 1–5 player co-op', () => {
    for (const L of LEVELS) {
      const solo = expectedCoinsForLevel(L, 1);
      for (let n = 2; n <= 5; n++) {
        expect(expectedCoinsForLevel(L, n)).toBe(solo);
      }
    }
  });

  it('caps a match so one clear cannot buy the late shop', () => {
    expect(maxCoinsForLevel(1)).toBeLessThan(SHIP_PRICES.titan);
    expect(maxCoinsForLevel(10)).toBeLessThan(SHIP_PRICES.nova);
    expect(maxCoinsForLevel(99)).toBeLessThan(SHIP_PRICES.phoenix);
    expect(SHIP_PRICES.apexflash).toBeGreaterThan(expectedCoinsForLevel(100) * 10);
    expect(SHIP_PRICES.beepbuggy).toBe(900);
    expect(maxCoinsForLevel(99)).toBeGreaterThan(7000);
    expect(clampLevelCoins(999999, 99)).toBe(maxCoinsForLevel(99));
  });

  it('keeps client and server caps in lockstep', () => {
    for (const L of LEVELS) {
      expect(serverCap(L, 'normal')).toBe(maxCoinsForLevel(L, 'normal'));
      expect(serverCap(L, 'veteran')).toBe(maxCoinsForLevel(L, 'veteran'));
    }
  });

  it('rejects a forged L99 pile that used to pass the 5000×level cap', () => {
    const huge = validateLevelResult({
      level: 99, stars: 3, score: 100n, coinsEarned: 200000n, timeMs: 4000n, heartsLeft: 1, mode: 'normal',
    });
    expect(huge.ok).toBe(false);
    const honest = validateLevelResult({
      level: 99, stars: 3, score: 100n, coinsEarned: BigInt(levelClearBonus(99, 3) + typicalCollectedCoins(99)),
      timeMs: 4000n, heartsLeft: 1, mode: 'normal',
    });
    expect(honest.ok).toBe(true);
  });

  it('caps a co-op L100 Robo-Kaiser clear well below 1,000,000', () => {
    const cap = maxCoinsForLevel(100);
    expect(cap).toBe(16686);
    expect(coopBossKillAward(100, 3, 1_000_000, 'normal', 5)).toBe(cap);
    expect(coopBossKillAward(100, 3, 620, 'normal', 5)).toBeLessThan(cap);
    expect(isMillionScaleGrant(1_000_000)).toBe(true);
    expect(isMillionScaleGrant(cap)).toBe(false);
    const huge = validateLevelResult({
      level: 100, stars: 3, score: 100n, coinsEarned: 1_000_000n, timeMs: 4000n, heartsLeft: 1, mode: 'normal',
    });
    expect(huge.ok).toBe(false);
    expect(huge.reason).toBe('coins_exceed_max');
  });

  it('identifies the owner secret as the only legitimate 1,000,000 grant', () => {
    // Root cause of the reported L100 ~1M pile: JOSHIE1000000 / JOSHI1000000.
    // A real Robo-Kaiser clear cannot mint that amount on any player count.
    expect(levelClearBonus(100, 3) + typicalCollectedCoins(100)).toBeLessThan(20_000);
    expect(coopBossKillAward(100, 3, 50_000, 'veteran', 5)).toBe(maxCoinsForLevel(100, 'veteran'));
    expect(maxCoinsForLevel(100, 'veteran')).toBeLessThan(30_000);
    expect(isMillionScaleGrant(levelClearBonus(100, 3))).toBe(false);
  });

  it('prints the payout table for the report', () => {
    const table = LEVELS.map((L) => ({
      level: L,
      solo: expectedCoinsForLevel(L, 1),
      coop2: expectedCoinsForLevel(L, 2),
      coop5: expectedCoinsForLevel(L, 5),
      cap: maxCoinsForLevel(L),
    }));
    expect(table[0].solo).toBe(table[0].coop5);
    expect(table.at(-1)?.cap).toBeGreaterThan(table.at(-1)!.solo);
  });
});
