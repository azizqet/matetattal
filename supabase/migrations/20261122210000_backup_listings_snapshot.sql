-- نسخة احتياطية قبل إغلاق ثغرة listings — طُبِّقت 2026-11-22
create schema if not exists backup_20261122p3;
revoke all on schema backup_20261122p3 from public, anon, authenticated;
create table backup_20261122p3.listings as select * from public.listings;
create table backup_20261122p3.listing_reports as select * from public.listing_reports;
create table backup_20261122p3.function_grants as
  select p.proname, pg_get_function_identity_arguments(p.oid) args, p.proacl::text acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('create_listing','bump_listing','delete_listing','report_listing','track_listing');
