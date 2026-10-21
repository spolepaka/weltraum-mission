import { describe, expect, it } from 'vitest';
import {
  JOIN_RETRY_DELAYS_MS,
  coopShipCount,
  dedupeGuestsByIdentity,
  isOwnListedRoom,
  isTransientPeerError,
  nextJoinDelay,
  nextListJoinGen,
  occupancyFromGuests,
  shouldApplyLocalInput,
  shouldRetryJoin,
} from '../src/lib/room-join';

describe('public room join retries', () => {
  it('retries peer-unavailable with a short backoff instead of calling it not-found', () => {
    expect(isTransientPeerError('peer-unavailable')).toBe(true);
    expect(shouldRetryJoin('peer-unavailable', 0)).toBe(true);
    expect(shouldRetryJoin('peer-unavailable', JOIN_RETRY_DELAYS_MS.length)).toBe(false);
    expect(nextJoinDelay(0)).toBe(250);
    expect(nextJoinDelay(1)).toBe(500);
    expect(nextJoinDelay(2)).toBe(1000);
    expect(nextListJoinGen(null, false)).toBe(0);
    expect(nextListJoinGen(0, false)).toBe(1);
    expect(nextListJoinGen(4, false)).toBe(null);
    expect(nextListJoinGen(0, true)).toBe(null);
  });

  it('does not join the host to its own listed row', () => {
    expect(isOwnListedRoom('host', 'V43NX', 'v43nx')).toBe(true);
    expect(isOwnListedRoom('guest', 'V43NX', 'V43NX')).toBe(false);
  });
});

describe('solo host ships', () => {
  it('spawns one ship when the host is alone, even if nPl defaulted to 2', () => {
    expect(coopShipCount({ role: 'host', inGame: true, occupancy: 1, nPl: 2, twoPOn: true })).toBe(1);
    expect(coopShipCount({ role: 'host', occupancy: 1, nPl: 1 })).toBe(1);
    expect(coopShipCount({ role: 'host', occupancy: 2, nPl: 2 })).toBe(2);
    expect(coopShipCount({ role: null, twoPOn: true, occupancy: 1 })).toBe(2);
    expect(coopShipCount({ role: null, twoPOn: false, occupancy: 1 })).toBe(1);
  });

  it('drops a duplicate guest identity so the host is not counted twice', () => {
    const guests = [
      { ok: true, pid: 2, peerId: 'abc', name: 'Ada' },
      { ok: true, pid: 3, peerId: 'abc', name: 'Ada' },
      { ok: true, pid: 4, peerId: 'host-peer', name: 'Host' },
    ];
    expect(dedupeGuestsByIdentity(guests, 'host-peer')).toEqual([{ ok: true, pid: 2, peerId: 'abc', name: 'Ada' }]);
    expect(occupancyFromGuests(guests, 'host-peer')).toBe(2);
  });

  it('does not apply host input to an empty extra seat', () => {
    expect(shouldApplyLocalInput({ role: 'host', inGame: true, curPid: 1, hostPid: 1, hasGuest: false })).toBe(true);
    expect(shouldApplyLocalInput({ role: 'host', inGame: true, curPid: 2, hostPid: 1, hasGuest: false })).toBe(false);
    expect(shouldApplyLocalInput({ role: 'host', inGame: true, curPid: 2, hostPid: 1, hasGuest: true })).toBe(false);
    expect(shouldApplyLocalInput({ role: 'host', inGame: true, curPid: 2, hostPid: 2, hasGuest: true })).toBe(false);
    expect(shouldApplyLocalInput({ role: null, inGame: false, curPid: 2, hostPid: 1, hasGuest: false })).toBe(true);
  });
});
