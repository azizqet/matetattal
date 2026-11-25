-- اختبار صلاحيات RLS لـ «ماتعطل».
-- يعمل داخل معاملة ثم يتراجع عن كل شيء في النهاية (لا يترك أي بيانات اختبار).
-- النتيجة المتوقعة عند النجاح: خطأ نصه يبدأ بـ ALL_RLS_TESTS_PASSED
-- أي نص آخر = اختبار فشل (رقم الاختبار مذكور في الرسالة).

create or replace function pg_temp.as_user(p_role text, p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('role', p_role, 'sub', p_uid)::text, true);
  execute format('set local role %I', p_role);
end $$;

-- يتوقع فشل الأمر (منع صلاحية أو استثناء)
create or replace function pg_temp.must_fail(p_sql text, p_label text) returns void language plpgsql as $$
declare v_rows int;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
  exception when others then
    return; -- فشل كما هو متوقع
  end;
  -- تحديث/حذف بلا صفوف متأثرة = ممنوع بواسطة RLS (نجاح)
  if v_rows = 0 and p_sql ~* '^\s*(update|delete)' then return; end if;
  raise exception 'FAIL % : expected denial but succeeded (% rows)', p_label, v_rows;
end $$;

do $$
declare
  u_cust uuid := gen_random_uuid();
  u_comp uuid := gen_random_uuid();
  u_admin uuid := (select id from public.profiles where role='admin' limit 1);
  v_company bigint; v_sub json; v_n int; v_req bigint; v_txt text; v_sub_id bigint;
