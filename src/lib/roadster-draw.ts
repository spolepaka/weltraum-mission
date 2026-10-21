/**
 * 2nd-gen Tesla Roadster (top-down, nose up).
 * Silhouette is traced from the official aerial: long narrow body,
 * short rounded nose, wide rear hips, teardrop canopy in the middle-rear
 * that tapers aft, long hood, short rear deck. Optional photo sprite.
 */

export interface RoadsterDrawOpts {
  paint: [string, string, string];
  edge: string;
  accent: string;
  glass: string;
  glow: string;
  badge: string;
  hw: number;
  jets: Array<[number, number, number, number]>;
  steerJets?: Array<[number, number, number, number]>;
  nozzles: number[];
  recessed?: number[];
  nozzleR: number;
  wing?: boolean;
  carbon?: boolean;
  plate?: boolean;
  aura?: [number, string, string];
  sprite?: string;
}

const ROW4 = [-7.2, -2.4, 2.4, 7.2] as const;

const VARIANTS: Record<string, RoadsterDrawOpts> = {
  beepbuggy: {
    paint: ['#d42a2f', '#a81c24', '#5c1014'],
    edge: '#3a080c',
    accent: '#ff4a3a',
    glass: '#2a2826',
    glow: '#ff4a3a',
    badge: '#1a1a1a',
    hw: 14.6,
    jets: [[-7.2, 31.4, 13, 2.2], [-2.4, 31.4, 13, 2.2], [2.4, 31.4, 13, 2.2], [7.2, 31.4, 13, 2.2]],
    steerJets: [[-15.5, 8, 7, 1.7], [15.5, 8, 7, 1.7]],
    nozzles: [...ROW4],
    nozzleR: 1.55,
    plate: true,
    sprite: 'red',
  },
  cloudcoupe: {
    paint: ['#f4f5f7', '#d8dce3', '#a8b0bc'],
    edge: '#7a8494',
    accent: '#7dffea',
    glass: '#2a2826',
    glow: '#7dffea',
    badge: '#222',
    hw: 14.8,
    jets: [[-7.2, 31.4, 15, 2.4], [-2.4, 31.4, 16, 2.5], [2.4, 31.4, 16, 2.5], [7.2, 31.4, 15, 2.4]],
    steerJets: [[-16, 6, 9, 2], [16, 6, 9, 2]],
    nozzles: [...ROW4],
    nozzleR: 1.65,
    plate: true,
    sprite: 'white',
    aura: [34, 'rgba(125,255,234,.1)', 'rgba(125,255,234,0)'],
  },
  shadowspeeder: {
    paint: ['#2a2a2e', '#121214', '#050506'],
    edge: '#c9a44a',
    accent: '#c9a44a',
    glass: '#1c1c1e',
    glow: '#c9a44a',
    badge: '#c9a44a',
    hw: 15,
    jets: [[-7.2, 31.4, 16, 2.5], [-2.4, 31.4, 17, 2.7], [2.4, 31.4, 17, 2.7], [7.2, 31.4, 16, 2.5]],
    steerJets: [[-16.5, 4, 8, 1.9], [16.5, 4, 8, 1.9]],
    nozzles: [...ROW4],
    recessed: [-5.4, -1.8, 1.8, 5.4],
    nozzleR: 1.75,
    plate: true,
    sprite: 'black',
  },
  chromewasp: {
    paint: ['#8a929c', '#4a525c', '#1c2026'],
    edge: '#9ad0ff',
    accent: '#9ad0ff',
    glass: '#1c1c1e',
    glow: '#9ad0ff',
    badge: '#e8eef5',
    hw: 15.2,
    jets: [[-7.2, 31.4, 17, 2.6], [-2.4, 31.4, 19, 2.9], [2.4, 31.4, 19, 2.9], [7.2, 31.4, 17, 2.6], [-5.4, 33.6, 12, 1.8], [-1.8, 33.6, 12, 1.8], [1.8, 33.6, 12, 1.8], [5.4, 33.6, 12, 1.8]],
    steerJets: [[-17, 2, 10, 2], [17, 2, 10, 2]],
    nozzles: [...ROW4],
    recessed: [-5.4, -1.8, 1.8, 5.4],
    nozzleR: 1.85,
    carbon: true,
    plate: true,
    sprite: 'silver',
    aura: [36, 'rgba(154,208,255,.1)', 'rgba(154,208,255,0)'],
  },
  apexflash: {
    paint: ['#f0e6c8', '#c5c0b0', '#6a6860'],
    edge: '#ffe066',
    accent: '#ffe066',
    glass: '#1c1c1e',
    glow: '#ffe066',
    badge: '#111',
    hw: 15.5,
    jets: [[-7.4, 31.4, 18, 2.8], [-2.5, 31.4, 21, 3.2], [2.5, 31.4, 21, 3.2], [7.4, 31.4, 18, 2.8], [-5.6, 33.8, 14, 2], [-1.9, 33.8, 14, 2], [1.9, 33.8, 14, 2], [5.6, 33.8, 14, 2]],
    steerJets: [[-18, 0, 11, 2.1], [18, 0, 11, 2.1], [-15, 12, 8, 1.9], [15, 12, 8, 1.9]],
    nozzles: [-7.4, -2.5, 2.5, 7.4],
    recessed: [-5.6, -1.9, 1.9, 5.6],
    nozzleR: 2,
    wing: true,
    carbon: true,
    plate: true,
    sprite: 'chrome',
    aura: [40, 'rgba(255,224,102,.12)', 'rgba(255,90,20,0)'],
  },
};

