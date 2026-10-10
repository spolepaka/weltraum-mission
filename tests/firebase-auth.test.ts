import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTH_PROVIDERS,
  AUTH_STORAGE_KEY,
  GUEST_TOKEN_KEY,
  PRODUCTION_APP_HOST,
  clearAuthUser,
  enabledProviders,
  getFirebaseConfig,
  isAppleEnabled,
  isAuthConfigured,
  loadAuthUser,
  loadGuestToken,
  resetFirebaseForTests,
  resolveAuthDomain,
  saveAuthUser,
  saveGuestToken,
  setFirebaseEnvForTests,
  shouldFallbackToRedirect,
  maskEmail,
  maskDisplayName,
  markRedirectPending,
  hasRedirectPending,
  needsFirebaseNow,
  REDIRECT_FLAG_KEY,
  tokenIssuerKind,
} from '../src/lib/firebase-auth';

const store: Record<string, string> = {};

function stubStorage(): void {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: () => null,
    length: 0,
  } as Storage;
}

afterEach(async () => {
  for (const k of Object.keys(store)) delete store[k];
  await resetFirebaseForTests();
});

describe('Firebase Auth config (no emulator)', () => {
  it('is unconfigured when VITE_FIREBASE_* are unset (guests keep playing)', () => {
    setFirebaseEnvForTests({
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_APP_ID: '',
    });
    expect(getFirebaseConfig()).toBeNull();
    expect(isAuthConfigured()).toBe(false);
  });

  it('reads the four required Vite env vars', async () => {
    const pinned = {
      VITE_FIREBASE_API_KEY: 'k',
      VITE_FIREBASE_AUTH_DOMAIN: 'p.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'p',
      VITE_FIREBASE_APP_ID: '1:1:web:x',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '',
      VITE_FIREBASE_STORAGE_BUCKET: '',
    };
    setFirebaseEnvForTests(pinned);
    await resetFirebaseForTests();
    setFirebaseEnvForTests(pinned);
    expect(getFirebaseConfig()).toEqual({
      apiKey: 'k',
      authDomain: 'p.firebaseapp.com',
      projectId: 'p',
      appId: '1:1:web:x',
      messagingSenderId: undefined,
      storageBucket: undefined,
    });
    expect(isAuthConfigured()).toBe(true);
  });

  it('lists Google + email link; Apple only when flagged', () => {
    expect(AUTH_PROVIDERS.map((p) => p.id)).toEqual(['google', 'emailLink', 'apple']);
    expect(isAppleEnabled()).toBe(false);
    expect(enabledProviders()).toEqual(['google', 'emailLink']);
    setFirebaseEnvForTests({ VITE_FIREBASE_APPLE_ENABLED: '1' });
    expect(isAppleEnabled()).toBe(true);
    expect(enabledProviders()).toEqual(['google', 'emailLink', 'apple']);
  });

  it('stores a parent session without overwriting the first guest token', () => {
    stubStorage();
    saveGuestToken('guest-token-1');
    saveGuestToken('guest-token-2');
    expect(loadGuestToken()).toBe('guest-token-1');
    saveAuthUser({
      idToken: 'firebase-jwt',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      uid: 'uid-1',
      email: 'parent@example.com',
      provider: 'google',
    });
    expect(loadAuthUser()?.email).toBe('parent@example.com');
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem(GUEST_TOKEN_KEY)).toBe('guest-token-1');
    clearAuthUser();
    expect(loadAuthUser()).toBeNull();
    expect(loadGuestToken()).toBe('guest-token-1');
  });

  it('masks Google email and name for the account panel', () => {
    expect(maskEmail('parent@example.com')).toBe('pa…@example.com');
    expect(maskDisplayName('Ada Lovelace')).toBe('Ad…e');
  });

  it('treats a pending redirect flag as needing Firebase now', () => {
    const sess: Record<string, string> = {};
    (globalThis as { sessionStorage?: Storage }).sessionStorage = {
      getItem: (k: string) => sess[k] ?? null,
      setItem: (k: string, v: string) => { sess[k] = v; },
      removeItem: (k: string) => { delete sess[k]; },
      clear: () => { for (const key of Object.keys(sess)) delete sess[key]; },
      key: (i: number) => Object.keys(sess)[i] ?? null,
      get length() { return Object.keys(sess).length; },
    } as Storage;
    expect(hasRedirectPending()).toBe(false);
    markRedirectPending();
    expect(sess[REDIRECT_FLAG_KEY]).toBe('1');
    expect(hasRedirectPending()).toBe(true);
    expect(needsFirebaseNow()).toBe(true);
  });

  it('falls back to redirect only when the popup is actually blocked', () => {
    expect(shouldFallbackToRedirect({ code: 'auth/popup-blocked' })).toBe(true);
    expect(shouldFallbackToRedirect({ message: 'popup-blocked by Safari' })).toBe(true);
    expect(shouldFallbackToRedirect({ code: 'auth/operation-not-supported-in-this-environment' })).toBe(true);
    expect(shouldFallbackToRedirect({ code: 'auth/internal-error' })).toBe(false);
    expect(shouldFallbackToRedirect({ code: 'auth/popup-closed-by-user' })).toBe(false);
    expect(shouldFallbackToRedirect({ code: 'auth/invalid-email' })).toBe(false);
  });

  it('uses first-party authDomain on the production host even if env is firebaseapp.com', () => {
    const pinned = {
      VITE_FIREBASE_API_KEY: 'k',
      VITE_FIREBASE_AUTH_DOMAIN: 'weltraum-mission.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'weltraum-mission',
      VITE_FIREBASE_APP_ID: '1:1:web:x',
    };
    setFirebaseEnvForTests(pinned);
    expect(resolveAuthDomain('weltraum-mission.firebaseapp.com', PRODUCTION_APP_HOST)).toBe(PRODUCTION_APP_HOST);
    expect(getFirebaseConfig(PRODUCTION_APP_HOST)?.authDomain).toBe(PRODUCTION_APP_HOST);
    expect(resolveAuthDomain('weltraum-mission.firebaseapp.com', 'localhost:4173')).toBe('weltraum-mission.firebaseapp.com');
    expect(getFirebaseConfig('localhost:4173')?.authDomain).toBe('weltraum-mission.firebaseapp.com');
  });

  it('classifies Firebase vs anonymous JWT issuers', () => {
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://securetoken.google.com/weltraum-mission',
      aud: 'weltraum-mission',
    })).toString('base64url');
    expect(tokenIssuerKind(`e30.${payload}.sig`)).toBe('firebase');
    const anon = Buffer.from(JSON.stringify({ iss: 'https://auth.spacetimedb.com/identity' })).toString('base64url');
    expect(tokenIssuerKind(`e30.${anon}.sig`)).toBe('anon');
    expect(tokenIssuerKind(null)).toBe('unknown');
  });
});
