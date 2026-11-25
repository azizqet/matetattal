-- =====================================================================
-- FAZZA — explicit function allowlist.
-- Supabase's default privileges grant EXECUTE on new functions to anon/authenticated.
-- We revoke everything and grant back only the client-facing API.
-- =====================================================================
do $$
declare
  f record;
  anon_allowed text[] := array['distance_m', 'normalize_kw_phone', 'calc_commission_fils', 'is_admin', 'is_approved_driver'];
  user_allowed text[] := array[
    'distance_m', 'normalize_kw_phone', 'calc_commission_fils', 'is_admin', 'is_approved_driver', 'is_order_participant',
    'can_read_order_file', 'can_write_order_file',
    'set_active_mode', 'clear_must_change_password', 'register_push_token', 'unregister_push_token', 'mark_notifications_read',
    'register_driver', 'set_online', 'driver_dashboard', 'create_order', 'driver_open_orders', 'get_order', 'get_order_offers',
    'submit_offer', 'withdraw_offer', 'reject_offer', 'accept_offer', 'driver_update_status', 'confirm_delivery', 'cancel_order',
    'update_my_location', 'mark_messages_read', 'rate_order', 'my_ratings', 'submit_receipt', 'redeem_promo', 'create_ticket',
    'add_ticket_message',
    'admin_me', 'admin_stats', 'admin_review_driver', 'admin_set_document_status', 'admin_set_user_status', 'admin_set_phone_verified',
    'admin_review_receipt', 'admin_ledger_entry', 'admin_update_settings', 'admin_upsert_area', 'admin_upsert_governorate',
    'admin_upsert_promo', 'admin_update_ticket', 'admin_hide_rating', 'admin_broadcast', 'admin_cancel_order', 'admin_set_admin',
    'admin_active_driver_locations', 'admin_financial_report', 'admin_search_users'];
  service_allowed text[] := array['prepare_account_deletion', 'run_maintenance', 'service_audit', 'login_lock_status',
    'login_record_failure', 'login_record_success', 'account_status_by_phone', 'phone_exists', 'revoke_user_sessions',
    'set_must_change_password', 'hit_rate_limit'];
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if f.proname = any(anon_allowed) then execute format('grant execute on function %s to anon', f.sig); end if;
    if f.proname = any(user_allowed) then execute format('grant execute on function %s to authenticated', f.sig); end if;
    if f.proname = any(service_allowed) then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $$;

alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
