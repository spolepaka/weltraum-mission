import { describe, expect, it } from 'vitest';
import {
  ROOM_TTL_MS,
  canPublishRoom,
  filterJoinableRooms,
  isJoinableListing,
  isListingFresh,
  sanitizeListedName,
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
});
