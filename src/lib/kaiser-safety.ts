/** Hard entity caps shared by the L250 Kaiser fight and its headless sim. */
export const PRIME_KAISER_CAPS = {
  bombs: 80,
  mines: 24,
  drones: 16,
  wells: 6,
  particles: 240,
  ufos: 12,
  rocks: 48,
  bullets: 120,
} as const;

export const KAISER_WELL_HUE = 280;

export function finiteN(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function isFinitePos(o: { x?: unknown; y?: unknown } | null | undefined): boolean {
  return !!o && Number.isFinite(Number(o.x)) && Number.isFinite(Number(o.y));
}

export function trimCap<T>(arr: T[], cap: number): T[] {
  if (arr.length > cap) arr.splice(0, arr.length - cap);
  return arr;
}

export type StrictCtxIssue = string;

export function makeStrictCtx() {
  let depth = 0;
  const issues: StrictCtxIssue[] = [];
  const noop = () => undefined;
  function checkNums(label: string, nums: number[]) {
    for (const n of nums) {
      if (!Number.isFinite(n)) issues.push(`${label}:NaN`);
    }
  }
  const ctx: Record<string, unknown> = {
    issues,
    depth: () => depth,
    save() { depth += 1; },
    restore() {
      if (depth <= 0) issues.push('restore-without-save');
      else depth -= 1;
    },
    createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
      checkNums('radial', [x0, y0, r0, x1, y1, r1]);
      if (r0 < 0 || r1 < 0) issues.push('radial:neg');
      return {
        addColorStop(_off: number, c: string) {
          if (typeof c !== 'string' || /undefined|NaN/i.test(c)) issues.push(`color:${c}`);
        },
      };
    },
    createLinearGradient() {
      return { addColorStop: noop };
    },
    arc(x: number, y: number, r: number) {
      checkNums('arc', [x, y, r]);
      if (r < 0) issues.push('arc:neg');
    },
    ellipse(x: number, y: number, rx: number, ry: number) {
      checkNums('ellipse', [x, y, rx, ry]);
      if (rx < 0 || ry < 0) issues.push('ellipse:neg');
    },
    fillRect(x: number, y: number, w: number, h: number) {
      checkNums('fillRect', [x, y, w, h]);
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      checkNums('strokeRect', [x, y, w, h]);
    },
    translate(x: number, y: number) { checkNums('translate', [x, y]); },
    scale(x: number, y: number) { checkNums('scale', [x, y]); },
    rotate(a: number) { checkNums('rotate', [a]); },
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fill: noop,
    clip: noop,
    setLineDash: noop,
    setTransform: noop,
    fillText: noop,
    strokeText: noop,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowColor: '#000',
    shadowBlur: 0,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    lineCap: 'butt',
    lineJoin: 'miter',
    lineDashOffset: 0,
  };
  return ctx as typeof ctx & { issues: StrictCtxIssue[]; depth: () => number };
}

export function extractHtmlFunction(html: string, name: string): string {
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing function ${name}`);
  const brace = html.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < html.length; i++) {
    const ch = html[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed function ${name}`);
}

const EXTRACT_FNS = [
  'finiteN',
  'safeCol',
  'primeKaiserPhase',
  'roomFor',
  'keepKaiserDrone',
  'shieldDroneOrb',
  'bladeHaloR',
  'cageWalls',
  'inCageBeam',
  'segDist',
  'primeGuarded',
  'dropPrimeBomb',
  'spawnSpiralGalaxy',
  'startShockwave',
  'startLaserCage',
  'spawnShieldDrones',
  'spawnMirrorClones',
  'seedMineField',
  'spawnDroneStorm',
  'droneStormShoot',
  'startVoidWell',
  'spawnSplitSwarm',
  'startPinwheel',
  'startAmbush',
  'rainCrownShards',
  'startEmpPulse',
  'startTractor',
  'startMeteorWall',
  'startCrownDash',
  'updateCrownDash',
  'clearPrimeHazards',
  'startPrimeDeath',
  'finishPrimeDeath',
  'updatePrimeDeath',
  'endPrimePhase',
  'primeKaiserFight',
  'updatePrimeKaiserFx',
  'updateDrones',
  'updateWells',
  'drawWell',
  'drawStormDrone',
  'drawDrone',
  'drawPrimeKaiserFx',
  'safeAtk',
  'clampKaiserEntities',
  'wrapCanvasSafety',
] as const;

