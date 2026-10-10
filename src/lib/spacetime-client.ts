/**
 * SpacetimeDB Client Integration
 * Handles connection, authentication, and data sync
 */

export type SyncStatus = 'connected' | 'connecting' | 'disconnected' | 'syncing' | 'error';

interface PlayerData {
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
}

interface SpacetimeConfig {
  host: string;
  moduleName: string;
  ssl: boolean;
}

const DEFAULT_CONFIG: SpacetimeConfig = {
  host: 'localhost:3000',
  moduleName: 'weltraum-dev',
  ssl: false,
};

const IDENTITY_STORAGE_KEY = 'spaceMissionIdentityToken';

class SpacetimeClient {
  private config: SpacetimeConfig;
  private status: SyncStatus = 'disconnected';
  private statusListeners: Array<(status: SyncStatus) => void> = [];
  private identityToken: string | null = null;
  private connected = false;
  private localCache: PlayerData | null = null;
  private pendingSync: PlayerData | null = null;
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  
  constructor(config: Partial<SpacetimeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadIdentityToken();
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
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async connect(): Promise<boolean> {
    if (this.connected) return true;
    
    this.setStatus('connecting');
    
    try {
      // TODO: Implement actual SpacetimeDB connection using the SDK
      // For now, we'll simulate the connection behavior
      // The actual implementation would use:
      // import { SpacetimeDBClient } from 'spacetimedb';
      // const client = new SpacetimeDBClient(wsUrl, moduleName);
      // await client.connect(this.identityToken);
      
      console.log('[SpacetimeDB] Would connect to:', this.getWsUrl());
      
      // Simulate connection success for offline-first mode
      this.connected = true;
      this.setStatus('connected');
      
      return true;
    } catch (error) {
      console.error('[SpacetimeDB] Connection failed:', error);
      this.setStatus('error');
      return false;
    }
  }
  
  disconnect(): void {
    this.connected = false;
    this.setStatus('disconnected');
  }
  
  private getWsUrl(): string {
    const protocol = this.config.ssl ? 'wss' : 'ws';
    return `${protocol}://${this.config.host}`;
  }
  
  getIdentityToken(): string | null {
    return this.identityToken;
  }
  
  hasIdentity(): boolean {
    return this.identityToken !== null;
  }
  
  // Load data from local cache (for offline-first behavior)
  loadLocalData(): PlayerData | null {
    if (this.localCache) return this.localCache;
    
    try {
      const data = localStorage.getItem('spaceMissionCachedData');
      if (data) {
        this.localCache = JSON.parse(data, (key, value) => {
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
    return null;
  }
  
  // Save data to local cache
  saveLocalData(data: PlayerData): void {
    this.localCache = data;
    try {
      const serialized = JSON.stringify(data, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString() + 'n';
        }
        return value;
      });
      localStorage.setItem('spaceMissionCachedData', serialized);
    } catch {
      // Ignore storage errors
    }
  }
  
  // Queue a sync operation (debounced)
  queueSync(data: Partial<PlayerData>): void {
    this.pendingSync = { ...this.localCache, ...data } as PlayerData;
    
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    this.syncTimeout = setTimeout(() => {
      this.performSync();
    }, 1000);
  }
  
  private async performSync(): Promise<void> {
    if (!this.pendingSync || !this.connected) return;
    
    const data = this.pendingSync;
    this.pendingSync = null;
    
    this.setStatus('syncing');
    
    try {
      // TODO: Call actual SpacetimeDB reducers
      // await this.client.callReducer('syncProgress', {...});
      
      console.log('[SpacetimeDB] Would sync data:', data);
      this.saveLocalData(data);
      this.setStatus('connected');
    } catch (error) {
      console.error('[SpacetimeDB] Sync failed:', error);
      this.setStatus('error');
      // Re-queue the sync for retry
      this.pendingSync = data;
    }
  }
  
  // Reducer wrappers
  async setLanguage(language: string): Promise<void> {
    console.log('[SpacetimeDB] setLanguage:', language);
    // TODO: Call reducer
  }
  
  async completeLevelResult(result: {
    level: number;
    stars: number;
    score: bigint;
    coinsEarned: bigint;
    timeMs: bigint;
    heartsLeft: number;
  }): Promise<void> {
    console.log('[SpacetimeDB] completeLevelResult:', result);
    // TODO: Call reducer
  }
  
  async requestLevelData(level: number): Promise<boolean> {
    console.log('[SpacetimeDB] requestLevelData:', level);
    // TODO: Call reducer and check response
    return true;
  }
  
  async purchaseShip(shipId: string, price: bigint): Promise<boolean> {
    console.log('[SpacetimeDB] purchaseShip:', shipId, price);
    // TODO: Call reducer
    return true;
  }
  
  async equipShip(shipId: string): Promise<void> {
    console.log('[SpacetimeDB] equipShip:', shipId);
    // TODO: Call reducer
  }
  
  async purchaseUpgrade(upgradeId: string, price: bigint): Promise<boolean> {
    console.log('[SpacetimeDB] purchaseUpgrade:', upgradeId, price);
    // TODO: Call reducer
    return true;
  }
  
  async applySecretCode(code: string): Promise<{ success: boolean; message: string }> {
    console.log('[SpacetimeDB] applySecretCode:', code);
    // TODO: Call reducer
    return { success: true, message: 'Code applied' };
  }
  
  async unlockAchievement(achievementId: string): Promise<void> {
    console.log('[SpacetimeDB] unlockAchievement:', achievementId);
    // TODO: Call reducer
  }
  
  async updateSettings(settings: Partial<{
    muted: boolean;
    twoPlayerMode: boolean;
    ghostMode: boolean;
  }>): Promise<void> {
    console.log('[SpacetimeDB] updateSettings:', settings);
    // TODO: Call reducer
  }
  
  async reportError(error: {
    errorType: string;
    message: string;
    stack?: string;
    context?: string;
  }): Promise<void> {
    console.log('[SpacetimeDB] reportError:', error);
    // TODO: Call reducer
  }
  
  async resetProgress(): Promise<void> {
    console.log('[SpacetimeDB] resetProgress');
    // TODO: Call reducer
  }
}

// Singleton instance
let clientInstance: SpacetimeClient | null = null;

export function getSpacetimeClient(): SpacetimeClient {
  if (!clientInstance) {
    // Check for environment-specific config
    const config: Partial<SpacetimeConfig> = {};
    
    // Look for config in URL params or env
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const host = params.get('stdb_host');
      const module = params.get('stdb_module');
      const ssl = params.get('stdb_ssl');
      
      if (host) config.host = host;
      if (module) config.moduleName = module;
      if (ssl === 'true') config.ssl = true;
      if (ssl === 'false') config.ssl = false;
      
      // Default to SSL for production hosts
      if (host && (host.includes('spacetimedb.com') || host.includes('maincloud'))) {
        config.ssl = true;
      }
    }
    
    clientInstance = new SpacetimeClient(config);
  }
  return clientInstance;
}

export function initSpacetime(): Promise<boolean> {
  const client = getSpacetimeClient();
  return client.connect();
}

export { SpacetimeClient, type PlayerData, type SpacetimeConfig };
