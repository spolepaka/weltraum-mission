/** Keep in lockstep with src/lib/versus.ts — spacetime module cannot import the client tree. */

export const VERSUS_PRIZE = 40;
export const VERSUS_ROUNDS_TO_WIN = 2;
export const VERSUS_QUEUE_TTL_US = 15 * 1_000_000;
export const VERSUS_ELO_START = 1000;
export const VERSUS_ELO_K = 32;
export const VERSUS_ELO_MIN = 100;
export const VERSUS_ELO_MAX = 3000;
export const VERSUS_BAND_START = 120;
export const VERSUS_BAND_PER_SEC = 12;
export const VERSUS_BAND_OPEN_US = 75 * 1_000_000;

const SHIP_POWER: Record<string, number> = {
  starter: 0, blitz: 20, komet: 30, doppel: 40, eis: 50, falke: 55, feuer: 65, stern: 75,
  titan: 90, lanze: 100, koenig: 120, nova: 140, quanten: 160, uni: 180, rochen: 190,
  phoenix: 200, hammer: 210, zwilling: 220, gravitron: 240, spektral: 250, segler: 270,
  schatten: 280, drache: 300, omega: 320, frostwal: 200, lindwurm: 220, hydra: 240,
  regenbogen: 230, kaiserbrecher: 310, beepbuggy: 40, cloudcoupe: 80, shadowspeeder: 150,
  chromewasp: 200, apexflash: 300,
};

export function utcDayKeyFromMicros(micros: bigint | number): number {
  const ms = Math.floor(Number(micros) / 1000);
  const d = new Date(ms);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/** Daily cap removed — always award the full prize. */
export function prizeToAward(_alreadyToday?: number, prize = VERSUS_PRIZE, _cap?: number): number {
  return Math.max(0, prize | 0);
}

export function clampElo(n: number): number {
  const v = Math.round(Number(n) || VERSUS_ELO_START);
  return Math.max(VERSUS_ELO_MIN, Math.min(VERSUS_ELO_MAX, v));
}

export function shipPower(shipId: string): number {
  const id = String(shipId || 'starter');
  return SHIP_POWER[id] !== undefined ? SHIP_POWER[id] : 20;
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
  const matches = Math.max(0, (opts.matches || 0) | 0);
  const rating = clampElo(opts.rating ?? VERSUS_ELO_START);
  if (matches > 0) return rating;
  return fallbackStrength(opts.unlockedLevel || 1, opts.shipId || 'starter');
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

export function matchBandUs(waitUs: number): number {
  const us = Math.max(0, waitUs || 0);
  if (us >= VERSUS_BAND_OPEN_US) return 9999;
  return Math.round(VERSUS_BAND_START + (us / 1_000_000) * VERSUS_BAND_PER_SEC);
}

export function withinBand(a: number, b: number, waitUs: number): boolean {
  return Math.abs((a || 0) - (b || 0)) <= matchBandUs(waitUs);
}

export function cleanVersusMatchId(raw: string): string {
  const text = String(raw || '').toUpperCase();
  const parts = text.split(/[:/-]/);
  const code = (parts[0] || '').replace(/O/g, '0').replace(/[^ACDEFHJKMNPRTUVWXY34679]/g, '').slice(0, 5);
  const seq = Math.max(1, Math.min(999, parseInt(parts[1] || '1', 10) || 1));
  return code.length === 5 ? `${code}:${seq}` : '';
}

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
