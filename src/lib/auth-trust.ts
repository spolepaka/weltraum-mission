/**
 * Client/test re-export of the module issuer rules.
 * Keep FIREBASE_PROJECT_ID in sync with server/spacetimedb/src/auth-trust.ts.
 */
export {
  FIREBASE_PROJECT_ID,
  FIREBASE_AUDIENCE,
  firebaseIssuer,
  isFirebaseIssuer,
  isAnonymousOrFirebase,
  assertTrustedCaller,
  authSnapshotFromCtx,
  type AuthSnapshot,
} from '../../server/spacetimedb/src/auth-trust';
