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
import {
  uniquifyDisplayName,
  validateDisplayName as serverValidate,
} from '../server/spacetimedb/src/display-names';
import {
  ADJ_DE,
  ADJ_EN,
  DOOM_TAILS_DE,
  NOUN_DE,
  NOUN_EN,
  PUNS_DE,
  RHYMES_DE,
  TITLE_NOUNS_DE,
  INATOR_STEMS_DE,
  INATOR_STEMS_EN,
  fugenForm,
  type DeGender,
} from '../src/lib/name-words';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
    expect(fugenForm(NOUN_DE.find((n) => n.word === 'Maus')!)).toBe('Mäuse');
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

  it('accepts good custom names including umlauts', () => {
    for (const name of ['PilotKid', 'Leo Pilot', 'Käptn Süß', 'Mäuse-Bär', 'Flinker Fuchs']) {
      expect(validateDisplayName(name, 'custom').ok, name).toBe(true);
      expect(serverValidate(name, 'custom').ok, name).toBe(true);
    }
  });

  it('rejects email, phone, URL, profanity, leetspeak, and short custom names', () => {
    const blocked = [
      'ada@x.com', 'www.bad.com', 'https://x.de', 'Call 55512', '12345',
      'fuckstar', 'f4ckstar', 'sh1tbox', 's c h e i s s e', 'hur3nkind', 'ab', '!!',
    ];
    for (const name of blocked) {
      expect(validateDisplayName(name, 'custom').ok, name).toBe(false);
      expect(serverValidate(name, 'custom').ok, name).toBe(false);
    }
    expect(validateDisplayName('Call 55512', 'custom')).toEqual({ ok: false, reason: 'pii' });
    expect(validateDisplayName('12345', 'custom')).toEqual({ ok: false, reason: 'pii' });
    expect(validateDisplayName('fuckstar', 'custom')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateDisplayName('f4ckstar', 'custom')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateDisplayName('sh1tbox', 'custom')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateDisplayName('ab', 'custom')).toEqual({ ok: false, reason: 'length' });
    expect(hasProfanity('f4ck')).toBe(true);
    expect(hasProfanity('s c h e i s s e')).toBe(true);
    expect(hasProfanity('PilotKid')).toBe(false);
    expect(validateDisplayName('PilotKid', 'custom').ok).toBe(true);
    expect(validateDisplayName('Raketen-Pinguin', 'generated').ok).toBe(true);
    expect(validateDisplayName('Flocken-Frosch', 'generated').ok).toBe(true);
    expect(validateDisplayName('Fox 42', 'custom').ok).toBe(true);
  });

  it('server copy rejects the same invalid names for every identity', () => {
    expect(serverValidate('ada@x.com', 'custom').ok).toBe(false);
    expect(serverValidate('PilotKid', 'custom').ok).toBe(true);
    expect(serverValidate('Cosmic Fox 42', 'generated').ok).toBe(true);
    expect(serverValidate('PilotKid', 'generated').ok).toBe(true);
    expect(serverValidate('Raketen-Pinguin', 'generated').ok).toBe(true);
    expect(serverValidate('Flocken-Frosch', 'generated').ok).toBe(true);
    expect(serverValidate('Kühnes Kätzchen', 'generated').ok).toBe(true);
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../server/spacetimedb/src/index.ts'), 'utf8');
    expect(src).not.toContain('Custom names require a signed-in parent account');
    expect(src).toContain('uniquifyDisplayName');
    expect(src).toMatch(/Custom names are allowed for every identity/);
  });

  it('uniquifies a taken name with a two-digit suffix that still fits', () => {
    const taken = new Set(['leo pilot', 'leo pilot 10']);
    const next = uniquifyDisplayName('Leo Pilot', (key) => taken.has(key));
    expect(next).toBe('Leo Pilot 11');
    expect(next.length).toBeLessThanOrEqual(16);
    expect(uniquifyDisplayName('Free Name', () => false)).toBe('Free Name');
  });

  it('uses real German umlauts and ß instead of ae/oe/ue/ss transliterations', () => {
    const words = [
      ...ADJ_DE,
      ...NOUN_DE.map((n) => n.word),
      ...NOUN_DE.map((n) => fugenForm(n)),
      ...PUNS_DE,
      ...RHYMES_DE.flat(),
      ...DOOM_TAILS_DE,
      ...TITLE_NOUNS_DE,
      'Käptn',
    ];
    const allowedAeOeUe = new Set([
      'feuer', 'neue', 'quelle', 'steuer', 'bauer', 'mauer', 'dauer', 'trauer',
      'sauer', 'teuer', 'abenteuer', 'schauen', 'bauen', 'phoenix',
    ]);
    const hits: string[] = [];
    for (const word of words) {
      const lower = word.toLowerCase();
      if (!/ae|oe|ue/.test(lower)) continue;
      const ok = [...allowedAeOeUe].some((allow) => lower === allow || lower.includes(allow));
      if (!ok) hits.push(word);
    }
    expect(hits, `transliterated umlauts: ${hits.join(', ')}`).toEqual([]);
    expect(ADJ_DE).toContain('Kühn');
    expect(ADJ_DE).toContain('Süß');
    expect(NOUN_DE.some((n) => n.word === 'Bär')).toBe(true);
    expect(NOUN_DE.some((n) => n.word === 'Käse')).toBe(true);
    expect(NOUN_DE.some((n) => n.word === 'Mütze')).toBe(true);
    expect(NOUN_DE.some((n) => n.word === 'Fuß')).toBe(true);
    expect(DOOM_TAILS_DE).toContain('Spaß');
    expect(words.join(' ')).not.toMatch(/Baer|Kaese|Kuehn|Muetze|Spass|Suess|Floete|Loeffel/);
  });

  it('pairs German titles with natural funny nouns and keeps McX sparse', () => {
    const titleWords = new Set(['käptn', 'agent', 'spion', 'doktor', 'baron', 'graf', 'scout', 'pilot', 'kadett', 'ritter']);
    const allowed = new Set(TITLE_NOUNS_DE.map((w) => w.toLowerCase()));
    let titles = 0;
    let mcx = 0;
    for (let i = 0; i < 400; i++) {
      const name = generateDisplayName('de');
      const core = name.replace(/\s+\d{1,3}$/, '');
      if (/ Mc/i.test(core)) mcx += 1;
      const spaced = core.match(/^([\p{L}]+) ([\p{L}]+)$/u);
      if (spaced && titleWords.has(spaced[1].toLowerCase())) {
        expect(allowed.has(spaced[2].toLowerCase())).toBe(true);
        titles += 1;
      }
    }
    expect(titles).toBeGreaterThan(10);
    expect(mcx / 400).toBeGreaterThanOrEqual(0.02);
    expect(mcx / 400).toBeLessThanOrEqual(0.09);
    const lemmas = new Set(NOUN_DE.map((n) => n.word));
    for (const word of TITLE_NOUNS_DE) expect(lemmas.has(word)).toBe(true);
  });

  it('uses a Latin-capable UI font stack for canvas and DOM', () => {
    const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'index.html'), 'utf8');
    expect(html).toMatch(/font-family:\s*"Trebuchet MS",\s*"Segoe UI",\s*Arial,\s*"Noto Sans",\s*"DejaVu Sans",\s*sans-serif/);
    expect(html).toMatch(/Trebuchet MS, Segoe UI, Arial, Noto Sans, DejaVu Sans/);
    expect(html).toContain('Noto Sans');
    expect(html).toContain('DejaVu Sans');
  });

  it('builds -inator names from full curated stems without truncating', () => {
    const stems = {
      en: new Set(INATOR_STEMS_EN.map((s) => s.toLowerCase())),
      de: new Set(INATOR_STEMS_DE.map((s) => s.toLowerCase())),
    };
    for (const stem of [...INATOR_STEMS_EN, ...INATOR_STEMS_DE]) {
      expect(`${stem}-inator`.length).toBeLessThanOrEqual(16);
    }
    let hits = 0;
    for (let i = 0; i < 800; i++) {
      const lang = i % 2 ? 'de' : 'en';
      const core = generateDisplayName(lang).replace(/\s+\d{1,3}$/, '');
      const m = core.match(/^([\p{L}]+)-inator$/iu);
      if (!m) {
        expect(core.toLowerCase().includes('inator') && !/-inator$/i.test(core)).toBe(false);
        continue;
      }
      expect(stems[lang].has(m[1].toLowerCase()), core).toBe(true);
      hits += 1;
    }
    expect(hits).toBeGreaterThan(8);
  });
});
