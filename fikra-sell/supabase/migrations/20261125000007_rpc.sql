-- FIKRA SELL · 0007 · RPC functions (public, user, admin)

-- ══════════════════════════════ PUBLIC ══════════════════════════════════

create type public.ad_card as (
  id bigint, title text, price numeric, price_type public.price_type, condition public.item_condition,
  cover_path text, images_count smallint, category_id int, main_category_id int,
  governorate_id smallint, area_id int, user_id uuid, status public.ad_status,
  created_at timestamptz, bumped_at timestamptz, is_featured boolean, is_pinned boolean,
  distance_km double precision, favorites_count int
);

-- Search & browse. All parameters optional:
--  q, category_id, governorate_id, area_id, min_price, max_price, condition,
--  attrs {key: value | {min,max}}, sort (newest|oldest|price_asc|price_desc|nearest|relevance),
--  lat, lng, radius_km, featured_only, seller_id, exclude_id, limit (≤50), offset
create or replace function public.search_ads(p jsonb default '{}'::jsonb)
returns setof public.ad_card language plpgsql stable security definer set search_path = ''
set pg_trgm.word_similarity_threshold = 0.4 as $$
declare
  q text := public.normalize_ar(p ->> 'q');
  toks text[];
  cat int := nullif(p ->> 'category_id', '')::int;
  gov int := nullif(p ->> 'governorate_id', '')::int;
  area int := nullif(p ->> 'area_id', '')::int;
  pmin numeric := nullif(p ->> 'min_price', '')::numeric;
  pmax numeric := nullif(p ->> 'max_price', '')::numeric;
  cond public.item_condition := nullif(p ->> 'condition', '')::public.item_condition;
  attrs jsonb := coalesce(p -> 'attrs', '{}'::jsonb);
  srt text := coalesce(nullif(p ->> 'sort', ''), case when coalesce(q, '') <> '' then 'relevance' else 'newest' end);
  ulat double precision := nullif(p ->> 'lat', '')::double precision;
  ulng double precision := nullif(p ->> 'lng', '')::double precision;
  radius double precision := coalesce(nullif(p ->> 'radius_km', '')::double precision, 15);
  featured boolean := coalesce((p ->> 'featured_only')::boolean, false);
  seller uuid := nullif(p ->> 'seller_id', '')::uuid;
  excl bigint := nullif(p ->> 'exclude_id', '')::bigint;
  lim int := least(greatest(coalesce((p ->> 'limit')::int, 20), 1), 50);
  off int := least(greatest(coalesce((p ->> 'offset')::int, 0), 0), 5000);
  k text; v jsonb;
  attr_sql text := '';
begin
  if q <> '' then toks := array(select t from unnest(string_to_array(q, ' ')) t where t <> '' limit 6); end if;

  for k, v in select * from jsonb_each(attrs) loop
    if k !~ '^[a-z_]{2,30}$' then continue; end if;
    if jsonb_typeof(v) = 'object' then
      if v ? 'min' then attr_sql := attr_sql || format(' and (a.attributes ->> %L)::numeric >= %L::numeric', k, v ->> 'min'); end if;
      if v ? 'max' then attr_sql := attr_sql || format(' and (a.attributes ->> %L)::numeric <= %L::numeric', k, v ->> 'max'); end if;
    elsif jsonb_typeof(v) = 'array' then
      attr_sql := attr_sql || format(' and (a.attributes ->> %L) = any (array(select jsonb_array_elements_text(%L::jsonb)))', k, v::text);
    elsif v #>> '{}' <> '' then
      attr_sql := attr_sql || format(' and (a.attributes ->> %L) = %L', k, v #>> '{}');
    end if;
  end loop;

  return query execute format($q$
    select a.id, a.title, a.price, a.price_type, a.condition, a.cover_path, a.images_count,
           a.category_id, a.main_category_id, a.governorate_id, a.area_id, a.user_id, a.status,
           a.created_at, a.bumped_at,
           coalesce(a.featured_until > now(), false), coalesce(a.pinned_until > now(), false),
           case when $1 is not null and $2 is not null then
             6371 * 2 * asin(sqrt(power(sin(radians(coalesce(a.lat, g.lat) - $1) / 2), 2) +
               cos(radians($1)) * cos(radians(coalesce(a.lat, g.lat))) * power(sin(radians(coalesce(a.lng, g.lng) - $2) / 2), 2)))
           end as distance_km,
           a.favorites_count
    from public.ads a
    join public.governorates g on g.id = a.governorate_id
    where a.status = 'active'
      and ($3 is null or a.category_id = $3 or a.main_category_id = $3)
      and ($4 is null or a.governorate_id = $4)
      and ($5 is null or a.area_id = $5)
      and ($6 is null or a.price >= $6)
      and ($7 is null or a.price <= $7)
      and ($8 is null or a.condition = $8)
      and (not $9 or a.featured_until > now())
      and ($10 is null or a.user_id = $10)
      and ($11 is null or a.id <> $11)
      and ($12 is null or (select bool_and(a.search_text like '%%' || t || '%%'
             or (t operator(extensions.<%%) a.search_text and public.fuzzy_word_match(t, a.search_text))) from unnest($12) t))
      %s
      and ($13 <> 'nearest' or ($1 is not null and 6371 * 2 * asin(sqrt(power(sin(radians(coalesce(a.lat, g.lat) - $1) / 2), 2) +
               cos(radians($1)) * cos(radians(coalesce(a.lat, g.lat))) * power(sin(radians(coalesce(a.lng, g.lng) - $2) / 2), 2))) <= $14))
      and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = a.user_id)
    order by
      case when $13 = 'newest' and $3 is not null and $12 is null then coalesce(a.pinned_until > now(), false) end desc nulls last,
      case when $13 = 'relevance' then extensions.word_similarity($15, a.search_text) end desc nulls last,
      case when $13 = 'price_asc' then a.price end asc nulls last,
      case when $13 = 'price_desc' then a.price end desc nulls last,
      case when $13 = 'nearest' then 6371 * 2 * asin(sqrt(power(sin(radians(coalesce(a.lat, g.lat) - $1) / 2), 2) +
               cos(radians($1)) * cos(radians(coalesce(a.lat, g.lat))) * power(sin(radians(coalesce(a.lng, g.lng) - $2) / 2), 2))) end asc nulls last,
      case when $13 = 'oldest' then a.bumped_at end asc,
      a.bumped_at desc, a.id desc
    limit $16 offset $17
  $q$, attr_sql)
  using ulat, ulng, cat, gov, area, pmin, pmax, cond, featured, seller, excl, toks, srt, radius, q, lim, off;
