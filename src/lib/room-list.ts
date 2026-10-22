/**
 * Public room listings. Private rooms stay code-only and are never listed.
 * Heartbeat / TTL is enforced on the client list and again on the server.
 */

import { ROOM_CODE_CHARS, validateRoomCode } from '../coop-security';
import { NAME_MAX, validateDisplayName } from './display-names';

export const ROOM_TTL_MS = 15_000;
export const ROOM_STALE_MS = 8_000;
export const ROOM_HEARTBEAT_MS = 4_000;
export const ROOM_MAX_PLAYERS = 5;

export interface PublicRoomRow {
  code: string;
  hostName: string;
  level: number;
  players: number;
  inGame?: boolean;
  versus?: boolean;
  heartbeatMs?: number;
}

export type ListingFreshness = 'fresh' | 'stale' | 'dead';

export interface DecoratedRoomRow extends PublicRoomRow {
  freshness: ListingFreshness;
  joinable: boolean;
}

export function listingFreshness(heartbeatMs: number | undefined, nowMs = Date.now()): ListingFreshness {
  if (heartbeatMs === undefined || !Number.isFinite(heartbeatMs) || heartbeatMs <= 0) return 'dead';
  const age = nowMs - heartbeatMs;
  if (age > ROOM_TTL_MS) return 'dead';
  if (age > ROOM_STALE_MS) return 'stale';
  return 'fresh';
}

export function isListingFresh(heartbeatMs: number, nowMs = Date.now()): boolean {
  return listingFreshness(heartbeatMs, nowMs) === 'fresh';
}

export function sanitizeListedName(raw: string): string {
  const trimmed = String(raw || '').trim().slice(0, NAME_MAX);
  const checked = validateDisplayName(trimmed, 'generated');
  if (checked.ok) return checked.name;
  const custom = validateDisplayName(trimmed, 'custom');
  if (custom.ok) return custom.name;
  return 'Pilot';
}

export function listingPlayerCap(versus?: boolean): number {
  return versus ? 2 : ROOM_MAX_PLAYERS;
}

export function canPublishRoom(opts: { isPublic: boolean; players: number; closed?: boolean; versus?: boolean }): boolean {
  if (!opts.isPublic || opts.closed) return false;
  const n = Math.floor(opts.players);
  const cap = listingPlayerCap(opts.versus);
  return n >= 1 && n <= cap;
}

export function isListableRoom(row: PublicRoomRow, nowMs = Date.now()): boolean {
  if (!validateRoomCode(row.code)) return false;
  if (row.inGame) return false;
  const n = Math.floor(row.players);
  const cap = listingPlayerCap(row.versus);
  if (n < 1 || n >= cap) return false;
  return listingFreshness(row.heartbeatMs, nowMs) !== 'dead';
}

export function isJoinableListing(row: PublicRoomRow, nowMs = Date.now()): boolean {
  return isListableRoom(row, nowMs) && listingFreshness(row.heartbeatMs, nowMs) === 'fresh';
}

function normalizeRoomRow(row: PublicRoomRow): PublicRoomRow {
  const versus = !!row.versus;
  const cap = listingPlayerCap(versus);
  return {
    code: String(row.code || '').toUpperCase(),
    hostName: sanitizeListedName(row.hostName),
    level: Math.max(1, Math.min(100, Math.floor(row.level) || 1)),
    players: Math.max(1, Math.min(cap, Math.floor(row.players) || 1)),
    inGame: !!row.inGame,
    versus,
    heartbeatMs: row.heartbeatMs,
  };
}

export function splitListedRooms<T extends { versus?: boolean }>(rows: T[]): { coop: T[]; versus: T[] } {
  const coop: T[] = [];
  const versus: T[] = [];
  for (const row of rows) {
    if (row.versus) versus.push(row);
    else coop.push(row);
  }
  return { coop, versus };
}

export function decorateListedRooms(rows: PublicRoomRow[], nowMs = Date.now()): DecoratedRoomRow[] {
  const seen = new Set<string>();
  const out: DecoratedRoomRow[] = [];
  for (const raw of rows) {
    const row = normalizeRoomRow(raw);
    if (seen.has(row.code) || !isListableRoom(row, nowMs)) continue;
    seen.add(row.code);
    const freshness = listingFreshness(row.heartbeatMs, nowMs);
    out.push({
      ...row,
      inGame: false,
      freshness,
      joinable: freshness === 'fresh',
    });
  }
  return out.sort((a, b) => a.level - b.level || a.hostName.localeCompare(b.hostName));
}

