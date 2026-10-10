import { describe, expect, it } from 'vitest';
import { generateDisplayName, generateNameChoices, hasProfanity, inflectDeAdj, validateDisplayName } from '../src/lib/display-names';
import { validateDisplayName as serverValidate } from '../server/spacetimedb/src/display-names';
import { ADJ_DE, ADJ_EN, NOUN_DE, NOUN_EN, PUNS_DE, type DeGender } from '../src/lib/name-words';

describe('kid-safe display names', () => {
  it('keeps large curated EN/DE word lists', () => {
    expect(new Set(ADJ_EN).size).toBeGreaterThanOrEqual(100);
    expect(new Set(NOUN_EN).size).toBeGreaterThanOrEqual(150);
    expect(new Set(ADJ_DE).size).toBeGreaterThanOrEqual(100);
    expect(new Set(NOUN_DE.map((n) => n.word)).size).toBeGreaterThanOrEqual(150);
  });

  it('inflects every German adjective for each gender', () => {
    const genders: DeGender[] = ['m', 'f', 'n'];
    const endings = { m: 'er', f: 'e', n: 'es' } as const;
    for (const adj of ADJ_DE) {
      for (const gender of genders) {
        expect(inflectDeAdj(adj, gender)).toBe(`${adj}${endings[gender]}`);
      }
    }
    expect(inflectDeAdj('Frostig', 'f')).toBe('Frostige');
    expect(inflectDeAdj('Lustig', 'm')).toBe('Lustiger');
    expect(inflectDeAdj('Schlau', 'm')).toBe('Schlauer');
    expect(inflectDeAdj('Fidel', 'm')).toBe('Fideler');
    expect(inflectDeAdj('Neugierig', 'f')).toBe('Neugierige');
    expect(inflectDeAdj('Sternig', 'n')).toBe('Sterniges');
    expect(NOUN_DE.find((n) => n.word === 'Robbe')?.gender).toBe('f');
    expect(NOUN_DE.find((n) => n.word === 'Komet')?.gender).toBe('m');
    expect(NOUN_DE.find((n) => n.word === 'Kessel')?.gender).toBe('m');
    expect(NOUN_DE.find((n) => n.word === 'Meteor')?.gender).toBe('m');
    expect(NOUN_DE.find((n) => n.word === 'Gabel')?.gender).toBe('f');
    expect(NOUN_DE.find((n) => n.word === 'Ufo')?.gender).toBe('n');
  });

  it('uses noun-noun German hyphens and inflected adjective-noun pairs', () => {
    const nounSet = new Set(NOUN_DE.map((n) => n.word.toLowerCase()));
    const adjSet = new Set(ADJ_DE.map((a) => a.toLowerCase()));
    const punSet = new Set(PUNS_DE);
    for (let i = 0; i < 80; i++) {
      const name = generateDisplayName('de', i * 31 + 4);
      if (punSet.has(name) || punSet.has(name.replace(/\s+\d{1,3}$/, ''))) continue;
      const core = name.replace(/\s+\d{1,3}$/, '');
      if (/-inator$/i.test(core)) continue;
      const hyphen = core.match(/^([\p{L}]+)-([\p{L}]+)$/u);
      if (hyphen) {
        expect(nounSet.has(hyphen[1].toLowerCase())).toBe(true);
        expect(nounSet.has(hyphen[2].toLowerCase())).toBe(true);
        expect(adjSet.has(hyphen[1].toLowerCase())).toBe(false);
      }
      const spaced = core.match(/^([\p{L}]+) ([\p{L}]+)$/u);
      if (spaced && spaced[1] !== 'Käptn') {
        const noun = NOUN_DE.find((n) => n.word === spaced[2]);
        if (noun) {
          expect(ADJ_DE.some((adj) => inflectDeAdj(adj, noun.gender) === spaced[1])).toBe(true);
        }
      }
    }
  });

  it('puts numbers on English names only about a quarter of the time', () => {
    const names = Array.from({ length: 200 }, (_, i) => generateDisplayName('en', i * 53 + 2));
    const numbered = names.filter((n) => /\s\d{1,3}$/.test(n)).length;
    expect(numbered / names.length).toBeGreaterThanOrEqual(0.08);
    expect(numbered / names.length).toBeLessThanOrEqual(0.42);
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
