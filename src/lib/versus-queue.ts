/**
 * Client-side versus queue events (same pattern as public rooms).
 */

import { listingFreshness, type VersusKind } from './versus';

export interface VersusQueueRow {
  code: string;
  hostHex: string;
  guestHex: string;
  hostName: string;
  guestName: string;
  hostShip: string;
  guestShip: string;
  kind: VersusKind;
  inMatch: boolean;
  heartbeatMs: number;
}

export type VersusQueueEvent =
  | { type: 'insert' | 'update'; row: VersusQueueRow }
  | { type: 'delete'; code: string };

export function versusRowFromServer(raw: Record<string, unknown>): VersusQueueRow {
  const kind = raw.kind === 'challenge' ? 'challenge' : 'quick';
  const beat = raw.heartbeatMs ?? raw.heartbeat;
  let heartbeatMs = 0;
  if (typeof beat === 'number') heartbeatMs = beat > 1e12 ? Math.floor(beat / 1000) : beat;
  else if (beat && typeof beat === 'object') {
    const micros = (beat as { microsSinceUnixEpoch?: bigint | number }).microsSinceUnixEpoch;
    if (micros !== undefined) heartbeatMs = Math.floor(Number(micros) / 1000);
  }
  return {
    code: String(raw.code || '').toUpperCase(),
    hostHex: String(raw.hostHex || ''),
    guestHex: String(raw.guestHex || ''),
    hostName: String(raw.hostName || 'Pilot').slice(0, 16),
    guestName: String(raw.guestName || '').slice(0, 16),
    hostShip: String(raw.hostShip || 'starter'),
    guestShip: String(raw.guestShip || ''),
    kind,
    inMatch: !!raw.inMatch,
    heartbeatMs,
  };
}

export function applyVersusQueueEvent(
  map: Map<string, VersusQueueRow>,
  event: VersusQueueEvent,
  nowMs = Date.now(),
): VersusQueueRow[] {
  if (event.type === 'delete') map.delete(event.code);
  else map.set(event.row.code, event.row);
  return listQuickQueue(map, nowMs);
}

export function listQuickQueue(map: Map<string, VersusQueueRow>, nowMs = Date.now()): VersusQueueRow[] {
  return [...map.values()].filter((row) => {
    if (row.inMatch || row.kind !== 'quick') return false;
    return listingFreshness(row.heartbeatMs, nowMs) !== 'dead';
  });
}

export function findChallenge(map: Map<string, VersusQueueRow>, code: string, nowMs = Date.now()): VersusQueueRow | null {
  const row = map.get(String(code || '').toUpperCase());
  if (!row || row.kind !== 'challenge' || row.inMatch) return null;
  if (listingFreshness(row.heartbeatMs, nowMs) !== 'fresh') return null;
  return row;
}

export function myVersusRole(row: VersusQueueRow, myHex: string): 'host' | 'guest' | null {
  if (!myHex) return null;
  if (row.hostHex === myHex) return 'host';
  if (row.guestHex === myHex) return 'guest';
  return null;
}
