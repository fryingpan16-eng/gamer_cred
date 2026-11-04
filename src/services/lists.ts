/**
 * Game lists (migration 000019). Anyone can make lists; public lists are
 * readable and searchable by everyone, private ones only by their owner.
 * App admins pin public lists to the Home tab.
 */
import type { PostgrestError } from '@supabase/supabase-js';

import type { ListFormValues } from '@/utils/listSchemas';
import { parseSmartRule, smartListResultSchema, type SmartListResult, type SmartRule } from '@/utils/smartLists';

import { supabase } from './supabase';

export class ListError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'ListError';
  }
}

function fail(error: PostgrestError, fallback: string): never {
  // LS001–LS004 carry readable messages from the database (see the migration).
  throw new ListError(error.message || fallback, error.code ?? null);
}

export type ListOwner = { id: string; username: string; avatar_url: string | null };

export type ListSummary = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  isRanked: boolean;
  isPublic: boolean;
  pinnedRank: number | null;
  /** Admin smart list: games come from this rule, not list_items (migration 000023). */
  smartRule: SmartRule | null;
  updatedAt: string;
  owner: ListOwner | null;
  /** Games in the list (a smart list's from its saved result, smart_list_previews). */
  gameCount: number;
  /** First few games (by position / rank), for the cover mosaic. */
  previewGameIds: number[];
};

export type ListDetail = ListSummary & {
  createdAt: string;
  /** Every game, in list order. */
  gameIds: number[];
};

const PREVIEW_COUNT = 4;

const SUMMARY_SELECT = `
  id, user_id, title, description, is_ranked, is_public, pinned_rank, smart_rule, updated_at,
  owner:profiles!lists_user_id_fkey ( id, username, avatar_url ),
  item_count:list_items ( count ),
  preview:list_items ( game_id, position )
` as const;

function summaryQuery() {
  return supabase
    .from('lists')
    .select(SUMMARY_SELECT)
    .order('position', { referencedTable: 'preview', ascending: true })
    .limit(PREVIEW_COUNT, { referencedTable: 'preview' });
}

type SummaryRow = NonNullable<Awaited<ReturnType<typeof summaryQuery>>['data']>[number];

function toSummary(row: SummaryRow): ListSummary {
  const owner = Array.isArray(row.owner) ? (row.owner[0] ?? null) : row.owner;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    isRanked: row.is_ranked,
    isPublic: row.is_public,
    pinnedRank: row.pinned_rank,
    smartRule: parseSmartRule(row.smart_rule),
    updatedAt: row.updated_at,
    owner: owner ?? null,
    gameCount: row.item_count[0]?.count ?? 0,
    previewGameIds: [...row.preview].sort((a, b) => a.position - b.position).map((p) => p.game_id),
  };
}

/**
 * Smart lists have no list_items: fill their count and first covers from the
 * saved result, one call for every smart list in the batch (migration 000036).
 */
async function withSmartPreviews(lists: ListSummary[]): Promise<ListSummary[]> {
  const smartIds = lists.filter((l) => l.smartRule !== null).map((l) => l.id);
  if (smartIds.length === 0) return lists;
  const { data, error } = await supabase.rpc('smart_list_previews', { p_list_ids: smartIds });
  if (error) {
    // Cards still show; only the smart lists' covers and counts are missing.
    console.warn('[lists] smart list previews unavailable', error.message);
    return lists;
  }
  const byId = new Map((data ?? []).map((r) => [r.list_id, r] as const));
  return lists.map((l) => {
    const preview = byId.get(l.id);
    return preview ? { ...l, gameCount: preview.game_count, previewGameIds: preview.preview_game_ids.map(Number) } : l;
  });
}

/** Admin-curated lists for the Home tab, in pinned order. */
export async function fetchPinnedLists(): Promise<ListSummary[]> {
  const { data, error } = await summaryQuery().not('pinned_rank', 'is', null).order('pinned_rank', { ascending: true });
  if (error) fail(error, 'Could not load featured lists.');
  return withSmartPreviews(data.map(toSummary));
}

/** A player's lists, most recently updated first (RLS hides their private ones from others). */
export async function fetchUserLists(userId: string): Promise<ListSummary[]> {
  const { data, error } = await summaryQuery().eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) fail(error, 'Could not load lists.');
  return withSmartPreviews(data.map(toSummary));
}

/** Recently updated public lists that have games (or fill themselves) — the list browser's default view. */
export async function fetchRecentLists(limit = 20): Promise<ListSummary[]> {
  const { data, error } = await summaryQuery()
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
    .limit(limit * 2);
  if (error) fail(error, 'Could not load lists.');
  return withSmartPreviews(
    data
      .map(toSummary)
      .filter((l) => l.gameCount > 0 || l.smartRule !== null)
      .slice(0, limit),
  );
}

