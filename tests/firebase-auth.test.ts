import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTH_PROVIDERS,
  AUTH_STORAGE_KEY,
  GUEST_TOKEN_KEY,
  clearAuthUser,
  enabledProviders,
  getFirebaseConfig,
  isAppleEnabled,
  isAuthConfigured,
  loadAuthUser,
  loadGuestToken,
  resetFirebaseForTests,
  saveAuthUser,
  saveGuestToken,
  setFirebaseEnvForTests,
  shouldFallbackToRedirect,
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

  it('falls back to redirect on popup-blocked and auth/internal-error', () => {
    expect(shouldFallbackToRedirect({ code: 'auth/popup-blocked' })).toBe(true);
    expect(shouldFallbackToRedirect({ code: 'auth/internal-error' })).toBe(true);
    expect(shouldFallbackToRedirect({ message: 'Firebase: Error (auth/internal-error).' })).toBe(true);
    expect(shouldFallbackToRedirect({ code: 'auth/invalid-email' })).toBe(false);
  });
});
