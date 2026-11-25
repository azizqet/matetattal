-- FIKRA SELL · 0017 · Guard for the instant-signup Edge Function.
-- Called only with the service role: per-IP and global limits before an
-- account is created (accounts are created already confirmed, no e-mail/OTP).
create or replace function public.signup_guard(p_ip text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.enforce_rate_limit('signup-ip:' || coalesce(nullif(p_ip, ''), 'unknown'), 5, 3600, 'signup_rate_limited');
  perform private.enforce_rate_limit('signup-ip-burst:' || coalesce(nullif(p_ip, ''), 'unknown'), 2, 60, 'signup_rate_limited');
end $$;
revoke all on function public.signup_guard(text) from public, anon, authenticated;
grant execute on function public.signup_guard(text) to service_role;
