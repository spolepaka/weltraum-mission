/**
 * SpacetimeDB Client Integration
 * Handles connection, authentication, and data sync with real SDK
 */

import {
  DbConnection,
  type SubscriptionHandle,
} from './module_bindings';
import type { Identity } from 'spacetimedb';
import { validateLevelResult, type LevelResultInput } from './validation';
import { mergeCoins, coinDeltaToPush } from './coin-ledger';
import {
  loadAuthUser,
  loadGuestToken,
  saveGuestToken,
  type ProgressSnapshot,
} from './firebase-auth';

export type SyncStatus = 'connected' | 'connecting' | 'disconnected' | 'syncing' | 'error' | 'offline';

export interface PlayerData {
  identity: string;
  unlockedLevel: number;
  totalScore: bigint;
  coins: bigint;
  equippedShip: string;
  ownedShips: string[];
  upgrades: Record<string, number>;
  stars: Record<number, { stars: number; bestScore: bigint }>;
  achievements: string[];
  settings: {
    muted: boolean;
    twoPlayerMode: boolean;
    ghostMode: boolean;
  };
  language: string;
  signedIn?: boolean;
}

interface SpacetimeConfig {
  host: string;
  moduleName: string;
  ssl: boolean;
}

const MAINCLOUD_CONFIG: SpacetimeConfig = {
  host: 'maincloud.spacetimedb.com',
  moduleName: 'weltraum-mission',
  ssl: true,
};

const LOCAL_DEV_CONFIG: SpacetimeConfig = {
  host: 'localhost:3000',
  moduleName: 'weltraum-dev',
  ssl: false,
};

const IDENTITY_STORAGE_KEY = 'spaceMissionIdentityToken';
const LOCAL_CACHE_KEY = 'spaceMissionCachedData';

class SpacetimeClient {
  private config: SpacetimeConfig;
  private status: SyncStatus = 'disconnected';
  private statusListeners: Array<(status: SyncStatus) => void> = [];
  private connection: DbConnection | null = null;
  private identity: Identity | null = null;
  private identityToken: string | null = null;
  private subscriptionHandle: SubscriptionHandle | null = null;
  private localCache: PlayerData | null = null;
  private pendingReducerCalls: Array<() => Promise<void>> = [];
  private dataListeners: Array<(data: PlayerData) => void> = [];
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectWaiters: Array<(ok: boolean) => void> = [];
  private silentReconnect = false;
  lastError: string | null = null;

  constructor(config: Partial<SpacetimeConfig> = {}) {
    this.config = this.resolveConfig(config);
    this.loadIdentityToken();
    this.loadLocalData();
  }

  getConfig(): SpacetimeConfig {
    return { ...this.config };
  }

  private resolveConfig(override: Partial<SpacetimeConfig>): SpacetimeConfig {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = this.configFromSearchParams(params);
      if (fromQuery) {
        return { ...fromQuery, ...override };
      }
    }

    const fromEnv = this.configFromEnv();
    if (fromEnv) {
      return { ...fromEnv, ...override };
    }

