-- FIKRA SELL · 0011 · Function execute allow-list
-- Supabase grants EXECUTE on new functions to anon/authenticated by default.
-- Revoke everything, then grant only what each role must call.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema private revoke execute on functions from anon, authenticated;

-- Used inside RLS policies (must be callable by the querying role).
grant usage on schema private to anon, authenticated;
grant execute on function
  public.normalize_ar(text), public.fuzzy_word_match(text, text), public.setting(text, jsonb), public.current_role_level(), public.is_staff(),
  public.has_perm(text), public.is_blocked_between(uuid, uuid), public.is_participant(uuid)
to anon, authenticated;
grant execute on function private.storage_user_ok() to authenticated;

-- Public RPCs (guests and members)
grant execute on function
  public.search_ads(jsonb), public.search_suggestions(text), public.log_search(text),
  public.record_ad_event(bigint, text), public.track_app_open(), public.banner_event(int, text),
  public.quote_package(int, text)
to anon, authenticated;

-- Member RPCs (each re-checks auth.uid(); admin_* re-check permissions)
grant execute on function
  public.bump_ad(bigint), public.renew_ad(bigint), public.start_conversation(bigint),
  public.mark_conversation_read(uuid), public.hide_conversation(uuid), public.my_counters(),
  public.mark_all_notifications_read(), public.register_push_token(text, text), public.delete_my_account(),
  public.create_order(int, bigint, text),
  public.admin_stats(), public.admin_set_ad_status(bigint, public.ad_status, text), public.admin_promote_ad(bigint, text, int),
  public.admin_set_ban(uuid, boolean, text), public.admin_set_role(uuid, public.user_role, text[]),
  public.admin_list_users(text, text, int, int), public.admin_resolve_report(bigint, public.report_status, text, text),
  public.admin_report_messages(bigint), public.admin_broadcast(text, text, text, text, text, text),
  public.admin_grant_package(uuid, int, bigint, numeric, text), public.admin_revenue()
to authenticated;
