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
import { clampLevelCoins, maxCoinsForLevel, MAX_LEVEL, SHIP_PRICES } from './economy';
import { salePrice } from './shop-ships';
import {
  applyPublicRoomEvent,
  filterJoinableRooms,
  pruneStaleRooms,
  publicRoomFromServer,
  type PublicRoomRow,
} from './room-list';
import {
  applyVersusQueueEvent,
  listOpenVersus,
  listQuickQueue,
  versusRowFromServer,
  type VersusQueueRow,
} from './versus-queue';
import { isAutomatedClient } from './geo-privacy';
import {
  loadAuthUser,
  loadGuestToken,
  saveGuestToken,
  type ProgressSnapshot,
} from './firebase-auth';
import { IDENTITY_STORAGE_KEY, LOCAL_CACHE_KEY } from './player-session';

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

export type RemoteProgress = {
  unlockedLevel: number;
  coins: bigint;
  equippedShip: string;
  ownedShips: string[];
  language: string;
  totalScore: bigint;
  legacyImported: boolean;
  displayName: string;
  nameKind: 'generated' | 'custom';
  onboardDone: boolean;
  upgrades: Record<string, number>;
  achievements: string[];
  stars: Record<string, number>;
};

class SpacetimeClient {
  private config: SpacetimeConfig;
  private status: SyncStatus = 'disconnected';
  private statusListeners: Array<(status: SyncStatus) => void> = [];
  private connection: DbConnection | null = null;
  private identity: Identity | null = null;
  private identityToken: string | null = null;
  private subscriptionHandle: SubscriptionHandle | null = null;
  private roomSubscriptionHandle: SubscriptionHandle | null = null;
  private versusSubscriptionHandle: SubscriptionHandle | null = null;
  private publicRooms = new Map<string, PublicRoomRow>();
  private publicRoomListeners: Array<(rows: PublicRoomRow[]) => void> = [];
  private livePublicRooms = false;
  private roomPollTimer: ReturnType<typeof setInterval> | null = null;
  private roomCallbacksBound = false;
  private versusQueue = new Map<string, VersusQueueRow>();
  private versusListeners: Array<(rows: VersusQueueRow[]) => void> = [];
  private liveVersusQueue = false;
  private versusCallbacksBound = false;
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
  private onlineActivity = 'menu';
  private onlineDisplayName = 'Pilot';
  private lastServerUnlock: number | null = null;
  private lastLegacyImported = false;

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

