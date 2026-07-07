-- The B/D->C/D ledger is derived entirely from finance_fund_receipts and
-- finance_expenses, so a client starting to use this module mid-year has no
-- way to seed the real opening balance they were already carrying (from
-- manual/Excel tracking before this system existed) — nor any way to record
-- a one-off correction later (a bank charge, a rounding fix, etc.) without
-- it being misattributed as a real receipt or expense. This table is a
-- signed manual adjustment folded into the same running balance.
create table public.finance_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  adjustment_date date not null default current_date,
  amount numeric not null default 0,
  remarks text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finance_balance_adjustments_client_id on public.finance_balance_adjustments (client_id);

alter table public.finance_balance_adjustments enable row level security;

create policy finance_balance_adjustments_select on public.finance_balance_adjustments for select
  using (app.has_client_access(client_id));
create policy finance_balance_adjustments_insert on public.finance_balance_adjustments for insert
  with check (app.has_client_access(client_id) and app.has_permission('finance.create', client_id));
create policy finance_balance_adjustments_update on public.finance_balance_adjustments for update
  using (app.has_client_access(client_id) and app.has_permission('finance.edit', client_id))
  with check (app.has_client_access(client_id) and app.has_permission('finance.edit', client_id));
create policy finance_balance_adjustments_delete on public.finance_balance_adjustments for delete
  using (app.has_client_access(client_id) and app.has_permission('finance.delete', client_id));

create trigger t_finance_balance_adjustments_audit after insert or delete or update on public.finance_balance_adjustments
  for each row execute function app.audit_trigger();
create trigger t_finance_balance_adjustments_touch before update on public.finance_balance_adjustments
  for each row execute function app.touch_updated_at();
