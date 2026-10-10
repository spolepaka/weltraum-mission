/**
 * Shared client/server anti-cheat bounds.
 * Keep in sync with server/spacetimedb/src/index.ts
 */

export const MAX_LEVEL = 100;
export const MAX_SCORE_PER_LEVEL = 100_000;
export const MAX_COINS_PER_LEVEL = 5_000;
export const MIN_TIME_MS = 10_000;
export const MAX_TIME_MS = 600_000;

export interface LevelResultInput {
  level: number;
  stars: number;
  score: bigint;
  coinsEarned: bigint;
  timeMs: bigint;
  heartsLeft: number;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateLevelResult(
  result: LevelResultInput,
  unlockedLevel?: number
): ValidationResult {
  if (!Number.isInteger(result.level) || result.level < 1 || result.level > MAX_LEVEL) {
    return { ok: false, reason: 'invalid_level' };
  }
  if (unlockedLevel !== undefined && result.level > unlockedLevel) {
    return { ok: false, reason: 'level_locked' };
  }
  if (result.stars < 0 || result.stars > 3) {
    return { ok: false, reason: 'invalid_stars' };
  }
  const maxScore = BigInt(result.level * MAX_SCORE_PER_LEVEL);
  if (result.score < 0n || result.score > maxScore) {
    return { ok: false, reason: 'score_exceeds_max' };
  }
  const maxCoins = BigInt(result.level * MAX_COINS_PER_LEVEL);
  if (result.coinsEarned < 0n || result.coinsEarned > maxCoins) {
    return { ok: false, reason: 'coins_exceed_max' };
  }
  if (result.timeMs < BigInt(MIN_TIME_MS) || result.timeMs > BigInt(MAX_TIME_MS)) {
    return { ok: false, reason: 'invalid_time' };
  }
  return { ok: true };
}
