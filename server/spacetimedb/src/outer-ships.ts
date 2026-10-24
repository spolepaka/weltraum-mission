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
  { id: 'rivet', unlockL: 105, hearts: 11, speed: 1.85, rate: 0.16, shots: 3, dmg: 8.2, regen: 10, perk: '', perk2: '' },
  { id: 'crane', unlockL: 110, hearts: 11, speed: 1.86, rate: 0.158, shots: 3, dmg: 8.42, regen: 10, perk: 'pierce', perk2: '' },
  { id: 'welder', unlockL: 115, hearts: 11, speed: 1.88, rate: 0.157, shots: 3, dmg: 8.64, regen: 10, perk: 'burn', perk2: '' },
  { id: 'dockn', unlockL: 120, hearts: 11, speed: 1.89, rate: 0.155, shots: 3, dmg: 8.86, regen: 10, perk: 'small', perk2: 'pierce', hitR: 13 },
  { id: 'boltfin', unlockL: 125, hearts: 11, speed: 1.91, rate: 0.154, shots: 3, dmg: 9.08, regen: 12, perk: 'homing', perk2: '' },
  { id: 'hullmite', unlockL: 130, hearts: 11, speed: 1.92, rate: 0.152, shots: 3, dmg: 9.3, regen: 12, perk: 'split', perk2: '' },
  { id: 'slagskip', unlockL: 135, hearts: 12, speed: 1.93, rate: 0.15, shots: 3, dmg: 9.52, regen: 12, perk: 'quake', perk2: '' },
  { id: 'magmapike', unlockL: 140, hearts: 12, speed: 1.95, rate: 0.149, shots: 3, dmg: 9.74, regen: 15, perk: 'burn', perk2: '' },
  { id: 'smeltwing', unlockL: 145, hearts: 12, speed: 1.96, rate: 0.147, shots: 4, dmg: 9.96, regen: 12, perk: 'burn', perk2: 'wing' },
  { id: 'ingothulk', unlockL: 150, hearts: 12, speed: 1.98, rate: 0.146, shots: 4, dmg: 10.18, regen: 12, perk: '', perk2: '' },
  { id: 'crucibit', unlockL: 155, hearts: 12, speed: 1.99, rate: 0.144, shots: 4, dmg: 10.4, regen: 16, perk: 'nova', perk2: '' },
  { id: 'forgefin', unlockL: 160, hearts: 12, speed: 2, rate: 0.142, shots: 4, dmg: 10.62, regen: 16, perk: 'pierce', perk2: 'orbit', drones: 2 },
  { id: 'frostbit', unlockL: 165, hearts: 13, speed: 2.02, rate: 0.141, shots: 4, dmg: 10.84, regen: 12, perk: 'freeze', perk2: '' },
  { id: 'iceauger', unlockL: 170, hearts: 13, speed: 2.03, rate: 0.139, shots: 4, dmg: 11.06, regen: 12, perk: 'pierce', perk2: '' },
  { id: 'cryowing', unlockL: 175, hearts: 13, speed: 2.05, rate: 0.138, shots: 4, dmg: 11.28, regen: 12, perk: 'freeze', perk2: 'frostaura' },
  { id: 'vaultskip', unlockL: 180, hearts: 13, speed: 2.06, rate: 0.136, shots: 4, dmg: 11.5, regen: 17, perk: 'phase', perk2: '' },
  { id: 'brinefin', unlockL: 185, hearts: 13, speed: 2.07, rate: 0.134, shots: 4, dmg: 11.72, regen: 12, perk: 'homing', perk2: '' },
  { id: 'ringshear', unlockL: 190, hearts: 13, speed: 2.09, rate: 0.133, shots: 4, dmg: 11.94, regen: 12, perk: 'split', perk2: '' },
  { id: 'spokejet', unlockL: 195, hearts: 14, speed: 2.1, rate: 0.131, shots: 5, dmg: 12.16, regen: 12, perk: '', perk2: '' },
  { id: 'shepwing', unlockL: 200, hearts: 14, speed: 2.12, rate: 0.13, shots: 5, dmg: 12.38, regen: 17, perk: 'homing', perk2: 'wing' },
  { id: 'hexsail', unlockL: 205, hearts: 14, speed: 2.13, rate: 0.128, shots: 5, dmg: 12.6, regen: 16, perk: 'beam', perk2: '' },
  { id: 'scythesk', unlockL: 210, hearts: 14, speed: 2.14, rate: 0.126, shots: 5, dmg: 12.82, regen: 12, perk: 'pierce', perk2: 'gravity' },
  { id: 'stormcoil', unlockL: 215, hearts: 14, speed: 2.16, rate: 0.125, shots: 5, dmg: 13.04, regen: 12, perk: 'chain', perk2: '' },
  { id: 'tiltwing', unlockL: 220, hearts: 14, speed: 2.17, rate: 0.123, shots: 5, dmg: 13.26, regen: 18, perk: 'phase', perk2: 'timeslow' },
  { id: 'methanray', unlockL: 225, hearts: 15, speed: 2.19, rate: 0.122, shots: 5, dmg: 13.48, regen: 12, perk: 'beam', perk2: '' },
  { id: 'aurorafin', unlockL: 230, hearts: 15, speed: 2.2, rate: 0.12, shots: 5, dmg: 13.7, regen: 16, perk: 'prism', perk2: '' },
  { id: 'oortneedle', unlockL: 235, hearts: 15, speed: 2.21, rate: 0.118, shots: 5, dmg: 13.92, regen: 12, perk: 'small', perk2: 'pierce', hitR: 13 },
  { id: 'plutospire', unlockL: 240, hearts: 15, speed: 2.23, rate: 0.117, shots: 5, dmg: 14.14, regen: 19, perk: 'homing', perk2: 'orbit', drones: 3 },
  { id: 'charongate', unlockL: 245, hearts: 15, speed: 2.24, rate: 0.115, shots: 5, dmg: 14.36, regen: 12, perk: 'nova', perk2: 'clone' },
  { id: 'starcrown', unlockL: 250, hearts: 16, speed: 2.26, rate: 0.114, shots: 5, dmg: 14.58, regen: 16, perk: 'omega', perk2: 'timeslow', drones: 4 },
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
