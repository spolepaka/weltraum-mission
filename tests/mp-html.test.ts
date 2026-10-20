import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('multiplayer HTML wiring', () => {
  it('aims bosses and enemies with aimTarget, not host-only ship.x', () => {
    expect(html).toContain('function aimTarget(');
    expect(html).toContain('function livingAimShips(');
    expect(html).toMatch(/function ufoShoot[\s\S]*aimTarget\(u\.x/);
    expect(html).toMatch(/function startBossLaser[\s\S]*aimTarget\(/);
    expect(html).toMatch(/function updateSniper[\s\S]*aimTarget\(/);
    expect(html).toMatch(/function updateDrones[\s\S]*aimTarget\(/);
    expect(html).toMatch(/function updateMagMine[\s\S]*aimTarget\(/);
    expect(html).toContain('aimTarget(tx, ty');
  });

  it('has a public room list and private/public toggle', () => {
    expect(html).toContain('id="onRoomRows"');
    expect(html).toContain('id="onVisPublic"');
    expect(html).toContain('id="onVisPrivate"');
    expect(html).toContain('publishPublicRoom');
    expect(html).toContain('listPublicRooms');
  });

  it('migrates the host instead of ending the game', () => {
    expect(html).toContain('function tryHostHandoff');
    expect(html).toContain('function beginHostRecovery');
    expect(html).toContain('function becomeMigratedHost');
    expect(html).toContain('tips.nowHost');
    expect(html).toContain('tips.keepPlayingSolo');
    expect(html).toContain('pagehide');
  });

  it('clamps a co-op boss-kill payout on the client', () => {
    expect(html).toContain('coopBossKillAward');
    expect(html).toContain('uncapped > rawEarned');
  });

  it('keeps the owner million cheat off the level-award path', () => {
    expect(html).toContain('JOSHIE1000000');
    expect(html).toContain('JOSHI1000000');
    expect(html).toMatch(/function finishLevel[\s\S]*coopBossKillAward/);
  });
});
