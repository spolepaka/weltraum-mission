import { describe, it, expect } from 'vitest';
import { validateLevelResult } from '../src/lib/validation';

describe('level result validation', () => {
  it('accepts a normal level 1 result', () => {
    expect(validateLevelResult({
      level: 1,
      stars: 3,
      score: 5000n,
      coinsEarned: 370n,
      timeMs: 35000n,
      heartsLeft: 3,
    }, 1).ok).toBe(true);
  });

  it('rejects locked levels, huge scores, and too-fast times', () => {
    const locked = validateLevelResult({
      level: 99, stars: 3, score: 1n, coinsEarned: 1n, timeMs: 30000n, heartsLeft: 3,
    }, 1);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.reason).toBe('level_locked');

    const score = validateLevelResult({
      level: 1, stars: 3, score: 99999999n, coinsEarned: 1n, timeMs: 30000n, heartsLeft: 3,
    }, 1);
    expect(score.ok).toBe(false);
    if (!score.ok) expect(score.reason).toBe('score_exceeds_max');

    const time = validateLevelResult({
      level: 1, stars: 3, score: 1n, coinsEarned: 1n, timeMs: 1000n, heartsLeft: 3,
    }, 1);
    expect(time.ok).toBe(false);
    if (!time.ok) expect(time.reason).toBe('invalid_time');
  });
});
