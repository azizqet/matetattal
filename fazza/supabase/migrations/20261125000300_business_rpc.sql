-- =====================================================================
-- FAZZA — business logic (server-side, SECURITY DEFINER, validated)
-- Every state change of orders, offers and money happens here.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profile / mode
-- ---------------------------------------------------------------------
create or replace function public.set_active_mode(p_mode public.app_mode) returns public.app_mode
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user();
begin
  if p_mode = 'driver' and not exists (select 1 from public.drivers where user_id = uid) then
    raise exception 'FZ_NOT_DRIVER';
  end if;
  if p_mode = 'customer' then
    update public.drivers set is_online = false, online_changed_at = now() where user_id = uid and is_online;
  end if;
  update public.profiles set active_mode = p_mode where id = uid;
  return p_mode;
end $$;

create or replace function public.clear_must_change_password() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set must_change_password = false where id = auth.uid();
end $$;

create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user();
begin
  perform public.enforce_rate_limit('push:' || uid, 20, 3600);
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, uid, p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create or replace function public.unregister_push_token(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end $$;

create or replace function public.mark_notifications_read(p_ids bigint[] default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
end $$;

-- ---------------------------------------------------------------------
-- Driver registration & status
-- ---------------------------------------------------------------------
create or replace function public.register_driver(p_vehicle_type public.vehicle_type, p_vehicle_model text,
                                                  p_plate text, p_documents jsonb)
returns public.driver_status
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  existing public.drivers;
  s public.app_settings := public.settings();
  doc jsonb;
  k public.document_kind;
  kinds public.document_kind[] := '{}';
  required public.document_kind[] := array['photo','civil_id_front','civil_id_back','driving_license','vehicle_registration']::public.document_kind[];
  ph text;
  carried bigint;
  plate text := upper(trim(regexp_replace(coalesce(p_plate, ''), '\s+', ' ', 'g')));
begin
  perform public.enforce_rate_limit('driver_reg:' || uid, 5, 86400);
  select * into existing from public.drivers where user_id = uid for update;
  if existing.user_id is not null and existing.status in ('pending', 'approved', 'suspended') then
    raise exception 'FZ_DRIVER_EXISTS';
  end if;
  if char_length(plate) < 2 or char_length(plate) > 20 then raise exception 'FZ_INVALID_PLATE'; end if;
  if jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) > 12 then
    raise exception 'FZ_INVALID_DOCUMENTS';
  end if;
  for doc in select * from jsonb_array_elements(p_documents) loop
    k := (doc ->> 'kind')::public.document_kind;
    if (doc ->> 'path') is null or (doc ->> 'path') not like uid::text || '/%' or (doc ->> 'path') like '%..%' then
      raise exception 'FZ_INVALID_DOCUMENT_PATH';
    end if;
    kinds := kinds || k;
  end loop;
  if not (kinds @> required) then raise exception 'FZ_MISSING_DOCUMENTS'; end if;

  if existing.user_id is null then
    insert into public.drivers (user_id, vehicle_type, vehicle_model, plate_number, activation_fee_due_fils)
    values (uid, p_vehicle_type, nullif(trim(p_vehicle_model), ''), plate, s.activation_fee_fils);
    -- carry dues of a previously deleted account with the same phone
    select phone into ph from public.profiles where id = uid;
    select outstanding_fils into carried from public.deleted_accounts
      where phone_hash = encode(extensions.digest(ph, 'sha256'), 'hex');
    if coalesce(carried, 0) > 0 then
      insert into public.ledger_entries (driver_id, kind, amount_fils, note)
      values (uid, 'carried_debt', carried, 'Outstanding dues from a previously deleted account');
      delete from public.deleted_accounts where phone_hash = encode(extensions.digest(ph, 'sha256'), 'hex');
    end if;
  else
    update public.drivers set status = 'pending', status_reason = null, vehicle_type = p_vehicle_type,
      vehicle_model = nullif(trim(p_vehicle_model), ''), plate_number = plate, reviewed_at = null, reviewed_by = null
    where user_id = uid;
    delete from public.driver_documents where driver_id = uid;
  end if;

  insert into public.driver_documents (driver_id, kind, storage_path)
  select uid, (d ->> 'kind')::public.document_kind, d ->> 'path' from jsonb_array_elements(p_documents) d;

  update public.profiles set active_mode = 'driver' where id = uid;
  perform public.notify_admins('driver_application', 'طلب تسجيل مندوب جديد', 'New driver application',
    '', '', jsonb_build_object('driver_id', uid));
  return 'pending';
exception when unique_violation then
  raise exception 'FZ_PLATE_TAKEN';
end $$;

create or replace function public.set_online(p_online boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  reason text;
begin
  if not exists (select 1 from public.drivers where user_id = uid) then raise exception 'FZ_NOT_DRIVER'; end if;
  if p_online then
    reason := public.driver_block_reason(uid);
    if reason is not null then raise exception 'FZ_CANNOT_RECEIVE:%', reason; end if;
  end if;
  update public.drivers set is_online = p_online, online_changed_at = now() where user_id = uid;
  return jsonb_build_object('is_online', p_online);
end $$;

create or replace function public.driver_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d public.drivers;
  s public.app_settings := public.settings();
  r jsonb;
begin
  select * into d from public.drivers where user_id = uid;
  if d.user_id is null then raise exception 'FZ_NOT_DRIVER'; end if;
  select jsonb_build_object(
    'status', d.status,
    'status_reason', d.status_reason,
    'is_online', d.is_online,
    'can_receive', public.driver_block_reason(uid) is null,
    'block_reason', public.driver_block_reason(uid),
    'balance_fils', d.balance_fils,
    'debt_limit_fils', s.debt_limit_fils,
    'commission_bps', s.commission_bps,
    'activation_paid', d.activation_paid,
    'activation_fee_due_fils', d.activation_fee_due_fils,
    'vehicle_type', d.vehicle_type,
    'plate_number', d.plate_number,
    'rating_avg', case when d.rating_count > 0 then round(d.rating_sum::numeric / d.rating_count, 2) else null end,
    'rating_count', d.rating_count,
    'completed_count', d.completed_count,
    'cancelled_count', d.cancelled_count,
    'total_earned_fils', d.total_earned_fils,
    'today_earned_fils', coalesce((select sum(delivery_fee_fils) from public.orders where driver_id = uid and status = 'completed' and completed_at >= public.kw_day_start()), 0),
    'month_earned_fils', coalesce((select sum(delivery_fee_fils) from public.orders where driver_id = uid and status = 'completed' and completed_at >= public.kw_month_start()), 0),
    'today_orders', (select count(*) from public.orders where driver_id = uid and status = 'completed' and completed_at >= public.kw_day_start()),
    'month_orders', (select count(*) from public.orders where driver_id = uid and status = 'completed' and completed_at >= public.kw_month_start()),
    'today_commission_fils', coalesce((select sum(amount_fils) from public.ledger_entries where driver_id = uid and kind = 'commission' and created_at >= public.kw_day_start()), 0),
    'month_commission_fils', coalesce((select sum(amount_fils) from public.ledger_entries where driver_id = uid and kind = 'commission' and created_at >= public.kw_month_start()), 0),
    'paid_total_fils', coalesce((select -sum(amount_fils) from public.ledger_entries where driver_id = uid and kind = 'payment'), 0),
    'active_orders', (select count(*) from public.orders where driver_id = uid and status in ('accepted', 'picked_up', 'delivered')),
    'pending_receipts', (select count(*) from public.payment_receipts where driver_id = uid and status = 'pending')
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
create or replace function public.create_order(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  s public.app_settings := public.settings();
  oid uuid := (p ->> 'id')::uuid;
  existing public.orders;
  imgs text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'image_paths', '[]'::jsonb))), '{}');
  img text;
  plat double precision := (p #>> '{pickup,lat}')::double precision;
  plng double precision := (p #>> '{pickup,lng}')::double precision;
  dlat double precision := (p #>> '{dropoff,lat}')::double precision;
  dlng double precision := (p #>> '{dropoff,lng}')::double precision;
  rphone text := nullif(p ->> 'recipient_phone', '');
begin
  if oid is null then raise exception 'FZ_INVALID_ORDER'; end if;
  -- Idempotency: a retry after a dropped connection returns the same order.
  select * into existing from public.orders where id = oid;
  if existing.id is not null then
    if existing.customer_id = uid then return existing.id; end if;
    raise exception 'FZ_INVALID_ORDER';
  end if;
  if s.maintenance_mode then raise exception 'FZ_MAINTENANCE'; end if;
  perform public.enforce_rate_limit('order:' || uid, 10, 3600);
  if (select count(*) from public.orders where customer_id = uid and status = 'open') >= 5 then
    raise exception 'FZ_TOO_MANY_OPEN_ORDERS';
  end if;
  foreach img in array imgs loop
    if img not like 'orders/' || uid::text || '/' || oid::text || '/%' or img like '%..%' then
      raise exception 'FZ_INVALID_IMAGE_PATH';
    end if;
  end loop;
  if rphone is not null then
    rphone := public.normalize_kw_phone(rphone);
    if rphone is null then raise exception 'FZ_INVALID_PHONE'; end if;
  end if;
  if plat is null or plng is null or dlat is null or dlng is null then raise exception 'FZ_INVALID_LOCATION'; end if;
  if public.distance_m(plat, plng, dlat, dlng) > 250000 then raise exception 'FZ_INVALID_LOCATION'; end if;

  insert into public.orders (id, customer_id, category, details,
    pickup_lat, pickup_lng, pickup_address, pickup_notes, pickup_area_id,
    dropoff_lat, dropoff_lng, dropoff_address, dropoff_notes, dropoff_area_id,
    recipient_name, recipient_phone, purchase_estimate_fils, distance_m, image_paths, expires_at)
  values (oid, uid, coalesce((p ->> 'category')::public.order_category, 'parcel'), trim(p ->> 'details'),
    plat, plng, trim(p #>> '{pickup,address}'), nullif(trim(p #>> '{pickup,notes}'), ''), (p #>> '{pickup,area_id}')::integer,
    dlat, dlng, trim(p #>> '{dropoff,address}'), nullif(trim(p #>> '{dropoff,notes}'), ''), (p #>> '{dropoff,area_id}')::integer,
    nullif(trim(p ->> 'recipient_name'), ''), rphone, (p ->> 'purchase_estimate_fils')::integer,
    public.distance_m(plat, plng, dlat, dlng), imgs, now() + make_interval(mins => s.order_ttl_minutes));

  insert into public.order_feed (order_id, category, pickup_area_id, dropoff_area_id, approx_pickup_lat, approx_pickup_lng, distance_m)
  select id, category, pickup_area_id, dropoff_area_id, round(pickup_lat::numeric, 3), round(pickup_lng::numeric, 3), distance_m
  from public.orders where id = oid;

  insert into public.order_events (order_id, actor_id, to_status) values (oid, uid, 'open');

  -- Push to online drivers who can currently receive orders.
  insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
  select d.user_id, 'new_order', 'طلب توصيل جديد', 'New delivery request',
         'قدّم عرض سعرك الآن', 'Send your price offer now', jsonb_build_object('order_id', oid)
  from public.drivers d
  where d.is_online and d.user_id <> uid and public.driver_can_receive(d.user_id)
  limit 500;

  return oid;
end $$;

-- Open orders for drivers: no recipient data and an approximate drop-off only.
create or replace function public.driver_open_orders(p_lat double precision default null, p_lng double precision default null)
returns table (id uuid, code text, category public.order_category, details text,
               pickup_address text, pickup_lat double precision, pickup_lng double precision, pickup_area_id integer,
               dropoff_area_id integer, dropoff_approx_lat double precision, dropoff_approx_lng double precision,
               distance_m integer, distance_to_pickup_m integer, purchase_estimate_fils integer,
               image_paths text[], offers_count bigint, my_offer_id uuid, my_offer_fils integer,
               created_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s public.app_settings := public.settings();
begin
  if not public.is_approved_driver(uid) then raise exception 'FZ_NOT_APPROVED_DRIVER'; end if;
  return query
  select o.id, o.code, o.category, o.details, o.pickup_address, o.pickup_lat, o.pickup_lng, o.pickup_area_id,
         o.dropoff_area_id, round(o.dropoff_lat::numeric, 2)::double precision, round(o.dropoff_lng::numeric, 2)::double precision,
         o.distance_m,
         case when p_lat is null then null else public.distance_m(p_lat, p_lng, o.pickup_lat, o.pickup_lng) end,
         o.purchase_estimate_fils, o.image_paths,
         (select count(*) from public.offers x where x.order_id = o.id and x.status = 'pending'),
         mo.id, mo.price_fils, o.created_at, o.expires_at
  from public.orders o
  left join lateral (select x.id, x.price_fils from public.offers x
                     where x.order_id = o.id and x.driver_id = uid and x.status = 'pending' limit 1) mo on true
  where o.status = 'open' and o.expires_at > now() and o.customer_id is distinct from uid
    and (p_lat is null or public.distance_m(p_lat, p_lng, o.pickup_lat, o.pickup_lng) <= s.nearby_radius_km * 1000)
  order by case when p_lat is null then 0 else public.distance_m(p_lat, p_lng, o.pickup_lat, o.pickup_lng) end, o.created_at desc
  limit 100;
end $$;

-- Full order details for a participant (or limited view for an approved driver while open).
create or replace function public.get_order(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o public.orders;
  cp public.profiles;
  dp public.profiles;
  d public.drivers;
  res jsonb;
begin
  select * into o from public.orders where id = p_order;
  if o.id is null then raise exception 'FZ_NOT_FOUND'; end if;
  if o.customer_id = uid or o.driver_id = uid or public.is_admin() then
    res := to_jsonb(o);
    res := res || jsonb_build_object('role', case when o.customer_id = uid then 'customer' when o.driver_id = uid then 'driver' else 'admin' end);
    if o.driver_id is not null then
      select * into dp from public.profiles where id = o.driver_id;
      select * into d from public.drivers where user_id = o.driver_id;
      res := res || jsonb_build_object('driver', jsonb_build_object(
        'id', dp.id, 'full_name', dp.full_name, 'phone', dp.phone, 'avatar_path', dp.avatar_path,
        'vehicle_type', d.vehicle_type, 'vehicle_model', d.vehicle_model, 'plate_number', d.plate_number,
        'rating_avg', case when d.rating_count > 0 then round(d.rating_sum::numeric / d.rating_count, 2) end,
        'rating_count', d.rating_count, 'completed_count', d.completed_count));
    end if;
    if o.driver_id = uid or public.is_admin() then
      select * into cp from public.profiles where id = o.customer_id;
      res := res || jsonb_build_object('customer', jsonb_build_object(
        'id', cp.id, 'full_name', cp.full_name, 'phone', cp.phone,
        'rating_avg', case when cp.customer_rating_count > 0 then round(cp.customer_rating_sum::numeric / cp.customer_rating_count, 2) end,
        'rating_count', cp.customer_rating_count));
    end if;
    res := res || jsonb_build_object('my_rating',
      (select to_jsonb(r) from public.ratings r where r.order_id = o.id and r.rater_id = uid));
    return res;
  end if;
  if o.status = 'open' and public.is_approved_driver(uid) then
    return jsonb_build_object('id', o.id, 'code', o.code, 'status', o.status, 'category', o.category, 'details', o.details,
      'pickup_address', o.pickup_address, 'pickup_lat', o.pickup_lat, 'pickup_lng', o.pickup_lng, 'pickup_area_id', o.pickup_area_id,
      'dropoff_area_id', o.dropoff_area_id, 'dropoff_approx_lat', round(o.dropoff_lat::numeric, 2), 'dropoff_approx_lng', round(o.dropoff_lng::numeric, 2),
      'distance_m', o.distance_m, 'purchase_estimate_fils', o.purchase_estimate_fils, 'image_paths', o.image_paths,
      'created_at', o.created_at, 'expires_at', o.expires_at, 'role', 'prospect',
      'my_offer', (select to_jsonb(x) from public.offers x where x.order_id = o.id and x.driver_id = uid and x.status = 'pending' limit 1));
  end if;
  raise exception 'FZ_FORBIDDEN';
end $$;

-- Offers on an order, for its customer, with the information needed to compare them.
create or replace function public.get_order_offers(p_order uuid)
returns table (offer_id uuid, driver_id uuid, driver_name text, avatar_path text, vehicle_type public.vehicle_type,
               rating_avg numeric, rating_count integer, completed_count integer, price_fils integer, eta_minutes integer,
               distance_to_pickup_m integer, note text, status public.offer_status, created_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.orders o where o.id = p_order and (o.customer_id = auth.uid() or public.is_admin())) then
    raise exception 'FZ_FORBIDDEN';
  end if;
  return query
  select x.id, x.driver_id, p.full_name, p.avatar_path, d.vehicle_type,
         case when d.rating_count > 0 then round(d.rating_sum::numeric / d.rating_count, 2) end,
         d.rating_count, d.completed_count, x.price_fils, x.eta_minutes, x.distance_to_pickup_m, x.note, x.status,
         x.created_at, x.expires_at
  from public.offers x
  join public.profiles p on p.id = x.driver_id
  join public.drivers d on d.user_id = x.driver_id
  where x.order_id = p_order and x.status in ('pending', 'accepted') and (x.status = 'accepted' or x.expires_at > now())
  order by x.price_fils, x.created_at;
end $$;

create or replace function public.submit_offer(p_order uuid, p_price_fils integer, p_eta_minutes integer,
                                               p_note text default null,
                                               p_lat double precision default null, p_lng double precision default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  s public.app_settings := public.settings();
  o public.orders;
  reason text;
  new_id uuid;
begin
  reason := public.driver_block_reason(uid);
  if reason is not null then raise exception 'FZ_CANNOT_RECEIVE:%', reason; end if;
  if not exists (select 1 from public.drivers where user_id = uid and is_online) then raise exception 'FZ_DRIVER_OFFLINE'; end if;
  perform public.enforce_rate_limit('offer:' || uid, 40, 600);
  if p_price_fils is null or p_price_fils < s.min_offer_fils or p_price_fils > s.max_offer_fils then
    raise exception 'FZ_INVALID_PRICE';
  end if;
  if p_eta_minutes is null or p_eta_minutes < 1 or p_eta_minutes > 240 then raise exception 'FZ_INVALID_ETA'; end if;
  if p_price_fils % 5 <> 0 then raise exception 'FZ_INVALID_PRICE'; end if; -- smallest coin is 5 fils

  select * into o from public.orders where id = p_order for share;
  if o.id is null then raise exception 'FZ_NOT_FOUND'; end if;
  if o.customer_id = uid then raise exception 'FZ_OWN_ORDER'; end if;
  if o.status <> 'open' or o.expires_at <= now() then raise exception 'FZ_ORDER_NOT_OPEN'; end if;
  if (select count(*) from public.orders where driver_id = uid and status in ('accepted', 'picked_up', 'delivered'))
       >= s.max_active_orders_per_driver then
    raise exception 'FZ_TOO_MANY_ACTIVE';
  end if;

  -- Replacing a previous pending offer from the same driver updates the price.
  update public.offers set status = 'withdrawn' where order_id = p_order and driver_id = uid and status = 'pending';

  insert into public.offers (order_id, driver_id, price_fils, eta_minutes, note, distance_to_pickup_m, expires_at)
  values (p_order, uid, p_price_fils, p_eta_minutes, nullif(trim(p_note), ''),
          case when p_lat is null or p_lng is null then null else public.distance_m(p_lat, p_lng, o.pickup_lat, o.pickup_lng) end,
          least(o.expires_at, now() + make_interval(mins => s.offer_ttl_minutes)))
  returning id into new_id;

  perform public.notify_user(o.customer_id, 'new_offer', 'عرض سعر جديد', 'New price offer',
    format('%s د.ك لطلب %s', to_char(p_price_fils / 1000.0, 'FM9990.000'), o.code),
    format('KWD %s for order %s', to_char(p_price_fils / 1000.0, 'FM9990.000'), o.code),
    jsonb_build_object('order_id', o.id, 'offer_id', new_id));
  return new_id;
end $$;

create or replace function public.withdraw_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.offers set status = 'withdrawn'
  where id = p_offer and driver_id = auth.uid() and status = 'pending';
  if not found then raise exception 'FZ_OFFER_NOT_PENDING'; end if;
end $$;

create or replace function public.reject_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare x public.offers;
begin
  select * into x from public.offers where id = p_offer;
  if x.id is null or not exists (select 1 from public.orders o where o.id = x.order_id and o.customer_id = auth.uid()) then
    raise exception 'FZ_FORBIDDEN';
  end if;
  update public.offers set status = 'rejected' where id = p_offer and status = 'pending';
  if not found then raise exception 'FZ_OFFER_NOT_PENDING'; end if;
  perform public.notify_user(x.driver_id, 'offer_rejected', 'تم رفض عرضك', 'Your offer was declined', '', '',
    jsonb_build_object('order_id', x.order_id));
end $$;

-- Accepting is serialized by row locks: an order can never get two accepted offers.
create or replace function public.accept_offer(p_offer uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  s public.app_settings := public.settings();
  x public.offers;
  o public.orders;
begin
  select * into x from public.offers where id = p_offer;
  if x.id is null then raise exception 'FZ_NOT_FOUND'; end if;
  select * into o from public.orders where id = x.order_id for update;
  if o.customer_id <> uid then raise exception 'FZ_FORBIDDEN'; end if;
  if o.status <> 'open' then raise exception 'FZ_ORDER_NOT_OPEN'; end if;
  if o.expires_at <= now() then raise exception 'FZ_ORDER_EXPIRED'; end if;
  -- lock the driver row to serialize the active-order count check
  perform 1 from public.drivers where user_id = x.driver_id for update;
  select * into x from public.offers where id = p_offer;
  if x.status <> 'pending' or x.expires_at <= now() then raise exception 'FZ_OFFER_NOT_PENDING'; end if;
  if not public.driver_can_receive(x.driver_id) then raise exception 'FZ_DRIVER_UNAVAILABLE'; end if;
  if (select count(*) from public.orders where driver_id = x.driver_id and status in ('accepted', 'picked_up', 'delivered'))
       >= s.max_active_orders_per_driver then
    raise exception 'FZ_DRIVER_UNAVAILABLE';
  end if;

  update public.offers set status = 'accepted' where id = x.id;
  update public.offers set status = 'rejected' where order_id = o.id and status = 'pending' and id <> x.id;
  update public.orders set status = 'accepted', driver_id = x.driver_id, accepted_offer_id = x.id,
    delivery_fee_fils = x.price_fils, commission_bps = s.commission_bps, accepted_at = now()
  where id = o.id;
  delete from public.order_feed where order_id = o.id;
  insert into public.order_events (order_id, actor_id, from_status, to_status) values (o.id, uid, 'open', 'accepted');

  perform public.notify_user(x.driver_id, 'offer_accepted', 'تم قبول عرضك!', 'Your offer was accepted!',
    format('توجّه إلى موقع الاستلام للطلب %s', o.code), format('Head to the pickup for order %s', o.code),
    jsonb_build_object('order_id', o.id));
  insert into public.notifications (user_id, type, title_ar, title_en, data)
  select y.driver_id, 'offer_rejected', 'اختار العميل عرضاً آخر', 'The customer chose another offer', jsonb_build_object('order_id', o.id)
  from public.offers y where y.order_id = o.id and y.status = 'rejected' and y.updated_at = now() and y.driver_id is not null;
  return jsonb_build_object('order_id', o.id, 'driver_id', x.driver_id, 'delivery_fee_fils', x.price_fils);
end $$;

-- Internal: finalize a delivered order (commission charged exactly once).
create or replace function public.finalize_order(p_order uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  c bigint;
begin
  select * into o from public.orders where id = p_order for update;
  if o.status <> 'delivered' then raise exception 'FZ_INVALID_TRANSITION'; end if;
  c := public.calc_commission_fils(o.delivery_fee_fils, coalesce(o.commission_bps, (public.settings()).commission_bps));
  update public.orders set status = 'completed', completed_at = now(), commission_fils = c where id = o.id;
  insert into public.order_events (order_id, actor_id, from_status, to_status) values (o.id, p_actor, 'delivered', 'completed');
  if c > 0 then
    insert into public.ledger_entries (driver_id, kind, amount_fils, order_id, note)
    values (o.driver_id, 'commission', c, o.id, format('Commission %s', o.code))
    on conflict (order_id) where kind = 'commission' do nothing;
  end if;
  update public.drivers set completed_count = completed_count + 1, total_earned_fils = total_earned_fils + o.delivery_fee_fils
  where user_id = o.driver_id;
  if not exists (select 1 from public.orders where driver_id = o.driver_id and status in ('accepted', 'picked_up')) then
    delete from public.driver_locations where driver_id = o.driver_id;
  end if;
  perform public.notify_user(o.driver_id, 'order_completed', 'اكتمل الطلب', 'Order completed',
    format('الطلب %s مكتمل. عمولة التطبيق %s د.ك', o.code, to_char(c / 1000.0, 'FM9990.000')),
    format('Order %s completed. App commission KWD %s', o.code, to_char(c / 1000.0, 'FM9990.000')),
    jsonb_build_object('order_id', o.id));
  if (select balance_fils from public.drivers where user_id = o.driver_id) >= (public.settings()).debt_limit_fils then
    update public.drivers set is_online = false where user_id = o.driver_id;
    perform public.notify_user(o.driver_id, 'debt_limit', 'تم إيقاف استقبال الطلبات مؤقتاً', 'New orders paused',
      'بلغت العمولات المستحقة الحد المسموح. سدّد المستحقات وارفع الإيصال لإعادة التفعيل.',
      'Unpaid commissions reached the limit. Pay and upload the receipt to resume.', '{}'::jsonb);
  end if;
end $$;

create or replace function public.driver_update_status(p_order uuid, p_status public.order_status, p_proof_path text default null)
returns public.order_status
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  o public.orders;
  s public.app_settings := public.settings();
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null or o.driver_id is distinct from uid then raise exception 'FZ_FORBIDDEN'; end if;
  if p_proof_path is not null and p_proof_path not like 'proof/' || o.id::text || '/' || uid::text || '/%' then
    raise exception 'FZ_INVALID_IMAGE_PATH';
  end if;
  if s.require_proof_photos and p_proof_path is null then raise exception 'FZ_PROOF_REQUIRED'; end if;
  if o.status = 'accepted' and p_status = 'picked_up' then
    update public.orders set status = 'picked_up', picked_up_at = now(), pickup_proof_path = p_proof_path where id = o.id;
    perform public.notify_user(o.customer_id, 'picked_up', 'المندوب استلم طلبك', 'Your order was picked up',
      'الطلب في الطريق إليك', 'Your order is on the way', jsonb_build_object('order_id', o.id));
  elsif o.status = 'picked_up' and p_status = 'delivered' then
    update public.orders set status = 'delivered', delivered_at = now(), delivery_proof_path = p_proof_path where id = o.id;
    perform public.notify_user(o.customer_id, 'delivered', 'تم التوصيل', 'Order delivered',
      'يرجى تأكيد الاستلام وتقييم المندوب', 'Please confirm receipt and rate your driver', jsonb_build_object('order_id', o.id));
  else
    raise exception 'FZ_INVALID_TRANSITION';
  end if;
  insert into public.order_events (order_id, actor_id, from_status, to_status) values (o.id, uid, o.status, p_status);
  return p_status;
end $$;

create or replace function public.confirm_delivery(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user();
begin
  if not exists (select 1 from public.orders where id = p_order and customer_id = uid) then raise exception 'FZ_FORBIDDEN'; end if;
  perform public.finalize_order(p_order, uid);
end $$;

create or replace function public.cancel_order(p_order uuid, p_reason text default null) returns public.order_status
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  s public.app_settings := public.settings();
  o public.orders;
  reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'FZ_NOT_FOUND'; end if;

  if o.customer_id = uid then
    if o.status = 'open' then
      update public.orders set status = 'cancelled', cancelled_at = now(), cancelled_by = uid, cancel_reason = reason where id = o.id;
      update public.offers set status = 'cancelled' where order_id = o.id and status = 'pending';
      delete from public.order_feed where order_id = o.id;
    elsif o.status = 'accepted' then
      if reason is null then raise exception 'FZ_REASON_REQUIRED'; end if;
      update public.orders set status = 'cancelled', cancelled_at = now(), cancelled_by = uid, cancel_reason = reason where id = o.id;
      update public.offers set status = 'cancelled' where id = o.accepted_offer_id;
      update public.profiles set customer_cancellations = customer_cancellations + 1 where id = uid;
      perform public.notify_user(o.driver_id, 'order_cancelled', 'ألغى العميل الطلب', 'The customer cancelled the order',
        reason, reason, jsonb_build_object('order_id', o.id));
    else
      raise exception 'FZ_CANCEL_NOT_ALLOWED';
    end if;
    insert into public.order_events (order_id, actor_id, from_status, to_status, note) values (o.id, uid, o.status, 'cancelled', reason);
    return 'cancelled';
  elsif o.driver_id = uid then
    if o.status <> 'accepted' then raise exception 'FZ_CANCEL_NOT_ALLOWED'; end if;
    if reason is null then raise exception 'FZ_REASON_REQUIRED'; end if;
    -- The order goes back to the market so the customer can receive new offers.
    update public.offers set status = 'cancelled' where id = o.accepted_offer_id;
    update public.orders set status = 'open', driver_id = null, accepted_offer_id = null, delivery_fee_fils = null,
      commission_bps = null, accepted_at = null, expires_at = now() + make_interval(mins => s.order_ttl_minutes)
    where id = o.id;
    insert into public.order_feed (order_id, category, pickup_area_id, dropoff_area_id, approx_pickup_lat, approx_pickup_lng, distance_m)
    values (o.id, o.category, o.pickup_area_id, o.dropoff_area_id, round(o.pickup_lat::numeric, 3), round(o.pickup_lng::numeric, 3), o.distance_m)
    on conflict (order_id) do nothing;
    update public.drivers set cancelled_count = cancelled_count + 1 where user_id = uid;
    if not exists (select 1 from public.orders where driver_id = uid and status in ('accepted', 'picked_up')) then
      delete from public.driver_locations where driver_id = uid;
    end if;
    insert into public.order_events (order_id, actor_id, from_status, to_status, note) values (o.id, uid, 'accepted', 'open', 'driver_cancelled: ' || reason);
    perform public.notify_user(o.customer_id, 'driver_cancelled', 'اعتذر المندوب عن الطلب', 'The driver cancelled',
      'أعدنا طلبك لاستقبال عروض جديدة', 'Your order is open for new offers again', jsonb_build_object('order_id', o.id));
    return 'open';
  end if;
  raise exception 'FZ_FORBIDDEN';
end $$;

-- Live location: accepted only while the driver has an active (accepted / picked-up) order.
create or replace function public.update_my_location(p_lat double precision, p_lng double precision,
                                                     p_heading real default null, p_speed real default null,
                                                     p_accuracy real default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'FZ_NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.orders where driver_id = uid and status in ('accepted', 'picked_up')) then
    delete from public.driver_locations where driver_id = uid;
    return false;
  end if;
  perform public.enforce_rate_limit('loc:' || uid, 120, 60);
  insert into public.driver_locations (driver_id, lat, lng, heading, speed, accuracy, updated_at)
  values (uid, p_lat, p_lng, p_heading, p_speed, p_accuracy, now())
  on conflict (driver_id) do update set lat = excluded.lat, lng = excluded.lng, heading = excluded.heading,
    speed = excluded.speed, accuracy = excluded.accuracy, updated_at = now();
  return true;
end $$;

create or replace function public.mark_messages_read(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_order_participant(p_order) then raise exception 'FZ_FORBIDDEN'; end if;
  update public.messages set read_at = now() where order_id = p_order and sender_id <> auth.uid() and read_at is null;
end $$;

-- Message rate limit + push notification to the other participant.
create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  other uuid;
begin
  perform public.enforce_rate_limit('msg:' || new.sender_id, 30, 60);
  select * into o from public.orders where id = new.order_id;
  other := case when new.sender_id = o.customer_id then o.driver_id else o.customer_id end;
  perform public.notify_user(other, 'message', 'رسالة جديدة', 'New message',
    coalesce(left(new.body, 120), '📷'), coalesce(left(new.body, 120), '📷'),
    jsonb_build_object('order_id', o.id, 'chat', true));
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

create or replace function public.rate_order(p_order uuid, p_stars smallint, p_comment text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  o public.orders;
  ratee uuid;
  role public.app_mode;
begin
  select * into o from public.orders where id = p_order;
  if o.id is null or (o.customer_id <> uid and o.driver_id is distinct from uid) then raise exception 'FZ_FORBIDDEN'; end if;
  if o.status <> 'completed' then raise exception 'FZ_NOT_COMPLETED'; end if;
  if o.completed_at < now() - interval '14 days' then raise exception 'FZ_RATING_WINDOW_CLOSED'; end if;
  if p_stars < 1 or p_stars > 5 then raise exception 'FZ_INVALID_RATING'; end if;
  if uid = o.customer_id then ratee := o.driver_id; role := 'driver'; else ratee := o.customer_id; role := 'customer'; end if;
  insert into public.ratings (order_id, rater_id, ratee_id, ratee_role, stars, comment)
  values (o.id, uid, ratee, role, p_stars, nullif(trim(p_comment), ''));
  if role = 'driver' then
    update public.drivers set rating_sum = rating_sum + p_stars, rating_count = rating_count + 1 where user_id = ratee;
  else
    update public.profiles set customer_rating_sum = customer_rating_sum + p_stars, customer_rating_count = customer_rating_count + 1 where id = ratee;
  end if;
exception when unique_violation then
  raise exception 'FZ_ALREADY_RATED';
end $$;

create or replace function public.my_ratings() returns table (stars smallint, comment text, created_at timestamptz, order_code text)
language sql stable security definer set search_path = public as $$
  select r.stars, r.comment, r.created_at, o.code
  from public.ratings r join public.orders o on o.id = r.order_id
  where r.ratee_id = auth.uid() and not r.hidden
  order by r.created_at desc limit 200
$$;

-- ---------------------------------------------------------------------
-- Payments (receipts are reviewed manually by the admin; never auto-approved)
-- ---------------------------------------------------------------------
create or replace function public.submit_receipt(p_purpose public.receipt_purpose, p_amount_fils integer,
                                                 p_image_path text, p_reference text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  rid uuid;
begin
  if not exists (select 1 from public.drivers where user_id = uid) then raise exception 'FZ_NOT_DRIVER'; end if;
  if p_image_path is null or p_image_path not like uid::text || '/%' or p_image_path like '%..%' then
    raise exception 'FZ_INVALID_IMAGE_PATH';
  end if;
  if p_amount_fils is null or p_amount_fils <= 0 or p_amount_fils > 10000000 then raise exception 'FZ_INVALID_AMOUNT'; end if;
  if p_purpose = 'activation_fee' and (select activation_paid from public.drivers where user_id = uid) then
    raise exception 'FZ_ALREADY_ACTIVATED';
  end if;
  perform public.enforce_rate_limit('receipt:' || uid, 6, 3600);
  if (select count(*) from public.payment_receipts where driver_id = uid and status = 'pending') >= 3 then
    raise exception 'FZ_TOO_MANY_PENDING';
  end if;
  insert into public.payment_receipts (driver_id, purpose, amount_fils, image_path, reference)
  values (uid, p_purpose, p_amount_fils, p_image_path, nullif(trim(p_reference), ''))
  returning id into rid;
  perform public.notify_admins('receipt_submitted', 'إيصال سداد جديد', 'New payment receipt', '', '',
    jsonb_build_object('receipt_id', rid));
  return rid;
end $$;

create or replace function public.redeem_promo(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  pc public.promo_codes;
  d public.drivers;
  new_due integer;
begin
  perform public.enforce_rate_limit('promo:' || uid, 10, 3600);
  select * into d from public.drivers where user_id = uid for update;
  if d.user_id is null then raise exception 'FZ_NOT_DRIVER'; end if;
  select * into pc from public.promo_codes where code = upper(trim(p_code)) for update;
  if pc.id is null or not pc.active or pc.valid_from > now() or (pc.valid_until is not null and pc.valid_until < now())
     or (pc.max_redemptions is not null and pc.redeemed_count >= pc.max_redemptions) then
    raise exception 'FZ_PROMO_INVALID';
  end if;
  insert into public.promo_redemptions (promo_id, user_id) values (pc.id, uid);
  update public.promo_codes set redeemed_count = redeemed_count + 1 where id = pc.id;
  if pc.kind = 'activation_discount' then
    if d.activation_paid then raise exception 'FZ_ALREADY_ACTIVATED'; end if;
    new_due := d.activation_fee_due_fils - (d.activation_fee_due_fils * pc.percent_off) / 100;
    update public.drivers set activation_fee_due_fils = new_due,
      activation_paid = (new_due = 0), activation_paid_at = case when new_due = 0 then now() end
    where user_id = uid;
    return jsonb_build_object('kind', pc.kind, 'activation_fee_due_fils', new_due);
  else
    insert into public.ledger_entries (driver_id, kind, amount_fils, note)
    values (uid, 'promo_credit', -pc.credit_fils, 'Promo ' || pc.code);
    return jsonb_build_object('kind', pc.kind, 'credit_fils', pc.credit_fils);
  end if;
exception when unique_violation then
  raise exception 'FZ_PROMO_USED';
end $$;

-- ---------------------------------------------------------------------
-- Support tickets & reports
-- ---------------------------------------------------------------------
create or replace function public.create_ticket(p_kind public.ticket_kind, p_subject text, p_body text,
                                                p_order uuid default null, p_target_user uuid default null,
                                                p_message uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_active_user();
  tid uuid;
begin
  if p_kind = 'password_reset' then raise exception 'FZ_INVALID_TICKET'; end if;
  perform public.enforce_rate_limit('ticket:' || uid, 10, 86400);
  if p_order is not null and not public.is_order_participant(p_order, uid) then raise exception 'FZ_FORBIDDEN'; end if;
  if p_message is not null and not exists (select 1 from public.messages m where m.id = p_message and public.is_order_participant(m.order_id, uid)) then
    raise exception 'FZ_FORBIDDEN';
  end if;
  insert into public.tickets (kind, user_id, subject, body, order_id, target_user_id, message_id)
  values (p_kind, uid, trim(p_subject), trim(p_body), p_order, p_target_user, p_message)
  returning id into tid;
  perform public.notify_admins('ticket', 'تذكرة دعم جديدة', 'New support ticket', left(p_subject, 100), left(p_subject, 100),
    jsonb_build_object('ticket_id', tid));
  return tid;
end $$;

create or replace function public.add_ticket_message(p_ticket uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user();
begin
  if not exists (select 1 from public.tickets where id = p_ticket and user_id = uid and status in ('open', 'in_progress')) then
    raise exception 'FZ_FORBIDDEN';
  end if;
  perform public.enforce_rate_limit('ticket_msg:' || uid, 30, 3600);
  insert into public.ticket_messages (ticket_id, sender_id, body) values (p_ticket, uid, trim(p_body));
  update public.tickets set status = 'open' where id = p_ticket;
end $$;

-- ---------------------------------------------------------------------
-- Account deletion (called by the delete-account Edge Function with the service role)
-- ---------------------------------------------------------------------
create or replace function public.prepare_account_deletion(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ph text;
  bal bigint;
begin
  if exists (select 1 from public.orders where (customer_id = p_user or driver_id = p_user)
             and status in ('accepted', 'picked_up', 'delivered')) then
    raise exception 'FZ_ACTIVE_ORDERS';
  end if;
  update public.orders set status = 'cancelled', cancelled_at = now(), cancelled_by = p_user, cancel_reason = 'account_deleted'
  where customer_id = p_user and status = 'open';
  delete from public.order_feed f using public.orders o where f.order_id = o.id and o.customer_id = p_user;
  update public.offers set status = 'withdrawn' where driver_id = p_user and status = 'pending';
  select phone into ph from public.profiles where id = p_user;
  select balance_fils into bal from public.drivers where user_id = p_user;
  if coalesce(bal, 0) > 0 then
    insert into public.deleted_accounts (phone_hash, outstanding_fils)
    values (encode(extensions.digest(ph, 'sha256'), 'hex'), bal)
    on conflict (phone_hash) do update set outstanding_fils = public.deleted_accounts.outstanding_fils + excluded.outstanding_fils, deleted_at = now();
  end if;
  delete from public.push_tokens where user_id = p_user;
  delete from public.driver_locations where driver_id = p_user;
  perform public.audit('account_deleted', 'user', p_user::text, jsonb_build_object('outstanding_fils', coalesce(bal, 0)), p_user);
  return jsonb_build_object('ok', true, 'outstanding_fils', coalesce(bal, 0));
end $$;

-- ---------------------------------------------------------------------
-- Scheduled maintenance (pg_cron every minute)
-- ---------------------------------------------------------------------
create or replace function public.run_maintenance() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.app_settings := public.settings();
  expired_orders integer;
  completed integer := 0;
  r record;
begin
  update public.offers set status = 'expired' where status = 'pending' and expires_at <= now();
  with e as (
    update public.orders set status = 'expired' where status = 'open' and expires_at <= now() returning id, customer_id, code
  ), ev as (
    insert into public.order_events (order_id, to_status, from_status) select id, 'expired', 'open' from e
  ), n as (
    insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
    select customer_id, 'order_expired', 'انتهت مهلة الطلب', 'Order expired',
           'لم يتم اختيار عرض. يمكنك إعادة إنشاء الطلب.', 'No offer was chosen. You can create the order again.',
           jsonb_build_object('order_id', id) from e where customer_id is not null
  )
  select count(*) into expired_orders from e;
  delete from public.order_feed f using public.orders o where f.order_id = o.id and o.status <> 'open';
  for r in select id from public.orders where status = 'delivered'
           and delivered_at <= now() - make_interval(hours => s.auto_complete_hours) loop
    perform public.finalize_order(r.id, null);
    completed := completed + 1;
  end loop;
  delete from public.driver_locations l where not exists
    (select 1 from public.orders o where o.driver_id = l.driver_id and o.status in ('accepted', 'picked_up'));
  delete from public.rate_limits where window_start < now() - interval '2 days';
  return jsonb_build_object('expired_orders', expired_orders, 'auto_completed', completed);
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('fazza-maintenance', '* * * * *', 'select public.run_maintenance()');
exception when others then
  raise notice 'pg_cron not available: schedule public.run_maintenance() externally (%).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- Grants for client-callable functions
-- ---------------------------------------------------------------------
grant execute on function
  public.set_active_mode(public.app_mode),
  public.clear_must_change_password(),
  public.register_push_token(text, text),
  public.unregister_push_token(text),
  public.mark_notifications_read(bigint[]),
  public.register_driver(public.vehicle_type, text, text, jsonb),
  public.set_online(boolean),
  public.driver_dashboard(),
  public.create_order(jsonb),
  public.driver_open_orders(double precision, double precision),
  public.get_order(uuid),
  public.get_order_offers(uuid),
  public.submit_offer(uuid, integer, integer, text, double precision, double precision),
  public.withdraw_offer(uuid),
  public.reject_offer(uuid),
  public.accept_offer(uuid),
  public.driver_update_status(uuid, public.order_status, text),
  public.confirm_delivery(uuid),
  public.cancel_order(uuid, text),
  public.update_my_location(double precision, double precision, real, real, real),
  public.mark_messages_read(uuid),
  public.rate_order(uuid, smallint, text),
  public.my_ratings(),
  public.submit_receipt(public.receipt_purpose, integer, text, text),
  public.redeem_promo(text),
  public.create_ticket(public.ticket_kind, text, text, uuid, uuid, uuid),
  public.add_ticket_message(uuid, text)
to authenticated;
grant execute on function public.prepare_account_deletion(uuid), public.run_maintenance() to service_role;
