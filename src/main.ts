/**
 * Vite entry loaded by the game HTML.
 * Connects the official SpacetimeDB SDK and routes save/load, level
 * start/complete, purchases, codes, co-op security, and Firebase Auth.
 */

import { initLanguage, getLanguage, setLanguage, toggleLanguage, t, onLanguageChange, getCatalog } from './i18n';
import { initSpacetime, getSpacetimeClient, type SyncStatus, type SpacetimeClient } from './lib/spacetime-client';
import * as coop from './coop-security';
import {
  isAuthConfigured,
  isAppleEnabled,
  loadAuthUser,
  loadAnonSnapshot,
  saveAnonSnapshot,
  clearAnonSnapshot,
  completeRedirectIfNeeded,
  completeEmailLinkIfNeeded,
  signInWithGoogle,
  startEmailLink,
  signInWithApple,
  signOutFirebase,
  watchIdToken,
  type ProgressSnapshot,
} from './lib/firebase-auth';
import { mergeCoins, shouldAcceptServerCoins } from './lib/coin-ledger';

export interface WeltraumApi {
  i18n: {
    t: typeof t;
    getLanguage: typeof getLanguage;
    setLanguage: typeof setLanguage;
    toggleLanguage: typeof toggleLanguage;
    onLanguageChange: typeof onLanguageChange;
    getCatalog: typeof getCatalog;
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
  account: {
    isConfigured: () => boolean;
    isSignedIn: () => boolean;
    appleEnabled: () => boolean;
    shortId: () => string;
    status: () => SyncStatus;
    guestLabel: () => string;
    signInGoogle: () => Promise<void>;
    startEmailLink: (email: string) => Promise<void>;
    signInApple: () => Promise<void>;
    signOut: () => Promise<void>;
  };
}

declare global {
  interface Window {
    __weltraum?: WeltraumApi;
    __spaceGame?: {
      forceFinish?: (opts?: { skipCelebrate?: boolean }) => void;
      tryStartLevel?: (level: number) => boolean;
      startLevel?: (level: number) => void;
      progress?: () => { unlocked: number; stars: Record<string, number>; best?: Record<string, number> };
      shop?: () => { coins: number; owned: string[]; equipped: string; up?: Record<string, number> };
      applyRemoteShop?: (coins: number) => void;
      coop?: Record<string, unknown>;
    };
    __I18N_BUNDLE__?: unknown;
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

function snapshotFromGame(): ProgressSnapshot | undefined {
  const game = window.__spaceGame;
  if (!game?.progress || !game.shop) return undefined;
  const progress = game.progress();
  const shop = game.shop();
  return {
    unlockedLevel: progress.unlocked || 1,
    coins: shop.coins || 0,
    equippedShip: shop.equipped || 'starter',
    ownedShips: shop.owned || ['starter'],
    upgrades: shop.up || {},
    stars: Object.fromEntries(Object.entries(progress.stars || {}).map(([k, v]) => [k, Number(v)])),
    best: progress.best || {},
    language: getLanguage(),
  };
}

function syncFromGame(client: SpacetimeClient): void {
  const game = window.__spaceGame;
  if (!game?.progress || !game.shop) return;

  const progress = game.progress();
  const shop = game.shop();
  const localCoins = BigInt(shop.coins || 0);

  client.syncProgress(progress.unlocked || 1, localCoins, shop.equipped || 'starter');

  const stars = progress.stars || {};
  for (const [levelStr, starVal] of Object.entries(stars)) {
    const level = parseInt(levelStr, 10);
    if (!isNaN(level) && starVal) {
      client.syncLevelStars(level, Number(starVal), 0n);
    }
  }

  const local = client.getLocalData();
  local.unlockedLevel = Math.max(local.unlockedLevel || 1, progress.unlocked || 1);
  local.coins = mergeCoins(local.coins, localCoins);
  local.equippedShip = shop.equipped || 'starter';
  local.ownedShips = shop.owned || ['starter'];
  if (shop.up) local.upgrades = shop.up;
  client.saveLocalData(local);
}

function applyHigherServerCoins(client: SpacetimeClient): void {
  const game = window.__spaceGame;
  if (!game?.shop) return;
  const shop = game.shop();
  const local = client.getLocalData();
  if (shouldAcceptServerCoins(shop.coins || 0, local.coins) && typeof game.applyRemoteShop === 'function') {
    game.applyRemoteShop(Number(local.coins));
  }
}

let importedOnce = false;
let watchBound = false;
let authFlowLock = false;

async function mergeAfterSignIn(client: SpacetimeClient): Promise<void> {
  if (importedOnce) return;
  const snap = loadAnonSnapshot() || snapshotFromGame();
  if (snap && loadAuthUser()) {
    importedOnce = true;
    client.importProgress(snap);
    clearAnonSnapshot();
    await client.reconcileWithServer();
    applyHigherServerCoins(client);
  }
}

async function connectFirebaseIdentity(client: SpacetimeClient, firstSignIn: boolean): Promise<void> {
  const user = loadAuthUser();
  if (!user?.idToken) return;
  if (firstSignIn) {
    const snap = snapshotFromGame();
    if (snap) saveAnonSnapshot(snap);
  }
  await client.reconnectWithToken(user.idToken);
  if (firstSignIn) {
    importedOnce = false;
    await mergeAfterSignIn(client);
  } else {
    await client.reconcileWithServer();
    applyHigherServerCoins(client);
  }
}

function installApi(client: SpacetimeClient): WeltraumApi {
  const api: WeltraumApi = {
    i18n: { t, getLanguage, setLanguage, toggleLanguage, onLanguageChange, getCatalog },
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
      syncFromGame(client);
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
    account: {
      isConfigured: () => isAuthConfigured(),
      isSignedIn: () => client.isSignedIn() || !!loadAuthUser(),
      appleEnabled: () => isAppleEnabled(),
      shortId: () => client.shortPlayerId(),
      status: () => client.getStatus(),
      guestLabel: () => {
        const user = loadAuthUser();
        if (user?.email) return user.email;
        return client.isSignedIn() ? t('account.signedIn') : t('account.guest');
      },
      signInGoogle: async () => {
        if (!isAuthConfigured()) throw new Error('auth_not_configured');
        authFlowLock = true;
        try {
          const snap = snapshotFromGame();
          if (snap) saveAnonSnapshot(snap);
          await signInWithGoogle();
          await connectFirebaseIdentity(client, true);
        } finally {
          authFlowLock = false;
        }
      },
      startEmailLink: async (email: string) => {
        if (!isAuthConfigured()) throw new Error('auth_not_configured');
        const snap = snapshotFromGame();
        if (snap) saveAnonSnapshot(snap);
        await startEmailLink(email);
      },
      signInApple: async () => {
        if (!isAuthConfigured()) throw new Error('auth_not_configured');
        authFlowLock = true;
        try {
          const snap = snapshotFromGame();
          if (snap) saveAnonSnapshot(snap);
          await signInWithApple();
          await connectFirebaseIdentity(client, true);
        } finally {
          authFlowLock = false;
        }
      },
      signOut: async () => {
        importedOnce = false;
        await signOutFirebase();
        await client.restoreGuestIdentity();
        await client.reconcileWithServer();
        applyHigherServerCoins(client);
      },
    },
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

function bindTokenWatch(client: SpacetimeClient): void {
  if (watchBound) return;
  watchBound = true;
  watchIdToken((user) => {
    if (!user || authFlowLock) return;
    if (!client.isSignedIn()) return;
    void (async () => {
      await client.reconnectWithToken(user.idToken);
      await client.reconcileWithServer();
      applyHigherServerCoins(client);
    })();
  });
}

async function init(): Promise<void> {
  console.log('[Weltraum] Initializing SpacetimeDB client...');
  initLanguage();

  const client = getSpacetimeClient();
  const api = installApi(client);
  window.__weltraum = api;
  api.onSyncStatusChange(() => undefined);
  attachCoopStandIn();

  let signed = null as Awaited<ReturnType<typeof completeRedirectIfNeeded>>;
  try {
    signed = await completeEmailLinkIfNeeded() || await completeRedirectIfNeeded();
  } catch (err) {
    console.warn('[Weltraum] Firebase callback failed', err);
  }

  const connected = await initSpacetime();
  if (connected) {
    console.log('[Weltraum] SpacetimeDB connected', client.getIdentityHex());
    if (signed) {
      await connectFirebaseIdentity(client, true);
    } else {
      await mergeAfterSignIn(client);
    }
    await client.reconcileWithServer();
    applyHigherServerCoins(client);
    showGameSync('saved');
  } else {
    console.log('[Weltraum] Running in offline mode (local cache)');
    showGameSync('offline');
  }
  bindTokenWatch(client);
}

init();

export { t, getLanguage, setLanguage, toggleLanguage };
