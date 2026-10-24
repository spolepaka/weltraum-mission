/**
 * Unique space/robot bosses for all 85 boss levels (3…249 step 3, plus 100 and 250).
 * Every entry has its own name, attack mods, and art id — no tint-only reuse.
 */

export const MAX_LEVEL = 250;
export const LEVELS_PER_WORLD_HINT = 25;

export type WorldDef = {
  from: number;
  to: number;
  key: string;
  icon: string;
};

export const WORLDS: WorldDef[] = [
  { from: 1, to: 18, key: 'home', icon: '🏠' },
  { from: 19, to: 30, key: 'nebel', icon: '🌫️' },
  { from: 31, to: 45, key: 'frost', icon: '❄️' },
  { from: 46, to: 60, key: 'sonnen', icon: '🌋' },
  { from: 61, to: 75, key: 'asteroid', icon: '💎' },
  { from: 76, to: 90, key: 'schatten', icon: '🌑' },
  { from: 91, to: 100, key: 'jenseits', icon: '👑' },
  { from: 101, to: 125, key: 'phobos', icon: '🛠️' },
  { from: 126, to: 150, key: 'titanw', icon: '🏭' },
  { from: 151, to: 175, key: 'europa', icon: '🧊' },
  { from: 176, to: 200, key: 'saturn', icon: '🪐' },
  { from: 201, to: 225, key: 'uranus', icon: '🌀' },
  { from: 226, to: 250, key: 'kuiper', icon: '☄️' },
];

export const SECTOR_BOSS_LEVELS = [18, 30, 45, 60, 75, 90, 100, 120, 150, 174, 198, 225, 250] as const;

export type BossEntry = {
  L: number;
  type: string;
  hp: number;
  nameEn: string;
  nameDe: string;
  mods: string[];
  art: number;
  sector?: boolean;
  finale?: boolean;
  prime?: boolean;
};

const MODS: string[][] = [
  [],
  ['laser'],
  ['drones'],
  ['missiles'],
  ['minions'],
  ['rain'],
  ['holes'],
  ['grid'],
  ['wells'],
  ['snipers'],
  ['mines'],
  ['flare'],
  ['laser', 'drones'],
  ['laser', 'missiles'],
  ['laser', 'minions'],
  ['laser', 'rain'],
  ['laser', 'holes'],
  ['drones', 'missiles'],
  ['drones', 'minions'],
  ['drones', 'rain'],
  ['drones', 'wells'],
  ['missiles', 'minions'],
  ['missiles', 'holes'],
  ['missiles', 'grid'],
  ['minions', 'rain'],
  ['minions', 'mines'],
  ['rain', 'flare'],
  ['holes', 'grid'],
  ['holes', 'wells'],
  ['grid', 'snipers'],
  ['wells', 'mines'],
  ['snipers', 'flare'],
  ['mines', 'flare'],
  ['laser', 'drones', 'missiles'],
  ['laser', 'minions', 'wells'],
  ['drones', 'rain', 'snipers'],
  ['missiles', 'holes', 'mines'],
  ['minions', 'grid', 'flare'],
  ['rain', 'wells', 'snipers'],
  ['holes', 'mines', 'flare'],
  ['laser', 'grid', 'snipers'],
  ['drones', 'holes', 'mines'],
  ['missiles', 'wells', 'flare'],
  ['minions', 'rain', 'grid'],
  ['laser', 'drones', 'flare'],
  ['laser', 'rain', 'mines'],
  ['drones', 'grid', 'wells'],
  ['missiles', 'snipers', 'minions'],
  ['holes', 'rain', 'laser'],
  ['flare', 'drones', 'grid'],
  ['wells', 'snipers', 'missiles'],
  ['mines', 'minions', 'laser'],
  ['laser', 'holes', 'flare'],
  ['drones', 'mines', 'snipers'],
  ['missiles', 'rain', 'wells'],
  ['grid', 'minions', 'holes'],
  ['flare', 'wells', 'rain'],
  ['snipers', 'mines', 'drones'],
  ['laser', 'wells', 'minions'],
  ['drones', 'flare', 'holes'],
  ['missiles', 'grid', 'mines'],
  ['rain', 'snipers', 'laser'],
  ['holes', 'minions', 'drones'],
  ['grid', 'flare', 'missiles'],
  ['wells', 'rain', 'mines'],
];

type NamePair = { en: string; de: string };

