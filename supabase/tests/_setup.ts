/**
 * Shared PGlite harness for the SQL tests: a minimal stand-in for migrations
 * 000001–000013 (only the tables/columns later migrations touch), then the
 * real migration files. auth.uid() reads a session setting so a test can act
 * as a specific user; `asUser` also switches to the `authenticated` role so
 * RLS policies apply exactly as they do through the API.
 */
import { PGlite } from '@electric-sql/pglite';

export const ME = '00000000-0000-0000-0000-00000000000a';
export const OTHER = '00000000-0000-0000-0000-00000000000b';

const BASE_SCHEMA = `
  create role authenticated; create role anon;
  create schema auth;
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create type public.review_status as enum ('draft', 'published');
  create type public.rating_scale as enum ('numeric', 'tier', 'stars', 'rounded');
  create table public.profiles (id uuid primary key);
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
`;

const GRANTS = `
  grant usage on schema public, auth to authenticated;
  grant all on all tables in schema public to authenticated;
  grant execute on all functions in schema public, auth to authenticated;
`;

const migration = (name: string) => Deno.readTextFile(new URL(`../migrations/${name}`, import.meta.url));

/** Fresh database. `beforeMigrations` runs between the stub schema and 000014 (e.g. cache rows for the backfill). */
export async function freshDb(opts: { beforeMigrations?: string; through?: 14 | 15 } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(BASE_SCHEMA);
  await db.exec(`insert into public.profiles (id) values ('${ME}'), ('${OTHER}');`);
  if (opts.beforeMigrations) await db.exec(opts.beforeMigrations);
  await db.exec(await migration('000014_games_and_stats.sql'));
  if ((opts.through ?? 15) >= 15) await db.exec(await migration('000015_quick_ratings.sql'));
  await db.exec(GRANTS);
  return db;
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
