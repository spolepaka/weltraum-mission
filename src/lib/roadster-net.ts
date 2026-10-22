/**
 * Roadster boost / barrel-roll over PeerJS.
 * The host simulates every ship. Guests only send a one-shot boost/flip flag.
 */

export function guestBoostFields(tapBoost: boolean, tapFlip: boolean): { b: 0 | 1; fl: 0 | 1 } {
  return { b: tapBoost ? 1 : 0, fl: tapBoost && tapFlip ? 1 : 0 };
}

export function hostBoostFromInput(m: { b?: unknown; fl?: unknown }): { once: boolean; flip: boolean } {
  const once = !!m.b;
  return { once, flip: once && !!m.fl };
}

/** Who should receive a local boost: guest's own pid, local P2, or P1. */
export function localBoostPid(opts: {
  isGuest?: boolean;
  online?: boolean;
  myPid?: number;
  p2Key?: boolean;
}): number {
  if (opts.isGuest) return Math.max(2, Math.floor(opts.myPid || 2));
  if (!opts.online && opts.p2Key) return 2;
  return 1;
}

export function bankFromMotion(dx: number, dt: number): number {
  return dx / Math.max(dt, 0.0001);
}

export function jetsFromBank(bank: number): boolean {
  return Math.abs(bank) > 18;
}

/** Keep an in-progress roll above the host's 2-decimal JSON rounding (0.001 → 0). */
export function snapRoll(rollU?: number): number {
  const u = rollU || 0;
  if (u > 0 && u < 1) return Math.max(0.02, u);
  return u;
}

/** Snapshot fields the guest needs to draw boost, roll, i-frames, and per-trim cooldown. */
export function boostSnapFields(ship: {
  boostLeft?: number;
  boostCd?: number;
  boostDur?: number;
  boostLift?: number;
  rollU?: number;
  rollTurns?: number;
  rollDur?: number;
  boostY?: number;
  bank?: number;
}): Record<string, number> {
  return {
    bo: ship.boostLeft || 0,
    cd: ship.boostCd || 0,
    bd: ship.boostDur || 0,
    lf: ship.boostLift || 0,
    rl: snapRoll(ship.rollU),
    rt: ship.rollTurns || 0,
    rd: ship.rollDur || 0,
    by: ship.boostY || 0,
    bk: ship.bank || 0,
  };
}
