/** Keep in lockstep with src/lib/outer-ships.ts — spacetime cannot import the client tree. */

export const OUTER_TAB = 6;

export const OUTER_SHIPS: Array<{
  id: string;
  unlockL: number;
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
}> = [
  { id: 'rivet', unlockL: 105, hearts: 5, speed: 1.35, rate: 0.26, shots: 2, dmg: 3, regen: 0, perk: '', perk2: '' },
  { id: 'crane', unlockL: 110, hearts: 5, speed: 1.36, rate: 0.258, shots: 2, dmg: 3.09, regen: 0, perk: 'pierce', perk2: '' },
  { id: 'welder', unlockL: 115, hearts: 5, speed: 1.37, rate: 0.256, shots: 2, dmg: 3.18, regen: 0, perk: 'burn', perk2: '' },
  { id: 'dockn', unlockL: 120, hearts: 5, speed: 1.39, rate: 0.254, shots: 2, dmg: 3.27, regen: 0, perk: 'small', perk2: 'pierce', hitR: 13 },
  { id: 'boltfin', unlockL: 125, hearts: 5, speed: 1.4, rate: 0.252, shots: 2, dmg: 3.36, regen: 0, perk: 'homing', perk2: '' },
  { id: 'hullmite', unlockL: 130, hearts: 5, speed: 1.41, rate: 0.25, shots: 2, dmg: 3.45, regen: 0, perk: 'split', perk2: '' },
  { id: 'slagskip', unlockL: 135, hearts: 5, speed: 1.42, rate: 0.248, shots: 2, dmg: 3.54, regen: 0, perk: 'quake', perk2: '' },
  { id: 'magmapike', unlockL: 140, hearts: 5, speed: 1.43, rate: 0.246, shots: 2, dmg: 3.63, regen: 13, perk: 'burn', perk2: '' },
  { id: 'smeltwing', unlockL: 145, hearts: 6, speed: 1.45, rate: 0.244, shots: 2, dmg: 3.72, regen: 0, perk: 'burn', perk2: 'wing' },
  { id: 'ingothulk', unlockL: 150, hearts: 6, speed: 1.46, rate: 0.242, shots: 3, dmg: 3.81, regen: 0, perk: '', perk2: '' },
  { id: 'crucibit', unlockL: 155, hearts: 6, speed: 1.47, rate: 0.24, shots: 2, dmg: 3.9, regen: 14, perk: 'nova', perk2: '' },
  { id: 'forgefin', unlockL: 160, hearts: 6, speed: 1.48, rate: 0.238, shots: 3, dmg: 3.99, regen: 13, perk: 'pierce', perk2: 'orbit', drones: 1 },
  { id: 'frostbit', unlockL: 165, hearts: 6, speed: 1.49, rate: 0.236, shots: 2, dmg: 4.08, regen: 0, perk: 'freeze', perk2: '' },
  { id: 'iceauger', unlockL: 170, hearts: 6, speed: 1.51, rate: 0.234, shots: 3, dmg: 4.17, regen: 0, perk: 'pierce', perk2: '' },
  { id: 'cryowing', unlockL: 175, hearts: 6, speed: 1.52, rate: 0.232, shots: 2, dmg: 4.26, regen: 0, perk: 'freeze', perk2: 'frostaura' },
  { id: 'vaultskip', unlockL: 180, hearts: 6, speed: 1.53, rate: 0.23, shots: 3, dmg: 4.35, regen: 14, perk: 'phase', perk2: '' },
  { id: 'brinefin', unlockL: 185, hearts: 7, speed: 1.54, rate: 0.228, shots: 2, dmg: 4.44, regen: 0, perk: 'homing', perk2: '' },
  { id: 'ringshear', unlockL: 190, hearts: 7, speed: 1.55, rate: 0.226, shots: 3, dmg: 4.53, regen: 0, perk: 'split', perk2: '' },
  { id: 'spokejet', unlockL: 195, hearts: 7, speed: 1.57, rate: 0.224, shots: 2, dmg: 4.62, regen: 0, perk: '', perk2: '' },
  { id: 'shepwing', unlockL: 200, hearts: 7, speed: 1.58, rate: 0.222, shots: 3, dmg: 4.71, regen: 15, perk: 'homing', perk2: 'wing' },
  { id: 'hexsail', unlockL: 205, hearts: 7, speed: 1.59, rate: 0.22, shots: 3, dmg: 4.8, regen: 14, perk: 'beam', perk2: '' },
  { id: 'scythesk', unlockL: 210, hearts: 7, speed: 1.6, rate: 0.218, shots: 3, dmg: 4.89, regen: 0, perk: 'pierce', perk2: 'gravity' },
  { id: 'stormcoil', unlockL: 215, hearts: 7, speed: 1.61, rate: 0.216, shots: 3, dmg: 4.98, regen: 0, perk: 'chain', perk2: '' },
  { id: 'tiltwing', unlockL: 220, hearts: 7, speed: 1.63, rate: 0.214, shots: 3, dmg: 5.07, regen: 15, perk: 'phase', perk2: 'timeslow' },
  { id: 'methanray', unlockL: 225, hearts: 8, speed: 1.64, rate: 0.212, shots: 3, dmg: 5.16, regen: 0, perk: 'beam', perk2: '' },
  { id: 'aurorafin', unlockL: 230, hearts: 8, speed: 1.65, rate: 0.21, shots: 3, dmg: 5.25, regen: 14, perk: 'prism', perk2: '' },
  { id: 'oortneedle', unlockL: 235, hearts: 8, speed: 1.66, rate: 0.208, shots: 3, dmg: 5.34, regen: 0, perk: 'small', perk2: 'pierce', hitR: 13 },
  { id: 'plutospire', unlockL: 240, hearts: 8, speed: 1.67, rate: 0.206, shots: 3, dmg: 5.43, regen: 16, perk: 'homing', perk2: 'orbit', drones: 2 },
  { id: 'charongate', unlockL: 245, hearts: 8, speed: 1.69, rate: 0.204, shots: 3, dmg: 5.52, regen: 0, perk: 'nova', perk2: 'clone' },
  { id: 'starcrown', unlockL: 250, hearts: 8, speed: 1.7, rate: 0.202, shots: 3, dmg: 5.61, regen: 12, perk: 'omega', perk2: 'timeslow', drones: 2 },
];

export const OUTER_IDS = OUTER_SHIPS.map((s) => s.id);

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
      hearts: s.hearts, speed: s.speed, rate: s.rate, shots: s.shots, dmg: s.dmg,
      regen: s.regen, hitR: s.hitR, perk: s.perk || undefined, perk2: s.perk2 || undefined, drones: s.drones,
    };
  }
  return out;
}

export function outerUnlockMap(): Record<string, { level: number }> {
  const out: Record<string, { level: number }> = {};
  for (const s of OUTER_SHIPS) out[s.id] = { level: s.unlockL };
  return out;
}
