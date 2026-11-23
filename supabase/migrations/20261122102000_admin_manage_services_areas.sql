-- السماح للإدارة بإدارة أقسام الخدمات والمناطق من التطبيق
create policy "admin manage services" on public.services for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin manage areas" on public.areas for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant insert, update on public.services, public.areas to authenticated;
