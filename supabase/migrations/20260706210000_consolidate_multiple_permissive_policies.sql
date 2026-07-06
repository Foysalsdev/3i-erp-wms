-- Each of these 10 tables had a platform-admin "FOR ALL" policy sitting
-- alongside a narrower SELECT (or, for inventory_stock/serial_numbers, a
-- permission-gated write) policy. Since FOR ALL includes SELECT, Postgres
-- evaluated both permissive policies on every SELECT (multiple_permissive_
-- policies advisor). Where the narrow policy didn't already grant admins
-- access, its condition gets an explicit "or app.is_platform_admin()"; the
-- admin policy is then split into INSERT/UPDATE/DELETE only (SELECT no
-- longer needed from it), which is functionally identical to the old FOR ALL
-- policy but no longer double-evaluated on reads. Where the narrow policy
-- already included the admin bypass (profiles/user_clients/user_roles), no
-- merge is needed at all.

-- clients
alter policy clients_select on public.clients using (app.has_client_access(id) or app.is_platform_admin());
drop policy clients_admin on public.clients;
create policy clients_admin_insert on public.clients for insert with check (app.is_platform_admin());
create policy clients_admin_update on public.clients for update using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy clients_admin_delete on public.clients for delete using (app.is_platform_admin());

-- document_sequences
alter policy docseq_read on public.document_sequences using (app.has_client_access(client_id) or app.is_platform_admin());
drop policy docseq_admin on public.document_sequences;
create policy docseq_admin_insert on public.document_sequences for insert with check (app.is_platform_admin());
create policy docseq_admin_update on public.document_sequences for update using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy docseq_admin_delete on public.document_sequences for delete using (app.is_platform_admin());

-- inventory_stock (write policy is permission-gated, not platform-admin; the
-- select policy already covers reads for anyone with client access, so no
-- merge needed there — just stop the write policy from also matching SELECT)
drop policy invstock_write on public.inventory_stock;
create policy invstock_write_insert on public.inventory_stock for insert
  with check (app.has_client_access(client_id) and app.has_permission('inventory.adjust', client_id));
create policy invstock_write_update on public.inventory_stock for update
  using (app.has_client_access(client_id) and app.has_permission('inventory.adjust', client_id))
  with check (app.has_client_access(client_id) and app.has_permission('inventory.adjust', client_id));
create policy invstock_write_delete on public.inventory_stock for delete
  using (app.has_client_access(client_id) and app.has_permission('inventory.adjust', client_id));

-- permissions
alter policy perms_read on public.permissions using ((select auth.role()) = 'authenticated' or app.is_platform_admin());
drop policy perms_admin on public.permissions;
create policy perms_admin_insert on public.permissions for insert with check (app.is_platform_admin());
create policy perms_admin_update on public.permissions for update using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy perms_admin_delete on public.permissions for delete using (app.is_platform_admin());

-- profiles: profiles_select_self and profiles_update_self already contain
-- "or app.is_platform_admin()", so the admin policy only still earns its
-- keep for insert/delete.
drop policy profiles_admin on public.profiles;
create policy profiles_admin_insert on public.profiles for insert with check (app.is_platform_admin());
create policy profiles_admin_delete on public.profiles for delete using (app.is_platform_admin());

-- role_permissions
alter policy rp_read on public.role_permissions using ((select auth.role()) = 'authenticated' or app.is_platform_admin());
drop policy rp_admin on public.role_permissions;
create policy rp_admin_insert on public.role_permissions for insert with check (app.is_platform_admin());
create policy rp_admin_update on public.role_permissions for update using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy rp_admin_delete on public.role_permissions for delete using (app.is_platform_admin());

-- roles
alter policy roles_read on public.roles using ((select auth.role()) = 'authenticated' or app.is_platform_admin());
drop policy roles_admin on public.roles;
create policy roles_admin_insert on public.roles for insert with check (app.is_platform_admin());
create policy roles_admin_update on public.roles for update using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy roles_admin_delete on public.roles for delete using (app.is_platform_admin());

-- serial_numbers (same reasoning as inventory_stock)
drop policy serial_write on public.serial_numbers;
create policy serial_write_insert on public.serial_numbers for insert
  with check (app.has_client_access(client_id) and app.has_permission('inventory.adjust', client_id));
create policy serial_write_update on public.serial_numbers for update
  using (app.has_client_access(client_id) and app.has_permission('inventory.adjust', client_id))
  with check (app.has_client_access(client_id) and app.has_permission('inventory.adjust', client_id));
create policy serial_write_delete on public.serial_numbers for delete
  using (app.has_client_access(client_id) and app.has_permission('inventory.adjust', client_id));

-- user_clients: uc_read already contains "or app.is_platform_admin()".
drop policy uc_admin on public.user_clients;
create policy uc_admin_insert on public.user_clients for insert with check (app.is_platform_admin());
create policy uc_admin_update on public.user_clients for update using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy uc_admin_delete on public.user_clients for delete using (app.is_platform_admin());

-- user_roles: ur_read already contains "or app.is_platform_admin()".
drop policy ur_admin on public.user_roles;
create policy ur_admin_insert on public.user_roles for insert with check (app.is_platform_admin());
create policy ur_admin_update on public.user_roles for update using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy ur_admin_delete on public.user_roles for delete using (app.is_platform_admin());
