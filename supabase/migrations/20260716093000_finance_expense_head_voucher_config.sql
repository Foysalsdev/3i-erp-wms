-- Each expense head carries a small voucher-behaviour config so the single
-- Voucher form auto-adapts when the head is picked (still user-overridable):
--   voucher_mode: 'single' (one amount), 'itemised' (breakdown grid),
--                 'handover' (fund handover to manager — no breakdown/vendor bill)
--   default_line_signature: turn on the per-line signature column (Labour)
--   default_sign_labels: pre-fill the voucher's signature role labels
--   owner_copy_required: show an "owner copy required" note (Accommodation)
alter table public.finance_expense_categories
  add column if not exists voucher_mode text not null default 'single',
  add column if not exists default_line_signature boolean not null default false,
  add column if not exists default_sign_labels text,
  add column if not exists owner_copy_required boolean not null default false;
