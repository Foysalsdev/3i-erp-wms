-- "project" was added for a print field that was removed one commit later
-- (the "Project: Whirlpool" line duplicated the letterhead) and never wired
-- back up — no code reads or writes it. Drop the dead column.
alter table public.finance_expenses drop column if exists project;
