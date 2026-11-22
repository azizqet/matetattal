-- ⚠️ مقترح للمراجعة فقط — لم يُطبَّق على قاعدة البيانات.
-- لا يُطبَّق إلا بعد موافقة المالك الصريحة على هذا النص.
--
-- المرحلة 1: الشروط والموافقات الإلكترونية + حماية ملكية المشروع
-- إضافي فقط: جداول جديدة + تعديل دالتين أنشأهما تطبيق الجوال (request_subscription, admin_set_role)
-- وتريجر جديد على companies يعمل فقط لغير المديرين.
--
-- التأثير على الموقع الإلكتروني: لا يوجد.
--   • الموقع لا يستخدم أي جدول جديد هنا.
--   • الموقع يضيف الشركات بحساب المدير، والتريجر الجديد يتجاوز المديرين → لا يتغير سلوكه.
--   • join_requests و areas و company_areas و contact_events لا تُمس.

-- ========== 1) وثائق الشروط (نسخ ثابتة لا تُعدَّل بعد النشر) ==========
create table public.terms_documents (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('customers','providers','privacy','subscriptions','ads')),
  version text not null check (version ~ '^\d+\.\d+$'),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 50 and 100000),
  body_sha256 text not null,                 -- بصمة النص الحرفي (يحسبها الخادم)
  published_at timestamptz,                  -- null = مسودة غير نافذة
  is_current boolean not null default false, -- النسخة السارية لكل نوع (واحدة فقط)
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (kind, version)
);
create unique index terms_one_current_per_kind on public.terms_documents(kind) where is_current;

create or replace function public.guard_terms_document() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.body_sha256 := encode(extensions.digest(new.body, 'sha256'), 'hex');
    new.created_at := now();
    if new.is_current and new.published_at is null then new.published_at := now(); end if;
    return new;
  end if;
  -- بعد الإنشاء: النص والإصدار والبصمة لا تتغير أبداً (أي تعديل = إصدار جديد)
  if new.body <> old.body or new.version <> old.version or new.kind <> old.kind
     or new.body_sha256 <> old.body_sha256 or new.title <> old.title then
    raise exception 'published terms are immutable; create a new version';
  end if;
  if new.published_at is distinct from old.published_at and old.published_at is not null then
    raise exception 'published_at cannot change once set';
  end if;
  if new.is_current and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger guard_terms_document before insert or update on public.terms_documents
  for each row execute function public.guard_terms_document();

alter table public.terms_documents enable row level security;
create policy "read published terms" on public.terms_documents for select
  using (published_at is not null or (select public.is_admin()));
create policy "admin writes terms" on public.terms_documents for insert to authenticated
  with check ((select public.is_admin()));
create policy "admin publishes terms" on public.terms_documents for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- لا سياسة حذف: الوثائق المنشورة تبقى للتوثيق
grant select on public.terms_documents to anon, authenticated;
grant insert, update (is_current, published_at) on public.terms_documents to authenticated;

-- ========== 2) سجل الموافقات (إضافة فقط — لا تعديل ولا حذف) ==========
create table public.terms_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id),
  document_id bigint not null references public.terms_documents(id),
  kind text not null,
  version text not null,
  body_sha256 text not null,              -- نسخة البصمة وقت الموافقة (من الخادم، لا من التطبيق)
  accepted_at timestamptz not null default now(),  -- وقت الخادم
  context text not null check (context in ('registration','company_create','subscription','ads','update')),
  company_id bigint references public.companies(id),
  app_version text check (char_length(app_version) <= 40),
  platform text check (platform in ('ios','android','web')),
  unique (user_id, document_id, context, company_id)
);
create index terms_acceptances_user_idx on public.terms_acceptances(user_id, kind);
create index terms_acceptances_document_idx on public.terms_acceptances(document_id);
create index terms_acceptances_company_idx on public.terms_acceptances(company_id);

create or replace function public.stamp_terms_acceptance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d public.terms_documents;
begin
  select * into d from public.terms_documents where id = new.document_id;
  if not found or d.published_at is null then raise exception 'terms document not published'; end if;
  if not d.is_current then raise exception 'only the current version can be accepted'; end if;
  -- القيم الموثقة يحددها الخادم دائماً، أي قيمة يرسلها التطبيق تُستبدل
  new.user_id := auth.uid();
  new.kind := d.kind; new.version := d.version; new.body_sha256 := d.body_sha256;
  new.accepted_at := now();
  if new.company_id is not null and not exists (
       select 1 from public.companies c where c.id = new.company_id and c.owner_id = auth.uid()) then
    raise exception 'company does not belong to user';
  end if;
  return new;
