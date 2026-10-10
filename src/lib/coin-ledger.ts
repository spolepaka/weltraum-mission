/**
 * Coin persistence rules:
 * - The in-game shop (localStorage spaceMissionShop) is the device source of truth.
 * - Never overwrite local coins with a lower / stale server value.
 * - Level rewards are applied once via completeLevelResult (server ADD).
 * - Reconnect merge: take max(local, server), then push the delta up if local is ahead.
 */

export function mergeCoins(localCoins: bigint | number, serverCoins: bigint | number): bigint {
  const local = typeof localCoins === 'bigint' ? localCoins : BigInt(Math.max(0, Math.floor(localCoins)));
  const server = typeof serverCoins === 'bigint' ? serverCoins : BigInt(Math.max(0, Math.floor(serverCoins)));
  return local > server ? local : server;
}

export function coinDeltaToPush(localCoins: bigint | number, serverCoins: bigint | number): bigint {
  const local = typeof localCoins === 'bigint' ? localCoins : BigInt(Math.max(0, Math.floor(localCoins)));
  const server = typeof serverCoins === 'bigint' ? serverCoins : BigInt(Math.max(0, Math.floor(serverCoins)));
  return local > server ? local - server : 0n;
}

export function shouldAcceptServerCoins(localCoins: bigint | number, serverCoins: bigint | number): boolean {
  const local = typeof localCoins === 'bigint' ? localCoins : BigInt(Math.max(0, Math.floor(localCoins)));
  const server = typeof serverCoins === 'bigint' ? serverCoins : BigInt(Math.max(0, Math.floor(serverCoins)));
  return server > local;
}

export interface LevelCoinAward {
  collected: number;
  bonus: number;
  totalEarned: number;
  newTotal: number;
}

export function awardLevelCoins(currentTotal: number, collected: number, bonus: number): LevelCoinAward {
  const safeCollected = Math.max(0, Math.floor(collected));
  const safeBonus = Math.max(0, Math.floor(bonus));
  const newTotal = Math.max(0, Math.floor(currentTotal)) + safeBonus;
  return {
    collected: safeCollected,
    bonus: safeBonus,
    totalEarned: safeCollected + safeBonus,
    newTotal,
  };
}
