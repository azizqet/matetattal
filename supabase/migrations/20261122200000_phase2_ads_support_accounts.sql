-- ✅ المرحلة 2 — طُبِّقت بموافقة المالك (2026-11-22) بعد نسخة احتياطية (مخطط backup_20261122p2). اختبارات: supabase/tests/phase2_test.sql (42 فحصاً).
--
-- المرحلة 2: الإعلانات بموافقة المالك + الدعم الفني + حذف الحساب + ربط رقم الهاتف بالملف الشخصي
-- إضافي فقط: جداول جديدة ودوال وتريجرات جديدة. لا يحذف أي بيانات ولا يعدّل صلاحيات الحسابات الحالية.
-- الجداول القائمة لا تُمس، باستثناء:
--   • profiles: لا تغيير في البنية؛ فقط handle_new_user تحفظ رقم الهاتف عند التسجيل برقم الهاتف.
--   • terms_acceptances: قيد المفتاح الأجنبي يصبح ON DELETE SET NULL (قرار للمالك — انظر القسم 4).
-- التأثير على الموقع الإلكتروني: لا يوجد (لا يستخدم أي جدول جديد هنا، وجدول listings لا يُمس).
--
-- «المالك/الإدارة» = public.is_admin() (حالياً حساب واحد فقط: المالك). الصلاحية تُقرأ من قاعدة البيانات
-- (profiles.role) وليست من الواجهة. حماية ملكية المشروع (is_owner) من المرحلة 1 كما هي.

