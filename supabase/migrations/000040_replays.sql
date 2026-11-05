-- =============================================================================
-- gamer_cred — 000040 replays
--
-- A player can play a game any number of times. Two ways to record a replay:
--   1. Game page "Mark as Replayed": a game_replays row (date finished +
--      platform, no score or text).
--   2. Review Studio: a new review of a game you already reviewed. Its score
--      becomes your score for the game; older reviews keep theirs.
--
-- Changes:
-- 1. reviews: the one-review-per-game rule (reviews_one_per_user_game) is
--    replaced by one DRAFT per game. New columns is_replay + finished_on.
--    A review written after another review of the same game is always a replay
--    (server-set). Existing reviews are untouched (is_replay = false).
-- 2. "Current review" = your newest review of the game, not counting an
--    unpublished replay draft. Only it syncs with your quick rating (000015/16).
--    Deleting it puts your score back to the review before it.
-- 3. game_replays: plain replays. Public to read like ratings, hidden when
--    blocked, owner insert/delete, members only. Marking one takes the game
--    off your backlog (like rating it, 000035).
-- 4. Replay count = plain replays + published replay reviews. Plays = replays + 1.
-- 5. Functions that joined "the" review now pick one (no duplicate rows), and
--    report replay counts: my_logged_games, friend_ratings_for_game,
--    user_ratings_table, game_reviews_browse (each player's newest review),
--    activity_feed / trending_posts (+ is_replay, + 'replay' items).
-- 6. New: review_playthroughs, most_replayed_game, replay_counts, stats_replays.
--
-- Non-destructive: one unique constraint dropped (no rows change), columns and
-- a table added.
-- =============================================================================

-- ---- 1. reviews: many per game, one draft ----------------------------------------------------
alter table public.reviews drop constraint if exists reviews_one_per_user_game;
alter table public.reviews add column if not exists is_replay boolean not null default false;
alter table public.reviews add column if not exists finished_on date;
alter table public.reviews add constraint reviews_finished_on_min check (finished_on is null or finished_on >= date '1970-01-01');

create unique index if not exists reviews_one_draft_per_game on public.reviews (user_id, game_id) where status = 'draft';
create index if not exists idx_reviews_user_game on public.reviews (user_id, game_id, created_at desc);

-- A review after another review of the same game is a replay; replays get a
-- finished date (today unless given); no finish dates in the future.
create or replace function public.reviews_replay_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_created timestamptz := case when tg_op = 'INSERT' then now() else old.created_at end;
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.game_id := old.game_id;
  end if;
  if exists (
    select 1 from public.reviews o
     where o.user_id = new.user_id and o.game_id = new.game_id and o.id <> new.id
       and (tg_op = 'INSERT' or o.created_at < v_created)
  ) then
    new.is_replay := true;
  end if;
  if new.is_replay and new.finished_on is null then
    new.finished_on := current_date;
  end if;
  if new.finished_on is not null and new.finished_on > current_date + 1 then
    raise exception 'The finish date can''t be in the future.' using errcode = 'RP001';
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_replay_guard on public.reviews;
create trigger reviews_replay_guard
  before insert or update on public.reviews
  for each row execute function public.reviews_replay_guard();

-- ---- 2. one score per game = the current review's -------------------------------------------
-- The current review: newest by created_at, skipping an unpublished replay draft.
-- It syncs when it changes; unpublishing a replay review hands the score back
-- to the review before it.
create or replace function public.reviews_sync_game_rating()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c public.reviews%rowtype;
begin
  select r.* into c from public.reviews r
   where r.user_id = new.user_id and r.game_id = new.game_id
     and not (r.is_replay and r.status = 'draft')
   order by r.created_at desc, r.id desc
   limit 1;
  if c.id is null or c.rating is null then
    return null; -- nothing scored to sync (an unscored draft leaves the quick rating alone)
  end if;
  if c.id <> new.id and not (tg_op = 'UPDATE' and new.is_replay and old.status = 'published' and new.status = 'draft') then
    return null; -- an older review, or a replay draft not yet published
  end if;
  insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input, platform_id)
  values (c.user_id, c.game_id, c.rating, c.rating_input_scale, c.rating_input, c.platform_id)
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

