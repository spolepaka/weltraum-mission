import { execFileSync } from 'node:child_process';
import { describe, it } from 'vitest';
import { fileURLToPath } from 'node:url';

/**
 * spacetime publish type-checks with server/spacetimedb/tsconfig.json.
 * Root `tsc` excludes `server/`, so this is the check that must stay green.
 */
describe('SpacetimeDB module typecheck', () => {
  it('passes the same tsc as spacetime publish (`tsc --noEmit -p server/spacetimedb`)', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    execFileSync(process.execPath, [
      fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)),
      '--noEmit',
      '-p',
      'server/spacetimedb',
    ], { cwd: root, stdio: 'inherit' });
  });
});
