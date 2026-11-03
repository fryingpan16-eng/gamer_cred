import type { PostgrestError } from '@supabase/supabase-js';
import { z } from 'zod';

import { supabase } from './supabase';

/**
 * Stats aggregates (migration 000014). Every function runs in Postgres scoped to
 * auth.uid(), so only small aggregate rows travel to the client.
 */
export class StatsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatsError';
  }
}

function fail(error: PostgrestError): never {
  throw new StatsError(error.message || 'Could not load this stat.');
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function fetchRatingHistogram() {
  const { data, error } = await supabase.rpc('stats_rating_histogram');
  if (error) fail(error);
  return data.map((r) => ({ score: Number(r.score), games: Number(r.games) }));
}

export async function fetchPlatformStats() {
  const { data, error } = await supabase.rpc('stats_platforms');
  if (error) fail(error);
  return data.map((r) => ({ platform_id: num(r.platform_id), games: Number(r.games) }));
}

/** `limit` null = every studio. `totalStudios` is always the full count. */
export async function fetchDeveloperStats(limit: number | null) {
  const { data, error } = await supabase.rpc('stats_developers', { p_limit: limit });
  if (error) fail(error);
  return {
    rows: data.map((r) => ({ name: r.developer, games: Number(r.games) })),
    totalStudios: data[0] ? Number(data[0].total_studios) : 0,
  };
}

export async function fetchGenreStats() {
  const { data, error } = await supabase.rpc('stats_genres');
  if (error) fail(error);
  return data.map((r) => ({
    genre: r.genre,
    games: Number(r.games),
    rated_games: Number(r.rated_games),
    average_rating: num(r.average_rating),
  }));
}

const hotTakeSchema = z.object({
  game_id: z.coerce.number(),
  name: z.string(),
  mine: z.coerce.number(),
  community: z.coerce.number(),
  diff: z.coerce.number(),
});
const vsCommunitySchema = z.object({
  compared: z.coerce.number(),
  my_average: z.coerce.number().nullable(),
  community_average: z.coerce.number().nullable(),
  higher: z.array(hotTakeSchema),
  lower: z.array(hotTakeSchema),
});
export type VsCommunity = z.infer<typeof vsCommunitySchema>;
export type HotTake = z.infer<typeof hotTakeSchema>;

export async function fetchVsCommunity(limit = 5): Promise<VsCommunity> {
  const { data, error } = await supabase.rpc('stats_vs_community', { p_limit: limit });
  if (error) fail(error);
  const parsed = vsCommunitySchema.safeParse(data);
  if (!parsed.success) throw new StatsError('Unexpected response for the community comparison.');
  return parsed.data;
}

export async function fetchReleaseYearStats() {
  const { data, error } = await supabase.rpc('stats_release_years');
  if (error) fail(error);
  return data.map((r) => ({ release_year: num(r.release_year), games: Number(r.games) }));
}

export async function fetchLoggedOverTime() {
  const { data, error } = await supabase.rpc('stats_logged_over_time');
  if (error) fail(error);
  return data.map((r) => ({ month: String(r.month), games: Number(r.games) }));
}
