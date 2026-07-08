-- Fix: the shared period-lock trigger referenced old/new.expense_date,
-- .receipt_date and .adjustment_date directly, but each table only has one of
-- those columns — so on finance_fund_receipts PL/pgSQL raised
-- 'record "old" has no field "expense_date"' and blocked every save. Read the
-- date through to_jsonb() instead, where a missing key is simply null.
create or replace function app.check_finance_period_open()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_client uuid;
  v_date   date;
  v_old    date;
  j_new    jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  j_old    jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  locked   boolean;
begin
  v_client := coalesce((j_new->>'client_id')::uuid, (j_old->>'client_id')::uuid);
  v_date := coalesce(
    (case when tg_op = 'DELETE' then j_old else j_new end)->>'receipt_date',
    (case when tg_op = 'DELETE' then j_old else j_new end)->>'expense_date',
    (case when tg_op = 'DELETE' then j_old else j_new end)->>'adjustment_date'
  )::date;

  if v_date is not null then
    select exists (
      select 1 from public.finance_monthly_adjustments a
      where a.client_id = v_client
        and a.year = extract(year from v_date)::int and a.month = extract(month from v_date)::int
        and a.submitted_at is not null
    ) into locked;
    if locked then
      raise exception 'Finance period % is submitted (locked). Reopen that month''s statement before changing its transactions.', to_char(v_date, 'Mon YYYY');
    end if;
  end if;

  if tg_op = 'UPDATE' then
    v_old := coalesce(j_old->>'receipt_date', j_old->>'expense_date', j_old->>'adjustment_date')::date;
    if v_old is not null and v_old is distinct from v_date then
      select exists (
        select 1 from public.finance_monthly_adjustments a
        where a.client_id = v_client
          and a.year = extract(year from v_old)::int and a.month = extract(month from v_old)::int
          and a.submitted_at is not null
      ) into locked;
      if locked then
        raise exception 'Finance period % is submitted (locked).', to_char(v_old, 'Mon YYYY');
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;
