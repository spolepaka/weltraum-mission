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

  if (!fetcher) {
    return cached;
  }

  const existing = inflight.get(L);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const row = await fetcher!(L);
      if (!row?.dataJson) return cached;
      const payload = parseLevelPayload(L, row.dataJson);
      cacheLevelPayload(payload);
      return payload;
    } catch {
      return cached;
    } finally {
      inflight.delete(L);
    }
  })();

  inflight.set(L, pending);
  return pending;
}

export function prefetchUnlocked(unlocked: number): number[] {
  const targets: number[] = [];
  for (const L of [unlocked, unlocked - 1]) {
    if (L > BUNDLED_LEVELS && L <= unlocked && L <= MAX_LEVEL && !cachedLevel(L)) {
      targets.push(L);
    }
  }
  for (const L of targets) {
    prefetchLog.push(L);
    void ensureLevel(L, unlocked);
  }
  return targets;
}

export function resetLevelRuntimeForTests(): void {
  inflight.clear();
  prefetchLog.length = 0;
  setLevelFetcher(null);
}

export { BUNDLED_LEVELS, MAX_LEVEL, cachedLevel, isBundledLevel, buildLevelPayload };
