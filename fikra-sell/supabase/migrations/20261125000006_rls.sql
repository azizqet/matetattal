-- FIKRA SELL · 0006 · Row Level Security & grants (least privilege)

-- Start from zero: no table privileges for API roles, then grant precisely.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ── Profiles ───────────────────────────────────────────────────────────
grant select on public.profiles to anon, authenticated;
grant update (full_name, avatar_path, bio) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select, update (phone, locale, notification_prefs, last_seen_at) on public.profile_settings to authenticated;
create policy settings_own_read on public.profile_settings for select to authenticated using (user_id = (select auth.uid()));
create policy settings_own_update on public.profile_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.user_bans to authenticated;
create policy bans_staff on public.user_bans for select to authenticated using ((select public.has_perm('users')));

grant select, insert, delete on public.staff_permissions to authenticated;
create policy staff_read on public.staff_permissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('staff')));
create policy staff_write on public.staff_permissions for insert to authenticated
  with check ((select public.current_role_level()) in ('admin', 'owner')
              and exists (select 1 from public.profiles p where p.id = user_id and p.role = 'moderator'));
create policy staff_delete on public.staff_permissions for delete to authenticated
  using ((select public.current_role_level()) in ('admin', 'owner'));

-- ── Reference data (public read; staff manage) ─────────────────────────
grant select on public.governorates, public.areas, public.categories, public.category_fields, public.pages to anon, authenticated;
grant insert, update, delete on public.governorates, public.areas, public.categories, public.category_fields, public.pages to authenticated;

create policy gov_read on public.governorates for select using (is_active or (select public.has_perm('locations')));
create policy gov_write on public.governorates for all to authenticated
  using ((select public.has_perm('locations'))) with check ((select public.has_perm('locations')));
create policy areas_read on public.areas for select using (is_active or (select public.has_perm('locations')));
create policy areas_write on public.areas for all to authenticated
  using ((select public.has_perm('locations'))) with check ((select public.has_perm('locations')));
create policy cats_read on public.categories for select using (is_active or (select public.has_perm('categories')));
create policy cats_write on public.categories for all to authenticated
  using ((select public.has_perm('categories'))) with check ((select public.has_perm('categories')));
create policy fields_read on public.category_fields for select using (true);
create policy fields_write on public.category_fields for all to authenticated
  using ((select public.has_perm('categories'))) with check ((select public.has_perm('categories')));
create policy pages_read on public.pages for select using (true);
create policy pages_write on public.pages for all to authenticated
  using ((select public.has_perm('pages'))) with check ((select public.has_perm('pages')));

grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
create policy settings_read on public.app_settings for select using (is_public or (select public.is_staff()));
create policy settings_write on public.app_settings for all to authenticated
  using ((select public.has_perm('settings'))) with check ((select public.has_perm('settings')));

-- ── Ads ────────────────────────────────────────────────────────────────
grant select on public.ads to anon, authenticated;
grant insert (category_id, title, description, price, price_type, condition, governorate_id, area_id, lat, lng,
  attributes, contact_phone, allow_call, allow_whatsapp, allow_chat) on public.ads to authenticated;
grant update (category_id, title, description, price, price_type, condition, governorate_id, area_id, lat, lng,
  attributes, contact_phone, allow_call, allow_whatsapp, allow_chat, status) on public.ads to authenticated;
grant delete on public.ads to authenticated;
create policy ads_read on public.ads for select using (
  status in ('active', 'sold') or user_id = (select auth.uid()) or (select public.has_perm('ads')));
create policy ads_insert on public.ads for insert to authenticated with check (user_id = (select auth.uid()));
create policy ads_update_own on public.ads for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ads_delete on public.ads for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('ads')));

grant select on public.ad_images to anon, authenticated;
grant insert (ad_id, path, sort, width, height), update (sort), delete on public.ad_images to authenticated;
create policy images_read on public.ad_images for select using (exists (select 1 from public.ads a where a.id = ad_id));
create policy images_insert on public.ad_images for insert to authenticated with check (
  exists (select 1 from public.ads a where a.id = ad_id and a.user_id = (select auth.uid())));
