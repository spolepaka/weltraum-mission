/**
 * Canvas Sky Roadster silhouettes (top-down flying sports cars).
 * Used by unit tests with a mock 2d context; the live game draws the same
 * shapes from public/index.html `roadsterKit` so shop + multiplayer match.
 */

export interface RoadsterDrawOpts {
  paint: [string, string, string];
  edge: string;
  accent: string;
  glass: string;
  glow: string;
  stripe?: string;
  core?: string;
  len: number;
  wide: number;
  rear: number;
  bodyW: number;
  canopyW: number;
  canopyH: number;
  jets: Array<[number, number, number, number]>;
  pods?: number;
  canard?: boolean;
  aura?: [number, string, string];
}

const VARIANTS: Record<string, RoadsterDrawOpts> = {
  beepbuggy: {
    paint: ['#ff8a6a', '#e03a2a', '#8a1210'],
    edge: '#5a0808',
    accent: '#ffd54a',
    glass: '#3a8ad8',
    glow: '#ff7a5a',
    len: 34,
    wide: 22,
    rear: 16,
    bodyW: 11,
    canopyW: 6.5,
    canopyH: 9,
    jets: [[-7, 28, 14, 4], [7, 28, 14, 4]],
  },
  cloudcoupe: {
    paint: ['#ffffff', '#e8eef8', '#b8c4d8'],
    edge: '#6a7a98',
    accent: '#7dffea',
    glass: '#2a9ad8',
    glow: '#7dffea',
    stripe: '#7dffea',
    len: 42,
    wide: 26,
    rear: 18,
    bodyW: 12,
    canopyW: 7.5,
    canopyH: 11,
    jets: [[-10, 30, 16, 4.5], [0, 32, 18, 5], [10, 30, 16, 4.5]],
    canard: true,
    aura: [48, 'rgba(125,255,234,.18)', 'rgba(125,255,234,0)'],
  },
  shadowspeeder: {
    paint: ['#3a3a48', '#15151c', '#050508'],
    edge: '#ff4a6a',
    accent: '#ff4a6a',
    glass: '#4a1020',
    glow: '#ff4a6a',
    stripe: '#ff2a4a',
    len: 44,
    wide: 28,
    rear: 20,
    bodyW: 11,
    canopyW: 6.5,
    canopyH: 10,
    jets: [[-12, 30, 15, 3.5], [-4, 32, 17, 3.8], [4, 32, 17, 3.8], [12, 30, 15, 3.5]],
    pods: 20,
  },
  chromewasp: {
    paint: ['#f4f7ff', '#c8d2e4', '#7a8498'],
    edge: '#ffe066',
    accent: '#ffe066',
    glass: '#1a6aaa',
    glow: '#ffe066',
    core: '#ffe066',
    len: 46,
    wide: 30,
    rear: 22,
    bodyW: 10,
    canopyW: 7,
    canopyH: 12,
    jets: [[-14, 28, 14, 3.5], [-6, 32, 18, 4.5], [6, 32, 18, 4.5], [14, 28, 14, 3.5]],
    canard: true,
    aura: [52, 'rgba(255,224,102,.16)', 'rgba(255,224,102,0)'],
  },
  apexflash: {
    paint: ['#ff6a4a', '#c82018', '#4a0808'],
    edge: '#ffd54a',
    accent: '#ffd54a',
    glass: '#1a4a8a',
    glow: '#ffd54a',
    stripe: '#ffd54a',
    core: '#ffffff',
    len: 48,
    wide: 32,
    rear: 24,
    bodyW: 13,
    canopyW: 8,
    canopyH: 13,
    jets: [[-14, 30, 16, 4], [-6, 33, 20, 5], [6, 33, 20, 5], [14, 30, 16, 4], [0, 36, 22, 6]],
    pods: 22,
    canard: true,
    aura: [62, 'rgba(255,213,74,.22)', 'rgba(255,90,20,0)'],
  },
};

export function roadsterDrawOpts(id: string): RoadsterDrawOpts | undefined {
  return VARIANTS[id];
}

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
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(o: number, c: string): void };
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): { addColorStop(o: number, c: string): void };
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  globalAlpha: number;
  shadowColor: string;
  shadowBlur: number;
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

