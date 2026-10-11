/** Keep in lockstep with src/lib/economy.ts — spacetime module cannot import the client tree. */

export const MAX_LEVEL = 100;

export function isBossLevel(level: number): boolean {
  return level > 0 && (level % 3 === 0 || level === 100);
}

export function modeCoinMult(mode?: string): number {
  return mode === 'veteran' ? 1.5 : mode === 'easy' ? 0.75 : 1;
}

export function levelClearBonus(level: number, stars: number, mode?: string): number {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level) || 1));
  const st = Math.max(0, Math.min(3, Math.floor(stars) || 0));
  const boss = isBossLevel(L) ? 40 + L * 8 : 0;
  return Math.round((10 + L * 3 + st * 8 + boss) * 10 * modeCoinMult(mode));
}

export function typicalCollectedCoins(level: number, mode?: string): number {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level) || 1));
  return Math.round((20 + L * 6) * modeCoinMult(mode));
}

export function maxCoinsForLevel(level: number, mode?: string): number {
  const bonus = levelClearBonus(level, 3, mode);
  const collected = typicalCollectedCoins(level, mode);
  return Math.ceil((bonus + collected) * 1.35);
}
