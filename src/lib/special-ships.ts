/**
 * Late Special tab ships (🎁 tabSpecial, tier 4) for levels 100–250.
 * Append-only: new ids go after the existing catalog. Do not reorder.
 * Keep HTML SHIPS[] / DESIGNS / server VALID_SHIPS / versus SHIP_COMBAT in lockstep.
 */

export const SPECIAL_TAB = 4;

export type SpecialShape =
  | 'claw' | 'fang' | 'heart' | 'brand' | 'wisp' | 'mind'
  | 'sovereign' | 'halo' | 'prism' | 'arc' | 'kuiper' | 'void';

export type SpecialShip = {
  id: string;
  unlockL: number;
  nameEn: string;
  nameDe: string;
  perkEn: string;
  perkDe: string;
  descEn: string;
  descDe: string;
  hearts: number;
  speed: number;
  rate: number;
  shots: number;
  dmg: number;
  regen: number;
  perk: string;
  perk2: string;
  drones?: number;
  hitR?: number;
  bullet: string;
  flame: [string, string, string];
  kit: {
    shape: SpecialShape;
    wing: [number, number];
    c: [string, string, string];
    edge: string;
    acc: string;
    glass: string;
    guns?: number[];
    pods?: number;
    fins?: boolean;
    eng: number[][];
    core?: string;
    len: number;
    bw?: number;
    aura?: [number, string, string];
  };
};

export function specialSalePrice(index: number): number {
  const i = Math.max(0, Math.floor(index) || 0);
  return 240000 + i * 110000 + i * i * 6000;
}

