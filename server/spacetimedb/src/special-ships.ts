/** Keep in lockstep with src/lib/special-ships.ts — spacetime cannot import the client tree. */

export const SPECIAL_TAB = 4;

export const SPECIAL_SHIPS: Array<{
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
  { id: 'phobosclaw', unlockL: 108, hearts: 12, speed: 1.9, rate: 0.15, shots: 3, dmg: 8.8, regen: 12, perk: 'quake', perk2: 'pulse' },
  { id: 'dockfang', unlockL: 123, hearts: 12, speed: 1.94, rate: 0.146, shots: 3, dmg: 9.38, regen: 12, perk: 'beam', perk2: '', drones: 2 },
  { id: 'slagheart', unlockL: 141, hearts: 13, speed: 1.97, rate: 0.143, shots: 3, dmg: 9.96, regen: 13, perk: 'nova', perk2: 'breath' },
  { id: 'titanbrand', unlockL: 153, hearts: 13, speed: 2.01, rate: 0.139, shots: 4, dmg: 10.54, regen: 13, perk: 'omega', perk2: 'breath' },
  { id: 'icewisp', unlockL: 162, hearts: 14, speed: 2.04, rate: 0.136, shots: 4, dmg: 11.12, regen: 14, perk: 'phase', perk2: 'frostaura' },
  { id: 'vaultmind', unlockL: 174, hearts: 14, speed: 2.08, rate: 0.132, shots: 4, dmg: 11.7, regen: 14, perk: 'pierce', perk2: 'gravity', drones: 2 },
  { id: 'ringsovr', unlockL: 186, hearts: 15, speed: 2.12, rate: 0.128, shots: 4, dmg: 12.28, regen: 15, perk: 'split', perk2: 'wing' },
  { id: 'dreadhalo', unlockL: 198, hearts: 15, speed: 2.15, rate: 0.125, shots: 5, dmg: 12.86, regen: 15, perk: 'homing', perk2: 'orbit', drones: 3 },
  { id: 'stormprism', unlockL: 216, hearts: 16, speed: 2.19, rate: 0.121, shots: 5, dmg: 13.44, regen: 16, perk: 'prism', perk2: 'pulse' },
  { id: 'uranusarc', unlockL: 228, hearts: 16, speed: 2.22, rate: 0.118, shots: 5, dmg: 14.02, regen: 16, perk: 'beam', perk2: 'timeslow' },
  { id: 'kuiperfang', unlockL: 237, hearts: 17, speed: 2.26, rate: 0.114, shots: 5, dmg: 14.6, regen: 17, perk: 'pierce', perk2: 'timeslow' },
  { id: 'voidcrown', unlockL: 248, hearts: 17, speed: 2.3, rate: 0.11, shots: 5, dmg: 15.2, regen: 17, perk: 'omega', perk2: 'clone', drones: 4 },
];

export const SPECIAL_IDS = SPECIAL_SHIPS.map((s) => s.id);

export function specialSalePrice(index: number): number {
  const i = Math.max(0, Math.floor(index) || 0);
  return 240000 + i * 110000 + i * i * 6000;
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
