-- =====================================================================
-- FAZZA | فزّاع — Core schema
-- All money values are stored as integer fils (1 KWD = 1000 fils).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.account_status as enum ('active', 'suspended', 'deleted');
create type public.app_mode as enum ('customer', 'driver');
create type public.driver_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.vehicle_type as enum ('motorcycle', 'car', 'van', 'pickup', 'truck');
create type public.document_kind as enum (
  'photo', 'civil_id_front', 'civil_id_back', 'driving_license', 'vehicle_registration', 'permit', 'other'
);
create type public.order_status as enum (
  'open', 'accepted', 'picked_up', 'delivered', 'completed', 'cancelled', 'expired'
);
create type public.order_category as enum ('parcel', 'food', 'groceries', 'documents', 'shopping', 'other');
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'cancelled');
create type public.ledger_kind as enum ('commission', 'payment', 'waiver', 'adjustment', 'carried_debt', 'promo_credit');
create type public.receipt_purpose as enum ('activation_fee', 'commission');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.ticket_kind as enum (
  'support', 'complaint', 'report_user', 'report_message', 'password_reset', 'account_deletion'
);
create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'rejected');
create type public.admin_role as enum ('owner', 'admin', 'finance', 'support');
create type public.promo_kind as enum ('activation_discount', 'commission_credit');

-- ---------------------------------------------------------------------
-- Settings (singleton row, editable from the admin panel at runtime)
-- ---------------------------------------------------------------------
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  activation_fee_fils integer not null default 5000 check (activation_fee_fils between 0 and 1000000),
  commission_bps integer not null default 1500 check (commission_bps between 0 and 5000), -- 1500 = 15.00%
  debt_limit_fils integer not null default 5000 check (debt_limit_fils between 0 and 1000000),
  min_offer_fils integer not null default 250 check (min_offer_fils > 0),
  max_offer_fils integer not null default 100000 check (max_offer_fils > 0),
  order_ttl_minutes integer not null default 120 check (order_ttl_minutes between 5 and 1440),
  offer_ttl_minutes integer not null default 15 check (offer_ttl_minutes between 1 and 240),
  max_active_orders_per_driver integer not null default 3 check (max_active_orders_per_driver between 1 and 20),
  auto_complete_hours integer not null default 24 check (auto_complete_hours between 1 and 168),
  require_proof_photos boolean not null default true,
  nearby_radius_km integer not null default 25 check (nearby_radius_km between 1 and 200),
  support_phone text not null default '',
  support_whatsapp text not null default '',
  support_hours_ar text not null default '',
  support_hours_en text not null default '',
  payment_instructions_ar text not null default '',
  payment_instructions_en text not null default '',
  payment_link_url text not null default '',
  account_deletion_url text not null default '',
  terms_ar text not null default '',
  terms_en text not null default '',
  privacy_ar text not null default '',
  privacy_en text not null default '',
  min_app_version text not null default '1.0.0',
  maintenance_mode boolean not null default false,
  maintenance_message_ar text not null default '',
  maintenance_message_en text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (min_offer_fils < max_offer_fils)
);
insert into public.app_settings (id) values (1);

-- ---------------------------------------------------------------------
-- Geography
-- ---------------------------------------------------------------------
create table public.governorates (
  id smallint primary key,
  name_ar text not null,
  name_en text not null,
  sort smallint not null default 0,
  active boolean not null default true
);

create table public.areas (
  id serial primary key,
  governorate_id smallint not null references public.governorates(id) on update cascade,
  name_ar text not null,
  name_en text not null,
  lat double precision not null check (lat between 28.4 and 30.2),
  lng double precision not null check (lng between 46.5 and 48.7),
  active boolean not null default true,
  unique (governorate_id, name_en)
);
create index areas_gov_idx on public.areas(governorate_id);

-- ---------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text not null unique check (phone ~ '^\+965[4569][0-9]{7}$'),
  -- The phone number is NOT verified until staff verify it manually (no OTP is used).
  phone_verified boolean not null default false,
  phone_verified_at timestamptz,
  avatar_path text,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  active_mode public.app_mode not null default 'customer',
  status public.account_status not null default 'active',
  must_change_password boolean not null default false,
  terms_accepted_at timestamptz not null default now(),
  customer_cancellations integer not null default 0,
  customer_rating_sum integer not null default 0,
  customer_rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.admin_role not null default 'admin',
  created_at timestamptz not null default now(),
  created_by uuid
);

