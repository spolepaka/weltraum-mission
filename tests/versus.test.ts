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
  rematchReady,
  roundWinner,
  spawnSide,
  versusOwnsShip,
  versusRockDamagesPid,
  versusShotIgnoresRock,
  utcDayKey,
  validateVersusReport,
  versusAimSign,
  versusHomeY,
  youThemScore,
  iWonMatch,
  cleanVersusMatchId,
  eloUpdate,
  fallbackStrength,
  filterVersusByStrength,
  matchBand,
  withinBand,
  pairingScore,
  shipCombatPower,
  statsForShip,
  VERSUS_ELO_START,
  VERSUS_PRIZE,
  VERSUS_SUDDEN_SEC,
  bumpFunCount,
  emptyVersusFunStats,
  isSuddenDeathRound,
  nextVersusPickup,
  suddenDeathLeft,
  suddenDeathTimedOut,
  suddenDeathWinner,
  validVersusEmote,
  versusPickupLaneX,
  versusPickupType,
  versusRank,
  versusRankFromRating,
  versusRankIcon,
} from '../src/lib/versus';
import {
  applyVersusQueueEvent,
  findChallenge,
  listOpenVersus,
  listQuickQueue,
  myVersusRole,
  versusRowFromServer,
  type VersusQueueRow,
} from '../src/lib/versus-queue';

