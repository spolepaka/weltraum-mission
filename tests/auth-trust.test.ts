import { describe, expect, it } from 'vitest';
import {
  FIREBASE_PROJECT_ID,
  assertTrustedCaller,
  authSnapshotFromCtx,
  firebaseIssuer,
  isAnonymousOrFirebase,
  isFirebaseIssuer,
} from '../src/lib/auth-trust';

describe('Firebase issuer trust', () => {
  it('uses a single easy-to-change project id constant', () => {
    expect(FIREBASE_PROJECT_ID).toBe('weltraum-mission');
    expect(firebaseIssuer()).toBe('https://securetoken.google.com/weltraum-mission');
  });

  it('accepts anonymous SpacetimeDB identities (no JWT)', () => {
    expect(isAnonymousOrFirebase({ hasJWT: false })).toBe(true);
    expect(() => assertTrustedCaller({ hasJWT: false })).not.toThrow();
  });

  it('accepts our Firebase project issuer', () => {
    const issuer = firebaseIssuer();
    expect(isFirebaseIssuer(issuer)).toBe(true);
    expect(() => assertTrustedCaller({ hasJWT: true, issuer })).not.toThrow();
  });

  it('rejects a token from a foreign issuer', () => {
    expect(() =>
      assertTrustedCaller({ hasJWT: true, issuer: 'https://auth.spacetimedb.com/oidc' }),
    ).toThrow(/Untrusted token issuer/);
    expect(() =>
      assertTrustedCaller({ hasJWT: true, issuer: 'https://securetoken.google.com/other-project' }),
    ).toThrow(/Untrusted token issuer/);
    expect(() =>
      assertTrustedCaller({ hasJWT: true, issuer: firebaseIssuer('not-ours') }),
    ).toThrow(/Untrusted token issuer/);
  });

  it('reads issuer from ctx.senderAuth.jwt', () => {
    const foreign = authSnapshotFromCtx({
      senderAuth: { hasJWT: true, jwt: { issuer: 'https://example.com' } },
    });
    expect(foreign.issuer).toBe('https://example.com');
    expect(() => assertTrustedCaller(foreign)).toThrow(/Untrusted token issuer/);

    const ours = authSnapshotFromCtx({
      senderAuth: { hasJWT: true, jwt: { issuer: firebaseIssuer() } },
    });
    expect(() => assertTrustedCaller(ours)).not.toThrow();
  });
});
