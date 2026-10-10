/**
 * Last auth-path / error snapshot for the Account panel debug line
 * and server-side reportError. No Firebase SDK import.
 */

export type AuthPathUsed = 'popup' | 'redirect' | 'none';

export const AUTH_PATH_KEY = 'spaceMissionAuthPath';
export const AUTH_ERR_KEY = 'spaceMissionAuthError';

let authPathUsed: AuthPathUsed = 'none';
let lastAuthErrorCode: string | null = null;

function readStoredPath(): AuthPathUsed {
  try {
    const raw = sessionStorage.getItem(AUTH_PATH_KEY);
    if (raw === 'popup' || raw === 'redirect' || raw === 'none') return raw;
  } catch {
    // ignore
  }
  return 'none';
}

function readStoredError(): string | null {
  try {
    return sessionStorage.getItem(AUTH_ERR_KEY);
  } catch {
    return null;
  }
}

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
  try { sessionStorage.setItem(AUTH_PATH_KEY, path); } catch { /* ignore */ }
}

export function setLastAuthError(err: unknown): void {
  const code = authErrorCode(err);
  lastAuthErrorCode = code || authErrorMessage(err) || 'unknown';
  try {
    if (lastAuthErrorCode) sessionStorage.setItem(AUTH_ERR_KEY, lastAuthErrorCode);
    else sessionStorage.removeItem(AUTH_ERR_KEY);
  } catch { /* ignore */ }
}

export function clearLastAuthError(): void {
  lastAuthErrorCode = null;
  try { sessionStorage.removeItem(AUTH_ERR_KEY); } catch { /* ignore */ }
}

export function getAuthPathUsed(): AuthPathUsed {
  if (authPathUsed !== 'none') return authPathUsed;
  return readStoredPath();
}

export function getLastAuthErrorCode(): string | null {
  return lastAuthErrorCode || readStoredError();
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
