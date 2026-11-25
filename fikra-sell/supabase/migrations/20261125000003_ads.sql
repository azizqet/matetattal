-- FIKRA SELL · 0003 · Ads, images, favourites, saved searches

create table public.ads (
  id bigint generated always as identity (start with 100001) primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id int not null references public.categories(id) on delete restrict,
  main_category_id int not null references public.categories(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 90),
  description text not null default '' check (char_length(description) <= 4000),
  price numeric(12, 3) check (price is null or (price >= 0 and price <= 999999999)),
  price_type public.price_type not null default 'fixed',
  condition public.item_condition,
  governorate_id smallint not null references public.governorates(id),
  area_id int references public.areas(id),
  lat double precision check (lat is null or lat between 28 and 31),
  lng double precision check (lng is null or lng between 46 and 49.5),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+?[0-9]{8,15}$'),
  allow_call boolean not null default true,
  allow_whatsapp boolean not null default true,
  allow_chat boolean not null default true,
  status public.ad_status not null default 'pending',
  reject_reason text,
  cover_path text,
  images_count smallint not null default 0,
  views_count int not null default 0,
  favorites_count int not null default 0,
  contacts_count int not null default 0,
  search_text text not null default '',
  content_hash text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  bumped_at timestamptz not null default now(),
  expires_at timestamptz,
  featured_until timestamptz,
  pinned_until timestamptz,
  sold_at timestamptz
);

create index ads_feed_idx on public.ads (status, bumped_at desc, id desc);
create index ads_cat_feed_idx on public.ads (main_category_id, status, bumped_at desc);
create index ads_sub_feed_idx on public.ads (category_id, status, bumped_at desc);
create index ads_user_idx on public.ads (user_id, status, created_at desc);
create index ads_gov_idx on public.ads (governorate_id, status);
create index ads_area_idx on public.ads (area_id) where area_id is not null;
create index ads_price_idx on public.ads (status, price);
create index ads_featured_idx on public.ads (featured_until desc) where featured_until is not null;
create index ads_pinned_idx on public.ads (pinned_until desc) where pinned_until is not null;
create index ads_expires_idx on public.ads (expires_at) where status = 'active';
create index ads_hash_idx on public.ads (user_id, content_hash);
create index ads_search_trgm on public.ads using gin (search_text extensions.gin_trgm_ops);
create index ads_attrs_gin on public.ads using gin (attributes jsonb_path_ops);
create index ads_geo_idx on public.ads (lat, lng) where lat is not null;

create table public.ad_images (
  id bigint generated always as identity primary key,
  ad_id bigint not null references public.ads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  path text not null unique,
  sort smallint not null default 0,
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index ad_images_ad_idx on public.ad_images (ad_id, sort);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ad_id bigint not null references public.ads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, ad_id)
);
create index favorites_ad_idx on public.favorites (ad_id);
create index favorites_user_idx on public.favorites (user_id, created_at desc);

create table public.saved_searches (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  query text not null default '' check (char_length(query) <= 100),
  query_norm text not null default '',
  filters jsonb not null default '{}'::jsonb,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  last_match_at timestamptz
);
create index saved_searches_user_idx on public.saved_searches (user_id);
create index saved_searches_cat_idx on public.saved_searches (((filters ->> 'category_id')::int)) where notify;

create table public.search_terms (
  term_norm text primary key,
  display text not null,
  hits int not null default 1,
  last_at timestamptz not null default now()
);
create index search_terms_trgm on public.search_terms using gin (term_norm extensions.gin_trgm_ops);

