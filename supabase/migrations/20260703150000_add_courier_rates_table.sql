-- Couriers charge per piece with a different rate per product category
-- (size class), and the rates change over time. One row per courier+category;
-- couriers.rate_per_unit stays as the fallback when a category has no rate.
-- Challans snapshot the computed bill into delivery_cost, so historical
-- challans keep the price that applied at the time.
create table public.courier_rates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  courier_id uuid not null references public.couriers(id) on delete cascade,
  category text not null,
  rate numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (courier_id, category)
);

alter table public.courier_rates enable row level security;

create policy courier_rates_select on public.courier_rates for select
  using (app.has_client_access(client_id));
create policy courier_rates_insert on public.courier_rates for insert
  with check (app.has_client_access(client_id) and app.has_permission('masters.create', client_id));
create policy courier_rates_update on public.courier_rates for update
  using (app.has_client_access(client_id) and app.has_permission('masters.edit', client_id))
  with check (app.has_client_access(client_id) and app.has_permission('masters.edit', client_id));
create policy courier_rates_delete on public.courier_rates for delete
  using (app.has_client_access(client_id) and app.has_permission('masters.delete', client_id));
