/**
 * Live online presence helpers. Sessions are per connection with a TTL so
 * ghost tabs drop off; counts and names are only returned to admins.
 */

export const ONLINE_TTL_US = 60 * 1_000_000;
export const ONLINE_ACTIVITIES = ['menu', 'solo', 'coop', 'versus'] as const;
export type OnlineActivity = (typeof ONLINE_ACTIVITIES)[number];

const ACTIVITY_RANK: Record<OnlineActivity, number> = {
  versus: 3,
  coop: 2,
  solo: 1,
  menu: 0,
};

export type OnlineRow = {
  identity: string;
  displayName: string;
  activity: OnlineActivity;
  connectedAtUs: number;
  lastBeatUs: number;
};

export type OnlinePerson = {
  name: string;
  activity: OnlineActivity;
  since: string;
};

export type OnlineSnapshot = {
  total: number;
  menu: number;
  solo: number;
  coop: number;
  versus: number;
  people: OnlinePerson[];
};

export function normalizeActivity(raw: unknown): OnlineActivity {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'solo' || v === 'coop' || v === 'versus') return v;
  return 'menu';
}

export function isFreshSession(nowUs: number, lastBeatUs: number, ttlUs = ONLINE_TTL_US): boolean {
  if (!nowUs || !lastBeatUs) return false;
  return nowUs - lastBeatUs <= ttlUs;
}

export function emptyOnlineSnapshot(): OnlineSnapshot {
  return { total: 0, menu: 0, solo: 0, coop: 0, versus: 0, people: [] };
}

export function summarizeOnline(rows: OnlineRow[], nowUs: number, ttlUs = ONLINE_TTL_US): OnlineSnapshot {
  const byIdent = new Map<string, OnlineRow>();
  for (const row of rows) {
    if (!isFreshSession(nowUs, row.lastBeatUs, ttlUs)) continue;
    const prev = byIdent.get(row.identity);
    if (!prev) {
      byIdent.set(row.identity, row);
      continue;
    }
    const rank = ACTIVITY_RANK[row.activity] - ACTIVITY_RANK[prev.activity];
    if (rank > 0 || (rank === 0 && row.lastBeatUs >= prev.lastBeatUs)) {
      byIdent.set(row.identity, row);
    }
  }
  const counts = emptyOnlineSnapshot();
  for (const row of byIdent.values()) {
    counts.total += 1;
    counts[row.activity] += 1;
    counts.people.push({
      name: row.displayName.trim() || 'Pilot',
      activity: row.activity,
      since: String(row.connectedAtUs),
    });
  }
  counts.people.sort((a, b) => a.name.localeCompare(b.name) || a.activity.localeCompare(b.activity));
  return counts;
}

export function publicOnlinePayload(isAdmin: boolean, snap: OnlineSnapshot): OnlineSnapshot & { admin: boolean } {
  if (!isAdmin) return { admin: false, ...emptyOnlineSnapshot() };
  return { admin: true, ...snap };
}