drop trigger if exists reviews_sync_game_rating on public.reviews;
create trigger reviews_sync_game_rating
  after insert or update of rating, rating_input_scale, rating_input, platform_id, status on public.reviews
  for each row execute function public.reviews_sync_game_rating();

-- Quick rating changed → only the current review follows; older reviews keep their score.
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
   where r.id = (
           select c.id from public.reviews c
            where c.user_id = new.user_id and c.game_id = new.game_id
              and not (c.is_replay and c.status = 'draft')
            order by c.created_at desc, c.id desc
            limit 1
         )
     and (r.rating, r.rating_input_scale, r.rating_input, r.platform_id)
         is distinct from (new.rating, new.rating_input_scale, new.rating_input, coalesce(new.platform_id, r.platform_id));
  return null;
end;
$$;

-- Deleting the current review puts your score back to the review before it.
-- Cascades (account deletion) skip this.
create or replace function public.reviews_after_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v public.reviews%rowtype;
begin
  if pg_trigger_depth() > 1 or (old.is_replay and old.status = 'draft') then
    return null; -- cascades, and replay drafts (never the current review)
  end if;
  select c.* into v from public.reviews c
   where c.user_id = old.user_id and c.game_id = old.game_id
     and not (c.is_replay and c.status = 'draft')
   order by c.created_at desc, c.id desc
   limit 1;
  if v.id is null or v.rating is null or v.created_at > old.created_at then
    return null; -- nothing left to fall back to, or the deleted review wasn't the current one
  end if;
  update public.game_ratings q
     set rating = v.rating, rating_input_scale = v.rating_input_scale, rating_input = v.rating_input,
         platform_id = coalesce(v.platform_id, q.platform_id)
   where q.user_id = old.user_id and q.game_id = old.game_id
     and (q.rating, q.rating_input_scale, q.rating_input) is distinct from (v.rating, v.rating_input_scale, v.rating_input);
  return null;
end;
$$;

drop trigger if exists reviews_after_delete on public.reviews;
create trigger reviews_after_delete
  after delete on public.reviews
  for each row execute function public.reviews_after_delete();

-- ---- 3. plain replays -------------------------------------------------------------------------
create table if not exists public.game_replays (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  game_id     bigint not null,
  platform_id bigint,
  finished_on date not null default current_date,
  created_at  timestamptz not null default now(),
  constraint game_replays_finished_on_min check (finished_on >= date '1970-01-01')
);

create index if not exists idx_game_replays_user_game on public.game_replays (user_id, game_id, finished_on desc);
create index if not exists idx_game_replays_user_created on public.game_replays (user_id, created_at desc);
create index if not exists idx_game_replays_game on public.game_replays (game_id);

alter table public.game_replays enable row level security;

create policy "game_replays: read" on public.game_replays
  for select to authenticated using (true);
create policy "game_replays: hide blocked" on public.game_replays as restrictive
  for select to authenticated using (not (user_id = any ((select private.hidden_user_ids())::uuid[])));
create policy "game_replays: owner insert" on public.game_replays
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "game_replays: owner delete" on public.game_replays
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "game_replays: members insert" on public.game_replays as restrictive
  for insert to authenticated with check (not (select public.is_guest()));
create policy "game_replays: members delete" on public.game_replays as restrictive
  for delete to authenticated using (not (select public.is_guest()));

revoke all on public.game_replays from anon;
grant select, insert, delete on public.game_replays to authenticated;

