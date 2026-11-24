-- أسماء مقاييس السوق الجديدة في site_stats_daily (m_*) + تحديث الدوال لاستخدامها
alter table public.site_stats_daily drop constraint site_stats_daily_metric_check;
alter table public.site_stats_daily add constraint site_stats_daily_metric_check check (metric = any (array[
  'visit','search','call','whatsapp','company_view','ad_view','ad_click','join_submit','ad_submit','signup',
  'm_visit','m_search','m_ad_view','m_call','m_whatsapp','m_post','m_sold','m_report']));

create or replace function public.track_market(p_kind text, p_ad bigint default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_metric text;
begin
  v_metric := case p_kind when 'm_visit' then 'm_visit' when 'm_search' then 'm_search' when 'ad_view' then 'm_ad_view'
                          when 'ad_call' then 'm_call' when 'ad_whatsapp' then 'm_whatsapp' end;
  if v_metric is null then return; end if;
  if p_ad is not null and not exists (select 1 from public.market_ads a where a.id = p_ad and a.status in ('active','sold')) then return; end if;
  if p_kind <> 'm_search' and not private.first_today(v_metric, p_ad) then return; end if;
  perform public.bump_stat(v_metric);
  if p_ad is not null then
    update public.market_ads set
      views = views + (p_kind = 'ad_view')::int,
      calls = calls + (p_kind = 'ad_call')::int,
      wa_taps = wa_taps + (p_kind = 'ad_whatsapp')::int
    where id = p_ad;
  end if;
end $$;

-- guard_market_ad / report_market_ad / admin_market_stats: نفس التعريف في 20261124_v5_marketplace.sql
-- مع استبدال: ad_post→m_post، ad_sold→m_sold، ad_report→m_report، (ad_call,ad_whatsapp)→(m_call,m_whatsapp)
