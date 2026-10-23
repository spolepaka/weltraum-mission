import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('onboarding name pick', () => {
  it('does not overlay the name picker on training, welcome, or live play', () => {
    expect(html).toContain('function namePickBlocked()');
    expect(html).toContain('if (trainOn || mapTourOn) return true;');
    expect(html).toContain('if (state === "play" || state === "dying" || state === "sucked") return true;');
    expect(html).toMatch(/function maybePickName\(\) \{[\s\S]*namePickBlocked\(\)/);
    expect(html).toMatch(/function finishWelcome\(\) \{[\s\S]*namePickScreen[\s\S]*classList\.add\("hidden"\)/);
  });
});
