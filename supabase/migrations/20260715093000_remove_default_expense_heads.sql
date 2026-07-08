-- Reverse the previous migration: expense heads should be created by the user
-- based on their own workflow, not preset by us. Remove the seeded defaults
-- that no expense references (used ones, if any, are left untouched).
delete from public.finance_expense_categories e
where e.name in ('Accommodation Rent', 'Courier Handover', 'Fuel', 'Stationery', 'Labour')
  and not exists (select 1 from public.finance_expenses x where x.category_id = e.id);
