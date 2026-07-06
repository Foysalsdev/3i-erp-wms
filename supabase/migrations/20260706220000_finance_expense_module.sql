-- Finance module: operating-cost requisition -> fund receipt -> expense
-- tracking (petty-cash style, not inventory billing). A Deputy Manager
-- raises a requisition against 3i Logistics (Whirlpool project); approval
-- happens outside the system, so requisitions have no status workflow and
-- can simply be revised. Money received against a requisition is recorded
-- (possibly partial, possibly never fully received), and expenses are
-- recorded against the overall running balance rather than against any one
-- requisition, since the balance can legitimately go negative when the
-- manager spends from pocket ahead of reimbursement. finance_monthly_adjustments
-- is the once-a-month statement submitted to Head Office to settle the period.

create table public.finance_requisitions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  req_no text not null,
  req_date date not null default current_date,
  sender_name text,
  grand_total numeric not null default 0,
  remarks text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, req_no)
);

create table public.finance_requisition_lines (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  requisition_id uuid not null references public.finance_requisitions(id) on delete cascade,
  purpose text not null,
  amount numeric not null default 0,
  unit text,
  qty numeric,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_fund_receipts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  requisition_id uuid not null references public.finance_requisitions(id) on delete cascade,
  receipt_date date not null default current_date,
  amount numeric not null default 0,
  remarks text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_expense_categories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, name)
);

create table public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  expense_date date not null default current_date,
  category_id uuid references public.finance_expense_categories(id) on delete set null,
  payee_name text,
  description text,
  amount numeric not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_expense_bills (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  expense_id uuid not null references public.finance_expenses(id) on delete cascade,
  bill_ref text,
  amount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_monthly_adjustments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  total_fund_received numeric not null default 0,
  total_expense numeric not null default 0,
  closing_balance numeric not null default 0,
  submitted_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, year, month)
);

-- RLS + audit/touch triggers, matching the courier_rates / purchase_requisitions pattern.
alter table public.finance_requisitions enable row level security;
alter table public.finance_requisition_lines enable row level security;
alter table public.finance_fund_receipts enable row level security;
alter table public.finance_expense_categories enable row level security;
alter table public.finance_expenses enable row level security;
alter table public.finance_expense_bills enable row level security;
alter table public.finance_monthly_adjustments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'finance_requisitions', 'finance_requisition_lines', 'finance_fund_receipts',
    'finance_expense_categories', 'finance_expenses', 'finance_expense_bills',
    'finance_monthly_adjustments'
  ]
  loop
    execute format('create policy %1$I_select on public.%1$I for select using (app.has_client_access(client_id))', t);
    execute format('create policy %1$I_insert on public.%1$I for insert with check (app.has_client_access(client_id) and app.has_permission(''finance.create'', client_id))', t);
    execute format('create policy %1$I_update on public.%1$I for update using (app.has_client_access(client_id) and app.has_permission(''finance.edit'', client_id)) with check (app.has_client_access(client_id) and app.has_permission(''finance.edit'', client_id))', t);
    execute format('create policy %1$I_delete on public.%1$I for delete using (app.has_client_access(client_id) and app.has_permission(''finance.delete'', client_id))', t);
    execute format('create trigger t_%1$I_audit after insert or delete or update on public.%1$I for each row execute function app.audit_trigger()', t);
    execute format('create trigger t_%1$I_touch before update on public.%1$I for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;
