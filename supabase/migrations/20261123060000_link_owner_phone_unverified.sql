-- ✅ بطلب المالك (2026-11-23): ربط رقم المالك 99912313 بحسابه الحالي (نفس المعرّف = نفس البيانات والصلاحيات).
-- الرقم يُربط «غير مؤكَّد» (phone_confirmed_at = null): لا يمكن الدخول به إلا بعد إدخال رمز SMS المرسل إليه
-- (إثبات ملكية الرقم)، وعندها يتأكد تلقائياً. الصلاحية تبقى من profiles.role و app_settings.owner_user_id، لا من الرقم.
create schema if not exists backup_20261123;
revoke all on schema backup_20261123 from public, anon, authenticated;
create table if not exists backup_20261123.owner_auth_before_phone as
  select u.id, u.phone, u.phone_confirmed_at, p.phone as profile_phone
  from auth.users u join public.profiles p on p.id = u.id
  where u.id = (select (value #>> '{}')::uuid from public.app_settings where key = 'owner_user_id');

do $$
declare v_owner uuid := (select (value #>> '{}')::uuid from public.app_settings where key = 'owner_user_id');
begin
  if v_owner is null then raise exception 'owner not set'; end if;
  if exists (select 1 from auth.users where phone = '96599912313' and id <> v_owner) then raise exception 'phone already used by another account'; end if;
  update auth.users set phone = '96599912313', phone_confirmed_at = null, updated_at = now()
   where id = v_owner and coalesce(phone, '') = '';
  update public.profiles set phone = '99912313' where id = v_owner;
end $$;
