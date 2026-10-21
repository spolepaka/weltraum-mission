/**
 * Sky Roadsters shop category. Fun original names — never "Tesla" or logos.
 * Keep HTML SHIPS[] / DESIGNS / server VALID_SHIPS in lockstep with this list.
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
  /** Shop tab index (Sky Roadsters). */
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
  paint: 'red' | 'white' | 'black' | 'silver' | 'crimson';
  glow: string;
}

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
    flame: ['255,220,180', '255,90,70', '180,20,20'],
    paint: 'red',
    glow: '#ff7a5a',
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
    flame: ['240,252,255', '140,210,255', '60,140,255'],
    paint: 'white',
    glow: '#7dffea',
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
    flame: ['255,180,190', '255,60,90', '80,0,20'],
    paint: 'black',
    glow: '#ff4a6a',
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
    flame: ['255,255,255', '200,220,255', '140,160,200'],
    paint: 'silver',
    glow: '#ffe066',
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
    flame: ['255,255,230', '255,180,60', '255,60,20'],
    paint: 'crimson',
    glow: '#ffd54a',
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

/** Brand tokens that must never appear in ship copy, ids, or art comments. */
export const FORBIDDEN_ROADSTER_MARKS = [
  'tesla',
  'cybertruck',
  'starman',
  'spacex',
  'elon',
  'musk',
] as const;
