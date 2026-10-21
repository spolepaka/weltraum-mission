import { describe, expect, it } from 'vitest';
import { applyPublicRoomEvent, type PublicRoomRow } from '../src/lib/room-list';

/**
 * Full two-client SpacetimeDB check lives in tools/public-rooms-live-proof.mjs
 * (starts a local module when spacetime CLI is available). This file keeps the
 * same insert/delete contract in the default unit suite without talking to
 * Maincloud.
 */
describe('public room live contract (no production E2E)', () => {
  it('second client sees insert then delete', () => {
    const a = new Map<string, PublicRoomRow>();
    const b = new Map<string, PublicRoomRow>();
    const now = Date.now();
    const row = { code: 'ADA34', hostName: 'Pia', level: 1, players: 1, heartbeatMs: now };
    applyPublicRoomEvent(a, { type: 'insert', row }, now);
    const seen = applyPublicRoomEvent(b, { type: 'insert', row }, now);
    expect(seen.map((r) => r.code)).toEqual(['ADA34']);
    const gone = applyPublicRoomEvent(b, { type: 'delete', code: 'ADA34' }, now);
    expect(gone).toEqual([]);
  });
});
