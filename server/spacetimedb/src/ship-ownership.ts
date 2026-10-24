/**
 * Server copy of unlock-vs-owned rules. ownedShip is the only hangar truth.
 * Keep lockstep with src/lib/ship-ownership.ts.
 */

export type UnlockRule = { level?: number; ach?: string };

export type UnlockProgress = {
  starredLevels?: Iterable<number>;
  stars?: Record<string | number, number>;
  unlockedLevel?: number;
  achievements?: Iterable<string>;
};

export function starredLevelSet(progress: UnlockProgress): Set<number> {
  const out = new Set<number>();
  for (const level of progress.starredLevels || []) {
    const n = Number(level);
    if (Number.isFinite(n) && n > 0) out.add(n);
  }
  for (const [key, value] of Object.entries(progress.stars || {})) {
    const n = Number(key);
    if (Number.isFinite(n) && n > 0 && Number(value) > 0) out.add(n);
  }
  return out;
}

export function unlockEarned(
  rule: UnlockRule | undefined,
  progress: UnlockProgress,
  opts?: { allowUnlockedLevel?: boolean },
): boolean {
  if (!rule) return false;
  if (rule.level) {
    const starred = starredLevelSet(progress);
    const byStar = starred.has(rule.level);
    const byUnlock = !!opts?.allowUnlockedLevel && (progress.unlockedLevel ?? 1) >= rule.level;
    if (!byStar && !byUnlock) return false;
  }
  if (rule.ach) {
    const have = new Set(progress.achievements || []);
    if (!have.has(rule.ach)) return false;
  }
  return !!(rule.level || rule.ach);
}

export function earnedUnlockShipIds(
  rules: Record<string, UnlockRule>,
  progress: UnlockProgress,
  opts?: { allowUnlockedLevel?: boolean },
): string[] {
  return Object.keys(rules).filter((id) => unlockEarned(rules[id], progress, opts));
}

export function grantEarnedOwned(
  owned: readonly string[],
  earned: readonly string[],
): string[] {
  const ships = [...new Set([...owned.filter(Boolean), ...earned.filter(Boolean)])];
  return ships.length ? ships : ['starter'];
}
