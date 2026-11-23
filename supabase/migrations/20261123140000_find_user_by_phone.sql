-- ✅ 2026-11-23: الدخول صار برقم الهاتف، فالبحث عن حساب (ربط شركة بصاحبها، أو إضافة عضو للإدارة) يقبل رقم التلفون أيضاً.
-- يطابق فقط رقماً مؤكَّداً برمز SMS (phone_confirmed_at)، حتى لا يُربط أحد برقم لم يثبت ملكيته. للمدير فقط كما كان.
create or replace function public.admin_find_user(p_email text)
returns table(id uuid, email text, role text, full_name text)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := trim(coalesce(p_email, ''));
        v_digits text := regexp_replace(translate(v_q, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if position('@' in v_q) > 0 then
    return query select u.id, u.email::text, p.role, p.full_name from auth.users u left join public.profiles p on p.id = u.id
      where lower(u.email) = lower(v_q) limit 1;
  else
    if length(v_digits) = 8 then v_digits := '965' || v_digits; end if;
    if v_digits !~ '^965[569][0-9]{7}$' then return; end if;
    return query select u.id, coalesce(u.email::text, '+' || u.phone::text), p.role, p.full_name from auth.users u left join public.profiles p on p.id = u.id
      where u.phone = v_digits and u.phone_confirmed_at is not null limit 1;
  end if;
end $$;
