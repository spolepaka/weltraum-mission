/**
 * Weltraum-Mission SpacetimeDB Module
 * Stage Zero: Anonymous identity, progress sync, level gating, error tracking
 */

import { schema, table, t } from 'spacetimedb/server';
import { assertTrustedCaller, authSnapshotFromCtx } from './auth-trust';
import { buildLevelPayload } from './level-catalog';
import { nameKey, uniquifyDisplayName, validateDisplayName, type NameKind } from './display-names';
import { plausibleLegacyUnlock } from './legacy-import';

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
  'drache', 'omega', 'frostwal', 'lindwurm', 'hydra', 'regenbogen', 'kaiserbrecher'
]);

const VALID_ACHIEVEMENTS = new Set([
  'firstWin', 'combo10', 'combo25', 'boss3', 'boss10', 'noHit', 'speedrun',
  'coins1k', 'coins10k', 'coins100k', 'allShips', 'maxUpgrades', 'level25',
  'level50', 'level75', 'level100', 'perfect3', 'missions10', 'sessions50'
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
  const identity = ctx.sender;
  const now = ctx.timestamp;
  
  const existingPlayer = ctx.db.player.identity.find(identity);
  
  if (!existingPlayer) {
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
    
    console.info(`New player connected: ${identity}`);
  } else {
    ctx.db.player.identity.update({ ...existingPlayer, lastSeenAt: now });
    console.info(`Returning player connected: ${identity}`);
  }
});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
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
    const identity = ctx.sender;
    
    const progress = ctx.db.playerProgress.identity.find(identity);
    if (!progress) throw new Error('Progress record not found');
    
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
    const modeMult = mode === 'veteran' ? 1.5 : mode === 'easy' ? 0.75 : 1;
    const maxCoins = BigInt(Math.ceil(result.level * 5000 * modeMult));
    if (result.coinsEarned > maxCoins) {
      throw new Error('Coins exceed maximum for this level');
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
      const newCoins = shop.coins + result.coinsEarned;
      const clampedCoins = newCoins > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : newCoins;
      ctx.db.playerShop.identity.update({ ...shop, coins: clampedCoins });
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

export const purchaseShip = spacetimedb.reducer(
  { shipId: t.string(), price: t.u64() },
  (ctx, { shipId, price }) => {
    const identity = ctx.sender;
    
    if (!validateShip(shipId)) {
      throw new Error(`Invalid ship: ${shipId}`);
    }
    
    const shop = ctx.db.playerShop.identity.find(identity);
    if (!shop) throw new Error('Shop data not found');
    
    for (const s of ctx.db.ownedShip.identity.filter(identity)) {
      if (s.shipId === shipId) {
        throw new Error('Ship already owned');
      }
    }
    
    if (shop.coins < price) {
      throw new Error('Insufficient coins');
    }
    
    ctx.db.playerShop.identity.update({
      ...shop,
      coins: shop.coins - price,
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
      throw new Error('Ship not owned');
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
    
    if (shop.coins < price) {
      throw new Error('Insufficient coins');
    }
    
    ctx.db.playerShop.identity.update({
      ...shop,
      coins: shop.coins - price,
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
      const newCoins = shop.coins + BigInt(secret.coins);
      const clampedCoins = newCoins > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : newCoins;
      ctx.db.playerShop.identity.update({ ...shop, coins: clampedCoins });
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
    const identity = ctx.sender;
    if (amount <= BigInt(0)) return;
    const shop = ctx.db.playerShop.identity.find(identity);
    if (!shop) throw new Error('Shop data not found');
    const next = shop.coins + amount;
    const clamped = next > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : next;
    ctx.db.playerShop.identity.update({ ...shop, coins: clamped });
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

export const setDisplayName = spacetimedb.reducer(
  { name: t.string(), kind: t.string() },
  (ctx, { name, kind }) => {
    const identity = ctx.sender;
    const nameKind = (kind === 'custom' ? 'custom' : 'generated') as NameKind;
    // Custom names are allowed for every identity (guest and signed-in).
    const checked = validateDisplayName(name, nameKind);
    if (!checked.ok) {
      throw new Error(`Invalid display name: ${checked.reason}`);
    }

    const finalName = uniquifyDisplayName(checked.name, (key) => {
      const existingClaim = ctx.db.claimedName.nameKey.find(key);
      return !!(existingClaim && String(existingClaim.identity) !== String(identity));
    });

    const profile = ctx.db.playerProfile.identity.find(identity);
    if (profile) {
      const oldKey = nameKey(profile.displayName);
      if (oldKey !== nameKey(finalName)) {
        const oldClaim = ctx.db.claimedName.nameKey.find(oldKey);
        if (oldClaim && String(oldClaim.identity) === String(identity)) {
          ctx.db.claimedName.delete(oldClaim);
        }
      }
      ctx.db.playerProfile.identity.update({
        ...profile,
        displayName: finalName,
        nameKind,
      });
    } else {
      ctx.db.playerProfile.insert({ identity, displayName: finalName, nameKind });
    }

    const finalKey = nameKey(finalName);
    if (!ctx.db.claimedName.nameKey.find(finalKey)) {
      ctx.db.claimedName.insert({ nameKey: finalKey, identity });
    }
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
      return {
        unlockedLevel: progress.unlockedLevel,
        coins: shop.coins,
        equippedShip: shop.equippedShip,
        ownedShipsCsv: ships.join(','),
        language: player?.language || 'en',
        totalScore: progress.totalScore,
        legacyImported: !!txCtx.db.playerLegacyImport.identity.find(identity),
      };
    });
  }
);
