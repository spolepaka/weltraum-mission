/**
 * 1 vs 1 versus: real ships, ship-power pairing, mirrored arena, prize, Elo.
 * Server copy: server/spacetimedb/src/versus.ts (lockstep for shared helpers).
 */

import { outerCombat } from './outer-ships';
import { specialCombat } from './special-ships';

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
export const VERSUS_ELO_WEIGHT = 0.25;
export const VERSUS_UP_MAX = { heart: 1, rate: 5, dmg: 5, dur: 3, mag: 3 } as const;

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

export interface VersusShipStats {
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

export interface VersusUpgrades {
  heart: number;
  rate: number;
  dmg: number;
  dur: number;
  mag: number;
}

export type VersusFairStats = VersusShipStats;

interface ShipCombat {
  hearts: number;
  speed: number;
  rate: number;
  shots: number;
  dmg: number;
  regen: number;
  hitR?: number;
  perk?: string;
  perk2?: string;
  drones?: number;
}

const SHIP_COMBAT: Record<string, ShipCombat> = {
  starter: { hearts: 3, speed: 1, rate: 0.25, shots: 1, dmg: 1, regen: 0 },
  blitz: { hearts: 3, speed: 1.4, rate: 0.2, shots: 1, dmg: 1, regen: 0 },
  komet: { hearts: 3, speed: 1.6, rate: 0.21, shots: 1, dmg: 1.1, regen: 0, hitR: 13, perk: 'small' },
  doppel: { hearts: 3, speed: 1.1, rate: 0.32, shots: 2, dmg: 1, regen: 0 },
  eis: { hearts: 3, speed: 1.15, rate: 0.29, shots: 2, dmg: 1, regen: 0, perk: 'freeze' },
  falke: { hearts: 3, speed: 1.2, rate: 0.25, shots: 1, dmg: 2, regen: 0 },
  feuer: { hearts: 3, speed: 1.2, rate: 0.3, shots: 2, dmg: 1.2, regen: 0, perk: 'burn' },
  stern: { hearts: 3, speed: 1.1, rate: 0.25, shots: 1, dmg: 2.2, regen: 0, perk: 'blast' },
  titan: { hearts: 4, speed: 1.2, rate: 0.36, shots: 3, dmg: 1.25, regen: 20 },
  lanze: { hearts: 4, speed: 1.25, rate: 0.25, shots: 1, dmg: 3, regen: 0, perk: 'pierce' },
  koenig: { hearts: 4, speed: 1.35, rate: 0.28, shots: 2, dmg: 2, regen: 15, perk: 'homing' },
  nova: { hearts: 4, speed: 1.4, rate: 0.26, shots: 2, dmg: 2.2, regen: 0, perk: 'nova' },
  quanten: { hearts: 4, speed: 1.5, rate: 0.25, shots: 2, dmg: 2.75, regen: 18, perk: 'phase' },
  uni: { hearts: 5, speed: 1.45, rate: 0.26, shots: 2, dmg: 2.9, regen: 12, perk: 'orbit', drones: 2 },
  rochen: { hearts: 5, speed: 1.55, rate: 0.24, shots: 2, dmg: 3.2, regen: 0, perk: 'split' },
  phoenix: { hearts: 5, speed: 1.5, rate: 0.24, shots: 2, dmg: 3.4, regen: 0, perk: 'burn', perk2: 'rebirth' },
  hammer: { hearts: 5, speed: 1.4, rate: 0.45, shots: 1, dmg: 14, regen: 0, perk: 'quake' },
  zwilling: { hearts: 5, speed: 1.55, rate: 0.24, shots: 2, dmg: 3.6, regen: 0, perk: 'homing', perk2: 'wing' },
  gravitron: { hearts: 6, speed: 1.45, rate: 0.24, shots: 2, dmg: 4.2, regen: 15, perk: 'pierce', perk2: 'gravity' },
  spektral: { hearts: 6, speed: 1.65, rate: 0.2, shots: 2, dmg: 4, regen: 0, perk: 'phase', perk2: 'timeslow' },
  segler: { hearts: 6, speed: 1.5, rate: 0.1, shots: 1, dmg: 6, regen: 12, perk: 'beam' },
  schatten: { hearts: 7, speed: 1.6, rate: 0.2, shots: 2, dmg: 4.6, regen: 0, perk: 'homing', perk2: 'clone' },
  drache: { hearts: 7, speed: 1.5, rate: 0.22, shots: 3, dmg: 4.6, regen: 12, perk: 'burn', perk2: 'breath' },
  omega: { hearts: 8, speed: 1.7, rate: 0.2, shots: 3, dmg: 5.4, regen: 10, perk: 'omega', perk2: 'timeslow', drones: 2 },
  frostwal: { hearts: 6, speed: 1.3, rate: 0.26, shots: 3, dmg: 3.2, regen: 14, perk: 'freeze', perk2: 'frostaura' },
  lindwurm: { hearts: 6, speed: 1.5, rate: 0.22, shots: 2, dmg: 3.8, regen: 0, perk: 'chain' },
  hydra: { hearts: 6, speed: 1.5, rate: 0.24, shots: 5, dmg: 3.2, regen: 0, perk: 'homing' },
  regenbogen: { hearts: 5, speed: 1.75, rate: 0.22, shots: 3, dmg: 3.8, regen: 0, perk: 'prism' },
  kaiserbrecher: { hearts: 7, speed: 1.55, rate: 0.22, shots: 3, dmg: 5, regen: 10, perk: 'nova', drones: 4 },
  beepbuggy: { hearts: 3, speed: 1.25, rate: 0.23, shots: 1, dmg: 1.05, regen: 0 },
  cloudcoupe: { hearts: 3, speed: 1.55, rate: 0.2, shots: 1, dmg: 1.5, regen: 0, perk2: 'dash' },
  shadowspeeder: { hearts: 4, speed: 1.4, rate: 0.26, shots: 2, dmg: 2.6, regen: 0, perk: 'pierce' },
  chromewasp: { hearts: 5, speed: 1.5, rate: 0.22, shots: 2, dmg: 3.6, regen: 14, perk: 'homing' },
  apexflash: { hearts: 7, speed: 1.62, rate: 0.2, shots: 3, dmg: 4.8, regen: 11, perk: 'homing', perk2: 'pulse' },
  ...outerCombat(),
  ...specialCombat(),
};

export function emptyUpgrades(): VersusUpgrades {
  return { heart: 0, rate: 0, dmg: 0, dur: 0, mag: 0 };
}

export function clampUpgrades(raw?: Partial<VersusUpgrades> | null): VersusUpgrades {
  const src = raw || {};
  return {
    heart: Math.max(0, Math.min(VERSUS_UP_MAX.heart, Math.floor(Number(src.heart) || 0))),
    rate: Math.max(0, Math.min(VERSUS_UP_MAX.rate, Math.floor(Number(src.rate) || 0))),
    dmg: Math.max(0, Math.min(VERSUS_UP_MAX.dmg, Math.floor(Number(src.dmg) || 0))),
    dur: Math.max(0, Math.min(VERSUS_UP_MAX.dur, Math.floor(Number(src.dur) || 0))),
    mag: Math.max(0, Math.min(VERSUS_UP_MAX.mag, Math.floor(Number(src.mag) || 0))),
  };
}

export function packUps(raw?: Partial<VersusUpgrades> | null): string {
  const u = clampUpgrades(raw);
  return `${u.heart},${u.rate},${u.dmg},${u.dur},${u.mag}`;
}

export function unpackUps(raw?: string | Partial<VersusUpgrades> | null): VersusUpgrades {
  if (raw && typeof raw === 'object') return clampUpgrades(raw);
  const parts = String(raw || '').split(/[,\s]+/);
  return clampUpgrades({
    heart: parseInt(parts[0] || '0', 10),
    rate: parseInt(parts[1] || '0', 10),
    dmg: parseInt(parts[2] || '0', 10),
    dur: parseInt(parts[3] || '0', 10),
    mag: parseInt(parts[4] || '0', 10),
  });
}

export function shipCombat(shipId: string): ShipCombat {
  return SHIP_COMBAT[String(shipId || 'starter')] || SHIP_COMBAT.starter;
}

export function statsForShip(shipId: string, rawUps?: Partial<VersusUpgrades> | null): VersusShipStats {
  const d = shipCombat(shipId);
  const u = clampUpgrades(rawUps);
  return {
    hitR: d.hitR || 22,
    perk: d.perk || '',
    perk2: d.perk2 || '',
    drones: d.drones || (d.perk === 'orbit' ? 2 : 0),
    hearts: (d.hearts || 3) + Math.min(1, u.heart),
    speed: d.speed,
    rate: d.rate * (1 - 0.12 * Math.min(3, u.rate) - 0.06 * Math.max(0, u.rate - 3)),
    shots: d.shots,
    dmg: d.dmg * (1 + 0.25 * u.dmg),
    dur: 1 + 0.25 * u.dur,
    magR: [0, 110, 170, 240][u.mag] || 0,
    regen: d.regen,
  };
}

/** Ship combat power from catalog + owned upgrades. Main pairing factor. */
export function shipCombatPower(shipId: string, rawUps?: Partial<VersusUpgrades> | null): number {
  const st = statsForShip(shipId, rawUps);
  const fire = 1 / Math.max(0.08, st.rate);
  const perk = (st.perk ? 35 : 0) + (st.perk2 ? 25 : 0) + (st.regen > 0 ? 20 : 0) + (st.drones || 0) * 12;
  return Math.max(1, Math.round(st.hearts * 35 + st.dmg * 28 + fire * 8 + st.speed * 40 + st.shots * 22 + perk));
}

/** Pairing score: ship power is the main factor, Elo is a light nudge. */
export function pairingScore(power: number, rating: number = VERSUS_ELO_START): number {
  return Math.max(0, Math.round((power || 0) + VERSUS_ELO_WEIGHT * (clampElo(rating) - VERSUS_ELO_START)));
}

export function shipPower(shipId: string, rawUps?: Partial<VersusUpgrades> | null): number {
  return shipCombatPower(shipId, rawUps);
}

export function utcDayKey(ms: number = Date.now()): number {
  const d = new Date(ms);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/** Always the full prize. Daily cap removed so matches can be played back-to-back. */
export function prizeToAward(_alreadyToday?: number, prize = VERSUS_PRIZE, _cap?: number): number {
  return Math.max(0, prize | 0);
}

export function fallbackStrength(_unlockedLevel: number, shipId: string, rawUps?: Partial<VersusUpgrades> | null): number {
  return pairingScore(shipCombatPower(shipId || 'starter', rawUps), VERSUS_ELO_START);
}

export function effectiveStrength(opts: {
  rating?: number;
  matches?: number;
  unlockedLevel?: number;
  shipId?: string;
  upgrades?: Partial<VersusUpgrades> | null;
}): number {
  const rating = clampElo(opts.rating ?? VERSUS_ELO_START);
  return pairingScore(shipCombatPower(opts.shipId || 'starter', opts.upgrades), rating);
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

/** Host / P1 tint (own-side rocks spawn at the bottom). */
export const VERSUS_P1_COLOR = '#4ec3ff';
/** Guest / P2 tint (own-side rocks spawn at the top). */
export const VERSUS_P2_COLOR = '#ff8a40';

/**
 * Rock.side is the spawn edge: 1 = top (guest edge), 2 = bottom (host edge).
 * Incoming rocks for a player come from the other player's side.
 */
export function versusRockDamagesPid(side: number, pid: number): boolean {
  return (side === 1 && pid === 1) || (side === 2 && pid === 2);
}

/** Shots, auto-aim, and homing ignore asteroids from the shooter's own side. */
export function versusShotIgnoresRock(side: number, shooterPid: number): boolean {
  return !versusRockDamagesPid(side, shooterPid);
}

export function versusRockHue(side: number): number {
  return side === 1 ? 28 : 200;
}

export function versusRockColor(side: number): string {
  return side === 1 ? VERSUS_P2_COLOR : VERSUS_P1_COLOR;
}

/** 1v1 may use a ship if it is owned (bought or unlocked). Level gates do not apply. */
export function versusOwnsShip(owned: Iterable<string> | null | undefined, shipId: string): boolean {
  const id = String(shipId || 'starter');
  if (id === 'starter') return true;
  for (const s of owned || []) {
    if (s === id) return true;
  }
  return false;
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

/** Kid-fun 1 vs 1 extras: pickups, sudden-death, emotes, ranks. */

export const VERSUS_SUDDEN_SEC = 28;
export const VERSUS_PICKUP_FIRST = 5.5;
export const VERSUS_PICKUP_EVERY = 8;
export const VERSUS_BOMB_R = 86;
export const VERSUS_RANK_SILVER = 1050;
export const VERSUS_RANK_GOLD = 1200;
export const VERSUS_EMOTE_SEC = 2.4;

export const VERSUS_PICKUPS = ['shield', 'rapid', 'bomb'] as const;
export type VersusPickup = (typeof VERSUS_PICKUPS)[number];

export const VERSUS_EMOTES = ['wave', 'cool', 'wow', 'yay'] as const;
export type VersusEmote = (typeof VERSUS_EMOTES)[number];

export const VERSUS_EMOTE_ICON: Record<VersusEmote, string> = {
  wave: '😄',
  cool: '😎',
  wow: '😱',
  yay: '🎉',
};

export type VersusRankId = 'unranked' | 'bronze' | 'silver' | 'gold';

export type VersusFunStats = {
  hits: [number, number];
  pickups: [number, number];
  bombs: [number, number];
  timeSec: number;
};

export function emptyVersusFunStats(): VersusFunStats {
  return { hits: [0, 0], pickups: [0, 0], bombs: [0, 0], timeSec: 0 };
}

export function nextVersusPickup(seq: number): VersusPickup {
  const i = ((seq | 0) % VERSUS_PICKUPS.length + VERSUS_PICKUPS.length) % VERSUS_PICKUPS.length;
  return VERSUS_PICKUPS[i];
}

export function versusPickupType(kind: VersusPickup): string {
  return kind === 'rapid' ? 'triple' : kind;
}

export function versusPickupLaneX(seq: number, width: number): number {
  const lanes = [0.28, 0.5, 0.72];
  const w = Math.max(120, width || 400);
  return Math.round(w * lanes[((seq | 0) % lanes.length + lanes.length) % lanes.length]);
}

export function versusRank(rating: number, matches = 0): VersusRankId {
  if ((matches | 0) <= 0) return 'unranked';
  const r = clampElo(rating);
  if (r >= VERSUS_RANK_GOLD) return 'gold';
  if (r >= VERSUS_RANK_SILVER) return 'silver';
  return 'bronze';
}

/** Listed duel rows only have rating — skip unranked so kids still see a badge. */
export function versusRankFromRating(rating: number): VersusRankId {
  const r = clampElo(rating);
  if (r >= VERSUS_RANK_GOLD) return 'gold';
  if (r >= VERSUS_RANK_SILVER) return 'silver';
  return 'bronze';
}

export function versusRankIcon(rank: VersusRankId): string {
  if (rank === 'gold') return '🥇';
  if (rank === 'silver') return '🥈';
  if (rank === 'bronze') return '🥉';
  return '🤍';
}

export function isSuddenDeathRound(hostWins: number, guestWins: number): boolean {
  return (hostWins | 0) === 1 && (guestWins | 0) === 1;
}

export function suddenDeathLeft(elapsedSec: number, limit = VERSUS_SUDDEN_SEC): number {
  return Math.max(0, Math.ceil(limit - (elapsedSec || 0)));
}

export function suddenDeathTimedOut(elapsedSec: number, limit = VERSUS_SUDDEN_SEC): boolean {
  return (elapsedSec || 0) >= limit;
}

/** Death still wins first. After the timer: more hits, then more lives. Tie keeps playing. */
export function suddenDeathWinner(opts: {
  hostLives: number;
  guestLives: number;
  hostHits: number;
  guestHits: number;
  timedOut: boolean;
}): 0 | 1 | 2 {
  const live = roundWinner(opts.hostLives | 0, opts.guestLives | 0);
  if (live) return live;
  if (!opts.timedOut) return 0;
  if ((opts.hostHits | 0) !== (opts.guestHits | 0)) return (opts.hostHits | 0) > (opts.guestHits | 0) ? 1 : 2;
  if ((opts.hostLives | 0) !== (opts.guestLives | 0)) return (opts.hostLives | 0) > (opts.guestLives | 0) ? 1 : 2;
  return 0;
}

export function validVersusEmote(raw: string): VersusEmote | '' {
  return (VERSUS_EMOTES as readonly string[]).includes(String(raw || '')) ? (raw as VersusEmote) : '';
}

export function bumpFunCount(stats: VersusFunStats, key: 'hits' | 'pickups' | 'bombs', pid: number): VersusFunStats {
  const next: VersusFunStats = {
    hits: [stats.hits[0], stats.hits[1]],
    pickups: [stats.pickups[0], stats.pickups[1]],
    bombs: [stats.bombs[0], stats.bombs[1]],
    timeSec: stats.timeSec,
  };
  const slot = pid === 2 ? 1 : 0;
  next[key][slot] += 1;
  return next;
}