export type FightReport = {
  errors: string[];
  ctxIssues: string[];
  nanHits: number;
  max: Record<string, number>;
  phasesSeen: number[];
  died: boolean;
  damageTaken: number;
  saveBalance: number;
  frames: number;
  seconds: number;
};

type FightEnv = Record<string, unknown> & {
  W: number;
  H: number;
  time: number;
  level: number;
  state: string;
  bombs: Array<Record<string, number | boolean>>;
  drones: Array<Record<string, number | boolean>>;
  mines: Array<Record<string, number>>;
  wells: Array<Record<string, number | boolean>>;
  particles: Array<Record<string, number | string | boolean>>;
  ufos: Array<Record<string, number | boolean>>;
  rocks: Array<Record<string, number | boolean>>;
  bullets: Array<Record<string, number | boolean>>;
  boss: Record<string, unknown>;
  ship: Record<string, number>;
  lives: number;
  ctx: ReturnType<typeof makeStrictCtx>;
  errors: string[];
  nanHits: number;
  damageTaken: number;
  primeKaiserFight: (dt: number) => void;
  updatePrimeKaiserFx: (dt: number) => void;
  updateDrones: (dt: number) => void;
  updateWells: (dt: number) => void;
  drawWell: (w: Record<string, unknown>) => void;
  drawPrimeKaiserFx: () => void;
  clampKaiserEntities: () => void;
  dropPrimeBomb: (...args: unknown[]) => void;
  startShockwave: () => void;
  startLaserCage: () => void;
  spawnShieldDrones: () => void;
  spawnDroneStorm: () => void;
  droneStormShoot: (d: Record<string, number | boolean>, dt: number) => void;
  startVoidWell: () => void;
  spawnSplitSwarm: () => void;
  startPinwheel: () => void;
  startAmbush: () => void;
  rainCrownShards: () => void;
  startEmpPulse: () => void;
  startTractor: () => void;
  startMeteorWall: () => void;
  startCrownDash: () => void;
  updateCrownDash: (dt: number) => void;
  clearPrimeHazards: () => void;
  startPrimeDeath: () => void;
  updatePrimeDeath: (dt: number) => boolean;
  finishPrimeDeath: () => void;
  drawStormDrone: (d: Record<string, unknown>) => void;
  drawDrone: (d: Record<string, unknown>) => void;
  endPrimePhase: (prev: number) => void;
  shieldDroneOrb: (k: number) => number;
  bladeHaloR: (k: number) => { rx: number; ry: number };
  cageWalls: (c: Record<string, unknown>) => { left: number; right: number; gapX: number; gapW: number };
  inCageBeam: (px: number, c: Record<string, unknown>) => boolean;
  primeGuarded: () => boolean;
  wrapCanvasSafety?: (c: unknown) => unknown;
};