  private shouldRefuseProductionTests(): boolean {
    if (this.config.host.includes('localhost') || this.config.host.includes('127.0.0.1')) return false;
    if (typeof process !== 'undefined' && process.env?.E2E_ALLOW_PRODUCTION === '1') return false;
    return isAutomatedClient() && this.config.host.includes('spacetimedb.com');
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

    if (this.shouldRefuseProductionTests()) {
      this.setStatus('offline');
      return false;
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
            this.roomSubscriptionHandle = null;
            this.livePublicRooms = false;
            this.roomCallbacksBound = false;
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
    this.subscriptionHandle = conn.subscriptionBuilder()
      .onApplied(() => {
        console.log('[SpacetimeDB] Subscription applied');
        this.syncFromServer();
      })
      .onError((ctx) => {
        console.error('[SpacetimeDB] Subscription error:', ctx.event);
      })
      .subscribe([
        'SELECT * FROM server_config',
      ]);

    // Separate handle so a pre-republish private public_room table cannot
    // take down the server_config subscription.
    this.roomSubscriptionHandle = conn.subscriptionBuilder()
      .onApplied(() => {
        console.log('[SpacetimeDB] public_room subscription applied');
        this.livePublicRooms = true;
        this.bindPublicRoomCallbacks(conn);
        this.seedPublicRoomsFromTable(conn);
      })
      .onError((ctx) => {
        console.warn('[SpacetimeDB] public_room subscribe failed; polling listPublicRooms', ctx.event);
        this.livePublicRooms = false;
        this.startRoomPoll();
      })
      .subscribe([
        'SELECT * FROM public_room',
      ]);

    this.bindPublicRoomCallbacks(conn);
    if (this.publicRoomListeners.length) this.startRoomPoll();

    this.versusSubscriptionHandle = conn.subscriptionBuilder()
      .onApplied(() => {
        console.log('[SpacetimeDB] versus_queue subscription applied');
        this.liveVersusQueue = true;
        this.bindVersusQueueCallbacks(conn);
        this.seedVersusQueueFromTable(conn);
      })
      .onError((ctx) => {
        console.warn('[SpacetimeDB] versus_queue subscribe failed (module republish needed)', ctx.event);
        this.liveVersusQueue = false;
      })
      .subscribe([
        'SELECT * FROM versus_queue',
      ]);
    this.bindVersusQueueCallbacks(conn);
  }

  private publicRoomTable(conn: DbConnection | null = this.connection): {
    onInsert: (cb: (ctx: unknown, row: Record<string, unknown>) => void) => void;
    onUpdate: (cb: (ctx: unknown, oldRow: Record<string, unknown>, row: Record<string, unknown>) => void) => void;
    onDelete: (cb: (ctx: unknown, row: Record<string, unknown>) => void) => void;
    iter: () => Iterable<Record<string, unknown>>;
  } | null {
    const table = (conn?.db as { publicRoom?: {
      onInsert: (cb: (ctx: unknown, row: Record<string, unknown>) => void) => void;
      onUpdate: (cb: (ctx: unknown, oldRow: Record<string, unknown>, row: Record<string, unknown>) => void) => void;
      onDelete: (cb: (ctx: unknown, row: Record<string, unknown>) => void) => void;
      iter: () => Iterable<Record<string, unknown>>;
    } } | undefined)?.publicRoom;
    return table || null;
  }

  private bindPublicRoomCallbacks(conn: DbConnection): void {
    if (this.roomCallbacksBound) return;
    const table = this.publicRoomTable(conn);
    if (!table) return;
    this.roomCallbacksBound = true;
    table.onInsert((_ctx, row) => {
      applyPublicRoomEvent(this.publicRooms, { type: 'insert', row: publicRoomFromServer(row) });
      this.notifyPublicRooms();
    });
    table.onUpdate((_ctx, _old, row) => {
      applyPublicRoomEvent(this.publicRooms, { type: 'update', row: publicRoomFromServer(row) });
      this.notifyPublicRooms();
    });
    table.onDelete((_ctx, row) => {
      applyPublicRoomEvent(this.publicRooms, { type: 'delete', code: String(row.code || '') });
      this.notifyPublicRooms();
    });
  }

  private seedPublicRoomsFromTable(conn: DbConnection): void {
    const table = this.publicRoomTable(conn);
    if (!table) return;
    this.publicRooms.clear();
    for (const row of table.iter()) {
      applyPublicRoomEvent(this.publicRooms, { type: 'insert', row: publicRoomFromServer(row) });
    }
    this.notifyPublicRooms();
  }

  private notifyPublicRooms(): void {
    const rows = this.getPublicRooms();
    this.publicRoomListeners.forEach(fn => fn(rows));
  }

  getPublicRooms(): PublicRoomRow[] {
    return pruneStaleRooms(this.publicRooms);
  }

  hasLivePublicRooms(): boolean {
    return this.livePublicRooms;
  }

  onPublicRooms(callback: (rows: PublicRoomRow[]) => void): () => void {
    this.publicRoomListeners.push(callback);
    callback(this.getPublicRooms());
    this.startRoomPoll();
    return () => {
      this.publicRoomListeners = this.publicRoomListeners.filter(fn => fn !== callback);
      if (!this.publicRoomListeners.length) this.stopRoomPoll();
    };
  }

  private startRoomPoll(): void {
    if (this.roomPollTimer) return;
    void this.refreshPublicRoomsFromProcedure();
    let ticks = 0;
    this.roomPollTimer = setInterval(() => {
      ticks += 1;
      if (!this.livePublicRooms) {
        void this.refreshPublicRoomsFromProcedure();
        return;
      }
      this.notifyPublicRooms();
      if (ticks % 4 === 0) void this.fetchPublicRoomsProcedure();
    }, 1000);
  }

  private stopRoomPoll(): void {
    if (this.roomPollTimer) {
      clearInterval(this.roomPollTimer);
      this.roomPollTimer = null;
    }
  }

  private async refreshPublicRoomsFromProcedure(): Promise<PublicRoomRow[]> {
    const rows = await this.fetchPublicRoomsProcedure();
    if (!this.livePublicRooms) {
      this.publicRooms.clear();
      for (const row of rows) {
        applyPublicRoomEvent(this.publicRooms, { type: 'insert', row });
      }
      this.notifyPublicRooms();
    }
    return this.getPublicRooms();
  }

  private async fetchPublicRoomsProcedure(): Promise<PublicRoomRow[]> {
    if (!this.connection || !this.isConnected()) return [];
    try {
      const procedures = this.connection.procedures as { listPublicRooms?: (a: Record<string, never>) => Promise<{ roomsJson: string } | undefined> };
      const result = await procedures.listPublicRooms?.({});
      const parsed = JSON.parse(result?.roomsJson || '[]') as PublicRoomRow[];
      return filterJoinableRooms(Array.isArray(parsed) ? parsed : []);
    } catch {
      return [];
    }
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
      this.roomSubscriptionHandle = null;
      this.versusSubscriptionHandle = null;
      this.livePublicRooms = false;
      this.roomCallbacksBound = false;
      this.liveVersusQueue = false;
      this.versusCallbacksBound = false;
    }
    this.stopRoomPoll();
    this.setStatus('disconnected');
  }