/** Famous early / sector bosses keep their live names (Sun Titan retitled as a mech). */
const NAMED: Record<number, { type: string; hp: number; en: string; de: string; sector?: boolean; finale?: boolean }> = {
  3: { type: 'saucer', hp: 28, en: 'UFO MOTHERSHIP', de: 'UFO-MUTTERSCHIFF' },
  6: { type: 'robo', hp: 40, en: 'ROBO BATTLESHIP', de: 'ROBO-SCHLACHTSCHIFF' },
  9: { type: 'twins', hp: 55, en: 'TWIN UFOs', de: 'ZWILLINGS-UFOs' },
  12: { type: 'golem', hp: 70, en: 'ASTEROID BASE', de: 'ASTEROIDEN-BASIS' },
  15: { type: 'crystal', hp: 90, en: 'CRYSTAL CRUISER', de: 'KRISTALL-KREUZER' },
  18: { type: 'kraken', hp: 820, en: 'GRABBER MOTHERSHIP', de: 'GREIFARM-MUTTERSCHIFF', sector: true },
  24: { type: 'walker', hp: 1100, en: 'MECHA STOMPER', de: 'MECHA-STAMPFER' },
  30: { type: 'station', hp: 1900, en: 'NEBULA FORTRESS', de: 'NEBEL-FESTUNG', sector: true },
  36: { type: 'head', hp: 2100, en: 'TITAN ROBO HEAD', de: 'TITAN-ROBOKOPF' },
  45: { type: 'scorpion', hp: 2700, en: 'FROST GUN CRUISER', de: 'FROST-GESCHÜTZKREUZER', sector: true },
  48: { type: 'trans', hp: 2900, en: 'MORPH ROBOJET', de: 'WANDEL-ROBOJET' },
  57: { type: 'carrier', hp: 3300, en: 'DRONE CARRIER ROBOT', de: 'DROHNEN-TRÄGER-ROBOTER' },
  60: { type: 'sun', hp: 3700, en: 'SOLAR CORE MECH', de: 'SONNENKERN-MECH', sector: true },
  66: { type: 'walker', hp: 3900, en: 'SPIDER MECH', de: 'SPINNEN-MECH' },
  72: { type: 'head', hp: 4100, en: 'GIGA ROBO SKULL', de: 'GIGA-ROBOSCHÄDEL' },
  75: { type: 'golem', hp: 4300, en: 'CRYSTAL ASTEROID BASE', de: 'KRISTALL-ASTEROIDENBASIS', sector: true },
  81: { type: 'trans', hp: 4700, en: 'TRANSFORMO CRUISER', de: 'TRANSFORMO-KREUZER' },
  90: { type: 'guardian', hp: 5400, en: 'BLACK-HOLE GUARDIAN', de: 'SCHWARZLOCH-WÄCHTER', sector: true },
  96: { type: 'carrier', hp: 5600, en: 'SWARM COMMAND ROBOT', de: 'SCHWARM-KOMMANDO-ROBOTER' },
  100: { type: 'emperor', hp: 9000, en: 'ROBO-EMPEROR: FINAL FORM', de: 'ROBO-KAISER: FINALE FORM', sector: true, finale: true },
};

const RETHEME: Record<number, NamePair> = {
  21: { en: 'PLASMA WEDGE', de: 'PLASMA-KEIL' },
  27: { en: 'NEUTRON FRIGATE', de: 'NEUTRONEN-FREGATTE' },
  33: { en: 'PULSAR BEETLE', de: 'PULSAR-KÄFER' },
  39: { en: 'QUANTUM EYE', de: 'QUANTEN-AUGE' },
  42: { en: 'GAMMA HEXAPOD', de: 'GAMMA-HEXAPODE' },
  51: { en: 'PHOTON ANVIL', de: 'PHOTONEN-AMBOS' },
  54: { en: 'ANTIMATTER CLAW', de: 'ANTIMATERIE-KLAUE' },
  63: { en: 'COMET DRILL', de: 'KOMETEN-BOHRER' },
  69: { en: 'ORBIT SAW', de: 'ORBIT-SÄGE' },
  78: { en: 'VOID LANTERN', de: 'LEEREN-LATERNE' },
  84: { en: 'MAGNET GYRO', de: 'MAGNET-KREISEL' },
  87: { en: 'NOVA CROWN', de: 'NOVA-KRONE' },
  93: { en: 'DARK PRISM', de: 'DUNKEL-PRISMA' },
  99: { en: 'CHRONO CORE', de: 'CHRONO-KERN' },
};