describe('versus pairing and fairness', () => {
  it('keeps each ship\'s real hearts, damage, and upgrades', () => {
    const starter = statsForShip('starter');
    const titan = statsForShip('titan', { heart: 1, dmg: 2 });
    expect(starter.hearts).toBe(3);
    expect(starter.dmg).toBe(1);
    expect(titan.hearts).toBe(5);
    expect(titan.dmg).toBeCloseTo(1.25 * 1.5);
    expect(titan.perk).toBe('');
    expect(statsForShip('phoenix').perk2).toBe('rebirth');
    expect(statsForShip('cloudcoupe').perk2).toBe('dash');
    expect(shipCombatPower('omega')).toBeGreaterThan(shipCombatPower('starter') + 200);
    expect(pairingScore(800, 1400) - pairingScore(800, 1000)).toBeLessThan(shipCombatPower('omega') - shipCombatPower('starter'));
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

  it('only the newer host joins an older live rival, never both', () => {
    const now = 1_000_000;
    const a = { identity: 'a', name: 'Ada', ship: 'starter', kind: 'quick' as const, code: 'AAAAA', heartbeatMs: now - 4000 };
    const b = { identity: 'b', name: 'Bea', ship: 'starter', kind: 'quick' as const, code: 'BBBBB', heartbeatMs: now };
    expect(pickQuickMatch([a, b], 'b', now, b.heartbeatMs)?.code).toBe('AAAAA');
    expect(pickQuickMatch([a, b], 'a', now, a.heartbeatMs)).toBeNull();
  });

  it('ignores stale queue rows so a live host is not baited into room-not-found', () => {
    const now = 1_000_000;
    const other = pickQuickMatch([
      { identity: 'ghost', name: 'Gone', ship: 'starter', kind: 'quick', code: 'GHOST', heartbeatMs: now - 20_000 },
      { identity: 'you', name: 'You', ship: 'starter', kind: 'quick', code: 'YOU12', heartbeatMs: now },
    ], 'me', now);
    expect(other?.code).toBe('YOU12');
    expect(pickQuickMatch([
      { identity: 'ghost', name: 'Gone', ship: 'starter', kind: 'quick', code: 'GHOST', heartbeatMs: now - 20_000 },
    ], 'me', now)).toBeNull();
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
    expect(versusRockDamagesPid(1, 1)).toBe(true);
    expect(versusShotIgnoresRock(2, 1)).toBe(true);
    expect(versusOwnsShip(['starter', 'rivet'], 'rivet')).toBe(true);
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

  it('always awards the full prize (no daily cap)', () => {
    expect(prizeToAward(0)).toBe(VERSUS_PRIZE);
    expect(prizeToAward(10_000)).toBe(VERSUS_PRIZE);
    expect(prizeToAward(160)).toBe(VERSUS_PRIZE);
    expect(utcDayKey(Date.UTC(2026, 9, 22))).toBe(20261022);
  });

  it('shows the score from each player\'s own view and agrees on the winner', () => {
    expect(youThemScore(2, 1, true)).toEqual({ you: 2, them: 1 });
    expect(youThemScore(2, 1, false)).toEqual({ you: 1, them: 2 });
    expect(iWonMatch(2, 1, true)).toBe(true);
    expect(iWonMatch(2, 1, false)).toBe(false);
    expect(rematchReady(true, false)).toBe(false);
    expect(rematchReady(true, true)).toBe(true);
    expect(cleanVersusMatchId('hack3')).toBe('HACK3:1');
    expect(cleanVersusMatchId('HACK3:2')).toBe('HACK3:2');
  });

  it('pairs similar strength immediately and far-apart players only after a long wait', () => {
    const now = 1_000_000;
    const weak = { identity: 'a', name: 'Ada', ship: 'starter', kind: 'quick' as const, code: 'AAAAA', heartbeatMs: now, strength: 1000, queuedAtMs: now };
    const strong = { identity: 'b', name: 'Bea', ship: 'omega', kind: 'quick' as const, code: 'BBBBB', heartbeatMs: now - 50, strength: 1800, queuedAtMs: now };
    const peer = { identity: 'c', name: 'Cal', ship: 'starter', kind: 'quick' as const, code: 'CCCCC', heartbeatMs: now - 100, strength: 1050, queuedAtMs: now };
    expect(pickQuickMatch([weak, strong], 'a', now, now, 1000, now)).toBeNull();
    expect(pickQuickMatch([weak, peer], 'a', now, now, 1000, now)?.code).toBe('CCCCC');
    const later = now + 80_000;
    const lateStrong = { ...strong, heartbeatMs: later - 500 };
    expect(pickQuickMatch([weak, lateStrong], 'a', later, later, 1000, now)?.code).toBe('BBBBB');
    expect(filterVersusByStrength([strong, peer], 1000, 0, now).map((r) => r.code)).toEqual(['CCCCC']);
    expect(filterVersusByStrength([strong], 1000, 80_000, now + 80_000).map((r) => r.code)).toEqual(['BBBBB']);
    expect(withinBand(1000, 1800, 0)).toBe(false);
    expect(withinBand(1000, 1800, 80_000)).toBe(true);
    expect(matchBand(0)).toBeLessThan(200);
    expect(fallbackStrength(1, 'starter')).toBe(pairingScore(shipCombatPower('starter'), VERSUS_ELO_START));
    expect(shipCombatPower('starter', { heart: 1 })).toBeGreaterThan(shipCombatPower('starter'));
    const elo = eloUpdate(1000, 1000, true);
    expect(elo.a).toBeGreaterThan(1000);
    expect(elo.b).toBeLessThan(1000);
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

  it('keeps a live listing when the SDK uses the underscored timestamp field', () => {
    const now = Date.now();
    const row = versusRowFromServer({
      code: 'seen1',
      hostHex: 'bb',
      hostName: 'Bea',
      hostShip: 'starter',
      kind: 'quick',
      inMatch: false,
      heartbeat: { __timestamp_micros_since_unix_epoch__: BigInt(now) * 1000n },
    });
    expect(row.heartbeatMs).toBeGreaterThan(now - 2000);
    const map = new Map<string, VersusQueueRow>();
    applyVersusQueueEvent(map, { type: 'insert', row }, now);
    expect(listOpenVersus(map, now).map((r) => r.code)).toEqual(['SEEN1']);
  });
});

describe('versus kid-fun extras', () => {
  it('cycles three arena pickups and parks them in mid-lane slots', () => {
    expect(nextVersusPickup(1)).toBe('rapid');
    expect(nextVersusPickup(2)).toBe('bomb');
    expect(nextVersusPickup(3)).toBe('shield');
    expect(versusPickupType('rapid')).toBe('triple');
    expect(versusPickupType('bomb')).toBe('bomb');
    expect(versusPickupLaneX(1, 400)).toBe(Math.round(400 * 0.5));
    expect(versusPickupLaneX(2, 400)).toBe(Math.round(400 * 0.72));
  });

  it('treats 1-1 as sudden death and times out to the player with more hits', () => {
    expect(isSuddenDeathRound(1, 1)).toBe(true);
    expect(isSuddenDeathRound(1, 0)).toBe(false);
    expect(suddenDeathLeft(0)).toBe(VERSUS_SUDDEN_SEC);
    expect(suddenDeathTimedOut(VERSUS_SUDDEN_SEC)).toBe(true);
    expect(suddenDeathWinner({ hostLives: 2, guestLives: 0, hostHits: 0, guestHits: 9, timedOut: false })).toBe(1);
    expect(suddenDeathWinner({ hostLives: 2, guestLives: 2, hostHits: 4, guestHits: 1, timedOut: true })).toBe(1);
    expect(suddenDeathWinner({ hostLives: 2, guestLives: 2, hostHits: 3, guestHits: 3, timedOut: true })).toBe(0);
  });

  it('maps Elo to bronze / silver / gold and keeps unused emotes out', () => {
    expect(versusRank(1000, 0)).toBe('unranked');
    expect(versusRank(1000, 2)).toBe('bronze');
    expect(versusRank(1050, 3)).toBe('silver');
    expect(versusRank(1200, 8)).toBe('gold');
    expect(versusRankFromRating(1000)).toBe('bronze');
    expect(versusRankIcon('gold')).toBe('🥇');
    expect(validVersusEmote('yay')).toBe('yay');
    expect(validVersusEmote('nope')).toBe('');
    const stats = bumpFunCount(emptyVersusFunStats(), 'hits', 2);
    expect(stats.hits).toEqual([0, 1]);
  });
});
