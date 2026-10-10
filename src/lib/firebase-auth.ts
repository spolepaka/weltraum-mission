/**
 * Firebase Auth facade — no Firebase SDK import.
 * The SDK loads via dynamic import() only when Account opens or a session exists.
 */

export const AUTH_STORAGE_KEY = 'spaceMissionFirebaseAuth';
export const ANON_SNAPSHOT_KEY = 'spaceMissionAnonSnapshot';
export const GUEST_TOKEN_KEY = 'spaceMissionGuestIdentityToken';
export const EMAIL_FOR_LINK_KEY = 'spaceMissionEmailForLink';
export const REDIRECT_FLAG_KEY = 'spaceMissionAuthRedirect';

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

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
}

let testEnvOverride: Record<string, string | undefined> | null = null;

/** Test-only: pin or clear VITE_FIREBASE_* without depending on the process env. */
export function setFirebaseEnvForTests(env: Record<string, string | undefined> | null): void {
  testEnvOverride = env;
}

function viteEnv(name: string): string | undefined {
  if (testEnvOverride && Object.prototype.hasOwnProperty.call(testEnvOverride, name)) {
    const pinned = testEnvOverride[name];
    return pinned || undefined;
  }
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

function errCode(err: unknown): string {
  return String((err as { code?: string })?.code || '');
}

function errMessage(err: unknown): string {
  return String((err as { message?: string })?.message || err || '');
}

/** Popup failed in a way that redirect can recover (iPad Safari, CSP, blocker). */
export function shouldFallbackToRedirect(err: unknown): boolean {
  const code = errCode(err);
  const msg = errMessage(err);
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/internal-error' ||
    /auth\/internal-error/i.test(msg) ||
    /popup-blocked/i.test(msg) ||
    /popup-closed/i.test(msg)
  );
}

type AuthImpl = typeof import('./firebase-auth-impl');
let implPromise: Promise<AuthImpl> | null = null;

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
  if (typeof window === 'undefined') return false;
  const href = window.location.href;
  if (/[?&#](oobCode|apiKey|mode)=/.test(href) || href.includes('firebase')) return true;
  return hasRedirectPending();
}

export function ensureFirebase(): Promise<AuthImpl> {
  if (!implPromise) implPromise = import('./firebase-auth-impl');
  return implPromise;
}

export async function completeRedirectIfNeeded(): Promise<AuthUser | null> {
  if (!needsFirebaseNow() && !isAuthConfigured()) return loadAuthUser();
  if (!needsFirebaseNow() && !loadAuthUser() && !hasRedirectPending()) return null;
  const impl = await ensureFirebase();
  const user = await impl.completeRedirectIfNeeded();
  clearRedirectPending();
  return user;
}

export async function completeEmailLinkIfNeeded(): Promise<AuthUser | null> {
  if (!needsFirebaseNow()) return loadAuthUser();
  const impl = await ensureFirebase();
  return impl.completeEmailLinkIfNeeded();
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const impl = await ensureFirebase();
  return impl.signInWithGoogle();
}

export async function startEmailLink(email: string): Promise<void> {
  const impl = await ensureFirebase();
  return impl.startEmailLink(email);
}

export async function signInWithApple(): Promise<AuthUser> {
  const impl = await ensureFirebase();
  return impl.signInWithApple();
}

export async function signOutFirebase(): Promise<void> {
  if (!implPromise && !loadAuthUser()) {
    clearAuthUser();
    return;
  }
  const impl = await ensureFirebase();
  return impl.signOutFirebase();
}

export function watchIdToken(onToken: (user: AuthUser | null) => void): () => void {
  if (!loadAuthUser() && !needsFirebaseNow()) {
    return () => undefined;
  }
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
  testEnvOverride = null;
  if (!implPromise) return;
  const impl = await implPromise;
  await impl.resetFirebaseForTests();
  implPromise = null;
}
