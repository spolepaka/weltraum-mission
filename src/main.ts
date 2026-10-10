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
  signInWithEmulatorGoogle,
  startEmailLink,
  signInWithApple,
  signOutFirebase,
  watchIdToken,
  watchAuthState,
  ensureFirebase,
  needsFirebaseNow,
  maskEmail,
  maskDisplayName,
  getAuthDebug,
  getFirebaseConfig,
  authErrorCode,
  tokenIssuerKind,
  type ProgressSnapshot,
  type SignInOpts,
} from './lib/firebase-auth';
import { mergeCoins, shouldAcceptServerCoins } from './lib/coin-ledger';
import { loadPeerConstructor } from './lib/online-peer';
import {
  ensureLevel,
  prefetchUnlocked,
  prefetchLog,
  setLevelFetcher,
  cachedLevel,
  isBundledLevel,
} from './lib/level-runtime';
import {
  generateDisplayName,
  generateNameChoices,
  loadDisplayName,
  saveDisplayName,
  validateDisplayName,
  type NameKind,
} from './lib/display-names';
import * as tips from './lib/tips';
import * as onboard from './lib/onboarding';
import { loadDifficulty, saveDifficulty, parseDifficulty, type Difficulty } from './lib/difficulty';
import { isoWeekKey, weeklyChallenge } from './lib/weekly';
import { loadDoNotTrack, saveDoNotTrack, type AnalyticsKind } from './lib/analytics';

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
  levels: {
    ensure: (level: number, unlocked: number) => Promise<unknown>;
    prefetch: (unlocked: number) => number[];
    cached: (level: number) => unknown;
    bundled: (level: number) => boolean;
    prefetchLog: number[];
  };
  loadPeer: () => Promise<unknown>;
  names: {
    current: () => { name: string; kind: NameKind } | null;
    generate: (lang?: 'en' | 'de') => string;
    choices: (lang?: 'en' | 'de', count?: number) => string[];
    validate: (name: string, kind: NameKind) => { ok: true; name: string } | { ok: false; reason: string };
    save: (name: string, kind: NameKind) => { ok: true; name: string } | { ok: false; reason: string };
  };
  tips: typeof tips;
  onboard: typeof onboard;
  difficulty: {
    current: () => Difficulty;
    set: (mode: Difficulty) => void;
  };
  weekly: {
    key: () => string;
    challenge: () => { weekKey: string; level: number; seed: number };
    submit: (score: number) => void;
    board: () => Promise<Array<{ name: string; score: string; mode: string; me: boolean }>>;
  };
  analytics: {
    track: (kind: AnalyticsKind, level?: number) => void;
    dnt: () => boolean;
    setDnt: (on: boolean) => void;
    funnel: () => Promise<Record<string, string>>;
  };
  account: {
    isConfigured: () => boolean;
    isSignedIn: () => boolean;
    appleEnabled: () => boolean;
    shortId: () => string;
    displayName: () => string;
    prepareAuth: () => Promise<void>;
    status: () => SyncStatus;
    guestLabel: () => string;
    debug: () => {
      path: 'popup' | 'redirect' | 'none';
      lastError: string | null;
      firebaseUser: boolean;
      issuer: 'anon' | 'firebase' | 'unknown';
    };
    profile: () => {
      signedIn: boolean;
      email?: string;
      emailMasked?: string;
      googleName?: string;
      googleNameMasked?: string;
      username?: string;
      uid?: string;
    };
    onChange: (cb: () => void) => () => void;
    signInGoogle: (opts?: SignInOpts) => Promise<void>;
    signInEmulatorGoogle: (email: string) => Promise<void>;
    startEmailLink: (email: string) => Promise<void>;
    signInApple: (opts?: SignInOpts) => Promise<void>;
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
const accountListeners: Array<() => void> = [];

function reportAuthFailure(client: SpacetimeClient, err: unknown, path: string): void {
  const code = authErrorCode(err) || String((err as { message?: string })?.message || err || 'auth_error');
  let host = '';
  try { host = window.location.host; } catch { /* ignore */ }
  client.reportError({
    errorType: 'firebase_auth',
    message: code,
    context: JSON.stringify({
      path,
      host,
      authDomain: getFirebaseConfig()?.authDomain || '',
    }),
  });
}

function notifyAccount(): void {
  accountListeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function adoptGameProgress(client: SpacetimeClient): number {
  const game = window.__spaceGame?.progress?.();
  const shop = window.__spaceGame?.shop?.();
  const local = client.getLocalData();
  const unlocked = Math.max(local.unlockedLevel || 1, game?.unlocked || 1);
  local.unlockedLevel = unlocked;
  if (shop) {
    local.coins = mergeCoins(local.coins, BigInt(shop.coins || 0));
    local.equippedShip = shop.equipped || local.equippedShip;
    local.ownedShips = shop.owned || local.ownedShips;
    if (shop.up) local.upgrades = shop.up;
  }
  client.saveLocalData(local);
  return unlocked;
}

async function afterProgressReady(client: SpacetimeClient): Promise<void> {
  const gameUnlock = window.__spaceGame?.progress?.()?.unlocked || 1;
  const remote = await client.fetchMyProgress();
  if (remote && gameUnlock > remote.unlockedLevel && !remote.legacyImported) {
    const snap = snapshotFromGame();
    if (snap) {
      try {
        await client.legacyImport(snap);
      } catch (err) {
        console.warn('[Weltraum] legacyImport failed', err);
      }
    }
  }
  const unlocked = adoptGameProgress(client);
  syncFromGame(client);
  await client.reconcileWithServer();
  applyHigherServerCoins(client);
  const cap = Math.max(unlocked, client.getLocalData().unlockedLevel || 1);
  prefetchUnlocked(cap);
  notifyAccount();
}

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
  bindAuthWatch(client);
  if (!loadDoNotTrack()) client.trackAnalytics('sign_in', 0, loadDifficulty());
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
        mode: loadDifficulty(),
      });
      showGameSync(out.ok ? 'saved' : 'error');
      return out;
    },
    onPurchaseShip: (shipId, price) => client.purchaseShip(shipId, BigInt(price)),
    onEquipShip: (shipId) => client.equipShip(shipId),
    onPurchaseUpgrade: (upgradeId, price) => client.purchaseUpgrade(upgradeId, BigInt(price)),
    onSecretCode: (code) => client.applySecretCode(code),
    canStartLevel: (level) => {
      adoptGameProgress(client);
      return client.requestLevelData(level);
    },
    levels: {
      ensure: (level, unlocked) => ensureLevel(level, Math.max(unlocked, adoptGameProgress(client))),
      prefetch: (unlocked) => prefetchUnlocked(Math.max(unlocked, adoptGameProgress(client))),
      cached: (level) => cachedLevel(level),
      bundled: (level) => isBundledLevel(level),
      prefetchLog,
    },
    loadPeer: () => loadPeerConstructor(),
    names: {
      current: () => loadDisplayName(),
      generate: (lang) => generateDisplayName(lang === 'de' ? 'de' : 'en', Date.now()),
      choices: (lang, count = 3) => generateNameChoices(lang === 'de' ? 'de' : 'en', count, Date.now()),
      validate: (name, kind) => validateDisplayName(name, kind),
      save: (name, kind) => {
        const checked = validateDisplayName(name, kind);
        if (!checked.ok) return checked;
        saveDisplayName({ name: checked.name, kind });
        client.setDisplayName(checked.name, kind);
        notifyAccount();
        return checked;
      },
    },
    tips,
    onboard,
    difficulty: {
      current: () => loadDifficulty(),
      set: (mode) => {
        const next = parseDifficulty(mode);
        saveDifficulty(next);
        client.setPlayerPrefs(next, loadDoNotTrack());
        if (!loadDoNotTrack()) client.trackAnalytics('session_start', 0, next);
      },
    },
    weekly: {
      key: () => isoWeekKey(),
      challenge: () => weeklyChallenge(),
      submit: (score) => {
        const name = loadDisplayName()?.name || 'Pilot';
        client.submitWeeklyScore(isoWeekKey(), score, loadDifficulty(), name);
      },
      board: () => client.fetchWeeklyBoard(isoWeekKey()),
    },
    analytics: {
      track: (kind, level = 0) => {
        if (loadDoNotTrack()) return;
        client.trackAnalytics(kind, level, loadDifficulty());
      },
      dnt: () => loadDoNotTrack(),
      setDnt: (on) => {
        saveDoNotTrack(on);
        client.setPlayerPrefs(loadDifficulty(), on);
      },
      funnel: () => client.fetchAnalyticsFunnel(),
    },
    account: {
      isConfigured: () => isAuthConfigured(),
      isSignedIn: () => client.isSignedIn() || !!loadAuthUser(),
      appleEnabled: () => isAppleEnabled(),
      shortId: () => client.shortPlayerId(),
      displayName: () => loadDisplayName()?.name || '',
      prepareAuth: async () => {
        await ensureFirebase();
        bindAuthWatch(client);
      },
      status: () => client.getStatus(),
      guestLabel: () => {
        const user = loadAuthUser();
        if (user) return t('account.signedIn');
        return t('account.guest');
      },
      debug: () => getAuthDebug({
        issuer: tokenIssuerKind(client.connectToken() || loadAuthUser()?.idToken),
      }),
      profile: () => {
        const user = loadAuthUser();
        const username = loadDisplayName()?.name || '';
        return {
          signedIn: !!(user || client.isSignedIn()),
          email: user?.email,
          emailMasked: maskEmail(user?.email),
          googleName: user?.displayName,
          googleNameMasked: maskDisplayName(user?.displayName),
          username,
          uid: user?.uid,
        };
      },
      onChange: (cb) => {
        accountListeners.push(cb);
        return () => {
          const i = accountListeners.indexOf(cb);
          if (i >= 0) accountListeners.splice(i, 1);
        };
      },
      signInGoogle: (opts?: SignInOpts) => {
        if (!isAuthConfigured()) return Promise.reject(new Error('auth_not_configured'));
        authFlowLock = true;
        const snap = snapshotFromGame();
        if (snap) saveAnonSnapshot(snap);
        // signInWithGoogle must start the popup synchronously (no await before it).
        return signInWithGoogle(opts).then(async () => {
          await connectFirebaseIdentity(client, true);
          await afterProgressReady(client);
        }).catch((err: unknown) => {
          if ((err as { message?: string })?.message !== 'redirecting') {
            reportAuthFailure(client, err, opts?.forceRedirect ? 'redirect' : 'popup');
          }
          throw err;
        }).finally(() => {
          authFlowLock = false;
        });
      },
      signInEmulatorGoogle: async (email: string) => {
        if (!isAuthConfigured()) throw new Error('auth_not_configured');
        authFlowLock = true;
        try {
          const snap = snapshotFromGame();
          if (snap) saveAnonSnapshot(snap);
          await signInWithEmulatorGoogle(email);
          await connectFirebaseIdentity(client, true);
          await afterProgressReady(client);
        } finally {
          authFlowLock = false;
        }
      },
      startEmailLink: async (email: string) => {
        if (!isAuthConfigured()) throw new Error('auth_not_configured');
        const snap = snapshotFromGame();
        if (snap) saveAnonSnapshot(snap);
        try {
          await startEmailLink(email);
        } catch (err) {
          reportAuthFailure(client, err, 'emailLink');
          throw err;
        }
      },
      signInApple: (opts?: SignInOpts) => {
        if (!isAuthConfigured()) return Promise.reject(new Error('auth_not_configured'));
        authFlowLock = true;
        const snap = snapshotFromGame();
        if (snap) saveAnonSnapshot(snap);
        return signInWithApple(opts).then(async () => {
          await connectFirebaseIdentity(client, true);
          await afterProgressReady(client);
        }).catch((err: unknown) => {
          if ((err as { message?: string })?.message !== 'redirecting') {
            reportAuthFailure(client, err, opts?.forceRedirect ? 'redirect' : 'popup');
          }
          throw err;
        }).finally(() => {
          authFlowLock = false;
        });
      },
      signOut: async () => {
        importedOnce = false;
        await signOutFirebase();
        await client.restoreGuestIdentity();
        await client.reconcileWithServer();
        applyHigherServerCoins(client);
        notifyAccount();
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
      setAsk: (on: boolean) => coop.setHostApprovalRequired(on),
      playerJoined: () => coop.playerJoined(),
      playerLeft: (id: string) => coop.playerLeft(id),
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

function bindAuthWatch(client: SpacetimeClient): void {
  if (watchBound) return;
  watchBound = true;
  watchAuthState((user) => {
    notifyAccount();
    if (!user || authFlowLock) return;
    void (async () => {
      if (client.connectToken() === user.idToken && client.isSignedIn()) return;
      await connectFirebaseIdentity(client, true);
      await afterProgressReady(client);
    })();
  });
  watchIdToken((user) => {
    if (!user || authFlowLock) return;
    if (!client.isSignedIn()) return;
    void (async () => {
      await client.reconnectWithToken(user.idToken);
      await afterProgressReady(client);
    })();
  });
}

async function init(): Promise<void> {
  console.log('[Weltraum] Initializing SpacetimeDB client...');
  initLanguage();

  const client = getSpacetimeClient();
  setLevelFetcher((level) => {
    adoptGameProgress(client);
    return client.fetchLevelData(level);
  });
  const api = installApi(client);
  window.__weltraum = api;
  api.onSyncStatusChange(() => undefined);
  attachCoopStandIn();
  if (!loadDoNotTrack()) client.trackAnalytics('session_start', 0, loadDifficulty());

  let signed = null as Awaited<ReturnType<typeof completeRedirectIfNeeded>>;
  try {
    if (isAuthConfigured() || needsFirebaseNow() || loadAuthUser()) {
      await ensureFirebase();
      signed = await completeEmailLinkIfNeeded() || await completeRedirectIfNeeded();
    }
  } catch (err) {
    console.warn('[Weltraum] Firebase callback failed', err);
    reportAuthFailure(client, err, 'redirect');
  }

  const connected = await initSpacetime();
  if (connected) {
    console.log('[Weltraum] SpacetimeDB connected', client.getIdentityHex());
    if (signed) {
      await connectFirebaseIdentity(client, true);
    } else if (loadAuthUser()) {
      await mergeAfterSignIn(client);
    }
    await afterProgressReady(client);
    showGameSync('saved');
    notifyAccount();
  } else {
    console.log('[Weltraum] Running in offline mode (local cache)');
    showGameSync('offline');
  }
  if (isAuthConfigured() || needsFirebaseNow() || loadAuthUser()) {
    bindAuthWatch(client);
  }
}

init();

export { t, getLanguage, setLanguage, toggleLanguage };
