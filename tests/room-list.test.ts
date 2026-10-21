import { describe, expect, it } from 'vitest';
import {
  ROOM_TTL_MS,
  applyPublicRoomEvent,
  canPublishRoom,
  filterJoinableRooms,
  heartbeatToMs,
  isJoinableListing,
  isListingFresh,
  pruneStaleRooms,
  publicRoomFromServer,
  sanitizeListedName,
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
  });
});
