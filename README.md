# gamer_cred

**GamerCred** is a cross-platform social app for rating and reviewing video games. It runs on iOS, Android and the web from one TypeScript codebase. You can log what you're playing, rate games in the rating system you prefer, write reviews, see what your friends think, and browse charts of your own gaming history.

The look is an original early-2000s desktop game-client style: dark, high-contrast panels, beveled chrome, compact type and monospace numbers.

---

## Contents

- [Features](#features)
- [The rating system](#the-rating-system)
- [Quick ratings vs. reviews](#quick-ratings-vs-reviews)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Backend](#backend)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Deploying backend changes](#deploying-backend-changes)
- [Conventions](#conventions)
- [Status & open items](#status--open-items)
- [Credits](#credits)

---

## Features

The app has five tabs. Phones get a bottom tab bar; tablets and desktop get a permanent left sidebar inside a centred, fixed-width window.

### Home
One tab bar at the top switches between three views:
- **Community** (the default):
  - **Trending Games:** the games the most players rated or reviewed in the last 14 days.
  - **Trending Posts:** recent reviews of those trending games.
  - **Latest from the Community:** everyone's newest reviews, loading more as you scroll.
- **Friends:** your friends' reviews, Now Playing activity and ♥ likes.
- **Lists:**
  - **Curated Lists:** featured by the app's admins (hand-picked or smart lists).
  - **Your Lists:** with **New List**.
  - **Browse Lists:** recently updated community lists, or search them by title or description.

### Lists
- Anyone can make a list: give it a **title** and a **description**, then search the game database to add games (up to 250).
- **Ranked** lists show #1, #2, #3…; the owner reorders with ▲ ▼ and removes with ✕.
- Lists are **public** (on your profile and in search) or **private** (only you).
- **Admins** feature public lists on Home and choose their order. Featured lists must stay public.
- **Smart lists (admins only):** instead of hand-picked games, the list stores a rule and fills itself from Gamer Cred ratings, recalculated once a day (nightly, plus straight away when the rule changes), e.g. "Top 500 games", "Top 500 expansions" or "every S-tier game".
  - Rule: type (games, expansions, DLC, remakes, collections), tier, release years or decade, genre, platform played on, and size (up to 500).
  - Ranked by the plain Gamer Cred average, or by **♥ likes** ("Most liked").
  - A game qualifies once it has at least as many ratings as the 75th percentile of rating counts for its type, and never fewer than 3, so the bar rises as the app grows.

### Search
Search covers three kinds of thing:

| Kind | What it searches | Source |
|---|---|---|
| **Games** | Title, genre, platform | IGDB |
| **Creators** (Studios · Directors & People) | Developers, publishers and key creators; tap a studio for its page | IGDB and RAWG |
| **Users** | Player profiles by username, with friend requests | Supabase |
| **Lists** | Public game lists, by title or description | Supabase |

- All IGDB and RAWG traffic goes through a Supabase Edge Function with a PostgreSQL cache. The app never calls IGDB or RAWG directly.
- Game results show the cover, year, platforms and studios; tap anywhere on a card to open the game page. Lists of games (search, studio pages, user lists) show no scores.
- **Studio pages:** every game a studio developed or published, filterable by role and sortable.
- The catalogue is curated so each game appears once. Editions, mods, fan games and unrelated bundles are filtered out. DLC, expansions, remakes and real collections are kept and labelled.

### Now Playing (Post / Review Studio)
- **Now Playing grid:** four slots for the games you're currently playing. Each slot holds running notes and a "so far" score.
- **Review Studio:** the only place full reviews are written, either from a Now Playing slot or for any game.
  - The writer opens as an overlay pinned to the top of the screen that shrinks above the keyboard, so you can always see what you type.
  - One action bar: Save Draft and Publish (or Unpublish and Update Review once published). Closing with unsaved changes asks first.
- **Drafts:** your unpublished reviews, ready to resume.

### Stats
Charts of your own logged games, all computed in Postgres:
- **Gamer Profile:** a short written summary of your tastes. It's generated in the app from your stats, with no AI involved.
- **Ratings:** one tab per scale (1–100, Tier, Stars, Rounded), always in the tier colours.
- **Liked Games:** your likes by series, studio, genre and decade.
- **Breakdowns:** Platforms, Studios (top 10 with "Show all"), Genres (count or average), Rating Habits (harsh vs. generous), You vs Community (with "hot takes"), Release Era and Logged Over Time.

Every chart shows the exact value when you tap a bar, and has a table view that screen readers use. Missing data goes into an "Unknown" bucket.

### Profile
- **Now Playing:** the four slots, with privacy options (public, friends only or private).
- **Top 4 Favorites:** tap a cover to open the game. The owner can reorder (◀ ▶) or remove (✕) entries.
- **Friends:** tap the friend count for the friends list (yours also shows requests).
- **♥ Liked Games:** the latest 8 liked covers, with **View all** for the full list (newest first, with a name filter).
- **Ratings:** your most recent ratings. Tap **Ratings ▸** for a spreadsheet of every game you've rated.
  - It has sortable columns, search, and filters for tier, score range, platform, genre and whether you've reviewed the game.
  - Only you and your friends can sort and filter it.
- **Lists:** your game lists. Others see only your public ones.
- **Reviews:** your published reviews.
- **Hardware & Platforms:** the consoles you own, one row per maker (PC, Nintendo, Xbox, PlayStation, Sega, Atari, Other), with one **Main** platform (★), PC specs, and devices such as PC handhelds.

### Game pages
- A banner with cover, developer, publisher, release info, genres and platforms.
- **Gamer Cred score:** the community average, shown large in your default scale, then in 1–100, stars and tier.
- **Your rating:** the same layout as an interactive control, plus your "played on" platform, a **Write a review** button and **Add to Now Playing**.
- **♥ Like:** one tap to show interest without rating or reviewing; the Gamer Cred box shows how many players like the game. Liking never creates a rating.
- Both score boxes are coloured by the tier of their score.
- **Friends' Ratings** (above the screenshots), About, Screenshots, Community Reviews, game facts, and PC system requirements (from RAWG).

### Reviews
One system, reached from everywhere:
- **Review card:** the same preview in Home feeds, Trending Posts, the game page, the review browser and profiles. Avatar or name → profile; game → game page; anywhere else → the full review.
- **Review browser** (`app/reviews/[gameId].tsx`): one game's reviews, **Community** or **Friends** tab, sorted **Popular / Recent / Highest / Lowest**. Opens from the game page's Community Reviews (View all) and Friends' Ratings (Friends tab). The Friends tab ends with friends who rated without writing a review.
- **Full review** (`app/review/[id].tsx`): the ♥ like, Report, and "All reviews of this game".
- **♥ on reviews:** any published review but your own. Counts are private: only the author sees how many likes their review got. Popular sorts by likes, then newest.

### Settings
- Profile picture: upload and crop. Pictures are screened automatically (Google Cloud Vision SafeSearch) before anyone sees them; borderline ones wait for an admin.
- **Colour themes:** **Mega** (blue, the default), **Chief** (olive), **Super** (red), **Pika** (yellow) and **Peach** (pink).
- **Hardware & Platforms:** tap chips to add or remove platforms, grouped by maker; one **Main platform** button; spec and device lines under PC.
- Rating scale (new players start on **stars**), Now Playing privacy, username and sign out.
- Choices save automatically, with inline "Saving…" / "✓ Saved" feedback. Your username has its own Save button, and you're warned before leaving with an unsaved change.

### Safety (app store requirements)
- **Report:** **⚑ Report** on reviews (review page and game page), lists and player profiles.
  - Pick a reason and add optional details. You can also block the person in the same step.
  - Reports are private and reviewed within 24 hours.
- **Block:** from a player's profile.
  - Blocking removes any friendship and stops friend requests.
  - It also hides both players from each other everywhere: profile, reviews, ratings, lists, Now Playing and search.
  - Unblock in **Settings → Blocked Players**.
- **Moderation:** admins get a **Moderation queue** in Settings. They can view, dismiss, remove the content, or remove the account, review held profile pictures, and see the admin **Activity** log.
- **Text filter:** usernames, list titles and descriptions, reviews, Now Playing notes and device names are checked with an open-source slur and profanity filter before saving. The database enforces a smaller backstop list too, so requests that skip the app are also refused, and sign-ups whose Google name fails it get a neutral username.
- **Terms:** everyone accepts the **Terms of Use & Community Guidelines** (zero tolerance for objectionable content).
  - Email sign-ups tick a box on Register.
  - Everyone else gets a one-time prompt.
- **Account deletion:** **Settings → Delete Account** permanently deletes the account and all its data straight away. You confirm by typing your username.
  - The public page `/delete-account` explains how to request deletion without the app, as Google Play requires.
- **Contact:** jjlabber16@gmail.com, set in `src/constants/legal.ts`.

### Admins
Admins can feature lists on Home, make smart lists, and moderate (reports, held pictures, removing accounts).

- **Two-step sign-in is required.** Every admin power needs a session verified with a 6-digit code from an authenticator app (Supabase MFA). The database (`is_app_admin()`) and the Edge Functions both check it, so a stolen password alone can't use admin tools.
  - First time: **Settings → Admin Security → Set Up Two-Step Sign-In**, scan the QR code (or type the key), enter the code.
  - Each sign-in after that: enter a code in Admin Security, or on the Moderation page.
  - Lost the phone: delete the old factor in Supabase → **Authentication → Users**, then set up a new one in the app.
- **Activity log:** every admin action (featuring, smart rules, report decisions, picture decisions, account removals) is recorded with who and when, in **Moderation → Activity**. Entries can't be edited or deleted from the app.

**Adding an admin.** There's deliberately no button for this. Run it in the Supabase dashboard → **SQL Editor**, using their username:
```sql
insert into public.app_admins (user_id)
select id from public.profiles where username = 'their_username';
```
They then set up two-step sign-in in **Settings → Admin Security** before any admin tool works for them.

**Removing an admin:**
```sql
delete from public.app_admins
where user_id = (select id from public.profiles where username = 'their_username');
```

### Authentication
- Email and password sign-up with email confirmation, plus Google sign-in.
- **Browse as Guest** (on Login): an anonymous, read-only session with no email.
  - Guests can read everything a member can: Home, search, game pages, profiles, reviews and lists.
  - Rating, reviews, Now Playing, lists, friends, reports and settings show "Create a free account".
  - The database enforces it (migration 000027: members-only write rules, no profile for guests); the game-search proxy gives guests 30 requests a minute.
  - Guest accounts older than 30 days are deleted nightly.
- **Bot protection:** sign-in, sign-up and guest sessions pass a Cloudflare Turnstile check (Supabase Auth CAPTCHA), plus Supabase's per-IP limits.
- Sessions are stored with `expo-secure-store` on device.
- Every screen except login and register requires an account.

---

## The rating system

Every rating is stored once, as a canonical score from **1 to 100**, together with the scale it was entered in and the exact input. The other three scales are always derived from it with a single rubric (`src/constants/ratingRubric.ts`), so all four always agree.

| Tier | 1–100 | Stars | Rounded | Descriptor |
|---|---|---|---|---|
| **S** (gold) | 100 | 5 | 10 | Masterpiece, a perfect score. Shown as a **gold S** (stored as `S**`). Reached by entering exactly 100, picking the gold S, or giving 5★. |
| **S** | 96–99 | 5 | 10 | Masterpiece |
| **A+** | 90–95 | 4.5 | 9 | Classic |
| **A** | 80–89 | 4 | 8 | Excellent–Fantastic |
| **B** | 70–79 | 3.5 | 7 | Good–Great |
| **C** | 60–69 | 3 | 6 | Decent |
| **D** | 50–59 | 2.5 | 5 | Mediocre |
| **F** | 1–49 | 0.5–2 | NOT GOOD | Not Good |

- **Your scale:** each user picks a default scale in Settings (new players start on **stars**). Every rating control (quick rating and review form) uses that scale:
  - **stars:** tap a half or full star (a full 5/5 shows in gold);
  - **tier:** tap a tier chip;
  - **rounded:** tap 5–10 or NOT GOOD;
  - **1–100:** type a score, or use − / +.
- **Converting the other way:** a star, tier or rounded value maps to the top of its 1–100 range. For example, 4★ becomes 89. The exception is 5★, which becomes 100 (the gold S); rounded 10 stays 99.
- **Tier colours:** every tier has its own colour. They're used on tier badges, on every chart that shows ratings, and on the score boxes on game pages.

---

## Quick ratings vs. reviews

These are two separate actions with separate code paths:

| | Quick rating | Full review |
|---|---|---|
| **What** | One score per game, in your scale, plus the platform you played on | A score plus a written review, saved as a draft or published |
| **Where** | The game page (lists of games show no scores; tapping one opens its page) | **Review Studio only**, also reached from the game page's **Write a review** button |
| **Visibility** | Public: your profile's Ratings, Friends' Ratings and the Gamer Cred average | Published reviews are public; drafts are visible only to you |
| **Code** | `services/ratings.ts` (`rateGame`, `clearGameRating`) | `services/reviews.ts` (`saveReview`) |

- **One score and one platform per game.** If you rate a game and also review it, the two always match; database triggers keep them in sync.
  - A new review starts from your rating.
  - Changing the rating updates the review's score.
  - Deleting a review keeps your rating.
  - You can't clear your rating while a published review exists, because a published review needs a score.
- **"Played on"** defaults to the game's earliest release platform that's in the app's platform catalogue. You can change it inline.
- **Saving:** taps save in the background straight away. Rapid taps collapse into one save, and a failed save rolls back with an error message.

More detail: [`src/components/rating/README.md`](src/components/rating/README.md).

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | **Expo SDK 58** (managed), **React Native 0.88**, **React 19**, **Expo Router** (typed routes) |
| Language | **TypeScript** (strict). No `.js` / `.jsx` source files apart from tool config. |
| Styling | **NativeWind v4** (Tailwind CSS for React Native). Themes are CSS variables. |
| Server state | **TanStack Query v5**, with one shared query-key factory (`src/utils/queryKeys.ts`) |
| Client state | **Zustand** |
| Validation | **Zod** for all user input and JSON results |
| Backend | **Supabase**: Postgres with row-level security, Auth, Storage and Edge Functions (Deno) |
| Game data | **IGDB** (via Twitch credentials) and **RAWG**, both through the `igdb-proxy` Edge Function |
| Icons | `@expo/vector-icons` (generic MaterialCommunityIcons / Feather glyphs; no brand logos) |
| Tests | **Jest** (`jest-expo`) + React Native Testing Library; **Deno** tests for the Edge Function; SQL tests on in-process Postgres via **PGlite** |

---

## Project structure

```
app/                         Expo Router routes only
  (auth)/                    login, register
  (tabs)/                    index (Home), search, post (Now Playing), stats, profile
  game/[id].tsx              game page
  user/[id].tsx              public profile
  ratings/[userId].tsx       a player's full ratings spreadsheet
  list/[id].tsx              one game list (owner: add, reorder, edit, delete; admin: feature)
  review/[id].tsx            one review
  settings.tsx               settings
  auth/callback.tsx          OAuth / email-link landing
  _layout.tsx                providers, theme root, route guards, error boundary, toasts
src/
  components/                UI, by area: ui/ (RetroGamingPC* primitives), game/, search/,
                             studio/, profile/, rating/, stats/, settings/, feed/, navigation/
  constants/                 rating rubric, platforms catalogue, themes, action colours
  hooks/                     TanStack Query + Zustand hooks
  services/                  Supabase client and Edge Function wrappers
  types/                     database.types.ts, igdb types, env.d.ts
  utils/                     pure helpers (rating maths, stats shaping, queues, colour…)
supabase/
  migrations/                000001–000018 (see below)
  functions/igdb-proxy/      the IGDB/RAWG proxy, with curation, ranking and cache policy
  functions/_shared/         API contract shared by the proxy and the app
  tests/                     SQL tests (Deno + PGlite)
scripts/                     generate-theme-palettes.py (writes src/constants/themePalettes.json)
global.css                   theme variables and bevel utility classes
```

---

## Backend

### Tables
Every table has row-level security with explicit read and write policies.

| Table | Purpose |
|---|---|
| `profiles` | Username, avatar, primary rating scale, colour theme, Now Playing privacy |
| `friendships` | Friend requests and friendships (pending, accepted, declined) |
| `reviews` | One review per user per game: draft or published, score, text, platform |
| `game_ratings` | Quick ratings: one per user per game, with score and platform. Public to read, owner-only to write. |
| `now_playing` | The four Now Playing slots, with notes and "so far" scores |
| `user_favorites` | Top 4 favourites |
| `user_platforms` | Owned platforms, Main platform, PC specs, devices |
| `lists` | Game lists: title, description, ranked, public / private, Home pin position and smart-list rule (both admins only) |
| `list_items` | The games on each list, in order (up to 250) |
| `app_admins` | App admins (feature lists, smart lists, moderation). Changed only from the SQL editor; admin powers also need two-step sign-in. |
| `admin_actions` | Admin activity log. Readable by verified admins only; never editable. |
| `avatar_reviews` | Profile pictures held for an admin by the screening check |
| `user_blocks` | Who blocked whom. Blocking hides both players from each other through extra row-level policies. |
| `content_reports` | Reports on reviews, lists, ratings and players. Reporters see their own; admins resolve them. |
| `terms_acceptances` | Which Terms version each user accepted |
| `api_rate_limits` | Per-user request counters for the game-database proxy (service role only) |
| `games` | A durable copy of IGDB metadata used by Stats and the ratings list (incl. series) |
| `game_likes` | ♥ likes: one per player per game. Public to signed-in players, owner-only writes, members only. |
| `review_likes` | ♥ on reviews. Private: you read only your own; authors see their own counts via `review_like_info`. |
| `igdb_cache` | The proxy's response cache (`cache_key`, `data` JSONB, `updated_at`) |
| `game_overrides` | Manual include/exclude overrides for catalogue curation |

Storage: a private `avatar-uploads` bucket (each user can write only their own pending picture) and a public `avatars` bucket that only the screening function writes to.

### Server-side functions (RPCs)
- **Feed and game stats:** the activity feed, `game_review_stats` (the Gamer Cred average, one score per user) and `friend_ratings_for_game`.
- **Stats:** `stats_*` aggregates, built on `my_logged_games()`. A game counts as "logged" if you've rated or reviewed it.
- **Ratings list:** `user_ratings_table` returns a player's full ratings list with game details in one call.
- **Lists:** `add_list_item`, `move_list_item` (renumbers 1..n), `set_list_pin` (admins only) and `smart_list_games` (a smart list's games, live).
- **Admins:** `is_app_admin` (admin with a two-step-verified session), `is_app_admin_member`, `admin_activity` and `log_admin_action`.
- **Trending:** `trending_games` and `trending_posts` (last 14 days of ratings and published reviews).
- **Safety:** `block_user`, `unblock_user`, `my_blocked_users`, `block_state`, `admin_reports` and `admin_resolve_reports` (admins only).
- **Profiles:** atomic helpers for favourites and platforms.

### Migrations
| # | Adds |
|---|---|
| 000001–000003 | Base schema, auth and profiles, search indexes |
| 000004–000006 | Review Studio, profile helpers, feed and game stats |
| 000007 | Canonical 1–100 rating with input scale and raw input |
| 000008–000011 | Platform devices, colour theme, Now Playing privacy, avatar storage |
| 000012–000013 | Review platform and friends' reviews, curation overrides |
| 000014 | `games` table and Stats functions |
| 000015 | Quick ratings and the review sync triggers |
| 000016 | Public ratings, "played on" platform, friends' ratings |
| 000017 | `user_ratings_table` (ratings spreadsheet) |
| 000018 | Blue (Mega) as the default theme |
| 000019 | Game lists, list items, app admins and Home pinning |
| 000020 | Trending games and trending posts |
| 000021 | Blocking, reports and moderation, terms acceptance |
| 000022 | Profile picture screening (private uploads bucket, held pictures) |
| 000023 | Smart lists (admin rule-based lists) |
| 000024 | Stars as the default rating scale for new players |
| 000025 | Two-step sign-in for admin powers, admin activity log |
| 000026 | Security hardening: friend-request guard, database text filter, reads need a session, proxy rate limit, scheduled cache cleanup |
| 000027 | Guest access: read-only anonymous sessions, members-only writes, guest cleanup |
| 000028 | Smart lists saved and refreshed nightly instead of on every view |
| 000029 | ♥ Game likes, likes in the Friends feed, "Most liked" smart lists, liked-games stats, game series |
| 000030 | Private review likes, the review browser (`game_reviews_browse`) |
| 000031 | Faster row rules (blocked list and guest/admin checks run once per request), duplicate indexes removed |
| 000032 | Blocked-player list moved to a private schema (it could reveal who blocked you); review browser counts likes only for Popular |
| 000033 | Review fixes: no client-supplied sign-up pictures, username check before sign-in, nobody learns who blocked them, reports name the real owner (ratings per player) |
| 000034 | PC specs go through the database text filter |

### avatar Edge Function
- `submit` screens an uploaded picture with Google Cloud Vision SafeSearch, then publishes, rejects or holds it.
- `admin_list` and `admin_decide` let a verified admin review held pictures.
- Secret: `GOOGLE_VISION_API_KEY` (`npx supabase secrets set GOOGLE_VISION_API_KEY=...`). Without it every picture is held for review.

### account Edge Function
- Handles `delete_self` (in-app account deletion) and `admin_delete_user` (moderation, verified admins only).
- It removes the user's avatar files, then deletes the sign-in account. Every table cascades from it.
- It uses the service-role key, which only ever exists inside the function.

### igdb-proxy Edge Function
- **Actions:**
  - `search`: games, companies or creators;
  - `lookup`: games by id;
  - `detail`: the full game page, with RAWG PC requirements;
  - `company`: a studio and every game it developed or published.
- **Response format:** every response is `{ success, data?, error? }`.
- **Access:** signed-in players only, rate limited to 120 requests a minute each.
- **Curation:** one entry per game.
  - Dropped: editions, unreleased entries, mods and fan games.
  - Bundles only count as collections when their games share a series or a developer.
- **Ranking:** results are ranked by title match and popularity.
- **Caching:**
  - Cache entries carry a version stamp that changes whenever the filtering rules or query fields change, so old results expire automatically.
  - Search results are refreshed in the background once they're a few hours old.
- **Platform order:** each result carries `releasePlatformIds`, the game's platforms in release order, which the app uses for the "Played on" default.

Details: [`supabase/functions/igdb-proxy/README.md`](supabase/functions/igdb-proxy/README.md).

---

## Getting started

### Prerequisites
- Node.js and npm.
- A Supabase project, plus the Supabase CLI (`npx supabase`).
- For game data, a Twitch developer app (IGDB client ID and secret) and a RAWG API key.
- The Expo Go app, or an emulator or simulator, if you want to run on a phone.

### 1. Install
```bash
npm install
```

### 2. App environment
Copy `.env.example` to `.env` and fill in:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
Only the public anon key goes here. Never put the service-role key, or any other secret, in an `EXPO_PUBLIC_` variable.

In the Supabase dashboard, under **Authentication → URL Configuration**, add these redirect URLs:
- `gamercred://auth/callback`
- `exp://**` (Expo Go)
- `http://localhost:8081/auth/callback` (web dev)
- your production web domain's `/auth/callback`

Then enable the **Google** provider if you want Google sign-in.

**Guests and bot protection** (optional; without them the app works, just with no guest button check):
1. **Authentication → Sign In / Providers:** turn on **Allow anonymous sign-ins**.
2. Cloudflare → **Turnstile → Add widget** (Managed). Hostnames: your web domain, plus `localhost` for development.
3. Put the **site key** (public) in `.env` as `EXPO_PUBLIC_TURNSTILE_SITE_KEY`, and your web address as `EXPO_PUBLIC_SITE_URL`; restart Expo.
4. Only once the app with those values is running: **Authentication → Attack Protection → CAPTCHA**, provider Turnstile, paste the **secret key**. (Turning this on first would make every sign-in fail.)

### 3. Database and Edge Function
```bash
npx supabase link                                  # once, to your project
npx supabase db push --remote                      # apply migrations
npx supabase secrets set IGDB_CLIENT_ID=... IGDB_CLIENT_SECRET=... RAWG_API_KEY=...
npx supabase functions deploy igdb-proxy --use-api
npx supabase functions deploy account --use-api
npx supabase functions deploy avatar --use-api
```
Run the `secrets set` command in your own terminal. Secrets never go in the repo or the app.

### 4. Run
```bash
npm run web        # http://localhost:8081
npm start          # then scan the QR code with Expo Go
npm run ios        # or: npm run android
```

---

## Testing

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # expo lint
npm test            # Jest: utils, services, hooks logic and component render tests
```

The Edge Function and SQL tests run under Deno:
```bash
cd supabase/functions/igdb-proxy && deno test -A   # curation, ranking, cache policy, platform order
cd supabase/tests && deno test -A                   # migrations on real Postgres (PGlite), with RLS applied
cd supabase/functions/avatar && deno test -A        # picture screening decisions, admin checks
```

What the tests cover:
- **Rating rubric:** the conversions between all four scales.
- **Stats:** the aggregations and how the results are shaped into chart data.
- **Quick ratings:**
  - setting, changing and clearing a rating;
  - one rating per game;
  - the batched lookup;
  - the save queue: debouncing, rollback, never overlapping saves;
  - that a rating never creates a review.
- **Database:** the sync triggers, public reads with owner-only writes, the ratings spreadsheet's sorting and filtering, the friends' ratings query, smart-list ranking and its rising rating bar, the two-step requirement for admins, and the read-only activity log.
- **Tier parity:** the database's tier bands are checked against the app's rating rubric for every score from 1 to 100.
- **Colour contrast:** theme and action colours meet WCAG contrast (text ≥ 7:1, muted text and button labels ≥ 4.5:1), and the tier-tinted score boxes stay readable.

---

## Deploying backend changes

```bash
npx supabase db push --remote --dry-run          # see what will be applied
npx supabase db push --remote                    # apply new migrations
npx supabase functions deploy igdb-proxy --use-api
npx supabase functions deploy account --use-api
```
Never edit a migration that has already been pushed. Add a new numbered migration instead.

---

## Conventions

- **TypeScript only:** UI goes in `.tsx`, everything else in `.ts`, strict mode, and no unhandled `any`.
- **Query keys:** every TanStack Query key comes from `src/utils/queryKeys.ts`.
- **No direct IGDB/RAWG calls from the app:** everything goes through the Edge Function and its cache.
- **Themes:**
  - The colour source of truth is `src/constants/themePalettes.json`. It's generated by `scripts/generate-theme-palettes.py`; edit the script, not the JSON.
  - Text is neutral grey in every theme.
- **Action colours** are the same in every theme (`src/constants/actionColors.ts`):
  - **green:** save, publish, confirm, start or add something;
  - **red:** cancel, close, exit;
  - **deep red with ⚠:** delete or discard;
  - **blue:** go somewhere.
- **Brand-safe:** no third-party logos, fonts or artwork. Product names only appear when they refer to that real product (for example a "Steam Deck" device entry).
- **Phones:**
  - Touch targets of about 40px or more, using `TOUCH_SLOP`.
  - Text of 10px or more.
  - `noZoomInputStyle` on every text input.
  - Dialogs that avoid the keyboard and scroll.
  - Wide content wraps or scrolls sideways.

  Details are in `CLAUDE.md`.
- **Adding a stat:** see [`src/components/stats/README.md`](src/components/stats/README.md).

---

## Status & open items

Phases 1–11 are complete: setup, auth, search, Review Studio, profiles, game pages and feed, stats, quick ratings, public ratings, the ratings spreadsheet, game lists, safety and moderation, studio pages, profile picture screening, mobile navigation, smart lists and admin two-step sign-in.

**Before alpha testing:**
- Custom SMTP (e.g. Resend) so confirmation emails reach testers; Supabase's built-in email only sends to team members.
- Host the web build on the Cloudflare subdomain, and set Supabase's Site URL and redirect URLs to it.
- Set up admin two-step sign-in, and add the Google Vision key.
- A privacy page, and the app name and icon in `app.json`.

Still open:
- Decide how standalone expansions should be grouped.
- Ratings don't appear in the activity feed yet; only reviews do.
- Trending posts are ranked by how popular their game is, because the app has no likes or comments yet.
- **Before store submission:**
  - publish a privacy policy;
  - have the Terms text reviewed;
  - host the web build, so `/delete-account` has a public URL for Google Play;
  - make sure reports get handled within 24 hours.
- Lists: an "Add to list" button on game pages (today games are added from the list page).

---

## Credits

Built with [Claude Code](https://claude.com/claude-code), Anthropic's AI coding assistant, which co-authored much of this codebase alongside the project owner.
