/**
 * Firebase web config + first-party authDomain resolution.
 * No Firebase SDK import — safe from both the facade and the impl chunk.
 *
 * On the production Vercel host, authDomain is the current site host so
 * `/__/auth/*` is first-party (Safari ITP / partitioned third-party storage
 * otherwise breaks signInWithRedirect + getRedirectResult).
 */

export const PRODUCTION_APP_HOST = 'space-game-deploy.vercel.app';
export const FIREBASE_AUTH_PROXY_HOST = 'weltraum-mission.firebaseapp.com';

export type AuthProviderId = 'google' | 'emailLink' | 'apple';

export const AUTH_PROVIDERS: { id: AuthProviderId; envFlag?: string }[] = [
  { id: 'google' },
  { id: 'emailLink' },
  { id: 'apple', envFlag: 'VITE_FIREBASE_APPLE_ENABLED' },
];

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

export function viteEnv(name: string): string | undefined {
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

export function currentAppHost(explicit?: string): string | undefined {
  if (explicit) return explicit;
  try {
    if (typeof location !== 'undefined' && location.host) return location.host;
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Production host → first-party authDomain (location.host).
 * Everywhere else → VITE_FIREBASE_AUTH_DOMAIN (or the explicit env arg).
 * Does not require the Vercel env to already be the first-party host.
 */
export function resolveAuthDomain(envAuthDomain?: string, host?: string): string | undefined {
  const resolvedHost = currentAppHost(host);
  if (resolvedHost === PRODUCTION_APP_HOST) return resolvedHost;
  return envAuthDomain || undefined;
}

export function getFirebaseConfig(host?: string): FirebaseWebConfig | null {
  const apiKey = viteEnv('VITE_FIREBASE_API_KEY');
  const envAuthDomain = viteEnv('VITE_FIREBASE_AUTH_DOMAIN');
  const authDomain = resolveAuthDomain(envAuthDomain, host);
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

export function tokenIssuerKind(token: string | null | undefined): 'anon' | 'firebase' | 'unknown' {
  if (!token) return 'unknown';
  const parts = token.split('.');
  if (parts.length < 2) return 'anon';
  try {
    const json = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = json + '='.repeat((4 - (json.length % 4)) % 4);
    const raw = typeof atob === 'function'
      ? atob(pad)
      : Buffer.from(pad, 'base64').toString('utf8');
    const payload = JSON.parse(raw) as { iss?: string };
    const iss = String(payload.iss || '');
    if (/securetoken\.google\.com/.test(iss)) return 'firebase';
    return 'anon';
  } catch {
    return 'anon';
  }
}
