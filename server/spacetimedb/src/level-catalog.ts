/** Server copy of remote level payloads (levels 4–250). Keep in sync with src/lib/level-catalog.ts. */

export const BUNDLED_LEVELS = 3;
export const MAX_LEVEL = 250;

type LevelFeats = {
  ice: boolean;
  meteor: boolean;
  sniper: boolean;
  worm: boolean;
  flare: boolean;
  armor: boolean;
  mines: boolean;
  wells: boolean;
  cloak: boolean;
  grid: boolean;
  missile: boolean;
  wind: boolean;
  holes: boolean;
};

export type LevelPayload = {
  level: number;
  name: string;
  isBoss: boolean;
  hole: boolean;
  feats: LevelFeats;
  featCopy?: { title: string; desc: string };
  boss?: { type: string; hp: number; mods: string[] };
};

function isBossLevel(L: number): boolean {
  return L > 0 && (L % 3 === 0 || L === 100 || L === 250);
}

function holeLevel(L: number): boolean {
  return !isBossLevel(L) && (L === 5 || L === 10 || (L >= 19 && (L * 7) % 11 === 3));
}

const FEAT_COPY: Record<number, { title: string; desc: string }> = {
  4: { title: 'Ice asteroids', desc: 'They freeze you for a moment! Shoot them: +15' },
  5: { title: 'Meteor shower', desc: 'Watch the warning, then dodge!' },
  6: { title: 'Boss: Robo-battleship', desc: 'Red line = laser coming. Move!' },
  7: { title: 'Alien snipers', desc: 'They aim first (line), then shoot slowly.' },
  8: { title: 'Wormholes', desc: 'Fly in and pop out the other side!' },
  9: { title: 'Boss: Twin UFOs', desc: 'Two at once — they share energy!' },
  10: { title: 'Solar storms', desc: 'Fly through the green gap or use a shield!' },
  11: { title: 'Armored rocks & mines', desc: 'Armor needs 3 hits. Do not shoot mines next to you!' },
  12: { title: 'Boss: Asteroid base', desc: 'When the arms glow, rocks fly. Shoot or dodge!' },
  13: { title: 'Gravity planets', desc: 'They pull you and your shots! Do not touch.' },
  14: { title: 'Cloaked UFOs', desc: 'They flicker. Hit them only while visible!' },
  15: { title: 'Boss: Crystal cruiser', desc: 'When it glows, shards fly. Red line = laser!' },
  16: { title: 'Laser grid', desc: 'Fly through the green gaps — they move!' },
  17: { title: 'Missiles & solar wind', desc: 'Missiles chase you — shoot them! Steer against the wind!' },
  18: { title: 'Sector boss: Grabber mothership', desc: 'A red stripe means a claw slam — move!' },
  19: { title: 'Sector 2: Nebula Reef', desc: 'A new galaxy! Cloaked UFOs and gravity planets lurk.' },
  21: { title: 'Remix bosses', desc: 'Old bosses return — new colors and extra tricks!' },
  30: { title: 'Sector boss: Nebula fortress', desc: 'Turrets spin and aim at you. Keep moving!' },
  31: { title: 'Sector 3: Ice galaxy', desc: 'Ice rain and solar storms! Ice rocks freeze you.' },
  45: { title: 'Sector boss: Frost gun-cruiser', desc: 'It aims (line), then fires 3 times. Dodge!' },
  46: { title: 'Sector 4: Lava sector', desc: 'Meteors and mines everywhere. Armor gets tougher!' },
  60: { title: 'Sector boss: Sun titan', desc: 'It hurls fire rings and solar storms!' },
  61: { title: 'Sector 5: Crystal swirl', desc: 'Laser grids and snipers! Find the gaps.' },
  75: { title: 'Sector boss on level 75', desc: 'A huge foe with lasers, drones and snipers!' },
  76: { title: 'Sector 6: Shadow zone', desc: 'Black holes, cloaked UFOs and hole storms.' },
  90: { title: 'Sector boss: Black-hole guardian', desc: 'Its eye fires lasers and opens holes and grids!' },
  91: { title: 'Sector 7: Emperor realm', desc: 'Everything at once. The Robo-Emperor waits on 100!' },
  100: { title: 'Robo-Emperor — final form', desc: '7 phases with every trick! The outer galaxies still wait beyond.' },
  101: { title: 'Galaxy 8: Phobos Shipyards', desc: 'Robot docks and crane mechs. Armor and mines come back!' },
  120: { title: 'Sector boss: Drydock Colossus', desc: 'A shipyard titan. When the clamps glow, dodge the slam!' },
  126: { title: 'Galaxy 9: Titan Foundry', desc: 'Molten presses and slag furnaces. Watch the meteor warnings!' },
  150: { title: 'Sector boss: Titan Foundry King', desc: 'The smelter king hurls fire rings. Keep moving!' },
  151: { title: 'Galaxy 10: Europa Vault', desc: 'Ice probes and vault drones. Ice rocks freeze you.' },
  174: { title: 'Sector boss: Europa Vault Mind', desc: 'An ice AI. Red line = laser. Fly through the gaps!' },
  176: { title: 'Galaxy 11: Saturn Ring Fleet', desc: 'Ring shears and spoke forts. Missiles chase you!' },
  198: { title: 'Sector boss: Ring Fleet Dreadnought', desc: 'A huge ring warship. Cannons turn — stay off the red line!' },
  201: { title: 'Galaxy 12: Uranus Stormworks', desc: 'Storm coils and sideways cruisers. Solar wind pushes hard!' },
  225: { title: 'Sector boss: Stormworks Core', desc: 'The storm AI core. When it glows, shards and lasers fly!' },
  226: { title: 'Galaxy 13: Kuiper Crown', desc: 'The edge of the map. Dark-matter crabs and void heralds.' },
  250: { title: 'FINALE: Weltraum Kaiser — Star Crown', desc: 'The last boss! The same Kaiser as level 100 — bigger, stronger, more phases. You can do this!' },
};

