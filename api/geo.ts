/**
 * Edge geo for admin. Reads Vercel IP / geo headers and returns a signed
 * record. Default payload is truncated IP + country/region/city (GDPR).
 */
import { STORE_FULL_IP, signGeo, truncateIp } from '../src/lib/geo-privacy';

type VercelReq = {
  headers: Record<string, string | string[] | undefined>;
};

type VercelRes = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => VercelRes;
  json: (body: unknown) => void;
};

function header(req: VercelReq, name: string): string {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] || '') : String(v || '');
}

export default function handler(req: VercelReq, res: VercelRes): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', 'null');
  const forwarded = header(req, 'x-forwarded-for').split(',')[0].trim();
  const rawIp = forwarded || header(req, 'x-real-ip');
  const country = decodeURIComponent(header(req, 'x-vercel-ip-country') || '');
  const region = decodeURIComponent(header(req, 'x-vercel-ip-country-region') || '');
  const city = decodeURIComponent(header(req, 'x-vercel-ip-city') || '');
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
  res.status(200).json({ ...body, sig: signGeo(body) });
}
