import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SHIP_PRICES,
  UNLOCK_SALE_PRICES,
  outerSalePrice,
} from '../src/lib/economy';
import {
  SHIP_PRICES as SERVER_PRICES,
  UNLOCK_SALE_PRICES as SERVER_UNLOCK,
  outerSalePrice as serverOuterPrice,
  salePrice as serverSale,
} from '../server/spacetimedb/src/economy';
import { OUTER_IDS } from '../src/lib/outer-ships';
import { purchaseShipLocal, salePrice } from '../src/lib/shop-ships';
import { versusOwnsShip } from '../src/lib/versus';
import { versusOwnsShip as serverOwns } from '../server/spacetimedb/src/versus';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const SERVER = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');
const EN = readFileSync(new URL('../src/i18n/en.ts', import.meta.url), 'utf8');
const DE = readFileSync(new URL('../src/i18n/de.ts', import.meta.url), 'utf8');
const VALID = new Set(Object.keys(SHIP_PRICES));

describe('coin ship catalog', () => {
  it('prices every ship except starter, with a steep late curve', () => {
    expect(salePrice(SHIP_PRICES, 'starter')).toBeNull();
    expect(salePrice(SHIP_PRICES, 'blitz')).toBe(150);
    expect(UNLOCK_SALE_PRICES.frostwal).toBe(18000);
    expect(UNLOCK_SALE_PRICES.kaiserbrecher).toBe(90000);
    expect(outerSalePrice(0)).toBe(380000);
    expect(outerSalePrice(28)).toBe(2060000);
    expect(outerSalePrice(29)).toBe(3000000);
    expect(SHIP_PRICES.starcrown).toBe(3000000);
    expect(SHIP_PRICES.rivet).toBeGreaterThan(SHIP_PRICES.omega * 2);
    expect(SHIP_PRICES.starcrown).toBeGreaterThan(SHIP_PRICES.rivet * 4);
    for (const id of Object.keys(SHIP_PRICES)) {
      if (id === 'starter') continue;
      expect(salePrice(SHIP_PRICES, id)).toBeGreaterThan(0);
      expect(serverSale(id)).toBe(SHIP_PRICES[id]);
      expect(SERVER_PRICES[id]).toBe(SHIP_PRICES[id]);
    }
    expect(SERVER_UNLOCK).toEqual(UNLOCK_SALE_PRICES);
    expect(serverOuterPrice(29)).toBe(outerSalePrice(29));
  });

  it('bakes the same prices into the hangar list', () => {
    for (const id of [...Object.keys(UNLOCK_SALE_PRICES), ...OUTER_IDS]) {
      expect(HTML).toContain(`id: "${id}"`);
      expect(HTML).toContain(`price: ${SHIP_PRICES[id]}`);
    }
  });

  it('shows Buy + confirm + not-enough text in EN and DE', () => {
    expect(EN).toContain("confirmBuy:");
    expect(EN).toContain("confirmBuyBtn:");
    expect(EN).toContain("buyAnyway:");
    expect(DE).toContain('Wirklich');
    expect(DE).toContain('Ja, kaufen');
    expect(HTML).toContain('shopBuyConfirm');
    expect(HTML).toContain('tips.confirmBuy');
    expect(HTML).toContain('tips.missingCoins');
    expect(HTML).toContain('onPurchaseShip');
  });

  it('lets a player buy a locked unlock-ship and treats it as owned in 1v1', () => {
    const shop = { coins: 90000, owned: ['starter'], equipped: 'starter' };
    const poor = purchaseShipLocal({ ...shop, coins: 100 }, 'kaiserbrecher', SHIP_PRICES, VALID);
    expect(poor.ok).toBe(false);
    if (!poor.ok) expect(poor.reason).toBe('insufficient_coins');

    const ok = purchaseShipLocal(shop, 'kaiserbrecher', SHIP_PRICES, VALID);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.shop.owned).toContain('kaiserbrecher');
      expect(ok.shop.coins).toBe(0);
      expect(versusOwnsShip(ok.shop.owned, 'kaiserbrecher')).toBe(true);
      expect(serverOwns(ok.shop.owned, 'kaiserbrecher')).toBe(true);
    }
    expect(versusOwnsShip(['starter'], 'kaiserbrecher')).toBe(false);
    expect(versusOwnsShip(['starter', 'rivet'], 'rivet')).toBe(true);
    expect(versusOwnsShip(new Set(['starcrown']), 'starcrown')).toBe(true);
  });

  it('keeps free claim for earned unlocks even when the ship is also for sale', () => {
    expect(SERVER).toContain('export const claimUnlockShip');
    expect(SERVER).toContain('export const claimEarnedUnlocks');
    expect(SERVER).toContain('export const purchaseShip');
    expect(SERVER).not.toContain("throw new Error('Ship is for sale')");
    expect(SERVER).toContain('versusOwnsShip(owned, want)');
    expect(SERVER).toContain('const catalog = salePrice(shipId)');
    expect(SERVER).toContain('ctx.db.ownedShip.insert');
  });
});
