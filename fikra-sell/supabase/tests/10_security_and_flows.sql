-- FIKRA SELL · SQL test suite: permissions, RLS, anti-abuse and core flows.
-- Each block raises an exception on failure (psql runs with ON_ERROR_STOP).
\set ON_ERROR_STOP 1
set client_min_messages = notice;

create schema if not exists t;
create or replace function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if; raise notice 'ok  %', label; end $$;
-- Runs a statement and asserts it fails with a message containing `expect`.
create or replace function t.fails(stmt text, expect text, label text) returns void language plpgsql as $$
begin
  begin execute stmt;
  exception when others then
    if position(expect in sqlerrm) > 0 or sqlstate = expect then raise notice 'ok  % (%)', label, sqlerrm; return; end if;
    raise exception 'FAIL: % — wrong error: % / %', label, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % — statement succeeded but should fail', label;
end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

-- Identities
\set seller '\'11111111-1111-1111-1111-111111111111\''
\set buyer  '\'22222222-2222-2222-2222-222222222222\''
\set admin  '\'33333333-3333-3333-3333-333333333333\''
\set mod    '\'44444444-4444-4444-4444-444444444444\''
\set other  '\'55555555-5555-5555-5555-555555555555\''

-- ── Sign-up creates profile instantly; disposable e-mails are refused ──
insert into auth.users (id, email, raw_user_meta_data) values
  (:seller, 'seller@example.com', '{"full_name":"بائع التجربة"}'),
  (:buyer, 'buyer@example.com', '{"full_name":"Buyer Test","locale":"en"}'),
  (:admin, 'admin@example.com', '{"full_name":"المدير"}'),
  (:mod, 'mod@example.com', '{"full_name":"المشرف"}'),
  (:other, 'other@example.com', '{"full_name":"x"}');
select t.ok((select count(*) = 5 from public.profiles), 'profiles created by trigger on sign-up');
select t.ok((select locale = 'en' from public.profile_settings where user_id = :buyer), 'locale from metadata');
select t.ok((select full_name = 'other' from public.profiles where id = :other), 'short name falls back to e-mail local part');
select t.fails($$insert into auth.users (email, raw_user_meta_data) values ('a@mailinator.com', '{"full_name":"Spam"}')$$,
  'disposable_email', 'disposable e-mail sign-up blocked');

-- Promote admin + moderator (as database owner, like the first-owner bootstrap)
update public.profiles set role = 'owner' where id = :admin;
update public.profiles set role = 'moderator' where id = :mod;
insert into public.staff_permissions (user_id, permission) values (:mod, 'reports');

-- ═══════════════════════════ GUEST (anon) ═══════════════════════════════
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select t.ok((select count(*) = 19 from public.categories where parent_id is null), 'guest reads 19 main categories');
select t.ok((select count(*) = 6 from public.governorates), 'guest reads 6 governorates');
select t.ok((select count(*) = 107 from public.areas), 'guest reads 107 areas');
select t.ok((select count(*) = 3 from public.pages), 'guest reads legal pages');
select t.ok((select count(*) = 0 from public.search_ads('{}')), 'guest can search (empty market)');
select t.fails($$select * from public.profile_settings$$, 'permission denied', 'guest cannot read private settings');
select t.fails($$select * from public.messages$$, 'permission denied', 'guest cannot read messages');
select t.fails($$insert into public.ads (category_id, title, price, governorate_id, contact_phone) values (1, 'x', 1, 1, '99999999')$$,
  'permission denied', 'guest cannot post ads');
select t.fails($$select public.admin_stats()$$, 'permission denied', 'guest cannot call admin functions');
select t.fails($$select private.expire_ads()$$, 'permission denied', 'guest cannot call private functions');
reset role;

-- ═══════════════════════════ SELLER ═════════════════════════════════════
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :seller, 'role', 'authenticated')::text, false);

