/**
 * Public room listings. Private rooms stay code-only and are never listed.
 * Heartbeat / TTL is enforced on the client list and again on the server.
 */

import { ROOM_CODE_CHARS, validateRoomCode } from '../coop-security';
import { NAME_MAX, validateDisplayName } from './display-names';

export const ROOM_TTL_MS = 15_000;
export const ROOM_HEARTBEAT_MS = 4_000;
export const ROOM_MAX_PLAYERS = 5;

export interface PublicRoomRow {
  code: string;
  hostName: string;
  level: number;
  players: number;
  inGame?: boolean;
  heartbeatMs?: number;
}

export function isListingFresh(heartbeatMs: number, nowMs = Date.now()): boolean {
  if (!Number.isFinite(heartbeatMs) || heartbeatMs <= 0) return false;
  return nowMs - heartbeatMs <= ROOM_TTL_MS;
}

export function sanitizeListedName(raw: string): string {
  const trimmed = String(raw || '').trim().slice(0, NAME_MAX);
  const checked = validateDisplayName(trimmed, 'generated');
  if (checked.ok) return checked.name;
  const custom = validateDisplayName(trimmed, 'custom');
  if (custom.ok) return custom.name;
  return 'Pilot';
}

export function canPublishRoom(opts: { isPublic: boolean; players: number; closed?: boolean }): boolean {
  if (!opts.isPublic || opts.closed) return false;
  const n = Math.floor(opts.players);
  return n >= 1 && n <= ROOM_MAX_PLAYERS;
}

export function isJoinableListing(row: PublicRoomRow, nowMs = Date.now()): boolean {
  if (!validateRoomCode(row.code)) return false;
  if (row.inGame) return false;
  const n = Math.floor(row.players);
  if (n < 1 || n >= ROOM_MAX_PLAYERS) return false;
  if (row.heartbeatMs !== undefined && !isListingFresh(row.heartbeatMs, nowMs)) return false;
  return true;
}

export function filterJoinableRooms(rows: PublicRoomRow[], nowMs = Date.now()): PublicRoomRow[] {
  const seen = new Set<string>();
  const out: PublicRoomRow[] = [];
  for (const row of rows) {
    const code = String(row.code || '').toUpperCase();
    if (seen.has(code) || !isJoinableListing({ ...row, code }, nowMs)) continue;
    seen.add(code);
    out.push({
      code,
      hostName: sanitizeListedName(row.hostName),
      level: Math.max(1, Math.min(100, Math.floor(row.level) || 1)),
      players: Math.max(1, Math.min(ROOM_MAX_PLAYERS, Math.floor(row.players) || 1)),
      inGame: false,
      heartbeatMs: row.heartbeatMs,
    });
  }
  return out.sort((a, b) => a.level - b.level || a.hostName.localeCompare(b.hostName));
}

export function listingPeerId(prefix: string, code: string): string {
  return prefix + String(code || '').toUpperCase();
}

export { ROOM_CODE_CHARS, validateRoomCode };
