-- FIKRA SELL · 0010 · Realtime, scheduled jobs, push dispatch

-- Realtime: RLS still applies to every change a client receives.
alter publication supabase_realtime add table public.messages, public.conversations, public.notifications;

-- Private configuration (never exposed through the API).
create table private.config (key text primary key, value text not null);
-- After deploying the "push" Edge Function, set (SQL editor, once):
--   insert into private.config values
--     ('push_url', 'https://<project-ref>.supabase.co/functions/v1/push'),
--     ('push_secret', '<same value as the PUSH_WEBHOOK_SECRET function secret>')
--   on conflict (key) do update set value = excluded.value;

create or replace function private.dispatch_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare url text; secret text;
begin
  select value into url from private.config where key = 'push_url';
  select value into secret from private.config where key = 'push_secret';
  if url is null or to_regnamespace('net') is null then return null; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    using url, jsonb_build_object('notification_id', new.id),
          jsonb_build_object('content-type', 'application/json', 'x-push-secret', secret);
  return null;
end $$;
create trigger notifications_push after insert on public.notifications
  for each row execute function private.dispatch_push();

-- Scheduled jobs (pg_cron is available on every Supabase project).
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('fikra-expire-ads', '*/15 * * * *', 'select private.expire_ads()');
    perform cron.schedule('fikra-housekeeping', '17 3 * * *', 'select private.housekeeping()');
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;
