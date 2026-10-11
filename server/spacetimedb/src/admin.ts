/**
 * Server-side admin gate. Email is read from the verified Firebase JWT
 * payload — never from a client flag.
 */

export const ADMIN_EMAILS = ['sumankpolepaka@gmail.com'] as const;

export function normalizeEmail(raw: unknown): string {
  return String(raw || '').trim().toLowerCase();
}

export function isAdminEmail(email: string): boolean {
  return (ADMIN_EMAILS as readonly string[]).includes(normalizeEmail(email));
}

export function emailFromJwtPayload(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return '';
  return normalizeEmail(payload.email);
}
