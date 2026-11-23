-- ماتعطل v3: تقوية الأمان + نظام اشتراكات جاهز لبوابة دفع + إعدادات قابلة للتعديل
-- كل التغييرات إضافية (لا حذف لبيانات أو جداول). النسخة الاحتياطية في المخطط backup_20261122.

-- 0) حماية جداول النسخة الاحتياطية (المخطط غير مكشوف أصلاً، وهذا دفاع إضافي)
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='backup_20261122' loop
    execute format('alter table backup_20261122.%I enable row level security', t.tablename);
  end loop; end $$;

-- 1) سحب صلاحيات غير لازمة من أدوار الـ API
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t.tablename);
  end loop; end $$;

-- دوال التريجر والدوال الداخلية لا يجب أن تُستدعى عبر /rpc
revoke execute on function public.apply_subscription() from public, anon, authenticated;
revoke execute on function public.guard_company_update() from public, anon, authenticated;
revoke execute on function public.guard_request() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.refresh_company_rating() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.notify(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
revoke execute on function public.admin_stats() from public, anon;

-- 2) فهارس للمفاتيح الأجنبية (أداء)
create index if not exists banners_company_idx on public.banners(company_id);
create index if not exists company_areas_area_idx on public.company_areas(area_id);
create index if not exists company_services_service_idx on public.company_services(service_id);
create index if not exists complaints_company_idx on public.complaints(company_id);
create index if not exists complaints_user_idx on public.complaints(user_id);
create index if not exists favorites_company_idx on public.favorites(company_id);
create index if not exists join_requests_service_idx on public.join_requests(service_id);
create index if not exists listing_reports_listing_idx on public.listing_reports(listing_id);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);
create index if not exists reviews_user_idx on public.reviews(user_id);
create index if not exists service_requests_service_idx on public.service_requests(service_id);
create index if not exists subscriptions_plan_idx on public.subscriptions(plan_id);
create index if not exists subscriptions_promotion_idx on public.subscriptions(promotion_id);
create index if not exists join_requests_phone_idx on public.join_requests(phone, created_at desc);

-- 3) حد معدل لطلبات الانضمام (منع الإغراق): 3 طلبات لكل رقم يومياً و 200 طلب عام بالساعة
create or replace function public.guard_join_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then return new; end if;
  new.status := 'new';
  if (select count(*) from public.join_requests where phone = new.phone and created_at > now() - interval '1 day') >= 3 then
    raise exception 'rate limit: too many requests for this phone';
  end if;
  if (select count(*) from public.join_requests where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'rate limit: try later';
  end if;
  if new.logo_url is not null and new.logo_url !~ '^https://xpnwhvbxordtsmnegvri\.supabase\.co/storage/v1/object/public/logos/pending/' then
    raise exception 'invalid logo url';
  end if;
  return new;
end $$;
revoke execute on function public.guard_join_request() from public, anon, authenticated;
drop trigger if exists guard_join_request on public.join_requests;
create trigger guard_join_request before insert on public.join_requests
  for each row execute function public.guard_join_request();

-- 4) المراجعات: لا يمكن نقل مراجعة لشركة أخرى أو لمستخدم آخر
create or replace function public.guard_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and not public.is_staff() then
    if new.company_id <> old.company_id or new.user_id <> old.user_id or new.created_at <> old.created_at then
      raise exception 'protected fields'; end if;
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.companies c where c.id = new.company_id and public.company_visible(c)) then
      raise exception 'company not available'; end if;
    if exists (select 1 from public.companies c where c.id = new.company_id and c.owner_id = new.user_id) then
      raise exception 'cannot review own company'; end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_review() from public, anon, authenticated;
drop trigger if exists guard_review on public.reviews;
create trigger guard_review before insert or update on public.reviews
  for each row execute function public.guard_review();

-- 5) عند إنشاء شركة: تحويل دور المستخدم من عميل إلى شركة
create or replace function public.promote_company_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null then
    update public.profiles set role = 'company' where id = new.owner_id and role = 'customer';
  end if;
  return null;
end $$;
revoke execute on function public.promote_company_owner() from public, anon, authenticated;
drop trigger if exists promote_company_owner on public.companies;
create trigger promote_company_owner after insert or update of owner_id on public.companies
  for each row execute function public.promote_company_owner();

