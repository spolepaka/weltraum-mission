/** GDPR geo helpers. Lockstep with src/lib/geo-privacy.ts and api/geo.ts. */

/** Flip to true only if Suman later wants full IPs stored/shown. Default OFF. */
export const STORE_FULL_IP = false;

export const GEO_RETENTION_DAYS = 30;
export const GEO_RETENTION_MS = GEO_RETENTION_DAYS * 24 * 3600 * 1000;
/**
 * Same fallback as the public client /api/geo function. Geo is best-effort
 * and spoofable — do not treat this signature as a security boundary.
 */
export const GEO_SIGNING_SECRET = 'weltraum-geo-v1';

export function truncateIp(ip: string): string {
  const raw = String(ip || '').trim();
  if (!raw) return '';
  if (raw.includes(':')) {
    const parts = raw.split(':').filter(Boolean);
    return `${parts.slice(0, 4).join(':')}::`;
  }
  const p = raw.split('.');
  if (p.length === 4) return `${p[0]}.${p[1]}.${p[2]}.0`;
  return '';
}

export function keyedSig(parts: string[], secret = GEO_SIGNING_SECRET): string {
  const body = `${secret}|${parts.join('|')}`;
  let h = 2166136261;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function signGeo(payload: { country: string; region: string; city: string; ipTrunc: string; iat: number }): string {
  return keyedSig([payload.country, payload.region, payload.city, payload.ipTrunc, String(payload.iat)]);
}

export function verifyGeo(payload: { country: string; region: string; city: string; ipTrunc: string; iat: number; sig: string }, nowMs = Date.now(), maxAgeMs = 15 * 60 * 1000): boolean {
  if (!payload.sig || !payload.iat) return false;
  if (Math.abs(nowMs - payload.iat) > maxAgeMs) return false;
  return payload.sig === signGeo(payload);
}

export function isEmptyGuestRow(row: {
  email?: string;
  username?: string;
  coins?: bigint | number;
  unlocked?: number;
  extraShips?: number;
  banned?: boolean;
  testBot?: boolean;
  starCount?: number;
}): boolean {
  if (row.email || row.username || row.banned || row.testBot) return false;
  const coins = typeof row.coins === 'bigint' ? Number(row.coins) : Number(row.coins || 0);
  if (coins > 0) return false;
  if ((row.unlocked || 1) > 1) return false;
  if ((row.extraShips || 0) > 0) return false;
  if ((row.starCount || 0) > 0) return false;
  return true;
}
