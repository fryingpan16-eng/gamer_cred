-- =============================================================================
-- gamer_cred — 000032 fixes from the 000031 review
--
-- 1. PRIVACY: public.my_hidden_user_ids() could be called through the API and
--    returned everyone who blocked you (not just who you blocked), revealing
--    who blocked you. The list now lives in a `private` schema the API doesn't
--    expose; row rules use it, nobody can call it directly.
-- 2. The review browser only counts likes for the Popular sort.
-- 3. The hidden-player lookup reads "who's asking" once, not per row.
-- (Each sub-select runs once per table per query, not once per request.)
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Everyone you blocked or who blocked you; empty when signed out. Not callable via the API.
create or replace function private.hidden_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id)
  select coalesce(array(
    select b.blocked_id from public.user_blocks b, me where b.blocker_id = me.id
    union
    select b.blocker_id from public.user_blocks b, me where b.blocked_id = me.id
  ), '{}');
$$;

revoke all on function private.hidden_user_ids() from public, anon;
grant execute on function private.hidden_user_ids() to authenticated;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('game_likes', 'user_id'), ('game_ratings', 'user_id'), ('lists', 'user_id'), ('now_playing', 'user_id'),
      ('profiles', 'id'), ('reviews', 'user_id'), ('user_favorites', 'user_id'), ('user_platforms', 'user_id')
    ) as v(tbl, col)
  loop
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.tbl and policyname = t.tbl || ': hide blocked') then
      execute format(
        'alter policy %I on public.%I using (not (%I = any ((select private.hidden_user_ids())::uuid[])))',
        t.tbl || ': hide blocked', t.tbl, t.col);
    end if;
  end loop;
end;
$$;

create or replace function public.game_reviews_browse(
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
  author_avatar_url text
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
  picked as (
    select r.*,
           -- Likes only matter for Popular; other sorts skip counting them.
           case when p_sort = 'popular'
                then (select count(*) from public.review_likes l where l.review_id = r.id)
           end as likes
      from public.reviews r
     where r.game_id = p_game_id
       and r.status = 'published'
       and not (r.user_id = any ((select private.hidden_user_ids())::uuid[]))
       and (p_scope = 'community' or r.user_id in (select fid from friends))
  )
  select p.id, p.user_id, p.game_id, p.rating, p.rating_input_scale, p.rating_input, p.content,
         p.platform_id, p.published_at, p.updated_at, pr.username, pr.avatar_url
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

-- The leaky public version is gone (nothing else uses it).
drop function if exists public.my_hidden_user_ids();
