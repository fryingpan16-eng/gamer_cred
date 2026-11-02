-- =============================================================================
-- gamer_cred — 000004 Review Studio
--
-- One review per (user, game): a draft is promoted to "published" in place,
-- and re-editing a published review updates it rather than duplicating it.
-- =============================================================================

alter table public.reviews
  add column updated_at   timestamptz not null default now(),
  add column published_at timestamptz;

-- Backfill for rows created before this migration.
update public.reviews set published_at = created_at where status = 'published' and published_at is null;

alter table public.reviews
  add constraint reviews_one_per_user_game unique (user_id, game_id);

-- Stamps updated_at on every change and published_at the first time a review goes public.
-- Unpublishing (back to draft) clears published_at.
create or replace function public.reviews_set_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = now();
  elsif new.status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

create trigger reviews_set_timestamps
  before insert or update on public.reviews
  for each row execute function public.reviews_set_timestamps();

-- Community feed ordering & "my drafts" lists.
create index idx_reviews_published_at on public.reviews (published_at desc) where status = 'published';
create index idx_reviews_user_status  on public.reviews (user_id, status, updated_at desc);
