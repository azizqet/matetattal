-- FIKRA SELL · 0014 · Least-privilege grants for the "push" Edge Function.
-- Hosted Supabase does not grant service_role on new tables automatically.
grant usage on schema public to service_role;
grant select, update (pushed_at) on public.notifications to service_role;
grant select on public.profile_settings to service_role;
grant select, delete on public.push_tokens to service_role;
