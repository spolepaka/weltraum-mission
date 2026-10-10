export const DISPLAY_NAME_KEY = 'spaceMissionDisplayName';
export const NAME_MIN = 3;
export const NAME_MAX = 16;

const ADJ = {
  en: ['Cosmic', 'Stellar', 'Nova', 'Lunar', 'Solar', 'Comet', 'Orbit', 'Nebula', 'Quantum', 'Astro', 'Polar', 'Ion'],
  de: ['Cosmo', 'Nova', 'Luna', 'Komet', 'Orbit', 'Nebel', 'Quanten', 'Astro', 'Polar', 'Solar', 'Ion', 'Stern'],
} as const;

const NOUN = {
  en: ['Fox', 'Owl', 'Rocket', 'Star', 'Wolf', 'Hawk', 'Bear', 'Kit', 'Puffin', 'Drake'],
  de: ['Fuchs', 'Eule', 'Rakete', 'Stern', 'Wolf', 'Falke', 'Baer', 'Kit', 'Drache', 'Pilot'],
} as const;

const BLOCKED = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'nazi', 'hitler',
  'sex', 'porn', 'nude', 'slut', 'whore', 'nigger', 'faggot', 'cunt',
  'arsch', 'scheisse', 'scheiße', 'fotze', 'hure', 'wichser', 'mistkerl',
];

export type NameKind = 'generated' | 'custom';

export interface StoredDisplayName {
  name: string;
  kind: NameKind;
}

export function generateDisplayName(lang: 'en' | 'de' = 'en', salt = 0): string {
  const adj = ADJ[lang] || ADJ.en;
  const noun = NOUN[lang] || NOUN.en;
  const n = Math.abs(Math.floor(salt) || Date.now());
  const a = adj[n % adj.length];
  const b = noun[Math.floor(n / adj.length) % noun.length];
  const num = (n % 90) + 10;
  const name = `${a} ${b} ${num}`;
  if (name.length <= NAME_MAX) return name;
  return `${a.slice(0, 6)} ${b.slice(0, 6)} ${num}`.slice(0, NAME_MAX);
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

export function hasProfanity(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^a-zäöüß]/g, '');
  return BLOCKED.some((w) => compact.includes(w));
}

export function validateDisplayName(raw: string, kind: NameKind): { ok: true; name: string } | { ok: false; reason: string } {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, reason: 'length' };
  if (!/^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+){0,3}$/u.test(name)) return { ok: false, reason: 'chars' };
  if (looksLikeEmail(name) || looksLikeUrl(name) || looksLikePhone(name)) return { ok: false, reason: 'pii' };
  if (hasProfanity(name)) return { ok: false, reason: 'blocked' };
  if (kind === 'generated' && !/ \d{1,3}$/.test(name)) return { ok: false, reason: 'generated' };
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
