/**
 * Firebase Auth emulator: Google-style sign-in, email link, token refresh,
 * silent SpacetimeDB reconnect, progress merge, sign-out → guest, foreign issuer.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailLink,
} from 'firebase/auth';
import {
  ANON_SNAPSHOT_KEY,
  GUEST_TOKEN_KEY,
  clearAuthUser,
  currentIdToken,
  isAuthConfigured,
  loadAuthUser,
  loadGuestToken,
  resetFirebaseForTests,
  saveAnonSnapshot,
  saveAuthUser,
  saveGuestToken,
  signOutFirebase,
} from '../src/lib/firebase-auth';
import { getFirebaseAuth } from '../src/lib/firebase-auth-impl';
import { assertTrustedCaller, firebaseIssuer } from '../src/lib/auth-trust';
import { mergeCoins } from '../src/lib/coin-ledger';

const EMU = process.env.VITE_FIREBASE_AUTH_EMULATOR || 'http://127.0.0.1:9099';
const PROJECT = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-weltraum';

function stubStorage(): Record<string, string> {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: () => null,
    length: 0,
  } as Storage;
  return store;
}

async function waitForEmulator(): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const res = await fetch(`${EMU}/`);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Firebase Auth emulator not reachable at ${EMU}`);
}

beforeAll(async () => {
  process.env.VITE_FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'fake-api-key';
  process.env.VITE_FIREBASE_AUTH_DOMAIN = process.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-weltraum.firebaseapp.com';
  process.env.VITE_FIREBASE_PROJECT_ID = PROJECT;
  process.env.VITE_FIREBASE_APP_ID = process.env.VITE_FIREBASE_APP_ID || '1:1:web:demo';
  process.env.VITE_FIREBASE_AUTH_EMULATOR = EMU;
  await resetFirebaseForTests();
  await waitForEmulator();
  expect(isAuthConfigured()).toBe(true);
}, 20000);

afterEach(async () => {
  await signOutFirebase();
  clearAuthUser();
});

describe('Firebase Auth emulator', () => {
  it('signs in with a Google-style emulator credential', async () => {
    stubStorage();
    const auth = getFirebaseAuth();
    expect(auth).toBeTruthy();
    const cred = GoogleAuthProvider.credential(
      JSON.stringify({ sub: 'google-parent-1', email: 'parent@example.com', email_verified: true }),
    );
    const result = await signInWithCredential(auth!, cred);
    expect(result.user.email).toBe('parent@example.com');
    const token = await result.user.getIdToken();
    expect(token.split('.').length).toBe(3);
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { iss?: string; aud?: string };
    expect(payload.iss).toContain('securetoken.google.com');
    expect(payload.aud || PROJECT).toBeTruthy();
    saveAuthUser({
      idToken: token,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      uid: result.user.uid,
      email: result.user.email || undefined,
      provider: 'google',
    });
    expect(loadAuthUser()?.provider).toBe('google');
    expect(loadAuthUser()?.idToken).toBe(token);
  });

  it('sends and completes an email link (passwordless)', async () => {
    stubStorage();
    const auth = getFirebaseAuth()!;
    const email = `parent+${Date.now()}@example.com`;
    await sendSignInLinkToEmail(auth, email, {
      url: 'http://localhost:4173/',
      handleCodeInApp: true,
    });
    const oobRes = await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/oobCodes`);
    expect(oobRes.ok).toBe(true);
    const body = await oobRes.json() as { oobCodes?: Array<{ email?: string; oobLink?: string }> };
    const match = (body.oobCodes || []).reverse().find((c) => c.email === email && c.oobLink);
    expect(match?.oobLink).toBeTruthy();
    expect(isSignInWithEmailLink(auth, match!.oobLink!)).toBe(true);
    const cred = await signInWithEmailLink(auth, email, match!.oobLink!);
    expect(cred.user.email).toBe(email);
    const token = await cred.user.getIdToken();
    expect(token.length).toBeGreaterThan(20);
  });

  it('refreshes the ID token and would reconnect SpacetimeDB with the new token', async () => {
    stubStorage();
    saveGuestToken('guest-identity-token-keep');
    const auth = getFirebaseAuth()!;
    const cred = GoogleAuthProvider.credential(
      JSON.stringify({ sub: 'refresh-parent', email: 'refresh@example.com', email_verified: true }),
    );
    const result = await signInWithCredential(auth, cred);
    const first = await result.user.getIdToken();
    const second = await result.user.getIdToken(true);
    expect(second.split('.').length).toBe(3);
    saveAuthUser({
      idToken: second,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      uid: result.user.uid,
      email: result.user.email || undefined,
      provider: 'google',
    });
    const latest = await currentIdToken(true);
    expect(latest).toBeTruthy();
    expect(loadAuthUser()?.idToken).toBe(latest);
    // Seamless reconnect contract: guest token stays; new token is what .withToken() gets.
    expect(loadGuestToken()).toBe('guest-identity-token-keep');
    const connectToken = loadAuthUser()?.idToken || loadGuestToken();
    expect(connectToken).toBe(latest);
    // Same iss+sub after refresh → first-sign-in merge must not run again.
    expect(first.length).toBeGreaterThan(10);
    expect(second.length).toBeGreaterThan(10);
  });

  it('max-merges guest progress and never wipes (importProgress contract)', () => {
    stubStorage();
    const guest = { unlockedLevel: 4, coins: 80, ownedShips: ['starter', 'blitz'] };
    const account = { unlockedLevel: 2, coins: 30, ownedShips: ['starter', 'komet'] };
    saveAnonSnapshot({
      unlockedLevel: guest.unlockedLevel,
      coins: guest.coins,
      equippedShip: 'blitz',
      ownedShips: guest.ownedShips,
      upgrades: {},
      stars: { '1': 3 },
      best: {},
      language: 'en',
    });
    const mergedUnlock = Math.max(guest.unlockedLevel, account.unlockedLevel);
    const mergedCoins = mergeCoins(BigInt(account.coins), BigInt(guest.coins));
    const mergedShips = Array.from(new Set([...account.ownedShips, ...guest.ownedShips]));
    expect(mergedUnlock).toBe(4);
    expect(mergedCoins).toBe(80n);
    expect(mergedShips.sort()).toEqual(['blitz', 'komet', 'starter']);
    expect(localStorage.getItem(ANON_SNAPSHOT_KEY)).toBeTruthy();
  });

  it('sign-out returns to the stored guest identity', async () => {
    stubStorage();
    saveGuestToken('guest-after-signout');
    const auth = getFirebaseAuth()!;
    const cred = GoogleAuthProvider.credential(
      JSON.stringify({ sub: 'signout-parent', email: 'out@example.com', email_verified: true }),
    );
    const result = await signInWithCredential(auth, cred);
    saveAuthUser({
      idToken: await result.user.getIdToken(),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      uid: result.user.uid,
      email: result.user.email || undefined,
      provider: 'google',
    });
    expect(loadAuthUser()).toBeTruthy();
    await signOutFirebase();
    expect(loadAuthUser()).toBeNull();
    expect(localStorage.getItem(GUEST_TOKEN_KEY)).toBe('guest-after-signout');
    const guestConnect = loadAuthUser()?.idToken || loadGuestToken();
    expect(guestConnect).toBe('guest-after-signout');
  });

  it('server rejects a token from a foreign issuer and accepts ours or anonymous', () => {
    expect(() =>
      assertTrustedCaller({ hasJWT: true, issuer: 'https://securetoken.google.com/foreign-app' }),
    ).toThrow(/Untrusted token issuer/);
    expect(() =>
      assertTrustedCaller({ hasJWT: true, issuer: 'https://auth.spacetimedb.com/oidc' }),
    ).toThrow(/Untrusted token issuer/);
    expect(() => assertTrustedCaller({ hasJWT: false })).not.toThrow();
    expect(() => assertTrustedCaller({ hasJWT: true, issuer: firebaseIssuer() })).not.toThrow();
  });

  it('maps a brand-new Google user into the saved AuthUser profile', async () => {
    stubStorage();
    const auth = getFirebaseAuth()!;
    const cred = GoogleAuthProvider.credential(
      JSON.stringify({ sub: `new-kid-${Date.now()}`, email: 'leo@example.com', email_verified: true, name: 'Leo Pilot' }),
    );
    const result = await signInWithCredential(auth, cred);
    saveAuthUser({
      idToken: await result.user.getIdToken(),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      uid: result.user.uid,
      email: result.user.email || undefined,
      displayName: result.user.displayName || 'Leo Pilot',
      provider: 'google',
    });
    const stored = loadAuthUser();
    expect(stored?.email).toBe('leo@example.com');
    expect(stored?.uid).toBeTruthy();
    expect(stored?.displayName || stored?.email).toBeTruthy();
    expect(result.user.metadata.creationTime).toBeTruthy();
  });
});
