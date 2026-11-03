-- =============================================================================
-- gamer_cred — 000012 review platform + friends' reviews for a game
-- =============================================================================

-- Which platform the reviewer played on. Same id space as user_platforms
-- (IGDB platform ids; negative ids are GamerCred-only entries such as
-- PC Handheld = -1). Optional; the app validates against its catalog.
alter table public.reviews
  add column platform_id bigint;

-- Accepted friends' published reviews of one game, newest first, with the
-- author's profile. SECURITY INVOKER: RLS still applies (only published
-- reviews are visible), and the friend set is resolved from auth.uid() here
-- rather than sent from the client.
create or replace function public.friend_reviews_for_game(p_game_id bigint)
returns table (
  review_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  platform_id bigint,
  published_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with friends as (
    select case when f.user_id = auth.uid() then f.friend_id else f.user_id end as id
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.user_id, f.friend_id)
  )
  select r.id, r.user_id, p.username, p.avatar_url,
         r.rating, r.rating_input_scale, r.rating_input, r.platform_id,
         coalesce(r.published_at, r.created_at)
  from public.reviews r
  join friends fr on fr.id = r.user_id
  join public.profiles p on p.id = r.user_id
  where r.game_id = p_game_id and r.status = 'published'
  order by coalesce(r.published_at, r.created_at) desc
  limit 50;
$$;

grant execute on function public.friend_reviews_for_game(bigint) to authenticated;
revoke execute on function public.friend_reviews_for_game(bigint) from anon;
