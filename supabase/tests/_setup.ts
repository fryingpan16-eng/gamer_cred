/**
 * Shared PGlite harness for the SQL tests: a minimal stand-in for migrations
 * 000001–000013 (only the tables/columns later migrations touch), then the
 * real migration files. auth.uid() reads a session setting so a test can act
 * as a specific user; `asUser` also switches to the `authenticated` role so
 * RLS policies apply exactly as they do through the API.
 */
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

export const ME = '00000000-0000-0000-0000-00000000000a';
export const OTHER = '00000000-0000-0000-0000-00000000000b';
export const THIRD = '00000000-0000-0000-0000-00000000000c';

const BASE_SCHEMA = `
  create role authenticated; create role anon;
  create schema auth;
  create schema extensions;
  create extension pg_trgm with schema extensions;
  -- Supabase Storage stand-in (000022 adds a bucket + object policies).
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  -- JWT claims: sessions are two-step verified (aal2) unless a test sets test.aal.
  create function auth.jwt() returns jsonb language sql stable
    as $$ select jsonb_build_object(
      'aal', coalesce(nullif(current_setting('test.aal', true), ''), 'aal2'),
      'is_anonymous', coalesce(nullif(current_setting('test.guest', true), ''), 'false')::boolean) $$;
  -- Authenticator factors (000037 reads id, user_id, status).
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null default 'verified');
  -- Sign-in accounts (the columns the migrations use).
  create table auth.users (
    id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb,
    is_anonymous boolean not null default false, created_at timestamptz not null default now()
  );
  create type public.review_status as enum ('draft', 'published');
  create type public.rating_scale as enum ('numeric', 'tier', 'stars', 'rounded');
  create table public.profiles (id uuid primary key, username text, avatar_url text);
  create type public.friendship_status as enum ('pending', 'accepted', 'declined', 'blocked');
  create table public.friendships (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (id) on delete cascade,
    friend_id uuid not null references public.profiles (id) on delete cascade,
    status public.friendship_status not null default 'pending'
  );
  create table public.reviews (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (id) on delete cascade,
    game_id bigint not null,
    rating smallint check (rating between 1 and 100),
    rating_input_scale public.rating_scale,
    rating_input text,
    content text,
    status public.review_status not null default 'published',
    platform_id bigint,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    published_at timestamptz, -- 000004 (set by trigger in the real schema)
    constraint reviews_one_per_user_game unique (user_id, game_id),
    constraint reviews_rating_fields_together check (
      (rating is null) = (rating_input_scale is null) and (rating is null) = (rating_input is null)
    ),
    constraint reviews_published_has_rating check (status = 'draft' or rating is not null)
  );
  -- 000004's timestamp trigger (000036 replaces the function).
  create function public.reviews_set_timestamps() returns trigger language plpgsql set search_path = '' as $$
  begin
    new.updated_at = now();
    if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
      new.published_at = now();
    elsif new.status = 'draft' then
      new.published_at = null;
    end if;
    return new;
  end; $$;
  create trigger reviews_set_timestamps before insert or update on public.reviews
    for each row execute function public.reviews_set_timestamps();
  -- Same RLS as 000001.
  alter table public.reviews enable row level security;
  create policy "reviews: read published or own" on public.reviews for select
    using (status = 'published' or (select auth.uid()) = user_id);
  create policy "reviews: owner insert" on public.reviews for insert to authenticated
    with check ((select auth.uid()) = user_id);
  create policy "reviews: owner update" on public.reviews for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  create policy "reviews: owner delete" on public.reviews for delete to authenticated
    using ((select auth.uid()) = user_id);
  create table public.igdb_cache (cache_key text primary key, data jsonb not null, updated_at timestamptz not null default now());
  -- Profile-owned tables that 000021 adds block filtering to (columns trimmed).
  alter table public.profiles enable row level security;
  create policy "profiles: public read" on public.profiles for select using (true);
  create policy "profiles: owner update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
  create table public.now_playing (user_id uuid not null references public.profiles (id) on delete cascade, slot_index smallint not null, game_id bigint not null, notes text, updated_at timestamptz not null default now(), preliminary_score smallint, preliminary_input_scale public.rating_scale, preliminary_input text, primary key (user_id, slot_index));
  create table public.user_favorites (user_id uuid not null references public.profiles (id) on delete cascade, rank smallint not null, game_id bigint not null, primary key (user_id, rank));
  create table public.user_platforms (user_id uuid not null references public.profiles (id) on delete cascade, platform_id bigint not null, devices text[] not null default '{}', pc_specs text, primary key (user_id, platform_id));
  alter table public.now_playing enable row level security;
  alter table public.user_favorites enable row level security;
  alter table public.user_platforms enable row level security;
  create policy "now_playing: public read" on public.now_playing for select using (true);
  create policy "user_favorites: public read" on public.user_favorites for select using (true);
  create policy "user_platforms: public read" on public.user_platforms for select using (true);
  alter table public.friendships enable row level security;
  create policy "friendships: read own" on public.friendships for select using ((select auth.uid()) in (user_id, friend_id) or status = 'accepted');
  create policy "friendships: requester sends" on public.friendships for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending');
`;

const GRANTS = `
  grant usage on schema public, auth, storage to authenticated;
  grant all on all tables in schema storage to authenticated;
  grant all on all tables in schema public to authenticated;
  grant execute on all functions in schema public, auth to authenticated;
`;

const migration = (name: string) => Deno.readTextFile(new URL(`../migrations/${name}`, import.meta.url));

