-- FIKRA SELL · 0002 · Users, staff permissions, locations, categories

-- ── Profiles ───────────────────────────────────────────────────────────
-- The e-mail address is NOT verified (confirmation is disabled for instant
-- sign-up) so it is never shown publicly and never treated as identity.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 60),
  avatar_path text,
  bio text check (bio is null or char_length(bio) <= 300),
  role public.user_role not null default 'user',
  is_banned boolean not null default false,
  is_merchant boolean not null default false,
  merchant_until timestamptz,
  active_ads_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role) where role <> 'user';
create index profiles_created_idx on public.profiles (created_at desc);
create index profiles_name_trgm on public.profiles using gin (public.normalize_ar(full_name) extensions.gin_trgm_ops);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Owner-only settings (never readable by other users).
create table public.profile_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone text check (phone is null or phone ~ '^\+?[0-9]{8,15}$'),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  notification_prefs jsonb not null default
    '{"messages":true,"ads":true,"saved_searches":true,"offers":true,"general":true}'::jsonb,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger profile_settings_touch before update on public.profile_settings
  for each row execute function private.touch_updated_at();

-- Ban history (staff only).
create table public.user_bans (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  banned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null
);
create index user_bans_user_idx on public.user_bans (user_id, created_at desc);

-- ── Staff permissions (multi-level moderators) ─────────────────────────
create table public.staff_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null check (permission in (
    'ads', 'reports', 'users', 'categories', 'locations', 'commerce', 'banners',
    'notifications', 'pages', 'support', 'settings', 'revenue', 'audit', 'staff')),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, permission)
);

create or replace function public.current_role_level()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select coalesce((select role from public.profiles where id = auth.uid() and not is_banned), 'user'::public.user_role)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_role_level() in ('moderator', 'admin', 'owner')
$$;

create or replace function public.has_perm(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case public.current_role_level()
    when 'owner' then true
    when 'admin' then true
    when 'moderator' then exists (select 1 from public.staff_permissions where user_id = auth.uid() and permission = p)
    else false end
$$;

-- ── Sign-up guard + profile creation ───────────────────────────────────
create table private.blocked_email_domains (domain text primary key);
insert into private.blocked_email_domains (domain) values
  ('mailinator.com'), ('guerrillamail.com'), ('guerrillamail.net'), ('10minutemail.com'),
  ('tempmail.com'), ('temp-mail.org'), ('yopmail.com'), ('trashmail.com'), ('sharklasers.com'),
  ('getnada.com'), ('dispostable.com'), ('maildrop.cc'), ('throwawaymail.com'), ('fakeinbox.com'),
  ('mintemail.com'), ('mohmal.com'), ('emailondeck.com'), ('tempail.com'), ('moakt.com'),
  ('mail.tm'), ('tmpmail.org'), ('burnermail.io'), ('spamgourmet.com'), ('mytemp.email');

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  if exists (select 1 from private.blocked_email_domains d where v_domain = d.domain or v_domain like '%.' || d.domain) then
    raise exception using errcode = 'P0403', message = 'disposable_email';
  end if;
  -- Circuit breaker against scripted mass sign-ups (per-IP limits are
  -- enforced by Supabase Auth itself; see supabase/config.toml).
  perform private.enforce_rate_limit('signup:global', 120, 600, 'signup_rate_limited');
  if char_length(v_name) < 2 then v_name := split_part(coalesce(new.email, 'user'), '@', 1); end if;
  insert into public.profiles (id, full_name) values (new.id, left(v_name, 60));
  insert into public.profile_settings (user_id, locale)
  values (new.id, case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'ar' end);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Direct API writes can never touch role / ban / merchant / counters.
-- Those change only through the audited admin_* functions (security definer).
create or replace function private.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_privileged() then
    new.role := old.role; new.is_banned := old.is_banned;
    new.is_merchant := old.is_merchant; new.merchant_until := old.merchant_until;
    new.active_ads_count := old.active_ads_count; new.created_at := old.created_at; new.id := old.id;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function private.protect_profile_columns();

-- ── Governorates & areas ───────────────────────────────────────────────
create table public.governorates (
  id smallint generated by default as identity primary key,
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  lat double precision not null,
  lng double precision not null,
  sort int not null default 0,
  is_active boolean not null default true
);

create table public.areas (
  id int generated by default as identity primary key,
  governorate_id smallint not null references public.governorates(id) on delete restrict,
  name_ar text not null,
  name_en text not null,
  lat double precision,
  lng double precision,
  sort int not null default 0,
  is_active boolean not null default true,
  unique (governorate_id, name_ar)
);
create index areas_gov_idx on public.areas (governorate_id, sort);

-- ── Categories (main + sub via parent_id) and dynamic fields ───────────
create table public.categories (
  id int generated by default as identity primary key,
  parent_id int references public.categories(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name_ar text not null,
  name_en text not null,
  icon text not null default 'misc',
  price_label text not null default 'price' check (price_label in ('price', 'salary', 'rent', 'none')),
  has_condition boolean not null default true,
  sort int not null default 0,
  is_active boolean not null default true,
  ads_count int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_parent_idx on public.categories (parent_id, sort);

create table public.category_fields (
  id int generated by default as identity primary key,
  category_id int not null references public.categories(id) on delete cascade,
  key text not null check (key ~ '^[a-z_]{2,30}$'),
  label_ar text not null,
  label_en text not null,
  type public.field_type not null,
  options jsonb not null default '[]'::jsonb,   -- [{"v":"toyota","ar":"تويوتا","en":"Toyota"}]
  unit_ar text,
  unit_en text,
  min_value numeric,
  max_value numeric,
  is_required boolean not null default false,
  is_filterable boolean not null default true,
  sort int not null default 0,
  unique (category_id, key)
);
