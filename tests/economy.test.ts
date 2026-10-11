import { describe, expect, it } from 'vitest';
import {
  SHIP_PRICES,
  clampLevelCoins,
  expectedCoinsForLevel,
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
