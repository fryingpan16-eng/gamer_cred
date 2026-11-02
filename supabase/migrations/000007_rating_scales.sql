-- =============================================================================
-- gamer_cred — 000007 four-scale rating system
--
-- Canonical value: an integer numeric score 1–100 in `reviews.rating` and
-- `now_playing.preliminary_score`. Alongside it we store the scale the user
-- entered (`*_input_scale`) and the raw input (`*_input`). Tier / stars /
-- rounded values are derived in the app (src/utils/rating.ts) from the rubric
-- in src/constants/ratingRubric.ts and are NOT stored.
--
-- Existing data: the old columns held a 1–10 score (app UI wrote whole numbers
-- only). They are PRESERVED as legacy_* columns (nothing is dropped) and
-- converted as if entered on the Rounded scale:
--   10→99 · 9→95 · 8→89 · 7→79 · 6→69 · 5→59 · 1–4→"NOT GOOD" (49)
-- (top-of-range mapping from the rubric). Any value that cannot be mapped
-- cleanly (0, or a fractional score such as 7.5) aborts the whole migration
-- before anything changes — resolve those rows first.
-- =============================================================================

-- ---- 0. Refuse to run on data we cannot map cleanly -------------------------
do $$
declare
  bad_reviews integer;
  bad_slots integer;
begin
  select count(*) into bad_reviews from public.reviews
   where rating is not null and (rating <> trunc(rating) or rating < 1 or rating > 10);
  select count(*) into bad_slots from public.now_playing
   where preliminary_score is not null
     and (preliminary_score <> trunc(preliminary_score) or preliminary_score < 1 or preliminary_score > 10);
  if bad_reviews > 0 or bad_slots > 0 then
    raise exception
      'rating migration aborted: % review(s) and % Now Playing slot(s) hold scores that are not whole numbers 1–10; no changes were made',
      bad_reviews, bad_slots;
  end if;
end;
$$;

-- ---- 1. Scale enum + user preference ----------------------------------------
create type public.rating_scale as enum ('numeric', 'tier', 'stars', 'rounded');

alter table public.profiles
  add column primary_rating_scale public.rating_scale not null default 'numeric';

-- ---- 2. reviews -------------------------------------------------------------
alter table public.reviews drop constraint reviews_published_has_rating;
alter table public.reviews rename column rating to legacy_rating_10;

alter table public.reviews
  add column rating             smallint check (rating between 1 and 100),
  add column rating_input_scale public.rating_scale,
  add column rating_input       text check (char_length(rating_input) <= 16),
  add constraint reviews_rating_fields_together check (
    (rating is null) = (rating_input_scale is null) and (rating is null) = (rating_input is null)
  ),
  add constraint reviews_published_has_rating check (status = 'draft' or rating is not null);

-- ---- 3. now_playing ---------------------------------------------------------
alter table public.now_playing rename column preliminary_score to legacy_preliminary_score_10;

alter table public.now_playing
  add column preliminary_score       smallint check (preliminary_score between 1 and 100),
  add column preliminary_input_scale public.rating_scale,
  add column preliminary_input       text check (char_length(preliminary_input) <= 16),
  add constraint now_playing_score_fields_together check (
    (preliminary_score is null) = (preliminary_input_scale is null)
    and (preliminary_score is null) = (preliminary_input is null)
  );

-- ---- 4. Convert existing scores (timestamps untouched) ----------------------
-- One-off data conversion; at runtime all mapping lives in the app's rubric.
create function pg_temp.legacy_to_numeric(old numeric) returns smallint
language sql immutable as $$
  select case old::int when 10 then 99 when 9 then 95 when 8 then 89 when 7 then 79
                       when 6 then 69 when 5 then 59 else 49 end::smallint
$$;
create function pg_temp.legacy_to_input(old numeric) returns text
language sql immutable as $$
  select case when old >= 5 then (old::int)::text else 'NOT GOOD' end
$$;

-- Don't let the conversion bump updated_at (it orders feeds and draft lists).
alter table public.reviews disable trigger reviews_set_timestamps;
alter table public.now_playing disable trigger now_playing_set_updated_at;

update public.reviews
   set rating = pg_temp.legacy_to_numeric(legacy_rating_10),
       rating_input_scale = 'rounded',
       rating_input = pg_temp.legacy_to_input(legacy_rating_10)
 where legacy_rating_10 is not null;

update public.now_playing
   set preliminary_score = pg_temp.legacy_to_numeric(legacy_preliminary_score_10),
       preliminary_input_scale = 'rounded',
       preliminary_input = pg_temp.legacy_to_input(legacy_preliminary_score_10)
 where legacy_preliminary_score_10 is not null;

alter table public.reviews enable trigger reviews_set_timestamps;
alter table public.now_playing enable trigger now_playing_set_updated_at;

comment on column public.reviews.legacy_rating_10 is
  'Pre-000007 1–10 score, kept for audit after conversion. Safe to drop once verified.';
comment on column public.now_playing.legacy_preliminary_score_10 is
  'Pre-000007 1–10 preliminary score, kept for audit after conversion. Safe to drop once verified.';

-- ---- 5. Stats: distribution is now per numeric score (index 0 = score 1) ----
-- The app buckets it into tiers via the rubric, so no ranges live in SQL.
create or replace function public.game_review_stats(p_game_id bigint)
returns table (review_count integer, average_rating numeric, distribution integer[])
language sql
stable
security invoker
set search_path = ''
as $$
  with published as (
    select r.rating as score
    from public.reviews r
    where r.game_id = p_game_id and r.status = 'published' and r.rating is not null
  )
  select
    count(*)::integer,
    round(avg(score), 1),
    array(select count(p.score)::integer
            from generate_series(1, 100) as s(n)
            left join published p on p.score = s.n
           group by s.n order by s.n)
  from published;
$$;

-- ---- 6. Feed: expose input scale + raw input (return type changes → recreate)
drop function public.activity_feed(text, timestamptz, text, integer);

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
  preliminary_input text
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
    select 'review:' || r.id::text as item_key,
           'review'::text as kind,
           coalesce(r.published_at, r.created_at) as occurred_at,
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
           null::text as preliminary_input
    from public.reviews r, params
    where r.status = 'published'
      and (p_scope = 'community' or r.user_id in (select id from friends))
      and (p_before is null
           or (coalesce(r.published_at, r.created_at), 'review:' || r.id::text) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
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
           n.preliminary_input
    from public.now_playing n, params
    where p_scope = 'friends'
      and n.user_id in (select id from friends)
      and (p_before is null
           or (n.updated_at, 'now_playing:' || n.user_id::text || ':' || n.slot_index) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
  ),
  merged as (
    select * from review_items
    union all
    select * from now_playing_items
  )
  select m.item_key, m.kind, m.occurred_at, m.actor_id,
         p.username, p.avatar_url,
         m.game_id, m.review_id, m.rating, m.rating_input_scale, m.rating_input,
         m.excerpt, m.slot_index, m.preliminary_score, m.preliminary_input_scale, m.preliminary_input
  from merged m
  join public.profiles p on p.id = m.actor_id
  order by m.occurred_at desc, m.item_key desc
  limit (select lim from params);
$$;

grant execute on function public.activity_feed(text, timestamptz, text, integer) to authenticated;
revoke execute on function public.activity_feed(text, timestamptz, text, integer) from anon;
