/**
 * Client-side shop purchase / equip rules. Server purchaseShip must use the
 * same catalog prices (see server/spacetimedb/src/economy.ts).
 */

export type PurchaseFail = 'unknown_ship' | 'not_for_sale' | 'already_owned' | 'insufficient_coins';
export type EquipFail = 'unknown_ship' | 'not_owned';

export function salePrice(prices: Record<string, number>, shipId: string): number | null {
  if (!Object.prototype.hasOwnProperty.call(prices, shipId)) return null;
  const p = prices[shipId];
  if (!Number.isFinite(p) || p <= 0) return null;
  return p;
}

export function purchaseShipLocal(
  shop: { coins: number; owned: string[]; equipped: string },
  shipId: string,
  prices: Record<string, number>,
  valid: ReadonlySet<string>,
): { ok: true; shop: { coins: number; owned: string[]; equipped: string }; price: number } | { ok: false; reason: PurchaseFail } {
  if (!valid.has(shipId)) return { ok: false, reason: 'unknown_ship' };
  if (shop.owned.includes(shipId)) return { ok: false, reason: 'already_owned' };
  const price = salePrice(prices, shipId);
  if (price === null) return { ok: false, reason: 'not_for_sale' };
  if (shop.coins < price) return { ok: false, reason: 'insufficient_coins' };
  return {
    ok: true,
    price,
    shop: {
      coins: shop.coins - price,
      owned: shop.owned.concat(shipId),
      equipped: shipId,
    },
  };
}

export function equipShipLocal(
  shop: { owned: string[]; equipped: string },
  shipId: string,
  valid: ReadonlySet<string>,
): { ok: true; equipped: string } | { ok: false; reason: EquipFail } {
  if (!valid.has(shipId)) return { ok: false, reason: 'unknown_ship' };
  if (!shop.owned.includes(shipId)) return { ok: false, reason: 'not_owned' };
  return { ok: true, equipped: shipId };
}
