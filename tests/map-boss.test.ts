import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const gameHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

function sliceFn(name: string, next: string): string {
  const start = gameHtml.indexOf(`function ${name}`);
  const end = gameHtml.indexOf(`function ${next}`, start + 1);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return gameHtml.slice(start, end);
}

describe('map boss portraits', () => {
  it('draws motherships first and never paints a styled planet over them', () => {
    const fn = sliceFn('drawLevelPlanet', 'ball');
    expect(fn).toContain('if (isBossLevel(L)) drawMothership');
    expect(fn).toMatch(/else if\s*\(\s*!isBossLevel\(L\)\s*\)/);
    expect(fn).not.toMatch(/else if\s*\(\s*true\s*\)\s*procPlanet/);
  });

  it('exposes a pixel check that bosses sit on top of their planets', () => {
    expect(gameHtml).toContain('mapBossOverPlanet');
    expect(gameHtml).toContain('closerToBoss');
  });
});
