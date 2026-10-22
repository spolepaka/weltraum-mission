/**
 * Account load / server echo must never toast already-earned achievements.
 * Only gameplay achCheck (quiet=false) may queue a pop-up.
 */

export function mergeSilentAchievements(
  done: Record<string, unknown>,
  incomingIds: string[],
  satisfiedIds: string[],
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [id, value] of Object.entries(done || {})) {
    if (id && value) next[id] = typeof value === 'number' ? value : 1;
  }
  for (const id of incomingIds || []) {
    if (id && !next[id]) next[id] = 1;
  }
  for (const id of satisfiedIds || []) {
    if (id && !next[id]) next[id] = 1;
  }
  return next;
}

export function shouldToastUnlock(alreadyDone: boolean, quiet: boolean): boolean {
  return !alreadyDone && !quiet;
}

export function filterEchoedQueue(queueIds: string[], incomingIds: string[]): string[] {
  const incoming = new Set((incomingIds || []).filter(Boolean));
  return (queueIds || []).filter((id) => id && !incoming.has(id));
}
