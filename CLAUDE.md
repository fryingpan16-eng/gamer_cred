node -e '
const fs = require("fs");
const md = `# GAMER_CRED — PROJECT RULES & ARCHITECTURE

## 🎯 ROLE & OBJECTIVE
Universal cross-platform video game social review app built with Expo Router and TypeScript (\`gamer_cred\`).

## 🖥️ TARGET DEVICES & RESPONSIVE LAYOUT SCALING
The app MUST target **iOS, Android, and Desktop (Web/Electron wrappers)**. 
- **Responsive Architecture**: The UI must automatically scale and adapt layout structures based on target viewports using responsive utilities (Tailwind's \`md:\`, \`lg:\` breakpoints).
- **Desktop/Tablet Mode**: Mimics a retro early-2000s desktop game-client window (fixed-width constrained centered shells, multi-column master-detail views, and permanent sidebar navigation).
- **Mobile Mode**: Collapses into single-column flows with standard bottom navigation bars.
- **Phone rules** (keep these when adding UI):
  - Touch targets ≥ ~40px: use \`TOUCH_SLOP\` / \`hitSlop\` on compact controls; \`RetroGamingPCButton\` and tabs already have it.
  - Text ≥ 10px (\`text-retrogamingpc-xs\`). Below \`md\` (phones) the whole \`text-retrogamingpc-*\` scale is 10% larger, set once in \`tailwind.config.js\` (\`FONT_SIZES\`, \`MOBILE_FONT_SCALE\`). Use those classes, not fixed px sizes.
  - Every \`TextInput\` gets \`noZoomInputStyle\` (\`src/utils/platform.ts\`), so phone browsers don't zoom on focus.
  - Dialogs go through \`RetroGamingPCModal\`, which avoids the keyboard and scrolls when taller than the screen. Pass \`scrollable={false}\` only for bodies with their own list.
  - Long-text writers (the Review Studio editor) use \`RetroGamingPCSheet\`: a full-height overlay pinned to the top that shrinks by exactly the part the keyboard covers. Dialogs opened from it go inside it as children.
  - Scrolling screens with inputs set \`automaticallyAdjustKeyboardInsets\` + \`keyboardShouldPersistTaps="handled"\`.
  - Anything wider than ~300px either wraps (\`flex-wrap\`) or scrolls sideways.
  - Full-screen pages keep the bottom safe-area inset (set in \`app/_layout.tsx\`).
  - Never toggle Tailwind classes that set CSS variables or animations (\`translate-*\`, \`rotate-*\`, \`scale-*\`, \`shadow-*\`, \`transition-*\`, \`animate-*\`) after the first render, e.g. on press. NativeWind crashes on native ("Could not find a LinkingContext"). Use a \`style\` transform instead.

## 📱 BOTTOM NAVIGATION & CORE WORKFLOWS
The core app features a bottom navigation bar (migrating to a desktop sidebar on wider viewports) with five tabs (Stats sits between Post and Profile):
1. **Home (\`app/(tabs)/index.tsx\`)**: one top tab bar (\`?tab=\`): **Community** (trending games + trending posts, migration 000020, then the community feed), **Friends** (friends' activity) and **Lists** (Curated Lists pinned by app admins via \`app_admins\` + \`set_list_pin\`, Your Lists with New List, Browse Lists). Lists: \`lists\` + \`list_items\` (migration 000019), page \`app/list/[id].tsx\`, searchable in the Search tab. Admins can also make **smart lists** (migration 000023, \`smart_rule\` + \`smart_list_games\`): a rule (type, tier, years, genre, platform, size) ranked live by plain Gamer Cred average; a game qualifies with at least the 75th-percentile rating count for its type (min 3). The SQL tier bands mirror \`ratingRubric.ts\` (test-enforced).
2. **Search (\`app/(tabs)/search.tsx\`)**: Unified search interface with tabs/filters for:
   - **Games**: Title, genre, and platform database search (via IGDB Edge Function cache).
   - **Creators** (sub-tabs Studios · Directors & People): Developers, publishers, and key game creators (via IGDB Edge Function cache).
     Tapping a studio opens \`app/studio/[id].tsx\`: the company plus every game it developed or published (proxy action \`company\`), each linking to its game page.
   - **Users / Friends**: Search community profiles by username to view profiles and send friend requests.
3. **Now Playing tab — Post / Review Studio (\`app/(tabs)/post.tsx\`)**: 
   - **Now Playing Grid**: 4 active slots. Empty slots allow adding a game. Filled slots allow removal (with confirmation modal), running notes, and preliminary scoring.
   - **Publishing**: Convert a Now Playing draft into a published community review.
   - **Standalone Review**: Review any game directly without occupying a Now Playing slot.
   - **Reviews are created ONLY here** (and via the game page's "Write a review" button, which opens the Studio). Quick ratings (\`game_ratings\`: score + played-on platform, public to read; game page only; game lists such as search, studio pages and user lists show no scores and the whole card opens the game page) are a separate action and must never create or open a review — see \`src/components/rating/README.md\`.
4. **Stats (\`app/(tabs)/stats.tsx\`)**: charts of the user's own logged games, computed in Postgres (\`stats_*\` functions, migration 000014). Menu driven by \`src/components/stats/statsConfig.ts\`; see \`src/components/stats/README.md\`.
5. **Profile (\`app/(tabs)/profile.tsx\`)**:
   - **Public & Private View**: Displays active Now Playing 4-game grid and friend status.
   - **Top 4 Favorites**: Showcase section for top 4 favorite games of all time.
   - **Hardware & Platform Roster**: Grid of owned consoles/platforms with PC spec entry and 1 highlighted "Main" platform badge.

## 🎨 VISUAL THEME & UX SPECIFICATION (RETROGAMINGPC AESTHETIC)
The application MUST strictly adhere to the **RetroGamingPC** aesthetic: an original early-2000s desktop game-client look (olive palette, beveled chrome, compact type). Never use third-party brand names, logos, icons, fonts or artwork in UI or code identifiers; product names may appear only when referring to that real product (e.g. a "Steam Deck" device entry).
- **Color Palette (high-contrast dark mode)**: user-selectable themes, shown in Settings as Mega (id \`blue\`, default), Chief (\`olive\`, the base the others are generated from), Super (\`red\`), Pika (\`yellow\`) and Peach (\`pink\`). Source of truth: \`src/constants/themePalettes.json\`, generated by \`scripts/generate-theme-palettes.py\` (edit the script, not the JSON).
  - Surfaces (\`retrogamingpc-dark\`, \`-card\`, \`-panel\`, \`-button\`, \`-accent\`, \`-button-border\`, \`-bevel-light\`, \`-bevel-dark\`) are near-black and tinted by the theme hue; \`-highlight\` and \`-active\` carry the theme colour for borders, meters, stars and primary buttons.
  - Text (\`retrogamingpc-text-bright\`, \`-text\`, \`-text-muted\`, \`-ink\`) is NEUTRAL grey, identical in every theme. Never colour text with a theme token; links are \`text-bright\` + underline.
  - Contrast minimums (enforced by \`src/utils/__tests__/themes.test.ts\`): body/heading text ≥ 7:1, muted text ≥ 4.5:1 on every surface.
- **Action colours (fixed in every theme)**: \`src/constants/actionColors.ts\` (values in \`actionColors.json\`, contrast enforced by \`src/utils/__tests__/actionColors.test.ts\`). Use the matching \`RetroGamingPCButton\` variant:
  - \`save\` bright green: save, publish, update, confirm, accept, log in / register.
  - \`cancel\` red: cancel, close, exit, decline, sign out (also dialog title-bar ✕ and small ✕ remove/clear controls).
  - \`danger\` deep red + ⚠: delete, remove, discard (can't be undone).
  - \`create\` bright green (same as save): start or add something (write a review, assign to Now Playing, add friend, add device, choose picture).
  - \`navigate\` blue: go somewhere (view details/profile, open in Review Studio, resume a draft, search for).
  - \`default\` / \`primary\` stay themed for everything else (Retry, Notes, Edit Specs, Set as Main, Prev/Next).
  - Status colours follow the same hues: alerts/toasts error red · info blue · success green; badges Published solid green · Draft green outline · Now Playing blue; "✓ Saved" green.
- **UI & Bevel Guidelines**:
  - **Skeuomorphic Borders**: Sharp, tactile bevel borders (\`border-t\`, \`border-l\` lighter highlights, \`border-b\`, \`border-r\` darker inset shadows).
  - **Typography**: Compact, high-density retro layout (sans-serif, tight line heights, crisp monospace numbers/ratings).

## 🚫 CRITICAL RESTRICTION: THE NO-JS LAW
UNDER NO CIRCUMSTANCES create, modify, or output \`.js\` or \`.jsx\` source files (excluding config files like \`babel.config.js\`, \`tailwind.config.js\`, \`metro.config.js\`).
- All React UI components and screens MUST use \`.tsx\`.
- All non-UI logic, services, types, and constants MUST use \`.ts\`.
- Maintain strict TypeScript mode with no unhandled \`any\` types.

## 🛠️ TECHNOLOGY STACK
- **Framework**: React Native + Expo (Managed Workflow, Expo Router v3+)
- **Language**: TypeScript (Strict mode enabled)
- **State & Data**: TanStack Query (React Query) v5, Zustand
- **Backend & Types**: Supabase client (\`@supabase/supabase-js\`)
- **UI & Styling**: NativeWind v4 (TailwindCSS for React Native)
- **Validation**: Zod (for runtime type safety and form validation)

## 📁 STRICT FOLDER STRUCTURE
- \`app/\` (Expo Router file-based routes ONLY)
  - \`app/(auth)/\`: Login, Register
  - \`app/(tabs)/\`: Index (Home), Search, Post, Profile
  - \`app/game/[id].tsx\`: Dynamic game detail view
  - \`app/user/[id].tsx\`: Dynamic public user profile view
  - \`app/+error.tsx\`: Global error boundary
- \`src/components/\`: Reusable UI components
- \`src/services/\`: Supabase client & Edge Function wrappers
- \`src/hooks/\`: Custom React hooks wrapping TanStack Query
- \`src/types/\`: TypeScript interfaces & database.types.ts
- \`src/utils/\`: Helper functions
- \`supabase/functions/\`: Supabase Edge Functions
- \`supabase/migrations/\`: PostgreSQL initial migrations

## 🗄️ BACKEND & CACHING RULES
- **No Direct IGDB Client Calls**: Client NEVER directly calls IGDB/Twitch APIs.
- **Supabase Edge Functions**: IGDB search (games, companies, creators) routes through Supabase Edge Functions.
- **PostgreSQL Caching**: IGDB responses cached in an \`igdb_cache\` table (\`cache_key\` primary key, \`data\` JSONB, \`updated_at\`).

## ⚡ QUERY CACHING & QUERY KEYS
- **Centralized Query Keys**: All TanStack Query calls MUST use a single query key factory defined in \`src/utils/queryKeys.ts\`.

## 🗄️ DATABASE INDEXING RULES
- **Indexes**: Migrations MUST include indexes for: \`reviews\`, \`favorites\`, \`igdb_cache\`, \`now_playing\`, \`user_platforms\`, \`user_favorites\`, and \`friendships(user_id, friend_id, status)\`.

## 🌐 EDGE FUNCTION CONTRACT & ENVIRONMENT TYPING
- **Standard API Envelope**: Edge Functions return responses formatted as \`{ success: boolean, data?: T, error?: string }\`.
- **Strict Environment Types**: Require \`src/types/env.d.ts\` declaring types for Supabase environment keys.

## 🔒 SECURITY & STABILITY HARDENING
- **Secure Auth Storage**: Supabase client MUST use \`expo-secure-store\` for session persistence.
- **Database RLS**: Every table created in migrations MUST enable Row Level Security with explicit read/write policies.
- **Global Error Boundary**: Implement \`app/+error.tsx\` at the root.
- **Typed Routes**: Enable Expo Router's typed routes in \`app.json\`.
- **Input Validation**: Use Zod schemas for all user-submitted data. Text other users can read must also pass \`containsObjectionable\` (\`src/utils/contentFilter.ts\`).
- **User-content safety (store requirements)**:
  - Every new kind of public content needs a ⚑ Report entry point (\`ReportLink\`, a \`content_reports\` target).
  - It also needs a restrictive \`… hide blocked\` select policy (migration 000021), so blocking hides it.
  - Profile pictures are screened before anyone sees them (migration 000022 + \`avatar\` Edge Function, Google Cloud Vision SafeSearch). The app uploads to the private \`avatar-uploads/<uid>/pending.jpg\`. Only the function publishes to \`avatars\` or sets \`profiles.avatar_url\` (a trigger blocks clients). Borderline pictures, or pictures sent while the check is unavailable, are held for admins in Moderation → Pictures.
  - Account deletion is the \`account\` Edge Function. New user tables must cascade from \`profiles\` / \`auth.users\`.
  - Contact and terms live in \`src/constants/legal.ts\`. Bump \`TERMS_VERSION\` when the terms change.

## 🎨 RETRO ICONOGRAPHY & MICRO-INTERACTIONS
- **Icons**: Use \`@expo/vector-icons\` (sharp linear sets like \`MaterialCommunityIcons\` or \`Feather\`).

## 🎨 NATIVEWIND V4 RULES
- Require \`global.css\` at project root defining the RetroGamingPC colors and bevel utility classes.
- Require import of \`../global.css\` in \`app/_layout.tsx\`.
- Require \`nativewind-env.d.ts\` at root with content: \`/// <reference types="nativewind/types" />\`.
`;
fs.writeFileSync("CLAUDE.md", md);
'