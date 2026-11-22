-- اختبارات المرحلة 2 (الإعلانات بموافقة المالك + الدعم الفني + حذف الحساب + رقم الهاتف).
-- تُشغَّل بعد ملف المقترح داخل نفس المعاملة، وتنتهي بخطأ متعمد يُلغي كل شيء:
-- النجاح = 'ALL_PHASE2_TESTS_PASSED (rolled back)'.

create or replace function pg_temp.as_user(p_role text, p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_uid)::text, true);
  execute format('set local role %I', p_role);
end $$;
create or replace function pg_temp.must_fail(p_sql text, p_label text) returns void language plpgsql as $$
declare v_rows int;
begin
  begin execute p_sql; get diagnostics v_rows = row_count;
  exception when others then return; end;
  if v_rows = 0 and p_sql ~* '^\s*(update|delete)' then return; end if;
  raise exception 'FAIL % : expected denial but succeeded (% rows)', p_label, v_rows;
end $$;

do $$
declare
  u_owner uuid := (select id from public.profiles where role = 'admin');
  u_a uuid := gen_random_uuid(); u_b uuid := gen_random_uuid(); u_p uuid := gen_random_uuid();
  ad1 bigint; t1 bigint; c1 bigint; v_n int; v_txt text; v_bool boolean; v_ts timestamptz;
  img_a text; img_b text;
