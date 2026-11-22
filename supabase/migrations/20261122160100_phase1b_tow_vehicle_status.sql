-- ✅ طُبِّق على قاعدة البيانات بموافقة المالك الصريحة (2026-11-22).
--
-- المرحلة 1B: حالات السطحات والونشات (لكل سطحة حالة مستقلة)
-- قرار المالك (2026-11-22):
--   متاح = يستقبل الطلبات · مشغول = عنده طلب أو لا يستطيع استقبال طلب جديد · غير متصل = خارج الخدمة مؤقتاً
--   صاحب السطحة يغيّر حالتها، والعميل يرى آخر حالة ووقت تحديثها.
--
-- إضافي فقط: جدول جديد + عمود اختياري جديد في service_requests + تريجرين جديدين.
-- التأثير على الموقع الإلكتروني: لا يوجد (لا يقرأ هذا الجدول، والعمود الجديد اختياري وفارغ افتراضياً).

-- ========== 1) السطحات/الونشات ==========
create table public.company_vehicles (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),        -- مثال: «سطحة 1» (لا رقم لوحة كامل لحماية الخصوصية)
  kind text not null default 'flatbed' check (kind in ('flatbed','wrecker','other')),  -- سطحة / ونش رافعة / أخرى
  status text not null default 'offline' check (status in ('available','busy','offline')),
  status_updated_at timestamptz not null default now(),                   -- يحدده الخادم فقط
  is_active boolean not null default true,                                -- إخفاء سطحة دون حذف سجلها
  created_at timestamptz not null default now()
);
create index company_vehicles_company_idx on public.company_vehicles(company_id);

-- وقت التحديث من الخادم دائماً، ولا يمكن نقل السطحة لشركة أخرى
create or replace function public.stamp_vehicle_status() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.status_updated_at := now(); new.created_at := now(); return new; end if;
  if new.company_id <> old.company_id then raise exception 'vehicle company cannot change'; end if;
  if new.status is distinct from old.status then new.status_updated_at := now();
  else new.status_updated_at := old.status_updated_at; end if;
  new.created_at := old.created_at;
  return new;
end $$;
revoke execute on function public.stamp_vehicle_status() from public, anon, authenticated;
create trigger stamp_vehicle_status before insert or update on public.company_vehicles
  for each row execute function public.stamp_vehicle_status();

alter table public.company_vehicles enable row level security;
-- العامة: سطحات الشركات الظاهرة فقط
create policy "read vehicles of visible companies" on public.company_vehicles for select using (
  exists (select 1 from public.companies c where c.id = company_vehicles.company_id
          and ((c.is_active and c.status = 'approved' and c.sub_end >= current_date)
               or c.owner_id = (select auth.uid()) or (select public.is_staff()))));
-- صاحب الشركة أو المدير: إضافة/تعديل/حذف
create policy "owner manages vehicles" on public.company_vehicles for all to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.companies c where c.id = company_vehicles.company_id and c.owner_id = (select auth.uid())))
  with check ((select public.is_admin()) or exists (select 1 from public.companies c where c.id = company_vehicles.company_id and c.owner_id = (select auth.uid())));
grant select on public.company_vehicles to anon, authenticated;
grant insert, update, delete on public.company_vehicles to authenticated;

-- ========== 2) ربط الطلب بسطحة (اختياري) ==========
alter table public.service_requests add column vehicle_id bigint references public.company_vehicles(id) on delete set null;
create index service_requests_vehicle_idx on public.service_requests(vehicle_id);

-- فقط صاحب الشركة (أو المدير) يحدد السطحة، ويجب أن تكون من سطحات نفس الشركة.
create or replace function public.guard_request_vehicle() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if new.vehicle_id is not distinct from (case when tg_op = 'UPDATE' then old.vehicle_id else null end) then return new; end if;
  if new.vehicle_id is not null and not exists (
       select 1 from public.company_vehicles v where v.id = new.vehicle_id and v.company_id = new.company_id) then
    raise exception 'vehicle does not belong to company'; end if;
  select owner_id into v_owner from public.companies where id = new.company_id;
  if not (public.is_admin() or v_owner = auth.uid()) then raise exception 'only the company can assign a vehicle'; end if;
  -- [قرار المالك ج — معلّق] تحديث حالة السطحة تلقائياً؟
  --   عند القبول/في الطريق → مشغول، وعند الإنجاز/الإلغاء/الرفض → متاح.
  --   إن وافق المالك يُضاف هنا وفي guard_request؛ الافتراضي: لا تحديث تلقائي (يغيّرها صاحب السطحة يدوياً).
  return new;
end $$;
revoke execute on function public.guard_request_vehicle() from public, anon, authenticated;
create trigger guard_request_vehicle before insert or update of vehicle_id on public.service_requests
  for each row execute function public.guard_request_vehicle();

-- ========== 3) التحديث الفوري للعميل ==========
-- [قرار المالك د — معلّق] افتراضياً: التطبيق يعيد جلب الحالات كل 30 ثانية في صفحة الشركة (بلا تغيير إضافي).
-- بديل لاحق: Supabase Realtime (يتطلب: alter publication supabase_realtime add table public.company_vehicles;)