const ROWS: Array<{
  id: string;
  unlockL: number;
  nameEn: string;
  nameDe: string;
  perkEn: string;
  perkDe: string;
  descEn: string;
  descDe: string;
  hearts: number;
  speed: number;
  rate: number;
  shots: number;
  dmg: number;
  regen: number;
  perk: string;
  perk2: string;
  drones?: number;
  shape: SpecialShape;
  c: [string, string, string];
  edge: string;
  acc: string;
  glass: string;
  bullet: string;
  flame: [string, string, string];
}> = [
  {
    id: 'phobosclaw', unlockL: 108,
    nameEn: 'Phobos Claw', nameDe: 'Phobos-Klaue',
    perkEn: 'Quake claw + shield pulse', perkDe: 'Beben-Klaue + Schildpuls',
    descEn: 'Special reward after the first outer docks. Twin claws smash a whole lane, then pulse a shield.',
    descDe: 'Spezial-Belohnung nach den ersten Außen-Docks. Zwillingsklauen erschüttern die Bahn und stoßen einen Schildpuls aus.',
    hearts: 12, speed: 1.9, rate: 0.15, shots: 3, dmg: 8.8, regen: 12,
    perk: 'quake', perk2: 'pulse',
    shape: 'claw', c: ['#f0b090', '#8a3a20', '#2a1008'], edge: '#ffd0a0', acc: '#ff6a2a', glass: '#ffd54a',
    bullet: '#ff8a40', flame: ['255,230,200', '255,120,50', '140,30,10'],
  },
  {
    id: 'dockfang', unlockL: 123,
    nameEn: 'Dock Fang', nameDe: 'Dock-Fangzahn',
    perkEn: 'Sunbeam + 2 dock drones', perkDe: 'Sonnenstrahl + 2 Dock-Drohnen',
    descEn: 'A drydock fang that holds a beam while two crane-drones fire along.',
    descDe: 'Ein Trockendock-Fangzahn mit Dauerstrahl und zwei Kran-Drohnen.',
    hearts: 12, speed: 1.94, rate: 0.146, shots: 3, dmg: 9.38, regen: 12,
    perk: 'beam', perk2: '', drones: 2,
    shape: 'fang', c: ['#ffe066', '#8a7018', '#241808'], edge: '#fff6c8', acc: '#2330ff', glass: '#8090ff',
    bullet: '#fff27a', flame: ['255,255,220', '255,210,80', '40,70,220'],
  },
  {
    id: 'slagheart', unlockL: 141,
    nameEn: 'Slag Heart', nameDe: 'Schlackenherz',
    perkEn: 'Nova heart + fire wave', perkDe: 'Nova-Herz + Feuer-Welle',
    descEn: 'A molten heart from Titan Foundry. Nova shots, then a fire wave.',
    descDe: 'Ein schmelzendes Herz aus der Titan-Gießerei. Nova-Schüsse, dann eine Feuer-Welle.',
    hearts: 13, speed: 1.97, rate: 0.143, shots: 3, dmg: 9.96, regen: 13,
    perk: 'nova', perk2: 'breath',
    shape: 'heart', c: ['#ff7040', '#7a1810', '#220808'], edge: '#ffc090', acc: '#ff5020', glass: '#ffd54a',
    bullet: '#ff6a2a', flame: ['255,240,200', '255,90,30', '160,20,10'],
  },
  {
    id: 'titanbrand', unlockL: 153,
    nameEn: 'Titan Brand', nameDe: 'Titan-Brand',
    perkEn: 'Omega brand + fire wave', perkDe: 'Omega-Brand + Feuer-Welle',
    descEn: 'Foundry-king special. Omega shots plus a huge fire wave.',
    descDe: 'Gießerei-Königs-Spezial. Omega-Schüsse plus eine riesige Feuer-Welle.',
    hearts: 13, speed: 2.01, rate: 0.139, shots: 4, dmg: 10.54, regen: 13,
    perk: 'omega', perk2: 'breath',
    shape: 'brand', c: ['#ffb060', '#a03010', '#2a0c08'], edge: '#ffe0a0', acc: '#ffd54a', glass: '#fff0c0',
    bullet: '#ffb02a', flame: ['255,255,220', '255,176,42', '180,40,10'],
  },
  {
    id: 'icewisp', unlockL: 162,
    nameEn: 'Ice Wisp', nameDe: 'Eisgeist',
    perkEn: 'Phase slip + frost aura', perkDe: 'Phasen-Gleiten + Frost-Aura',
    descEn: 'A Europa wisp. Shots slip through ice, and a cold field slows bombs.',
    descDe: 'Ein Europa-Geist. Schüsse gleiten durch Eis, ein Kältefeld bremst Bomben.',
    hearts: 14, speed: 2.04, rate: 0.136, shots: 4, dmg: 11.12, regen: 14,
    perk: 'phase', perk2: 'frostaura',
    shape: 'wisp', c: ['#e0f4ff', '#3a7aa0', '#0a2030'], edge: '#ffffff', acc: '#7dffff', glass: '#c8f6ff',
    bullet: '#bff4ff', flame: ['255,255,255', '180,240,255', '80,160,220'],
  },
  {
    id: 'vaultmind', unlockL: 174,
    nameEn: 'Vault Mind', nameDe: 'Tresor-Geist',
    perkEn: 'Pierce + gravity + 2 mind drones', perkDe: 'Durchschuss + Schwerkraft + 2 Geist-Drohnen',
    descEn: 'Reward for the Europa Vault Mind! A thinking vault that pulls foes in.',
    descDe: 'Belohnung für den Europa-Tresor-Geist! Ein denkender Tresor, der Gegner anzieht.',
    hearts: 14, speed: 2.08, rate: 0.132, shots: 4, dmg: 11.7, regen: 14,
    perk: 'pierce', perk2: 'gravity', drones: 2,
    shape: 'mind', c: ['#c0a870', '#4a3820', '#181008'], edge: '#ffe8b0', acc: '#ffd54a', glass: '#7dffe0',
    bullet: '#ffe066', flame: ['255,250,220', '255,213,74', '80,200,180'],
  },
  {
    id: 'ringsovr', unlockL: 186,
    nameEn: 'Ring Sovereign', nameDe: 'Ring-Souverän',
    perkEn: 'Split rings + 2 escorts', perkDe: 'Splitter-Ringe + 2 Begleiter',
    descEn: 'Saturn royalty. Each hit shears into two blades, and two escorts fly beside you.',
    descDe: 'Saturn-Adel. Jeder Treffer teilt sich in zwei Klingen, zwei Begleiter fliegen mit.',
    hearts: 15, speed: 2.12, rate: 0.128, shots: 4, dmg: 12.28, regen: 15,
    perk: 'split', perk2: 'wing',
    shape: 'sovereign', c: ['#f0d080', '#6a4a18', '#201408'], edge: '#fff4c8', acc: '#ffd54a', glass: '#ffffff',
    bullet: '#ffe066', flame: ['255,255,230', '255,213,74', '200,140,40'],
  },
  {
    id: 'dreadhalo', unlockL: 198,
    nameEn: 'Dread Halo', nameDe: 'Schreckens-Heiligenschein',
    perkEn: 'Homing + 3 halo drones', perkDe: 'Zielsuchend + 3 Heiligenschein-Drohnen',
    descEn: 'Reward for the Ring Fleet Dreadnought! A spinning halo with three hunter drones.',
    descDe: 'Belohnung für den Ringflotten-Dreadnought! Ein drehender Heiligenschein mit drei Jäger-Drohnen.',
    hearts: 15, speed: 2.15, rate: 0.125, shots: 5, dmg: 12.86, regen: 15,
    perk: 'homing', perk2: 'orbit', drones: 3,
    shape: 'halo', c: ['#e0c8ff', '#5a3a9a', '#1a0a30'], edge: '#ffffff', acc: '#c08cff', glass: '#ffe066',
    bullet: '#c08cff', flame: ['255,240,255', '192,140,255', '80,40,160'],
  },
  {
    id: 'stormprism', unlockL: 216,
    nameEn: 'Storm Prism', nameDe: 'Sturm-Prisma',
    perkEn: 'Rainbow storm + shield pulse', perkDe: 'Regenbogen-Sturm + Schildpuls',
    descEn: 'A Uranus crystal. Five colorful shots and a pulse that pops nearby bombs.',
    descDe: 'Ein Uranus-Kristall. Fünf bunte Schüsse und ein Puls, der Bomben in der Nähe knallt.',
    hearts: 16, speed: 2.19, rate: 0.121, shots: 5, dmg: 13.44, regen: 16,
    perk: 'prism', perk2: 'pulse',
    shape: 'prism', c: ['#b0e0ff', '#2050a0', '#081830'], edge: '#ffffff', acc: '#7dffff', glass: '#fff27a',
    bullet: '#ffffff', flame: ['255,255,255', '125,255,234', '80,160,255'],
  },
  {
    id: 'uranusarc', unlockL: 228,
    nameEn: 'Uranus Arc', nameDe: 'Uranus-Bogen',
    perkEn: 'Beam + slow-mo', perkDe: 'Strahl + Zeitlupe',
    descEn: 'A sideways lightning arc. Holds a beam and slows time when danger is close.',
    descDe: 'Ein seitlicher Blitzbogen. Hält einen Strahl und bremst die Zeit, wenn Gefahr nah ist.',
    hearts: 16, speed: 2.22, rate: 0.118, shots: 5, dmg: 14.02, regen: 16,
    perk: 'beam', perk2: 'timeslow',
    shape: 'arc', c: ['#7dffff', '#1a6a6a', '#082028'], edge: '#e8fffb', acc: '#4ec3ff', glass: '#ffffff',
    bullet: '#7dffff', flame: ['230,255,255', '80,230,220', '20,90,100'],
  },
  {
    id: 'kuiperfang', unlockL: 237,
    nameEn: 'Kuiper Fang', nameDe: 'Kuiper-Fangzahn',
    perkEn: 'Pierce + slow-mo fang', perkDe: 'Durchschuss + Zeitlupen-Fangzahn',
    descEn: 'A Kuiper ice fang. Punches through everything and slows the lane.',
    descDe: 'Ein Kuiper-Eis-Fangzahn. Durchschlägt alles und bremst die Bahn.',
    hearts: 17, speed: 2.26, rate: 0.114, shots: 5, dmg: 14.6, regen: 17,
    perk: 'pierce', perk2: 'timeslow',
    shape: 'kuiper', c: ['#c0c8e0', '#2a3050', '#0a0c18'], edge: '#ffffff', acc: '#7dffff', glass: '#c08cff',
    bullet: '#d8e8ff', flame: ['255,255,255', '180,210,255', '80,80,160'],
  },
  {
    id: 'voidcrown', unlockL: 248,
    nameEn: 'Void Crown', nameDe: 'Leeren-Krone',
    perkEn: 'Omega + clone + 4 drones + 1.6x vs Star Crown Kaiser',
    perkDe: 'Omega + Klon + 4 Drohnen + 1,6x gegen den Sternenkronen-Kaiser',
    descEn: 'Special-built to beat the Level 250 Kaiser. Crown shots seek and pierce, a void-clone fires along, four drones, and extra bite vs Star Crown.',
    descDe: 'Gebaut, um den Level-250-Kaiser zu besiegen. Kronen-Schüsse suchen und durchschlagen, ein Leeren-Klon schießt mit, vier Drohnen, extra Biss gegen die Sternenkrone.',
    hearts: 17, speed: 2.3, rate: 0.11, shots: 5, dmg: 15.2, regen: 17,
    perk: 'omega', perk2: 'clone', drones: 4,
    shape: 'void', c: ['#e0d0ff', '#3a2060', '#140828'], edge: '#ffffff', acc: '#c08cff', glass: '#ffd54a',
    bullet: '#ffd54a', flame: ['255,255,255', '200,140,255', '255,213,74'],
  },
];

