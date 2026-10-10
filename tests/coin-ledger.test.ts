import { describe, it, expect } from 'vitest';
import {
  awardLevelCoins,
  coinDeltaToPush,
  mergeCoins,
  shouldAcceptServerCoins,
} from '../src/lib/coin-ledger';
import { MIN_TIME_MS, validateLevelResult } from '../src/lib/validation';

describe('coin ledger', () => {
  it('never overwrites local coins with a lower server value', () => {
    expect(mergeCoins(1200, 400)).toBe(1200n);
    expect(shouldAcceptServerCoins(1200, 400)).toBe(false);
    expect(coinDeltaToPush(1200, 400)).toBe(800n);
  });

  it('accepts a higher server value and pushes nothing', () => {
    expect(mergeCoins(400, 1200)).toBe(1200n);
    expect(shouldAcceptServerCoins(400, 1200)).toBe(true);
    expect(coinDeltaToPush(400, 1200)).toBe(0n);
  });

  it('awards the level-end bonus on top of already-collected coins', () => {
    const award = awardLevelCoins(100, 50, 370);
    expect(award.collected).toBe(50);
    expect(award.bonus).toBe(370);
    expect(award.totalEarned).toBe(420);
    expect(award.newTotal).toBe(470);
  });

  it('allows a 3s level result so short wins are not rejected', () => {
    expect(MIN_TIME_MS).toBe(3000);
    const ok = validateLevelResult({
      level: 1,
      stars: 3,
      score: 500n,
      coinsEarned: 420n,
      timeMs: 3000n,
      heartsLeft: 3,
    }, 1);
    expect(ok.ok).toBe(true);
  });
});
