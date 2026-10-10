import {
  ADJ_DE,
  ADJ_EN,
  NOUN_DE,
  NOUN_EN,
  PUNS_DE,
  PUNS_EN,
  inflectDeAdj,
  type DeGender,
  type DeNoun,
} from './name-words';

export { inflectDeAdj, type DeGender, type DeNoun };

export const DISPLAY_NAME_KEY = 'spaceMissionDisplayName';
export const NAME_MIN = 3;
export const NAME_MAX = 16;

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

function pickDeNoun(rnd: () => number): DeNoun {
  return pick(NOUN_DE, rnd);
}

function sameLetterDeNoun(letter: string, rnd: () => number): DeNoun {
  const matches = NOUN_DE.filter((n) => n.word[0]?.toLowerCase() === letter.toLowerCase());
  return matches.length ? pick(matches, rnd) : pickDeNoun(rnd);
}

function mulberry(seed: number): () => number {
  let s = Math.abs(Math.floor(seed) || 1) >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: readonly T[], rnd: () => number): T {
  return list[Math.floor(rnd() * list.length) % list.length];
}

function sameLetter(list: readonly string[], letter: string, rnd: () => number): string {
  const matches = list.filter((w) => w[0]?.toLowerCase() === letter);
  return matches.length ? pick(matches, rnd) : pick(list, rnd);
}

function clip(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= NAME_MAX) return trimmed;
  return trimmed.slice(0, NAME_MAX).trim();
}

function withOptionalNumber(base: string, rnd: () => number, salt = 0): string {
  const n = 10 + (Math.abs(Math.floor(salt)) % 90);
  const core = clip(base.replace(/\s+\d{1,3}$/, ''));
  const spaced = `${core} ${n}`;
  if (rnd() < 0.25 && spaced.length <= NAME_MAX && validateDisplayName(spaced, 'generated').ok) {
    return spaced;
  }
  if (core.length >= NAME_MIN && validateDisplayName(core, 'generated').ok) return core;
  if (spaced.length <= NAME_MAX) return clip(spaced);
  return core;
}

export function hasProfanity(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^a-zäöüß]/g, '');
  return BLOCKED.some((w) => compact.includes(w));
}

function fitDeAdjNoun(rnd: () => number, alliterate: boolean): string {
  for (let i = 0; i < 16; i++) {
    const adj = pick(ADJ_DE, rnd);
    const noun = alliterate ? sameLetterDeNoun(adj[0] || 's', rnd) : pickDeNoun(rnd);
    const full = `${inflectDeAdj(adj, noun.gender)} ${noun.word}`;
    if (full.length <= NAME_MAX) return full;
  }
  return 'Flinker Fuchs';
}

function fitDeNounNoun(rnd: () => number): string {
  for (let i = 0; i < 16; i++) {
    const full = `${pickDeNoun(rnd).word}-${pickDeNoun(rnd).word}`;
    if (full.length <= NAME_MAX) return full;
  }
  return 'Komet-Keks';
}

function patternName(lang: NameLang, rnd: () => number, seed = 0): string {
  const adj = lang === 'de' ? ADJ_DE : ADJ_EN;
  const nounEn = NOUN_EN;
  const puns = lang === 'de' ? PUNS_DE : PUNS_EN;
  const kind = Math.abs(Math.floor(seed) || Math.floor(rnd() * 7)) % 7;
  if (kind === 0) {
    if (lang === 'de') return fitDeAdjNoun(rnd, false);
    return `${pick(adj, rnd)} ${pick(nounEn, rnd)}`;
  }
  if (kind === 1) {
    if (lang === 'de') return fitDeNounNoun(rnd);
    const glued = `${pick(nounEn, rnd)}${pick(nounEn, rnd)}`;
    return glued.length <= NAME_MAX ? glued : pick(nounEn, rnd);
  }
  if (kind === 2) {
    if (lang === 'de') return fitDeAdjNoun(rnd, true);
    const a = pick(adj, rnd);
    return `${a} ${sameLetter(nounEn, a[0] || 's', rnd)}`;
  }
  if (kind === 3) {
    const title = lang === 'de' ? 'Käptn' : 'Captain';
    if (lang === 'de') {
      const shortNouns = NOUN_DE.filter((n) => n.word.length <= 8);
      return `${title} ${pick(shortNouns.length ? shortNouns : NOUN_DE, rnd).word}`;
    }
    const shortNouns = nounEn.filter((w) => w.length <= 9);
    return `${title} ${pick(shortNouns.length ? shortNouns : nounEn, rnd)}`;
  }
  if (kind === 4) {
    const core = lang === 'de' ? pickDeNoun(rnd).word : pick(nounEn, rnd);
    const name = `${core.replace(/e$/i, '')}-inator`;
    return name.length <= NAME_MAX ? name : (lang === 'de' ? 'Fuchs-inator' : 'Fox-inator');
  }
  if (kind === 5 && seed % 5 === 0) {
    return puns[Math.abs(seed) % puns.length];
  }
  if (lang === 'de') return fitDeNounNoun(rnd);
  return `${pick(adj, rnd)} ${pick(nounEn, rnd)}`;
}

function saltAdjNoun(lang: NameLang, seed: number): string | null {
  if (lang === 'de') {
    const noun = NOUN_DE[Math.abs(seed) % NOUN_DE.length];
    const adj = ADJ_DE[Math.floor(Math.abs(seed) / NOUN_DE.length) % ADJ_DE.length];
    const full = `${inflectDeAdj(adj, noun.gender)} ${noun.word}`;
    return full.length <= NAME_MAX ? full : null;
  }
  const noun = NOUN_EN[Math.abs(seed) % NOUN_EN.length];
  const adj = ADJ_EN[Math.floor(Math.abs(seed) / NOUN_EN.length) % ADJ_EN.length];
  const full = `${adj} ${noun}`;
  return full.length <= NAME_MAX ? full : null;
}

export function generateDisplayName(lang: NameLang = 'en', salt = 0): string {
  const seed = Math.abs(Math.floor(salt) || Date.now());
  const rnd = mulberry(seed);
  for (let i = 0; i < 40; i++) {
    if (i === 0) {
      const indexed = saltAdjNoun(lang, seed);
      if (indexed && validateDisplayName(indexed, 'generated').ok && !hasProfanity(indexed)) {
        return withOptionalNumber(indexed, rnd, seed);
      }
    }
    const raw = withOptionalNumber(patternName(lang, rnd, seed + i * 17), rnd, seed + i * 17);
    const name = clip(raw);
    if (name.length < NAME_MIN) continue;
    if (hasProfanity(name)) continue;
    const checked = validateDisplayName(name, 'generated');
    if (checked.ok) return checked.name;
  }
  const fallback = lang === 'de' ? 'Flinker Fuchs' : 'Turbo Fox';
  return `${fallback} ${10 + (seed % 90)}`.slice(0, NAME_MAX);
}

export function generateNameChoices(lang: NameLang = 'en', count = 3, salt = 0): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < count * 24 && out.length < count; i++) {
    const name = generateDisplayName(lang, (salt || Date.now()) + i * 7919 + out.length * 13);
    const key = name.toLowerCase();
    if (seen.has(key) || hasProfanity(name)) continue;
    seen.add(key);
    out.push(name);
  }
  while (out.length < count) out.push(generateDisplayName(lang, salt + out.length * 101));
  return out;
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
