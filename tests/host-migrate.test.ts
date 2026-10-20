import { describe, expect, it } from 'vitest';
import {
  HOST_AWAY_MS,
  HOST_GONE_MS,
  buildResume,
  hostGoneTimeout,
  livingJoinOrder,
  migratePeerId,
  nextHostPid,
  onlyOneLeft,
  shouldSelfPromote,
} from '../src/lib/host-migrate';

const roster = [
  { pid: 1, name: 'Host' },
  { pid: 2, name: 'Ada' },
  { pid: 3, name: 'Bea' },
];

describe('host migration', () => {
  it('promotes the next living player by join order', () => {
    expect(nextHostPid(roster, 1)).toBe(2);
    expect(nextHostPid([{ pid: 1 }, { pid: 2, left: true }, { pid: 3 }], 1)).toBe(3);
    expect(shouldSelfPromote(2, 2)).toBe(true);
    expect(shouldSelfPromote(3, 2)).toBe(false);
  });

  it('continues as solo when nobody else is left', () => {
    expect(onlyOneLeft([{ pid: 1 }, { pid: 2, left: true }], 1)).toBe(true);
    expect(livingJoinOrder(roster, 1).map((p) => p.pid)).toEqual([2, 3]);
  });

  it('derives a new PeerJS id per generation', () => {
    expect(migratePeerId('joshi-space-v1-', 'HACK3', 0)).toBe('joshi-space-v1-HACK3');
    expect(migratePeerId('joshi-space-v1-', 'hack3', 2)).toBe('joshi-space-v1-HACK3-m2');
  });

  it('waits longer when the host tab is backgrounded (iPad sleep)', () => {
    expect(hostGoneTimeout(false)).toBe(HOST_GONE_MS);
    expect(hostGoneTimeout(true)).toBe(HOST_AWAY_MS);
    expect(HOST_AWAY_MS).toBeGreaterThan(HOST_GONE_MS);
  });

  it('keeps a resume payload so the level can continue', () => {
    const r = buildResume({ code: 'hack3', hostPid: 2, gen: 1, name: 'Ada', L: 100, lt: 40, sc: 900, inGame: true, lives: [0, 2, 3], coinsRun: 120 });
    expect(r.code).toBe('HACK3');
    expect(r.hostPid).toBe(2);
    expect(r.inGame).toBe(true);
    expect(r.L).toBe(100);
  });
});
