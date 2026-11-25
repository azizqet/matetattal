-- =====================================================================
-- FAZZA — storage buckets & policies, realtime publication, push webhook
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('driver-docs', 'driver-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('order-files', 'order-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.can_read_order_file(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  seg text[] := string_to_array(p_name, '/');
  oid uuid;
  o public.orders;
begin
  if auth.uid() is null then return false; end if;
  if public.is_admin(array['admin','support']::public.admin_role[]) then return true; end if;
  if seg[1] = 'orders' then
    if seg[2] = auth.uid()::text then return true; end if;
    oid := seg[3]::uuid;
  elsif seg[1] in ('chat', 'proof') then
    oid := seg[2]::uuid;
  else
    return false;
  end if;
  select * into o from public.orders where id = oid;
  if o.id is null then return false; end if;
  if o.customer_id = auth.uid() or o.driver_id = auth.uid() then return true; end if;
  -- approved drivers may view the photos of an open order to price it
  return seg[1] = 'orders' and o.status = 'open' and public.is_approved_driver();
exception when invalid_text_representation then
  return false;
end $$;

create or replace function public.can_write_order_file(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  seg text[] := string_to_array(p_name, '/');
begin
  if auth.uid() is null or p_name like '%..%' or cardinality(seg) < 4 then return false; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active') then return false; end if;
  if seg[1] = 'orders' then
    return seg[2] = auth.uid()::text and seg[3] ~ '^[0-9a-f-]{36}$';
  elsif seg[1] in ('chat', 'proof') then
    return seg[3] = auth.uid()::text and public.is_order_participant(seg[2]::uuid);
  end if;
  return false;
exception when invalid_text_representation then
  return false;
end $$;

grant execute on function public.can_read_order_file(text), public.can_write_order_file(text) to authenticated;

-- driver documents: owner uploads into "<uid>/...", staff can read. Never public.
create policy "driver-docs insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'driver-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "driver-docs read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'driver-docs' and ((storage.foldername(name))[1] = auth.uid()::text
         or public.is_admin(array['admin','support']::public.admin_role[])));

create policy "receipts insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts read own or finance" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text
         or public.is_admin(array['admin','finance']::public.admin_role[])));

create policy "order-files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'order-files' and public.can_write_order_file(name));
create policy "order-files read" on storage.objects for select to authenticated
  using (bucket_id = 'order-files' and public.can_read_order_file(name));

create policy "avatars insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars read" on storage.objects for select using (bucket_id = 'avatars');

-- ---------------------------------------------------------------------
-- Realtime (postgres_changes respects RLS)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['orders','offers','order_feed','messages','driver_locations','notifications','drivers',
                           'payment_receipts','tickets','ticket_messages'] loop
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
exception when undefined_object then
  raise notice 'supabase_realtime publication not found';
end $$;
alter table public.orders replica identity full;
alter table public.offers replica identity full;

-- ---------------------------------------------------------------------
-- Push: every notification row is forwarded to the push-dispatch Edge Function.
-- Configure once per project (see docs/SETUP.md):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/push-dispatch', 'push_dispatch_url');
--   select vault.create_secret('<random secret>', 'push_webhook_secret');
-- ---------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

create or replace function public.forward_notification_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  url text;
  secret text;
begin
  begin
    select decrypted_secret into url from vault.decrypted_secrets where name = 'push_dispatch_url';
    select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  exception when others then
    return new;
  end;
  if url is null or secret is null then return new; end if;
  if not exists (select 1 from public.push_tokens where user_id = new.user_id) then return new; end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-fazza-webhook-secret', secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'push forward failed: %', sqlerrm;
  return new;
end $$;

create trigger notifications_push after insert on public.notifications
  for each row execute function public.forward_notification_push();
