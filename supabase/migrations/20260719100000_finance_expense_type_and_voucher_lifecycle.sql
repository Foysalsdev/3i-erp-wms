-- Broaden finance_expenses from "Procurement only" to all operational Expense
-- Types, and add the voucher lifecycle (collection -> ready -> submitted ->
-- verified) that HO Submission batching needs. expense_type is the fix for
-- the Dashboard "Uncategorized" bug: category_id was only ever populated by
-- copying the first item row's item-master category (never set for a
-- brand-new inline-created item), so the breakdown silently fell back to
-- "Uncategorized". expense_type is explicit, required, chosen at entry time,
-- and always a plain string - no lookup table, nothing to leave unset.
alter table public.finance_expenses
  add column if not exists expense_type text not null default 'Procurement',
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists doc_type text not null default 'vendor_voucher',
  add column if not exists voucher_status text not null default 'collected',
  add column if not exists is_draft boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists print_count int not null default 0,
  add column if not exists submission_id uuid;

alter table public.finance_expenses
  add constraint finance_expenses_expense_type_check check (expense_type in (
    'Procurement', 'Labour', 'Maintenance', 'Rent', 'Fuel', 'Utility Bill',
    'Refreshment', 'Transport Expense', 'Service Charge', 'Others'
  ));
alter table public.finance_expenses
  add constraint finance_expenses_doc_type_check check (doc_type in ('vendor_voucher', 'internal_voucher', 'no_document'));
alter table public.finance_expenses
  add constraint finance_expenses_voucher_status_check check (voucher_status in
    ('pending_collection', 'collected', 'lost', 'submitted', 'verified'));

create index if not exists idx_finance_expenses_expense_type on public.finance_expenses (client_id, expense_type);
create index if not exists idx_finance_expenses_voucher_status on public.finance_expenses (client_id, voucher_status);
create index if not exists idx_finance_expenses_submission_id on public.finance_expenses (submission_id);

create table public.finance_ho_submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  submission_no text not null,
  submission_date date not null default current_date,
  voucher_count int not null default 0,
  total_amount numeric not null default 0,
  remarks text,
  category_order jsonb not null default '[]'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'verified')),
  verified_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, submission_no)
);

create table public.finance_ho_submission_vouchers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  submission_id uuid not null references public.finance_ho_submissions(id) on delete cascade,
  expense_id uuid not null references public.finance_expenses(id) on delete cascade,
  sl_no int not null,
  category_label text not null,
  returned_at timestamptz,
  return_note text,
  created_at timestamptz not null default now()
);

alter table public.finance_expenses
  add constraint finance_expenses_submission_id_fkey foreign key (submission_id)
  references public.finance_ho_submissions(id) on delete set null;

alter table public.finance_ho_submissions enable row level security;
alter table public.finance_ho_submission_vouchers enable row level security;

do $$
declare t text;
begin
  foreach t in array array['finance_ho_submissions', 'finance_ho_submission_vouchers']
  loop
    execute format('create policy %1$I_select on public.%1$I for select using (app.has_client_access(client_id))', t);
    execute format('create policy %1$I_insert on public.%1$I for insert with check (app.has_client_access(client_id) and app.has_permission(''finance.create'', client_id))', t);
    execute format('create policy %1$I_update on public.%1$I for update using (app.has_client_access(client_id) and app.has_permission(''finance.edit'', client_id)) with check (app.has_client_access(client_id) and app.has_permission(''finance.edit'', client_id))', t);
    execute format('create policy %1$I_delete on public.%1$I for delete using (app.has_client_access(client_id) and app.has_permission(''finance.delete'', client_id))', t);
    execute format('create trigger t_%1$I_audit after insert or delete or update on public.%1$I for each row execute function app.audit_trigger()', t);
    execute format('create trigger t_%1$I_touch before update on public.%1$I for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;

create index on public.finance_ho_submission_vouchers (submission_id);
create index on public.finance_ho_submission_vouchers (expense_id);

-- A submitted voucher is locked: no update/delete once submission_id is set,
-- except the specific "Unlock" transition that clears it back to null. Mirrors
-- the existing app.check_finance_period_open() month-lock precedent, just at
-- the single-voucher grain instead of the whole month.
create or replace function app.check_finance_expense_lock()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if tg_op = 'DELETE' then
    if old.submission_id is not null then
      raise exception 'This voucher is submitted to Head Office (locked). Unlock it first.';
    end if;
    return old;
  end if;
  if old.submission_id is not null and new.submission_id is not distinct from old.submission_id then
    raise exception 'This voucher is submitted to Head Office (locked). Unlock it first.';
  end if;
  return new;
end;
$function$;

create trigger t_finance_expenses_lock before update or delete on public.finance_expenses
  for each row execute function app.check_finance_expense_lock();
