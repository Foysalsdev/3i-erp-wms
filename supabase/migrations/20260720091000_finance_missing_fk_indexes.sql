-- Covering indexes for the eight finance foreign keys flagged by the
-- Supabase performance advisor (unindexed_foreign_keys). Without them,
-- lookups/joins on these columns and cascading deletes scan the whole table.
create index if not exists idx_finance_additional_expenses_client on public.finance_additional_expenses (client_id);
create index if not exists idx_finance_expense_bills_category on public.finance_expense_bills (category_id);
create index if not exists idx_finance_expense_bills_item on public.finance_expense_bills (item_id);
create index if not exists idx_finance_expenses_vendor on public.finance_expenses (vendor_id);
create index if not exists idx_finance_ho_submission_vouchers_client on public.finance_ho_submission_vouchers (client_id);
create index if not exists idx_finance_items_category on public.finance_items (category_id);
create index if not exists idx_finance_items_last_vendor on public.finance_items (last_vendor_id);
create index if not exists idx_finance_vendor_payments_vendor on public.finance_vendor_payments (vendor_id);
