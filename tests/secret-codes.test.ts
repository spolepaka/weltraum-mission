import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AMELIA_STAR_CODE,
  AMELIA_STAR_KEY,
  AMELIA_STAR_SHIP,
  grantAmeliaStarShip,
  isAmeliaStarCode,
  normalizeSecretCode,
} from '../src/lib/secret-codes';
import {
  AMELIA_STAR_CODE as SERVER_CODE,
  AMELIA_STAR_KEY as SERVER_KEY,
  AMELIA_STAR_SHIP as SERVER_SHIP,
  grantAmeliaStarShip as serverGrant,
  isAmeliaStarCode as serverIs,
  normalizeSecretCode as serverNorm,
} from '../server/spacetimedb/src/secret-codes';
import { OUTER_SHIPS } from '../src/lib/outer-ships';
import { outerSalePrice } from '../src/lib/economy';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const SERVER = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');

describe('AMELIASTAR — Charon Gate secret', () => {
  it('names Charon Gate as the second-best Outer Fleet ship after Star Crown', () => {
    expect(OUTER_SHIPS[29].id).toBe('starcrown');
    expect(OUTER_SHIPS[28].id).toBe('charongate');
    expect(OUTER_SHIPS[28].nameEn).toBe('Charon Gate');
    expect(outerSalePrice(28)).toBeGreaterThan(outerSalePrice(27));
    expect(outerSalePrice(29)).toBeGreaterThan(outerSalePrice(28));
    expect(AMELIA_STAR_SHIP).toBe('charongate');
    expect(SERVER_SHIP).toBe('charongate');
  });

  it('matches the code case-insensitively and stays in lockstep with the server module', () => {
    expect(AMELIA_STAR_CODE).toBe('AMELIASTAR');
    expect(AMELIA_STAR_KEY).toBe('secretAmeliaStar');
    expect(SERVER_CODE).toBe(AMELIA_STAR_CODE);
    expect(SERVER_KEY).toBe(AMELIA_STAR_KEY);
    expect(normalizeSecretCode('  amelia star ')).toBe('AMELIASTAR');
    expect(serverNorm('AmeliaStar')).toBe('AMELIASTAR');
    expect(isAmeliaStarCode('ameliastar')).toBe(true);
    expect(isAmeliaStarCode('AMELIASTAR')).toBe(true);
    expect(serverIs('AmElIaStAr')).toBe(true);
    expect(isAmeliaStarCode('ALLELEVEL')).toBe(false);
    expect(isAmeliaStarCode('AMELIA500')).toBe(false);
  });

  it('grants only Charon Gate and is idempotent', () => {
    const first = grantAmeliaStarShip(['starter']);
    expect(first.already).toBe(false);
    expect(first.owned).toEqual(['starter', 'charongate']);
    const again = grantAmeliaStarShip(first.owned);
    expect(again.already).toBe(true);
    expect(again.owned).toEqual(['starter', 'charongate']);
    expect(serverGrant(['starter', 'charongate']).already).toBe(true);
    expect(first.owned).not.toContain('starcrown');
    expect(first.owned).toHaveLength(2);
  });

  it('server applySecretCode inserts ownedShip, equips, and throws when already owned', () => {
    const start = SERVER.indexOf('export const applySecretCode');
    const next = SERVER.indexOf('export const unlockAchievement', start);
    const body = SERVER.slice(start, next);
    expect(body).toContain('isAmeliaStarCode');
    expect(body).toContain('AMELIA_STAR_SHIP');
    expect(body).toContain("ctx.db.ownedShip.insert({ identity, shipId: AMELIA_STAR_SHIP })");
    expect(body).toContain('equippedShip: AMELIA_STAR_SHIP');
    expect(body).toContain("throw new Error('Ship already owned')");
    expect(body).toContain('AMELIA_STAR_KEY');
    expect(body).toContain('usedSecretCode.insert');
    expect(body.indexOf('isAmeliaStarCode')).toBeLessThan(body.indexOf("upperCode === 'ALLELEVEL'"));
    expect(body).not.toMatch(/isAmeliaStarCode[\s\S]{0,400}secret\.coins/);
    expect(body).not.toMatch(/isAmeliaStarCode[\s\S]{0,400}writeCoinEvent/);
  });

  it('client trySecret grants, equips, and shows already-owned without extra coins', () => {
    const start = HTML.indexOf('function trySecret()');
    const body = HTML.slice(start, start + 1800);
    expect(body).toContain('v === "AMELIASTAR"');
    expect(body).toContain('shop.owned.push("charongate")');
    expect(body).toContain('shop.equipped = "charongate"');
    expect(body).toContain('onEquipShip("charongate")');
    expect(body).toContain('tips.codeAmeliaStarOwned');
    expect(body).toContain('tips.codeAmeliaStar');
    expect(body).not.toMatch(/AMELIASTAR[\s\S]{0,400}shop\.coins \+=/);
    expect(en.tips.codeAmeliaStar).toMatch(/Charon Gate/);
    expect(de.tips.codeAmeliaStar).toMatch(/Charon-Tor/);
    expect(en.tips.codeAmeliaStarOwned).toMatch(/already have the Charon Gate/i);
    expect(de.tips.codeAmeliaStarOwned).toMatch(/Charon-Tor schon/);
  });
});