create table public.drivers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status public.driver_status not null default 'pending',
  status_reason text,
  vehicle_type public.vehicle_type not null,
  vehicle_model text check (vehicle_model is null or char_length(vehicle_model) <= 60),
  plate_number text not null check (char_length(plate_number) between 2 and 20),
  activation_fee_due_fils integer not null default 0 check (activation_fee_due_fils >= 0),
  activation_paid boolean not null default false,
  activation_paid_at timestamptz,
  is_online boolean not null default false,
  online_changed_at timestamptz,
  -- Cached balance of the driver's ledger (positive = owed to FAZZA). Maintained by trigger only.
  balance_fils bigint not null default 0,
  total_earned_fils bigint not null default 0,
  completed_count integer not null default 0,
  cancelled_count integer not null default 0,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index drivers_plate_unique on public.drivers (upper(regexp_replace(plate_number, '\s', '', 'g')))
  where status in ('pending', 'approved', 'suspended');

create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(user_id) on delete cascade,
  kind public.document_kind not null,
  storage_path text not null,
  status public.review_status not null default 'pending',
  note text,
  created_at timestamptz not null default now()
);
create index driver_documents_driver_idx on public.driver_documents(driver_id);

create table public.saved_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  area_id integer references public.areas(id),
  address_text text not null check (char_length(address_text) between 2 and 300),
  notes text check (notes is null or char_length(notes) <= 300),
  lat double precision not null check (lat between 28.4 and 30.2),
  lng double precision not null check (lng between 46.5 and 48.7),
  created_at timestamptz not null default now()
);
create index saved_addresses_user_idx on public.saved_addresses(user_id);

create table public.push_tokens (
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens(user_id);

-- Hash of phone numbers of deleted accounts with outstanding dues, so dues are carried over on re-registration.
create table public.deleted_accounts (
  phone_hash text primary key,
  outstanding_fils bigint not null default 0,
  deleted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Orders & offers
-- ---------------------------------------------------------------------
create sequence public.order_code_seq start 100001;

create table public.orders (
  id uuid primary key,                -- generated by the client (idempotency key for offline retries)
  code text not null unique default ('FZ' || nextval('public.order_code_seq')::text),
  customer_id uuid references public.profiles(id) on delete set null,
  driver_id uuid references public.profiles(id) on delete set null,
  status public.order_status not null default 'open',
  category public.order_category not null default 'parcel',
  details text not null check (char_length(details) between 3 and 1000),
  pickup_lat double precision not null check (pickup_lat between 28.4 and 30.2),
  pickup_lng double precision not null check (pickup_lng between 46.5 and 48.7),
  pickup_address text not null check (char_length(pickup_address) between 2 and 300),
  pickup_notes text check (pickup_notes is null or char_length(pickup_notes) <= 300),
  pickup_area_id integer references public.areas(id),
  dropoff_lat double precision not null check (dropoff_lat between 28.4 and 30.2),
  dropoff_lng double precision not null check (dropoff_lng between 46.5 and 48.7),
  dropoff_address text not null check (char_length(dropoff_address) between 2 and 300),
  dropoff_notes text check (dropoff_notes is null or char_length(dropoff_notes) <= 300),
  dropoff_area_id integer references public.areas(id),
  recipient_name text check (recipient_name is null or char_length(recipient_name) <= 80),
  recipient_phone text check (recipient_phone is null or recipient_phone ~ '^\+965[0-9]{8}$'),
  -- Optional estimate of goods the driver buys on the customer's behalf. Never commissioned.
  purchase_estimate_fils integer check (purchase_estimate_fils is null or purchase_estimate_fils between 0 and 10000000),
  distance_m integer not null default 0,
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 5),
  accepted_offer_id uuid,
  delivery_fee_fils integer check (delivery_fee_fils is null or delivery_fee_fils > 0),
  commission_fils integer check (commission_fils is null or commission_fils >= 0),
  commission_bps integer,
  pickup_proof_path text,
  delivery_proof_path text,
  cancel_reason text,
  cancelled_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_driver_idx on public.orders(driver_id, created_at desc);
create index orders_status_idx on public.orders(status, created_at desc);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid references public.profiles(id) on delete set null,
  price_fils integer not null check (price_fils > 0),
  eta_minutes integer not null check (eta_minutes between 1 and 240),
  note text check (note is null or char_length(note) <= 200),
  distance_to_pickup_m integer,
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create unique index offers_one_pending_per_driver on public.offers(order_id, driver_id) where status = 'pending';
create unique index offers_one_accepted_per_order on public.offers(order_id) where status = 'accepted';
create index offers_order_idx on public.offers(order_id);
create index offers_driver_idx on public.offers(driver_id, created_at desc);

alter table public.orders
  add constraint orders_accepted_offer_fk foreign key (accepted_offer_id) references public.offers(id) on delete set null;

-- Lightweight public feed of open orders for approved drivers (no personal data).
create table public.order_feed (
  order_id uuid primary key references public.orders(id) on delete cascade,
  category public.order_category not null,
  pickup_area_id integer,
  dropoff_area_id integer,
  approx_pickup_lat double precision not null,
  approx_pickup_lng double precision not null,
  distance_m integer not null,
  created_at timestamptz not null default now()
);

create table public.order_events (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid,
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, id);

-- Live location: only stored while a driver has an active order. Deleted afterwards.
create table public.driver_locations (
  driver_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null check (lat between 28.0 and 30.5),
  lng double precision not null check (lng between 46.0 and 49.0),
  heading real,
  speed real,
  accuracy real,
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text check (body is null or char_length(body) between 1 and 2000),
  image_path text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (body is not null or image_path is not null)
);
create index messages_order_idx on public.messages(order_id, created_at);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  rater_id uuid references public.profiles(id) on delete set null,
  ratee_id uuid references public.profiles(id) on delete set null,
  ratee_role public.app_mode not null,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, rater_id)
);
create index ratings_ratee_idx on public.ratings(ratee_id, created_at desc);

