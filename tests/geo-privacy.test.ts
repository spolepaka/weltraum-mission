import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
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

const GEO_FN = new URL('../api/geo.ts', import.meta.url);

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
      json(v: unknown) { body = v as Record<string, unknown>; },
    };
    handler(req, res);
    expect(status).toBe(200);
    expect(body.ipTrunc).toBe('203.0.113.0');
    expect(body.ipFull).toBe('');
    expect(body.country).toBe('DE');
    expect(body.storeFullIp).toBe(false);
    expect(typeof body.sig).toBe('string');
    expect(verifyGeo({
      country: String(body.country || ''),
      region: String(body.region || ''),
      city: String(body.city || ''),
      ipTrunc: String(body.ipTrunc || ''),
      iat: Number(body.iat),
      sig: String(body.sig),
    })).toBe(true);
  });

  it('does not import ../src (Vercel Node + outputDirectory=dist cannot bundle it)', () => {
    const src = readFileSync(GEO_FN, 'utf8');
    expect(src).not.toMatch(/from\s+['"]\.\.\/src\//);
    expect(src).not.toMatch(/require\s*\(/);
    expect(src).toMatch(/FUNCTION_INVOCATION_FAILED/);
    expect(src).toMatch(/best-effort and spoofable/);
  });

  it('built function works isolated from src/ (Node req/res and Web Request)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'geo-fn-'));
    const entry = join(dir, 'geo.ts');
    const out = join(dir, 'geo.mjs');
    writeFileSync(entry, readFileSync(GEO_FN));
    try {
      await build({
        absWorkingDir: dir,
        entryPoints: [entry],
        outfile: out,
        bundle: true,
        platform: 'node',
        format: 'esm',
        logLevel: 'silent',
      });
      const mod = await import(`${pathToFileURL(out).href}?t=${Date.now()}`) as {
        default: typeof handler;
        geoFromHeaders: (headers: Record<string, string>, remoteIp?: string) => Record<string, string | number | boolean>;
      };
      expect(typeof mod.default).toBe('function');
      expect(typeof mod.geoFromHeaders).toBe('function');

      const headers = {
        'x-forwarded-for': '198.51.100.9',
        'x-vercel-ip-country': 'US',
        'x-vercel-ip-country-region': 'CA',
        'x-vercel-ip-city': 'Oakland',
      };
      let status = 0;
      let body: Record<string, unknown> = {};
      const res = {
        setHeader() {},
        status(n: number) { status = n; return res; },
        json(v: unknown) { body = v as Record<string, unknown>; },
      };
      mod.default({ headers }, res);
      expect(status).toBe(200);
      expect(body.ipTrunc).toBe('198.51.100.0');
      expect(body.ipFull).toBe('');
      expect(body.country).toBe('US');
      expect(verifyGeo({
        country: String(body.country || ''),
        region: String(body.region || ''),
        city: String(body.city || ''),
        ipTrunc: String(body.ipTrunc || ''),
        iat: Number(body.iat),
        sig: String(body.sig),
      })).toBe(true);

      const web = mod.default(new Request('https://example.test/api/geo', { headers })) as Response;
      expect(web).toBeInstanceOf(Response);
      expect(web.status).toBe(200);
      const webBody = await web.json() as Record<string, unknown>;
      expect(webBody.ipTrunc).toBe('198.51.100.0');
      expect(webBody.storeFullIp).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
