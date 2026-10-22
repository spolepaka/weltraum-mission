/**
 * Vite entry loaded by the game HTML.
 * Connects the official SpacetimeDB SDK and routes save/load, level
 * start/complete, purchases, codes, co-op security, and Firebase Auth.
 */

import { initLanguage, getLanguage, setLanguage, toggleLanguage, t, onLanguageChange, getCatalog } from './i18n';
import { initSpacetime, getSpacetimeClient, type SyncStatus, type SpacetimeClient, type RemoteProgress } from './lib/spacetime-client';
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
import { peerIceConfig } from './lib/peer-ice';
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
  saveGuestDisplayName,
  clearDisplayName,
  validateDisplayName,
  type NameKind,
} from './lib/display-names';
import {
  ACCOUNT_GATE_KEY,
  accountHasProgress,
  clearLocalPlayerState,
  guestSnapshotHasProgress,
  postSessionEvent,
  rememberGuestDisplayName,
  restoreGuestDisplayName,
  shouldPushLocalName,
  snapshotToGameState,
} from './lib/player-session';
import * as tips from './lib/tips';
import * as onboard from './lib/onboarding';
import { loadDifficulty, saveDifficulty, parseDifficulty, type Difficulty } from './lib/difficulty';
import { isoWeekKey, weeklyChallenge } from './lib/weekly';
import { loadDoNotTrack, saveDoNotTrack, type AnalyticsKind } from './lib/analytics';
import { clearSoftReloadGuard, installChunkUpdateHandlers } from './lib/chunk-update';
import { isAutomatedClient, isBotUserAgent, verifyGeo } from './lib/geo-privacy';
import * as aim from './lib/aim-target';
import * as roomList from './lib/room-list';
import * as roomJoin from './lib/room-join';
import * as migrate from './lib/host-migrate';
import * as economy from './lib/economy';
import * as versus from './lib/versus';
import * as versusQueue from './lib/versus-queue';
import * as achievementsSync from './lib/achievements-sync';
import { formatOnlineBadge, inferOnlineActivity, shouldShowOnlineBadge } from './lib/online-now';
import { ROADSTERS } from './lib/roadsters';
import { drawRoadster } from './lib/roadster-draw';
import * as roadsterNet from './lib/roadster-net';
import {
  boostCooldown,
  boostDuration,
  boostInvuln,
  canStartBoost,
  flipsOnBoost,
  isRollInvulnerable,
  isUnderside,
  rollDuration,
  rollEase,
  rollScaleX,
  startRoadsterBoost,
  steerJetSign,
} from './lib/roadster-boost';

const rooms = { ...roomList, ...roomJoin };

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
  aim: typeof aim;
  rooms: typeof rooms;
  migrate: typeof migrate;
  economy: typeof economy;
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
  onClaimShip: (shipId: string) => void;
  roadsters: {
    list: typeof ROADSTERS;
    draw: typeof drawRoadster;
    boost: {
      start: typeof startRoadsterBoost;
      can: typeof canStartBoost;
      scaleX: typeof rollScaleX;
      ease: typeof rollEase;
      underside: typeof isUnderside;
      safe: typeof isRollInvulnerable;
      jetSign: typeof steerJetSign;
      cd: typeof boostCooldown;
      dur: typeof boostDuration;
      invuln: typeof boostInvuln;
      flips: typeof flipsOnBoost;
      rollDur: typeof rollDuration;
    };
    net: typeof roadsterNet;
  };
  versus: typeof versus & typeof versusQueue;
  achievements: typeof achievementsSync;
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
    peerIce: ReturnType<typeof peerIceConfig>;
  names: {
    current: () => { name: string; kind: NameKind } | null;
    generate: (lang?: 'en' | 'de') => string;
    choices: (lang?: 'en' | 'de', count?: number) => string[];
    validate: (name: string, kind: NameKind) => { ok: true; name: string } | { ok: false; reason: string };
    save: (name: string, kind: NameKind) => Promise<{ ok: true; name: string } | { ok: false; reason: string }>;
    needsPick: () => boolean;
  };
  tips: typeof tips;
  onboard: typeof onboard;
  ensureCloud: () => Promise<boolean>;
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
    importGuestIfAgreed: (agreed: boolean) => Promise<void>;
    pendingImport: () => boolean;
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
      applyRemoteProgress?: (p: {
        coins?: number;
        unlocked?: number;
        ships?: string[];
        equipped?: string;
        name?: string;
        upgrades?: Record<string, number>;
        stars?: Record<string, number>;
        best?: Record<string, number>;
        achievements?: string[];
        onboardDone?: boolean;
        replace?: boolean;
      }) => void;
      resetToFreshPlayer?: (guestName?: string) => void;
      applyAccountSnapshot?: (p: Record<string, unknown>) => void;
      askImportGuest?: (title: string, body: string, yes: string, no: string) => Promise<boolean>;
      coop?: Record<string, unknown>;
      onlineActivity?: () => string;
      net?: () => { role?: string | null; inGame?: boolean };
      state?: () => { state?: string };
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
let pendingGuestHex = '';
let pendingGuestSnap: ProgressSnapshot | null = null;
let pendingImport = false;
let cloudReady = false;
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