-- Server-owned created_at; no future finish dates; a generous per-game cap
-- ("unlimited in theory", but no runaway scripts).
create or replace function public.game_replays_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  if new.finished_on > current_date + 1 then
    raise exception 'The finish date can''t be in the future.' using errcode = 'RP001';
  end if;
  if (select count(*) from public.game_replays r where r.user_id = new.user_id and r.game_id = new.game_id) >= 1000 then
    raise exception 'That''s the most replays one game can hold.' using errcode = 'RP002';
  end if;
  return new;
end;
$$;

drop trigger if exists game_replays_before_insert on public.game_replays;
create trigger game_replays_before_insert
  before insert on public.game_replays
  for each row execute function public.game_replays_before_insert();

-- Finishing a game again takes it off the backlog, like rating it (000035).
create or replace function public.replay_leaves_backlog()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.game_backlog where user_id = new.user_id and game_id = new.game_id;
  return null;
end;
$$;

drop trigger if exists game_replays_leave_backlog on public.game_replays;
create trigger game_replays_leave_backlog
  after insert on public.game_replays
  for each row execute function public.replay_leaves_backlog();

-- ---- 4. stats: one row per logged game (now also replay-only games) ---------------------------
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
      union all
      select p.game_id, p.created_at from public.game_replays p where p.user_id = auth.uid()
    ) s
    group by s.game_id
  )
  select i.game_id, i.first_logged, coalesce(q.rating, cr.rating),
         coalesce(cr.platform_id, q.platform_id,
                  (select p.platform_id from public.game_replays p
                    where p.user_id = auth.uid() and p.game_id = i.game_id and p.platform_id is not null
                    order by p.finished_on desc, p.created_at desc limit 1))
  from ids i
  left join public.game_ratings q on q.user_id = auth.uid() and q.game_id = i.game_id
  left join lateral (
    select r.rating, r.platform_id from public.reviews r
     where r.user_id = auth.uid() and r.game_id = i.game_id and not (r.is_replay and r.status = 'draft')
     order by r.created_at desc, r.id desc
     limit 1
  ) cr on true;
$$;

-- ---- 5a. friends' ratings of a game: newest published review + replay count ------------------
drop function if exists public.friend_ratings_for_game(bigint);
create function public.friend_ratings_for_game(p_game_id bigint)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  platform_id bigint,
  review_id uuid,
  rated_at timestamptz,
  replays integer
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
         r.id, q.updated_at,
         ((select count(*) from public.game_replays x where x.user_id = q.user_id and x.game_id = q.game_id)
          + (select count(*) from public.reviews y
              where y.user_id = q.user_id and y.game_id = q.game_id and y.status = 'published' and y.is_replay))::integer
  from public.game_ratings q
  join friends fr on fr.id = q.user_id
  join public.profiles p on p.id = q.user_id
  left join lateral (
    select r.id, r.platform_id from public.reviews r
     where r.user_id = q.user_id and r.game_id = q.game_id and r.status = 'published'
     order by r.created_at desc, r.id desc
     limit 1
  ) r on true
  where q.game_id = p_game_id
  order by q.updated_at desc
  limit 50;
$$;

grant execute on function public.friend_ratings_for_game(bigint) to authenticated;
revoke execute on function public.friend_ratings_for_game(bigint) from public, anon;

-- ---- 5b. a player's ratings list: newest published review + replay count ---------------------
drop function if exists public.user_ratings_table(uuid);
create function public.user_ratings_table(p_user_id uuid)
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
  review_id uuid,
  replays integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with replay_counts as (
    select s.game_id, count(*)::integer as n
    from (
      select x.game_id from public.game_replays x where x.user_id = p_user_id
      union all
      select y.game_id from public.reviews y where y.user_id = p_user_id and y.status = 'published' and y.is_replay
    ) s
    group by s.game_id
  )
  select q.game_id, q.rating, q.rating_input_scale, q.rating_input, q.platform_id, q.updated_at,
         g.name, g.release_year, coalesce(g.genres, '{}'), coalesce(g.developers, '{}'), g.community_rating,
         r.id, coalesce(rc.n, 0)
  from public.game_ratings q
  left join public.games g on g.igdb_id = q.game_id
  left join lateral (
    select r.id from public.reviews r
     where r.user_id = q.user_id and r.game_id = q.game_id and r.status = 'published'
     order by r.created_at desc, r.id desc
     limit 1
  ) r on true
  left join replay_counts rc on rc.game_id = q.game_id
  where q.user_id = p_user_id
  order by q.updated_at desc
  limit 5000;
