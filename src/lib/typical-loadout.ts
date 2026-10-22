/** Typical L1–L5 spend so balance sims match a kid who shops after ~2-star clears. */

import { isBossLevel as isBoss, levelClearBonus, typicalCollectedCoins, UPGRADE_PRICES } from './economy';

export const EARLY_SHIPS: Array<{ id: string; price: number }> = [
  { id: 'starter', price: 0 },
  { id: 'blitz', price: 150 },
  { id: 'komet', price: 250 },
  { id: 'doppel', price: 400 },
  { id: 'eis', price: 600 },
  { id: 'falke', price: 800 },
  { id: 'feuer', price: 1000 },
  { id: 'stern', price: 1200 },
  { id: 'titan', price: 1500 },
  { id: 'lanze', price: 2000 },
  { id: 'koenig', price: 3000 },
];

export { UPGRADE_PRICES };

const UPGRADE_ORDER = ['heart', 'dmg', 'rate', 'mag', 'dur'] as const;

export function isBossLevel(level: number): boolean {
  return isBoss(level);
}

export function coinsFromLevels(fromL: number, toL: number, stars = 2, coinMult = 1, training = 60): number {
  let coins = training;
  const mode = coinMult >= 1.4 ? 'veteran' : coinMult <= 0.8 ? 'easy' : 'normal';
  for (let L = fromL; L <= toL; L++) {
    coins += levelClearBonus(L, stars, mode) + typicalCollectedCoins(L, mode);
  }
  return coins;
}

export interface TypicalLoadout {
  coins: number;
  ship: string;
  up: { heart: number; rate: number; dmg: number; dur: number; mag: number };
  coinsLeft: number;
}

export function spendBestAffordable(coins: number): TypicalLoadout {
  const ships = EARLY_SHIPS.filter((s) => s.price > 0).sort((a, b) => b.price - a.price);
  let ship = 'starter';
  let left = coins;
  for (const s of ships) {
    if (s.price <= left) {
      ship = s.id;
      left -= s.price;
      break;
    }
  }
  const up = { heart: 0, rate: 0, dmg: 0, dur: 0, mag: 0 };
  let bought = true;
  while (bought) {
    bought = false;
    for (const id of UPGRADE_ORDER) {
      const prices = UPGRADE_PRICES[id];
      const lv = up[id];
      if (lv >= prices.length) continue;
      if (prices[lv] <= left) {
        left -= prices[lv];
        up[id] += 1;
        bought = true;
        break;
      }
    }
  }
  return { coins, ship, up, coinsLeft: left };
}

export function typicalLoadoutByL6(mode: 'easy' | 'normal' | 'veteran' = 'normal'): TypicalLoadout {
  const coinMult = mode === 'veteran' ? 1.5 : mode === 'easy' ? 0.75 : 1;
  return spendBestAffordable(coinsFromLevels(1, 5, 2, coinMult));
}
