/**
 * Safety features required by the app stores for user-generated content
 * (migration 000021 + the `account` Edge Function): blocking, reporting,
 * admin moderation, terms acceptance and account deletion.
 */
import { FunctionsHttpError, type PostgrestError } from '@supabase/supabase-js';

import type { ApiEnvelope } from '@/types/api';
import type { Database, ReportReason, ReportTarget } from '@/types/database.types';

import { supabase } from './supabase';

export class SafetyError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'SafetyError';
  }
}

function fail(error: PostgrestError, fallback: string): never {
  if (error.code === '23505') throw new SafetyError('You’ve already reported this — thanks, we’re on it.', error.code);
  throw new SafetyError(error.message || fallback, error.code ?? null);
}

// ---- blocking -----------------------------------------------------------------

export type BlockState = 'none' | 'blocked_by_me';
export type BlockedUser = { userId: string; username: string; avatarUrl: string | null; blockedAt: string };

export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_user: userId });
  if (error) fail(error, 'Could not block this player.');
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { p_user: userId });
  if (error) fail(error, 'Could not unblock this player.');
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('my_blocked_users');
  if (error) fail(error, 'Could not load blocked players.');
  return data.map((r) => ({ userId: r.user_id, username: r.username, avatarUrl: r.avatar_url, blockedAt: r.blocked_at }));
}

export async function fetchBlockState(userId: string): Promise<BlockState> {
  const { data, error } = await supabase.rpc('block_state', { p_user: userId });
  if (error) fail(error, 'Could not check block status.');
  return data;
}

// ---- reports ------------------------------------------------------------------

export type ReportInput = {
  targetType: ReportTarget;
  /** Review / list id, the rated game id (as a string), or the user id. */
  targetId: string;
  /** Owner of the content (the reported user for user reports). */
  targetUserId: string;
  reason: ReportReason;
  details: string;
};

export async function submitReport(reporterId: string, r: ReportInput): Promise<void> {
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: reporterId,
    target_type: r.targetType,
    target_id: r.targetId,
    target_user_id: r.targetUserId,
    reason: r.reason,
    details: r.details.trim().length > 0 ? r.details.trim() : null,
  });
  if (error) fail(error, 'Could not send the report.');
}

export type AdminReport = Database['public']['Functions']['admin_reports']['Returns'][number];

export async function fetchAdminReports(status: 'open' | 'actioned' | 'dismissed'): Promise<AdminReport[]> {
  const { data, error } = await supabase.rpc('admin_reports', { p_status: status, p_limit: 200 });
  if (error) fail(error, 'Could not load reports.');
  return data;
}

/** Admin: dismiss every open report on a target, or remove the content and mark them actioned. */
export async function resolveReports(target: { type: ReportTarget; id: string; userId: string }, remove: boolean, note?: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_resolve_reports', {
    p_target_type: target.type,
    p_target_id: target.id,
    p_target_user: target.userId,
    p_remove: remove,
    p_note: note ?? null,
  });
  if (error) fail(error, 'Could not resolve the report.');
  return data;
}

// ---- terms ----------------------------------------------------------------------

export async function hasAcceptedTerms(userId: string, version: string): Promise<boolean> {
  const { data, error } = await supabase.from('terms_acceptances').select('version').eq('user_id', userId).eq('version', version).maybeSingle();
  if (error) fail(error, 'Could not check the terms.');
  return data !== null;
}

export async function acceptTerms(userId: string, version: string): Promise<void> {
  const { error } = await supabase.from('terms_acceptances').upsert({ user_id: userId, version }, { onConflict: 'user_id,version' });
  if (error) fail(error, 'Could not save your acceptance.');
}

// ---- account (Edge Function) ---------------------------------------------------

async function invokeAccount(body: { action: 'delete_self' } | { action: 'admin_delete_user'; user_id: string }): Promise<void> {
  const { data, error } = await supabase.functions.invoke<ApiEnvelope<{ deleted: string }>>('account', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const envelope = (await (error.context as Response).json().catch(() => null)) as { error?: string } | null;
      throw new SafetyError(envelope?.error ?? 'The request failed.', String((error.context as Response).status));
    }
    throw new SafetyError('Couldn’t reach GamerCred. Check your connection and try again.', null);
  }
  if (!data?.success) throw new SafetyError(data?.error ?? 'The request failed.', null);
}

/** Permanently deletes the signed-in user's account and everything they posted. */
export function deleteMyAccount(): Promise<void> {
  return invokeAccount({ action: 'delete_self' });
}

/** Admin: permanently remove another user's account (e.g. after reports). */
export function adminDeleteUser(userId: string): Promise<void> {
  return invokeAccount({ action: 'admin_delete_user', user_id: userId });
}
