# GamerCred — Project Status

The one list of next steps and to-dos. Claude reads this instead of re-deriving status, updates it when work lands, and reminds you of open items.

_Last updated: 2026-11-25_

## Tech stack
- Expo + React Native + Expo Router, TypeScript (strict); iOS, Android, web
- TanStack Query v5, Zustand, Zod; NativeWind v4 (RetroGamingPC theme)
- Supabase: Postgres + RLS, Edge Functions (igdb-proxy, avatar, account)
- Tests: Jest (app), Deno + PGlite (SQL migrations)

## Key entry points
- `app/(tabs)/` — Home, Search, Post (Review Studio), Stats, Profile
- `app/game/[id].tsx`, `app/review/[id].tsx`, `app/reviews/[gameId].tsx`
- `src/services/` (Supabase calls) · `src/hooks/` (queries) · `src/utils/queryKeys.ts`
- `supabase/migrations/` (000001–000052) · `supabase/tests/` · `supabase/name-rules/`

## Completed
- Auth, search, Review Studio, profiles, game and studio pages, feeds, trending, friends
- Quick ratings (one score per game), ratings spreadsheet, Now Playing, backlog, ♥ likes (games + reviews)
- Lists and admin smart lists; Stats tab (Postgres `stats_*`)
- Safety: blocking, reports, moderation, picture screening, guests, admin two-step + approved authenticator
- Security/privacy/performance hardening (000036–000037)
- Permanent + display names, name rules, gold official badge, admin name reset (000038–000039, 000041)
- Replays: Mark as Replayed, replay reviews, play counts, Stats → Replays (000040)
- Other versions (Director's Cut…) fold into their original like remasters; Persona re-releases stay separate; saved data moves over (000042)
- Review comments: flat thread with @replies, filtered like reviews, 60/hour, edit own ("edited"), private ♥, ⚑ report → admin removal, 💬 count on ReviewCard (000043); edits limited to 30/hour (000046)
- Light theme (colours only, Wii/3DS-inspired white + silver + sky blue): shown as "Cloud" (id `white`); status colours (errors, likes, gold) now follow the theme (000045)
- How long to beat (IGDB `game_time_to_beats`): "To beat: ~12h main story" in the game page header; Main story / Main + extras / Completionist in Game Details
- Settings → About: version, Terms, Privacy Policy (`/privacy`, public), Open-source licenses (`/licenses`, from `npm run licenses`), data credits. Terms now mention Cloudflare Turnstile (TERMS_VERSION 2026-11-10: everyone re-accepts once)
- IGDB credit: "Game data from IGDB · View on IGDB ↗" at the foot of game pages; studio pages and Search credit IGDB too
- Audit 2026-11-10 (000047): hourly caps on new reviews (30), lists (20), reports (30), friend requests (60); `game_merges` reads need a session; ratings/list pages and friendship queries reject non-UUID ids
- Spoiler reviews (000049): "Contains spoilers" tick box in the Review Studio; cards cover the text for other players, the review page shows it with a ⚠ Spoilers badge
- Audit pass 2 (000048): report indexes (faster account deletion), blocked authors' reviews left out of like/comment info; edited reviews refresh on Back; cancelled friend requests and uneditable comments now say so
- Now Playing: tapping a filled cover opens the game page; Change game is in the slot's ⋯ menu
- Bigger type (14px body on desktop, +10% on phones) in the device's standard sans-serif; `font-mono` = same font with tabular numbers. Game page cache (incl. time to beat) now 14 days
- Modernised chrome, step 1 (all themes): small rounded corners, a softer 1px bevel (dark edge at 60%), soft drop shadows (`useSoftShadow`: buttons, cards, panels, dialogs, toasts, desktop window), roomier cards/panels/dialogs; Cloud's sunken fields and raised buttons now show every edge
- App owner (000050): one admin is the owner; admins can't remove each other's accounts, nobody removes the owner's, and the owner can take an admin's role away without deleting the account (profile → ⋯ → Remove Admin Role)
- Console generations (000051): a badge in the top-right of the game page's main card ("Gen 6", or "PC" / "Arcade" / "Mobile" over the release year) from where the game first launched (a console beats PC on a shared launch, the oldest console wins; Switch = Gen 8; old computers and browser games = PC; remasters show the original's generation, remakes their own). Corner tab = the game's place in its Top 250 (from last night's list). Tap opens the list; long-press (hover on web) shows details ("Remastered for Gen 8", "Remake of a Gen 1 game"). Twelve "Top 250" smart lists seeded for the app owner (games + remakes, rating bar measured inside each generation); smart lists can filter by generation. Stats → Games by Generation and Scores by Generation. Platform table: `public.platform_generations` (one row per IGDB platform)
- Library (000052): games you own, one copy per platform with optional Physical / Digital; private by default (🔒 / 🔓 on the Library page, profile card and Settings → Privacy; private = no rows, counts or preview for anyone else). + Library on game pages and Search results (platforms limited to the game's IGDB platforms), + Add games multi-add (one platform for a batch, then tap games), Library page with title search, platform / generation (of the owned platform) / format filters and date / title / year sort, owner's rating on each game. Separate from ratings and Backlog. Privacy Policy updated (PRIVACY_VERSION 2026-11-25)
- IGDB cache: service-role only, purge keeps 60 days to match the outage fallback (000044); game records saved on the device for instant covers

## Your to-do list (only you can do these)
- [ ] Push migration 000050 (`! npx supabase db push`) and redeploy the `account` function (`! npx supabase functions deploy account`): push the migration FIRST, the function needs it
- [ ] Generations: push migration 000051 (same `db push`), THEN redeploy `igdb-proxy` (`! npx supabase functions deploy igdb-proxy`). Each game page refreshes its cached record once to pick up remake/remaster data.
- [ ] Generations: check the IGDB platform ids once: `! cd supabase/functions/igdb-proxy && IGDB_CLIENT_ID=... IGDB_CLIENT_SECRET=... node tools/platform-generations-verify.mjs` and tell Claude about any line marked `!! NOT ON IGDB` or with the wrong name
- [ ] Library: push migration 000052 (same `db push`, after 000051). No function redeploy needed. Until it's pushed, the Library card, page and + Library buttons show load errors.
- [ ] Phones (Expo Go): restart `npx expo start -c` and reload Expo Go to get comments + on-device game records
- [ ] Admin: Settings → Admin Security → set up, THEN approve the authenticator in the SQL Editor (README → Admins). Unlocks admin tools and the badge.
- [ ] Guest browsing, in this order: (1) Supabase → allow anonymous sign-ins; (2) Cloudflare Turnstile widget → `EXPO_PUBLIC_TURNSTILE_SITE_KEY` in `.env`; (3) LAST: Supabase CAPTCHA with the secret (earlier breaks every login)
- [ ] Supabase Auth: minimum password length 8+, leaked-password protection on
- [ ] Ko-fi page (when monetization starts); tell Claude your country for "Where to buy"

## Alpha launch: web + Android APK together (next)
Done: migration 000049 pushed and `igdb-proxy` (14-day game page cache) redeployed 2026-11-15; `eas.json` (`preview` = APK for friends, `production` = Play AAB), app name GamerCred, dark splash + placeholder pixel "GC" icon; profile pictures limited to 1 check per hour; `igdb-proxy` (how long to beat) and `avatar` deployed 2026-11-10.
- [ ] You: review the Privacy Policy and Terms drafts (`src/constants/legal.ts`, also at `/privacy` and `/terms`); the Privacy Policy names Resend for email, so tell Claude if you pick another provider
- [ ] You: app logo (1024×1024 master; Claude makes the sizes) — placeholder is fine until then
- [ ] You: choose the permanent Android package name (e.g. `com.<you>.gamercred`); Claude adds it to `app.json`
- [ ] You: Expo account, then `! npx eas-cli login`; Claude runs `eas init` and stores `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` as EAS env vars (`.env` never reaches builds)
- [ ] You: Google Vision key for picture checks (Cloud Vision API enabled, key restricted to it, budget alert), then `! npx supabase secrets set GOOGLE_VISION_API_KEY=...`. Without it every picture waits for admin review.
- [ ] You: custom SMTP (Resend) — Supabase's built-in email only reaches project members
- [ ] You: Supabase → Auth → URL Configuration → add `gamercred://auth/callback` and the web address's `/auth/callback`; set Site URL to the web address
- [ ] Claude + you: host the web build on the Cloudflare subdomain
- [ ] Claude: `eas build -p android --profile preview` → share the APK link and the web link the same day (friends allow "install unknown apps")

## Before alpha
- Visual check of the light theme on every screen (phone + desktop)
- Visual check of the modernised chrome on signed-in screens and on a real phone (Expo Go): shadows and rounded bevels (only Sign In was checked, in all 6 themes on web)
- Visual check of the bigger text on every screen (phone + desktop): nothing cut off or crowded (game page already checked in code)
- Visual check of the Library: game page button row (6 buttons on phones), + Library on Search cards (title room), the Library page filters on a narrow phone, and the multi-add picker's platform header (picker list gets shorter)
- Visual check of the replay screens and the review page (action bar, ⋯ menus, comments), profile, list, friends and Now Playing ⋯ on phone and desktop

## Before closed testing (Google Play beta)
Needs the alpha list above, plus:
- Claude: `eas.json`, AAB build, `android.package` (permanent; choose the name first), confirm target API 36+
- Privacy policy public URL: `https://<web address>/privacy` once the web build is hosted
- You: Play developer account ($25; personal or organization)
- You: Data safety, content rating, target audience and app access forms; test login for Google that gets past email confirmation and CAPTCHA
- You: store listing (icon, feature graphic, screenshots, descriptions)
- Test Turnstile and the Supabase CAPTCHA on a real Android build

## Before store submission
- Personal account: 12+ testers opted in for 14 straight days, then apply for production (recruit extras)
- Publish the privacy policy; have the Terms reviewed
- Hosted web build so `/delete-account` has a public URL (Google Play)
- Reports handled within 24 hours

## Still open
- Decide how standalone expansions are grouped
- Ratings don't appear in the activity feed (reviews, likes, replays do)
- Trending posts rank by game popularity, not review likes
- "Add to list" button on game pages (today: added from the list page)
- Modernise step 2 (maybe): more breathing room screen by screen, bigger covers; then retro accents (pixel score badges, subtle desktop backdrop)
- Comments: players can't delete their own (only edit); add "Delete own" if testers ask

## After alpha (planned)
- **Where to buy:** plain-text store chips filtered to the game's platforms; locale region with a Settings override; affiliate codes later with a "may earn a commission" note
- **Support:** web-only Ko-fi "Buy the dev a tea"; cosmetic supporter tier (badge, card trim, themes, banner); never pay-to-rank
- Tasteful "Sponsored" feed cards only at real scale
- **Steam library import** (decided 2026-11-25: after alpha; roadmap B). The Library (000052) is ready for it: `library_entries.source` = 'steam', and server-side writes skip the hourly cap.
  - Ownership check: Steam OpenID sign-in → SteamID, through a new Edge Function (never trust a typed SteamID)
  - Matching: Steam app id → IGDB game via IGDB `external_games` (through `igdb-proxy`, rate limited); skip DLC, soundtracks, tools and editions; fold remasters/versions into their original; platform = PC (Windows)
  - The player's Steam profile must have game details set to public (not the default): explain this in the import screen
  - Import screen: preview the matched games, untick any you don't want, re-import without duplicates (upsert on user + game + platform)
  - You: Steam Web API key (`npx supabase secrets set ...`), read Valve's API terms; credit Steam in plain text, no logos
  - Privacy Policy: add Valve/Steam as a provider and bump PRIVACY_VERSION
  - Signal to move it earlier: alpha testers find adding big PC collections by hand too slow

## Roadmap after alpha (reshuffle freely)
- **A — learn and polish:** tester feedback; crash reporting + privacy-friendly analytics; notifications (friend requests, likes, featured lists); "Download my data"
- **B — core gaming:** Played / Dropped statuses; play diary (start date, hours; replays done); Steam library import; SQL recommendations; Year in review
- **C — growth:** shareable image cards; public share pages; release calendar + "Notify me"; series, platform and creator pages
- **D — store launch:** EAS builds (Android APK, then TestFlight); push notifications; store listings; store payments
- **E — community depth:** follow critics; comment notifications; achievements; moderation tooling (search, suspensions, appeals, spam flags)
- **Ongoing:** precomputed stats, keyset paging, image caching; accessibility and translations; optional weekly digest

## To do later (your list)
_Add items here yourself, or tell Claude "remind me to … later" / "add … to the to-do list". Claude adds them here (dated) and reminds you._
- [ ] Switch `src/types/database.types.ts` to generated types (`npx supabase gen types`) once the schema settles, around alpha; keep a small override layer for exact shapes such as feed `kind` (added 2026-11-04)
