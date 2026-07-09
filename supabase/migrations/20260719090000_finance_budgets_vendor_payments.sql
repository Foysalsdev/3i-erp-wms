-- Budget monitoring (monthly, per department) + vendor dues (Credit AP): credit
-- purchases are settled by recorded vendor payments, which are the actual cash
-- outflow. Both tables follow the finance RLS/audit/touch pattern.

create table public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  department text not null default 'All',
  amount numeric not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, year, month, department)
);

create table public.finance_vendor_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  vendor_id uuid references public.finance_vendors(id) on delete set null,
  payment_date date not null default current_date,
  amount numeric not null default 0,
  method text,
  remarks text,
  expense_id uuid references public.finance_expenses(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_budgets enable row level security;
alter table public.finance_vendor_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['finance_budgets','finance_vendor_payments']
  loop
    execute format('create policy %1$I_select on public.%1$I for select using (app.has_client_access(client_id))', t);
    execute format('create policy %1$I_insert on public.%1$I for insert with check (app.has_client_access(client_id) and app.has_permission(''finance.create'', client_id))', t);
    execute format('create policy %1$I_update on public.%1$I for update using (app.has_client_access(client_id) and app.has_permission(''finance.edit'', client_id)) with check (app.has_client_access(client_id) and app.has_permission(''finance.edit'', client_id))', t);
    execute format('create policy %1$I_delete on public.%1$I for delete using (app.has_client_access(client_id) and app.has_permission(''finance.delete'', client_id))', t);
    execute format('create trigger t_%1$I_audit after insert or delete or update on public.%1$I for each row execute function app.audit_trigger()', t);
    execute format('create trigger t_%1$I_touch before update on public.%1$I for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;

create index on public.finance_vendor_payments (client_id, vendor_id);
create index on public.finance_vendor_payments (expense_id);

-- Extend period-lock: vendor payments dated in a submitted month lock too.
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
    (case when tg_op = 'DELETE' then j_old else j_new end)->>'adjustment_date',
    (case when tg_op = 'DELETE' then j_old else j_new end)->>'payment_date'
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
    v_old := coalesce(j_old->>'receipt_date', j_old->>'expense_date', j_old->>'adjustment_date', j_old->>'payment_date')::date;
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

create trigger t_finance_vendor_payments_period before insert or update or delete on public.finance_vendor_payments
  for each row execute function app.check_finance_period_open();