const NEW_BOSSES: Record<number, { type: string; en: string; de: string; sector?: boolean; finale?: boolean; prime?: boolean; hp?: number }> = {
  102: { type: 'art', en: 'RIVET DRONE', de: 'NIETEN-DROHNE' },
  105: { type: 'art', en: 'CRANE MECH', de: 'KRAN-MECH' },
  108: { type: 'art', en: 'WELDER SKULL', de: 'SCHWEISS-SCHÄDEL' },
  111: { type: 'art', en: 'DOCKYARD CRAB', de: 'WERFT-KRABBE' },
  114: { type: 'art', en: 'BOLT HOWITZER', de: 'BOLZEN-HAUBITZE' },
  117: { type: 'art', en: 'HULL STRIPPER', de: 'RUMPF-SCHÄLER' },
  120: { type: 'forge', en: 'DRYDOCK COLOSSUS', de: 'TROCKENDOCK-KOLOSS', sector: true, hp: 7000 },
  123: { type: 'art', en: 'LAUNCH CLAMP', de: 'START-KLAUE' },
  126: { type: 'art', en: 'SLAG FURNACE', de: 'SCHLACKEN-OFEN' },
  129: { type: 'art', en: 'MAGMA PRESS', de: 'MAGMA-PRESSE' },
  132: { type: 'art', en: 'SMELTER SPIDER', de: 'SCHMELZ-SPINNE' },
  135: { type: 'art', en: 'INGOT CANNON', de: 'BARREN-KANONE' },
  138: { type: 'art', en: 'CRUCIBLE DRONE', de: 'TIEGEL-DROHNE' },
  141: { type: 'art', en: 'FORGE HAMMER', de: 'SCHMIEDE-HAMMER' },
  144: { type: 'art', en: 'LAVA RAIL', de: 'LAVA-SCHIENE' },
  147: { type: 'art', en: 'ASH CARRIER', de: 'ASCHE-TRÄGER' },
  150: { type: 'foundry', en: 'TITAN FOUNDRY KING', de: 'TITAN-GIESSEREI-KÖNIG', sector: true, hp: 8000 },
  153: { type: 'art', en: 'FROST PROBE', de: 'FROST-SONDE' },
  156: { type: 'art', en: 'ICE AUGER', de: 'EIS-BOHRER' },
  159: { type: 'art', en: 'CRYO SENTINEL', de: 'KRYO-WÄCHTER' },
  162: { type: 'art', en: 'VAULT WARDEN', de: 'TRESOR-WACHE' },
  165: { type: 'art', en: 'BRINE JELLY', de: 'LAUGEN-QUALLE' },
  168: { type: 'art', en: 'SUBGLACIAL EYE', de: 'UNTEREIS-AUGE' },
  171: { type: 'art', en: 'CRACKER DRILL', de: 'RISS-BOHRER' },
  174: { type: 'vault', en: 'EUROPA VAULT MIND', de: 'EUROPA-TRESOR-GEIST', sector: true, hp: 9000 },
  177: { type: 'art', en: 'RING SHEAR', de: 'RING-SCHERE' },
  180: { type: 'art', en: 'SPOKE DESTROYER', de: 'SPEICHEN-ZERSTÖRER' },
  183: { type: 'art', en: 'SHEPHERD DRONE', de: 'HIRTEN-DROHNE' },
  186: { type: 'art', en: 'ICE RING WORM', de: 'EISRING-WURM' },
  189: { type: 'art', en: 'HEX SAIL', de: 'HEX-SEGEL' },
  192: { type: 'art', en: 'ORBITAL SCYTHE', de: 'ORBIT-SENSE' },
  195: { type: 'art', en: 'SPOKE FORT', de: 'SPEICHEN-FESTUNG' },
  198: { type: 'ringfleet', en: 'RING FLEET DREADNOUGHT', de: 'RINGFLOTTEN-DREADNOUGHT', sector: true, hp: 10000 },
  201: { type: 'art', en: 'STORM COIL', de: 'STURM-SPULE' },
  204: { type: 'art', en: 'TILT GYRO', de: 'KIPP-KREISEL' },
  207: { type: 'art', en: 'METHANE RAY', de: 'METHAN-STRAHL' },
  210: { type: 'art', en: 'DIAMOND TURRET', de: 'DIAMANT-TURM' },
  213: { type: 'art', en: 'SIDEWAYS CRUISER', de: 'QUER-KREUZER' },
  216: { type: 'art', en: 'AURORA FAN', de: 'AURORA-FÄCHER' },
  219: { type: 'art', en: 'ICE GIANT FIST', de: 'EISRIESEN-FAUST' },
  222: { type: 'art', en: 'VORTEX DRONE', de: 'WIRBEL-DROHNE' },
  225: { type: 'stormcore', en: 'STORMWORKS CORE', de: 'STURMWERK-KERN', sector: true, hp: 11000 },
  228: { type: 'art', en: 'COMET HATCHERY', de: 'KOMETEN-BRUT' },
  231: { type: 'art', en: 'PLUTO SPIRE', de: 'PLUTO-TURM' },
  234: { type: 'art', en: 'CHARON GATE', de: 'CHARON-TOR' },
  237: { type: 'art', en: 'OORT NEEDLE', de: 'OORT-NADEL' },
  240: { type: 'art', en: 'DARK MATTER CRAB', de: 'DUNKELMATERIE-KRABBE' },
  243: { type: 'art', en: 'HALO SENTINEL', de: 'HALO-WÄCHTER' },
  246: { type: 'art', en: 'ICE DWARF MECH', de: 'EISZWERG-MECH' },
  249: { type: 'art', en: 'VOID HERALD', de: 'LEEREN-HEROLD' },
  250: { type: 'emperor', en: 'WELTRAUM KAISER: STAR CROWN', de: 'WELTRAUM-KAISER: STERNENKRONE', sector: true, finale: true, hp: 60000, prime: true },
};

