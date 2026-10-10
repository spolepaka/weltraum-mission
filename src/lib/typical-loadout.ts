/** Typical L1–L5 spend so balance sims match a kid who shops after ~2-star clears. */

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

export const UPGRADE_PRICES: Record<string, number[]> = {
  heart: [400],
  rate: [80, 180, 320, 6000, 30000],
  dmg: [120, 250, 450, 8000, 40000],
  dur: [60, 140, 260],
  mag: [50, 120, 220],
};

const UPGRADE_ORDER = ['heart', 'dmg', 'rate', 'mag', 'dur'] as const;

export function isBossLevel(level: number): boolean {
  return level > 0 && (level % 3 === 0 || level === 100);
}

export function coinsFromLevels(fromL: number, toL: number, stars = 2, coinMult = 1, training = 60): number {
  let coins = training;
  for (let L = fromL; L <= toL; L++) {
    const bonus = Math.round((10 + L * 3 + stars * 8 + (isBossLevel(L) ? 40 + L * 8 : 0)) * 10 * coinMult);
    const collected = Math.round((20 + L * 6) * coinMult);
    coins += bonus + collected;
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