/** Characters that would break a PostgREST `or=(…)` filter or act as wildcards. */
export function listSearchPattern(term: string): string | null {
  const cleaned = term
    .replace(/[,()*%\\:."]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length >= 2 ? `%${cleaned}%` : null;
}

/** Public lists whose title or description matches (trigram-indexed `ilike`). */
export async function searchLists(term: string, limit = 30): Promise<ListSummary[]> {
  const pattern = listSearchPattern(term);
  if (!pattern) return [];
  const { data, error } = await summaryQuery()
    .eq('is_public', true)
    .or(`title.ilike.${pattern},description.ilike.${pattern}`)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) fail(error, 'Could not search lists.');
  return withSmartPreviews(data.map(toSummary));
}

/** One list with every game in order. Null when it doesn't exist or is someone else's private list. */
export async function fetchList(listId: string): Promise<ListDetail | null> {
  const { data, error } = await supabase
    .from('lists')
    .select(
      `id, user_id, title, description, is_ranked, is_public, pinned_rank, smart_rule, created_at, updated_at,
       owner:profiles!lists_user_id_fkey ( id, username, avatar_url ),
       items:list_items ( game_id, position )`,
    )
    .eq('id', listId)
    .order('position', { referencedTable: 'items', ascending: true })
    .maybeSingle();
  if (error) fail(error, 'Could not load the list.');
  if (!data) return null;
  const owner = Array.isArray(data.owner) ? (data.owner[0] ?? null) : data.owner;
  const gameIds = [...data.items].sort((a, b) => a.position - b.position).map((i) => i.game_id);
  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    description: data.description,
    isRanked: data.is_ranked,
    isPublic: data.is_public,
    pinnedRank: data.pinned_rank,
    smartRule: parseSmartRule(data.smart_rule),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    owner: owner ?? null,
    gameCount: gameIds.length,
    previewGameIds: gameIds.slice(0, PREVIEW_COUNT),
    gameIds,
  };
}

const listColumns = (values: ListFormValues) => ({
  title: values.title,
  description: values.description.length > 0 ? values.description : null,
  // Smart lists are always ranked (the database enforces it too).
  is_ranked: values.smartRule !== null || values.isRanked,
  is_public: values.isPublic,
  smart_rule: values.smartRule,
});

export async function createList(userId: string, values: ListFormValues): Promise<string> {
  const { data, error } = await supabase
    .from('lists')
    .insert({ user_id: userId, ...listColumns(values) })
    .select('id')
    .single();
  if (error) fail(error, 'Could not create the list.');
  return data.id;
}

export async function updateList(listId: string, values: ListFormValues): Promise<void> {
  const { error } = await supabase.from('lists').update(listColumns(values)).eq('id', listId);
  if (error) {
    if (error.code === '23514' && !values.isPublic) {
      throw new ListError('This list is featured on the Home tab, so it has to stay public.', error.code);
    }
    fail(error, 'Could not save the list.');
  }
}

export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) fail(error, 'Could not delete the list.');
}

export async function addListItem(listId: string, gameId: number): Promise<void> {
  const { error } = await supabase.rpc('add_list_item', { p_list_id: listId, p_game_id: gameId });
  if (error) fail(error, 'Could not add the game.');
}

export async function removeListItem(listId: string, gameId: number): Promise<void> {
  const { error } = await supabase.from('list_items').delete().eq('list_id', listId).eq('game_id', gameId);
  if (error) fail(error, 'Could not remove the game.');
}

/** Move a game to 1-based position `to`. */
export async function moveListItem(listId: string, gameId: number, to: number): Promise<void> {
  const { error } = await supabase.rpc('move_list_item', { p_list_id: listId, p_game_id: gameId, p_to: to });
  if (error) fail(error, 'Could not move the game.');
}

/** Admin only: pin to Home at `rank` (1 = first), or unpin with null. */
export async function setListPin(listId: string, rank: number | null): Promise<void> {
  const { error } = await supabase.rpc('set_list_pin', { p_list_id: listId, p_rank: rank });
  if (error) fail(error, 'Could not update the featured lists.');
}

/** A smart list's games, worked out live from Gamer Cred ratings. Null when the list isn't smart or visible. */
export async function fetchSmartListGames(listId: string): Promise<SmartListResult | null> {
  const { data, error } = await supabase.rpc('smart_list_games', { p_list_id: listId });
  if (error) fail(error, 'Could not load this list.');
  if (data === null) return null;
  const parsed = smartListResultSchema.safeParse(data);
  if (!parsed.success) throw new ListError('This list returned data the app could not read.', null);
  return parsed.data;
}

export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_app_admin');
  if (error) fail(error, 'Could not check admin status.');
  return data === true;
}