-- 6) إعدادات التطبيق القابلة للتعديل من لوحة الإدارة
create table if not exists public.app_settings (
  key text primary key check (key ~ '^[a-z0-9_]{2,50}$'),
  value jsonb not null default 'null'::jsonb,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "read public settings" on public.app_settings;
create policy "read public settings" on public.app_settings for select using (is_public or (select public.is_admin()));
drop policy if exists "admin settings" on public.app_settings;
create policy "admin settings" on public.app_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_settings to authenticated;
insert into public.app_settings(key, value) values
  ('support_whatsapp', '"96565755222"'),
  ('payment_mode', '"manual"'),          -- manual | gateway
  ('payment_provider', '"none"'),        -- none | myfatoorah | tap | upayments | knet
  ('trial_days', '0'),
  ('maintenance_message', 'null')
on conflict (key) do nothing;

-- 7) جدول المدفوعات (جاهز لربط بوابة دفع كويتية مرخصة لاحقاً)
create table if not exists public.payments (
  id bigint generated always as identity primary key,
  subscription_id bigint not null references public.subscriptions(id),
  provider text not null default 'manual' check (provider in ('manual','myfatoorah','tap','upayments','knet','other')),
  provider_ref text,
  amount_kwd numeric(10,3) not null check (amount_kwd >= 0),
  currency text not null default 'KWD',
  status text not null default 'initiated' check (status in ('initiated','paid','failed','refunded','cancelled')),
  payment_url text,
  raw jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (provider, provider_ref)
);
create index if not exists payments_subscription_idx on public.payments(subscription_id);
create index if not exists payments_created_by_idx on public.payments(created_by);
alter table public.payments enable row level security;
drop policy if exists "admin payments" on public.payments;
create policy "admin payments" on public.payments for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "owner reads payments" on public.payments;
create policy "owner reads payments" on public.payments for select to authenticated using (
  exists (select 1 from public.subscriptions s join public.companies c on c.id = s.company_id
          where s.id = payments.subscription_id and c.owner_id = (select auth.uid())));
grant select on public.payments to authenticated;
grant insert, update on public.payments to authenticated;

-- 8) الشركة تطلب اشتراكاً (يُنشأ معلّقاً بالمبلغ المحسوب من الخطة + كود الخصم)
create or replace function public.request_subscription(p_company bigint, p_plan text, p_code text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare q json; c public.companies; v_start date; v_id bigint; v_months int;
begin
  select * into c from public.companies where id = p_company;
  if not found or (c.owner_id is distinct from auth.uid() and not public.is_admin()) then raise exception 'forbidden'; end if;
  q := public.quote_subscription(p_plan, p_code);
  v_months := (q->>'months')::int;
  v_start := greatest(current_date, coalesce(c.sub_end + 1, current_date));
  update public.subscriptions set status = 'cancelled', payment_note = coalesce(payment_note,'') || ' [استبدل بطلب أحدث]'
    where company_id = p_company and status = 'pending';
  insert into public.subscriptions(company_id, plan_id, promotion_id, amount_kwd, starts_on, ends_on, status, payment_note)
  values (p_company, p_plan, nullif(q->>'promotion_id','')::bigint, (q->>'total')::numeric, v_start,
          (v_start + make_interval(months => v_months))::date, 'pending', 'بانتظار الدفع')
  returning id into v_id;
  return json_build_object('subscription_id', v_id, 'amount_kwd', q->'total', 'starts_on', v_start,
    'ends_on', (v_start + make_interval(months => v_months))::date, 'discount_percent', q->'discount_percent');
end $$;
revoke execute on function public.request_subscription(bigint, text, text) from public, anon;
grant execute on function public.request_subscription(bigint, text, text) to authenticated;

-- 9) الإدارة تفعّل الاشتراك بعد استلام الدفع يدوياً (أو يستدعيها webhook البوابة لاحقاً عبر service_role)
create or replace function public.admin_activate_subscription(p_id bigint, p_note text default null, p_provider text default 'manual', p_ref text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.subscriptions;
begin
  if not (public.is_admin() or current_user in ('postgres','service_role')) then raise exception 'forbidden'; end if;
  select * into s from public.subscriptions where id = p_id for update;
  if not found then raise exception 'subscription not found'; end if;
  if s.status = 'active' then return; end if;
  if s.status not in ('pending') then raise exception 'subscription not pending'; end if;
  insert into public.payments(subscription_id, provider, provider_ref, amount_kwd, status, paid_at, raw)
    values (p_id, coalesce(p_provider,'manual'), p_ref, s.amount_kwd, 'paid', now(), json_build_object('note', p_note)::jsonb);
  update public.subscriptions set status = 'active', payment_note = coalesce(p_note, 'تم الدفع') where id = p_id;
end $$;
revoke execute on function public.admin_activate_subscription(bigint, text, text, text) from public, anon;
grant execute on function public.admin_activate_subscription(bigint, text, text, text) to authenticated;

-- 10) البحث عن مستخدم بالإيميل لربط شركة قائمة بمالكها (للإدارة فقط)
create or replace function public.admin_find_user(p_email text)
returns table(id uuid, email text, role text, full_name text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select u.id, u.email::text, p.role, p.full_name from auth.users u left join public.profiles p on p.id = u.id
    where lower(u.email) = lower(trim(p_email)) limit 1;
end $$;
revoke execute on function public.admin_find_user(text) from public, anon;
grant execute on function public.admin_find_user(text) to authenticated;

-- 11) سياسات تخزين مبنية على الدور بدل UUID ثابت (السياسات القديمة تبقى كما هي)
drop policy if exists "role admin manage logos" on storage.objects;
create policy "role admin manage logos" on storage.objects for all to authenticated
  using (bucket_id = 'logos' and (select public.is_admin())) with check (bucket_id = 'logos' and (select public.is_admin()));
drop policy if exists "role admin manage company media" on storage.objects;
create policy "role admin manage company media" on storage.objects for all to authenticated
  using (bucket_id = 'company-media' and (select public.is_admin())) with check (bucket_id = 'company-media' and (select public.is_admin()));
