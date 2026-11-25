-- =====================================================================
-- FAZZA — admin panel functions. Every mutation writes to audit_log.
-- Roles: owner (everything), admin (everything except managing admins),
--        finance (receipts, ledger, reports), support (users, drivers, tickets)
-- =====================================================================

create or replace function public.admin_me() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('user_id', a.user_id, 'role', a.role, 'full_name', p.full_name, 'phone', p.phone)
  from public.admins a join public.profiles p on p.id = a.user_id
  where a.user_id = auth.uid() and p.status = 'active'
$$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object(
    'customers', (select count(*) from public.profiles where status <> 'deleted'),
    'drivers_total', (select count(*) from public.drivers),
    'drivers_pending', (select count(*) from public.drivers where status = 'pending'),
    'drivers_approved', (select count(*) from public.drivers where status = 'approved'),
    'drivers_suspended', (select count(*) from public.drivers where status = 'suspended'),
    'drivers_online', (select count(*) from public.drivers where is_online),
    'drivers_blocked_debt', (select count(*) from public.drivers d where d.status = 'approved' and d.balance_fils >= (public.settings()).debt_limit_fils),
    'active_users_24h', (select count(*) from auth.users where last_sign_in_at >= now() - interval '24 hours'),
    'active_users_30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    'orders_open', (select count(*) from public.orders where status = 'open'),
    'orders_in_progress', (select count(*) from public.orders where status in ('accepted', 'picked_up', 'delivered')),
    'orders_completed', (select count(*) from public.orders where status = 'completed'),
    'orders_cancelled', (select count(*) from public.orders where status = 'cancelled'),
    'orders_expired', (select count(*) from public.orders where status = 'expired'),
    'orders_today', (select count(*) from public.orders where created_at >= public.kw_day_start()),
    'commission_today_fils', coalesce((select sum(amount_fils) from public.ledger_entries where kind = 'commission' and created_at >= public.kw_day_start()), 0),
    'commission_month_fils', coalesce((select sum(amount_fils) from public.ledger_entries where kind = 'commission' and created_at >= public.kw_month_start()), 0),
    'commission_year_fils', coalesce((select sum(amount_fils) from public.ledger_entries where kind = 'commission' and created_at >= public.kw_year_start()), 0),
    'collected_today_fils', coalesce((select sum(approved_amount_fils) from public.payment_receipts where status = 'approved' and reviewed_at >= public.kw_day_start()), 0),
    'collected_month_fils', coalesce((select sum(approved_amount_fils) from public.payment_receipts where status = 'approved' and reviewed_at >= public.kw_month_start()), 0),
    'collected_year_fils', coalesce((select sum(approved_amount_fils) from public.payment_receipts where status = 'approved' and reviewed_at >= public.kw_year_start()), 0),
    'outstanding_fils', coalesce((select sum(greatest(balance_fils, 0)) from public.drivers), 0),
    'receipts_pending', (select count(*) from public.payment_receipts where status = 'pending'),
    'tickets_open', (select count(*) from public.tickets where status in ('open', 'in_progress')),
    'gmv_month_fils', coalesce((select sum(delivery_fee_fils) from public.orders where status = 'completed' and completed_at >= public.kw_month_start()), 0)
  ) into r;
  return r;
end $$;

create or replace function public.admin_review_driver(p_driver uuid, p_decision text, p_reason text default null) returns public.driver_status
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.require_admin(array['admin','support']::public.admin_role[]);
  d public.drivers;
  new_status public.driver_status;
