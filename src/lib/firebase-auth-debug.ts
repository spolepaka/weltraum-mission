/**
 * Last auth-path / error snapshot for the Account panel debug line
 * and server-side reportError. No Firebase SDK import.
 */

export type AuthPathUsed = 'popup' | 'redirect' | 'none';

let authPathUsed: AuthPathUsed = 'none';
let lastAuthErrorCode: string | null = null;

export function authErrorCode(err: unknown): string {
  const code = String((err as { code?: string })?.code || '');
  if (code) return code;
  const msg = String((err as { message?: string })?.message || err || '');
  const m = /auth\/[a-z0-9-]+/i.exec(msg);
  return m ? m[0] : '';
}

export function authErrorMessage(err: unknown): string {
  return String((err as { message?: string })?.message || err || '');
}

export function setAuthPathUsed(path: AuthPathUsed): void {
  authPathUsed = path;
}

export function setLastAuthError(err: unknown): void {
  const code = authErrorCode(err);
  lastAuthErrorCode = code || authErrorMessage(err) || 'unknown';
}

export function clearLastAuthError(): void {
  lastAuthErrorCode = null;
}

export function getAuthPathUsed(): AuthPathUsed {
  return authPathUsed;
}

export function getLastAuthErrorCode(): string | null {
  return lastAuthErrorCode;
}

/** Popup failed in a way that redirect can recover — only actual blocks. */
export function shouldFallbackToRedirect(err: unknown): boolean {
  const code = authErrorCode(err);
  const msg = authErrorMessage(err);
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    /popup-blocked/i.test(msg)
  );
}

export interface AuthDebugSnapshot {
  path: AuthPathUsed;
  lastError: string | null;
  firebaseUser: boolean;
  issuer: 'anon' | 'firebase' | 'unknown';
}

export function formatAuthDebugLine(debug: AuthDebugSnapshot): string {
  return `auth: ${debug.path} · err: ${debug.lastError || '—'} · firebase: ${debug.firebaseUser ? 'yes' : 'no'} · issuer: ${debug.issuer}`;
}
