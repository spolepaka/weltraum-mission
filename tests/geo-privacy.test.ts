import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  GEO_RETENTION_DAYS,
  STORE_FULL_IP,
  isBotUserAgent,
  signGeo,
  truncateIp,
  verifyGeo,
} from '../src/lib/geo-privacy';
import { STORE_FULL_IP as SERVER_FULL_IP, truncateIp as serverTrunc, verifyGeo as serverVerify, signGeo as serverSign } from '../server/spacetimedb/src/geo';
import handler from '../api/geo';

describe('geo privacy', () => {
  it('defaults full IP off and keeps a 30-day retention', () => {
    expect(STORE_FULL_IP).toBe(false);
    expect(SERVER_FULL_IP).toBe(false);
    expect(GEO_RETENTION_DAYS).toBe(30);
    const src = readFileSync(new URL('../src/lib/geo-privacy.ts', import.meta.url), 'utf8');
    expect(src).toContain('/** Flip to true only if Suman later wants full IPs stored/shown. Default OFF. */');
    expect(src).toContain('export const STORE_FULL_IP = false');
  });

  it('truncates IPv4 last octet and signs a short-lived record', () => {
    expect(truncateIp('203.0.113.77')).toBe('203.0.113.0');
    expect(serverTrunc('203.0.113.77')).toBe('203.0.113.0');
    const payload = { country: 'DE', region: 'BY', city: 'Munich', ipTrunc: '203.0.113.0', iat: Date.now() };
    const sig = signGeo(payload);
    expect(verifyGeo({ ...payload, sig })).toBe(true);
    expect(serverVerify({ ...payload, sig: serverSign(payload) }, Date.now())).toBe(true);
    expect(verifyGeo({ ...payload, sig, iat: Date.now() - 60 * 60 * 1000 })).toBe(false);
  });

  it('skips crawler user agents', () => {
    expect(isBotUserAgent('Slackbot-LinkExpanding 1.0')).toBe(true);
    expect(isBotUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isBotUserAgent('vercel-screenshot')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 iPad Safari')).toBe(false);
  });

  it('edge handler returns truncated IP and never a full IP by default', () => {
    const req = {
      headers: {
        'x-forwarded-for': '203.0.113.77, 10.0.0.1',
        'x-vercel-ip-country': 'DE',
        'x-vercel-ip-country-region': 'BY',
        'x-vercel-ip-city': 'Munich',
      },
    };
    let status = 0;
    let body: Record<string, unknown> = {};
    const res = {
      setHeader() {},
      status(n: number) { status = n; return res; },
      json(v: Record<string, unknown>) { body = v; },
    };
    handler(req, res);
    expect(status).toBe(200);
    expect(body.ipTrunc).toBe('203.0.113.0');
    expect(body.ipFull).toBe('');
    expect(body.country).toBe('DE');
    expect(body.storeFullIp).toBe(false);
    expect(typeof body.sig).toBe('string');
  });
});
