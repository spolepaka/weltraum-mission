import { describe, expect, it } from 'vitest';
import { generateDisplayName, generateNameChoices, hasProfanity, validateDisplayName } from '../src/lib/display-names';
import { validateDisplayName as serverValidate } from '../server/spacetimedb/src/display-names';
import { ADJ_DE, ADJ_EN, NOUN_DE, NOUN_EN } from '../src/lib/name-words';

describe('kid-safe display names', () => {
  it('keeps large curated EN/DE word lists', () => {
    expect(new Set(ADJ_EN).size).toBeGreaterThanOrEqual(100);
    expect(new Set(NOUN_EN).size).toBeGreaterThanOrEqual(150);
    expect(new Set(ADJ_DE).size).toBeGreaterThanOrEqual(100);
    expect(new Set(NOUN_DE).size).toBeGreaterThanOrEqual(150);
  });

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

  it('offers three unique choices at a time', () => {
    const picks = generateNameChoices('en', 3, 42);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((n) => n.toLowerCase())).size).toBe(3);
  });

  it('generates 1000 names that stay unique and unblocked', () => {
    const names = Array.from({ length: 1000 }, (_, i) => generateDisplayName(i % 2 ? 'de' : 'en', i * 97 + 11));
    const unique = new Set(names.map((n) => n.toLowerCase()));
    expect(unique.size / names.length).toBeGreaterThanOrEqual(0.95);
    for (const name of names) {
      expect(hasProfanity(name)).toBe(false);
      expect(validateDisplayName(name, 'generated').ok).toBe(true);
    }
  });

  it('rejects email, phone, URL, profanity, and short custom names', () => {
    expect(validateDisplayName('ada@x.com', 'custom').ok).toBe(false);
    expect(validateDisplayName('www.bad.com', 'custom').ok).toBe(false);
    expect(validateDisplayName('Call 5551234567', 'custom').ok).toBe(false);
    expect(validateDisplayName('fuckstar', 'custom').ok).toBe(false);
    expect(validateDisplayName('ab', 'custom').ok).toBe(false);
    expect(validateDisplayName('PilotKid', 'custom').ok).toBe(true);
    expect(validateDisplayName('Raketen-Pinguin', 'generated').ok).toBe(true);
  });

  it('server copy rejects the same invalid names', () => {
    expect(serverValidate('ada@x.com', 'custom').ok).toBe(false);
    expect(serverValidate('PilotKid', 'custom').ok).toBe(true);
    expect(serverValidate('Cosmic Fox 42', 'generated').ok).toBe(true);
    expect(serverValidate('PilotKid', 'generated').ok).toBe(true);
    expect(serverValidate('Raketen-Pinguin', 'generated').ok).toBe(true);
  });
});
