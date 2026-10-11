/**
 * GDPR defaults for kid geo. Showing the full IP is one marked constant.
 * Module copy: server/spacetimedb/src/geo.ts — keep them in lockstep.
 */

/** Flip to true only if Suman later wants full IPs stored/shown. Default OFF. */
export const STORE_FULL_IP = false;

export const GEO_RETENTION_DAYS = 30;
export const GEO_RETENTION_MS = GEO_RETENTION_DAYS * 24 * 3600 * 1000;
/**
 * Fallback only. The same string is in the public repo, so a signature is
 * not a security boundary — geo is best-effort and spoofable. Optional
 * GEO_SIGNING_SECRET on Vercel must stay equal to this fallback (or the
 * client/module copies) or presence reports are dropped.
 */
export const GEO_SIGNING_SECRET =
  (typeof process !== 'undefined' && process.env?.GEO_SIGNING_SECRET) || 'weltraum-geo-v1';

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

export function keyedSig(parts: string[], secret = String(GEO_SIGNING_SECRET)): string {
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

export function verifyGeo(payload: { country: string; region: string; city: string; ipTrunc: string; iat: number; sig: string }, maxAgeMs = 15 * 60 * 1000): boolean {
  if (!payload.sig || !payload.iat) return false;
  if (Math.abs(Date.now() - payload.iat) > maxAgeMs) return false;
  return payload.sig === signGeo(payload);
}

const BOT_UA = /bot|crawl|spider|preview|slurp|facebookexternalhit|embedly|quora|pinterest|whatsapp|telegram|discord|slackbot|twitterbot|linkedinbot|skypeuripreview|vercel-screenshot|headless/i;

export function isBotUserAgent(ua: string): boolean {
  return BOT_UA.test(ua || '');
}

export function isAutomatedClient(): boolean {
  try {
    if (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver) return true;
    if (typeof navigator !== 'undefined' && isBotUserAgent(navigator.userAgent || '')) return true;
  } catch {
    // ignore
  }
  return false;
}
