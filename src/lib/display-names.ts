import {
  ADJ_DE,
  ADJ_EN,
  DOOM_TAILS,
  DOOM_TAILS_DE,
  NOUN_DE,
  NOUN_EN,
  PUNS_DE,
  PUNS_EN,
  RHYMES_DE,
  RHYMES_EN,
  fugenForm,
  inflectDeAdj,
  type DeGender,
  type DeNoun,
} from './name-words';

export { fugenForm, inflectDeAdj, type DeGender, type DeNoun };

export const DISPLAY_NAME_KEY = 'spaceMissionDisplayName';
export const NAME_MIN = 3;
export const NAME_MAX = 16;
export const RECENT_STEM_LIMIT = 40;

const BLOCKED = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'nazi', 'hitler',
  'sex', 'porn', 'nude', 'slut', 'whore', 'nigger', 'faggot', 'cunt',
  'arsch', 'scheisse', 'scheiße', 'fotze', 'hure', 'wichser', 'mistkerl',
  'heil', 'fuhrer', 'führer', 'rape', 'kill', 'die', 'hate',
];

export type NameKind = 'generated' | 'custom';

export interface StoredDisplayName {
  name: string;
  kind: NameKind;
}

export type NameLang = 'en' | 'de';

export interface NameParts {
  name: string;
  adj: string | null;
  nouns: string[];
}

type PatternId =
  | 'adjNoun'
  | 'alliterate'
  | 'rhyme'
  | 'title'
  | 'great'
  | 'doom'
  | 'mcx'
  | 'space'
  | 'compound'
  | 'inator'
  | 'pun';

const PATTERNS: { id: PatternId; weight: number }[] = [
  { id: 'adjNoun', weight: 22 },
  { id: 'alliterate', weight: 14 },
  { id: 'rhyme', weight: 8 },
  { id: 'title', weight: 8 },
  { id: 'great', weight: 1 },
  { id: 'doom', weight: 7 },
  { id: 'mcx', weight: 8 },
  { id: 'space', weight: 1 },
  { id: 'compound', weight: 14 },
  { id: 'inator', weight: 5 },
  { id: 'pun', weight: 4 },
];

const TITLES_EN = ['Captain', 'Agent', 'Dr', 'Sir', 'Chef', 'Scout', 'Pilot', 'Major', 'Cadet', 'Ensign'] as const;
const TITLES_DE = ['Käptn', 'Spion', 'Doktor', 'Baron', 'Graf', 'Scout', 'Pilot', 'Major', 'Kadett', 'Ritter'] as const;

const recentStems: string[] = [];
const recentNames: string[] = [];

export function resetNameHistory(): void {
  recentStems.length = 0;
  recentNames.length = 0;
}

function rememberStems(stems: string[]): void {
  for (const stem of stems) {
    const key = stem.toLowerCase();
    if (!key) continue;
    recentStems.push(key);
  }
  while (recentStems.length > RECENT_STEM_LIMIT) recentStems.shift();
}

function rememberName(name: string): void {
  const key = name.toLowerCase();
  const core = name.replace(/\s+\d{1,3}$/, '').toLowerCase();
  recentNames.push(key);
  if (core !== key) recentNames.push(core);
  while (recentNames.length > 400) recentNames.shift();
}

function nameTaken(name: string): boolean {
  return recentNames.includes(name.toLowerCase());
}

function avoidSet(extra?: Set<string>): Set<string> {
  const out = new Set(recentStems);
  extra?.forEach((s) => out.add(s.toLowerCase()));
  return out;
}

export function cryptoRnd(): number {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }
  return Math.random();
}

function pick<T>(list: readonly T[], rnd: () => number): T {
  return list[Math.floor(rnd() * list.length) % list.length];
}

function pickWeighted<T extends { weight: number }>(items: readonly T[], rnd: () => number): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = rnd() * total;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

function pickFresh<T>(list: readonly T[], rnd: () => number, keyOf: (item: T) => string[], avoid: Set<string>): T {
  if (!list.length) throw new Error('empty pick list');
  for (let i = 0; i < 24; i++) {
    const item = pick(list, rnd);
    if (!keyOf(item).some((k) => avoid.has(k.toLowerCase()))) return item;
  }
  return pick(list, rnd);
}

function clip(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= NAME_MAX) return trimmed;
  return trimmed.slice(0, NAME_MAX).trim();
}

