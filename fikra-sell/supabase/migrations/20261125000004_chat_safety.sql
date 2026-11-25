-- FIKRA SELL · 0004 · Conversations, messages, blocks, reports

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  ad_id bigint references public.ads(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  ad_title text not null default '',
  ad_cover_path text,
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  last_sender_id uuid,
  buyer_unread int not null default 0,
  seller_unread int not null default 0,
  buyer_hidden_at timestamptz,
  seller_hidden_at timestamptz,
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  unique (ad_id, buyer_id)
);
create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text check (body is null or char_length(body) between 1 and 2000),
  image_path text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (body is not null or image_path is not null)
);
create index messages_conv_idx on public.messages (conversation_id, created_at desc);
create index messages_unread_idx on public.messages (conversation_id) where read_at is null;

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type public.report_target not null,
  target_id text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('scam', 'prohibited', 'offensive', 'spam', 'wrong_category', 'duplicate', 'sold', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolution_note text,
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);
create unique index reports_once_per_target on public.reports (reporter_id, target_type, target_id) where status = 'open';

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public.is_participant(conv uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversations c where c.id = conv and auth.uid() in (c.buyer_id, c.seller_id))
$$;

-- Messages: sender is always the caller; blocked or banned users cannot send.
create or replace function private.messages_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if not private.is_privileged() then
    new.sender_id := auth.uid();
    new.read_at := null;
    new.created_at := now();
  end if;
  if c.id is null or new.sender_id not in (c.buyer_id, c.seller_id) then
    raise exception using errcode = 'P0403', message = 'not_participant';
  end if;
  if public.is_blocked_between(c.buyer_id, c.seller_id) then
    raise exception using errcode = 'P0403', message = 'blocked';
  end if;
  if exists (select 1 from public.profiles where id = new.sender_id and is_banned) then
    raise exception using errcode = 'P0403', message = 'account_banned';
  end if;
  if new.image_path is not null and split_part(new.image_path, '/', 1) <> new.conversation_id::text then
    raise exception using errcode = 'P0422', message = 'invalid_image_path';
  end if;
  new.body := nullif(btrim(new.body), '');
  perform private.enforce_rate_limit('msg:' || new.sender_id, 20, 60, 'sending_too_fast');
  perform private.enforce_rate_limit('msg_day:' || new.sender_id, 600, 86400, 'daily_message_limit');
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function private.messages_before_insert();

-- Only read_at may change, and only by the recipient (enforced in RPC);
-- direct updates are not granted to clients.

create or replace function private.messages_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c record; recipient uuid; sender_name text; prefs jsonb;
begin
  update public.conversations set
    last_message_at = new.created_at,
    last_message_preview = left(coalesce(new.body, '📷'), 120),
    last_sender_id = new.sender_id,
    buyer_unread = case when new.sender_id = seller_id then buyer_unread + 1 else buyer_unread end,
    seller_unread = case when new.sender_id = buyer_id then seller_unread + 1 else seller_unread end,
    buyer_hidden_at = null, seller_hidden_at = null
  where id = new.conversation_id
  returning * into c;
  recipient := case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end;
  select full_name into sender_name from public.profiles where id = new.sender_id;
  -- One notification row per conversation while unread (avoid flooding).
  if not exists (select 1 from public.notifications n where n.user_id = recipient and n.type = 'message'
                 and n.read_at is null and n.data ->> 'conversation_id' = c.id::text) then
    insert into public.notifications (user_id, type, title_ar, title_en, body_ar, body_en, data)
    values (recipient, 'message', 'رسالة جديدة من ' || sender_name, 'New message from ' || sender_name,
            left(coalesce(new.body, 'صورة'), 120), left(coalesce(new.body, 'Photo'), 120),
            jsonb_build_object('conversation_id', c.id, 'ad_id', c.ad_id));
  end if;
  return null;
end $$;

create or replace function private.reports_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_privileged() then
    if auth.uid() is null then raise exception using errcode = 'P0401', message = 'auth_required'; end if;
    new.reporter_id := auth.uid();
    new.status := 'open'; new.handled_by := null; new.handled_at := null; new.resolution_note := null;
    perform private.enforce_rate_limit('report:' || auth.uid(), 10, 3600, 'reporting_too_fast');
  end if;
  new.target_user_id := case new.target_type
    when 'ad' then (select user_id from public.ads where id::text = new.target_id)
    when 'user' then (select id from public.profiles where id::text = new.target_id)
    when 'conversation' then (select case when c.buyer_id = new.reporter_id then c.seller_id else c.buyer_id end
                                from public.conversations c where c.id::text = new.target_id
                                and new.reporter_id in (c.buyer_id, c.seller_id))
    when 'message' then (select m.sender_id from public.messages m join public.conversations c on c.id = m.conversation_id
                           where m.id::text = new.target_id and new.reporter_id in (c.buyer_id, c.seller_id))
  end;
  if new.target_user_id is null then
    raise exception using errcode = 'P0422', message = 'invalid_report_target';
  end if;
  if new.target_user_id = new.reporter_id then
    raise exception using errcode = 'P0422', message = 'cannot_report_self';
  end if;
  return new;
end $$;
create trigger reports_before_insert before insert on public.reports
  for each row execute function private.reports_before_insert();

-- Auto-hide an ad once it collects N distinct open reports (pending review).
create or replace function private.reports_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare threshold int := coalesce((public.setting('auto_hide_report_threshold') #>> '{}')::int, 5); prev text;
begin
  if new.target_type = 'ad' and (select count(distinct reporter_id) from public.reports
      where target_type = 'ad' and target_id = new.target_id and status = 'open') >= threshold then
    prev := private.elevate();
    update public.ads set status = 'pending' where id::text = new.target_id and status = 'active';
    perform private.restore(prev);
  end if;
  return null;
end $$;
create trigger reports_after_insert after insert on public.reports
  for each row execute function private.reports_after_insert();

create or replace function private.blocks_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_privileged() then new.blocker_id := auth.uid(); end if;
  perform private.enforce_rate_limit('block:' || new.blocker_id, 30, 3600, 'too_many_blocks');
  return new;
end $$;
create trigger blocks_before_insert before insert on public.blocks
  for each row execute function private.blocks_before_insert();
