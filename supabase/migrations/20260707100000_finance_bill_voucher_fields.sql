-- Some expenses (Dinner Bill, Labour Bill, Accommodation Rent, Electricity
-- Bill, ...) don't arrive with an external vendor bill — 3i Logistics has to
-- generate its own printed bill/voucher, get it signed, and keep it as the
-- record. These fields let any expense's category (already a dynamic,
-- creatable list — Dinner Bill / Labour Bill / etc. are just categories)
-- double as the printed document's title, with the line items rendered as a
-- proper Particulars/Unit/Qty/Rate/Amount table plus a summation block.
alter table public.finance_expenses
  add column if not exists project text,
  add column if not exists bill_ref text,
  add column if not exists less_deduction numeric not null default 0,
  add column if not exists sign_labels text,
  add column if not exists show_line_signature boolean not null default false;

alter table public.finance_expense_bills
  add column if not exists unit text,
  add column if not exists qty numeric,
  add column if not exists rate numeric,
  add column if not exists remarks text;
