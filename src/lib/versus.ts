/**
 * 1 vs 1 versus: pairing, fair loadout, mirrored arena, prize.
 * Server copy: server/spacetimedb/src/versus.ts (lockstep).
 */

export const VERSUS_HEARTS = 4;
export const VERSUS_ROUNDS_TO_WIN = 2;
export const VERSUS_PRIZE = 40;
export const VERSUS_DAILY_CAP = 160;
export const VERSUS_MAX_PLAYERS = 2;
export const VERSUS_NUDGE = 220;
export const VERSUS_SHOT_SPEED = 650;
export const VERSUS_QUEUE_TTL_MS = 15_000;
export const VERSUS_QUEUE_STALE_MS = 8_000;
export const VERSUS_QUEUE_HEARTBEAT_MS = 4_000;

export type VersusKind = 'quick' | 'challenge';

export interface VersusWaiter {
  identity: string;
  name: string;
  ship: string;
  kind: VersusKind;
  code: string;
  heartbeatMs: number;
}

export interface VersusMatch {
  matchId: string;
  hostHex: string;
  guestHex: string;
  hostName: string;
  guestName: string;
  hostShip: string;
  guestShip: string;
}

export interface VersusFairStats {
  hearts: number;
  dmg: number;
  shots: number;
  rate: number;
  speed: number;
  hitR: number;
  perk: string;
  perk2: string;
  regen: number;
  drones: number;
  dur: number;
  magR: number;
}

export function versusFairStats(): VersusFairStats {
  return {
    hearts: VERSUS_HEARTS,
    dmg: 2,
    shots: 1,
    rate: 0.28,
    speed: 1,
    hitR: 22,
    perk: '',
    perk2: '',
    regen: 0,
    drones: 0,
    dur: 1,
    magR: 0,
  };
}

export function utcDayKey(ms: number = Date.now()): number {
  const d = new Date(ms);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export function prizeToAward(alreadyToday: number, prize = VERSUS_PRIZE, cap = VERSUS_DAILY_CAP): number {
  const left = Math.max(0, cap - Math.max(0, alreadyToday | 0));
  return Math.max(0, Math.min(prize, left));
}

/** Best of 3: first to 2 round wins. winnerPid is 1 (host) or 2 (guest). */
export function validateVersusReport(opts: {
  winnerPid: number;
  hostRounds: number;
  guestRounds: number;
}): { ok: boolean; reason?: string } {
  const w = opts.winnerPid | 0;
  const a = opts.hostRounds | 0;
  const b = opts.guestRounds | 0;
  if (w !== 1 && w !== 2) return { ok: false, reason: 'bad-winner' };
  if (a < 0 || b < 0 || a > 2 || b > 2) return { ok: false, reason: 'bad-score' };
  if (a === 2 && b === 2) return { ok: false, reason: 'tied' };
  if (Math.max(a, b) !== 2) return { ok: false, reason: 'not-over' };
  if (a + b < 2 || a + b > 3) return { ok: false, reason: 'bad-total' };
  if (w === 1 && a !== 2) return { ok: false, reason: 'host-not-winner' };
  if (w === 2 && b !== 2) return { ok: false, reason: 'guest-not-winner' };
  return { ok: true };
}

export function roundWinner(hostLives: number, guestLives: number): 0 | 1 | 2 {
  if (hostLives <= 0 && guestLives <= 0) return 0;
  if (hostLives <= 0) return 2;
  if (guestLives <= 0) return 1;
  return 0;
}

export function matchOver(hostWins: number, guestWins: number, need = VERSUS_ROUNDS_TO_WIN): boolean {
  return hostWins >= need || guestWins >= need;
}

export function disconnectWinner(leftPid: number): 1 | 2 {
  return leftPid === 1 ? 2 : 1;
}

export function listingFreshness(heartbeatMs: number | undefined, nowMs = Date.now()): 'fresh' | 'stale' | 'dead' {
  if (!heartbeatMs || !Number.isFinite(heartbeatMs) || heartbeatMs <= 0) return 'dead';
  const age = nowMs - heartbeatMs;
  if (age > VERSUS_QUEUE_TTL_MS) return 'dead';
  if (age > VERSUS_QUEUE_STALE_MS) return 'stale';
  return 'fresh';
}

export function pickQuickMatch(waiters: VersusWaiter[], myHex: string, nowMs = Date.now(), myHeartbeatMs?: number): VersusWaiter | null {
  const ready = waiters
    .filter((w) => w.kind === 'quick' && w.identity !== myHex && listingFreshness(w.heartbeatMs, nowMs) === 'fresh')
    .filter((w) => !myHeartbeatMs || w.heartbeatMs < myHeartbeatMs)
    .sort((a, b) => a.heartbeatMs - b.heartbeatMs);
  return ready[0] || null;
}

export function pairQuickWaiters(waiters: VersusWaiter[], nowMs = Date.now()): { host: VersusWaiter; guest: VersusWaiter } | null {
  const ready = waiters
    .filter((w) => w.kind === 'quick' && listingFreshness(w.heartbeatMs, nowMs) === 'fresh')
    .sort((a, b) => a.heartbeatMs - b.heartbeatMs);
  if (ready.length < 2) return null;
  return { host: ready[0], guest: ready[1] };
}

/** Canonical: P1 bottom (shoots up, -1), P2 top (shoots down, +1). */
export function versusAimSign(pid: number): -1 | 1 {
  return pid === 2 ? 1 : -1;
}

export function versusHomeY(pid: number, H: number, shipBottom: number): number {
  return pid === 2 ? shipBottom : H - shipBottom;
}

export function flipWorldY(y: number, H: number): number {
  return H - y;
}

export function nudgeRockVy(vy: number, shooterPid: number, impulse = VERSUS_NUDGE): number {
  return shooterPid === 2 ? Math.max(vy, 0) + impulse : Math.min(vy, 0) - impulse;
}

export function spawnSide(waveIndex: number): 1 | 2 {
  return waveIndex % 2 === 0 ? 1 : 2;
}
