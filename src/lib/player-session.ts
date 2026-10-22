/**
 * Account-bound player session: local keys, logout wipe, login replace.
 * Names/coins/ships/levels belong to the signed-in account, not the device.
 */

import { AUTH_STORAGE_KEY, ANON_SNAPSHOT_KEY, GUEST_TOKEN_KEY } from './firebase-auth';
import { DISPLAY_NAME_KEY, GUEST_DISPLAY_NAME_KEY } from './display-names';
import { ONBOARD_KEY } from './onboarding';
import { TIPS_KEY } from './tips';

export const IDENTITY_STORAGE_KEY = 'spaceMissionIdentityToken';
export const LOCAL_CACHE_KEY = 'spaceMissionCachedData';
export const SHOP_KEY = 'spaceMissionShop';
export const PROGRESS_KEY = 'spaceMissionProgress';
export const GHOSTS_KEY = 'spaceMissionGhosts';
export const REC_KEY = 'spaceMissionRec';
export const ACH_KEY = 'spaceMissionAch';
export const BEST_KEY = 'spaceMissionBest';
export const DAILY_KEY = 'spaceMissionDaily';
export const SKIN_KEY = 'spaceMissionSkin';
export const LEGACY_ONBOARD_KEY = 'spaceMissionOnboard';
export const SESSION_CHANNEL = 'weltraum-session';
export const SESSION_TICK_KEY = 'spaceMissionSessionTick';
export const ACCOUNT_GATE_KEY = 'spaceMissionAccountGate';

export const PLAYER_STATE_KEYS = [
  DISPLAY_NAME_KEY,
  LOCAL_CACHE_KEY,
  IDENTITY_STORAGE_KEY,
  AUTH_STORAGE_KEY,
  ANON_SNAPSHOT_KEY,
  GUEST_TOKEN_KEY,
  SHOP_KEY,
  PROGRESS_KEY,
  GHOSTS_KEY,
  REC_KEY,
  ACH_KEY,
  BEST_KEY,
  DAILY_KEY,
  SKIN_KEY,
  ONBOARD_KEY,
  LEGACY_ONBOARD_KEY,
  TIPS_KEY,
  'spaceMissionSecret2',
  'spaceMissionSecretAmelia',
  'spaceMissionSecretMillion',
  'spaceMissionAuthPath',
  'spaceMissionAuthError',
] as const;

/** Device prefs that survive logout. Guest name stays local-only. */
export const DEVICE_KEEP_KEYS = [
  GUEST_DISPLAY_NAME_KEY,
  'spaceMissionLanguage',
  'spaceMissionMuted',
  'spaceMissionDoNotTrack',
  'spaceMissionDifficulty',
  'spaceMissionAskToJoin',
  'spaceMissionGhostOn',
] as const;

export interface AccountSnapshot {
  coins: number;
  unlockedLevel: number;
  ownedShips: string[];
  equippedShip: string;
  upgrades?: Record<string, number>;
  stars?: Record<string, number>;
  best?: Record<string, number>;
  achievements?: string[];
  displayName?: string;
  nameKind?: 'generated' | 'custom';
  onboardDone?: boolean;
}

export interface LocalGameState {
  coins: number;
  unlocked: number;
  ships: string[];
  equipped: string;
  upgrades: Record<string, number>;
  stars: Record<string, number>;
  best: Record<string, number>;
  achievements: string[];
  name: string;
  nameKind: 'generated' | 'custom';
  onboardDone: boolean;
}

export type SessionEventType = 'logout' | 'login';

export interface SessionEvent {
  type: SessionEventType;
  at: number;
}

export function emptyUpgrades(): Record<string, number> {
  return { heart: 0, rate: 0, dmg: 0, dur: 0, mag: 0 };
}

export function freshGuestState(guestName = ''): LocalGameState {
  return {
    coins: 0,
    unlocked: 1,
    ships: ['starter'],
    equipped: 'starter',
    upgrades: emptyUpgrades(),
    stars: {},
    best: {},
    achievements: [],
    name: guestName,
    nameKind: 'generated',
    onboardDone: false,
  };
}

