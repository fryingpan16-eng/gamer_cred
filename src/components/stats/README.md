# Stats

The Stats tab (`app/(tabs)/stats.tsx`) renders `StatsPage`. It shows a sidebar on desktop and tabs on mobile. The menu is built from the `STATS` array in `statsConfig.ts`. Only the selected stat is mounted, so only that stat fetches data. The selection is kept in the `?stat=` route param.

Every aggregate runs in Postgres as a `stats_*` function in `supabase/migrations/000014_games_and_stats.sql`. These functions are `SECURITY INVOKER` and filter on `user_id = auth.uid()`, so users only ever aggregate their own data. Migration 000015 routes them through `my_logged_games()`. A game counts as "logged" when it has a quick rating or a review (draft or published). Now Playing slots do not count. Score-based stats use the user's one score per game. Platforms come from reviews, so quick-rated-only games land in Unknown.

## Adding a stat

1. **SQL.** Add the function in a new migration (`0000NN_*.sql`; never edit one that has been pushed).
   - Use `language sql stable security invoker set search_path = ''` and a `where r.user_id = auth.uid()` filter.
   - Put missing data in an `'Unknown'` bucket.
   - `unnest` array columns such as `games.genres` and `games.developers` so that multi-value games count toward each value.
   - `grant execute … to authenticated` and `revoke … from anon`.
2. **SQL test.** Add a case to `supabase/tests/stats_sql_test.ts`. It runs the migrations on in-process Postgres (PGlite): `cd supabase/tests && deno test -A`.
   - If the function reads a column that the stub schema at the top of the file doesn't have yet, extend the stub.
   - Load the new migration after 000014.
3. **Types.** Add the function to `Functions` in `src/types/database.types.ts`.
4. **Service and hook.**
   - Add a `fetchX()` to `src/services/stats.ts` that calls `supabase.rpc` and throws `StatsError`. Zod-parse any `jsonb` result.
   - Add a key under `queryKeys.stats.stat(userId, 'x', …params)`.
   - Add a `useX()` in `src/hooks/useStats.ts` via `useStatQuery`.

   Review saves and deletes already invalidate `queryKeys.stats.all()`.
5. **Shaping.** Put any pure transforms from rows to `BarDatum[]` in `src/utils/stats.ts`, with a test in `src/utils/__tests__/stats.test.ts`. Keep rating maths on the 1–100 score and convert it with `src/utils/rating.ts` so all four scales stay consistent.
6. **Component.** Create `XStat.tsx` in this folder.
   - Wrap it in `StatFrame`, which provides the loading, error and "Log some games to see this" empty states.
   - Draw the chart with `RetroGamingPCBarChart`. Tooltips, the table fallback, top-N and "Show all" come with it.
7. **Menu.** Append `{ id, title, description, component }` to `STATS` in `statsConfig.ts`. The id becomes the `?stat=` value and must be unique; a test enforces this.
