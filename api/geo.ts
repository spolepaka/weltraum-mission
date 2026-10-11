/**
 * Vercel Node function. Self-contained on purpose: importing ../src/* fails
 * at runtime on this Vite + outputDirectory=dist project (FUNCTION_INVOCATION_FAILED).
 *
 * Geo is best-effort and spoofable. GEO_SIGNING_SECRET may be set on Vercel
 * later; leave it unset so the function stays in lockstep with the client
 * fallback. Do not treat the signature as a security boundary.
 */
const STORE_FULL_IP = false;
const FALLBACK_SECRET = 'weltraum-geo-v1';

function geoSecret(): string {
  try {
    const env = typeof process !== 'undefined' ? process.env?.GEO_SIGNING_SECRET : '';
    return env || FALLBACK_SECRET;
  } catch {
    return FALLBACK_SECRET;
  }
}

function truncateIp(ip: string): string {
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

function signGeo(payload: { country: string; region: string; city: string; ipTrunc: string; iat: number }): string {
  const secret = geoSecret();
  const body = `${secret}|${payload.country}|${payload.region}|${payload.city}|${payload.ipTrunc}|${payload.iat}`;
  let h = 2166136261;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function headerOf(headers: Record<string, string | string[] | undefined> | Headers | undefined, name: string): string {
  if (!headers) return '';
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) || (headers as Headers).get(name.toLowerCase()) || '';
  }
  const rec = headers as Record<string, string | string[] | undefined>;
  const v = rec[name] ?? rec[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] || '') : String(v || '');
}

export function geoFromHeaders(headers: Record<string, string | string[] | undefined> | Headers | undefined, remoteIp = ''): Record<string, string | number | boolean> {
  const forwarded = headerOf(headers, 'x-forwarded-for').split(',')[0].trim();
  const rawIp = forwarded || headerOf(headers, 'x-real-ip') || remoteIp;
  const country = decodeURIComponent(headerOf(headers, 'x-vercel-ip-country') || '');
  const region = decodeURIComponent(headerOf(headers, 'x-vercel-ip-country-region') || '');
  const city = decodeURIComponent(headerOf(headers, 'x-vercel-ip-city') || '');
  const ipTrunc = truncateIp(rawIp);
  const iat = Date.now();
  const body = {
    country: country.slice(0, 8),
    region: region.slice(0, 16),
    city: city.slice(0, 48),
    ipTrunc,
    iat,
    storeFullIp: STORE_FULL_IP,
    ipFull: STORE_FULL_IP ? rawIp.slice(0, 64) : '',
  };
  return { ...body, sig: signGeo(body) };
}

type NodeRes = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => NodeRes;
  json: (body: unknown) => void;
};

function jsonHeaders(): Record<string, string> {
  return { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
}

/** Node (req, res) and Web (Request → Response) so either Vercel runtime works. */
export default function handler(req: { headers?: Record<string, string | string[] | undefined> | Headers; socket?: { remoteAddress?: string } } | Request, res?: NodeRes): Response | void {
  const headers = req && 'headers' in req ? req.headers : undefined;
  const remote = req && 'socket' in req ? String(req.socket?.remoteAddress || '') : '';
  const body = geoFromHeaders(headers as never, remote);
  if (res && typeof res.status === 'function') {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(body);
    return;
  }
  return new Response(JSON.stringify(body), { status: 200, headers: jsonHeaders() });
}
