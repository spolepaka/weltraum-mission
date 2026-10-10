import {
  BUNDLED_LEVELS,
  MAX_LEVEL,
  buildLevelPayload,
  cacheLevelPayload,
  cachedLevel,
  isBundledLevel,
  type LevelPayload,
} from './level-catalog';

export type LevelFetcher = (level: number) => Promise<{ level: number; dataJson: string } | null>;

let fetcher: LevelFetcher | null = null;
const inflight = new Map<number, Promise<LevelPayload | null>>();
export const prefetchLog: number[] = [];

export function setLevelFetcher(fn: LevelFetcher | null): void {
  fetcher = fn;
}

export function parseLevelPayload(level: number, dataJson: string): LevelPayload {
  let parsed: Partial<LevelPayload> = {};
  try {
    parsed = JSON.parse(dataJson) as Partial<LevelPayload>;
  } catch {
    parsed = {};
  }
  const base = buildLevelPayload(level);
  return {
    ...base,
    ...parsed,
    level,
    feats: { ...base.feats, ...(parsed.feats || {}) },
    featCopy: parsed.featCopy || base.featCopy,
    boss: parsed.boss || base.boss,
  };
}

export async function ensureLevel(level: number, unlocked: number): Promise<LevelPayload | null> {
  const L = Math.floor(level);
  if (L < 1 || L > MAX_LEVEL) return null;
  if (L > unlocked) return null;
  if (isBundledLevel(L)) return buildLevelPayload(L);

  const cached = cachedLevel(L);
  if (cached && cached.feats) return cached;

  const existing = inflight.get(L);
  if (existing) return existing;

  const pending = (async () => {
    try {
      if (fetcher) {
        const row = await fetcher(L);
        if (row?.dataJson) {
          const payload = parseLevelPayload(L, row.dataJson);
          cacheLevelPayload(payload);
          return payload;
        }
      }
    } catch {
      // fall through to deterministic local catalog
    } finally {
      inflight.delete(L);
    }
    const local = buildLevelPayload(L);
    cacheLevelPayload(local);
    return local;
  })();

  inflight.set(L, pending);
  return pending;
}

export function prefetchUnlocked(unlocked: number): number[] {
  const cap = Math.max(1, Math.min(MAX_LEVEL, unlocked));
  const targets: number[] = [];
  const prefer = [cap, cap + 1, cap - 1];
  for (const L of prefer) {
    if (L > BUNDLED_LEVELS && L <= cap + 1 && L <= MAX_LEVEL && !cachedLevel(L)) targets.push(L);
  }
  for (let L = BUNDLED_LEVELS + 1; L <= cap; L++) {
    if (!cachedLevel(L) && !targets.includes(L)) targets.push(L);
  }
  for (const L of targets) {
    prefetchLog.push(L);
    void ensureLevel(L, Math.max(cap, L));
  }
  return targets;
}

export function resetLevelRuntimeForTests(): void {
  inflight.clear();
  prefetchLog.length = 0;
  setLevelFetcher(null);
}

export { BUNDLED_LEVELS, MAX_LEVEL, cachedLevel, isBundledLevel, buildLevelPayload };
