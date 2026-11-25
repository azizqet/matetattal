-- FIKRA SELL · 0008 · Storage buckets & policies
-- Paths:
--   ad-images/<user_id>/<ad_id>/<random>.jpg   (public read)
--   avatars/<user_id>/<random>.jpg             (public read)
--   chat-images/<conversation_id>/<user_id>/<random>.jpg (participants only)
--   banners/<random>.jpg                       (public read, staff write)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('ad-images', 'ad-images', true, 6291456, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat-images', 'chat-images', false, 6291456, array['image/jpeg', 'image/png', 'image/webp']),
  ('banners', 'banners', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.storage_user_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and not exists (select 1 from public.profiles where id = auth.uid() and is_banned)
$$;

create policy "fikra public read" on storage.objects for select
  using (bucket_id in ('ad-images', 'avatars', 'banners'));

create policy "fikra own uploads" on storage.objects for insert to authenticated with check (
  bucket_id in ('ad-images', 'avatars')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.storage_user_ok())
  and lower(name) ~ '\.(jpg|jpeg|png|webp)$');

create policy "fikra own update" on storage.objects for update to authenticated
  using (bucket_id in ('ad-images', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "fikra own delete" on storage.objects for delete to authenticated using (
  (bucket_id in ('ad-images', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text)
  or (bucket_id = 'ad-images' and (select public.has_perm('ads')))
  or (bucket_id = 'chat-images' and (storage.foldername(name))[2] = (select auth.uid())::text));

create policy "fikra chat read" on storage.objects for select to authenticated using (
  bucket_id = 'chat-images'
  and ((select public.is_participant(((storage.foldername(name))[1])::uuid)) or (select public.has_perm('reports'))));

create policy "fikra chat upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (select public.is_participant(((storage.foldername(name))[1])::uuid))
  and (select private.storage_user_ok())
  and lower(name) ~ '\.(jpg|jpeg|png|webp)$');

create policy "fikra banners write" on storage.objects for all to authenticated
  using (bucket_id = 'banners' and (select public.has_perm('banners')))
  with check (bucket_id = 'banners' and (select public.has_perm('banners')));
