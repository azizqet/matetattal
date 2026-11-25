-- =====================================================================
-- FAZZA — login protection (account lockout), session revocation
-- =====================================================================

create table public.login_failures (
  id bigserial primary key,
  phone text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index login_failures_phone_idx on public.login_failures(phone, created_at desc);
create index login_failures_ip_idx on public.login_failures(ip, created_at desc);
alter table public.login_failures enable row level security; -- no policies: service role only

-- Max 5 failed attempts per phone / 15 min, 30 per IP / 15 min.
create or replace function public.login_lock_status(p_phone text, p_ip text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  by_phone integer;
  by_ip integer;
  oldest timestamptz;
begin
  select count(*), min(created_at) into by_phone, oldest from public.login_failures
    where phone = p_phone and created_at > now() - interval '15 minutes';
  select count(*) into by_ip from public.login_failures
    where p_ip is not null and ip = p_ip and created_at > now() - interval '15 minutes';
  return jsonb_build_object(
    'locked', by_phone >= 5 or by_ip >= 30,
    'retry_after_seconds', case when by_phone >= 5 then greatest(0, extract(epoch from (oldest + interval '15 minutes' - now()))::integer) else 900 end,
    'failures', by_phone);
end $$;

create or replace function public.login_record_failure(p_phone text, p_ip text) returns void
language sql security definer set search_path = public as $$
  insert into public.login_failures (phone, ip) values (p_phone, p_ip);
  delete from public.login_failures where created_at < now() - interval '1 day';
$$;

create or replace function public.login_record_success(p_phone text) returns void
language sql security definer set search_path = public as $$
  delete from public.login_failures where phone = p_phone;
$$;

create or replace function public.account_status_by_phone(p_phone text) returns text
language sql stable security definer set search_path = public as $$
  select status::text from public.profiles where phone = p_phone
$$;

create or replace function public.phone_exists(p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where phone = p_phone)
      or exists (select 1 from auth.users where phone = ltrim(p_phone, '+'))
$$;

create or replace function public.revoke_user_sessions(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.sessions where user_id = p_user;
end $$;

create or replace function public.set_must_change_password(p_user uuid, p_value boolean) returns void
language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = p_value where id = p_user
$$;

revoke execute on function public.login_lock_status(text, text), public.login_record_failure(text, text),
  public.login_record_success(text), public.account_status_by_phone(text), public.phone_exists(text),
  public.revoke_user_sessions(uuid), public.set_must_change_password(uuid, boolean) from public, anon, authenticated;
grant execute on function public.login_lock_status(text, text), public.login_record_failure(text, text),
  public.login_record_success(text), public.account_status_by_phone(text), public.phone_exists(text),
  public.revoke_user_sessions(uuid), public.set_must_change_password(uuid, boolean),
  public.hit_rate_limit(text, integer, integer) to service_role;

-- Optional Supabase Auth Hook (defense in depth for direct calls to the Auth API):
-- "Password verification attempt" -> pg-functions://postgres/public/hook_password_verification_attempt
create or replace function public.hook_password_verification_attempt(event jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (event ->> 'user_id')::uuid;
  ph text;
  fails integer;
begin
  select phone into ph from public.profiles where id = uid;
  if ph is null then return jsonb_build_object('decision', 'continue'); end if;
  select count(*) into fails from public.login_failures where phone = ph and created_at > now() - interval '15 minutes';
  if fails >= 5 then
    return jsonb_build_object('decision', 'reject', 'message', 'FZ_LOGIN_LOCKED', 'should_logout_user', false);
  end if;
  if (event ->> 'valid')::boolean then
    delete from public.login_failures where phone = ph;
  else
    insert into public.login_failures (phone, ip) values (ph, 'auth-hook');
  end if;
  return jsonb_build_object('decision', 'continue');
end $$;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant select, insert, delete on public.login_failures to supabase_auth_admin;
grant usage, select on sequence public.login_failures_id_seq to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;
create policy auth_admin_failures on public.login_failures to supabase_auth_admin using (true) with check (true);
create policy auth_admin_profiles on public.profiles for select to supabase_auth_admin using (true);

-- Suspending a user also revokes their sessions.
create or replace function public.on_profile_suspended() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if new.status = 'suspended' and old.status <> 'suspended' then
    delete from auth.sessions where user_id = new.id;
  end if;
  return new;
end $$;
create trigger profiles_suspended after update of status on public.profiles
  for each row execute function public.on_profile_suspended();

-- Send-SMS Auth Hook: FAZZA does not use OTP/SMS at all. The phone provider (needed for
-- phone + password accounts) is wired to this hook, which refuses every OTP request so that
-- OTP login cannot be used even by calling the Auth API directly.
create or replace function public.hook_send_sms_refuse_otp(event jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'FZ_OTP_DISABLED'));
end $$;
grant execute on function public.hook_send_sms_refuse_otp(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_send_sms_refuse_otp(jsonb) from public, anon, authenticated;