select t.fails($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'permission denied', 'cannot self-promote (column not granted)');
update public.profiles set full_name = 'بائع محترف' where id = auth.uid();
select t.ok((select full_name = 'بائع محترف' and role = 'user' from public.profiles where id = auth.uid()), 'can edit own name; role unchanged');
select t.ok((select count(*) = 0 from public.profiles p where p.id <> auth.uid() and p.full_name is null), 'profiles readable');
update public.profiles set full_name = 'hacked' where id = '22222222-2222-2222-2222-222222222222';
select t.ok((select full_name <> 'hacked' from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'cannot edit others profile');
select t.ok((select count(*) = 1 from public.profile_settings), 'sees only own private settings');

-- Must choose a sub-category when the main one has subs
select t.fails(format($$insert into public.ads (category_id, title, price, governorate_id, contact_phone) values (%s, 'Camry', 1000, 1, '99998888')$$,
  (select id from public.categories where slug = 'cars')), 'choose_subcategory', 'main category with subs rejected');
-- Required attribute
select t.fails(format($$insert into public.ads (category_id, title, price, governorate_id, contact_phone) values (%s, 'كامري', 1000, 1, '99998888')$$,
  (select id from public.categories where slug = 'cars-sale')), 'missing_field:make', 'required field enforced');
-- Invalid option
select t.fails(format($$insert into public.ads (category_id, title, price, governorate_id, contact_phone, attributes) values (%s, 'كامري', 1000, 1, '99998888', '{"make":"bogus","year":2020}')$$,
  (select id from public.categories where slug = 'cars-sale')), 'invalid_option:make', 'select option validated');
-- Price required for fixed
select t.fails(format($$insert into public.ads (category_id, title, governorate_id, contact_phone, attributes) values (%s, 'كامري', 1, '99998888', '{"make":"toyota","year":2020}')$$,
  (select id from public.categories where slug = 'cars-sale')), 'price_required', 'price required for fixed price');
-- Area must belong to governorate
select t.fails(format($$insert into public.ads (category_id, title, price, governorate_id, area_id, contact_phone, attributes) values (%s, 'كامري', 1000, 1, (select id from public.areas where name_en = 'Jahra'), '99998888', '{"make":"toyota","year":2020}')$$,
  (select id from public.categories where slug = 'cars-sale')), 'invalid_area', 'area/governorate consistency');

-- Valid ad, with forged protected columns that must be ignored
insert into public.ads (category_id, title, description, price, price_type, condition, governorate_id, area_id, contact_phone, attributes)
select (select id from public.categories where slug = 'cars-sale'), 'تويوتا  كامري   2020 نظيفة', 'السيّارة بحالة الوكالة، صبغ الوكالة', 4500.5, 'negotiable', 'used',
       g.id, (select a.id from public.areas a where a.governorate_id = g.id and a.name_en = 'Salmiya'), '99998888',
       '{"make":"toyota","model":"Camry","year":"2020","mileage":"85000","transmission":"automatic"}'
from public.governorates g where g.slug = 'hawalli';
select t.ok((select status = 'active' and user_id = auth.uid() and featured_until is null and expires_at > now() + interval '29 days'
             from public.ads order by id desc limit 1), 'ad published instantly, owner forced, 30-day expiry');
select t.ok((select title = 'تويوتا كامري 2020 نظيفة' from public.ads order by id desc limit 1), 'title whitespace normalised');
select t.ok((select (attributes ->> 'year')::int = 2020 and jsonb_typeof(attributes -> 'mileage') = 'number' from public.ads order by id desc limit 1), 'numeric attributes typed');
select t.ok((select main_category_id = (select id from public.categories where slug = 'cars') from public.ads order by id desc limit 1), 'main category derived');
select t.fails(format($$insert into public.ads (category_id, title, description, price, governorate_id, contact_phone, attributes) values (%s, 'تويوتا كامري 2020 نظيفة', 'السيّارة بحالة الوكالة، صبغ الوكالة', 4500, 1, '99998888', '{"make":"toyota","year":2020}')$$,
  (select id from public.categories where slug = 'cars-sale')), 'duplicate_ad', 'duplicate ad refused');
select t.fails($$update public.ads set featured_until = now() + interval '1 year'$$, 'permission denied', 'cannot self-feature (column not granted)');
update public.ads set price = 4400 where user_id = auth.uid();
select t.ok((select price = 4400 and status = 'active' from public.ads where user_id = auth.uid() limit 1), 'owner edits price');
select t.fails($$update public.ads set status = 'pending' where user_id = auth.uid()$$, 'invalid_status_change', 'cannot set arbitrary status');

-- Images: path must be in own folder
select t.fails(format($$insert into public.ad_images (ad_id, path) values (%s, '22222222-2222-2222-2222-222222222222/1/abcdefgh.jpg')$$,
  (select id from public.ads where user_id = auth.uid() limit 1)), 'invalid_image_path', 'image path outside own folder refused');
insert into public.ad_images (ad_id, path, sort)
select a.id, auth.uid() || '/' || a.id || '/img' || g || 'abcdef.jpg', g from public.ads a, generate_series(0, 2) g where a.user_id = auth.uid();
select t.ok((select images_count = 3 and cover_path like '%img0abcdef.jpg' from public.ads where user_id = auth.uid() limit 1), 'cover + count synced');
update public.ad_images set sort = -1 where path like '%img2abcdef.jpg';
select t.ok((select cover_path like '%img2abcdef.jpg' from public.ads where user_id = auth.uid() limit 1), 'reordering changes main photo');

-- Bump cooldown
select t.fails(format('select public.bump_ad(%s)', (select id from public.ads where user_id = auth.uid() limit 1)), 'bump_cooldown', 'bump cooldown enforced on fresh ad');
-- Second ad: jobs (no condition, salary)
insert into public.ads (category_id, title, price, price_type, condition, governorate_id, contact_phone, allow_call, allow_whatsapp, attributes)
select id, 'مطلوب محاسب', null, 'contact', 'new', 1, null, false, false, '{"job_type":"full_time"}' from public.categories where slug = 'jobs-vacancies';
select t.ok((select condition is null and price is null from public.ads where title = 'مطلوب محاسب'), 'condition dropped for jobs; contact-for-price');
select t.fails($$insert into public.ads (category_id, title, price, governorate_id, allow_call, allow_whatsapp, allow_chat) select id, 'بدون تواصل', 5, 1, false, false, false from public.categories where slug = 'misc'$$,
  'contact_method_required', 'at least one contact method');
reset role;

-- ═══════════════════════════ SEARCH ═════════════════════════════════════
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select t.ok((select count(*) = 1 from public.search_ads('{"q":"السياره"}')), 'Arabic spelling variant (ة/ه + ال) matches');
select t.ok((select count(*) = 1 from public.search_ads('{"q":"كامرى"}')), 'ى/ي variant matches');
select t.ok((select count(*) = 1 from public.search_ads('{"q":"تيوتا"}')), 'typo tolerated via trigram (تيوتا)');
select t.ok((select count(*) = 1 from public.search_ads('{"q":"toyota"}')), 'English attribute label searchable');
select t.ok((select count(*) = 0 from public.search_ads('{"q":"هوندا"}')), 'non-matching query returns nothing');
select t.ok((select count(*) = 1 from public.search_ads(jsonb_build_object('category_id', (select id from public.categories where slug = 'cars'), 'min_price', 4000, 'max_price', 5000))), 'category + price range');
select t.ok((select count(*) = 0 from public.search_ads('{"max_price": 100}')), 'max price filter');
select t.ok((select count(*) = 1 from public.search_ads('{"attrs":{"make":"toyota","year":{"min":2019}}}')), 'attribute filters');
select t.ok((select count(*) = 1 from public.search_ads(jsonb_build_object('governorate_id', (select id from public.governorates where slug = 'hawalli'), 'condition', 'used'))), 'governorate + condition');
select t.ok((select distance_km < 5 from public.search_ads('{"sort":"nearest","lat":29.33,"lng":48.03}') limit 1), 'nearest sort with distance');
select t.ok((select count(*) = 0 from public.search_ads('{"sort":"nearest","lat":29.34,"lng":47.66,"radius_km":5}')), 'radius excludes far ads');
select t.ok((select count(*) = 2 from public.search_ads('{"sort":"price_desc"}')), 'price sort includes contact-price ads');
select t.ok((select count(*) >= 1 from public.search_suggestions('توي')), 'suggestions');
select public.log_search('تويوتا');
reset role;
select t.ok((select hits = 1 from public.search_terms where term_norm = 'تويوتا'), 'search logged for suggestions');

-- ═══════════════════════════ BUYER: favourites, chat, blocks, reports ═══
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :buyer, 'role', 'authenticated')::text, false);
insert into public.favorites (ad_id) select id from public.ads where title like 'تويوتا%';
select t.ok((select favorites_count = 1 from public.ads where title like 'تويوتا%'), 'favourite counter');
select t.fails($$insert into public.favorites (user_id, ad_id) select '11111111-1111-1111-1111-111111111111', id from public.ads limit 1$$,
  'permission denied', 'cannot favourite on behalf of others');
