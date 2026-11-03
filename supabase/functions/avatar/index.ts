/**
 * `avatar` Edge Function — profile picture screening (see logic.ts).
 *   POST { action: 'submit' }                                    (signed-in user)
 *   POST { action: 'admin_list' }                                (app admin)
 *   POST { action: 'admin_decide', user_id, approve: boolean }   (app admin)
 * Responds with the standard envelope { success, data?, error? }.
 *
 * Secret (supabase secrets set …): GOOGLE_VISION_API_KEY — Cloud Vision API key,
 *   restricted to the Vision API. Without it every picture is held for review.
 * Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (never leaves this function).
 */
import { createClient } from '@supabase/supabase-js';

import { isVerifiedSession } from '../_shared/admin-auth.ts';
import { handleAvatar, parseRequest, parseVisionResponse, type AvatarDeps, type HeldPicture, type SafeSearch } from './logic.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UPLOADS = 'avatar-uploads';
const PUBLIC = 'avatars';
const pendingPath = (uid: string) => `${uid}/pending.jpg`;
const heldPath = (uid: string) => `held/${uid}.jpg`;
const VISION_TIMEOUT_MS = 8000;
const SIGNED_URL_SECONDS = 15 * 60;

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Google Cloud Vision SafeSearch; null (→ held for review) when unconfigured or failing. */
async function classify(image: Uint8Array): Promise<SafeSearch | null> {
  const key = Deno.env.get('GOOGLE_VISION_API_KEY');
  if (!key) {
    console.warn('[avatar] GOOGLE_VISION_API_KEY not set; holding picture for review');
    return null;
  }
  try {
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: toBase64(image) }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] }] }),
      signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('[avatar] Vision request failed', res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return parseVisionResponse(await res.json());
  } catch (error) {
    console.error('[avatar] Vision unavailable', error instanceof Error ? error.message : error);
    return null;
  }
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

    const download = async (bucket: string, path: string): Promise<Uint8Array | null> => {
      const { data, error } = await admin.storage.from(bucket).download(path);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    };
    const upload = async (bucket: string, path: string, image: Uint8Array) => {
      const { error } = await admin.storage.from(bucket).upload(path, image, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
      if (error) throw error;
    };

    const deps: AvatarDeps = {
      callerId: auth.user?.id ?? null,
      // Admin powers need a two-step-verified session (migration 000025); the token was validated above.
      isAdmin: async (userId) => {
        if (!isVerifiedSession(token)) return false;
        const { data, error } = await admin.from('app_admins').select('user_id').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        return data !== null;
      },
      logAdmin: async (adminId, action, targetType, targetId, details) => {
        const { error } = await admin
          .from('admin_actions')
          .insert({ admin_id: adminId, action, target_type: targetType, target_id: targetId, details: details ?? null });
        if (error) throw error;
      },
      readPending: (userId) => download(UPLOADS, pendingPath(userId)),
      removePending: async (userId) => {
        await admin.storage.from(UPLOADS).remove([pendingPath(userId)]);
      },
      classify,
      publish: async (userId, image) => {
        const path = `${userId}/avatar.jpg`;
        await upload(PUBLIC, path, image);
        // Same path on every upload, so bust caches with a version parameter.
        const url = `${admin.storage.from(PUBLIC).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
        const { data, error } = await admin.from('profiles').update({ avatar_url: url }).eq('id', userId).select().single();
        if (error) throw error;
        return data;
      },
      hold: async (userId, image, reason, scores) => {
        await upload(UPLOADS, heldPath(userId), image);
        const { error } = await admin
          .from('avatar_reviews')
          .upsert({ user_id: userId, held_path: heldPath(userId), reason, scores, created_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
      },
      readHeld: async (userId) => {
        const { data } = await admin.from('avatar_reviews').select('held_path').eq('user_id', userId).maybeSingle();
        return data ? download(UPLOADS, data.held_path as string) : null;
      },
      clearHeld: async (userId) => {
        await admin.storage.from(UPLOADS).remove([heldPath(userId)]);
        const { error } = await admin.from('avatar_reviews').delete().eq('user_id', userId);
        if (error) throw error;
      },
      listHeld: async () => {
        const { data, error } = await admin
          .from('avatar_reviews')
          .select('user_id, held_path, reason, scores, created_at, profile:profiles ( username )')
          .order('created_at', { ascending: true })
          .limit(100);
        if (error) throw error;
        const rows = data ?? [];
        const signed = rows.length
          ? (await admin.storage.from(UPLOADS).createSignedUrls(rows.map((r) => r.held_path as string), SIGNED_URL_SECONDS)).data ?? []
          : [];
        return rows.map((r, i): HeldPicture => {
          const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
          return {
            userId: r.user_id as string,
            username: (profile as { username?: string } | null)?.username ?? null,
            reason: r.reason as string,
            scores: (r.scores as SafeSearch | null) ?? null,
            createdAt: r.created_at as string,
            imageUrl: signed[i]?.signedUrl ?? null,
          };
        });
      },
    };

    const result = await handleAvatar(parseRequest(body), deps);
    return respond(result.status, result.body);
  } catch (e) {
    console.error('[avatar] failed', e);
    return respond(500, { success: false, error: 'Something went wrong with your picture. Please try again.' });
  }
});
