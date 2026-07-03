-- The outbound workflow (workflow.ts) and the SAP invoice-entry modal
-- (OutboundSalesOrders.tsx) treat 'invoiced' as a valid sales_orders status,
-- but the check constraint never included it, so "Mark Invoiced" failed with
-- a check-constraint violation. Add it to the allowed set.
alter table public.sales_orders drop constraint sales_orders_status_check;

alter table public.sales_orders add constraint sales_orders_status_check
  check (status = any (array['draft'::text, 'pending'::text, 'approved'::text, 'picking'::text, 'packed'::text, 'invoiced'::text, 'dispatched'::text, 'delivered'::text, 'closed'::text, 'cancelled'::text]));