function setAccountGate(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(ACCOUNT_GATE_KEY, '1');
    else sessionStorage.removeItem(ACCOUNT_GATE_KEY);
  } catch { /* ignore */ }
  const el = typeof document !== 'undefined' ? document.getElementById('sessionGate') : null;
  if (el) el.classList.toggle('hidden', !on);
}

async function afterProgressReady(client: SpacetimeClient): Promise<void> {
  if (loadAuthUser()) {
    await applySignedInAccount(client, false);
    return;
  }
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
  pushLocalName(client);
  await client.reconcileWithServer();
  applyHigherServerCoins(client);
  const cap = Math.max(unlocked, client.getLocalData().unlockedLevel || 1);
  prefetchUnlocked(cap);
  notifyAccount();
}

function pushLocalName(client: SpacetimeClient): void {
  if (!shouldPushLocalName(!!loadAuthUser())) return;
  const local = loadDisplayName();
  if (local?.name) client.setDisplayName(local.name, local.kind === 'custom' ? 'custom' : 'generated');
}

function applyServerTruth(client: SpacetimeClient, remote: RemoteProgress): void {
  client.replaceWithServer(remote);
  if (remote.displayName) {
    saveDisplayName({ name: remote.displayName, kind: remote.nameKind === 'custom' ? 'custom' : 'generated' });
  } else {
    clearDisplayName();
  }
  const game = window.__spaceGame;
  const state = snapshotToGameState({
    coins: Number(remote.coins),
    unlockedLevel: remote.unlockedLevel,
    ownedShips: remote.ownedShips,
    equippedShip: remote.equippedShip,
    upgrades: remote.upgrades,
    stars: remote.stars,
    achievements: remote.achievements,
    displayName: remote.displayName,
    nameKind: remote.nameKind,
    onboardDone: remote.onboardDone,
  });
  if (typeof game?.applyRemoteProgress === 'function') {
    game.applyRemoteProgress({
      coins: state.coins,
      unlocked: state.unlocked,
      ships: state.ships,
      equipped: state.equipped,
      name: state.name,
      upgrades: state.upgrades,
      stars: state.stars,
      achievements: state.achievements,
      onboardDone: state.onboardDone,
      replace: true,
    });
  }
  if (remote.onboardDone) {
    onboard.markAllDone(onboard.loadOnboard(), true);
    tips.saveTips({ ...tips.loadTips(), onboardDone: true, skipAll: true });
  }
}

async function applySignedInAccount(client: SpacetimeClient, allowImportPrompt: boolean): Promise<void> {
  client.ensurePlayerRow();
  await client.reconcileWithServer({ replace: true });
  const remote = await client.fetchMyProgress();
  if (remote) applyServerTruth(client, remote);
  const ready = remote ? accountHasProgress(remote) : false;
  pendingImport = allowImportPrompt && !ready && guestSnapshotHasProgress(pendingGuestSnap || loadAnonSnapshot());
  if (!pendingImport) {
    pendingGuestHex = '';
    pendingGuestSnap = null;
    clearAnonSnapshot();
  }
  prefetchUnlocked(Math.max(1, remote?.unlockedLevel || 1));
  notifyAccount();
  setAccountGate(false);
}

