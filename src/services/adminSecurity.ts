/**
 * Admin two-step sign-in (Supabase MFA, authenticator-app codes) and the admin
 * activity log — migration 000025. Admin powers need a session verified with a
 * code (aal2); the database and Edge Functions enforce it, this only drives the UI.
 */
import type { AdminActivityEntry } from '@/utils/adminSecurity';

import { supabase } from './supabase';

export type AdminStatus = {
  /** The account is an app admin (grants nothing on its own). */
  member: boolean;
  /** This sign-in passed the code check, so admin tools work. */
  verified: boolean;
  /** The verified authenticator, if one is set up. */
  factorId: string | null;
  /** The project owner approved this authenticator (migration 000037); admin tools need it. */
  approved: boolean;
};

const NOT_ADMIN: AdminStatus = { member: false, verified: false, factorId: null, approved: false };

export async function fetchAdminStatus(): Promise<AdminStatus> {
  const { data: member, error } = await supabase.rpc('is_app_admin_member');
  if (error) throw new Error(error.message || 'Could not check admin status.');
  if (!member) return NOT_ADMIN;
  const [aal, factors, approved] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
    supabase.rpc('admin_factor_approved'),
  ]);
  if (aal.error) throw new Error(aal.error.message);
  if (factors.error) throw new Error(factors.error.message);
  if (approved.error) throw new Error(approved.error.message || 'Could not check admin status.');
  return {
    member: true,
    verified: aal.data.currentLevel === 'aal2',
    factorId: factors.data.totp[0]?.id ?? null,
    approved: approved.data === true,
  };
}

export type AuthenticatorSetup = { factorId: string; secret: string; uri: string; qrCode: string };

/** Starts adding an authenticator app. Clears any earlier setup that was never finished. */
export async function startAuthenticatorSetup(): Promise<AuthenticatorSetup> {
  const existing = await supabase.auth.mfa.listFactors();
  if (existing.error) throw new Error(existing.error.message);
  for (const f of existing.data.all) {
    if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'GamerCred',
    friendlyName: `Admin ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) throw new Error(error.message || 'Could not start two-step setup.');
  return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri, qrCode: data.totp.qr_code };
}

/** Checks a code; on success this sign-in becomes two-step verified (and a new setup is switched on). */
export async function verifyAuthenticatorCode(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    throw new Error(
      /invalid|expired|code/i.test(error.message)
        ? 'That code didn’t work. Check the time on your phone and try the newest code.'
        : error.message,
    );
  }
}

export async function fetchAdminActivity(limit = 100): Promise<AdminActivityEntry[]> {
  const { data, error } = await supabase.rpc('admin_activity', { p_limit: limit });
  if (error) throw new Error(error.message || 'Could not load the activity log.');
  return data.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    adminName: r.admin_name,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    details: r.details && typeof r.details === 'object' && !Array.isArray(r.details) ? (r.details as Record<string, unknown>) : {},
  }));
}
