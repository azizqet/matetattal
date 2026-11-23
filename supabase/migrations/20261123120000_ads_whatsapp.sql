-- ✅ 2026-11-23: رقم واتساب اختياري للإعلان (نفس رقم الاتصال أو رقم مختلف).
-- إضافة فقط: عمود جديد يقبل null، فلا تتأثر الإعلانات أو البيانات الحالية.
-- null = الواتساب على نفس رقم الاتصال. القيمة = رقم جوال كويتي محلي (8 أرقام يبدأ بـ 5 أو 6 أو 9).
alter table public.ads add column if not exists whatsapp text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ads_whatsapp_check' and conrelid = 'public.ads'::regclass) then
    alter table public.ads add constraint ads_whatsapp_check check (whatsapp is null or whatsapp ~ '^[569][0-9]{7}$');
  end if;
end $$;

-- تغيير رقم الواتساب مثل تغيير رقم الاتصال: يعيد الإعلان للمراجعة (نفس الدالة الحالية + whatsapp فقط).
create or replace function public.guard_ad() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_admin boolean := public.is_admin();
        v_prefix text := 'https://xpnwhvbxordtsmnegvri.supabase.co/storage/v1/object/public/ads/';
begin
  if tg_op = 'INSERT' then
    if not v_admin then
      new.owner_id := auth.uid();
      new.status := 'pending';
    end if;
    if new.owner_id is null then raise exception 'login required'; end if;
    new.reject_reason := null; new.reviewed_by := null; new.reviewed_at := null; new.published_at := null;
    new.created_at := now(); new.updated_at := now();
  else
    if new.owner_id <> old.owner_id then raise exception 'ad owner cannot change'; end if;
    new.created_at := old.created_at;
    new.updated_at := now();
    if not v_admin then
      new.status := old.status; new.reject_reason := old.reject_reason;
      new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.published_at := old.published_at;
      if (new.title, new.description, new.images, new.service_id, new.area_name, new.phone, new.whatsapp, new.price)
         is distinct from (old.title, old.description, old.images, old.service_id, old.area_name, old.phone, old.whatsapp, old.price) then
        new.status := 'pending'; new.reject_reason := null; new.reviewed_by := null; new.reviewed_at := null;
      end if;
    elsif new.status is distinct from old.status then
      if new.status = 'rejected' and coalesce(trim(new.reject_reason), '') = '' then
        raise exception 'reject reason required'; end if;
      if new.status <> 'rejected' then new.reject_reason := null; end if;
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
      if new.status = 'approved' then new.published_at := now(); end if;
    end if;
  end if;
  if exists (select 1 from unnest(new.images) u
             where u not like v_prefix || new.owner_id::text || '/%') then
    raise exception 'invalid image url'; end if;
  if tg_op = 'INSERT' and not v_admin and
     (select count(*) from public.ads where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate limit: too many ads today'; end if;
  return new;
end $$;
