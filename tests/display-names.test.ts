import { describe, expect, it } from 'vitest';
import { generateDisplayName, validateDisplayName } from '../src/lib/display-names';
import { validateDisplayName as serverValidate } from '../server/spacetimedb/src/display-names';

describe('kid-safe display names', () => {
  it('generates localized space names within 3–16 chars', () => {
    for (let i = 0; i < 40; i++) {
      const en = generateDisplayName('en', i * 17 + 3);
      const de = generateDisplayName('de', i * 19 + 5);
      expect(en.length).toBeGreaterThanOrEqual(3);
      expect(en.length).toBeLessThanOrEqual(16);
      expect(de.length).toBeLessThanOrEqual(16);
      expect(validateDisplayName(en, 'generated').ok).toBe(true);
      expect(validateDisplayName(de, 'generated').ok).toBe(true);
    }
  });

  it('rejects email, phone, URL, profanity, and short custom names', () => {
    expect(validateDisplayName('ada@x.com', 'custom').ok).toBe(false);
    expect(validateDisplayName('www.bad.com', 'custom').ok).toBe(false);
    expect(validateDisplayName('Call 5551234567', 'custom').ok).toBe(false);
    expect(validateDisplayName('fuckstar', 'custom').ok).toBe(false);
    expect(validateDisplayName('ab', 'custom').ok).toBe(false);
    expect(validateDisplayName('PilotKid', 'custom').ok).toBe(true);
  });

  it('server copy rejects the same invalid names', () => {
    expect(serverValidate('ada@x.com', 'custom').ok).toBe(false);
    expect(serverValidate('PilotKid', 'custom').ok).toBe(true);
    expect(serverValidate('Cosmic Fox 42', 'generated').ok).toBe(true);
    expect(serverValidate('PilotKid', 'generated').ok).toBe(false);
  });
});
