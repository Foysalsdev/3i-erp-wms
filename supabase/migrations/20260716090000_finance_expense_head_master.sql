-- Make expense heads a proper master: a short code and an active flag, managed
-- from a Finance → Setup screen. Vouchers pick from the active heads instead of
-- typing a category inline.
alter table public.finance_expense_categories add column if not exists code text;
alter table public.finance_expense_categories add column if not exists is_active boolean not null default true;
