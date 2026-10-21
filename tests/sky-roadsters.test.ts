import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';
import { SHIP_PRICES, expectedCoinsForLevel, maxCoinsForLevel } from '../src/lib/economy';
import { salePrice as serverSalePrice, SHIP_PRICES as serverPrices } from '../server/spacetimedb/src/economy';
import {
  ROADSTER_IDS,
  ROADSTER_PRICES,
  ROADSTER_TAB,
  ROADSTER_TRIM,
  ROADSTERS,
  TESLA_ROADSTER_MARKS,
  canonicalRoadsterId,
  isRoadsterId,
} from '../src/lib/roadsters';
import { drawRoadster, mockCanvasCtx, roadsterDrawOpts } from '../src/lib/roadster-draw';
import { equipShipLocal, purchaseShipLocal, salePrice } from '../src/lib/shop-ships';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const serverSrc = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');
const clientSrc = readFileSync(new URL('../src/lib/spacetime-client.ts', import.meta.url), 'utf8');

const VALID = new Set([
  'starter', 'blitz', 'komet', 'doppel', 'eis', 'falke', 'feuer', 'stern',
  'titan', 'lanze', 'koenig', 'nova', 'quanten', 'uni', 'rochen', 'phoenix',
  'hammer', 'zwilling', 'gravitron', 'spektral', 'segler', 'schatten',
  'drache', 'omega', 'frostwal', 'lindwurm', 'hydra', 'regenbogen', 'kaiserbrecher',
  ...ROADSTER_IDS,
]);

function shipBlock(id: string): string {
  const re = new RegExp(`\\{ id: "${id}"[\\s\\S]*?desc: "[^"]*" \\}`);
  const m = html.match(re);
  expect(m, `missing SHIPS entry for ${id}`).toBeTruthy();
  return m![0];
}

function numField(block: string, key: string): number {
  const m = block.match(new RegExp(`${key}:\\s*([0-9.]+)`));
  expect(m, `missing ${key}`).toBeTruthy();
  return Number(m![1]);
}

function blob(...parts: string[]): string {
  return parts.join('\n').toLowerCase();
}

