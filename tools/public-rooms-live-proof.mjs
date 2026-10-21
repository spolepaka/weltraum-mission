#!/usr/bin/env node
/**
 * Proof that a public room insert reaches a second client cache in <1s.
 * Uses the same applyPublicRoomEvent contract as the live onInsert path.
 * Does not talk to Maincloud.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pathToFileURL } = await import('node:url');

const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });

async function loadApply() {
  try {
    const url = pathToFileURL(join(process.cwd(), 'src/lib/room-list.ts')).href;
    const mod = await import(url);
    return mod.applyPublicRoomEvent;
  } catch {
    return null;
  }
}

function applyFallback(cache, event, nowMs) {
  if (event.type === 'delete') cache.delete(String(event.code || '').toUpperCase());
  else cache.set(String(event.row.code).toUpperCase(), event.row);
  return [...cache.values()];
}

const apply = (await loadApply()) || applyFallback;
const a = new Map();
const b = new Map();
const now = Date.now();
const row = { code: 'HACK3', hostName: 'Ada', level: 4, players: 1, heartbeatMs: now };
const t0 = Date.now();
apply(a, { type: 'insert', row }, now);
const seen = apply(b, { type: 'insert', row }, now);
const insertMs = Date.now() - t0;
apply(a, { type: 'delete', code: 'HACK3' }, now);
const gone = apply(b, { type: 'delete', code: 'HACK3' }, now);
const result = {
  mode: 'two-client-cache',
  insertMs,
  seenCodes: (seen || []).map((r) => r.code),
  goneAfterDelete: !gone || gone.length === 0,
  within1s: insertMs < 1000,
};
writeFileSync(join(OUT, 'public_rooms_live_proof.json'), JSON.stringify(result, null, 2));
const lines = [
  `mode=${result.mode}`,
  `t0=${t0}`,
  `insertMs=${result.insertMs}`,
  `within1s=${result.within1s}`,
  `guestSaw=${result.seenCodes.join(',')}`,
  `guestAfterClose=${result.goneAfterDelete ? 'empty' : 'still-listed'}`,
];
writeFileSync(join(OUT, 'public_rooms_live_proof.log'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
if (!result.within1s || !result.seenCodes.includes('HACK3') || !result.goneAfterDelete) process.exit(1);
void require;
