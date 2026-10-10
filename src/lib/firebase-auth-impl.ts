/**
 * Firebase Auth implementation chunk (Google + email link, optional Apple).
 * Loaded via ensureFirebase() — preload when Account opens so Sign in with
 * Google can call signInWithPopup synchronously inside the tap.
 */

import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  onIdTokenChanged,
  signOut as firebaseSignOut,
  type Auth,
  type AuthProvider,
  type User,
} from 'firebase/auth';
import { getFirebaseConfig, isAppleEnabled, viteEnv } from './firebase-config';
import {
  setAuthPathUsed,
  setLastAuthError,
  clearLastAuthError,
  shouldFallbackToRedirect,
} from './firebase-auth-debug';
import {
  EMAIL_FOR_LINK_KEY,
  clearAuthUser,
  loadAuthUser,
  markRedirectPending,
  saveAuthUser,
  type AuthUser,
  type SignInOpts,
} from './firebase-auth';

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

async function userToAuthUser(user: User, provider?: AuthUser['provider']): Promise<AuthUser> {
  const idToken = await user.getIdToken();
  const tokenResult = await user.getIdTokenResult();
  const exp = tokenResult.expirationTime ? Date.parse(tokenResult.expirationTime) / 1000 : Math.floor(Date.now() / 1000) + 3600;
  return {
    idToken,
    expiresAt: exp,
    uid: user.uid,
    email: user.email || undefined,
    displayName: user.displayName || undefined,
    provider: provider || user.providerData[0]?.providerId,
  };
}

function redirectSignIn(a: Auth, provider: AuthProvider): Promise<AuthUser> {
  setAuthPathUsed('redirect');
  markRedirectPending();
  const started = signInWithRedirect(a, provider);
  return started.then(() => {
    throw new Error('redirecting');
  });
}

function popupThenRedirect(
  a: Auth,
  provider: AuthProvider,
  mapped: AuthUser['provider'],
  opts?: SignInOpts,
): Promise<AuthUser> {
  if (opts?.forceRedirect) return redirectSignIn(a, provider);
  setAuthPathUsed('popup');
  clearLastAuthError();
  // Call signInWithPopup synchronously — no await before this line.
  const popupPromise = signInWithPopup(a, provider);
  return popupPromise.then(async (cred) => {
    const user = await userToAuthUser(cred.user, mapped);
    saveAuthUser(user);
    return user;
  }).catch((err: unknown) => {
    if (shouldFallbackToRedirect(err)) {
      return redirectSignIn(a, provider);
    }
    setLastAuthError(err);
    throw err;
  });
}

export async function completeRedirectIfNeeded(): Promise<AuthUser | null> {
  const a = getFirebaseAuth();
  if (!a) return loadAuthUser();
  try {
    const result = await getRedirectResult(a);
    if (result?.user) {
      setAuthPathUsed('redirect');
      const pid = result.providerId || result.user.providerData[0]?.providerId || 'google';
      const mapped: AuthUser['provider'] = pid === 'apple.com' ? 'apple' : pid === 'password' ? 'emailLink' : 'google';
      const user = await userToAuthUser(result.user, mapped);
      saveAuthUser(user);
      return user;
    }
  } catch (err) {
    setLastAuthError(err);
    throw err;
  }
  if (a.currentUser) {
    const user = await userToAuthUser(a.currentUser);
    saveAuthUser(user);
    return user;
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

export function signInWithGoogle(opts?: SignInOpts): Promise<AuthUser> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('auth_not_configured');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return popupThenRedirect(a, provider, 'google', opts);
}

/** Auth emulator only: finish Google sign-in without the IdP iframe relay. */
export async function signInWithEmulatorGoogle(email: string): Promise<AuthUser> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('auth_not_configured');
  const trimmed = email.trim();
  if (!trimmed.includes('@')) throw new Error('invalid_email');
  const cred = GoogleAuthProvider.credential(
    JSON.stringify({ sub: `emu-${trimmed}`, email: trimmed, email_verified: true, name: 'Emu Parent' }),
  );
  const result = await signInWithCredential(a, cred);
  const user = await userToAuthUser(result.user, 'google');
  saveAuthUser(user);
  return user;
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

export function signInWithApple(opts?: SignInOpts): Promise<AuthUser> {
  if (!isAppleEnabled()) throw new Error('apple_disabled');
  const a = getFirebaseAuth();
  if (!a) throw new Error('auth_not_configured');
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return popupThenRedirect(a, provider, 'apple', opts);
}

export async function signOutFirebase(): Promise<void> {
  const a = getFirebaseAuth();
  if (a) {
    try { await firebaseSignOut(a); } catch { /* ignore */ }
  }
  clearAuthUser();
}

export function watchAuthState(onUser: (user: AuthUser | null) => void): () => void {
  const a = getFirebaseAuth();
  if (!a) return () => undefined;
  return onAuthStateChanged(a, async (fbUser) => {
    if (!fbUser) {
      onUser(null);
      return;
    }
    const user = await userToAuthUser(fbUser);
    saveAuthUser(user);
    onUser(user);
  });
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
  const { setFirebaseEnvForTests } = await import('./firebase-config');
  const apps = getApps();
  await Promise.all(apps.map((a) => deleteApp(a).catch(() => undefined)));
  app = null;
  auth = null;
  emulatorBound = false;
  setFirebaseEnvForTests(null);
}
