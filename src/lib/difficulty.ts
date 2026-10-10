export type Difficulty = 'easy' | 'normal' | 'veteran';

export const DIFFICULTY_KEY = 'spaceMissionDifficulty';
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'veteran'];

export const DIFFICULTY_TUNING: Record<Difficulty, {
  enemySpeed: number;
  spawnRate: number;
  bossHp: number;
  extraHearts: number;
  coinMult: number;
  bossAtk: number;
}> = {
  easy: { enemySpeed: 0.78, spawnRate: 0.72, bossHp: 0.72, extraHearts: 1, coinMult: 0.75, bossAtk: 0.8 },
  normal: { enemySpeed: 1, spawnRate: 1, bossHp: 1, extraHearts: 0, coinMult: 1, bossAtk: 1 },
  veteran: { enemySpeed: 1.28, spawnRate: 1.32, bossHp: 1.35, extraHearts: -1, coinMult: 1.5, bossAtk: 1.25 },
};

export function parseDifficulty(raw: unknown): Difficulty {
  return raw === 'easy' || raw === 'veteran' ? raw : 'normal';
}

export function loadDifficulty(): Difficulty {
  try {
    return parseDifficulty(localStorage.getItem(DIFFICULTY_KEY));
  } catch {
    return 'normal';
  }
}

export function saveDifficulty(mode: Difficulty): void {
  try {
    localStorage.setItem(DIFFICULTY_KEY, mode);
  } catch {
    // ignore
  }
}

export function coinCapForLevel(level: number, mode: Difficulty): number {
  return Math.ceil(level * 5000 * DIFFICULTY_TUNING[mode].coinMult);
}

export function scoreCapForLevel(level: number): number {
  return level * 100_000;
}

/** Higher = easier survival. Used by the balance report. */
export function survivalIndex(mode: Difficulty): number {
  const t = DIFFICULTY_TUNING[mode];
  const hearts = Math.max(1, 3 + t.extraHearts);
  return (hearts * 1.15) / (t.enemySpeed * t.spawnRate * t.bossHp * t.bossAtk);
}
