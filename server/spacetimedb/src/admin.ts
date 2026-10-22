/**
 * Server-side admin gate. Email / UID come from the verified Firebase JWT
 * on the transaction ctx — never from a client flag.
 *
 * ProcedureCtx has no senderAuth. JWT lives on withTx()'s TransactionCtx.
 */

export const OWNER_EMAIL = 'sumankpolepaka@gmail.com';

/** Hard-coded owner. Always admin and cannot be removed from the role table. */
export const ADMIN_EMAILS = [OWNER_EMAIL] as const;

/** Seeded on first module boot. Can be revoked later by the owner. */
export const SEED_ADMIN_EMAILS = ['joshiepolepaka@gmail.com'] as const;

export const ADMIN_ROLES_SEEDED_KEY = 'adminRolesSeeded';

/** Fill in Suman's Firebase UID once known. Email check remains required to work. */
export const ADMIN_UIDS: readonly string[] = [];

export type AuthProbe = {
  hasJwt: boolean;
  issuer: string;
  email: string;
  rawEmail: string;
  emailVerified: boolean;
  sub: string;
  via: 'tx.senderAuth' | 'none';
};

export function normalizeEmail(raw: unknown): string {
  return String(raw || '').trim().toLowerCase();
}

export function normalizeUid(raw: unknown): string {
  return String(raw || '').trim();
}

export function isOwnerEmail(email: string): boolean {
  return normalizeEmail(email) === OWNER_EMAIL;
}

export function isAdminEmail(email: string): boolean {
  return isOwnerEmail(email);
}

export function bootstrapAdminEmails(): string[] {
  return [OWNER_EMAIL, ...SEED_ADMIN_EMAILS].map(normalizeEmail);
}

export type AdminRoleRow = {
  email: string;
  grantedBy: string;
  grantedAt: number;
};

export function applySeedAdminRoles(
  existing: AdminRoleRow[],
  seeded: boolean,
  now: number,
): { rows: AdminRoleRow[]; seeded: boolean; added: string[] } {
  const emails = new Set(existing.map((row) => normalizeEmail(row.email)));
  const rows = existing.map((row) => ({ ...row, email: normalizeEmail(row.email) }));
  const added: string[] = [];
  const add = (email: string, grantedBy: string) => {
    const e = normalizeEmail(email);
    if (!e || emails.has(e)) return;
    emails.add(e);
    rows.push({ email: e, grantedBy, grantedAt: now });
    added.push(e);
  };
  add(OWNER_EMAIL, 'system');
  if (!seeded) {
    for (const email of SEED_ADMIN_EMAILS) add(email, OWNER_EMAIL);
  }
  return { rows, seeded: true, added };
}

export function isGrantedAdmin(email: string, roleEmails: Iterable<string>): boolean {
  const e = normalizeEmail(email);
  if (!e) return false;
  if (isOwnerEmail(e)) return true;
  for (const row of roleEmails) {
    if (normalizeEmail(row) === e) return true;
  }
  return false;
}

export function canGrantAdmin(email: string): { ok: true; email: string } | { ok: false; reason: string } {
  const e = normalizeEmail(email);
  if (!e || e.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    return { ok: false, reason: 'Invalid email' };
  }
  return { ok: true, email: e };
}

export function canRevokeAdmin(email: string): { ok: true; email: string } | { ok: false; reason: string } {
  const e = normalizeEmail(email);
  if (!e) return { ok: false, reason: 'Invalid email' };
  if (isOwnerEmail(e)) return { ok: false, reason: 'Cannot remove owner' };
  return { ok: true, email: e };
}

export function isAdminUid(uid: string): boolean {
  const id = normalizeUid(uid);
  return !!id && (ADMIN_UIDS as readonly string[]).includes(id);
}

export function payloadFromJwt(jwt: { fullPayload?: unknown; rawPayload?: unknown } | null | undefined): Record<string, unknown> {
  if (!jwt) return {};
  const full = jwt.fullPayload;
  if (full && typeof full === 'object' && !Array.isArray(full)) {
    return full as Record<string, unknown>;
  }
  if (typeof jwt.rawPayload === 'string' && jwt.rawPayload.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(jwt.rawPayload) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
  }
  return {};
}

export function emailFromJwtPayload(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return '';
  const direct = payload.email ?? payload.Email ?? payload.mail;
  if (typeof direct === 'string') return normalizeEmail(direct);
  return '';
}

export function inspectSenderAuth(auth: { hasJWT?: boolean; jwt?: { issuer?: string; subject?: string; fullPayload?: unknown; rawPayload?: unknown } | null } | null | undefined): AuthProbe {
  if (!auth) {
    return { hasJwt: false, issuer: '', email: '', rawEmail: '', emailVerified: false, sub: '', via: 'none' };
  }
  const jwt = auth.jwt;
  if (!jwt || auth.hasJWT === false) {
    return { hasJwt: false, issuer: '', email: '', rawEmail: '', emailVerified: false, sub: '', via: 'tx.senderAuth' };
  }
  const payload = payloadFromJwt(jwt);
  const issuer = String(jwt.issuer || payload.iss || '');
  const rawEmail = emailFromJwtPayload(payload);
  const sub = String(jwt.subject || payload.sub || '');
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  return {
    hasJwt: true,
    issuer,
    email: rawEmail,
    rawEmail,
    emailVerified,
    sub,
    via: 'tx.senderAuth',
  };
}

/**
 * Copy JWT from the transaction ctx (which has senderAuth) — never from the
 * procedure outer ctx, which does not expose it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bindAdminCtx(outer: any, tx: any): any {
  return {
    ...tx,
    sender: tx.sender ?? outer.sender,
    timestamp: tx.timestamp ?? outer.timestamp,
    connectionId: tx.connectionId ?? outer.connectionId,
    senderAuth: tx.senderAuth ?? outer.senderAuth,
    db: tx.db,
  };
}

export function isAdminPrincipal(email: string, uid: string): boolean {
  return isAdminEmail(email) || isAdminUid(uid);
}