$$;

grant execute on function public.user_ratings_table(uuid) to authenticated;
revoke execute on function public.user_ratings_table(uuid) from public, anon;

-- ---- 5c. a game's review browser: each player's newest published review ----------------------
drop function if exists public.game_reviews_browse(bigint, text, text, integer, integer);
create function public.game_reviews_browse(
  p_game_id bigint,
  p_scope text default 'community',
  p_sort text default 'recent',
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  user_id uuid,
  game_id bigint,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  content text,
  platform_id bigint,
  published_at timestamptz,
  updated_at timestamptz,
  author_username text,
  author_avatar_url text,
  is_replay boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_scope not in ('community', 'friends') then
    raise exception 'Unknown scope: %', p_scope using errcode = '22023';
  end if;
  if p_sort not in ('popular', 'recent', 'highest', 'lowest') then
    raise exception 'Unknown sort: %', p_sort using errcode = '22023';
  end if;

  return query
  with friends as (
    select case when f.user_id = (select auth.uid()) then f.friend_id else f.user_id end as fid
      from public.friendships f
     where f.status = 'accepted' and (select auth.uid()) in (f.user_id, f.friend_id)
  ),
  newest as (
    select distinct on (r.user_id) r.*
      from public.reviews r
     where r.game_id = p_game_id
       and r.status = 'published'
       and not (r.user_id = any ((select private.hidden_user_ids())::uuid[]))
       and (p_scope = 'community' or r.user_id in (select fid from friends))
     order by r.user_id, r.created_at desc, r.id desc
  ),
  picked as (
    select n.*, coalesce(c.likes, 0) as likes
      from newest n
      left join private.review_like_counts c on c.review_id = n.id
  )
  select p.id, p.user_id, p.game_id, p.rating, p.rating_input_scale, p.rating_input, p.content,
         p.platform_id, p.published_at, p.updated_at, pr.username, pr.avatar_url, p.is_replay
    from picked p
    join public.profiles pr on pr.id = p.user_id
   order by
     case when p_sort = 'popular' then p.likes end desc nulls last,
     case when p_sort = 'highest' then p.rating end desc nulls last,
     case when p_sort = 'lowest' then p.rating end asc nulls last,
     coalesce(p.published_at, p.updated_at) desc,
     p.id desc
   offset greatest(coalesce(p_offset, 0), 0)
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

grant execute on function public.game_reviews_browse(bigint, text, text, integer, integer) to authenticated;
revoke execute on function public.game_reviews_browse(bigint, text, text, integer, integer) from public, anon;

-- ---- 5d. feed: replay reviews are marked; friends' plain replays are items -------------------
-- Same as 000036, plus the is_replay column and the 'replay' kind (friends scope).
drop function if exists public.activity_feed(text, timestamptz, text, integer);
create function public.activity_feed(
  p_scope text default 'friends',
  p_before timestamptz default null,
  p_before_key text default null,
  p_limit integer default 20
)
returns table (
  item_key text,
  kind text,
  occurred_at timestamptz,
  actor_id uuid,
  actor_username text,
  actor_avatar_url text,
  game_id bigint,
  review_id uuid,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  excerpt text,
  slot_index smallint,
  preliminary_score smallint,
  preliminary_input_scale public.rating_scale,
  preliminary_input text,
  is_replay boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select least(greatest(coalesce(p_limit, 20), 1), 50) as lim,
           coalesce(p_before_key, '') as before_key
  ),
  friends as (
    select case when f.user_id = auth.uid() then f.friend_id else f.user_id end as id
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.user_id, f.friend_id)
  ),
  review_items as (
    (
      select 'review:' || r.id::text as item_key,
             'review'::text as kind,
             r.published_at as occurred_at,
             r.user_id as actor_id,
             r.game_id,
             r.id as review_id,
             r.rating,
             r.rating_input_scale,
             r.rating_input,
             left(r.content, 280) as excerpt,
             null::smallint as slot_index,
             null::smallint as preliminary_score,
             null::public.rating_scale as preliminary_input_scale,
             null::text as preliminary_input,
             r.is_replay
      from public.reviews r, params
      where p_scope = 'community'
        and r.status = 'published'
        and r.published_at <= coalesce(p_before, 'infinity'::timestamptz)
        and (p_before is null
             or (r.published_at, 'review:' || r.id::text) < (p_before, params.before_key))
      order by r.published_at desc, 1 desc
      limit (select lim from params)
    )
    union all
    (
      select 'review:' || r.id::text,
             'review'::text,
             r.published_at,
             r.user_id,
             r.game_id,
             r.id,
             r.rating,
             r.rating_input_scale,
             r.rating_input,
             left(r.content, 280),
             null::smallint,
             null::smallint,
             null::public.rating_scale,
             null::text,
             r.is_replay
      from public.reviews r, params
      where p_scope = 'friends'
        and r.status = 'published'
        and r.user_id in (select id from friends)
        and r.published_at <= coalesce(p_before, 'infinity'::timestamptz)
        and (p_before is null
             or (r.published_at, 'review:' || r.id::text) < (p_before, params.before_key))
      order by r.published_at desc, 1 desc
      limit (select lim from params)
    )
  ),
  now_playing_items as (
    select 'now_playing:' || n.user_id::text || ':' || n.slot_index as item_key,
           'now_playing'::text as kind,
           n.updated_at as occurred_at,
           n.user_id as actor_id,
           n.game_id,
           null::uuid as review_id,
           null::smallint as rating,
           null::public.rating_scale as rating_input_scale,
           null::text as rating_input,
           left(n.notes, 280) as excerpt,
           n.slot_index,
           n.preliminary_score,
           n.preliminary_input_scale,
           n.preliminary_input,
           false as is_replay
    from public.now_playing n, params
    where p_scope = 'friends'
      and n.user_id in (select id from friends)
      and (p_before is null
           or (n.updated_at, 'now_playing:' || n.user_id::text || ':' || n.slot_index) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
  ),
  like_items as (
    select 'like:' || l.user_id::text || ':' || l.game_id as item_key,
           'like'::text as kind,
           l.created_at as occurred_at,
           l.user_id as actor_id,
           l.game_id,
           null::uuid as review_id,
           null::smallint as rating,
           null::public.rating_scale as rating_input_scale,
           null::text as rating_input,
           null::text as excerpt,
           null::smallint as slot_index,
           null::smallint as preliminary_score,
           null::public.rating_scale as preliminary_input_scale,
           null::text as preliminary_input,
           false as is_replay
    from public.game_likes l, params
    where p_scope = 'friends'
      and l.user_id in (select id from friends)
      and (p_before is null
           or (l.created_at, 'like:' || l.user_id::text || ':' || l.game_id) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
  ),
  replay_items as (
    select 'replay:' || x.id::text as item_key,
           'replay'::text as kind,
           x.created_at as occurred_at,
           x.user_id as actor_id,
           x.game_id,
           null::uuid as review_id,
           null::smallint as rating,
           null::public.rating_scale as rating_input_scale,
           null::text as rating_input,
           null::text as excerpt,
           null::smallint as slot_index,
           null::smallint as preliminary_score,
           null::public.rating_scale as preliminary_input_scale,
           null::text as preliminary_input,
           true as is_replay
    from public.game_replays x, params
    where p_scope = 'friends'
      and x.user_id in (select id from friends)
      and (p_before is null
           or (x.created_at, 'replay:' || x.id::text) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
  ),
  merged as (
    select * from review_items
    union all
    select * from now_playing_items
    union all
    select * from like_items
    union all
    select * from replay_items
  )
  select m.item_key, m.kind, m.occurred_at, m.actor_id,
         p.username, p.avatar_url,
         m.game_id, m.review_id, m.rating, m.rating_input_scale, m.rating_input,
         m.excerpt, m.slot_index, m.preliminary_score, m.preliminary_input_scale, m.preliminary_input,
         m.is_replay
  from merged m
  join public.profiles p on p.id = m.actor_id
  order by m.occurred_at desc, m.item_key desc
  limit (select lim from params);
$$;

grant execute on function public.activity_feed(text, timestamptz, text, integer) to authenticated;
revoke execute on function public.activity_feed(text, timestamptz, text, integer) from public, anon;

create index if not exists idx_game_replays_created on public.game_replays (created_at desc);

drop function if exists public.trending_posts(integer, integer);
create function public.trending_posts(p_days integer default 14, p_limit integer default 10)
returns table (
  item_key text,
  kind text,
  occurred_at timestamptz,
  actor_id uuid,
  actor_username text,
  actor_avatar_url text,
  game_id bigint,
  review_id uuid,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  excerpt text,
  slot_index smallint,
  preliminary_score smallint,
  preliminary_input_scale public.rating_scale,
  preliminary_input text,
  is_replay boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 90)) as since,
           least(greatest(coalesce(p_limit, 10), 1), 50) as lim
  ),
  hot as (
    select t.game_id, t.players, t.activity from public.trending_games(p_days, 50) t
  )
  select 'review:' || r.id::text, 'review'::text, r.published_at,
         r.user_id, p.username, p.avatar_url, r.game_id, r.id,
         r.rating, r.rating_input_scale, r.rating_input, left(r.content, 280),
         null::smallint, null::smallint, null::public.rating_scale, null::text,
         r.is_replay
  from public.reviews r
  join hot h on h.game_id = r.game_id
  join public.profiles p on p.id = r.user_id
  where r.status = 'published' and r.published_at >= (select since from params)
  order by h.players desc, h.activity desc, r.published_at desc
  limit (select lim from params);
$$;

grant execute on function public.trending_posts(integer, integer) to authenticated;
revoke execute on function public.trending_posts(integer, integer) from public, anon;

-- ---- 6a. a review's playthroughs: the author's published reviews of that game ---------------
create or replace function public.review_playthroughs(p_review_id uuid)
returns table (
  id uuid,
  n integer,
  total integer,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  is_replay boolean,
  finished_on date,
  published_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with target as (
    select r.user_id, r.game_id from public.reviews r where r.id = p_review_id
  ),
  mine as (
    select r.*, row_number() over (order by r.created_at, r.id) as rn, count(*) over () as cnt
      from public.reviews r, target t
     where r.user_id = t.user_id and r.game_id = t.game_id and r.status = 'published'
  )
  select m.id, m.rn::integer, m.cnt::integer, m.rating, m.rating_input_scale, m.rating_input,
         m.is_replay, m.finished_on, m.published_at
    from mine m
   order by m.rn
   limit 200;
$$;

grant execute on function public.review_playthroughs(uuid) to authenticated;
revoke execute on function public.review_playthroughs(uuid) from public, anon;

-- ---- 6b. profile card: a player's most replayed game ----------------------------------------
create or replace function public.most_replayed_game(p_user_id uuid)
returns table (game_id bigint, replays integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.game_id, count(*)::integer
  from (
    select x.game_id, x.created_at as at from public.game_replays x where x.user_id = p_user_id
    union all
    select y.game_id, y.created_at from public.reviews y where y.user_id = p_user_id and y.status = 'published' and y.is_replay
  ) s
  group by s.game_id
  order by count(*) desc, max(s.at) desc, s.game_id
  limit 1;
$$;

grant execute on function public.most_replayed_game(uuid) to authenticated;
revoke execute on function public.most_replayed_game(uuid) from public, anon;

-- ---- 6b2. replay counts for a set of a player's games (profile Ratings panel) ----------------
create or replace function public.replay_counts(p_user_id uuid, p_game_ids bigint[])
returns table (game_id bigint, replays integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.game_id, count(*)::integer
  from (
    select x.game_id from public.game_replays x
     where x.user_id = p_user_id and x.game_id = any (p_game_ids[1:500])
    union all
    select y.game_id from public.reviews y
     where y.user_id = p_user_id and y.game_id = any (p_game_ids[1:500]) and y.status = 'published' and y.is_replay
  ) s
  group by s.game_id;
$$;

grant execute on function public.replay_counts(uuid, bigint[]) to authenticated;
revoke execute on function public.replay_counts(uuid, bigint[]) from public, anon;

-- ---- 6c. Stats → Replays (your own) ----------------------------------------------------------
-- { total, games, top: [{gameId, replays, lastFinished}], byYear: [{year, replays}],
--   scoreChanges: [{gameId, reviews, first, latest}] }  (scores are canonical 1–100)
create or replace function public.stats_replays(p_limit integer default 10)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with all_replays as (
    select x.game_id, x.finished_on from public.game_replays x where x.user_id = auth.uid()
    union all
    select y.game_id, coalesce(y.finished_on, y.published_at::date)
      from public.reviews y where y.user_id = auth.uid() and y.status = 'published' and y.is_replay
  ),
  per_game as (
    select a.game_id, count(*)::integer as replays, max(a.finished_on) as last_finished
      from all_replays a group by a.game_id
  ),
  per_year as (
    select extract(year from a.finished_on)::integer as year, count(*)::integer as replays
      from all_replays a group by 1
  ),
  scored as (
    select r.game_id, r.rating,
           row_number() over (partition by r.game_id order by r.created_at, r.id) as first_n,
           row_number() over (partition by r.game_id order by r.created_at desc, r.id desc) as last_n,
           count(*) over (partition by r.game_id) as cnt
      from public.reviews r
     where r.user_id = auth.uid() and r.status = 'published' and r.rating is not null
  ),
  changes as (
    select f.game_id, f.cnt::integer as reviews, f.rating as first, l.rating as latest
      from scored f
      join scored l on l.game_id = f.game_id and l.last_n = 1
     where f.first_n = 1 and f.cnt > 1
  )
  select jsonb_build_object(
    'total', (select count(*) from all_replays),
    'games', (select count(*) from per_game),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('gameId', t.game_id, 'replays', t.replays, 'lastFinished', t.last_finished)
                       order by t.replays desc, t.last_finished desc, t.game_id)
        from (select * from per_game order by replays desc, last_finished desc, game_id
              limit least(greatest(coalesce(p_limit, 10), 1), 100)) t
    ), '[]'::jsonb),
    'byYear', coalesce((
      select jsonb_agg(jsonb_build_object('year', y.year, 'replays', y.replays) order by y.year) from per_year y
    ), '[]'::jsonb),
    'scoreChanges', coalesce((
      select jsonb_agg(jsonb_build_object('gameId', c.game_id, 'reviews', c.reviews, 'first', c.first, 'latest', c.latest)
                       order by abs(c.latest - c.first) desc, c.game_id)
        from (select * from changes order by abs(latest - first) desc, game_id limit 50) c
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.stats_replays(integer) to authenticated;
revoke execute on function public.stats_replays(integer) from public, anon;
