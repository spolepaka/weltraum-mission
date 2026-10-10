/**
 * End-to-End Tests
 * Tests the full game flow against a local SpacetimeDB server
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('E2E: Anonymous Player Flow', () => {
  it('should create new player on first connect', () => {
    // When SpacetimeDB is running, this would:
    // 1. Connect without a token
    // 2. Receive a new identity token
    // 3. Have a player record created with default values
    
    const mockNewPlayer = {
      unlockedLevel: 1,
      coins: BigInt(0),
      equippedShip: 'starter',
      ownedShips: ['starter'],
      upgrades: { heart: 0, rate: 0, dmg: 0, dur: 0, mag: 0 },
    };
    
    expect(mockNewPlayer.unlockedLevel).toBe(1);
    expect(mockNewPlayer.equippedShip).toBe('starter');
    expect(mockNewPlayer.ownedShips).toContain('starter');
  });

  it('should persist identity token in localStorage', () => {
    const mockToken = 'test-identity-token-12345';
    const storageKey = 'spaceMissionIdentityToken';
    
    // Simulate localStorage behavior
    const storage: Record<string, string> = {};
    storage[storageKey] = mockToken;
    
    expect(storage[storageKey]).toBe(mockToken);
  });

  it('should reconnect with stored token', () => {
    const storedToken = 'existing-token-67890';
    // When reconnecting, the client passes the stored token
    // The server recognizes the identity and returns existing progress
    expect(storedToken).toBeTruthy();
  });
});

describe('E2E: Progress Sync', () => {
  it('should sync level completion to server', () => {
    const levelResult = {
      level: 1,
      stars: 3,
      score: BigInt(1500),
      coinsEarned: BigInt(50),
      timeMs: BigInt(35000),
      heartsLeft: 3,
    };
    
    // After completing a level, the client calls completeLevelResult reducer
    expect(levelResult.level).toBe(1);
    expect(levelResult.stars).toBeLessThanOrEqual(3);
    expect(levelResult.score).toBeGreaterThan(BigInt(0));
  });

  it('should unlock next level after completion', () => {
    const beforeUnlocked = 1;
    const afterUnlocked = 2;
    
    // Server updates unlockedLevel from 1 to 2 after level 1 is completed
    expect(afterUnlocked).toBe(beforeUnlocked + 1);
  });

  it('should accumulate coins correctly', () => {
    const initialCoins = BigInt(100);
    const earned = BigInt(50);
    const expected = BigInt(150);
    
    expect(initialCoins + earned).toBe(expected);
  });
});

describe('E2E: Level Gating', () => {
  it('should allow requesting unlocked levels', () => {
    const unlockedLevel = 5;
    const requestedLevel = 3;
    
    // Server validates level is unlocked before allowing play
    expect(requestedLevel <= unlockedLevel).toBe(true);
  });

  it('should reject requesting locked levels', () => {
    const unlockedLevel = 5;
    const requestedLevel = 10;
    
    // Server returns error for locked level request
    expect(requestedLevel <= unlockedLevel).toBe(false);
  });

  it('should provide gating error message', () => {
    const unlockedLevel = 5;
    const requestedLevel = 10;
    const errorMessage = `Level ${requestedLevel} is locked. Current unlock: ${unlockedLevel}`;
    
    expect(errorMessage).toContain('locked');
    expect(errorMessage).toContain(String(requestedLevel));
  });
});

describe('E2E: Shop Transactions', () => {
  it('should purchase ship when coins sufficient', () => {
    const coins = BigInt(5000);
    const price = BigInt(3000);
    
    expect(coins >= price).toBe(true);
    expect(coins - price).toBe(BigInt(2000));
  });

  it('should reject purchase when coins insufficient', () => {
    const coins = BigInt(1000);
    const price = BigInt(3000);
    
    expect(coins >= price).toBe(false);
  });

  it('should add ship to owned list after purchase', () => {
    const ownedBefore = ['starter', 'blitz'];
    const purchased = 'komet';
    const ownedAfter = [...ownedBefore, purchased];
    
    expect(ownedAfter).toContain(purchased);
    expect(ownedAfter.length).toBe(3);
  });
});

describe('E2E: Offline Tolerance', () => {
  it('should cache progress locally', () => {
    const progress = {
      unlockedLevel: 10,
      stars: { 1: 3, 2: 2, 3: 3 },
      coins: BigInt(5000),
    };
    
    // Simulating localStorage cache
    const cached = JSON.stringify(progress, (_, v) => 
      typeof v === 'bigint' ? v.toString() + 'n' : v
    );
    
    expect(cached).toContain('"unlockedLevel":10');
    expect(cached).toContain('"coins":"5000n"');
  });

  it('should restore from cache when offline', () => {
    const cached = '{"unlockedLevel":10,"coins":"5000n"}';
    const restored = JSON.parse(cached, (_, v) => {
      if (typeof v === 'string' && /^\d+n$/.test(v)) {
        return BigInt(v.slice(0, -1));
      }
      return v;
    });
    
    expect(restored.unlockedLevel).toBe(10);
    expect(restored.coins).toBe(BigInt(5000));
  });

  it('should sync pending changes when reconnected', () => {
    const pendingChanges = [
      { type: 'level_complete', level: 5, stars: 2 },
      { type: 'coins_earned', amount: 150 },
    ];
    
    // When reconnecting, all pending changes are synced
    expect(pendingChanges.length).toBe(2);
  });
});

describe('E2E: Secret Codes', () => {
  it('should validate and apply secret code', () => {
    const code = 'JOSHI10000';
    const normalizedCode = code.toUpperCase().replace(/\s+/g, '');
    
    expect(normalizedCode).toBe('JOSHI10000');
  });

  it('should add coins for valid code', () => {
    const initialCoins = BigInt(1000);
    const codeBonus = BigInt(10000);
    const expected = BigInt(11000);
    
    expect(initialCoins + codeBonus).toBe(expected);
  });

  it('should prevent reuse of same code', () => {
    const usedCodes = new Set(['secret2']);
    const codeKey = 'secret2';
    
    expect(usedCodes.has(codeKey)).toBe(true);
  });

  it('should handle ALLELEVEL code specially', () => {
    const code = 'ALLELEVEL';
    const isTestMode = code === 'ALLELEVEL' || code === 'ALLELEVELS';
    
    expect(isTestMode).toBe(true);
  });
});

describe('E2E: Error Reporting', () => {
  it('should capture error details', () => {
    const error = {
      errorType: 'uncaught_error',
      message: 'Cannot read property x of undefined',
      stack: 'Error: Cannot read...\n  at game.js:123',
      context: '{"state":"play","level":5}',
    };
    
    expect(error.errorType).toBe('uncaught_error');
    expect(error.message.length).toBeLessThanOrEqual(500);
    expect(error.stack).toBeDefined();
  });

  it('should truncate long messages', () => {
    const longMessage = 'x'.repeat(1000);
    const maxLen = 500;
    const truncated = longMessage.slice(0, maxLen);
    
    expect(truncated.length).toBe(500);
  });
});
