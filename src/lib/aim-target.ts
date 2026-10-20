/**
 * Co-op aim: bosses and aimed enemies pick a living player, never a
 * downed / disconnected ship. Single shots go to the nearest living
 * player; multi-shot patterns rotate across the living set.
 */

export interface AimShip {
  x: number;
  y: number;
  pid: number;
  down?: number | boolean;
  left?: boolean;
  lives?: number;
}

export interface AimPoint {
  x: number;
  y: number;
  pid: number;
}

export function isLivingShip(s: AimShip | null | undefined): s is AimShip {
  if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) return false;
  if (s.left) return false;
  if (s.down && Number(s.down) > 0) return false;
  if (typeof s.lives === 'number' && s.lives <= 0) return false;
  return true;
}

export function livingPlayers(ships: Array<AimShip | null | undefined>): AimShip[] {
  return ships.filter(isLivingShip).sort((a, b) => a.pid - b.pid);
}

export function nearestLiving(ships: AimShip[], x: number, y: number): AimPoint | null {
  const live = livingPlayers(ships);
  if (!live.length) return null;
  let best = live[0];
  let bestD = Infinity;
  for (const s of live) {
    const dx = s.x - x;
    const dy = s.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return { x: best.x, y: best.y, pid: best.pid };
}

export function rotatingLiving(ships: AimShip[], index: number): AimPoint | null {
  const live = livingPlayers(ships);
  if (!live.length) return null;
  const i = ((Math.floor(index) % live.length) + live.length) % live.length;
  const s = live[i];
  return { x: s.x, y: s.y, pid: s.pid };
}

/** Assign shot `shotIndex` of a volley to a living player, cycling the roster. */
export function spreadLiving(ships: AimShip[], shotIndex: number): AimPoint | null {
  return rotatingLiving(ships, shotIndex);
}

/**
 * Default picker: a rotate index spreads a volley; otherwise nearest.
 * Falls back to the first ship (even if down) only so callers always get a point.
 */
export function pickAimTarget(
  ships: Array<AimShip | null | undefined>,
  fromX: number,
  fromY: number,
  rotateIdx?: number,
): AimPoint {
  const live = livingPlayers(ships);
  if (live.length) {
    const picked = rotateIdx !== undefined && rotateIdx !== null
      ? spreadLiving(live, rotateIdx)
      : nearestLiving(live, fromX, fromY);
    if (picked) return picked;
  }
  const fallback = ships.find((s) => s && Number.isFinite(s.x) && Number.isFinite(s.y));
  return {
    x: fallback ? fallback.x : fromX,
    y: fallback ? fallback.y : fromY,
    pid: fallback ? fallback.pid : 1,
  };
}