function withOptionalNumber(base: string, rnd: () => number): string | null {
  const core = clip(base.replace(/\s+\d{1,3}$/, ''));
  const preferNumber = rnd() < 0.25 || nameTaken(core);
  if (!preferNumber && core.length >= NAME_MIN && validateDisplayName(core, 'generated').ok && !nameTaken(core)) {
    return core;
  }
  for (let i = 0; i < 20; i++) {
    const n = 10 + Math.floor(rnd() * 90);
    const spaced = `${core} ${n}`;
    if (spaced.length <= NAME_MAX && !nameTaken(spaced) && validateDisplayName(spaced, 'generated').ok) {
      return spaced;
    }
  }
  if (core.length >= NAME_MIN && validateDisplayName(core, 'generated').ok && !nameTaken(core)) return core;
  return null;
}

export function hasProfanity(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^a-zäöüß]/g, '');
  return BLOCKED.some((w) => compact.includes(w));
}

function shortDeNouns(max = 8): readonly DeNoun[] {
  const short = NOUN_DE.filter((n) => n.word.length <= max);
  return short.length ? short : NOUN_DE;
}

function shortEnNouns(max = 8): readonly string[] {
  const short = NOUN_EN.filter((w) => w.length <= max);
  return short.length ? short : NOUN_EN;
}

function articleFor(gender: DeGender): string {
  return gender === 'm' ? 'Der' : gender === 'f' ? 'Die' : 'Das';
}

function fit(name: string): string | null {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) return null;
  return trimmed;
}

function buildPattern(lang: NameLang, id: PatternId, rnd: () => number, avoid: Set<string>): NameParts | null {
  if (lang === 'de') return buildDe(id, rnd, avoid);
  return buildEn(id, rnd, avoid);
}

function buildEn(id: PatternId, rnd: () => number, avoid: Set<string>): NameParts | null {
  const adj = () => pickFresh(ADJ_EN, rnd, (a) => [a], avoid);
  const noun = () => pickFresh(NOUN_EN, rnd, (n) => [n], avoid);
  if (id === 'adjNoun' || id === 'alliterate') {
    const a = adj();
    const same = NOUN_EN.filter((w) => w[0]?.toLowerCase() === a[0]?.toLowerCase());
    const n = id === 'alliterate'
      ? pickFresh(same.length ? same : NOUN_EN, rnd, (w) => [w], avoid)
      : noun();
    const name = fit(`${a} ${n}`);
    return name ? { name, adj: a, nouns: [n] } : null;
  }
  if (id === 'rhyme') {
    const pair = pickFresh(RHYMES_EN, rnd, (p) => [p[0], p[1]], avoid);
    const name = fit(`${pair[0]} ${pair[1]}`);
    return name ? { name, adj: pair[0], nouns: [pair[1]] } : null;
  }
  if (id === 'title') {
    const title = pick(TITLES_EN, rnd);
    const n = pickFresh(shortEnNouns(title === 'Captain' ? 8 : 10), rnd, (w) => [w], avoid);
    const name = fit(`${title} ${n}`);
    return name ? { name, adj: null, nouns: [n] } : null;
  }
  if (id === 'great') {
    const n = pickFresh(shortEnNouns(8), rnd, (w) => [w], avoid);
    const name = fit(`The Great ${n}`);
    return name ? { name, adj: null, nouns: [n] } : null;
  }
  if (id === 'doom') {
    const n = pickFresh(shortEnNouns(7), rnd, (w) => [w], avoid);
    const tail = pick(DOOM_TAILS, rnd);
    const name = fit(`${n} of ${tail}`);
    return name ? { name, adj: null, nouns: [n] } : null;
  }
  if (id === 'mcx') {
    const a = pickFresh(shortEnNouns(6), rnd, (w) => [w], avoid);
    const b = pickFresh(shortEnNouns(6), rnd, (w) => [w], avoid);
    const name = fit(`${a} Mc${b}`);
    return name ? { name, adj: null, nouns: [a, b] } : null;
  }
  if (id === 'space') {
    const n = pickFresh(shortEnNouns(10), rnd, (w) => [w], avoid);
    const name = fit(`Space ${n}`);
    return name ? { name, adj: null, nouns: [n] } : null;
  }
  if (id === 'compound') {
    const a = noun();
    const b = noun();
    const glued = `${a}${b}`;
    const name = fit(glued.length <= NAME_MAX ? glued : `${a} ${b}`);
    return name ? { name, adj: null, nouns: [a, b] } : null;
  }
  if (id === 'inator') {
    const n = pickFresh(shortEnNouns(7), rnd, (w) => [w], avoid);
    const name = fit(`${n.replace(/e$/i, '')}-inator`);
    return name ? { name, adj: null, nouns: [n] } : null;
  }
  const pun = pickFresh(PUNS_EN, rnd, (p) => p.split(/[\s-]+/), avoid);
  return fit(pun) ? { name: pun, adj: null, nouns: pun.split(/[\s-]+/) } : null;
}

