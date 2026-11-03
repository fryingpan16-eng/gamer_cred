-- =============================================================================
-- gamer_cred — 000017 a player's full ratings list (profile → Ratings spreadsheet)
-- Read-only function; no tables or data change.
-- =============================================================================

-- One call: every rating of p_user_id with the game metadata the list sorts
-- and filters on (public.games, 000014) and their published review, if any.
-- SECURITY INVOKER: game_ratings and games are public; RLS only exposes
-- published reviews. Games never cached by the proxy come back with null
-- metadata (the app fills names in and buckets the rest as Unknown).
create or replace function public.user_ratings_table(p_user_id uuid)
returns table (
  game_id bigint,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  platform_id bigint,
  rated_at timestamptz,
  name text,
  release_year smallint,
  genres text[],
  developers text[],
  community_rating smallint,
  review_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select q.game_id, q.rating, q.rating_input_scale, q.rating_input, q.platform_id, q.updated_at,
         g.name, g.release_year, coalesce(g.genres, '{}'), coalesce(g.developers, '{}'), g.community_rating,
         r.id
  from public.game_ratings q
  left join public.games g on g.igdb_id = q.game_id
  left join public.reviews r on r.user_id = q.user_id and r.game_id = q.game_id and r.status = 'published'
  where q.user_id = p_user_id
  order by q.updated_at desc
  limit 5000;
$$;

grant execute on function public.user_ratings_table(uuid) to authenticated;
revoke execute on function public.user_ratings_table(uuid) from anon;
