-- ✅ إصلاح أمني بموافقة المالك (2026-11-22)
-- has_accepted_current كانت تجيب عن أي مستخدم (نعم/لا) لأي مستخدم مسجّل.
-- الآن: تجيب فقط عن المستخدم نفسه، أو للمشرف/المدير، أو للاتصال المباشر بقاعدة البيانات (بلا JWT).
-- التريجر require_provider_consent ودالة request_subscription تستدعيانها دائماً بـ auth.uid() → لا تتأثران.
-- التأثير على الموقع: لا يوجد (لا يستخدم هذه الدالة).

create or replace function public.has_accepted_current(p_user uuid, p_kinds text[])
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user is distinct from auth.uid()
     and not public.is_staff()
     and coalesce(current_setting('request.jwt.claims', true), '') <> '' then
    raise exception 'forbidden';
  end if;
  return not exists (
    select 1 from public.terms_documents d
    where d.is_current and d.published_at is not null and d.kind = any(p_kinds)
      and not exists (select 1 from public.terms_acceptances a
                      where a.user_id = p_user and a.document_id = d.id));
end $$;
revoke execute on function public.has_accepted_current(uuid, text[]) from public, anon;
grant execute on function public.has_accepted_current(uuid, text[]) to authenticated;
