-- =============================================================================
-- gamer_cred — 000038 permanent names + display names
--
-- 1. The username becomes the PERMANENT name: chosen once (Register, or the
--    "Choose your permanent name" screen for Google / player_xxxxxx accounts),
--    then locked. A–Z, 0–9 and keyboard symbols (no spaces or @), 3–24 long.
--    Names that only differ by capitals, symbols, I/l/1 or O/0 from an
--    existing one are rejected. It is the only name search looks at.
-- 2. A new DISPLAY name: any alphabet, 0–9, spaces and keyboard symbols (no
--    @, no emoji), 1–32 long, changeable once a day. Empty = the permanent
--    name is shown. Admins can reset it (logged).
-- 3. Both names are checked against slurs / profanity (even run together:
--    "Chinkdude" is blocked, "Canadiandude" is fine), staff impersonation,
--    and reserved public figures and companies (private.name_blocklist,
--    filled by 000039; add names with one insert, see README → Names).
-- 4. official_user_ids(): admins whose authenticator is approved (000037),
--    for the gold check-mark badge.
--
-- Existing names are never changed by this migration.
-- =============================================================================

-- ---- 1. columns ---------------------------------------------------------------------------------
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists display_name_changed_at timestamptz;
-- Existing accounts have chosen theirs; new player_xxxxxx accounts get false (handle_new_user).
alter table public.profiles add column if not exists username_chosen boolean not null default true;

-- Wider permanent-name characters. Every existing name already passes the old, narrower
-- rule, so existing rows aren't re-checked (not valid); every new or changed name is.
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check
  check (username ~ '^[A-Za-z0-9!#$%^&*()_+=\[\]{};:''",.<>/?\\|`~-]{3,24}$' and username ~ '[A-Za-z0-9]') not valid;

-- ---- 2. rule tables (private: never reachable through the API) ---------------------------------
-- Reserved names: staff words, public figures, companies. name_key = private.name_key(label).
create table if not exists private.name_blocklist (
  name_key text primary key,
  label    text not null,
  category text not null check (category in ('staff', 'game_industry', 'creator', 'celebrity', 'politician', 'company'))
);

-- Slurs and profanity. 'anywhere' = even inside a longer name; 'whole' = only as its own word.
create table if not exists private.name_badwords (
  word_key text primary key,
  word     text not null,
  match    text not null check (match in ('anywhere', 'whole')),
  pattern  text generated always as (regexp_replace(word_key, '(.)', '\1+', 'g')) stored
);

-- Everyday words that contain an 'anywhere' word (raccoon, spicy, Scunthorpe…).
create table if not exists private.name_allowed_words (
  word_key text primary key,
  word     text not null
);

-- A reserved name released for one account (e.g. the real public figure joined).
create table if not exists private.name_exceptions (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  name_key text not null,
  primary key (user_id, name_key)
);

alter table private.name_blocklist enable row level security;
alter table private.name_badwords enable row level security;
alter table private.name_allowed_words enable row level security;
alter table private.name_exceptions enable row level security;
revoke all on private.name_blocklist, private.name_badwords, private.name_allowed_words, private.name_exceptions
  from public, anon, authenticated;

-- ---- 3. folding ---------------------------------------------------------------------------------
-- Aggressive fold for matching: strips accents, maps Cyrillic / Greek look-alikes and
-- number swaps to Latin letters, i/l/1/!/| all become i, then keeps only a–z.
create or replace function private.name_fold(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(
      lower(translate(
        regexp_replace(normalize(coalesce(p, ''), NFKD), '[̀-ͯ]', '', 'g'),
        'АВЕКМНОРСТХУІЈЅԀавекмнорстхуіјѕԁӏɡгΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεικνορτυχω',
        'abekmhopctxyijsdabekmhopctxyijsdigrabezhikmnoptyxabeikvoptuxw')),
      '0134578@$!|+l',
      'oieastbasiiti'),
    '[^a-z]', '', 'g');
$$;

