import { describe, expect, it, beforeEach } from 'vitest';
import {
  adjectiveStemOf,
  firstWord,
  generateDisplayName,
  generateNameChoices,
  hasProfanity,
  inflectDeAdj,
  resetNameHistory,
  validateDisplayName,
} from '../src/lib/display-names';
import { validateDisplayName as serverValidate } from '../server/spacetimedb/src/display-names';
import { ADJ_DE, ADJ_EN, NOUN_DE, NOUN_EN, PUNS_DE, fugenForm, type DeGender } from '../src/lib/name-words';

describe('kid-safe display names', () => {
  beforeEach(() => {
    resetNameHistory();
  });

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
    expect(inflectDeAdj('Wackelig', 'f')).toBe('Wackelige');
    expect(inflectDeAdj('Flauschig', 'm')).toBe('Flauschiger');
    expect(inflectDeAdj('Blitzschnell', 'm')).toBe('Blitzschneller');
    expect(inflectDeAdj('Kichernd', 'n')).toBe('Kicherndes');
    expect(inflectDeAdj('Schusselig', 'f')).toBe('Schusselige');
    expect(NOUN_DE.find((n) => n.word === 'Robbe')?.gender).toBe('f');
    expect(NOUN_DE.find((n) => n.word === 'Komet')?.gender).toBe('m');
    expect(NOUN_DE.find((n) => n.word === 'Kessel')?.gender).toBe('m');
    expect(NOUN_DE.find((n) => n.word === 'Meteor')?.gender).toBe('m');
    expect(NOUN_DE.find((n) => n.word === 'Gabel')?.gender).toBe('f');
    expect(NOUN_DE.find((n) => n.word === 'Ufo')?.gender).toBe('n');
  });

  it('applies Fugenlaut on German compound first parts', () => {
    expect(fugenForm({ word: 'Flocke', gender: 'f' })).toBe('Flocken');
    expect(fugenForm({ word: 'Rakete', gender: 'f' })).toBe('Raketen');
    expect(fugenForm({ word: 'Erbse', gender: 'f' })).toBe('Erbsen');
    expect(fugenForm({ word: 'Gabel', gender: 'f' })).toBe('Gabeln');
    expect(fugenForm({ word: 'Wolke', gender: 'f' })).toBe('Wolken');
    expect(fugenForm({ word: 'Hase', gender: 'm' })).toBe('Hasen');
    expect(fugenForm({ word: 'Fuchs', gender: 'm' })).toBe('Fuchs');
    expect(fugenForm(NOUN_DE.find((n) => n.word === 'Stern')!)).toBe('Sternen');
    expect(fugenForm(NOUN_DE.find((n) => n.word === 'Flocke')!)).toBe('Flocken');
    expect(fugenForm(NOUN_DE.find((n) => n.word === 'Maus')!)).toBe('Maeuse');
  });

  it('uses Fugen noun-noun hyphens and inflected adjective-noun pairs', () => {
    const fugenSet = new Set(NOUN_DE.map((n) => fugenForm(n).toLowerCase()));
    const lemmaSet = new Set(NOUN_DE.map((n) => n.word.toLowerCase()));
    const punSet = new Set(PUNS_DE);
    const skipFirst = new Set([
      'käptn', 'agent', 'doktor', 'der', 'die', 'das', 'weltraum',
      'baron', 'graf', 'scout', 'spion', 'pilot', 'major', 'kadett', 'ritter',
    ]);
    let compounds = 0;
    for (let i = 0; i < 120; i++) {
      const name = generateDisplayName('de');
      if (punSet.has(name) || punSet.has(name.replace(/\s+\d{1,3}$/, ''))) continue;
      const core = name.replace(/\s+\d{1,3}$/, '');
      if (/-inator$/i.test(core) || / Mc/i.test(core) || / von /i.test(core)) continue;
      const hyphen = core.match(/^([\p{L}]+)-([\p{L}]+)$/u);
      if (hyphen) {
        expect(fugenSet.has(hyphen[1].toLowerCase())).toBe(true);
        expect(lemmaSet.has(hyphen[2].toLowerCase())).toBe(true);
        compounds += 1;
      }
      const spaced = core.match(/^([\p{L}]+) ([\p{L}]+)$/u);
      if (spaced && !skipFirst.has(spaced[1].toLowerCase())) {
        const noun = NOUN_DE.find((n) => n.word === spaced[2]);
        if (noun) {
          expect(ADJ_DE.some((adj) => inflectDeAdj(adj, noun.gender) === spaced[1])).toBe(true);
        }
      }
    }
    expect(compounds).toBeGreaterThan(0);
  });

  it('puts numbers on English names only about a quarter of the time', () => {
    const names = Array.from({ length: 200 }, () => generateDisplayName('en'));
    const numbered = names.filter((n) => /\s\d{1,3}$/.test(n)).length;
    expect(numbered / names.length).toBeGreaterThanOrEqual(0.08);
    expect(numbered / names.length).toBeLessThanOrEqual(0.42);
  });

  it('generates localized space names within 3–16 chars', () => {
    for (let i = 0; i < 40; i++) {
      const en = generateDisplayName('en');
      const de = generateDisplayName('de');
      expect(en.length).toBeGreaterThanOrEqual(3);
      expect(en.length).toBeLessThanOrEqual(16);
      expect(de.length).toBeLessThanOrEqual(16);
      expect(validateDisplayName(en, 'generated').ok).toBe(true);
      expect(validateDisplayName(de, 'generated').ok).toBe(true);
    }
  });

  it('offers three unique choices with no repeated adjective', () => {
    for (let i = 0; i < 200; i++) {
      const lang = i % 2 ? 'de' : 'en';
      const picks = generateNameChoices(lang, 3);
      expect(picks).toHaveLength(3);
      expect(new Set(picks.map((n) => n.toLowerCase())).size).toBe(3);
      const adjs = picks.map((n) => adjectiveStemOf(n, lang)).filter((a): a is string => !!a);
      expect(new Set(adjs).size).toBe(adjs.length);
    }
  });

  it('keeps the most common first word under 3% in 1000 random names', () => {
    const names = Array.from({ length: 1000 }, (_, i) => generateDisplayName(i % 2 ? 'de' : 'en'));
    const counts = new Map<string, number>();
    for (const name of names) {
      const word = firstWord(name);
      counts.set(word, (counts.get(word) || 0) + 1);
    }
    const top = Math.max(...counts.values());
    expect(top / names.length).toBeLessThan(0.03);
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
    expect(validateDisplayName('Flocken-Frosch', 'generated').ok).toBe(true);
  });

  it('server copy rejects the same invalid names', () => {
    expect(serverValidate('ada@x.com', 'custom').ok).toBe(false);
    expect(serverValidate('PilotKid', 'custom').ok).toBe(true);
    expect(serverValidate('Cosmic Fox 42', 'generated').ok).toBe(true);
    expect(serverValidate('PilotKid', 'generated').ok).toBe(true);
    expect(serverValidate('Raketen-Pinguin', 'generated').ok).toBe(true);
    expect(serverValidate('Flocken-Frosch', 'generated').ok).toBe(true);
  });
});
