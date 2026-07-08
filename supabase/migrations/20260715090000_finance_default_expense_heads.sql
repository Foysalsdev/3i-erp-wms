-- Preset the common warehouse expense heads so the Voucher form's head
-- dropdown is useful from day one; users can still add their own (the head
-- picker is a creatable combobox). Seeded per client, skipping any that
-- already exist (case-insensitive) so re-running is safe.
insert into public.finance_expense_categories (client_id, name)
select c.id, h.name
from public.clients c
cross join (values
  ('Accommodation Rent'), ('Courier Handover'), ('Fuel'), ('Stationery'), ('Labour')
) as h(name)
where not exists (
  select 1 from public.finance_expense_categories e
  where e.client_id = c.id and lower(e.name) = lower(h.name)
);
