-- PO-first outbound workflow: payment capture, prework price split, serial linkage
-- Additive + idempotent. Safe to run on the live DB.

-- 1) Payment / deposit capture on the order header (dealer PO intake)
alter table public.sales_orders
  add column if not exists deposited_amount numeric not null default 0,
  add column if not exists deposited_date date,
  add column if not exists payment_status text not null default 'unpaid',  -- unpaid | partial | paid
  add column if not exists mail_ref text;                                   -- chain-mail subject / multi-dealer grouping

-- 2) Keep basic price and VAT rate separate on order lines (needed for SAP prework)
alter table public.sales_order_items
  add column if not exists basic_price numeric not null default 0,
  add column if not exists vat_rate numeric not null default 15;

-- 3) Cleaner serial -> order line linkage (serials captured at the scan stage)
alter table public.serial_numbers
  add column if not exists so_item_id uuid references public.sales_order_items(id);

create index if not exists serial_numbers_so_item_id_idx on public.serial_numbers (so_item_id);
create index if not exists serial_numbers_reference_no_idx on public.serial_numbers (reference_no);
