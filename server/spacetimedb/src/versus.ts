/** Keep in lockstep with src/lib/versus.ts — spacetime module cannot import the client tree. */

export const VERSUS_PRIZE = 40;
export const VERSUS_DAILY_CAP = 160;
export const VERSUS_ROUNDS_TO_WIN = 2;
export const VERSUS_QUEUE_TTL_US = 15 * 1_000_000;

export function utcDayKeyFromMicros(micros: bigint | number): number {
  const ms = Math.floor(Number(micros) / 1000);
  const d = new Date(ms);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export function prizeToAward(alreadyToday: number, prize = VERSUS_PRIZE, cap = VERSUS_DAILY_CAP): number {
  const left = Math.max(0, cap - Math.max(0, alreadyToday | 0));
  return Math.max(0, Math.min(prize, left));
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
