/**
 * Admin checks for Edge Functions (migration 000025): an admin power needs the
 * account to be in app_admins AND the session to be two-step verified
 * (JWT claim aal = 'aal2'). Call only AFTER the token is validated
 * (auth.getUser), which proves the claims are genuine.
 */

/** The `aal` claim of a JWT ('aal1' / 'aal2'), or null when unreadable. */
export function tokenAal(token: string): string | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(part.length / 4) * 4, '=');
    const claims: unknown = JSON.parse(atob(base64));
    if (typeof claims !== 'object' || claims === null) return null;
    const aal = (claims as Record<string, unknown>).aal;
    return typeof aal === 'string' ? aal : null;
  } catch {
    return null;
  }
}

export const isVerifiedSession = (token: string) => tokenAal(token) === 'aal2';

export const ADMIN_VERIFY_HINT = 'Admin tools need two-step sign-in: verify your authenticator code in Settings → Admin Security.';
