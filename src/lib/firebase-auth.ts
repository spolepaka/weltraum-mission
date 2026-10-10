/**
 * Firebase Auth for parent sign-in (Google + email link).
 * Apple is wired but off unless VITE_FIREBASE_APPLE_ENABLED=1.
 *
 * Official SpacetimeDB SDK authenticates with `.withToken(firebaseIdToken)`.
 * Guest/anonymous play works when Firebase env is unset.
 */

import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onIdTokenChanged,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';

export const AUTH_STORAGE_KEY = 'spaceMissionFirebaseAuth';
export const ANON_SNAPSHOT_KEY = 'spaceMissionAnonSnapshot';
export const GUEST_TOKEN_KEY = 'spaceMissionGuestIdentityToken';
export const EMAIL_FOR_LINK_KEY = 'spaceMissionEmailForLink';

export type AuthProviderId = 'google' | 'emailLink' | 'apple';

/** Add a provider here; gate optional ones with envFlag (Apple is off by default). */
export const AUTH_PROVIDERS: { id: AuthProviderId; envFlag?: string }[] = [
  { id: 'google' },
  { id: 'emailLink' },
  { id: 'apple', envFlag: 'VITE_FIREBASE_APPLE_ENABLED' },
];

export interface AuthUser {
  idToken: string;
  expiresAt: number;
  uid: string;
  email?: string;
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

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
}

function viteEnv(name: string): string | undefined {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    if (env?.[name]) return env[name];
  } catch {
    // not a Vite runtime
  }
  try {
    return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  } catch {
    return undefined;
  }
}

export function getFirebaseConfig(): FirebaseWebConfig | null {
  const apiKey = viteEnv('VITE_FIREBASE_API_KEY');
  const authDomain = viteEnv('VITE_FIREBASE_AUTH_DOMAIN');
  const projectId = viteEnv('VITE_FIREBASE_PROJECT_ID');
  const appId = viteEnv('VITE_FIREBASE_APP_ID');
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: viteEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    storageBucket: viteEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  };
}

export function isAuthConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

export function isAppleEnabled(): boolean {
  return viteEnv('VITE_FIREBASE_APPLE_ENABLED') === '1' || viteEnv('VITE_FIREBASE_APPLE_ENABLED') === 'true';
}

export function enabledProviders(): AuthProviderId[] {
  return AUTH_PROVIDERS
    .filter((p) => !p.envFlag || viteEnv(p.envFlag) === '1' || viteEnv(p.envFlag) === 'true')
    .map((p) => p.id);
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

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let emulatorBound = false;

export function getFirebaseAuth(): Auth | null {
  const config = getFirebaseConfig();
  if (!config) return null;
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(config);
    auth = getAuth(app);
    const emu = viteEnv('VITE_FIREBASE_AUTH_EMULATOR');
    if (emu && !emulatorBound) {
      connectAuthEmulator(auth, emu, { disableWarnings: true });
      emulatorBound = true;
    }
  }
  return auth;
}

function preferRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    // ignore
  }
  const ua = nav.userAgent || '';
  const iPad = /iPad/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const iPhone = /iPhone|iPod/.test(ua);
  return iPad || iPhone;
}

function isPopupBlocked(err: unknown): boolean {
  const code = (err as { code?: string })?.code || '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/operation-not-supported-in-this-environment'
  );
}

async function userToAuthUser(user: User, provider?: AuthProviderId | string): Promise<AuthUser> {
  const idToken = await user.getIdToken();
  const tokenResult = await user.getIdTokenResult();
  const exp = tokenResult.expirationTime ? Date.parse(tokenResult.expirationTime) / 1000 : Math.floor(Date.now() / 1000) + 3600;
  return {
    idToken,
    expiresAt: exp,
    uid: user.uid,
    email: user.email || undefined,
    provider: provider || user.providerData[0]?.providerId,
  };
}

