import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  flipWorldY,
  versusOwnsShip,
  versusRockColor,
  versusRockDamagesPid,
  versusRockHue,
  versusShotIgnoresRock,
  VERSUS_P1_COLOR,
  VERSUS_P2_COLOR,
} from '../src/lib/versus';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('1v1 asteroid sides', () => {
  it('makes own-side rocks harmless and untargetable', () => {
    // side 1 = from the top (guest edge) → incoming for the host
    expect(versusRockDamagesPid(1, 1)).toBe(true);
    expect(versusRockDamagesPid(1, 2)).toBe(false);
    expect(versusShotIgnoresRock(1, 1)).toBe(false);
    expect(versusShotIgnoresRock(1, 2)).toBe(true);
    // side 2 = from the bottom (host edge) → incoming for the guest
    expect(versusRockDamagesPid(2, 2)).toBe(true);
    expect(versusRockDamagesPid(2, 1)).toBe(false);
    expect(versusShotIgnoresRock(2, 1)).toBe(true);
    expect(versusShotIgnoresRock(2, 2)).toBe(false);
  });

  it('tints each side in that player color and survives the guest Y-flip', () => {
    expect(versusRockColor(1)).toBe(VERSUS_P2_COLOR);
    expect(versusRockColor(2)).toBe(VERSUS_P1_COLOR);
    expect(versusRockHue(1)).not.toBe(versusRockHue(2));
    expect(flipWorldY(80, 768)).toBe(688);
    expect(flipWorldY(688, 768)).toBe(80);
  });

  it('wires host-authoritative spawn, shot filters, homing, and guest snapshots', () => {
    expect(HTML).toContain('rk.side = side');
    expect(HTML).toContain('versusShotIgnores');
    expect(HTML).toContain('versusRockHurts');
    expect(HTML).toContain('versusRockColor');
    expect(HTML).toContain('steerBullet');
    expect(HTML).toContain('aimDown');
    expect(HTML).toContain('flipVersusView()');
    expect(HTML).toContain('snapString');
    expect(HTML).toContain('A: A');
    expect(HTML).toContain('spawnVersusRock');
    expect(versusOwnsShip(['starter', 'starcrown'], 'starcrown')).toBe(true);
  });
});
