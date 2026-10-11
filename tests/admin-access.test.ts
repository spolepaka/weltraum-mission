import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_EMAILS,
  bindAdminCtx,
  emailFromJwtPayload,
  inspectSenderAuth,
  isAdminEmail,
  isAdminPrincipal,
  isAdminUid,
  normalizeEmail,
  payloadFromJwt,
} from '../server/spacetimedb/src/admin';

const moduleSrc = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const adminHtml = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
const adminTs = readFileSync(new URL('../src/admin.ts', import.meta.url), 'utf8');
const gameHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

describe('admin access', () => {
  it('only allows Suman’s Firebase email', () => {
    expect(ADMIN_EMAILS).toEqual(['sumankpolepaka@gmail.com']);
    expect(isAdminEmail('SumanKPolepaka@gmail.com')).toBe(true);
    expect(isAdminEmail('kid@example.com')).toBe(false);
    expect(normalizeEmail('  x@Y.com ')).toBe('x@y.com');
    expect(isAdminUid('')).toBe(false);
    expect(isAdminPrincipal('sumankpolepaka@gmail.com', '')).toBe(true);
    expect(isAdminPrincipal('kid@example.com', '')).toBe(false);
  });

  it('reads email from fullPayload and rawPayload', () => {
    expect(emailFromJwtPayload({ email: 'SumanKPolepaka@gmail.com' })).toBe('sumankpolepaka@gmail.com');
    expect(payloadFromJwt({ rawPayload: '{"email":"sumankpolepaka@gmail.com","iss":"https://securetoken.google.com/weltraum-mission"}' }).email).toBe('sumankpolepaka@gmail.com');
    const probe = inspectSenderAuth({
      hasJWT: true,
      jwt: {
        issuer: 'https://securetoken.google.com/weltraum-mission',
        subject: 'firebase-uid-1',
        fullPayload: { email: 'sumankpolepaka@gmail.com', email_verified: true, sub: 'firebase-uid-1' },
      },
    });
    expect(probe.hasJwt).toBe(true);
    expect(probe.email).toBe('sumankpolepaka@gmail.com');
    expect(probe.emailVerified).toBe(true);
    expect(inspectSenderAuth(undefined).via).toBe('none');
  });

  it('takes JWT from the transaction ctx, not the procedure outer ctx', () => {
    const outer = { sender: 'outer', senderAuth: undefined, db: { from: 'outer' } };
    const tx = {
      sender: 'tx',
      senderAuth: { hasJWT: true, jwt: { issuer: 'https://securetoken.google.com/weltraum-mission', fullPayload: { email: 'sumankpolepaka@gmail.com' } } },
      db: { from: 'tx' },
    };
    const bound = bindAdminCtx(outer, tx);
    expect(bound.senderAuth).toBe(tx.senderAuth);
    expect(bound.db).toEqual({ from: 'tx' });
    expect(inspectSenderAuth(bound.senderAuth).email).toBe('sumankpolepaka@gmail.com');
    expect(moduleSrc).toContain('bindAdminCtx(ctx as never, txCtx as never)');
    expect(moduleSrc).toContain("from './admin'");
  });

  it('gates every admin write on assertAdmin and writes an audit row', () => {
    const writes = [
      'adminSetCoins', 'adminAddCoins', 'adminUnlockLevel', 'adminGrantShip',
      'adminRemoveShip', 'adminResetProgress', 'adminResetPlayer', 'adminBan', 'adminUnban',
      'adminSetTestFlag', 'adminPurgeEmptyGuests',
    ];
    for (const name of writes) {
      expect(moduleSrc).toContain(`export const ${name}`);
    }
    expect(moduleSrc.match(/assertAdmin\(/g)?.length).toBeGreaterThanOrEqual(writes.length);
    expect(moduleSrc.match(/writeAudit\(/g)?.length).toBeGreaterThanOrEqual(writes.length);
    expect(moduleSrc).not.toContain('isAdmin = true');
    expect(moduleSrc).toContain('readJwtEmail');
    expect(moduleSrc).toContain('detail: t.string()');
  });

  it('is a separate lazy route, not linked from the game', () => {
    expect(vite).toContain('admin.html');
    expect(adminHtml).toContain('/src/admin.ts');
    expect(gameHtml).not.toContain('/admin');
    expect(gameHtml).not.toContain('src/admin');
    expect(main).not.toContain("from './admin'");
    expect(adminTs).toContain('showDenied');
    expect(adminTs).toContain('currentIdToken(true)');
    expect(adminTs).toContain('Hide empty guests');
    expect(adminTs).toContain('Mark as test/bot');
    expect(adminTs).toContain('type PURGE');
    expect(adminTs).toContain('Coin history');
    expect(adminTs).toContain('Location (GDPR)');
  });
});
