/**
 * 2nd-gen Tesla Roadster silhouettes (top-down, nose up).
 * Official aerial: long rounded-rectangle, gold-glazed canopy over most
 * of the roof, short hood, slim nose light bar, T badge, flared haunches,
 * full-width red tail bar, gold-rimmed cold-gas nozzles, tucked aero wheels.
 */

export interface RoadsterDrawOpts {
  paint: [string, string, string];
  edge: string;
  accent: string;
  glass: string;
  glow: string;
  badge: string;
  hw: number;
  canopyW: number;
  canopyH: number;
  jets: Array<[number, number, number, number]>;
  steerJets?: Array<[number, number, number, number]>;
  nozzles: number[];
  nozzleRim: string;
  wing?: boolean;
  carbon?: boolean;
  plate?: boolean;
  wheelGlowOn?: boolean;
  aura?: [number, string, string];
}

const VARIANTS: Record<string, RoadsterDrawOpts> = {
  beepbuggy: {
    paint: ['#d42a2f', '#a81c24', '#5c1014'],
    edge: '#3a080c',
    accent: '#ff4a3a',
    glass: '#c9a44a',
    glow: '#ff4a3a',
    badge: '#1a1a1a',
    hw: 15.2,
    canopyW: 12.6,
    canopyH: 19.2,
    jets: [[-5, 28, 16, 3.2], [5, 28, 16, 3.2]],
    nozzles: [-5, 5],
    nozzleRim: '#c9a44a',
    plate: true,
  },
  cloudcoupe: {
    paint: ['#f7f8fb', '#dfe3ea', '#a8b0bc'],
    edge: '#7a8494',
    accent: '#7dffea',
    glass: '#c9a44a',
    glow: '#7dffea',
    badge: '#222',
    hw: 15.5,
    canopyW: 12.8,
    canopyH: 19.4,
    jets: [[-7, 28, 17, 3.2], [0, 30, 19, 3.6], [7, 28, 17, 3.2]],
    steerJets: [[-17, 4, 10, 2.2], [17, 4, 10, 2.2]],
    nozzles: [-7, 0, 7],
    nozzleRim: '#c9a44a',
    plate: true,
    aura: [36, 'rgba(125,255,234,.12)', 'rgba(125,255,234,0)'],
  },
  shadowspeeder: {
    paint: ['#2a2a2e', '#121214', '#050506'],
    edge: '#c9a44a',
    accent: '#c9a44a',
    glass: '#b8923a',
    glow: '#c9a44a',
    badge: '#c9a44a',
    hw: 15.8,
    canopyW: 13,
    canopyH: 19.6,
    jets: [[-8.5, 28, 17, 3], [-3, 29, 18, 3.2], [3, 29, 18, 3.2], [8.5, 28, 17, 3]],
    steerJets: [[-18, 2, 9, 2], [18, 2, 9, 2]],
    nozzles: [-8.5, -3, 3, 8.5],
    nozzleRim: '#c9a44a',
    plate: true,
    wheelGlowOn: true,
  },
  chromewasp: {
    paint: ['#8a929c', '#4a525c', '#1c2026'],
    edge: '#9ad0ff',
    accent: '#9ad0ff',
    glass: '#c9a44a',
    glow: '#9ad0ff',
    badge: '#e8eef5',
    hw: 16.2,
    canopyW: 13.2,
    canopyH: 19.8,
    jets: [[-9.5, 28, 17, 3], [-3.2, 30, 19, 3.4], [3.2, 30, 19, 3.4], [9.5, 28, 17, 3]],
    steerJets: [[-19, 0, 11, 2.2], [19, 0, 11, 2.2], [-15, 12, 8, 2], [15, 12, 8, 2]],
    nozzles: [-9.5, -3.2, 3.2, 9.5],
    nozzleRim: '#e8c36a',
    carbon: true,
    plate: true,
    wheelGlowOn: true,
    aura: [40, 'rgba(154,208,255,.12)', 'rgba(154,208,255,0)'],
  },
  apexflash: {
    paint: ['#f0e6c8', '#c5c0b0', '#6a6860'],
    edge: '#ffe066',
    accent: '#ffe066',
    glass: '#d4b45a',
    glow: '#ffe066',
    badge: '#111',
    hw: 16.6,
    canopyW: 13.5,
    canopyH: 20,
    jets: [[-10.5, 28, 18, 3.2], [-4, 31, 21, 3.8], [4, 31, 21, 3.8], [10.5, 28, 18, 3.2], [0, 34, 22, 4.2]],
    steerJets: [[-20, -2, 12, 2.3], [20, -2, 12, 2.3], [-16, 10, 9, 2.1], [16, 10, 9, 2.1]],
    nozzles: [-10.5, -4, 4, 10.5],
    nozzleRim: '#ffe066',
    wing: true,
    carbon: true,
    plate: true,
    wheelGlowOn: true,
    aura: [44, 'rgba(255,224,102,.14)', 'rgba(255,90,20,0)'],
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
  fillText?(text: string, x: number, y: number): void;
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

function teslaT(ctx: Ctx, x: number, y: number, col: string): void {
  ctx.fillStyle = col;
  ctx.fillRect(x - 4, y, 8, 1.6);
  ctx.fillRect(x - 0.9, y, 1.8, 6.2);
}

/** Official 2nd-gen top view: long rounded-rectangle, wide blunt nose, flared hips. */
function bodyPath(ctx: Ctx, hw: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.quadraticCurveTo(hw * 0.84, -34.5, hw * 0.98, -27);
  ctx.quadraticCurveTo(hw + 0.15, -12, hw + 0.25, 2);
  ctx.quadraticCurveTo(hw + 1.8, 16, hw + 0.4, 25);
  ctx.lineTo(-hw - 0.4, 25);
  ctx.quadraticCurveTo(-hw - 1.8, 16, -hw - 0.25, 2);
  ctx.quadraticCurveTo(-hw - 0.15, -12, -hw * 0.98, -27);
  ctx.quadraticCurveTo(-hw * 0.84, -34.5, 0, -34);
  ctx.closePath();
}

export function drawRoadster(
  ctx: Ctx,
  id: string,
  t: number,
  flame: string[],
  fx = true,
  bank = 0,
): void {
  const o = VARIANTS[id];
  if (!o) throw new Error(`Unknown roadster design: ${id}`);
  const p = 0.5 + 0.5 * Math.sin(t * 6);
  const c = o.paint;
  const hw = o.hw;
  if (fx && o.aura) softAura(ctx, o.aura[0], o.aura[1], o.aura[2]);
  o.jets.forEach((e, i) => flameAt(ctx, e[0], e[1], e[2] + p * 4, e[3], flame, t, i * 1.1));
  if (o.steerJets) {
    const leftOn = bank < -0.08 || Math.sin(t * 2.1) < -0.35;
    const rightOn = bank > 0.08 || Math.sin(t * 2.1) > 0.35;
    o.steerJets.forEach((e, i) => {
      if ((e[0] < 0 && leftOn) || (e[0] > 0 && rightOn)) {
        flameAt(ctx, e[0], e[1], e[2], e[3], flame, t, 4 + i);
      }
    });
  }

  ctx.fillStyle = '#0a0a0c';
  poly(ctx, [-hw + 3, 20, hw - 3, 20, hw - 5, 29, -hw + 5, 29]);
  ctx.fill();

  o.nozzles.forEach((nx) => {
    ctx.fillStyle = '#141416';
    ctx.beginPath();
    ctx.arc(nx, 26.4, 2.45, 0, 7);
    ctx.fill();
    ctx.strokeStyle = o.nozzleRim;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,230,255,.45)';
    ctx.beginPath();
    ctx.arc(nx, 26.4, 1.2, 0, 7);
    ctx.fill();
  });

  const wheel = (x: number, y: number, wr: number) => {
    ctx.fillStyle = '#101012';
    ctx.beginPath();
    ctx.ellipse(x, y, wr * 0.48, wr, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,230,240,.62)';
    ctx.lineWidth = 1.15;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,210,220,.3)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x - wr * 0.22, y - wr * 0.5);
    ctx.lineTo(x + wr * 0.22, y + wr * 0.5);
    ctx.stroke();
    if (o.wheelGlowOn) glowDot(ctx, x, y, 1.2 + p * 0.45, o.glow, 8);
  };
  wheel(-hw - 1.5, -9, 5.1);
  wheel(hw + 1.5, -9, 5.1);
  wheel(-hw - 2.1, 14, 5.7);
  wheel(hw + 2.1, 14, 5.7);

  bodyPath(ctx, hw);
  ctx.fillStyle = lgH(ctx, -hw, hw, [c[2], c[1], c[0], c[1], c[2]]);
  ctx.fill();
  ctx.strokeStyle = o.edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(0, -16);
  ctx.stroke();

  ctx.fillStyle = lgV(ctx, -16, 20, ['#f3d98a', o.glass, '#7a5818']);
  ctx.beginPath();
  ctx.ellipse(0, 2.2, o.canopyW, o.canopyH, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,195,106,.85)';
  ctx.lineWidth = 1.35;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.beginPath();
  ctx.ellipse(-3.8, -4, 3.6, 6.2, -0.22, 0, 7);
  ctx.fill();

  ctx.fillStyle = '#f4f7fb';
  ctx.fillRect(-hw * 0.72, -32.6, hw * 1.44, 1.85);
  glowDot(ctx, -hw * 0.48, -31.7, 1.2 + p * 0.35, '#ffffff', 7);
  glowDot(ctx, hw * 0.48, -31.7, 1.2 + p * 0.35, '#ffffff', 7);
  teslaT(ctx, 0, -29.6, o.badge);

  ctx.save();
  ctx.fillStyle = '#ff1a1a';
  ctx.shadowColor = '#ff3a3a';
  ctx.shadowBlur = 8;
  ctx.fillRect(-hw + 1.6, 23.6, hw * 2 - 3.2, 1.75);
  ctx.restore();

  if (o.plate) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-5.4, 25.4, 10.8, 3.3);
    ctx.fillStyle = '#333';
    if (ctx.fillText) {
      ctx.font = 'bold 2.3px Trebuchet MS, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RDSTR', 0, 27.1);
    }
  }

  if (o.wing) {
    ctx.fillStyle = '#1a1a1c';
    poly(ctx, [-hw - 7, 18.4, hw + 7, 18.4, hw + 8.2, 22.2, -hw - 8.2, 22.2]);
    ctx.fill();
    ctx.strokeStyle = o.accent;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  if (o.carbon) {
    ctx.fillStyle = 'rgba(16,16,20,.42)';
    poly(ctx, [-hw + 4, 10, hw - 4, 10, hw - 5, 14.4, -hw + 5, 14.4]);
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
