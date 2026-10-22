import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIceServers } from '../src/lib/peer-ice';
import { UPGRADE_PRICES, upgradeSalePrice, UNLOCK_SHIPS } from '../src/lib/economy';
import { UPGRADE_PRICES as serverUpgradePrices, upgradeSalePrice as serverUpgradeSale } from '../server/spacetimedb/src/economy';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/lib/spacetime-client.ts', import.meta.url), 'utf8');
const handover = readFileSync(new URL('../docs/HANDOVER.md', import.meta.url), 'utf8');

const CLIENT_ACH = [
  'first', 'lv10', 'lv50', 'max12', 'max25', 'max50', 'max75', 'max100',
  'rock100', 'rock1k', 'rock10k', 'ufo25', 'ufo250',
  'boss1', 'boss10', 'boss30', 'comet5',
  'combo10', 'combo25', 'combo50',
  'coin1k', 'coin10k', 'coin100k',
  'star25', 'three10', 'three40', 'pow50',
  'nohit1', 'nohit10', 'ships5', 'ships15',
  'golden', 'treasure', 'twoP', 'online', 'ghost',
];

describe('TURN ICE config', () => {
  it('defaults to free STUN and adds TURN only when VITE_TURN_URL is set', () => {
    const stun = buildIceServers({});
    expect(stun).toHaveLength(2);
    expect(stun[0].urls).toMatch(/^stun:/);
    const turn = buildIceServers({
      VITE_TURN_URL: 'turn:relay.example:3478',
      VITE_TURN_USERNAME: 'pilot',
      VITE_TURN_CREDENTIAL: 'secret',
    });
    expect(turn).toHaveLength(3);
    expect(turn[2]).toEqual({
      urls: 'turn:relay.example:3478',
      username: 'pilot',
      credential: 'secret',
    });
  });

  it('HTML PeerJS uses the TS ICE config when present', () => {
    expect(html).toContain('window.__weltraum.peerIce');
    expect(html).toContain('stun:stun.l.google.com:19302');
  });
});

describe('upgrade catalog and unlock ships', () => {
  it('keeps client and server upgrade prices in lockstep', () => {
    expect(serverUpgradePrices).toEqual(UPGRADE_PRICES);
    expect(upgradeSalePrice('heart', 0)).toBe(400);
    expect(serverUpgradeSale('dmg', 1)).toBe(250);
    expect(upgradeSalePrice('mag', 3)).toBeNull();
    expect(UNLOCK_SHIPS.frostwal).toEqual({ level: 30 });
    expect(UNLOCK_SHIPS.regenbogen).toEqual({ ach: 'combo25' });
  });

  it('charges purchaseUpgrade from the catalog and ignores the client price', () => {
    expect(server).toContain('upgradeSalePrice');
    expect(server).toMatch(/Client-sent `price` is ignored[\s\S]*purchaseUpgrade|purchaseUpgrade[\s\S]*Client-sent `price` is ignored/);
  });
});

describe('achievements, hearts, addOwnedShip', () => {
  it('accepts all 36 client achievement ids on the server', () => {
    expect(CLIENT_ACH).toHaveLength(36);
    for (const id of CLIENT_ACH) {
      expect(server, id).toContain(`'${id}'`);
    }
  });

  it('uses each ship\'s defined hearts instead of a 3/4 cap', () => {
    expect(html).toContain('hearts: (d.hearts || 3) + Math.min(1, u.heart)');
    expect(html).not.toContain('Math.min(d.hearts, (d.tier >= 3 || d.price >= 85000) ? 4 : 3)');
  });

  it('guards addOwnedShip as admin-only and claims unlocks on a separate path', () => {
    const add = server.match(/export const addOwnedShip[\s\S]*?export const /)?.[0] || '';
    expect(add).toContain('assertAdmin');
    expect(server).toContain('export const claimUnlockShip');
    expect(client).toContain('claimUnlockShip');
  });
});

describe('HANDOVER covers the latest PRs', () => {
  it('lists PRs 17 through 26', () => {
    for (const n of [17, 18, 19, 20, 21, 22, 23, 24, 25, 26]) {
      expect(handover).toMatch(new RegExp(`\\|\\s*${n}\\s*\\|`));
    }
    expect(handover).toMatch(/versus|1 vs 1/i);
  });
});
