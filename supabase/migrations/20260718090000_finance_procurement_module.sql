-- Daily Operation Procurement: vendor + item masters (with last-price memory),
-- additional expenses, and header fields for a fast one-minute procurement entry.
-- Audit + updated_at triggers and RLS mirror the existing finance tables.

create table public.finance_vendors (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  contact_number text,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, name)
);

create table public.finance_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  category_id uuid references public.finance_expense_categories(id) on delete set null,
  unit text,
  last_price numeric,
  last_vendor_id uuid references public.finance_vendors(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, name)
);

create table public.finance_additional_expenses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  expense_id uuid not null references public.finance_expenses(id) on delete cascade,
  expense_type text,
  amount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_expenses
  add column if not exists procurement_type text default 'Daily Operation',
  add column if not exists vendor_id uuid references public.finance_vendors(id) on delete set null,
  add column if not exists due_date date,
  add column if not exists department text,
  add column if not exists doc_no text,
  add column if not exists status text not null default 'posted';

alter table public.finance_expense_bills
  add column if not exists item_id uuid references public.finance_items(id) on delete set null,
  add column if not exists category_id uuid references public.finance_expense_categories(id) on delete set null;

alter table public.finance_vendors enable row level security;
alter table public.finance_items enable row level security;
alter table public.finance_additional_expenses enable row level security;

do $$
declare t text;
begin
  foreach t in array array['finance_vendors','finance_items','finance_additional_expenses']
  loop
    execute format('create policy %1$I_select on public.%1$I for select using (app.has_client_access(client_id))', t);
    execute format('create policy %1$I_insert on public.%1$I for insert with check (app.has_client_access(client_id) and app.has_permission(''finance.create'', client_id))', t);
    execute format('create policy %1$I_update on public.%1$I for update using (app.has_client_access(client_id) and app.has_permission(''finance.edit'', client_id)) with check (app.has_client_access(client_id) and app.has_permission(''finance.edit'', client_id))', t);
    execute format('create policy %1$I_delete on public.%1$I for delete using (app.has_client_access(client_id) and app.has_permission(''finance.delete'', client_id))', t);
    execute format('create trigger t_%1$I_audit after insert or delete or update on public.%1$I for each row execute function app.audit_trigger()', t);
    execute format('create trigger t_%1$I_touch before update on public.%1$I for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;

create index on public.finance_items (client_id, category_id);
create index on public.finance_expenses (client_id, vendor_id);
create index on public.finance_additional_expenses (expense_id);
