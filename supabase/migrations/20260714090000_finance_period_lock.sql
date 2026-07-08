-- Period close: once a month's statement is submitted, its transactions are
-- locked. Submitting only snapshotted the figures before — nothing stopped a
-- receipt/expense from being edited afterwards, silently diverging from what
-- Head Office received. This enforces it in the database: any insert/update/
-- delete of a receipt, expense or balance adjustment dated in a submitted
-- month is rejected until the month is reopened.
create or replace function app.check_finance_period_open()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_client uuid;
  v_date   date;
  v_old    date;
begin
  if tg_op = 'DELETE' then v_client := old.client_id; else v_client := new.client_id; end if;

  v_date := case tg_table_name
    when 'finance_fund_receipts'      then (case when tg_op = 'DELETE' then old.receipt_date    else new.receipt_date end)
    when 'finance_expenses'           then (case when tg_op = 'DELETE' then old.expense_date    else new.expense_date end)
    when 'finance_balance_adjustments' then (case when tg_op = 'DELETE' then old.adjustment_date else new.adjustment_date end)
  end;

  if v_date is not null and exists (
    select 1 from public.finance_monthly_adjustments a
    where a.client_id = v_client
      and a.year = extract(year from v_date)::int
      and a.month = extract(month from v_date)::int
      and a.submitted_at is not null
  ) then
    raise exception 'Finance period % is submitted (locked). Reopen that month''s statement before changing its transactions.', to_char(v_date, 'Mon YYYY');
  end if;

  -- Moving a row OUT of a locked month is also a change to that month.
  if tg_op = 'UPDATE' then
    v_old := case tg_table_name
      when 'finance_fund_receipts'       then old.receipt_date
      when 'finance_expenses'            then old.expense_date
      when 'finance_balance_adjustments' then old.adjustment_date
    end;
    if v_old is not null and v_old <> v_date and exists (
      select 1 from public.finance_monthly_adjustments a
      where a.client_id = old.client_id
        and a.year = extract(year from v_old)::int and a.month = extract(month from v_old)::int
        and a.submitted_at is not null
    ) then
      raise exception 'Finance period % is submitted (locked).', to_char(v_old, 'Mon YYYY');
    end if;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;

create trigger t_finance_fund_receipts_period before insert or update or delete on public.finance_fund_receipts
  for each row execute function app.check_finance_period_open();
create trigger t_finance_expenses_period before insert or update or delete on public.finance_expenses
  for each row execute function app.check_finance_period_open();
create trigger t_finance_balance_adjustments_period before insert or update or delete on public.finance_balance_adjustments
  for each row execute function app.check_finance_period_open();
