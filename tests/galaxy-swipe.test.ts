import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

describe('galaxy map swipe', () => {
  it('keeps arrows and page dots, and swipes with snap plus momentum', () => {
    expect(HTML).toContain('id="worldPager"');
    expect(HTML).toContain('id="worldPrev"');
    expect(HTML).toContain('id="worldNext"');
    expect(HTML).toContain('id="worldDots"');
    expect(HTML).toContain('function snapMapWorld');
    expect(HTML).toContain('mapWorldSlide');
    expect(HTML).toContain('mapWorldVel');
    expect(HTML).toContain('mapScrollVel');
    expect(HTML).toContain('mapPtr.axis');
    expect(HTML).toContain('e.deltaX');
    expect(HTML).toContain('swipeGalaxy');
    expect(HTML).toContain('touch-action: none');
  });
});
