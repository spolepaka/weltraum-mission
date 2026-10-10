import { ADJ_DE, ADJ_EN, NOUN_DE, NOUN_EN, PUNS_DE, PUNS_EN } from './name-words';

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

function words(lang: NameLang): { adj: readonly string[]; noun: readonly string[]; puns: readonly string[] } {
  return lang === 'de'
    ? { adj: ADJ_DE, noun: NOUN_DE, puns: PUNS_DE }
    : { adj: ADJ_EN, noun: NOUN_EN, puns: PUNS_EN };
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

function withOptionalNumber(base: string, rnd: () => number): string {
  if (rnd() > 0.28) return clip(base);
  const n = 10 + Math.floor(rnd() * 90);
  const spaced = `${clip(base.replace(/\s+\d{1,3}$/, ''))} ${n}`;
  if (spaced.length <= NAME_MAX) return spaced;
  return clip(base);
}

export function hasProfanity(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^a-zäöüß]/g, '');
  return BLOCKED.some((w) => compact.includes(w));
}

function patternName(lang: NameLang, rnd: () => number): string {
  const { adj, noun, puns } = words(lang);
  const kind = Math.floor(rnd() * 7);
  if (kind === 0) {
    return `${pick(adj, rnd)} ${pick(noun, rnd)}`;
  }
  if (kind === 1) {
    const a = pick(noun, rnd);
    const b = pick(noun, rnd);
    if (lang === 'de') return `${a}-${b}`;
    return `${a}${b}`;
  }
  if (kind === 2) {
    const a = pick(adj, rnd);
    const b = sameLetter(noun, a[0] || 's', rnd);
    return `${a} ${b}`;
  }
  if (kind === 3) {
    const title = lang === 'de' ? 'Käptn' : 'Captain';
    return `${title} ${pick(noun, rnd)}`;
  }
  if (kind === 4) {
    const core = pick(noun, rnd).replace(/e$/i, '');
    return lang === 'de' ? `${core}-inator` : `${core}-inator`;
  }
  if (kind === 5) {
    return pick(puns, rnd);
  }
  const a = pick(adj, rnd);
  const b = pick(noun, rnd);
  return lang === 'de' ? `${a}-${b}` : `${a} ${b}`;
}

export function generateDisplayName(lang: NameLang = 'en', salt = 0): string {
  const rnd = mulberry(Math.abs(Math.floor(salt) || Date.now()));
  for (let i = 0; i < 40; i++) {
    const raw = withOptionalNumber(patternName(lang, rnd), rnd);
    const name = clip(raw);
    if (name.length < NAME_MIN) continue;
    if (hasProfanity(name)) continue;
    const checked = validateDisplayName(name, 'generated');
    if (checked.ok) return checked.name;
  }
  return lang === 'de' ? 'Turbo Fuchs 11' : 'Turbo Fox 11';
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