export function roadsterDrawOpts(id: string): RoadsterDrawOpts | undefined {
  return VARIANTS[id];
}

export const ROADSTER_SPRITE_PAINT: Record<string, string> = {
  beepbuggy: 'red',
  cloudcoupe: 'white',
  shadowspeeder: 'black',
  chromewasp: 'silver',
  apexflash: 'chrome',
};

type Img = { complete?: boolean; naturalWidth?: number; width?: number; height?: number };

type Ctx = {
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText?(text: string, x: number, y: number): void;
  drawImage?(img: Img, x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(o: number, c: string): void };
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): { addColorStop(o: number, c: string): void };
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  globalAlpha: number;
  shadowColor: string;
  shadowBlur: number;
  font?: string;
  textAlign?: string;
  textBaseline?: string;
};

function poly(ctx: Ctx, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function lgH(ctx: Ctx, x0: number, x1: number, cols: string[]) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
  return g;
}

function lgV(ctx: Ctx, y0: number, y1: number, cols: string[]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
  return g;
}

function flameAt(
  ctx: Ctx,
  x: number,
  y: number,
  len: number,
  w: number,
  cols: string[],
  t: number,
  seed: number,
): void {
  const fl = len + Math.sin(t * 40 + seed) * len * 0.25;
  const g = ctx.createLinearGradient(0, y, 0, y + fl * 1.2);
  g.addColorStop(0, `rgba(${cols[0]},1)`);
  g.addColorStop(0.35, `rgba(${cols[1]},.95)`);
  g.addColorStop(1, `rgba(${cols[2]},0)`);
  ctx.save();
  ctx.shadowColor = `rgb(${cols[1]})`;
  ctx.shadowBlur = 14;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w, y - 3);
  ctx.quadraticCurveTo(x, y + fl * 1.3, x + w, y - 3);
  ctx.fill();
  ctx.fillStyle = `rgba(${cols[0]},.9)`;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.4, y - 2);
  ctx.quadraticCurveTo(x, y + fl * 0.6, x + w * 0.4, y - 2);
  ctx.fill();
  ctx.restore();
}

function teslaT(ctx: Ctx, x: number, y: number, col: string): void {
  ctx.fillStyle = col;
  ctx.fillRect(x - 3.4, y, 6.8, 1.35);
  ctx.fillRect(x - 0.75, y, 1.5, 5.2);
}

/** Official aerial half-width samples, nose → rear (0…1). */
const HALF_W = [
  [0.0, 0.42],
  [0.06, 0.73],
  [0.12, 0.91],
  [0.2, 0.97],
  [0.35, 0.96],
  [0.5, 0.95],
  [0.65, 0.95],
  [0.78, 0.99],
  [0.88, 0.99],
  [0.95, 0.90],
  [1.0, 0.52],
];

