/**
 * Tesla Roadster rocket boost + barrel roll.
 * Roll is eased and readable (~1 s). Boost never adds lateral drift.
 */
import { ROADSTER_IDS, type RoadsterId } from './roadsters';

export const ROADSTER_BOOST_CD: Record<RoadsterId, number> = {
  beepbuggy: 4.2,
  cloudcoupe: 3.2,
  shadowspeeder: 2.6,
  chromewasp: 2.1,
  apexflash: 1.6,
};

export const ROADSTER_BOOST_DUR: Record<RoadsterId, number> = {
  beepbuggy: 0.28,
  cloudcoupe: 0.32,
  shadowspeeder: 0.34,
  chromewasp: 0.38,
  apexflash: 0.42,
};

export const ROADSTER_ROLL_DUR = 1.0;
export const ROADSTER_ROLL_INVULN_GRACE = 0.15;
export const ROADSTER_BOOST_INVULN = 0.45;
export const ROADSTER_ROLL_INVULN = ROADSTER_ROLL_DUR + ROADSTER_ROLL_INVULN_GRACE;

const FLIP_ON_BOOST: Record<RoadsterId, boolean> = {
  beepbuggy: false,
  cloudcoupe: false,
  shadowspeeder: true,
  chromewasp: true,
  apexflash: true,
};

export function isRoadsterBoostId(id: string): id is RoadsterId {
  return (ROADSTER_IDS as readonly string[]).includes(id);
}

export function boostCooldown(id: string): number {
  return isRoadsterBoostId(id) ? ROADSTER_BOOST_CD[id] : 3.2;
}

export function boostDuration(id: string): number {
  return isRoadsterBoostId(id) ? ROADSTER_BOOST_DUR[id] : 0.3;
}

export function flipsOnBoost(id: string): boolean {
  return isRoadsterBoostId(id) ? FLIP_ON_BOOST[id] : false;
}

export function rollTurns(id: string): number {
  return id === 'apexflash' || id === 'chromewasp' ? 2 : 1;
}

export function rollDuration(_id?: string): number {
  return ROADSTER_ROLL_DUR;
}

export function boostInvuln(withRoll: boolean): number {
  return withRoll ? ROADSTER_ROLL_INVULN : ROADSTER_BOOST_INVULN;
}

export function canStartBoost(cdLeft: number): boolean {
  return cdLeft <= 0;
}

/** Smoothstep ease-in-out so the roll lingers at the start and end. */
export function rollEase(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

/** scaleX for a barrel roll. u is 0…1 (pre-ease). turns=1 is 180°, turns=2 is 360°. */
export function rollScaleX(turns: number, u: number): number {
  return Math.cos(rollEase(u) * Math.PI * Math.max(1, turns));
}

export function isUnderside(scaleX: number): boolean {
  return scaleX < 0;
}

export function isRolling(rollU: number): boolean {
  return rollU > 0 && rollU < 1;
}

/** Full i-frames while rolling, plus any leftover boost/hurt invuln. */
export function isRollInvulnerable(rollU: number, invulnLeft: number): boolean {
  return isRolling(rollU) || invulnLeft > 0;
}

export function rockCollisionDuringRoll(safe: boolean): 'pass' | 'hurt' {
  return safe ? 'pass' : 'hurt';
}

/**
 * bank > 0 = moving right → jets fire on the LEFT (pushing right).
 * bank < 0 = moving left → jets fire on the RIGHT.
 */
export function steerJetSign(bank: number): -1 | 0 | 1 {
  if (bank > 0.04) return -1;
  if (bank < -0.04) return 1;
  return 0;
}

export interface BoostStart {
  cd: number;
  dur: number;
  invuln: number;
  roll: boolean;
  turns: number;
  rollDur: number;
  vx: number;
  lift: number;
}

export function startRoadsterBoost(id: string, _steer: number, forceFlip: boolean): BoostStart {
  const roll = forceFlip || flipsOnBoost(id);
  const turns = roll ? rollTurns(id) : 0;
  const power = 1 + (isRoadsterBoostId(id) ? ROADSTER_IDS.indexOf(id) * 0.12 : 0);
  return {
    cd: boostCooldown(id),
    dur: boostDuration(id),
    invuln: boostInvuln(roll),
    roll,
    turns,
    rollDur: ROADSTER_ROLL_DUR,
    vx: 0,
    lift: 46 * power,
  };
}