describe('Tesla Roadster catalogue', () => {
  it('has five roadsters on a cheap → top ladder', () => {
    expect(ROADSTERS).toHaveLength(5);
    expect(ROADSTER_IDS).toEqual(['beepbuggy', 'cloudcoupe', 'shadowspeeder', 'chromewasp', 'apexflash']);
    const prices = ROADSTERS.map((r) => r.price);
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    expect(ROADSTERS[0].hearts).toBe(3);
    expect(ROADSTERS[0].dmg).toBeLessThan(ROADSTERS[2].dmg);
    expect(ROADSTERS[4].id).toBe('apexflash');
    expect(ROADSTERS[4].shots).toBe(3);
    expect(ROADSTERS[4].perk).toBe('homing');
    expect(ROADSTERS[4].perk2).toBe('pulse');
    expect(ROADSTERS[1].perk2).toBe('dash');
    expect(ROADSTERS[2].perk).toBe('pierce');
    expect(ROADSTERS[2].shots).toBe(2);
    expect(ROADSTERS[3].perk).toBe('homing');
    expect(ROADSTERS[3].regen).toBeGreaterThan(0);
  });

  it('prices sit on the live coin economy (L100 3-star ~12.4k, top is a long-term goal)', () => {
    const l100 = expectedCoinsForLevel(100, 1, 3);
    expect(l100).toBeGreaterThan(12000);
    expect(l100).toBeLessThan(13000);
    expect(ROADSTER_PRICES.beepbuggy).toBeLessThan(l100);
    expect(ROADSTER_PRICES.cloudcoupe).toBeLessThan(maxCoinsForLevel(50) * 3);
    expect(ROADSTER_PRICES.apexflash).toBeGreaterThan(l100 * 10);
    expect(ROADSTER_PRICES.apexflash).toBeLessThan(SHIP_PRICES.omega);
    expect(ROADSTER_PRICES.apexflash).toBeGreaterThan(SHIP_PRICES.drache);
    expect(ROADSTER_PRICES.shadowspeeder).toBeGreaterThan(SHIP_PRICES.phoenix);
    expect(ROADSTER_PRICES.chromewasp).toBeGreaterThan(SHIP_PRICES.hammer);
    expect(ROADSTER_PRICES.chromewasp).toBeLessThan(SHIP_PRICES.gravitron);
  });

  it('keeps client, server, HTML, and i18n in lockstep', () => {
    for (const r of ROADSTERS) {
      expect(SHIP_PRICES[r.id]).toBe(r.price);
      expect(serverPrices[r.id]).toBe(r.price);
      expect(ROADSTER_PRICES[r.id]).toBe(r.price);
      const block = shipBlock(r.id);
      expect(numField(block, 'price')).toBe(r.price);
      expect(numField(block, 'hearts')).toBe(r.hearts);
      expect(numField(block, 'speed')).toBe(r.speed);
      expect(numField(block, 'rate')).toBe(r.rate);
      expect(numField(block, 'shots')).toBe(r.shots);
      expect(numField(block, 'dmg')).toBe(r.dmg);
      expect(numField(block, 'regen')).toBe(r.regen);
      expect(numField(block, 'tier')).toBe(ROADSTER_TAB);
      expect(html).toMatch(new RegExp(`DESIGNS\\.${r.id}\\s*=\\s*function`));
      expect(en.ships[r.id]?.name).toBe(ROADSTER_TRIM[r.id].en);
      expect(de.ships[r.id]?.name).toBe(ROADSTER_TRIM[r.id].de);
      expect(en.ships[r.id].name).not.toBe(de.ships[r.id].name);
      expect(serverSrc).toContain(`'${r.id}'`);
    }
    expect(html).toContain('["🏎️", "tabRoadster"]');
    expect(en.tips.tabRoadster).toBe('Tesla Roadster');
    expect(de.tips.tabRoadster).toBe('Fliegende Tesla Roadster');
    expect(html).toContain('function roadsterKit');
    expect(html).toContain('function teslaT');
    expect(html).toContain('RDSTR');
    expect(html).toContain('perk2: "dash"');
    expect(html).toContain('perk2: "pulse"');
    expect(html).toContain('p2k === "dash"');
    expect(html).toContain('p2k === "pulse"');
  });

  it('uses Tesla / Roadster / SpaceX naming in EN and DE copy', () => {
    const text = blob(
      html,
      JSON.stringify(en.ships),
      JSON.stringify(de.ships),
      en.tips.tabRoadster,
      de.tips.tabRoadster,
      JSON.stringify(ROADSTERS),
      JSON.stringify(ROADSTER_TRIM),
    );
    for (const mark of TESLA_ROADSTER_MARKS) {
      expect(text, mark).toContain(mark);
    }
    expect(canonicalRoadsterId('beepbuggy')).toBe('beepbuggy');
    expect(canonicalRoadsterId('not-a-car')).toBeUndefined();
  });

  it('paints and specials are distinct', () => {
    const paints = new Set(ROADSTERS.map((r) => r.paint));
    expect(paints.size).toBe(ROADSTERS.length);
    expect(new Set(ROADSTERS.map((r) => r.glow)).size).toBeGreaterThanOrEqual(4);
    expect(roadsterDrawOpts('beepbuggy')!.jets).toHaveLength(2);
    expect(roadsterDrawOpts('apexflash')!.jets.length).toBeGreaterThan(roadsterDrawOpts('beepbuggy')!.jets.length);
    expect(roadsterDrawOpts('apexflash')!.wing).toBe(true);
    expect(roadsterDrawOpts('beepbuggy')!.wing).toBeFalsy();
  });
});

