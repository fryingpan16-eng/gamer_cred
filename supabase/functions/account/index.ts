/**
 * `account` Edge Function — POST { action: 'delete_self' } or
 * { action: 'admin_delete_user', user_id } with the user's session JWT.
 * Responds with the standard envelope { success, data?, error? }.
 *
 * Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * The service-role key never leaves this function.
 */
import { createClient } from '@supabase/supabase-js';

import { isVerifiedSession } from '../_shared/admin-auth.ts';
import { handleAccount, parseRequest, type AccountDeps } from './logic.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return respond(405, { success: false, error: 'Use POST.' });

  try {
    const admin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const body: unknown = await req.json().catch(() => null);

    const deps: AccountDeps = {
      callerId: auth.user?.id ?? null,
      // Admin powers need a two-step-verified session (migration 000025); the token was validated above.
      isAdmin: async (userId) => {
        if (!isVerifiedSession(token)) return false;
        // In app_admins with the owner-approved authenticator as their only one (migration 000037).
        const { data, error } = await admin.rpc('admin_ready', { p_user: userId });
        if (error) throw error;
        return data === true;
      },
      logAdmin: async (adminId, action, targetType, targetId, details) => {
        const { error } = await admin
          .from('admin_actions')
          .insert({ admin_id: adminId, action, target_type: targetType, target_id: targetId, details: details ?? null });
        if (error) throw error;
      },
      listAvatarFiles: async (userId) => {
        const { data, error } = await admin.storage.from('avatars').list(userId, { limit: 1000 });
        if (error) throw error;
        return (data ?? []).map((f) => `${userId}/${f.name}`);
      },
      removeAvatarFiles: async (paths) => {
        const { error } = await admin.storage.from('avatars').remove(paths);
        if (error) throw error;
      },
      closeReportsAbout: async (userId, adminId) => {
        const { error } = await admin
          .from('content_reports')
          .update({ status: 'actioned', resolved_at: new Date().toISOString(), resolved_by: adminId, resolution_note: 'User removed' })
          .eq('target_user_id', userId)
          .eq('status', 'open');
        if (error) throw error;
      },
      deleteAuthUser: async (userId) => {
        // Pictures waiting in the private screening bucket (migration 000022). Best effort:
        // there is usually nothing there.
        await admin.storage.from('avatar-uploads').remove([`${userId}/pending.jpg`, `held/${userId}.jpg`]);
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw error;
      },
    };

    const result = await handleAccount(parseRequest(body), deps);
    return respond(result.status, result.body);
  } catch (e) {
    console.error('account function failed', e);
    return respond(500, { success: false, error: 'Something went wrong — nothing was deleted, or only partly. Please try again.' });
  }
});