function kitFor(row: (typeof ROWS)[number], i: number): SpecialShip['kit'] {
  return {
    shape: row.shape,
    wing: [38 + (i % 4) * 2, 8],
    c: row.c,
    edge: row.edge,
    acc: row.acc,
    glass: row.glass,
    eng: i >= 8
      ? [[-14, 30, 16, 6], [14, 30, 16, 6], [0, 34, 22, 8]]
      : i >= 4
        ? [[-10, 30, 16, 6], [10, 30, 16, 6]]
        : [[0, 30, 20, 7]],
    core: row.acc,
    len: 42 + Math.min(8, Math.floor(i / 2)),
    bw: 12 + Math.floor(i / 4),
    aura: [56 + Math.floor(i / 3) * 4, `${row.acc}38`, `${row.c[2]}00`],
  };
}

export const SPECIAL_SHIPS: SpecialShip[] = ROWS.map((row, i) => ({
  id: row.id,
  unlockL: row.unlockL,
  nameEn: row.nameEn,
  nameDe: row.nameDe,
  perkEn: row.perkEn,
  perkDe: row.perkDe,
  descEn: row.descEn,
  descDe: row.descDe,
  hearts: row.hearts,
  speed: row.speed,
  rate: row.rate,
  shots: row.shots,
  dmg: row.dmg,
  regen: row.regen,
  perk: row.perk,
  perk2: row.perk2,
  drones: row.drones,
  bullet: row.bullet,
  flame: row.flame,
  kit: kitFor(row, i),
}));

