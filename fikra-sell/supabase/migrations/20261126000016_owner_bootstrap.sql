-- FIKRA SELL · 0016 · One-time owner bootstrap.
-- The owner's email is NOT stored in the repository: it is set on the live
-- database only, e.g.  insert into private.config(key, value) values ('owner_email', '<email>');
-- When that email signs up (and no owner exists yet), the account is confirmed
-- and promoted to owner. Afterwards the config row is removed (one-time).
create or replace function private.bootstrap_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target text; prev text;
begin
  select lower(value) into target from private.config where key = 'owner_email';
  if target is null or lower(new.email) <> target then return null; end if;
  if exists (select 1 from public.profiles where role = 'owner') then return null; end if;
  prev := private.elevate();
  update public.profiles set role = 'owner' where id = new.id;
  perform private.restore(prev);
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = new.id;
  delete from private.config where key = 'owner_email';
  return null;
end $$;
revoke all on function private.bootstrap_owner() from public, anon, authenticated;

drop trigger if exists zz_bootstrap_owner on auth.users;
create trigger zz_bootstrap_owner after insert on auth.users
  for each row execute function private.bootstrap_owner();
