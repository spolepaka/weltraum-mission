/**
 * Client-side versus queue events (same pattern as public rooms).
 */

import { heartbeatToMs } from './room-list';
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
  rating?: number;
  strength?: number;
  queuedAtMs?: number;
  shipPower?: number;
  guestShipPower?: number;
  hostUps?: string;
  guestUps?: string;
}

export type VersusQueueEvent =
  | { type: 'insert' | 'update'; row: VersusQueueRow }
  | { type: 'delete'; code: string };

export function versusRowFromServer(raw: Record<string, unknown>): VersusQueueRow {
  const kind = raw.kind === 'challenge' ? 'challenge' : 'quick';
  const fromMs = raw.heartbeatMs;
  const heartbeatMs = typeof fromMs === 'number' && Number.isFinite(fromMs)
    ? (fromMs > 1e12 ? Math.floor(fromMs / 1000) : fromMs)
    : heartbeatToMs(raw.heartbeat) || 0;
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
    rating: Math.max(0, Math.floor(Number(raw.rating) || 0)) || undefined,
    strength: Math.max(0, Math.floor(Number(raw.strength) || 0)) || undefined,
    queuedAtMs: raw.queuedAtMs !== undefined
      ? Math.max(0, Math.floor(Number(raw.queuedAtMs) || 0)) || undefined
      : (Number(raw.queuedAtUs) > 0 ? Math.floor(Number(raw.queuedAtUs) / 1000) : undefined),
    shipPower: Math.max(0, Math.floor(Number(raw.shipPower) || 0)) || undefined,
    guestShipPower: Math.max(0, Math.floor(Number(raw.guestShipPower) || 0)) || undefined,
    hostUps: raw.hostUps != null ? String(raw.hostUps) : undefined,
    guestUps: raw.guestUps != null ? String(raw.guestUps) : undefined,
  };
}

export function applyVersusQueueEvent(
  map: Map<string, VersusQueueRow>,
  event: VersusQueueEvent,
  nowMs = Date.now(),
): VersusQueueRow[] {
  if (event.type === 'delete') map.delete(event.code);
  else map.set(event.row.code, event.row);
  return listOpenVersus(map, nowMs);
}

export function listOpenVersus(map: Map<string, VersusQueueRow>, nowMs = Date.now()): VersusQueueRow[] {
  return [...map.values()].filter((row) => {
    if (row.inMatch) return false;
    return listingFreshness(row.heartbeatMs, nowMs) !== 'dead';
  });
}

export function listQuickQueue(map: Map<string, VersusQueueRow>, nowMs = Date.now()): VersusQueueRow[] {
  return listOpenVersus(map, nowMs).filter((row) => row.kind === 'quick');
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
