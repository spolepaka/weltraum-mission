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

  it('shows public rooms on the first Online Co-op screen', () => {
    const menu = html.match(/id="onMenu"[\s\S]*?id="onJoinBox"/)?.[0] || '';
    expect(menu).toContain('id="onRoomRows"');
    expect(menu).toContain('id="onHost"');
    expect(menu).toContain('id="onCode"');
    expect(menu).toContain('id="onMenuVisPublic"');
    expect(html).toContain('startRoomWatch');
    expect(html).toContain('onPublicRooms');
    expect(html).toContain('noPublicRooms');
    expect(html).toContain('injectPublicRooms');
    const hostFn = html.match(/function hostRoom\(tries(?:, forcedCode)?\) \{[\s\S]*?function joinRoom/)?.[0] || '';
    expect(hostFn.indexOf('startRoomHeartbeat()')).toBeGreaterThan(-1);
    expect(hostFn.indexOf('peer.on("open"')).toBeGreaterThan(-1);
    expect(hostFn.indexOf('startRoomHeartbeat()')).toBeGreaterThan(hostFn.indexOf('peer.on("open"'));
    const openHandler = hostFn.match(/peer\.on\("open", function \(\) \{[\s\S]*?\}\);/)?.[0] || '';
    expect(openHandler).toContain('startRoomHeartbeat()');
    expect(openHandler).toContain('peerReady = true');
  });

  it('retries a transient peer-unavailable instead of showing room-not-found once', () => {
    const joinFn = html.match(/function joinRoom\(code, gen\) \{[\s\S]*?function attachGuest/)?.[0] || '';
    expect(joinFn).toContain('shouldRetryJoin');
    expect(joinFn).toContain('nextJoinDelay');
    expect(joinFn).toContain('isOwnListedRoom');
    expect(joinFn).toContain('cleanCode(code)');
    expect(html).toContain('shouldCloseOnPageHide');
    expect(html).toContain('shouldCloseOnHidden');
    expect(html).toContain('roomRow.stale');
    expect(html).toContain('decorateListedRooms');
  });

  it('spawns ships from occupancy, not a forced second seat', () => {
    expect(html).toContain('function coopShipCountNow()');
    expect(html).toContain('function uniqueOkGuests()');
    expect(html).not.toMatch(/Math\.max\(2,\s*Math\.min\(5,\s*net\.nPl/);
    expect(html).not.toMatch(/net\.nPl = Math\.max\(2,/);
    expect(html).toContain('hostSoloStart');
    expect(html).toContain('seedGuest');
  });

  it('does not close a listing when the heartbeat is restarted', () => {
    const start = html.match(/function startRoomHeartbeat\(\) \{[\s\S]*?function stopRoomHeartbeat/)?.[0] || '';
    expect(start).toContain('pushRoomListing()');
    expect(start).not.toContain('stopRoomHeartbeat()');
    expect(html).toMatch(/try \{ st\.publishPublicRoom\(row\); net\.listed = true; \}/);
    expect(html).not.toMatch(/net\.listed \? st\.heartbeatPublicRoom : st\.publishPublicRoom/);
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