end $$;

-- Autocomplete: popular searches, matching titles and categories.
create or replace function public.search_suggestions(prefix text)
returns table (label text, kind text, category_id int) language sql stable security definer set search_path = '' as $$
  with n as (select public.normalize_ar(prefix) as q)
  (select c.name_ar || ' / ' || c.name_en, 'category', c.id from public.categories c, n
     where c.is_active and char_length(n.q) >= 1
       and (public.normalize_ar(c.name_ar) like n.q || '%' or lower(c.name_en) like n.q || '%')
     order by c.parent_id nulls first, c.sort limit 3)
  union all
  (select s.display, 'term', null::int from public.search_terms s, n
     where char_length(n.q) >= 2 and (s.term_norm like n.q || '%' or n.q operator(extensions.<%) s.term_norm)
     order by (s.term_norm like n.q || '%') desc, s.hits desc limit 5)
  union all
  (select a.title, 'ad', a.main_category_id from public.ads a, n
     where char_length(n.q) >= 2 and a.status = 'active' and a.search_text like '%' || n.q || '%'
     order by a.bumped_at desc limit 4)
$$;

create or replace function public.log_search(term text)
returns void language plpgsql security definer set search_path = '' as $$
declare n text := public.normalize_ar(term);
begin
  if char_length(n) < 2 or char_length(n) > 60 then return; end if;
  if not private.hit_rate_limit('search:' || coalesce(auth.uid()::text, 'anon'), case when auth.uid() is null then 600 else 60 end, 60) then
    return;
  end if;
  insert into public.search_terms as s (term_norm, display) values (n, left(btrim(term), 60))
  on conflict (term_norm) do update set hits = s.hits + 1, last_at = now();
  insert into public.daily_metrics as m (metric, value) values ('search', 1)
  on conflict (day, metric) do update set value = m.value + 1;
end $$;

