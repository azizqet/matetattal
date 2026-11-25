-- FIKRA SELL · 0012 · Hardening after Supabase security advisor review
-- Internal helpers: only called inside security-definer functions, never by clients.
revoke execute on function public.is_blocked_between(uuid, uuid) from anon, authenticated;
revoke execute on function public.setting(text, jsonb) from anon, authenticated;
-- Keep pg_net out of the exposed schema (no-op locally when pg_net is unavailable).
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end $$;
