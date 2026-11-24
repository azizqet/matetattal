-- ماتعطل v5 — سوق الإعلانات المبوبة
-- كل التغييرات إضافية: لا تحذف ولا تعدّل أي جدول من النسخة السابقة (v4) حتى يبقى الموقع الحالي يعمل حتى النشر.

/* ---------- الحسابات: الحظر ---------- */
alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_reason text,
  add column if not exists banned_at timestamptz;

create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_banned from public.profiles p where p.id = auth.uid()), false)
$$;

/* ---------- المناطق ---------- */
create table if not exists public.kw_areas (
  id serial primary key,
  gov text not null check (gov in ('capital','hawalli','farwaniya','jahra','ahmadi','mubarak')),
  name_ar text not null check (char_length(name_ar) between 2 and 60),
  name_en text not null check (char_length(name_en) between 2 and 60),
  sort int not null default 100,
  is_active boolean not null default true,
  unique (name_ar)
);
alter table public.kw_areas enable row level security;
drop policy if exists "kw_areas read" on public.kw_areas;
create policy "kw_areas read" on public.kw_areas for select using (true);
drop policy if exists "kw_areas admin" on public.kw_areas;
create policy "kw_areas admin" on public.kw_areas for all using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.kw_areas (gov, name_ar, name_en, sort) values
('capital','مدينة الكويت','Kuwait City',1),('capital','الشرق','Sharq',2),('capital','الدسمة','Dasma',3),('capital','الدعية','Daiya',4),('capital','الشامية','Shamiya',5),('capital','كيفان','Kaifan',6),('capital','الخالدية','Khaldiya',7),('capital','العديلية','Adailiya',8),('capital','الفيحاء','Faiha',9),('capital','النزهة','Nuzha',10),('capital','الروضة','Rawda',11),('capital','القادسية','Qadsiya',12),('capital','اليرموك','Yarmouk',13),('capital','السرة','Surra',14),('capital','قرطبة','Qurtuba',15),('capital','الصليبيخات','Sulaibikhat',16),('capital','الدوحة','Doha',17),('capital','غرناطة','Granada',18),('capital','الشويخ','Shuwaikh',19),('capital','بنيد القار','Bneid Al-Gar',20),
('hawalli','حولي','Hawalli',1),('hawalli','السالمية','Salmiya',2),('hawalli','الجابرية','Jabriya',3),('hawalli','الرميثية','Rumaithiya',4),('hawalli','سلوى','Salwa',5),('hawalli','مشرف','Mishref',6),('hawalli','بيان','Bayan',7),('hawalli','الشعب','Shaab',8),('hawalli','الزهراء','Zahra',9),('hawalli','حطين','Hitteen',10),('hawalli','الصديق','Siddiq',11),('hawalli','السلام','Salam',12),('hawalli','الشهداء','Shuhada',13),('hawalli','البدع','Bidaa',14),('hawalli','ميدان حولي','Maidan Hawalli',15),
('farwaniya','الفروانية','Farwaniya',1),('farwaniya','خيطان','Khaitan',2),('farwaniya','جليب الشيوخ','Jleeb Al-Shuyoukh',3),('farwaniya','العارضية','Ardiya',4),('farwaniya','الرابية','Rabiya',5),('farwaniya','الأندلس','Andalous',6),('farwaniya','الرقعي','Riggae',7),('farwaniya','العمرية','Omariya',8),('farwaniya','الرحاب','Rehab',9),('farwaniya','الضجيج','Dhajeej',10),('farwaniya','صباح الناصر','Sabah Al-Nasser',11),('farwaniya','عبدالله المبارك','Abdullah Al-Mubarak',12),('farwaniya','الفردوس','Firdous',13),('farwaniya','اشبيلية','Ishbiliya',14),
('jahra','الجهراء','Jahra',1),('jahra','سعد العبدالله','Saad Al-Abdullah',2),('jahra','القصر','Qasr',3),('jahra','النسيم','Naseem',4),('jahra','العيون','Oyoun',5),('jahra','الواحة','Waha',6),('jahra','تيماء','Taima',7),('jahra','الصليبية','Sulaibiya',8),('jahra','كبد','Kabd',9),('jahra','العبدلي','Abdali',10),('jahra','المطلاع','Mutlaa',11),
('ahmadi','الأحمدي','Ahmadi',1),('ahmadi','الفحيحيل','Fahaheel',2),('ahmadi','المنقف','Mangaf',3),('ahmadi','الفنطاس','Fintas',4),('ahmadi','أبو حليفة','Abu Halifa',5),('ahmadi','المهبولة','Mahboula',6),('ahmadi','الصباحية','Sabahiya',7),('ahmadi','الرقة','Riqqa',8),('ahmadi','هدية','Hadiya',9),('ahmadi','العقيلة','Egaila',10),('ahmadi','الظهر','Dhaher',11),('ahmadi','جابر العلي','Jaber Al-Ali',12),('ahmadi','الوفرة','Wafra',13),('ahmadi','الخيران','Khairan',14),('ahmadi','صباح الأحمد','Sabah Al-Ahmad',15),('ahmadi','الزور','Zour',16),('ahmadi','علي صباح السالم','Ali Sabah Al-Salem',17),
('mubarak','مبارك الكبير','Mubarak Al-Kabeer',1),('mubarak','صباح السالم','Sabah Al-Salem',2),('mubarak','القرين','Qurain',3),('mubarak','العدان','Adan',4),('mubarak','القصور','Qusour',5),('mubarak','المسيلة','Messila',6),('mubarak','أبو فطيرة','Abu Fatira',7),('mubarak','الفنيطيس','Funaitees',8),('mubarak','المسايل','Masayel',9),('mubarak','أبو الحصانية','Abu Al-Hasaniya',10)
on conflict (name_ar) do nothing;

