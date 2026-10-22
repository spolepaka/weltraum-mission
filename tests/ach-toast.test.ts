import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  filterEchoedQueue,
  mergeSilentAchievements,
  shouldToastUnlock,
} from '../src/lib/achievements-sync';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('silent achievement load', () => {
  it('marks incoming and already-satisfied ids without toasting', () => {
    const done = mergeSilentAchievements({ first: 1 }, ['lv10', 'first'], ['lv10', 'ships5']);
    expect(done.first).toBeTruthy();
    expect(done.lv10).toBeTruthy();
    expect(done.ships5).toBeTruthy();
    expect(shouldToastUnlock(true, false)).toBe(false);
    expect(shouldToastUnlock(false, true)).toBe(false);
    expect(shouldToastUnlock(false, false)).toBe(true);
  });

  it('drops a server echo of ids the client just unlocked so they do not double-toast', () => {
    expect(filterEchoedQueue(['first', 'lv10'], ['first'])).toEqual(['lv10']);
  });

  it('HTML loads account data quietly and only toasts gameplay unlocks', () => {
    expect(html).toContain('function achAdoptSilent');
    expect(html).toContain('function achHideToasts');
    expect(html).toContain('achQuiet');
    expect(html).toContain('achAdoptSilent(p.achievements || [])');
    expect(html).not.toContain('achDone = {};\n        p.achievements.forEach');
    expect(html).toMatch(/if \(!achQuiet\) \{ achQueue\.push\(a\); achPushCloud\(a\[0\]\); \}/);
    expect(html).toContain('unlockAchievement');
  });
});