-- ========== 1) الإعلانات ==========
create table public.ads (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  service_id text not null references public.services(id),
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 10 and 1500),
  images text[] not null default '{}' check (cardinality(images) <= 6),
  area_name text not null check (char_length(area_name) between 2 and 40),
  phone text not null check (phone ~ '^[2569][0-9]{7}$'),
  price numeric(10,3) check (price is null or price >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ads_status_idx on public.ads(status, published_at desc);
create index ads_owner_idx on public.ads(owner_id);
create index ads_service_idx on public.ads(service_id);

-- القواعد كلها في الخادم (لا يمكن تجاوزها من التطبيق أو بالاتصال المباشر):
--   • غير المدير: الإعلان الجديد دائماً «بانتظار الموافقة»، ولا يغيّر الحالة أو بيانات المراجعة بنفسه.
--   • تعديل البيانات الأساسية لإعلان منشور/مرفوض/موقوف ← يعود «بانتظار الموافقة» ويختفي من العامة.
--   • المدير فقط: قبول/رفض (مع سبب إلزامي)/إيقاف. الوقت والمراجع يسجّلهما الخادم.
--   • الصور يجب أن تكون من مجلد المستخدم نفسه في حاوية ads.
create or replace function public.guard_ad() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_admin boolean := public.is_admin();
        v_prefix text := 'https://xpnwhvbxordtsmnegvri.supabase.co/storage/v1/object/public/ads/';
begin
  if tg_op = 'INSERT' then
    if not v_admin then
      new.owner_id := auth.uid();
      new.status := 'pending';
    end if;
    if new.owner_id is null then raise exception 'login required'; end if;
    new.reject_reason := null; new.reviewed_by := null; new.reviewed_at := null; new.published_at := null;
    new.created_at := now(); new.updated_at := now();
  else
    if new.owner_id <> old.owner_id then raise exception 'ad owner cannot change'; end if;
    new.created_at := old.created_at;
    new.updated_at := now();
    if not v_admin then
      -- لا يغيّر المستخدم الحالة ولا بيانات المراجعة
      new.status := old.status; new.reject_reason := old.reject_reason;
      new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.published_at := old.published_at;
      -- أي تعديل في البيانات الأساسية يعيد الإعلان للمراجعة
      if (new.title, new.description, new.images, new.service_id, new.area_name, new.phone, new.price)
         is distinct from (old.title, old.description, old.images, old.service_id, old.area_name, old.phone, old.price) then
        new.status := 'pending'; new.reject_reason := null; new.reviewed_by := null; new.reviewed_at := null;
      end if;
    elsif new.status is distinct from old.status then
      if new.status = 'rejected' and coalesce(trim(new.reject_reason), '') = '' then
        raise exception 'reject reason required'; end if;
      if new.status <> 'rejected' then new.reject_reason := null; end if;
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
      if new.status = 'approved' then new.published_at := now(); end if;
    end if;
  end if;
  if exists (select 1 from unnest(new.images) u
             where u not like v_prefix || new.owner_id::text || '/%') then
    raise exception 'invalid image url'; end if;
  -- حد: 10 إعلانات جديدة لكل مستخدم يومياً
  if tg_op = 'INSERT' and not v_admin and
     (select count(*) from public.ads where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate limit: too many ads today'; end if;
  return new;
end $$;
revoke execute on function public.guard_ad() from public, anon, authenticated;
create trigger guard_ad before insert or update on public.ads for each row execute function public.guard_ad();

-- إشعار صاحب الإعلان عند القبول أو الرفض
create or replace function public.notify_ad_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected','paused') then
    perform public.notify(new.owner_id,
      case new.status when 'approved' then 'تم نشر إعلانك' when 'rejected' then 'لم يتم قبول إعلانك' else 'تم إيقاف إعلانك' end,
      case new.status when 'rejected' then 'السبب: ' || coalesce(new.reject_reason, '') else new.title end,
      jsonb_build_object('type', 'ad', 'ad_id', new.id, 'status', new.status));
  end if;
  return new;
end $$;
revoke execute on function public.notify_ad_review() from public, anon, authenticated;
create trigger notify_ad_review after update of status on public.ads for each row execute function public.notify_ad_review();

alter table public.ads enable row level security;
create policy "public reads approved ads" on public.ads for select using (status = 'approved');
create policy "owner reads own ads" on public.ads for select to authenticated using (owner_id = (select auth.uid()));
create policy "admin reads all ads" on public.ads for select to authenticated using ((select public.is_admin()));
create policy "user creates own ads" on public.ads for insert to authenticated with check (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "owner or admin updates ads" on public.ads for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "owner or admin deletes ads" on public.ads for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
grant select on public.ads to anon, authenticated;
grant insert, update, delete on public.ads to authenticated;

-- صور الإعلانات: قراءة عامة (تظهر فقط في إعلان منشور)، رفع في مجلد المستخدم فقط، 5 ميجا، صور فقط
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ads', 'ads', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "ads upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'ads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "ads delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'ads' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- ========== 2) الدعم الفني ==========
create table public.support_tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  status text not null default 'new' check (status in ('new','in_progress','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets(user_id, last_message_at desc);
create index support_tickets_status_idx on public.support_tickets(status, last_message_at desc);

create table public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.support_tickets(id) on delete cascade,
  sender_id uuid default auth.uid() references auth.users(id) on delete set null,
  is_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 3000),
  image_path text check (image_path is null or char_length(image_path) <= 300),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages(ticket_id, created_at);

create or replace function public.guard_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then new.user_id := auth.uid(); end if;
    new.status := 'new'; new.created_at := now(); new.updated_at := now(); new.last_message_at := now();
    if (select count(*) from public.support_tickets where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
      raise exception 'rate limit: too many tickets today'; end if;
  else
    -- تحديث داخلي من تريجر الرسائل (وقت آخر رسالة / إعادة فتح) — بدون إشعار.
    -- pg_trigger_depth() > 1 لا يمكن للمستخدم تزويره (يتحقق فقط عند التحديث من داخل تريجر آخر).
    if pg_trigger_depth() > 1 then
      if new.user_id <> old.user_id or new.subject <> old.subject then raise exception 'ticket fields locked'; end if;
      return new;
    end if;
    if not public.is_admin() then raise exception 'forbidden'; end if;   -- المستخدم لا يغيّر الحالة
    if new.user_id <> old.user_id or new.subject <> old.subject then raise exception 'ticket fields locked'; end if;
    new.created_at := old.created_at; new.updated_at := now();
    if new.status is distinct from old.status then
      perform public.notify(new.user_id, 'تحديث على طلب الدعم #' || new.id,
        case new.status when 'in_progress' then 'طلبك قيد المعالجة' when 'resolved' then 'تم حل طلبك' else 'طلبك جديد' end,
        jsonb_build_object('type', 'support', 'ticket_id', new.id));
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_ticket() from public, anon, authenticated;
create trigger guard_ticket before insert or update on public.support_tickets for each row execute function public.guard_ticket();

-- الرسائل: المرسل والصفة (إدارة/مستخدم) والوقت من الخادم. رد الإدارة يرسل إشعاراً.
-- رسالة جديدة من المستخدم على طلب «تم الحل» تعيد فتحه.
create or replace function public.guard_support_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; v_admin boolean := public.is_admin();
begin
  select * into t from public.support_tickets where id = new.ticket_id;
  if not found or (t.user_id <> auth.uid() and not v_admin) then raise exception 'forbidden'; end if;
  new.sender_id := auth.uid(); new.is_staff := v_admin and t.user_id <> auth.uid(); new.created_at := now();
  if new.image_path is not null and new.image_path not like t.user_id::text || '/' || t.id::text || '/%' then
    raise exception 'invalid image path'; end if;
  if not new.is_staff and (select count(*) from public.support_messages
       where ticket_id = new.ticket_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate limit: too many messages'; end if;
  update public.support_tickets set last_message_at = now(), updated_at = now(),
    status = case when not new.is_staff and status = 'resolved' then 'new' else status end
    where id = t.id;
  if new.is_staff then
    perform public.notify(t.user_id, 'رد جديد من الدعم الفني', left(new.body, 120),
      jsonb_build_object('type', 'support', 'ticket_id', t.id));
  end if;
  return new;
end $$;
revoke execute on function public.guard_support_message() from public, anon, authenticated;
create trigger guard_support_message before insert on public.support_messages for each row execute function public.guard_support_message();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
-- خاص بين صاحب الطلب والإدارة فقط
create policy "own or admin reads tickets" on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "user opens ticket" on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "admin updates tickets" on public.support_tickets for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "own or admin reads messages" on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id
                 and (t.user_id = (select auth.uid()) or (select public.is_admin()))));
create policy "own or admin writes messages" on public.support_messages for insert to authenticated
  with check (exists (select 1 from public.support_tickets t where t.id = ticket_id
                      and (t.user_id = (select auth.uid()) or (select public.is_admin()))));
-- لا تعديل ولا حذف للرسائل (سجل محفوظ)
grant select, insert on public.support_tickets, public.support_messages to authenticated;
grant update (status) on public.support_tickets to authenticated;

-- صور الدعم: حاوية خاصة (غير عامة). المسار: <user_id>/<ticket_id>/<ملف>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support', 'support', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "support upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'support' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "support read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'support' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- ========== 3) التسجيل برقم الهاتف: حفظ الرقم في الملف الشخصي ==========
-- رقم الهاتف نفسه فريد في نظام المصادقة (Supabase Auth) → لا حسابات مكررة بنفس الرقم.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, phone)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''),80),
          case when new.phone ~ '^965[2569][0-9]{7}$' then right(new.phone, 8) end)
  on conflict (id) do nothing;
  return new;
end $$;

-- ========== 4) حذف الحساب ==========
-- [قرار للمالك] سجل الموافقات على الشروط: يبقى كدليل قانوني بعد حذف الحساب لكن بدون ربط بالمستخدم.
-- (البديل: حذفه مع الحساب.) الافتراضي هنا: يبقى بلا ربط.
alter table public.terms_acceptances alter column user_id drop not null;
alter table public.terms_acceptances drop constraint terms_acceptances_user_id_fkey,
  add constraint terms_acceptances_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

-- يحذف الحساب وبياناته الشخصية: الملف الشخصي، المفضلة، الإشعارات، الطلبات، التقييمات، الإعلانات، طلبات الدعم.
-- الشركات لا تُحذف: تُفصل عن الحساب (owner_id = null) وتبقى بيد الإدارة.
-- لا يمكن حذف حساب المالك من التطبيق.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'login required'; end if;
  if public.is_owner() then raise exception 'owner account cannot be deleted from the app'; end if;
  delete from auth.users where id = v;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