/* ---------- الأقسام والخانات ---------- */
create table if not exists public.market_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,30}$'),
  name_ar text not null check (char_length(name_ar) between 2 and 40),
  name_en text not null check (char_length(name_en) between 2 and 40),
  icon text not null default 'misc' check (char_length(icon) <= 30),
  sort int not null default 100,
  is_active boolean not null default true,
  price_label text not null default 'price' check (price_label in ('price','salary','rent')),
  fields jsonb not null default '[]' check (jsonb_typeof(fields) = 'array' and pg_column_size(fields) < 16000),
  created_at timestamptz not null default now()
);
alter table public.market_categories enable row level security;
drop policy if exists "categories read" on public.market_categories;
create policy "categories read" on public.market_categories for select using (is_active or (select public.is_staff()));
drop policy if exists "categories admin" on public.market_categories;
create policy "categories admin" on public.market_categories for all using ((select public.is_admin())) with check ((select public.is_admin()));

/* ---------- الإعلانات ---------- */
create table if not exists public.market_ads (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id text not null references public.market_categories(id) on update cascade,
  area_id int not null references public.kw_areas(id),
  title text not null check (char_length(title) between 3 and 90),
  description text check (char_length(description) <= 3000),
  price numeric(12,3) check (price >= 0 and price < 100000000),
  price_type text not null default 'fixed' check (price_type in ('fixed','negotiable','free','ask')),
  specs jsonb not null default '{}' check (jsonb_typeof(specs) = 'object' and pg_column_size(specs) < 4000),
  images text[] not null default '{}' check (cardinality(images) <= 10),
  phone text not null check (phone ~ '^[2569][0-9]{7}$'),
  show_whatsapp boolean not null default true,
  status text not null default 'active' check (status in ('pending','active','sold','hidden','removed')),
  removed_reason text check (char_length(removed_reason) <= 300),
  featured_until timestamptz,
  views int not null default 0,
  calls int not null default 0,
  wa_taps int not null default 0,
  reports_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  bumped_at timestamptz not null default now()
);
create index if not exists market_ads_feed on public.market_ads (status, bumped_at desc);
create index if not exists market_ads_cat on public.market_ads (category_id, status, bumped_at desc);
create index if not exists market_ads_user on public.market_ads (user_id, created_at desc);
create index if not exists market_ads_area on public.market_ads (area_id);
create index if not exists market_ads_featured on public.market_ads (featured_until) where featured_until is not null;
alter table public.market_ads enable row level security;

