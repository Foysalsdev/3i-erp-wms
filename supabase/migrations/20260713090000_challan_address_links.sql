-- Link a challan's Bill-To / Ship-To to the customer_addresses master (a
-- customer can have many addresses — head office to bill, branch stores to
-- ship). The address text is still copied onto the challan for print fidelity
-- and history; these columns record WHICH saved address was chosen. ON DELETE
-- SET NULL so removing a customer address never breaks an issued challan.
alter table public.delivery_challans
  add column if not exists bill_to_address_id uuid references public.customer_addresses(id) on delete set null,
  add column if not exists ship_to_address_id uuid references public.customer_addresses(id) on delete set null;

create index if not exists idx_delivery_challans_bill_to_address_id on public.delivery_challans (bill_to_address_id);
create index if not exists idx_delivery_challans_ship_to_address_id on public.delivery_challans (ship_to_address_id);
