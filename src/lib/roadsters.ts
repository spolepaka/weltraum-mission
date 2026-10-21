/**
 * Tesla Roadster hangar category (2nd-gen flying Roadster).
 * Keep HTML SHIPS[] / DESIGNS / server VALID_SHIPS in lockstep with this list.
 * Ship ids stay beepbuggy…apexflash so existing saves and the unreleased shop stay valid.
 */

export const ROADSTER_TAB = 5;
export const ROADSTER_TAB_KEY = 'tabRoadster' as const;

export const ROADSTER_IDS = [
  'beepbuggy',
  'cloudcoupe',
  'shadowspeeder',
  'chromewasp',
  'apexflash',
] as const;

export type RoadsterId = (typeof ROADSTER_IDS)[number];

export interface RoadsterDef {
  id: RoadsterId;
  tier: typeof ROADSTER_TAB;
  price: number;
  hearts: number;
  speed: number;
  rate: number;
  shots: number;
  dmg: number;
  regen: number;
  perk: string;
  perk2: string;
  bullet: string;
  flame: [string, string, string];
  paint: 'red' | 'white' | 'black' | 'silver' | 'chrome';
  glow: string;
  trim: string;
}

const ROCKET_FLAME: [string, string, string] = ['230,250,255', '90,180,255', '30,70,200'];

export const ROADSTERS: readonly RoadsterDef[] = [
  {
    id: 'beepbuggy',
    tier: ROADSTER_TAB,
    price: 900,
    hearts: 3,
    speed: 1.25,
    rate: 0.23,
    shots: 1,
    dmg: 1.05,
    regen: 0,
    perk: '',
    perk2: '',
    bullet: '#ff6a5a',
    flame: ROCKET_FLAME,
    paint: 'red',
    glow: '#ff4a3a',
    trim: 'base',
  },
  {
    id: 'cloudcoupe',
    tier: ROADSTER_TAB,
    price: 6000,
    hearts: 3,
    speed: 1.55,
    rate: 0.2,
    shots: 1,
    dmg: 1.5,
    regen: 0,
    perk: '',
    perk2: 'dash',
    bullet: '#e8f6ff',
    flame: ROCKET_FLAME,
    paint: 'white',
    glow: '#7dffea',
    trim: 'performance',
  },
  {
    id: 'shadowspeeder',
    tier: ROADSTER_TAB,
    price: 22000,
    hearts: 4,
    speed: 1.4,
    rate: 0.26,
    shots: 2,
    dmg: 2.6,
    regen: 0,
    perk: 'pierce',
    perk2: '',
    bullet: '#ff4a5a',
    flame: ROCKET_FLAME,
    paint: 'black',
    glow: '#c9a44a',
    trim: 'thrust',
  },
  {
    id: 'chromewasp',
    tier: ROADSTER_TAB,
    price: 45000,
    hearts: 5,
    speed: 1.5,
    rate: 0.22,
    shots: 2,
    dmg: 3.6,
    regen: 14,
    perk: 'homing',
    perk2: '',
    bullet: '#d8e8ff',
    flame: ROCKET_FLAME,
    paint: 'silver',
    glow: '#9ad0ff',
    trim: 'rocket',
  },
  {
    id: 'apexflash',
    tier: ROADSTER_TAB,
    price: 148000,
    hearts: 7,
    speed: 1.62,
    rate: 0.2,
    shots: 3,
    dmg: 4.8,
    regen: 11,
    perk: 'homing',
    perk2: 'pulse',
    bullet: '#ffd54a',
    flame: ['255,255,255', '140,210,255', '40,90,220'],
    paint: 'chrome',
    glow: '#ffe066',
    trim: 'founders',
  },
] as const;

export const ROADSTER_PRICES: Record<RoadsterId, number> = {
  beepbuggy: 900,
  cloudcoupe: 6000,
  shadowspeeder: 22000,
  chromewasp: 45000,
  apexflash: 148000,
};

const ROADSTER_SET = new Set<string>(ROADSTER_IDS);

export function isRoadsterId(id: string): id is RoadsterId {
  return ROADSTER_SET.has(id);
}

export function roadsterById(id: string): RoadsterDef | undefined {
  return ROADSTERS.find((r) => r.id === id);
}

/** Owner-requested Tesla naming must appear in EN/DE copy. */
export const TESLA_ROADSTER_MARKS = ['tesla', 'roadster', 'spacex'] as const;

/** Real 2nd-gen trims (Performance / Thrust / Rocket) plus base + Founders. */
export const ROADSTER_TRIM = {
  beepbuggy: { en: 'Roadster', de: 'Roadster Basis' },
  cloudcoupe: { en: 'Roadster Performance', de: 'Roadster-Performance' },
  shadowspeeder: { en: 'Roadster Thrust', de: 'Roadster-Thrust' },
  chromewasp: { en: 'Roadster Rocket', de: 'Roadster-Rocket' },
  apexflash: { en: 'Roadster Founders Series', de: 'Roadster Founders-Serie' },
} as const;

/** Safe no-op: ids never changed. Keep for any future rename. */
const ROADSTER_ID_ALIASES: Record<string, RoadsterId> = {
  beepbuggy: 'beepbuggy',
  cloudcoupe: 'cloudcoupe',
  shadowspeeder: 'shadowspeeder',
  chromewasp: 'chromewasp',
  apexflash: 'apexflash',
};

export function canonicalRoadsterId(id: string): RoadsterId | undefined {
  const mapped = ROADSTER_ID_ALIASES[id];
  if (mapped) return mapped;
  return isRoadsterId(id) ? id : undefined;
}