select public.record_ad_event((select id from public.ads where title like 'تويوتا%'), 'view');
select public.record_ad_event((select id from public.ads where title like 'تويوتا%'), 'view');
select t.ok((select views_count = 1 from public.ads where title like 'تويوتا%'), 'view counted once per hour per user');
select t.fails($$update public.ads set views_count = 999$$, 'permission denied', 'cannot write view counters');

insert into public.saved_searches (name, query, filters) values ('سيارات تويوتا', 'تويوتا', jsonb_build_object('category_id', (select id from public.categories where slug = 'cars')));

select public.start_conversation((select id from public.ads where title like 'تويوتا%')) as conv \gset
select t.ok(:'conv' is not null, 'conversation started');
select t.ok((select public.start_conversation((select id from public.ads where title like 'تويوتا%')) = :'conv'::uuid), 'same conversation reused');
insert into public.messages (conversation_id, body) values (:'conv', 'السلام عليكم، السيارة موجودة؟');
select t.fails(format($$insert into public.messages (conversation_id, sender_id, body) values (%L, '11111111-1111-1111-1111-111111111111', 'spoof')$$, :'conv'),
  'permission denied', 'cannot spoof sender');
select t.fails(format($$insert into public.messages (conversation_id, image_path) values (%L, 'other-conv/x.jpg')$$, :'conv'), 'invalid_image_path', 'chat image path bound to conversation');
reset role;
select t.ok((select seller_unread = 1 and last_message_preview like 'السلام%' from public.conversations where id = :'conv'), 'conversation preview + unread');
select t.ok((select count(*) = 1 from public.notifications where user_id = :seller and type = 'message'), 'seller notified of message');

