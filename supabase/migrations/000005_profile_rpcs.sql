-- =============================================================================
-- gamer_cred — 000005 profile helpers
--
-- Multi-row profile edits that must be atomic under the unique indexes
-- (one Main platform; one game per favorite rank and per user). All functions
-- are SECURITY INVOKER: they run as the caller, so the existing RLS owner
-- policies still decide what may change. auth.uid() scopes every statement.
-- =============================================================================

-- Set (or clear, with null) the caller's Main platform. Unset happens first so
-- uq_user_platforms_one_main never sees two mains, all inside one transaction.
create or replace function public.set_main_platform(p_platform_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.user_platforms set is_main = false
   where user_id = uid and is_main and platform_id is distinct from p_platform_id;

  if p_platform_id is not null then
    update public.user_platforms set is_main = true
     where user_id = uid and platform_id = p_platform_id;
    if not found then
      raise exception 'platform % is not in your roster', p_platform_id using errcode = 'P0002';
    end if;
  end if;
end;
$$;

-- Put a game at a favorite rank. If the game already sits at another rank it
-- moves; whatever occupied the target rank is replaced.
create or replace function public.set_favorite(p_rank smallint, p_game_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  delete from public.user_favorites
   where user_id = uid and (rank = p_rank or game_id = p_game_id);

  insert into public.user_favorites (user_id, game_id, rank) values (uid, p_game_id, p_rank);
end;
$$;

-- Swap two favorite ranks (either may be empty), e.g. moving #3 to #2.
create or replace function public.swap_favorite_ranks(p_rank_a smallint, p_rank_b smallint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  game_a bigint;
  game_b bigint;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_rank_a = p_rank_b then
    return;
  end if;

  select game_id into game_a from public.user_favorites where user_id = uid and rank = p_rank_a;
  select game_id into game_b from public.user_favorites where user_id = uid and rank = p_rank_b;

  delete from public.user_favorites where user_id = uid and rank in (p_rank_a, p_rank_b);
  if game_a is not null then
    insert into public.user_favorites (user_id, game_id, rank) values (uid, game_a, p_rank_b);
  end if;
  if game_b is not null then
    insert into public.user_favorites (user_id, game_id, rank) values (uid, game_b, p_rank_a);
  end if;
end;
$$;

grant execute on function public.set_main_platform(bigint) to authenticated;
grant execute on function public.set_favorite(smallint, bigint) to authenticated;
grant execute on function public.swap_favorite_ranks(smallint, smallint) to authenticated;
revoke execute on function public.set_main_platform(bigint) from anon;
revoke execute on function public.set_favorite(smallint, bigint) from anon;
revoke execute on function public.swap_favorite_ranks(smallint, smallint) from anon;