-- Reserved-name key: the fold with repeated letters collapsed ("Taaaylor" = "Taylor").
create or replace function private.name_key(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(private.name_fold(p), '(.)\1+', '\1', 'g');
$$;

-- Permanent-name look-alike key: capitals, symbols, I/l/1 and O/0 don't count.
create or replace function private.handle_skeleton(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(translate(p, 'I10', 'llo')), '[^a-z0-9]', '', 'g');
$$;

create index if not exists idx_profiles_username_skeleton on public.profiles (private.handle_skeleton(username));

-- ---- 4. format rules (mirrored in src/utils/nameRules.ts; fixture-tested both sides) ----------
create or replace function private.permanent_name_format_ok(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null
     and p ~ '^[A-Za-z0-9!#$%^&*()_+=\[\]{};:''",.<>/?\\|`~-]{3,24}$'
     and p ~ '[A-Za-z0-9]';
$$;

-- 1–32 characters: letters of any alphabet, 0–9, spaces (not leading, trailing or
-- doubled) and keyboard symbols except @. At least one letter or number; at most two
-- accents stacked on one letter. No emoji, invisible or right-to-left control characters.
create or replace function private.display_name_format_ok(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  cp       int;
  marks    int := 0;
  has_text boolean := false;
begin
  if p is null then
    return true;
  end if;
  if char_length(p) < 1 or char_length(p) > 32 or p <> btrim(p, ' ') or position('  ' in p) > 0 then
    return false;
  end if;
  for i in 1 .. char_length(p) loop
    cp := ascii(substr(p, i, 1));
    if cp between 768 and 879 then -- combining accents
      marks := marks + 1;
      if marks > 2 or i = 1 then
        return false;
      end if;
      continue;
    end if;
    marks := 0;
    if cp between 32 and 126 then
      if cp = 64 then
        return false;
      end if;
      if cp between 48 and 57 or cp between 65 and 90 or cp between 97 and 122 then
        has_text := true;
      end if;
    elsif cp between 192 and 214 or cp between 216 and 246 or cp between 248 and 591  -- Latin
       or cp between 880 and 1023      -- Greek
       or cp between 1024 and 1327     -- Cyrillic
       or cp between 1329 and 1423     -- Armenian
       or cp between 1425 and 1524     -- Hebrew
       or cp between 1568 and 1747     -- Arabic
       or cp between 2304 and 3583     -- Indic scripts
       or cp between 3585 and 3675     -- Thai
       or cp between 3713 and 3807     -- Lao
       or cp between 4256 and 4351     -- Georgian
       or cp between 4352 and 4607     -- Hangul Jamo
       or cp between 7680 and 7935     -- Latin Extended Additional (Vietnamese)
       or cp between 7936 and 8191     -- Greek Extended
       or cp between 12353 and 12438 or cp between 12441 and 12543 -- Hiragana, Katakana
       or cp between 13312 and 19903 or cp between 19968 and 40959 -- CJK
       or cp between 44032 and 55203   -- Hangul
    then
      has_text := true;
    else
      return false;
    end if;
  end loop;
  return has_text;
end;
$$;

-- ---- 5. content rules -----------------------------------------------------------------------------
-- Slurs / profanity: 'anywhere' words even when run together (after taking out allowed
-- everyday words), 'whole' words as their own word (spaces, symbols or camelCase split words).
create or replace function private.name_has_badword(p text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folded text := private.name_fold(p);
  tokens text[];
  w      record;
begin
  if folded = '' then
    return false;
  end if;
  -- Allowed everyday words become separators, longest first.
  for w in select word_key from private.name_allowed_words order by char_length(word_key) desc loop
    folded := replace(folded, w.word_key, '.');
  end loop;
  if exists (select 1 from private.name_badwords b where b.match = 'anywhere' and folded ~ b.pattern) then
    return true;
  end if;

  tokens := array(
    select private.name_fold(t)
      from regexp_split_to_table(regexp_replace(p, '([a-z])([A-Z])', '\1 \2', 'g'), '[\s_\-.,;:''"()\[\]{}<>/?\\~`#%^&*=]+') t
     where t <> ''
  );
  return exists (
    select 1
      from private.name_badwords b, unnest(tokens) tok
     where b.match = 'whole' and tok ~ ('^' || b.pattern || 's*$')
  );
end;
$$;

-- Reserved: a staff word, public figure or company, exactly or with impersonation
-- add-ons ("TheReal…", "…Official", "…TV"). Fan names ("KojimaFan") are fine.
create or replace function private.name_reserved(p text, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folded     text := private.name_fold(p);
  prefixes   text[] := array['thereal', 'real', 'official', 'its', 'iam', 'im', 'the', 'gc'];
  suffixes   text[] := array['official', 'real', 'hq', 'tv', 'ttv', 'yt', 'live', 'team', 'staff', 'support', 'verified', 'irl', 'gc'];
  bodies     text[] := array[folded];
  candidates text[];
  pre        text;
  suf        text;
  b          text;
begin
  if folded = '' then
    return false;
  end if;
  foreach pre in array prefixes loop
    pre := private.name_fold(pre);
    if folded like pre || '%' and char_length(folded) > char_length(pre) then
      bodies := bodies || substr(folded, char_length(pre) + 1);
    end if;
  end loop;
  candidates := bodies;
  foreach b in array bodies loop
    foreach suf in array suffixes loop
      suf := private.name_fold(suf);
      if b like '%' || suf and char_length(b) > char_length(suf) then
        candidates := candidates || left(b, char_length(b) - char_length(suf));
      end if;
    end loop;
  end loop;
  candidates := array(select regexp_replace(c, '(.)\1+', '\1', 'g') from unnest(candidates) c);
  return exists (
    select 1
      from private.name_blocklist l
     where l.name_key = any (candidates)
       and not exists (select 1 from private.name_exceptions e where e.user_id = p_user and e.name_key = l.name_key)
  );
end;
$$;

-- What's wrong with a name, or null if it's fine:
-- format · taken · too_close (permanent only) · language · reserved.
create or replace function private.name_problem(p_kind text, p_name text, p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind = 'permanent' then
    if not private.permanent_name_format_ok(p_name) then
      return 'format';
    end if;
    if exists (select 1 from public.profiles p where lower(p.username) = lower(p_name) and p.id is distinct from p_user) then
      return 'taken';
    end if;
    if exists (
      select 1 from public.profiles p
       where private.handle_skeleton(p.username) = private.handle_skeleton(p_name) and p.id is distinct from p_user
    ) then
      return 'too_close';
    end if;
  elsif p_kind = 'display' then
    p_name := normalize(p_name, NFC); -- as stored
    if p_name is null or not private.display_name_format_ok(p_name) then
      return 'format';
    end if;
  else
    raise exception 'unknown name kind %', p_kind;
  end if;
  if public.contains_objectionable(replace(p_name, '_', ' ')) or private.name_has_badword(p_name) then
    return 'language';
  end if;
  if private.name_reserved(p_name, p_user) then
    return 'reserved';
  end if;
  return null;
end;
$$;

revoke all on function private.name_fold(text), private.name_key(text), private.handle_skeleton(text),
  private.permanent_name_format_ok(text), private.display_name_format_ok(text), private.name_has_badword(text),
  private.name_reserved(text, uuid), private.name_problem(text, text, uuid) from public, anon;
grant execute on function private.name_fold(text), private.name_key(text), private.handle_skeleton(text),
  private.permanent_name_format_ok(text), private.display_name_format_ok(text), private.name_problem(text, text, uuid)
  to authenticated;

-- For the app (Register runs before there is a session, so anon too, like
-- is_username_available). Returns the problem code or null.
create or replace function public.check_name(p_kind text, p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.name_problem(p_kind, p_name, (select auth.uid()));
$$;

revoke all on function public.check_name(text, text) from public;
grant execute on function public.check_name(text, text) to anon, authenticated;

-- Old app versions call this; same rules as check_name('permanent').
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.name_problem('permanent', candidate, (select auth.uid())) is null;
$$;

-- ---- 6. the profile guard -----------------------------------------------------------------------
-- Not security definer, so current_user tells the app (authenticated) apart from
-- handle_new_user / admin_reset_display_name / the SQL editor.
create or replace function private.profiles_names_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  from_app boolean := current_user in ('authenticated', 'anon');
  problem  text;
begin
  if new.display_name is not null then
    new.display_name := normalize(new.display_name, NFC);
  end if;

  if tg_op = 'INSERT' or new.username is distinct from old.username then
    if tg_op = 'UPDATE' and from_app and old.username_chosen then
      raise exception 'Your permanent name can''t be changed.' using errcode = 'NM001';
    end if;
    problem := private.name_problem('permanent', new.username, new.id);
    if tg_op = 'UPDATE' then
      new.username_chosen := true;
    end if;
  elsif from_app then
    new.username_chosen := old.username_chosen;
  end if;
  if problem is null and new.display_name is distinct from (case when tg_op = 'UPDATE' then old.display_name end) then
    if tg_op = 'UPDATE' and from_app then
      if old.display_name_changed_at > now() - interval '1 day' then
        raise exception 'You can change your display name once a day.' using errcode = 'NM005';
      end if;
      new.display_name_changed_at := now();
    end if;
    if new.display_name is not null then
      problem := private.name_problem('display', new.display_name, new.id);
    end if;
  elsif tg_op = 'UPDATE' and from_app then
    new.display_name_changed_at := old.display_name_changed_at;
  end if;

  case problem
    when 'format' then
      raise exception 'That name uses characters or a length that aren''t allowed.' using errcode = 'NM004';
    when 'taken' then
      raise exception 'That name is already taken.' using errcode = '23505';
    when 'too_close' then
      raise exception 'That name is too close to another player''s name.' using errcode = 'NM002';
    when 'language' then
      raise exception 'Please keep it clean — that contains language GamerCred doesn''t allow.' using errcode = 'CF001';
    when 'reserved' then
      raise exception 'That name is reserved. Names can''t impersonate staff, public figures or companies.' using errcode = 'NM003';
    else
      null;
  end case;
  return new;
end;
$$;

drop trigger if exists profiles_names_guard on public.profiles;
create trigger profiles_names_guard
  before insert or update of username, display_name, username_chosen, display_name_changed_at on public.profiles
  for each row execute function private.profiles_names_guard();

-- Display names are public text: same database word filter as everything else.
drop trigger if exists profiles_reject_objectionable on public.profiles;
create trigger profiles_reject_objectionable before insert or update of username, display_name on public.profiles
  for each row execute function public.reject_objectionable('username', 'display_name');

-- ---- 7. sign-up -----------------------------------------------------------------------------------
-- Same as 000037, but a requested name must pass every name rule, and accounts that
-- end up with a player_xxxxxx name pick their permanent name on first sign-in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested text  := meta ->> 'username';
  candidate text;
  chosen    boolean := true;
  attempt   int   := 0;
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  if requested is not null and private.name_problem('permanent', requested, new.id) is null then
    candidate := requested;
  else
    chosen := false;
    loop
      candidate := 'player_' || substr(md5(random()::text), 1, 6);
      exit when private.name_problem('permanent', candidate, new.id) is null;
      attempt := attempt + 1;
      if attempt > 20 then
        raise exception 'could not allocate a unique username for %', new.id;
      end if;
    end loop;
  end if;

  -- Pictures only ever come through the screening function (000022).
  insert into public.profiles (id, username, username_chosen) values (new.id, candidate, chosen);

  return new;
end;
$$;

-- ---- 8. official badge + names for the app ----------------------------------------------------------
-- Admins whose authenticator is approved (000037): the gold check-mark badge.
create or replace function public.official_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(a.user_id), '{}') from public.app_admins a where private.admin_factor_ok(a.user_id);
$$;

revoke all on function public.official_user_ids() from public, anon;
grant execute on function public.official_user_ids() to authenticated;

-- Names for up to 200 players at once (one request per screen). Runs as the caller,
-- so blocked players stay hidden.
create or replace function public.profile_names(p_ids uuid[])
returns table (id uuid, username text, display_name text, is_official boolean)
language sql
stable
set search_path = ''
as $$
  with o as (select public.official_user_ids() as ids)
  select p.id, p.username, p.display_name, p.id = any (o.ids)
    from public.profiles p, o
   where p.id = any (p_ids[1:200]);
$$;

revoke all on function public.profile_names(uuid[]) from public, anon;
grant execute on function public.profile_names(uuid[]) to authenticated;

-- ---- 9. admin reset --------------------------------------------------------------------------------
create or replace function public.admin_reset_display_name(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous text;
begin
  if not public.is_app_admin() then
    raise exception 'Only app admins can reset display names.' using errcode = 'LS001';
  end if;
  select display_name into previous from public.profiles where id = p_user;
  if not found then
    raise exception 'That player doesn''t exist.' using errcode = 'P0002';
  end if;
  update public.profiles set display_name = null, display_name_changed_at = null where id = p_user;
  perform public.log_admin_action('user.reset_display_name', 'user', p_user::text, jsonb_build_object('display_name', previous));
end;
$$;

revoke all on function public.admin_reset_display_name(uuid) from public, anon;
grant execute on function public.admin_reset_display_name(uuid) to authenticated;