create policy images_update on public.ad_images for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy images_delete on public.ad_images for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('ads')));

grant select, insert (ad_id), delete on public.favorites to authenticated;
create policy fav_own on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.favorites alter column user_id set default auth.uid();

grant select, insert (name, query, filters, notify), update (name, notify), delete on public.saved_searches to authenticated;
create policy saved_own on public.saved_searches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.saved_searches alter column user_id set default auth.uid();

-- search_terms: RPC only (no grants).

-- ── Chat ───────────────────────────────────────────────────────────────
grant select on public.conversations to authenticated;
create policy conv_participant on public.conversations for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

grant select, insert (conversation_id, body, image_path) on public.messages to authenticated;
create policy msg_read on public.messages for select to authenticated using ((select public.is_participant(conversation_id)));
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (select public.is_participant(conversation_id)));
alter table public.messages alter column sender_id set default auth.uid();

grant select, insert (blocked_id), delete on public.blocks to authenticated;
create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
alter table public.blocks alter column blocker_id set default auth.uid();

grant select, insert (target_type, target_id, reason, details) on public.reports to authenticated;
grant update (status, resolution_note) on public.reports to authenticated;
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.has_perm('reports')));
create policy reports_update on public.reports for update to authenticated
  using ((select public.has_perm('reports'))) with check ((select public.has_perm('reports')));
alter table public.reports alter column reporter_id set default auth.uid();

-- ── Notifications & push ───────────────────────────────────────────────
grant select, update (read_at), delete on public.notifications to authenticated;
create policy notif_own_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_own_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_own_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

grant select, delete on public.push_tokens to authenticated;
create policy push_own on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.broadcasts to authenticated;
create policy broadcasts_staff on public.broadcasts for select to authenticated using ((select public.has_perm('notifications')));

-- ── Commerce ───────────────────────────────────────────────────────────
grant select on public.packages to anon, authenticated;
grant insert, update, delete on public.packages to authenticated;
create policy packages_read on public.packages for select using (is_active or (select public.has_perm('commerce')));
create policy packages_write on public.packages for all to authenticated
  using ((select public.has_perm('commerce'))) with check ((select public.has_perm('commerce')));

grant select, insert, update, delete on public.promo_codes to authenticated;
create policy promo_staff on public.promo_codes for all to authenticated
  using ((select public.has_perm('commerce'))) with check ((select public.has_perm('commerce')));

grant select on public.orders, public.subscriptions to authenticated;
create policy orders_read on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('revenue')));
create policy subs_read on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('revenue')));

grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;
create policy banners_read on public.banners for select using (
  (is_active and starts_at <= now() and (ends_at is null or ends_at > now())) or (select public.has_perm('banners')));
create policy banners_write on public.banners for all to authenticated
  using ((select public.has_perm('banners'))) with check ((select public.has_perm('banners')));

-- ── Support ────────────────────────────────────────────────────────────
grant select, insert (subject), update (status, assigned_to) on public.support_tickets to authenticated;
create policy tickets_read on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('support')));
create policy tickets_insert on public.support_tickets for insert to authenticated with check (user_id = (select auth.uid()));
create policy tickets_update on public.support_tickets for update to authenticated
  using ((select public.has_perm('support'))) with check ((select public.has_perm('support')));
alter table public.support_tickets alter column user_id set default auth.uid();

grant select, insert (ticket_id, body) on public.ticket_messages to authenticated;
create policy tmsg_read on public.ticket_messages for select to authenticated using (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = (select auth.uid()) or (select public.has_perm('support')))));
create policy tmsg_insert on public.ticket_messages for insert to authenticated with check (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = (select auth.uid()) or (select public.has_perm('support')))));

-- ── Audit & metrics ────────────────────────────────────────────────────
grant select on public.audit_log, public.daily_metrics to authenticated;
create policy audit_read on public.audit_log for select to authenticated using ((select public.has_perm('audit')));
create policy metrics_read on public.daily_metrics for select to authenticated using ((select public.is_staff()));

grant usage on all sequences in schema public to authenticated;
