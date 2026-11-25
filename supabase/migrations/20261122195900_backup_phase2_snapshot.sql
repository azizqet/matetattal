-- نسخة احتياطية قبل المرحلة 2 (مخطط خاص غير مكشوف للـ API) — طُبِّقت 2026-11-22
create schema if not exists backup_20261122p2;
revoke all on schema backup_20261122p2 from public, anon, authenticated;
create table backup_20261122p2.profiles as select * from public.profiles;
create table backup_20261122p2.terms_acceptances as select * from public.terms_acceptances;
create table backup_20261122p2.companies as select * from public.companies;
create table backup_20261122p2.notifications as select * from public.notifications;
create table backup_20261122p2.function_defs as
  select p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('handle_new_user');
create table backup_20261122p2.constraint_defs as
  select conname, pg_get_constraintdef(oid) def from pg_constraint where conrelid = 'public.terms_acceptances'::regclass;
