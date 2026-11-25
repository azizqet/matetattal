-- ⚠️ مقترح — لم يُطبَّق. لا يُطبَّق إلا بعد موافقة المالك الصريحة وأخذ نسخة احتياطية.
--
-- المرحلة 3: تسجيل ودخول موحّد برقم التلفون + كلمة السر (بدون SMS وبدون تأكيد بريد)
--
-- التصميم:
--  • الحساب في Supabase Auth بمعرّف داخلي ثابت مبني على الرقم: 965XXXXXXXX@users.matattal.invalid
--    (نطاق .invalid محجوز عالمياً ولا يستقبل بريداً) → الرقم فريد تلقائياً (لا حسابات مكررة).
--  • كلمات السر يشفّرها Supabase Auth بـ bcrypt (خوارزمية مخصصة لكلمات المرور).
--  • الاستعادة بدون SMS أو بريد: «رمز استعادة» عشوائي يُعرض للمستخدم مرة واحدة ويُحفظ مشفّراً (bcrypt).
--    الاستعادة تتطلب الرقم + رمز الاستعادة معاً (الرقم وحده لا يكفي)، مع حدود محاولات وقفل مؤقت.
--  • الصلاحيات تبقى في قاعدة البيانات (profiles.role و app_settings.owner_user_id) — الرقم لا يمنح أي صلاحية.
--
-- التأثير على البيانات: لا حذف. جداول ودوال جديدة + تعديل handle_new_user + تحويل حساب المالك (القسم 4).

-- ========== 1) رموز الاستعادة ==========
create table public.account_recovery (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,                       -- bcrypt
  created_at timestamptz not null default now(),
  failed_attempts int not null default 0,
  locked_until timestamptz
);
alter table public.account_recovery enable row level security;   -- لا سياسات: الوصول عبر الدوال فقط
revoke all on public.account_recovery from anon, authenticated;

create table public.recovery_attempts (
  id bigint generated always as identity primary key,
  phone text not null,
  success boolean not null,
  at timestamptz not null default now()
);
create index recovery_attempts_phone_idx on public.recovery_attempts(phone, at desc);
alter table public.recovery_attempts enable row level security;
revoke all on public.recovery_attempts from anon, authenticated;

create or replace function public.auth_email_for_phone(p_phone text) returns text
language sql immutable set search_path = '' as $$
  select '965' || p_phone || '@users.matattal.invalid'
$$;

-- يولّد رمز استعادة جديد للمستخدم الحالي (يلغي القديم) ويرجعه مرة واحدة فقط
create or replace function public.create_recovery_code() returns text
language plpgsql security definer set search_path = '' as $$
declare v uuid := auth.uid(); v_code text; v_raw text;
begin
  if v is null then raise exception 'login required'; end if;
  v_raw := upper(encode(extensions.gen_random_bytes(9), 'hex'));          -- 72 بت عشوائية
  v_code := substr(v_raw,1,6) || '-' || substr(v_raw,7,6) || '-' || substr(v_raw,13,6);
  insert into public.account_recovery(user_id, code_hash) values (v, extensions.crypt(v_code, extensions.gen_salt('bf', 10)))
  on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now(), failed_attempts = 0, locked_until = null;
  return v_code;
end $$;
revoke execute on function public.create_recovery_code() from public, anon;
grant execute on function public.create_recovery_code() to authenticated;

create or replace function public.has_recovery_code() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.account_recovery where user_id = auth.uid())
$$;
revoke execute on function public.has_recovery_code() from public, anon;
grant execute on function public.has_recovery_code() to authenticated;

