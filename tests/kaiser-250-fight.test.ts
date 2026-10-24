import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  KAISER_WELL_HUE,
  PRIME_KAISER_CAPS,
  bindKaiserHtml,
  extractHtmlFunction,
  makeStrictCtx,
  simulateKaiserFight,
} from '../src/lib/kaiser-safety';
import { PRIME_KAISER_PHASES, primeKaiserPhase } from '../src/lib/boss-catalog';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('L250 Kaiser freeze safety', () => {
  it('pins hard entity caps, canvas wrap, and isolated boss updates in the live game', () => {
    expect(HTML).toContain('var ENT_CAP = { bombs: 80, mines: 24, drones: 16, wells: 6, particles: 240, ufos: 12, rocks: 48, bullets: 120 }');
    expect(HTML).toContain('function safeAtk(');
    expect(HTML).toContain('function clampKaiserEntities(');
    expect(HTML).toContain('function wrapCanvasSafety(');
    expect(HTML).toContain('hue: 280');
    expect(HTML).toContain('var hue = (typeof w.hue === "number" && isFinite(w.hue)) ? w.hue : 280');
    expect(HTML).toContain('wrapCanvasSafety(ctx)');
    expect(HTML).toContain('requestAnimationFrame(loop)');
    expect(HTML).toMatch(/function loop\(now\) \{[\s\S]*try \{[\s\S]*requestAnimationFrame\(loop\)/);
    expect(HTML).toContain('safeAtk("bossAttack"');
    expect(HTML).toContain('safeAtk("drawBoss"');
    expect(HTML).toContain('if (b.phase === 15) b.blades = null');
    expect(HTML).toContain('if (bombs.length >= ENT_CAP.bombs) return');
    expect(HTML.indexOf('function loop(now)')).toBeLessThan(HTML.lastIndexOf('requestAnimationFrame(loop)'));
  });

  it('does not re-split child bombs and keeps gravity-well hue finite', () => {
    const split = HTML.slice(HTML.indexOf('if (b.splitAt && !b.didSplit'), HTML.indexOf('if (b.splitAt && !b.didSplit') + 280);
    expect(split).toContain('dropPrimeBomb(b.x, b.y, sd * 70, 90)');
    expect(split).not.toMatch(/dropPrimeBomb\([^)]*splitAt/);
    expect(HTML).toContain('wells.push({ mini: false,');
    expect(HTML).toMatch(/wells\.push\(\{ mini: false,[\s\S]*hue: 280/);
  });

  it('extracted drawWell stays balanced and accepts a missing hue (Safari freeze)', () => {
    const env = bindKaiserHtml(HTML, { W: 768, H: 1024 });
    const well = { mini: false, x: 400, y: 300, r: 22, vx: 0, vy: 10, t: 1.2, warn: 0, side: 0 };
    const d0 = env.ctx.depth();
    env.drawWell(well);
    expect(env.ctx.depth()).toBe(d0);
    expect(env.ctx.issues.filter((i) => i.startsWith('color:') || i.startsWith('radial') || i.startsWith('arc'))).toEqual([]);
    env.drawWell({ ...well, hue: KAISER_WELL_HUE, warn: 0.4, side: -1 });
    expect(env.ctx.depth()).toBe(d0);
  });

  it('simulates the whole L250 fight through all 20 phases, damage, death, and forced phases', () => {
    expect(PRIME_KAISER_PHASES).toBe(20);
    expect(primeKaiserPhase(0.05)).toBe(20);
    const report = simulateKaiserFight(HTML, {
      viewport: { W: 768, H: 1024 },
      fullSeconds: 180,
      phaseSeconds: 8,
      death: true,
    });
    expect(report.seconds).toBeGreaterThan(300);
    expect(report.phasesSeen).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(report.errors).toEqual([]);
    expect(report.ctxIssues).toEqual([]);
    expect(report.nanHits).toBe(0);
    expect(report.saveBalance).toBe(0);
    expect(report.died).toBe(true);
    expect(report.damageTaken).toBeGreaterThan(0);
    expect(report.max.bombs).toBeLessThanOrEqual(PRIME_KAISER_CAPS.bombs);
    expect(report.max.mines).toBeLessThanOrEqual(PRIME_KAISER_CAPS.mines);
    expect(report.max.drones).toBeLessThanOrEqual(PRIME_KAISER_CAPS.drones);
    expect(report.max.wells).toBeLessThanOrEqual(PRIME_KAISER_CAPS.wells);
    expect(report.max.particles).toBeLessThanOrEqual(PRIME_KAISER_CAPS.particles);
    expect(report.max.ufos).toBeLessThanOrEqual(PRIME_KAISER_CAPS.ufos);
  });

  it('also holds on an iPad landscape canvas and after wrapCanvasSafety sanitizes bad radii', () => {
    const report = simulateKaiserFight(HTML, {
      viewport: { W: 1024, H: 768 },
      fullSeconds: 40,
      phaseSeconds: 2,
      death: true,
    });
    expect(report.errors).toEqual([]);
    expect(report.nanHits).toBe(0);
    expect(report.phasesSeen.length).toBe(20);

    const ctx = makeStrictCtx();
    const env = bindKaiserHtml(HTML);
    if (typeof env.wrapCanvasSafety === 'function') env.wrapCanvasSafety(ctx);
    const g = (ctx as { createRadialGradient: (...a: number[]) => { addColorStop: (o: number, c: string) => void } })
      .createRadialGradient(NaN, 0, -4, 10, 10, 8);
    expect(g).toBeTruthy();
    expect(extractHtmlFunction(HTML, 'wrapCanvasSafety')).toContain('r0 < 0');
  });
});