function halfAt(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  for (let i = 1; i < HALF_W.length; i++) {
    if (t <= HALF_W[i][0]) {
      const a = HALF_W[i - 1], b = HALF_W[i];
      const f = (t - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * f;
    }
  }
  return HALF_W[HALF_W.length - 1][1];
}

const Y0 = -33;
const Y1 = 29;

function bodyPath(ctx: Ctx, hw: number): void {
  const steps = 18;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = hw * halfAt(u);
    const y = Y0 + (Y1 - Y0) * u;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    ctx.lineTo(-hw * halfAt(u), Y0 + (Y1 - Y0) * u);
  }
  ctx.closePath();
}

/** Teardrop glass: starts after a long hood, tapers toward the rear. */
function canopyPath(ctx: Ctx, hw: number): void {
  const yA = -12;
  const yB = 20;
  ctx.beginPath();
  ctx.moveTo(0, yA);
  ctx.quadraticCurveTo(hw * 0.58, yA + 3, hw * 0.62, yA + 10);
  ctx.quadraticCurveTo(hw * 0.55, (yA + yB) / 2, hw * 0.38, yB - 4);
  ctx.quadraticCurveTo(hw * 0.16, yB + 1, 0, yB + 1);
  ctx.quadraticCurveTo(-hw * 0.16, yB + 1, -hw * 0.38, yB - 4);
  ctx.quadraticCurveTo(-hw * 0.55, (yA + yB) / 2, -hw * 0.62, yA + 10);
  ctx.quadraticCurveTo(-hw * 0.58, yA + 3, 0, yA);
  ctx.closePath();
}

function softAura(ctx: Ctx, r: number, c1: string, c2: string): void {
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 7);
  ctx.fill();
}

function drawFallback(ctx: Ctx, o: RoadsterDrawOpts): void {
  const hw = o.hw;
  const c = o.paint;
  bodyPath(ctx, hw);
  ctx.fillStyle = lgH(ctx, -hw, hw, [c[2], c[1], c[0], c[1], c[2]]);
  ctx.fill();
  ctx.save();
  bodyPath(ctx, hw);
  const gloss = lgV(ctx, Y0, Y1, ['rgba(255,255,255,.28)', 'rgba(255,255,255,0)', 'rgba(0,0,0,.18)']);
  ctx.fillStyle = gloss;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = o.edge;
  ctx.lineWidth = 1.1;
  bodyPath(ctx, hw);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0,0,0,.12)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, Y0 + 3);
  ctx.lineTo(0, -13);
  ctx.stroke();

  canopyPath(ctx, hw);
  ctx.fillStyle = lgV(ctx, -12, 20, ['#4a4642', o.glass, '#101012']);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,80,84,.55)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.beginPath();
  ctx.ellipse(-3, -4, 2.6, 5, -0.15, 0, 7);
  ctx.fill();
}

function drawThrusters(ctx: Ctx, o: RoadsterDrawOpts, t: number, flame: string[], fx: boolean, bank: number, boosting = false): void {
  const p = 0.5 + 0.5 * Math.sin(t * 6);
  const boost = boosting ? 1.55 : 1;
  if (fx && o.aura) softAura(ctx, o.aura[0], o.aura[1], o.aura[2]);
  o.jets.forEach((e, i) => flameAt(ctx, e[0], e[1], (e[2] + p * 4) * boost, e[3] * boost, flame, t, i * 1.1));
  if (o.steerJets) {
    const leftOn = bank < -0.08 || Math.sin(t * 2.1) < -0.35;
    const rightOn = bank > 0.08 || Math.sin(t * 2.1) > 0.35;
    o.steerJets.forEach((e, i) => {
      if ((e[0] < 0 && leftOn) || (e[0] > 0 && rightOn)) {
        flameAt(ctx, e[0], e[1], e[2], e[3], flame, t, 4 + i);
      }
    });
  }
  const drawNozzle = (x: number, y: number, r: number) => {
    ctx.fillStyle = '#070708';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,214,220,.55)';
    ctx.lineWidth = 0.65;
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,220,255,.28)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, 7);
    ctx.fill();
  };
  o.nozzles.forEach((nx) => drawNozzle(nx, 31.15, o.nozzleR));
  (o.recessed || []).forEach((nx) => drawNozzle(nx, 33.55, o.nozzleR * 0.72));
  if (fx) {
    const under = boosting ? 0.55 : 0.22 + 0.08 * Math.sin(t * 9);
    [-8, 8].forEach((x, i) => {
      flameAt(ctx, x, 12 + (i ? 10 : 0), 7 + (boosting ? 5 : 0), 1.4, flame, t, 8 + i);
    });
    ctx.save();
    ctx.globalAlpha = under;
    ctx.fillStyle = 'rgba(140,210,255,.55)';
    ctx.beginPath();
    ctx.ellipse(0, 18, o.hw * 0.55, 6, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  }
}

