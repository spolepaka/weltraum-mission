/**
 * Weltraum-Mission SpacetimeDB Module
 * Stage Zero: Anonymous identity, progress sync, level gating, error tracking
 */

import { schema, table, t } from 'spacetimedb/server';
import { assertTrustedCaller, authSnapshotFromCtx, isFirebaseIssuer } from './auth-trust';
import { buildLevelPayload } from './level-catalog';
import { nameKey, validateDisplayName, type NameKind } from './display-names';
import { plausibleLegacyUnlock } from './legacy-import';
import { isMillionScaleGrant, maxCoinsForLevel, salePrice, UNLOCK_SHIPS, upgradeSalePrice } from './economy';
import { prizeToAward, utcDayKeyFromMicros, validateVersusReport, VERSUS_QUEUE_TTL_US } from './versus';
import {
  ADMIN_ROLES_SEEDED_KEY,
  bindAdminCtx,
  canGrantAdmin,
  canRevokeAdmin,
  inspectSenderAuth,
  isAdminUid,
  isGrantedAdmin,
  isOwnerEmail,
  normalizeEmail,
  OWNER_EMAIL,
  applySeedAdminRoles,
} from './admin';
import { GEO_RETENTION_MS, STORE_FULL_IP, isEmptyGuestRow, verifyGeo } from './geo';
import {
  ONLINE_TTL_US,
  normalizeActivity,
  publicOnlinePayload,
  summarizeOnline,
  type OnlineRow,
} from './online';

/** Account-linked only. Do not call from guest gameplay — local hosts trap on JWT lookup. */
function assertTrusted(ctx: { senderAuth?: { hasJWT: boolean; isInternal?: boolean; jwt?: { issuer?: string } | null } }): void {
  try {
    assertTrustedCaller(authSnapshotFromCtx(ctx));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Untrusted token issuer')) throw err;
    console.warn(`Issuer check skipped: ${msg}`);
  }
}

const MAX_LEVEL = 100;
const MAX_COINS = 10_000_000;
const MAX_SCORE = 10_000_000;
const MAX_UPGRADE_LEVEL = 5;

const VALID_SHIPS = new Set([
  'starter', 'blitz', 'komet', 'doppel', 'eis', 'falke', 'feuer', 'stern',
  'titan', 'lanze', 'koenig', 'nova', 'quanten', 'uni', 'rochen', 'phoenix',
  'hammer', 'zwilling', 'gravitron', 'spektral', 'segler', 'schatten',
  'drache', 'omega', 'frostwal', 'lindwurm', 'hydra', 'regenbogen', 'kaiserbrecher',
  'beepbuggy', 'cloudcoupe', 'shadowspeeder', 'chromewasp', 'apexflash'
]);

const VALID_ACHIEVEMENTS = new Set([
  // Current client ACH ids (36)
  'first', 'lv10', 'lv50', 'max12', 'max25', 'max50', 'max75', 'max100',
  'rock100', 'rock1k', 'rock10k', 'ufo25', 'ufo250',
  'boss1', 'boss10', 'boss30', 'comet5',
  'combo10', 'combo25', 'combo50',
  'coin1k', 'coin10k', 'coin100k',
  'star25', 'three10', 'three40', 'pow50',
  'nohit1', 'nohit10', 'ships5', 'ships15',
  'golden', 'treasure', 'twoP', 'online', 'ghost',
  // Legacy ids still stored on older rows
  'firstWin', 'boss3', 'noHit', 'speedrun',
  'coins1k', 'coins10k', 'coins100k', 'allShips', 'maxUpgrades',
  'level25', 'level50', 'level75', 'level100', 'perfect3', 'missions10', 'sessions50',
]);

const SECRET_CODES: Record<string, { key: string; coins: number }> = {
  'JOSHI10000': { key: 'secret2', coins: 10000 },
  'AMELIA500': { key: 'secretAmelia', coins: 500 },
  'JOSHIE1000000': { key: 'secretMillion', coins: 1000000 },
};

const VALID_UPGRADE_IDS = new Set(['heart', 'rate', 'dmg', 'dur', 'mag']);

const spacetimedb = schema({
  player: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      createdAt: t.timestamp(),
      lastSeenAt: t.timestamp(),
      language: t.string().default('en'),
    }
  ),
  
  playerProgress: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      unlockedLevel: t.u32().default(1),
      totalScore: t.u64().default(BigInt(0)),
    }
  ),
  
  levelStars: table(
    { public: false },
    {
      identity: t.identity().index('btree'),
      level: t.u32(),
      stars: t.u32(),
      bestScore: t.u64(),
    }
  ),
  
  playerShop: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      coins: t.u64().default(BigInt(0)),
      equippedShip: t.string().default('starter'),
    }
  ),
  
  ownedShip: table(
    { public: false },
    {
      identity: t.identity().index('btree'),
      shipId: t.string(),
    }
  ),
  
  playerUpgrades: table(
    { public: false },
    {
      identity: t.identity().index('btree'),
      upgradeId: t.string(),
      level: t.u32(),
    }
  ),
  
  usedSecretCode: table(
    { public: false },
    {
      identity: t.identity().index('btree'),
      codeKey: t.string(),
    }
  ),
  
  playerSettings: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      muted: t.bool().default(false),
      twoPlayerMode: t.bool().default(false),
      ghostMode: t.bool().default(true),
    }
  ),
  
  playerAchievements: table(
    { public: false },
    {
      identity: t.identity().index('btree'),
      achievementId: t.string(),
      unlockedAt: t.timestamp(),
    }
  ),
  
  levelData: table(
    { public: false },
    {
      level: t.u32().primaryKey(),
      minUnlockedLevel: t.u32(),
      dataJson: t.string(),
    }
  ),

  playerProfile: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      displayName: t.string(),
      nameKind: t.string(),
    }
  ),

  claimedName: table(
    { public: false },
    {
      nameKey: t.string().primaryKey(),
      identity: t.identity(),
    }
  ),

  playerLegacyImport: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      importedAt: t.timestamp(),
    }
  ),

  playerPrefs: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      difficulty: t.string().default('normal'),
      doNotTrack: t.bool().default(false),
    }
  ),

  weeklyScore: table(
    { public: true },
    {
      id: t.u64().autoInc().primaryKey(),
      weekKey: t.string().index('btree'),
      identity: t.identity(),
      displayName: t.string(),
      score: t.u64(),
      mode: t.string(),
    }
  ),

  analyticsCounter: table(
    { public: false },
    {
      key: t.string().primaryKey(),
      count: t.u64(),
    }
  ),

  analyticsUnique: table(
    { public: false },
    {
      stamp: t.string().primaryKey(),
    }
  ),

  playerAccount: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      email: t.string(),
      firebaseSub: t.string(),
    }
  ),

  /** Pilot name + onboard flag keyed by Firebase user, not device or guest identity. */
  accountName: table(
    { public: false },
    {
      firebaseSub: t.string().primaryKey(),
      displayName: t.string(),
      nameKind: t.string(),
      identity: t.identity(),
      onboardDone: t.bool().default(false),
    }
  ),

  adminUser: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      email: t.string(),
      grantedAt: t.timestamp(),
    }
  ),

  adminRole: table(
    { public: false },
    {
      email: t.string().primaryKey(),
      grantedBy: t.string(),
      grantedAt: t.timestamp(),
    }
  ),

  adminAudit: table(
    { public: false },
    {
      id: t.u64().autoInc().primaryKey(),
      at: t.timestamp(),
      adminIdentity: t.identity(),
      action: t.string(),
      targetKey: t.string(),
      detail: t.string(),
    }
  ),

  playerBan: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      bannedAt: t.timestamp(),
      reason: t.string(),
    }
  ),

  playerLink: table(
    { public: false },
    {
      id: t.u64().autoInc().primaryKey(),
      primaryIdentity: t.identity().index('btree'),
      linkedHex: t.string(),
      kind: t.string(),
    }
  ),

  coinEvent: table(
    { public: false },
    {
      id: t.u64().autoInc().primaryKey(),
      identity: t.identity().index('btree'),
      at: t.timestamp(),
      amount: t.i64(),
      reason: t.string(),
      level: t.u32(),
    }
  ),

  playerPresence: table(
    { public: false },
    {
      id: t.u64().autoInc().primaryKey(),
      identity: t.identity().index('btree'),
      at: t.timestamp(),
      country: t.string(),
      region: t.string(),
      city: t.string(),
      ipTrunc: t.string(),
      ipFull: t.string(),
      userAgent: t.string(),
    }
  ),

  playerFlag: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      testBot: t.bool(),
    }
  ),

  playerSession: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      count: t.u32(),
      roomsJoined: t.u32(),
    }
  ),

  onlineSession: table(
    { public: false },
    {
      connectionId: t.connectionId().primaryKey(),
      identity: t.identity().index('btree'),
      displayName: t.string(),
      activity: t.string(),
      connectedAt: t.timestamp(),
      lastBeat: t.timestamp(),
    }
  ),

  publicRoom: table(
    { public: true },
    {
      code: t.string().primaryKey(),
      hostIdentity: t.identity().index('btree'),
      hostName: t.string(),
      level: t.u32(),
      players: t.u32(),
      inGame: t.bool(),
      heartbeat: t.timestamp(),
      versus: t.bool().default(false),
    }
  ),

  versusQueue: table(
    { public: true },
    {
      code: t.string().primaryKey(),
      hostIdentity: t.identity().index('btree'),
      guestIdentity: t.identity(),
      hostHex: t.string(),
      guestHex: t.string(),
      hostName: t.string(),
      guestName: t.string(),
      hostShip: t.string(),
      guestShip: t.string(),
      kind: t.string(),
      inMatch: t.bool(),
      heartbeat: t.timestamp(),
    }
  ),

  versusSettled: table(
    { public: false },
    {
      matchId: t.string().primaryKey(),
      winnerHex: t.string(),
      prize: t.u32(),
      at: t.timestamp(),
    }
  ),

  versusPrizeDay: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      dayKey: t.u32(),
      awarded: t.u32(),
    }
  ),

  levelAward: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      level: t.u32(),
      at: t.timestamp(),
    }
  ),
  
  errorReport: table(
    { public: false },
    {
      id: t.u64().autoInc().primaryKey(),
      identity: t.identity(),
      reportedAt: t.timestamp(),
      errorType: t.string(),
      message: t.string(),
      stack: t.option(t.string()),
      context: t.option(t.string()),
    }
  ),
  
  serverConfig: table(
    { public: true },
    {
      key: t.string().primaryKey(),
      value: t.string(),
    }
  ),
});

export default spacetimedb;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function validateLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL;
}

function validateShip(shipId: string): boolean {
  return VALID_SHIPS.has(shipId);
}