-- ── Validation & protection ────────────────────────────────────────────
create or replace function private.validate_attributes(p_category int, p_attrs jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  f record;
  v jsonb;
  clean jsonb := '{}'::jsonb;
  main_id int;
begin
  select coalesce(parent_id, id) into main_id from public.categories where id = p_category;
  for f in
    select * from public.category_fields where category_id in (p_category, main_id) order by sort
  loop
    v := p_attrs -> f.key;
    if v is null or v = 'null'::jsonb or v = '""'::jsonb then
      if f.is_required then
        raise exception using errcode = 'P0422', message = 'missing_field:' || f.key;
      end if;
      continue;
    end if;
    if f.type = 'select' then
      if not exists (select 1 from jsonb_array_elements(f.options) o where o ->> 'v' = v #>> '{}') then
        raise exception using errcode = 'P0422', message = 'invalid_option:' || f.key;
      end if;
      clean := clean || jsonb_build_object(f.key, v #>> '{}');
    elsif f.type in ('number', 'year') then
      if jsonb_typeof(v) not in ('number', 'string') or (v #>> '{}') !~ '^-?[0-9]+(\.[0-9]+)?$' then
        raise exception using errcode = 'P0422', message = 'invalid_number:' || f.key;
      end if;
      if (f.min_value is not null and (v #>> '{}')::numeric < f.min_value)
         or (f.max_value is not null and (v #>> '{}')::numeric > f.max_value) then
        raise exception using errcode = 'P0422', message = 'out_of_range:' || f.key;
      end if;
      clean := clean || jsonb_build_object(f.key, (v #>> '{}')::numeric);
    elsif f.type = 'boolean' then
      clean := clean || jsonb_build_object(f.key, (v #>> '{}')::boolean);
    else
      clean := clean || jsonb_build_object(f.key, left(v #>> '{}', 120));
    end if;
  end loop;
  return clean;
end $$;

create or replace function private.attribute_search_text(p_category int, p_attrs jsonb)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(string_agg(
    case when f.type = 'select' then
      (select (o ->> 'ar') || ' ' || (o ->> 'en') from jsonb_array_elements(f.options) o where o ->> 'v' = p_attrs ->> f.key limit 1)
    when f.type = 'text' then p_attrs ->> f.key
    when f.type = 'year' then p_attrs ->> f.key
    end, ' '), '')
  from public.category_fields f
  where f.category_id in (p_category, (select coalesce(parent_id, id) from public.categories where id = p_category))
    and p_attrs ? f.key
$$;

create or replace function private.ads_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cat record;
  uid uuid := auth.uid();
  priv boolean := private.is_privileged();
  review boolean := coalesce((public.setting('require_ad_review') #>> '{}')::boolean, false);
  duration int := coalesce((public.setting('ad_duration_days') #>> '{}')::int, 30);
  daily int;
  account_age interval;
  content_changed boolean;
begin
  if tg_op = 'INSERT' or row(new.category_id, new.title, new.description, new.price, new.price_type,
      new.condition, new.governorate_id, new.area_id, new.attributes, new.contact_phone, new.allow_call,
      new.allow_whatsapp, new.allow_chat, new.lat, new.lng)
    is distinct from row(old.category_id, old.title, old.description, old.price, old.price_type,
      old.condition, old.governorate_id, old.area_id, old.attributes, old.contact_phone, old.allow_call,
      old.allow_whatsapp, old.allow_chat, old.lat, old.lng) then
    select c.*, (select count(*) from public.categories s where s.parent_id = c.id and s.is_active) as sub_count
      into cat from public.categories c where c.id = new.category_id;
    if cat.id is null or not cat.is_active then
      raise exception using errcode = 'P0422', message = 'invalid_category';
    end if;
    if cat.sub_count > 0 and not priv then
      raise exception using errcode = 'P0422', message = 'choose_subcategory';
    end if;
    new.main_category_id := coalesce(cat.parent_id, cat.id);

    if new.area_id is not null and not exists (
      select 1 from public.areas a where a.id = new.area_id and a.governorate_id = new.governorate_id and a.is_active) then
      raise exception using errcode = 'P0422', message = 'invalid_area';
    end if;

    -- Price rules
    if new.price_type in ('fixed', 'negotiable') then
      if new.price is null or new.price <= 0 then
        raise exception using errcode = 'P0422', message = 'price_required';
      end if;
    else
      new.price := null;
    end if;
    if not cat.has_condition then new.condition := null; end if;
    if new.lat is not null then new.lat := round(new.lat::numeric, 3); new.lng := round(new.lng::numeric, 3); end if;

    new.title := btrim(regexp_replace(new.title, '\s+', ' ', 'g'));
    new.description := btrim(new.description);
    new.attributes := private.validate_attributes(new.category_id, new.attributes);
    new.search_text := public.normalize_ar(new.title || ' ' || new.description || ' ' ||
      private.attribute_search_text(new.category_id, new.attributes));
    new.content_hash := md5(new.category_id::text || '|' || public.normalize_ar(new.title) || '|' ||
      left(public.normalize_ar(new.description), 400));
    if not (new.allow_call or new.allow_whatsapp or new.allow_chat) then
      raise exception using errcode = 'P0422', message = 'contact_method_required';
    end if;
    if (new.allow_call or new.allow_whatsapp) and new.contact_phone is null then
      raise exception using errcode = 'P0422', message = 'phone_required';
    end if;

  else
    new.main_category_id := old.main_category_id;
    new.search_text := old.search_text;
    new.content_hash := old.content_hash;
  end if;

  if tg_op = 'INSERT' then
    if not priv then
      if uid is null then raise exception using errcode = 'P0401', message = 'auth_required'; end if;
      new.user_id := uid;
      if exists (select 1 from public.profiles where id = uid and is_banned) then
        raise exception using errcode = 'P0403', message = 'account_banned';
      end if;
      select now() - created_at into account_age from public.profiles where id = uid;
      daily := case when account_age < interval '24 hours'
        then coalesce((public.setting('new_account_daily_ad_limit') #>> '{}')::int, 3)
        else coalesce((public.setting('daily_ad_limit') #>> '{}')::int, 10) end;
      if (select count(*) from public.ads where user_id = uid and created_at > now() - interval '24 hours') >= daily then
        raise exception using errcode = 'P0429', message = 'daily_ad_limit';
      end if;
      perform private.enforce_rate_limit('ad_post:' || uid, 3, 60, 'posting_too_fast');
      if exists (select 1 from public.ads where user_id = uid and content_hash = new.content_hash
                 and status in ('pending', 'active', 'hidden') ) then
        raise exception using errcode = 'P0409', message = 'duplicate_ad';
      end if;
      new.status := case when review then 'pending'::public.ad_status else 'active'::public.ad_status end;
      new.reject_reason := null;
      new.featured_until := null; new.pinned_until := null; new.sold_at := null;
      new.views_count := 0; new.favorites_count := 0; new.contacts_count := 0;
      new.cover_path := null; new.images_count := 0;
      new.created_at := now(); new.bumped_at := now();
    end if;
    if new.status = 'active' then
      new.published_at := coalesce(new.published_at, now());
      new.expires_at := coalesce(new.expires_at, now() + make_interval(days => duration));
    end if;
    return new;
  end if;

  -- UPDATE
  if not priv then
    if exists (select 1 from public.profiles where id = old.user_id and is_banned) then
      raise exception using errcode = 'P0403', message = 'account_banned';
    end if;
    perform private.enforce_rate_limit('ad_edit:' || old.user_id, 30, 600, 'editing_too_fast');
    new.user_id := old.user_id; new.created_at := old.created_at; new.published_at := old.published_at;
    new.bumped_at := old.bumped_at; new.expires_at := old.expires_at;
    new.featured_until := old.featured_until; new.pinned_until := old.pinned_until;
    new.views_count := old.views_count; new.favorites_count := old.favorites_count;
    new.contacts_count := old.contacts_count; new.reject_reason := old.reject_reason;
    new.cover_path := old.cover_path; new.images_count := old.images_count;

    content_changed := new.content_hash is distinct from old.content_hash
      or new.price is distinct from old.price or new.attributes is distinct from old.attributes;

    -- Allowed owner transitions
    if new.status is distinct from old.status then
      if not (
        (old.status = 'active' and new.status in ('sold', 'hidden')) or
        (old.status = 'hidden' and new.status = 'active' and old.expires_at > now()) or
        (old.status = 'hidden' and new.status = 'sold')
      ) then
        raise exception using errcode = 'P0403', message = 'invalid_status_change';
      end if;
    end if;
    if new.status = 'sold' and old.status <> 'sold' then new.sold_at := now(); else new.sold_at := old.sold_at; end if;
    if old.status = 'sold' and content_changed then
      raise exception using errcode = 'P0403', message = 'sold_ad_locked';
    end if;
    -- Edited content goes back to review when moderation is on; rejected ads
    -- re-enter review after any edit.
    if content_changed and (old.status = 'rejected' or (review and old.status in ('active', 'pending'))) then
      new.status := 'pending';
      new.reject_reason := null;
    end if;
  else
    if new.status = 'active' and old.status is distinct from 'active' then
      new.published_at := coalesce(new.published_at, now());
      if new.expires_at is null or new.expires_at < now() then
        new.expires_at := now() + make_interval(days => duration);
      end if;
      new.reject_reason := null;
    end if;
    if new.status = 'sold' and old.status <> 'sold' then new.sold_at := now(); end if;
  end if;
  return new;
end $$;

create trigger ads_before_write before insert or update on public.ads
  for each row execute function private.ads_before_write();
create trigger ads_touch before update on public.ads
  for each row execute function private.touch_updated_at();

-- Counters on profiles and categories
create or replace function private.ads_counters()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'active' then
    update public.profiles set active_ads_count = greatest(active_ads_count - 1, 0) where id = old.user_id;
    update public.categories set ads_count = greatest(ads_count - 1, 0) where id in (old.category_id, old.main_category_id);
  end if;
  if tg_op in ('UPDATE', 'INSERT') and new.status = 'active' then
    update public.profiles set active_ads_count = active_ads_count + 1 where id = new.user_id;
    update public.categories set ads_count = ads_count + 1 where id in (new.category_id, new.main_category_id);
  end if;
  return null;
end $$;
create trigger ads_counters after insert or delete or update of status, category_id on public.ads
  for each row execute function private.ads_counters();

-- Image rules: owner only, max images per ad, path inside owner's folder.
create or replace function private.ad_images_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
  max_images int := coalesce((public.setting('max_images') #>> '{}')::int, 15);
begin
  select user_id into owner from public.ads where id = new.ad_id;
  if owner is null then raise exception using errcode = 'P0422', message = 'invalid_ad'; end if;
  if not private.is_privileged() then
    if owner is distinct from auth.uid() then
      raise exception using errcode = 'P0403', message = 'not_owner';
    end if;
    new.user_id := owner;
    if split_part(new.path, '/', 1) <> owner::text or new.path !~ '^[0-9a-f-]{36}/[0-9]+/[A-Za-z0-9_-]{6,64}\.(jpg|jpeg|png|webp)$' then
      raise exception using errcode = 'P0422', message = 'invalid_image_path';
    end if;
    if tg_op = 'UPDATE' then new.path := old.path; new.ad_id := old.ad_id; end if;
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.ad_images where ad_id = new.ad_id) >= max_images then
    raise exception using errcode = 'P0422', message = 'too_many_images';
  end if;
  return new;
end $$;
create trigger ad_images_before_write before insert or update on public.ad_images
  for each row execute function private.ad_images_before_write();

create or replace function private.ad_images_sync_cover()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a bigint := coalesce(new.ad_id, old.ad_id); prev text;
begin
  prev := private.elevate();
  update public.ads set
    cover_path = (select path from public.ad_images where ad_id = a order by sort, id limit 1),
    images_count = (select count(*) from public.ad_images where ad_id = a)
  where id = a;
  perform private.restore(prev);
  return null;
end $$;
create trigger ad_images_sync_cover after insert or update or delete on public.ad_images
  for each row execute function private.ad_images_sync_cover();

create or replace function private.favorites_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare prev text := private.elevate();
begin
  if tg_op = 'INSERT' then
    update public.ads set favorites_count = favorites_count + 1 where id = new.ad_id;
  else
    update public.ads set favorites_count = greatest(favorites_count - 1, 0) where id = old.ad_id;
  end if;
  perform private.restore(prev);
  return null;
end $$;
create trigger favorites_count after insert or delete on public.favorites
  for each row execute function private.favorites_count();

create or replace function private.saved_searches_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_privileged() then
    new.user_id := auth.uid();
    if tg_op = 'INSERT' and (select count(*) from public.saved_searches where user_id = new.user_id) >= 20 then
      raise exception using errcode = 'P0429', message = 'saved_search_limit';
    end if;
  end if;
  new.query_norm := public.normalize_ar(new.query);
  return new;
end $$;
create trigger saved_searches_before_write before insert or update on public.saved_searches
  for each row execute function private.saved_searches_before_write();
