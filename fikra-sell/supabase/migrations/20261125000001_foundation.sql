-- FIKRA SELL · 0001 · Foundation: extensions, private schema, enums, helpers
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;

-- Objects in "private" are never exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

-- ── Enums ──────────────────────────────────────────────────────────────
create type public.user_role as enum ('user', 'moderator', 'admin', 'owner');
create type public.ad_status as enum ('pending', 'active', 'rejected', 'expired', 'sold', 'hidden');
create type public.price_type as enum ('fixed', 'negotiable', 'contact', 'free');
create type public.item_condition as enum ('new', 'used');
create type public.field_type as enum ('select', 'text', 'number', 'year', 'boolean');
create type public.report_target as enum ('ad', 'user', 'conversation', 'message');
create type public.report_status as enum ('open', 'resolved', 'dismissed');
create type public.ticket_status as enum ('open', 'pending', 'closed');
create type public.package_kind as enum ('feature', 'pin', 'bump', 'merchant', 'subscription');
create type public.order_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded');
create type public.banner_placement as enum ('home_top', 'home_middle', 'category_top', 'search_top');

-- ── Arabic-aware text normalisation (used by search) ───────────────────
-- Removes diacritics and tatweel, unifies alef/ya/ta-marbuta/hamza forms,
-- converts Arabic-Indic digits, strips the definite article "ال" from each
-- word and lower-cases Latin text. "السيّارة", "سياره" and "سيارة" all
-- normalise to "سياره".
create or replace function public.normalize_ar(input text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select btrim(regexp_replace(
    regexp_replace(
      translate(
        lower(regexp_replace(coalesce(input, ''), '[ً-ٰٟـ]', '', 'g')),
        'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        'اااايهوي01234567890123456789'),
      '(^|\s)(وال|بال|فال|كال|لل|ال)(\S{2,})', '\1\3', 'g'),
    '[^0-9a-zء-ي]+', ' ', 'g'))
$$;

-- Typo tolerance: true when some word of `txt` is within a small edit
-- distance of `tok` (1 edit for 4–6 letters, 2 edits for 7+).
create or replace function public.fuzzy_word_match(tok text, txt text)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select char_length(tok) >= 4 and exists (
    select 1 from unnest(string_to_array(txt, ' ')) w
    where abs(char_length(w) - char_length(tok)) <= 2
      and extensions.levenshtein(left(w, 255), left(tok, 255)) <= case when char_length(tok) >= 7 then 2 else 1 end)
$$;

-- ── Settings (key/value, editable by admins) ───────────────────────────
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create or replace function public.setting(k text, fallback jsonb default 'null'::jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select value from public.app_settings where key = k), fallback)
$$;

-- ── Generic updated_at trigger ─────────────────────────────────────────
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ── Rate limiting (fixed window, per key) ──────────────────────────────
create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (key, window_start)
);

-- Returns true when the call is allowed and records it; false when the
-- caller exceeded max_hits within the window.
create or replace function private.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into private.rate_limits as r (key, window_start) values (p_key, w)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  return n <= p_max;
end $$;

create or replace function private.enforce_rate_limit(p_key text, p_max int, p_window_seconds int, p_message text default 'rate_limited')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.hit_rate_limit(p_key, p_max, p_window_seconds) then
    raise exception using errcode = 'P0429', message = p_message;
  end if;
end $$;

-- Server-side functions mark their transaction as privileged before
-- touching protected columns. Clients cannot call set_config through the
-- Data API (pg_catalog is not exposed), so the flag cannot be forged.
create or replace function private.is_privileged()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(current_setting('fikra.privileged', true), '') = 'on'
      or current_user in ('postgres', 'supabase_admin', 'service_role')
         and coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon')
$$;

-- Usage:  prev := private.elevate();  ...protected writes...;  perform private.restore(prev);
create or replace function private.elevate()
returns text language plpgsql volatile set search_path = '' as $$
declare prev text := coalesce(current_setting('fikra.privileged', true), '');
begin perform set_config('fikra.privileged', 'on', true); return prev; end $$;

create or replace function private.restore(prev text)
returns void language sql volatile set search_path = '' as $$
  select set_config('fikra.privileged', coalesce(prev, ''), true)
$$;
