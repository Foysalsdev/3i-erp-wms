-- Role management was gated purely on is_platform_admin(). Move it to the
-- app's own permission model: anyone whose app-role carries hr.role.manage
-- (or a platform admin) can manage roles. app.has_permission() already ORs in
-- is_platform_admin() and treats a null client as "any client".

-- roles ---------------------------------------------------------------------
drop policy if exists roles_admin_insert on public.roles;
drop policy if exists roles_admin_update on public.roles;
drop policy if exists roles_admin_delete on public.roles;

create policy roles_manage_insert on public.roles
  for insert with check (app.has_permission('hr.role.manage'));
create policy roles_manage_update on public.roles
  for update using (app.has_permission('hr.role.manage'))
  with check (app.has_permission('hr.role.manage'));
-- system roles stay undeletable even for role managers
create policy roles_manage_delete on public.roles
  for delete using (app.has_permission('hr.role.manage') and is_system = false);

-- role_permissions ----------------------------------------------------------
drop policy if exists rp_admin_insert on public.role_permissions;
drop policy if exists rp_admin_update on public.role_permissions;
drop policy if exists rp_admin_delete on public.role_permissions;

create policy rp_manage_insert on public.role_permissions
  for insert with check (app.has_permission('hr.role.manage'));
create policy rp_manage_update on public.role_permissions
  for update using (app.has_permission('hr.role.manage'))
  with check (app.has_permission('hr.role.manage'));
create policy rp_manage_delete on public.role_permissions
  for delete using (app.has_permission('hr.role.manage'));

-- Atomic, race-safe permission sync. The old client-side "delete all then
-- insert" was two round trips: a swallowed/failed delete left the old rows in
-- place and the re-insert collided on role_permissions_pkey ("duplicate key").
-- Doing it in one SECURITY DEFINER call removes the race and surfaces a real
-- permission error instead of a confusing constraint violation.
create or replace function public.set_role_permissions(p_role_id uuid, p_permission_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app.has_permission('hr.role.manage') then
    raise exception 'Access denied: role management permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.roles where id = p_role_id) then
    raise exception 'Role % not found', p_role_id;
  end if;

  delete from public.role_permissions where role_id = p_role_id;
  if p_permission_ids is not null and array_length(p_permission_ids, 1) is not null then
    insert into public.role_permissions(role_id, permission_id)
    select p_role_id, pid from unnest(p_permission_ids) as pid
    on conflict (role_id, permission_id) do nothing;
  end if;
end;
$$;

revoke all on function public.set_role_permissions(uuid, uuid[]) from public, anon;
grant execute on function public.set_role_permissions(uuid, uuid[]) to authenticated;