begin
  if (select count(*) from public.profiles where role = 'admin') <> 1 then raise exception 'SETUP: expected exactly one admin'; end if;
  insert into auth.users(id, email, aud, role, instance_id) values
    (u_a,'p2_a_'||u_a||'@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
    (u_b,'p2_b_'||u_b||'@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
  img_a := 'https://xpnwhvbxordtsmnegvri.supabase.co/storage/v1/object/public/ads/' || u_a || '/x.jpg';
  img_b := 'https://xpnwhvbxordtsmnegvri.supabase.co/storage/v1/object/public/ads/' || u_b || '/x.jpg';

  -- ===== P1: التسجيل برقم الهاتف يحفظ الرقم المحلي في الملف الشخصي =====
  insert into auth.users(id, phone, aud, role, instance_id) values (u_p, '96597700001', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  select phone into v_txt from public.profiles where id = u_p;
  if v_txt is distinct from '97700001' then raise exception 'FAIL P1 profile phone = %', v_txt; end if;

  -- ===== الإعلانات =====
  perform pg_temp.as_user('anon', null);
  perform pg_temp.must_fail($q$insert into public.ads(service_id,title,description,area_name,phone) values ('tow','اعلان','وصف إعلان تجريبي','حولي','97700001')$q$, 'A01 anon insert');

  perform pg_temp.as_user('authenticated', u_a);
  insert into public.ads(service_id,title,description,area_name,phone,status,images)
    values ('tow','سطحة للاختبار','وصف إعلان تجريبي للاختبار','حولي','97700001','approved', array[img_a]) returning id into ad1;
  select status into v_txt from public.ads where id = ad1;
  if v_txt <> 'pending' then raise exception 'FAIL A02 new ad status = % (expected pending)', v_txt; end if;
  perform pg_temp.must_fail(format($q$insert into public.ads(service_id,title,description,area_name,phone,images) values ('tow','صور غيري','وصف إعلان تجريبي','حولي','97700001', array[%L])$q$, img_b), 'A03 foreign image');
  -- محاولة النشر باسم مستخدم آخر: الخادم يستبدل المالك بالمرسل الفعلي
  insert into public.ads(owner_id,service_id,title,description,area_name,phone)
    values (u_b,'tow','باسم غيري','وصف إعلان تجريبي','حولي','97700001') returning owner_id::text into v_txt;
  if v_txt <> u_a::text then raise exception 'FAIL A04 ad created for another user'; end if;

  update public.ads set status = 'approved' where id = ad1;
  select status into v_txt from public.ads where id = ad1;
  if v_txt <> 'pending' then raise exception 'FAIL A05 user self-approved (status=%)', v_txt; end if;
  perform pg_temp.must_fail(format('update public.ads set owner_id = %L where id = %s', u_b, ad1), 'A06 change owner');

  perform pg_temp.as_user('anon', null);
  select count(*) into v_n from public.ads where id = ad1;
  if v_n <> 0 then raise exception 'FAIL A07 anon sees pending ad'; end if;
  perform pg_temp.as_user('authenticated', u_b);
  select count(*) into v_n from public.ads where id = ad1;
  if v_n <> 0 then raise exception 'FAIL A08 other user sees pending ad'; end if;
  perform pg_temp.must_fail(format($q$update public.ads set title = 'اختراق' where id = %s$q$, ad1), 'A09 other user edits ad');
  perform pg_temp.must_fail(format('delete from public.ads where id = %s', ad1), 'A10 other user deletes ad');

  -- المدير يوافق
  perform pg_temp.as_user('authenticated', u_owner);
  update public.ads set status = 'approved' where id = ad1;
  select status, published_at, reviewed_by::text into v_txt, v_ts, img_b from public.ads where id = ad1;
  if v_txt <> 'approved' or v_ts is null or img_b <> u_owner::text then raise exception 'FAIL A11 admin approve (% % %)', v_txt, v_ts, img_b; end if;
  perform pg_temp.as_user('anon', null);
  select count(*) into v_n from public.ads where id = ad1;
  if v_n <> 1 then raise exception 'FAIL A12 anon cannot see approved ad'; end if;

  perform pg_temp.as_user('authenticated', u_a);
  select count(*) into v_n from public.notifications where user_id = u_a and data->>'type' = 'ad' and data->>'status' = 'approved';
  if v_n <> 1 then raise exception 'FAIL A13 approval notification count = %', v_n; end if;

  -- تعديل أساسي يعيده للمراجعة ويخفيه
  update public.ads set title = 'سطحة معدّلة' where id = ad1;
  select status, reviewed_by into v_txt, img_b from public.ads where id = ad1;
  if v_txt <> 'pending' or img_b is not null then raise exception 'FAIL A14 edit did not return to review (%)', v_txt; end if;
  perform pg_temp.as_user('anon', null);
  select count(*) into v_n from public.ads where id = ad1;
  if v_n <> 0 then raise exception 'FAIL A15 edited ad still public'; end if;

  -- الرفض يحتاج سبباً
  perform pg_temp.as_user('authenticated', u_owner);
  perform pg_temp.must_fail(format($q$update public.ads set status = 'rejected' where id = %s$q$, ad1), 'A16 reject without reason');
  update public.ads set status = 'rejected', reject_reason = 'الصور غير واضحة' where id = ad1;
  perform pg_temp.as_user('authenticated', u_a);
  select reject_reason into v_txt from public.ads where id = ad1;
  if v_txt <> 'الصور غير واضحة' then raise exception 'FAIL A17 reason not visible to owner'; end if;
  select count(*) into v_n from public.notifications where user_id = u_a and data->>'status' = 'rejected';
  if v_n <> 1 then raise exception 'FAIL A18 rejection notification'; end if;
  perform pg_temp.as_user('anon', null);
  select count(*) into v_n from public.ads where id = ad1;
  if v_n <> 0 then raise exception 'FAIL A19 rejected ad public'; end if;

  -- ===== الدعم الفني =====
  perform pg_temp.as_user('authenticated', u_a);
  insert into public.support_tickets(subject, status) values ('ما يوصلني الرمز', 'resolved') returning id into t1;
  select status into v_txt from public.support_tickets where id = t1;
  if v_txt <> 'new' then raise exception 'FAIL S01 ticket status forced (got %)', v_txt; end if;
  insert into public.support_messages(ticket_id, body, is_staff) values (t1, 'التفاصيل هنا', true);
  select bool_or(is_staff) into v_bool from public.support_messages where ticket_id = t1;
  if v_bool then raise exception 'FAIL S02 user spoofed staff message'; end if;
  update public.support_tickets set status = 'resolved' where id = t1;
  select status into v_txt from public.support_tickets where id = t1;
  if v_txt <> 'new' then raise exception 'FAIL S03 user changed ticket status'; end if;
  perform pg_temp.must_fail(format($q$insert into public.support_messages(ticket_id, body, image_path) values (%s, 'صورة', %L)$q$, t1, u_b || '/' || t1 || '/x.jpg'), 'S04 foreign image path');

  perform pg_temp.as_user('authenticated', u_b);
  select count(*) into v_n from public.support_tickets where id = t1;
  if v_n <> 0 then raise exception 'FAIL S05 other user reads ticket'; end if;
  select count(*) into v_n from public.support_messages where ticket_id = t1;
  if v_n <> 0 then raise exception 'FAIL S06 other user reads messages'; end if;
  perform pg_temp.must_fail(format($q$insert into public.support_messages(ticket_id, body) values (%s, 'تطفل')$q$, t1), 'S07 other user writes message');

  perform pg_temp.as_user('anon', null);
  perform pg_temp.must_fail('select 1 from public.support_tickets', 'S08 anon reads tickets');

  perform pg_temp.as_user('authenticated', u_owner);
  insert into public.support_messages(ticket_id, body) values (t1, 'جرّب الآن من فضلك');
  select is_staff into v_bool from public.support_messages where ticket_id = t1 order by id desc limit 1;
  if not v_bool then raise exception 'FAIL S09 admin reply not marked staff'; end if;
  update public.support_tickets set status = 'resolved' where id = t1;
  perform pg_temp.as_user('authenticated', u_a);
  select count(*) into v_n from public.notifications where user_id = u_a and data->>'type' = 'support';
  if v_n <> 2 then raise exception 'FAIL S10 support notifications = % (expected reply + status)', v_n; end if;
  insert into public.support_messages(ticket_id, body) values (t1, 'المشكلة رجعت');
  select status into v_txt from public.support_tickets where id = t1;
  if v_txt <> 'new' then raise exception 'FAIL S11 user message did not reopen (status=%)', v_txt; end if;
  perform pg_temp.must_fail('update public.support_messages set body = $x$تعديل$x$', 'S12 edit message');
  perform pg_temp.must_fail('delete from public.support_messages', 'S13 delete message');

  -- ===== حذف الحساب =====
  perform pg_temp.as_user('anon', null);
  perform pg_temp.must_fail('select public.delete_my_account()', 'D01 anon delete account');
  perform pg_temp.as_user('authenticated', u_owner);
  perform pg_temp.must_fail('select public.delete_my_account()', 'D02 owner deletes own account');

  execute 'reset role';
  insert into public.companies(owner_id, service_id, name, phone) values (u_a, 'tow', 'شركة اختبار الحذف', '96599990009') returning id into c1;
  perform pg_temp.as_user('authenticated', u_a);
  perform public.delete_my_account();
  execute 'reset role';
  if exists (select 1 from auth.users where id = u_a) then raise exception 'FAIL D03 user not deleted'; end if;
  if exists (select 1 from public.profiles where id = u_a) then raise exception 'FAIL D04 profile not deleted'; end if;
  if exists (select 1 from public.ads where owner_id = u_a) then raise exception 'FAIL D05 ads not deleted'; end if;
  if exists (select 1 from public.support_tickets where id = t1) then raise exception 'FAIL D06 tickets not deleted'; end if;
  select owner_id::text into v_txt from public.companies where id = c1;
  if not found then raise exception 'FAIL D07 company deleted (must be kept)'; end if;
  if v_txt is not null then raise exception 'FAIL D08 company still linked'; end if;
  if (select count(*) from public.profiles where role = 'admin') <> 1 then raise exception 'FAIL D09 admin count changed'; end if;

  raise exception 'ALL_PHASE2_TESTS_PASSED (rolled back)';
end $$;
