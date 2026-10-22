import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  bankFromMotion,
  boostSnapFields,
  guestBoostFields,
  hostBoostFromInput,
  jetsFromBank,
  localBoostPid,
  snapRoll,
} from '../src/lib/roadster-net';
import { boostCooldown, flipsOnBoost, startRoadsterBoost } from '../src/lib/roadster-boost';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('guest roadster boost over PeerJS', () => {
  it('packs a one-shot boost and optional flip for the host', () => {
    expect(guestBoostFields(false, true)).toEqual({ b: 0, fl: 0 });
    expect(guestBoostFields(true, false)).toEqual({ b: 1, fl: 0 });
    expect(guestBoostFields(true, true)).toEqual({ b: 1, fl: 1 });
    expect(hostBoostFromInput({ b: 1 })).toEqual({ once: true, flip: false });
    expect(hostBoostFromInput({ b: 1, fl: 1 })).toEqual({ once: true, flip: true });
    expect(hostBoostFromInput({})).toEqual({ once: false, flip: false });
  });

  it('would have caught a host that always boosted guests without flip', () => {
    const beep = startRoadsterBoost('beepbuggy', 0, hostBoostFromInput({ b: 1, fl: 1 }).flip);
    expect(beep.roll).toBe(true);
    const noFlip = startRoadsterBoost('beepbuggy', 0, hostBoostFromInput({ b: 1 }).flip);
    expect(noFlip.roll).toBe(false);
    expect(flipsOnBoost('shadowspeeder')).toBe(true);
  });

  it('keeps per-trim cooldowns', () => {
    expect(boostCooldown('beepbuggy')).toBeGreaterThan(boostCooldown('apexflash'));
    const a = startRoadsterBoost('beepbuggy', 0, false);
    const b = startRoadsterBoost('apexflash', 0, false);
    expect(a.cd).not.toBe(b.cd);
  });

  it('sends guest boost to the guest pid, local P2 to seat 2', () => {
    expect(localBoostPid({ isGuest: true, myPid: 3 })).toBe(3);
    expect(localBoostPid({ online: false, p2Key: true })).toBe(2);
    expect(localBoostPid({ online: true })).toBe(1);
    expect(html).toMatch(/if \(isGuest\(\)\) \{ try \{ return curShip\(\)\.id/);
    expect(html).not.toMatch(/if \(!net\.role \|\| isGuest\(\)\) \{ try \{ return curShip\(\)\.id/);
  });

  it('fires side jets from motion, not a -1/0/1 steer flag', () => {
    expect(jetsFromBank(bankFromMotion(12, 0.05))).toBe(true);
    expect(jetsFromBank(1)).toBe(false);
  });

  it('snapshots cooldown and roll so every screen can draw them', () => {
    const snap = boostSnapFields({
      boostLeft: 0.3, boostCd: 2.1, rollU: 0.4, rollTurns: 2, rollDur: 1, boostY: -10, bank: 40, boostDur: 0.3, boostLift: 46,
    });
    expect(snap.cd).toBe(2.1);
    expect(snap.rl).toBe(0.4);
    expect(snap.rt).toBe(2);
    expect(html).toContain('requestRoadsterBoost');
    expect(html).toContain('rboostFlip');
    expect(html).toContain('guestBoostFields');
    expect(html).toContain('tapFlip');
    expect(html).toMatch(/if \(isGuest\(\)\) requestRoadsterBoost/);
    expect(html).toContain('kb2.boost');
    expect(html).toContain('pidNearPointer');
    expect(html).toMatch(/tryRoadsterBoost\(gFlip\)/);
    expect(html).toContain('ship.rollU = 0.02');
  });

  it('keeps an in-progress roll visible after 2-decimal JSON rounding', () => {
    const round = (v: number) => Math.round(v * 100) / 100;
    expect(round(0.001)).toBe(0);
    expect(round(snapRoll(0.001))).toBeGreaterThan(0);
    expect(round(boostSnapFields({ rollU: 0.001 }).rl)).toBeGreaterThan(0);
    expect(round(0.02)).toBe(0.02);
    expect(snapRoll(0)).toBe(0);
    expect(snapRoll(1)).toBe(1);
  });
});