-- Outsider cannot see the conversation
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :other, 'role', 'authenticated')::text, false);
select t.ok((select count(*) = 0 from public.conversations), 'outsider sees no conversations');
select t.ok((select count(*) = 0 from public.messages), 'outsider sees no messages');
select t.fails(format($$insert into public.messages (conversation_id, body) values (%L, 'intrusion')$$, :'conv'), 'not_participant', 'outsider cannot post into conversation');
select t.fails(format('select public.mark_conversation_read(%L)', :'conv'), 'not_found', 'outsider cannot mark read');
select t.ok((select count(*) = 0 from public.notifications), 'outsider sees no one else''s notifications');
select t.ok((select count(*) = 0 from public.saved_searches), 'outsider sees no saved searches');

-- Seller reads + replies, then blocks the buyer
select set_config('request.jwt.claims', json_build_object('sub', :seller, 'role', 'authenticated')::text, false);
select public.mark_conversation_read(:'conv');
select t.ok((select seller_unread = 0 from public.conversations where id = :'conv'), 'mark read resets unread');
select t.ok((select read_at is not null from public.messages where conversation_id = :'conv' limit 1), 'read receipt set');
insert into public.messages (conversation_id, body) values (:'conv', 'نعم موجودة');
insert into public.blocks (blocked_id) values (:buyer);
select set_config('request.jwt.claims', json_build_object('sub', :buyer, 'role', 'authenticated')::text, false);
select t.fails(format($$insert into public.messages (conversation_id, body) values (%L, 'hello?')$$, :'conv'), 'blocked', 'blocked user cannot message');
select t.fails(format('select public.start_conversation(%s)', (select id from public.ads where title like 'تويوتا%')), 'blocked', 'blocked user cannot start chat');
-- Buyer reports the conversation and the ad
insert into public.reports (target_type, target_id, reason, details) values ('conversation', :'conv', 'offensive', 'رسائل مزعجة');
insert into public.reports (target_type, target_id, reason) select 'ad', id::text, 'scam' from public.ads where title like 'تويوتا%';
select t.fails($$insert into public.reports (target_type, target_id, reason) values ('user', '22222222-2222-2222-2222-222222222222', 'spam')$$, 'cannot_report_self', 'cannot report self');
select t.fails($$select * from public.admin_report_messages(1)$$, 'forbidden', 'non-staff cannot read reported messages');
select public.hide_conversation(:'conv');
select t.ok((select buyer_hidden_at is not null from public.conversations where id = :'conv'), 'conversation hidden for buyer only');
reset role;