describe('Tesla Roadster purchase / equip', () => {
  it('buys, auto-equips, and rejects bad cases', () => {
    const shop = { coins: 899, owned: ['starter'], equipped: 'starter' };
    const failCash = purchaseShipLocal(shop, 'beepbuggy', SHIP_PRICES, VALID);
    expect(failCash.ok).toBe(false);
    if (!failCash.ok) expect(failCash.reason).toBe('insufficient_coins');

    const ok = purchaseShipLocal({ ...shop, coins: 900 }, 'beepbuggy', SHIP_PRICES, VALID);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.price).toBe(900);
      expect(ok.shop.coins).toBe(0);
      expect(ok.shop.owned).toContain('beepbuggy');
      expect(ok.shop.equipped).toBe('beepbuggy');
    }

    const again = purchaseShipLocal(ok.ok ? ok.shop : shop, 'beepbuggy', SHIP_PRICES, VALID);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('already_owned');

    const free = purchaseShipLocal(shop, 'starter', SHIP_PRICES, VALID);
    expect(free.ok).toBe(false);
    if (!free.ok) expect(free.reason).toBe('already_owned');

    const reward = purchaseShipLocal({ coins: 999999, owned: ['starter'], equipped: 'starter' }, 'kaiserbrecher', SHIP_PRICES, VALID);
    expect(reward.ok).toBe(false);
    if (!reward.ok) expect(reward.reason).toBe('not_for_sale');

    const bogus = purchaseShipLocal(shop, 'not-a-ship', SHIP_PRICES, VALID);
    expect(bogus.ok).toBe(false);
    if (!bogus.ok) expect(bogus.reason).toBe('unknown_ship');
  });

  it('equips only owned ships and uses catalog prices on the server copy', () => {
    expect(equipShipLocal({ owned: ['starter'], equipped: 'starter' }, 'apexflash', VALID).ok).toBe(false);
    const owned = equipShipLocal({ owned: ['starter', 'apexflash'], equipped: 'starter' }, 'apexflash', VALID);
    expect(owned.ok).toBe(true);
    if (owned.ok) expect(owned.equipped).toBe('apexflash');
    expect(salePrice(SHIP_PRICES, 'apexflash')).toBe(148000);
    expect(serverSalePrice('apexflash')).toBe(148000);
    expect(serverSalePrice('starter')).toBeNull();
    expect(serverSalePrice('nope')).toBeNull();
    expect(isRoadsterId('beepbuggy')).toBe(true);
    expect(isRoadsterId('omega')).toBe(false);
  });

  it('ignores a forged client price (server uses catalog, then auto-equips)', () => {
    expect(serverSrc).toContain('Client-sent `price` is ignored');
    expect(serverSrc).toContain('equippedShip: shipId');
    expect(serverSrc).toContain("throw new Error('Insufficient coins')");
    expect(serverSrc).toContain("throw new Error('Ship not for sale')");
    expect(clientSrc).toContain('salePrice(SHIP_PRICES, shipId)');
    expect(html).toContain('onEquipShip(shopSel)');
    expect(html).toContain('onClaimShip');
  });
});

describe('Tesla Roadster rendering', () => {
  it('draws every roadster without throwing', () => {
    for (const id of ROADSTER_IDS) {
      const ctx = mockCanvasCtx();
      expect(() => drawRoadster(ctx, id, 0.42, ['230,250,255', '90,180,255', '30,70,200'], true)).not.toThrow();
      expect(() => drawRoadster(ctx, id, 1.7, ['230,250,255', '90,180,255', '30,70,200'], false)).not.toThrow();
    }
    expect(() => drawRoadster(mockCanvasCtx(), 'not-a-roadster', 0, ['0,0,0', '0,0,0', '0,0,0'])).toThrow(/Unknown roadster/);
  });

  it('game drawShipModel falls back instead of throwing on a missing design', () => {
    expect(html).toContain('DESIGNS[d.id]');
    expect(html).toContain('DESIGNS.starter(t, d, fx)');
    expect(html).toContain('drawShipOk');
  });
});
