/**
 * Firebase Auth facade — no Firebase SDK import.
 * The SDK loads via dynamic import() only when Account opens or a session exists.
 *
 * Sign-in must call signInWithPopup synchronously inside the click handler
 * (chunk preloaded). Redirect is only a fallback when the popup is blocked.
 */

export {
  AUTH_PROVIDERS,
  PRODUCTION_APP_HOST,
  FIREBASE_AUTH_PROXY_HOST,
  enabledProviders,
  getFirebaseConfig,
  isAppleEnabled,
  isAuthConfigured,
  resolveAuthDomain,
  setFirebaseEnvForTests,
  tokenIssuerKind,
  type AuthProviderId,
  type FirebaseWebConfig,
} from './firebase-config';

export {
  authErrorCode,
  formatAuthDebugLine,
  getAuthPathUsed,
  getLastAuthErrorCode,
  shouldFallbackToRedirect,
  type AuthDebugSnapshot,
  type AuthPathUsed,
} from './firebase-auth-debug';

import {
  isAuthConfigured,
  setFirebaseEnvForTests,
  tokenIssuerKind,
  type AuthProviderId,
} from './firebase-config';
import {
  clearLastAuthError,
  formatAuthDebugLine,
  getAuthPathUsed,
  getLastAuthErrorCode,
  setAuthPathUsed,
  setLastAuthError,
  type AuthDebugSnapshot,
} from './firebase-auth-debug';
import { importFresh } from './chunk-update';

export const AUTH_STORAGE_KEY = 'spaceMissionFirebaseAuth';
export const ANON_SNAPSHOT_KEY = 'spaceMissionAnonSnapshot';
export const GUEST_TOKEN_KEY = 'spaceMissionGuestIdentityToken';
export const EMAIL_FOR_LINK_KEY = 'spaceMissionEmailForLink';
export const REDIRECT_FLAG_KEY = 'spaceMissionAuthRedirect';

export interface AuthUser {
  idToken: string;
  expiresAt: number;
  uid: string;
  email?: string;
  displayName?: string;
  provider?: AuthProviderId | string;
}

export interface ProgressSnapshot {
  unlockedLevel: number;
  coins: number;
  equippedShip: string;
  ownedShips: string[];
  upgrades: Record<string, number>;
  stars: Record<string, number>;
  best: Record<string, number>;
  language: string;
}

export interface SignInOpts {
  forceRedirect?: boolean;
}

export function loadAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as AuthUser;
    if (!user.idToken) return null;
    return user;
  } catch {
    return null;
  }
}