function stubEnv(viewport: { W: number; H: number }): FightEnv {
  const ctx = makeStrictCtx();
  const env = {
    W: viewport.W,
    H: viewport.H,
    time: 0,
    level: 250,
    state: 'play',
    bombs: [] as Array<Record<string, number | boolean>>,
    drones: [] as Array<Record<string, number | boolean>>,
    mines: [] as Array<Record<string, number>>,
    wells: [] as Array<Record<string, number | boolean>>,
    particles: [] as Array<Record<string, number | string | boolean>>,
    ufos: [] as Array<Record<string, number | boolean>>,
    rocks: [] as Array<Record<string, number | boolean>>,
    bullets: [] as Array<Record<string, number | boolean>>,
    powers: [] as unknown[],
    grid: null as null | Record<string, unknown>,
    flare: null,
    shower: null as null | Record<string, unknown>,
    shake: 0,
    lives: 3,
    invuln: 0,
    damageTaken: 0,
    errors: [] as string[],
    nanHits: 0,
    ENT_CAP: { ...PRIME_KAISER_CAPS },
    PRIME_KAISER_PHASES: 30,
    PRIME_KAISER_THRESHOLDS: [0.967, 0.933, 0.9, 0.867, 0.833, 0.8, 0.767, 0.733, 0.7, 0.667, 0.633, 0.6, 0.567, 0.533, 0.5, 0.467, 0.433, 0.4, 0.367, 0.333, 0.3, 0.267, 0.233, 0.2, 0.167, 0.133, 0.1, 0.067, 0.033],
    primeFlash: 0,
    frozen: 0,
    trainOn: false,
    coinsArr: [] as unknown[],
    bossesBeaten: 0,
    FIRE: ['#ff9a2a', '#ffd54a'],
    CYAN: ['#7dffea'],
    PURPLE: ['#d08cff'],
    ctx,
    ship: { x: viewport.W / 2, y: viewport.H - 80, down: 0 },
    boss: {
      type: 'emperor', prime: true, k: 1.15, x: viewport.W / 2, y: 220, targetY: 220,
      hp: 396000, maxHp: 396000, phase: 1, bph: 1, atk: 1,
      bombTimer: 1, laserCd: 2, spreadT: 3, fx1: 2, fx2: 4, fx3: 5, dashT: 3,
      laser: null, shock: null, cage: null, blades: null, t: 0, flash: 0, vx: 40,
    },
  } as unknown as FightEnv;

  env.heat = () => 2.2;
  env.speedScale = () => 1;
  env.aimTarget = () => ({ x: env.ship.x, y: env.ship.y, pid: 1 });
  env.tr = (k: string) => k;
  env.showMsg = () => undefined;
  env.tone = () => undefined;
  env.noise = () => undefined;
  env.SFX = { boss() { return undefined; }, bigBoom() { return undefined; }, win() { return undefined; } };
  env.spawnPower = () => undefined;
  env.dropCoin = () => undefined;
  env.addScore = () => undefined;
  env.missionAdd = () => undefined;
  env.safeCol = (c: unknown, fb = '#ffd54a') => (typeof c === 'string' && c && !/NaN|undefined/i.test(c) ? c : fb);
  env.explode = (x: number, y: number, n = 8) => {
    const room = PRIME_KAISER_CAPS.particles - env.particles.length;
    for (let i = 0; i < Math.min(n, Math.max(0, room)); i++) {
      env.particles.push({ x, y, vx: i, vy: -i, life: 0.4, max: 0.4, r: 3, c: '#ffd54a' });
    }
  };
  env.spawnUfo = () => {
    if (env.ufos.length < PRIME_KAISER_CAPS.ufos) env.ufos.push({ x: 80, y: 40, r: 20, t: 0 });
  };
  env.startGrid = () => { env.grid = { phase: 'warn', t: 0, lines: [] }; };
  env.startBossLaser = () => {
    env.boss.laser = { phase: 'warn', t: 0, tx0: env.ship.x, tx1: env.ship.x + 80, warnDur: 1.5, fireDur: 1.1 };
  };
  env.eachPlayer = (fn: () => void) => { fn(); };
  env.roadsterSafe = () => false;
  env.hurt = () => {
    if (env.invuln > 0 || env.state !== 'play') return;
    env.lives -= 1;
    env.damageTaken += 1;
    env.invuln = 1.2;
    if (env.lives <= 0) env.state = 'dying';
  };
  env.rnd = (a: number, b: number) => a + (b - a) * 0.5;
  env.pick = (arr: unknown[]) => arr[0];
  env.drawMissile = () => undefined;
  env.glowDot = () => undefined;
  env.poly = (pts: number[]) => {
    const c = env.ctx as { beginPath: () => void; moveTo: (x: number, y: number) => void; lineTo: (x: number, y: number) => void; closePath: () => void };
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
  };
  env.finiteN = finiteN;
  env.hit = () => false;
  env.curStats = { hitR: 22 };
  env.curPid = 1;
  env.net = { role: null };
  env.netOnline = () => false;
  env.safeAtk = (name: string, fn: () => void) => {
    try { fn(); } catch (e) { env.errors.push(`${name}:${e instanceof Error ? e.message : String(e)}`); }
  };
  return env;
}

