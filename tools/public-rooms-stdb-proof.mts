import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DbConnection } from '../src/lib/module_bindings/index.ts';

const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts';
const HOST = process.env.STDB_HOST || 'localhost:3000';
const MODULE = process.env.STDB_MODULE || 'weltraum-rooms-dev';
mkdirSync(OUT, { recursive: true });

function connect() {
  return new Promise<InstanceType<typeof DbConnection>>((resolve, reject) => {
    const conn = DbConnection.builder()
      .withUri(`ws://${HOST}`)
      .withDatabaseName(MODULE)
      .onConnect((c) => resolve(c))
      .onConnectError((_ctx, err) => reject(err))
      .build();
    setTimeout(() => reject(new Error('connect timeout')), 15000);
  });
}

const host = await connect();
const guest = await connect();

await new Promise<void>((resolve, reject) => {
  guest.subscriptionBuilder()
    .onApplied(() => resolve())
    .onError((ctx) => reject(ctx.event))
    .subscribe(['SELECT * FROM public_room']);
  setTimeout(() => reject(new Error('subscribe timeout')), 10000);
});

const seen: Array<{ code: string; t: number }> = [];
const gone: Array<{ code: string; t: number }> = [];
guest.db.publicRoom.onInsert((_ctx, row) => {
  seen.push({ code: row.code, t: Date.now() });
});
guest.db.publicRoom.onDelete((_ctx, row) => {
  gone.push({ code: row.code, t: Date.now() });
});

const t0 = Date.now();
host.reducers.publishPublicRoom({
  code: 'HACK3',
  hostName: 'Ada',
  level: 4,
  players: 1,
  inGame: false,
});

const insertMs = await new Promise<number | null>((resolve) => {
  const start = Date.now();
  const tick = () => {
    if (seen.length) return resolve(Date.now() - t0);
    if (Date.now() - start > 2500) return resolve(null);
    setTimeout(tick, 10);
  };
  tick();
});

const tClose = Date.now();
host.reducers.closePublicRoom({ code: 'HACK3' });
const deleteMs = await new Promise<number | null>((resolve) => {
  const start = Date.now();
  const tick = () => {
    if (gone.length) return resolve(Date.now() - tClose);
    if (Date.now() - start > 2500) return resolve(null);
    setTimeout(tick, 10);
  };
  tick();
});

host.disconnect();
guest.disconnect();

const result = {
  mode: 'local-stdb-two-clients',
  host: HOST,
  module: MODULE,
  insertMs,
  deleteMs,
  seenCodes: seen.map((s) => s.code),
  goneCodes: gone.map((s) => s.code),
  within1s: insertMs != null && insertMs < 1000,
};
writeFileSync(join(OUT, 'public_rooms_live_proof.json'), JSON.stringify(result, null, 2));
const lines = [
  `mode=${result.mode}`,
  `module=${MODULE}`,
  `insertMs=${insertMs}`,
  `deleteMs=${deleteMs}`,
  `within1s=${result.within1s}`,
  `guestSaw=${result.seenCodes.join(',')}`,
  `guestAfterClose=${result.goneCodes.join(',') || 'empty'}`,
];
writeFileSync(join(OUT, 'public_rooms_live_proof.log'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
if (!result.within1s) process.exit(1);