drop policy if exists "ads public read" on public.market_ads;
create policy "ads public read" on public.market_ads for select
  using (status in ('active','sold') or user_id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists "ads owner insert" on public.market_ads;
create policy "ads owner insert" on public.market_ads for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_banned()));
drop policy if exists "ads owner update" on public.market_ads;
create policy "ads owner update" on public.market_ads for update to authenticated
  using ((user_id = (select auth.uid()) and not (select public.is_banned())) or (select public.is_staff()))
  with check ((user_id = (select auth.uid()) and not (select public.is_banned())) or (select public.is_staff()));
drop policy if exists "ads owner delete" on public.market_ads;
create policy "ads owner delete" on public.market_ads for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

-- صلاحيات الأعمدة: المستخدم لا يقدر يعدّل العدادات أو الرقم أو التمييز أو المالك
revoke all on public.market_ads from anon, authenticated;
grant select on public.market_ads to anon, authenticated;
grant insert (user_id, category_id, area_id, title, description, price, price_type, specs, images, show_whatsapp) on public.market_ads to authenticated;
grant update (category_id, area_id, title, description, price, price_type, specs, images, show_whatsapp, status) on public.market_ads to authenticated;
grant delete on public.market_ads to authenticated;

create or replace function private.market_setting(p_key text, p_default jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.value -> p_key from public.app_settings s where s.key = 'market'), p_default)
$$;

