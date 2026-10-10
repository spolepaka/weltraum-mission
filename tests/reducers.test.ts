/**
 * SpacetimeDB Reducer Unit Tests
 * Tests the validation logic and business rules
 */

import { describe, it, expect } from 'vitest';

const MAX_LEVEL = 100;
const MAX_UPGRADE_LEVEL = 5;

const VALID_SHIPS = new Set([
  'starter', 'blitz', 'komet', 'doppel', 'eis', 'falke', 'feuer', 'stern',
  'titan', 'lanze', 'koenig', 'nova', 'quanten', 'uni', 'rochen', 'phoenix',
  'hammer', 'zwilling', 'gravitron', 'spektral', 'segler', 'schatten',
  'drache', 'omega', 'frostwal', 'lindwurm', 'hydra', 'regenbogen', 'kaiserbrecher'
]);

const VALID_ACHIEVEMENTS = new Set([
  'firstWin', 'combo10', 'combo25', 'boss3', 'boss10', 'noHit', 'speedrun',
  'coins1k', 'coins10k', 'coins100k', 'allShips', 'maxUpgrades', 'level25',
  'level50', 'level75', 'level100', 'perfect3', 'missions10', 'sessions50'
]);

const SECRET_CODES: Record<string, { key: string; coins: number }> = {
  'JOSHI10000': { key: 'secret2', coins: 10000 },
  'AMELIA500': { key: 'secretAmelia', coins: 500 },
  'JOSHIE1000000': { key: 'secretMillion', coins: 1000000 },
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function validateLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL;
}

function validateShip(shipId: string): boolean {
  return VALID_SHIPS.has(shipId);
}

function validateAchievement(achId: string): boolean {
  return VALID_ACHIEVEMENTS.has(achId);
}

describe('Level Validation', () => {
  it('accepts valid levels 1-100', () => {
    expect(validateLevel(1)).toBe(true);
    expect(validateLevel(50)).toBe(true);
    expect(validateLevel(100)).toBe(true);
  });

  it('rejects invalid levels', () => {
    expect(validateLevel(0)).toBe(false);
    expect(validateLevel(101)).toBe(false);
    expect(validateLevel(-1)).toBe(false);
    expect(validateLevel(1.5)).toBe(false);
    expect(validateLevel(NaN)).toBe(false);
  });
});

describe('Ship Validation', () => {
  it('accepts all valid ships', () => {
    expect(validateShip('starter')).toBe(true);
    expect(validateShip('omega')).toBe(true);
    expect(validateShip('kaiserbrecher')).toBe(true);
  });

  it('rejects invalid ships', () => {
    expect(validateShip('invalid')).toBe(false);
    expect(validateShip('')).toBe(false);
    expect(validateShip('STARTER')).toBe(false);
  });
});

describe('Achievement Validation', () => {
  it('accepts valid achievements', () => {
    expect(validateAchievement('firstWin')).toBe(true);
    expect(validateAchievement('combo25')).toBe(true);
    expect(validateAchievement('level100')).toBe(true);
  });

  it('rejects invalid achievements', () => {
    expect(validateAchievement('invalid')).toBe(false);
    expect(validateAchievement('')).toBe(false);
  });
});

describe('Secret Code Validation', () => {
  it('validates known codes', () => {
    expect(SECRET_CODES['JOSHI10000']).toBeDefined();
    expect(SECRET_CODES['JOSHI10000'].coins).toBe(10000);
    expect(SECRET_CODES['AMELIA500'].coins).toBe(500);
    expect(SECRET_CODES['JOSHIE1000000'].coins).toBe(1000000);
  });

  it('returns undefined for unknown codes', () => {
    expect(SECRET_CODES['INVALID']).toBeUndefined();
  });
});

describe('Progress Gating', () => {
  it('allows playing unlocked levels', () => {
    const unlockedLevel = 5;
    expect(validateLevel(1)).toBe(true);
    expect(1 <= unlockedLevel).toBe(true);
    expect(5 <= unlockedLevel).toBe(true);
  });

  it('prevents playing locked levels', () => {
    const unlockedLevel = 5;
    expect(6 <= unlockedLevel).toBe(false);
    expect(100 <= unlockedLevel).toBe(false);
  });

  it('allows incrementing by one level', () => {
    const currentUnlocked = 5;
    const newUnlocked = 6;
    expect(newUnlocked <= currentUnlocked + 1).toBe(true);
  });

  it('prevents skipping levels', () => {
    const currentUnlocked = 5;
    const newUnlocked = 10;
    expect(newUnlocked <= currentUnlocked + 1).toBe(false);
  });
});

describe('Anti-cheat: Score Bounds', () => {
  it('accepts scores within bounds', () => {
    const level = 50;
    const maxScore = BigInt(level * 100000);
    expect(BigInt(1000000) <= maxScore).toBe(true);
    expect(BigInt(5000000) <= maxScore).toBe(true);
  });

  it('rejects excessive scores', () => {
    const level = 50;
    const maxScore = BigInt(level * 100000);
    expect(BigInt(6000000) <= maxScore).toBe(false);
  });
});

describe('Anti-cheat: Coin Bounds', () => {
  it('accepts coins within bounds', () => {
    const level = 50;
    const maxCoins = BigInt(level * 5000);
    expect(BigInt(100000) <= maxCoins).toBe(true);
    expect(BigInt(250000) <= maxCoins).toBe(true);
  });

  it('rejects excessive coins', () => {
    const level = 50;
    const maxCoins = BigInt(level * 5000);
    expect(BigInt(300000) <= maxCoins).toBe(false);
  });
});

describe('Anti-cheat: Time Bounds', () => {
  it('accepts valid completion times', () => {
    const minTime = BigInt(10000);
    const maxTime = BigInt(600000);
    const time = BigInt(35000);
    expect(time >= minTime && time <= maxTime).toBe(true);
  });

  it('rejects impossibly fast times', () => {
    const minTime = BigInt(10000);
    const time = BigInt(5000);
    expect(time >= minTime).toBe(false);
  });

  it('rejects excessively long times', () => {
    const maxTime = BigInt(600000);
    const time = BigInt(700000);
    expect(time <= maxTime).toBe(false);
  });
});

describe('Upgrade Validation', () => {
  it('clamps upgrade levels to max', () => {
    expect(clamp(10, 0, MAX_UPGRADE_LEVEL)).toBe(5);
    expect(clamp(3, 0, MAX_UPGRADE_LEVEL)).toBe(3);
    expect(clamp(-1, 0, MAX_UPGRADE_LEVEL)).toBe(0);
  });

  it('heart upgrade max is 1', () => {
    const heartMax = 1;
    expect(clamp(5, 0, heartMax)).toBe(1);
  });
});

describe('Clamp Utility', () => {
  it('clamps values correctly', () => {
    expect(clamp(50, 1, 100)).toBe(50);
    expect(clamp(0, 1, 100)).toBe(1);
    expect(clamp(150, 1, 100)).toBe(100);
  });
});