function earlyFeats(L: number): LevelFeats {
  const bl = isBossLevel(L);
  return {
    ice: L >= 4,
    meteor: L >= 5,
    sniper: L >= 7,
    worm: L >= 8 && !bl,
    flare: L >= 10 && !bl,
    armor: L >= 11,
    mines: L >= 11,
    wells: L >= 13 && !bl,
    cloak: L >= 14,
    grid: L === 16,
    missile: L >= 17 && !bl,
    wind: L >= 17 && !bl,
    holes: holeLevel(L),
  };
}

function highFeats(L: number): LevelFeats {
  const bl = isBossLevel(L);
  return {
    ice: true,
    meteor: L % 4 === 0,
    sniper: L % 5 === 1,
    worm: !bl && L % 5 === 2,
    flare: !bl && L % 7 === 1,
    armor: true,
    mines: L % 6 === 2,
    wells: !bl && L % 6 === 1,
    cloak: L % 7 === 3,
    grid: !bl && L % 8 === 4,
    missile: !bl && L % 9 === 5,
    wind: !bl && L % 8 === 3,
    holes: holeLevel(L) && !bl,
  };
}

function lateBossHp(L: number): number {
  if (L === 250) return 60000;
  if (L === 225) return 11000;
  if (L === 198) return 10000;
  if (L === 174) return 9000;
  if (L === 150) return 8000;
  if (L === 120) return 7000;
  return Math.round(4800 + 20 * (L - 100));
}

function bossFor(L: number): LevelPayload['boss'] | undefined {
  if (!isBossLevel(L)) return undefined;
  if (L === 250) return { type: 'emperor', hp: 60000, mods: [] };
  if (L === 100) return { type: 'emperor', hp: 9000, mods: [] };
  const early: Record<number, { type: string; hp: number }> = {
    3: { type: 'saucer', hp: 28 },
    6: { type: 'robo', hp: 40 },
    9: { type: 'twins', hp: 55 },
    12: { type: 'golem', hp: 70 },
    15: { type: 'crystal', hp: 90 },
    18: { type: 'kraken', hp: 820 },
  };
  if (early[L]) return { ...early[L], mods: [] };
  if (L > 100) return { type: 'art', hp: lateBossHp(L), mods: ['laser'] };
  return { type: 'remix', hp: 330 + 17 * (L - 18), mods: ['laser'] };
}

export function buildLevelPayload(level: number): LevelPayload {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const feats = L >= 19 ? highFeats(L) : earlyFeats(L);
  return {
    level: L,
    name: `Level ${L}`,
    isBoss: isBossLevel(L),
    hole: holeLevel(L),
    feats,
    featCopy: FEAT_COPY[L],
    boss: bossFor(L),
  };
}
