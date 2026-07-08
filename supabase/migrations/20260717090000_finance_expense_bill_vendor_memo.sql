-- Purchase vouchers record several shop memos in one voucher. Each breakdown
-- line can carry the shop it was bought from and that shop's memo/bill number
-- (both optional — roadside purchases often have neither).
alter table public.finance_expense_bills
  add column if not exists vendor_name text,
  add column if not exists memo_no text;