function drawBadges(ctx: Ctx, o: RoadsterDrawOpts, onSprite: boolean): void {
  const tY = onSprite ? -27.2 : -30.4;
  teslaT(ctx, 0, tY, o.badge);
  ctx.save();
  ctx.fillStyle = '#ff1a1a';
  ctx.shadowColor = '#ff2a2a';
  ctx.shadowBlur = 8;
  ctx.fillRect(-o.hw * 0.92, onSprite ? 28.2 : 26.4, o.hw * 1.84, 1.05);
  ctx.restore();
  if (o.plate && !onSprite) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-5, 28.2, 10, 2.8);
    ctx.fillStyle = '#333';
    if (ctx.fillText) {
      ctx.font = 'bold 2.1px Trebuchet MS, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RDSTR', 0, 29.6);
    }
  }
  if (o.wing) {
    ctx.fillStyle = '#101012';
    poly(ctx, [-o.hw - 5.5, 21.6, o.hw + 5.5, 21.6, o.hw + 6.4, 24.8, -o.hw - 6.4, 24.8]);
    ctx.fill();
    ctx.fillStyle = '#c01818';
    poly(ctx, [-o.hw - 6.6, 18.2, -o.hw - 3.4, 18.2, -o.hw - 3.1, 25.2, -o.hw - 6.9, 25.2]);
    ctx.fill();
    poly(ctx, [o.hw + 3.4, 18.2, o.hw + 6.6, 18.2, o.hw + 6.9, 25.2, o.hw + 3.1, 25.2]);
    ctx.fill();
  }
}

export function drawRoadster(
  ctx: Ctx,
  id: string,
  t: number,
  flame: string[],
  fx = true,
  bank = 0,
  img?: Img | null,
  boosting = false,
  underside = false,
): void {
  const o = VARIANTS[id];
  if (!o) throw new Error(`Unknown roadster design: ${id}`);
  drawThrusters(ctx, o, t, flame, fx, bank, boosting);
  const ready = !!(img && img.complete && (img.naturalWidth || 0) > 0 && ctx.drawImage && !underside);
  if (underside) {
    const dark: RoadsterDrawOpts = { ...o, paint: ['#2a2a2e', '#121214', '#050506'], glass: '#0c0c0e' };
    drawFallback(ctx, dark);
  } else if (ready) {
    const sh = 72;
    const sw = sh * ((img!.naturalWidth || 252) / ((img as { naturalHeight?: number }).naturalHeight || 520));
    ctx.drawImage!(img!, -sw / 2, -sh / 2 - 1, sw, sh);
  } else {
    drawFallback(ctx, o);
  }
  drawBadges(ctx, o, ready);
  if (o.carbon && !ready) {
    ctx.fillStyle = 'rgba(16,16,20,.35)';
    poly(ctx, [-o.hw + 4, 10, o.hw - 4, 10, o.hw - 5, 14, -o.hw + 5, 14]);
    ctx.fill();
  }
}

export function mockCanvasCtx(): Ctx {
  const noop = (): void => undefined;
  const grad = { addColorStop: noop };
  return {
    save: noop,
    restore: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    fillText: noop,
    drawImage: noop,
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
  };
}
