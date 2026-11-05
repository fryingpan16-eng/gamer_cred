# GamerCred — Project Status

The one list of next steps and to-dos. Claude reads this instead of re-deriving status, updates it when work lands, and reminds you of open items.

_Last updated: 2026-11-04_

## Tech stack
- Expo + React Native + Expo Router, TypeScript (strict); iOS, Android, web
- TanStack Query v5, Zustand, Zod; NativeWind v4 (RetroGamingPC theme)
- Supabase: Postgres + RLS, Edge Functions (igdb-proxy, avatar, account)
- Tests: Jest (app), Deno + PGlite (SQL migrations)

## Key entry points
- `app/(tabs)/` — Home, Search, Post (Review Studio), Stats, Profile
- `app/game/[id].tsx`, `app/review/[id].tsx`, `app/reviews/[gameId].tsx`
- `src/services/` (Supabase calls) · `src/hooks/` (queries) · `src/utils/queryKeys.ts`
- `supabase/migrations/` (000001–000042) · `supabase/tests/` · `supabase/name-rules/`

## Completed
- Auth, search, Review Studio, profiles, game and studio pages, feeds, trending, friends
- Quick ratings (one score per game), ratings spreadsheet, Now Playing, backlog, ♥ likes (games + reviews)
- Lists and admin smart lists; Stats tab (Postgres `stats_*`)
- Safety: blocking, reports, moderation, picture screening, guests, admin two-step + approved authenticator
- Security/privacy/performance hardening (000036–000037)
- Permanent + display names, name rules, gold official badge, admin name reset (000038–000039, 000041)
- Replays: Mark as Replayed, replay reviews, play counts, Stats → Replays (000040)
- Other versions (Director's Cut…) fold into their original like remasters; Persona re-releases stay separate; saved data moves over (000042)

## Your to-do list (only you can do these)
- [ ] Apply migration 000042 (`npx supabase db push`), THEN deploy the proxy (`npx supabase functions deploy igdb-proxy`)
- [ ] Rebuild phone apps: builds older than 000040 can't save reviews
- [ ] Admin: Settings → Admin Security → set up, THEN approve the authenticator in the SQL Editor (README → Admins). Unlocks admin tools and the badge.
- [ ] Guest browsing, in this order: (1) Supabase → allow anonymous sign-ins; (2) Cloudflare Turnstile widget → `EXPO_PUBLIC_TURNSTILE_SITE_KEY` in `.env`; (3) LAST: Supabase CAPTCHA with the secret (earlier breaks every login)
- [ ] Supabase Auth: minimum password length 8+, leaked-password protection on
- [ ] Google Vision key: `npx supabase secrets set GOOGLE_VISION_API_KEY=...`
- [ ] Ko-fi page (when monetization starts); tell Claude your country for "Where to buy"

## Before alpha
- Custom SMTP (e.g. Resend) so confirmation emails reach testers
- Host the web build on the Cloudflare subdomain; set Supabase Site URL + redirect URLs to it
- Privacy page; app name and icon in `app.json`
- Visual check of the replay screens on phone and desktop

## Before store submission
- Publish the privacy policy; have the Terms reviewed
- Hosted web build so `/delete-account` has a public URL (Google Play)
- Reports handled within 24 hours

## Still open
- Decide how standalone expansions are grouped
- Ratings don't appear in the activity feed (reviews, likes, replays do)
- Trending posts rank by game popularity, not review likes
- "Add to list" button on game pages (today: added from the list page)

## After alpha (planned)
- **Where to buy:** plain-text store chips filtered to the game's platforms; locale region with a Settings override; affiliate codes later with a "may earn a commission" note
- **Support:** web-only Ko-fi "Buy the dev a tea"; cosmetic supporter tier (badge, card trim, themes, banner); never pay-to-rank
- Tasteful "Sponsored" feed cards only at real scale

## Roadmap after alpha (reshuffle freely)
- **A — learn and polish:** tester feedback; crash reporting + privacy-friendly analytics; notifications (friend requests, likes, featured lists); "Download my data"
- **B — core gaming:** Played / Dropped statuses; play diary (start date, hours; replays done); Steam library import; SQL recommendations; Year in review
- **C — growth:** shareable image cards; public share pages; release calendar + "Notify me"; series, platform and creator pages
- **D — store launch:** EAS builds (Android APK, then TestFlight); push notifications; store listings; store payments
- **E — community depth:** follow critics; review comments; achievements; moderation tooling (search, suspensions, appeals, spam flags)
- **Ongoing:** precomputed stats, keyset paging, image caching; accessibility and translations; optional weekly digest

## To do later (your list)
_Add items here yourself, or tell Claude "remind me to … later" / "add … to the to-do list". Claude adds them here (dated) and reminds you._
- [ ] Switch `src/types/database.types.ts` to generated types (`npx supabase gen types`) once the schema settles, around alpha; keep a small override layer for exact shapes such as feed `kind` (added 2026-11-04)
