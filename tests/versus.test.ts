import { describe, expect, it } from 'vitest';
import {
  disconnectWinner,
  flipWorldY,
  listingFreshness,
  matchOver,
  nudgeRockVy,
  pairQuickWaiters,
  pickQuickMatch,
  prizeToAward,
  roundWinner,
  spawnSide,
  utcDayKey,
  validateVersusReport,
  versusAimSign,
  versusFairStats,
  versusHomeY,
  VERSUS_DAILY_CAP,
  VERSUS_HEARTS,
  VERSUS_PRIZE,
} from '../src/lib/versus';
import {
  applyVersusQueueEvent,
  findChallenge,
  listQuickQueue,
  myVersusRole,
  versusRowFromServer,
  type VersusQueueRow,
} from '../src/lib/versus-queue';

describe('versus pairing and fairness', () => {
  it('normalizes both sides to the same hearts and no shop perks', () => {
    const fair = versusFairStats();
    expect(fair.hearts).toBe(VERSUS_HEARTS);
    expect(fair.perk).toBe('');
    expect(fair.perk2).toBe('');
    expect(fair.regen).toBe(0);
    expect(fair.dmg).toBe(2);
  });

  it('pairs the two oldest fresh quick waiters', () => {
    const now = 1_000_000;
    const pair = pairQuickWaiters([
      { identity: 'a', name: 'Ada', ship: 'starter', kind: 'quick', code: 'AAAAA', heartbeatMs: now - 2000 },
      { identity: 'b', name: 'Bea', ship: 'blitz', kind: 'quick', code: 'BBBBB', heartbeatMs: now - 1000 },
      { identity: 'c', name: 'Cal', ship: 'starter', kind: 'challenge', code: 'CCCCC', heartbeatMs: now },
    ], now);
    expect(pair?.host.identity).toBe('a');
    expect(pair?.guest.identity).toBe('b');
  });

  it('picks another fresh quick waiter, never myself', () => {
    const now = Date.now();
    const other = pickQuickMatch([
      { identity: 'me', name: 'Me', ship: 'starter', kind: 'quick', code: 'ME123', heartbeatMs: now },
      { identity: 'you', name: 'You', ship: 'starter', kind: 'quick', code: 'YOU12', heartbeatMs: now },
    ], 'me', now);
    expect(other?.identity).toBe('you');
  });
});

describe('versus arena geometry', () => {
  it('puts P1 at the bottom shooting up and P2 at the top shooting down', () => {
    expect(versusAimSign(1)).toBe(-1);
    expect(versusAimSign(2)).toBe(1);
    expect(versusHomeY(1, 768, 80)).toBe(688);
    expect(versusHomeY(2, 768, 80)).toBe(80);
    expect(flipWorldY(80, 768)).toBe(688);
  });

  it('nudges a rock toward the opponent after a hit', () => {
    expect(nudgeRockVy(40, 1)).toBeLessThan(0);
    expect(nudgeRockVy(-40, 2)).toBeGreaterThan(0);
    expect(spawnSide(0)).toBe(1);
    expect(spawnSide(1)).toBe(2);
  });
});

describe('versus score and prize', () => {
  it('accepts first-to-2 scores and rejects ties or unfinished matches', () => {
    expect(validateVersusReport({ winnerPid: 1, hostRounds: 2, guestRounds: 1 })).toEqual({ ok: true });
    expect(validateVersusReport({ winnerPid: 2, hostRounds: 0, guestRounds: 2 }).ok).toBe(true);
    expect(validateVersusReport({ winnerPid: 1, hostRounds: 1, guestRounds: 1 }).ok).toBe(false);
    expect(validateVersusReport({ winnerPid: 1, hostRounds: 2, guestRounds: 2 }).ok).toBe(false);
    expect(roundWinner(0, 3)).toBe(2);
    expect(roundWinner(2, 0)).toBe(1);
    expect(matchOver(2, 1)).toBe(true);
    expect(disconnectWinner(1)).toBe(2);
  });

  it('caps the daily prize', () => {
    expect(prizeToAward(0)).toBe(VERSUS_PRIZE);
    expect(prizeToAward(VERSUS_DAILY_CAP)).toBe(0);
    expect(prizeToAward(VERSUS_DAILY_CAP - 10)).toBe(10);
    expect(utcDayKey(Date.UTC(2026, 9, 22))).toBe(20261022);
  });
});

describe('versus queue rows', () => {
  it('reads heartbeat micros and drops dead quick listings', () => {
    const now = Date.now();
    const row = versusRowFromServer({
      code: 'duel1',
      hostHex: 'aa',
      hostName: 'Ada',
      hostShip: 'starter',
      kind: 'quick',
      inMatch: false,
      heartbeat: { microsSinceUnixEpoch: BigInt(now) * 1000n },
    });
    expect(row.code).toBe('DUEL1');
    expect(row.heartbeatMs).toBeGreaterThan(0);
    const map = new Map<string, VersusQueueRow>();
    applyVersusQueueEvent(map, { type: 'insert', row }, now);
    expect(listQuickQueue(map, now).map((r) => r.code)).toEqual(['DUEL1']);
    expect(listingFreshness(now - 20_000, now)).toBe('dead');
    expect(findChallenge(map, 'duel1', now)).toBeNull();
    expect(myVersusRole(row, 'aa')).toBe('host');
  });
});