function buildDe(id: PatternId, rnd: () => number, avoid: Set<string>): NameParts | null {
  const adj = () => pickFresh(ADJ_DE, rnd, (a) => [a], avoid);
  const noun = () => pickFresh(NOUN_DE, rnd, (n) => [n.word, fugenForm(n)], avoid);
  if (id === 'adjNoun' || id === 'alliterate') {
    for (let i = 0; i < 16; i++) {
      const a = adj();
      const same = NOUN_DE.filter((x) => x.word[0]?.toLowerCase() === a[0]?.toLowerCase());
      const n = id === 'alliterate'
        ? pickFresh(same.length ? same : NOUN_DE, rnd, (x) => [x.word], avoid)
        : noun();
      const name = fit(`${inflectDeAdj(a, n.gender)} ${n.word}`);
      if (name) return { name, adj: a, nouns: [n.word] };
    }
    return null;
  }
  if (id === 'rhyme') {
    const pair = pickFresh(RHYMES_DE, rnd, (p) => [p[0], p[1]], avoid);
    const name = fit(`${pair[0]} ${pair[1]}`);
    return name ? { name, adj: null, nouns: [...pair] } : null;
  }
  if (id === 'title') {
    const title = pick(TITLES_DE, rnd);
    const n = pickFresh(shortDeNouns(title === 'Doktor' ? 8 : 9), rnd, (x) => [x.word], avoid);
    const name = fit(`${title} ${n.word}`);
    return name ? { name, adj: null, nouns: [n.word] } : null;
  }
  if (id === 'great') {
    const n = pickFresh(shortDeNouns(6), rnd, (x) => [x.word], avoid);
    const name = fit(`${articleFor(n.gender)} Große ${n.word}`);
    return name ? { name, adj: null, nouns: [n.word] } : null;
  }
  if (id === 'doom') {
    const n = pickFresh(shortDeNouns(6), rnd, (x) => [x.word], avoid);
    const tail = pick(DOOM_TAILS_DE, rnd);
    const name = fit(`${n.word} von ${tail}`);
    return name ? { name, adj: null, nouns: [n.word] } : null;
  }
  if (id === 'mcx') {
    const a = pickFresh(shortDeNouns(6), rnd, (x) => [x.word], avoid);
    const b = pickFresh(shortDeNouns(6), rnd, (x) => [x.word], avoid);
    const name = fit(`${a.word} Mc${b.word}`);
    return name ? { name, adj: null, nouns: [a.word, b.word] } : null;
  }
  if (id === 'space') {
    const n = pickFresh(shortDeNouns(9), rnd, (x) => [x.word], avoid);
    const name = fit(`Weltraum ${n.word}`);
    return name ? { name, adj: null, nouns: [n.word] } : null;
  }
  if (id === 'compound') {
    for (let i = 0; i < 16; i++) {
      const a = noun();
      const b = noun();
      if (a.word === b.word) continue;
      const name = fit(`${fugenForm(a)}-${b.word}`);
      if (name) return { name, adj: null, nouns: [a.word, b.word] };
    }
    return null;
  }
  if (id === 'inator') {
    const n = pickFresh(shortDeNouns(7), rnd, (x) => [x.word], avoid);
    const name = fit(`${n.word.replace(/e$/i, '')}-inator`);
    return name ? { name, adj: null, nouns: [n.word] } : null;
  }
  const pun = pickFresh(PUNS_DE, rnd, (p) => p.split(/[\s-]+/), avoid);
  return fit(pun) ? { name: pun, adj: null, nouns: pun.split(/[\s-]+/) } : null;
}

