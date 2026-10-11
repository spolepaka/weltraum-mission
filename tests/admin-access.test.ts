import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADMIN_EMAILS, isAdminEmail, normalizeEmail } from '../server/spacetimedb/src/admin';

const moduleSrc = readFileSync(new URL('../server/spacetimedb/src/index.ts', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const adminHtml = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
const gameHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

describe('admin access', () => {
  it('only allows Suman’s Firebase email', () => {
    expect(ADMIN_EMAILS).toEqual(['sumankpolepaka@gmail.com']);
    expect(isAdminEmail('SumanKPolepaka@gmail.com')).toBe(true);
    expect(isAdminEmail('kid@example.com')).toBe(false);
    expect(normalizeEmail('  x@Y.com ')).toBe('x@y.com');
  });

  it('gates every admin write on assertAdmin and writes an audit row', () => {
    const writes = [
      'adminSetCoins', 'adminAddCoins', 'adminUnlockLevel', 'adminGrantShip',
      'adminRemoveShip', 'adminResetProgress', 'adminResetPlayer', 'adminBan', 'adminUnban',
    ];
    for (const name of writes) {
      expect(moduleSrc).toContain(`export const ${name}`);
    }
    expect(moduleSrc.match(/assertAdmin\(/g)?.length).toBeGreaterThanOrEqual(writes.length);
    expect(moduleSrc.match(/writeAudit\(/g)?.length).toBeGreaterThanOrEqual(writes.length);
    expect(moduleSrc).not.toContain('isAdmin = true');
    expect(moduleSrc).toContain('readJwtEmail');
  });

  it('is a separate lazy route, not linked from the game', () => {
    expect(vite).toContain('admin.html');
    expect(adminHtml).toContain('/src/admin.ts');
    expect(gameHtml).not.toContain('/admin');
    expect(gameHtml).not.toContain('src/admin');
    expect(main).not.toContain("from './admin'");
  });
});
