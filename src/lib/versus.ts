/**
 * 1 vs 1 versus: pairing, fair loadout, mirrored arena, prize, Elo.
 * Server copy: server/spacetimedb/src/versus.ts (lockstep for shared helpers).
 */

export const VERSUS_HEARTS = 4;
export const VERSUS_ROUNDS_TO_WIN = 2;
export const VERSUS_PRIZE = 40;
export const VERSUS_MAX_PLAYERS = 2;
export const VERSUS_NUDGE = 220;
export const VERSUS_SHOT_SPEED = 650;
export const VERSUS_QUEUE_TTL_MS = 15_000;
export const VERSUS_QUEUE_STALE_MS = 8_000;
export const VERSUS_QUEUE_HEARTBEAT_MS = 4_000;
export const VERSUS_ELO_START = 1000;
export const VERSUS_ELO_K = 32;
export const VERSUS_ELO_MIN = 100;
export const VERSUS_ELO_MAX = 3000;
export const VERSUS_BAND_START = 120;
export const VERSUS_BAND_PER_SEC = 12;
export const VERSUS_BAND_OPEN_MS = 75_000;

export type VersusKind = 'quick' | 'challenge';

export interface VersusWaiter {
  identity: string;
  name: string;
  ship: string;
  kind: VersusKind;
  code: string;
  heartbeatMs: number;
  rating?: number;
  strength?: number;
  queuedAtMs?: number;
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

const SHIP_POWER: Record<string, number> = {
  starter: 0,
  blitz: 20,
  komet: 30,
  doppel: 40,
  eis: 50,
  falke: 55,
  feuer: 65,
  stern: 75,
  titan: 90,
  lanze: 100,
  koenig: 120,
  nova: 140,
  quanten: 160,
  uni: 180,
  rochen: 190,
  phoenix: 200,
  hammer: 210,
  zwilling: 220,
  gravitron: 240,
  spektral: 250,
  segler: 270,
  schatten: 280,
  drache: 300,
  omega: 320,
  frostwal: 200,
  lindwurm: 220,
  hydra: 240,
  regenbogen: 230,
  kaiserbrecher: 310,
  beepbuggy: 40,
  cloudcoupe: 80,
  shadowspeeder: 150,
  chromewasp: 200,
  apexflash: 300,
};

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

/** Always the full prize. Daily cap removed so matches can be played back-to-back. */
export function prizeToAward(_alreadyToday?: number, prize = VERSUS_PRIZE, _cap?: number): number {
  return Math.max(0, prize | 0);
}

export function shipPower(shipId: string): number {
  const id = String(shipId || 'starter');
  if (SHIP_POWER[id] !== undefined) return SHIP_POWER[id];
  return 20;
}

export function fallbackStrength(unlockedLevel: number, shipId: string): number {
  const lvl = Math.max(1, Math.min(100, Math.floor(unlockedLevel) || 1));
  return clampElo(VERSUS_ELO_START + (lvl - 1) * 30 + shipPower(shipId));
}

export function effectiveStrength(opts: {
  rating?: number;
  matches?: number;
  unlockedLevel?: number;
  shipId?: string;
}): number {
  const matches = Math.max(0, opts.matches | 0);
  const rating = clampElo(opts.rating ?? VERSUS_ELO_START);
  if (matches > 0) return rating;
  return fallbackStrength(opts.unlockedLevel || 1, opts.shipId || 'starter');
}

export function clampElo(n: number): number {
  const v = Math.round(Number(n) || VERSUS_ELO_START);
  return Math.max(VERSUS_ELO_MIN, Math.min(VERSUS_ELO_MAX, v));
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function eloUpdate(ratingA: number, ratingB: number, aWon: boolean, k = VERSUS_ELO_K): { a: number; b: number } {
  const ea = expectedScore(ratingA, ratingB);
  const sa = aWon ? 1 : 0;
  return {
    a: clampElo(ratingA + k * (sa - ea)),
    b: clampElo(ratingB + k * ((1 - sa) - (1 - ea))),
  };
}

/** Widen the allowed rating gap the longer someone has been waiting. */
export function matchBand(waitMs: number): number {
  const ms = Math.max(0, waitMs || 0);
  if (ms >= VERSUS_BAND_OPEN_MS) return 9999;
  return Math.round(VERSUS_BAND_START + (ms / 1000) * VERSUS_BAND_PER_SEC);
}

export function withinBand(a: number, b: number, waitMs: number): boolean {
  return Math.abs((a || 0) - (b || 0)) <= matchBand(waitMs);
}

export function waiterWaitMs(w: Pick<VersusWaiter, 'queuedAtMs' | 'heartbeatMs'>, nowMs: number): number {
  const start = w.queuedAtMs && w.queuedAtMs > 0 ? w.queuedAtMs : w.heartbeatMs;
  if (!start || start > nowMs) return 0;
  return nowMs - start;
}

export function pairWaitMs(a: VersusWaiter, b: VersusWaiter, nowMs: number): number {
  return Math.max(waiterWaitMs(a, nowMs), waiterWaitMs(b, nowMs));
}

export function canPairByStrength(a: VersusWaiter, b: VersusWaiter, nowMs: number): boolean {
  if (a.kind === 'challenge' || b.kind === 'challenge') return true;
  const sa = a.strength || a.rating || VERSUS_ELO_START;
  const sb = b.strength || b.rating || VERSUS_ELO_START;
  return withinBand(sa, sb, pairWaitMs(a, b, nowMs));
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

export function cleanVersusMatchId(raw: string): string {
  const text = String(raw || '').toUpperCase();
  const parts = text.split(/[:/-]/);
  const code = (parts[0] || '').replace(/O/g, '0').replace(/[^ACDEFHJKMNPRTUVWXY34679]/g, '').slice(0, 5);
  const seq = Math.max(1, Math.min(999, parseInt(parts[1] || '1', 10) || 1));
  return code.length === 5 ? `${code}:${seq}` : '';
}

export function nextRoundNumber(hostWins: number, guestWins: number): number {
  return Math.min(3, (hostWins | 0) + (guestWins | 0) + 1);
}

export function youThemScore(hostWins: number, guestWins: number, iAmHost: boolean): { you: number; them: number } {
  return iAmHost
    ? { you: hostWins | 0, them: guestWins | 0 }
    : { you: guestWins | 0, them: hostWins | 0 };
}

export function iWonMatch(hostWins: number, guestWins: number, iAmHost: boolean): boolean {
  return iAmHost ? (hostWins | 0) >= VERSUS_ROUNDS_TO_WIN : (guestWins | 0) >= VERSUS_ROUNDS_TO_WIN;
}

export function rematchReady(me: boolean, them: boolean): boolean {
  return !!(me && them);
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

export function pickQuickMatch(waiters: VersusWaiter[], myHex: string, nowMs = Date.now(), myHeartbeatMs?: number, myStrength?: number, myQueuedAtMs?: number): VersusWaiter | null {
  const me: VersusWaiter = {
    identity: myHex,
    name: '',
    ship: 'starter',
    kind: 'quick',
    code: '',
    heartbeatMs: myHeartbeatMs || nowMs,
    strength: myStrength,
    queuedAtMs: myQueuedAtMs,
  };
  const ready = waiters
    .filter((w) => w.kind === 'quick' && w.identity !== myHex && listingFreshness(w.heartbeatMs, nowMs) === 'fresh')
    .filter((w) => !myHeartbeatMs || w.heartbeatMs < myHeartbeatMs)
    .filter((w) => canPairByStrength(me, w, nowMs))
    .sort((a, b) => a.heartbeatMs - b.heartbeatMs);
  return ready[0] || null;
}

export function pairQuickWaiters(waiters: VersusWaiter[], nowMs = Date.now()): { host: VersusWaiter; guest: VersusWaiter } | null {
  const ready = waiters
    .filter((w) => w.kind === 'quick' && listingFreshness(w.heartbeatMs, nowMs) === 'fresh')
    .sort((a, b) => a.heartbeatMs - b.heartbeatMs);
  for (let i = 0; i < ready.length; i++) {
    for (let j = i + 1; j < ready.length; j++) {
      if (canPairByStrength(ready[i], ready[j], nowMs)) return { host: ready[i], guest: ready[j] };
    }
  }
  return null;
}

export function filterVersusByStrength<T extends { strength?: number; rating?: number; queuedAtMs?: number; heartbeatMs?: number; kind?: string }>(
  rows: T[],
  myStrength: number,
  waitMs: number,
  nowMs = Date.now(),
): T[] {
  return rows.filter((row) => {
    if (row.kind === 'challenge') return true;
    const theirs = row.strength || row.rating || VERSUS_ELO_START;
    const theirWait = row.queuedAtMs && row.queuedAtMs > 0
      ? Math.max(0, nowMs - row.queuedAtMs)
      : 0;
    return withinBand(myStrength, theirs, Math.max(waitMs || 0, theirWait));
  });
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
