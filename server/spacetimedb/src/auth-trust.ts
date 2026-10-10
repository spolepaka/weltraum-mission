/**
 * Issuer trust for account-linked operations (importProgress).
 *
 * Live Firebase project: weltraum-mission
 * Issuer: https://securetoken.google.com/weltraum-mission
 * Audience: weltraum-mission
 *
 * Change FIREBASE_PROJECT_ID if the Firebase project id changes.
 * Republish the module after changing it.
 */

export const FIREBASE_PROJECT_ID = 'weltraum-mission';
export const FIREBASE_AUDIENCE = FIREBASE_PROJECT_ID;

export function firebaseIssuer(projectId: string = FIREBASE_PROJECT_ID): string {
  return `https://securetoken.google.com/${projectId}`;
}

export function isFirebaseIssuer(issuer: string | null | undefined, projectId: string = FIREBASE_PROJECT_ID): boolean {
  return !!issuer && issuer === firebaseIssuer(projectId);
}

export type AuthSnapshot = {
  hasJWT: boolean;
  issuer?: string | null;
  isInternal?: boolean;
};

/** Anonymous SpacetimeDB identity (no JWT) or our Firebase project. */
export function isAnonymousOrFirebase(auth: AuthSnapshot, projectId: string = FIREBASE_PROJECT_ID): boolean {
  if (auth.isInternal) return true;
  if (!auth.hasJWT) return true;
  return isFirebaseIssuer(auth.issuer, projectId);
}

export function assertTrustedCaller(auth: AuthSnapshot, projectId: string = FIREBASE_PROJECT_ID): void {
  if (!isAnonymousOrFirebase(auth, projectId)) {
    throw new Error(`Untrusted token issuer: ${auth.issuer || 'unknown'}`);
  }
}

export function authSnapshotFromCtx(ctx: { senderAuth?: { hasJWT: boolean; isInternal?: boolean; jwt?: { issuer?: string } | null } }): AuthSnapshot {
  const a = ctx.senderAuth;
  if (!a) return { hasJWT: false };
  return {
    hasJWT: !!a.hasJWT,
    issuer: a.jwt?.issuer ?? null,
    isInternal: !!a.isInternal,
  };
}
