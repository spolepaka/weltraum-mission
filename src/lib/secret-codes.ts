/** Shared secret-code rules. Keep in lockstep with server/spacetimedb/src/secret-codes.ts. */

export const AMELIA_STAR_CODE = 'AMELIASTAR';
export const AMELIA_STAR_SHIP = 'charongate';
export const AMELIA_STAR_KEY = 'secretAmeliaStar';

export function normalizeSecretCode(code: string): string {
  return String(code || '').toUpperCase().replace(/\s+/g, '');
}

export function isAmeliaStarCode(code: string): boolean {
  return normalizeSecretCode(code) === AMELIA_STAR_CODE;
}

export function grantAmeliaStarShip(owned: string[]): { already: boolean; owned: string[] } {
  const next = Array.isArray(owned) ? owned.slice() : [];
  if (next.includes(AMELIA_STAR_SHIP)) return { already: true, owned: next };
  next.push(AMELIA_STAR_SHIP);
  return { already: false, owned: next };
}