function validateAchievement(achId: string): boolean {
  return VALID_ACHIEVEMENTS.has(achId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any;

function readJwtEmail(ctx: AnyCtx): { email: string; sub: string; issuer: string; hasJwt: boolean; emailVerified: boolean; rawEmail: string } {
  try {
    const probe = inspectSenderAuth(ctx.senderAuth);
    const trusted = !probe.issuer || isFirebaseIssuer(probe.issuer);
    return {
      email: trusted ? probe.email : '',
      rawEmail: probe.rawEmail,
      sub: probe.sub,
      issuer: probe.issuer,
      hasJwt: probe.hasJwt,
      emailVerified: probe.emailVerified,
    };
  } catch {
    return { email: '', rawEmail: '', sub: '', issuer: '', hasJwt: false, emailVerified: false };
  }
}

function roleEmails(ctx: AnyCtx): string[] {
  const emails: string[] = [];
  for (const row of ctx.db.adminRole.iter()) emails.push(row.email);
  return emails;
}

function ensureAdminRoles(ctx: AnyCtx): void {
  const flag = ctx.db.serverConfig.key.find(ADMIN_ROLES_SEEDED_KEY);
  const existing: Array<{ email: string; grantedBy: string; grantedAt: number }> = [];
  for (const row of ctx.db.adminRole.iter()) {
    existing.push({ email: row.email, grantedBy: row.grantedBy, grantedAt: 0 });
  }
  const plan = applySeedAdminRoles(existing, !!flag, 0);
  for (const email of plan.added) {
    ctx.db.adminRole.insert({
      email,
      grantedBy: email === OWNER_EMAIL ? 'system' : OWNER_EMAIL,
      grantedAt: ctx.timestamp,
    });
  }
  if (!flag) {
    ctx.db.serverConfig.insert({ key: ADMIN_ROLES_SEEDED_KEY, value: '1' });
  }
}

function senderIsAdmin(ctx: AnyCtx): boolean {
  ensureAdminRoles(ctx);
  const { email, sub } = readJwtEmail(ctx);
  return isOwnerEmail(email) || isAdminUid(sub) || isGrantedAdmin(email, roleEmails(ctx));
}

function mintAdminUser(ctx: AnyCtx, email: string): void {
  const existing = ctx.db.adminUser.identity.find(ctx.sender);
  if (!existing) {
    ctx.db.adminUser.insert({ identity: ctx.sender, email: email || 'admin', grantedAt: ctx.timestamp });
    return;
  }
  if (email && existing.email !== email) {
    ctx.db.adminUser.identity.update({ ...existing, email });
  }
}

function assertAdmin(ctx: AnyCtx): void {
  const { email } = readJwtEmail(ctx);
  if (senderIsAdmin(ctx)) {
    mintAdminUser(ctx, email);
    return;
  }
  throw new Error('Admin only');
}

function sweepStaleOnlineSessions(ctx: AnyCtx): void {
  const now = timestampMicros(ctx.timestamp as { microsSinceUnixEpoch?: bigint });
  if (!now) return;
  for (const row of [...ctx.db.onlineSession.iter()]) {
    const beat = timestampMicros(row.lastBeat as { microsSinceUnixEpoch?: bigint; __timestamp_micros_since_unix_epoch__?: bigint });
    if (!beat || now - beat > ONLINE_TTL_US) ctx.db.onlineSession.delete(row);
  }
}

function upsertOnlineSession(ctx: AnyCtx, activity: string, displayName: string): void {
  const cid = ctx.connectionId;
  if (!cid) return;
  sweepStaleOnlineSessions(ctx);
  const name = String(displayName || '').trim().slice(0, 16) || displayNameFor(ctx.db, ctx.sender) || 'Pilot';
  const act = normalizeActivity(activity);
  const existing = ctx.db.onlineSession.connectionId.find(cid);
  if (existing) {
    ctx.db.onlineSession.connectionId.update({
      ...existing,
      displayName: name,
      activity: act,
      lastBeat: ctx.timestamp,
    });
    return;
  }
  ctx.db.onlineSession.insert({
    connectionId: cid,
    identity: ctx.sender,
    displayName: name,
    activity: act,
    connectedAt: ctx.timestamp,
    lastBeat: ctx.timestamp,
  });
}

function collectOnlineRows(ctx: AnyCtx): OnlineRow[] {
  const rows: OnlineRow[] = [];
  for (const row of ctx.db.onlineSession.iter()) {
    rows.push({
      identity: identityKey(row.identity),
      displayName: row.displayName,
      activity: normalizeActivity(row.activity),
      connectedAtUs: timestampMicros(row.connectedAt as { microsSinceUnixEpoch?: bigint; __timestamp_micros_since_unix_epoch__?: bigint }),
      lastBeatUs: timestampMicros(row.lastBeat as { microsSinceUnixEpoch?: bigint; __timestamp_micros_since_unix_epoch__?: bigint }),
    });
  }
  return rows;
}

function assertNotBanned(ctx: AnyCtx): void {
  if (ctx.db.playerBan.identity.find(ctx.sender)) {
    throw new Error('Banned');
  }
}

function identityKey(id: { toHexString?: () => string } | string): string {
  if (typeof id === 'string') return id;
  try { return id.toHexString?.() || String(id); } catch { return String(id); }
}

function writeCoinEvent(ctx: AnyCtx, identity: AnyCtx, amount: bigint, reason: string, level = 0): void {
  ctx.db.coinEvent.insert({
    id: BigInt(0),
    identity,
    at: ctx.timestamp,
    amount,
    reason: reason.slice(0, 40),
    level,
  });
}

function ensurePlayer(ctx: AnyCtx): void {
  const identity = ctx.sender;
  const now = ctx.timestamp;
  const existingPlayer = ctx.db.player.identity.find(identity);
  if (existingPlayer) {
    ctx.db.player.identity.update({ ...existingPlayer, lastSeenAt: now });
    return;
  }
  ctx.db.player.insert({
    identity,
    createdAt: now,
    lastSeenAt: now,
    language: 'en',
  });
  ctx.db.playerProgress.insert({
    identity,
    unlockedLevel: 1,
    totalScore: BigInt(0),
  });
  ctx.db.playerShop.insert({
    identity,
    coins: BigInt(0),
    equippedShip: 'starter',
  });
  ctx.db.ownedShip.insert({ identity, shipId: 'starter' });
  ctx.db.playerSettings.insert({
    identity,
    muted: false,
    twoPlayerMode: false,
    ghostMode: true,
  });
  const defaultUpgrades = ['heart', 'rate', 'dmg', 'dur', 'mag'];
  for (const upgradeId of defaultUpgrades) {
    ctx.db.playerUpgrades.insert({ identity, upgradeId, level: 0 });
  }
}

function writeAudit(ctx: AnyCtx, action: string, targetKey: string, detail: unknown): void {
  ctx.db.adminAudit.insert({
    id: BigInt(0),
    at: ctx.timestamp,
    adminIdentity: ctx.sender,
    action,
    targetKey,
    detail: typeof detail === 'string' ? detail : JSON.stringify(detail ?? {}),
  });
}

function isStubLevelJson(dataJson: string): boolean {
  return !dataJson || dataJson.length < 80 || dataJson.indexOf('"feats"') < 0;
}

type MaybeRow<T> = T | null | undefined;

function seedLevelCatalog(ctx: {
  db: {
    levelData: {
      level: {
        find: (n: number) => MaybeRow<{ level: number; minUnlockedLevel: number; dataJson: string }>;
        update: (row: { level: number; minUnlockedLevel: number; dataJson: string }) => void;
      };
      insert: (row: { level: number; minUnlockedLevel: number; dataJson: string }) => void;
    };
  };
}): void {
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const dataJson = JSON.stringify(buildLevelPayload(i));
    const existing = ctx.db.levelData.level.find(i);
    if (!existing) {
      ctx.db.levelData.insert({
        level: i,
        minUnlockedLevel: i,
        dataJson,
      });
    } else if (isStubLevelJson(existing.dataJson)) {
      ctx.db.levelData.level.update({ ...existing, dataJson });
    }
  }
}

export const init = spacetimedb.init(ctx => {
  ctx.db.serverConfig.insert({ key: 'version', value: '1.0.0' });
  ctx.db.serverConfig.insert({ key: 'maxLevel', value: String(MAX_LEVEL) });
  seedLevelCatalog(ctx);
  console.info('Weltraum-Mission module initialized');
});

export const onConnect = spacetimedb.clientConnected(ctx => {
  seedLevelCatalog(ctx);
  ensureAdminRoles(ctx);
  const identity = ctx.sender;
  const now = ctx.timestamp;
  const existingPlayer = ctx.db.player.identity.find(identity);
  if (existingPlayer) {
    ctx.db.player.identity.update({ ...existingPlayer, lastSeenAt: now });
  }

  const { email, sub } = readJwtEmail(ctx);
  if (email) {
    // Signed-in Google users are real people — mint the row. Guests wait for
    // ensurePlayerRow / a meaningful action so crawlers and empty tabs stay out.
    if (!existingPlayer) ensurePlayer(ctx);
    const acc = ctx.db.playerAccount.identity.find(identity);
    if (acc) ctx.db.playerAccount.identity.update({ ...acc, email, firebaseSub: sub });
    else ctx.db.playerAccount.insert({ identity, email, firebaseSub: sub });
    if (isOwnerEmail(email) || isGrantedAdmin(email, roleEmails(ctx))) {
      mintAdminUser(ctx, email);
    }
    bindAccountName(ctx, sub);
  }
  upsertOnlineSession(ctx, 'menu', displayNameFor(ctx.db, identity) || 'Pilot');
});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  const cid = ctx.connectionId;
  if (cid) {
    const row = ctx.db.onlineSession.connectionId.find(cid);
    if (row) ctx.db.onlineSession.delete(row);
  }
  console.info(`Player disconnected: ${ctx.sender}`);
});

export const setLanguage = spacetimedb.reducer(
  { language: t.string() },
  (ctx, { language }) => {
    const validLangs = ['en', 'de'];
    if (!validLangs.includes(language)) {
      throw new Error(`Invalid language: ${language}`);
    }
    
    const player = ctx.db.player.identity.find(ctx.sender);
    if (!player) throw new Error('Player not found');
    
    ctx.db.player.identity.update({ ...player, language });
  }
);

export const syncProgress = spacetimedb.reducer(
  {
    unlockedLevel: t.u32(),
    coins: t.u64(),
    equippedShip: t.string(),
  },
  (ctx, data) => {
    assertNotBanned(ctx);
    const identity = ctx.sender;
    if (!ctx.db.player.identity.find(identity)) return;
    const progress = ctx.db.playerProgress.identity.find(identity);
    if (!progress) return;
    
    const newUnlocked = clamp(data.unlockedLevel, 1, MAX_LEVEL);
    const serverUnlocked = progress.unlockedLevel;
    
    if (newUnlocked < serverUnlocked) {
      // Keep the higher server unlock; do not reject a stale client.
    } else if (newUnlocked > serverUnlocked + 1) {
      throw new Error('Cannot skip levels');
    } else if (newUnlocked === serverUnlocked + 1) {
      ctx.db.playerProgress.identity.update({
        ...progress,
        unlockedLevel: newUnlocked,
      });
    }
    
    const shop = ctx.db.playerShop.identity.find(identity);
    if (shop) {
      // Coins are not set here. Rewards use completeLevelResult / addCoins;
      // spending uses purchaseShip / purchaseUpgrade. A stale SET would
      // overwrite a just-earned level bonus or a just-spent purchase.
      const equip = validateShip(data.equippedShip) ? data.equippedShip : shop.equippedShip;
      ctx.db.playerShop.identity.update({
        ...shop,
        equippedShip: equip,
      });
    }
  }
);

export const syncLevelStars = spacetimedb.reducer(
  {
    level: t.u32(),
    stars: t.u32(),
    bestScore: t.u64(),
  },
  (ctx, data) => {
    const identity = ctx.sender;
    
    if (!validateLevel(data.level)) {
      throw new Error(`Invalid level: ${data.level}`);
    }
    
    const progress = ctx.db.playerProgress.identity.find(identity);
    if (!progress) throw new Error('Progress not found');
    
    if (data.level > progress.unlockedLevel) {
      throw new Error(`Level ${data.level} is locked`);
    }
    
    if (data.stars > 3) {
      throw new Error('Invalid stars count');
    }
    
    const clampedScore = data.bestScore > BigInt(MAX_SCORE) ? BigInt(MAX_SCORE) : data.bestScore;
    
    let existing: typeof data & { identity: typeof identity } | null = null;
    for (const s of ctx.db.levelStars.identity.filter(identity)) {
      if (s.level === data.level) {
        existing = s;
        break;
      }
    }
    
    if (existing) {
      const newStars = Math.max(existing.stars, data.stars);
      const newBest = existing.bestScore > clampedScore ? existing.bestScore : clampedScore;
      ctx.db.levelStars.delete(existing);
      ctx.db.levelStars.insert({
        identity,
        level: data.level,
        stars: newStars,
        bestScore: newBest,
      });
    } else {
      ctx.db.levelStars.insert({
        identity,
        level: data.level,
        stars: data.stars,
        bestScore: clampedScore,
      });
    }
  }
);

