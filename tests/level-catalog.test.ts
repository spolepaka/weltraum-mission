import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUNDLED_LEVELS, buildLevelPayload, allRemoteLevelPayloads } from '../src/lib/level-catalog';
import { ensureLevel, parseLevelPayload, prefetchUnlocked, resetLevelRuntimeForTests, setLevelFetcher } from '../src/lib/level-runtime';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('level catalog', () => {
  it('keeps 1–3 bundled and 4–250 remote', () => {
    expect(BUNDLED_LEVELS).toBe(3);
    expect(allRemoteLevelPayloads()).toHaveLength(247);
    expect(allRemoteLevelPayloads()[0].level).toBe(4);
    expect(allRemoteLevelPayloads().at(-1)?.level).toBe(250);
    expect(buildLevelPayload(100).featCopy?.title).toMatch(/Emperor|Kaiser|FINALE/i);
    expect(buildLevelPayload(250).featCopy?.title).toMatch(/Kaiser/i);
    expect(buildLevelPayload(250).boss).toMatchObject({ type: 'emperor', hp: 810000 });
    expect(buildLevelPayload(100).boss).toMatchObject({ type: 'emperor', hp: 9000 });
  });

  it('does not embed locked finale copy in the HTML IIFE', () => {
    const iife = HTML.split('window.__I18N_BUNDLE__')[0] || HTML;
    expect(iife).not.toContain('FINALE: Robo-Kaiser');
    expect(iife).not.toContain('7 Phasen mit allen Tricks');
    expect(iife).not.toContain('Robo-Kaiser – Finale Form');
  });

  it('merges stub server JSON with the client catalog', () => {
    const parsed = parseLevelPayload(6, JSON.stringify({ level: 6, name: 'Level 6' }));
    expect(parsed.isBoss).toBe(true);
    expect(parsed.featCopy?.title).toMatch(/Boss/i);
  });

  it('gates ensureLevel to the unlocked range and records prefetch', async () => {
    resetLevelRuntimeForTests();
    const calls: number[] = [];
    setLevelFetcher(async (level) => {
      calls.push(level);
      return { level, dataJson: JSON.stringify(buildLevelPayload(level)) };
    });
    expect(await ensureLevel(10, 3)).toBeNull();
    expect(await ensureLevel(2, 3)).toMatchObject({ level: 2 });
    const targets = prefetchUnlocked(5);
    expect(targets).toContain(4);
    expect(targets).toContain(5);
  });

  it('falls back to the local catalog when the fetcher fails for an unlocked level', async () => {
    resetLevelRuntimeForTests();
    setLevelFetcher(async () => null);
    const payload = await ensureLevel(20, 20);
    expect(payload).toMatchObject({ level: 20 });
    expect(payload?.feats).toBeTruthy();
  });
});