-- Ad interactions: view / call / whatsapp / share (counters + daily metrics)
create or replace function public.record_ad_event(p_ad bigint, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare who text := coalesce(auth.uid()::text, 'anon'); prev text;
begin
  if p_kind not in ('view', 'call', 'whatsapp', 'share') then return; end if;
  if not private.hit_rate_limit('ev:' || p_kind || ':' || who || ':' || p_ad, case when who = 'anon' then 200 else 1 end, 3600) then
    return;
  end if;
  prev := private.elevate();
  if p_kind = 'view' then
    update public.ads set views_count = views_count + 1 where id = p_ad and status = 'active' and user_id::text <> who;
  elsif p_kind in ('call', 'whatsapp') then
    update public.ads set contacts_count = contacts_count + 1 where id = p_ad and status = 'active';
  end if;
  perform private.restore(prev);
  insert into public.daily_metrics as m (metric, value)
  values (case p_kind when 'view' then 'ad_view' else p_kind end, 1)
  on conflict (day, metric) do update set value = m.value + 1;
end $$;

create or replace function public.track_app_open()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.hit_rate_limit('open:' || coalesce(auth.uid()::text, 'anon'), case when auth.uid() is null then 5000 else 1 end, 1800) then
    return;
  end if;
  insert into public.daily_metrics as m (metric, value) values ('app_open', 1)
  on conflict (day, metric) do update set value = m.value + 1;
  if auth.uid() is not null then
    update public.profile_settings set last_seen_at = now() where user_id = auth.uid();
  end if;
end $$;

create or replace function public.banner_event(p_banner int, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.hit_rate_limit('banner:' || coalesce(auth.uid()::text, 'anon') || ':' || p_banner || p_kind,
       case when auth.uid() is null then 2000 else 20 end, 3600) then return; end if;
  if p_kind = 'impression' then update public.banners set impressions = impressions + 1 where id = p_banner;
  elsif p_kind = 'click' then
    update public.banners set clicks = clicks + 1 where id = p_banner;
    insert into public.daily_metrics as m (metric, value) values ('banner_click', 1)
    on conflict (day, metric) do update set value = m.value + 1;
  end if;
end $$;

-- ══════════════════════════════ USER ════════════════════════════════════

create or replace function private.require_user()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception using errcode = 'P0401', message = 'auth_required'; end if;
  if exists (select 1 from public.profiles where id = uid and is_banned) then
    raise exception using errcode = 'P0403', message = 'account_banned';
  end if;
  return uid;
end $$;

create or replace function public.bump_ad(p_ad bigint)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  a record;
  cooldown int := coalesce((public.setting('bump_cooldown_hours') #>> '{}')::int, 24);
  prev text;
begin
  select * into a from public.ads where id = p_ad and user_id = uid for update;
  if a.id is null then raise exception using errcode = 'P0404', message = 'ad_not_found'; end if;
  if a.status <> 'active' then raise exception using errcode = 'P0422', message = 'ad_not_active'; end if;
  if a.bumped_at > now() - make_interval(hours => cooldown) then
    raise exception using errcode = 'P0429', message = 'bump_cooldown', detail = (a.bumped_at + make_interval(hours => cooldown))::text;
  end if;
  prev := private.elevate();
  update public.ads set bumped_at = now() where id = p_ad;
  perform private.restore(prev);
  return now() + make_interval(hours => cooldown);
end $$;

create or replace function public.renew_ad(p_ad bigint)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  a record;
  duration int := coalesce((public.setting('ad_duration_days') #>> '{}')::int, 30);
  prev text;
  new_exp timestamptz;
begin
  select * into a from public.ads where id = p_ad and user_id = uid for update;
  if a.id is null then raise exception using errcode = 'P0404', message = 'ad_not_found'; end if;
  if not (a.status = 'expired' or (a.status = 'active' and a.expires_at < now() + interval '5 days')) then
    raise exception using errcode = 'P0422', message = 'renew_not_needed';
  end if;
  perform private.enforce_rate_limit('renew:' || uid, 30, 86400, 'renew_limit');
  new_exp := now() + make_interval(days => duration);
  prev := private.elevate();
  update public.ads set status = 'active', expires_at = new_exp, bumped_at = now() where id = p_ad;
  perform private.restore(prev);
  return new_exp;
end $$;

create or replace function public.start_conversation(p_ad bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); a record; cid uuid;
begin
  select id, user_id, title, cover_path, allow_chat, status into a from public.ads where id = p_ad;
  if a.id is null or a.status not in ('active', 'sold') then raise exception using errcode = 'P0404', message = 'ad_not_found'; end if;
  if a.user_id = uid then raise exception using errcode = 'P0422', message = 'own_ad'; end if;
  if not a.allow_chat then raise exception using errcode = 'P0403', message = 'chat_disabled'; end if;
  if public.is_blocked_between(uid, a.user_id) then raise exception using errcode = 'P0403', message = 'blocked'; end if;
  select id into cid from public.conversations where ad_id = p_ad and buyer_id = uid;
  if cid is null then
    perform private.enforce_rate_limit('conv:' || uid, 30, 3600, 'too_many_conversations');
    insert into public.conversations (ad_id, buyer_id, seller_id, ad_title, ad_cover_path)
    values (p_ad, uid, a.user_id, a.title, a.cover_path) returning id into cid;
  else
    update public.conversations set buyer_hidden_at = null where id = cid;
  end if;
  return cid;
end $$;

create or replace function public.mark_conversation_read(p_conv uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c record;
begin
  select * into c from public.conversations where id = p_conv and uid in (buyer_id, seller_id);
  if c.id is null then raise exception using errcode = 'P0404', message = 'not_found'; end if;
  update public.messages set read_at = now() where conversation_id = p_conv and sender_id <> uid and read_at is null;
  update public.conversations set
    buyer_unread = case when uid = buyer_id then 0 else buyer_unread end,
    seller_unread = case when uid = seller_id then 0 else seller_unread end
  where id = p_conv;
  update public.notifications set read_at = now()
  where user_id = uid and type = 'message' and read_at is null and data ->> 'conversation_id' = p_conv::text;
end $$;

create or replace function public.hide_conversation(p_conv uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  update public.conversations set
    buyer_hidden_at = case when uid = buyer_id then now() else buyer_hidden_at end,
    seller_hidden_at = case when uid = seller_id then now() else seller_hidden_at end,
    buyer_unread = case when uid = buyer_id then 0 else buyer_unread end,
    seller_unread = case when uid = seller_id then 0 else seller_unread end
  where id = p_conv and uid in (buyer_id, seller_id);
  if not found then raise exception using errcode = 'P0404', message = 'not_found'; end if;
end $$;

create or replace function public.my_counters()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'unread_messages', coalesce((select sum(case when buyer_id = auth.uid() then buyer_unread else seller_unread end)
       from public.conversations where auth.uid() in (buyer_id, seller_id)), 0),
    'unread_notifications', (select count(*) from public.notifications where user_id = auth.uid() and read_at is null),
    'favorites', (select count(*) from public.favorites where user_id = auth.uid()))
$$;

create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
  perform private.enforce_rate_limit('push:' || uid, 20, 3600);
  insert into public.push_tokens (token, user_id, platform, updated_at) values (p_token, uid, p_platform, now())
  on conflict (token) do update set user_id = uid, platform = p_platform, updated_at = now();
end $$;

-- Permanently deletes the caller's account and all their data (cascade).
-- The app removes the caller's storage files first (storage API).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception using errcode = 'P0401', message = 'auth_required'; end if;
  if (select role from public.profiles where id = uid) = 'owner' then
    raise exception using errcode = 'P0403', message = 'owner_cannot_delete';
  end if;
  insert into private.deleted_accounts (user_id) values (uid);
  delete from auth.users where id = uid;
end $$;

create table private.deleted_accounts (
  user_id uuid not null,
  deleted_at timestamptz not null default now()
);

-- Commerce (prepared; refuses while payments are disabled)
create or replace function public.quote_package(p_package int, p_code text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare pk record; pc record; base numeric; disc numeric := 0;
begin
  select * into pk from public.packages where id = p_package and is_active;
  if pk.id is null then raise exception using errcode = 'P0404', message = 'package_not_found'; end if;
  base := case when pk.promo_price_kwd is not null and (pk.promo_ends_at is null or pk.promo_ends_at > now())
               then pk.promo_price_kwd else pk.price_kwd end;
  if nullif(btrim(p_code), '') is not null then
    select * into pc from public.promo_codes where code = upper(btrim(p_code)) and is_active
      and starts_at <= now() and (ends_at is null or ends_at > now())
      and (max_uses is null or used_count < max_uses) and (package_kind is null or package_kind = pk.kind);
    if pc.id is null then raise exception using errcode = 'P0422', message = 'invalid_promo'; end if;
    disc := least(base, coalesce(round(base * pc.discount_percent / 100.0, 3), 0) + coalesce(pc.discount_kwd, 0));
  end if;
  return jsonb_build_object('package_id', pk.id, 'base_kwd', base, 'discount_kwd', disc, 'amount_kwd', base - disc,
    'payments_enabled', coalesce((public.setting('payments_enabled') #>> '{}')::boolean, false));
end $$;

create or replace function public.create_order(p_package int, p_ad bigint default null, p_code text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); q jsonb; oid uuid;
begin
  if not coalesce((public.setting('payments_enabled') #>> '{}')::boolean, false) then
    raise exception using errcode = 'P0403', message = 'payments_disabled';
  end if;
  if p_ad is not null and not exists (select 1 from public.ads where id = p_ad and user_id = uid) then
    raise exception using errcode = 'P0404', message = 'ad_not_found';
  end if;
  q := public.quote_package(p_package, p_code);
  insert into public.orders (user_id, package_id, ad_id, base_kwd, discount_kwd, amount_kwd, promo_code)
  values (uid, p_package, p_ad, (q ->> 'base_kwd')::numeric, (q ->> 'discount_kwd')::numeric,
          (q ->> 'amount_kwd')::numeric, nullif(upper(btrim(p_code)), ''))
  returning id into oid;
  return oid;
end $$;

-- Applies a paid order (called by the payment webhook with service role, or by admins for manual sales).
create or replace function private.apply_order(p_order uuid, p_provider text, p_ref text)
returns void language plpgsql security definer set search_path = '' as $$
declare o record; pk record; prev text;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null or o.status = 'paid' then return; end if;
  select * into pk from public.packages where id = o.package_id;
  update public.orders set status = 'paid', paid_at = now(), provider = p_provider, provider_ref = p_ref where id = o.id;
  if o.promo_code is not null then update public.promo_codes set used_count = used_count + 1 where code = o.promo_code; end if;
  prev := private.elevate();
  if pk.kind = 'feature' and o.ad_id is not null then
    update public.ads set featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => pk.duration_days) where id = o.ad_id;
  elsif pk.kind = 'pin' and o.ad_id is not null then
    update public.ads set pinned_until = greatest(coalesce(pinned_until, now()), now()) + make_interval(days => pk.duration_days) where id = o.ad_id;
  elsif pk.kind = 'bump' and o.ad_id is not null then
    update public.ads set bumped_at = now() where id = o.ad_id;
  elsif pk.kind in ('merchant', 'subscription') then
    insert into public.subscriptions (user_id, package_id, order_id, ends_at)
    values (o.user_id, pk.id, o.id, now() + make_interval(days => pk.duration_days));
    if pk.kind = 'merchant' then
      update public.profiles set is_merchant = true,
        merchant_until = greatest(coalesce(merchant_until, now()), now()) + make_interval(days => pk.duration_days)
      where id = o.user_id;
    end if;
  end if;
  perform private.restore(prev);
end $$;

-- ══════════════════════════════ ADMIN ═══════════════════════════════════

create or replace function private.require_perm(p text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_perm(p) then
    raise exception using errcode = 'P0403', message = 'forbidden';
  end if;
  return auth.uid();
end $$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception using errcode = 'P0403', message = 'forbidden'; end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'users_new_today', (select count(*) from public.profiles where created_at > date_trunc('day', now())),
    'users_banned', (select count(*) from public.profiles where is_banned),
    'ads_total', (select count(*) from public.ads),
    'ads_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.ads group by status) s),
    'ads_new_today', (select count(*) from public.ads where created_at > date_trunc('day', now())),
    'ads_featured', (select count(*) from public.ads where featured_until > now()),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'tickets_open', (select count(*) from public.support_tickets where status = 'open'),
    'messages_today', (select count(*) from public.messages where created_at > date_trunc('day', now())),
    'revenue_kwd_30d', (select coalesce(sum(amount_kwd), 0) from public.orders where status = 'paid' and paid_at > now() - interval '30 days'),
    'by_category', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
        select c.id, c.name_ar, c.name_en, count(a.id) n from public.categories c
        left join public.ads a on a.main_category_id = c.id and a.status = 'active'
        where c.parent_id is null group by c.id) x),
    'by_governorate', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
        select g.id, g.name_ar, g.name_en, count(a.id) n from public.governorates g
        left join public.ads a on a.governorate_id = g.id and a.status = 'active' group by g.id) x),
    'daily', (select coalesce(jsonb_agg(x order by x.day), '[]') from (
        select d::date as day,
          (select count(*) from public.profiles p where p.created_at::date = d::date) as users,
          (select count(*) from public.ads a where a.created_at::date = d::date) as ads,
          coalesce((select value from public.daily_metrics m where m.day = d::date and m.metric = 'app_open'), 0) as opens,
          coalesce((select value from public.daily_metrics m where m.day = d::date and m.metric = 'ad_view'), 0) as views
        from generate_series(current_date - 13, current_date, interval '1 day') d) x)
  );
end $$;

create or replace function public.admin_set_ad_status(p_ad bigint, p_status public.ad_status, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a record; prev text;
begin
  perform private.require_perm('ads');
  select * into a from public.ads where id = p_ad for update;
  if a.id is null then raise exception using errcode = 'P0404', message = 'ad_not_found'; end if;
  if p_status = 'rejected' and nullif(btrim(p_reason), '') is null then
    raise exception using errcode = 'P0422', message = 'reason_required';
  end if;
  prev := private.elevate();
  update public.ads set status = p_status, reject_reason = case when p_status = 'rejected' then p_reason else null end where id = p_ad;
  perform private.restore(prev);
  if p_status = 'active' and a.status = 'pending' then
    insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
    values (a.user_id, 'ad_approved', 'تم نشر إعلانك', 'Your ad is live', a.title, a.title, jsonb_build_object('ad_id', a.id));
  elsif p_status = 'rejected' then
    insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
    values (a.user_id, 'ad_rejected', 'لم يُقبل إعلانك', 'Your ad was not approved', a.title || ' — ' || p_reason,
            a.title || ' — ' || p_reason, jsonb_build_object('ad_id', a.id));
  end if;
  perform private.audit('ad_status', 'ad', p_ad::text, jsonb_build_object('from', a.status, 'to', p_status, 'reason', p_reason));
end $$;

create or replace function public.admin_promote_ad(p_ad bigint, p_kind text, p_days int)
returns void language plpgsql security definer set search_path = '' as $$
declare prev text;
begin
  perform private.require_perm('commerce');
  if p_kind not in ('feature', 'pin', 'bump', 'unfeature', 'unpin') or p_days not between 0 and 365 then
    raise exception using errcode = 'P0422', message = 'invalid_input';
  end if;
  prev := private.elevate();
  update public.ads set
    featured_until = case p_kind when 'feature' then greatest(coalesce(featured_until, now()), now()) + make_interval(days => p_days)
                                 when 'unfeature' then null else featured_until end,
    pinned_until = case p_kind when 'pin' then greatest(coalesce(pinned_until, now()), now()) + make_interval(days => p_days)
                               when 'unpin' then null else pinned_until end,
    bumped_at = case when p_kind = 'bump' then now() else bumped_at end
  where id = p_ad;
  perform private.restore(prev);
  if not found then raise exception using errcode = 'P0404', message = 'ad_not_found'; end if;
  perform private.audit('ad_promote', 'ad', p_ad::text, jsonb_build_object('kind', p_kind, 'days', p_days));
end $$;

create or replace function public.admin_set_ban(p_user uuid, p_banned boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_perm('users'); target record; prev text;
begin
  select * into target from public.profiles where id = p_user for update;
  if target.id is null then raise exception using errcode = 'P0404', message = 'user_not_found'; end if;
  if target.role <> 'user' and public.current_role_level() <> 'owner' then
    raise exception using errcode = 'P0403', message = 'cannot_ban_staff';
  end if;
  if target.role = 'owner' or p_user = me then raise exception using errcode = 'P0403', message = 'forbidden'; end if;
  if p_banned and nullif(btrim(p_reason), '') is null then raise exception using errcode = 'P0422', message = 'reason_required'; end if;
  prev := private.elevate();
  if p_banned then
    update public.profiles set is_banned = true where id = p_user;
    insert into public.user_bans (user_id, reason, banned_by) values (p_user, p_reason, me);
    update public.ads set status = 'hidden', reject_reason = '__banned__' where user_id = p_user and status in ('active', 'pending');
    delete from public.push_tokens where user_id = p_user;
    if to_regclass('auth.sessions') is not null then
      execute 'delete from auth.sessions where user_id = $1' using p_user;
    end if;
  else
    update public.profiles set is_banned = false where id = p_user;
    update public.user_bans set lifted_at = now(), lifted_by = me where user_id = p_user and lifted_at is null;
    update public.ads set status = case when expires_at > now() then 'active'::public.ad_status else 'expired'::public.ad_status end,
      reject_reason = null where user_id = p_user and status = 'hidden' and reject_reason = '__banned__';
  end if;
  perform private.restore(prev);
  perform private.audit(case when p_banned then 'user_ban' else 'user_unban' end, 'user', p_user::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.user_role, p_permissions text[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); my_level public.user_role := public.current_role_level(); target record; prev text;
begin
  if my_level not in ('admin', 'owner') then raise exception using errcode = 'P0403', message = 'forbidden'; end if;
  select * into target from public.profiles where id = p_user for update;
  if target.id is null then raise exception using errcode = 'P0404', message = 'user_not_found'; end if;
  if p_role = 'owner' or target.role = 'owner' or p_user = me then raise exception using errcode = 'P0403', message = 'forbidden'; end if;
  if (p_role = 'admin' or target.role = 'admin') and my_level <> 'owner' then
    raise exception using errcode = 'P0403', message = 'owner_only';
  end if;
  prev := private.elevate();
  update public.profiles set role = p_role where id = p_user;
  perform private.restore(prev);
  delete from public.staff_permissions where user_id = p_user;
  if p_role = 'moderator' then
    insert into public.staff_permissions (user_id, permission, granted_by)
    select p_user, x, me from unnest(p_permissions) x
    where x in ('ads', 'reports', 'users', 'categories', 'locations', 'commerce', 'banners', 'notifications', 'pages', 'support', 'settings', 'revenue', 'audit')
    on conflict do nothing;
  end if;
  perform private.audit('user_role', 'user', p_user::text, jsonb_build_object('from', target.role, 'to', p_role, 'permissions', p_permissions));
end $$;

create or replace function public.admin_list_users(p_q text default '', p_filter text default 'all', p_limit int default 30, p_offset int default 0)
returns table (id uuid, full_name text, email text, phone text, role public.user_role, is_banned boolean, is_merchant boolean,
               active_ads_count int, created_at timestamptz, last_seen_at timestamptz, permissions text[], total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare n text := public.normalize_ar(p_q);
begin
  perform private.require_perm('users');
  return query
  select p.id, p.full_name, u.email::text, s.phone, p.role, p.is_banned, p.is_merchant, p.active_ads_count, p.created_at, s.last_seen_at,
         array(select sp.permission from public.staff_permissions sp where sp.user_id = p.id),
         count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.profile_settings s on s.user_id = p.id
  where (n = '' or public.normalize_ar(p.full_name) like '%' || n || '%' or lower(u.email) like '%' || lower(btrim(p_q)) || '%'
         or s.phone like '%' || btrim(p_q) || '%' or p.id::text = btrim(p_q))
    and (p_filter = 'all' or (p_filter = 'banned' and p.is_banned) or (p_filter = 'staff' and p.role <> 'user')
         or (p_filter = 'merchants' and p.is_merchant) or (p_filter = 'new' and p.created_at > now() - interval '7 days'))
  order by p.created_at desc
  limit least(p_limit, 100) offset greatest(p_offset, 0);
end $$;

create or replace function public.admin_resolve_report(p_report bigint, p_status public.report_status, p_note text default null, p_action text default 'none')
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_perm('reports'); r record;
begin
  select * into r from public.reports where id = p_report for update;
  if r.id is null then raise exception using errcode = 'P0404', message = 'not_found'; end if;
  update public.reports set status = p_status, resolution_note = p_note, handled_by = me, handled_at = now()
  where (id = p_report) or (p_status = 'resolved' and target_type = r.target_type and target_id = r.target_id and status = 'open');
  if p_action = 'hide_ad' and r.target_type = 'ad' then
    perform public.admin_set_ad_status(r.target_id::bigint, 'rejected', coalesce(p_note, 'مخالف لإرشادات المجتمع'));
  elsif p_action = 'ban_user' and r.target_user_id is not null then
    perform public.admin_set_ban(r.target_user_id, true, coalesce(p_note, 'report #' || r.id));
  end if;
  perform private.audit('report_' || p_status, 'report', p_report::text, jsonb_build_object('action', p_action, 'note', p_note));
end $$;

-- Staff can read a conversation ONLY through a report that references it.
create or replace function public.admin_report_messages(p_report bigint)
returns table (id bigint, sender_id uuid, sender_name text, body text, image_path text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare r record; conv uuid;
begin
  perform private.require_perm('reports');
  select * into r from public.reports where reports.id = p_report;
  if r.target_type = 'conversation' then conv := r.target_id::uuid;
  elsif r.target_type = 'message' then select m.conversation_id into conv from public.messages m where m.id = r.target_id::bigint;
  else return; end if;
  return query select m.id, m.sender_id, p.full_name, m.body, m.image_path, m.created_at
    from public.messages m join public.profiles p on p.id = m.sender_id
    where m.conversation_id = conv order by m.created_at desc limit 200;
end $$;

create or replace function public.admin_broadcast(p_audience text, p_title_ar text, p_title_en text, p_body_ar text, p_body_en text, p_link text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare me uuid := private.require_perm('notifications'); n int;
begin
  perform private.enforce_rate_limit('broadcast:' || me, 10, 3600, 'broadcast_limit');
  insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
  select p.id, 'general', p_title_ar, p_title_en, p_body_ar, p_body_en, jsonb_build_object('link', p_link)
  from public.profiles p join public.profile_settings s on s.user_id = p.id
  where not p.is_banned and coalesce((s.notification_prefs ->> 'general')::boolean, true)
    and case p_audience
      when 'all' then true
      when 'merchants' then p.is_merchant
      when 'new_users' then p.created_at > now() - interval '30 days'
      when 'active_sellers' then p.active_ads_count > 0
      when 'inactive' then coalesce(s.last_seen_at, p.created_at) < now() - interval '30 days'
      else false end;
  get diagnostics n = row_count;
  insert into public.broadcasts (audience, title_ar, title_en, body_ar, body_en, link, recipients, sent_by)
  values (p_audience, p_title_ar, p_title_en, p_body_ar, p_body_en, p_link, n, me);
  perform private.audit('broadcast', 'broadcast', p_audience, jsonb_build_object('recipients', n, 'title', p_title_ar));
  return n;
end $$;

-- Manual sale recorded by staff (e.g. a merchant package sold by the sales team).
create or replace function public.admin_grant_package(p_user uuid, p_package int, p_ad bigint default null, p_amount numeric default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare oid uuid; pk record;
begin
  perform private.require_perm('commerce');
  select * into pk from public.packages where id = p_package;
  if pk.id is null then raise exception using errcode = 'P0404', message = 'package_not_found'; end if;
  insert into public.orders (user_id, package_id, ad_id, base_kwd, amount_kwd, provider, provider_ref)
  values (p_user, p_package, p_ad, pk.price_kwd, coalesce(p_amount, pk.price_kwd), 'manual', p_note)
  returning id into oid;
  perform private.apply_order(oid, 'manual', p_note);
  perform private.audit('grant_package', 'order', oid::text, jsonb_build_object('user', p_user, 'package', p_package, 'ad', p_ad, 'amount', p_amount));
  return oid;
end $$;

create or replace function public.admin_revenue()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_perm('revenue');
  return jsonb_build_object(
    'total_kwd', (select coalesce(sum(amount_kwd), 0) from public.orders where status = 'paid'),
    'by_month', (select coalesce(jsonb_agg(x order by x.month desc), '[]') from (
      select to_char(date_trunc('month', paid_at), 'YYYY-MM') as month, sum(amount_kwd) as kwd, count(*) as orders
      from public.orders where status = 'paid' group by 1 limit 24) x),
    'by_kind', (select coalesce(jsonb_agg(x), '[]') from (
      select pk.kind, sum(o.amount_kwd) as kwd, count(*) as orders from public.orders o
      join public.packages pk on pk.id = o.package_id where o.status = 'paid' group by pk.kind) x),
    'recent', (select coalesce(jsonb_agg(x), '[]') from (
      select o.id, o.amount_kwd, o.status, o.provider, o.created_at, o.paid_at, p.full_name, pk.name_ar as package
      from public.orders o join public.profiles p on p.id = o.user_id join public.packages pk on pk.id = o.package_id
      order by o.created_at desc limit 50) x));
end $$;

-- ═════════════════════ SAVED-SEARCH MATCHING & EXPIRY ═══════════════════

create or replace function private.match_saved_searches(p_ad bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  select * into a from public.ads where id = p_ad and status = 'active';
  if a.id is null then return; end if;
  insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
  select s.user_id, 'saved_search', 'إعلان جديد يطابق بحثك: ' || s.name, 'New match for: ' || s.name, a.title, a.title,
         jsonb_build_object('ad_id', a.id, 'saved_search_id', s.id)
  from public.saved_searches s
  join public.profile_settings ps on ps.user_id = s.user_id
  where s.notify and s.user_id <> a.user_id
    and coalesce((ps.notification_prefs ->> 'saved_searches')::boolean, true)
    and (s.last_match_at is null or s.last_match_at < now() - interval '10 minutes')
    and (s.filters ->> 'category_id' is null or (s.filters ->> 'category_id')::int in (a.category_id, a.main_category_id))
    and (s.filters ->> 'governorate_id' is null or (s.filters ->> 'governorate_id')::int = a.governorate_id)
    and (s.filters ->> 'area_id' is null or (s.filters ->> 'area_id')::int = a.area_id)
    and (s.filters ->> 'condition' is null or s.filters ->> 'condition' = a.condition::text)
    and (s.filters ->> 'min_price' is null or a.price >= (s.filters ->> 'min_price')::numeric)
    and (s.filters ->> 'max_price' is null or a.price <= (s.filters ->> 'max_price')::numeric)
    and (s.query_norm = '' or (select bool_and(a.search_text like '%' || t || '%') from unnest(string_to_array(s.query_norm, ' ')) t where t <> ''))
    and not public.is_blocked_between(s.user_id, a.user_id)
  limit 500;
  update public.saved_searches s set last_match_at = now()
  where s.id in (select (n.data ->> 'saved_search_id')::bigint from public.notifications n
                 where n.type = 'saved_search' and n.data ->> 'ad_id' = a.id::text);
end $$;

create or replace function private.ads_after_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active')
     and (tg_op = 'INSERT' or old.status = 'pending') then
    perform private.match_saved_searches(new.id);
  end if;
  return null;
end $$;
create trigger ads_after_status after insert or update of status on public.ads
  for each row execute function private.ads_after_status();

create or replace function private.expire_ads()
returns int language plpgsql security definer set search_path = '' as $$
declare n int; prev text := private.elevate();
begin
  with expired as (
    update public.ads set status = 'expired' where status = 'active' and expires_at < now() returning id, user_id, title
  )
  insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
  select user_id, 'ad_expired', 'انتهت مدة إعلانك', 'Your ad expired', title || ' — جدّده بضغطة واحدة', title || ' — renew it in one tap',
         jsonb_build_object('ad_id', id) from expired;
  get diagnostics n = row_count;
  insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
  select a.user_id, 'ad_expiring', 'إعلانك ينتهي قريباً', 'Your ad expires soon', a.title, a.title, jsonb_build_object('ad_id', a.id)
  from public.ads a
  where a.status = 'active' and a.expires_at between now() and now() + interval '3 days'
    and not exists (select 1 from public.notifications x where x.type = 'ad_expiring' and x.data ->> 'ad_id' = a.id::text
                    and x.created_at > a.expires_at - interval '10 days');
  perform private.restore(prev);
  return n;
end $$;

create or replace function private.housekeeping()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from private.rate_limits where window_start < now() - interval '2 days';
  delete from public.notifications where created_at < now() - interval '120 days';
  update public.search_terms set hits = greatest(hits / 2, 1) where last_at < now() - interval '30 days' and hits > 1;
  delete from public.search_terms where last_at < now() - interval '180 days' and hits <= 1;
end $$;

