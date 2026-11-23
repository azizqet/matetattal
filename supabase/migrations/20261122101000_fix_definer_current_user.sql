-- إصلاح ثغرة: داخل دوال SECURITY DEFINER تكون current_user دائماً مالك الدالة (postgres)
-- فكان شرط "current_user in (postgres, service_role)" يتحقق دائماً، ما يسمح لصاحب الشركة
-- باعتماد شركته وتمديد اشتراكه بنفسه. الحل: تريجر الحماية يعمل SECURITY INVOKER،
-- والتحقق من الخدمة يتم عبر دور الـ JWT أو session_user.

create or replace function public.guard_company_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if public.is_admin() or current_user in ('postgres','service_role','supabase_admin') then
    new.updated_at := now(); return new; end if;
  if tg_op = 'INSERT' then
    new.status:='pending'; new.is_active:=false; new.is_sample:=false; new.rating:=0; new.rating_count:=0;
    new.visits:=0; new.calls:=0; new.wa_taps:=0; new.sub_start:=null; new.sub_end:=current_date - 1;
    return new; end if;
  if new.status is distinct from old.status or new.is_active is distinct from old.is_active
     or new.sub_start is distinct from old.sub_start or new.sub_end is distinct from old.sub_end
     or new.rating is distinct from old.rating or new.rating_count is distinct from old.rating_count
     or new.visits is distinct from old.visits or new.calls is distinct from old.calls or new.wa_taps is distinct from old.wa_taps
     or new.is_sample is distinct from old.is_sample or new.owner_id is distinct from old.owner_id then
    raise exception 'protected fields';
  end if;
  new.updated_at := now(); return new;
end $$;
revoke execute on function public.guard_company_update() from public, anon, authenticated;

create or replace function public.admin_activate_subscription(p_id bigint, p_note text default null, p_provider text default 'manual', p_ref text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.subscriptions;
begin
  -- مسموح: مدير، أو service_role (webhook بوابة الدفع)، أو اتصال مباشر بقاعدة البيانات بلا JWT
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role'
          or coalesce(current_setting('request.jwt.claims', true), '') = '') then
    raise exception 'forbidden'; end if;
  select * into s from public.subscriptions where id = p_id for update;
  if not found then raise exception 'subscription not found'; end if;
  if s.status = 'active' then return; end if;
  if s.status <> 'pending' then raise exception 'subscription not pending'; end if;
  insert into public.payments(subscription_id, provider, provider_ref, amount_kwd, status, paid_at, raw)
    values (p_id, coalesce(p_provider,'manual'), p_ref, s.amount_kwd, 'paid', now(), json_build_object('note', p_note)::jsonb);
  update public.subscriptions set status = 'active', payment_note = coalesce(p_note, 'تم الدفع') where id = p_id;
end $$;
revoke execute on function public.admin_activate_subscription(bigint, text, text, text) from public, anon;
grant execute on function public.admin_activate_subscription(bigint, text, text, text) to authenticated;