function glowDot(ctx: Ctx, x: number, y: number, r: number, col: string, blur: number): void {
  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur = blur;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.restore();
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

/**
 * Draw one Sky Roadster at the origin. `flame` is "r,g,b" triples like the game.
 * Throws if the id is unknown so tests catch missing designs.
 */
export function drawRoadster(
  ctx: Ctx,
  id: string,
  t: number,
  flame: string[],
  fx = true,
): void {
  const o = VARIANTS[id];
  if (!o) throw new Error(`Unknown roadster design: ${id}`);
  const p = 0.5 + 0.5 * Math.sin(t * 5);
  const c = o.paint;
  if (fx && o.aura) softAura(ctx, o.aura[0], o.aura[1], o.aura[2]);
  o.jets.forEach((e, i) => flameAt(ctx, e[0], e[1], e[2] + p * 3, e[3], flame, t, i * 1.2));

  ctx.fillStyle = '#1a1a22';
  poly(ctx, [-o.rear, 18, o.rear, 18, o.rear - 4, 28, -o.rear + 4, 28]);
  ctx.fill();

  const drawSide = (s: number) => {
    ctx.fillStyle = lgH(ctx, s * 6, s * o.wide, [c[2], c[1], c[0]]);
    ctx.strokeStyle = o.edge;
    ctx.lineWidth = 1.6;
    poly(ctx, [s * 8, -6, s * o.wide, 4, s * o.wide, 20, s * (o.wide - 6), 26, s * 10, 22]);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = o.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 10, 2);
    ctx.lineTo(s * (o.wide - 5), 12);
    ctx.stroke();
    glowDot(ctx, s * (o.wide - 3), 8, 2.2 + p * 0.8, o.glow, 10);
    if (o.canard) {
      ctx.fillStyle = c[1];
      poly(ctx, [s * 6, -16, s * 18, -22, s * 16, -14, s * 6, -10]);
      ctx.fill();
    }
    if (o.pods) {
      ctx.fillStyle = '#2a2f45';
      ctx.fillRect(s * o.pods - 2.2, -12, 4.4, 18);
      ctx.fillStyle = o.accent;
      ctx.fillRect(s * o.pods - 1.4, -16, 2.8, 5);
      glowDot(ctx, s * o.pods, -16, 1.8 + p, o.glow, 8);
    }
  };
  drawSide(-1);
  drawSide(1);

  const L = o.len;
  const bw = o.bodyW;
  ctx.beginPath();
  ctx.moveTo(0, -L);
  ctx.quadraticCurveTo(bw * 0.55, -L * 0.75, bw * 0.85, -L * 0.35);
  ctx.lineTo(bw, 8);
  ctx.quadraticCurveTo(bw + 2, 20, bw - 3, 24);
  ctx.lineTo(-(bw - 3), 24);
  ctx.quadraticCurveTo(-(bw + 2), 20, -bw, 8);
  ctx.lineTo(-bw * 0.85, -L * 0.35);
  ctx.quadraticCurveTo(-bw * 0.55, -L * 0.75, 0, -L);
  ctx.closePath();
  ctx.fillStyle = lgH(ctx, -bw, bw, [c[2], c[0], c[1], c[0], c[2]]);
  ctx.fill();
  ctx.strokeStyle = o.edge;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (o.stripe) {
    ctx.fillStyle = o.stripe;
    ctx.globalAlpha = 0.85;
    poly(ctx, [-2.2, -L + 4, 2.2, -L + 4, 3, 18, -3, 18]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = lgV(ctx, -L * 0.42, -L * 0.08, ['rgba(230,250,255,.95)', o.glass]);
  ctx.beginPath();
  ctx.ellipse(0, -L * 0.22, o.canopyW, o.canopyH, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath();
  ctx.ellipse(-2, -L * 0.28, 2.2, 3.5, -0.3, 0, 7);
  ctx.fill();

  glowDot(ctx, -5, -L + 6, 1.6 + p * 0.5, '#fff6c8', 8);
  glowDot(ctx, 5, -L + 6, 1.6 + p * 0.5, '#fff6c8', 8);
  if (o.core) glowDot(ctx, 0, 10, 3 + p * 2, o.core, 12);
}

export function mockCanvasCtx(): Ctx {
  const noop = (): void => undefined;
  const grad = { addColorStop: noop };
  const ctx = {
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
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    fillStyle: '#000' as unknown,
    strokeStyle: '#000' as unknown,
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
  };
  return ctx;
}