export function filterJoinableRooms(rows: PublicRoomRow[], nowMs = Date.now()): PublicRoomRow[] {
  return decorateListedRooms(rows, nowMs).filter((row) => row.joinable).map(({ freshness, joinable, ...row }) => row);
}

export function heartbeatToMs(heartbeat: unknown): number | undefined {
  if (heartbeat == null) return undefined;
  if (typeof heartbeat === 'number' && Number.isFinite(heartbeat)) {
    return heartbeat > 1e14 ? Math.floor(heartbeat / 1000) : heartbeat;
  }
  if (typeof heartbeat === 'bigint') return Number(heartbeat / 1000n);
  const stamped = heartbeat as { microsSinceUnixEpoch?: bigint | number; __timestamp_micros_since_unix_epoch__?: bigint | number };
  const micros = stamped.microsSinceUnixEpoch ?? stamped.__timestamp_micros_since_unix_epoch__;
  if (typeof micros === 'bigint') return Number(micros / 1000n);
  if (typeof micros === 'number' && Number.isFinite(micros)) return Math.floor(micros / 1000);
  return undefined;
}

export function publicRoomFromServer(row: {
  code?: string;
  hostName?: string;
  level?: number | string;
  players?: number | string;
  inGame?: boolean;
  versus?: boolean;
  heartbeat?: unknown;
  heartbeatMs?: number;
}): PublicRoomRow {
  const versus = !!row.versus;
  const cap = listingPlayerCap(versus);
  return {
    code: String(row.code || '').toUpperCase(),
    hostName: sanitizeListedName(String(row.hostName || '')),
    level: Math.max(1, Math.min(100, Math.floor(Number(row.level) || 1))),
    players: Math.max(1, Math.min(cap, Math.floor(Number(row.players) || 1))),
    inGame: !!row.inGame,
    versus,
    heartbeatMs: row.heartbeatMs !== undefined ? row.heartbeatMs : heartbeatToMs(row.heartbeat),
  };
}

export type PublicRoomEvent =
  | { type: 'insert' | 'update'; row: PublicRoomRow }
  | { type: 'delete'; code: string };

/** Apply a live publicRoom row event to a client cache and return the joinable list. */
export function applyPublicRoomEvent(
  cache: Map<string, PublicRoomRow>,
  event: PublicRoomEvent,
  nowMs = Date.now(),
): PublicRoomRow[] {
  if (event.type === 'delete') {
    cache.delete(String(event.code || '').toUpperCase());
  } else {
    const row = publicRoomFromServer(event.row);
    if (row.code) cache.set(row.code, row);
  }
  return pruneStaleRooms(cache, nowMs);
}

export function pruneStaleRooms(cache: Map<string, PublicRoomRow>, nowMs = Date.now()): PublicRoomRow[] {
  for (const [code, row] of [...cache.entries()]) {
    if (listingFreshness(row.heartbeatMs, nowMs) === 'dead') cache.delete(code);
  }
  return decorateListedRooms([...cache.values()], nowMs);
}

export function listingPeerId(prefix: string, code: string): string {
  return prefix + String(code || '').toUpperCase();
}

/** Closing on heartbeat restart races a later close past the next publish. */
export function shouldCloseListing(opts: { leaving: boolean; listed: boolean }): boolean {
  return !!(opts.leaving && opts.listed);
}

export function shouldPublishListing(opts: {
  isPublic: boolean;
  role?: string | null;
  peerReady: boolean;
  code: string;
  leaving?: boolean;
}): boolean {
  if (opts.leaving || !opts.isPublic || opts.role !== 'host' || !opts.peerReady) return false;
  return validateRoomCode(opts.code);
}

export function shouldCloseOnPageHide(opts: { persisted: boolean; listed: boolean }): boolean {
  return !opts.persisted && !!opts.listed;
}

/** Solo host backgrounding: the Peer often dies, so drop the row instead of leaving a not-found bait. */
export function shouldCloseOnHidden(opts: { hidden: boolean; occupancy: number; listed: boolean }): boolean {
  return !!opts.hidden && !!opts.listed && (Math.floor(opts.occupancy) || 0) <= 1;
}

export { ROOM_CODE_CHARS, validateRoomCode };