export const completeLevelResult = spacetimedb.reducer(
  {
    level: t.u32(),
    stars: t.u32(),
    score: t.u64(),
    coinsEarned: t.u64(),
    timeMs: t.u64(),
    heartsLeft: t.u32(),
    mode: t.string(),
  },
  (ctx, result) => {
    assertNotBanned(ctx);
    ensurePlayer(ctx);
    const identity = ctx.sender;
    
    if (!validateLevel(result.level)) {
      throw new Error(`Invalid level: ${result.level}`);
    }
    
    const progress = ctx.db.playerProgress.identity.find(identity);
    if (!progress) throw new Error('Progress not found');
    
    if (result.level > progress.unlockedLevel) {
      throw new Error(`Level ${result.level} is locked`);
    }
    
    if (result.stars > 3) {
      throw new Error('Invalid stars count');
    }
    
    const maxScore = BigInt(result.level * 100000);
    if (result.score > maxScore) {
      throw new Error('Score exceeds maximum for this level');
    }
    
    const mode = result.mode === 'easy' || result.mode === 'veteran' ? result.mode : 'normal';
    const maxCoins = BigInt(maxCoinsForLevel(result.level, mode));
    ensurePlayer(ctx);
    let earned = result.coinsEarned;
    if (isMillionScaleGrant(earned) || earned > maxCoins) {
      earned = maxCoins;
    }
    
    const minTime = BigInt(3000);
    const maxTime = BigInt(600000);
    if (result.timeMs < minTime || result.timeMs > maxTime) {
      throw new Error('Invalid completion time');
    }
    
    if (result.stars > 0 && result.level === progress.unlockedLevel && result.level < MAX_LEVEL) {
      ctx.db.playerProgress.identity.update({
        ...progress,
        unlockedLevel: result.level + 1,
      });
    }
    
    let existing: { identity: typeof identity; level: number; stars: number; bestScore: bigint } | null = null;
    for (const s of ctx.db.levelStars.identity.filter(identity)) {
      if (s.level === result.level) {
        existing = s;
        break;
      }
    }
    
    if (existing) {
      const newStars = Math.max(existing.stars, result.stars);
      const newBest = existing.bestScore > result.score ? existing.bestScore : result.score;
      ctx.db.levelStars.delete(existing);
      ctx.db.levelStars.insert({
        identity,
        level: result.level,
        stars: newStars,
        bestScore: newBest,
      });
    } else {
      ctx.db.levelStars.insert({
        identity,
        level: result.level,
        stars: result.stars,
        bestScore: result.score,
      });
    }
    
    const shop = ctx.db.playerShop.identity.find(identity);
    if (shop) {
      const nowUs = Number(ctx.timestamp.microsSinceUnixEpoch || 0n);
      const lastAward = ctx.db.levelAward.identity.find(identity);
      const lastUs = lastAward
        ? Number((lastAward.at as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || 0n)
        : 0;
      const duplicate = !!(lastAward && lastAward.level === result.level && nowUs && lastUs && nowUs - lastUs < 8_000_000);
      if (duplicate) earned = 0n;
      else if (lastAward) ctx.db.levelAward.identity.update({ identity, level: result.level, at: ctx.timestamp });
      else ctx.db.levelAward.insert({ identity, level: result.level, at: ctx.timestamp });
      const newCoins = shop.coins + earned;
      const clampedCoins = newCoins > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : newCoins;
      ctx.db.playerShop.identity.update({ ...shop, coins: clampedCoins });
      if (earned > 0n) writeCoinEvent(ctx, identity, earned, result.coinsEarned > maxCoins ? 'level_clamped' : 'level', result.level);
    }
    
    let totalScore = BigInt(0);
    for (const s of ctx.db.levelStars.identity.filter(identity)) {
      totalScore += s.bestScore;
    }
    
    const updatedProgress = ctx.db.playerProgress.identity.find(identity);
    if (updatedProgress) {
      ctx.db.playerProgress.identity.update({ ...updatedProgress, totalScore });
    }
  }
);

export const requestLevelData = spacetimedb.reducer(
  { level: t.u32() },
  (ctx, { level }) => {
    const identity = ctx.sender;
    
    if (!validateLevel(level)) {
      throw new Error(`Invalid level: ${level}`);
    }
    
    const progress = ctx.db.playerProgress.identity.find(identity);
    if (!progress) throw new Error('Progress not found');
    
    if (level > progress.unlockedLevel) {
      throw new Error(`Level ${level} is locked. Current unlock: ${progress.unlockedLevel}`);
    }
    
    console.info(`Level ${level} data requested by ${identity}`);
  }
);

export const getLevelData = spacetimedb.procedure(
  { level: t.u32() },
  t.option(t.object('LevelDataResult', {
    level: t.u32(),
    dataJson: t.string(),
  })),
  (ctx, { level }) => {
    return ctx.withTx(txCtx => {
      if (!validateLevel(level)) {
        return undefined;
      }

      const progress = txCtx.db.playerProgress.identity.find(ctx.sender);
      const serverUnlock = progress?.unlockedLevel ?? 1;
      if (level > serverUnlock + 1) {
        return undefined;
      }

      const levelData = txCtx.db.levelData.level.find(level);
      if (!levelData) {
        return undefined;
      }

      return {
        level: levelData.level,
        dataJson: levelData.dataJson,
      };
    });
  }
);

export const addOwnedShip = spacetimedb.reducer(
  { shipId: t.string() },
  (ctx, { shipId }) => {
    assertAdmin(ctx);
    const identity = ctx.sender;
    
    if (!validateShip(shipId)) {
      throw new Error(`Invalid ship: ${shipId}`);
    }
    
    for (const s of ctx.db.ownedShip.identity.filter(identity)) {
      if (s.shipId === shipId) {
        return;
      }
    }
    
    ctx.db.ownedShip.insert({ identity, shipId });
  }
);

export const claimUnlockShip = spacetimedb.reducer(
  { shipId: t.string() },
  (ctx, { shipId }) => {
    assertNotBanned(ctx);
    ensurePlayer(ctx);
    const identity = ctx.sender;
    if (!validateShip(shipId)) throw new Error(`Invalid ship: ${shipId}`);
    if (salePrice(shipId) !== null) throw new Error('Ship is for sale');
    const rule = UNLOCK_SHIPS[shipId];
    if (!rule) throw new Error('Ship is not an unlock reward');
    if (rule.level) {
      const progress = ctx.db.playerProgress.identity.find(identity);
      const unlocked = progress?.unlockedLevel ?? 1;
      let starred = false;
      for (const row of ctx.db.levelStars.identity.filter(identity)) {
        if (row.level === rule.level && row.stars > 0) { starred = true; break; }
      }
      if (!starred && unlocked < rule.level) throw new Error('Unlock not earned');
    }
    if (rule.ach) {
      let have = false;
      for (const a of ctx.db.playerAchievements.identity.filter(identity)) {
        if (a.achievementId === rule.ach) { have = true; break; }
      }
      if (!have) throw new Error('Achievement not earned');
    }
    for (const s of ctx.db.ownedShip.identity.filter(identity)) {
      if (s.shipId === shipId) return;
    }
    ctx.db.ownedShip.insert({ identity, shipId });
    const shop = ctx.db.playerShop.identity.find(identity);
    if (shop) ctx.db.playerShop.identity.update({ ...shop, equippedShip: shipId });
  }
);

export const purchaseShip = spacetimedb.reducer(
  { shipId: t.string(), price: t.u64() },
  (ctx, { shipId, price }) => {
    const identity = ctx.sender;
    // Client-sent `price` is ignored — catalog is the only charge (needs republish).
    void price;

    if (!validateShip(shipId)) {
      throw new Error(`Invalid ship: ${shipId}`);
    }

    const catalog = salePrice(shipId);
    if (catalog === null) {
      throw new Error('Ship not for sale');
    }
    const cost = BigInt(catalog);

    const shop = ctx.db.playerShop.identity.find(identity);
    if (!shop) throw new Error('Shop data not found');

    for (const s of ctx.db.ownedShip.identity.filter(identity)) {
      if (s.shipId === shipId) {
        throw new Error('Ship already owned');
      }
    }

    if (shop.coins < cost) {
      throw new Error('Insufficient coins');
    }

    ctx.db.playerShop.identity.update({
      ...shop,
      coins: shop.coins - cost,
      equippedShip: shipId,
    });

    ctx.db.ownedShip.insert({ identity, shipId });
  }
);

export const equipShip = spacetimedb.reducer(
  { shipId: t.string() },
  (ctx, { shipId }) => {
    const identity = ctx.sender;
    
    if (!validateShip(shipId)) {
      throw new Error(`Invalid ship: ${shipId}`);
    }
    
    const shop = ctx.db.playerShop.identity.find(identity);
    if (!shop) throw new Error('Shop data not found');
    
    let owned = false;
    for (const s of ctx.db.ownedShip.identity.filter(identity)) {
      if (s.shipId === shipId) {
        owned = true;
        break;
      }
    }
    
    if (!owned) {
      console.warn(`equip_ship skipped ${shipId}: not owned`);
      return;
    }
    
    ctx.db.playerShop.identity.update({ ...shop, equippedShip: shipId });
  }
);

export const setUpgradeLevel = spacetimedb.reducer(
  { upgradeId: t.string(), level: t.u32() },
  (ctx, { upgradeId, level }) => {
    const identity = ctx.sender;
    
    if (!VALID_UPGRADE_IDS.has(upgradeId)) {
      throw new Error(`Invalid upgrade: ${upgradeId}`);
    }
    
    const maxLevel = upgradeId === 'heart' ? 1 : MAX_UPGRADE_LEVEL;
    const clampedLevel = clamp(level, 0, maxLevel);
    
    let existing: { identity: typeof identity; upgradeId: string; level: number } | null = null;
    for (const u of ctx.db.playerUpgrades.identity.filter(identity)) {
      if (u.upgradeId === upgradeId) {
        existing = u;
        break;
      }
    }
    
    if (existing) {
      if (clampedLevel > existing.level) {
        ctx.db.playerUpgrades.delete(existing);
        ctx.db.playerUpgrades.insert({ identity, upgradeId, level: clampedLevel });
      }
    } else {
      ctx.db.playerUpgrades.insert({ identity, upgradeId, level: clampedLevel });
    }
  }
);

export const purchaseUpgrade = spacetimedb.reducer(
  { upgradeId: t.string(), price: t.u64() },
  (ctx, { upgradeId, price }) => {
    const identity = ctx.sender;
    // Client-sent `price` is ignored — catalog is the only charge (needs republish).
    void price;
    
    if (!VALID_UPGRADE_IDS.has(upgradeId)) {
      throw new Error(`Invalid upgrade: ${upgradeId}`);
    }
    
    const shop = ctx.db.playerShop.identity.find(identity);
    if (!shop) throw new Error('Shop data not found');
    
    let currentLevel = 0;
    for (const u of ctx.db.playerUpgrades.identity.filter(identity)) {
      if (u.upgradeId === upgradeId) {
        currentLevel = u.level;
        ctx.db.playerUpgrades.delete(u);
        break;
      }
    }
    
    const maxLevel = upgradeId === 'heart' ? 1 : MAX_UPGRADE_LEVEL;
    
    if (currentLevel >= maxLevel) {
      throw new Error('Upgrade already at max level');
    }

    const catalog = upgradeSalePrice(upgradeId, currentLevel);
    if (catalog === null) {
      throw new Error('Upgrade not for sale');
    }
    const cost = BigInt(catalog);
    
    if (shop.coins < cost) {
      throw new Error('Insufficient coins');
    }
    
    ctx.db.playerShop.identity.update({
      ...shop,
      coins: shop.coins - cost,
    });
    
    ctx.db.playerUpgrades.insert({
      identity,
      upgradeId,
      level: currentLevel + 1,
    });
  }
);

export const applySecretCode = spacetimedb.reducer(
  { code: t.string() },
  (ctx, { code }) => {
    const identity = ctx.sender;
    const upperCode = code.toUpperCase().replace(/\s+/g, '');
    
    // Test unlock: ALLELEVEL raises this identity's unlockedLevel to 100.
    // getLevelData then allows every level for that identity only (same anti-cheat
    // gate as normal play — other players stay locked). Use only in tests / owner QA.
    if (upperCode === 'ALLELEVEL' || upperCode === 'ALLELEVELS') {
      const progress = ctx.db.playerProgress.identity.find(identity);
      if (progress) {
        ctx.db.playerProgress.identity.update({
          ...progress,
          unlockedLevel: MAX_LEVEL,
        });
      }
      return;
    }
    
    const secret = SECRET_CODES[upperCode];
    if (!secret) {
      throw new Error('Invalid secret code');
    }
    
    for (const u of ctx.db.usedSecretCode.identity.filter(identity)) {
      if (u.codeKey === secret.key) {
        throw new Error('Code already used');
      }
    }
    
    ctx.db.usedSecretCode.insert({ identity, codeKey: secret.key });
    
    const shop = ctx.db.playerShop.identity.find(identity);
    if (shop) {
      const grant = BigInt(secret.coins);
      const newCoins = shop.coins + grant;
      const clampedCoins = newCoins > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : newCoins;
      ctx.db.playerShop.identity.update({ ...shop, coins: clampedCoins });
      writeCoinEvent(ctx, identity, grant, 'secret', 0);
    }
  }
);

export const unlockAchievement = spacetimedb.reducer(
  { achievementId: t.string() },
  (ctx, { achievementId }) => {
    const identity = ctx.sender;
    
    if (!validateAchievement(achievementId)) {
      throw new Error(`Invalid achievement: ${achievementId}`);
    }
    
    for (const a of ctx.db.playerAchievements.identity.filter(identity)) {
      if (a.achievementId === achievementId) {
        return;
      }
    }
    
    ctx.db.playerAchievements.insert({
      identity,
      achievementId,
      unlockedAt: ctx.timestamp,
    });
  }
);

export const updateSettings = spacetimedb.reducer(
  {
    muted: t.option(t.bool()),
    twoPlayerMode: t.option(t.bool()),
    ghostMode: t.option(t.bool()),
  },
  (ctx, settings) => {
    const identity = ctx.sender;
    
    const existing = ctx.db.playerSettings.identity.find(identity);
    if (!existing) {
      ctx.db.playerSettings.insert({
        identity,
        muted: settings.muted ?? false,
        twoPlayerMode: settings.twoPlayerMode ?? false,
        ghostMode: settings.ghostMode ?? true,
      });
      return;
    }
    
    ctx.db.playerSettings.identity.update({
      ...existing,
      muted: settings.muted ?? existing.muted,
      twoPlayerMode: settings.twoPlayerMode ?? existing.twoPlayerMode,
      ghostMode: settings.ghostMode ?? existing.ghostMode,
    });
  }
);

export const reportError = spacetimedb.reducer(
  {
    errorType: t.string(),
    message: t.string(),
    stack: t.option(t.string()),
    context: t.option(t.string()),
  },
  (ctx, error) => {
    const identity = ctx.sender;
    
    const maxMessageLen = 500;
    const maxStackLen = 2000;
    const maxContextLen = 500;
    
    ctx.db.errorReport.insert({
      id: BigInt(0),
      identity,
      reportedAt: ctx.timestamp,
      errorType: error.errorType.slice(0, 100),
      message: error.message.slice(0, maxMessageLen),
      stack: error.stack?.slice(0, maxStackLen),
      context: error.context?.slice(0, maxContextLen),
    });
    
    console.error(`Client error from ${identity}: ${error.errorType} - ${error.message}`);
  }
);

export const resetProgress = spacetimedb.reducer(
  {},
  ctx => {
    const identity = ctx.sender;
    
    for (const star of ctx.db.levelStars.identity.filter(identity)) {
      ctx.db.levelStars.delete(star);
    }
    
    for (const ship of ctx.db.ownedShip.identity.filter(identity)) {
      if (ship.shipId !== 'starter') {
        ctx.db.ownedShip.delete(ship);
      }
    }
    
    for (const upg of ctx.db.playerUpgrades.identity.filter(identity)) {
      ctx.db.playerUpgrades.delete(upg);
    }
    
    for (const ach of ctx.db.playerAchievements.identity.filter(identity)) {
      ctx.db.playerAchievements.delete(ach);
    }
    
    for (const code of ctx.db.usedSecretCode.identity.filter(identity)) {
      ctx.db.usedSecretCode.delete(code);
    }
    
    const progress = ctx.db.playerProgress.identity.find(identity);
    if (progress) {
      ctx.db.playerProgress.identity.update({
        ...progress,
        unlockedLevel: 1,
        totalScore: BigInt(0),
      });
    }
    
    const shop = ctx.db.playerShop.identity.find(identity);
    if (shop) {
      ctx.db.playerShop.identity.update({
        ...shop,
        coins: BigInt(0),
        equippedShip: 'starter',
      });
    }
    
    const defaultUpgrades = ['heart', 'rate', 'dmg', 'dur', 'mag'];
    for (const upgradeId of defaultUpgrades) {
      ctx.db.playerUpgrades.insert({ identity, upgradeId, level: 0 });
    }
    
    console.info(`Progress reset for player: ${identity}`);
  }
);

export const addCoins = spacetimedb.reducer(
  { amount: t.u64() },
  (ctx, { amount }) => {
    assertNotBanned(ctx);
    ensurePlayer(ctx);
    const identity = ctx.sender;
    if (amount <= BigInt(0)) return;
    const perCall = BigInt(maxCoinsForLevel(MAX_LEVEL, 'veteran'));
    if (isMillionScaleGrant(amount) || amount > perCall) throw new Error('Coin grant too large');
    const shop = ctx.db.playerShop.identity.find(identity);
    if (!shop) throw new Error('Shop data not found');
    const next = shop.coins + amount;
    const clamped = next > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : next;
    ctx.db.playerShop.identity.update({ ...shop, coins: clamped });
    writeCoinEvent(ctx, identity, amount, 'add', 0);
  }
);

export const importProgress = spacetimedb.reducer(
  {
    unlockedLevel: t.u32(),
    coins: t.u64(),
    equippedShip: t.string(),
    ownedShipsCsv: t.string(),
    upgradesJson: t.string(),
    starsJson: t.string(),
    language: t.string(),
  },
  (ctx, data) => {
    assertTrusted(ctx);
    ensurePlayer(ctx);
    const identity = ctx.sender;
    const progress = ctx.db.playerProgress.identity.find(identity);
    if (!progress) throw new Error('Progress not found');

    const incomingUnlock = clamp(data.unlockedLevel, 1, MAX_LEVEL);
    if (incomingUnlock > progress.unlockedLevel) {
      ctx.db.playerProgress.identity.update({
        ...progress,
        unlockedLevel: incomingUnlock,
      });
    }

    const shop = ctx.db.playerShop.identity.find(identity);
    if (shop) {
      const incoming = data.coins > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : data.coins;
      const coins = incoming > shop.coins ? incoming : shop.coins;
      const equip = validateShip(data.equippedShip) ? data.equippedShip : shop.equippedShip;
      ctx.db.playerShop.identity.update({ ...shop, coins, equippedShip: equip });
    }

    const ships = data.ownedShipsCsv.split(',').map(s => s.trim()).filter(Boolean);
    for (const shipId of ships) {
      if (!validateShip(shipId)) continue;
      let owned = false;
      for (const s of ctx.db.ownedShip.identity.filter(identity)) {
        if (s.shipId === shipId) { owned = true; break; }
      }
      if (!owned) ctx.db.ownedShip.insert({ identity, shipId });
    }

    try {
      const ups = JSON.parse(data.upgradesJson) as Record<string, number>;
      for (const [upgradeId, level] of Object.entries(ups || {})) {
        if (!VALID_UPGRADE_IDS.has(upgradeId)) continue;
        const maxLevel = upgradeId === 'heart' ? 1 : MAX_UPGRADE_LEVEL;
        const clampedLevel = clamp(Number(level) || 0, 0, maxLevel);
        let existing: { identity: typeof identity; upgradeId: string; level: number } | null = null;
        for (const u of ctx.db.playerUpgrades.identity.filter(identity)) {
          if (u.upgradeId === upgradeId) { existing = u; break; }
        }
        if (existing) {
          if (clampedLevel > existing.level) {
            ctx.db.playerUpgrades.delete(existing);
            ctx.db.playerUpgrades.insert({ identity, upgradeId, level: clampedLevel });
          }
        } else {
          ctx.db.playerUpgrades.insert({ identity, upgradeId, level: clampedLevel });
        }
      }
    } catch {
      // ignore malformed upgrades
    }

    try {
      const stars = JSON.parse(data.starsJson) as Record<string, number>;
      for (const [levelStr, starVal] of Object.entries(stars || {})) {
        const level = parseInt(levelStr, 10);
        const starN = Math.max(0, Math.min(3, Number(starVal) || 0));
        if (!validateLevel(level) || starN <= 0) continue;
        let existing: { identity: typeof identity; level: number; stars: number; bestScore: bigint } | null = null;
        for (const s of ctx.db.levelStars.identity.filter(identity)) {
          if (s.level === level) { existing = s; break; }
        }
        if (existing) {
          if (starN > existing.stars) {
            ctx.db.levelStars.delete(existing);
            ctx.db.levelStars.insert({ identity, level, stars: starN, bestScore: existing.bestScore });
          }
        } else {
          ctx.db.levelStars.insert({ identity, level, stars: starN, bestScore: BigInt(0) });
        }
      }
    } catch {
      // ignore malformed stars
    }

    if (data.language === 'en' || data.language === 'de') {
      const player = ctx.db.player.identity.find(identity);
      if (player) ctx.db.player.identity.update({ ...player, language: data.language });
    }
  }
);

export const legacyImport = spacetimedb.reducer(
  {
    unlockedLevel: t.u32(),
    coins: t.u64(),
    equippedShip: t.string(),
    ownedShipsCsv: t.string(),
    upgradesJson: t.string(),
    starsJson: t.string(),
    language: t.string(),
  },
  (ctx, data) => {
    ensurePlayer(ctx);
    const identity = ctx.sender;
    if (ctx.db.playerLegacyImport.identity.find(identity)) {
      throw new Error('Legacy import already used');
    }
    const progress = ctx.db.playerProgress.identity.find(identity);
    if (!progress) throw new Error('Progress not found');

    ctx.db.playerLegacyImport.insert({ identity, importedAt: ctx.timestamp });

    const granted = plausibleLegacyUnlock(data.unlockedLevel, progress.unlockedLevel, data.starsJson, MAX_LEVEL);
    if (granted > progress.unlockedLevel) {
      ctx.db.playerProgress.identity.update({
        ...progress,
        unlockedLevel: granted,
      });
    }

    const shop = ctx.db.playerShop.identity.find(identity);
    if (shop) {
      const incoming = data.coins > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : data.coins;
      const coins = incoming > shop.coins ? incoming : shop.coins;
      const equip = validateShip(data.equippedShip) ? data.equippedShip : shop.equippedShip;
      ctx.db.playerShop.identity.update({ ...shop, coins, equippedShip: equip });
    }

    const ships = data.ownedShipsCsv.split(',').map(s => s.trim()).filter(Boolean);
    for (const shipId of ships) {
      if (!validateShip(shipId)) continue;
      let owned = false;
      for (const s of ctx.db.ownedShip.identity.filter(identity)) {
        if (s.shipId === shipId) { owned = true; break; }
      }
      if (!owned) ctx.db.ownedShip.insert({ identity, shipId });
    }

    try {
      const ups = JSON.parse(data.upgradesJson) as Record<string, number>;
      for (const [upgradeId, level] of Object.entries(ups || {})) {
        if (!VALID_UPGRADE_IDS.has(upgradeId)) continue;
        const maxLevel = upgradeId === 'heart' ? 1 : MAX_UPGRADE_LEVEL;
        const clampedLevel = clamp(Number(level) || 0, 0, maxLevel);
        let existing: { identity: typeof identity; upgradeId: string; level: number } | null = null;
        for (const u of ctx.db.playerUpgrades.identity.filter(identity)) {
          if (u.upgradeId === upgradeId) { existing = u; break; }
        }
        if (existing) {
          if (clampedLevel > existing.level) {
            ctx.db.playerUpgrades.delete(existing);
            ctx.db.playerUpgrades.insert({ identity, upgradeId, level: clampedLevel });
          }
        } else {
          ctx.db.playerUpgrades.insert({ identity, upgradeId, level: clampedLevel });
        }
      }
    } catch {
      // ignore malformed upgrades
    }

    try {
      const stars = JSON.parse(data.starsJson) as Record<string, number>;
      for (const [levelStr, starVal] of Object.entries(stars || {})) {
        const level = parseInt(levelStr, 10);
        const starN = Math.max(0, Math.min(3, Number(starVal) || 0));
        if (!validateLevel(level) || starN <= 0) continue;
        let existing: { identity: typeof identity; level: number; stars: number; bestScore: bigint } | null = null;
        for (const s of ctx.db.levelStars.identity.filter(identity)) {
          if (s.level === level) { existing = s; break; }
        }
        if (existing) {
          if (starN > existing.stars) {
            ctx.db.levelStars.delete(existing);
            ctx.db.levelStars.insert({ identity, level, stars: starN, bestScore: existing.bestScore });
          }
        } else {
          ctx.db.levelStars.insert({ identity, level, stars: starN, bestScore: BigInt(0) });
        }
      }
    } catch {
      // ignore malformed stars
    }

    if (data.language === 'en' || data.language === 'de') {
      const player = ctx.db.player.identity.find(identity);
      if (player) ctx.db.player.identity.update({ ...player, language: data.language });
    }
  }
);

function bumpAnalytics(
  ctx: {
    db: {
      analyticsCounter: {
        key: { find: (k: string) => MaybeRow<{ key: string; count: bigint }>; update: (row: { key: string; count: bigint }) => void };
        insert: (row: { key: string; count: bigint }) => void;
      };
      analyticsUnique: {
        stamp: { find: (k: string) => MaybeRow<{ stamp: string }> };
        insert: (row: { stamp: string }) => void;
      };
    };
  },
  key: string,
  stamp: string | null,
): void {
  if (stamp) {
    if (ctx.db.analyticsUnique.stamp.find(stamp)) return;
    ctx.db.analyticsUnique.insert({ stamp });
  }
  const row = ctx.db.analyticsCounter.key.find(key);
  if (row) ctx.db.analyticsCounter.key.update({ ...row, count: row.count + BigInt(1) });
  else ctx.db.analyticsCounter.insert({ key, count: BigInt(1) });
}

export const setPlayerPrefs = spacetimedb.reducer(
  { difficulty: t.string(), doNotTrack: t.bool() },
  (ctx, { difficulty, doNotTrack }) => {
    const identity = ctx.sender;
    const mode = difficulty === 'easy' || difficulty === 'veteran' ? difficulty : 'normal';
    const existing = ctx.db.playerPrefs.identity.find(identity);
    if (existing) {
      ctx.db.playerPrefs.identity.update({ ...existing, difficulty: mode, doNotTrack });
    } else {
      ctx.db.playerPrefs.insert({ identity, difficulty: mode, doNotTrack });
    }
  }
);

export const trackAnalytics = spacetimedb.reducer(
  { kind: t.string(), level: t.u32(), mode: t.string() },
  (ctx, { kind, level, mode }) => {
    const identity = ctx.sender;
    const prefs = ctx.db.playerPrefs.identity.find(identity);
    if (prefs?.doNotTrack) return;
    const allowed = new Set([
      'session_start', 'level_start', 'level_win', 'level_loss', 'level_quit',
      'shop_open', 'shop_purchase', 'tip_shown', 'tip_clicked',
      'room_created', 'room_joined', 'sign_in',
    ]);
    if (!allowed.has(kind)) return;
    const safeMode = mode === 'easy' || mode === 'veteran' ? mode : 'normal';
    bumpAnalytics(ctx, `kind:${kind}`, null);
    bumpAnalytics(ctx, `kind:${kind}:${safeMode}`, null);
    if (kind === 'level_win' || kind === 'level_start' || kind === 'level_loss') {
      bumpAnalytics(ctx, `level:${kind}:${level}`, null);
    }
    let funnel: string | null = null;
    if (kind === 'session_start') funnel = 'session_start';
    if (kind === 'level_win' && level === 3) funnel = 'level3_win';
    if (kind === 'shop_open') funnel = 'shop_open';
    if (kind === 'shop_purchase') funnel = 'shop_purchase';
    if (kind === 'room_created' || kind === 'room_joined') funnel = 'multiplayer';
    if (funnel) bumpAnalytics(ctx, `funnel:${funnel}`, `funnel:${funnel}:${identity}`);
  }
);

export const submitWeeklyScore = spacetimedb.reducer(
  { weekKey: t.string(), score: t.u64(), mode: t.string(), displayName: t.string() },
  (ctx, { weekKey, score, mode, displayName }) => {
    const identity = ctx.sender;
    if (!/^\d{4}-W\d{2}$/.test(weekKey)) throw new Error('Invalid week');
    if (score > BigInt(10_000_000)) throw new Error('Score exceeds maximum');
    const safeMode = mode === 'easy' || mode === 'veteran' ? mode : 'normal';
    const checked = validateDisplayName(displayName, displayName.match(/ \\d{1,3}$/) ? 'generated' : 'custom');
    const name = checked.ok ? checked.name : 'Pilot';
    let existing: { id: bigint; weekKey: string; identity: typeof identity; displayName: string; score: bigint; mode: string } | null = null;
    for (const row of ctx.db.weeklyScore.weekKey.filter(weekKey)) {
      if (String(row.identity) === String(identity)) {
        existing = row;
        break;
      }
    }
    if (existing) {
      if (score > existing.score) {
        ctx.db.weeklyScore.delete(existing);
        ctx.db.weeklyScore.insert({ id: BigInt(0), weekKey, identity, displayName: name, score, mode: safeMode });
      }
    } else {
      ctx.db.weeklyScore.insert({ id: BigInt(0), weekKey, identity, displayName: name, score, mode: safeMode });
    }
  }
);

export const getWeeklyBoard = spacetimedb.procedure(
  { weekKey: t.string() },
  t.option(t.object('WeeklyBoardResult', {
    weekKey: t.string(),
    rowsJson: t.string(),
  })),
  (ctx, { weekKey }) => {
    return ctx.withTx(txCtx => {
      const rows: Array<{ name: string; score: string; mode: string; me: boolean }> = [];
      const identity = ctx.sender;
      for (const row of txCtx.db.weeklyScore.weekKey.filter(weekKey)) {
        rows.push({
          name: row.displayName,
          score: String(row.score),
          mode: row.mode,
          me: String(row.identity) === String(identity),
        });
      }
      rows.sort((a, b) => Number(b.score) - Number(a.score));
      return { weekKey, rowsJson: JSON.stringify(rows.slice(0, 20)) };
    });
  }
);

export const getAnalyticsFunnel = spacetimedb.procedure(
  {},
  t.option(t.object('AnalyticsFunnelResult', {
    dataJson: t.string(),
  })),
  (ctx) => {
    return ctx.withTx(txCtx => {
      const out: Record<string, string> = {};
      for (const row of txCtx.db.analyticsCounter.iter()) {
        out[row.key] = String(row.count);
      }
      return { dataJson: JSON.stringify(out) };
    });
  }
);

function createdAtMs(ctx: AnyCtx, ident: AnyCtx): number {
  const row = ctx.db.player.identity.find(ident);
  return timestampMicros(row?.createdAt as { microsSinceUnixEpoch?: bigint } | undefined);
}

function writePlayerProfile(ctx: AnyCtx, identity: AnyCtx, displayName: string, nameKind: string): void {
  const profile = ctx.db.playerProfile.identity.find(identity);
  if (profile) {
    ctx.db.playerProfile.identity.update({ ...profile, displayName, nameKind });
    return;
  }
  ctx.db.playerProfile.insert({ identity, displayName, nameKind });
}

function clearOtherNameHolders(ctx: AnyCtx, key: string, keepIdent: AnyCtx): void {
  for (const profile of ctx.db.playerProfile.iter()) {
    if (String(profile.identity) === String(keepIdent)) continue;
    if (!profile.displayName || nameKey(profile.displayName) !== key) continue;
    const acc = ctx.db.playerAccount.identity.find(profile.identity);
    if (!acc?.firebaseSub) continue;
    ctx.db.playerProfile.identity.update({ ...profile, displayName: '' });
    const account = ctx.db.accountName.firebaseSub.find(acc.firebaseSub);
    if (account && nameKey(account.displayName) === key) {
      ctx.db.accountName.firebaseSub.update({ ...account, displayName: '' });
    }
  }
}

function upsertAccountName(
  ctx: AnyCtx,
  sub: string,
  identity: AnyCtx,
  displayName: string,
  nameKind: string,
  onboardDone?: boolean,
): void {
  const existing = ctx.db.accountName.firebaseSub.find(sub);
  if (existing) {
    ctx.db.accountName.firebaseSub.update({
      ...existing,
      displayName,
      nameKind,
      identity,
      onboardDone: onboardDone == null ? existing.onboardDone : onboardDone,
    });
    return;
  }
  ctx.db.accountName.insert({
    firebaseSub: sub,
    displayName,
    nameKind,
    identity,
    onboardDone: !!onboardDone,
  });
}

function claimAccountName(ctx: AnyCtx, name: string, identity: AnyCtx, _sub: string): void {
  const key = nameKey(name);
  const existing = ctx.db.claimedName.nameKey.find(key);
  if (existing && String(existing.identity) !== String(identity)) {
    ctx.db.claimedName.delete(existing);
  }
  if (!ctx.db.claimedName.nameKey.find(key)) {
    ctx.db.claimedName.insert({ nameKey: key, identity });
  }
  clearOtherNameHolders(ctx, key, identity);
}

function releaseOwnClaim(ctx: AnyCtx, identity: AnyCtx, oldName: string, nextName: string): void {
  const oldKey = nameKey(oldName);
  if (!oldKey || oldKey === nameKey(nextName)) return;
  const oldClaim = ctx.db.claimedName.nameKey.find(oldKey);
  if (oldClaim && String(oldClaim.identity) === String(identity)) {
    ctx.db.claimedName.delete(oldClaim);
  }
}

function senderFirebaseSub(ctx: AnyCtx): string {
  const { sub } = readJwtEmail(ctx);
  if (sub) return sub;
  const acc = ctx.db.playerAccount.identity.find(ctx.sender);
  return acc?.firebaseSub || '';
}

function nameTakenByOtherAccount(ctx: AnyCtx, name: string, identity: AnyCtx, sub: string): boolean {
  const key = nameKey(name);
  const claim = ctx.db.claimedName.nameKey.find(key);
  if (!claim) return false;
  if (String(claim.identity) === String(identity)) return false;
  const otherAcc = ctx.db.playerAccount.identity.find(claim.identity);
  if (otherAcc?.firebaseSub && otherAcc.firebaseSub === sub) return false;
  return !!otherAcc?.firebaseSub;
}

function applyDisplayName(ctx: AnyCtx, rawName: string, kind: string): { ok: true; name: string } | { ok: false; reason: string } {
  ensurePlayer(ctx);
  const identity = ctx.sender;
  const nameKind = (kind === 'custom' ? 'custom' : 'generated') as NameKind;
  const checked = validateDisplayName(rawName, nameKind);
  if (!checked.ok) return { ok: false, reason: checked.reason };

  const sub = senderFirebaseSub(ctx);
  if (!sub) {
    writePlayerProfile(ctx, identity, checked.name, nameKind);
    return { ok: true, name: checked.name };
  }

  if (nameTakenByOtherAccount(ctx, checked.name, identity, sub)) {
    return { ok: false, reason: 'taken' };
  }

  const profile = ctx.db.playerProfile.identity.find(identity);
  releaseOwnClaim(ctx, identity, profile?.displayName || '', checked.name);
  writePlayerProfile(ctx, identity, checked.name, nameKind);
  claimAccountName(ctx, checked.name, identity, sub);
  const existing = ctx.db.accountName.firebaseSub.find(sub);
  upsertAccountName(ctx, sub, identity, checked.name, nameKind, existing?.onboardDone);
  return { ok: true, name: checked.name };
}

function bindAccountName(ctx: AnyCtx, sub: string): void {
  if (!sub) return;
  const identity = ctx.sender;
  const existing = ctx.db.accountName.firebaseSub.find(sub);
  const profile = ctx.db.playerProfile.identity.find(identity);

  if (existing?.displayName) {
    writePlayerProfile(ctx, identity, existing.displayName, existing.nameKind || 'generated');
    const key = nameKey(existing.displayName);
    const claim = ctx.db.claimedName.nameKey.find(key);
    if (claim && String(claim.identity) !== String(identity)) {
      const otherCreated = createdAtMs(ctx, claim.identity);
      const ours = createdAtMs(ctx, identity);
      if (ours <= otherCreated) {
        claimAccountName(ctx, existing.displayName, identity, sub);
      } else {
        ctx.db.accountName.firebaseSub.update({ ...existing, displayName: '', identity });
        writePlayerProfile(ctx, identity, '', existing.nameKind || 'generated');
      }
    } else {
      claimAccountName(ctx, existing.displayName, identity, sub);
    }
    const row = ctx.db.accountName.firebaseSub.find(sub);
    if (row && String(row.identity) !== String(identity)) {
      ctx.db.accountName.firebaseSub.update({ ...row, identity });
    }
    return;
  }

  const candidate = profile?.displayName || '';
  if (!candidate) {
    upsertAccountName(ctx, sub, identity, '', profile?.nameKind || 'generated', existing?.onboardDone);
    return;
  }

  const claim = ctx.db.claimedName.nameKey.find(nameKey(candidate));
  if (!claim || String(claim.identity) === String(identity)) {
    claimAccountName(ctx, candidate, identity, sub);
    upsertAccountName(ctx, sub, identity, candidate, profile?.nameKind || 'generated', existing?.onboardDone);
    return;
  }

  const otherAcc = ctx.db.playerAccount.identity.find(claim.identity);
  const otherIsAccount = !!(otherAcc?.firebaseSub);
  const ours = createdAtMs(ctx, identity);
  const otherCreated = createdAtMs(ctx, claim.identity);
  if (!otherIsAccount || ours < otherCreated) {
    claimAccountName(ctx, candidate, identity, sub);
    upsertAccountName(ctx, sub, identity, candidate, profile?.nameKind || 'generated', existing?.onboardDone);
    return;
  }

  writePlayerProfile(ctx, identity, '', profile?.nameKind || 'generated');
  upsertAccountName(ctx, sub, identity, '', profile?.nameKind || 'generated', existing?.onboardDone);
}

export const setDisplayName = spacetimedb.reducer(
  { name: t.string(), kind: t.string() },
  (ctx, { name, kind }) => {
    // Custom names are allowed for every identity (guest and signed-in).
    const result = applyDisplayName(ctx, name, kind);
    if (!result.ok) throw new Error(`Invalid display name: ${result.reason}`);
  }
);

export const claimDisplayName = spacetimedb.procedure(
  { name: t.string(), kind: t.string() },
  t.object('ClaimNameResult', {
    ok: t.bool(),
    reason: t.string(),
    name: t.string(),
  }),
  (ctx, { name, kind }) => {
    return ctx.withTx(txCtx => {
      const bound = bindAdminCtx(ctx, txCtx);
      const result = applyDisplayName(bound, name, kind);
      if (result.ok) return { ok: true, reason: '', name: result.name };
      return { ok: false, reason: result.reason, name: '' };
    });
  }
);

export const setOnboardDone = spacetimedb.reducer(
  { done: t.bool() },
  (ctx, { done }) => {
    const sub = senderFirebaseSub(ctx);
    if (!sub) return;
    ensurePlayer(ctx);
    const existing = ctx.db.accountName.firebaseSub.find(sub);
    upsertAccountName(
      ctx,
      sub,
      ctx.sender,
      existing?.displayName || '',
      existing?.nameKind || 'generated',
      !!done,
    );
  }
);

export const getMyProgress = spacetimedb.procedure(
  {},
  t.option(t.object('MyProgressResult', {
    unlockedLevel: t.u32(),
    coins: t.u64(),
    equippedShip: t.string(),
    ownedShipsCsv: t.string(),
    language: t.string(),
    totalScore: t.u64(),
    legacyImported: t.bool(),
    displayName: t.string(),
    nameKind: t.string(),
    onboardDone: t.bool(),
    upgradesJson: t.string(),
    achievementsCsv: t.string(),
    starsJson: t.string(),
  })),
  (ctx) => {
    return ctx.withTx(txCtx => {
      const identity = ctx.sender;
      const progress = txCtx.db.playerProgress.identity.find(identity);
      const shop = txCtx.db.playerShop.identity.find(identity);
      const player = txCtx.db.player.identity.find(identity);
      if (!progress || !shop) return undefined;
      const ships: string[] = [];
      for (const s of txCtx.db.ownedShip.identity.filter(identity)) {
        ships.push(s.shipId);
      }
      const upgrades: Record<string, number> = {};
      for (const u of txCtx.db.playerUpgrades.identity.filter(identity)) {
        upgrades[u.upgradeId] = u.level;
      }
      const achievements: string[] = [];
      for (const a of txCtx.db.playerAchievements.identity.filter(identity)) {
        achievements.push(a.achievementId);
      }
      const stars: Record<string, number> = {};
      for (const s of txCtx.db.levelStars.identity.filter(identity)) {
        stars[String(s.level)] = s.stars;
      }
      const bound = bindAdminCtx(ctx, txCtx);
      const sub = senderFirebaseSub(bound);
      const account = sub ? txCtx.db.accountName.firebaseSub.find(sub) : null;
      const profile = txCtx.db.playerProfile.identity.find(identity);
      const displayName = sub ? (account?.displayName || '') : (profile?.displayName || '');
      return {
        unlockedLevel: progress.unlockedLevel,
        coins: shop.coins,
        equippedShip: shop.equippedShip,
        ownedShipsCsv: ships.join(','),
        language: player?.language || 'en',
        totalScore: progress.totalScore,
        legacyImported: !!txCtx.db.playerLegacyImport.identity.find(identity),
        displayName,
        nameKind: (account?.nameKind || profile?.nameKind || 'generated'),
        onboardDone: !!(account?.onboardDone),
        upgradesJson: JSON.stringify(upgrades),
        achievementsCsv: achievements.join(','),
        starsJson: JSON.stringify(stars),
      };
    });
  }
);

function findPlayerIdentity(db: AnyCtx, hex: string): AnyCtx {
  const want = hex.replace(/^0x/i, '').toLowerCase();
  for (const p of db.player.iter()) {
    const have = identityKey(p.identity).replace(/^0x/i, '').toLowerCase();
    if (have === want || have.startsWith(want) || want.startsWith(have)) return p.identity;
  }
  return null;
}

/** Prefer max/union so a kid never loses guest progress when they sign in. */
function mergeLinkedProgress(ctx: AnyCtx, destIdent: AnyCtx, srcIdent: AnyCtx): void {
  if (!destIdent || !srcIdent) return;
  if (identityKey(destIdent) === identityKey(srcIdent)) return;
  const srcAcc = ctx.db.playerAccount.identity.find(srcIdent);
  if (srcAcc?.email) return;

  const srcProgress = ctx.db.playerProgress.identity.find(srcIdent);
  const destProgress = ctx.db.playerProgress.identity.find(destIdent);
  if (srcProgress && destProgress) {
    const unlocked = Math.max(srcProgress.unlockedLevel, destProgress.unlockedLevel);
    const totalScore = srcProgress.totalScore > destProgress.totalScore ? srcProgress.totalScore : destProgress.totalScore;
    if (unlocked !== destProgress.unlockedLevel || totalScore !== destProgress.totalScore) {
      ctx.db.playerProgress.identity.update({ ...destProgress, unlockedLevel: unlocked, totalScore });
    }
  }

  const srcShop = ctx.db.playerShop.identity.find(srcIdent);
  const destShop = ctx.db.playerShop.identity.find(destIdent);
  if (srcShop && destShop) {
    const coins = srcShop.coins > destShop.coins ? srcShop.coins : destShop.coins;
    const equip = destShop.equippedShip !== 'starter' ? destShop.equippedShip : srcShop.equippedShip;
    if (coins !== destShop.coins || equip !== destShop.equippedShip) {
      ctx.db.playerShop.identity.update({ ...destShop, coins, equippedShip: equip });
    }
    if (coins > destShop.coins) writeCoinEvent(ctx, destIdent, BigInt(coins) - BigInt(destShop.coins), 'link_merge', 0);
  }

  for (const s of ctx.db.ownedShip.identity.filter(srcIdent)) {
    let owned = false;
    for (const d of ctx.db.ownedShip.identity.filter(destIdent)) {
      if (d.shipId === s.shipId) { owned = true; break; }
    }
    if (!owned) ctx.db.ownedShip.insert({ identity: destIdent, shipId: s.shipId });
  }

  for (const s of ctx.db.levelStars.identity.filter(srcIdent)) {
    let existing: { identity: AnyCtx; level: number; stars: number; bestScore: bigint } | null = null;
    for (const d of ctx.db.levelStars.identity.filter(destIdent)) {
      if (d.level === s.level) { existing = d; break; }
    }
    if (!existing) {
      ctx.db.levelStars.insert({ identity: destIdent, level: s.level, stars: s.stars, bestScore: s.bestScore });
    } else if (s.stars > existing.stars || (s.stars === existing.stars && s.bestScore > existing.bestScore)) {
      ctx.db.levelStars.delete(existing);
      ctx.db.levelStars.insert({
        identity: destIdent,
        level: s.level,
        stars: s.stars > existing.stars ? s.stars : existing.stars,
        bestScore: s.bestScore > existing.bestScore ? s.bestScore : existing.bestScore,
      });
    }
  }

  for (const a of ctx.db.playerAchievements.identity.filter(srcIdent)) {
    let have = false;
    for (const d of ctx.db.playerAchievements.identity.filter(destIdent)) {
      if (d.achievementId === a.achievementId) { have = true; break; }
    }
    if (!have) ctx.db.playerAchievements.insert({ identity: destIdent, achievementId: a.achievementId, unlockedAt: a.unlockedAt });
  }

  // Guest names stay local-only. Never copy them onto a signed-in account.
}

function displayNameFor(db: AnyCtx, ident: AnyCtx): string {
  const profile = db.playerProfile.identity.find(ident);
  if (profile?.displayName) return profile.displayName;
  for (const l of db.playerLink.primaryIdentity.filter(ident)) {
    const guest = findPlayerIdentity(db, l.linkedHex);
    if (!guest) continue;
    const gp = db.playerProfile.identity.find(guest);
    if (gp?.displayName) return gp.displayName;
  }
  return '';
}

export const adminMe = spacetimedb.procedure(
  {},
  t.option(t.object('AdminMeResult', {
    ok: t.bool(),
    email: t.string(),
    detail: t.string(),
  })),
  (ctx) => {
    return ctx.withTx(txCtx => {
      const bound = bindAdminCtx(ctx as never, txCtx as never);
      const info = readJwtEmail(bound);
      let ok = false;
      let reason = 'denied';
      try {
        assertAdmin(bound as never);
        ok = true;
        reason = 'ok';
      } catch (err) {
        reason = err instanceof Error ? err.message : String(err);
      }
      const identityHex = identityKey(ctx.sender);
      return {
        ok,
        email: info.email || info.rawEmail,
        detail: JSON.stringify({
          issuer: info.issuer || '',
          sub: info.sub || '',
          hasJwt: !!info.hasJwt,
          identity: identityHex,
          emailVerified: !!info.emailVerified,
          reason,
        }),
      };
    });
  }
);

export const getOnlineNow = spacetimedb.procedure(
  {},
  t.option(t.object('OnlineNowResult', {
    admin: t.bool(),
    total: t.u32(),
    menu: t.u32(),
    solo: t.u32(),
    coop: t.u32(),
    versus: t.u32(),
    peopleJson: t.string(),
  })),
  (ctx) => {
    return ctx.withTx(txCtx => {
      const bound = bindAdminCtx(ctx as never, txCtx as never);
      const admin = senderIsAdmin(bound);
      if (admin) sweepStaleOnlineSessions(bound);
      const now = timestampMicros(txCtx.timestamp as { microsSinceUnixEpoch?: bigint });
      const snap = summarizeOnline(collectOnlineRows(bound), now);
      const payload = publicOnlinePayload(admin, snap);
      return {
        admin: payload.admin,
        total: payload.total,
        menu: payload.menu,
        solo: payload.solo,
        coop: payload.coop,
        versus: payload.versus,
        peopleJson: JSON.stringify(payload.people),
      };
    });
  }
);

export const adminListRoles = spacetimedb.procedure(
  {},
  t.option(t.object('AdminRolesResult', {
    rowsJson: t.string(),
  })),
  (ctx) => {
    return ctx.withTx(txCtx => {
      const bound = bindAdminCtx(ctx as never, txCtx as never);
      assertAdmin(bound as never);
      const rows: Array<Record<string, string | boolean>> = [];
      const seen = new Set<string>();
      for (const row of txCtx.db.adminRole.iter()) {
        const email = normalizeEmail(row.email);
        seen.add(email);
        rows.push({
          email,
          owner: isOwnerEmail(email),
          grantedBy: row.grantedBy,
          grantedAt: String((row.grantedAt as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || ''),
        });
      }
      if (!seen.has(OWNER_EMAIL)) {
        rows.push({ email: OWNER_EMAIL, owner: true, grantedBy: 'system', grantedAt: '' });
      }
      rows.sort((a, b) => Number(b.owner) - Number(a.owner) || String(a.email).localeCompare(String(b.email)));
      return { rowsJson: JSON.stringify(rows) };
    });
  }
);

export const adminStats = spacetimedb.procedure(
  {},
  t.option(t.object('AdminStatsResult', {
    players: t.u32(),
    activeWeek: t.u32(),
    gamesPlayed: t.u64(),
    emptyGuests: t.u32(),
    signedIn: t.u32(),
  })),
  (ctx) => {
    return ctx.withTx(txCtx => {
      assertAdmin(bindAdminCtx(ctx, txCtx) as never);
      let players = 0;
      let activeWeek = 0;
      let emptyGuests = 0;
      let signedIn = 0;
      const now = Number(txCtx.timestamp.microsSinceUnixEpoch || 0n);
      const weekUs = 7 * 24 * 3600 * 1_000_000;
      for (const p of txCtx.db.player.iter()) {
        players += 1;
        const seen = Number((p.lastSeenAt as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || 0n);
        if (now && seen && now - seen < weekUs) activeWeek += 1;
        const acc = txCtx.db.playerAccount.identity.find(p.identity);
        if (acc?.email) signedIn += 1;
        const profile = txCtx.db.playerProfile.identity.find(p.identity);
        const shop = txCtx.db.playerShop.identity.find(p.identity);
        const progress = txCtx.db.playerProgress.identity.find(p.identity);
        const banned = !!txCtx.db.playerBan.identity.find(p.identity);
        const flag = txCtx.db.playerFlag.identity.find(p.identity);
        let extraShips = 0;
        for (const s of txCtx.db.ownedShip.identity.filter(p.identity)) {
          if (s.shipId !== 'starter') extraShips += 1;
        }
        let starCount = 0;
        for (const s of txCtx.db.levelStars.identity.filter(p.identity)) {
          if (s.stars > 0) starCount += 1;
        }
        if (isEmptyGuestRow({
          email: acc?.email || '',
          username: profile?.displayName || '',
          coins: shop?.coins ?? 0n,
          unlocked: progress?.unlockedLevel ?? 1,
          extraShips,
          banned,
          testBot: !!flag?.testBot,
          starCount,
        })) emptyGuests += 1;
      }
      let gamesPlayed = 0n;
      const win = txCtx.db.analyticsCounter.key.find('kind:level_win');
      if (win) gamesPlayed = win.count;
      return { players, activeWeek, gamesPlayed, emptyGuests, signedIn };
    });
  }
);

export const adminListPlayers = spacetimedb.procedure(
  { query: t.string() },
  t.option(t.object('AdminListResult', {
    rowsJson: t.string(),
  })),
  (ctx, { query }) => {
    return ctx.withTx(txCtx => {
      assertAdmin(bindAdminCtx(ctx, txCtx) as never);
      const q = query.trim().toLowerCase();
      const rows: Array<Record<string, string | number | boolean>> = [];
      const now = Number(txCtx.timestamp.microsSinceUnixEpoch || 0n);
      const dayUs = 24 * 3600 * 1_000_000;
      for (const p of txCtx.db.player.iter()) {
        const id = identityKey(p.identity);
        const progress = txCtx.db.playerProgress.identity.find(p.identity);
        const shop = txCtx.db.playerShop.identity.find(p.identity);
        const profile = txCtx.db.playerProfile.identity.find(p.identity);
        const acc = txCtx.db.playerAccount.identity.find(p.identity);
        const banned = !!txCtx.db.playerBan.identity.find(p.identity);
        const flag = txCtx.db.playerFlag.identity.find(p.identity);
        const ships: string[] = [];
        let extraShips = 0;
        for (const s of txCtx.db.ownedShip.identity.filter(p.identity)) {
          ships.push(s.shipId);
          if (s.shipId !== 'starter') extraShips += 1;
        }
        let starCount = 0;
        for (const s of txCtx.db.levelStars.identity.filter(p.identity)) {
          if (s.stars > 0) starCount += 1;
        }
        const linked: string[] = [];
        for (const l of txCtx.db.playerLink.primaryIdentity.filter(p.identity)) linked.push(l.linkedHex);
        let linkedTo = '';
        for (const l of txCtx.db.playerLink.iter()) {
          if (l.linkedHex.replace(/^0x/i, '').toLowerCase() === id.replace(/^0x/i, '').toLowerCase()) {
            linkedTo = identityKey(l.primaryIdentity);
            break;
          }
        }
        const username = displayNameFor(txCtx.db, p.identity);
        const email = acc?.email || '';
        const lastSeen = Number((p.lastSeenAt as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || 0n);
        const emptyGuest = isEmptyGuestRow({
          email, username, coins: shop?.coins ?? 0n, unlocked: progress?.unlockedLevel ?? 1,
          extraShips, banned, testBot: !!flag?.testBot, starCount,
        });
        const blob = `${id} ${username} ${email} ${linked.join(' ')}`.toLowerCase();
        if (q && !blob.includes(q)) continue;
        rows.push({
          id,
          username,
          email,
          coins: String(shop?.coins ?? 0n),
          unlocked: progress?.unlockedLevel ?? 1,
          highest: progress?.unlockedLevel ?? 1,
          ships: ships.join(','),
          lastSeen: String((p.lastSeenAt as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || ''),
          created: String((p.createdAt as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || ''),
          banned,
          testBot: !!flag?.testBot,
          emptyGuest,
          signedIn: !!email,
          activeToday: !!(now && lastSeen && now - lastSeen < dayUs),
          linkedIds: linked.join(','),
          linkedTo,
        });
      }
      rows.sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
      return { rowsJson: JSON.stringify(rows.slice(0, 800)) };
    });
  }
);

export const adminGetPlayer = spacetimedb.procedure(
  { targetHex: t.string() },
  t.option(t.object('AdminPlayerResult', {
    rowJson: t.string(),
  })),
  (ctx, { targetHex }) => {
    return ctx.withTx(txCtx => {
      assertAdmin(bindAdminCtx(ctx, txCtx) as never);
      const ident = findPlayerIdentity(txCtx.db, targetHex);
      if (!ident) return { rowJson: '' };
      const progress = txCtx.db.playerProgress.identity.find(ident);
      const shop = txCtx.db.playerShop.identity.find(ident);
      const profile = txCtx.db.playerProfile.identity.find(ident);
      const acc = txCtx.db.playerAccount.identity.find(ident);
      const banned = txCtx.db.playerBan.identity.find(ident);
      const flag = txCtx.db.playerFlag.identity.find(ident);
      const sess = txCtx.db.playerSession.identity.find(ident);
      const player = txCtx.db.player.identity.find(ident);
      const ships: string[] = [];
      for (const s of txCtx.db.ownedShip.identity.filter(ident)) ships.push(s.shipId);
      const stars: Record<string, { stars: number; best: string }> = {};
      for (const s of txCtx.db.levelStars.identity.filter(ident)) {
        stars[String(s.level)] = { stars: s.stars, best: String(s.bestScore) };
      }
      const ach: string[] = [];
      for (const a of txCtx.db.playerAchievements.identity.filter(ident)) ach.push(a.achievementId);
      const linked: string[] = [];
      for (const l of txCtx.db.playerLink.primaryIdentity.filter(ident)) linked.push(`${l.kind}:${l.linkedHex}`);
      const now = Number(txCtx.timestamp.microsSinceUnixEpoch || 0n);
      const retain = GEO_RETENTION_MS * 1000;
      const presence: Array<Record<string, string>> = [];
      for (const pr of txCtx.db.playerPresence.identity.filter(ident)) {
        const at = Number((pr.at as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || 0n);
        if (now && at && now - at > retain) continue;
        presence.push({
          at: String(at),
          country: pr.country,
          region: pr.region,
          city: pr.city,
          ipTrunc: pr.ipTrunc,
          ipFull: STORE_FULL_IP ? pr.ipFull : '',
          userAgent: pr.userAgent,
        });
      }
      presence.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      const coins: Array<Record<string, string | number>> = [];
      for (const ev of txCtx.db.coinEvent.identity.filter(ident)) {
        coins.push({
          at: String((ev.at as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || ''),
          amount: String(ev.amount),
          reason: ev.reason,
          level: ev.level,
        });
      }
      coins.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      const audit: Array<Record<string, string>> = [];
      const hex = identityKey(ident);
      for (const a of txCtx.db.adminAudit.iter()) {
        if (String(a.targetKey).toLowerCase().replace(/^0x/, '').startsWith(hex.replace(/^0x/i, '').slice(0, 10).toLowerCase())
          || String(a.targetKey).toLowerCase().includes(hex.replace(/^0x/i, '').toLowerCase())) {
          audit.push({
            at: String((a.at as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || ''),
            action: a.action,
            detail: a.detail,
          });
        }
      }
      return {
        rowJson: JSON.stringify({
          id: hex,
          username: displayNameFor(txCtx.db, ident) || profile?.displayName || '',
          email: acc?.email || '',
          firebaseSub: acc?.firebaseSub || '',
          coins: String(shop?.coins ?? 0n),
          unlocked: progress?.unlockedLevel ?? 1,
          equipped: shop?.equippedShip || 'starter',
          ships: ships.join(','),
          stars,
          achievements: ach.join(','),
          banned: !!banned,
          banReason: banned?.reason || '',
          testBot: !!flag?.testBot,
          sessions: sess?.count || 0,
          roomsJoined: sess?.roomsJoined || 0,
          linkedIds: linked.join(','),
          created: String((player?.createdAt as { microsSinceUnixEpoch?: bigint })?.microsSinceUnixEpoch || ''),
          lastSeen: String((player?.lastSeenAt as { microsSinceUnixEpoch?: bigint })?.microsSinceUnixEpoch || ''),
          language: player?.language || '',
          presence: presence.slice(0, 20),
          coinHistory: coins.slice(0, 40),
          audit: audit.slice(0, 40),
          storeFullIp: STORE_FULL_IP,
        }),
      };
    });
  }
);

export const adminSetCoins = spacetimedb.reducer(
  { targetHex: t.string(), coins: t.u64() },
  (ctx, { targetHex, coins }) => {
    assertAdmin(ctx);
    const ident = findPlayerIdentity(ctx.db, targetHex);
    if (!ident) throw new Error('Player not found');
    const shop = ctx.db.playerShop.identity.find(ident);
    if (!shop) throw new Error('Shop not found');
    const next = coins > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : coins;
    const delta = next - shop.coins;
    ctx.db.playerShop.identity.update({ ...shop, coins: next });
    writeCoinEvent(ctx, ident, delta, 'admin_set', 0);
    writeAudit(ctx, 'set_coins', targetHex, { coins: String(next) });
  }
);

export const adminAddCoins = spacetimedb.reducer(
  { targetHex: t.string(), delta: t.i64() },
  (ctx, { targetHex, delta }) => {
    assertAdmin(ctx);
    const ident = findPlayerIdentity(ctx.db, targetHex);
    if (!ident) throw new Error('Player not found');
    const shop = ctx.db.playerShop.identity.find(ident);
    if (!shop) throw new Error('Shop not found');
    let next = shop.coins + delta;
    if (next < 0n) next = 0n;
    if (next > BigInt(MAX_COINS)) next = BigInt(MAX_COINS);
    ctx.db.playerShop.identity.update({ ...shop, coins: next });
    writeCoinEvent(ctx, ident, delta, 'admin_add', 0);
    writeAudit(ctx, 'add_coins', targetHex, { delta: String(delta), coins: String(next) });
  }
);

export const adminUnlockLevel = spacetimedb.reducer(
  { targetHex: t.string(), level: t.u32() },
  (ctx, { targetHex, level }) => {
    assertAdmin(ctx);
    const ident = findPlayerIdentity(ctx.db, targetHex);
    if (!ident) throw new Error('Player not found');
    const progress = ctx.db.playerProgress.identity.find(ident);
    if (!progress) throw new Error('Progress not found');
    const unlocked = clamp(level, 1, MAX_LEVEL);
    ctx.db.playerProgress.identity.update({ ...progress, unlockedLevel: unlocked });
    writeAudit(ctx, 'unlock_level', targetHex, { level: unlocked });
  }
);

export const adminGrantShip = spacetimedb.reducer(
  { targetHex: t.string(), shipId: t.string() },
  (ctx, { targetHex, shipId }) => {
    assertAdmin(ctx);
    if (!validateShip(shipId)) throw new Error('Invalid ship');
    const ident = findPlayerIdentity(ctx.db, targetHex);
    if (!ident) throw new Error('Player not found');
    let owned = false;
    for (const s of ctx.db.ownedShip.identity.filter(ident)) {
      if (s.shipId === shipId) owned = true;
    }
    if (!owned) ctx.db.ownedShip.insert({ identity: ident, shipId });
    writeAudit(ctx, 'grant_ship', targetHex, { shipId });
  }
);

export const adminRemoveShip = spacetimedb.reducer(
  { targetHex: t.string(), shipId: t.string() },
  (ctx, { targetHex, shipId }) => {
    assertAdmin(ctx);
    const ident = findPlayerIdentity(ctx.db, targetHex);
    if (!ident) throw new Error('Player not found');
    if (shipId === 'starter') throw new Error('Cannot remove starter');
    for (const s of ctx.db.ownedShip.identity.filter(ident)) {
      if (s.shipId === shipId) ctx.db.ownedShip.delete(s);
    }
    const shop = ctx.db.playerShop.identity.find(ident);
    if (shop && shop.equippedShip === shipId) {
      ctx.db.playerShop.identity.update({ ...shop, equippedShip: 'starter' });
    }
    writeAudit(ctx, 'remove_ship', targetHex, { shipId });
  }
);

export const adminResetProgress = spacetimedb.reducer(
  { targetHex: t.string() },
  (ctx, { targetHex }) => {
    assertAdmin(ctx);
    const ident = findPlayerIdentity(ctx.db, targetHex);
    if (!ident) throw new Error('Player not found');
    const progress = ctx.db.playerProgress.identity.find(ident);
    if (progress) ctx.db.playerProgress.identity.update({ ...progress, unlockedLevel: 1, totalScore: 0n });
    for (const s of [...ctx.db.levelStars.identity.filter(ident)]) ctx.db.levelStars.delete(s);
    writeAudit(ctx, 'reset_progress', targetHex, {});
  }
);

export const adminResetPlayer = spacetimedb.reducer(
  { targetHex: t.string() },
  (ctx, { targetHex }) => {
    assertAdmin(ctx);
    const ident = findPlayerIdentity(ctx.db, targetHex);
    if (!ident) throw new Error('Player not found');
    const progress = ctx.db.playerProgress.identity.find(ident);
    if (progress) ctx.db.playerProgress.identity.update({ ...progress, unlockedLevel: 1, totalScore: 0n });
    const shop = ctx.db.playerShop.identity.find(ident);
    if (shop) ctx.db.playerShop.identity.update({ ...shop, coins: 0n, equippedShip: 'starter' });
    for (const s of [...ctx.db.levelStars.identity.filter(ident)]) ctx.db.levelStars.delete(s);
    for (const s of [...ctx.db.ownedShip.identity.filter(ident)]) {
      if (s.shipId !== 'starter') ctx.db.ownedShip.delete(s);
    }
    writeAudit(ctx, 'reset_player', targetHex, {});
  }
);

export const adminBan = spacetimedb.reducer(
  { targetHex: t.string(), reason: t.string() },
  (ctx, { targetHex, reason }) => {
    assertAdmin(ctx);
    const ident = findPlayerIdentity(ctx.db, targetHex);
    if (!ident) throw new Error('Player not found');
    if (String(ident) === String(ctx.sender)) throw new Error('Cannot ban self');
    const existing = ctx.db.playerBan.identity.find(ident);
    if (existing) ctx.db.playerBan.identity.update({ ...existing, reason: reason.slice(0, 80), bannedAt: ctx.timestamp });
    else ctx.db.playerBan.insert({ identity: ident, bannedAt: ctx.timestamp, reason: reason.slice(0, 80) });
    writeAudit(ctx, 'ban', targetHex, { reason: reason.slice(0, 80) });
  }
);

export const adminUnban = spacetimedb.reducer(
  { targetHex: t.string() },
  (ctx, { targetHex }) => {
    assertAdmin(ctx);
    const ident = findPlayerIdentity(ctx.db, targetHex);
    if (!ident) throw new Error('Player not found');
    const existing = ctx.db.playerBan.identity.find(ident);
    if (existing) ctx.db.playerBan.delete(existing);
    writeAudit(ctx, 'unban', targetHex, {});
  }
);

export const adminGrantRole = spacetimedb.reducer(
  { email: t.string() },
  (ctx, { email }) => {
    assertAdmin(ctx);
    const checked = canGrantAdmin(email);
    if (!checked.ok) throw new Error(checked.reason);
    const existing = ctx.db.adminRole.email.find(checked.email);
    if (!existing) {
      const granter = readJwtEmail(ctx).email || OWNER_EMAIL;
      ctx.db.adminRole.insert({
        email: checked.email,
        grantedBy: granter,
        grantedAt: ctx.timestamp,
      });
    }
    writeAudit(ctx, 'grant_admin', checked.email, {});
  }
);

export const adminRevokeRole = spacetimedb.reducer(
  { email: t.string() },
  (ctx, { email }) => {
    assertAdmin(ctx);
    const checked = canRevokeAdmin(email);
    if (!checked.ok) throw new Error(checked.reason);
    const existing = ctx.db.adminRole.email.find(checked.email);
    if (existing) ctx.db.adminRole.delete(existing);
    for (const row of [...ctx.db.adminUser.iter()]) {
      if (normalizeEmail(row.email) === checked.email) ctx.db.adminUser.delete(row);
    }
    writeAudit(ctx, 'revoke_admin', checked.email, {});
  }
);

export const ensurePlayerRow = spacetimedb.reducer(
  {},
  (ctx) => {
    assertNotBanned(ctx);
    ensurePlayer(ctx);
  }
);

export const linkGuestIdentity = spacetimedb.reducer(
  { guestHex: t.string() },
  (ctx, { guestHex }) => {
    ensurePlayer(ctx);
    const hex = guestHex.replace(/^0x/i, '').toLowerCase().slice(0, 64);
    if (hex.length < 8) return;
    if (hex === identityKey(ctx.sender).replace(/^0x/i, '').toLowerCase()) return;
    let already = false;
    for (const l of ctx.db.playerLink.primaryIdentity.filter(ctx.sender)) {
      if (l.linkedHex === hex) already = true;
    }
    if (!already) {
      ctx.db.playerLink.insert({ id: BigInt(0), primaryIdentity: ctx.sender, linkedHex: hex, kind: 'guest' });
    }
    const guest = findPlayerIdentity(ctx.db, hex);
    if (guest) mergeLinkedProgress(ctx, ctx.sender, guest);
  }
);

export const reportPresence = spacetimedb.reducer(
  {
    country: t.string(),
    region: t.string(),
    city: t.string(),
    ipTrunc: t.string(),
    ipFull: t.string(),
    iat: t.u64(),
    sig: t.string(),
    userAgent: t.string(),
  },
  (ctx, data) => {
    if (!ctx.db.player.identity.find(ctx.sender)) return;
    const ok = verifyGeo({
      country: data.country,
      region: data.region,
      city: data.city,
      ipTrunc: data.ipTrunc,
      iat: Number(data.iat),
      sig: data.sig,
    }, Date.now());
    if (!ok) return;
    const now = Number(ctx.timestamp.microsSinceUnixEpoch || 0n);
    const retain = GEO_RETENTION_MS * 1000;
    for (const old of [...ctx.db.playerPresence.identity.filter(ctx.sender)]) {
      const at = Number((old.at as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || 0n);
      if (now && at && now - at > retain) ctx.db.playerPresence.delete(old);
    }
    ctx.db.playerPresence.insert({
      id: BigInt(0),
      identity: ctx.sender,
      at: ctx.timestamp,
      country: data.country.slice(0, 8),
      region: data.region.slice(0, 16),
      city: data.city.slice(0, 48),
      ipTrunc: data.ipTrunc.slice(0, 48),
      ipFull: STORE_FULL_IP ? data.ipFull.slice(0, 64) : '',
      userAgent: data.userAgent.slice(0, 160),
    });
    const sess = ctx.db.playerSession.identity.find(ctx.sender);
    if (sess) ctx.db.playerSession.identity.update({ ...sess, count: sess.count + 1 });
    else ctx.db.playerSession.insert({ identity: ctx.sender, count: 1, roomsJoined: 0 });
  }
);

export const reportMpJoin = spacetimedb.reducer(
  {},
  (ctx) => {
    ensurePlayer(ctx);
    const sess = ctx.db.playerSession.identity.find(ctx.sender);
    if (sess) ctx.db.playerSession.identity.update({ ...sess, roomsJoined: sess.roomsJoined + 1 });
    else ctx.db.playerSession.insert({ identity: ctx.sender, count: 1, roomsJoined: 1 });
  }
);

export const heartbeatOnline = spacetimedb.reducer(
  { activity: t.string(), displayName: t.string() },
  (ctx, { activity, displayName }) => {
    upsertOnlineSession(ctx, activity, displayName);
  }
);

export const adminSetTestFlag = spacetimedb.reducer(
  { targetHex: t.string(), testBot: t.bool() },
  (ctx, { targetHex, testBot }) => {
    assertAdmin(ctx);
    const ident = findPlayerIdentity(ctx.db, targetHex);
    if (!ident) throw new Error('Player not found');
    const existing = ctx.db.playerFlag.identity.find(ident);
    if (existing) ctx.db.playerFlag.identity.update({ ...existing, testBot });
    else ctx.db.playerFlag.insert({ identity: ident, testBot });
    writeAudit(ctx, 'set_test_flag', targetHex, { testBot });
  }
);

export const adminPurgeEmptyGuests = spacetimedb.reducer(
  { olderDays: t.u32(), confirm: t.string() },
  (ctx, { olderDays, confirm }) => {
    assertAdmin(ctx);
    if (confirm !== 'PURGE') throw new Error('Confirmation required');
    const days = Math.max(1, Math.min(365, olderDays || 14));
    const now = Number(ctx.timestamp.microsSinceUnixEpoch || 0n);
    const cutoff = now - days * 24 * 3600 * 1_000_000;
    let removed = 0;
    for (const p of [...ctx.db.player.iter()]) {
      const last = Number((p.lastSeenAt as { microsSinceUnixEpoch?: bigint }).microsSinceUnixEpoch || 0n);
      if (!last || last > cutoff) continue;
      const acc = ctx.db.playerAccount.identity.find(p.identity);
      const profile = ctx.db.playerProfile.identity.find(p.identity);
      const shop = ctx.db.playerShop.identity.find(p.identity);
      const progress = ctx.db.playerProgress.identity.find(p.identity);
      const banned = !!ctx.db.playerBan.identity.find(p.identity);
      const flag = ctx.db.playerFlag.identity.find(p.identity);
      let extraShips = 0;
      for (const s of ctx.db.ownedShip.identity.filter(p.identity)) {
        if (s.shipId !== 'starter') extraShips += 1;
      }
      let starCount = 0;
      for (const s of ctx.db.levelStars.identity.filter(p.identity)) {
        if (s.stars > 0) starCount += 1;
      }
      if (!isEmptyGuestRow({
        email: acc?.email || '',
        username: profile?.displayName || '',
        coins: shop?.coins ?? 0n,
        unlocked: progress?.unlockedLevel ?? 1,
        extraShips,
        banned,
        testBot: !!flag?.testBot,
        starCount,
      })) continue;
      for (const s of [...ctx.db.ownedShip.identity.filter(p.identity)]) ctx.db.ownedShip.delete(s);
      for (const s of [...ctx.db.levelStars.identity.filter(p.identity)]) ctx.db.levelStars.delete(s);
      for (const u of [...ctx.db.playerUpgrades.identity.filter(p.identity)]) ctx.db.playerUpgrades.delete(u);
      if (shop) ctx.db.playerShop.delete(shop);
      if (progress) ctx.db.playerProgress.delete(progress);
      const settings = ctx.db.playerSettings.identity.find(p.identity);
      if (settings) ctx.db.playerSettings.delete(settings);
      ctx.db.player.delete(p);
      removed += 1;
      if (removed >= 200) break;
    }
    writeAudit(ctx, 'purge_empty_guests', 'bulk', { olderDays: days, removed });
  }
);

const ROOM_CODE_OK = 'ACDEFHJKMNPRTUVWXY34679';
const ROOM_TTL_US = 15 * 1_000_000;

function cleanRoomCode(code: string): string {
  return String(code || '').toUpperCase().replace(/O/g, '0').split('').filter((ch) => ROOM_CODE_OK.includes(ch)).join('').slice(0, 5);
}

function safeRoomName(raw: string): string {
  const checked = validateDisplayName(String(raw || '').trim().slice(0, 16), 'custom');
  return checked.ok ? checked.name : 'Pilot';
}

function timestampMicros(ts: { microsSinceUnixEpoch?: bigint; __timestamp_micros_since_unix_epoch__?: bigint } | undefined): number {
  const raw = ts?.microsSinceUnixEpoch ?? ts?.__timestamp_micros_since_unix_epoch__ ?? 0n;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function sweepStalePublicRooms(ctx: AnyCtx): void {
  const now = timestampMicros(ctx.timestamp as { microsSinceUnixEpoch?: bigint });
  if (!now) return;
  for (const row of [...ctx.db.publicRoom.iter()]) {
    const beat = timestampMicros(row.heartbeat as { microsSinceUnixEpoch?: bigint; __timestamp_micros_since_unix_epoch__?: bigint });
    if (beat && now - beat > ROOM_TTL_US) {
      ctx.db.publicRoom.delete(row);
      console.info(`public_room sweep ${row.code}`);
    }
  }
}

function upsertPublicRoom(ctx: AnyCtx, code: string, hostName: string, level: number, players: number, inGame: boolean, versus: boolean): void {
  sweepStalePublicRooms(ctx);
  const existing = ctx.db.publicRoom.code.find(code);
  const isVersus = !!versus;
  const cap = isVersus ? 2 : 5;
  const row = {
    code,
    hostIdentity: ctx.sender,
    hostName: safeRoomName(hostName),
    level: Math.max(1, Math.min(MAX_LEVEL, Math.floor(level) || 1)),
    players: Math.max(1, Math.min(cap, Math.floor(players) || 1)),
    inGame: !!inGame,
    heartbeat: ctx.timestamp,
    versus: isVersus,
  };
  if (existing) {
    if (identityKey(existing.hostIdentity) !== identityKey(ctx.sender)) throw new Error('Not your room');
    ctx.db.publicRoom.code.update(row);
    console.info(`public_room update ${code} players=${row.players} inGame=${row.inGame}`);
    return;
  }
  for (const old of [...ctx.db.publicRoom.hostIdentity.filter(ctx.sender)]) {
    ctx.db.publicRoom.delete(old);
    console.info(`public_room delete ${old.code} reason=replace`);
  }
  ctx.db.publicRoom.insert(row);
  console.info(`public_room insert ${code} host=${row.hostName} level=${row.level} players=${row.players}`);
}

export const publishPublicRoom = spacetimedb.reducer(
  { code: t.string(), hostName: t.string(), level: t.u32(), players: t.u32(), inGame: t.bool(), versus: t.bool() },
  (ctx, { code, hostName, level, players, inGame, versus }) => {
    assertNotBanned(ctx);
    ensurePlayer(ctx);
    const clean = cleanRoomCode(code);
    if (clean.length !== 5) throw new Error('Bad room code');
    upsertPublicRoom(ctx, clean, hostName, level, players, inGame, versus);
  }
);

export const heartbeatPublicRoom = spacetimedb.reducer(
  { code: t.string(), hostName: t.string(), level: t.u32(), players: t.u32(), inGame: t.bool(), versus: t.bool() },
  (ctx, { code, hostName, level, players, inGame, versus }) => {
    const clean = cleanRoomCode(code);
    if (clean.length !== 5) return;
    const existing = ctx.db.publicRoom.code.find(clean);
    if (existing && identityKey(existing.hostIdentity) !== identityKey(ctx.sender)) return;
    upsertPublicRoom(ctx, clean, hostName || existing?.hostName || 'Pilot', level, players, inGame, versus || !!existing?.versus);
  }
);

export const closePublicRoom = spacetimedb.reducer(
  { code: t.string() },
  (ctx, { code }) => {
    const clean = cleanRoomCode(code);
    const existing = clean ? ctx.db.publicRoom.code.find(clean) : null;
    if (existing && identityKey(existing.hostIdentity) === identityKey(ctx.sender)) {
      ctx.db.publicRoom.delete(existing);
      console.info(`public_room delete ${existing.code} reason=close`);
      return;
    }
    for (const old of [...ctx.db.publicRoom.hostIdentity.filter(ctx.sender)]) {
      ctx.db.publicRoom.delete(old);
      console.info(`public_room delete ${old.code} reason=close-host`);
    }
  }
);

export const listPublicRooms = spacetimedb.procedure(
  {},
  t.option(t.object('PublicRoomListResult', {
    roomsJson: t.string(),
  })),
  (ctx) => {
    return ctx.withTx(txCtx => {
      const now = timestampMicros(txCtx.timestamp as { microsSinceUnixEpoch?: bigint });
      const rooms: Array<{ code: string; hostName: string; level: number; players: number; versus: boolean; heartbeatMs: number }> = [];
      for (const row of [...txCtx.db.publicRoom.iter()]) {
        const beat = timestampMicros(row.heartbeat as { microsSinceUnixEpoch?: bigint; __timestamp_micros_since_unix_epoch__?: bigint });
        if (now && beat && now - beat > ROOM_TTL_US) {
          txCtx.db.publicRoom.delete(row);
          continue;
        }
        const cap = row.versus ? 2 : 5;
        if (row.inGame || row.players < 1 || row.players >= cap) continue;
        rooms.push({
          code: row.code,
          hostName: safeRoomName(row.hostName),
          level: row.level,
          players: row.players,
          versus: !!row.versus,
          heartbeatMs: beat ? Math.floor(beat / 1000) : 0,
        });
      }
      rooms.sort((a, b) => a.level - b.level || a.hostName.localeCompare(b.hostName));
      return { roomsJson: JSON.stringify(rooms.slice(0, 40)) };
    });
  }
);

function sweepStaleVersusQueue(ctx: AnyCtx): void {
  const now = timestampMicros(ctx.timestamp as { microsSinceUnixEpoch?: bigint });
  if (!now) return;
  for (const row of [...ctx.db.versusQueue.iter()]) {
    const beat = timestampMicros(row.heartbeat as { microsSinceUnixEpoch?: bigint; __timestamp_micros_since_unix_epoch__?: bigint });
    if (beat && now - beat > VERSUS_QUEUE_TTL_US) {
      ctx.db.versusQueue.delete(row);
      console.info(`versus_queue sweep ${row.code}`);
    }
  }
}

function upsertVersusQueue(
  ctx: AnyCtx,
  code: string,
  kind: string,
  hostName: string,
  hostShip: string,
): void {
  sweepStaleVersusQueue(ctx);
  const hex = identityKey(ctx.sender);
  const ship = validateShip(hostShip) ? hostShip : 'starter';
  const k = kind === 'challenge' ? 'challenge' : 'quick';
  const existing = ctx.db.versusQueue.code.find(code);
  const row = {
    code,
    hostIdentity: ctx.sender,
    guestIdentity: existing?.guestIdentity || ctx.sender,
    hostHex: hex,
    guestHex: existing?.guestHex || '',
    hostName: safeRoomName(hostName),
    guestName: existing?.guestName || '',
    hostShip: ship,
    guestShip: existing?.guestShip || '',
    kind: k,
    inMatch: existing ? !!existing.inMatch : false,
    heartbeat: ctx.timestamp,
  };
  if (existing) {
    if (identityKey(existing.hostIdentity) !== hex) throw new Error('Not your versus room');
    ctx.db.versusQueue.code.update(row);
    return;
  }
  for (const old of [...ctx.db.versusQueue.hostIdentity.filter(ctx.sender)]) {
    ctx.db.versusQueue.delete(old);
  }
  ctx.db.versusQueue.insert(row);
  console.info(`versus_queue insert ${code} kind=${k}`);
}

export const publishVersusQueue = spacetimedb.reducer(
  { code: t.string(), hostName: t.string(), hostShip: t.string(), kind: t.string() },
  (ctx, { code, hostName, hostShip, kind }) => {
    assertNotBanned(ctx);
    ensurePlayer(ctx);
    const clean = cleanRoomCode(code);
    if (clean.length !== 5) throw new Error('Bad versus code');
    upsertVersusQueue(ctx, clean, kind, hostName, hostShip);
  }
);

export const heartbeatVersusQueue = spacetimedb.reducer(
  { code: t.string(), hostName: t.string(), hostShip: t.string(), kind: t.string() },
  (ctx, { code, hostName, hostShip, kind }) => {
    const clean = cleanRoomCode(code);
    if (clean.length !== 5) return;
    const existing = ctx.db.versusQueue.code.find(clean);
    if (existing && identityKey(existing.hostIdentity) !== identityKey(ctx.sender)) return;
    upsertVersusQueue(ctx, clean, kind || existing?.kind || 'quick', hostName || existing?.hostName || 'Pilot', hostShip || existing?.hostShip || 'starter');
  }
);

export const closeVersusQueue = spacetimedb.reducer(
  { code: t.string() },
  (ctx, { code }) => {
    const clean = cleanRoomCode(code);
    const existing = clean ? ctx.db.versusQueue.code.find(clean) : null;
    if (existing && identityKey(existing.hostIdentity) === identityKey(ctx.sender)) {
      ctx.db.versusQueue.delete(existing);
      console.info(`versus_queue delete ${existing.code} reason=close`);
      return;
    }
    for (const old of [...ctx.db.versusQueue.hostIdentity.filter(ctx.sender)]) {
      ctx.db.versusQueue.delete(old);
      console.info(`versus_queue delete ${old.code} reason=close-host`);
    }
  }
);

export const claimVersusQueue = spacetimedb.reducer(
  { code: t.string(), guestName: t.string(), guestShip: t.string() },
  (ctx, { code, guestName, guestShip }) => {
    assertNotBanned(ctx);
    ensurePlayer(ctx);
    sweepStaleVersusQueue(ctx);
    const clean = cleanRoomCode(code);
    const row = ctx.db.versusQueue.code.find(clean);
    if (!row) throw new Error('Versus room not found');
    const me = identityKey(ctx.sender);
    if (identityKey(row.hostIdentity) === me) return;
    if (row.guestHex && row.guestHex !== me) throw new Error('Versus room taken');
    const ship = validateShip(guestShip) ? guestShip : 'starter';
    ctx.db.versusQueue.code.update({
      ...row,
      guestIdentity: ctx.sender,
      guestHex: me,
      guestName: safeRoomName(guestName),
      guestShip: ship,
      inMatch: true,
      heartbeat: ctx.timestamp,
    });
    console.info(`versus_queue claim ${clean} guest=${me.slice(0, 8)}`);
  }
);

export const reportVersusResult = spacetimedb.reducer(
  { matchId: t.string(), winnerPid: t.u32(), hostRounds: t.u32(), guestRounds: t.u32() },
  (ctx, { matchId, winnerPid, hostRounds, guestRounds }) => {
    assertNotBanned(ctx);
    ensurePlayer(ctx);
    const clean = cleanRoomCode(matchId);
    if (clean.length !== 5) throw new Error('Bad match id');
    const check = validateVersusReport({ winnerPid: winnerPid | 0, hostRounds: hostRounds | 0, guestRounds: guestRounds | 0 });
    if (!check.ok) throw new Error(check.reason || 'Bad versus report');
    const row = ctx.db.versusQueue.code.find(clean);
    if (!row) throw new Error('Versus match not found');
    const me = identityKey(ctx.sender);
    const hostHex = row.hostHex || identityKey(row.hostIdentity);
    const guestHex = row.guestHex || '';
    if (me !== hostHex && me !== guestHex) throw new Error('Not in this match');
    if ((winnerPid | 0) === 2 && !guestHex) throw new Error('No guest');
    const already = ctx.db.versusSettled.matchId.find(clean);
    if (already) return;
    const winnerHex = (winnerPid | 0) === 1 ? hostHex : guestHex;
    if (!winnerHex) throw new Error('No winner identity');
    const winnerIdent = (winnerPid | 0) === 1 ? row.hostIdentity : row.guestIdentity;
    const dayKey = utcDayKeyFromMicros(ctx.timestamp.microsSinceUnixEpoch || 0n);
    const dayRow = ctx.db.versusPrizeDay.identity.find(winnerIdent);
    const alreadyToday = dayRow && dayRow.dayKey === dayKey ? dayRow.awarded : 0;
    const prize = prizeToAward(alreadyToday);
    ctx.db.versusSettled.insert({
      matchId: clean,
      winnerHex,
      prize,
      at: ctx.timestamp,
    });
    if (prize > 0) {
      const shop = ctx.db.playerShop.identity.find(winnerIdent);
      if (shop) {
        const next = shop.coins + BigInt(prize);
        const clamped = next > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : next;
        ctx.db.playerShop.identity.update({ ...shop, coins: clamped });
        writeCoinEvent(ctx, winnerIdent, BigInt(prize), 'versus', 0);
      }
      if (dayRow) {
        ctx.db.versusPrizeDay.identity.update({
          identity: winnerIdent,
          dayKey,
          awarded: (dayRow.dayKey === dayKey ? dayRow.awarded : 0) + prize,
        });
      } else {
        ctx.db.versusPrizeDay.insert({ identity: winnerIdent, dayKey, awarded: prize });
      }
    }
    console.info(`versus_settle ${clean} winner=${winnerHex.slice(0, 8)} prize=${prize}`);
  }
);
