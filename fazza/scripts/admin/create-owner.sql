-- Promote an existing account (registered normally in the app) to OWNER of the admin panel.
-- Run once in the Supabase SQL editor (or psql) after the owner has signed up in the app:
--   select public.bootstrap_owner('+965XXXXXXXX');
create or replace function public.bootstrap_owner(p_phone text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if exists (select 1 from public.admins where role = 'owner') then
    raise exception 'An owner already exists. Use the admin panel (Users -> Admin role) to add staff.';
  end if;
  select id into uid from public.profiles where phone = public.normalize_kw_phone(p_phone);
  if uid is null then raise exception 'No account with this phone. Register in the app first.'; end if;
  insert into public.admins (user_id, role) values (uid, 'owner');
  update public.profiles set phone_verified = true, phone_verified_at = now() where id = uid;
  insert into public.audit_log (actor_id, action, target_type, target_id) values (uid, 'owner_bootstrapped', 'user', uid::text);
  return 'owner set for ' || p_phone;
end $$;
revoke execute on function public.bootstrap_owner(text) from public, anon, authenticated;
