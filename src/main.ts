/**
 * Vite entry loaded by the game HTML.
 * Connects the official SpacetimeDB SDK and routes save/load, level
 * start/complete, purchases, codes, and co-op security through it.
 */

import { initLanguage, getLanguage, setLanguage, toggleLanguage, t, onLanguageChange } from './i18n';
import { initSpacetime, getSpacetimeClient, type SyncStatus, type SpacetimeClient } from './lib/spacetime-client';
import * as coop from './coop-security';

export interface WeltraumApi {
  i18n: {
    t: typeof t;
    getLanguage: typeof getLanguage;
    setLanguage: typeof setLanguage;
    toggleLanguage: typeof toggleLanguage;
    onLanguageChange: typeof onLanguageChange;
  };
  spacetime: SpacetimeClient;
  coop: typeof coop;
  syncStatus: SyncStatus;
  onSyncStatusChange: (callback: (status: SyncStatus) => void) => () => void;
  onGameSave: () => void;
  onLevelComplete: (result: {
    level: number;
    stars: number;
    score: number | bigint;
    coinsEarned: number | bigint;
    timeMs: number | bigint;
    heartsLeft: number;
  }) => Promise<{ ok: boolean; reason?: string }>;
  onPurchaseShip: (shipId: string, price: number) => boolean;
  onEquipShip: (shipId: string) => void;
  onPurchaseUpgrade: (upgradeId: string, price: number) => boolean;
  onSecretCode: (code: string) => { success: boolean; message: string };
  canStartLevel: (level: number) => boolean;
}

declare global {
  interface Window {
    __weltraum?: WeltraumApi;
    __spaceGame?: {
      forceFinish?: () => void;
      tryStartLevel?: (level: number) => boolean;
      startLevel?: (level: number) => void;
      progress?: () => { unlocked: number; stars: Record<string, number> };
      shop?: () => { coins: number; owned: string[]; equipped: string };
      coop?: Record<string, unknown>;
    };
  }
}

function toBigInt(value: number | bigint): bigint {
  return typeof value === 'bigint' ? value : BigInt(Math.max(0, Math.floor(value)));
}

function showGameSync(status: 'saved' | 'saving' | 'offline' | 'error'): void {
  const game = window as Window & { __spaceGameSync?: (s: string) => void };
  if (typeof game.__spaceGameSync === 'function') {
    game.__spaceGameSync(status);
  }
}

function syncFromGame(client: SpacetimeClient): void {
  const game = window.__spaceGame;
  if (!game?.progress || !game.shop) return;

  const progress = game.progress();
  const shop = game.shop();
  client.syncProgress(progress.unlocked || 1, BigInt(shop.coins || 0), shop.equipped || 'starter');

  const stars = progress.stars || {};
  for (const [levelStr, starVal] of Object.entries(stars)) {
    const level = parseInt(levelStr, 10);
    if (!isNaN(level) && starVal) {
      client.syncLevelStars(level, Number(starVal), 0n);
    }
  }

  const local = client.getLocalData();
  local.unlockedLevel = progress.unlocked || 1;
  local.coins = BigInt(shop.coins || 0);
  local.equippedShip = shop.equipped || 'starter';
  local.ownedShips = shop.owned || ['starter'];
  client.saveLocalData(local);
}

function installApi(client: SpacetimeClient): WeltraumApi {
  const api: WeltraumApi = {
    i18n: { t, getLanguage, setLanguage, toggleLanguage, onLanguageChange },
    spacetime: client,
    coop,
    syncStatus: client.getStatus(),
    onSyncStatusChange: (callback) => {
      return client.onStatusChange((status) => {
        api.syncStatus = status;
        if (status === 'syncing') showGameSync('saving');
        if (status === 'connected') showGameSync('saved');
        if (status === 'offline' || status === 'error' || status === 'disconnected') {
          showGameSync('offline');
        }
        callback(status);
      });
    },
    onGameSave: () => {
      showGameSync('saving');
      syncFromGame(client);
      if (client.isConnected()) {
        showGameSync('saved');
      }
    },
    onLevelComplete: async (result) => {
      showGameSync('saving');
      const out = await client.completeLevelResult({
        level: result.level,
        stars: result.stars,
        score: toBigInt(result.score),
        coinsEarned: toBigInt(result.coinsEarned),
        timeMs: toBigInt(result.timeMs),
        heartsLeft: result.heartsLeft,
      });
      showGameSync(out.ok ? 'saved' : 'error');
      return out;
    },
    onPurchaseShip: (shipId, price) => client.purchaseShip(shipId, BigInt(price)),
    onEquipShip: (shipId) => client.equipShip(shipId),
    onPurchaseUpgrade: (upgradeId, price) => client.purchaseUpgrade(upgradeId, BigInt(price)),
    onSecretCode: (code) => client.applySecretCode(code),
    canStartLevel: (level) => client.requestLevelData(level),
  };
  return api;
}

function attachCoopStandIn(): void {
  const attach = () => {
    if (!window.__spaceGame) return false;
    window.__spaceGame.coop = {
      requestJoin: (id: string) => coop.requestJoin(id),
      pending: () => coop.getPendingRequests(),
      approve: (id: string) => coop.approveJoin(id),
      reject: (id: string) => coop.rejectJoin(id),
      kick: (id: string) => coop.kickPlayer(id),
      isApproved: (id: string) => coop.isApproved(id),
      isKicked: (id: string) => coop.isKicked(id),
      check: (id: string) => coop.checkJoinAllowed(id),
      reset: () => coop.resetCoopSecurity(),
    };
    return true;
  };
  if (!attach()) {
    const timer = setInterval(() => {
      if (attach()) clearInterval(timer);
    }, 50);
    setTimeout(() => clearInterval(timer), 5000);
  }
}

async function init(): Promise<void> {
  console.log('[Weltraum] Initializing SpacetimeDB client...');
  initLanguage();

  const client = getSpacetimeClient();
  const api = installApi(client);
  window.__weltraum = api;
  api.onSyncStatusChange(() => undefined);
  attachCoopStandIn();

  const connected = await initSpacetime();
  if (connected) {
    console.log('[Weltraum] SpacetimeDB connected', client.getIdentityHex());
    showGameSync('saved');
  } else {
    console.log('[Weltraum] Running in offline mode (local cache)');
    showGameSync('offline');
  }
}

init();

export { t, getLanguage, setLanguage, toggleLanguage };
