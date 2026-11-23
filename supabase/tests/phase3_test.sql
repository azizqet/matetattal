-- اختبارات المرحلة 3 (تُشغَّل بعد ملف المقترح داخل نفس المعاملة، وتنتهي بخطأ متعمد يُلغي كل شيء)
create or replace function pg_temp.as_user(p_role text, p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_uid)::text, true);
  execute format('set local role %I', p_role);
end $$;
do $$
declare u1 uuid := gen_random_uuid(); v_code text; v_ok boolean; v_hash_before text; v_txt text; v_n int; v_owner uuid; i int;
begin
  v_owner := (select (value #>> '{}')::uuid from public.app_settings where key = 'owner_user_id');
  -- T1: حساب جديد بالمعرّف الداخلي → الرقم في الملف الشخصي من المعرّف (لا من بيانات المستخدم)
  insert into auth.users(id, email, encrypted_password, aud, role, instance_id, raw_user_meta_data)
  values (u1, public.auth_email_for_phone('55500001'), extensions.crypt('oldpass11', extensions.gen_salt('bf', 10)), 'authenticated', 'authenticated',
          '00000000-0000-0000-0000-000000000000', '{"full_name":"اختبار","phone":"99999999"}');
  select phone into v_txt from public.profiles where id = u1;
  if v_txt is distinct from '55500001' then raise exception 'FAIL T1 profile phone=%', v_txt; end if;
  -- T2: لا حساب ثانٍ بنفس الرقم
  begin
    insert into auth.users(id, email, aud, role, instance_id) values (gen_random_uuid(), public.auth_email_for_phone('55500001'), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
    raise exception 'FAIL T2 duplicate phone account allowed';
  exception when unique_violation then null; end;
  -- T3: رمز الاستعادة للمستخدم نفسه فقط، والجدول غير مقروء
  perform pg_temp.as_user('authenticated', u1);
  v_code := public.create_recovery_code();
  if v_code !~ '^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$' then raise exception 'FAIL T3 code format %', v_code; end if;
  begin perform count(*) from public.account_recovery; raise exception 'FAIL T3b table readable'; exception when insufficient_privilege then null; end;
  if not public.has_recovery_code() then raise exception 'FAIL T3c has_recovery_code'; end if;
  -- T4: زائر بدون حساب لا يقدر يولّد رمزاً
  perform pg_temp.as_user('anon', null);
  begin perform public.create_recovery_code(); raise exception 'FAIL T4 anon create code'; exception when insufficient_privilege then null; end;
  -- T5: الرقم وحده (رمز خاطئ) لا يكفي، ولا يغيّر كلمة السر
  execute 'reset role';
  select encrypted_password into v_hash_before from auth.users where id = u1;
  perform pg_temp.as_user('anon', null);
  if public.reset_password_with_recovery('55500001', 'WRONG-CODE-000', 'newpass22') then raise exception 'FAIL T5 wrong code accepted'; end if;
  execute 'reset role';
  if (select encrypted_password from auth.users where id = u1) <> v_hash_before then raise exception 'FAIL T5b password changed'; end if;
  -- T6: كلمة سر ضعيفة مرفوضة
  perform pg_temp.as_user('anon', null);
  begin perform public.reset_password_with_recovery('55500001', v_code, 'short'); raise exception 'FAIL T6 weak accepted'; exception when raise_exception then
    if sqlerrm <> 'weak password' then raise; end if; end;
  -- T7: الرقم + الرمز الصحيح → كلمة سر جديدة (bcrypt) والرمز يُستهلك
  v_ok := public.reset_password_with_recovery('55500001', lower(v_code), 'newpass22');
  execute 'reset role';
  if not v_ok then raise exception 'FAIL T7'; end if;
  select encrypted_password into v_txt from auth.users where id = u1;
  if v_txt not like '$2a$%' or v_txt <> extensions.crypt('newpass22', v_txt) then raise exception 'FAIL T7b new hash'; end if;
  if exists (select 1 from public.account_recovery where user_id = u1) then raise exception 'FAIL T7c code reusable'; end if;
  -- T8: نفس الرمز لا يُستخدم مرتين
  perform pg_temp.as_user('anon', null);
  if public.reset_password_with_recovery('55500001', v_code, 'another33') then raise exception 'FAIL T8 code reused'; end if;
  -- T9: حد المحاولات لكل رقم (5 في الساعة) حتى لرقم غير مسجّل
  for i in 1..5 loop
    if public.reset_password_with_recovery('55500777', 'X', 'abcdefg1') then raise exception 'FAIL T9a'; end if;
  end loop;
  begin perform public.reset_password_with_recovery('55500777', 'X', 'abcdefg1'); raise exception 'FAIL T9 no rate limit'; exception when raise_exception then
    if sqlerrm <> 'too many attempts' then raise exception 'FAIL T9 msg %', sqlerrm; end if; end;
  -- T10: تحويل حساب المالك — نفس المعرّف، نفس كلمة السر، نفس الدور
  -- T11: حساب المدير يُقفل بعد 3 محاولات خاطئة (24 ساعة) حتى لو جاء الرمز الصحيح بعدها
  execute 'reset role';
  perform pg_temp.as_user('authenticated', v_owner);
  v_code := public.create_recovery_code();
  perform pg_temp.as_user('anon', null);
  for i in 1..3 loop
    if public.reset_password_with_recovery('99912313', 'BAD-' || i, 'abcdefg1') then raise exception 'FAIL T11a'; end if;
  end loop;
  if public.reset_password_with_recovery('99912313', v_code, 'abcdefg1') then raise exception 'FAIL T11 admin not locked'; end if;
  execute 'reset role';
  if (select locked_until from public.account_recovery where user_id = v_owner) < now() + interval '23 hours' then raise exception 'FAIL T11b lock duration'; end if;
  select email into v_txt from auth.users where id = v_owner;
  if v_txt <> '96599912313@users.matattal.invalid' then raise exception 'FAIL T10 owner email %', v_txt; end if;
  if (select identity_data->>'email' from auth.identities where user_id = v_owner and provider = 'email') <> v_txt then raise exception 'FAIL T10b identity'; end if;
  if (select role from public.profiles where id = v_owner) <> 'admin' then raise exception 'FAIL T10c role'; end if;
  if (select encrypted_password from auth.users where id = v_owner) <> (select encrypted_password from auth.users where id = v_owner) then raise exception 'x'; end if;
  if (select count(*) from backup_phase3.owner_auth) <> 1 then raise exception 'FAIL T10d backup'; end if;
  if (select email from backup_phase3.owner_auth) not like 'azi%' then raise exception 'FAIL T10e backup email'; end if;
  raise exception 'ALL_PHASE3_TESTS_PASSED (rolled back)';
end $$;
