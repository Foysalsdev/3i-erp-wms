-- 1. A rejected order needs its own status (was missing) plus who/when/why.
alter table public.sales_orders drop constraint sales_orders_status_check;
alter table public.sales_orders add constraint sales_orders_status_check
  check (status = any (array['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'picking'::text, 'packed'::text, 'invoiced'::text, 'dispatched'::text, 'delivered'::text, 'closed'::text, 'cancelled'::text]));

alter table public.sales_orders
  add column rejected_by uuid references public.profiles(id),
  add column rejected_at timestamptz,
  add column rejection_reason text;

-- 2. sales_orders_update required outbound.edit only. The seeded "Warehouse
--    Manager" role has outbound.approve but NOT outbound.edit (approval is
--    meant to be a separate access from general SO editing), so the
--    Approve/Reject/Undo actions would silently fail this RLS check for
--    that role. Accept either permission.
drop policy if exists sales_orders_update on public.sales_orders;
create policy sales_orders_update on public.sales_orders
  for update
  using (app.has_client_access(client_id) and (app.has_permission('outbound.edit', client_id) or app.has_permission('outbound.approve', client_id)))
  with check (app.has_client_access(client_id) and (app.has_permission('outbound.edit', client_id) or app.has_permission('outbound.approve', client_id)));