export function generateNameParts(lang: NameLang = 'en', extraAvoid?: Set<string>): NameParts {
  const rnd = cryptoRnd;
  const avoid = avoidSet(extraAvoid);
  for (let i = 0; i < 48; i++) {
    const pattern = pickWeighted(PATTERNS, rnd);
    const parts = buildPattern(lang, pattern.id, rnd, avoid);
    if (!parts) continue;
    const raw = withOptionalNumber(parts.name, rnd);
    if (!raw) continue;
    const name = clip(raw);
    if (name.length < NAME_MIN || hasProfanity(name) || nameTaken(name)) continue;
    const checked = validateDisplayName(name, 'generated');
    if (!checked.ok) continue;
    const out = { ...parts, name: checked.name };
    rememberStems([out.adj || '', ...out.nouns].filter(Boolean));
    rememberName(out.name);
    return out;
  }
  const fallback = lang === 'de' ? 'Flinker Fuchs' : 'Turbo Fox';
  const n = 10 + Math.floor(cryptoRnd() * 90);
  return { name: `${fallback} ${n}`.slice(0, NAME_MAX), adj: lang === 'de' ? 'Flink' : 'Turbo', nouns: [lang === 'de' ? 'Fuchs' : 'Fox'] };
}

export function generateDisplayName(lang: NameLang = 'en', _salt = 0): string {
  return generateNameParts(lang).name;
}

export function generateNameChoices(lang: NameLang = 'en', count = 3, _salt = 0): string[] {
  const used = new Set<string>();
  const names = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < count * 32 && out.length < count; i++) {
    const parts = generateNameParts(lang, used);
    const key = parts.name.toLowerCase();
    if (names.has(key) || hasProfanity(parts.name)) continue;
    if (parts.adj && used.has(parts.adj.toLowerCase())) continue;
    if (parts.nouns.some((n) => used.has(n.toLowerCase()))) continue;
    names.add(key);
    if (parts.adj) used.add(parts.adj.toLowerCase());
    parts.nouns.forEach((n) => used.add(n.toLowerCase()));
    out.push(parts.name);
  }
  for (let extra = 0; out.length < count && extra < 80; extra++) {
    const parts = generateNameParts(lang, used);
    const key = parts.name.toLowerCase();
    if (names.has(key)) continue;
    names.add(key);
    if (parts.adj) used.add(parts.adj.toLowerCase());
    parts.nouns.forEach((n) => used.add(n.toLowerCase()));
    out.push(parts.name);
  }
  return out;
}

export function firstWord(name: string): string {
  return (name.split(/[\s-]/)[0] || '').toLowerCase();
}

export function adjectiveStemOf(name: string, lang: NameLang): string | null {
  const core = name.replace(/\s+\d{1,3}$/, '');
  const first = core.split(/[\s-]/)[0] || '';
  if (lang === 'en') {
    const hit = ADJ_EN.find((a) => a.toLowerCase() === first.toLowerCase());
    return hit ? hit.toLowerCase() : null;
  }
  const hit = ADJ_DE.find((a) => inflectDeAdj(a, 'm') === first || inflectDeAdj(a, 'f') === first || inflectDeAdj(a, 'n') === first);
  return hit ? hit.toLowerCase() : null;
}

export function loadDisplayName(): StoredDisplayName | null {
  try {
    const raw = localStorage.getItem(DISPLAY_NAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDisplayName;
    if (!parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDisplayName(stored: StoredDisplayName): void {
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}

export function looksLikeEmail(value: string): boolean {
  return /@/.test(value) || /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(value);
}

export function looksLikeUrl(value: string): boolean {
  return /https?:\/\//i.test(value) || /\bwww\./i.test(value) || /\b[a-z0-9-]+\.(com|net|org|de|io|app)\b/i.test(value);
}

export function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7;
}

export function validateDisplayName(raw: string, kind: NameKind): { ok: true; name: string } | { ok: false; reason: string } {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, reason: 'length' };
  if (!/^[\p{L}\p{N}]+(?:[- ][\p{L}\p{N}]+){0,3}$/u.test(name)) return { ok: false, reason: 'chars' };
  if (looksLikeEmail(name) || looksLikeUrl(name) || looksLikePhone(name)) return { ok: false, reason: 'pii' };
  if (hasProfanity(name)) return { ok: false, reason: 'blocked' };
  if (kind === 'generated' && !/[\p{L}]/u.test(name)) return { ok: false, reason: 'generated' };
  return { ok: true, name };
}

export function uniqueishName(base: string, taken: (n: string) => boolean): string {
  const core = base.replace(/\s+\d{1,3}$/, '').slice(0, NAME_MAX - 3).trim();
  for (let i = 0; i < 80; i++) {
    const suffix = i === 0 ? '' : ` ${10 + (i % 90)}`;
    const candidate = (core + suffix).slice(0, NAME_MAX);
    if (!taken(candidate.toLowerCase())) return candidate;
  }
  return `${core.slice(0, 10)} ${Math.floor(Math.random() * 90) + 10}`.slice(0, NAME_MAX);
}
