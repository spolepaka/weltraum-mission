/**
 * 30 unlockable ships for levels 105–250 (one every 5 levels).
 * Keep HTML SHIPS[] / DESIGNS / server VALID_SHIPS / versus SHIP_COMBAT in lockstep.
 */

export const OUTER_TAB = 6;
export const OUTER_TAB_KEY = 'tabOuter' as const;

export type OuterShape =
  | 'kite' | 'gantry' | 'torch' | 'needle' | 'bolt' | 'beetle' | 'hopper' | 'pike'
  | 'manta' | 'hulk' | 'crucible' | 'anvil' | 'shard' | 'auger' | 'crescent'
  | 'vault' | 'fish' | 'ring' | 'spoke' | 'crook' | 'hexsail' | 'scythe'
  | 'coil' | 'tilt' | 'saucer' | 'ribbon' | 'spine' | 'spire' | 'gate' | 'crown';

export type OuterShip = {
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
    shape: OuterShape;
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

const SHAPES: OuterShape[] = [
  'kite', 'gantry', 'torch', 'needle', 'bolt', 'beetle', 'hopper', 'pike',
  'manta', 'hulk', 'crucible', 'anvil', 'shard', 'auger', 'crescent',
  'vault', 'fish', 'ring', 'spoke', 'crook', 'hexsail', 'scythe',
  'coil', 'tilt', 'saucer', 'ribbon', 'spine', 'spire', 'gate', 'crown',
];

function flame(a: string, b: string, c: string): [string, string, string] {
  return [a, b, c];
}

const PALETTES: Array<[string, string, string, string, string, string]> = [
  ['#f0c8a8', '#b06a3a', '#3a1a10', '#ffd0a0', '#7dffea', '#4ec3ff'],
  ['#ffe066', '#c0a020', '#3a2a08', '#fff6c8', '#2330ff', '#8090ff'],
  ['#ffb060', '#d05010', '#3a1008', '#ffe0a0', '#ff6a1a', '#ffd54a'],
  ['#d8e0f0', '#6a7890', '#1a2030', '#ffffff', '#7dffff', '#4ec3ff'],
  ['#c8c8d8', '#5a5a6a', '#1a1a24', '#ff9a3a', '#ff6a1a', '#ffe0a0'],
  ['#c09070', '#6a3a28', '#201008', '#ffc090', '#ff7a40', '#3a2010'],
  ['#8a8a6a', '#4a3a20', '#1a140c', '#c8b080', '#ff9a3a', '#6a4a20'],
  ['#ff6a2a', '#8a1a0a', '#2a0808', '#ffd0a0', '#ff3a1a', '#ffe066'],
  ['#ff8a40', '#a03010', '#2a0c08', '#ffd0a8', '#ff5020', '#fff0c0'],
  ['#b0b0c0', '#4a4a58', '#14141c', '#e0e0f0', '#7dffe0', '#3a3a4a'],
  ['#ff7040', '#7a2010', '#220808', '#ffc090', '#ff5020', '#ffd54a'],
  ['#d0a060', '#6a4018', '#241408', '#ffe0b0', '#ffb02a', '#4a2a10'],
  ['#c8f0ff', '#3a7aa0', '#0a2030', '#ffffff', '#7dffff', '#bff4ff'],
  ['#a0d8f0', '#2a5a80', '#081828', '#e8fbff', '#4ec3ff', '#ffffff'],
  ['#e0f4ff', '#4080b0', '#0c2438', '#ffffff', '#7dffff', '#c8f6ff'],
  ['#c0a870', '#4a3820', '#181008', '#ffe8b0', '#ffd54a', '#7dffe0'],
  ['#70c8c0', '#1a4a4a', '#081818', '#c8fff4', '#7dffea', '#3affd0'],
  ['#e0c8ff', '#5a3a9a', '#1a0a30', '#ffffff', '#c08cff', '#ffe066'],
  ['#f0d080', '#6a4a18', '#201408', '#fff4c8', '#ffd54a', '#ffffff'],
  ['#b8d0ff', '#304878', '#0c1428', '#e8f0ff', '#7dffff', '#c08cff'],
  ['#ffe9a0', '#a07018', '#2a1c08', '#fffbe0', '#ffd54a', '#ffffff'],
  ['#d0e8ff', '#305080', '#0a1830', '#ffffff', '#7dffff', '#c08cff'],
  ['#b0e0ff', '#2050a0', '#081830', '#ffffff', '#7dffff', '#fff27a'],
  ['#c8b8ff', '#3a2a70', '#120828', '#f0e8ff', '#c08cff', '#7dffff'],
  ['#7dffff', '#1a6a6a', '#082028', '#e8fffb', '#4ec3ff', '#ffffff'],
  ['#ffb0e0', '#6a2080', '#200828', '#ffe0f4', '#ff8ae0', '#7dffff'],
  ['#e8f0ff', '#506080', '#101828', '#ffffff', '#c8f6ff', '#7dffff'],
  ['#c0c8e0', '#2a3050', '#0a0c18', '#ffffff', '#7dffff', '#c08cff'],
  ['#e0d0ff', '#3a2060', '#140828', '#ffffff', '#c08cff', '#ffd54a'],
  ['#fff6c8', '#c09020', '#2a1c08', '#ffffff', '#ffd54a', '#7dffff'],
];

function kitFor(i: number): OuterShip['kit'] {
  const [c1, c2, c3, edge, acc, glass] = PALETTES[i];
  const auraR = 48 + Math.floor(i / 5) * 6;
  return {
    shape: SHAPES[i],
    wing: [36 + (i % 5) * 2, 8],
    c: [c1, c2, c3],
    edge,
    acc,
    glass,
    eng: i >= 24
      ? [[-14, 30, 16, 6], [14, 30, 16, 6], [0, 34, 22, 8]]
      : i >= 16
        ? [[-10, 30, 16, 6], [10, 30, 16, 6]]
        : [[0, 30, 20, 7]],
    core: acc,
    len: 40 + Math.min(12, Math.floor(i / 3)),
    bw: 10 + Math.floor(i / 6),
    aura: [auraR, `${acc}38`, `${c3}00`],
  };
}

const NAMES: Array<[string, string, string, string, string, string, string]> = [
  ['rivet', 'Rivet Kite', 'Nieten-Drachen', 'Twin rivet shots', 'Doppel-Nieten', 'A dockyard kite that fires rivet bolts.', 'Ein Werft-Drachen mit Nietenschüssen.'],
  ['crane', 'Crane Wing', 'Kran-Flügel', 'Pierce crane beam', 'Kran-Strahl durch alles', 'Long crane wings punch a hole through foes.', 'Lange Kran-Flügel durchschlagen Gegner.'],
  ['welder', 'Welder Skip', 'Schweiss-Skip', 'Burn sparks', 'Schweiss-Funken', 'Sparks set rocks on fire.', 'Funken setzen Steine in Brand.'],
  ['dockn', 'Drydock Needle', 'Dock-Nadel', 'Tiny + pierce', 'Winzig + Durchschuss', 'A slim needle from the drydock. Hard to hit!', 'Eine schlanke Nadel aus dem Trockendock. Schwer zu treffen!'],
  ['boltfin', 'Bolt Fin', 'Bolzen-Finne', 'Homing bolts', 'Zielsuch-Bolzen', 'Fins fire bolts that chase the target.', 'Flossen schießen Bolzen, die das Ziel suchen.'],
  ['hullmite', 'Hull Mite', 'Rumpf-Milbe', 'Split mites', 'Splitter-Milben', 'Hits burst into two tiny mites.', 'Treffer zerplatzen in zwei kleine Milben.'],
  ['slagskip', 'Slag Skip', 'Schlacken-Skip', 'Quake slag', 'Schlacken-Beben', 'Drops heavy slag that shakes the lane.', 'Wirft schwere Schlacke, die die Bahn bebt.'],
  ['magmapike', 'Magma Pike', 'Magma-Pike', 'Fire pike + shield', 'Feuer-Pike + Schild', 'A magma lance with a slow shield pulse.', 'Eine Magma-Lanze mit langsamem Schildpuls.'],
  ['smeltwing', 'Smelter Wing', 'Schmelz-Flügel', 'Burn + wing escorts', 'Brand + Begleiter', 'Two hot escorts fly beside you.', 'Zwei heiße Begleiter fliegen neben dir.'],
  ['ingothulk', 'Ingot Hulk', 'Barren-Koloss', 'Triple ingot + shield', 'Dreifach-Barren + Schild', 'A heavy foundry tank. Slow shots, big hearts.', 'Ein schwerer Gießerei-Panzer. Langsame Schüsse, große Herzen.'],
  ['crucibit', 'Crucible Bit', 'Tiegel-Bit', 'Nova melt', 'Nova-Schmelze', 'Every few seconds a melt-wave pops nearby foes.', 'Alle paar Sekunden knallt eine Schmelz-Welle.'],
  ['forgefin', 'Forge Fin', 'Schmiede-Finne', 'Pierce + hammer drone', 'Durchschuss + Hammer-Drohne', 'A finned forge craft with one hammer drone.', 'Ein Flossen-Schmiedeschiff mit einer Hammer-Drohne.'],
  ['frostbit', 'Frost Bit', 'Frost-Bit', 'Ice shots freeze', 'Eis-Schüsse frieren', 'Tiny ice bits freeze nearby rocks.', 'Kleine Eis-Bits frieren Steine in der Nähe.'],
  ['iceauger', 'Ice Auger', 'Eis-Bohrer', 'Pierce auger', 'Bohr-Durchschuss', 'Drills straight through every foe in the lane.', 'Bohrt gerade durch alle Gegner in der Bahn.'],
  ['cryowing', 'Cryo Wing', 'Kryo-Flügel', 'Frost aura + 3 shots', 'Frost-Aura + 3 Schüsse', 'A cold field slows bombs around you.', 'Ein Kältefeld bremst Bomben um dich.'],
  ['vaultskip', 'Vault Skip', 'Tresor-Skip', 'Phase vault shots', 'Phasen-Tresor-Schüsse', 'Shots slip through walls of ice.', 'Schüsse gleiten durch Eiswände.'],
  ['brinefin', 'Brine Fin', 'Laugen-Finne', 'Homing brine', 'Zielsuch-Lauge', 'Salty homing darts from Europa.', 'Salzige Such-Pfeile von Europa.'],
  ['ringshear', 'Ring Shear', 'Ring-Schere', 'Split ring blades', 'Splitter-Ringklingen', 'Each hit shears into two ring blades.', 'Jeder Treffer teilt sich in zwei Ringklingen.'],
  ['spokejet', 'Spoke Jet', 'Speichen-Jet', 'Rapid spokes', 'Schnelle Speichen', 'Fast Saturn jet. Shoots a lot!', 'Schneller Saturn-Jet. Schießt viel!'],
  ['shepwing', 'Shepherd Wing', 'Hirten-Flügel', 'Homing + 2 shepherds', 'Zielsuchend + 2 Hirten', 'Two moon-shepherds fire with you.', 'Zwei Mond-Hirten schießen mit.'],
  ['hexsail', 'Hex Sail', 'Hex-Segel', 'Sunbeam through all', 'Sonnenstrahl durch alles', 'Hex sails hold a continuous beam.', 'Hex-Segel halten einen Dauerstrahl.'],
  ['scythesk', 'Orbital Scythe', 'Orbit-Sense', 'Pierce scythe + gravity', 'Sense + Schwerkraft', 'A ring scythe that pulls foes in.', 'Eine Ringsense, die Gegner anzieht.'],
  ['stormcoil', 'Storm Coil', 'Sturm-Spule', 'Chain lightning', 'Kettenblitz', 'Hits jump to two more foes.', 'Treffer springen auf zwei weitere Gegner.'],
  ['tiltwing', 'Tilt Wing', 'Kipp-Flügel', 'Phase + slow-mo', 'Phase + Zeitlupe', 'Tilts out of danger and slows time.', 'Kippt aus der Gefahr und bremst die Zeit.'],
  ['methanray', 'Methane Ray', 'Methan-Strahl', 'Beam + shield', 'Strahl + Schild', 'A cyan methane beam from Uranus.', 'Ein cyaner Methan-Strahl von Uranus.'],
  ['aurorafin', 'Aurora Fin', 'Aurora-Finne', 'Prism aurora shots', 'Prisma-Aurora', 'Five colorful aurora shots.', 'Fünf bunte Aurora-Schüsse.'],
  ['oortneedle', 'Oort Needle', 'Oort-Nadel', 'Tiny pierce needle', 'Winzige Durchschuss-Nadel', 'A Kuiper needle. Very small, very sharp.', 'Eine Kuiper-Nadel. Sehr klein, sehr scharf.'],
  ['plutospire', 'Pluto Spire', 'Pluto-Turm', 'Homing + 2 drones', 'Zielsuchend + 2 Drohnen', 'A dark spire with two ice drones.', 'Ein dunkler Turm mit zwei Eis-Drohnen.'],
  ['charongate', 'Charon Gate', 'Charon-Tor', 'Nova + clone', 'Nova + Klon', 'Opens a gate-clone on the other side.', 'Öffnet einen Tor-Klon auf der anderen Seite.'],
  ['starcrown', 'Star Crown', 'Sternenkrone', 'Omega crown + drones', 'Omega-Krone + Drohnen', 'Reward for the Weltraum Kaiser at 250! Crown shots seek and pierce.', 'Belohnung für den Weltraum-Kaiser auf 250! Kronen-Schüsse suchen und durchschlagen.'],
];

const PERKS: Array<[string, string, number?]> = [
  ['', '', 0],
  ['pierce', '', 0],
  ['burn', '', 0],
  ['small', 'pierce', 0],
  ['homing', '', 0],
  ['split', '', 0],
  ['quake', '', 0],
  ['burn', '', 0],
  ['burn', 'wing', 0],
  ['', '', 0],
  ['nova', '', 0],
  ['pierce', 'orbit', 1],
  ['freeze', '', 0],
  ['pierce', '', 0],
  ['freeze', 'frostaura', 0],
  ['phase', '', 0],
  ['homing', '', 0],
  ['split', '', 0],
  ['', '', 0],
  ['homing', 'wing', 0],
  ['beam', '', 0],
  ['pierce', 'gravity', 0],
  ['chain', '', 0],
  ['phase', 'timeslow', 0],
  ['beam', '', 0],
  ['prism', '', 0],
  ['small', 'pierce', 0],
  ['homing', 'orbit', 2],
  ['nova', 'clone', 0],
  ['omega', 'timeslow', 2],
];

export const OUTER_SHIPS: OuterShip[] = NAMES.map((row, i) => {
  const unlockL = 105 + i * 5;
  const [perk, perk2, drones] = PERKS[i];
  const hearts = 5 + Math.floor(i / 8);
  const speed = Math.round((1.35 + i * 0.012) * 100) / 100;
  const rate = Math.round((0.26 - i * 0.002) * 1000) / 1000;
  const shots = i < 8 ? 2 : i < 20 ? 2 + (i % 2) : 3;
  const dmg = Math.round((3.0 + i * 0.09) * 100) / 100;
  const regen = i === 29 ? 12 : i >= 7 && i % 4 === 3 ? 12 + Math.floor(i / 6) : i >= 9 && i % 5 === 0 ? 14 : 0;
  const hue = (i * 41 + 12) % 360;
  const bulletHue = (hue + 160) % 360;
  return {
    id: row[0],
    unlockL,
    nameEn: row[1],
    nameDe: row[2],
    perkEn: row[3],
    perkDe: row[4],
    descEn: row[5],
    descDe: row[6],
    hearts,
    speed,
    rate,
    shots: Math.min(3, shots),
    dmg,
    regen,
    perk,
    perk2,
    drones: drones || undefined,
    hitR: perk === 'small' ? 13 : undefined,
    bullet: `hsl(${bulletHue},85%,70%)`,
    flame: flame('255,255,255', `${80 + (i % 8) * 12},${160 + (i % 5) * 10},255`, `${30 + i},${70},200`),
    kit: kitFor(i),
  };
});

export const OUTER_IDS = OUTER_SHIPS.map((s) => s.id);

export function outerById(id: string): OuterShip | undefined {
  return OUTER_SHIPS.find((s) => s.id === id);
}

export function outerI18n(lang: 'en' | 'de'): Record<string, { name: string; perk: string; desc: string }> {
  const out: Record<string, { name: string; perk: string; desc: string }> = {};
  for (const s of OUTER_SHIPS) {
    out[s.id] = lang === 'de'
      ? { name: s.nameDe, perk: s.perkDe, desc: s.descDe }
      : { name: s.nameEn, perk: s.perkEn, desc: s.descEn };
  }
  return out;
}

export function outerUnlockMap(): Record<string, { level: number }> {
  const out: Record<string, { level: number }> = {};
  for (const s of OUTER_SHIPS) out[s.id] = { level: s.unlockL };
  return out;
}

export function outerCombat(): Record<string, {
  hearts: number; speed: number; rate: number; shots: number; dmg: number;
  regen: number; hitR?: number; perk?: string; perk2?: string; drones?: number;
}> {
  const out: Record<string, {
    hearts: number; speed: number; rate: number; shots: number; dmg: number;
    regen: number; hitR?: number; perk?: string; perk2?: string; drones?: number;
  }> = {};
  for (const s of OUTER_SHIPS) {
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
