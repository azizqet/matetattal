-- FIKRA SELL · 0013 · Push webhook secret kept inside the database.
-- The secret is generated here, stored in private.config (never exposed via the
-- API) and verified by the "push" Edge Function through a service-role-only RPC.
insert into private.config (key, value)
values ('push_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

create or replace function public.verify_push_secret(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select value = p_secret from private.config where key = 'push_secret'), false)
$$;
revoke execute on function public.verify_push_secret(text) from public, anon, authenticated;
grant execute on function public.verify_push_secret(text) to service_role;
