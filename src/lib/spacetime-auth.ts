/**
 * SpacetimeAuth (OIDC) for the vanilla game client.
 *
 * Official SDK support: the SpacetimeDB TypeScript SDK authenticates with
 * `.withToken(idToken)`. SpacetimeAuth is an OIDC provider; a public SPA
 * uses Authorization Code + PKCE (no client secret).
 *
 * Requires a SpacetimeAuth project + public client created in the dashboard.
 * Configure with VITE_SPACETIME_AUTH_CLIENT_ID (see docs/DEPLOY.md).
 * Anonymous play always works when this is unset.
 */

export const AUTH_ISSUER = 'https://auth.spacetimedb.com/oidc';
export const AUTH_STORAGE_KEY = 'spaceMissionOidc';
export const AUTH_PENDING_KEY = 'spaceMissionAuthPending';
export const ANON_SNAPSHOT_KEY = 'spaceMissionAnonSnapshot';

export interface AuthConfig {
  clientId: string;
  issuer: string;
  redirectUri: string;
  scope: string;
}

export interface AuthUser {
  idToken: string;
  accessToken?: string;
  expiresAt: number;
  sub?: string;
  email?: string;
  name?: string;
}

export interface ProgressSnapshot {
  unlockedLevel: number;
  coins: number;
  equippedShip: string;
  ownedShips: string[];
  upgrades: Record<string, number>;
  stars: Record<string, number>;
  best: Record<string, number>;
  language: string;
}

function viteEnv(name: string): string | undefined {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    return env?.[name];
  } catch {
    return undefined;
  }
}

export function getAuthConfig(): AuthConfig | null {
  const clientId =
    viteEnv('VITE_SPACETIME_AUTH_CLIENT_ID') ||
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('auth_client') || undefined
      : undefined);
  if (!clientId) return null;
  const issuer = viteEnv('VITE_SPACETIME_AUTH_ISSUER') || AUTH_ISSUER;
  const redirectUri =
    viteEnv('VITE_SPACETIME_AUTH_REDIRECT') ||
    (typeof window !== 'undefined' ? `${window.location.origin}/` : '');
  return {
    clientId,
    issuer,
    redirectUri,
    scope: 'openid profile email',
  };
}

export function isAuthConfigured(): boolean {
  return getAuthConfig() !== null;
}

export function loadAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as AuthUser;
    if (!user.idToken || (user.expiresAt && user.expiresAt < Date.now() / 1000 - 30)) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function saveAuthUser(user: AuthUser): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuthUser(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_PENDING_KEY);
  } catch {
    // ignore
  }
}

function randomString(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256b64url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
}

let discoveryCache: Discovery | null = null;

export async function fetchDiscovery(issuer: string): Promise<Discovery> {
  if (discoveryCache) return discoveryCache;
  const res = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error('oidc_discovery_failed');
  discoveryCache = await res.json() as Discovery;
  return discoveryCache;
}

export async function startSignIn(snapshot?: ProgressSnapshot): Promise<void> {
  const config = getAuthConfig();
  if (!config) throw new Error('auth_not_configured');

  if (snapshot) {
    localStorage.setItem(ANON_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }

  const verifier = randomString(64);
  const challenge = await sha256b64url(verifier);
  const state = randomString(24);
  const nonce = randomString(24);
  localStorage.setItem(AUTH_PENDING_KEY, JSON.stringify({ verifier, state, nonce }));

  const disc = await fetchDiscovery(config.issuer);
  const url = new URL(disc.authorization_endpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  window.location.assign(url.toString());
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  if (!part) return {};
  const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(json) as Record<string, unknown>;
}

export async function completeSignInIfNeeded(): Promise<AuthUser | null> {
  if (typeof window === 'undefined') return loadAuthUser();
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return loadAuthUser();

  const config = getAuthConfig();
  if (!config) return null;

  const pendingRaw = localStorage.getItem(AUTH_PENDING_KEY);
  if (!pendingRaw) return null;
  const pending = JSON.parse(pendingRaw) as { verifier: string; state: string };
  if (pending.state !== state) throw new Error('oidc_state_mismatch');

  const disc = await fetchDiscovery(config.issuer);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: pending.verifier,
  });
  const res = await fetch(disc.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('oidc_token_exchange_failed');
  const tokens = await res.json() as { id_token?: string; access_token?: string; expires_in?: number };
  if (!tokens.id_token) throw new Error('oidc_missing_id_token');

  const claims = decodeJwtPayload(tokens.id_token);
  const user: AuthUser = {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    expiresAt: typeof claims.exp === 'number' ? claims.exp : Math.floor(Date.now() / 1000) + (tokens.expires_in || 3600),
    sub: typeof claims.sub === 'string' ? claims.sub : undefined,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    name: typeof claims.name === 'string' ? claims.name : undefined,
  };
  saveAuthUser(user);
  localStorage.removeItem(AUTH_PENDING_KEY);

  params.delete('code');
  params.delete('state');
  params.delete('session_state');
  const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', clean);
  return user;
}

export function loadAnonSnapshot(): ProgressSnapshot | null {
  try {
    const raw = localStorage.getItem(ANON_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProgressSnapshot;
  } catch {
    return null;
  }
}

export function clearAnonSnapshot(): void {
  try { localStorage.removeItem(ANON_SNAPSHOT_KEY); } catch { /* ignore */ }
}