-- ---------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------
create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.profiles(id) on delete set null,
  purpose public.receipt_purpose not null,
  amount_fils integer not null check (amount_fils > 0 and amount_fils <= 10000000),
  approved_amount_fils integer check (approved_amount_fils is null or approved_amount_fils > 0),
  image_path text not null,
  reference text check (reference is null or char_length(reference) <= 100),
  status public.review_status not null default 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_receipts_driver_idx on public.payment_receipts(driver_id, created_at desc);
create index payment_receipts_status_idx on public.payment_receipts(status, created_at);

-- Append-only ledger of the driver's dues. Positive = owed to FAZZA, negative = paid/credited.
create table public.ledger_entries (
  id bigserial primary key,
  driver_id uuid references public.profiles(id) on delete set null,
  kind public.ledger_kind not null,
  amount_fils bigint not null check (amount_fils <> 0),
  order_id uuid references public.orders(id) on delete set null,
  receipt_id uuid references public.payment_receipts(id) on delete set null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
-- Guarantees a commission is never charged twice for the same order.
create unique index ledger_one_commission_per_order on public.ledger_entries(order_id) where kind = 'commission';
create unique index ledger_one_payment_per_receipt on public.ledger_entries(receipt_id) where kind = 'payment';
create index ledger_driver_idx on public.ledger_entries(driver_id, created_at desc);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  kind public.promo_kind not null,
  percent_off integer check (percent_off is null or percent_off between 1 and 100),
  credit_fils integer check (credit_fils is null or credit_fils between 1 and 1000000),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  check ((kind = 'activation_discount' and percent_off is not null) or (kind = 'commission_credit' and credit_fils is not null))
);

create table public.promo_redemptions (
  promo_id uuid not null references public.promo_codes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (promo_id, user_id)
);

-- ---------------------------------------------------------------------
-- Support, reports, notifications
-- ---------------------------------------------------------------------
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  kind public.ticket_kind not null,
  user_id uuid references public.profiles(id) on delete set null,
  contact_phone text,
  contact_name text,
  target_user_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  subject text not null check (char_length(subject) between 2 and 120),
  body text not null check (char_length(body) between 2 and 3000),
  status public.ticket_status not null default 'open',
  admin_note text,
  handled_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_status_idx on public.tickets(status, created_at desc);
create index tickets_user_idx on public.tickets(user_id, created_at desc);

create table public.ticket_messages (
  id bigserial primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  from_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages(ticket_id, id);

create table public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title_ar text not null,
  title_en text not null,
  body_ar text not null default '',
  body_en text not null default '',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, id desc);

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('all', 'customers', 'drivers', 'user')),
  target_user_id uuid,
  title_ar text not null,
  title_en text not null,
  body_ar text not null,
  body_en text not null,
  recipients integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Security infrastructure
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
