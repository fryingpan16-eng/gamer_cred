-- =============================================================================
-- gamer_cred — 000019 game lists (+ app admins who pin curated lists to Home)
--
-- * Any user can make lists: title, description, ordered games, an optional
--   "Ranked" display (#1, #2 …) and public / private.
-- * Public lists are readable (and searchable) by everyone; private lists only
--   by their owner. Only the owner edits a list and its games.
-- * App admins pin public lists to the Home tab ("Featured Lists"). Pinning is
--   admin-only (enforced by a trigger + the set_list_pin RPC).
--
-- New tables only; nothing existing is changed.
-- =============================================================================

-- ---- 1. admins -----------------------------------------------------------------
create table public.app_admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
-- You can see whether YOU are an admin; nobody can write through the API.
create policy "app_admins: read own" on public.app_admins
  for select to authenticated using ((select auth.uid()) = user_id);

-- First admin: the project owner's account (no-op if it doesn't exist here).
insert into public.app_admins (user_id)
select id from public.profiles where id = 'fc630ef2-b4c5-4960-ac31-529a3550fe57'
on conflict do nothing;
-- More admins: insert into public.app_admins (user_id) values ('<profile id>');

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

grant execute on function public.is_app_admin() to authenticated;
revoke execute on function public.is_app_admin() from anon;

-- ---- 2. lists ------------------------------------------------------------------
create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (char_length(description) <= 1000),
  is_ranked   boolean not null default false,
  is_public   boolean not null default true,
  -- Position on the Home tab's Featured Lists strip (admin-only); null = not pinned.
  pinned_rank smallint check (pinned_rank between 1 and 50),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint lists_pinned_must_be_public check (pinned_rank is null or is_public)
);

create index idx_lists_user_updated on public.lists (user_id, updated_at desc);
create index idx_lists_public_updated on public.lists (updated_at desc) where is_public;
create unique index uq_lists_pinned_rank on public.lists (pinned_rank) where pinned_rank is not null;
-- Title / description search (`ilike '%term%'`).
create index idx_lists_title_trgm on public.lists using gin (title extensions.gin_trgm_ops);
create index idx_lists_description_trgm on public.lists using gin (description extensions.gin_trgm_ops);

alter table public.lists enable row level security;

create policy "lists: read public or own" on public.lists
  for select using (is_public or (select auth.uid()) = user_id);
create policy "lists: owner insert" on public.lists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "lists: owner update" on public.lists
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "lists: owner delete" on public.lists
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Stamps updated_at; only admins may pin / unpin / re-rank.
create or replace function public.lists_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  if (tg_op = 'INSERT' and new.pinned_rank is not null)
     or (tg_op = 'UPDATE' and new.pinned_rank is distinct from old.pinned_rank) then
    if pg_trigger_depth() <= 1 and not public.is_app_admin() then
      raise exception 'Only app admins can pin lists to the Home tab.' using errcode = 'LS001';
    end if;
  end if;
  return new;
end;
$$;

create trigger lists_before_write
  before insert or update on public.lists
  for each row execute function public.lists_before_write();

-- ---- 3. list items -------------------------------------------------------------
create table public.list_items (
  list_id  uuid not null references public.lists (id) on delete cascade,
  game_id  bigint not null, -- curated IGDB id (one canonical entry per game)
  position integer not null,
  added_at timestamptz not null default now(),
  constraint list_items_pkey primary key (list_id, game_id)
);

create index idx_list_items_list_position on public.list_items (list_id, position);
create index idx_list_items_game on public.list_items (game_id);

alter table public.list_items enable row level security;

create policy "list_items: read with the list" on public.list_items
  for select using (
    exists (select 1 from public.lists l where l.id = list_id and (l.is_public or l.user_id = (select auth.uid())))
  );
create policy "list_items: owner insert" on public.list_items
  for insert to authenticated with check (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid()))
  );
create policy "list_items: owner update" on public.list_items
  for update to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));
create policy "list_items: owner delete" on public.list_items
  for delete to authenticated using (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid()))
  );

-- A list holds at most 250 games; any change to its games bumps updated_at.
create or replace function public.list_items_after_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_list uuid := coalesce(new.list_id, old.list_id);
begin
  if tg_op = 'INSERT' and (select count(*) from public.list_items i where i.list_id = v_list) > 250 then
    raise exception 'A list can hold up to 250 games.' using errcode = 'LS002';
  end if;
  update public.lists set updated_at = now() where id = v_list;
  return null;
end;
$$;

create trigger list_items_after_write
  after insert or update or delete on public.list_items
  for each row execute function public.list_items_after_write();

-- ---- 4. RPCs -------------------------------------------------------------------
-- Append a game (no-op if it is already on the list). RLS: owner only.
create or replace function public.add_list_item(p_list_id uuid, p_game_id bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.list_items (list_id, game_id, position)
  select p_list_id, p_game_id, coalesce(max(i.position), 0) + 1
  from public.list_items i
  where i.list_id = p_list_id
  on conflict (list_id, game_id) do nothing;
$$;

-- Move a game to 1-based position p_to; positions are renumbered 1..n. RLS: owner only.
create or replace function public.move_list_item(p_list_id uuid, p_game_id bigint, p_to integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids bigint[];
  v_to integer;
begin
  select array_agg(i.game_id order by i.position, i.added_at) into v_ids
  from public.list_items i
  where i.list_id = p_list_id and i.game_id <> p_game_id;
  if not exists (select 1 from public.list_items i where i.list_id = p_list_id and i.game_id = p_game_id) then
    raise exception 'That game is not on this list.' using errcode = 'LS003';
  end if;
  v_ids := coalesce(v_ids, '{}');
  v_to := greatest(1, least(p_to, cardinality(v_ids) + 1));
  v_ids := v_ids[1:v_to - 1] || p_game_id || v_ids[v_to:];
  update public.list_items i
     set position = o.n
    from unnest(v_ids) with ordinality as o(game_id, n)
   where i.list_id = p_list_id and i.game_id = o.game_id and i.position is distinct from o.n;
end;
$$;

-- Admin: pin a public list to Home at p_rank (1 = first), or unpin with null.
-- A list already at that rank is unpinned.
create or replace function public.set_list_pin(p_list_id uuid, p_rank smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Only app admins can pin lists to the Home tab.' using errcode = 'LS001';
  end if;
  if p_rank is not null then
    update public.lists set pinned_rank = null where pinned_rank = p_rank and id <> p_list_id;
  end if;
  update public.lists set pinned_rank = p_rank where id = p_list_id;
  if not found then
    raise exception 'List not found.' using errcode = 'LS004';
  end if;
end;
$$;

grant execute on function public.add_list_item(uuid, bigint) to authenticated;
grant execute on function public.move_list_item(uuid, bigint, integer) to authenticated;
grant execute on function public.set_list_pin(uuid, smallint) to authenticated;
revoke execute on function public.add_list_item(uuid, bigint) from anon;
revoke execute on function public.move_list_item(uuid, bigint, integer) from anon;
revoke execute on function public.set_list_pin(uuid, smallint) from anon;