  setOnlinePresence(activity: string, displayName: string): void {
    this.onlineActivity = activity || 'menu';
    this.onlineDisplayName = String(displayName || 'Pilot').trim().slice(0, 16) || 'Pilot';
  }

  heartbeatOnline(activity?: string, displayName?: string): void {
    if (activity) this.onlineActivity = activity;
    if (displayName) this.onlineDisplayName = String(displayName).trim().slice(0, 16) || this.onlineDisplayName;
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as { heartbeatOnline?: (a: { activity: string; displayName: string }) => void }).heartbeatOnline?.({
        activity: this.onlineActivity,
        displayName: this.onlineDisplayName,
      });
    });
  }

  async getOnlineNow(): Promise<{
    admin: boolean;
    total: number;
    menu: number;
    solo: number;
    coop: number;
    versus: number;
    people: Array<{ name: string; activity: string; since: string }>;
  } | null> {
    if (!this.connection) return null;
    try {
      const procedures = this.connection.procedures as {
        getOnlineNow?: (a: Record<string, never>) => Promise<{
          admin?: boolean;
          total?: number;
          menu?: number;
          solo?: number;
          coop?: number;
          versus?: number;
          peopleJson?: string;
        } | undefined>;
      };
      const result = await procedures.getOnlineNow?.({});
      if (!result) return null;
      let people: Array<{ name: string; activity: string; since: string }> = [];
      try {
        people = JSON.parse(result.peopleJson || '[]') as Array<{ name: string; activity: string; since: string }>;
      } catch {
        people = [];
      }
      return {
        admin: !!result.admin,
        total: result.total || 0,
        menu: result.menu || 0,
        solo: result.solo || 0,
        coop: result.coop || 0,
        versus: result.versus || 0,
        people: Array.isArray(people) ? people : [],
      };
    } catch {
      return null;
    }
  }

  async adminListRoles(): Promise<Array<{ email: string; owner: boolean; grantedBy: string; grantedAt: string }>> {
    if (!this.connection) return [];
    try {
      const procedures = this.connection.procedures as {
        adminListRoles?: (a: Record<string, never>) => Promise<{ rowsJson?: string } | undefined>;
      };
      const result = await procedures.adminListRoles?.({});
      if (!result?.rowsJson) return [];
      const rows = JSON.parse(result.rowsJson) as Array<{ email: string; owner?: boolean; grantedBy?: string; grantedAt?: string }>;
      return rows.map((row) => ({
        email: String(row.email || ''),
        owner: !!row.owner,
        grantedBy: String(row.grantedBy || ''),
        grantedAt: String(row.grantedAt || ''),
      }));
    } catch {
      return [];
    }
  }

  adminGrantRole(email: string): Promise<void> {
    return this.callAdmin(() => (this.connection?.reducers as { adminGrantRole?: (a: { email: string }) => unknown }).adminGrantRole?.({ email }));
  }

  adminRevokeRole(email: string): Promise<void> {
    return this.callAdmin(() => (this.connection?.reducers as { adminRevokeRole?: (a: { email: string }) => unknown }).adminRevokeRole?.({ email }));
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
    const capped = this.lastServerUnlock == null
      ? unlockedLevel
      : Math.min(unlockedLevel, this.lastServerUnlock + 1);
    console.log('[SpacetimeDB] syncProgress:', { unlockedLevel: capped, coins, equippedShip });
    this.queueOrCallReducer(() => {
      this.connection?.reducers.syncProgress({ unlockedLevel: capped, coins: BigInt(coins), equippedShip });
    });
  }

  async completeLevelResult(result: LevelResultInput): Promise<{ ok: boolean; reason?: string }> {
    console.log('[SpacetimeDB] completeLevelResult:', result);
    this.lastError = null;
    result = {
      ...result,
      coinsEarned: BigInt(clampLevelCoins(Number(result.coinsEarned), result.level, result.mode)),
    };

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
      const complete = this.connection.reducers.completeLevelResult as unknown as (a: {
        level: number; stars: number; score: bigint; coinsEarned: bigint; timeMs: bigint; heartsLeft: number; mode: string;
      }) => Promise<void>;
      await complete({
        level: result.level,
        stars: result.stars,
        score: BigInt(result.score),
        coinsEarned: BigInt(clampLevelCoins(Number(result.coinsEarned), result.level, result.mode)),
        timeMs: BigInt(result.timeMs),
        heartsLeft: result.heartsLeft,
        mode: result.mode || 'normal',
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
    const data = this.getLocalData();
    const allowed = data.unlockedLevel || 1;
    if (level > allowed) {
      this.lastError = 'level_locked';
      return false;
    }
    this.queueOrCallReducer(() => {
      this.connection?.reducers.requestLevelData({ level });
    });
    return true;
  }

  isOnline(): boolean {
    try {
      return typeof navigator === 'undefined' || navigator.onLine !== false;
    } catch {
      return true;
    }
  }

  async fetchLevelData(level: number): Promise<{ level: number; dataJson: string } | null> {
    this.lastError = null;

    if (!this.isConnected()) {
      await this.waitUntilConnected(8000);
    }

    const tryOnce = async (): Promise<{ level: number; dataJson: string } | null> => {
      if (!this.connection || !this.isConnected()) return null;
      const proc = this.connection.procedures.getLevelData as unknown as (a: {
        level: number;
      }) => Promise<{ level: number; dataJson: string } | undefined>;
      const result = await proc({ level });
      if (result) return { level: result.level, dataJson: result.dataJson };
      this.lastError = 'level_locked_or_missing';
      return null;
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const row = await Promise.race([
          tryOnce(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        if (row) return row;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
      }
      if (!this.isOnline()) break;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
    return null;
  }

  getLevelDataFromCache(level: number): object | null {
    if (!this.connection) return null;
    const db = this.connection.db as { levelData?: { iter: () => Iterable<{ level: number; dataJson: string }> } };
    const rows = [...(db.levelData?.iter() ?? [])];
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
    const catalog = salePrice(SHIP_PRICES, shipId);
    if (catalog === null) {
      return false;
    }
    const cost = BigInt(catalog);
    const data = this.getLocalData();
    if (data.coins < cost) {
      return false;
    }
    if (data.ownedShips.includes(shipId)) {
      return false;
    }
    data.coins -= cost;
    data.ownedShips.push(shipId);
    data.equippedShip = shipId;
    this.saveLocalData(data);

    this.queueOrCallReducer(() => {
      this.connection?.reducers.purchaseShip({ shipId, price: cost });
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

  setPlayerPrefs(difficulty: string, doNotTrack: boolean): void {
    this.queueOrCallReducer(() => {
      const reducers = this.connection?.reducers as { setPlayerPrefs?: (a: { difficulty: string; doNotTrack: boolean }) => void } | undefined;
      reducers?.setPlayerPrefs?.({ difficulty, doNotTrack });
    });
  }

  trackAnalytics(kind: string, level = 0, mode = 'normal'): void {
    this.queueOrCallReducer(() => {
      const reducers = this.connection?.reducers as { trackAnalytics?: (a: { kind: string; level: number; mode: string }) => void } | undefined;
      reducers?.trackAnalytics?.({ kind, level, mode });
    });
  }

  submitWeeklyScore(weekKey: string, score: number, mode: string, displayName: string): void {
    this.queueOrCallReducer(() => {
      const reducers = this.connection?.reducers as { submitWeeklyScore?: (a: { weekKey: string; score: bigint; mode: string; displayName: string }) => void } | undefined;
      reducers?.submitWeeklyScore?.({ weekKey, score: BigInt(Math.max(0, Math.floor(score))), mode, displayName });
    });
  }

  async fetchWeeklyBoard(weekKey: string): Promise<Array<{ name: string; score: string; mode: string; me: boolean }>> {
    try {
      const procedures = this.connection?.procedures as { getWeeklyBoard?: (a: { weekKey: string }) => Promise<{ weekKey: string; rowsJson: string } | undefined> } | undefined;
      const result = await procedures?.getWeeklyBoard?.({ weekKey });
      if (!result?.rowsJson) return [];
      return JSON.parse(result.rowsJson) as Array<{ name: string; score: string; mode: string; me: boolean }>;
    } catch {
      return [];
    }
  }

  async fetchAnalyticsFunnel(): Promise<Record<string, string>> {
    try {
      const procedures = this.connection?.procedures as { getAnalyticsFunnel?: () => Promise<{ dataJson: string } | undefined> } | undefined;
      const result = await procedures?.getAnalyticsFunnel?.();
      if (!result?.dataJson) return {};
      return JSON.parse(result.dataJson) as Record<string, string>;
    } catch {
      return {};
    }
  }

  setDisplayName(name: string, kind: 'generated' | 'custom'): boolean {
    this.queueOrCallReducer(() => {
      const reducers = this.connection?.reducers as { setDisplayName?: (args: { name: string; kind: string }) => void } | undefined;
      reducers?.setDisplayName?.({ name, kind });
    });
    return true;
  }

  async claimDisplayName(name: string, kind: 'generated' | 'custom'): Promise<{ ok: boolean; reason: string; name: string }> {
    try {
      const procedures = this.connection?.procedures as {
        claimDisplayName?: (a: { name: string; kind: string }) => Promise<{ ok: boolean; reason: string; name: string }>;
      } | undefined;
      const result = await procedures?.claimDisplayName?.({ name, kind });
      if (result) return { ok: !!result.ok, reason: result.reason || '', name: result.name || '' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/taken/i.test(msg)) return { ok: false, reason: 'taken', name: '' };
      if (/Invalid display name: (\w+)/.test(msg)) {
        return { ok: false, reason: RegExp.$1, name: '' };
      }
    }
    this.setDisplayName(name, kind);
    return { ok: true, reason: '', name };
  }

  setOnboardDone(done: boolean): void {
    this.queueOrCallReducer(() => {
      const reducers = this.connection?.reducers as { setOnboardDone?: (a: { done: boolean }) => void } | undefined;
      reducers?.setOnboardDone?.({ done });
    });
  }

  clearLocalPlayerCache(): void {
    this.localCache = this.getDefaultPlayerData();
    this.identityToken = null;
    this.lastServerUnlock = null;
    this.lastLegacyImported = false;
    try { localStorage.removeItem(LOCAL_CACHE_KEY); } catch { /* ignore */ }
    try { localStorage.removeItem(IDENTITY_STORAGE_KEY); } catch { /* ignore */ }
  }

  replaceWithServer(remote: RemoteProgress): void {
    const next = this.getDefaultPlayerData();
    next.identity = this.getIdentityHex() || '';
    next.unlockedLevel = remote.unlockedLevel;
    next.coins = remote.coins;
    next.equippedShip = remote.equippedShip || 'starter';
    next.ownedShips = remote.ownedShips.length ? remote.ownedShips : ['starter'];
    next.upgrades = { ...(remote.upgrades || {}) };
    next.achievements = [...(remote.achievements || [])];
    next.language = remote.language || next.language;
    next.totalScore = remote.totalScore;
    const stars: PlayerData['stars'] = {};
    for (const [level, value] of Object.entries(remote.stars || {})) {
      const n = parseInt(level, 10);
      if (!Number.isNaN(n)) stars[n] = { stars: Number(value) || 0, bestScore: 0n };
    }
    next.stars = stars;
    next.signedIn = this.isSignedIn();
    this.saveLocalData(next);
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
      (this.connection?.reducers as { claimUnlockShip?: (a: { shipId: string }) => void }).claimUnlockShip?.({ shipId });
    });
  }

  addCoins(amount: bigint): void {
    if (amount <= 0n) return;
    const cap = BigInt(maxCoinsForLevel(MAX_LEVEL, 'veteran'));
    const grant = amount > cap ? cap : amount;
    const data = this.getLocalData();
    data.coins = data.coins + grant;
    this.saveLocalData(data);
    this.queueOrCallReducer(() => {
      this.connection?.reducers.addCoins({ amount: BigInt(grant) });
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

  snapshotArgs(snapshot: ProgressSnapshot) {
    return {
      unlockedLevel: snapshot.unlockedLevel,
      coins: BigInt(snapshot.coins),
      equippedShip: snapshot.equippedShip || 'starter',
      ownedShipsCsv: (snapshot.ownedShips || ['starter']).join(','),
      upgradesJson: JSON.stringify(snapshot.upgrades || {}),
      starsJson: JSON.stringify(snapshot.stars || {}),
      language: snapshot.language || 'en',
    };
  }

  async legacyImport(snapshot: ProgressSnapshot): Promise<{ ok: boolean; reason?: string }> {
    this.lastError = null;
    const data = this.getLocalData();
    data.unlockedLevel = Math.max(data.unlockedLevel, snapshot.unlockedLevel || 1);
    data.coins = mergeCoins(data.coins, snapshot.coins);
    data.equippedShip = snapshot.equippedShip || data.equippedShip;
    data.ownedShips = Array.from(new Set([...(data.ownedShips || []), ...(snapshot.ownedShips || [])]));
    data.upgrades = { ...data.upgrades, ...snapshot.upgrades };
    data.language = snapshot.language || data.language;
    this.saveLocalData(data);

    try {
      if (!this.isConnected()) await this.waitUntilConnected(8000);
      const reducers = this.connection?.reducers as {
        legacyImport?: (a: ReturnType<SpacetimeClient['snapshotArgs']>) => Promise<void>;
      } | undefined;
      if (!reducers?.legacyImport) {
        this.lastError = 'legacy_import_unavailable';
        return { ok: false, reason: this.lastError };
      }
      await reducers.legacyImport(this.snapshotArgs(snapshot));
      this.lastLegacyImported = true;
      const remote = await this.fetchMyProgress();
      if (remote) this.lastServerUnlock = remote.unlockedLevel;
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.lastError = reason;
      console.warn('[SpacetimeDB] legacyImport rejected:', reason);
      return { ok: false, reason };
    }
  }

  hasLegacyImported(): boolean {
    return this.lastLegacyImported;
  }

  async fetchMyProgress(): Promise<RemoteProgress | null> {
    if (!this.connection || !this.isConnected()) return null;
    try {
      const result = await this.connection.procedures.getMyProgress({});
      if (!result) return null;
      const extra = result as {
        legacyImported?: boolean;
        displayName?: string;
        nameKind?: string;
        onboardDone?: boolean;
        upgradesJson?: string;
        achievementsCsv?: string;
        starsJson?: string;
      };
      const legacyImported = !!extra.legacyImported;
      this.lastServerUnlock = result.unlockedLevel;
      this.lastLegacyImported = legacyImported || this.lastLegacyImported;
      let upgrades: Record<string, number> = {};
      try { upgrades = extra.upgradesJson ? JSON.parse(extra.upgradesJson) as Record<string, number> : {}; } catch { upgrades = {}; }
      let stars: Record<string, number> = {};
      try { stars = extra.starsJson ? JSON.parse(extra.starsJson) as Record<string, number> : {}; } catch { stars = {}; }
      return {
        unlockedLevel: result.unlockedLevel,
        coins: BigInt(result.coins),
        equippedShip: result.equippedShip,
        ownedShips: result.ownedShipsCsv ? result.ownedShipsCsv.split(',').filter(Boolean) : ['starter'],
        language: result.language,
        totalScore: BigInt(result.totalScore),
        legacyImported,
        displayName: extra.displayName || '',
        nameKind: extra.nameKind === 'custom' ? 'custom' : 'generated',
        onboardDone: !!extra.onboardDone,
        upgrades,
        achievements: extra.achievementsCsv ? extra.achievementsCsv.split(',').filter(Boolean) : [],
        stars,
      };
    } catch (error) {
      console.warn('[SpacetimeDB] getMyProgress failed:', error);
      return null;
    }
  }

  async reconcileWithServer(opts?: { replace?: boolean }): Promise<void> {
    const remote = await this.fetchMyProgress();
    if (!remote) return;
    if (opts?.replace || this.isSignedIn()) {
      this.replaceWithServer(remote);
      this.notifyDataListeners();
      return;
    }
    const local = this.getLocalData();
    const mergedCoins = mergeCoins(local.coins, remote.coins);
    const delta = coinDeltaToPush(local.coins, remote.coins);
    local.coins = mergedCoins;
    local.unlockedLevel = Math.max(local.unlockedLevel, remote.unlockedLevel);
    if (remote.equippedShip) local.equippedShip = local.equippedShip || remote.equippedShip;
    local.ownedShips = Array.from(new Set([...(local.ownedShips || []), ...remote.ownedShips]));
    this.saveLocalData(local);
    if (local.unlockedLevel === remote.unlockedLevel + 1) {
      this.syncProgress(local.unlockedLevel, local.coins, local.equippedShip);
    }
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

  async adminMe(): Promise<{ ok: boolean; email: string; detail: string } | null> {
    if (!this.connection) return null;
    try {
      const result = await this.connection.procedures.adminMe({});
      return result
        ? { ok: !!result.ok, email: result.email || '', detail: result.detail || '' }
        : { ok: false, email: '', detail: '{"reason":"empty-result"}' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, email: '', detail: JSON.stringify({ reason: 'procedure-error', error: msg.slice(0, 160) }) };
    }
  }

  async adminStats(): Promise<{ players: number; activeWeek: number; gamesPlayed: string; emptyGuests?: number; signedIn?: number } | null> {
    if (!this.connection) return null;
    const result = await this.connection.procedures.adminStats({});
    if (!result) return null;
    const extra = result as { emptyGuests?: number; signedIn?: number };
    return {
      players: result.players,
      activeWeek: result.activeWeek,
      gamesPlayed: String(result.gamesPlayed),
      emptyGuests: extra.emptyGuests,
      signedIn: extra.signedIn,
    };
  }

  async adminListPlayers(query = ''): Promise<Array<Record<string, string | number | boolean>>> {
    if (!this.connection) return [];
    const result = await this.connection.procedures.adminListPlayers({ query });
    if (!result?.rowsJson) return [];
    try { return JSON.parse(result.rowsJson) as Array<Record<string, string | number | boolean>>; }
    catch { return []; }
  }

  async adminGetPlayer(targetHex: string): Promise<Record<string, unknown> | null> {
    if (!this.connection) return null;
    const result = await this.connection.procedures.adminGetPlayer({ targetHex });
    if (!result?.rowJson) return null;
    try { return JSON.parse(result.rowJson) as Record<string, unknown>; }
    catch { return null; }
  }

  private async callAdmin(fn: () => unknown): Promise<void> {
    const out = fn();
    if (out && typeof (out as Promise<void>).then === 'function') await out;
    await new Promise((r) => setTimeout(r, 120));
  }

  adminSetCoins(targetHex: string, coins: bigint): Promise<void> {
    return this.callAdmin(() => this.connection?.reducers.adminSetCoins({ targetHex, coins }));
  }
  adminAddCoins(targetHex: string, delta: bigint): Promise<void> {
    return this.callAdmin(() => this.connection?.reducers.adminAddCoins({ targetHex, delta }));
  }
  adminUnlockLevel(targetHex: string, level: number): Promise<void> {
    return this.callAdmin(() => this.connection?.reducers.adminUnlockLevel({ targetHex, level }));
  }
  adminGrantShip(targetHex: string, shipId: string): Promise<void> {
    return this.callAdmin(() => this.connection?.reducers.adminGrantShip({ targetHex, shipId }));
  }
  adminRemoveShip(targetHex: string, shipId: string): Promise<void> {
    return this.callAdmin(() => this.connection?.reducers.adminRemoveShip({ targetHex, shipId }));
  }
  adminResetProgress(targetHex: string): Promise<void> {
    return this.callAdmin(() => this.connection?.reducers.adminResetProgress({ targetHex }));
  }
  adminResetPlayer(targetHex: string): Promise<void> {
    return this.callAdmin(() => this.connection?.reducers.adminResetPlayer({ targetHex }));
  }
  adminBan(targetHex: string, reason: string): Promise<void> {
    return this.callAdmin(() => this.connection?.reducers.adminBan({ targetHex, reason }));
  }
  adminUnban(targetHex: string): Promise<void> {
    return this.callAdmin(() => this.connection?.reducers.adminUnban({ targetHex }));
  }
  adminSetTestFlag(targetHex: string, testBot: boolean): Promise<void> {
    return this.callAdmin(() => (this.connection?.reducers as { adminSetTestFlag?: (a: { targetHex: string; testBot: boolean }) => unknown }).adminSetTestFlag?.({ targetHex, testBot }));
  }
  adminPurgeEmptyGuests(olderDays: number, confirm: string): Promise<void> {
    return this.callAdmin(() => (this.connection?.reducers as { adminPurgeEmptyGuests?: (a: { olderDays: number; confirm: string }) => unknown }).adminPurgeEmptyGuests?.({ olderDays, confirm }));
  }

  ensurePlayerRow(): void {
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as { ensurePlayerRow?: (a: Record<string, never>) => void }).ensurePlayerRow?.({});
    });
  }

  linkGuestIdentity(guestHex: string): void {
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as { linkGuestIdentity?: (a: { guestHex: string }) => void }).linkGuestIdentity?.({ guestHex });
    });
  }

  reportPresence(payload: Record<string, string | number>): void {
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as unknown as { reportPresence?: (a: Record<string, string | number>) => void }).reportPresence?.(payload);
    });
  }

  reportMpJoin(): void {
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as { reportMpJoin?: (a: Record<string, never>) => void }).reportMpJoin?.({});
    });
  }

  publishPublicRoom(row: { code: string; hostName: string; level: number; players: number; inGame: boolean; versus?: boolean }): void {
    this.queueOrCallReducer(() => {
      const payload = { ...row, versus: !!row.versus };
      (this.connection?.reducers as { publishPublicRoom?: (a: typeof payload) => void }).publishPublicRoom?.(payload);
    });
  }

  heartbeatPublicRoom(row: { code: string; hostName: string; level: number; players: number; inGame: boolean; versus?: boolean }): void {
    this.queueOrCallReducer(() => {
      const payload = { ...row, versus: !!row.versus };
      (this.connection?.reducers as { heartbeatPublicRoom?: (a: typeof payload) => void }).heartbeatPublicRoom?.(payload);
    });
  }

  closePublicRoom(code: string): void {
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as { closePublicRoom?: (a: { code: string }) => void }).closePublicRoom?.({ code });
    });
  }

  private versusQueueTable(conn: DbConnection | null = this.connection): {
    onInsert: (cb: (ctx: unknown, row: Record<string, unknown>) => void) => void;
    onUpdate: (cb: (ctx: unknown, oldRow: Record<string, unknown>, row: Record<string, unknown>) => void) => void;
    onDelete: (cb: (ctx: unknown, row: Record<string, unknown>) => void) => void;
    iter: () => Iterable<Record<string, unknown>>;
  } | null {
    const table = (conn?.db as { versusQueue?: {
      onInsert: (cb: (ctx: unknown, row: Record<string, unknown>) => void) => void;
      onUpdate: (cb: (ctx: unknown, oldRow: Record<string, unknown>, row: Record<string, unknown>) => void) => void;
      onDelete: (cb: (ctx: unknown, row: Record<string, unknown>) => void) => void;
      iter: () => Iterable<Record<string, unknown>>;
    } } | undefined)?.versusQueue;
    return table || null;
  }

  private bindVersusQueueCallbacks(conn: DbConnection): void {
    if (this.versusCallbacksBound) return;
    const table = this.versusQueueTable(conn);
    if (!table) return;
    this.versusCallbacksBound = true;
    table.onInsert((_ctx, row) => {
      applyVersusQueueEvent(this.versusQueue, { type: 'insert', row: versusRowFromServer(row) });
      this.notifyVersusQueue();
    });
    table.onUpdate((_ctx, _old, row) => {
      applyVersusQueueEvent(this.versusQueue, { type: 'update', row: versusRowFromServer(row) });
      this.notifyVersusQueue();
    });
    table.onDelete((_ctx, row) => {
      applyVersusQueueEvent(this.versusQueue, { type: 'delete', code: String(row.code || '') });
      this.notifyVersusQueue();
    });
  }

  private seedVersusQueueFromTable(conn: DbConnection): void {
    const table = this.versusQueueTable(conn);
    if (!table) return;
    this.versusQueue.clear();
    for (const row of table.iter()) {
      applyVersusQueueEvent(this.versusQueue, { type: 'insert', row: versusRowFromServer(row) });
    }
    this.notifyVersusQueue();
  }

  private notifyVersusQueue(): void {
    const rows = this.getOpenVersus();
    this.versusListeners.forEach((fn) => fn(rows));
  }

  getOpenVersus(): VersusQueueRow[] {
    return listOpenVersus(this.versusQueue);
  }

  getVersusQueue(): VersusQueueRow[] {
    return listQuickQueue(this.versusQueue);
  }

  hasLiveVersusQueue(): boolean {
    return this.liveVersusQueue;
  }

  onVersusQueue(callback: (rows: VersusQueueRow[]) => void): () => void {
    this.versusListeners.push(callback);
    callback(this.getVersusQueue());
    return () => {
      this.versusListeners = this.versusListeners.filter((fn) => fn !== callback);
    };
  }

  publishVersusQueue(row: { code: string; hostName: string; hostShip: string; kind: string }): void {
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as { publishVersusQueue?: (a: typeof row) => void }).publishVersusQueue?.(row);
    });
  }

  heartbeatVersusQueue(row: { code: string; hostName: string; hostShip: string; kind: string }): void {
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as { heartbeatVersusQueue?: (a: typeof row) => void }).heartbeatVersusQueue?.(row);
    });
  }

  closeVersusQueue(code: string): void {
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as { closeVersusQueue?: (a: { code: string }) => void }).closeVersusQueue?.({ code });
    });
  }

  claimVersusQueue(code: string, guestName: string, guestShip: string): void {
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as { claimVersusQueue?: (a: { code: string; guestName: string; guestShip: string }) => void }).claimVersusQueue?.({ code, guestName, guestShip });
    });
  }

  reportVersusResult(matchId: string, winnerPid: number, hostRounds: number, guestRounds: number): void {
    this.queueOrCallReducer(() => {
      (this.connection?.reducers as { reportVersusResult?: (a: { matchId: string; winnerPid: number; hostRounds: number; guestRounds: number }) => void }).reportVersusResult?.({
        matchId, winnerPid, hostRounds, guestRounds,
      });
    });
  }

  async listPublicRooms(): Promise<PublicRoomRow[]> {
    if (this.livePublicRooms) return this.getPublicRooms();
    return this.refreshPublicRoomsFromProcedure();
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
