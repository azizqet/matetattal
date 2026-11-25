-- =====================================================================
-- FAZZA — helper functions, triggers, privileges and Row Level Security
-- Error convention: functions raise exceptions whose message is a stable
-- code prefixed with FZ_ (mapped to localized text in the clients).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger drivers_touch before update on public.drivers for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger offers_touch before update on public.offers for each row execute function public.touch_updated_at();
create trigger tickets_touch before update on public.tickets for each row execute function public.touch_updated_at();

create or replace function public.distance_m(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns integer language sql immutable parallel safe as $$
  select round(2 * 6371000 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2) +
           cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
         )))::integer
$$;

-- Normalizes Kuwaiti mobile numbers to E.164 (+965XXXXXXXX). Returns null if invalid.
create or replace function public.normalize_kw_phone(raw text) returns text
language plpgsql immutable as $$
declare
  s text;
begin
  if raw is null then return null; end if;
  s := translate(raw, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  s := regexp_replace(s, '[^0-9+]', '', 'g');
  if s like '+965%' then s := substr(s, 5);
  elsif s like '00965%' then s := substr(s, 6);
  elsif s like '965%' and length(s) = 11 then s := substr(s, 4);
  end if;
  if s ~ '^[4569][0-9]{7}$' then return '+965' || s; end if;
  return null;
end $$;

create or replace function public.settings() returns public.app_settings
language sql stable security definer set search_path = public as $$
  select * from public.app_settings where id = 1
$$;

-- Kuwait local "today" boundaries (Asia/Kuwait, UTC+3, no DST)
create or replace function public.kw_day_start(ts timestamptz default now()) returns timestamptz
language sql stable as $$ select date_trunc('day', ts at time zone 'Asia/Kuwait') at time zone 'Asia/Kuwait' $$;
create or replace function public.kw_month_start(ts timestamptz default now()) returns timestamptz
language sql stable as $$ select date_trunc('month', ts at time zone 'Asia/Kuwait') at time zone 'Asia/Kuwait' $$;
create or replace function public.kw_year_start(ts timestamptz default now()) returns timestamptz
language sql stable as $$ select date_trunc('year', ts at time zone 'Asia/Kuwait') at time zone 'Asia/Kuwait' $$;

-- Commission in fils, integer arithmetic, rounded half-up. e.g. 1250 fils @ 15% = 187.5 -> 188.
create or replace function public.calc_commission_fils(fee_fils bigint, bps integer) returns bigint
language sql immutable parallel safe as $$
  select case when fee_fils <= 0 or bps <= 0 then 0 else (fee_fils * bps + 5000) / 10000 end
$$;

-- ---------------------------------------------------------------------
-- Rate limiting (fixed window). Raises FZ_RATE_LIMITED when exceeded.
-- ---------------------------------------------------------------------
create or replace function public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  return n;
end $$;

create or replace function public.enforce_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.hit_rate_limit(p_key, p_max, p_window_seconds) > p_max then
    raise exception 'FZ_RATE_LIMITED';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Identity & role helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin(roles public.admin_role[] default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a join public.profiles p on p.id = a.user_id
    where a.user_id = auth.uid() and p.status = 'active'
      and (roles is null or a.role = any(roles) or a.role = 'owner')
  )
$$;

create or replace function public.require_admin(roles public.admin_role[] default null) returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin(roles) then
    raise exception 'FZ_FORBIDDEN';
  end if;
  return auth.uid();
end $$;

-- Returns the caller's id and guarantees an active account.
create or replace function public.require_active_user() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  st public.account_status;
begin
  if uid is null then raise exception 'FZ_NOT_AUTHENTICATED'; end if;
  select status into st from public.profiles where id = uid;
  if st is null then raise exception 'FZ_PROFILE_MISSING'; end if;
  if st <> 'active' then raise exception 'FZ_ACCOUNT_SUSPENDED'; end if;
  return uid;
end $$;

create or replace function public.is_approved_driver(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.drivers d join public.profiles p on p.id = d.user_id
    where d.user_id = uid and d.status = 'approved' and p.status = 'active'
  )
$$;

-- Why a driver cannot receive new orders (null = can receive).
create or replace function public.driver_block_reason(uid uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  d public.drivers;
  p public.profiles;
  s public.app_settings := public.settings();
begin
  select * into p from public.profiles where id = uid;
  if p.id is null then return 'not_driver'; end if;
  if p.status <> 'active' then return 'account_suspended'; end if;
  select * into d from public.drivers where user_id = uid;
  if d.user_id is null then return 'not_driver'; end if;
  if d.status = 'pending' then return 'pending_review'; end if;
  if d.status = 'rejected' then return 'rejected'; end if;
  if d.status = 'suspended' then return 'driver_suspended'; end if;
  if not d.activation_paid then return 'activation_unpaid'; end if;
  if d.balance_fils >= s.debt_limit_fils then return 'debt_limit'; end if;
  return null;
end $$;

create or replace function public.driver_can_receive(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.driver_block_reason(uid) is null
$$;

create or replace function public.is_order_participant(p_order uuid, uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders o where o.id = p_order and (o.customer_id = uid or o.driver_id = uid))
$$;

-- ---------------------------------------------------------------------
-- Notifications & audit
-- ---------------------------------------------------------------------
create or replace function public.notify_user(p_user uuid, p_type text, p_title_ar text, p_title_en text,
                                              p_body_ar text default '', p_body_en text default '',
                                              p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
  values (p_user, p_type, p_title_ar, p_title_en, coalesce(p_body_ar, ''), coalesce(p_body_en, ''), coalesce(p_data, '{}'::jsonb));
end $$;

create or replace function public.notify_admins(p_type text, p_title_ar text, p_title_en text,
                                                p_body_ar text default '', p_body_en text default '',
                                                p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
  select a.user_id, p_type, p_title_ar, p_title_en, p_body_ar, p_body_en, p_data from public.admins a;
end $$;

create or replace function public.audit(p_action text, p_target_type text, p_target_id text,
                                        p_details jsonb default '{}'::jsonb, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (coalesce(p_actor, auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- Profile creation when an auth user is created (by the signup Edge Function)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ph text := public.normalize_kw_phone(new.phone);
  nm text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  loc text := coalesce(new.raw_user_meta_data ->> 'locale', 'ar');
begin
  if ph is null then
    raise exception 'FZ_INVALID_PHONE';
  end if;
  insert into public.profiles (id, full_name, phone, locale)
  values (new.id, coalesce(nm, 'FAZZA user'), ph, case when loc in ('ar', 'en') then loc else 'ar' end);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- Ledger: append-only + cached balance on drivers
-- ---------------------------------------------------------------------
create or replace function public.ledger_apply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.driver_id is not null then
    update public.drivers set balance_fils = balance_fils + new.amount_fils where user_id = new.driver_id;
  end if;
  return new;
end $$;
create trigger ledger_after_insert after insert on public.ledger_entries
  for each row execute function public.ledger_apply();

create or replace function public.forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'FZ_APPEND_ONLY';
end $$;

-- Ledger rows are immutable. The only permitted change is ON DELETE SET NULL of a referenced
-- account / order / receipt (amount and kind never change).
create or replace function public.ledger_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.amount_fils = old.amount_fils and new.kind = old.kind
     and new.created_at = old.created_at
     and (new.driver_id is not distinct from old.driver_id or new.driver_id is null)
     and (new.order_id is not distinct from old.order_id or new.order_id is null)
     and (new.receipt_id is not distinct from old.receipt_id or new.receipt_id is null)
     and new.note is not distinct from old.note then
    return new;
  end if;
  raise exception 'FZ_APPEND_ONLY';
end $$;
create trigger ledger_no_update before update or delete on public.ledger_entries
  for each row execute function public.ledger_guard();
create trigger audit_no_update before update or delete on public.audit_log
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------
-- Privileges: start from zero, then grant precisely.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.app_settings, public.governorates, public.areas to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, locale, avatar_path) on public.profiles to authenticated;
grant select on public.admins, public.drivers, public.driver_documents to authenticated;
grant select, insert, update, delete on public.saved_addresses to authenticated;
grant select on public.push_tokens to authenticated;
grant select on public.orders, public.offers, public.order_feed, public.order_events to authenticated;
grant select on public.driver_locations to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.ratings to authenticated;
grant select on public.payment_receipts, public.ledger_entries to authenticated;
grant select on public.promo_codes, public.promo_redemptions to authenticated;
grant select on public.tickets, public.ticket_messages to authenticated;
grant select on public.notifications to authenticated;
grant select on public.broadcasts, public.audit_log to authenticated;

grant execute on function public.distance_m(double precision, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.normalize_kw_phone(text) to anon, authenticated;
grant execute on function public.calc_commission_fils(bigint, integer) to anon, authenticated;
grant execute on function public.is_admin(public.admin_role[]) to anon, authenticated;
grant execute on function public.is_approved_driver(uuid) to anon;
grant execute on function public.is_approved_driver(uuid) to authenticated;
grant execute on function public.is_order_participant(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.governorates enable row level security;
alter table public.areas enable row level security;
alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.drivers enable row level security;
alter table public.driver_documents enable row level security;
alter table public.saved_addresses enable row level security;
alter table public.push_tokens enable row level security;
alter table public.deleted_accounts enable row level security;
alter table public.orders enable row level security;
alter table public.offers enable row level security;
alter table public.order_feed enable row level security;
alter table public.order_events enable row level security;
alter table public.driver_locations enable row level security;
alter table public.messages enable row level security;
alter table public.ratings enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.broadcasts enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

create policy settings_read on public.app_settings for select using (true);
create policy gov_read on public.governorates for select using (active or public.is_admin());
create policy areas_read on public.areas for select using (active or public.is_admin());

create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid() and status = 'active') with check (id = auth.uid());

create policy admins_read on public.admins for select using (user_id = auth.uid() or public.is_admin());
create policy drivers_read on public.drivers for select using (user_id = auth.uid() or public.is_admin());
create policy driver_docs_read on public.driver_documents for select
  using (driver_id = auth.uid() or public.is_admin(array['admin','support']::public.admin_role[]));

create policy addresses_own on public.saved_addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_tokens_own on public.push_tokens for select using (user_id = auth.uid());

create policy orders_read on public.orders for select
  using (customer_id = auth.uid() or driver_id = auth.uid() or public.is_admin());

create policy offers_read on public.offers for select
  using (driver_id = auth.uid()
         or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
         or public.is_admin());

create policy feed_read on public.order_feed for select
  using (public.is_approved_driver() or public.is_admin());

create policy events_read on public.order_events for select
  using (public.is_order_participant(order_id) or public.is_admin());

create policy locations_read on public.driver_locations for select
  using (driver_id = auth.uid()
         or exists (select 1 from public.orders o
                    where o.driver_id = driver_locations.driver_id and o.customer_id = auth.uid()
                      and o.status in ('accepted', 'picked_up')));

create policy messages_read on public.messages for select
  using (public.is_order_participant(order_id) or public.is_admin(array['admin','support']::public.admin_role[]));
create policy messages_insert on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
    and exists (select 1 from public.orders o
                where o.id = order_id and (o.customer_id = auth.uid() or o.driver_id = auth.uid())
                  and o.status in ('accepted', 'picked_up', 'delivered'))
    and (image_path is null or image_path like 'chat/' || order_id::text || '/' || auth.uid()::text || '/%')
    and read_at is null
  );

create policy ratings_read on public.ratings for select
  using (rater_id = auth.uid() or ratee_id = auth.uid() or public.is_admin());

create policy receipts_read on public.payment_receipts for select
  using (driver_id = auth.uid() or public.is_admin(array['admin','finance']::public.admin_role[]));
create policy ledger_read on public.ledger_entries for select
  using (driver_id = auth.uid() or public.is_admin(array['admin','finance']::public.admin_role[]));

create policy promo_admin_read on public.promo_codes for select using (public.is_admin());
create policy promo_red_read on public.promo_redemptions for select using (user_id = auth.uid() or public.is_admin());

create policy tickets_read on public.tickets for select
  using (user_id = auth.uid() or public.is_admin(array['admin','support']::public.admin_role[]));
create policy ticket_messages_read on public.ticket_messages for select
  using (exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
         or public.is_admin(array['admin','support']::public.admin_role[]));

create policy notifications_own on public.notifications for select using (user_id = auth.uid());

create policy broadcasts_admin on public.broadcasts for select using (public.is_admin());
create policy audit_admin on public.audit_log for select using (public.is_admin(array['admin']::public.admin_role[]));
-- deleted_accounts and rate_limits: no policies => no client access at all.
