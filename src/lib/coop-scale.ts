/** Co-op combat scaling. 1 player = 1×; 3 players ≈ 3× boss HP. */

export const COOP_MAX_PLAYERS = 5;

export function clampPlayerCount(n: number): number {
  return Math.max(1, Math.min(COOP_MAX_PLAYERS, Math.floor(n) || 1));
}

/** Boss / enemy HP. Linear with player count so 3p ≈ 3× tank. */
export function coopBossHpScale(players: number): number {
  return clampPlayerCount(players);
}

/** Spawn rate. Sub-linear so the screen is busy but not a wall. */
export function coopSpawnScale(players: number): number {
  const n = clampPlayerCount(players);
  return 1 + 0.45 * (n - 1);
}

/** Boss attack / bullet density. */
export function coopAtkScale(players: number): number {
  const n = clampPlayerCount(players);
  return 1 + 0.25 * (n - 1);
}