export function snapshotToGameState(remote: AccountSnapshot): LocalGameState {
  const ships = (remote.ownedShips || []).filter(Boolean);
  return {
    coins: Math.max(0, Math.floor(Number(remote.coins) || 0)),
    unlocked: Math.max(1, Math.floor(Number(remote.unlockedLevel) || 1)),
    ships: ships.length ? ships : ['starter'],
    equipped: remote.equippedShip || 'starter',
    upgrades: { ...emptyUpgrades(), ...(remote.upgrades || {}) },
    stars: { ...(remote.stars || {}) },
    best: { ...(remote.best || {}) },
    achievements: [...(remote.achievements || [])],
    name: remote.displayName || '',
    nameKind: remote.nameKind === 'custom' ? 'custom' : 'generated',
    onboardDone: !!remote.onboardDone,
  };
}

export function accountHasProgress(remote: {
  displayName?: string;
  unlockedLevel?: number;
  coins?: bigint | number;
  ownedShips?: string[];
  onboardDone?: boolean;
  achievements?: string[];
}): boolean {
  if (remote.displayName) return true;
  if (remote.onboardDone) return true;
  if ((remote.unlockedLevel || 1) > 1) return true;
  const coins = typeof remote.coins === 'bigint' ? Number(remote.coins) : Number(remote.coins || 0);
  if (coins > 0) return true;
  if ((remote.achievements || []).length > 0) return true;
  return (remote.ownedShips || []).some((s) => s && s !== 'starter');
}

export function guestSnapshotHasProgress(snap: {
  unlockedLevel?: number;
  coins?: number;
  ownedShips?: string[];
} | null | undefined): boolean {
  if (!snap) return false;
  if ((snap.unlockedLevel || 1) > 1) return true;
  if ((snap.coins || 0) > 0) return true;
  return (snap.ownedShips || []).some((s) => s && s !== 'starter');
}

/** Guest progress is imported only for a brand-new account after an explicit yes. */
export function shouldImportGuestProgress(accountReady: boolean, userAgreed: boolean): boolean {
  return !accountReady && userAgreed;
}

export function shouldPushLocalName(signedIn: boolean): boolean {
  return !signedIn;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function clearLocalPlayerState(storage: StorageLike = localStorage): void {
  for (const key of PLAYER_STATE_KEYS) {
    try { storage.removeItem(key); } catch { /* ignore */ }
  }
}

export function restoreGuestDisplayName(storage: StorageLike = localStorage): string {
  try {
    const raw = storage.getItem(GUEST_DISPLAY_NAME_KEY);
    if (!raw) return '';
    storage.setItem(DISPLAY_NAME_KEY, raw);
    const parsed = JSON.parse(raw) as { name?: string };
    return parsed?.name || '';
  } catch {
    return '';
  }
}

export function rememberGuestDisplayName(storage: StorageLike = localStorage): void {
  try {
    const raw = storage.getItem(DISPLAY_NAME_KEY);
    if (!raw) return;
    storage.setItem(GUEST_DISPLAY_NAME_KEY, raw);
  } catch {
    /* ignore */
  }
}

export function postSessionEvent(type: SessionEventType, at = Date.now()): SessionEvent {
  const event: SessionEvent = { type, at };
  try {
    localStorage.setItem(SESSION_TICK_KEY, JSON.stringify(event));
  } catch {
    /* ignore */
  }
  try {
    const ch = new BroadcastChannel(SESSION_CHANNEL);
    ch.postMessage(event);
    ch.close();
  } catch {
    /* ignore */
  }
  return event;
}

export function parseSessionEvent(raw: string | null): SessionEvent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionEvent;
    if (parsed?.type === 'logout' || parsed?.type === 'login') return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function isSessionTickKey(key: string | null): boolean {
  return key === SESSION_TICK_KEY || key === AUTH_STORAGE_KEY;
}
