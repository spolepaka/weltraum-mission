import { describe, expect, it } from 'vitest';
import { livingPlayers, nearestLiving, pickAimTarget, spreadLiving } from '../src/lib/aim-target';

const p1 = { x: 100, y: 800, pid: 1, lives: 3 };
const p2 = { x: 400, y: 800, pid: 2, lives: 3 };
const p3 = { x: 700, y: 800, pid: 3, lives: 2 };
const dead = { x: 400, y: 800, pid: 2, lives: 0, down: 999, left: true };

describe('co-op boss / enemy targeting', () => {
  it('never aims at dead or disconnected players', () => {
    const live = livingPlayers([p1, dead, p3]);
    expect(live.map((s) => s.pid)).toEqual([1, 3]);
    const nearest = nearestLiving([p1, dead, p3], 400, 100);
    expect(nearest?.pid).not.toBe(2);
  });

  it('picks the nearest living player for a single shot', () => {
    expect(pickAimTarget([p1, p2, p3], 390, 200).pid).toBe(2);
    expect(pickAimTarget([p1, p2, p3], 50, 200).pid).toBe(1);
    expect(pickAimTarget([p1, p2, p3], 720, 200).pid).toBe(3);
  });

  it('spreads a multi-shot volley across living players', () => {
    const pids = [0, 1, 2, 3, 4].map((i) => spreadLiving([p1, p2, p3], i)?.pid);
    expect(pids).toEqual([1, 2, 3, 1, 2]);
  });

  it('falls back when everyone is down', () => {
    const gone = { ...p1, down: 999, left: true, lives: 0 };
    const t = pickAimTarget([gone], 10, 10);
    expect(t.pid).toBe(1);
    expect(t.x).toBe(100);
  });
});
