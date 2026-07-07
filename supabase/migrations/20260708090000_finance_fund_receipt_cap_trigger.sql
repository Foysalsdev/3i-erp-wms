-- The Requisitions.tsx form already blocks entering a receipt that would
-- exceed the requisition's grand_total, but that check runs against
-- already-fetched client state, so two concurrent inserts (two browser
-- tabs, a retried request) could each pass the client check and still land
-- both rows in the database. Enforce the same cap server-side, matching how
-- app.post_stock_movement() rejects a movement that would drive quantity
-- negative inside the database function rather than trusting the caller.
create or replace function app.check_fund_receipt_cap()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_grand_total numeric;
  v_other_total numeric;
begin
  select grand_total into v_grand_total from public.finance_requisitions where id = new.requisition_id;
  select coalesce(sum(amount), 0) into v_other_total from public.finance_fund_receipts
    where requisition_id = new.requisition_id and id <> new.id;

  if v_other_total + new.amount > v_grand_total + 0.01 then
    raise exception 'Fund receipt of % would exceed this requisition''s requested amount of % (already received: %)',
      new.amount, v_grand_total, v_other_total;
  end if;
  return new;
end;
$$;

create trigger t_finance_fund_receipts_cap
  before insert or update on public.finance_fund_receipts
  for each row execute function app.check_fund_receipt_cap();
