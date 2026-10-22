import { describe, expect, it } from 'vitest';
import {
  ROOM_STALE_MS,
  ROOM_TTL_MS,
  applyPublicRoomEvent,
  canPublishRoom,
  decorateListedRooms,
  filterJoinableRooms,
  heartbeatToMs,
  shouldCloseListing,
  shouldCloseOnHidden,
  shouldCloseOnPageHide,
  shouldPublishListing,
  isJoinableListing,
  isListingFresh,
  listingFreshness,
  pruneStaleRooms,
  publicRoomFromServer,
  type PublicRoomRow,
} from '../src/lib/room-list';

describe('public room list', () => {
  const now = 1_000_000;

  it('hides private, stale, full, empty, and in-game rooms', () => {
    expect(canPublishRoom({ isPublic: false, players: 2 })).toBe(false);
    expect(canPublishRoom({ isPublic: true, players: 2 })).toBe(true);
    expect(isListingFresh(now - ROOM_TTL_MS - 1, now)).toBe(false);
    expect(isListingFresh(now - 1_000, now)).toBe(true);
    expect(isJoinableListing({ code: 'HACK3', hostName: 'Ada', level: 12, players: 5, heartbeatMs: now }, now)).toBe(false);
    expect(isJoinableListing({ code: 'HACK3', hostName: 'Ada', level: 12, players: 2, inGame: true, heartbeatMs: now }, now)).toBe(false);
  });

  it('only shows kid-safe host names and valid codes', () => {
    const rows = filterJoinableRooms([
      { code: 'HACK3', hostName: 'Mighty Comet', level: 12, players: 2, heartbeatMs: now },
      { code: '!!!', hostName: 'Ada', level: 1, players: 1, heartbeatMs: now },
      { code: 'HACK3', hostName: 'dup', level: 12, players: 2, heartbeatMs: now },
      { code: 'TREK4', hostName: 'fuck nazi', level: 4, players: 1, heartbeatMs: now },
      { code: 'STALE', hostName: 'Old', level: 3, players: 1, heartbeatMs: now - ROOM_TTL_MS - 50 },
    ], now);
    expect(rows.map((r) => r.code)).toEqual(['TREK4', 'HACK3']);
    expect(rows[0].hostName).toBe('Pilot');
    expect(rows[1].hostName).toBe('Mighty Comet');
  });

  it('propagates live insert/update/delete to a second client cache within a tick', () => {
    const host = new Map<string, PublicRoomRow>();
    const guest = new Map<string, PublicRoomRow>();
    const row = { code: 'HACK3', hostName: 'Ada', level: 4, players: 1, heartbeatMs: now };
    const t0 = Date.now();
    const afterHost = applyPublicRoomEvent(host, { type: 'insert', row }, now);
    const afterGuest = applyPublicRoomEvent(guest, { type: 'insert', row }, now);
    const dt = Date.now() - t0;
    expect(dt).toBeLessThan(1000);
    expect(afterHost.map((r) => r.code)).toEqual(['HACK3']);
    expect(afterGuest.map((r) => r.code)).toEqual(['HACK3']);
    expect(afterGuest[0].hostName).toBe('Ada');
    expect(afterGuest[0].level).toBe(4);
    expect(afterGuest[0].players).toBe(1);

    applyPublicRoomEvent(host, { type: 'update', row: { ...row, players: 3 } }, now);
    const guestUpdated = applyPublicRoomEvent(guest, { type: 'update', row: { ...row, players: 3 } }, now);
    expect(guestUpdated[0].players).toBe(3);

    applyPublicRoomEvent(host, { type: 'delete', code: 'HACK3' }, now);
    const guestGone = applyPublicRoomEvent(guest, { type: 'delete', code: 'HACK3' }, now);
    expect(guestGone).toEqual([]);
  });

  it('drops abandoned rooms from both caches once the heartbeat is stale', () => {
    const a = new Map<string, PublicRoomRow>();
    const b = new Map<string, PublicRoomRow>();
    const row = { code: 'TREK4', hostName: 'Old', level: 2, players: 1, heartbeatMs: now };
    applyPublicRoomEvent(a, { type: 'insert', row }, now);
    applyPublicRoomEvent(b, { type: 'insert', row }, now);
    expect(pruneStaleRooms(a, now + ROOM_TTL_MS + 1)).toEqual([]);
    expect(pruneStaleRooms(b, now + ROOM_TTL_MS + 1)).toEqual([]);
  });

  it('reads heartbeat micros from a server publicRoom row', () => {
    const row = publicRoomFromServer({
      code: 'PUL34',
      hostName: 'Nia',
      level: 7,
      players: 2,
      inGame: false,
      heartbeat: { microsSinceUnixEpoch: BigInt(now) * 1000n },
    });
    expect(row.code).toBe('PUL34');
    expect(heartbeatToMs(row.heartbeatMs)).toBe(now);
    expect(isListingFresh(row.heartbeatMs || 0, now)).toBe(true);
    expect(heartbeatToMs({ __timestamp_micros_since_unix_epoch__: BigInt(now) * 1000n })).toBe(now);
  });

  it('only closes a listing when the host is actually leaving', () => {
    expect(shouldCloseListing({ leaving: false, listed: true })).toBe(false);
    expect(shouldCloseListing({ leaving: true, listed: true })).toBe(true);
    expect(shouldCloseListing({ leaving: true, listed: false })).toBe(false);
  });

  it('does not publish until the host Peer is open', () => {
    expect(shouldPublishListing({ isPublic: true, role: 'host', peerReady: false, code: 'V43NX' })).toBe(false);
    expect(shouldPublishListing({ isPublic: true, role: 'host', peerReady: true, code: 'V43NX' })).toBe(true);
    expect(shouldPublishListing({ isPublic: true, role: 'guest', peerReady: true, code: 'V43NX' })).toBe(false);
  });

  it('greys a stale heartbeat and hides a dead one', () => {
    expect(listingFreshness(now - ROOM_STALE_MS - 10, now)).toBe('stale');
    expect(listingFreshness(now - 1_000, now)).toBe('fresh');
    expect(listingFreshness(undefined, now)).toBe('dead');
    expect(isJoinableListing({ code: 'V43NX', hostName: 'Ada', level: 1, players: 1, heartbeatMs: now - ROOM_STALE_MS - 10 }, now)).toBe(false);
    const shown = decorateListedRooms([
      { code: 'V43NX', hostName: 'Ada', level: 1, players: 1, heartbeatMs: now - ROOM_STALE_MS - 10 },
      { code: 'TREK4', hostName: 'Bea', level: 2, players: 1, heartbeatMs: now },
    ], now);
    expect(shown.map((r) => r.code)).toEqual(['V43NX', 'TREK4']);
    expect(shown[0].joinable).toBe(false);
    expect(shown[0].freshness).toBe('stale');
    expect(shown[1].joinable).toBe(true);
  });

  it('closes a listed room on a real leave, not on a persisted iPad sleep with friends', () => {
    expect(shouldCloseOnPageHide({ persisted: true, listed: true })).toBe(false);
    expect(shouldCloseOnPageHide({ persisted: false, listed: true })).toBe(true);
    expect(shouldCloseOnHidden({ hidden: true, occupancy: 1, listed: true })).toBe(true);
    expect(shouldCloseOnHidden({ hidden: true, occupancy: 2, listed: true })).toBe(false);
    expect(shouldCloseOnHidden({ hidden: false, occupancy: 1, listed: true })).toBe(false);
  });
});