begin
  select * into d from public.drivers where user_id = p_driver for update;
  if d.user_id is null then raise exception 'FZ_NOT_FOUND'; end if;
  new_status := case p_decision
    when 'approve' then 'approved' when 'reject' then 'rejected'
    when 'suspend' then 'suspended' when 'reinstate' then 'approved' end;
  if new_status is null then raise exception 'FZ_INVALID_DECISION'; end if;
  if p_decision in ('reject', 'suspend') and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'FZ_REASON_REQUIRED';
  end if;
  update public.drivers set status = new_status, status_reason = nullif(trim(p_reason), ''),
    reviewed_by = actor, reviewed_at = now(),
    is_online = case when new_status = 'approved' then is_online else false end
  where user_id = p_driver;
  if p_decision = 'approve' then
    update public.driver_documents set status = 'approved' where driver_id = p_driver and status = 'pending';
  end if;
  perform public.audit('driver_' || p_decision, 'driver', p_driver::text, jsonb_build_object('reason', p_reason, 'from', d.status));
  perform public.notify_user(p_driver, 'driver_review',
    case new_status when 'approved' then 'تم قبول حسابك كمندوب' when 'rejected' then 'تعذّر قبول طلبك' else 'تم إيقاف حساب المندوب' end,
    case new_status when 'approved' then 'Your driver account is approved' when 'rejected' then 'Your application was not approved' else 'Your driver account is suspended' end,
    coalesce(p_reason, case when new_status = 'approved' and not d.activation_paid then 'ادفع رسوم التفعيل لبدء استقبال الطلبات' else '' end),
    coalesce(p_reason, case when new_status = 'approved' and not d.activation_paid then 'Pay the activation fee to start receiving orders' else '' end),
    jsonb_build_object('status', new_status));
  return new_status;
end $$;