/** Fresh database. `beforeMigrations` runs between the stub schema and 000014 (e.g. cache rows for the backfill). */
export async function freshDb(opts: { beforeMigrations?: string; through?: 14 | 15 | 16 | 17 | 19 | 20 | 21 | 22 | 23 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(BASE_SCHEMA);
  await db.exec(`insert into auth.users (id) values ('${ME}'), ('${OTHER}'), ('${THIRD}');
    insert into public.profiles (id, username) values ('${ME}', 'myself'), ('${OTHER}', 'other'), ('${THIRD}', 'third');`);
  if (opts.beforeMigrations) await db.exec(opts.beforeMigrations);
  await db.exec(await migration('000014_games_and_stats.sql'));
  const through = opts.through ?? 47;
  if (through >= 15) await db.exec(await migration('000015_quick_ratings.sql'));
  if (through >= 16) await db.exec(await migration('000016_public_ratings_and_platform.sql'));
  if (through >= 17) await db.exec(await migration('000017_user_ratings_table.sql'));
  if (through >= 19) await db.exec(await migration('000019_lists.sql'));
  if (through >= 20) await db.exec(await migration('000020_trending.sql'));
  if (through >= 21) await db.exec(await migration('000021_safety.sql'));
  if (through >= 22) await db.exec(await migration('000022_avatar_moderation.sql'));
  if (through >= 23) await db.exec(await migration('000023_smart_lists.sql'));
  // 000024 only changes a profiles column default the stub schema doesn't have.
  if (through >= 25) await db.exec(await migration('000025_admin_security.sql'));
  if (through >= 26) await db.exec(await migration('000026_security_hardening.sql'));
  if (through >= 27) await db.exec(await migration('000027_guest_access.sql'));
  if (through >= 28) await db.exec(await migration('000028_smart_lists_daily.sql'));
  if (through >= 29) await db.exec(await migration('000029_game_likes.sql'));
  if (through >= 30) await db.exec(await migration('000030_review_likes.sql'));
  if (through >= 31) await db.exec(await migration('000031_rls_performance.sql'));
  if (through >= 32) await db.exec(await migration('000032_review_fixes.sql'));
  if (through >= 33) await db.exec(await migration('000033_bug_fixes_batch1.sql'));
  if (through >= 34) await db.exec(await migration('000034_bug_fixes_batch2.sql'));
  if (through >= 35) await db.exec(await migration('000035_backlog.sql'));
  if (through >= 36) await db.exec(await migration('000036_security_privacy_perf.sql'));
  if (through >= 37) {
    await db.exec(await migration('000037_admin_factor_and_provider_signup.sql'));
    // Test convenience: a new admin gets a verified, owner-approved authenticator
    // (admin_security_sql_test covers the unapproved cases).
    await db.exec(`
      create function public.test_pin_admin_factor() returns trigger language plpgsql as $$
      declare v_factor uuid;
      begin
        insert into auth.mfa_factors (user_id) values (new.user_id) returning id into v_factor;
        update public.app_admins set mfa_factor_id = v_factor where user_id = new.user_id;
        return null;
      end; $$;
      create trigger test_pin_admin_factor after insert on public.app_admins
        for each row when (new.mfa_factor_id is null) execute function public.test_pin_admin_factor();`);
  }
  if (through >= 38) {
    await db.exec(await migration('000038_permanent_and_display_names.sql'));
    await db.exec(await migration('000039_name_rules_data.sql'));
  }
  if (through >= 40) await db.exec(await migration('000040_replays.sql'));
  if (through >= 41) await db.exec(await migration('000041_name_rules_update.sql'));
  if (through >= 42) await db.exec(await migration('000042_other_versions.sql'));
  if (through >= 43) await db.exec(await migration('000043_review_comments.sql'));
  if (through >= 44) await db.exec(await migration('000044_cache_fixes.sql'));
  if (through >= 45) {
    // The test schema skips 000009 (profiles.ui_theme); give it the enum so 000045 can extend it.
    await db.exec(`create type public.ui_theme as enum ('olive', 'blue', 'red', 'yellow', 'pink');`);
    await db.exec(await migration('000045_light_theme.sql'));
  }
  if (through >= 46) await db.exec(await migration('000046_comment_edit_limit.sql'));
  if (through >= 47) await db.exec(await migration('000047_write_limits.sql'));
  await db.exec(GRANTS);
  // GRANTS re-grants every table; 000044 takes the cache back from the API roles.
  if (through >= 44) await db.exec('revoke all on public.igdb_cache from authenticated;');
  return db;
}

/** Make later asUser calls run as a guest (anonymous sign-in) or a member. */
export async function setGuest(db: PGlite, guest: boolean) {
  await db.exec(`reset role; select set_config('test.guest', '${guest}', false);`);
}

/** Make later asUser calls run with a session that is (aal2) or isn't (aal1) two-step verified. */
export async function setAal(db: PGlite, aal: 'aal1' | 'aal2') {
  await db.exec(`reset role; select set_config('test.aal', '${aal}', false);`);
}

/** Run `sql` as a signed-in user ('' = signed out) under the authenticated role, so RLS applies. */
export async function asUser<T>(db: PGlite, uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role authenticated;`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role;');
  }
}

/** Run `sql` as the database owner (bypasses RLS) — for arranging and inspecting state. */
export async function asOwner<T>(db: PGlite, sql: string): Promise<T[]> {
  await db.exec('reset role;');
  return (await db.query<T>(sql)).rows;
}

/** A review row's rating triplet for a 1–100 score entered on the numeric scale. */
export const numeric = (score: number | null) => (score === null ? 'null, null, null' : `${score}, 'numeric', '${score}'`);
