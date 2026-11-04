import type { PostgrestError } from '@supabase/supabase-js';

import type { Profile } from '@/types/database.types';
import { nameProblemMessage, type NameProblem } from '@/utils/nameRules';

import { supabase } from './supabase';

/** Permanent names, display names and the official badge (migration 000038). */

export class NameError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'NameError';
  }
}

const NAME_ERRORS: Record<string, string> = {
  NM001: 'Your permanent name can’t be changed.',
  NM002: nameProblemMessage('too_close', 'permanent'),
  NM003: nameProblemMessage('reserved', 'display'),
  NM005: 'You can change your display name once a day.',
  CF001: nameProblemMessage('language', 'display'),
  '23505': nameProblemMessage('taken', 'permanent'),
};

function fail(error: PostgrestError, kind: 'permanent' | 'display', fallback: string): never {
  const code = error.code ?? null;
  if (code === 'NM004') throw new NameError(nameProblemMessage('format', kind), code);
  throw new NameError((code && NAME_ERRORS[code]) || error.message || fallback, code);
}

/** null = the name is fine. Throws only when the check itself can't run. */
export async function checkName(kind: 'permanent' | 'display', name: string): Promise<NameProblem | null> {
  const { data, error } = await supabase.rpc('check_name', { p_kind: kind, p_name: name });
  if (error) throw new NameError('Could not check that name. Try again.', error.code ?? null);
  return data;
}

/** Only for player_xxxxxx accounts; the database locks it afterwards. */
export async function choosePermanentName(userId: string, name: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update({ username: name }).eq('id', userId).select().single();
  if (error) fail(error, 'permanent', 'Could not save your permanent name.');
  return data;
}

/** null clears it (the permanent name shows instead). Once a day, server-enforced. */
export async function updateDisplayName(userId: string, displayName: string | null): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select()
    .single();
  if (error) fail(error, 'display', 'Could not save your display name.');
  return data;
}

export const DISPLAY_NAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** When the display name can next change, or null if it can change now. */
export function nextDisplayNameChange(profile: Pick<Profile, 'display_name_changed_at'>, now = Date.now()): Date | null {
  if (!profile.display_name_changed_at) return null;
  const next = new Date(profile.display_name_changed_at).getTime() + DISPLAY_NAME_COOLDOWN_MS;
  return next > now ? new Date(next) : null;
}

export type ProfileName = { id: string; username: string; displayName: string | null; isOfficial: boolean };

/** Up to 200 players per call; hidden (blocked) players are left out. */
export async function fetchProfileNames(ids: readonly string[]): Promise<ProfileName[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc('profile_names', { p_ids: [...ids] });
  if (error) throw new NameError('Could not load player names.', error.code ?? null);
  return data.map((r) => ({ id: r.id, username: r.username, displayName: r.display_name, isOfficial: r.is_official }));
}

/** Verified admins only; logged in Moderation → Activity. */
export async function adminResetDisplayName(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reset_display_name', { p_user: userId });
  if (error) throw new NameError(error.message || 'Could not reset the display name.', error.code ?? null);
}
