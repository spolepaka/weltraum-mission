import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { coopAtkScale, coopBossHpScale, coopSpawnScale } from '../src/lib/coop-scale';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('co-op difficulty scaling', () => {
  it('scales boss HP with player count (3p ≈ 3×)', () => {
    expect(coopBossHpScale(1)).toBe(1);
    expect(coopBossHpScale(2)).toBe(2);
    expect(coopBossHpScale(3)).toBe(3);
    expect(coopBossHpScale(5)).toBe(5);
  });

  it('raises spawn and attack sub-linearly', () => {
    expect(coopSpawnScale(3)).toBeCloseTo(1.9, 5);
    expect(coopAtkScale(3)).toBeCloseTo(1.5, 5);
    expect(coopSpawnScale(3)).toBeGreaterThan(coopSpawnScale(1));
  });

  it('is wired in the game HTML (including 2-player, which used to be 1×)', () => {
    expect(html).toMatch(/function teamScale\(\)[\s\S]*return n;/);
    expect(html).toMatch(/function teamSpawn\(\)[\s\S]*0\.45/);
    expect(html).toMatch(/function teamAtk\(\)[\s\S]*0\.25/);
    expect(html).not.toMatch(/return n <= 2 \? 1/);
  });
});