async function importGuestIfAgreed(client: SpacetimeClient, agreed: boolean): Promise<void> {
  const snap = pendingGuestSnap || loadAnonSnapshot();
  const hex = pendingGuestHex;
  pendingImport = false;
  pendingGuestSnap = null;
  pendingGuestHex = '';
  clearAnonSnapshot();
  if (!agreed || !snap) return;
  const latest = await client.fetchMyProgress();
  if (latest && accountHasProgress(latest)) return;
  importedOnce = true;
  client.importProgress(snap);
  if (hex) client.linkGuestIdentity(hex);
  await new Promise((r) => setTimeout(r, 200));
  await client.reconcileWithServer({ replace: true });
  const remote = await client.fetchMyProgress();
  if (remote) applyServerTruth(client, remote);
  notifyAccount();
}

async function connectFirebaseIdentity(client: SpacetimeClient, firstSignIn: boolean): Promise<void> {
  const user = loadAuthUser();
  if (!user?.idToken) return;
  setAccountGate(true);
  if (firstSignIn && !pendingGuestSnap) {
    pendingGuestHex = client.getIdentityHex() || pendingGuestHex;
    pendingGuestSnap = loadAnonSnapshot() || snapshotFromGame() || null;
    if (pendingGuestSnap) saveAnonSnapshot(pendingGuestSnap);
  }
  await client.reconnectWithToken(user.idToken);
  bindAuthWatch(client);
  if (!loadDoNotTrack()) client.trackAnalytics('sign_in', 0, loadDifficulty());
  importedOnce = false;
  await applySignedInAccount(client, firstSignIn);
}

function pageIsLocal(): boolean {
  try {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return true;
    const q = new URLSearchParams(window.location.search);
    const host = `${q.get('stdb_host') || ''} ${q.get('server') || ''}`;
    return host.includes('localhost') || host.includes('127.0.0.1');
  } catch {
    return false;
  }
}

function welcomeIsDone(): boolean {
  try {
    const v1 = localStorage.getItem('spaceMissionOnboardV1');
    if (v1 && /"welcomeDone"\s*:\s*true/.test(v1)) return true;
    const raw = localStorage.getItem('spaceMissionOnboard');
    return !!(raw && /"welcomeDone"\s*:\s*true/.test(raw));
  } catch {
    return false;
  }
}

function shouldAutoconnect(): boolean {
  if (isAutomatedClient() && !pageIsLocal()) return false;
  if (pageIsLocal()) return true;
  if (loadAuthUser()) return true;
  if (welcomeIsDone()) return true;
  return false;
}

async function sendPresence(client: SpacetimeClient): Promise<void> {
  if (loadDoNotTrack() || isBotUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : '')) return;
  try {
    const res = await fetch('/api/geo', { cache: 'no-store' });
    if (!res.ok) return;
    const body = await res.json() as { country?: string; region?: string; city?: string; ipTrunc?: string; ipFull?: string; iat?: number; sig?: string };
    if (!body.sig || !verifyGeo({
      country: body.country || '',
      region: body.region || '',
      city: body.city || '',
      ipTrunc: body.ipTrunc || '',
      iat: body.iat || 0,
      sig: body.sig,
    })) return;
    client.reportPresence({
      country: body.country || '',
      region: body.region || '',
      city: body.city || '',
      ipTrunc: body.ipTrunc || '',
      ipFull: body.ipFull || '',
      iat: body.iat || 0,
      sig: body.sig,
      userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 160),
    });
  } catch {
    // geo is optional
  }
}

async function ensureCloudAndReady(client: SpacetimeClient): Promise<boolean> {
  const ok = client.isConnected() || await initSpacetime();
  if (!ok) return false;
  if (!cloudReady) {
    cloudReady = true;
    client.ensurePlayerRow();
    pushLocalName(client);
    void sendPresence(client);
    await afterProgressReady(client);
  }
  return true;
}

