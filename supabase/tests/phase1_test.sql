-- اختبارات المرحلة 1 (الشروط والموافقات وحماية الملكية) + 1B (حالات السطحات).
-- تُشغَّل بعد ملفي المقترح داخل نفس المعاملة، وتنتهي بخطأ متعمد يُلغي كل شيء:
-- النجاح = 'ALL_PHASE1_TESTS_PASSED (rolled back)'.

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
  u_cust uuid := gen_random_uuid(); u_comp uuid := gen_random_uuid();
  u_comp2 uuid := gen_random_uuid(); u_partner uuid := gen_random_uuid();
  c1 bigint; c2 bigint; v1 bigint; v_other bigint; v_req bigint; v_n int; v_txt text; v_ts timestamptz;
  d_cust bigint; d_priv bigint; d_prov bigint; d_subs bigint; v_body text := repeat('نص شروط تجريبي للاختبار فقط. ', 5);
begin
  if (select count(*) from public.profiles where role = 'admin') <> 1 then raise exception 'SETUP: expected exactly one admin'; end if;
  if not exists (select 1 from public.app_settings where key='owner_user_id' and value #>> '{}' = u_owner::text) then
    raise exception 'FAIL T00 owner_user_id not set to the sole admin'; end if;
  insert into auth.users(id, email, aud, role, instance_id) values
    (u_cust,'p1_cust_'||u_cust||'@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
    (u_comp,'p1_comp_'||u_comp||'@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
    (u_comp2,'p1_comp2_'||u_comp2||'@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
    (u_partner,'p1_partner_'||u_partner||'@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
  insert into public.profiles(id, full_name) values (u_cust,'عميل'),(u_comp,'شركة1'),(u_comp2,'شركة2'),(u_partner,'شريك') on conflict do nothing;

  -- ===== قبل نشر الشروط: التسجيل لا يتوقف (قرار المالك) =====
  perform pg_temp.as_user('authenticated', u_comp);
  insert into public.companies(owner_id, service_id, name, phone) values (u_comp, 'tow', 'سطحات اختبار 1', '96599990001') returning id into c1;
  perform public.request_subscription(c1, 'monthly', null);  -- لا شروط منشورة → مسموح
  select count(*) into v_n from public.my_pending_terms(); if v_n <> 0 then raise exception 'FAIL T01 pending terms before publication'; end if;
  perform pg_temp.must_fail(format('insert into public.terms_documents(kind,version,title,body) values (''customers'',''9.9'',''x'',%L)', v_body), 'T02 non-admin writes terms');

  -- ===== المالك ينشر الشروط =====
  perform pg_temp.as_user('authenticated', u_owner);
  insert into public.terms_documents(kind,version,title,body,is_current,body_sha256) values ('customers','1.0','شروط العملاء',v_body,true,'forged') returning id into d_cust;
  insert into public.terms_documents(kind,version,title,body,is_current) values ('privacy','1.0','الخصوصية',v_body||'p',true) returning id into d_priv;
  insert into public.terms_documents(kind,version,title,body,is_current) values ('providers','1.0','مقدمي الخدمات',v_body||'v',true) returning id into d_prov;
  insert into public.terms_documents(kind,version,title,body,is_current) values ('subscriptions','1.0','الاشتراكات',v_body||'s',true) returning id into d_subs;
  insert into public.terms_documents(kind,version,title,body) values ('ads','1.0','الإعلانات - مسودة',v_body||'a');  -- غير منشورة
  if (select body_sha256 from public.terms_documents where id=d_cust) <> encode(extensions.digest(v_body,'sha256'),'hex') then
    raise exception 'FAIL T03 server-side hash not enforced'; end if;
  if (select published_at from public.terms_documents where id=d_cust) is null then raise exception 'FAIL T04 published_at not set'; end if;
  perform pg_temp.must_fail(format('update public.terms_documents set body = body || ''x'' where id=%s', d_cust), 'T05 edit published text');
  perform pg_temp.must_fail(format('delete from public.terms_documents where id=%s', d_cust), 'T06 delete terms');
  perform pg_temp.must_fail('insert into public.terms_documents(kind,version,title,body,is_current) values (''customers'',''1.1'',''x'','''||v_body||''',true)', 'T07 two current versions');

  perform pg_temp.as_user('anon', null);
  select count(*) into v_n from public.terms_documents; if v_n <> 4 then raise exception 'FAIL T08 anon sees % docs (expected 4 published)', v_n; end if;

  -- ===== بعد النشر: الموافقة إلزامية =====
  perform pg_temp.as_user('authenticated', u_comp2);
  select count(*) into v_n from public.my_pending_terms(); if v_n <> 2 then raise exception 'FAIL T09 new user pending % (expected customers+privacy)', v_n; end if;
  perform pg_temp.must_fail(format('insert into public.companies(owner_id,service_id,name) values (%L,''tow'',''بدون موافقة'')', u_comp2), 'T10 company without consent');
  insert into public.terms_acceptances(document_id, context, user_id, kind, version, body_sha256, accepted_at, platform)
    values (d_prov, 'company_create', u_cust, 'forged', '0.0', 'forged', '2000-01-01', 'ios');
  insert into public.terms_acceptances(document_id, context, platform) values (d_priv, 'company_create', 'ios');
  if exists (select 1 from public.terms_acceptances where user_id = u_cust) then raise exception 'FAIL T11 acceptance recorded for another user'; end if;
  select count(*) into v_n from public.terms_acceptances where user_id = u_comp2 and document_id = d_prov and kind='providers' and version='1.0'
    and body_sha256 = (select body_sha256 from public.terms_documents where id=d_prov) and accepted_at > '2020-01-01';
  if v_n <> 1 then raise exception 'FAIL T12 forged acceptance fields not overwritten'; end if;
  insert into public.companies(owner_id, service_id, name, phone) values (u_comp2, 'tow', 'سطحات اختبار 2', '96599990002') returning id into c2;
  perform pg_temp.must_fail('update public.terms_acceptances set version = ''9''', 'T13 edit acceptance');
  perform pg_temp.must_fail('delete from public.terms_acceptances', 'T14 delete acceptance');
  perform pg_temp.must_fail(format('insert into public.terms_acceptances(document_id, context) values ((select id from public.terms_documents where kind=''ads''), ''ads'')'), 'T15 accept unpublished doc');
  select count(*) into v_n from public.my_pending_terms(); if v_n <> 2 then raise exception 'FAIL T16 company owner pending % (expected customers + subscriptions)', v_n; end if;

  perform pg_temp.as_user('authenticated', u_comp);
  select count(*) into v_n from public.terms_acceptances; if v_n <> 0 then raise exception 'FAIL T17 user reads others acceptances'; end if;
  perform pg_temp.must_fail(format('select public.request_subscription(%s, ''monthly'', null)', c1), 'T18 subscription without consent');
  insert into public.terms_acceptances(document_id, context) values (d_prov, 'subscription'), (d_subs, 'subscription');
  perform public.request_subscription(c1, 'monthly', null);

  -- ===== حماية الملكية =====
  perform pg_temp.as_user('authenticated', u_owner);
  perform public.admin_set_role(u_partner, 'admin');
  if not public.is_owner() then raise exception 'FAIL T19 owner not recognised'; end if;
  select count(*) into v_n from public.terms_acceptances; if v_n < 4 then raise exception 'FAIL T20 owner/staff cannot audit acceptances'; end if;
  perform pg_temp.must_fail(format('select public.admin_set_role(%L,''customer'')', u_owner), 'T21 owner changes own role');

  perform pg_temp.as_user('authenticated', u_partner);
  if public.is_owner() then raise exception 'FAIL T22 partner treated as owner'; end if;
  perform pg_temp.must_fail(format('select public.admin_set_role(%L,''customer'')', u_owner), 'T23 partner demotes owner');
  perform pg_temp.must_fail(format('select public.admin_set_role(%L,''admin'')', u_cust), 'T24 partner grants admin');
  perform public.admin_set_role(u_cust, 'staff');  -- صلاحية تشغيلية مسموحة
  perform pg_temp.must_fail('update public.app_settings set value = ''"x"'' where key = ''owner_user_id''', 'T25 partner edits owner setting');
  perform pg_temp.must_fail('update public.app_settings set value = ''"gateway"'' where key = ''payment_mode''', 'T26 partner edits payment setting');
  update public.app_settings set value = value where key = 'trial_days';  -- إعداد غير حساس مسموح
  get diagnostics v_n = row_count; if v_n <> 1 then raise exception 'FAIL T27 partner blocked from normal settings'; end if;
  select count(*) into v_n from public.join_requests; if v_n < 1 then raise exception 'FAIL T28 partner lacks operational access'; end if;

  perform pg_temp.as_user('authenticated', u_owner);
  perform public.admin_set_role(u_partner, 'staff');  -- المالك فقط يسحب المدير
  perform public.admin_set_role(u_partner, 'admin');

  -- ===== مسار الموقع لم يتأثر =====
  insert into public.companies(service_id, name, phone, whatsapp, is_active, status, sub_start, sub_end)
    values ('tow', 'شركة من لوحة الموقع', '96599990003', '96599990003', true, 'approved', current_date, current_date + 30);
  perform pg_temp.as_user('anon', null);
  insert into public.join_requests(company_name, service_id, phone, area_name) values ('طلب اختبار', 'tow', '99990004', 'حولي');

  -- ===== 1B: حالات السطحات =====
  perform pg_temp.as_user('authenticated', u_comp2);
  insert into public.company_vehicles(company_id, label, kind, status_updated_at) values (c2, 'سطحة 1', 'flatbed', '2000-01-01') returning id into v1;
  select status, status_updated_at into v_txt, v_ts from public.company_vehicles where id = v1;
  if v_txt <> 'offline' or v_ts < '2020-01-01' then raise exception 'FAIL T29 default status/time (%, %)', v_txt, v_ts; end if;
  insert into public.company_vehicles(company_id, label) values (c2, 'سطحة 2');
  update public.company_vehicles set status = 'available', status_updated_at = '2000-01-01' where id = v1;
  select status, status_updated_at into v_txt, v_ts from public.company_vehicles where id = v1;
  if v_txt <> 'available' or v_ts < '2020-01-01' then raise exception 'FAIL T30 status/time not server-stamped'; end if;
  perform pg_temp.must_fail(format('update public.company_vehicles set company_id = %s where id = %s', c1, v1), 'T31 move vehicle to another company');

  perform pg_temp.as_user('authenticated', u_comp);
  insert into public.company_vehicles(company_id, label) values (c1, 'ونش الشركة 1') returning id into v_other;
  perform pg_temp.must_fail(format('insert into public.company_vehicles(company_id,label) values (%s,''دخيل'')', c2), 'T32 add vehicle to other company');
  perform pg_temp.must_fail(format('update public.company_vehicles set status = ''busy'' where id = %s', v1), 'T33 change other company vehicle');

  perform pg_temp.as_user('anon', null);
  if exists (select 1 from public.company_vehicles where company_id = c2) then raise exception 'FAIL T34 hidden company vehicles visible'; end if;
  perform pg_temp.as_user('authenticated', u_owner);
  update public.companies set status = 'approved', is_active = true, sub_start = current_date, sub_end = current_date + 30 where id = c2;
  perform pg_temp.as_user('anon', null);
  select count(*) into v_n from public.company_vehicles where company_id = c2; if v_n <> 2 then raise exception 'FAIL T35 anon sees % vehicles of visible company', v_n; end if;
  perform pg_temp.must_fail(format('update public.company_vehicles set status = ''busy'' where id = %s', v1), 'T36 anon changes status');

  -- الطلب من داخل التطبيق وربطه بسطحة
  perform pg_temp.as_user('authenticated', u_cust);
  perform pg_temp.must_fail(format('update public.company_vehicles set status = ''busy'' where id = %s', v1), 'T37 customer changes status');
  perform pg_temp.must_fail(format('insert into public.service_requests(company_id, service_id, phone, vehicle_id) values (%s,''tow'',''99887766'',%s)', c2, v1), 'T38 customer picks vehicle');
  insert into public.service_requests(company_id, service_id, phone) values (c2, 'tow', '99887766') returning id into v_req;
  perform pg_temp.must_fail(format('update public.service_requests set vehicle_id = %s where id = %s', v1, v_req), 'T39 customer assigns vehicle');
  perform pg_temp.as_user('authenticated', u_comp2);
  perform pg_temp.must_fail(format('update public.service_requests set vehicle_id = %s where id = %s', v_other, v_req), 'T40 assign other company vehicle');
  update public.service_requests set vehicle_id = v1, status = 'accepted' where id = v_req;
  if (select vehicle_id from public.service_requests where id = v_req) <> v1 then raise exception 'FAIL T41 owner cannot assign own vehicle'; end if;
  if (select status from public.company_vehicles where id = v1) <> 'available' then raise exception 'FAIL T42 status changed automatically (decision C default = manual)'; end if;

  execute 'reset role';
  raise exception 'ALL_PHASE1_TESTS_PASSED (rolled back)';
end $$;
