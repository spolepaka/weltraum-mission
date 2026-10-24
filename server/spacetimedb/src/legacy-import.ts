/** One-time legacy localStorage import: unlock cannot exceed what stars plausibly support. */

export const DEFAULT_MAX_LEVEL = 250;

export function parseStarMap(starsJson: string): { highest: number; count: number } {
  let highest = 0;
  let count = 0;
  try {
    const stars = JSON.parse(starsJson) as Record<string, number>;
    for (const [levelStr, starVal] of Object.entries(stars || {})) {
      const level = parseInt(levelStr, 10);
      const starN = Number(starVal) || 0;
      if (!Number.isInteger(level) || level < 1 || starN <= 0) continue;
      count += 1;
      if (level > highest) highest = level;
    }
  } catch {
    return { highest: 0, count: 0 };
  }
  return { highest, count };
}

/**
 * Grant at most the claimed unlock, capped by star history.
 * Sparse forgeries (only a high level starred) collapse to count+1.
 * No stars → only the normal +1 next level from the server row.
 */
export function plausibleLegacyUnlock(
  claimed: number,
  serverUnlock: number,
  starsJson: string,
  maxLevel = DEFAULT_MAX_LEVEL,
): number {
  const claimedN = Math.max(1, Math.min(maxLevel, Math.floor(Number(claimed) || 1)));
  const server = Math.max(1, Math.min(maxLevel, Math.floor(Number(serverUnlock) || 1)));
  const { highest, count } = parseStarMap(starsJson);
  if (count <= 0) {
    return Math.min(claimedN, Math.min(server + 1, maxLevel));
  }
  const fromStars = Math.min(highest + 1, count + 1, maxLevel);
  return Math.max(1, Math.min(claimedN, Math.max(fromStars, Math.min(server + 1, maxLevel))));
}
