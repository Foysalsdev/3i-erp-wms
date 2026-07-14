-- Add batch/lot number column to goods_receipt_items, used by the
-- Receive Wizard's batch number input.
alter table public.goods_receipt_items
  add column if not exists batch text;
