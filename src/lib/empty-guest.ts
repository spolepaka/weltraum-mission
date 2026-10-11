/** Shared empty-guest predicate for admin filters and purge. */

export type GuestLike = {
  email?: string;
  username?: string;
  coins?: string | number | bigint;
  unlocked?: number;
  ships?: string;
  banned?: boolean;
  testBot?: boolean;
  starCount?: number;
};

export function isEmptyGuest(row: GuestLike): boolean {
  if (row.email) return false;
  if (row.username) return false;
  if (row.banned) return false;
  if (row.testBot) return false;
  const coins = typeof row.coins === 'bigint' ? Number(row.coins) : Number(row.coins || 0);
  if (coins > 0) return false;
  if ((row.unlocked || 1) > 1) return false;
  const ships = (row.ships || '').split(',').map((s) => s.trim()).filter((s) => s && s !== 'starter');
  if (ships.length) return false;
  if ((row.starCount || 0) > 0) return false;
  return true;
}

export function daysAgoMicros(days: number, nowMs = Date.now()): number {
  return (nowMs - days * 24 * 3600 * 1000) * 1000;
}

export type PlayerFilter = {
  hideEmptyGuests?: boolean;
  signedIn?: boolean;
  guest?: boolean;
  banned?: boolean;
  activeToday?: boolean;
  testBot?: boolean;
  query?: string;
};

export function matchesPlayerFilter(row: GuestLike & {
  id?: string;
  signedIn?: boolean;
  activeToday?: boolean;
  linkedIds?: string;
  linkedTo?: string;
}, f: PlayerFilter): boolean {
  if (f.hideEmptyGuests && isEmptyGuest(row)) return false;
  if (f.signedIn && !row.email && !row.signedIn) return false;
  if (f.guest && (row.email || row.signedIn)) return false;
  if (f.banned && !row.banned) return false;
  if (f.activeToday && !row.activeToday) return false;
  if (f.testBot && !row.testBot) return false;
  const q = (f.query || '').trim().toLowerCase();
  if (!q) return true;
  const blob = `${row.id || ''} ${row.username || ''} ${row.email || ''} ${row.linkedIds || ''} ${row.linkedTo || ''}`.toLowerCase();
  return blob.includes(q);
}

export function sortPlayers<T extends Record<string, unknown>>(rows: T[], key: string, dir: 'asc' | 'desc'): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true }) * sign;
  });
}
