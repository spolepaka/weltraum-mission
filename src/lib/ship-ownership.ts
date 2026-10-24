/**
 * ownedShip is the only source of truth for hangar Owned / equip.
 * Unlocked-by-level is "free to claim" until the server inserts a row.
 */

export type UnlockRule = { level?: number; ach?: string };

export type ShopShipKind = 'equipped' | 'owned' | 'free_to_claim' | 'buy' | 'locked';

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

export function shopShipKind(input: {
  owned: boolean;
  equipped: boolean;
  unlockEarned: boolean;
  forSale: boolean;
}): ShopShipKind {
  if (input.owned && input.equipped) return 'equipped';
  if (input.owned) return 'owned';
  if (input.unlockEarned) return 'free_to_claim';
  if (input.forSale) return 'buy';
  return 'locked';
}

export function ownedFromServer(remoteOwned: readonly string[]): string[] {
  const ships = [...new Set((remoteOwned || []).filter(Boolean))];
  return ships.length ? ships : ['starter'];
}

/** Reload, login, and second-device: drop every local-only phantom. */
export function replaceOwnedFromServer(
  _localOwned: readonly string[],
  remoteOwned: readonly string[],
): string[] {
  return ownedFromServer(remoteOwned);
}

export function sanitizeEquipped(
  owned: readonly string[],
  equipped: string | undefined,
  fallback = 'starter',
): string {
  if (equipped && owned.includes(equipped)) return equipped;
  if (owned.includes(fallback)) return fallback;
  return owned[0] || fallback;
}

export function canEquip(owned: readonly string[], shipId: string): boolean {
  return !!shipId && owned.includes(shipId);
}

export function grantEarnedOwned(
  owned: readonly string[],
  earned: readonly string[],
): string[] {
  return [...new Set([...ownedFromServer(owned), ...earned.filter(Boolean)])];
}

export function applyBuyThenReload(
  localBeforeBuy: readonly string[],
  boughtId: string,
  serverAfterBuy: readonly string[],
): string[] {
  void localBeforeBuy;
  void boughtId;
  return replaceOwnedFromServer(localBeforeBuy, serverAfterBuy);
}
