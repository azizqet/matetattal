-- ✅ 2026-11-23: حدود إرسال رموز SMS لكل رقم (فوق حدود Supabase Auth: 60 ثانية بين الرسائل وحد المشروع بالساعة).
-- تُستدعى فقط من دالة send-sms (Send SMS Hook) بمفتاح الخدمة؛ لا يصل لها التطبيق ولا العامة.
-- الرقم يُحفظ مُجزّأً (sha256) وليس نصاً واضحاً، والسجلات الأقدم من يومين تُحذف تلقائياً.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.sms_send_log (
  id bigint generated always as identity primary key,
  phone_hash text not null,
  sent_at timestamptz not null default now()
);
create index if not exists sms_send_log_phone_idx on private.sms_send_log (phone_hash, sent_at desc);
revoke all on private.sms_send_log from public, anon, authenticated;

-- يرجع null إذا مسموح (ويسجّل المحاولة)، أو سبب الرفض: 'cooldown' | 'hourly' | 'daily'
create or replace function public.sms_hook_reserve(p_phone text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_hash text := encode(extensions.digest(p_phone, 'sha256'), 'hex');
        v_last timestamptz; v_hour int; v_day int;
begin
  delete from private.sms_send_log where sent_at < now() - interval '2 days';
  perform pg_advisory_xact_lock(hashtext(v_hash));
  select max(sent_at), count(*) filter (where sent_at > now() - interval '1 hour'), count(*)
    into v_last, v_hour, v_day
    from private.sms_send_log where phone_hash = v_hash and sent_at > now() - interval '1 day';
  if v_last is not null and v_last > now() - interval '55 seconds' then return 'cooldown'; end if;
  if v_hour >= 5 then return 'hourly'; end if;
  if v_day >= 10 then return 'daily'; end if;
  insert into private.sms_send_log (phone_hash) values (v_hash);
  return null;
end $$;
revoke execute on function public.sms_hook_reserve(text) from public, anon, authenticated;
grant execute on function public.sms_hook_reserve(text) to service_role;
