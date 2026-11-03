-- =============================================================================
-- gamer_cred — 000010 Now Playing privacy
--
-- Who may see a player's Now Playing slots:
--   'public'  → everyone (default)
--   'friends' → accepted friends only
--   'private' → only the player
-- Enforced by RLS, not just the UI: anyone else's selects return no rows, which
-- also keeps the slots out of activity feeds (activity_feed is SECURITY INVOKER).
-- The owner always sees their own slots.
-- =============================================================================

create type public.now_playing_visibility as enum ('public', 'friends', 'private');

alter table public.profiles
  add column now_playing_visibility public.now_playing_visibility not null default 'public';

drop policy "now_playing: public read" on public.now_playing;

create policy "now_playing: read by visibility"
  on public.now_playing for select
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.profiles p
      where p.id = now_playing.user_id
        and (
          p.now_playing_visibility = 'public'
          or (
            p.now_playing_visibility = 'friends'
            and exists (
              select 1
              from public.friendships f
              where f.status = 'accepted'
                and (
                  (f.user_id = (select auth.uid()) and f.friend_id = now_playing.user_id)
                  or (f.friend_id = (select auth.uid()) and f.user_id = now_playing.user_id)
                )
            )
          )
        )
    )
  );
