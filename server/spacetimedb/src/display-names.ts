export const NAME_MIN = 3;
export const NAME_MAX = 16;

const BLOCKED = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'nazi', 'hitler',
  'sex', 'porn', 'nude', 'slut', 'whore', 'nigger', 'faggot', 'cunt',
  'arsch', 'scheisse', 'scheiße', 'fotze', 'hure', 'wichser', 'mistkerl',
  'heil', 'fuhrer', 'führer', 'rape', 'kill', 'die', 'hate',
];

export type NameKind = 'generated' | 'custom';

const LEET_MAPS: Record<string, string>[] = [
  { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' },
  { '0': 'o', '1': 'i', '3': 'e', '4': 'u', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' },
];

function compactLeet(value: string, map: Record<string, string>): string {
  return value.toLowerCase().replace(/[013457@$!]/g, (c) => map[c] || c).replace(/[^a-zäöüß]/g, '');
}

function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}

function looksLikeUrl(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('http://') || lower.includes('https://') || lower.includes('www.')
    || /\b[a-z0-9-]+\.(com|net|org|de|io|app)\b/i.test(value);
}

function looksLikePhone(value: string): boolean {
  return value.replace(/\D/g, '').length > 4;
}

function hasProfanity(value: string): boolean {
  return LEET_MAPS.some((map) => {
    const compact = compactLeet(value, map);
    return BLOCKED.some((w) => compact.includes(w));
  });
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

export function nameKey(name: string): string {
  return name.toLowerCase();
}

export interface AccountNameRow {
  firebaseSub: string;
  name: string;
  createdAtMs: number;
}

/** Keep the earliest account; later duplicates must pick a new name. */
export function resolveDuplicateAccountNames(rows: AccountNameRow[]): {
  keep: AccountNameRow[];
  rename: AccountNameRow[];
} {
  const byKey = new Map<string, AccountNameRow[]>();
  for (const row of rows) {
    if (!row.firebaseSub || !row.name) continue;
    const key = nameKey(row.name);
    const list = byKey.get(key) || [];
    list.push(row);
    byKey.set(key, list);
  }
  const keep: AccountNameRow[] = [];
  const rename: AccountNameRow[] = [];
  for (const group of byKey.values()) {
    group.sort((a, b) => a.createdAtMs - b.createdAtMs || a.firebaseSub.localeCompare(b.firebaseSub));
    keep.push(group[0]);
    rename.push(...group.slice(1));
  }
  return { keep, rename };
}

export function isNameTakenByOther(
  name: string,
  ownerKey: string,
  claims: Iterable<{ nameKey: string; ownerKey: string }>,
): boolean {
  const key = nameKey(name);
  for (const claim of claims) {
    if (claim.nameKey === key && claim.ownerKey && claim.ownerKey !== ownerKey) return true;
  }
  return false;
}

/** @deprecated Account names reject instead of suffixing. Kept for generated-name helpers. */
export function uniquifyDisplayName(name: string, isTaken: (key: string) => boolean): string {
  if (!isTaken(nameKey(name))) return name;
  const core = name.replace(/\s+\d{1,3}$/, '').slice(0, NAME_MAX - 3).trim();
  for (let i = 10; i <= 99; i++) {
    const candidate = `${core} ${i}`.slice(0, NAME_MAX);
    if (!isTaken(nameKey(candidate))) return candidate;
  }
  throw new Error('Invalid display name: taken');
}
