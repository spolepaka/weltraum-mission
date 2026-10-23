/**
 * Host migration helpers. Next living player by join-order pid becomes
 * the new host. PeerJS stays star-topology: the successor opens a derived
 * Peer ID so remaining guests can reconnect without the original host.
 */

export const HOST_GONE_MS = 8_000;
export const HOST_AWAY_MS = 25_000;
export const HOST_RECONNECT_DELAY_MS = 1_200;

export interface RosterSeat {
  pid: number;
  name?: string;
  left?: boolean;
  down?: number | boolean;
  lives?: number;
}

export interface ResumePayload {
  L: number;
  lt: number;
  sc: number;
  hl: number;
  inGame: boolean;
  lives: number[];
  coinsRun: number;
  hostPid: number;
  gen: number;
  code: string;
  name: string;
}

export function migratePeerId(prefix: string, code: string, gen: number): string {
  const c = String(code || '').toUpperCase();
  const g = Math.max(0, Math.floor(gen) || 0);
  return g <= 0 ? prefix + c : prefix + c + '-m' + g;
}

export function livingJoinOrder(roster: RosterSeat[], currentHostPid = 1): RosterSeat[] {
  return roster
    .filter((p) => {
      if (!p || p.pid < 1) return false;
      if (p.pid === currentHostPid) return false;
      if (p.left) return false;
      if (p.down && Number(p.down) >= 900) return false;
      if (typeof p.lives === 'number' && p.lives <= 0 && p.down) return false;
      return true;
    })
    .sort((a, b) => a.pid - b.pid);
}

/** Next host by join order (lowest remaining pid). 0 = nobody left. */
export function nextHostPid(roster: RosterSeat[], currentHostPid = 1): number {
  const live = livingJoinOrder(roster, currentHostPid);
  return live[0]?.pid || 0;
}

export function shouldSelfPromote(myPid: number, nextPid: number): boolean {
  return nextPid > 0 && myPid === nextPid;
}

export function hostGoneTimeout(hostAway: boolean): number {
  return hostAway ? HOST_AWAY_MS : HOST_GONE_MS;
}

export function onlyOneLeft(roster: RosterSeat[], currentHostPid = 1): boolean {
  return livingJoinOrder(roster, currentHostPid).length === 0;
}

export function buildResume(partial: Partial<ResumePayload> & { code: string; hostPid: number; gen: number; name: string }): ResumePayload {
  return {
    L: Math.max(1, Math.min(250, Math.floor(partial.L || 1))),
    lt: Math.max(0, Number(partial.lt) || 0),
    sc: Math.max(0, Math.floor(partial.sc || 0)),
    hl: Math.max(0, Math.floor(partial.hl || 0)),
    inGame: !!partial.inGame,
    lives: Array.isArray(partial.lives) ? partial.lives.map((n) => Math.max(0, Math.floor(n || 0))) : [],
    coinsRun: Math.max(0, Math.floor(partial.coinsRun || 0)),
    hostPid: partial.hostPid,
    gen: partial.gen,
    code: String(partial.code || '').toUpperCase(),
    name: String(partial.name || 'P' + partial.hostPid).slice(0, 16),
  };
}