export const SPECIAL_IDS = SPECIAL_SHIPS.map((s) => s.id);

export const EARLY_SPECIAL_IDS = ['frostwal', 'lindwurm', 'hydra', 'regenbogen', 'kaiserbrecher'] as const;

export function specialById(id: string): SpecialShip | undefined {
  return SPECIAL_SHIPS.find((s) => s.id === id);
}

export function specialI18n(lang: 'en' | 'de'): Record<string, { name: string; perk: string; desc: string }> {
  const out: Record<string, { name: string; perk: string; desc: string }> = {};
  for (const s of SPECIAL_SHIPS) {
    out[s.id] = lang === 'de'
      ? { name: s.nameDe, perk: s.perkDe, desc: s.descDe }
      : { name: s.nameEn, perk: s.perkEn, desc: s.descEn };
  }
  return out;
}

export function specialUnlockMap(): Record<string, { level: number }> {
  const out: Record<string, { level: number }> = {};
  for (const s of SPECIAL_SHIPS) out[s.id] = { level: s.unlockL };
  return out;
}

export function specialCombat(): Record<string, {
  hearts: number; speed: number; rate: number; shots: number; dmg: number;
  regen: number; hitR?: number; perk?: string; perk2?: string; drones?: number;
}> {
  const out: Record<string, {
    hearts: number; speed: number; rate: number; shots: number; dmg: number;
    regen: number; hitR?: number; perk?: string; perk2?: string; drones?: number;
  }> = {};
  for (const s of SPECIAL_SHIPS) {
    out[s.id] = {
      hearts: s.hearts,
      speed: s.speed,
      rate: s.rate,
      shots: s.shots,
      dmg: s.dmg,
      regen: s.regen,
      hitR: s.hitR,
      perk: s.perk || undefined,
      perk2: s.perk2 || undefined,
      drones: s.drones,
    };
  }
  return out;
}
