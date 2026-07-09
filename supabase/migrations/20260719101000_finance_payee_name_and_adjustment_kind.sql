-- Dues move from vendor_id-keyed to payee_name-keyed, since Vendor/Payee is
-- becoming a free-text field everywhere (no master list requirement). Every
-- finance_expenses row has always had payee_name populated (ProcurementForm
-- copied it from the linked vendor at save time), so this is safe for old
-- rows too - only finance_vendor_payments needs a backfill to match.
alter table public.finance_vendor_payments
  add column if not exists payee_name text;

update public.finance_vendor_payments p
set payee_name = v.name
from public.finance_vendors v
where p.vendor_id = v.id and p.payee_name is null;

-- Distinguish Top-up/Replenishment entries from Opening Balance / one-off
-- corrections within the same signed-adjustment table.
alter table public.finance_balance_adjustments
  add column if not exists kind text not null default 'correction';
alter table public.finance_balance_adjustments
  add constraint finance_balance_adjustments_kind_check check (kind in ('opening', 'topup', 'correction'));

update public.finance_balance_adjustments
set kind = 'opening'
where remarks ilike 'opening balance%';
