import { describe, expect, it } from 'vitest';
import { parseStarMap, plausibleLegacyUnlock } from '../server/spacetimedb/src/legacy-import';

describe('legacy import plausibility', () => {
  it('caps a claim with no stars to server unlock + 1', () => {
    expect(plausibleLegacyUnlock(100, 1, '{}')).toBe(2);
    expect(plausibleLegacyUnlock(20, 1, '')).toBe(2);
    expect(parseStarMap('{"1":0,"2":0}')).toEqual({ highest: 0, count: 0 });
  });

  it('grants the owner-like local-ahead case from contiguous stars', () => {
    const stars: Record<string, number> = {};
    for (let i = 1; i <= 19; i++) stars[String(i)] = 2;
    expect(plausibleLegacyUnlock(20, 1, JSON.stringify(stars))).toBe(20);
  });

  it('refuses a sparse high-level star forgery', () => {
    expect(plausibleLegacyUnlock(100, 1, '{"99":3}')).toBe(2);
  });

  it('never exceeds the claimed unlock or max level', () => {
    const stars: Record<string, number> = {};
    for (let i = 1; i <= 19; i++) stars[String(i)] = 1;
    expect(plausibleLegacyUnlock(12, 1, JSON.stringify(stars))).toBe(12);
    expect(plausibleLegacyUnlock(200, 1, JSON.stringify(stars))).toBe(20);
  });
});