create or replace function public.admin_set_document_status(p_doc uuid, p_status public.review_status, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin(array['admin','support']::public.admin_role[]);
  update public.driver_documents set status = p_status, note = p_note where id = p_doc;
  if not found then raise exception 'FZ_NOT_FOUND'; end if;
  perform public.audit('document_' || p_status, 'driver_document', p_doc::text, jsonb_build_object('note', p_note));
end $$;

create or replace function public.admin_set_user_status(p_user uuid, p_status public.account_status, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(array['admin','support']::public.admin_role[]);
begin
  if p_status = 'deleted' then raise exception 'FZ_INVALID_DECISION'; end if;
  if p_user = actor then raise exception 'FZ_FORBIDDEN'; end if;
  if exists (select 1 from public.admins where user_id = p_user and role = 'owner') and not public.is_admin(array['owner']::public.admin_role[]) then
    raise exception 'FZ_FORBIDDEN';
  end if;
  update public.profiles set status = p_status where id = p_user;
  if not found then raise exception 'FZ_NOT_FOUND'; end if;
  if p_status = 'suspended' then
    update public.drivers set is_online = false where user_id = p_user;
    update public.offers set status = 'withdrawn' where driver_id = p_user and status = 'pending';
  end if;
  perform public.audit('user_' || p_status, 'user', p_user::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_set_phone_verified(p_user uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin(array['admin','support']::public.admin_role[]);
  update public.profiles set phone_verified = p_verified, phone_verified_at = case when p_verified then now() end where id = p_user;
  if not found then raise exception 'FZ_NOT_FOUND'; end if;
  perform public.audit(case when p_verified then 'phone_verified' else 'phone_unverified' end, 'user', p_user::text);
end $$;

create or replace function public.admin_review_receipt(p_receipt uuid, p_decision text, p_approved_amount_fils integer default null,
                                                       p_note text default null)
returns public.review_status
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.require_admin(array['finance']::public.admin_role[]);
  r public.payment_receipts;
  amt integer;
begin
  select * into r from public.payment_receipts where id = p_receipt for update;
  if r.id is null then raise exception 'FZ_NOT_FOUND'; end if;
  if r.status <> 'pending' then raise exception 'FZ_ALREADY_REVIEWED'; end if;
  if p_decision = 'reject' then
    if nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'FZ_REASON_REQUIRED'; end if;
    update public.payment_receipts set status = 'rejected', review_note = p_note, reviewed_by = actor, reviewed_at = now() where id = r.id;
    perform public.notify_user(r.driver_id, 'receipt_rejected', 'تم رفض إيصال السداد', 'Payment receipt rejected', p_note, p_note,
      jsonb_build_object('receipt_id', r.id));
    perform public.audit('receipt_rejected', 'receipt', r.id::text, jsonb_build_object('note', p_note));
    return 'rejected';
  elsif p_decision <> 'approve' then
    raise exception 'FZ_INVALID_DECISION';
  end if;
  amt := coalesce(p_approved_amount_fils, r.amount_fils);
  if amt <= 0 or amt > 10000000 then raise exception 'FZ_INVALID_AMOUNT'; end if;
  update public.payment_receipts set status = 'approved', approved_amount_fils = amt, review_note = p_note,
    reviewed_by = actor, reviewed_at = now() where id = r.id;
  if r.purpose = 'activation_fee' then
    update public.drivers set activation_paid = true, activation_paid_at = now(),
      activation_fee_due_fils = greatest(activation_fee_due_fils - amt, 0)
    where user_id = r.driver_id;
  else
    insert into public.ledger_entries (driver_id, kind, amount_fils, receipt_id, note, created_by)
    values (r.driver_id, 'payment', -amt, r.id, 'Receipt approved', actor);
  end if;
  perform public.notify_user(r.driver_id, 'receipt_approved', 'تم تأكيد السداد', 'Payment confirmed',
    format('تم اعتماد %s د.ك', to_char(amt / 1000.0, 'FM9990.000')), format('KWD %s confirmed', to_char(amt / 1000.0, 'FM9990.000')),
    jsonb_build_object('receipt_id', r.id));
  perform public.audit('receipt_approved', 'receipt', r.id::text, jsonb_build_object('amount_fils', amt, 'purpose', r.purpose, 'driver_id', r.driver_id));
  return 'approved';
end $$;

create or replace function public.admin_ledger_entry(p_driver uuid, p_kind public.ledger_kind, p_amount_fils bigint, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.require_admin(array['finance']::public.admin_role[]);
  lid bigint;
begin
  if p_kind not in ('waiver', 'adjustment') then raise exception 'FZ_INVALID_DECISION'; end if;
  if p_kind = 'waiver' and p_amount_fils >= 0 then raise exception 'FZ_INVALID_AMOUNT'; end if;
  if p_amount_fils = 0 or abs(p_amount_fils) > 10000000 then raise exception 'FZ_INVALID_AMOUNT'; end if;
  if nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'FZ_REASON_REQUIRED'; end if;
  if not exists (select 1 from public.drivers where user_id = p_driver) then raise exception 'FZ_NOT_FOUND'; end if;
  insert into public.ledger_entries (driver_id, kind, amount_fils, note, created_by)
  values (p_driver, p_kind, p_amount_fils, p_note, actor) returning id into lid;
  perform public.audit('ledger_' || p_kind, 'driver', p_driver::text, jsonb_build_object('amount_fils', p_amount_fils, 'note', p_note));
  return lid;
end $$;

create or replace function public.admin_update_settings(p jsonb) returns public.app_settings
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.require_admin(array['admin']::public.admin_role[]);
  allowed text[] := array['activation_fee_fils','commission_bps','debt_limit_fils','min_offer_fils','max_offer_fils',
    'order_ttl_minutes','offer_ttl_minutes','max_active_orders_per_driver','auto_complete_hours','require_proof_photos',
    'nearby_radius_km','support_phone','support_whatsapp','support_hours_ar','support_hours_en','payment_instructions_ar',
    'payment_instructions_en','payment_link_url','account_deletion_url','terms_ar','terms_en','privacy_ar','privacy_en',
    'min_app_version','maintenance_mode','maintenance_message_ar','maintenance_message_en'];
  k text;
  old public.app_settings := public.settings();
  res public.app_settings;
begin
  for k in select jsonb_object_keys(p) loop
    if not (k = any(allowed)) then raise exception 'FZ_INVALID_SETTING:%', k; end if;
  end loop;
  update public.app_settings s set
    (activation_fee_fils, commission_bps, debt_limit_fils, min_offer_fils, max_offer_fils, order_ttl_minutes,
     offer_ttl_minutes, max_active_orders_per_driver, auto_complete_hours, require_proof_photos, nearby_radius_km,
     support_phone, support_whatsapp, support_hours_ar, support_hours_en, payment_instructions_ar, payment_instructions_en,
     payment_link_url, account_deletion_url, terms_ar, terms_en, privacy_ar, privacy_en, min_app_version,
     maintenance_mode, maintenance_message_ar, maintenance_message_en) =
    (select x.activation_fee_fils, x.commission_bps, x.debt_limit_fils, x.min_offer_fils, x.max_offer_fils, x.order_ttl_minutes,
            x.offer_ttl_minutes, x.max_active_orders_per_driver, x.auto_complete_hours, x.require_proof_photos, x.nearby_radius_km,
            x.support_phone, x.support_whatsapp, x.support_hours_ar, x.support_hours_en, x.payment_instructions_ar, x.payment_instructions_en,
            x.payment_link_url, x.account_deletion_url, x.terms_ar, x.terms_en, x.privacy_ar, x.privacy_en, x.min_app_version,
            x.maintenance_mode, x.maintenance_message_ar, x.maintenance_message_en
     from jsonb_populate_record(s, p) x),
    updated_at = now(), updated_by = actor
  where s.id = 1
  returning * into res;
  perform public.audit('settings_updated', 'settings', '1',
    jsonb_build_object('changes', p - array['terms_ar','terms_en','privacy_ar','privacy_en'],
                       'legal_changed', p ?| array['terms_ar','terms_en','privacy_ar','privacy_en'],
                       'before', jsonb_build_object('activation_fee_fils', old.activation_fee_fils, 'commission_bps', old.commission_bps, 'debt_limit_fils', old.debt_limit_fils)));
  return res;
end $$;

create or replace function public.admin_upsert_area(p_id integer, p_governorate smallint, p_name_ar text, p_name_en text,
                                                    p_lat double precision, p_lng double precision, p_active boolean default true)
returns integer language plpgsql security definer set search_path = public as $$
declare rid integer;
begin
  perform public.require_admin(array['admin']::public.admin_role[]);
  if p_id is null then
    insert into public.areas (governorate_id, name_ar, name_en, lat, lng, active)
    values (p_governorate, trim(p_name_ar), trim(p_name_en), p_lat, p_lng, p_active) returning id into rid;
  else
    update public.areas set governorate_id = p_governorate, name_ar = trim(p_name_ar), name_en = trim(p_name_en),
      lat = p_lat, lng = p_lng, active = p_active where id = p_id returning id into rid;
    if rid is null then raise exception 'FZ_NOT_FOUND'; end if;
  end if;
  perform public.audit('area_saved', 'area', rid::text, jsonb_build_object('name_en', p_name_en, 'active', p_active));
  return rid;
end $$;

create or replace function public.admin_upsert_governorate(p_id smallint, p_name_ar text, p_name_en text, p_sort smallint, p_active boolean)
returns smallint language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin(array['admin']::public.admin_role[]);
  insert into public.governorates (id, name_ar, name_en, sort, active) values (p_id, p_name_ar, p_name_en, p_sort, p_active)
  on conflict (id) do update set name_ar = excluded.name_ar, name_en = excluded.name_en, sort = excluded.sort, active = excluded.active;
  perform public.audit('governorate_saved', 'governorate', p_id::text, jsonb_build_object('name_en', p_name_en, 'active', p_active));
  return p_id;
end $$;

create or replace function public.admin_upsert_promo(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.require_admin(array['admin']::public.admin_role[]);
  pid uuid := (p ->> 'id')::uuid;
begin
  if pid is null then
    insert into public.promo_codes (code, kind, percent_off, credit_fils, max_redemptions, valid_from, valid_until, active, created_by)
    values (upper(trim(p ->> 'code')), (p ->> 'kind')::public.promo_kind, (p ->> 'percent_off')::integer, (p ->> 'credit_fils')::integer,
            (p ->> 'max_redemptions')::integer, coalesce((p ->> 'valid_from')::timestamptz, now()), (p ->> 'valid_until')::timestamptz,
            coalesce((p ->> 'active')::boolean, true), actor)
    returning id into pid;
  else
    update public.promo_codes set max_redemptions = (p ->> 'max_redemptions')::integer,
      valid_until = (p ->> 'valid_until')::timestamptz, active = coalesce((p ->> 'active')::boolean, active)
    where id = pid;
    if not found then raise exception 'FZ_NOT_FOUND'; end if;
  end if;
  perform public.audit('promo_saved', 'promo', pid::text, p);
  return pid;
end $$;

create or replace function public.admin_update_ticket(p_ticket uuid, p_status public.ticket_status, p_note text default null,
                                                      p_reply text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.require_admin(array['support']::public.admin_role[]);
  t public.tickets;
begin
  select * into t from public.tickets where id = p_ticket for update;
  if t.id is null then raise exception 'FZ_NOT_FOUND'; end if;
  update public.tickets set status = p_status, admin_note = coalesce(p_note, admin_note), handled_by = actor where id = p_ticket;
  if nullif(trim(coalesce(p_reply, '')), '') is not null then
    insert into public.ticket_messages (ticket_id, sender_id, from_staff, body) values (p_ticket, actor, true, trim(p_reply));
    perform public.notify_user(t.user_id, 'ticket_reply', 'ردّ من الدعم الفني', 'Support replied', left(p_reply, 140), left(p_reply, 140),
      jsonb_build_object('ticket_id', t.id));
  end if;
  perform public.audit('ticket_updated', 'ticket', p_ticket::text, jsonb_build_object('status', p_status));
end $$;

create or replace function public.admin_hide_rating(p_rating uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.ratings;
begin
  perform public.require_admin(array['support']::public.admin_role[]);
  select * into r from public.ratings where id = p_rating for update;
  if r.id is null then raise exception 'FZ_NOT_FOUND'; end if;
  if r.hidden = p_hidden then return; end if;
  update public.ratings set hidden = p_hidden where id = p_rating;
  -- hidden ratings do not count in the averages
  if r.ratee_role = 'driver' then
    update public.drivers set rating_sum = rating_sum + (case when p_hidden then -r.stars else r.stars end),
      rating_count = rating_count + (case when p_hidden then -1 else 1 end) where user_id = r.ratee_id;
  else
    update public.profiles set customer_rating_sum = customer_rating_sum + (case when p_hidden then -r.stars else r.stars end),
      customer_rating_count = customer_rating_count + (case when p_hidden then -1 else 1 end) where id = r.ratee_id;
  end if;
  perform public.audit(case when p_hidden then 'rating_hidden' else 'rating_restored' end, 'rating', p_rating::text);
end $$;

create or replace function public.admin_broadcast(p_audience text, p_user uuid, p_title_ar text, p_title_en text,
                                                  p_body_ar text, p_body_en text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.require_admin(array['admin','support']::public.admin_role[]);
  n integer;
  bid uuid;
begin
  if p_audience not in ('all', 'customers', 'drivers', 'user') then raise exception 'FZ_INVALID_DECISION'; end if;
  if p_audience = 'user' and p_user is null then raise exception 'FZ_NOT_FOUND'; end if;
  insert into public.broadcasts (audience, target_user_id, title_ar, title_en, body_ar, body_en, created_by)
  values (p_audience, p_user, p_title_ar, p_title_en, p_body_ar, p_body_en, actor) returning id into bid;
  insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
  select p.id, 'broadcast', p_title_ar, p_title_en, p_body_ar, p_body_en, jsonb_build_object('broadcast_id', bid)
  from public.profiles p
  where p.status = 'active'
    and (p_audience = 'all'
      or (p_audience = 'user' and p.id = p_user)
      or (p_audience = 'drivers' and exists (select 1 from public.drivers d where d.user_id = p.id and d.status = 'approved'))
      or (p_audience = 'customers' and not exists (select 1 from public.drivers d where d.user_id = p.id)));
  get diagnostics n = row_count;
  update public.broadcasts set recipients = n where id = bid;
  perform public.audit('broadcast_sent', 'broadcast', bid::text, jsonb_build_object('audience', p_audience, 'recipients', n));
  return n;
end $$;

create or replace function public.admin_cancel_order(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.require_admin(array['admin','support']::public.admin_role[]);
  o public.orders;
begin
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'FZ_REASON_REQUIRED'; end if;
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'FZ_NOT_FOUND'; end if;
  if o.status in ('completed', 'cancelled', 'expired') then raise exception 'FZ_INVALID_TRANSITION'; end if;
  update public.orders set status = 'cancelled', cancelled_at = now(), cancelled_by = actor, cancel_reason = 'admin: ' || p_reason where id = o.id;
  update public.offers set status = 'cancelled' where order_id = o.id and status in ('pending', 'accepted');
  delete from public.order_feed where order_id = o.id;
  if o.driver_id is not null and not exists (select 1 from public.orders where driver_id = o.driver_id and status in ('accepted','picked_up') and id <> o.id) then
    delete from public.driver_locations where driver_id = o.driver_id;
  end if;
  insert into public.order_events (order_id, actor_id, from_status, to_status, note) values (o.id, actor, o.status, 'cancelled', 'admin: ' || p_reason);
  perform public.notify_user(o.customer_id, 'order_cancelled', 'تم إلغاء الطلب من الإدارة', 'Order cancelled by FAZZA', p_reason, p_reason, jsonb_build_object('order_id', o.id));
  perform public.notify_user(o.driver_id, 'order_cancelled', 'تم إلغاء الطلب من الإدارة', 'Order cancelled by FAZZA', p_reason, p_reason, jsonb_build_object('order_id', o.id));
  perform public.audit('order_cancelled', 'order', o.id::text, jsonb_build_object('reason', p_reason, 'from', o.status));
end $$;

create or replace function public.admin_set_admin(p_user uuid, p_role public.admin_role) returns void
language plpgsql security definer set search_path = public as $$
declare actor uuid := public.require_admin(array['owner']::public.admin_role[]);
begin
  if p_user = actor then raise exception 'FZ_FORBIDDEN'; end if;
  if p_role is null then
    delete from public.admins where user_id = p_user;
  else
    insert into public.admins (user_id, role, created_by) values (p_user, p_role, actor)
    on conflict (user_id) do update set role = excluded.role;
  end if;
  perform public.audit('admin_role_set', 'user', p_user::text, jsonb_build_object('role', p_role));
end $$;

-- Live locations of drivers on active orders (access is audited).
create or replace function public.admin_active_driver_locations()
returns table (driver_id uuid, full_name text, phone text, lat double precision, lng double precision,
               updated_at timestamptz, order_id uuid, order_code text, order_status public.order_status)
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin(array['admin','support']::public.admin_role[]);
  perform public.audit('locations_viewed', 'driver_locations', null);
  return query
  select l.driver_id, p.full_name, p.phone, l.lat, l.lng, l.updated_at, o.id, o.code, o.status
  from public.driver_locations l
  join public.profiles p on p.id = l.driver_id
  left join lateral (select * from public.orders x where x.driver_id = l.driver_id and x.status in ('accepted','picked_up')
                     order by x.accepted_at desc limit 1) o on true;
end $$;

create or replace function public.admin_financial_report(p_from date, p_to date)
returns table (day date, orders_completed bigint, gross_fees_fils bigint, commission_fils bigint,
               commission_collected_fils bigint, activation_collected_fils bigint, cancelled bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin(array['finance']::public.admin_role[]);
  if p_to < p_from or p_to - p_from > 366 then raise exception 'FZ_INVALID_RANGE'; end if;
  return query
  with days as (select generate_series(p_from, p_to, interval '1 day')::date as d)
  select days.d,
    (select count(*) from public.orders o where o.status = 'completed' and (o.completed_at at time zone 'Asia/Kuwait')::date = days.d),
    coalesce((select sum(o.delivery_fee_fils) from public.orders o where o.status = 'completed' and (o.completed_at at time zone 'Asia/Kuwait')::date = days.d), 0)::bigint,
    coalesce((select sum(l.amount_fils) from public.ledger_entries l where l.kind = 'commission' and (l.created_at at time zone 'Asia/Kuwait')::date = days.d), 0)::bigint,
    coalesce((select sum(r.approved_amount_fils) from public.payment_receipts r where r.status = 'approved' and r.purpose = 'commission' and (r.reviewed_at at time zone 'Asia/Kuwait')::date = days.d), 0)::bigint,
    coalesce((select sum(r.approved_amount_fils) from public.payment_receipts r where r.status = 'approved' and r.purpose = 'activation_fee' and (r.reviewed_at at time zone 'Asia/Kuwait')::date = days.d), 0)::bigint,
    (select count(*) from public.orders o where o.status = 'cancelled' and (o.cancelled_at at time zone 'Asia/Kuwait')::date = days.d)
  from days order by days.d;
end $$;

-- Search users for the admin panel (profiles + driver info).
create or replace function public.admin_search_users(p_query text default null, p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, full_name text, phone text, phone_verified boolean, status public.account_status,
               created_at timestamptz, driver_status public.driver_status, balance_fils bigint, is_admin boolean, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
  select p.id, p.full_name, p.phone, p.phone_verified, p.status, p.created_at, d.status, d.balance_fils,
         exists (select 1 from public.admins a where a.user_id = p.id), u.last_sign_in_at
  from public.profiles p
  left join public.drivers d on d.user_id = p.id
  left join auth.users u on u.id = p.id
  where p_query is null or p_query = '' or p.full_name ilike '%' || p_query || '%' or p.phone like '%' || regexp_replace(p_query, '[^0-9]', '', 'g') || '%'
  order by p.created_at desc
  limit least(p_limit, 200) offset greatest(p_offset, 0);
end $$;

-- Used by Edge Functions (service role) to log actions performed with the admin API.
create or replace function public.service_audit(p_actor uuid, p_action text, p_target_type text, p_target_id text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, details) values (p_actor, p_action, p_target_type, p_target_id, p_details)
$$;

grant execute on function
  public.admin_me(), public.admin_stats(),
  public.admin_review_driver(uuid, text, text),
  public.admin_set_document_status(uuid, public.review_status, text),
  public.admin_set_user_status(uuid, public.account_status, text),
  public.admin_set_phone_verified(uuid, boolean),
  public.admin_review_receipt(uuid, text, integer, text),
  public.admin_ledger_entry(uuid, public.ledger_kind, bigint, text),
  public.admin_update_settings(jsonb),
  public.admin_upsert_area(integer, smallint, text, text, double precision, double precision, boolean),
  public.admin_upsert_governorate(smallint, text, text, smallint, boolean),
  public.admin_upsert_promo(jsonb),
  public.admin_update_ticket(uuid, public.ticket_status, text, text),
  public.admin_hide_rating(uuid, boolean),
  public.admin_broadcast(text, uuid, text, text, text, text),
  public.admin_cancel_order(uuid, text),
  public.admin_set_admin(uuid, public.admin_role),
  public.admin_active_driver_locations(),
  public.admin_financial_report(date, date),
  public.admin_search_users(text, integer, integer)
to authenticated;
grant execute on function public.service_audit(uuid, text, text, text, jsonb) to service_role;