    return { ...MAINCLOUD_CONFIG, ...override };
  }

  private configFromSearchParams(params: URLSearchParams): SpacetimeConfig | null {
    const server = params.get('server');
    const hostParam = params.get('stdb_host');
    const moduleParam = params.get('stdb_module') || params.get('module');
    const sslParam = params.get('stdb_ssl');

    if (server) {
      try {
        const url = new URL(server);
        const ssl = url.protocol === 'https:' || url.protocol === 'wss:';
        return {
          host: url.host,
          moduleName: moduleParam || MAINCLOUD_CONFIG.moduleName,
          ssl,
        };
      } catch {
        return null;
      }
    }

    if (hostParam || moduleParam) {
      const host = hostParam || LOCAL_DEV_CONFIG.host;
      return {
        host,
        moduleName: moduleParam || (host.includes('spacetimedb.com') ? MAINCLOUD_CONFIG.moduleName : LOCAL_DEV_CONFIG.moduleName),
        ssl: sslParam === 'true' || (sslParam !== 'false' && host.includes('spacetimedb.com')),
      };
    }

    return null;
  }

  private configFromEnv(): SpacetimeConfig | null {
    let host: string | undefined;
    let moduleName: string | undefined;
    let sslRaw: string | undefined;

    try {
      const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
      host = viteEnv?.VITE_STDB_HOST || viteEnv?.STDB_HOST;
      moduleName = viteEnv?.VITE_STDB_MODULE || viteEnv?.STDB_MODULE;
      sslRaw = viteEnv?.VITE_STDB_SSL || viteEnv?.STDB_SSL;
    } catch {
      // not a Vite runtime
    }

    if (!host && typeof globalThis !== 'undefined' && 'process' in globalThis) {
      const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
      host = nodeProcess?.env?.VITE_STDB_HOST || nodeProcess?.env?.STDB_HOST;
      moduleName = nodeProcess?.env?.VITE_STDB_MODULE || nodeProcess?.env?.STDB_MODULE;
      sslRaw = nodeProcess?.env?.VITE_STDB_SSL || nodeProcess?.env?.STDB_SSL;
    }

    if (!host && !moduleName) return null;
    const resolvedHost = host || MAINCLOUD_CONFIG.host;
    return {
      host: resolvedHost,
      moduleName: moduleName || (resolvedHost.includes('spacetimedb.com') ? MAINCLOUD_CONFIG.moduleName : LOCAL_DEV_CONFIG.moduleName),
      ssl: sslRaw === 'true' || (sslRaw !== 'false' && resolvedHost.includes('spacetimedb.com')),
    };
  }

  private loadIdentityToken(): void {
    try {
      this.identityToken = localStorage.getItem(IDENTITY_STORAGE_KEY);
    } catch {
      this.identityToken = null;
    }
  }

  private saveIdentityToken(token: string): void {
    this.identityToken = token;
    try {
      localStorage.setItem(IDENTITY_STORAGE_KEY, token);
    } catch {
      // Ignore storage errors
    }
  }

  private setStatus(status: SyncStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusListeners.forEach(fn => fn(status));
    }
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(fn => fn !== callback);
    };
  }

  onDataChange(callback: (data: PlayerData) => void): () => void {
    this.dataListeners.push(callback);
    if (this.localCache) {
      callback(this.localCache);
    }
    return () => {
      this.dataListeners = this.dataListeners.filter(fn => fn !== callback);
    };
  }

  isConnected(): boolean {
    return this.connection !== null && this.status === 'connected';
  }

  hasActiveSubscription(): boolean {
    return this.subscriptionHandle !== null;
  }

  getIdentity(): Identity | null {
    return this.identity;
  }

  getIdentityHex(): string | null {
    return this.identity?.toHexString() ?? null;
  }

  private getWsUrl(): string {
    const protocol = this.config.ssl ? 'wss' : 'ws';
    return `${protocol}://${this.config.host}`;
  }

  private flushConnectWaiters(ok: boolean): void {
    const waiters = this.connectWaiters.splice(0);
    waiters.forEach(fn => fn(ok));
  }

  async connect(): Promise<boolean> {
    if (this.connection && this.status === 'connected') {
      return true;
    }

    if (this.connection && (this.status === 'connecting' || this.status === 'disconnected')) {
      return new Promise(resolve => this.connectWaiters.push(resolve));
    }

    this.setStatus('connecting');

    return new Promise(resolve => {
      this.connectWaiters.push(resolve);

      try {
        const builder = DbConnection.builder()
          .withUri(this.getWsUrl())
          .withDatabaseName(this.config.moduleName)
          .withCompression('gzip')
          .onConnect((conn, identity, token) => {
            console.log('[SpacetimeDB] Connected with identity:', identity.toHexString());
            this.identity = identity;
            if (loadAuthUser()) {
              this.identityToken = token;
            } else {
              this.saveIdentityToken(token);
              saveGuestToken(token);
            }
            this.reconnectAttempts = 0;
            this.setStatus('connected');

            this.setupSubscriptions(conn);
            this.flushPendingReducerCalls();
            void this.reconcileWithServer();
            this.flushConnectWaiters(true);
          })
          .onConnectError((_ctx, error) => {
            console.error('[SpacetimeDB] Connection error:', error);
            this.setStatus('error');
            this.flushConnectWaiters(false);
            if (!this.silentReconnect) this.scheduleReconnect();
          })
          .onDisconnect((_ctx, error) => {
            console.log('[SpacetimeDB] Disconnected', error ? `with error: ${error.message}` : '');
            this.setStatus('disconnected');
            this.connection = null;
            this.subscriptionHandle = null;
            if (!this.silentReconnect && !this.isReconnecting) {
              this.scheduleReconnect();
            }
          });

        const firebase = loadAuthUser();
        const token = firebase?.idToken || this.identityToken;
        if (token && token.length > 8) {
          builder.withToken(token);
        }

        this.connection = builder.build();
      } catch (error) {
        console.error('[SpacetimeDB] Failed to build connection:', error);
        this.setStatus('error');
        this.flushConnectWaiters(false);
      }
    });
  }

  async waitUntilConnected(timeoutMs = 15000): Promise<boolean> {
    if (this.isConnected()) return true;
    const started = Date.now();
    if (!this.connection) {
      const ok = await this.connect();
      if (ok) return true;
    }
    return new Promise(resolve => {
      const check = () => {
        if (this.isConnected()) {
          resolve(true);
          return;
        }
        if (Date.now() - started > timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }

  private setupSubscriptions(conn: DbConnection): void {
    conn.db.levelData.onInsert((_ctx, row) => {
      console.log('[SpacetimeDB] Level data received:', row.level);
    });

    this.subscriptionHandle = conn.subscriptionBuilder()
      .onApplied(() => {
        console.log('[SpacetimeDB] Subscription applied');
        this.syncFromServer();
      })
      .onError((ctx) => {
        console.error('[SpacetimeDB] Subscription error:', ctx.event);
      })
      .subscribe([
        'SELECT * FROM level_data',
        'SELECT * FROM server_config',
      ]);
  }

  private syncFromServer(): void {
    // Level data and server config are the only public tables
    // Player data comes through reducer responses and needs to be stored locally
    // The server marks private tables, so we can't query them directly
    // Instead, the game state is maintained locally and synced via reducers
    this.notifyDataListeners();
  }

  private notifyDataListeners(): void {
    if (this.localCache) {
      this.dataListeners.forEach(fn => fn(this.localCache!));
    }
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('[SpacetimeDB] Max reconnect attempts reached, going offline');
        this.setStatus('offline');
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[SpacetimeDB] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      this.isReconnecting = false;
      await this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
      this.subscriptionHandle = null;
    }
    this.setStatus('disconnected');
  }

  private async flushPendingReducerCalls(): Promise<void> {
    if (this.pendingReducerCalls.length === 0) return;

    console.log(`[SpacetimeDB] Flushing ${this.pendingReducerCalls.length} pending reducer calls`);
    const calls = [...this.pendingReducerCalls];
    this.pendingReducerCalls = [];

    for (const call of calls) {
      try {
        await call();
      } catch (error) {
        console.error('[SpacetimeDB] Pending reducer call failed:', error);
      }
    }
  }

  private queueOrCallReducer(fn: () => void | Promise<void>): Promise<void> {
    if (this.isConnected() && this.connection) {
      return Promise.resolve(fn());
    }
    return new Promise((resolve, reject) => {
      this.pendingReducerCalls.push(async () => {
        try {
          await fn();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  loadLocalData(): PlayerData | null {
    if (this.localCache) return this.localCache;

    try {
      const data = localStorage.getItem(LOCAL_CACHE_KEY);
      if (data) {
        this.localCache = JSON.parse(data, (_key, value) => {
          if (typeof value === 'string' && /^\d+n$/.test(value)) {
            return BigInt(value.slice(0, -1));
          }
          return value;
        });
        return this.localCache;
      }
    } catch {
      // Ignore parse errors
    }
    return this.getDefaultPlayerData();
  }

  private getDefaultPlayerData(): PlayerData {
    return {
      identity: '',
      unlockedLevel: 1,
      totalScore: BigInt(0),
      coins: BigInt(0),
      equippedShip: 'starter',
      ownedShips: ['starter'],
      upgrades: {},
      stars: {},
      achievements: [],
      settings: {
        muted: false,
        twoPlayerMode: false,
        ghostMode: false,
      },
      language: 'en',
    };
  }

  saveLocalData(data: PlayerData): void {
    this.localCache = data;
    try {
      const serialized = JSON.stringify(data, (_key, value) => {
        if (typeof value === 'bigint') {
          return value.toString() + 'n';
        }
        return value;
      });
      localStorage.setItem(LOCAL_CACHE_KEY, serialized);
      this.notifyDataListeners();
    } catch {
      // Ignore storage errors
    }
  }

  getLocalData(): PlayerData {
    return this.localCache || this.getDefaultPlayerData();
  }

  hasIdentity(): boolean {
    return this.identityToken !== null;
  }

  getIdentityToken(): string | null {
    return this.identityToken;
  }

  // Reducer wrappers
  setLanguage(language: string): void {
    console.log('[SpacetimeDB] setLanguage:', language);
    const data = this.getLocalData();
    data.language = language;
    this.saveLocalData(data);

    this.queueOrCallReducer(() => {
      this.connection?.reducers.setLanguage({ language });
    });
  }

  syncProgress(unlockedLevel: number, coins: bigint, equippedShip: string): void {
    console.log('[SpacetimeDB] syncProgress:', { unlockedLevel, coins, equippedShip });
    this.queueOrCallReducer(() => {
      this.connection?.reducers.syncProgress({ unlockedLevel, coins: BigInt(coins), equippedShip });
    });
  }

  async completeLevelResult(result: LevelResultInput): Promise<{ ok: boolean; reason?: string }> {
    console.log('[SpacetimeDB] completeLevelResult:', result);
    this.lastError = null;

    const data = this.getLocalData();
    const localCheck = validateLevelResult(result, data.unlockedLevel);
    if (!localCheck.ok) {
      this.lastError = localCheck.reason;
      console.warn('[SpacetimeDB] completeLevelResult rejected locally:', localCheck.reason);
    } else {
      const existingStars = data.stars[result.level];
      if (!existingStars || result.stars > existingStars.stars ||
          (result.stars === existingStars.stars && result.score > existingStars.bestScore)) {
        data.stars[result.level] = { stars: result.stars, bestScore: result.score };
      }
      data.totalScore += result.score;
      // Coins stay with the game shop (already includes collected + bonus).
      // Adding coinsEarned here double-counted and later overwrote the shop.
      if (result.level >= data.unlockedLevel) {
        data.unlockedLevel = result.level + 1;
      }
      this.saveLocalData(data);
    }

    if (!this.connection) {
      return localCheck.ok ? { ok: true } : { ok: false, reason: localCheck.reason };
    }

    this.setStatus('syncing');
    try {
      await this.connection.reducers.completeLevelResult({
        level: result.level,
        stars: result.stars,
        score: BigInt(result.score),
        coinsEarned: BigInt(result.coinsEarned),
        timeMs: BigInt(result.timeMs),
        heartsLeft: result.heartsLeft,
      });
      this.setStatus('connected');
      return localCheck.ok ? { ok: true } : { ok: false, reason: localCheck.reason };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.lastError = reason;
      this.setStatus('connected');
      console.warn('[SpacetimeDB] completeLevelResult rejected by server:', reason);
      return { ok: false, reason };
    }
  }

  requestLevelData(level: number): boolean {
    console.log('[SpacetimeDB] requestLevelData:', level);
    const data = this.getLocalData();
    if (level > data.unlockedLevel) {
      console.warn('[SpacetimeDB] Level not unlocked:', level, 'max:', data.unlockedLevel);
      this.lastError = 'level_locked';
      return false;
    }

    this.queueOrCallReducer(() => {
      this.connection?.reducers.requestLevelData({ level });
    });
    return true;
  }

  async fetchLevelData(level: number): Promise<{ level: number; dataJson: string } | null> {
    console.log('[SpacetimeDB] fetchLevelData (procedure):', level);
    this.lastError = null;

    if (!this.connection || !this.isConnected()) {
      const data = this.getLocalData();
      if (level > data.unlockedLevel) {
        this.lastError = 'level_locked';
        return null;
      }
      return null;
    }

    try {
      const result = await this.connection.procedures.getLevelData({ level });
      if (result) {
        return { level: result.level, dataJson: result.dataJson };
      }
      this.lastError = 'level_locked_or_missing';
      return null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error('[SpacetimeDB] fetchLevelData error:', error);
      return null;
    }
  }

  getLevelDataFromCache(level: number): object | null {
    if (!this.connection) return null;
    const rows = [...this.connection.db.levelData.iter()];
    const row = rows.find(r => r.level === level);
    if (row) {
      try {
        return JSON.parse(row.dataJson);
      } catch {
        return null;
      }
    }
    return null;
  }

  purchaseShip(shipId: string, price: bigint): boolean {
    console.log('[SpacetimeDB] purchaseShip:', shipId, price);
    const data = this.getLocalData();
    if (data.coins < price) {
      return false;
    }
    if (data.ownedShips.includes(shipId)) {
      return false;
    }
    data.coins -= price;
    data.ownedShips.push(shipId);
    this.saveLocalData(data);

    this.queueOrCallReducer(() => {
      this.connection?.reducers.purchaseShip({ shipId, price: BigInt(price) });
    });
    return true;
  }

  equipShip(shipId: string): void {
    console.log('[SpacetimeDB] equipShip:', shipId);
    const data = this.getLocalData();
    if (!data.ownedShips.includes(shipId)) {
      console.warn('[SpacetimeDB] Ship not owned:', shipId);
      return;
    }
    data.equippedShip = shipId;
    this.saveLocalData(data);

    this.queueOrCallReducer(() => {
      this.connection?.reducers.equipShip({ shipId });
    });
  }

  purchaseUpgrade(upgradeId: string, price: bigint): boolean {
    console.log('[SpacetimeDB] purchaseUpgrade:', upgradeId, price);
    const data = this.getLocalData();
    if (data.coins < price) {
      return false;
    }
    const currentLevel = data.upgrades[upgradeId] || 0;
    if (currentLevel >= 5) {
      return false;
    }
    data.coins -= price;
    data.upgrades[upgradeId] = currentLevel + 1;
    this.saveLocalData(data);

    this.queueOrCallReducer(() => {
      this.connection?.reducers.purchaseUpgrade({ upgradeId, price: BigInt(price) });
    });
    return true;
  }

  applySecretCode(code: string): { success: boolean; message: string } {
    console.log('[SpacetimeDB] applySecretCode:', code);
    this.queueOrCallReducer(() => {
      this.connection?.reducers.applySecretCode({ code });
    });
    return { success: true, message: 'Code submitted for validation' };
  }

  unlockAchievement(achievementId: string): void {
    console.log('[SpacetimeDB] unlockAchievement:', achievementId);
    const data = this.getLocalData();
    if (!data.achievements.includes(achievementId)) {
      data.achievements.push(achievementId);
      this.saveLocalData(data);
    }

    this.queueOrCallReducer(() => {
      this.connection?.reducers.unlockAchievement({ achievementId });
    });
  }

  updateSettings(settings: Partial<{
    muted: boolean;
    twoPlayerMode: boolean;
    ghostMode: boolean;
  }>): void {
    console.log('[SpacetimeDB] updateSettings:', settings);
    const data = this.getLocalData();
    data.settings = { ...data.settings, ...settings };
    this.saveLocalData(data);

    this.queueOrCallReducer(() => {
      this.connection?.reducers.updateSettings({
        muted: settings.muted,
        twoPlayerMode: settings.twoPlayerMode,
        ghostMode: settings.ghostMode,
      });
    });
  }

  reportError(error: {
    errorType: string;
    message: string;
    stack?: string;
    context?: string;
  }): void {
    console.log('[SpacetimeDB] reportError:', error);
    this.queueOrCallReducer(() => {
      this.connection?.reducers.reportError({
        errorType: error.errorType,
        message: error.message,
        stack: error.stack,
        context: error.context,
      });
    });
  }

  resetProgress(): void {
    console.log('[SpacetimeDB] resetProgress');
    this.localCache = this.getDefaultPlayerData();
    this.saveLocalData(this.localCache);

    this.queueOrCallReducer(() => {
      this.connection?.reducers.resetProgress({});
    });
  }

  syncLevelStars(level: number, stars: number, bestScore: bigint): void {
    console.log('[SpacetimeDB] syncLevelStars:', { level, stars, bestScore });
    this.queueOrCallReducer(() => {
      this.connection?.reducers.syncLevelStars({ level, stars, bestScore: BigInt(bestScore) });
    });
  }

  addOwnedShip(shipId: string): void {
    console.log('[SpacetimeDB] addOwnedShip:', shipId);
    const data = this.getLocalData();
    if (!data.ownedShips.includes(shipId)) {
      data.ownedShips.push(shipId);
      this.saveLocalData(data);
    }

    this.queueOrCallReducer(() => {
      this.connection?.reducers.addOwnedShip({ shipId });
    });
  }

  addCoins(amount: bigint): void {
    if (amount <= 0n) return;
    const data = this.getLocalData();
    data.coins = data.coins + amount;
    this.saveLocalData(data);
    this.queueOrCallReducer(() => {
      this.connection?.reducers.addCoins({ amount: BigInt(amount) });
    });
  }

  importProgress(snapshot: ProgressSnapshot): void {
    const data = this.getLocalData();
    data.unlockedLevel = Math.max(data.unlockedLevel, snapshot.unlockedLevel || 1);
    data.coins = mergeCoins(data.coins, snapshot.coins);
    data.equippedShip = snapshot.equippedShip || data.equippedShip;
    data.ownedShips = Array.from(new Set([...(data.ownedShips || []), ...(snapshot.ownedShips || [])]));
    data.upgrades = { ...data.upgrades, ...snapshot.upgrades };
    data.language = snapshot.language || data.language;
    this.saveLocalData(data);

    this.queueOrCallReducer(() => {
      this.connection?.reducers.importProgress({
        unlockedLevel: snapshot.unlockedLevel,
        coins: BigInt(snapshot.coins),
        equippedShip: snapshot.equippedShip || 'starter',
        ownedShipsCsv: (snapshot.ownedShips || ['starter']).join(','),
        upgradesJson: JSON.stringify(snapshot.upgrades || {}),
        starsJson: JSON.stringify(snapshot.stars || {}),
        language: snapshot.language || 'en',
      });
    });
  }

  async fetchMyProgress(): Promise<{
    unlockedLevel: number;
    coins: bigint;
    equippedShip: string;
    ownedShips: string[];
    language: string;
    totalScore: bigint;
  } | null> {
    if (!this.connection || !this.isConnected()) return null;
    try {
      const result = await this.connection.procedures.getMyProgress({});
      if (!result) return null;
      return {
        unlockedLevel: result.unlockedLevel,
        coins: BigInt(result.coins),
        equippedShip: result.equippedShip,
        ownedShips: result.ownedShipsCsv ? result.ownedShipsCsv.split(',').filter(Boolean) : ['starter'],
        language: result.language,
        totalScore: BigInt(result.totalScore),
      };
    } catch (error) {
      console.warn('[SpacetimeDB] getMyProgress failed:', error);
      return null;
    }
  }

  async reconcileWithServer(): Promise<void> {
    const remote = await this.fetchMyProgress();
    if (!remote) return;
    const local = this.getLocalData();
    const mergedCoins = mergeCoins(local.coins, remote.coins);
    const delta = coinDeltaToPush(local.coins, remote.coins);
    local.coins = mergedCoins;
    local.unlockedLevel = Math.max(local.unlockedLevel, remote.unlockedLevel);
    if (remote.equippedShip) local.equippedShip = local.equippedShip || remote.equippedShip;
    local.ownedShips = Array.from(new Set([...(local.ownedShips || []), ...remote.ownedShips]));
    this.saveLocalData(local);
    if (delta > 0n) {
      this.queueOrCallReducer(() => {
        this.connection?.reducers.addCoins({ amount: delta });
      });
    }
    this.notifyDataListeners();
  }

  isSignedIn(): boolean {
    return !!loadAuthUser();
  }

  /** Token that `.withToken()` will send on the next connect. */
  connectToken(): string | null {
    return loadAuthUser()?.idToken || this.identityToken;
  }

  shortPlayerId(): string {
    const hex = this.getIdentityHex();
    if (!hex) return '----';
    return hex.replace(/^0x/i, '').slice(0, 8).toUpperCase();
  }

  async reconnectWithToken(token: string, opts?: { replaceGuest?: boolean }): Promise<boolean> {
    this.silentReconnect = true;
    try {
      if (opts?.replaceGuest) {
        this.saveIdentityToken(token);
      } else {
        this.identityToken = token;
      }
      this.disconnect();
      this.reconnectAttempts = 0;
      return await this.connect();
    } finally {
      this.silentReconnect = false;
    }
  }

  restoreGuestIdentity(): Promise<boolean> {
    const guest = loadGuestToken();
    if (guest) {
      return this.reconnectWithToken(guest, { replaceGuest: true });
    }
    this.silentReconnect = true;
    try {
      this.identityToken = null;
      try { localStorage.removeItem(IDENTITY_STORAGE_KEY); } catch { /* ignore */ }
      this.disconnect();
      this.reconnectAttempts = 0;
      return this.connect();
    } finally {
      this.silentReconnect = false;
    }
  }

  setUpgradeLevel(upgradeId: string, level: number): void {
    console.log('[SpacetimeDB] setUpgradeLevel:', { upgradeId, level });
    const data = this.getLocalData();
    data.upgrades[upgradeId] = level;
    this.saveLocalData(data);

    this.queueOrCallReducer(() => {
      this.connection?.reducers.setUpgradeLevel({ upgradeId, level });
    });
  }
}

// Singleton instance
let clientInstance: SpacetimeClient | null = null;

export function getSpacetimeClient(config?: Partial<SpacetimeConfig>): SpacetimeClient {
  if (!clientInstance) {
    clientInstance = new SpacetimeClient(config);
  }
  return clientInstance;
}

export function initSpacetime(config?: Partial<SpacetimeConfig>): Promise<boolean> {
  const client = getSpacetimeClient(config);
  return client.connect();
}

export function resetSpacetimeClient(): void {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }
}

export { SpacetimeClient, type SpacetimeConfig };
