/**
 * Weltraum-Mission SpacetimeDB Module
 * Stage Zero: Anonymous identity, progress sync, level gating, error tracking
 */

import { schema, table, t } from 'spacetimedb/server';

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
    { public: true },
    {
      level: t.u32().primaryKey(),
      minUnlockedLevel: t.u32(),
      dataJson: t.string(),
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

export const init = spacetimedb.init(ctx => {
  ctx.db.serverConfig.insert({ key: 'version', value: '1.0.0' });
  ctx.db.serverConfig.insert({ key: 'maxLevel', value: String(MAX_LEVEL) });
  console.info('Weltraum-Mission module initialized');
});

export const onConnect = spacetimedb.clientConnected(ctx => {
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
      throw new Error('Cannot reduce unlocked level');
    }
    if (newUnlocked > serverUnlocked + 1) {
      throw new Error('Cannot skip levels');
    }
    
    ctx.db.playerProgress.identity.update({
      ...progress,
      unlockedLevel: newUnlocked,
    });
    
    const shop = ctx.db.playerShop.identity.find(identity);
    if (shop) {
      const clampedCoins = data.coins > BigInt(MAX_COINS) ? BigInt(MAX_COINS) : data.coins;
      const equip = validateShip(data.equippedShip) ? data.equippedShip : shop.equippedShip;
      ctx.db.playerShop.identity.update({
        ...shop,
        coins: clampedCoins,
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
    
    const maxCoins = BigInt(result.level * 5000);
    if (result.coinsEarned > maxCoins) {
      throw new Error('Coins exceed maximum for this level');
    }
    
    const minTime = BigInt(10000);
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
