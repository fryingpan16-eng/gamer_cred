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
    as $$ select jsonb_build_object('aal', coalesce(nullif(current_setting('test.aal', true), ''), 'aal2')) $$;
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
    unique (user_id, game_id),
    constraint reviews_rating_fields_together check (
      (rating is null) = (rating_input_scale is null) and (rating is null) = (rating_input is null)
    ),
    constraint reviews_published_has_rating check (status = 'draft' or rating is not null)
  );
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
  create table public.now_playing (user_id uuid not null references public.profiles (id) on delete cascade, slot_index smallint not null, game_id bigint not null, primary key (user_id, slot_index));
  create table public.user_favorites (user_id uuid not null references public.profiles (id) on delete cascade, rank smallint not null, game_id bigint not null, primary key (user_id, rank));
  create table public.user_platforms (user_id uuid not null references public.profiles (id) on delete cascade, platform_id bigint not null, primary key (user_id, platform_id));
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
export async function freshDb(opts: { beforeMigrations?: string; through?: 14 | 15 | 16 | 17 | 19 | 20 | 21 | 22 | 23 | 25 } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(BASE_SCHEMA);
  await db.exec(`insert into public.profiles (id, username) values ('${ME}', 'me'), ('${OTHER}', 'other'), ('${THIRD}', 'third');`);
  if (opts.beforeMigrations) await db.exec(opts.beforeMigrations);
  await db.exec(await migration('000014_games_and_stats.sql'));
  const through = opts.through ?? 25;
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
  await db.exec(GRANTS);
  return db;
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
