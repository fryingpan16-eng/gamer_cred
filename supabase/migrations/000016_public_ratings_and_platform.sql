-- =============================================================================
-- gamer_cred — 000016 public quick ratings + "played on" platform
--
-- 1. game_ratings.platform_id: the platform the game was played on (catalog id
--    = IGDB platform id, same space as reviews.platform_id / user_platforms).
--    The app sends the user's pick, or the game's earliest release platform
--    when they don't choose. Existing ratings copy it from the user's review.
-- 2. Quick ratings are PUBLIC to read (like published reviews); only the owner
--    can write. They still never create or publish a review.
-- 3. One score per game, now also one platform: the sync triggers from 000015
--    keep the platform equal on the rating and the user's review. A review
--    saved with "not specified" keeps the rating's platform (and vice versa).
-- 4. Stats: the review's platform, else the rating's.
-- 5. friend_ratings_for_game: friends' ratings (quick or reviewed) of a game.
--
-- Non-destructive: one column added; no existing column or row removed.
-- =============================================================================

-- ---- 1. platform -------------------------------------------------------------
alter table public.game_ratings add column platform_id bigint;

update public.game_ratings q
   set platform_id = r.platform_id
  from public.reviews r
 where r.user_id = q.user_id and r.game_id = q.game_id
   and r.platform_id is not null and q.platform_id is null;

-- ---- 2. public read ----------------------------------------------------------
drop policy "game_ratings: owner read" on public.game_ratings;
create policy "game_ratings: public read"
  on public.game_ratings for select
  using (true);

-- Profile "Ratings" list (a user's ratings, newest first) is served by
-- idx_game_ratings_user_updated from 000015.

-- ---- 3. sync triggers now carry the platform ---------------------------------
create or replace function public.reviews_sync_game_rating()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rating is null then
    return null; -- an unscored draft leaves the quick rating alone
  end if;
  insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input, platform_id)
  values (new.user_id, new.game_id, new.rating, new.rating_input_scale, new.rating_input, new.platform_id)
  on conflict (user_id, game_id) do update
    set rating = excluded.rating,
        rating_input_scale = excluded.rating_input_scale,
        rating_input = excluded.rating_input,
        platform_id = coalesce(excluded.platform_id, public.game_ratings.platform_id)
    where (public.game_ratings.rating, public.game_ratings.rating_input_scale, public.game_ratings.rating_input,
           public.game_ratings.platform_id)
          is distinct from (excluded.rating, excluded.rating_input_scale, excluded.rating_input,
                            coalesce(excluded.platform_id, public.game_ratings.platform_id));
  return null;
end;
$$;

drop trigger reviews_sync_game_rating on public.reviews;
create trigger reviews_sync_game_rating
  after insert or update of rating, rating_input_scale, rating_input, platform_id on public.reviews
  for each row execute function public.reviews_sync_game_rating();

create or replace function public.game_ratings_sync_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.reviews r
     set rating = new.rating,
         rating_input_scale = new.rating_input_scale,
         rating_input = new.rating_input,
         platform_id = coalesce(new.platform_id, r.platform_id)
   where r.user_id = new.user_id
     and r.game_id = new.game_id
     and (r.rating, r.rating_input_scale, r.rating_input, r.platform_id)
         is distinct from (new.rating, new.rating_input_scale, new.rating_input, coalesce(new.platform_id, r.platform_id));
  return null;
end;
$$;

-- ---- 4. stats: platform from the review, else the rating --------------------
create or replace function public.my_logged_games()
returns table (game_id bigint, first_logged timestamptz, rating smallint, platform_id bigint)
language sql stable security invoker set search_path = ''
as $$
  with ids as (
    select s.game_id, min(s.created_at) as first_logged
    from (
      select r.game_id, r.created_at from public.reviews r where r.user_id = auth.uid()
      union all
      select q.game_id, q.created_at from public.game_ratings q where q.user_id = auth.uid()
    ) s
    group by s.game_id
  )
  select i.game_id, i.first_logged, coalesce(q.rating, r.rating), coalesce(r.platform_id, q.platform_id)
  from ids i
  left join public.game_ratings q on q.user_id = auth.uid() and q.game_id = i.game_id
  left join public.reviews r on r.user_id = auth.uid() and r.game_id = i.game_id;
$$;

-- ---- 5. friends' ratings of a game (quick ratings + reviewed) ---------------
-- Every rated review is mirrored into game_ratings, so this covers both;
-- review_id is set when that friend has a PUBLISHED review to open.
create or replace function public.friend_ratings_for_game(p_game_id bigint)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  platform_id bigint,
  review_id uuid,
  rated_at timestamptz
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
  select q.user_id, p.username, p.avatar_url,
         q.rating, q.rating_input_scale, q.rating_input, coalesce(r.platform_id, q.platform_id),
         r.id, q.updated_at
  from public.game_ratings q
  join friends fr on fr.id = q.user_id
  join public.profiles p on p.id = q.user_id
  left join public.reviews r on r.user_id = q.user_id and r.game_id = q.game_id and r.status = 'published'
  where q.game_id = p_game_id
  order by q.updated_at desc
  limit 50;
$$;

grant execute on function public.friend_ratings_for_game(bigint) to authenticated;
revoke execute on function public.friend_ratings_for_game(bigint) from anon;