export function bindKaiserHtml(html: string, viewport = { W: 768, H: 1024 }): FightEnv {
  const env = stubEnv(viewport);
  const present = EXTRACT_FNS.filter((n) => html.includes(`function ${n}(`));
  const src = present.map((n) => extractHtmlFunction(html, n)).join('\n');
  const factory = new Function('env', `
    with (env) {
      ${src}
      return {
        finiteN: typeof finiteN === 'function' ? finiteN : env.finiteN,
        primeKaiserPhase: typeof primeKaiserPhase === 'function' ? primeKaiserPhase : null,
        dropPrimeBomb: typeof dropPrimeBomb === 'function' ? dropPrimeBomb : null,
        spawnSpiralGalaxy: typeof spawnSpiralGalaxy === 'function' ? spawnSpiralGalaxy : null,
        startShockwave: typeof startShockwave === 'function' ? startShockwave : null,
        startLaserCage: typeof startLaserCage === 'function' ? startLaserCage : null,
        spawnShieldDrones: typeof spawnShieldDrones === 'function' ? spawnShieldDrones : null,
        spawnMirrorClones: typeof spawnMirrorClones === 'function' ? spawnMirrorClones : null,
        seedMineField: typeof seedMineField === 'function' ? seedMineField : null,
        spawnDroneStorm: typeof spawnDroneStorm === 'function' ? spawnDroneStorm : null,
        droneStormShoot: typeof droneStormShoot === 'function' ? droneStormShoot : null,
        startVoidWell: typeof startVoidWell === 'function' ? startVoidWell : null,
        spawnSplitSwarm: typeof spawnSplitSwarm === 'function' ? spawnSplitSwarm : null,
        startPinwheel: typeof startPinwheel === 'function' ? startPinwheel : null,
        startAmbush: typeof startAmbush === 'function' ? startAmbush : null,
        rainCrownShards: typeof rainCrownShards === 'function' ? rainCrownShards : null,
        startEmpPulse: typeof startEmpPulse === 'function' ? startEmpPulse : null,
        startTractor: typeof startTractor === 'function' ? startTractor : null,
        startMeteorWall: typeof startMeteorWall === 'function' ? startMeteorWall : null,
        startCrownDash: typeof startCrownDash === 'function' ? startCrownDash : null,
        updateCrownDash: typeof updateCrownDash === 'function' ? updateCrownDash : null,
        clearPrimeHazards: typeof clearPrimeHazards === 'function' ? clearPrimeHazards : null,
        startPrimeDeath: typeof startPrimeDeath === 'function' ? startPrimeDeath : null,
        updatePrimeDeath: typeof updatePrimeDeath === 'function' ? updatePrimeDeath : null,
        finishPrimeDeath: typeof finishPrimeDeath === 'function' ? finishPrimeDeath : null,
        drawStormDrone: typeof drawStormDrone === 'function' ? drawStormDrone : null,
        drawDrone: typeof drawDrone === 'function' ? drawDrone : null,
        endPrimePhase: typeof endPrimePhase === 'function' ? endPrimePhase : null,
        shieldDroneOrb: typeof shieldDroneOrb === 'function' ? shieldDroneOrb : null,
        bladeHaloR: typeof bladeHaloR === 'function' ? bladeHaloR : null,
        cageWalls: typeof cageWalls === 'function' ? cageWalls : null,
        inCageBeam: typeof inCageBeam === 'function' ? inCageBeam : null,
        primeGuarded: typeof primeGuarded === 'function' ? primeGuarded : null,
        primeKaiserFight: typeof primeKaiserFight === 'function' ? primeKaiserFight : null,
        updatePrimeKaiserFx: typeof updatePrimeKaiserFx === 'function' ? updatePrimeKaiserFx : null,
        updateDrones: typeof updateDrones === 'function' ? updateDrones : null,
        updateWells: typeof updateWells === 'function' ? updateWells : null,
        drawWell: typeof drawWell === 'function' ? drawWell : null,
        drawPrimeKaiserFx: typeof drawPrimeKaiserFx === 'function' ? drawPrimeKaiserFx : null,
        clampKaiserEntities: typeof clampKaiserEntities === 'function' ? clampKaiserEntities : null,
        wrapCanvasSafety: typeof wrapCanvasSafety === 'function' ? wrapCanvasSafety : null,
        safeAtk: typeof safeAtk === 'function' ? safeAtk : env.safeAtk
      };
    }
  `);
  Object.assign(env, factory(env));
  if (typeof env.wrapCanvasSafety === 'function') {
    try { (env.wrapCanvasSafety as (c: unknown) => void)(env.ctx); } catch { /* mock ctx */ }
  }
  return env;
}