-- ═══════════════════════════ STAFF ══════════════════════════════════════
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :mod, 'role', 'authenticated')::text, false);
select t.ok((select count(*) = 2 from public.reports), 'moderator with reports permission sees reports');
select t.ok((select count(*) >= 2 from public.admin_report_messages((select id from public.reports where target_type = 'conversation'))), 'moderator reads ONLY the reported conversation');
select t.ok((select count(*) = 0 from public.conversations), 'moderator still cannot list conversations');
select t.fails($$select public.admin_set_ban('22222222-2222-2222-2222-222222222222', true, 'x')$$, 'forbidden', 'moderator without users permission cannot ban');
select t.fails($$select * from public.admin_list_users()$$, 'forbidden', 'moderator without users permission cannot list users');
select t.fails($$insert into public.categories (slug, name_ar, name_en) values ('hack', 'x', 'x')$$, 'row-level security', 'moderator without categories permission cannot edit categories');
select t.fails($$select public.admin_set_role('22222222-2222-2222-2222-222222222222', 'moderator')$$, 'forbidden', 'moderator cannot grant roles');
select public.admin_resolve_report((select id from public.reports where target_type = 'conversation'), 'resolved', 'تم التحقق', 'none');

select set_config('request.jwt.claims', json_build_object('sub', :admin, 'role', 'authenticated')::text, false);
select t.ok((select (public.admin_stats() ->> 'users_total')::int = 5), 'owner stats');
select t.ok((select count(*) = 5 from public.admin_list_users()), 'owner lists users with e-mails');
insert into public.categories (slug, name_ar, name_en, icon, sort) values ('boats', 'القوارب', 'Boats', 'boat', 50);
update public.categories set sort = 99 where slug = 'boats';
delete from public.categories where slug = 'boats';
select t.ok((select count(*) = 3 from public.audit_log where target_type = 'categories'), 'category changes audited');
update public.app_settings set value = 'true' where key = 'require_ad_review';
select public.admin_set_ad_status((select id from public.ads where title = 'مطلوب محاسب'), 'rejected', 'نص غير واضح');
select public.admin_promote_ad((select id from public.ads where title like 'تويوتا%'), 'feature', 7);
select public.admin_set_ban(:other, true, 'احتيال');
select t.fails($$select public.admin_set_role('33333333-3333-3333-3333-333333333333', 'user')$$, 'forbidden', 'owner cannot demote self');
reset role;
select t.ok((select featured_until > now() + interval '6 days' from public.ads where title like 'تويوتا%'), 'admin featured an ad');
select t.ok((select count(*) = 1 from public.notifications where user_id = :seller and type = 'ad_rejected'), 'rejection notifies seller');
select t.ok((select is_banned from public.profiles where id = :other), 'user banned');
select t.ok((select count(*) >= 4 from public.audit_log), 'admin actions audited');

-- Rejected ad re-enters review after edit; review mode puts edits into pending
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :seller, 'role', 'authenticated')::text, false);
update public.ads set title = 'مطلوب محاسب قانوني' where title = 'مطلوب محاسب';
select t.ok((select status = 'pending' from public.ads where title = 'مطلوب محاسب قانوني'), 'edited rejected ad goes back to review');
update public.ads set status = 'sold' where title like 'تويوتا%';
select t.ok((select status = 'sold' and sold_at is not null from public.ads where title like 'تويوتا%'), 'mark as sold');
select t.fails($$update public.ads set price = 1 where title like 'تويوتا%'$$, 'sold_ad_locked', 'sold ad content locked');
reset role;

-- Banned user cannot post or chat
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :other, 'role', 'authenticated')::text, false);
select t.fails($$insert into public.ads (category_id, title, price, governorate_id, contact_phone) select id, 'محاولة', 5, 1, '99990000' from public.categories where slug = 'misc'$$,
  'account_banned', 'banned user cannot post');