end $$;
revoke execute on function public.stamp_terms_acceptance() from public, anon, authenticated;
create trigger stamp_terms_acceptance before insert on public.terms_acceptances
  for each row execute function public.stamp_terms_acceptance();

alter table public.terms_acceptances enable row level security;
create policy "user records own acceptance" on public.terms_acceptances for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "read own or staff" on public.terms_acceptances for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
grant select, insert on public.terms_acceptances to authenticated;
revoke update, delete, truncate on public.terms_acceptances from anon, authenticated;

-- هل وافق المستخدم على النسخة السارية من الأنواع المطلوبة؟
-- [قرار المالك أ] إذا لم تُنشر أي نسخة سارية لنوع ما بعد: هل يُمنع التسجيل (أحوط قانونياً)
-- أم يُسمح مؤقتاً (يستمر التطبيق بالعمل حتى اعتماد الشروط)؟ الافتراضي أدناه: المنع.
create or replace function public.has_accepted_current(p_user uuid, p_kinds text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(bool_and(exists (
           select 1 from public.terms_acceptances a
           where a.user_id = p_user and a.document_id = d.id)), false)
     and count(*) = cardinality(p_kinds)
  from public.terms_documents d
  where d.is_current and d.kind = any(p_kinds)
$$;
revoke execute on function public.has_accepted_current(uuid, text[]) from public, anon;
grant execute on function public.has_accepted_current(uuid, text[]) to authenticated;

-- ========== 3) الإلزام: لا شركة ولا اشتراك بدون موافقة صريحة ==========
create or replace function public.require_provider_consent() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if public.is_admin() or current_user in ('postgres','service_role','supabase_admin') then return new; end if;
  if not public.has_accepted_current(auth.uid(), array['providers','privacy']) then
    raise exception 'terms not accepted: providers, privacy';
  end if;
  return new;
end $$;
revoke execute on function public.require_provider_consent() from public, anon, authenticated;
create trigger require_provider_consent before insert on public.companies
  for each row execute function public.require_provider_consent();

-- request_subscription: نفس الدالة الحالية + شرط الموافقة على شروط مقدمي الخدمات وسياسة الاشتراكات
--   (يُضاف في بدايتها، بعد التحقق من الملكية):
--   if not public.is_admin() and not public.has_accepted_current(auth.uid(), array['providers','subscriptions']) then
--     raise exception 'terms not accepted: providers, subscriptions'; end if;

-- ========== 4) حماية ملكية المشروع ==========
-- [قرار المالك ب] تأكيد أن حساب المالك هو الحساب المدير الحالي الوحيد (b6e2d36c-...).
insert into public.app_settings(key, value, is_public)
values ('owner_user_id', to_jsonb('b6e2d36c-af6f-4d88-ae24-49961bb3722e'::text), false)
on conflict (key) do nothing;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_settings s
                 where s.key = 'owner_user_id' and s.value #>> '{}' = auth.uid()::text)
$$;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- admin_set_role: المدير الشريك يستطيع إدارة العملاء والشركات والمشرفين،
-- لكن منح/سحب صلاحية «مدير» وأي تغيير على حساب المالك = للمالك فقط.
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_role not in ('customer','company','staff','admin') then raise exception 'bad role'; end if;
  if p_user = auth.uid() then raise exception 'cannot change own role'; end if;
  if exists (select 1 from public.app_settings s where s.key='owner_user_id' and s.value #>> '{}' = p_user::text) then
    raise exception 'owner account is protected'; end if;
  select role into v_old from public.profiles where id = p_user;
  if (p_role = 'admin' or v_old = 'admin') and not public.is_owner() then
    raise exception 'only the owner can grant or revoke admin'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

-- الإعدادات الحساسة (المالك فقط): owner_user_id وكل ما يبدأ بـ payment_
drop policy if exists "admin settings" on public.app_settings;
create policy "admin settings" on public.app_settings for all to authenticated
  using ((select public.is_admin()) and (key not in ('owner_user_id') and key not like 'payment\_%' or (select public.is_owner())))
  with check ((select public.is_admin()) and (key not in ('owner_user_id') and key not like 'payment\_%' or (select public.is_owner())));
