-- auth.uid()/auth.role() called directly in a policy expression gets
-- re-evaluated once PER ROW; wrapping it in (select ...) lets Postgres
-- evaluate it once per query instead (InitPlan). Same logic, faster at scale.
alter policy profiles_select_self on public.profiles
  using (id = (select auth.uid()) or app.is_platform_admin());

alter policy profiles_update_self on public.profiles
  using (id = (select auth.uid()) or app.is_platform_admin())
  with check (id = (select auth.uid()) or app.is_platform_admin());

alter policy roles_read on public.roles
  using ((select auth.role()) = 'authenticated');

alter policy perms_read on public.permissions
  using ((select auth.role()) = 'authenticated');

alter policy rp_read on public.role_permissions
  using ((select auth.role()) = 'authenticated');

alter policy uc_read on public.user_clients
  using (user_id = (select auth.uid()) or app.is_platform_admin());

alter policy ur_read on public.user_roles
  using (user_id = (select auth.uid()) or app.is_platform_admin());