function countNan(env: FightEnv): number {
  let n = 0;
  const scan = (o: { x?: unknown; y?: unknown } | null | undefined) => {
    if (!o) return;
    if (!Number.isFinite(Number(o.x)) || !Number.isFinite(Number(o.y))) n += 1;
  };
  scan(env.boss);
  scan(env.ship);
  env.bombs.forEach(scan);
  env.drones.forEach(scan);
  env.mines.forEach(scan);
  env.wells.forEach(scan);
  env.particles.forEach(scan);
  env.ufos.forEach(scan);
  return n;
}

function bumpMax(max: Record<string, number>, env: FightEnv) {
  const snap = {
    bombs: env.bombs.length,
    mines: env.mines.length,
    drones: env.drones.length,
    wells: env.wells.length,
    particles: env.particles.length,
    ufos: env.ufos.length,
  };
  for (const [k, v] of Object.entries(snap)) max[k] = Math.max(max[k] || 0, v);
}

function tickFight(env: FightEnv, dt: number) {
  env.time += dt;
  env.boss.t = Number(env.boss.t || 0) + dt;
  if (env.invuln > 0) env.invuln = Math.max(0, env.invuln - dt);
  env.ship.x = env.W * (0.5 + 0.28 * Math.sin(env.time * 1.4));

  try {
    if (env.boss.dying) {
      if (typeof env.updatePrimeDeath === 'function') env.updatePrimeDeath(dt);
    } else if (env.boss.laser) {
      const L = env.boss.laser as { t: number; phase: string; warnDur: number; fireDur: number };
      L.t += dt;
      if (L.phase === 'warn' && L.t >= L.warnDur) { L.phase = 'fire'; L.t = 0; }
      else if (L.phase === 'fire' && L.t >= L.fireDur) env.boss.laser = null;
    } else {
      env.boss.bombTimer = Number(env.boss.bombTimer) - dt;
      env.boss.laserCd = Number(env.boss.laserCd) - dt;
      env.primeKaiserFight(dt * Number(env.boss.atk || 1));
    }
    if (!env.boss.dying) env.updatePrimeKaiserFx(dt);
    for (const b of env.bombs) {
      b.y = Number(b.y) + Number(b.vy || 0) * dt;
      b.x = Number(b.x) + Number(b.vx || 0) * dt;
      b.t = Number(b.t || 0) + dt;
      if (b.splitAt && !b.didSplit && Number(b.t) >= Number(b.splitAt)) {
        b.didSplit = true;
        b.dead = true;
        env.dropPrimeBomb(b.x, b.y, -70, 90);
        env.dropPrimeBomb(b.x, b.y, 0, 90);
        env.dropPrimeBomb(b.x, b.y, 70, 90);
      }
      if (env.state === 'play' && Math.abs(Number(b.x) - env.ship.x) < 18 && Math.abs(Number(b.y) - env.ship.y) < 22) {
        (env.hurt as () => void)();
        b.dead = true;
      }
    }
    env.bombs = env.bombs.filter((b) => !b.dead && Number(b.y) < env.H + 40 && Number(b.x) > -80 && Number(b.x) < env.W + 80);
    env.updateDrones(dt);
    env.updateWells(dt);
    for (const m of env.mines) m.y = Number(m.y) + Number(m.vy || 46) * dt;
    env.mines = env.mines.filter((m) => Number(m.y) < env.H + 30);
    env.particles = env.particles.filter((p) => {
      p.life = Number(p.life) - dt;
      return Number(p.life) > 0;
    });
    if (typeof env.clampKaiserEntities === 'function') env.clampKaiserEntities();
    else {
      trimCap(env.bombs, PRIME_KAISER_CAPS.bombs);
      trimCap(env.mines, PRIME_KAISER_CAPS.mines);
      trimCap(env.drones, PRIME_KAISER_CAPS.drones);
      trimCap(env.wells, PRIME_KAISER_CAPS.wells);
      trimCap(env.particles, PRIME_KAISER_CAPS.particles);
    }
  } catch (e) {
    env.errors.push(e instanceof Error ? e.message : String(e));
  }

  const d0 = env.ctx.depth();
  try {
    for (const w of env.wells) env.drawWell(w);
    env.drawPrimeKaiserFx();
    if (typeof env.drawDrone === 'function') {
      for (const d of env.drones) env.drawDrone(d);
    }
  } catch (e) {
    env.errors.push(`draw:${e instanceof Error ? e.message : String(e)}`);
  }
  if (env.ctx.depth() !== d0) env.ctx.issues.push(`save-imbalance:${env.ctx.depth() - d0}`);
  env.nanHits += countNan(env);
}