begin
  if u_admin is null then raise exception 'SETUP: no admin profile'; end if;
  insert into auth.users(id, email, aud, role, instance_id, raw_user_meta_data) values
    (u_cust, 'rls_cust_'||u_cust||'@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000','{"full_name":"عميل اختبار"}'),
    (u_comp, 'rls_comp_'||u_comp||'@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000','{"full_name":"شركة اختبار"}');
  insert into public.profiles(id, full_name) values (u_cust,'عميل اختبار'),(u_comp,'شركة اختبار') on conflict do nothing;

  -- ========== زائر مجهول ==========
  perform pg_temp.as_user('anon', null);
  select count(*) into v_n from public.companies;
  if v_n < 1 then raise exception 'FAIL T01 anon should read visible companies'; end if;
  if exists (select 1 from public.companies where not (is_active and status='approved' and sub_end >= current_date)) then
    raise exception 'FAIL T02 anon sees hidden companies'; end if;
  select count(*) into v_n from public.services; if v_n < 5 then raise exception 'FAIL T03 anon read services'; end if;
  select count(*) into v_n from public.app_settings; if v_n < 1 then raise exception 'FAIL T04 anon read settings'; end if;
  perform pg_temp.must_fail('select count(*) from public.join_requests', 'T05 anon read join_requests');
  perform pg_temp.must_fail('select * from public.profiles', 'T06 anon read profiles');
  perform pg_temp.must_fail('update public.companies set name=''x''', 'T07 anon update companies');
  perform pg_temp.must_fail('delete from public.companies', 'T08 anon delete companies');
  perform pg_temp.must_fail('select public.admin_stats()', 'T09 anon admin_stats');
  perform pg_temp.must_fail('select public.notify(null,''x'',''y'',''{}'')', 'T10 anon notify');
  perform pg_temp.must_fail('insert into public.app_settings(key,value) values (''hack'',''1'')', 'T11 anon write settings');
  perform pg_temp.must_fail('select * from public.payments', 'T12 anon read payments');
  perform pg_temp.must_fail('insert into public.join_requests(company_name,phone,status) values (''ab'',''123'',''new'')', 'T13 join phone too short');
  insert into public.join_requests(company_name, service_id, phone, area_name) values ('شركة اختبار RLS','tow','99999991','حولي');
  insert into public.join_requests(company_name, service_id, phone, area_name) values ('شركة اختبار RLS','tow','99999991','حولي');
  insert into public.join_requests(company_name, service_id, phone, area_name) values ('شركة اختبار RLS','tow','99999991','حولي');
  perform pg_temp.must_fail('insert into public.join_requests(company_name,service_id,phone,area_name) values (''شركة اختبار'',''tow'',''99999991'',''حولي'')', 'T14 join rate limit');
  perform pg_temp.must_fail('insert into public.join_requests(company_name,service_id,phone,area_name,logo_url) values (''شركة اختبار'',''tow'',''99999992'',''حولي'',''https://evil.example/x.jpg'')', 'T15 join foreign logo url');

  -- ========== عميل مسجل ==========
  perform pg_temp.as_user('authenticated', u_cust);
  select count(*) into v_n from public.profiles; if v_n <> 1 then raise exception 'FAIL T20 customer sees % profiles', v_n; end if;
  perform pg_temp.must_fail(format('update public.profiles set role=''admin'' where id=%L', u_cust), 'T21 self promote to admin');
  perform pg_temp.must_fail(format('select public.admin_set_role(%L,''admin'')', u_cust), 'T22 admin_set_role by customer');
  perform pg_temp.must_fail('select public.admin_stats()', 'T23 customer admin_stats');
  perform pg_temp.must_fail('select * from public.admin_find_user(''x@y.z'')', 'T24 customer find user');
  perform pg_temp.must_fail('update public.companies set is_active=false', 'T25 customer update others company');
  select count(*) into v_n from public.join_requests; if v_n <> 0 then raise exception 'FAIL T26 customer reads % join requests', v_n; end if;
  select count(*) into v_n from public.service_requests; if v_n <> 0 then raise exception 'FAIL T26b customer sees others requests'; end if;
  update public.profiles set full_name='عميل معدل', phone='99887766' where id=u_cust;
  -- طلب خدمة من شركة ظاهرة
  select id into v_company from public.companies limit 1;
  insert into public.service_requests(company_id, service_id, phone, note) values (v_company, 'tow', '99887766', 'اختبار') returning id into v_req;
  perform pg_temp.must_fail(format('update public.service_requests set status=''done'' where id=%s', v_req), 'T27 customer marks done');
  update public.service_requests set status='cancelled' where id=v_req;
  perform pg_temp.must_fail(format('update public.service_requests set status=''new'' where id=%s', v_req), 'T28 reopen closed request');
  -- تقييم
  insert into public.reviews(company_id, rating, comment) values (v_company, 5, 'ممتاز');
  perform pg_temp.must_fail(format('insert into public.reviews(company_id, rating) values (%s, 4)', v_company), 'T29 duplicate review');
  perform pg_temp.must_fail(format('update public.reviews set is_hidden=true where user_id=%L', u_cust), 'T30 self hide review');
  perform pg_temp.must_fail(format('insert into public.reviews(company_id, user_id, rating) values (%s, %L, 1)', v_company, u_comp), 'T31 review as someone else');
  insert into public.favorites(company_id) values (v_company);
  select count(*) into v_n from public.favorites; if v_n <> 1 then raise exception 'FAIL T32 favorites'; end if;
  insert into public.complaints(company_id, subject, body) values (v_company, 'شكوى اختبار', 'نص شكوى للاختبار');
  perform pg_temp.must_fail('update public.complaints set status=''resolved''', 'T33 customer resolves complaint');

  -- ========== صاحب شركة ==========
  perform pg_temp.as_user('authenticated', u_comp);
  insert into public.companies(owner_id, service_id, name, phone, whatsapp, status, is_active)
    values (u_comp, 'tire', 'بنشر اختبار', '96599999993', '96599999993', 'pending', false) returning id into v_company;
  select status into v_txt from public.companies where id=v_company;
  if v_txt <> 'pending' then raise exception 'FAIL T40 new company status %', v_txt; end if;
  select role into v_txt from public.profiles where id=u_comp;
  if v_txt <> 'company' then raise exception 'FAIL T41 owner role not promoted (%)', v_txt; end if;
  -- محاولة إدخال شركة "معتمدة" مباشرة: التريجر يجبرها على pending وغير فعالة
  insert into public.companies(owner_id,service_id,name,status,is_active,sub_end) values (u_comp,'tow','محاولة اعتماد ذاتي','approved',true,current_date+999);
  if exists (select 1 from public.companies where name='محاولة اعتماد ذاتي' and (status<>'pending' or is_active or sub_end>=current_date)) then
    raise exception 'FAIL T42 self-approved insert was not sanitized'; end if;
  perform pg_temp.must_fail(format('update public.companies set status=''approved'' where id=%s', v_company), 'T43 self approve');
  perform pg_temp.must_fail(format('update public.companies set sub_end=current_date+365 where id=%s', v_company), 'T44 self extend');
  perform pg_temp.must_fail(format('update public.companies set rating=5 where id=%s', v_company), 'T45 self rating');
  update public.companies set description='وصف', is_24h=true, lat=29.3, lng=48.0 where id=v_company;
  insert into public.company_areas(company_id, area_id) values (v_company, 2);
  insert into public.company_services(company_id, service_id, title, price_from) values (v_company, 'tire', 'تبديل إطار', 5);
  -- شركة غير ظاهرة للعامة
  perform pg_temp.as_user('anon', null);
  if exists (select 1 from public.companies where id=v_company) then raise exception 'FAIL T46 pending company visible to anon'; end if;
  perform pg_temp.as_user('authenticated', u_comp);
  v_sub := public.request_subscription(v_company, 'monthly', 'LAUNCH100');
  if (v_sub->>'amount_kwd')::numeric <> 10 then raise exception 'FAIL T47 promo amount %', v_sub->>'amount_kwd'; end if;
  v_sub_id := (v_sub->>'subscription_id')::bigint;
  perform pg_temp.must_fail(format('select public.admin_activate_subscription(%s)', v_sub_id), 'T48 owner activates own sub');
  perform pg_temp.must_fail(format('update public.subscriptions set status=''active'' where id=%s', v_sub_id), 'T49 owner updates sub');
  perform pg_temp.must_fail(format('insert into public.payments(subscription_id, amount_kwd, status) values (%s, 0, ''paid'')', v_sub_id), 'T50 owner fakes payment');
  select count(*) into v_n from public.subscriptions where company_id=v_company; if v_n <> 1 then raise exception 'FAIL T51 owner reads own subs'; end if;
  perform pg_temp.must_fail('select public.request_subscription((select min(id) from public.companies where owner_id is null), ''monthly'')', 'T52 request sub for others company');

  -- ========== المدير ==========
  perform pg_temp.as_user('authenticated', u_admin);
  select count(*) into v_n from public.join_requests; if v_n < 1 then raise exception 'FAIL T60 admin reads join requests'; end if;
  perform public.admin_stats();
  perform public.admin_activate_subscription(v_sub_id, 'تحويل بنكي اختبار');
  select status into v_txt from public.companies where id=v_company;
  if v_txt <> 'approved' then raise exception 'FAIL T61 activation did not approve company (%)', v_txt; end if;
  if not exists (select 1 from public.companies where id=v_company and sub_end >= current_date + 27) then raise exception 'FAIL T62 sub_end not extended'; end if;
  select count(*) into v_n from public.payments where subscription_id=v_sub_id and status='paid'; if v_n <> 1 then raise exception 'FAIL T63 payment row'; end if;
  select count(*) into v_n from public.notifications where user_id=u_comp; if v_n < 1 then raise exception 'FAIL T64 owner notified'; end if;
  update public.app_settings set value='"96500000000"' where key='support_whatsapp';
  select count(*) into v_n from public.admin_find_user('rls_comp_'||u_comp||'@test.local'); if v_n <> 1 then raise exception 'FAIL T65 find user'; end if;

  -- الشركة صارت ظاهرة
  perform pg_temp.as_user('anon', null);
  if not exists (select 1 from public.companies where id=v_company) then raise exception 'FAIL T66 activated company not visible'; end if;
  select count(*) into v_n from public.nearby_companies(29.3, 48.0, 'tire', 20) where id=v_company; if v_n <> 1 then raise exception 'FAIL T67 nearby search'; end if;

  -- الشركة تستقبل طلباً وتغير حالته
  perform pg_temp.as_user('authenticated', u_cust);
  insert into public.service_requests(company_id, service_id, phone) values (v_company, 'tire', '99887766') returning id into v_req;
  perform pg_temp.as_user('authenticated', u_comp);
  update public.service_requests set status='accepted' where id=v_req;
  update public.service_requests set status='on_way' where id=v_req;
  update public.service_requests set status='done' where id=v_req;
  perform pg_temp.must_fail(format('update public.service_requests set phone=''55555555'' where id=%s', v_req), 'T68 company edits customer phone');
  perform pg_temp.must_fail(format('insert into public.reviews(company_id, rating) values (%s, 5)', v_company), 'T69 review own company');
  perform pg_temp.as_user('authenticated', u_cust);
  select count(*) into v_n from public.notifications where user_id=u_cust; if v_n < 3 then raise exception 'FAIL T70 customer notified (%)', v_n; end if;

  execute 'reset role';
  raise exception 'ALL_RLS_TESTS_PASSED (rolled back)';
end $$;
