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
    expect(HTML).toContain('if (prev === 15) boss.blades = null');
    expect(HTML).toContain('function roomFor(');
    expect(HTML).toContain('function shieldDroneOrb(');
    expect(HTML).toContain('function startCrownDash(');
    expect(HTML).not.toMatch(/if \(rp === 15\)\s*b\.blades = null/);
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

function fracForPhase(phase: number): number {
  if (phase <= 1) return 0.99;
  if (phase >= 20) return 0.02;
  return 1.01 - phase * 0.05;
}

function forcePhase(env: ReturnType<typeof bindKaiserHtml>, phase: number) {
  env.boss.hp = Number(env.boss.maxHp) * fracForPhase(phase);
  env.boss.phase = phase === 1 ? 1 : phase - 1;
  env.boss.laser = null;
  env.boss.fx1 = 0;
  env.boss.fx2 = 0;
  env.boss.fx3 = 0;
  env.boss.dashT = 0;
  env.boss.bombTimer = 1;
  env.primeKaiserFight(0.05);
}

describe('L250 Kaiser attack audit — dash, drones, cage, blades', () => {
  it('phase 12 shield drones spawn outside the hull, orbit, guard, die, and despawn', () => {
    const env = bindKaiserHtml(HTML, { W: 768, H: 1024 });
    env.boss.k = 1.8;
    env.boss.x = 384;
    env.boss.y = 340;
    const hull = 118 * 1.8;
    const orb = env.shieldDroneOrb(1.8);
    expect(orb).toBeGreaterThan(hull);

    env.spawnShieldDrones();
    const sd = env.drones.filter((d) => d.sdrone);
    expect(sd).toHaveLength(3);
    expect(env.primeGuarded()).toBe(true);
    for (const d of sd) {
      expect(Number(d.orb)).toBeGreaterThan(hull);
      const dist = Math.hypot(Number(d.x) - Number(env.boss.x), (Number(d.y) - Number(env.boss.y)) / 0.55);
      expect(dist).toBeGreaterThan(hull);
      expect(Math.abs(Number(d.x) - Number(env.boss.x))).toBeGreaterThan(20);
    }

    const before = sd.map((d) => ({ x: Number(d.x), y: Number(d.y), a: Number(d.a) }));
    env.updateDrones(0.4);
    const after = env.drones.filter((d) => d.sdrone);
    expect(after).toHaveLength(3);
    expect(after.some((d, i) => Math.abs(Number(d.a) - before[i].a) > 0.1)).toBe(true);
    expect(after.every((d) => Math.hypot(Number(d.x) - Number(env.boss.x), (Number(d.y) - Number(env.boss.y)) / 0.55) > hull)).toBe(true);

    after.forEach((d) => { d.dead = true; });
    expect(env.primeGuarded()).toBe(false);

    env.drones = Array.from({ length: 16 }, (_, i) => ({ missile: true, x: i * 10, y: -20, t: 0, warn: 0.2, vx: 0 }));
    env.spawnShieldDrones();
    expect(env.drones.filter((d) => d.sdrone)).toHaveLength(3);
    expect(env.drones.length).toBeLessThanOrEqual(PRIME_KAISER_CAPS.drones);
    expect(env.primeGuarded()).toBe(true);

    env.clampKaiserEntities();
    expect(env.drones.filter((d) => d.sdrone)).toHaveLength(3);

    env.endPrimePhase(12);
    expect(env.drones.some((d) => d.sdrone)).toBe(false);
    expect(env.primeGuarded()).toBe(false);
  });

  it('phase 14/19 crown dash telegraphs, travels, returns, and hits once — no teleport', () => {
    const env = bindKaiserHtml(HTML, { W: 768, H: 1024 });
    env.boss.x = 384;
    env.boss.y = 320;
    env.boss.targetY = 320;
    env.ship.x = 500;
    env.ship.y = 700;
    env.startCrownDash();
    const dash = env.boss.dash as { phase: string; t: number; x0: number; y0: number; x1: number; y1: number; warnDur: number; goDur: number; backDur: number };
    expect(dash.phase).toBe('warn');
    expect(dash.x1).not.toBe(dash.x0);
    const xStart = Number(env.boss.x);
    env.updateCrownDash(0.4);
    expect((env.boss.dash as { phase: string }).phase).toBe('warn');
    expect(Number(env.boss.x)).toBeCloseTo(xStart, 5);

    env.updateCrownDash(0.7);
    expect((env.boss.dash as { phase: string }).phase).toBe('go');
    const midX = Number(env.boss.x);
    expect(Math.abs(dash.x1 - dash.x0)).toBeGreaterThan(80);
    expect(Math.abs(midX - dash.x0)).toBeGreaterThan(8);
    expect(Math.abs(midX - dash.x1)).toBeGreaterThan(8);

    env.updateCrownDash(0.5);
    expect(['go', 'back'].includes((env.boss.dash as { phase: string }).phase)).toBe(true);

    env.updateCrownDash(1.2);
    expect(env.boss.dash).toBeNull();
    expect(Number(env.boss.x)).toBeCloseTo(dash.x0, 5);
    expect(Number(env.boss.y)).toBeCloseTo(dash.y0, 5);

    env.startCrownDash();
    const d2 = env.boss.dash as { x1: number; y1: number; warnDur: number; goDur: number };
    env.ship.x = d2.x1;
    env.ship.y = d2.y1;
    env.invuln = 0;
    env.lives = 3;
    env.damageTaken = 0;
    env.updateCrownDash(d2.warnDur + d2.goDur);
    expect(env.damageTaken).toBe(1);
    env.invuln = 0;
    env.updateCrownDash(0.15);
    expect(env.damageTaken).toBe(1);
  });

  it('phase 17 laser cage telegraphs, keeps a reachable gap, hits once, then clears', () => {
    const env = bindKaiserHtml(HTML, { W: 768, H: 1024 });
    env.ship.x = 40;
    env.ship.y = 800;
    env.startLaserCage();
    const cage0 = env.boss.cage as { phase: string; gapX: number; gapW: number; warnDur: number; fireDur: number };
    const gapW0 = cage0.gapW;
    expect(cage0.phase).toBe('warn');
    expect(gapW0).toBeGreaterThanOrEqual(150);
    const walls0 = env.cageWalls(cage0);
    expect(walls0.left).toBeGreaterThanOrEqual(0);
    expect(walls0.right).toBeLessThanOrEqual(env.W);
    expect(walls0.right - walls0.left).toBeGreaterThanOrEqual(150);
    expect(env.inCageBeam(walls0.gapX, cage0)).toBe(false);
    expect(env.inCageBeam(20, cage0)).toBe(true);

    env.invuln = 0;
    env.lives = 3;
    env.updatePrimeKaiserFx(1.0);
    expect((env.boss.cage as { phase: string }).phase).toBe('warn');
    expect(env.damageTaken).toBe(0);

    env.updatePrimeKaiserFx(1.0);
    const cage1 = env.boss.cage as { phase: string; gapW: number; gapX: number; t: number };
    expect(cage1.phase).toBe('fire');
    env.ship.x = 10;
    env.invuln = 0;
    env.updatePrimeKaiserFx(0.05);
    expect(env.damageTaken).toBe(1);
    env.invuln = 0;
    env.updatePrimeKaiserFx(0.8);
    expect(env.damageTaken).toBe(1);
    expect(cage1.gapW).toBeLessThan(gapW0);
    const walls1 = env.cageWalls(cage1);
    expect(walls1.left + 8).toBeGreaterThan(0);
    expect(walls1.right - 8).toBeLessThan(env.W);
    expect(walls1.gapW).toBeGreaterThanOrEqual(140);

    env.endPrimePhase(17);
    expect(env.boss.cage).toBeNull();
  });

  it('phase 15 blade halo is visible outside the hull, damages on contact, and only clears after the phase', () => {
    const env = bindKaiserHtml(HTML, { W: 768, H: 1024 });
    env.boss.k = 1.8;
    env.boss.x = 384;
    env.boss.y = 320;
    forcePhase(env, 15);
    expect(Number(env.boss.phase)).toBe(15);
    expect(env.boss.blades).toBeTruthy();
    const hr = env.bladeHaloR(1.8);
    expect(hr.rx).toBeGreaterThan(118 * 1.8);
    expect(hr.ry).toBeGreaterThan(70);

    const a0 = Number((env.boss.blades as { a: number }).a);
    env.updatePrimeKaiserFx(0.4);
    expect(env.boss.blades).toBeTruthy();
    expect(Number((env.boss.blades as { a: number }).a)).toBeGreaterThan(a0);
    expect(Number((env.boss.blades as { rx: number }).rx)).toBeGreaterThan(118 * 1.8);

    const blades = env.boss.blades as { a: number; n: number; rx: number; ry: number };
    env.ship.x = Number(env.boss.x) + Math.cos(blades.a) * blades.rx;
    env.ship.y = Number(env.boss.y) + Math.sin(blades.a) * blades.ry;
    env.invuln = 0;
    env.lives = 3;
    env.updatePrimeKaiserFx(0.05);
    expect(env.damageTaken).toBe(1);

    env.ship.x = Number(env.boss.x);
    env.ship.y = Number(env.boss.y) + blades.ry + 80;
    env.invuln = 0;
    const taken = env.damageTaken;
    env.updatePrimeKaiserFx(0.2);
    expect(env.damageTaken).toBe(taken);

    for (let i = 0; i < 40; i++) env.primeKaiserFight(0.05);
    expect(Number(env.boss.phase)).toBe(15);
    expect(env.boss.blades).toBeTruthy();

    env.boss.hp = Number(env.boss.maxHp) * fracForPhase(16);
    env.primeKaiserFight(0.05);
    expect(Number(env.boss.phase)).toBe(16);
    expect(env.boss.blades).toBeNull();
  });

  it('forces every phase and records a spawn, motion, or hazard signature', () => {
    const env = bindKaiserHtml(HTML, { W: 768, H: 1024 });
    const seen: Record<number, string> = {};
    for (let ph = 1; ph <= 20; ph++) {
      env.bombs = [];
      env.drones = [];
      env.mines = [];
      env.wells = [];
      env.ufos = [];
      env.grid = null;
      env.shower = null;
      env.boss.shock = null;
      env.boss.cage = null;
      env.boss.blades = null;
      env.boss.dash = null;
      env.boss.laser = null;
      forcePhase(env, ph);
      const tags = new Set<string>();
      const note = () => {
        if (env.bombs.length) tags.add('bombs');
        if (env.drones.some((d) => d.sdrone)) tags.add('sdrones');
        if (env.drones.some((d) => d.missile)) tags.add('missiles');
        if (env.drones.some((d) => d.clone)) tags.add('clones');
        if (env.mines.length) tags.add('mines');
        if (env.wells.length) tags.add('wells');
        if (env.ufos.length) tags.add('ufos');
        if (env.boss.shock) tags.add('shock');
        if (env.boss.cage) tags.add('cage');
        if (env.boss.blades) tags.add('blades');
        if (env.boss.dash) tags.add('dash');
        if (env.boss.laser) tags.add('laser');
        if (env.grid) tags.add('grid');
        if (env.shower) tags.add('shower');
      };
      note();
      for (let i = 0; i < 90; i++) {
        env.boss.bombTimer = Number(env.boss.bombTimer) - 0.05;
        env.boss.laserCd = Number(env.boss.laserCd) - 0.05;
        env.primeKaiserFight(0.05);
        env.updatePrimeKaiserFx(0.05);
        env.updateDrones(0.05);
        env.bombs.forEach((b) => {
          b.x = Number(b.x) + Number(b.vx || 0) * 0.05;
          b.y = Number(b.y) + Number(b.vy || 0) * 0.05;
        });
        note();
      }
      expect(tags.size, `phase ${ph} produced no attack`).toBeGreaterThan(0);
      seen[ph] = [...tags].join('+');
    }
    expect(seen[12]).toMatch(/sdrone/);
    expect(seen[14]).toMatch(/dash/);
    expect(seen[15]).toMatch(/blade/);
    expect(seen[17]).toMatch(/cage/);
    expect(seen[19]).toMatch(/dash|laser|missile|bomb/);
  });
});