/** Catalog HP for the L250 prime Kaiser. In-fight HP still multiplies by heat() and TUNE_BOSS. */
export const PRIME_KAISER_HP = 60000;
export const PRIME_KAISER_PHASES = 10;
/** HP fraction cutoffs: a new phase starts each time remaining HP crosses one of these. */
export const PRIME_KAISER_THRESHOLDS = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1] as const;

export function primeKaiserPhase(hpFrac: number): number {
  const fr = Math.max(0, Math.min(1, hpFrac));
  for (let i = 0; i < PRIME_KAISER_THRESHOLDS.length; i++) {
    if (fr > PRIME_KAISER_THRESHOLDS[i]) return i + 1;
  }
  return PRIME_KAISER_PHASES;
}

function remixHp(L: number): number {
  return Math.round(330 + 17 * (L - 18));
}

function lateHp(L: number): number {
  return Math.round(4800 + 20 * (L - 100));
}

export function isBossLevel(level: number): boolean {
  const L = Math.floor(level);
  return L > 0 && (L % 3 === 0 || L === 100 || L === 250);
}

export function isSectorBoss(level: number): boolean {
  return (SECTOR_BOSS_LEVELS as readonly number[]).includes(Math.floor(level));
}

export function allBossLevels(): number[] {
  const out: number[] = [];
  for (let L = 3; L <= 249; L += 3) out.push(L);
  if (!out.includes(100)) out.push(100);
  if (!out.includes(250)) out.push(250);
  return out.sort((a, b) => a - b);
}

export function worldForLevel(level: number): WorldDef {
  const L = Math.floor(level);
  for (let i = WORLDS.length - 1; i > 0; i--) {
    if (L >= WORLDS[i].from) return WORLDS[i];
  }
  return WORLDS[0];
}

export function worldIndex(level: number): number {
  const L = Math.floor(level);
  for (let i = WORLDS.length - 1; i > 0; i--) {
    if (L >= WORLDS[i].from) return i;
  }
  return 0;
}

function buildBosses(): BossEntry[] {
  const levels = allBossLevels();
  let art = 0;
  let modI = 0;
  return levels.map((L) => {
    const named = NAMED[L];
    if (named) {
      const mods = L <= 15 ? [] : MODS[++modI] || ['laser'];
      return {
        L,
        type: named.type,
        hp: named.hp,
        nameEn: named.en,
        nameDe: named.de,
        mods,
        art: -1,
        sector: named.sector,
        finale: named.finale,
      };
    }
    const neu = NEW_BOSSES[L];
    const re = RETHEME[L];
    const mods = MODS[++modI] || ['laser', 'drones'];
    const hp = neu?.hp ?? (L > 100 ? lateHp(L) : remixHp(L));
    const dedicated = !!(neu && neu.type !== 'art');
    return {
      L,
      type: neu?.type || 'art',
      hp,
      nameEn: neu?.en || re?.en || `SPACE MECH ${L}`,
      nameDe: neu?.de || re?.de || `WELTRAUM-MECH ${L}`,
      mods,
      art: dedicated ? -1 : art++,
      sector: neu?.sector || isSectorBoss(L),
      finale: neu?.finale,
      prime: neu?.prime,
    };
  });
}

