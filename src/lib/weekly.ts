import { BUNDLED_LEVELS, MAX_LEVEL } from './level-catalog';

export function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function weeklyChallenge(weekKey = isoWeekKey()): { weekKey: string; level: number; seed: number } {
  const seed = hashSeed(weekKey + ':space-challenge');
  const span = Math.max(1, MAX_LEVEL - BUNDLED_LEVELS);
  const level = BUNDLED_LEVELS + 1 + (seed % Math.min(30, span));
  return { weekKey, level, seed };
}

export interface BoardRow {
  rank: number;
  name: string;
  score: number;
  mode: string;
  me?: boolean;
}