export function saveAuthUser(user: AuthUser): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuthUser(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function loadGuestToken(): string | null {
  try {
    return localStorage.getItem(GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveGuestToken(token: string): void {
  try {
    if (!token) return;
    if (!localStorage.getItem(GUEST_TOKEN_KEY)) {
      localStorage.setItem(GUEST_TOKEN_KEY, token);
    }
  } catch {
    // ignore
  }
}

export function loadAnonSnapshot(): ProgressSnapshot | null {
  try {
    const raw = localStorage.getItem(ANON_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProgressSnapshot;
  } catch {
    return null;
  }
}

export function saveAnonSnapshot(snapshot: ProgressSnapshot): void {
  localStorage.setItem(ANON_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function clearAnonSnapshot(): void {
  try { localStorage.removeItem(ANON_SNAPSHOT_KEY); } catch { /* ignore */ }
}

type AuthImpl = typeof import('./firebase-auth-impl');
let implPromise: Promise<AuthImpl> | null = null;
let implReady: AuthImpl | null = null;

export function markRedirectPending(): void {
  try { sessionStorage.setItem(REDIRECT_FLAG_KEY, '1'); } catch { /* ignore */ }
}

export function clearRedirectPending(): void {
  try { sessionStorage.removeItem(REDIRECT_FLAG_KEY); } catch { /* ignore */ }
}

export function hasRedirectPending(): boolean {
  try {
    if (sessionStorage.getItem(REDIRECT_FLAG_KEY) === '1') return true;
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i) || '';
      if (/pendingRedirect|firebase/i.test(k)) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function maskEmail(email?: string): string {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!domain) return `${email.slice(0, 2)}…`;
  const keep = Math.min(2, user.length);
  return `${user.slice(0, keep)}…@${domain}`;
}

export function maskDisplayName(name?: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.length <= 3) return `${trimmed[0] || ''}…`;
  return `${trimmed.slice(0, 2)}…${trimmed.slice(-1)}`;
}

export function needsFirebaseNow(): boolean {
  if (loadAuthUser()) return true;
  if (hasRedirectPending()) return true;
  if (typeof window === 'undefined') return false;
  const href = window.location.href;
  return /[?&#](oobCode|apiKey|mode)=/.test(href) || href.includes('firebase');
}

export function ensureFirebase(): Promise<AuthImpl> {
  if (!implPromise) {
    implPromise = importFresh(() => import('./firebase-auth-impl')).then((impl) => {
      implReady = impl;
      return impl;
    }).catch((err) => {
      implPromise = null;
      throw err;
    });
  }
  return implPromise;
}

/** Sync peek — used so Sign in with Google can start a popup without awaiting import(). */
export function peekFirebase(): AuthImpl | null {
  return implReady;
}

export function isFirebaseReady(): boolean {
  return implReady !== null;
}

export function getAuthDebug(opts?: {
  firebaseUser?: boolean;
  issuer?: AuthDebugSnapshot['issuer'];
}): AuthDebugSnapshot {
  const impl = peekFirebase();
  const liveUser = !!impl?.getFirebaseAuth()?.currentUser;
  return {
    path: getAuthPathUsed(),
    lastError: getLastAuthErrorCode(),
    firebaseUser: opts?.firebaseUser ?? (liveUser || !!loadAuthUser()),
    issuer: opts?.issuer ?? tokenIssuerKind(loadAuthUser()?.idToken),
  };
}

export function authDebugLine(opts?: {
  firebaseUser?: boolean;
  issuer?: AuthDebugSnapshot['issuer'];
}): string {
  return formatAuthDebugLine(getAuthDebug(opts));
}

export async function completeRedirectIfNeeded(): Promise<AuthUser | null> {
  if (!needsFirebaseNow()) return loadAuthUser();
  const impl = await ensureFirebase();
  try {
    const user = await impl.completeRedirectIfNeeded();
    clearRedirectPending();
    return user;
  } catch (err) {
    setLastAuthError(err);
    clearRedirectPending();
    throw err;
  }
}

export async function completeEmailLinkIfNeeded(): Promise<AuthUser | null> {
  if (!needsFirebaseNow()) return loadAuthUser();
  const impl = await ensureFirebase();
  return impl.completeEmailLinkIfNeeded();
}

/**
 * Starts Google sign-in. When the auth chunk is preloaded this calls
 * signInWithPopup synchronously (no await before the popup). Redirect
 * only if the popup is actually blocked or the chunk is not ready yet.
 */
export function signInWithGoogle(opts?: SignInOpts): Promise<AuthUser> {
  const impl = peekFirebase();
  if (impl) return impl.signInWithGoogle(opts);
  setAuthPathUsed('redirect');
  setLastAuthError({ code: 'auth/popup-blocked', message: 'firebase-chunk-not-ready' });
  markRedirectPending();
  return ensureFirebase().then((ready) => ready.signInWithGoogle({ forceRedirect: true }));
}

export async function startEmailLink(email: string): Promise<void> {
  const impl = await ensureFirebase();
  return impl.startEmailLink(email);
}

export async function signInWithEmulatorGoogle(email: string): Promise<AuthUser> {
  const impl = await ensureFirebase();
  return impl.signInWithEmulatorGoogle(email);
}

export function signInWithApple(opts?: SignInOpts): Promise<AuthUser> {
  const impl = peekFirebase();
  if (impl) return impl.signInWithApple(opts);
  setAuthPathUsed('redirect');
  setLastAuthError({ code: 'auth/popup-blocked', message: 'firebase-chunk-not-ready' });
  markRedirectPending();
  return ensureFirebase().then((ready) => ready.signInWithApple({ forceRedirect: true }));
}

export async function signOutFirebase(): Promise<void> {
  if (!implPromise && !loadAuthUser()) {
    clearAuthUser();
    return;
  }
  const impl = await ensureFirebase();
  return impl.signOutFirebase();
}

export function watchAuthState(onUser: (user: AuthUser | null) => void): () => void {
  let unsub: () => void = () => {};
  void ensureFirebase().then((impl) => {
    unsub = impl.watchAuthState(onUser);
  });
  return () => unsub();
}

export function watchIdToken(onToken: (user: AuthUser | null) => void): () => void {
  let unsub: () => void = () => {};
  void ensureFirebase().then((impl) => {
    unsub = impl.watchIdToken(onToken);
  });
  return () => unsub();
}

export async function currentIdToken(forceRefresh = false): Promise<string | null> {
  if (!loadAuthUser() && !implPromise) return null;
  const impl = await ensureFirebase();
  return impl.currentIdToken(forceRefresh);
}

export async function resetFirebaseForTests(): Promise<void> {
  setFirebaseEnvForTests(null);
  clearLastAuthError();
  setAuthPathUsed('none');
  if (!implPromise) {
    implReady = null;
    return;
  }
  const impl = await implPromise;
  await impl.resetFirebaseForTests();
  implPromise = null;
  implReady = null;
}