function installApi(client: SpacetimeClient): WeltraumApi {
  const api: WeltraumApi = {
    i18n: { t, getLanguage, setLanguage, toggleLanguage, onLanguageChange, getCatalog },
    spacetime: client,
    coop,
    aim,
    rooms,
    migrate,
    economy,
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
    onClaimShip: (shipId) => {
      client.addOwnedShip(shipId);
      client.equipShip(shipId);
    },
    peerIce: peerIceConfig(),
    roadsters: {
      list: ROADSTERS,
      draw: drawRoadster,
      boost: {
        start: startRoadsterBoost,
        can: canStartBoost,
        scaleX: rollScaleX,
        ease: rollEase,
        underside: isUnderside,
        safe: isRollInvulnerable,
        jetSign: steerJetSign,
        cd: boostCooldown,
        dur: boostDuration,
        invuln: boostInvuln,
        flips: flipsOnBoost,
        rollDur: rollDuration,
      },
      net: roadsterNet,
    },
    versus: { ...versus, ...versusQueue },
    achievements: achievementsSync,
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
      needsPick: () => !!loadAuthUser() && !loadDisplayName()?.name,
      save: async (name, kind) => {
        const checked = validateDisplayName(name, kind);
        if (!checked.ok) return checked;
        if (loadAuthUser()) {
          await ensureCloudAndReady(client);
          const claimed = await client.claimDisplayName(checked.name, kind);
          if (!claimed.ok) return { ok: false, reason: claimed.reason || 'taken' };
          saveDisplayName({ name: claimed.name || checked.name, kind });
          notifyAccount();
          return { ok: true, name: claimed.name || checked.name };
        }
        saveDisplayName({ name: checked.name, kind });
        saveGuestDisplayName({ name: checked.name, kind });
        client.setDisplayName(checked.name, kind);
        void ensureCloudAndReady(client);
        notifyAccount();
        return checked;
      },
    },
    tips,
    onboard: {
      ...onboard,
      markMapTour: (state, skipped = false) => {
        const next = onboard.markMapTour(state, skipped);
        if (loadAuthUser()) client.setOnboardDone(true);
        return next;
      },
      markAllDone: (state, skipped = true) => {
        const next = onboard.markAllDone(state, skipped);
        if (loadAuthUser()) client.setOnboardDone(true);
        return next;
      },
    },
    ensureCloud: () => ensureCloudAndReady(client),
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
        rememberGuestDisplayName();
        setAccountGate(true);
        const snap = snapshotFromGame();
        if (snap) saveAnonSnapshot(snap);
        pendingGuestSnap = snap || null;
        pendingGuestHex = client.getIdentityHex() || pendingGuestHex;
        return signInWithGoogle(opts).then(async () => {
          await connectFirebaseIdentity(client, true);
          postSessionEvent('login');
        }).catch((err: unknown) => {
          setAccountGate(false);
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
          rememberGuestDisplayName();
          setAccountGate(true);
          const snap = snapshotFromGame();
          if (snap) saveAnonSnapshot(snap);
          pendingGuestSnap = snap || null;
          pendingGuestHex = client.getIdentityHex() || pendingGuestHex;
          await signInWithEmulatorGoogle(email);
          await connectFirebaseIdentity(client, true);
          postSessionEvent('login');
        } catch (err) {
          setAccountGate(false);
          throw err;
        } finally {
          authFlowLock = false;
        }
      },
      startEmailLink: async (email: string) => {
        if (!isAuthConfigured()) throw new Error('auth_not_configured');
        rememberGuestDisplayName();
        const snap = snapshotFromGame();
        if (snap) saveAnonSnapshot(snap);
        pendingGuestSnap = snap || null;
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
        rememberGuestDisplayName();
        setAccountGate(true);
        const snap = snapshotFromGame();
        if (snap) saveAnonSnapshot(snap);
        pendingGuestSnap = snap || null;
        pendingGuestHex = client.getIdentityHex() || pendingGuestHex;
        return signInWithApple(opts).then(async () => {
          await connectFirebaseIdentity(client, true);
          postSessionEvent('login');
        }).catch((err: unknown) => {
          setAccountGate(false);
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
        pendingImport = false;
        pendingGuestSnap = null;
        pendingGuestHex = '';
        await signOutFirebase();
        client.clearLocalPlayerCache();
        clearLocalPlayerState();
        const guestName = restoreGuestDisplayName();
        window.__spaceGame?.resetToFreshPlayer?.(guestName);
        postSessionEvent('logout');
        notifyAccount();
        try { window.location.reload(); } catch { /* ignore */ }
      },
      importGuestIfAgreed: (agreed: boolean) => importGuestIfAgreed(client, agreed),
      pendingImport: () => pendingImport,
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
      checkJoinAllowed: (id: string) => coop.checkJoinAllowed(id),
      reset: () => coop.resetCoopSecurity(),
      setAsk: (on: boolean) => coop.setHostApprovalRequired(on),
      playerJoined: (id?: string) => coop.playerJoined(id),
      playerLeft: (id: string) => coop.playerLeft(id),
      setOccupancy: (n: number) => coop.setOccupancy(n),
      occupied: () => coop.getState().currentPlayers,
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

function currentOnlineActivity(): string {
  const game = window.__spaceGame;
  if (game && typeof game.onlineActivity === 'function') return game.onlineActivity();
  const net = game?.net?.();
  const playing = game?.state?.()?.state === 'play' || game?.state?.()?.state === 'dying' || game?.state?.()?.state === 'sucked';
  return inferOnlineActivity({ versus: false, netRole: net?.role, playing });
}

function paintOnlineNowBadge(total: number, isAdmin: boolean): void {
  const text = formatOnlineBadge(total, t('onlineNow', { n: total }));
  const show = shouldShowOnlineBadge(isAdmin);
  for (const id of ['onlineNowHud', 'onlineNowMap']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.textContent = text;
    el.classList.toggle('hidden', !show);
  }
}

function startOnlineNowWatch(client: SpacetimeClient): void {
  const tick = async () => {
    const name = loadDisplayName()?.name || 'Pilot';
    const activity = currentOnlineActivity();
    client.setOnlinePresence(activity, name);
    if (!client.isConnected()) {
      paintOnlineNowBadge(0, false);
      return;
    }
    client.heartbeatOnline(activity, name);
    const snap = await client.getOnlineNow();
    paintOnlineNowBadge(snap?.total || 0, !!snap?.admin);
  };
  void tick();
  setInterval(() => { void tick(); }, 5000);
  client.onStatusChange((status) => {
    if (status === 'connected') void tick();
    if (status === 'disconnected' || status === 'offline' || status === 'error') paintOnlineNowBadge(0, false);
  });
  onLanguageChange(() => { void tick(); });
}

async function init(): Promise<void> {
  console.log('[Weltraum] Initializing SpacetimeDB client...');
  installChunkUpdateHandlers();
  initLanguage();
  if (loadAuthUser()) setAccountGate(true);

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
    if (needsFirebaseNow()) {
      await ensureFirebase();
      signed = await completeEmailLinkIfNeeded() || await completeRedirectIfNeeded();
    }
  } catch (err) {
    console.warn('[Weltraum] Firebase callback failed', err);
    reportAuthFailure(client, err, 'redirect');
  }

  const connected = shouldAutoconnect() ? await initSpacetime() : false;
  if (connected) {
    console.log('[Weltraum] SpacetimeDB connected', client.getIdentityHex());
    if (signed || loadAuthUser()) {
      await connectFirebaseIdentity(client, !!signed);
      await ensureCloudAndReady(client);
    } else if (welcomeIsDone()) {
      await ensureCloudAndReady(client);
    } else {
      showGameSync('saved');
    }
    notifyAccount();
  } else {
    console.log('[Weltraum] Running in offline mode (local cache)');
    showGameSync('offline');
  }
  if (needsFirebaseNow()) {
    bindAuthWatch(client);
  }
  startOnlineNowWatch(client);
  clearSoftReloadGuard();
}

init();

export { t, getLanguage, setLanguage, toggleLanguage };
