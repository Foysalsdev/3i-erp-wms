-- Sales orders are created with status 'pending' (see OutboundSalesOrders.tsx
-- SOForm default) and, until now, nothing stopped the warehouse from picking
-- against an order nobody had actually approved — the status dropdown let any
-- editor jump straight to 'approved'. Add an audit trail for the approval
-- itself (who, when) so the new Approve action has somewhere to record it.
alter table public.sales_orders
  add column approved_by uuid references public.profiles(id),
  add column approved_at timestamptz;