export async function completeRedirectIfNeeded(): Promise<AuthUser | null> {
  const a = getFirebaseAuth();
  if (!a) return loadAuthUser();
  try {
    const result = await getRedirectResult(a);
    if (result?.user) {
      const pid = result.providerId || result.user.providerData[0]?.providerId || 'google';
      const mapped: AuthProviderId = pid === 'apple.com' ? 'apple' : pid === 'password' ? 'emailLink' : 'google';
      const user = await userToAuthUser(result.user, mapped);
      saveAuthUser(user);
      return user;
    }
  } catch (err) {
    console.warn('[FirebaseAuth] redirect result failed', err);
  }
  return loadAuthUser();
}

export async function completeEmailLinkIfNeeded(): Promise<AuthUser | null> {
  const a = getFirebaseAuth();
  if (!a || typeof window === 'undefined') return loadAuthUser();
  if (!isSignInWithEmailLink(a, window.location.href)) return loadAuthUser();
  const email = localStorage.getItem(EMAIL_FOR_LINK_KEY) || window.prompt('Email for sign-in link') || '';
  if (!email) throw new Error('email_required');
  const cred = await signInWithEmailLink(a, email, window.location.href);
  localStorage.removeItem(EMAIL_FOR_LINK_KEY);
  const user = await userToAuthUser(cred.user, 'emailLink');
  saveAuthUser(user);
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  window.history.replaceState({}, '', url.pathname);
  return user;
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('auth_not_configured');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (preferRedirect()) {
    await signInWithRedirect(a, provider);
    throw new Error('redirecting');
  }
  try {
    const cred = await signInWithPopup(a, provider);
    const user = await userToAuthUser(cred.user, 'google');
    saveAuthUser(user);
    return user;
  } catch (err) {
    if (isPopupBlocked(err) || preferRedirect()) {
      await signInWithRedirect(a, provider);
      throw new Error('redirecting');
    }
    throw err;
  }
}

export async function startEmailLink(email: string): Promise<void> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('auth_not_configured');
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@')) throw new Error('invalid_email');
  localStorage.setItem(EMAIL_FOR_LINK_KEY, trimmed);
  await sendSignInLinkToEmail(a, trimmed, {
    url: `${window.location.origin}/`,
    handleCodeInApp: true,
  });
}

export async function signInWithApple(): Promise<AuthUser> {
  if (!isAppleEnabled()) throw new Error('apple_disabled');
  const a = getFirebaseAuth();
  if (!a) throw new Error('auth_not_configured');
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  if (preferRedirect()) {
    await signInWithRedirect(a, provider);
    throw new Error('redirecting');
  }
  try {
    const cred = await signInWithPopup(a, provider);
    const user = await userToAuthUser(cred.user, 'apple');
    saveAuthUser(user);
    return user;
  } catch (err) {
    if (isPopupBlocked(err)) {
      await signInWithRedirect(a, provider);
      throw new Error('redirecting');
    }
    throw err;
  }
}

export async function signOutFirebase(): Promise<void> {
  const a = getFirebaseAuth();
  if (a) {
    try { await firebaseSignOut(a); } catch { /* ignore */ }
  }
  clearAuthUser();
}

export function watchIdToken(onToken: (user: AuthUser | null) => void): () => void {
  const a = getFirebaseAuth();
  if (!a) return () => undefined;
  return onIdTokenChanged(a, async (fbUser) => {
    if (!fbUser) {
      onToken(null);
      return;
    }
    const user = await userToAuthUser(fbUser);
    const prev = loadAuthUser();
    if (prev?.idToken === user.idToken) return;
    saveAuthUser(user);
    onToken(user);
  });
}

export async function currentIdToken(forceRefresh = false): Promise<string | null> {
  const a = getFirebaseAuth();
  const user = a?.currentUser;
  if (!user) return loadAuthUser()?.idToken ?? null;
  const token = await user.getIdToken(forceRefresh);
  const mapped = await userToAuthUser(user);
  mapped.idToken = token;
  saveAuthUser(mapped);
  return token;
}

/** Test-only: drop the cached Firebase app so the next call re-reads env. */
export async function resetFirebaseForTests(): Promise<void> {
  const apps = getApps();
  await Promise.all(apps.map((a) => deleteApp(a).catch(() => undefined)));
  app = null;
  auth = null;
  emulatorBound = false;
}
