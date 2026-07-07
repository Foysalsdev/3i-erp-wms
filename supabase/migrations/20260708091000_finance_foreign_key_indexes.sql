-- Matches the fix already applied to every other table in
-- 20260706190000_add_missing_foreign_key_indexes.sql — the finance tables
-- landed one day later with none. requisition_id/expense_id are filtered
-- directly by the UI (Requisitions.tsx, Expenses.tsx) and client_id backs
-- every RLS policy on these tables.
create index if not exists idx_finance_requisitions_client_id on public.finance_requisitions (client_id);
create index if not exists idx_finance_requisition_lines_client_id on public.finance_requisition_lines (client_id);
create index if not exists idx_finance_requisition_lines_requisition_id on public.finance_requisition_lines (requisition_id);
create index if not exists idx_finance_fund_receipts_client_id on public.finance_fund_receipts (client_id);
create index if not exists idx_finance_fund_receipts_requisition_id on public.finance_fund_receipts (requisition_id);
create index if not exists idx_finance_expense_categories_client_id on public.finance_expense_categories (client_id);
create index if not exists idx_finance_expenses_client_id on public.finance_expenses (client_id);
create index if not exists idx_finance_expenses_category_id on public.finance_expenses (category_id);
create index if not exists idx_finance_expense_bills_client_id on public.finance_expense_bills (client_id);
create index if not exists idx_finance_expense_bills_expense_id on public.finance_expense_bills (expense_id);
create index if not exists idx_finance_monthly_adjustments_client_id on public.finance_monthly_adjustments (client_id);
