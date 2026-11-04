-- =============================================================================
-- gamer_cred — 000030 review likes + the review browser
--
-- 1. review_likes: ♥ on a published review (anyone's but your own). Counts are
--    NOT public: you can see your own likes, and an author sees how many likes
--    their own reviews got (review_like_info). The browser's "Popular" sort
--    uses the counts internally without returning them.
-- 2. game_reviews_browse: one game's published reviews, Community (everyone) or
--    Friends, sorted popular / recent / highest / lowest, paged.
-- =============================================================================

create table public.review_likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  review_id  uuid not null references public.reviews (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);

create index idx_review_likes_review on public.review_likes (review_id);

alter table public.review_likes enable row level security;

-- Private: you only ever see your own likes.
create policy "review_likes: owner read" on public.review_likes
  for select to authenticated using ((select auth.uid()) = user_id);
-- Only published reviews you can see, and never your own.
create policy "review_likes: owner insert" on public.review_likes
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.reviews r
       where r.id = review_id and r.status = 'published' and r.user_id <> (select auth.uid())
    )
  );
create policy "review_likes: owner delete" on public.review_likes
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "review_likes: members insert" on public.review_likes
  as restrictive for insert to authenticated with check (not public.is_guest());
create policy "review_likes: members delete" on public.review_likes
  as restrictive for delete to authenticated using (not public.is_guest());

-- For a batch of reviews: whether you like each one, and — only for reviews you
-- wrote — how many likes it has (null for everyone else's).
create or replace function public.review_like_info(p_review_ids uuid[])
returns table (review_id uuid, liked boolean, like_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         exists (select 1 from public.review_likes l where l.review_id = r.id and l.user_id = (select auth.uid())),
         case when r.user_id = (select auth.uid())
              then (select count(*)::integer from public.review_likes l where l.review_id = r.id)
         end
    from public.reviews r
   where r.id = any (p_review_ids[1:200])
     and (r.status = 'published' or r.user_id = (select auth.uid()));
$$;

grant execute on function public.review_like_info(uuid[]) to authenticated;
revoke execute on function public.review_like_info(uuid[]) from public, anon;

-- The review browser. Blocked players are left out; Friends = accepted friends.
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
           (select count(*) from public.review_likes l where l.review_id = r.id) as likes
      from public.reviews r
     where r.game_id = p_game_id
       and r.status = 'published'
       and not public.is_hidden_user(r.user_id)
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

grant execute on function public.game_reviews_browse(bigint, text, text, integer, integer) to authenticated;
revoke execute on function public.game_reviews_browse(bigint, text, text, integer, integer) from public, anon;
