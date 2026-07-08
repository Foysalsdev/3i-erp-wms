-- Reframe an expense from "a bill/voucher" to a general purchase record that
-- covers all spending, small to large. Add how it was paid and the vendor's
-- own bill number (when the purchase came with one); the self-generated
-- voucher stays optional on top of this. Line items remain optional — a small
-- cash purchase can be a single amount, a larger one an itemised breakdown.
alter table public.finance_expenses add column if not exists payment_mode text;
alter table public.finance_expenses add column if not exists vendor_bill_no text;