select t.fails($$select public.start_conversation(100001)$$, 'account_banned', 'banned user cannot start chat');
reset role;

-- Expiry job + saved search matching
update public.app_settings set value = 'false' where key = 'require_ad_review';
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :seller, 'role', 'authenticated')::text, false);
delete from public.blocks where blocked_id = '22222222-2222-2222-2222-222222222222';
insert into public.ads (category_id, title, price, governorate_id, contact_phone, attributes)
select id, 'تويوتا لاندكروزر 2022', 18000, 1, '99998888', '{"make":"toyota","year":2022}' from public.categories where slug = 'cars-sale';
reset role;
select t.ok((select count(*) = 1 from public.notifications where user_id = :buyer and type = 'saved_search'), 'saved search match notifies buyer');
update public.ads set expires_at = now() - interval '1 minute' where title = 'تويوتا لاندكروزر 2022';
select private.expire_ads();
select t.ok((select status = 'expired' from public.ads where title = 'تويوتا لاندكروزر 2022'), 'expiry job expires ads');
select t.ok((select count(*) = 1 from public.notifications where user_id = :seller and type = 'ad_expired'), 'expiry notification');
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :seller, 'role', 'authenticated')::text, false);
select public.renew_ad((select id from public.ads where title = 'تويوتا لاندكروزر 2022'));
select t.ok((select status = 'active' and expires_at > now() + interval '29 days' from public.ads where title = 'تويوتا لاندكروزر 2022'), 'renew expired ad');
select t.fails($$select public.create_order(1)$$, 'payments_disabled', 'payments disabled at launch');
reset role;
update public.packages set is_active = true where kind = 'feature';
insert into public.promo_codes (code, discount_percent) values ('LAUNCH50', 50);
set role authenticated;
select t.ok((select (public.quote_package((select id from public.packages where kind = 'feature'), 'launch50') ->> 'amount_kwd')::numeric = 1.5), 'promo code quote (3.000 KWD − 50%)');
select t.fails($$select public.quote_package((select id from public.packages where kind = 'feature'), 'NOPE')$$, 'invalid_promo', 'invalid promo refused');
reset role;

-- Rate limit: posting too fast
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :buyer, 'role', 'authenticated')::text, false);
do $$ declare i int; begin
  for i in 1..3 loop
    insert into public.ads (category_id, title, price, governorate_id, contact_phone)
    select id, 'سلعة رقم ' || i, 5, 1, '99990000' from public.categories where slug = 'misc';
  end loop;
  begin
    insert into public.ads (category_id, title, price, governorate_id, contact_phone)
    select id, 'سلعة رابعة', 5, 1, '99990000' from public.categories where slug = 'misc';
    raise exception 'FAIL: new-account daily limit not enforced';
  exception when others then
    if sqlerrm not in ('daily_ad_limit', 'posting_too_fast') then raise; end if;
    raise notice 'ok  posting limits enforced (%)', sqlerrm;
  end;
end $$;

-- Account deletion removes everything (cascade)
select public.delete_my_account();
reset role;
select t.ok((select count(*) = 0 from public.profiles where id = :buyer), 'account deleted');
select t.ok((select count(*) = 0 from public.ads where user_id = :buyer), 'deleted account ads removed');
select t.ok((select count(*) = 0 from public.conversations where buyer_id = :buyer), 'deleted account conversations removed');
select t.ok((select count(*) = 0 from auth.users where id = :buyer), 'auth user removed');

-- Storage policies
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :seller, 'role', 'authenticated')::text, false);
insert into storage.objects (bucket_id, name, owner) values ('ad-images', :seller || '/100001/abcdefgh.jpg', :seller);
select t.fails($$insert into storage.objects (bucket_id, name) values ('ad-images', '22222222-2222-2222-2222-222222222222/1/x.jpg')$$, 'row-level security', 'cannot upload into another user folder');
select t.fails($$insert into storage.objects (bucket_id, name) values ('ad-images', '11111111-1111-1111-1111-111111111111/1/x.exe')$$, 'row-level security', 'non-image extension refused');
select t.fails($$insert into storage.objects (bucket_id, name) values ('banners', 'x.jpg')$$, 'row-level security', 'non-staff cannot upload banners');
reset role;

drop schema t cascade;
\echo '✓ security & flow suite passed'