export function simulateKaiserFight(html: string, opts?: {
  viewport?: { W: number; H: number };
  fullSeconds?: number;
  phaseSeconds?: number;
  death?: boolean;
}): FightReport {
  const viewport = opts?.viewport || { W: 768, H: 1024 };
  const env = bindKaiserHtml(html, viewport);
  const max: Record<string, number> = {};
  const phases = new Set<number>();
  let frames = 0;
  const dt = 1 / 30;

  const runFor = (seconds: number) => {
    const steps = Math.ceil(seconds / dt);
    for (let i = 0; i < steps; i++) {
      tickFight(env, dt);
      frames += 1;
      phases.add(Number(env.boss.phase || 1));
      bumpMax(max, env);
    }
  };

  // Whole fight: drain HP through all 30 phases over several minutes.
  const full = opts?.fullSeconds ?? 180;
  env.boss.hp = env.boss.maxHp;
  env.boss.phase = 1;
  runFor(full * 0.05);
  for (let step = 0; step <= 30; step++) {
    env.boss.hp = Math.max(0, Number(env.boss.maxHp) * (1 - step / 30));
    runFor(full / 30);
  }

  // Force every phase on its own for a stretch, including late stacked attacks.
  const per = opts?.phaseSeconds ?? 8;
  for (let ph = 1; ph <= 30; ph++) {
    const frac = ph === 1 ? 0.99 : ph >= 30 ? 0.01 : 1.01 - ph / 30;
    env.boss.hp = Number(env.boss.maxHp) * frac;
    env.boss.phase = ph === 1 ? 1 : ph - 1;
    env.boss.laser = null;
    env.boss.dying = false;
    env.state = 'play';
    if (env.lives <= 0) env.lives = 2;
    runFor(per);
  }

  if (opts?.death !== false) {
    env.state = 'play';
    env.lives = 1;
    env.invuln = 0;
    env.boss.hp = Number(env.boss.maxHp) * 0.02;
    env.startShockwave();
    env.startLaserCage();
    (env.boss.cage as { phase: string; t: number }).phase = 'fire';
    runFor(4);
    while (env.lives > 0 && frames < 200000) {
      (env.hurt as () => void)();
      env.invuln = 0;
    }
    runFor(3);
  }

  return {
    errors: env.errors,
    ctxIssues: env.ctx.issues,
    nanHits: env.nanHits,
    max,
    phasesSeen: [...phases].sort((a, b) => a - b),
    died: env.damageTaken > 0 && (env.lives <= 0 || env.state === 'dying'),
    damageTaken: env.damageTaken,
    saveBalance: env.ctx.depth(),
    frames,
    seconds: frames * dt,
  };
}
