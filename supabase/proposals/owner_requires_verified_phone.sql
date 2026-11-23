-- ⏳ مقترح (لا يُطبَّق قبل نجاح أول رمز SMS حقيقي لرقم المالك، وإلا تُقفل لوحة الإدارة على المالك نفسه).
-- الهدف: صلاحيات الإدارة لا تعمل إلا لحساب أثبت ملكية رقمه برمز SMS.
--   • is_admin / is_staff: الصلاحية من profiles.role كما هي + الرقم مؤكَّد (phone_confirmed_at).
--   • is_owner: معرّف المالك (app_settings.owner_user_id) + رقمه المؤكَّد هو رقم المالك المعتمد.
-- الصلاحية مربوطة بمعرّف الحساب، لا بالرقم: أي حساب آخر لا يحصل عليها حتى لو كتب الرقم، و Supabase Auth
-- يمنع ربط نفس الرقم بحسابين، وتغيير رقم أي حساب يحتاج رمزاً يُرسل للرقم الجديد.
-- كل سياسات RLS والدوال (admin_set_role، admin_stats، …) تستدعي هذه الدوال، فيسري الشرط على الخادم كله.
create or replace function public.has_verified_phone() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and u.phone is not null and u.phone_confirmed_at is not null)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_verified_phone()
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_verified_phone()
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff'))
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_settings s join auth.users u on u.id::text = s.value #>> '{}'
    where s.key = 'owner_user_id' and u.id = auth.uid()
      and u.phone = '96599912313' and u.phone_confirmed_at is not null)
$$;

revoke execute on function public.has_verified_phone() from public, anon;
grant execute on function public.has_verified_phone() to authenticated;

-- الملف الشخصي يُنشأ تلقائياً من الخادم فقط (handle_new_user)؛ لا يحتاج المستخدم صلاحية إدراج (ولا عمود role).
revoke insert on public.profiles from anon, authenticated;
