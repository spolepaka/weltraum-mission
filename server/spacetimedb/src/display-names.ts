export const NAME_MIN = 3;
export const NAME_MAX = 16;

const BLOCKED = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'nazi', 'hitler',
  'sex', 'porn', 'nude', 'slut', 'whore', 'nigger', 'faggot', 'cunt',
  'arsch', 'scheisse', 'scheiße', 'fotze', 'hure', 'wichser', 'mistkerl',
];

export type NameKind = 'generated' | 'custom';

function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}

function looksLikeUrl(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('http://') || lower.includes('https://') || lower.includes('www.')
    || /\b[a-z0-9-]+\.(com|net|org|de|io|app)\b/i.test(value);
}

function looksLikePhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 7;
}

function hasProfanity(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^a-zäöüß]/g, '');
  return BLOCKED.some((w) => compact.includes(w));
}

export function validateDisplayName(raw: string, kind: NameKind): { ok: true; name: string } | { ok: false; reason: string } {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, reason: 'length' };
  if (!/^[A-Za-z0-9ÄÖÜäöüß]+(?: [A-Za-z0-9ÄÖÜäöüß]+){0,3}$/.test(name)) return { ok: false, reason: 'chars' };
  if (looksLikeEmail(name) || looksLikeUrl(name) || looksLikePhone(name)) return { ok: false, reason: 'pii' };
  if (hasProfanity(name)) return { ok: false, reason: 'blocked' };
  if (kind === 'generated' && !/ \d{1,3}$/.test(name)) return { ok: false, reason: 'generated' };
  return { ok: true, name };
}

export function nameKey(name: string): string {
  return name.toLowerCase();
}
