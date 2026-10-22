import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  OWNER_EMAIL,
  SEED_ADMIN_EMAILS,
  applySeedAdminRoles,
  canRevokeAdmin,
  isGrantedAdmin,
  isOwnerEmail,
} from '../server/spacetimedb/src/admin';
import {
  ONLINE_TTL_US,
  emptyOnlineSnapshot,
  isFreshSession,
  normalizeActivity,
  publicOnlinePayload,
  summarizeOnline,
} from '../server/spacetimedb/src/online';
import { formatOnlineBadge, inferOnlineActivity, shouldShowOnlineBadge } from '../src/lib/online-now';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';

const moduleSrc = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const adminTs = readFileSync(new URL('../src/admin.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/lib/spacetime-client.ts', import.meta.url), 'utf8');

describe('online presence', () => {
  it('normalizes activity and drops stale heartbeats', () => {
    expect(normalizeActivity('SOLO')).toBe('solo');
    expect(normalizeActivity('nope')).toBe('menu');
    expect(isFreshSession(100, 100 - ONLINE_TTL_US, ONLINE_TTL_US)).toBe(true);
    expect(isFreshSession(100, 100 - ONLINE_TTL_US - 1, ONLINE_TTL_US)).toBe(false);
  });

  it('counts unique players and hides names from non-admins', () => {
    const now = 50_000_000;
    const rows = [
      { identity: 'a', displayName: 'Ada', activity: 'menu' as const, connectedAtUs: 10, lastBeatUs: now },
      { identity: 'a', displayName: 'Ada', activity: 'coop' as const, connectedAtUs: 11, lastBeatUs: now },
      { identity: 'b', displayName: 'Bea', activity: 'solo' as const, connectedAtUs: 12, lastBeatUs: now - ONLINE_TTL_US - 5 },
      { identity: 'c', displayName: 'Cee', activity: 'versus' as const, connectedAtUs: 13, lastBeatUs: now },
    ];
    const snap = summarizeOnline(rows, now);
    expect(snap.total).toBe(2);
    expect(snap.coop).toBe(1);
    expect(snap.versus).toBe(1);
    expect(snap.solo).toBe(0);
    expect(snap.people.map((p) => p.name)).toEqual(['Ada', 'Cee']);
    expect(publicOnlinePayload(false, snap)).toEqual({ admin: false, ...emptyOnlineSnapshot() });
    expect(publicOnlinePayload(true, snap).people).toHaveLength(2);
    expect(publicOnlinePayload(true, snap).total).toBe(2);
  });

  it('tracks presence per connection with a TTL on the server', () => {
    expect(moduleSrc).toContain('onlineSession');
    expect(moduleSrc).toContain('connectionId: t.connectionId().primaryKey()');
    expect(moduleSrc).toContain('export const heartbeatOnline');
    expect(moduleSrc).toContain('export const getOnlineNow');
    expect(moduleSrc).toContain('sweepStaleOnlineSessions');
    expect(moduleSrc).toContain('ONLINE_TTL_US');
    expect(moduleSrc).toContain('onDisconnect');
    expect(moduleSrc).toContain('ctx.db.onlineSession.delete');
    expect(moduleSrc).toContain('peopleJson: JSON.stringify(payload.people)');
    expect(moduleSrc).toContain('publicOnlinePayload(admin, snap)');
    expect(client).toContain('heartbeatOnline');
    expect(client).toContain('getOnlineNow');
  });
});

describe('admin roles', () => {
  it('keeps the owner locked and seeds Joshi', () => {
    expect(isOwnerEmail(OWNER_EMAIL)).toBe(true);
    expect(SEED_ADMIN_EMAILS).toContain('joshiepolepaka@gmail.com');
    const seeded = applySeedAdminRoles([], false, 1);
    expect(seeded.rows.map((row) => row.email)).toEqual([
      'sumankpolepaka@gmail.com',
      'joshiepolepaka@gmail.com',
    ]);
    expect(canRevokeAdmin(OWNER_EMAIL).ok).toBe(false);
    expect(isGrantedAdmin('joshiepolepaka@gmail.com', seeded.rows.map((row) => row.email))).toBe(true);
    expect(moduleSrc).toContain('adminRole');
    expect(moduleSrc).toContain('adminGrantRole');
    expect(moduleSrc).toContain('adminRevokeRole');
    expect(moduleSrc).toContain('canRevokeAdmin');
    expect(moduleSrc).toContain('senderIsAdmin');
    expect(moduleSrc).toContain('isGrantedAdmin');
    expect(moduleSrc).toContain('readJwtEmail');
  });
});

describe('in-game admin badge', () => {
  it('is EN/DE, hidden for non-admins, and wired into HUD plus map', () => {
    expect(en.onlineNow).toBe('{n} online');
    expect(de.onlineNow).toBe('{n} Spieler online');
    expect(formatOnlineBadge(3, en.onlineNow)).toBe('🟢 3 online');
    expect(formatOnlineBadge(3, de.onlineNow)).toBe('🟢 3 Spieler online');
    expect(shouldShowOnlineBadge(true)).toBe(true);
    expect(shouldShowOnlineBadge(false)).toBe(false);
    expect(html).toContain('id="onlineNowHud"');
    expect(html).toContain('id="onlineNowMap"');
    expect(html).toContain('onlineActivity');
    expect(main).toContain('startOnlineNowWatch');
    expect(main).toContain('paintOnlineNowBadge');
    expect(main).toContain("t('onlineNow'");
    expect(inferOnlineActivity({ netRole: 'host' })).toBe('coop');
    expect(inferOnlineActivity({ playing: true })).toBe('solo');
    expect(inferOnlineActivity({})).toBe('menu');
    expect(adminTs).toContain('Online now');
    expect(adminTs).toContain('Grant admin');
  });
});