create or replace function public.guard_market_ad() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_staff boolean := public.is_staff(); v_email text; v_img text; v_max int;
begin
  if tg_op = 'INSERT' or (new.title, new.description, new.price, new.price_type, new.specs, new.images, new.category_id, new.area_id)
       is distinct from (old.title, old.description, old.price, old.price_type, old.specs, old.images, old.category_id, old.area_id) then
    -- تنظيف النصوص
    new.title := btrim(regexp_replace(new.title, '[[:cntrl:]]+', ' ', 'g'));
    new.description := nullif(btrim(regexp_replace(coalesce(new.description, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]+', '', 'g')), '');
    if char_length(new.title) < 3 then raise exception 'title too short'; end if;
    if new.price_type in ('free','ask') then new.price := null; end if;
    if new.price_type in ('fixed','negotiable') and new.price is null then raise exception 'price required'; end if;
    if (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
       and not exists (select 1 from public.market_categories c where c.id = new.category_id and (c.is_active or v_staff)) then raise exception 'invalid category'; end if;
    if (tg_op = 'INSERT' or new.area_id is distinct from old.area_id)
       and not exists (select 1 from public.kw_areas a where a.id = new.area_id and a.is_active) then raise exception 'invalid area'; end if;
    -- الصور لازم تكون من مجلد صاحب الإعلان داخل bucket market
    foreach v_img in array coalesce(new.images, '{}') loop
      if v_img !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/market/' || coalesce(case when tg_op = 'INSERT' then v_uid else old.user_id end::text, 'x') || '/[A-Za-z0-9._-]+$') then
        raise exception 'invalid image url'; end if;
    end loop;
    -- الخانات: قيم نصية/رقمية قصيرة فقط
    if exists (select 1 from jsonb_each(new.specs) e where jsonb_typeof(e.value) not in ('string','number') or char_length(e.value #>> '{}') > 80 or char_length(e.key) > 30) then
      raise exception 'invalid specs'; end if;
    if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  elsif tg_op = 'UPDATE' then
    new.updated_at := old.updated_at;
  end if;

  if tg_op = 'INSERT' then
    if v_uid is null then raise exception 'login required'; end if;
    if public.is_banned() then raise exception 'account banned'; end if;
    new.user_id := v_uid;
    select u.email into v_email from auth.users u where u.id = v_uid;
    new.phone := coalesce(substring(v_email from '^965([569][0-9]{7})@users\.matattal\.invalid$'),
                          (select p.phone from public.profiles p where p.id = v_uid and p.phone ~ '^[569][0-9]{7}$'));
    if new.phone is null then raise exception 'phone required'; end if;
    v_max := coalesce((private.market_setting('max_ads_per_day', '15'::jsonb) #>> '{}')::int, 15);
    if not v_staff and (select count(*) from public.market_ads a where a.user_id = v_uid and a.created_at > now() - interval '24 hours') >= v_max then
      raise exception 'daily limit'; end if;
    new.status := case when coalesce((private.market_setting('require_approval', 'false'::jsonb))::text, 'false') = 'true' and not v_staff then 'pending' else 'active' end;
    new.featured_until := null; new.removed_reason := null;
    new.views := 0; new.calls := 0; new.wa_taps := 0; new.reports_count := 0;
    new.created_at := now(); new.updated_at := now(); new.bumped_at := now();
    perform public.bump_stat('m_post');
    return new;
  end if;

  -- UPDATE
  if not v_staff then
    if old.status in ('pending','removed') and new.status <> old.status then raise exception 'status locked'; end if;
    if new.status not in ('active','sold','hidden') and new.status <> old.status then raise exception 'invalid status'; end if;
  end if;
  if new.status = 'sold' and old.status <> 'sold' then perform public.bump_stat('m_sold'); end if;
  if new.status is distinct from old.status then new.updated_at := now(); end if;
  return new;
end $$;
drop trigger if exists guard_market_ad on public.market_ads;
create trigger guard_market_ad before insert or update on public.market_ads for each row execute function public.guard_market_ad();

/* ---------- المفضلة ---------- */
create table if not exists public.market_favorites (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  ad_id bigint not null references public.market_ads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, ad_id)
);
create index if not exists market_favorites_ad on public.market_favorites (ad_id);
alter table public.market_favorites enable row level security;
drop policy if exists "fav own" on public.market_favorites;
create policy "fav own" on public.market_favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.market_favorites from anon;
grant select, insert, delete on public.market_favorites to authenticated;

/* ---------- البلاغات ---------- */
create table if not exists public.market_reports (
  id bigint generated always as identity primary key,
  ad_id bigint not null references public.market_ads(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  ip_hash text,
  reason text not null check (reason in ('spam','fraud','prohibited','wrong_category','duplicate','sold','offensive','other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists market_reports_status on public.market_reports (status, created_at desc);
create index if not exists market_reports_ad on public.market_reports (ad_id);
create index if not exists market_reports_reporter on public.market_reports (reporter_id);
create index if not exists market_reports_resolver on public.market_reports (resolved_by);
alter table public.market_reports enable row level security;
drop policy if exists "reports staff read" on public.market_reports;
create policy "reports staff read" on public.market_reports for select to authenticated using ((select public.is_staff()));
revoke all on public.market_reports from anon, authenticated;
grant select on public.market_reports to authenticated;

create or replace function public.report_market_ad(p_id bigint, p_reason text, p_details text default null) returns json
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_ip text := private.client_ip_hash(); v_n int; v_lim int;
begin
  if p_reason not in ('spam','fraud','prohibited','wrong_category','duplicate','sold','offensive','other') then raise exception 'invalid reason'; end if;
  if not exists (select 1 from public.market_ads a where a.id = p_id and a.status in ('active','sold')) then raise exception 'not found'; end if;
  if v_uid is not null and exists (select 1 from public.market_ads a where a.id = p_id and a.user_id = v_uid) then raise exception 'cannot report own'; end if;
  if (select count(*) from public.market_reports r where r.created_at > now() - interval '1 hour'
        and ((v_uid is not null and r.reporter_id = v_uid) or (v_ip is not null and r.ip_hash = v_ip))) >= 10 then
    raise exception 'rate limit'; end if;
  if exists (select 1 from public.market_reports r where r.ad_id = p_id and r.status = 'open'
        and ((v_uid is not null and r.reporter_id = v_uid) or (v_ip is not null and r.ip_hash = v_ip))) then
    return json_build_object('ok', true, 'duplicate', true); end if;
  insert into public.market_reports(ad_id, reporter_id, ip_hash, reason, details)
  values (p_id, v_uid, v_ip, p_reason, nullif(left(btrim(coalesce(p_details, '')), 500), ''));
  update public.market_ads set reports_count = reports_count + 1 where id = p_id returning reports_count into v_n;
  v_lim := coalesce((private.market_setting('auto_hide_reports', '5'::jsonb) #>> '{}')::int, 5);
  if v_lim > 0 and v_n >= v_lim then
    update public.market_ads set status = 'pending', removed_reason = 'auto: reports' where id = p_id and status = 'active';
  end if;
  perform public.bump_stat('m_report');
  return json_build_object('ok', true);
end $$;

/* ---------- العدادات ---------- */
create or replace function public.track_market(p_kind text, p_ad bigint default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('m_visit','m_search','ad_view','ad_call','ad_whatsapp') then return; end if;
  if p_ad is not null and not exists (select 1 from public.market_ads a where a.id = p_ad and a.status in ('active','sold')) then return; end if;
  if p_kind <> 'm_search' and not private.first_today(p_kind, p_ad) then return; end if;
  perform public.bump_stat(p_kind);
  if p_ad is not null then
    update public.market_ads set
      views = views + (p_kind = 'ad_view')::int,
      calls = calls + (p_kind = 'ad_call')::int,
      wa_taps = wa_taps + (p_kind = 'ad_whatsapp')::int
    where id = p_ad;
  end if;
end $$;

/* ---------- رفع الإعلان (مرة كل 24 ساعة) ---------- */
create or replace function public.bump_market_ad(p_id bigint) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_at timestamptz;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if public.is_banned() then raise exception 'account banned'; end if;
  select bumped_at into v_at from public.market_ads where id = p_id and user_id = auth.uid() and status = 'active';
  if v_at is null then raise exception 'not found'; end if;
  if v_at > now() - interval '24 hours' then raise exception 'bump too soon'; end if;
  update public.market_ads set bumped_at = now() where id = p_id;
  return now();
end $$;

/* ---------- الإدارة ---------- */
create or replace function public.admin_set_ad_status(p_id bigint, p_status text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.market_ads;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_status not in ('pending','active','sold','hidden','removed') then raise exception 'invalid status'; end if;
  update public.market_ads set status = p_status,
         removed_reason = case when p_status in ('removed','hidden','pending') then nullif(left(btrim(coalesce(p_reason, '')), 300), '') else null end,
         reports_count = case when p_status = 'active' then 0 else reports_count end
   where id = p_id returning * into a;
  if a.id is null then raise exception 'not found'; end if;
  if p_status = 'active' then
    update public.market_reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now() where ad_id = p_id and status = 'open';
  elsif p_status = 'removed' then
    update public.market_reports set status = 'resolved', resolved_by = auth.uid(), resolved_at = now() where ad_id = p_id and status = 'open';
    perform public.notify(a.user_id, 'تم إيقاف إعلانك', 'إعلان «' || a.title || '» أوقفته الإدارة' || coalesce(': ' || nullif(btrim(p_reason), ''), '.'), jsonb_build_object('ad', a.id));
  end if;
end $$;

create or replace function public.admin_delete_ad(p_id bigint) returns text[]
language plpgsql security definer set search_path = '' as $$
declare v_imgs text[];
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  delete from public.market_ads where id = p_id returning images into v_imgs;
  return coalesce(v_imgs, '{}');
end $$;

create or replace function public.admin_feature_ad(p_id bigint, p_days int) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_days < 0 or p_days > 365 then raise exception 'invalid days'; end if;
  update public.market_ads set featured_until = case when p_days = 0 then null else greatest(coalesce(featured_until, now()), now()) + make_interval(days => p_days) end
   where id = p_id returning featured_until into v;
  if not found then raise exception 'not found'; end if;
  return v;
end $$;

create or replace function public.admin_resolve_report(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_status not in ('open','resolved','dismissed') then raise exception 'invalid status'; end if;
  update public.market_reports set status = p_status,
    resolved_by = case when p_status = 'open' then null else auth.uid() end,
    resolved_at = case when p_status = 'open' then null else now() end
  where id = p_id;
end $$;

create or replace function public.admin_ban_user(p_user uuid, p_banned boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user = auth.uid() then raise exception 'cannot ban yourself'; end if;
  if exists (select 1 from public.app_settings s where (s.key='owner_user_id' and s.value #>> '{}' = p_user::text)
             or (s.key='co_owner_user_ids' and jsonb_typeof(s.value)='array' and s.value ? p_user::text)) then
    raise exception 'owner account is protected'; end if;
  select role into v_role from public.profiles where id = p_user;
  if v_role is null then raise exception 'not found'; end if;
  if v_role in ('admin','staff') and not public.is_owner() then raise exception 'only the owner can ban staff'; end if;
  if p_banned then
    update public.profiles set is_banned = true, banned_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), ''), banned_at = now() where id = p_user;
    update public.market_ads set status = 'removed', removed_reason = 'banned' where user_id = p_user and status in ('active','sold','pending','hidden');
    delete from auth.refresh_tokens where user_id = p_user::text;
    delete from auth.sessions where user_id = p_user;
  else
    update public.profiles set is_banned = false, banned_reason = null, banned_at = null where id = p_user;
    update public.market_ads set status = 'active', removed_reason = null where user_id = p_user and status = 'removed' and removed_reason = 'banned';
  end if;
end $$;

create or replace function public.admin_list_users(p_q text default null, p_filter text default 'all', p_limit int default 50, p_offset int default 0)
returns table(id uuid, full_name text, phone text, role text, is_banned boolean, banned_reason text, created_at timestamptz, last_sign_in_at timestamptz, ads_total bigint, ads_active bigint, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := nullif(btrim(coalesce(p_q, '')), ''); v_d text;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  v_d := regexp_replace(translate(coalesce(v_q, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
  return query
  with base as (
    select p.id, p.full_name, coalesce(p.phone, substring(u.email from '^965([0-9]{8})@')) as phone, p.role, p.is_banned, p.banned_reason, p.created_at, u.last_sign_in_at
    from public.profiles p left join auth.users u on u.id = p.id
    where (v_q is null or p.full_name ilike '%' || v_q || '%' or (v_d <> '' and (coalesce(p.phone, '') like '%' || v_d || '%' or u.email like '%' || v_d || '%')))
      and (p_filter = 'all' or (p_filter = 'banned' and p.is_banned) or (p_filter = 'staff' and p.role in ('admin','staff')))
  )
  select b.id, b.full_name, b.phone, b.role, b.is_banned, b.banned_reason, b.created_at, b.last_sign_in_at,
         (select count(*) from public.market_ads a where a.user_id = b.id),
         (select count(*) from public.market_ads a where a.user_id = b.id and a.status = 'active'),
         count(*) over ()
  from base b order by b.created_at desc limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

create or replace function public.admin_market_stats() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return json_build_object(
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'users_banned', (select count(*) from public.profiles where is_banned),
    'ads_total', (select count(*) from public.market_ads),
    'ads_active', (select count(*) from public.market_ads where status = 'active'),
    'ads_sold', (select count(*) from public.market_ads where status = 'sold'),
    'ads_pending', (select count(*) from public.market_ads where status = 'pending'),
    'ads_removed', (select count(*) from public.market_ads where status in ('removed','hidden')),
    'ads_today', (select count(*) from public.market_ads where (created_at at time zone 'Asia/Kuwait')::date = (now() at time zone 'Asia/Kuwait')::date),
    'ads_7d', (select count(*) from public.market_ads where created_at > now() - interval '7 days'),
    'featured_now', (select count(*) from public.market_ads where featured_until > now()),
    'reports_open', (select count(*) from public.market_reports where status = 'open'),
    'views', (select coalesce(sum(views), 0) from public.market_ads),
    'calls', (select coalesce(sum(calls), 0) from public.market_ads),
    'wa_taps', (select coalesce(sum(wa_taps), 0) from public.market_ads),
    'by_category', (select coalesce(json_agg(x order by x.n desc), '[]') from (select c.id, c.name_ar, c.name_en, count(a.id) filter (where a.status = 'active') n, count(a.id) total from public.market_categories c left join public.market_ads a on a.category_id = c.id group by c.id, c.name_ar, c.name_en) x),
    'by_gov', (select coalesce(json_agg(x order by x.n desc), '[]') from (select ar.gov, count(*) n from public.market_ads a join public.kw_areas ar on ar.id = a.area_id where a.status = 'active' group by ar.gov) x),
    'daily', (select coalesce(json_agg(x order by x.day), '[]') from (
        select d::date as day,
          (select count(*) from public.market_ads a where (a.created_at at time zone 'Asia/Kuwait')::date = d::date) ads,
          (select count(*) from public.profiles p where (p.created_at at time zone 'Asia/Kuwait')::date = d::date) users,
          coalesce((select sum(s.count) from public.site_stats_daily s where s.day = d::date and s.metric = 'm_visit'), 0) visits,
          coalesce((select sum(s.count) from public.site_stats_daily s where s.day = d::date and s.metric in ('m_call','m_whatsapp')), 0) contacts
        from generate_series((now() at time zone 'Asia/Kuwait')::date - 13, (now() at time zone 'Asia/Kuwait')::date, interval '1 day') d) x)
  );
end $$;

/* ---------- صلاحيات الدوال ---------- */
revoke all on function public.is_banned() from public, anon;
grant execute on function public.is_banned() to authenticated;
revoke all on function private.market_setting(text, jsonb) from public, anon, authenticated;
revoke all on function public.guard_market_ad() from public, anon, authenticated;
revoke all on function public.report_market_ad(bigint, text, text) from public;
grant execute on function public.report_market_ad(bigint, text, text) to anon, authenticated;
revoke all on function public.track_market(text, bigint) from public;
grant execute on function public.track_market(text, bigint) to anon, authenticated;
revoke all on function public.bump_market_ad(bigint) from public, anon;
grant execute on function public.bump_market_ad(bigint) to authenticated;
do $$ declare f text; begin
  foreach f in array array['admin_set_ad_status(bigint,text,text)','admin_delete_ad(bigint)','admin_feature_ad(bigint,integer)','admin_resolve_report(bigint,text)','admin_ban_user(uuid,boolean,text)','admin_list_users(text,text,integer,integer)','admin_market_stats()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- الحقول الجديدة في profiles لا يعدّلها المستخدم
revoke update (is_banned, banned_reason, banned_at) on public.profiles from authenticated;
revoke insert (is_banned, banned_reason, banned_at) on public.profiles from authenticated;

/* ---------- تخزين الصور ---------- */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('market', 'market', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "market upload own folder" on storage.objects;
create policy "market upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'market' and (storage.foldername(name))[1] = (select auth.uid())::text and not (select public.is_banned()));
drop policy if exists "market read own or staff" on storage.objects;
create policy "market read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'market' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff())));
drop policy if exists "market delete own or staff" on storage.objects;
create policy "market delete own or staff" on storage.objects for delete to authenticated
  using (bucket_id = 'market' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff())));

/* ---------- الإعدادات ---------- */
insert into public.app_settings (key, value, is_public) values
  ('market', '{"require_approval": false, "max_ads_per_day": 15, "auto_hide_reports": 5, "max_images": 10}'::jsonb, true),
  ('paid_ads', '{"enabled": false, "featured_prices": {"3": 2, "7": 4, "14": 7, "30": 12}, "note_ar": "", "note_en": ""}'::jsonb, true)
on conflict (key) do nothing;

/* ---------- صلاحيات الجداول الجديدة (RLS يحدد الصفوف) ---------- */
grant select on public.kw_areas, public.market_categories to anon, authenticated;
grant insert, update, delete on public.kw_areas, public.market_categories to authenticated;
grant usage, select on sequence public.kw_areas_id_seq to authenticated;