-- استعادة كلمة السر: الرقم + رمز الاستعادة + كلمة سر جديدة. ترجع true عند النجاح و false عند خطأ الرقم/الرمز
-- (بدون كشف هل الرقم مسجّل). تُرفع أخطاء فقط لكلمة السر الضعيفة وتجاوز حد المحاولات.
create or replace function public.reset_password_with_recovery(p_phone text, p_code text, p_new_password text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; r public.account_recovery; v_admin boolean; v_max int;
begin
  if p_phone !~ '^[569][0-9]{7}$' then return false; end if;
  if char_length(coalesce(p_new_password, '')) < 8 or p_new_password !~ '[0-9]' or p_new_password !~ '[^0-9]' then
    raise exception 'weak password'; end if;
  -- حد عام لكل رقم: 5 محاولات في الساعة (حتى لو الرقم غير مسجّل)
  if (select count(*) from public.recovery_attempts where phone = p_phone and not success and at > now() - interval '1 hour') >= 5 then
    raise exception 'too many attempts'; end if;

  select id into v_user from auth.users where email = public.auth_email_for_phone(p_phone);
  select * into r from public.account_recovery where user_id = v_user;
  v_admin := exists (select 1 from public.profiles where id = v_user and role = 'admin');
  v_max := case when v_admin then 3 else 5 end;     -- حماية إضافية لحساب المدير

  if r.user_id is null or (r.locked_until is not null and r.locked_until > now())
     or r.code_hash <> extensions.crypt(upper(trim(coalesce(p_code, ''))), r.code_hash) then
    insert into public.recovery_attempts(phone, success) values (p_phone, false);
    if r.user_id is not null then
      update public.account_recovery
         set failed_attempts = failed_attempts + 1,
             locked_until = case when failed_attempts + 1 >= v_max then now() + case when v_admin then interval '24 hours' else interval '1 hour' end else locked_until end
       where user_id = r.user_id;
    end if;
    -- لا نرفع خطأ هنا: الخطأ يُلغي تسجيل المحاولة والقفل. نرجع false والتطبيق يعرض «بيانات الاستعادة غير صحيحة».
    return false;
  end if;

  update auth.users set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)), updated_at = now() where id = v_user;
  delete from auth.refresh_tokens where user_id = v_user::text;   -- إنهاء الجلسات القديمة
  delete from auth.sessions where user_id = v_user;
  delete from public.account_recovery where user_id = v_user;      -- الرمز لمرة واحدة؛ يُطلب رمز جديد بعد الدخول
  insert into public.recovery_attempts(phone, success) values (p_phone, true);
  return true;
end $$;
revoke execute on function public.reset_password_with_recovery(text, text, text) from public;
grant execute on function public.reset_password_with_recovery(text, text, text) to anon, authenticated;

-- ========== 2) الرقم في الملف الشخصي يُستخرج من المعرّف الداخلي (لا من بيانات يرسلها المستخدم) ==========
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, phone)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''),80),
          case
            when new.email ~ '^965[569][0-9]{7}@users\.matattal\.invalid$' then substr(new.email, 4, 8)
            when new.phone ~ '^965[2569][0-9]{7}$' then right(new.phone, 8)
          end)
  on conflict (id) do nothing;
  return new;
end $$;

-- ========== 3) حماية من الحسابات الوهمية: حد إنشاء حسابات جديدة على مستوى المشروع ==========
-- (إضافةً لحدود Supabase Auth لكل عنوان IP)
create or replace function public.guard_signup_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from auth.users where created_at > now() - interval '10 minutes') >= 100 then
    raise exception 'signup rate limit';
  end if;
  return new;
end $$;
revoke execute on function public.guard_signup_rate() from public, anon, authenticated;
create trigger guard_signup_rate before insert on auth.users for each row execute function public.guard_signup_rate();

-- ========== 4) حساب المالك: الدخول برقم 99912313 وكلمة السر الحالية نفسها ==========
-- نفس الحساب ونفس كلمة السر (bcrypt كما هي) → كل البيانات والصلاحيات باقية.
-- الرقم لا يمنح الصلاحية؛ الدخول يتطلب كلمة سر المالك الحالية. البريد الأصلي يُحفظ في نسخة احتياطية.
create schema if not exists backup_phase3;
revoke all on schema backup_phase3 from public, anon, authenticated;
create table backup_phase3.owner_auth as
  select u.id, u.email, u.phone, u.phone_confirmed_at, i.identity_data
  from auth.users u left join auth.identities i on i.user_id = u.id and i.provider = 'email'
  where u.id = (select (value #>> '{}')::uuid from public.app_settings where key = 'owner_user_id');

do $$
declare v_owner uuid := (select (value #>> '{}')::uuid from public.app_settings where key = 'owner_user_id');
        v_email text := public.auth_email_for_phone('99912313');
begin
  if v_owner is null then raise exception 'owner not set'; end if;
  if exists (select 1 from auth.users where email = v_email and id <> v_owner) then raise exception 'owner phone login already used'; end if;
  update auth.users set email = v_email, phone = null, phone_confirmed_at = null, updated_at = now() where id = v_owner;
  update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_email)), updated_at = now()
   where user_id = v_owner and provider = 'email';
  update public.profiles set phone = '99912313' where id = v_owner;
end $$;