export const BOSSES: BossEntry[] = buildBosses();
export const BOSS_BY_LEVEL: Map<number, BossEntry> = new Map(BOSSES.map((b) => [b.L, b]));

export function bossForLevel(level: number): BossEntry | undefined {
  return BOSS_BY_LEVEL.get(Math.floor(level));
}

/** Unique silhouette recipe — same hull never shares the same limbs/crown/guns. */
export type ArtRecipe = {
  art: number;
  hull: number;
  limbs: number;
  crown: number;
  guns: number;
  orbit: number;
  hue: number;
  hue2: number;
  hue3?: number;
  body?: number;
  limbN?: number;
  kind?: number;
  form?: string;
};

/** One named body per L101–249 art boss. Sector bosses keep dedicated draw fns. */
export const LATE_ART_FORMS: Record<number, string> = {
  102: 'rivetDrone', 105: 'craneMech', 108: 'welderRig', 111: 'dockClamp',
  114: 'boltHowitzer', 117: 'hullSaw', 123: 'launchClamp', 126: 'slagFurnace',
  129: 'magmaPress', 132: 'smelterWalker', 135: 'ingotCannon', 138: 'cruciblePod',
  141: 'forgeHammer', 144: 'lavaRail', 147: 'ashBarge', 153: 'frostProbe',
  156: 'iceAuger', 159: 'cryoTurret', 162: 'vaultLock', 165: 'brineTank',
  168: 'searchTurret', 171: 'crackerRig', 177: 'ringShear', 180: 'spokeDestroyer',
  183: 'shepherdSat', 186: 'icePipe', 189: 'hexSail', 192: 'orbitScythe',
  195: 'spokeFort', 201: 'stormCoil', 204: 'tiltGyro', 207: 'methaneWing',
  210: 'diamondTurret', 213: 'sideCruiser', 216: 'auroraFan', 219: 'iceRam',
  222: 'vortexTurbine', 228: 'cometRack', 231: 'plutoSpire', 234: 'charonGate',
  237: 'oortNeedle', 240: 'pincerDeck', 243: 'haloRing', 246: 'iceWalker',
  249: 'voidDelta',
};

export function bossArtRecipe(art: number): ArtRecipe {
  const a = Math.max(0, Math.floor(art));
  return {
    art: a,
    hull: a % 24,
    limbs: Math.floor(a / 24) % 8,
    crown: (a * 3 + 1) % 8,
    guns: (a * 2 + 2) % 6,
    orbit: (a * 5 + 3) % 5,
    hue: (a * 47 + 18) % 360,
    hue2: (a * 47 + 18 + 130) % 360,
  };
}

/** L101–249 art bosses: unique body form per level. Keep in lockstep with HTML artRecipe(). */
export function lateBossArtRecipe(level: number): ArtRecipe {
  const L = Math.floor(level);
  const a = Math.max(0, L - 101);
  return {
    art: a,
    hull: a % 20,
    limbs: Math.floor(a / 2) % 8,
    crown: 0,
    guns: 2 + ((a * 2 + 2) % 5),
    orbit: 1 + ((a * 5 + 3) % 5),
    hue: (a * 47 + 18) % 360,
    hue2: (a * 47 + 148) % 360,
    hue3: (a * 29 + 80) % 360,
    body: a % 4,
    limbN: 3 + (a % 4),
    kind: L,
    form: LATE_ART_FORMS[L] || `late${L}`,
  };
}

export function lateBossLevels(): number[] {
  return allBossLevels().filter((L) => L >= 101 && L <= 249);
}

export function bossNamesForLang(lang: 'en' | 'de'): Record<string, string> {
  const out: Record<string, string> = { default: lang === 'de' ? 'BOSS' : 'BOSS' };
  for (const b of BOSSES) out[`l${b.L}`] = lang === 'de' ? b.nameDe : b.nameEn;
  out.l18b = lang === 'de' ? 'GREIFARM-MUTTERSCHIFF' : 'GRABBER MOTHERSHIP';
  out.l18 = lang === 'de' ? 'ROBO-WELTRAUM-KAISER' : 'ROBO SPACE EMPEROR';
  return out;
}
