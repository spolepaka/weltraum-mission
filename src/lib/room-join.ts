/**
 * Public-room join / solo-host spawn helpers.
 * Peer-unavailable is often a race (host Peer not open yet, or a close/re-insert).
 */

export const JOIN_RETRY_DELAYS_MS = [250, 500, 1000] as const;
export const LIST_JOIN_MAX_GEN = 4;

export function isTransientPeerError(type: string | undefined | null): boolean {
  return type === 'peer-unavailable' || type === 'network' || type === 'server-error' || type === 'server_error';
}

export function shouldRetryJoin(type: string | undefined | null, attempt: number): boolean {
  return isTransientPeerError(type) && attempt >= 0 && attempt < JOIN_RETRY_DELAYS_MS.length;
}

export function nextJoinDelay(attempt: number): number {
  const i = Math.max(0, Math.min(JOIN_RETRY_DELAYS_MS.length - 1, Math.floor(attempt) || 0));
  return JOIN_RETRY_DELAYS_MS[i];
}

/** List taps omit gen. Walk derived PeerJS ids after a host re-insert / migrate. */
export function nextListJoinGen(prev: number | null, forcedGen: boolean): number | null {
  if (forcedGen) return null;
  const n = prev == null ? 0 : Math.floor(prev) + 1;
  return n > LIST_JOIN_MAX_GEN ? null : n;
}

export function isOwnListedRoom(role: string | null | undefined, hostCode: string, joinCode: string): boolean {
  if (role !== 'host') return false;
  const a = String(hostCode || '').toUpperCase();
  const b = String(joinCode || '').toUpperCase();
  return !!a && a === b;
}

export interface GuestIdent {
  ok?: boolean;
  pid?: number;
  peerId?: string;
  name?: string;
}

/** Drop duplicate seats (same PeerJS id, or same name after a close/re-insert). */
export function dedupeGuestsByIdentity<T extends GuestIdent>(guests: T[], hostPeerId?: string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const g of guests) {
    if (!g || !g.ok) continue;
    const peer = String(g.peerId || '').trim();
    if (hostPeerId && peer && peer === hostPeerId) continue;
    const key = peer || (g.name ? 'name:' + String(g.name).toLowerCase() : 'pid:' + (g.pid || 0));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

export function occupancyFromGuests<T extends GuestIdent>(guests: T[], hostPeerId?: string): number {
  return 1 + dedupeGuestsByIdentity(guests, hostPeerId).length;
}

/** Online rooms spawn from real occupancy. Never force a second ship. */
export function coopShipCount(opts: {
  role?: string | null;
  inGame?: boolean;
  twoPOn?: boolean;
  occupancy: number;
  nPl?: number;
}): number {
  const occ = Math.max(1, Math.min(5, Math.floor(opts.occupancy) || 1));
  if (opts.role) {
    const listed = Math.max(1, Math.min(5, Math.floor(opts.nPl || occ) || 1));
    return Math.min(occ, listed);
  }
  return opts.twoPOn ? 2 : 1;
}

export function shouldApplyLocalInput(opts: {
  role?: string | null;
  inGame?: boolean;
  curPid: number;
  hostPid: number;
  hasGuest: boolean;
}): boolean {
  if (opts.role === 'host' && opts.inGame && opts.curPid > 1) return false;
  return true;
}
