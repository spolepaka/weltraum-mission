import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/lib/spacetime-client.ts', import.meta.url), 'utf8');
const bindings = readFileSync(new URL('../src/lib/module_bindings/index.ts', import.meta.url), 'utf8');

describe('versus HTML and module wiring', () => {
  it('adds 1 vs 1 and Challenge on the Online screen', () => {
    expect(html).toContain('id="onVersus"');
    expect(html).toContain('id="onChallenge"');
    expect(html).toContain('id="onDuelRows"');
    expect(html).toContain('id="openDuelsLabel"');
    expect(html).toContain('function renderVersusRows');
    expect(html).toContain('function joinVersus');
    expect(html).toContain('shouldPublishListing');
    expect(html).toContain('id="vsHud"');
    expect(html).toContain('id="vsScreen"');
    expect(html).toContain('function versusOn()');
    expect(html).toContain('function applyVersusFair()');
    expect(html).toContain('function spawnVersusWave()');
    expect(html).toContain('function versusBulletHitPlayer(');
    expect(html).toContain('function flipVersusView()');
    expect(html).toContain('function finishVersusRound(');
    expect(html).toContain('startVersus');
  });

  it('reuses host-sim PeerJS and auto-starts a duel at two players', () => {
    expect(html).toContain('hostStart(1)');
    expect(html).toContain('vs: versusOn() ? 1 : 0');
    expect(html).toContain('claimVersusQueue');
    expect(html).toContain('reportVersusResult');
    expect(html).toContain('versusDisconnectWin');
    expect(html).toContain('maybeJoinQueuedRival');
    expect(html).toContain('shouldAbandonQuickHost');
    expect(html).toContain('pickQuickMatch');
    expect(html).toContain('t: "pending"');
    expect(html).toContain('t: "ready"');
    expect(html).toContain('GUEST_READY_RETRY_MS');
    expect(html).toContain('JOIN_APPROVE_WAIT_MS');
    expect(html).toContain('approvePendingGuest');
    expect(html).toMatch(/versus:\s*versus/);
    expect(html).toContain('splitListedRooms');
  });

  it('publishes a live versus_queue table with prize settlement', () => {
    expect(server).toMatch(/versusQueue:\s*table\(\s*\{\s*public:\s*true/);
    expect(server).toContain('versusSettled');
    expect(server).toContain('versusPrizeDay');
    expect(server).toMatch(/heartbeat:\s*t\.timestamp\(\),\s*versus:\s*t\.bool\(\)\.default\(false\)/);
    expect(server).toContain('export const publishPublicRoom');
    expect(server).toContain('export const publishVersusQueue');
    expect(server).toContain('export const claimVersusQueue');
    expect(server).toContain('export const reportVersusResult');
    expect(client).toContain('SELECT * FROM versus_queue');
    expect(client).toContain('publishVersusQueue');
    expect(client).toContain('reportVersusResult');
    expect(bindings).toContain("name: 'versus_queue'");
    expect(bindings).toContain('publish_versus_queue');
  });
});
