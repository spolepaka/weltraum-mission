import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';
import {
  applyPublicRoomEvent,
  type PublicRoomRow,
} from '../src/lib/room-list';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const clientSrc = readFileSync(new URL('../src/lib/spacetime-client.ts', import.meta.url), 'utf8');
const serverSrc = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');
const bindings = readFileSync(new URL('../src/lib/module_bindings/index.ts', import.meta.url), 'utf8');

describe('public rooms live wiring', () => {
  it('makes publicRoom a live-subscribable table', () => {
    expect(serverSrc).toMatch(/publicRoom:\s*table\(\s*\{\s*public:\s*true/);
    expect(serverSrc).toContain('sweepStalePublicRooms');
    expect(bindings).toContain("name: 'public_room'");
    expect(clientSrc).toContain("SELECT * FROM public_room");
    expect(clientSrc).toContain('table.onInsert');
    expect(clientSrc).toContain('table.onUpdate');
    expect(clientSrc).toContain('table.onDelete');
    expect(clientSrc).toContain('onPublicRooms');
  });

  it('keeps a procedure fallback when the published module is still private', () => {
    expect(clientSrc).toContain('listPublicRooms');
    expect(clientSrc).toContain('refreshPublicRoomsFromProcedure');
    expect(clientSrc).toMatch(/public_room subscribe failed/);
  });

  it('uses kid-friendly empty copy in EN and DE', () => {
    expect(en.noPublicRooms).toMatch(/No public rooms yet/);
    expect(de.noPublicRooms).toMatch(/Noch keine öffentlichen Räume/);
    expect(html).toContain('tr("noPublicRooms")');
  });
});

describe('two-client publicRoom event propagation', () => {
  it('shows a room on the second client as soon as the insert event arrives', () => {
    const clientA = new Map<string, PublicRoomRow>();
    const clientB = new Map<string, PublicRoomRow>();
    const now = 5_000_000;
    const created = { code: 'KEEN4', hostName: 'Nia', level: 3, players: 1, heartbeatMs: now };

    const t0 = Date.now();
    applyPublicRoomEvent(clientA, { type: 'insert', row: created }, now);
    const seen = applyPublicRoomEvent(clientB, { type: 'insert', row: created }, now);
    const dt = Date.now() - t0;

    expect(dt).toBeLessThan(1000);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ code: 'KEEN4', hostName: 'Nia', level: 3, players: 1 });
  });

  it('removes a closed room from the second client on delete', () => {
    const clientA = new Map<string, PublicRoomRow>();
    const clientB = new Map<string, PublicRoomRow>();
    const now = 5_000_000;
    const created = { code: 'KEEN4', hostName: 'Nia', level: 3, players: 1, heartbeatMs: now };
    applyPublicRoomEvent(clientA, { type: 'insert', row: created }, now);
    applyPublicRoomEvent(clientB, { type: 'insert', row: created }, now);

    applyPublicRoomEvent(clientA, { type: 'delete', code: 'KEEN4' }, now);
    const gone = applyPublicRoomEvent(clientB, { type: 'delete', code: 'KEEN4' }, now);
    expect(gone).toEqual([]);
  });
});
