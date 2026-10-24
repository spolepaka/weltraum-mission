/**
 * Shared coin economy: 10× late-game bonuses stay, but one match cannot
 * print an unbounded pile, and co-op cannot pay more per player than solo.
 */

import { OUTER_SHIPS, outerUnlockMap } from './outer-ships';
import { SPECIAL_SHIPS, specialSalePrice, specialUnlockMap } from './special-ships';

export const MAX_LEVEL = 250;

/** Unlock-reward ships can also be bought. Keep in lockstep with the server catalog. */
export const UNLOCK_SALE_PRICES: Record<string, number> = {
  frostwal: 18000,
  lindwurm: 28000,
  hydra: 42000,
  regenbogen: 36000,
  kaiserbrecher: 90000,
  ...Object.fromEntries(SPECIAL_SHIPS.map((s, i) => [s.id, specialSalePrice(i)])),
};

/** Outer Fleet: ~2×+ the old curve, steepest for the last ships. */
export function outerSalePrice(index: number): number {
  const i = Math.max(0, Math.floor(index) || 0);
  if (i >= 29) return 50_000_000;
  return 380000 + i * 32000 + i * i * 1000;
}

export const SHIP_PRICES: Record<string, number> = {
  starter: 0,
  blitz: 150,
  komet: 250,
  doppel: 400,
  eis: 600,
  falke: 800,
  feuer: 1000,
  stern: 1200,
  titan: 1500,
  lanze: 2000,
  koenig: 3000,
  nova: 5000,
  quanten: 8000,
  uni: 12000,
  rochen: 15000,
  phoenix: 20000,
  hammer: 30000,
  zwilling: 38000,
  gravitron: 52000,
  spektral: 65000,
  segler: 85000,
  schatten: 105000,
  drache: 125000,
  omega: 160000,
  frostwal: UNLOCK_SALE_PRICES.frostwal,
  lindwurm: UNLOCK_SALE_PRICES.lindwurm,
  hydra: UNLOCK_SALE_PRICES.hydra,
  regenbogen: UNLOCK_SALE_PRICES.regenbogen,
  kaiserbrecher: UNLOCK_SALE_PRICES.kaiserbrecher,
  beepbuggy: 900,
  cloudcoupe: 6000,
  shadowspeeder: 22000,
  chromewasp: 45000,
  apexflash: 148000,
  ...Object.fromEntries(OUTER_SHIPS.map((s, i) => [s.id, outerSalePrice(i)])),
  ...Object.fromEntries(SPECIAL_SHIPS.map((s, i) => [s.id, specialSalePrice(i)])),
};

export const UPGRADE_PRICES: Record<string, number[]> = {
  heart: [400],
  rate: [80, 180, 320, 6000, 30000],
  dmg: [120, 250, 450, 8000, 40000],
  dur: [60, 140, 260],
  mag: [50, 120, 220],
};

export function upgradeSalePrice(upgradeId: string, currentLevel: number): number | null {
  const prices = UPGRADE_PRICES[upgradeId];
  if (!prices || currentLevel < 0 || currentLevel >= prices.length) return null;
  const p = prices[currentLevel];
  return Number.isFinite(p) && p > 0 ? p : null;
}

export const UNLOCK_SHIPS: Record<string, { level?: number; ach?: string }> = {
  frostwal: { level: 30 },
  lindwurm: { level: 45 },
  hydra: { level: 60 },
  kaiserbrecher: { level: 90 },
  regenbogen: { ach: 'combo25' },
  ...outerUnlockMap(),
  ...specialUnlockMap(),
};

export function isBossLevel(level: number): boolean {
  return level > 0 && (level % 3 === 0 || level === 100 || level === 250);
}

export function modeCoinMult(mode?: string): number {
  return mode === 'veteran' ? 1.5 : mode === 'easy' ? 0.75 : 1;
}

/** Level-clear bonus (already includes Joshi's 10×). Same in solo and co-op. */
export function levelClearBonus(level: number, stars: number, mode?: string): number {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level) || 1));
  const st = Math.max(0, Math.min(3, Math.floor(stars) || 0));
  const boss = isBossLevel(L) ? 40 + L * 8 : 0;
  return Math.round((10 + L * 3 + st * 8 + boss) * 10 * modeCoinMult(mode));
}

/** Typical in-level pickups (10-value coins) for a normal clear. */
export function typicalCollectedCoins(level: number, mode?: string): number {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level) || 1));
  return Math.round((20 + L * 6) * modeCoinMult(mode));
}

/**
 * Hard per-level award cap. 3-star bonus + typical pickups + 35% headroom.
 * Co-op uses the same number so extra pickups cannot stack per player.
 */
export function maxCoinsForLevel(level: number, mode?: string): number {
  const bonus = levelClearBonus(level, 3, mode);
  const collected = typicalCollectedCoins(level, mode);
  return Math.ceil((bonus + collected) * 1.35);
}

/** Expected payout for a 3-star clear. `players` is ignored on purpose. */
export function expectedCoinsForLevel(level: number, players = 1, stars = 3, mode?: string): number {
  void players;
  return levelClearBonus(level, stars, mode) + typicalCollectedCoins(level, mode);
}

export function clampLevelCoins(earned: number, level: number, mode?: string): number {
  const cap = maxCoinsForLevel(level, mode);
  return Math.max(0, Math.min(cap, Math.floor(earned) || 0));
}

/** The owner cheat is exactly 1e6. A level grant this large is never legitimate. */
export const MILLION_CHEAT = 1_000_000;

export function isMillionScaleGrant(amount: number | bigint): boolean {
  const n = typeof amount === 'bigint' ? Number(amount) : amount;
  return Number.isFinite(n) && n >= 900_000;
}

/**
 * Co-op boss-kill payout: same cap as solo, players ignored.
 * Used by finishLevel and the L100 regression test.
 */
export function coopBossKillAward(
  level: number,
  stars: number,
  collected: number,
  mode?: string,
  players = 1,
): number {
  void players;
  const raw = levelClearBonus(level, stars, mode) + Math.max(0, Math.floor(collected) || 0);
  return clampLevelCoins(raw, level, mode);
}
